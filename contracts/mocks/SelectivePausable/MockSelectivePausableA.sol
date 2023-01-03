// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {SelectivePausable} from "../../lib/SelectivePausable.sol";

import {IMockSelectivePausableA} from "./IMockSelectivePausableA.sol";

contract MockSelectivePausableA is
    IMockSelectivePausableA,
    Initializable,
    SelectivePausable,
    UUPSUpgradeable
{
    uint256 internal value;

    function _authorizeUpgrade(address newImplementation) internal override {}

    function initialize() public initializer {
        __Pausable_init();

        value = 1;

        _addPausableFunc("setValue", this.setValue.selector);
        _addPausableFunc("setZero", this.setZero.selector);

        _setFuncPaused("setZero", true);
    }

    function setValue(uint256 _value) external ifNotPaused {
        value = _value;
    }

    function setZero() public ifNotPaused {
        value = 0;
    }

    function readValue() external view ifNotPaused returns (uint256) {
        return value;
    }

    function pause() external {
        _pause();
    }

    function setFuncPaused(string memory name, bool paused) external {
        _setFuncPaused(name, paused);
    }
}
