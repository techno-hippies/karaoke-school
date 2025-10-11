// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title KaraokeCreditsV1
 * @notice Credit system for user-generated karaoke segments
 * @dev V1: Base Sepolia deployment with USDC/ETH payments via Particle Network
 *
 * Architecture:
 * - Users purchase credits with USDC (preferred) or ETH (fallback)
 * - 1 credit = 1 karaoke segment unlock (permanent ownership)
 * - Segment ownership tracked by hash: keccak256(source, songId, segmentId)
 * - Integrates with Particle Network for any-token payments
 * - Trusted PKP can grant free credits (anti-botnet mitigation)
 *
 * Pricing:
 * - Base: $0.50 per credit (adjustable by owner)
 * - Bulk discounts via packages (10 credits = $4.50, 20 credits = $8.00, etc.)
 * - Payment in USDC (Base) or ETH
 *
 * Flow:
 * 1. User selects song segment → Frontend checks ownership
 * 2. If not owned && credits == 0 → PurchaseCreditsDialog
 * 3. User pays via Particle (any crypto → USDC on Base)
 * 4. Contract receives USDC → mints credits
 * 5. User clicks "Start" → useCredit() → marks segment as owned
 * 6. Lit Action generates karaoke stems → stores in registry
 */
contract KaraokeCreditsV1 {
    // ========================================================================
    // Types & Structs
    // ========================================================================

    /**
     * @notice Content source enumeration (matches other contracts)
     */
    enum ContentSource {
        Native,   // 0: Songs from SongCatalogV1
        Genius    // 1: Songs from Genius.com API
    }

    /**
     * @notice Credit package for bulk purchases
     */
    struct CreditPackage {
        uint16 credits;      // Number of credits
        uint256 priceUSDC;   // Price in USDC (6 decimals)
        uint256 priceETH;    // Price in ETH (18 decimals)
        bool enabled;        // Is package available
    }

    // ========================================================================
    // State
    // ========================================================================

    // Credit balances
    mapping(address => uint256) public credits;

    // Segment ownership: user => segmentHash => owned
    mapping(address => mapping(bytes32 => bool)) public ownedSegments;

    // Credit packages (packageId => CreditPackage)
    mapping(uint8 => CreditPackage) public packages;
    uint8 public packageCount;

    // Payment token addresses
    address public usdcToken;  // USDC on Base Sepolia

    // SongCatalog reference (for deduplication check)
    address public songCatalog;  // SongCatalogV1 on Lens Testnet

    // Access control
    address public owner;
    address public trustedPKP;  // PKP can grant free credits (anti-botnet)
    address public treasury;    // Receives payments

    bool public paused;

    // ========================================================================
    // Events
    // ========================================================================

    event CreditsPurchased(
        address indexed user,
        uint8 indexed packageId,
        uint16 creditAmount,
        uint256 priceUSDC,
        uint256 priceETH,
        string paymentMethod,
        uint64 timestamp
    );

    event CreditsGranted(
        address indexed user,
        uint16 creditAmount,
        string reason,
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

    event PackageUpdated(
        uint8 indexed packageId,
        uint16 credits,
        uint256 priceUSDC,
        uint256 priceETH,
        bool enabled
    );

    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event TrustedPKPUpdated(address indexed oldPKP, address indexed newPKP);
    event USDCTokenUpdated(address indexed oldToken, address indexed newToken);
    event SongCatalogUpdated(address indexed oldCatalog, address indexed newCatalog);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(address indexed by);
    event Unpaused(address indexed by);

    // ========================================================================
    // Constructor & Modifiers
    // ========================================================================

    constructor(address _usdcToken, address _treasury, address _trustedPKP, address _songCatalog) {
        require(_usdcToken != address(0), "Invalid USDC address");
        require(_treasury != address(0), "Invalid treasury address");
        require(_trustedPKP != address(0), "Invalid PKP address");
        // songCatalog can be 0x0 initially (set later via setSongCatalog)

        owner = msg.sender;
        usdcToken = _usdcToken;
        treasury = _treasury;
        trustedPKP = _trustedPKP;
        songCatalog = _songCatalog;

        // Initialize default packages (Base Sepolia: ~$0.50/credit)
        // Package 0: 1 credit = $0.50
        packages[0] = CreditPackage({
            credits: 1,
            priceUSDC: 500000,        // $0.50 USDC (6 decimals)
            priceETH: 0.0002 ether,   // ~$0.50 ETH (adjust based on price)
            enabled: true
        });

        // Package 1: 5 credits = $2.50
        packages[1] = CreditPackage({
            credits: 5,
            priceUSDC: 2500000,       // $2.50 USDC
            priceETH: 0.001 ether,    // ~$2.50 ETH
            enabled: true
        });

        // Package 2: 20 credits = $10.00
        packages[2] = CreditPackage({
            credits: 20,
            priceUSDC: 10000000,      // $10.00 USDC
            priceETH: 0.004 ether,    // ~$10.00 ETH
            enabled: true
        });

        packageCount = 3;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyTrustedPKP() {
        require(msg.sender == trustedPKP, "Not trusted PKP");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    // ========================================================================
    // Utility Functions
    // ========================================================================

    /**
     * @notice Generate segment hash (matches other contracts)
     */
    function getSegmentHash(uint8 source, string calldata songId, string calldata segmentId)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(source, songId, segmentId));
    }

    // ========================================================================
    // Credit Purchase (Public)
    // ========================================================================

    /**
     * @notice Purchase credits with USDC
     * @dev User must approve USDC transfer first
     * @param packageId Package to purchase (0-3)
     */
    function purchaseCreditsUSDC(uint8 packageId) external whenNotPaused {
        require(packageId < packageCount, "Invalid package");
        CreditPackage memory pkg = packages[packageId];
        require(pkg.enabled, "Package disabled");

        // Transfer USDC from user to treasury
        (bool success, bytes memory data) = usdcToken.call(
            abi.encodeWithSignature(
                "transferFrom(address,address,uint256)",
                msg.sender,
                treasury,
                pkg.priceUSDC
            )
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "USDC transfer failed");

        // Mint credits
        credits[msg.sender] += pkg.credits;

        emit CreditsPurchased(
            msg.sender,
            packageId,
            pkg.credits,
            pkg.priceUSDC,
            0,
            "USDC",
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Purchase credits with ETH (fallback option)
     * @param packageId Package to purchase (0-3)
     */
    function purchaseCreditsETH(uint8 packageId) external payable whenNotPaused {
        require(packageId < packageCount, "Invalid package");
        CreditPackage memory pkg = packages[packageId];
        require(pkg.enabled, "Package disabled");
        require(msg.value >= pkg.priceETH, "Insufficient ETH");

        // Transfer ETH to treasury
        (bool success, ) = treasury.call{value: msg.value}("");
        require(success, "ETH transfer failed");

        // Mint credits
        credits[msg.sender] += pkg.credits;

        emit CreditsPurchased(
            msg.sender,
            packageId,
            pkg.credits,
            0,
            msg.value,
            "ETH",
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Grant free credits (PKP only, for anti-botnet mitigation)
     * @dev Used to give 1-2 free credits to users who pass balance check
     * @param user User to receive credits
     * @param amount Number of credits to grant
     * @param reason Why credits were granted (e.g., "first_generation", "promotion")
     */
    function grantCredits(address user, uint16 amount, string calldata reason)
        external
        onlyTrustedPKP
        whenNotPaused
    {
        require(user != address(0), "Invalid user");
        require(amount > 0 && amount <= 10, "Invalid amount"); // Max 10 free credits at once

        credits[user] += amount;

        emit CreditsGranted(user, amount, reason, uint64(block.timestamp));
    }

    // ========================================================================
    // Credit Usage
    // ========================================================================

    /**
     * @notice Use 1 credit to unlock a segment (permanent ownership)
     * @dev Called by user when clicking "Unlock" button
     * @param source ContentSource (0=Native, 1=Genius)
     * @param songId Song identifier (e.g., geniusId as string)
     * @param segmentId Segment identifier (e.g., "verse-1", "chorus-1")
     */
    function useCredit(uint8 source, string calldata songId, string calldata segmentId)
        external
        whenNotPaused
    {
        require(source <= uint8(ContentSource.Genius), "Invalid source");
        require(bytes(songId).length > 0, "Invalid songId");
        require(bytes(segmentId).length > 0, "Invalid segmentId");
        require(credits[msg.sender] > 0, "Insufficient credits");

        // DEDUPLICATION: Check if song exists in SongCatalogV1 (free full songs)
        if (source == uint8(ContentSource.Genius) && songCatalog != address(0)) {
            // Parse geniusId from songId string
            uint32 geniusId = _parseUint32(songId);
            if (geniusId > 0) {
                // Check if song exists in Native catalog
                (bool success, bytes memory data) = songCatalog.staticcall(
                    abi.encodeWithSignature("songExistsByGeniusId(uint32)", geniusId)
                );
                if (success && data.length > 0) {
                    bool existsInCatalog = abi.decode(data, (bool));
                    require(!existsInCatalog, "Song available for free in Native catalog - no credits needed");
                }
            }
        }

        bytes32 segmentHash = getSegmentHash(source, songId, segmentId);
        require(!ownedSegments[msg.sender][segmentHash], "Segment already owned");

        // Deduct credit
        credits[msg.sender]--;

        // Mark segment as owned (permanent)
        ownedSegments[msg.sender][segmentHash] = true;

        emit CreditUsed(
            msg.sender,
            source,
            songId,
            segmentId,
            segmentHash,
            uint64(block.timestamp)
        );

        emit SegmentUnlocked(msg.sender, segmentHash, source, songId, segmentId);
    }

    /**
     * @notice Admin can unlock segments without credit cost (for promotions/fixes)
     */
    function unlockSegmentAdmin(
        address user,
        uint8 source,
        string calldata songId,
        string calldata segmentId
    ) external onlyOwner {
        require(user != address(0), "Invalid user");
        require(source <= uint8(ContentSource.Genius), "Invalid source");

        bytes32 segmentHash = getSegmentHash(source, songId, segmentId);
        require(!ownedSegments[user][segmentHash], "Segment already owned");

        ownedSegments[user][segmentHash] = true;

        emit SegmentUnlocked(user, segmentHash, source, songId, segmentId);
    }

    // ========================================================================
    // Query Functions
    // ========================================================================

    /**
     * @notice Get user's credit balance
     */
    function getCredits(address user) external view returns (uint256) {
        return credits[user];
    }

    /**
     * @notice Check if user owns a segment
     */
    function ownsSegment(address user, uint8 source, string calldata songId, string calldata segmentId)
        external
        view
        returns (bool)
    {
        bytes32 segmentHash = getSegmentHash(source, songId, segmentId);
        return ownedSegments[user][segmentHash];
    }

    /**
     * @notice Check if user owns a segment by hash
     */
    function ownsSegmentByHash(address user, bytes32 segmentHash)
        external
        view
        returns (bool)
    {
        return ownedSegments[user][segmentHash];
    }

    /**
     * @notice Get package details
     */
    function getPackage(uint8 packageId) external view returns (CreditPackage memory) {
        require(packageId < packageCount, "Invalid package");
        return packages[packageId];
    }

    /**
     * @notice Get all packages
     */
    function getAllPackages() external view returns (CreditPackage[] memory) {
        CreditPackage[] memory allPackages = new CreditPackage[](packageCount);
        for (uint8 i = 0; i < packageCount; i++) {
            allPackages[i] = packages[i];
        }
        return allPackages;
    }

    // ========================================================================
    // Admin Functions
    // ========================================================================

    /**
     * @notice Update a credit package
     */
    function updatePackage(
        uint8 packageId,
        uint16 _credits,
        uint256 _priceUSDC,
        uint256 _priceETH,
        bool _enabled
    ) external onlyOwner {
        require(packageId < packageCount, "Invalid package");
        require(_credits > 0, "Invalid credits");

        packages[packageId] = CreditPackage({
            credits: _credits,
            priceUSDC: _priceUSDC,
            priceETH: _priceETH,
            enabled: _enabled
        });

        emit PackageUpdated(packageId, _credits, _priceUSDC, _priceETH, _enabled);
    }

    /**
     * @notice Add a new credit package
     */
    function addPackage(uint16 _credits, uint256 _priceUSDC, uint256 _priceETH)
        external
        onlyOwner
    {
        require(_credits > 0, "Invalid credits");
        require(packageCount < 255, "Too many packages");

        packages[packageCount] = CreditPackage({
            credits: _credits,
            priceUSDC: _priceUSDC,
            priceETH: _priceETH,
            enabled: true
        });

        emit PackageUpdated(packageCount, _credits, _priceUSDC, _priceETH, true);
        packageCount++;
    }

    /**
     * @notice Update USDC token address
     */
    function setUSDCToken(address _usdcToken) external onlyOwner {
        require(_usdcToken != address(0), "Invalid address");
        address oldToken = usdcToken;
        usdcToken = _usdcToken;
        emit USDCTokenUpdated(oldToken, _usdcToken);
    }

    /**
     * @notice Update treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid address");
        address oldTreasury = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(oldTreasury, _treasury);
    }

    /**
     * @notice Update trusted PKP address
     */
    function setTrustedPKP(address _trustedPKP) external onlyOwner {
        require(_trustedPKP != address(0), "Invalid address");
        address oldPKP = trustedPKP;
        trustedPKP = _trustedPKP;
        emit TrustedPKPUpdated(oldPKP, _trustedPKP);
    }

    /**
     * @notice Pause contract (emergency)
     */
    function pause() external onlyOwner {
        require(!paused, "Already paused");
        paused = true;
        emit Paused(msg.sender);
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyOwner {
        require(paused, "Not paused");
        paused = false;
        emit Unpaused(msg.sender);
    }

    /**
     * @notice Update SongCatalog address
     */
    function setSongCatalog(address _songCatalog) external onlyOwner {
        // Can be set to 0x0 to disable deduplication check
        address oldCatalog = songCatalog;
        songCatalog = _songCatalog;
        emit SongCatalogUpdated(oldCatalog, _songCatalog);
    }

    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    // ========================================================================
    // Internal Helpers
    // ========================================================================

    /**
     * @notice Parse string to uint32 (e.g., "378195" -> 378195)
     * @dev Returns 0 if parsing fails
     */
    function _parseUint32(string calldata str) internal pure returns (uint32) {
        bytes memory b = bytes(str);
        uint32 result = 0;

        for (uint256 i = 0; i < b.length; i++) {
            uint8 digit = uint8(b[i]);
            if (digit < 48 || digit > 57) {
                return 0; // Invalid character
            }
            result = result * 10 + (digit - 48);
        }

        return result;
    }
}
