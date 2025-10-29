// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/events/PerformanceGrader.sol";
import "../src/events/IPerformanceGrader.sol";

contract PerformanceGraderTest is Test {
    PerformanceGrader public grader;
    address public owner = address(0x1);
    address public trustedPKP = address(0x2);
    address public attacker = address(0x3);
    
    uint256 constant PERFORMANCE_ID = 12345;
    bytes32 constant SEGMENT_HASH = keccak256("test-segment");
    address constant PERFORMER = address(0x4);
    
    event PerformanceGraded(
        uint256 indexed performanceId,
        bytes32 indexed segmentHash,
        address indexed performer,
        uint16 score,
        string metadataUri,
        uint64 timestamp
    );
    
    event PerformanceSubmitted(
        uint256 indexed performanceId,
        bytes32 indexed segmentHash,
        address indexed performer,
        string videoUri,
        uint64 timestamp
    );
    
    event TrustedPKPUpdated(
        address indexed oldPKP,
        address indexed newPKP
    );
    
    event PausedUpdated(bool paused);
    
    function setUp() public {
        vm.prank(owner);
        grader = new PerformanceGrader(trustedPKP);
    }
    
    // ============ Constructor Tests ============
    
    function testConstructorSuccess() public {
        assertEq(grader.owner(), owner);
        assertEq(grader.trustedPKP(), trustedPKP);
        assertEq(grader.paused(), false);
    }
    
    function testConstructorWithZeroPKP() public {
        vm.expectRevert(PerformanceGrader.InvalidAddress.selector);
        new PerformanceGrader(address(0));
    }
    
    // ============ Grade Performance Tests ============
    
    function testGradePerformanceSuccess() public {
        uint16 score = 8525;
        string memory metadataUri = "lens://performance-12345";
        
        vm.prank(trustedPKP);
        vm.expectEmit();
        emit PerformanceGraded(PERFORMANCE_ID, SEGMENT_HASH, PERFORMER, score, metadataUri, uint64(block.timestamp));
        grader.gradePerformance(PERFORMANCE_ID, SEGMENT_HASH, PERFORMER, score, metadataUri);
    }
    
    function testGradePerformanceInvalidScore() public {
        uint16 invalidScore = 10001; // Above maximum
        
        vm.prank(trustedPKP);
        vm.expectRevert(PerformanceGrader.InvalidScore.selector);
        grader.gradePerformance(PERFORMANCE_ID, SEGMENT_HASH, PERFORMER, invalidScore, "uri");
    }
    
    function testGradePerformanceZeroAddress() public {
        vm.prank(trustedPKP);
        vm.expectRevert(PerformanceGrader.InvalidAddress.selector);
        grader.gradePerformance(PERFORMANCE_ID, SEGMENT_HASH, address(0), 5000, "uri");
    }
    
    function testGradePerformanceOnlyTrustedPKP() public {
        vm.prank(attacker);
        vm.expectRevert(PerformanceGrader.NotTrustedPKP.selector);
        grader.gradePerformance(PERFORMANCE_ID, SEGMENT_HASH, PERFORMER, 5000, "uri");
    }
    
    function testGradePerformanceWhenPaused() public {
        vm.prank(owner);
        grader.setPaused(true);
        
        vm.prank(trustedPKP);
        vm.expectRevert(PerformanceGrader.ContractPaused.selector);
        grader.gradePerformance(PERFORMANCE_ID, SEGMENT_HASH, PERFORMER, 5000, "uri");
    }
    
    function testGradePerformanceBoundaryScores() public {
        uint16 maxScore = 10000;
        string memory metadataUri = "lens://performance-boundary";
        
        vm.prank(trustedPKP);
        grader.gradePerformance(PERFORMANCE_ID, SEGMENT_HASH, PERFORMER, maxScore, metadataUri);
        
        // Test minimum score (0)
        uint16 minScore = 0;
        vm.prank(trustedPKP);
        grader.gradePerformance(PERFORMANCE_ID + 1, SEGMENT_HASH, PERFORMER, minScore, metadataUri);
    }
    
    // ============ Submit Performance Tests ============
    
    function testSubmitPerformanceSuccess() public {
        string memory videoUri = "lens://video-12345";
        
        vm.prank(PERFORMER);
        vm.expectEmit();
        emit PerformanceSubmitted(PERFORMANCE_ID, SEGMENT_HASH, PERFORMER, videoUri, uint64(block.timestamp));
        grader.submitPerformance(PERFORMANCE_ID, SEGMENT_HASH, PERFORMER, videoUri);
    }
    
    function testSubmitPerformanceZeroAddress() public {
        vm.prank(attacker);
        vm.expectRevert(PerformanceGrader.InvalidAddress.selector);
        grader.submitPerformance(PERFORMANCE_ID, SEGMENT_HASH, address(0), "uri");
    }
    
    function testSubmitPerformanceWhenPaused() public {
        vm.prank(owner);
        grader.setPaused(true);
        
        vm.prank(PERFORMER);
        vm.expectRevert(PerformanceGrader.ContractPaused.selector);
        grader.submitPerformance(PERFORMANCE_ID, SEGMENT_HASH, PERFORMER, "uri");
    }
    
    function testSubmitPerformanceOpenAccess() public {
        // Anyone should be able to submit performances
        string memory videoUri = "lens://video-open";
        
        vm.prank(attacker); // Not the performer
        grader.submitPerformance(PERFORMANCE_ID, SEGMENT_HASH, PERFORMER, videoUri);
    }
    
    // ============ Admin Function Tests ============
    
    function testSetTrustedPKPSuccess() public {
        address newPKP = address(0x5);
        
        vm.prank(owner);
        vm.expectEmit();
        emit TrustedPKPUpdated(trustedPKP, newPKP);
        grader.setTrustedPKP(newPKP);
        
        assertEq(grader.trustedPKP(), newPKP);
    }
    
    function testSetTrustedPKPOnlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert(PerformanceGrader.NotOwner.selector);
        grader.setTrustedPKP(address(0x5));
    }
    
    function testSetTrustedPKPZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(PerformanceGrader.InvalidAddress.selector);
        grader.setTrustedPKP(address(0));
    }
    
    function testSetPausedSuccess() public {
        vm.prank(owner);
        grader.setPaused(true);
        assertEq(grader.paused(), true);
        
        vm.prank(owner);
        grader.setPaused(false);
        assertEq(grader.paused(), false);
    }
    
    function testSetPausedOnlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert(PerformanceGrader.NotOwner.selector);
        grader.setPaused(true);
    }
    
    function testTransferOwnershipSuccess() public {
        address newOwner = address(0x6);
        
        vm.prank(owner);
        grader.transferOwnership(newOwner);
        
        assertEq(grader.owner(), newOwner);
    }
    
    function testTransferOwnershipOnlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert(PerformanceGrader.NotOwner.selector);
        grader.transferOwnership(address(0x6));
    }
    
    function testTransferOwnershipZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(PerformanceGrader.InvalidAddress.selector);
        grader.transferOwnership(address(0));
    }
    
    // ============ View Function Tests ============
    
    function testOwnerView() public {
        assertEq(grader.owner(), owner);
    }
    
    function testTrustedPKPView() public {
        assertEq(grader.trustedPKP(), trustedPKP);
    }
    
    function testPausedView() public {
        assertEq(grader.paused(), false);
        
        vm.prank(owner);
        grader.setPaused(true);
        assertEq(grader.paused(), true);
    }
    
    // ============ Event Emission Tests ============
    
    function testPerformanceGradedEventStructure() public {
        uint16 score = 7500;
        string memory metadataUri = "lens://test-event";
        uint64 expectedTimestamp = uint64(block.timestamp);
        
        vm.prank(trustedPKP);
        vm.expectEmit();
        emit PerformanceGraded(PERFORMANCE_ID, SEGMENT_HASH, PERFORMER, score, metadataUri, expectedTimestamp);
        grader.gradePerformance(PERFORMANCE_ID, SEGMENT_HASH, PERFORMER, score, metadataUri);
    }
    
    function testPerformanceSubmittedEventStructure() public {
        string memory videoUri = "lens://submitted-video";
        uint64 expectedTimestamp = uint64(block.timestamp);
        
        vm.prank(PERFORMER);
        vm.expectEmit();
        emit PerformanceSubmitted(PERFORMANCE_ID, SEGMENT_HASH, PERFORMER, videoUri, expectedTimestamp);
        grader.submitPerformance(PERFORMANCE_ID, SEGMENT_HASH, PERFORMER, videoUri);
    }
}
