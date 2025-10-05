// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title MsgSenderTest
 * @notice Minimal contract to test msg.sender in zkSync EIP-712 transactions
 */
contract MsgSenderTest {
    event SenderLogged(address indexed sender, uint256 timestamp);

    address public lastSender;
    uint256 public callCount;

    function logSender() external returns (address) {
        lastSender = msg.sender;
        callCount++;
        emit SenderLogged(msg.sender, block.timestamp);
        return msg.sender;
    }

    function getLastSender() external view returns (address) {
        return lastSender;
    }
}
