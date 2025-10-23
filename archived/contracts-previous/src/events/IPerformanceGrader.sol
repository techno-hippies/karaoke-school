// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title IPerformanceGrader
 * @notice Interface for PerformanceGrader contract
 * @dev Used by Lit Actions and frontend integrations
 */
interface IPerformanceGrader {

    // ============ Events ============

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

    // ============ Errors ============

    error NotOwner();
    error NotTrustedPKP();
    error ContractPaused();
    error InvalidAddress();
    error InvalidScore();

    // ============ Functions ============

    function gradePerformance(
        uint256 performanceId,
        bytes32 segmentHash,
        address performer,
        uint16 score,
        string calldata metadataUri
    ) external;

    function submitPerformance(
        uint256 performanceId,
        bytes32 segmentHash,
        address performer,
        string calldata videoUri
    ) external;

    function setTrustedPKP(address newPKP) external;

    function setPaused(bool _paused) external;

    function transferOwnership(address newOwner) external;

    // ============ View Functions ============

    function owner() external view returns (address);

    function trustedPKP() external view returns (address);

    function paused() external view returns (bool);
}
