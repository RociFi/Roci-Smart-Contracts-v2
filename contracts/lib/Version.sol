// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {IVersion} from "../interfaces/IVersion.sol";
import {Errors} from "./Errors.sol";

/*
 * @title Version
 * @author RociFi Labs
 * @notice  Abstract contract for implementing versioning functionality
 * @notice Used to mark backwards-incompatible changes to the contract logic.
 * @notice checkVersion modifier should be applied to all external mutating methods
 */

abstract contract Version is IVersion {
    /**
     * @notice converts string to bytes32
     */
    function getVersionAsBytes(string memory v) public pure override returns (bytes32 result) {
        if (bytes(v).length == 0) {
            return 0x0;
        }

        assembly {
            result := mload(add(v, 32))
        }
    }

    /**
     * @notice
     * Controls the call of mutating methods in versioned contract.
     * The following modifier reverts unless the value of the `versionToCheck` argument
     * matches the one provided in currentVersion method.
     */
    modifier checkVersion(string memory versionToCheck) {
        require(
            getVersionAsBytes(this.currentVersion()) == getVersionAsBytes(versionToCheck),
            Errors.VERSION
        );
        _;
    }
}
