// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";

interface IPool {
    event LiquidityDeposited(
        uint256 timestamp,
        address indexed user,
        uint256 amountUnderlyingToken,
        uint256 amountRToken
    );

    event LiquidityWithdrawn(
        uint256 timestamp,
        address indexed user,
        uint256 amountUnderlyingToken,
        uint256 amountRToken
    );

    event PoolValueUpdated(
        address indexed loanManager,
        uint256 old,
        uint256 updated,
        uint256 timestamp
    );

    event LoanManagerApproved(address loanManager, uint256 amount);

    event LockupPeriodChanged(address user, uint256 old, uint256 updated, uint256 timestamp);

    function underlyingToken() external view returns (IERC20MetadataUpgradeable);

    function decimals() external view returns (uint8);

    function updatePoolValue(int256) external;

    function deposit(uint256, string memory) external;

    function withdraw(uint256, string memory) external;
}
