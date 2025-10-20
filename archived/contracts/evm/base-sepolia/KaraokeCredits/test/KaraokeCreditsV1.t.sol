// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../KaraokeCreditsV1.sol";

/**
 * @title KaraokeCreditsV1Test
 * @notice Comprehensive tests for KaraokeCreditsV1 contract
 * @dev Uses Anvil (standard EVM) since contract deploys to Base Sepolia
 *
 * Run tests:
 * forge test --match-contract KaraokeCreditsV1Test -vvv
 *
 * Run with gas report:
 * forge test --match-contract KaraokeCreditsV1Test --gas-report
 *
 * Run specific test:
 * forge test --match-test testPurchaseCreditsUSDC -vvv
 */
contract KaraokeCreditsV1Test is Test {
    KaraokeCreditsV1 public credits;
    MockUSDC public usdc;
    MockSongCatalog public songCatalog;

    address public owner;
    address public treasury;
    address public trustedPKP;
    address public user1;
    address public user2;

    // Events to test
    event CreditsPurchased(
        address indexed user,
        uint8 indexed packageId,
        uint16 creditAmount,
        uint256 priceUSDC,
        uint256 priceETH,
        string paymentMethod,
        uint64 timestamp
    );

    event CreditUsed(
        address indexed user,
        uint8 source,
        string songId,
        string segmentId,
        bytes32 indexed segmentHash,
        uint64 timestamp
    );

    event SegmentUnlocked(
        address indexed user,
        bytes32 indexed segmentHash,
        uint8 source,
        string songId,
        string segmentId
    );

    event CreditsGranted(
        address indexed user,
        uint16 creditAmount,
        string reason,
        uint64 timestamp
    );

    function setUp() public {
        owner = address(this);
        treasury = makeAddr("treasury");
        trustedPKP = makeAddr("trustedPKP");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");

        // Deploy mock contracts
        usdc = new MockUSDC();
        songCatalog = new MockSongCatalog();

        // Deploy KaraokeCreditsV1
        credits = new KaraokeCreditsV1(
            address(usdc),
            treasury,
            trustedPKP,
            address(songCatalog)
        );

        // Fund users with USDC and ETH
        usdc.mint(user1, 1000 * 10**6); // 1000 USDC
        usdc.mint(user2, 1000 * 10**6);
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
    }

    // ========================================================================
    // Constructor & Initialization Tests
    // ========================================================================

    function testConstructor() public {
        assertEq(credits.owner(), owner);
        assertEq(credits.treasury(), treasury);
        assertEq(credits.trustedPKP(), trustedPKP);
        assertEq(credits.usdcToken(), address(usdc));
        assertEq(credits.songCatalog(), address(songCatalog));
        assertEq(credits.packageCount(), 4);
        assertFalse(credits.paused());
    }

    function testDefaultPackages() public {
        // Package 0: 1 credit = $0.50
        (uint16 credits0, uint256 priceUSDC0, uint256 priceETH0, bool enabled0) = credits.packages(0);
        assertEq(credits0, 1);
        assertEq(priceUSDC0, 500000); // $0.50 in USDC (6 decimals)
        assertEq(priceETH0, 0.0002 ether);
        assertTrue(enabled0);

        // Package 1: 10 credits = $4.50
        (uint16 credits1, uint256 priceUSDC1, uint256 priceETH1, bool enabled1) = credits.packages(1);
        assertEq(credits1, 10);
        assertEq(priceUSDC1, 4500000);
        assertEq(priceETH1, 0.0018 ether);
        assertTrue(enabled1);

        // Package 2: 20 credits = $8.00
        (uint16 credits2, uint256 priceUSDC2, uint256 priceETH2, bool enabled2) = credits.packages(2);
        assertEq(credits2, 20);
        assertEq(priceUSDC2, 8000000);
        assertEq(priceETH2, 0.0032 ether);
        assertTrue(enabled2);

        // Package 3: 50 credits = $17.50
        (uint16 credits3, uint256 priceUSDC3, uint256 priceETH3, bool enabled3) = credits.packages(3);
        assertEq(credits3, 50);
        assertEq(priceUSDC3, 17500000);
        assertEq(priceETH3, 0.007 ether);
        assertTrue(enabled3);
    }

    // ========================================================================
    // USDC Purchase Tests
    // ========================================================================

    function testPurchaseCreditsUSDC() public {
        vm.startPrank(user1);

        // Approve USDC
        usdc.approve(address(credits), 500000);

        // Purchase 1 credit (package 0)
        vm.expectEmit(true, true, false, true);
        emit CreditsPurchased(user1, 0, 1, 500000, 0, "USDC", uint64(block.timestamp));

        credits.purchaseCreditsUSDC(0);

        vm.stopPrank();

        // Verify credits minted
        assertEq(credits.getCredits(user1), 1);

        // Verify USDC transferred to treasury
        assertEq(usdc.balanceOf(treasury), 500000);
    }

    function testPurchaseMultiplePackagesUSDC() public {
        vm.startPrank(user1);

        // Purchase package 1 (10 credits)
        usdc.approve(address(credits), 4500000);
        credits.purchaseCreditsUSDC(1);

        // Purchase package 2 (20 credits)
        usdc.approve(address(credits), 8000000);
        credits.purchaseCreditsUSDC(2);

        vm.stopPrank();

        // Total: 10 + 20 = 30 credits
        assertEq(credits.getCredits(user1), 30);
        assertEq(usdc.balanceOf(treasury), 12500000); // $4.50 + $8.00
    }

    function testCannotPurchaseWithoutApproval() public {
        vm.startPrank(user1);

        // Don't approve USDC
        vm.expectRevert();
        credits.purchaseCreditsUSDC(0);

        vm.stopPrank();
    }

    function testCannotPurchaseInvalidPackage() public {
        vm.startPrank(user1);

        usdc.approve(address(credits), 500000);

        // Package 4 doesn't exist
        vm.expectRevert("Invalid package");
        credits.purchaseCreditsUSDC(4);

        vm.stopPrank();
    }

    function testCannotPurchaseWhenPaused() public {
        // Pause contract
        credits.pause();

        vm.startPrank(user1);
        usdc.approve(address(credits), 500000);

        vm.expectRevert("Contract is paused");
        credits.purchaseCreditsUSDC(0);

        vm.stopPrank();
    }

    // ========================================================================
    // ETH Purchase Tests
    // ========================================================================

    function testPurchaseCreditsETH() public {
        vm.startPrank(user1);

        // Purchase 1 credit with ETH
        vm.expectEmit(true, true, false, true);
        emit CreditsPurchased(user1, 0, 1, 0, 0.0002 ether, "ETH", uint64(block.timestamp));

        credits.purchaseCreditsETH{value: 0.0002 ether}(0);

        vm.stopPrank();

        // Verify credits minted
        assertEq(credits.getCredits(user1), 1);

        // Verify ETH transferred to treasury
        assertEq(treasury.balance, 0.0002 ether);
    }

    function testPurchaseCreditsETHWithExcess() public {
        vm.startPrank(user1);

        // Send more ETH than required (should accept)
        credits.purchaseCreditsETH{value: 0.001 ether}(0);

        vm.stopPrank();

        // Verify credits minted
        assertEq(credits.getCredits(user1), 1);

        // Verify all ETH transferred to treasury
        assertEq(treasury.balance, 0.001 ether);
    }

    function testCannotPurchaseETHInsufficientValue() public {
        vm.startPrank(user1);

        // Send less ETH than required
        vm.expectRevert("Insufficient ETH");
        credits.purchaseCreditsETH{value: 0.0001 ether}(0);

        vm.stopPrank();
    }

    // ========================================================================
    // Credit Usage Tests
    // ========================================================================

    function testUseCredit() public {
        // Give user1 credits
        vm.prank(trustedPKP);
        credits.grantCredits(user1, 5, "test");

        vm.startPrank(user1);

        bytes32 expectedHash = credits.getSegmentHash(1, "378195", "chorus-1");

        // Use 1 credit
        vm.expectEmit(true, true, false, true);
        emit CreditUsed(user1, 1, "378195", "chorus-1", expectedHash, uint64(block.timestamp));

        vm.expectEmit(true, true, false, true);
        emit SegmentUnlocked(user1, expectedHash, 1, "378195", "chorus-1");

        credits.useCredit(1, "378195", "chorus-1");

        vm.stopPrank();

        // Verify credit deducted
        assertEq(credits.getCredits(user1), 4);

        // Verify segment owned
        assertTrue(credits.ownsSegment(user1, 1, "378195", "chorus-1"));
        assertTrue(credits.ownsSegmentByHash(user1, expectedHash));
    }

    function testUseCreditMultipleSegments() public {
        vm.prank(trustedPKP);
        credits.grantCredits(user1, 10, "test");

        vm.startPrank(user1);

        // Unlock different segments
        credits.useCredit(1, "378195", "verse-1");
        credits.useCredit(1, "378195", "chorus-1");
        credits.useCredit(1, "378195", "bridge-1");

        vm.stopPrank();

        // Verify credits
        assertEq(credits.getCredits(user1), 7);

        // Verify all segments owned
        assertTrue(credits.ownsSegment(user1, 1, "378195", "verse-1"));
        assertTrue(credits.ownsSegment(user1, 1, "378195", "chorus-1"));
        assertTrue(credits.ownsSegment(user1, 1, "378195", "bridge-1"));
    }

    function testCannotUseCreditWithoutBalance() public {
        vm.startPrank(user1);

        vm.expectRevert("Insufficient credits");
        credits.useCredit(1, "378195", "chorus-1");

        vm.stopPrank();
    }

    function testCannotUseCreditForOwnedSegment() public {
        vm.prank(trustedPKP);
        credits.grantCredits(user1, 5, "test");

        vm.startPrank(user1);

        // Unlock segment
        credits.useCredit(1, "378195", "chorus-1");

        // Try to unlock same segment again
        vm.expectRevert("Segment already owned");
        credits.useCredit(1, "378195", "chorus-1");

        vm.stopPrank();
    }

    // ========================================================================
    // Deduplication Tests
    // ========================================================================

    function testDeduplicationPreventsCreditUsage() public {
        // Add song to catalog with geniusId=378195
        songCatalog.addSong(378195);

        vm.prank(trustedPKP);
        credits.grantCredits(user1, 5, "test");

        vm.startPrank(user1);

        // Try to use credit for song that exists in catalog
        vm.expectRevert("Song available for free in Native catalog - no credits needed");
        credits.useCredit(1, "378195", "chorus-1");

        vm.stopPrank();

        // Credits not deducted
        assertEq(credits.getCredits(user1), 5);
    }

    function testDeduplicationOnlyAppliesToGenius() public {
        // Add song to catalog
        songCatalog.addSong(378195);

        vm.prank(trustedPKP);
        credits.grantCredits(user1, 5, "test");

        vm.startPrank(user1);

        // Native source (0) - deduplication doesn't apply
        credits.useCredit(0, "378195", "chorus-1");

        vm.stopPrank();

        // Credit used successfully
        assertEq(credits.getCredits(user1), 4);
        assertTrue(credits.ownsSegment(user1, 0, "378195", "chorus-1"));
    }

    function testDeduplicationWithInvalidGeniusId() public {
        vm.prank(trustedPKP);
        credits.grantCredits(user1, 5, "test");

        vm.startPrank(user1);

        // Non-numeric songId - deduplication check skips
        credits.useCredit(1, "invalid-id", "chorus-1");

        vm.stopPrank();

        // Credit used successfully
        assertEq(credits.getCredits(user1), 4);
    }

    // ========================================================================
    // PKP Grant Tests
    // ========================================================================

    function testGrantCredits() public {
        vm.prank(trustedPKP);

        vm.expectEmit(true, false, false, true);
        emit CreditsGranted(user1, 2, "first_generation_bonus", uint64(block.timestamp));

        credits.grantCredits(user1, 2, "first_generation_bonus");

        assertEq(credits.getCredits(user1), 2);
    }

    function testGrantCreditsMultipleTimes() public {
        vm.startPrank(trustedPKP);

        credits.grantCredits(user1, 5, "bonus1");
        credits.grantCredits(user1, 3, "bonus2");

        vm.stopPrank();

        assertEq(credits.getCredits(user1), 8);
    }

    function testCannotGrantCreditsNotPKP() public {
        vm.prank(user1);

        vm.expectRevert("Not trusted PKP");
        credits.grantCredits(user2, 5, "test");
    }

    function testCannotGrantTooManyCredits() public {
        vm.prank(trustedPKP);

        vm.expectRevert("Invalid amount");
        credits.grantCredits(user1, 11, "test");
    }

    function testCannotGrantZeroCredits() public {
        vm.prank(trustedPKP);

        vm.expectRevert("Invalid amount");
        credits.grantCredits(user1, 0, "test");
    }

    // ========================================================================
    // Admin Function Tests
    // ========================================================================

    function testUpdatePackage() public {
        credits.updatePackage(0, 1, 750000, 0.0003 ether, true);

        (uint16 creditsAmount, uint256 priceUSDC, uint256 priceETH, bool enabled) = credits.packages(0);
        assertEq(creditsAmount, 1);
        assertEq(priceUSDC, 750000);
        assertEq(priceETH, 0.0003 ether);
        assertTrue(enabled);
    }

    function testDisablePackage() public {
        credits.updatePackage(0, 1, 500000, 0.0002 ether, false);

        (, , , bool enabled) = credits.packages(0);
        assertFalse(enabled);

        // Cannot purchase disabled package
        vm.startPrank(user1);
        usdc.approve(address(credits), 500000);

        vm.expectRevert("Package disabled");
        credits.purchaseCreditsUSDC(0);

        vm.stopPrank();
    }

    function testAddPackage() public {
        credits.addPackage(100, 30000000, 0.012 ether);

        assertEq(credits.packageCount(), 5);

        (uint16 creditsAmount, uint256 priceUSDC, uint256 priceETH, bool enabled) = credits.packages(4);
        assertEq(creditsAmount, 100);
        assertEq(priceUSDC, 30000000);
        assertEq(priceETH, 0.012 ether);
        assertTrue(enabled);
    }

    function testUnlockSegmentAdmin() public {
        // Admin can unlock segments without credits
        credits.unlockSegmentAdmin(user1, 1, "378195", "chorus-1");

        assertTrue(credits.ownsSegment(user1, 1, "378195", "chorus-1"));
        assertEq(credits.getCredits(user1), 0); // No credits deducted
    }

    function testSetTreasury() public {
        address newTreasury = makeAddr("newTreasury");
        credits.setTreasury(newTreasury);

        assertEq(credits.treasury(), newTreasury);
    }

    function testSetTrustedPKP() public {
        address newPKP = makeAddr("newPKP");
        credits.setTrustedPKP(newPKP);

        assertEq(credits.trustedPKP(), newPKP);
    }

    function testSetSongCatalog() public {
        address newCatalog = makeAddr("newCatalog");
        credits.setSongCatalog(newCatalog);

        assertEq(credits.songCatalog(), newCatalog);
    }

    function testPauseUnpause() public {
        // Pause
        credits.pause();
        assertTrue(credits.paused());

        // Cannot purchase when paused
        vm.startPrank(user1);
        vm.expectRevert("Contract is paused");
        credits.purchaseCreditsETH{value: 0.0002 ether}(0);
        vm.stopPrank();

        // Unpause
        credits.unpause();
        assertFalse(credits.paused());

        // Can purchase again
        vm.prank(user1);
        credits.purchaseCreditsETH{value: 0.0002 ether}(0);
        assertEq(credits.getCredits(user1), 1);
    }

    function testTransferOwnership() public {
        address newOwner = makeAddr("newOwner");
        credits.transferOwnership(newOwner);

        assertEq(credits.owner(), newOwner);
    }

    // ========================================================================
    // View Function Tests
    // ========================================================================

    function testGetAllPackages() public {
        KaraokeCreditsV1.CreditPackage[] memory packages = credits.getAllPackages();

        assertEq(packages.length, 4);
        assertEq(packages[0].credits, 1);
        assertEq(packages[1].credits, 10);
        assertEq(packages[2].credits, 20);
        assertEq(packages[3].credits, 50);
    }

    function testGetSegmentHash() public {
        bytes32 hash1 = credits.getSegmentHash(1, "378195", "chorus-1");
        bytes32 hash2 = credits.getSegmentHash(1, "378195", "verse-1");
        bytes32 hash3 = credits.getSegmentHash(1, "378195", "chorus-1");

        // Same inputs = same hash
        assertEq(hash1, hash3);

        // Different inputs = different hash
        assertTrue(hash1 != hash2);
    }

    // ========================================================================
    // Edge Case Tests
    // ========================================================================

    function testMultipleUsersIndependentCredits() public {
        vm.prank(trustedPKP);
        credits.grantCredits(user1, 5, "test");

        vm.prank(trustedPKP);
        credits.grantCredits(user2, 3, "test");

        assertEq(credits.getCredits(user1), 5);
        assertEq(credits.getCredits(user2), 3);

        // User1 uses credits
        vm.prank(user1);
        credits.useCredit(1, "378195", "chorus-1");

        // User2 balance unaffected
        assertEq(credits.getCredits(user1), 4);
        assertEq(credits.getCredits(user2), 3);
    }

    function testMultipleUsersCanOwnSameSegment() public {
        vm.prank(trustedPKP);
        credits.grantCredits(user1, 5, "test");

        vm.prank(trustedPKP);
        credits.grantCredits(user2, 5, "test");

        // Both users unlock same segment
        vm.prank(user1);
        credits.useCredit(1, "378195", "chorus-1");

        vm.prank(user2);
        credits.useCredit(1, "378195", "chorus-1");

        // Both own the segment
        assertTrue(credits.ownsSegment(user1, 1, "378195", "chorus-1"));
        assertTrue(credits.ownsSegment(user2, 1, "378195", "chorus-1"));
    }

    function testLargeGeniusId() public {
        vm.prank(trustedPKP);
        credits.grantCredits(user1, 1, "test");

        vm.prank(user1);
        credits.useCredit(1, "4294967295", "chorus-1"); // Max uint32

        assertEq(credits.getCredits(user1), 0);
        assertTrue(credits.ownsSegment(user1, 1, "4294967295", "chorus-1"));
    }

    function testLongSegmentId() public {
        vm.prank(trustedPKP);
        credits.grantCredits(user1, 1, "test");

        string memory longId = "verse-1-intro-with-very-long-identifier-name";

        vm.prank(user1);
        credits.useCredit(1, "378195", longId);

        assertTrue(credits.ownsSegment(user1, 1, "378195", longId));
    }
}

// ========================================================================
// Mock Contracts
// ========================================================================

contract MockUSDC {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");

        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;

        return true;
    }
}

contract MockSongCatalog {
    mapping(uint32 => bool) private songs;

    function addSong(uint32 geniusId) external {
        songs[geniusId] = true;
    }

    function songExistsByGeniusId(uint32 geniusId) external view returns (bool) {
        return songs[geniusId];
    }
}
