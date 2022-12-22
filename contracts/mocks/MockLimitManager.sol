// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";

import {ILimitManager} from "../interfaces/ILimitManager.sol";
import {IPool} from "../interfaces/IPool.sol";

contract MockLimitManager is ILimitManager {
    function onBorrow(
        address user,
        IPool pool,
        uint16 score,
        uint256 amount
    ) external {}

    function onRepayOrLiquidate(
        address user,
        IPool pool,
        uint256 amount
    ) external {}

    function onLoanFulfillment(address user, IPool pool) external {}
}
