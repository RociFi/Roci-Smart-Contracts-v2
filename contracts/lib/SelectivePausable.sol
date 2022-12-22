// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

/*
 * @title Selective Pausable Contract for RociFi Cydonia
 * @author RociFi Labs
 * @notice Allows to pause functions independently without effecting global pausable
 * @notice Inheritance from PausableUpgradable allows to add minimal functionality to support both global and selective pausability
 */

abstract contract SelectivePausable is PausableUpgradeable {
    //Function name to function selector mapping
    mapping(string => bytes4) internal funcNameSelector;
    //Function selector to function name mapping
    mapping(bytes4 => string) public selectorFuncName;

    //Function paused/unpaused mapping
    mapping(bytes4 => bool) public funcSelectorPaused;

    event PausableMethodAdded(string name, bytes4 selector, uint256 timestamp);
    event MethodPaused(string name, bool paused, uint256 timestamp);

    /**
     * @dev Adds selective pausability to function name using selector
     * @param name function name as string
     * @param selector function selector as bytes4; can be achieved using this.function.selector
     */
    function _addPausableFunc(string memory name, bytes4 selector) internal {
        funcNameSelector[name] = selector;
        selectorFuncName[selector] = name;
        emit PausableMethodAdded(name, selector, block.timestamp);
    }

    /**
     * @dev Pause/unpause function by name
     * @param name function name as string
     * @param paused true to pause
     */
    function _setFuncPaused(string memory name, bool paused) internal virtual {
        require(funcNameSelector[name] != bytes4(0), "Unknown function.");
        funcSelectorPaused[funcNameSelector[name]] = paused;
        emit MethodPaused(name, paused, block.timestamp);
    }

    /**
     * @dev whenNotPaused modifier can't be overridden, thus we added out modifier that implements both functionalities
     */
    modifier ifNotPaused() {
        _requireNotPaused();
        require(
            funcSelectorPaused[msg.sig] == false,
            string(bytes.concat(bytes(selectorFuncName[msg.sig]), bytes(" function is on pause.")))
        );
        _;
    }
}
