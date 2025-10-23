// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../interfaces/IArtistRegistry.sol";

/**
 * @title ArtistRegistryV1
 * @notice Registry mapping Genius artist IDs to PKP addresses and Lens profiles
 * @dev Minimal on-chain storage - rich metadata stored in Lens Account Metadata
 *
 * Design Philosophy:
 * - Keep on-chain data minimal (gas efficient)
 * - Store rich metadata (bio, stats, translations) in Lens Account Metadata
 * - Enable efficient lookups via The Graph subgraph indexing
 * - Single source of truth for artist identity
 *
 * Version: 1.0.0
 * Author: Karaoke School
 */
contract ArtistRegistryV1 is IArtistRegistry {

    // ============ State Variables ============

    address public owner;
    mapping(address => bool) public isAuthorized; // Authorized registrars

    // Primary storage
    mapping(uint32 => Artist) private artists; // geniusArtistId => Artist

    // Reverse lookups
    mapping(address => uint32) private pkpToGeniusId;
    mapping(bytes32 => uint32) private lensHandleHashToGeniusId;

    // Stats
    uint32 public totalArtists;

    // ============ Constructor ============

    constructor() {
        owner = msg.sender;
        isAuthorized[msg.sender] = true;
    }

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAuthorized() {
        if (!isAuthorized[msg.sender] && msg.sender != owner) {
            revert NotAuthorized();
        }
        _;
    }

    // ============ Registration Functions ============

    /**
     * @notice Register a new artist
     * @param geniusArtistId Genius API artist ID (e.g., 498 for Beyoncé)
     * @param pkpAddress PKP Ethereum address
     * @param lensHandle Lens username without @ (e.g., "beyonce")
     * @param lensAccountAddress Lens account contract address
     * @dev Only authorized addresses can register artists
     */
    function registerArtist(
        uint32 geniusArtistId,
        address pkpAddress,
        string calldata lensHandle,
        address lensAccountAddress
    ) external onlyAuthorized {
        // Validation
        if (geniusArtistId == 0) revert InvalidGeniusId();
        if (pkpAddress == address(0)) revert InvalidPKPAddress();
        if (lensAccountAddress == address(0)) revert InvalidLensAccountAddress();
        if (bytes(lensHandle).length == 0) revert InvalidLensHandle();

        // Check for existing registrations
        if (artists[geniusArtistId].geniusArtistId != 0) {
            revert ArtistAlreadyExists(geniusArtistId);
        }
        if (pkpToGeniusId[pkpAddress] != 0) {
            revert PKPAlreadyRegistered(pkpAddress);
        }

        bytes32 handleHash = keccak256(bytes(lensHandle));
        if (lensHandleHashToGeniusId[handleHash] != 0) {
            revert LensHandleAlreadyRegistered(lensHandle);
        }

        // Create artist record
        artists[geniusArtistId] = Artist({
            geniusArtistId: geniusArtistId,
            pkpAddress: pkpAddress,
            lensHandle: lensHandle,
            lensAccountAddress: lensAccountAddress,
            verified: false,
            createdAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp)
        });

        // Update reverse lookups
        pkpToGeniusId[pkpAddress] = geniusArtistId;
        lensHandleHashToGeniusId[handleHash] = geniusArtistId;

        // Update stats
        totalArtists++;

        emit ArtistRegistered(
            geniusArtistId,
            pkpAddress,
            lensHandle,
            lensAccountAddress
        );
    }

    /**
     * @notice Update artist metadata (for migrations or corrections)
     * @dev Only owner can update. Validates no collisions on new values.
     */
    function updateArtist(
        uint32 geniusArtistId,
        address newPKPAddress,
        string calldata newLensHandle,
        address newLensAccountAddress
    ) external onlyOwner {
        Artist storage artist = artists[geniusArtistId];
        if (artist.geniusArtistId == 0) revert ArtistNotFound(geniusArtistId);

        // Validate new values
        if (newPKPAddress == address(0)) revert InvalidPKPAddress();
        if (newLensAccountAddress == address(0)) revert InvalidLensAccountAddress();
        if (bytes(newLensHandle).length == 0) revert InvalidLensHandle();

        // Check for collisions on new PKP address
        uint32 existingPKPMapping = pkpToGeniusId[newPKPAddress];
        if (existingPKPMapping != 0 && existingPKPMapping != geniusArtistId) {
            revert PKPAlreadyRegistered(newPKPAddress);
        }

        // Check for collisions on new Lens handle
        bytes32 newHandleHash = keccak256(bytes(newLensHandle));
        uint32 existingHandleMapping = lensHandleHashToGeniusId[newHandleHash];
        if (existingHandleMapping != 0 && existingHandleMapping != geniusArtistId) {
            revert LensHandleAlreadyRegistered(newLensHandle);
        }

        // Clear old reverse lookups
        delete pkpToGeniusId[artist.pkpAddress];
        delete lensHandleHashToGeniusId[keccak256(bytes(artist.lensHandle))];

        // Update artist
        artist.pkpAddress = newPKPAddress;
        artist.lensHandle = newLensHandle;
        artist.lensAccountAddress = newLensAccountAddress;
        artist.updatedAt = uint64(block.timestamp);

        // Create new reverse lookups
        pkpToGeniusId[newPKPAddress] = geniusArtistId;
        lensHandleHashToGeniusId[newHandleHash] = geniusArtistId;

        emit ArtistUpdated(geniusArtistId, newPKPAddress, newLensHandle);
    }

    /**
     * @notice Set artist verification status
     * @dev Only owner can verify artists
     */
    function setVerified(uint32 geniusArtistId, bool verified) external onlyOwner {
        Artist storage artist = artists[geniusArtistId];
        if (artist.geniusArtistId == 0) revert ArtistNotFound(geniusArtistId);

        artist.verified = verified;
        artist.updatedAt = uint64(block.timestamp);

        emit ArtistVerified(geniusArtistId, verified);
    }

    // ============ Query Functions ============

    /**
     * @notice Get artist by Genius ID
     * @param geniusArtistId Genius artist ID
     * @return Artist struct
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
        return lensHandleHashToGeniusId[keccak256(bytes(lensHandle))];
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
     * @notice Get total number of registered artists
     */
    function getTotalArtists() external view returns (uint32) {
        return totalArtists;
    }

    // ============ Admin Functions ============

    /**
     * @notice Authorize/revoke registrar
     * @dev Only owner can manage authorizations
     */
    function setAuthorized(address registrar, bool authorized) external onlyOwner {
        isAuthorized[registrar] = authorized;
    }

    /**
     * @notice Transfer ownership to new address
     * @dev Only owner can transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidPKPAddress();
        address oldOwner = owner;
        owner = newOwner;
        isAuthorized[newOwner] = true;
    }
}
