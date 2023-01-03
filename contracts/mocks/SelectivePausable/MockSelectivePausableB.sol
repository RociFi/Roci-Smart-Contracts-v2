// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {SelectivePausable} from "../../lib/SelectivePausable.sol";

import {IMockSelectivePausableA} from "./IMockSelectivePausableA.sol";

contract MockSelectivePausableB {
    IMockSelectivePausableA public pausableA;

    constructor(IMockSelectivePausableA _pausableA) {
        pausableA = _pausableA;
    }

    function callSetValueA(uint256 value) external {
        pausableA.setValue(value);
    }

    function callSetZeroA() external {
        pausableA.setZero();
    }

    function readValueFromA() external view returns (uint256) {
        return pausableA.readValue();
    }
}
