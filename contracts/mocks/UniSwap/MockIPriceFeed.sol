// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.6;

interface MockIPriceFeed {
    function convert(
        uint256 amount,
        address token,
        address targetToken
    ) external view returns (uint256);

    event PriceFeedSet(
        uint256 timestamp,
        address indexed priceFeed,
        address indexed from,
        address indexed to,
        uint8 fromDecimals
    );
}
