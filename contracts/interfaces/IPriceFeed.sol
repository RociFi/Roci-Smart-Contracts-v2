// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";

interface IPriceFeed {
    function convert(
        uint256 amount,
        IERC20MetadataUpgradeable token,
        IERC20MetadataUpgradeable targetToken
    ) external view returns (uint256);

    event PriceFeedSet(
        uint256 timestamp,
        address indexed priceFeed,
        IERC20MetadataUpgradeable indexed from,
        IERC20MetadataUpgradeable indexed to,
        uint8 fromDecimals
    );
}
