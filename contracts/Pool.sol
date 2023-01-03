// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import {IPool} from "./interfaces/IPool.sol";

import {Errors} from "./lib/Errors.sol";
import {Roles} from "./lib/Roles.sol";
import {Version} from "./lib/Version.sol";
import {SelectivePausable} from "./lib/SelectivePausable.sol";
import {POOL_VERSION} from "./lib/ContractVersions.sol";

/*
 * @title Pool
 * @author RociFi Labs
 */
contract Pool is
    IPool,
    Initializable,
    ERC20Upgradeable,
    SelectivePausable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    Version
{
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;

    // address of underlying asset used for deposit
    IERC20MetadataUpgradeable public underlyingToken;
    // pool value corresponding to amount of deposited amount of underlyingToken
    uint256 public poolValue;
    // decimals amount of Roci Debt Token
    uint8 private rTokenDecimals;
    // timestamp of last deposit for every depositor
    mapping(address => uint256) public lastDepositTimestamp;
    // lockup period in seconds to prevent quick deposit-withdrawals by bots
    uint256 public lockupPeriod;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        whenPaused
        onlyRole(Roles.UPDATER)
    {}

    function initialize(
        IERC20MetadataUpgradeable _token,
        string memory symbol_,
        string memory name_,
        address _admin
    ) public initializer {
        require(_admin != address(0), Errors.ZERO_ADDRESS);
        require(address(_token) != address(0), Errors.ZERO_ADDRESS);

        __Pausable_init();
        __ERC20_init(name_, symbol_);

        underlyingToken = _token;

        rTokenDecimals = _token.decimals();

        _setRoleAdmin(Roles.ADMIN, Roles.ADMIN);
        _setRoleAdmin(Roles.PAUSER, Roles.ADMIN);
        _setRoleAdmin(Roles.UPDATER, Roles.ADMIN);
        _setRoleAdmin(Roles.LOAN_MANAGER, Roles.ADMIN);

        _grantRole(Roles.ADMIN, _admin);

        _addPausableFunc("deposit", this.deposit.selector);
        _addPausableFunc("withdraw", this.withdraw.selector);
    }

    /**
     * @dev Method to set lockupPeriod
     * @param value of a new lockupPeriod
     */
    function setLockupPeriod(uint256 value) external onlyRole(Roles.ADMIN) {
        emit LockupPeriodChanged(msg.sender, lockupPeriod, value, block.timestamp);
        lockupPeriod = value;
    }

    /**
     * @dev Method to convert underlyingToken into Roci Debt Token
     * @param value underlyingToken amount
     * @return result Roci Debt Token amount
     */
    function stablecoinToRToken(uint256 value) public view returns (uint256) {
        return totalSupply() == 0 ? value : (totalSupply() * value) / poolValue;
    }

    /**
     * @dev Method to convert Roci Debt Token into underlyingToken
     * @param value Roci Debt Token amount
     * @return result underlyingToken amount
     */
    function rTokenToStablecoin(uint256 value) public view returns (uint256) {
        require(totalSupply() > 0, Errors.POOL_TOTAL_SUPPLY_ZERO);
        return (poolValue * value) / totalSupply();
    }

    /**
     * @dev Method to deposit liquidity
     * @param underlyingTokenAmount underlyingToken amount
     * @param version Pool version
     */
    function deposit(uint256 underlyingTokenAmount, string memory version)
        external
        checkVersion(version)
        ifNotPaused
    {
        uint256 rTokenAmount = stablecoinToRToken(underlyingTokenAmount);

        lastDepositTimestamp[msg.sender] = block.timestamp;

        poolValue += underlyingTokenAmount;

        _mint(msg.sender, rTokenAmount);

        underlyingToken.safeTransferFrom(msg.sender, address(this), underlyingTokenAmount);

        emit LiquidityDeposited(block.timestamp, msg.sender, underlyingTokenAmount, rTokenAmount);
    }

    /**
     * @dev Method to withdraw liquidity
     * @param rTokenAmount Roci Debt Token amount
     * @param version Pool version
     */
    function withdraw(uint256 rTokenAmount, string memory version)
        external
        checkVersion(version)
        ifNotPaused
    {
        require(
            block.timestamp > (lastDepositTimestamp[msg.sender] + lockupPeriod),
            Errors.POOL_LOCKUP
        );

        uint256 underlyingTokenAmount = rTokenToStablecoin(rTokenAmount);

        poolValue -= underlyingTokenAmount;

        _burn(msg.sender, rTokenAmount);

        underlyingToken.safeTransfer(msg.sender, underlyingTokenAmount);

        emit LiquidityWithdrawn(block.timestamp, msg.sender, underlyingTokenAmount, rTokenAmount);
    }

    /**
     * @dev Method to update pool value
     * @notice called by LoanManager
     * @notice in case of interest payment poolValue will be increased
     * @notice in case of liquidation poolValue will be decreased
     * @param value underlyingToken amount
     */
    function updatePoolValue(int256 value) external whenNotPaused onlyRole(Roles.LOAN_MANAGER) {
        int256 newPoolValue = int256(poolValue) + value;

        require(newPoolValue >= 0, Errors.POOL_VALUE_LT_ZERO);

        emit PoolValueUpdated(msg.sender, poolValue, uint256(newPoolValue), block.timestamp);

        poolValue = uint256(newPoolValue);
    }

    /**
     * @dev Method to get decimals for Roci Debt Token
     */
    function decimals() public view override(ERC20Upgradeable, IPool) returns (uint8) {
        return rTokenDecimals;
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
    function currentVersion() public pure virtual override returns (string memory) {
        return POOL_VERSION;
    }

    /**
     * @dev Method to approve spending of underlyingToken by LoanManager
     * @notice needed for borrowing
     * @param loanManager LoanManager address
     * @param amount amount to approve
     */
    function approveLoanManager(address loanManager, uint256 amount)
        external
        onlyRole(Roles.ADMIN)
    {
        _checkRole(Roles.LOAN_MANAGER, loanManager);

        underlyingToken.approve(loanManager, amount);
        emit LoanManagerApproved(loanManager, amount);
    }
}
