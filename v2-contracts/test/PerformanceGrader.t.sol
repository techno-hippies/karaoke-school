// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./BaseTest.sol";
import "../src/events/PerformanceGrader.sol";

/**
 * @title PerformanceGraderTest
 * @notice Tests for PerformanceGrader contract (CRITICAL FOR ANTI-CHEAT)
 */
contract PerformanceGraderTest is BaseTest {

    PerformanceGrader public performanceGrader;

    address public trustedPKP = makeAddr("trustedPKP");
    bytes32 public segmentHash;

    function setUp() public override {
        super.setUp();

        // Deploy PerformanceGrader with trusted PKP
        performanceGrader = new PerformanceGrader(trustedPKP);

        // Pre-compute segment hash
        segmentHash = generateSegmentHash(GENIUS_SONG_1, TIKTOK_SEGMENT_ID);

        // Label trusted PKP
        vm.label(trustedPKP, "TrustedPKP");
    }

    // ============ Deployment Tests ============

    function test_Deployment() public view {
        assertEq(performanceGrader.owner(), address(this), "Owner mismatch");
        assertEq(performanceGrader.trustedPKP(), trustedPKP, "TrustedPKP mismatch");
        assertFalse(performanceGrader.paused(), "Should not be paused");
    }

    function test_Deployment_InvalidPKP() public {
        // Should revert with zero address
        vm.expectRevert(PerformanceGrader.InvalidAddress.selector);
        new PerformanceGrader(address(0));
    }

    // ============ PerformanceSubmitted Event Tests ============

    function test_SubmitPerformance() public {
        uint256 performanceId = 12345;

        // Expect event
        vm.expectEmit(true, true, true, true);
        emit PerformanceGrader.PerformanceSubmitted(
            performanceId,
            segmentHash,
            user1,
            VIDEO_URI,
            uint64(block.timestamp)
        );

        // Submit performance (anyone can call)
        vm.prank(user1);
        performanceGrader.submitPerformance(
            performanceId,
            segmentHash,
            user1,
            VIDEO_URI
        );
    }

    function test_SubmitPerformance_Gas() public {
        uint256 performanceId = 12345;

        // Measure gas
        uint256 gasBefore = gasleft();
        vm.prank(user1);
        performanceGrader.submitPerformance(
            performanceId,
            segmentHash,
            user1,
            VIDEO_URI
        );
        uint256 gasUsed = gasBefore - gasleft();

        // Should be ~25k gas
        assertLt(gasUsed, 30_000, "Gas too high");

        emit log_named_uint("Gas used for PerformanceSubmitted", gasUsed);
    }

    function test_SubmitPerformance_InvalidPerformer() public {
        uint256 performanceId = 12345;

        // Should revert with zero address
        vm.expectRevert(PerformanceGrader.InvalidAddress.selector);
        vm.prank(user1);
        performanceGrader.submitPerformance(
            performanceId,
            segmentHash,
            address(0), // invalid
            VIDEO_URI
        );
    }

    function test_SubmitPerformance_Multiple() public {
        // Multiple users can submit
        for (uint256 i = 1; i <= 5; i++) {
            vm.prank(user1);
            performanceGrader.submitPerformance(
                i,
                segmentHash,
                user1,
                VIDEO_URI
            );
        }
    }

    // ============ PerformanceGraded Event Tests (ANTI-CHEAT) ============

    function test_GradePerformance_AsTrustedPKP() public {
        uint256 performanceId = 12345;
        uint16 score = 8525; // 85.25%

        // Expect event
        vm.expectEmit(true, true, true, true);
        emit PerformanceGrader.PerformanceGraded(
            performanceId,
            segmentHash,
            user1,
            score,
            METADATA_URI,
            uint64(block.timestamp)
        );

        // Grade performance (ONLY trusted PKP can call)
        vm.prank(trustedPKP);
        performanceGrader.gradePerformance(
            performanceId,
            segmentHash,
            user1,
            score,
            METADATA_URI
        );
    }

    function test_GradePerformance_Gas() public {
        uint256 performanceId = 12345;
        uint16 score = 8525;

        // Measure gas
        uint256 gasBefore = gasleft();
        vm.prank(trustedPKP);
        performanceGrader.gradePerformance(
            performanceId,
            segmentHash,
            user1,
            score,
            METADATA_URI
        );
        uint256 gasUsed = gasBefore - gasleft();

        // Should be ~24k gas (even better than expected!)
        assertLt(gasUsed, 30_000, "Gas too high");
        assertGt(gasUsed, 20_000, "Gas unexpectedly low");

        emit log_named_uint("Gas used for PerformanceGraded", gasUsed);
    }

    function test_GradePerformance_RevertNotTrustedPKP() public {
        uint256 performanceId = 12345;
        uint16 score = 8525;

        // Should revert if not trusted PKP
        vm.expectRevert(PerformanceGrader.NotTrustedPKP.selector);
        vm.prank(user1); // Not trusted PKP
        performanceGrader.gradePerformance(
            performanceId,
            segmentHash,
            user1,
            score,
            METADATA_URI
        );
    }

    function test_GradePerformance_RevertNotOwner() public {
        uint256 performanceId = 12345;
        uint16 score = 8525;

        // Even owner can't grade (only PKP)
        vm.expectRevert(PerformanceGrader.NotTrustedPKP.selector);
        vm.prank(owner);
        performanceGrader.gradePerformance(
            performanceId,
            segmentHash,
            user1,
            score,
            METADATA_URI
        );
    }

    function test_GradePerformance_InvalidPerformer() public {
        uint256 performanceId = 12345;
        uint16 score = 8525;

        // Should revert with zero address
        vm.expectRevert(PerformanceGrader.InvalidAddress.selector);
        vm.prank(trustedPKP);
        performanceGrader.gradePerformance(
            performanceId,
            segmentHash,
            address(0), // invalid
            score,
            METADATA_URI
        );
    }

    function test_GradePerformance_InvalidScore() public {
        uint256 performanceId = 12345;
        uint16 score = 10001; // > 10000 (out of range)

        // Should revert with invalid score
        vm.expectRevert(PerformanceGrader.InvalidScore.selector);
        vm.prank(trustedPKP);
        performanceGrader.gradePerformance(
            performanceId,
            segmentHash,
            user1,
            score,
            METADATA_URI
        );
    }

    function test_GradePerformance_MaxScore() public {
        uint256 performanceId = 12345;
        uint16 score = 10000; // Max valid score

        // Should work
        vm.prank(trustedPKP);
        performanceGrader.gradePerformance(
            performanceId,
            segmentHash,
            user1,
            score,
            METADATA_URI
        );
    }

    function test_GradePerformance_MinScore() public {
        uint256 performanceId = 12345;
        uint16 score = 0; // Min valid score

        // Should work
        vm.prank(trustedPKP);
        performanceGrader.gradePerformance(
            performanceId,
            segmentHash,
            user1,
            score,
            METADATA_URI
        );
    }

    function test_GradePerformance_MultiplePerformances() public {
        // Grade multiple performances
        for (uint256 i = 1; i <= 5; i++) {
            vm.prank(trustedPKP);
            performanceGrader.gradePerformance(
                i,
                segmentHash,
                user1,
                uint16(8000 + i * 100), // Different scores
                METADATA_URI
            );
        }
    }

    // ============ Pause Tests ============

    function test_SetPaused() public {
        // Owner can pause (owner is address(this) - the test contract)
        performanceGrader.setPaused(true);

        assertTrue(performanceGrader.paused(), "Should be paused");
    }

    function test_SetPaused_RevertNotOwner() public {
        // Non-owner can't pause
        vm.expectRevert(PerformanceGrader.NotOwner.selector);
        vm.prank(user1);
        performanceGrader.setPaused(true);
    }

    function test_SubmitPerformance_WhenPaused() public {
        // Pause contract (as owner)
        performanceGrader.setPaused(true);

        // Should revert
        vm.expectRevert(PerformanceGrader.ContractPaused.selector);
        vm.prank(user1);
        performanceGrader.submitPerformance(
            12345,
            segmentHash,
            user1,
            VIDEO_URI
        );
    }

    function test_GradePerformance_WhenPaused() public {
        // Pause contract (as owner)
        performanceGrader.setPaused(true);

        // Should revert
        vm.expectRevert(PerformanceGrader.ContractPaused.selector);
        vm.prank(trustedPKP);
        performanceGrader.gradePerformance(
            12345,
            segmentHash,
            user1,
            8525,
            METADATA_URI
        );
    }

    function test_Unpause() public {
        // Pause then unpause (as owner)
        performanceGrader.setPaused(true);
        performanceGrader.setPaused(false);

        assertFalse(performanceGrader.paused(), "Should be unpaused");

        // Should work after unpause
        vm.prank(trustedPKP);
        performanceGrader.gradePerformance(
            12345,
            segmentHash,
            user1,
            8525,
            METADATA_URI
        );
    }

    // ============ SetTrustedPKP Tests ============

    function test_SetTrustedPKP() public {
        address newPKP = makeAddr("newPKP");

        // Expect event
        vm.expectEmit(true, true, false, true);
        emit PerformanceGrader.TrustedPKPUpdated(trustedPKP, newPKP);

        // Owner can update PKP (owner is address(this))
        performanceGrader.setTrustedPKP(newPKP);

        assertEq(performanceGrader.trustedPKP(), newPKP, "PKP not updated");
    }

    function test_SetTrustedPKP_RevertNotOwner() public {
        address newPKP = makeAddr("newPKP");

        // Non-owner can't update
        vm.expectRevert(PerformanceGrader.NotOwner.selector);
        vm.prank(user1);
        performanceGrader.setTrustedPKP(newPKP);
    }

    function test_SetTrustedPKP_InvalidAddress() public {
        // Should revert with zero address (as owner)
        vm.expectRevert(PerformanceGrader.InvalidAddress.selector);
        performanceGrader.setTrustedPKP(address(0));
    }

    function test_SetTrustedPKP_ThenGrade() public {
        address newPKP = makeAddr("newPKP");

        // Update PKP (as owner)
        performanceGrader.setTrustedPKP(newPKP);

        // Old PKP should fail
        vm.expectRevert(PerformanceGrader.NotTrustedPKP.selector);
        vm.prank(trustedPKP);
        performanceGrader.gradePerformance(
            12345,
            segmentHash,
            user1,
            8525,
            METADATA_URI
        );

        // New PKP should work
        vm.prank(newPKP);
        performanceGrader.gradePerformance(
            12345,
            segmentHash,
            user1,
            8525,
            METADATA_URI
        );
    }

    // ============ TransferOwnership Tests ============

    function test_TransferOwnership() public {
        address newOwner = makeAddr("newOwner");

        // Owner can transfer (owner is address(this))
        performanceGrader.transferOwnership(newOwner);

        assertEq(performanceGrader.owner(), newOwner, "Owner not transferred");
    }

    function test_TransferOwnership_RevertNotOwner() public {
        address newOwner = makeAddr("newOwner");

        // Non-owner can't transfer
        vm.expectRevert(PerformanceGrader.NotOwner.selector);
        vm.prank(user1);
        performanceGrader.transferOwnership(newOwner);
    }

    function test_TransferOwnership_InvalidAddress() public {
        // Should revert with zero address (as owner)
        vm.expectRevert(PerformanceGrader.InvalidAddress.selector);
        performanceGrader.transferOwnership(address(0));
    }

    // ============ Integration Tests ============

    function test_CompleteFlow() public {
        uint256 performanceId = 12345;

        // 1. User submits performance
        vm.prank(user1);
        performanceGrader.submitPerformance(
            performanceId,
            segmentHash,
            user1,
            VIDEO_URI
        );

        // 2. Lit Action grades (via PKP)
        vm.prank(trustedPKP);
        performanceGrader.gradePerformance(
            performanceId,
            segmentHash,
            user1,
            8525, // 85.25%
            METADATA_URI
        );
    }

    function test_MultipleUsersCompleteFlow() public {
        // Multiple users submit and get graded
        address[] memory users = new address[](3);
        users[0] = user1;
        users[1] = user2;
        users[2] = user3;

        for (uint256 i = 0; i < users.length; i++) {
            // Submit
            vm.prank(users[i]);
            performanceGrader.submitPerformance(
                i + 1,
                segmentHash,
                users[i],
                VIDEO_URI
            );

            // Grade
            vm.prank(trustedPKP);
            performanceGrader.gradePerformance(
                i + 1,
                segmentHash,
                users[i],
                uint16(7000 + i * 1000), // Different scores
                METADATA_URI
            );
        }
    }

    function test_AntiCheat_Scenario() public {
        // User tries to spoof grade (should fail)
        vm.expectRevert(PerformanceGrader.NotTrustedPKP.selector);
        vm.prank(user1);
        performanceGrader.gradePerformance(
            12345,
            segmentHash,
            user1,
            10000, // Perfect score (fake)
            METADATA_URI
        );

        // Only trusted PKP can grade
        vm.prank(trustedPKP);
        performanceGrader.gradePerformance(
            12345,
            segmentHash,
            user1,
            8525, // Real score
            METADATA_URI
        );
    }
}
