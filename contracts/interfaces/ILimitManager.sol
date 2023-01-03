// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IPool} from "./IPool.sol";

interface ILimitManager {
    event PoolToMaxBorrowLimitChanged(
        address user,
        IPool indexed pool,
        uint256 old,
        uint256 updated,
        uint256 timestamp
    );
    event PoolToMinBorrowLimitChanged(
        address user,
        IPool indexed pool,
        uint256 old,
        uint256 updated,
        uint256 timestamp
    );
    event PoolToScoreToBorrowLimitChanged(
        address user,
        IPool indexed pool,
        uint16 indexed score,
        uint256 old,
        uint256 updated,
        uint256 timestamp
    );
    event PoolToMaxLoanNumberChanged(
        address user,
        IPool indexed pool,
        uint256 old,
        uint256 updated,
        uint256 timestamp
    );

    function onBorrow(
        address user,
        IPool pool,
        uint16 score,
        uint256 amount
    ) external;

    function onRepayOrLiquidate(
        address user,
        IPool pool,
        uint256 amount
    ) external;

    function onLoanFulfillment(address user, IPool pool) external;
}
