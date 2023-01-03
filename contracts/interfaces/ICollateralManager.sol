// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import {IWrapper} from "./IWrapper.sol";

interface ICollateralManager {
    event AllowedTokenSet(
        uint256 timestamp,
        IERC20MetadataUpgradeable indexed token,
        bool indexed isSet
    );
    event CollateralAdded(address indexed user, IERC20MetadataUpgradeable token, uint256 amount);
    event CollateralClaimed(address indexed user, IERC20MetadataUpgradeable token, uint256 amount);
    event CollateralFrozen(
        address indexed user,
        address indexed freezer,
        IERC20MetadataUpgradeable token,
        uint256 amount
    );
    event CollateralUnfrozen(
        address indexed user,
        address indexed freezer,
        IERC20MetadataUpgradeable token,
        uint256 amount
    );
    event CollateralSeized(
        address indexed liquidator,
        address indexed user,
        address indexed freezer,
        IERC20MetadataUpgradeable token,
        uint256 amount
    );
    event WrapperChanged(address user, IWrapper old, IWrapper updated, uint256 timestamp);
    event CollateralsAdded(
        address user,
        IERC20MetadataUpgradeable[] collaterals,
        uint256 timestamp
    );
    event CollateralsRemoved(
        address user,
        IERC20MetadataUpgradeable[] collaterals,
        uint256 timestamp
    );

    function wrapper() external view returns (IWrapper);

    function collateralToUserToAmount(
        IERC20MetadataUpgradeable,
        address
    ) external view returns (uint256);

    function freeze(address user, IERC20MetadataUpgradeable token, uint256 amount) external;

    function unfreeze(address user, IERC20MetadataUpgradeable token, uint256 amount) external;

    function addCollateral(
        address user,
        IERC20MetadataUpgradeable token,
        uint256 amount
    ) external payable;

    function claimCollateral(
        address user,
        IERC20MetadataUpgradeable token,
        uint256 amount
    ) external;

    function seize(
        address liquidator,
        IERC20MetadataUpgradeable token,
        address user,
        uint256 amount
    ) external;
}
