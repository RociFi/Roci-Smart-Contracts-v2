// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

/**
 * @title IVersion
 * @author RociFi Labs
 * @notice Interface for implementing versioning of contracts
 * @notice Used to mark backwards-incompatible changes to the contract logic.
 * @notice All interfaces of versioned contracts should inherit this interface
 */

interface IVersion {
    /**
     * @notice returns the current version of the contract
     */
    function currentVersion() external pure returns (string memory);

    /**
     * @notice converts string to bytes32
     */
    function getVersionAsBytes(string memory v) external pure returns (bytes32 result);
}
