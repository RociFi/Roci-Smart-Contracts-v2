// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import {ICollateralManager} from "./interfaces/ICollateralManager.sol";

import {Errors} from "./lib/Errors.sol";
import {Roles} from "./lib/Roles.sol";
import {Version} from "./lib/Version.sol";
import {SelectivePausable} from "./lib/SelectivePausable.sol";
import {COLLATERAL_MANAGER_VERSION} from "./lib/ContractVersions.sol";
import {ListMap} from "./lib/ListMap.sol";
import {IWrapper} from "./interfaces/IWrapper.sol";

/*
 * @title CollateralManager
 * @author RociFi Labs
 * @notice Contract used for managing collateral
 */
contract CollateralManager is
    Initializable,
    UUPSUpgradeable,
    SelectivePausable,
    AccessControlUpgradeable,
    ICollateralManager,
    Version
{
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;
    using ListMap for ListMap._IERC20MetadataUpgradeable;

    // accepted collaterals
    ListMap._IERC20MetadataUpgradeable internal allowedCollaterals;
    // amount of collateral user deposited
    mapping(IERC20MetadataUpgradeable => mapping(address => uint256))
        public collateralToUserToAmount;
    // amount of collateral which was freezed for taken loans
    mapping(IERC20MetadataUpgradeable => mapping(address => mapping(address => uint256)))
        public collateralToFreezerToUserToAmount;
    // contract used for wrapping native asset (e.g. ETH, MATIC, etc)
    IWrapper public wrapper;

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        whenPaused
        onlyRole(Roles.UPDATER)
    {}

    function initialize(address admin) public initializer {
        require(admin != address(0), Errors.ZERO_ADDRESS);
        __Pausable_init();

        _setRoleAdmin(Roles.ADMIN, Roles.ADMIN);
        _setRoleAdmin(Roles.LOAN_MANAGER, Roles.ADMIN);
        _setRoleAdmin(Roles.PAUSER, Roles.ADMIN);
        _setRoleAdmin(Roles.UPDATER, Roles.ADMIN);

        _grantRole(Roles.ADMIN, admin);

        _addPausableFunc("add", this.addCollateral.selector);
        _addPausableFunc("claim", this.claimCollateral.selector);
    }

    /**
     * @dev Modifier to check that amount is not zero
     * @param amount amount value to check
     */
    modifier checkAmount(uint256 amount) {
        require(amount > 0, Errors.ZERO_VALUE);
        _;
    }

    /**
     * @dev Modifier to check that operator is LoanManager or user itself
     * @param operator operator address
     */
    modifier checkFreezerOrUser(address operator) {
        require(
            hasRole(Roles.LOAN_MANAGER, msg.sender) || operator == msg.sender,
            Errors.COLLATERAL_MANAGER_FREEZER_OR_USER
        );
        _;
    }

    /**
     * @dev Modifier to verify that user has sufficient collateral balance
     * @param token collateral address
     * @param owner user address
     * @param amount needed amount of collateral
     */
    modifier checkCollateralBalance(
        IERC20MetadataUpgradeable token,
        address owner,
        uint256 amount
    ) {
        require(
            collateralToUserToAmount[token][owner] >= amount,
            Errors.COLLATERAL_MANAGER_INSUFFICIENT_AMOUNT
        );
        _;
    }

    /**
     * @dev Modifier to verify that user has sufficient collateral balance
     * @param token collateral address
     * @param freezer address (LoanManager)
     * @param owner user address
     * @param amount needed amount of collateral
     */
    modifier checkFrozenCollateralBalance(
        IERC20MetadataUpgradeable token,
        address freezer,
        address owner,
        uint256 amount
    ) {
        require(
            collateralToFreezerToUserToAmount[token][freezer][owner] >= amount,
            Errors.COLLATERAL_MANAGER_FROZEN_INSUFFICIENT_AMOUNT
        );
        _;
    }

    /**
     * @dev Method to get all supported collaterals
     */
    function getCollaterals() external view returns (IERC20MetadataUpgradeable[] memory) {
        return allowedCollaterals.list;
    }

    /**
     * @dev Method to set wrapper
     * @param _wrapper address for wrapper contract
     */
    function setNativeWrapper(IWrapper _wrapper) external onlyRole(Roles.ADMIN) {
        emit WrapperChanged(msg.sender, wrapper, _wrapper, block.timestamp);
        wrapper = _wrapper;
    }

    /**
     * @dev Method to add supported collaterals
     * @param _collaterals list of collateral addresses
     */
    function addCollaterals(IERC20MetadataUpgradeable[] memory _collaterals)
        external
        onlyRole(Roles.ADMIN)
    {
        allowedCollaterals.addList(_collaterals);
        emit CollateralsAdded(msg.sender, _collaterals, block.timestamp);
    }

    /**
     * @dev Method to remove supported collaterals
     * @param _collaterals list of collateral addresses
     */
    function removeCollaterals(IERC20MetadataUpgradeable[] memory _collaterals)
        external
        onlyRole(Roles.ADMIN)
    {
        allowedCollaterals.removeList(_collaterals);
        emit CollateralsRemoved(msg.sender, _collaterals, block.timestamp);
    }

    /**
     * @dev Method to freeze deposited collateral of user
     * @param user borrower address
     * @param token collateral address
     * @param amount amount of collateral to freeze
     */
    function freeze(
        address user,
        IERC20MetadataUpgradeable token,
        uint256 amount
    )
        external
        checkAmount(amount)
        checkCollateralBalance(token, user, amount)
        onlyRole(Roles.LOAN_MANAGER)
    {
        require(allowedCollaterals.includes[token], Errors.COLLATERAL_MANAGER_TOKEN_NOT_SUPPORTED);

        collateralToUserToAmount[token][user] -= amount;
        collateralToFreezerToUserToAmount[token][msg.sender][user] += amount;

        emit CollateralFrozen(user, msg.sender, token, amount);
    }

    /**
     * @dev Method to unfreeze collateral of user
     * @param user borrower address
     * @param token collateral address
     * @param amount amount of collateral to unfreeze
     */
    function unfreeze(
        address user,
        IERC20MetadataUpgradeable token,
        uint256 amount
    )
        external
        checkAmount(amount)
        onlyRole(Roles.LOAN_MANAGER)
        checkFrozenCollateralBalance(token, msg.sender, user, amount)
    {
        collateralToFreezerToUserToAmount[token][msg.sender][user] -= amount;
        collateralToUserToAmount[token][user] += amount;

        emit CollateralUnfrozen(user, msg.sender, token, amount);
    }

    /**
     * @dev Method to deposit collateral
     * @param user user address
     * @param token collateral address
     * @param amount amount of collateral to add
     */
    function addCollateral(
        address user,
        IERC20MetadataUpgradeable token,
        uint256 amount
    ) external payable checkFreezerOrUser(user) ifNotPaused {
        require(amount > 0 || msg.value > 0, Errors.ZERO_VALUE);
        require(allowedCollaterals.includes[token], Errors.COLLATERAL_MANAGER_TOKEN_NOT_SUPPORTED);

        // if token is native then wrap it
        if (msg.value > 0) {
            require(address(wrapper) != address(0), Errors.COLLATERAL_MANAGER_WRAPPER_ZERO);
            require(
                address(wrapper) == address(token),
                Errors.COLLATERAL_MANAGER_TOKEN_IS_NOT_WRAPPER
            );
            wrapper.deposit{value: msg.value}();
            amount = msg.value;
        } else {
            token.safeTransferFrom(user, address(this), amount);
        }

        collateralToUserToAmount[token][user] += amount;
        emit CollateralAdded(user, token, amount);
    }

    /**
     * @dev Method to withdraw collateral
     * @param user user address
     * @param token collateral address
     * @param amount amount of collateral to withdraw
     */
    function claimCollateral(
        address user,
        IERC20MetadataUpgradeable token,
        uint256 amount
    )
        external
        checkAmount(amount)
        checkFreezerOrUser(user)
        checkCollateralBalance(token, user, amount)
        ifNotPaused
    {
        collateralToUserToAmount[token][user] -= amount;

        // if token is wrapped native - unwrap it
        if (token == IERC20MetadataUpgradeable(address(wrapper))) {
            wrapper.withdraw(amount);
            require(payable(user).send(amount), Errors.COLLATERAL_MANAGER_NATIVE_TRANSFER);
        } else {
            token.safeTransfer(user, amount);
        }

        emit CollateralClaimed(user, token, amount);
    }

    /**
     * @dev Method called by LoanManager to seize the collateral during liquidation
     * @param liquidator liquidator address
     * @param token collateral address
     * @param user user address
     * @param amount amount of collateral needed for liquidation
     */
    function seize(
        address liquidator,
        IERC20MetadataUpgradeable token,
        address user,
        uint256 amount
    )
        external
        checkAmount(amount)
        onlyRole(Roles.LOAN_MANAGER)
        checkFrozenCollateralBalance(token, msg.sender, user, amount)
    {
        collateralToFreezerToUserToAmount[token][msg.sender][user] -= amount;

        if (token == IERC20MetadataUpgradeable(address(wrapper))) {
            require(
                wrapper.transfer(liquidator, amount),
                Errors.COLLATERAL_MANAGER_NATIVE_TRANSFER
            );
        } else {
            token.safeTransfer(liquidator, amount);
        }

        emit CollateralSeized(liquidator, user, msg.sender, token, amount);
    }

    /**
     * @dev pause contract
     */
    function pause() external onlyRole(Roles.PAUSER) {
        _pause();
    }

    /**
     * @dev unpause contract
     */
    function unpause() external onlyRole(Roles.PAUSER) {
        _unpause();
    }

    /**
     * @dev pause specific method on contract
     * @param name method name
     * @param paused boolean
     */
    function setFuncPaused(string memory name, bool paused) external onlyRole(Roles.PAUSER) {
        _setFuncPaused(name, paused);
    }

    /**
     * @dev get current contract version
     */
    function currentVersion() public pure override returns (string memory) {
        return COLLATERAL_MANAGER_VERSION;
    }

    fallback() external payable {}

    receive() external payable {}
}
