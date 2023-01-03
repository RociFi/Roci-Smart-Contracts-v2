// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import {IPool} from "./interfaces/IPool.sol";
import {ILimitManager} from "./interfaces/ILimitManager.sol";

import {Roles} from "./lib/Roles.sol";
import {Errors} from "./lib/Errors.sol";
import {Version} from "./lib/Version.sol";
import {LIMIT_MANAGER_VERSION} from "./lib/ContractVersions.sol";


/*
 * @title LimitManager
 * @author RociFi Labs
 * @notice Contract for tracking borrow limits
 */
contract LimitManager is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    Version,
    ILimitManager
{
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(Roles.UPDATER)
    {}

    function initialize(address admin) public initializer {
        require(admin != address(0), Errors.ZERO_ADDRESS);

        _setRoleAdmin(Roles.ADMIN, Roles.ADMIN);
        _setRoleAdmin(Roles.LOAN_MANAGER, Roles.ADMIN);
        _setRoleAdmin(Roles.UPDATER, Roles.ADMIN);

        _grantRole(Roles.ADMIN, admin);
    }

    // max amount can be borrowed in pool cumulatively
    mapping(IPool => uint256) public poolToMaxBorrowLimit;
    // min amount can be borrowed in pool per one loan
    mapping(IPool => uint256) public poolToMinBorrowLimit;
    // total borrowed amount in pool
    mapping(IPool => uint256) public poolToBorrowedAmount;
    // cumulative limit for every score in pool
    mapping(IPool => mapping(uint16 => uint256)) public poolToScoreToBorrowLimit;
    // total borrowed amount for user in certain pool
    mapping(IPool => mapping(address => uint256)) public poolToUserToBorrowedAmount;
    // max number of loans user can take in pool
    mapping(IPool => uint256) public poolToMaxLoanNumber;
    // amount of loans user has taken in pool
    mapping(IPool => mapping(address => uint256)) public poolToUserOpenLoans;

    /**
     * @dev Method to set poolToMaxBorrowLimit
     * @param pool pool address
     * @param value limit amount
     */
    function setPoolToMaxBorrowLimit(IPool pool, uint256 value) external onlyRole(Roles.ADMIN) {
        emit PoolToMaxBorrowLimitChanged(
            msg.sender,
            pool,
            poolToMaxBorrowLimit[pool],
            value,
            block.timestamp
        );
        poolToMaxBorrowLimit[pool] = value;
    }

    /**
     * @dev Method to set poolToMinBorrowLimit
     * @param pool pool address
     * @param value limit amount
     */
    function setPoolToMinBorrowLimit(IPool pool, uint256 value) external onlyRole(Roles.ADMIN) {
        emit PoolToMinBorrowLimitChanged(
            msg.sender,
            pool,
            poolToMinBorrowLimit[pool],
            value,
            block.timestamp
        );
        poolToMinBorrowLimit[pool] = value;
    }

    /**
     * @dev Method to set poolToScoreToBorrowLimit
     * @param pool pool address
     * @param score score value
     * @param value limit amount
     */
    function setPoolToScoreBorrowLimit(
        IPool pool,
        uint16 score,
        uint256 value
    ) external onlyRole(Roles.ADMIN) {
        emit PoolToScoreToBorrowLimitChanged(
            msg.sender,
            pool,
            score,
            poolToScoreToBorrowLimit[pool][score],
            value,
            block.timestamp
        );
        poolToScoreToBorrowLimit[pool][score] = value;
    }

    /**
     * @dev Method to set poolToMaxLoanNumber
     * @param pool pool address
     * @param value limit amount
     */
    function setPoolToMaxLoanNumber(IPool pool, uint256 value) external onlyRole(Roles.ADMIN) {
        emit PoolToMaxLoanNumberChanged(
            msg.sender,
            pool,
            poolToMaxLoanNumber[pool],
            value,
            block.timestamp
        );
        poolToMaxLoanNumber[pool] = value;
    }

    /**
     * @dev Hook called on each borrow in LoanManager
     * @param user user who borrows
     * @param pool pool borrowed from
     * @param score score of user
     * @param amount borrow amount
     */
    function onBorrow(
        address user,
        IPool pool,
        uint16 score,
        uint256 amount
    ) external onlyRole(Roles.LOAN_MANAGER) {
        // validate that borrow is allowed, no limit is exceeded
        require(amount >= poolToMinBorrowLimit[pool], Errors.LIMIT_MANAGER_MIN_LIMIT);

        uint256 maxLoanNumber = poolToMaxLoanNumber[pool];

        require(
            maxLoanNumber == 0 || maxLoanNumber > poolToUserOpenLoans[pool][user],
            Errors.LIMIT_MANAGER_LOAN_NUMBER
        );

        uint256 maxBorrowLimit = poolToMaxBorrowLimit[pool];

        require(
            maxBorrowLimit == 0 || maxBorrowLimit >= poolToBorrowedAmount[pool] + amount,
            Errors.LIMIT_MANAGER_MAX_LIMIT
        );

        uint256 maxBorrowLimitScore = poolToScoreToBorrowLimit[pool][score];

        require(
            maxBorrowLimitScore == 0 ||
                maxBorrowLimitScore >= poolToUserToBorrowedAmount[pool][user] + amount,
            Errors.LIMIT_MANAGER_MAX_LIMIT_SCORE
        );

        // update storage variable
        poolToUserOpenLoans[pool][user]++;
        poolToBorrowedAmount[pool] += amount;
        poolToUserToBorrowedAmount[pool][user] += amount;
    }

    /**
     * @dev Hook called on each repayment/liquidation in LoanManager
     * @param user borrower
     * @param pool pool borrowed from
     * @param amount borrowed amount
     */
    function onRepayOrLiquidate(
        address user,
        IPool pool,
        uint256 amount
    ) external onlyRole(Roles.LOAN_MANAGER) {
        // validate correctness of operation
        require(poolToBorrowedAmount[pool] >= amount, Errors.LIMIT_MANAGER_REPAY_OR_LIQUIDATE);
        require(
            poolToUserToBorrowedAmount[pool][user] >= amount,
            Errors.LIMIT_MANAGER_REPAY_OR_LIQUIDATE
        );
        // update storage variables
        poolToBorrowedAmount[pool] -= amount;
        poolToUserToBorrowedAmount[pool][user] -= amount;
    }

    /**
     * @dev Hook called on loan fulfillment (repayment/liquidation) in LoanManager
     * @param user borrower
     * @param pool pool borrowed from
     */
    function onLoanFulfillment(address user, IPool pool) external onlyRole(Roles.LOAN_MANAGER) {
        require(poolToUserOpenLoans[pool][user] > 0, Errors.LIMIT_MANAGER_OPEN_LOANS);
        poolToUserOpenLoans[pool][user]--;
    }

    /**
     * @dev get current contract version
     */
    function currentVersion() public pure override returns (string memory) {
        return LIMIT_MANAGER_VERSION;
    }
}
