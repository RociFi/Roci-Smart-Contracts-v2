// SPDX-License-Identifier: None
pragma solidity ^0.8.4;
uint256 constant ONE_HUNDRED_PERCENT = 100 ether; // NOTE This CAN NOT exceed 2^256/2 -1 as type casting to int occurs

uint256 constant ONE_YEAR = 31556926;
uint256 constant ONE_DAY = ONE_HOUR * 24;
uint256 constant ONE_HOUR = 60 * 60;

uint256 constant APY_CONST = 3000000000 gwei;

uint8 constant CONTRACT_DECIMALS = 18;

address constant DEAD = 0x000000000000000000000000000000000000dEaD;
address constant ZERO_ADDRESS = 0x0000000000000000000000000000000000000000;

uint256 constant ROLE_TOKEN = 0;
uint256 constant ROLE_BONDS = 1;
uint256 constant ROLE_PAYMENT_CONTRACT = 2;
uint256 constant ROLE_REV_MANAGER = 3;
uint256 constant ROLE_NFCS = 4;
uint256 constant ROLE_COLLATERAL_MANAGER = 5;
uint256 constant ROLE_PRICE_FEED = 6;
uint256 constant ROLE_ORACLE = 7;
uint256 constant ROLE_ADMIN = 8;
uint256 constant ROLE_PAUSER = 9;
uint256 constant ROLE_LIQUIDATOR = 10;
uint256 constant ROLE_COLLECTOR = 11;
