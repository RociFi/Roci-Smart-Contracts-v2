// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IMockSelectivePausableA {
    function setValue(uint256 value) external;

    function setZero() external;

    function readValue() external view returns (uint256);
}
