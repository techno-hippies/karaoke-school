// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "../FSRSTrackerV1.sol";

/**
 * @title FSRSTrackerV1Test
 * @notice Tests for FSRSTrackerV1 contract
 */
contract FSRSTrackerV1Test is Test {
    FSRSTrackerV1 tracker;

    address owner = address(this);
    address trustedPKP = address(0x1234);
    address user = address(0x5678);
    address attacker = address(0x9ABC);

    string constant SONG_ID = "heat-of-the-night-scarlett-x";
    string constant SEGMENT_ID = "chorus-1-1";

    function setUp() public {
        tracker = new FSRSTrackerV1(trustedPKP);
    }

    // ============================================================
    // DEPLOYMENT TESTS
    // ============================================================

    function test_Deployment() public view {
        assertEq(tracker.owner(), owner);
        assertEq(tracker.trustedPKP(), trustedPKP);
        assertEq(tracker.paused(), false);
        assertEq(tracker.MAX_LINE_COUNT(), 100);
    }

    function test_RevertWhen_DeployWithZeroAddress() public {
        vm.expectRevert(FSRSTrackerV1.InvalidAddress.selector);
        new FSRSTrackerV1(address(0));
    }

    // ============================================================
    // UPDATE CARD TESTS
    // ============================================================

    function test_UpdateCard() public {
        FSRSTrackerV1.Card memory newCard = FSRSTrackerV1.Card({
            due: uint40(block.timestamp + 1 days),
            stability: 100, // 1.0 day * 100
            difficulty: 50,  // 5.0 * 10
            elapsedDays: 0,
            scheduledDays: 10, // 1.0 day * 10
            reps: 1,
            lapses: 0,
            state: uint8(FSRSTrackerV1.CardState.Learning),
            lastReview: uint40(block.timestamp)
        });

        // Mock PKP calling updateCard
        vm.prank(trustedPKP);
        tracker.updateCard(user, SONG_ID, SEGMENT_ID, 0, 2, 85, newCard);

        // Verify card was stored
        FSRSTrackerV1.Card memory stored = tracker.getCard(user, SONG_ID, SEGMENT_ID, 0);
        assertEq(stored.due, newCard.due);
        assertEq(stored.stability, newCard.stability);
        assertEq(stored.difficulty, newCard.difficulty);
        assertEq(stored.reps, 1);
        assertEq(stored.state, uint8(FSRSTrackerV1.CardState.Learning));
    }

    function test_RevertWhen_UpdateCard_NotPKP() public {
        FSRSTrackerV1.Card memory newCard = FSRSTrackerV1.Card({
            due: uint40(block.timestamp + 1 days),
            stability: 100,
            difficulty: 50,
            elapsedDays: 0,
            scheduledDays: 10,
            reps: 1,
            lapses: 0,
            state: uint8(FSRSTrackerV1.CardState.Learning),
            lastReview: uint40(block.timestamp)
        });

        // Attacker tries to update
        vm.prank(attacker);
        vm.expectRevert(FSRSTrackerV1.NotTrustedPKP.selector);
        tracker.updateCard(user, SONG_ID, SEGMENT_ID, 0, 2, 85, newCard);
    }

    function test_RevertWhen_UpdateCard_InvalidRating() public {
        FSRSTrackerV1.Card memory newCard = FSRSTrackerV1.Card({
            due: uint40(block.timestamp + 1 days),
            stability: 100,
            difficulty: 50,
            elapsedDays: 0,
            scheduledDays: 10,
            reps: 1,
            lapses: 0,
            state: uint8(FSRSTrackerV1.CardState.Learning),
            lastReview: uint40(block.timestamp)
        });

        vm.prank(trustedPKP);
        vm.expectRevert(FSRSTrackerV1.InvalidRating.selector);
        tracker.updateCard(user, SONG_ID, SEGMENT_ID, 0, 4, 85, newCard); // rating > 3
    }

    function test_RevertWhen_UpdateCard_InvalidScore() public {
        FSRSTrackerV1.Card memory newCard = FSRSTrackerV1.Card({
            due: uint40(block.timestamp + 1 days),
            stability: 100,
            difficulty: 50,
            elapsedDays: 0,
            scheduledDays: 10,
            reps: 1,
            lapses: 0,
            state: uint8(FSRSTrackerV1.CardState.Learning),
            lastReview: uint40(block.timestamp)
        });

        vm.prank(trustedPKP);
        vm.expectRevert(FSRSTrackerV1.InvalidScore.selector);
        tracker.updateCard(user, SONG_ID, SEGMENT_ID, 0, 2, 101, newCard); // score > 100
    }

    // ============================================================
    // BATCH UPDATE TESTS
    // ============================================================

    function test_UpdateCardsBatch() public {
        uint8[] memory lineIndices = new uint8[](3);
        lineIndices[0] = 0;
        lineIndices[1] = 1;
        lineIndices[2] = 2;

        uint8[] memory ratings = new uint8[](3);
        ratings[0] = 2; // Good
        ratings[1] = 3; // Easy
        ratings[2] = 1; // Hard

        uint8[] memory scores = new uint8[](3);
        scores[0] = 85;
        scores[1] = 95;
        scores[2] = 70;

        FSRSTrackerV1.Card[] memory newCards = new FSRSTrackerV1.Card[](3);
        for (uint i = 0; i < 3; i++) {
            newCards[i] = FSRSTrackerV1.Card({
                due: uint40(block.timestamp + 1 days),
                stability: 100 * uint16(i + 1),
                difficulty: 50,
                elapsedDays: 0,
                scheduledDays: 10 * uint16(i + 1),
                reps: 1,
                lapses: 0,
                state: uint8(FSRSTrackerV1.CardState.Learning),
                lastReview: uint40(block.timestamp)
            });
        }

        vm.prank(trustedPKP);
        tracker.updateCardsBatch(user, SONG_ID, SEGMENT_ID, lineIndices, ratings, scores, newCards);

        // Verify all cards were stored
        for (uint i = 0; i < 3; i++) {
            FSRSTrackerV1.Card memory stored = tracker.getCard(user, SONG_ID, SEGMENT_ID, uint8(i));
            assertEq(stored.stability, newCards[i].stability);
            assertEq(stored.reps, 1);
        }
    }

    function test_RevertWhen_UpdateCardsBatch_TooLarge() public {
        uint8[] memory lineIndices = new uint8[](21); // Max is 20
        uint8[] memory ratings = new uint8[](21);
        uint8[] memory scores = new uint8[](21);
        FSRSTrackerV1.Card[] memory newCards = new FSRSTrackerV1.Card[](21);

        vm.prank(trustedPKP);
        vm.expectRevert(FSRSTrackerV1.BatchLimitExceeded.selector);
        tracker.updateCardsBatch(user, SONG_ID, SEGMENT_ID, lineIndices, ratings, scores, newCards);
    }

    // ============================================================
    // QUERY TESTS
    // ============================================================

    function test_GetStudyStats() public {
        // Set block timestamp to a reasonable future time to avoid underflow
        vm.warp(30 days);

        // Create 3 new cards (never reviewed)
        // Create 2 learning cards (recently reviewed)
        // Create 1 due card (review overdue)

        // Card 0: New (never reviewed)
        // Card 1: New (never reviewed)
        // Card 2: Learning (not due yet)
        FSRSTrackerV1.Card memory learningCard = FSRSTrackerV1.Card({
            due: uint40(block.timestamp + 1 days),
            stability: 100,
            difficulty: 50,
            elapsedDays: 0,
            scheduledDays: 10,
            reps: 1,
            lapses: 0,
            state: uint8(FSRSTrackerV1.CardState.Learning),
            lastReview: uint40(block.timestamp)
        });
        vm.prank(trustedPKP);
        tracker.updateCard(user, SONG_ID, SEGMENT_ID, 2, 2, 85, learningCard);

        // Card 3: Due (overdue for review)
        FSRSTrackerV1.Card memory dueCard = FSRSTrackerV1.Card({
            due: uint40(block.timestamp - 1 days), // 1 day overdue
            stability: 200,
            difficulty: 50,
            elapsedDays: 10,
            scheduledDays: 10,
            reps: 5,
            lapses: 1,
            state: uint8(FSRSTrackerV1.CardState.Review),
            lastReview: uint40(block.timestamp - 2 days)
        });
        vm.prank(trustedPKP);
        tracker.updateCard(user, SONG_ID, SEGMENT_ID, 3, 2, 90, dueCard);

        // Query stats (4 total lines)
        (uint8 newCount, uint8 learningCount, uint8 dueCount) =
            tracker.getStudyStats(user, SONG_ID, SEGMENT_ID, 4);

        assertEq(newCount, 2); // Cards 0 and 1 (never reviewed)
        assertEq(learningCount, 1); // Card 2 (Learning state)
        assertEq(dueCount, 1); // Card 3 (overdue)
    }

    function test_GetDueCards() public {
        // Set block timestamp to a reasonable future time to avoid underflow
        vm.warp(30 days);

        // Card 0: New
        // Card 1: Due
        FSRSTrackerV1.Card memory dueCard = FSRSTrackerV1.Card({
            due: uint40(block.timestamp - 1 hours),
            stability: 100,
            difficulty: 50,
            elapsedDays: 10,
            scheduledDays: 10,
            reps: 3,
            lapses: 0,
            state: uint8(FSRSTrackerV1.CardState.Review),
            lastReview: uint40(block.timestamp - 2 days)
        });
        vm.prank(trustedPKP);
        tracker.updateCard(user, SONG_ID, SEGMENT_ID, 1, 2, 88, dueCard);

        // Card 2: Not due yet
        FSRSTrackerV1.Card memory notDueCard = FSRSTrackerV1.Card({
            due: uint40(block.timestamp + 1 days),
            stability: 150,
            difficulty: 50,
            elapsedDays: 10,
            scheduledDays: 15,
            reps: 2,
            lapses: 0,
            state: uint8(FSRSTrackerV1.CardState.Learning),
            lastReview: uint40(block.timestamp)
        });
        vm.prank(trustedPKP);
        tracker.updateCard(user, SONG_ID, SEGMENT_ID, 2, 2, 92, notDueCard);

        uint8[] memory dueLines = tracker.getDueCards(user, SONG_ID, SEGMENT_ID, 3);

        assertEq(dueLines.length, 2); // Cards 0 (new) and 1 (due)
        assertEq(dueLines[0], 0);
        assertEq(dueLines[1], 1);
    }

    function test_RevertWhen_GetStudyStats_ExceedsMaxLineCount() public {
        vm.expectRevert(FSRSTrackerV1.InvalidLineCount.selector);
        tracker.getStudyStats(user, SONG_ID, SEGMENT_ID, 101); // Max is 100
    }

    // ============================================================
    // ADMIN TESTS
    // ============================================================

    function test_SetTrustedPKP() public {
        address newPKP = address(0xABCD);
        tracker.setTrustedPKP(newPKP);
        assertEq(tracker.trustedPKP(), newPKP);
    }

    function test_RevertWhen_SetTrustedPKP_NotOwner() public {
        vm.prank(attacker);
        vm.expectRevert(FSRSTrackerV1.NotOwner.selector);
        tracker.setTrustedPKP(address(0xABCD));
    }

    function test_SetPaused() public {
        tracker.setPaused(true);
        assertEq(tracker.paused(), true);

        tracker.setPaused(false);
        assertEq(tracker.paused(), false);
    }

    function test_RevertWhen_UpdateCard_WhenPaused() public {
        tracker.setPaused(true);

        FSRSTrackerV1.Card memory newCard = FSRSTrackerV1.Card({
            due: uint40(block.timestamp + 1 days),
            stability: 100,
            difficulty: 50,
            elapsedDays: 0,
            scheduledDays: 10,
            reps: 1,
            lapses: 0,
            state: uint8(FSRSTrackerV1.CardState.Learning),
            lastReview: uint40(block.timestamp)
        });

        vm.prank(trustedPKP);
        vm.expectRevert(FSRSTrackerV1.ContractPaused.selector);
        tracker.updateCard(user, SONG_ID, SEGMENT_ID, 0, 2, 85, newCard);
    }

    // ============================================================
    // EVENT TESTS
    // ============================================================

    function test_CardReviewedEvent() public {
        FSRSTrackerV1.Card memory newCard = FSRSTrackerV1.Card({
            due: uint40(block.timestamp + 1 days),
            stability: 100,
            difficulty: 50,
            elapsedDays: 0,
            scheduledDays: 10,
            reps: 1,
            lapses: 0,
            state: uint8(FSRSTrackerV1.CardState.Learning),
            lastReview: uint40(block.timestamp)
        });

        vm.expectEmit(true, true, false, true);
        emit FSRSTrackerV1.CardReviewed(
            user,
            SONG_ID,
            SEGMENT_ID,
            0,
            2, // rating: Good
            85, // score
            newCard.due,
            newCard.state,
            uint64(block.timestamp)
        );

        vm.prank(trustedPKP);
        tracker.updateCard(user, SONG_ID, SEGMENT_ID, 0, 2, 85, newCard);
    }
}
