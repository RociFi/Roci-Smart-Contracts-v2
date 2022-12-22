// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {PriceFeed} from "../PriceFeed.sol";

contract MockPriceFeed is PriceFeed {
    mapping(address => uint256) public latestAnswer;

    function init(address _owner) public initializer {
        PriceFeed.initialize(_owner);
    }

    function setLatestAnswer(address feed, uint256 amount) external {
        latestAnswer[feed] = amount;
    }

    function queryFeed(address feedAddress) internal view override returns (uint256) {
        uint256 price = latestAnswer[feedAddress];
        require(price > 0);
        return price;
    }
}
