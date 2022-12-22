// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";

import {Pool} from "../Pool.sol";

contract MockPool is Pool {
    function init(
        IERC20MetadataUpgradeable _token,
        string memory symbol_,
        string memory name_,
        address _admin
    ) public initializer {
        Pool.initialize(_token, symbol_, name_, _admin);
    }

    function currentVersion() public pure virtual override returns (string memory) {
        return "11.11.11";
    }
}
