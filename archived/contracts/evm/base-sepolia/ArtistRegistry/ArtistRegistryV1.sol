// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ArtistRegistryV1
 * @notice Registry mapping Genius artist IDs to PKP addresses and Lens profiles
 * @dev Minimal on-chain storage - rich metadata stored in Lens Account Metadata
 *
 * Design Philosophy:
 * - Keep on-chain data minimal (~150k gas per artist = $1-2 on Base)
 * - Store rich metadata (ISNI, IPI, Spotify ID, socials) in Lens Account Metadata
 * - Enable efficient lookups and The Graph subgraph indexing
 * - Support both MANUAL (pipeline) and GENERATED (on-demand) profiles
 */
contract ArtistRegistryV1 {

    // ============ Types ============

    enum ProfileSource {
        MANUAL,     // Created via pkp-lens-flow pipeline
        GENERATED   // Created on-demand via Lit Action
    }

    struct Artist {
        uint32 geniusArtistId;
        address pkpAddress;
        string lensHandle;           // e.g. "taylorswifttiktok"
        address lensAccountAddress;  // Lens account contract address
        ProfileSource source;
        bool verified;               // Platform verification flag
        bool hasContent;             // Has videos/posts on Lens
        uint64 createdAt;
        uint64 updatedAt;
    }

    // ============ State ============

    // Ownership
    address public owner;

    // Primary mapping: geniusArtistId => Artist
    mapping(uint32 => Artist) private artists;

    // Reverse lookups
    mapping(address => uint32) private pkpToGeniusId;
    mapping(bytes32 => uint32) private lensHandleToGeniusId; // keccak256(lensHandle)

    // Authorized registrars (can register GENERATED profiles)
    mapping(address => bool) public isRegistrar;

    // Stats
    uint32 public totalArtists;
    uint32 public manualArtists;
    uint32 public generatedArtists;

    // ============ Events ============

    event ArtistRegistered(
        uint32 indexed geniusArtistId,
        address indexed pkpAddress,
        string lensHandle,
        address lensAccountAddress,
        ProfileSource source
    );

    event ArtistUpdated(
        uint32 indexed geniusArtistId,
        address indexed pkpAddress,
        string lensHandle
    );

    event ArtistVerified(uint32 indexed geniusArtistId, bool verified);
    event ContentFlagUpdated(uint32 indexed geniusArtistId, bool hasContent);
    event RegistrarUpdated(address indexed registrar, bool authorized);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ============ Errors ============

    error ArtistAlreadyExists(uint32 geniusArtistId);
    error ArtistNotFound(uint32 geniusArtistId);
    error PKPAlreadyRegistered(address pkpAddress);
    error LensHandleAlreadyRegistered(string lensHandle);
    error InvalidGeniusId();
    error InvalidPKPAddress();
    error InvalidLensHandle();
    error InvalidAddress();
    error NotOwner();
    error Unauthorized();

    // ============ Constructor ============

    constructor() {
        owner = msg.sender;
        // Owner is automatically a registrar
        isRegistrar[msg.sender] = true;
    }

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyRegistrar() {
        if (!isRegistrar[msg.sender] && msg.sender != owner) {
            revert Unauthorized();
        }
        _;
    }

    // ============ Registration Functions ============

    /**
     * @notice Register a new artist (manual or generated)
     * @param geniusArtistId Genius API artist ID
     * @param pkpAddress PKP Ethereum address
     * @param lensHandle Lens username (without @)
     * @param lensAccountAddress Lens account contract address
     * @param source MANUAL or GENERATED
     */
    function registerArtist(
        uint32 geniusArtistId,
        address pkpAddress,
        string calldata lensHandle,
        address lensAccountAddress,
        ProfileSource source
    ) external onlyRegistrar {
        // Validation
        if (geniusArtistId == 0) revert InvalidGeniusId();
        if (pkpAddress == address(0)) revert InvalidPKPAddress();
        if (bytes(lensHandle).length == 0) revert InvalidLensHandle();

        // Check for existing registrations
        if (artists[geniusArtistId].geniusArtistId != 0) {
            revert ArtistAlreadyExists(geniusArtistId);
        }
        if (pkpToGeniusId[pkpAddress] != 0) {
            revert PKPAlreadyRegistered(pkpAddress);
        }

        bytes32 handleHash = keccak256(bytes(lensHandle));
        if (lensHandleToGeniusId[handleHash] != 0) {
            revert LensHandleAlreadyRegistered(lensHandle);
        }

        // Create artist record
        artists[geniusArtistId] = Artist({
            geniusArtistId: geniusArtistId,
            pkpAddress: pkpAddress,
            lensHandle: lensHandle,
            lensAccountAddress: lensAccountAddress,
            source: source,
            verified: false,
            hasContent: false,
            createdAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp)
        });

        // Update reverse lookups
        pkpToGeniusId[pkpAddress] = geniusArtistId;
        lensHandleToGeniusId[handleHash] = geniusArtistId;

        // Update stats
        totalArtists++;
        if (source == ProfileSource.MANUAL) {
            manualArtists++;
        } else {
            generatedArtists++;
        }

        emit ArtistRegistered(
            geniusArtistId,
            pkpAddress,
            lensHandle,
            lensAccountAddress,
            source
        );
    }

    /**
     * @notice Update artist metadata (for migrations or corrections)
     * @dev Only owner can update to prevent abuse
     */
    function updateArtist(
        uint32 geniusArtistId,
        address newPKPAddress,
        string calldata newLensHandle,
        address newLensAccountAddress
    ) external onlyOwner {
        Artist storage artist = artists[geniusArtistId];
        if (artist.geniusArtistId == 0) revert ArtistNotFound(geniusArtistId);

        // Clear old reverse lookups
        delete pkpToGeniusId[artist.pkpAddress];
        delete lensHandleToGeniusId[keccak256(bytes(artist.lensHandle))];

        // Update artist
        artist.pkpAddress = newPKPAddress;
        artist.lensHandle = newLensHandle;
        artist.lensAccountAddress = newLensAccountAddress;
        artist.updatedAt = uint64(block.timestamp);

        // Create new reverse lookups
        pkpToGeniusId[newPKPAddress] = geniusArtistId;
        lensHandleToGeniusId[keccak256(bytes(newLensHandle))] = geniusArtistId;

        emit ArtistUpdated(geniusArtistId, newPKPAddress, newLensHandle);
    }

    /**
     * @notice Set artist verification status
     */
    function setVerified(uint32 geniusArtistId, bool verified) external onlyOwner {
        Artist storage artist = artists[geniusArtistId];
        if (artist.geniusArtistId == 0) revert ArtistNotFound(geniusArtistId);

        artist.verified = verified;
        artist.updatedAt = uint64(block.timestamp);

        emit ArtistVerified(geniusArtistId, verified);
    }

    /**
     * @notice Update hasContent flag (called when artist posts content)
     */
    function setHasContent(uint32 geniusArtistId, bool hasContent) external onlyRegistrar {
        Artist storage artist = artists[geniusArtistId];
        if (artist.geniusArtistId == 0) revert ArtistNotFound(geniusArtistId);

        artist.hasContent = hasContent;
        artist.updatedAt = uint64(block.timestamp);

        emit ContentFlagUpdated(geniusArtistId, hasContent);
    }

    // ============ Query Functions ============

    /**
     * @notice Get artist by Genius ID
     */
    function getArtist(uint32 geniusArtistId)
        external
        view
        returns (Artist memory)
    {
        Artist memory artist = artists[geniusArtistId];
        if (artist.geniusArtistId == 0) revert ArtistNotFound(geniusArtistId);
        return artist;
    }

    /**
     * @notice Check if artist exists
     */
    function artistExists(uint32 geniusArtistId) external view returns (bool) {
        return artists[geniusArtistId].geniusArtistId != 0;
    }

    /**
     * @notice Get Genius ID from PKP address
     */
    function getGeniusIdByPKP(address pkpAddress)
        external
        view
        returns (uint32)
    {
        return pkpToGeniusId[pkpAddress];
    }

    /**
     * @notice Get Genius ID from Lens handle
     */
    function getGeniusIdByLensHandle(string calldata lensHandle)
        external
        view
        returns (uint32)
    {
        return lensHandleToGeniusId[keccak256(bytes(lensHandle))];
    }

    /**
     * @notice Get Lens handle for artist
     */
    function getLensHandle(uint32 geniusArtistId)
        external
        view
        returns (string memory)
    {
        Artist memory artist = artists[geniusArtistId];
        if (artist.geniusArtistId == 0) revert ArtistNotFound(geniusArtistId);
        return artist.lensHandle;
    }

    /**
     * @notice Get PKP address for artist
     */
    function getPKPAddress(uint32 geniusArtistId)
        external
        view
        returns (address)
    {
        Artist memory artist = artists[geniusArtistId];
        if (artist.geniusArtistId == 0) revert ArtistNotFound(geniusArtistId);
        return artist.pkpAddress;
    }

    /**
     * @notice Batch query - check multiple artist IDs
     */
    function artistsExist(uint32[] calldata geniusArtistIds)
        external
        view
        returns (bool[] memory)
    {
        bool[] memory results = new bool[](geniusArtistIds.length);
        for (uint256 i = 0; i < geniusArtistIds.length; i++) {
            results[i] = artists[geniusArtistIds[i]].geniusArtistId != 0;
        }
        return results;
    }

    // ============ Admin Functions ============

    /**
     * @notice Authorize/revoke registrar
     */
    function setRegistrar(address registrar, bool authorized) external onlyOwner {
        isRegistrar[registrar] = authorized;
        emit RegistrarUpdated(registrar, authorized);
    }

    /**
     * @notice Transfer ownership to new address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}
