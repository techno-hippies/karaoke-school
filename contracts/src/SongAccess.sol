// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SongAccess
 * @notice Soulbound NFT for song access. Pay ETH to unlock a song forever.
 * @dev Non-transferable. Lit Protocol checks ownsSong() for decryption access.
 *      Single-signature UX - just send ETH, no approvals needed.
 */
contract SongAccess is ERC721, Ownable, ReentrancyGuard {
    // ============ Errors ============
    error AlreadyOwned();
    error InsufficientPayment();
    error TransferNotAllowed();
    error WithdrawFailed();

    // ============ Events ============
    event SongPurchased(
        address indexed buyer,
        uint256 indexed tokenId,
        bytes32 indexed songId,
        string spotifyTrackId,
        uint256 pricePaid
    );
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);

    // ============ State ============

    /// @notice Price in wei. Updated via setPrice() to 0.000033 ETH (~$0.10 at $3000/ETH)
    uint256 public price = 0.0001 ether;

    /// @notice Next token ID to mint
    uint256 private _nextTokenId;

    /// @notice user => songId (keccak256 of spotifyTrackId) => owns
    mapping(address => mapping(bytes32 => bool)) public owns;

    /// @notice tokenId => songId
    mapping(uint256 => bytes32) public tokenSong;

    // ============ Constructor ============

    constructor(address initialOwner)
        ERC721("Karaoke Song Access", "SONG")
        Ownable(initialOwner)
    {}

    // ============ External Functions ============

    /**
     * @notice Purchase song access with ETH (single signature!)
     * @param spotifyTrackId The Spotify track ID (22 chars)
     */
    function purchase(string calldata spotifyTrackId) external payable nonReentrant {
        bytes32 songId = keccak256(bytes(spotifyTrackId));
        if (owns[msg.sender][songId]) revert AlreadyOwned();
        if (msg.value < price) revert InsufficientPayment();

        // Mint soulbound NFT
        uint256 tokenId = _nextTokenId++;
        _mint(msg.sender, tokenId);
        tokenSong[tokenId] = songId;
        owns[msg.sender][songId] = true;

        // Refund excess ETH
        if (msg.value > price) {
            (bool success, ) = msg.sender.call{value: msg.value - price}("");
            require(success, "Refund failed");
        }

        emit SongPurchased(msg.sender, tokenId, songId, spotifyTrackId, price);
    }

    /**
     * @notice Purchase song access for another address (e.g., PKP wallet)
     * @dev Allows EOA to pay while granting access to their PKP wallet
     * @param spotifyTrackId The Spotify track ID (22 chars)
     * @param recipient Address that will receive song access
     */
    function purchaseFor(string calldata spotifyTrackId, address recipient) external payable nonReentrant {
        bytes32 songId = keccak256(bytes(spotifyTrackId));
        if (owns[recipient][songId]) revert AlreadyOwned();
        if (msg.value < price) revert InsufficientPayment();

        // Mint soulbound NFT to recipient
        uint256 tokenId = _nextTokenId++;
        _mint(recipient, tokenId);
        tokenSong[tokenId] = songId;
        owns[recipient][songId] = true;

        // Refund excess ETH
        if (msg.value > price) {
            (bool success, ) = msg.sender.call{value: msg.value - price}("");
            require(success, "Refund failed");
        }

        emit SongPurchased(recipient, tokenId, songId, spotifyTrackId, price);
    }

    /**
     * @notice Admin mint for relayer/fiat payments
     * @param to Recipient address
     * @param spotifyTrackId The Spotify track ID
     */
    function mintFor(address to, string calldata spotifyTrackId) external onlyOwner {
        bytes32 songId = keccak256(bytes(spotifyTrackId));
        if (owns[to][songId]) revert AlreadyOwned();

        uint256 tokenId = _nextTokenId++;
        _mint(to, tokenId);
        tokenSong[tokenId] = songId;
        owns[to][songId] = true;

        emit SongPurchased(to, tokenId, songId, spotifyTrackId, 0);
    }

    // ============ View Functions (for Lit Protocol) ============

    /**
     * @notice Check if user owns a song (for Lit Protocol access control)
     * @param user User address
     * @param songId keccak256(spotifyTrackId)
     * @return True if user has purchased this song
     */
    function ownsSong(address user, bytes32 songId) external view returns (bool) {
        return owns[user][songId];
    }

    /**
     * @notice Check if user owns a song by Spotify track ID
     * @param user User address
     * @param spotifyTrackId The Spotify track ID string
     * @return True if user has purchased this song
     */
    function ownsSongByTrackId(address user, string calldata spotifyTrackId) external view returns (bool) {
        return owns[user][keccak256(bytes(spotifyTrackId))];
    }

    /**
     * @notice Get total songs purchased
     */
    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update price (owner only)
     * @param newPrice New price in wei
     */
    function setPrice(uint256 newPrice) external onlyOwner {
        uint256 oldPrice = price;
        price = newPrice;
        emit PriceUpdated(oldPrice, newPrice);
    }

    /**
     * @notice Withdraw ETH to owner
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = owner().call{value: balance}("");
        if (!success) revert WithdrawFailed();
    }

    // ============ Soulbound (Non-Transferable) ============

    /**
     * @dev Block all transfers except minting (OZ v5 uses _update hook)
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) revert TransferNotAllowed();
        return super._update(to, tokenId, auth);
    }

    /**
     * @dev Block approvals (meaningless for soulbound)
     */
    function approve(address, uint256) public pure override {
        revert TransferNotAllowed();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert TransferNotAllowed();
    }
}
