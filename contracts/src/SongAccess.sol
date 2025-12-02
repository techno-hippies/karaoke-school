// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title SongAccess
 * @notice Soulbound NFT for song access. Pay $0.10 USDC to unlock a song forever.
 * @dev Non-transferable. Lit Protocol checks ownsSong() for decryption access.
 */
contract SongAccess is ERC721, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Errors ============
    error AlreadyOwned();
    error InvalidPermit();
    error TransferNotAllowed();

    // ============ Events ============
    event SongPurchased(
        address indexed buyer,
        uint256 indexed tokenId,
        bytes32 indexed songId,
        string spotifyTrackId
    );
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);

    // ============ State ============

    /// @notice USDC contract (6 decimals)
    IERC20Permit public immutable usdc;

    /// @notice Price in USDC (6 decimals). Default: 100000 = $0.10
    uint256 public price = 100_000;

    /// @notice Next token ID to mint
    uint256 private _nextTokenId;

    /// @notice user => songId (keccak256 of spotifyTrackId) => owns
    mapping(address => mapping(bytes32 => bool)) public owns;

    /// @notice tokenId => songId
    mapping(uint256 => bytes32) public tokenSong;

    // ============ Constructor ============

    constructor(address _usdc, address initialOwner)
        ERC721("Karaoke Song Access", "SONG")
        Ownable(initialOwner)
    {
        usdc = IERC20Permit(_usdc);
    }

    // ============ External Functions ============

    /**
     * @notice Purchase song access with USDC permit (single signature!)
     * @param spotifyTrackId The Spotify track ID (22 chars)
     * @param deadline Permit deadline timestamp
     * @param v Permit signature v
     * @param r Permit signature r
     * @param s Permit signature s
     */
    function purchase(
        string calldata spotifyTrackId,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        bytes32 songId = keccak256(bytes(spotifyTrackId));
        if (owns[msg.sender][songId]) revert AlreadyOwned();

        // Permit allows USDC transfer without separate approve tx
        usdc.permit(msg.sender, address(this), price, deadline, v, r, s);
        IERC20(address(usdc)).safeTransferFrom(msg.sender, address(this), price);

        // Mint soulbound NFT
        uint256 tokenId = _nextTokenId++;
        _mint(msg.sender, tokenId);
        tokenSong[tokenId] = songId;
        owns[msg.sender][songId] = true;

        emit SongPurchased(msg.sender, tokenId, songId, spotifyTrackId);
    }

    /**
     * @notice Purchase without permit (user must approve USDC first)
     * @param spotifyTrackId The Spotify track ID
     */
    function purchaseWithApproval(string calldata spotifyTrackId) external nonReentrant {
        bytes32 songId = keccak256(bytes(spotifyTrackId));
        if (owns[msg.sender][songId]) revert AlreadyOwned();

        IERC20(address(usdc)).safeTransferFrom(msg.sender, address(this), price);

        uint256 tokenId = _nextTokenId++;
        _mint(msg.sender, tokenId);
        tokenSong[tokenId] = songId;
        owns[msg.sender][songId] = true;

        emit SongPurchased(msg.sender, tokenId, songId, spotifyTrackId);
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

        emit SongPurchased(to, tokenId, songId, spotifyTrackId);
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
     * @param newPrice New price in USDC (6 decimals)
     */
    function setPrice(uint256 newPrice) external onlyOwner {
        uint256 oldPrice = price;
        price = newPrice;
        emit PriceUpdated(oldPrice, newPrice);
    }

    /**
     * @notice Withdraw USDC to owner
     */
    function withdraw() external onlyOwner {
        uint256 balance = IERC20(address(usdc)).balanceOf(address(this));
        IERC20(address(usdc)).safeTransfer(owner(), balance);
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

// ============ Interfaces ============

interface IERC20Permit {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function nonces(address owner) external view returns (uint256);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}
