// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title IArtistRegistry
 * @notice Interface for the Artist Registry contract
 * @dev Maps Genius Artist IDs to PKP addresses and Lens profiles
 */
interface IArtistRegistry {

    // ============ Types ============

    struct Artist {
        uint32 geniusArtistId;      // Genius.com artist ID (primary identifier)
        address pkpAddress;          // Lit Protocol PKP address
        string lensHandle;           // Lens username (without @)
        address lensAccountAddress;  // Lens account contract address
        bool verified;               // Platform verification flag
        uint64 createdAt;            // Registration timestamp
        uint64 updatedAt;            // Last update timestamp
    }

    // ============ Events ============

    event ArtistRegistered(
        uint32 indexed geniusArtistId,
        address indexed pkpAddress,
        string lensHandle,
        address lensAccountAddress
    );

    event ArtistUpdated(
        uint32 indexed geniusArtistId,
        address indexed pkpAddress,
        string lensHandle
    );

    event ArtistVerified(uint32 indexed geniusArtistId, bool verified);

    // ============ Errors ============

    error ArtistAlreadyExists(uint32 geniusArtistId);
    error ArtistNotFound(uint32 geniusArtistId);
    error PKPAlreadyRegistered(address pkpAddress);
    error LensHandleAlreadyRegistered(string lensHandle);
    error InvalidGeniusId();
    error InvalidPKPAddress();
    error InvalidLensHandle();
    error InvalidLensAccountAddress();
    error NotOwner();
    error NotAuthorized();

    // ============ Functions ============

    function registerArtist(
        uint32 geniusArtistId,
        address pkpAddress,
        string calldata lensHandle,
        address lensAccountAddress
    ) external;

    function updateArtist(
        uint32 geniusArtistId,
        address newPKPAddress,
        string calldata newLensHandle,
        address newLensAccountAddress
    ) external;

    function setVerified(uint32 geniusArtistId, bool verified) external;

    function getArtist(uint32 geniusArtistId) external view returns (Artist memory);

    function artistExists(uint32 geniusArtistId) external view returns (bool);

    function getGeniusIdByPKP(address pkpAddress) external view returns (uint32);

    function getGeniusIdByLensHandle(string calldata lensHandle) external view returns (uint32);

    function getLensHandle(uint32 geniusArtistId) external view returns (string memory);

    function getPKPAddress(uint32 geniusArtistId) external view returns (address);

    function getTotalArtists() external view returns (uint32);
}
