// SPDX-License-Identifier: None
pragma solidity ^0.8.9;

/**
 * @title Errors library
 * @author RociFi Labs
 * @notice Defines the error messages emitted by the different contracts of the RociFi protocol
 * @dev Error messages prefix glossary:
 *  - NFCS = NFCS
 *  - POOL = Pool
 *  - SettingsProvider = SettingsProvider
 *  - LOAN_MANAGER = LoanManager
 *  - COLLATERAL_MANAGER = CollateralManager
 *  - PRICE_FEED = PriceFeed
 *  - VERSION = Version
 */
library Errors {
    string public constant NFCS_TOKEN_MINTED = "0"; //  Token already minted
    string public constant NFCS_TOKEN_NOT_MINTED = "1"; //  No token minted for address
    string public constant NFCS_ADDRESS_BUNDLED = "2"; // Address already bundled
    string public constant NFCS_WALLET_VERIFICATION_FAILED = "3"; //  Wallet verification failed
    string public constant NFCS_NONEXISTENT_TOKEN = "4"; // Nonexistent NFCS token
    string public constant NFCS_TOKEN_HAS_BUNDLE = "5"; //  Token already has an associated bundle
    string public constant NFCS_TOKEN_HAS_NOT_BUNDLE = "6"; //  Token does not have an associated bundle
    string public constant NFCS_UPDATE_WITHOUT_POPULATE = "11"; //  Data was not populated

    string public constant POOL_TOTAL_SUPPLY_ZERO = "100"; // Zero totalSupply() pool
    string public constant POOL_VALUE_LT_ZERO = "101"; // pooValueUpdate leads to poolValue < 0
    string public constant POOL_LOCKUP = "102"; // withdraw before passing lockup period

    string public constant LOAN_MANAGER_ZERO_REPAY = "200"; //Loan repay zero
    string public constant LOAN_MANAGER_LOAN_AMOUNT_ZERO = "201"; //Loan amount is zero
    string public constant LOAN_MANAGER_LOAN_IS_LIQUID = "202"; //Loan is liquid
    string public constant LOAN_MANAGER_NATIVE_RETURN = "203"; //Can't return native token exceeds

    string public constant COLLATERAL_MANAGER_TOKEN_NOT_SUPPORTED = "300"; // CollateralManager does not support provided token
    string public constant COLLATERAL_MANAGER_FREEZER_OR_USER = "302"; // Provided contract / user address is not allowed to freeze/unfreeze collateral
    string public constant COLLATERAL_MANAGER_INSUFFICIENT_AMOUNT = "303"; // Not enough funds to perform transaction
    string public constant COLLATERAL_MANAGER_FROZEN_INSUFFICIENT_AMOUNT = "304"; // Not enough funds to perform transaction
    string public constant COLLATERAL_MANAGER_WRAPPER_ZERO = "305"; // Wrapper are not set
    string public constant COLLATERAL_MANAGER_NATIVE_TRANSFER = "306"; // Native token transfer error
    string public constant COLLATERAL_MANAGER_TOKEN_IS_NOT_WRAPPER = "307"; // Provided token is not equal to wrapper token

    string public constant SCORE_DB_VERIFICATION = "401"; // Unverified score
    string public constant SCORE_DB_UNKNOWN_FETCHING_SCORE = "402"; // Unknown error fetching score.
    string public constant SCORE_DB_OUTDATED_SIGNATURE = "403"; // Attempt to update score with outdated signature

    string public constant SETTINGS_PROVIDER_POOL_NOT_SET = "506"; //  Pool is not set
    string public constant SETTINGS_PROVIDER_SCORE_NOT_SET = "507"; //  Score is not set in pool
    string public constant SETTINGS_PROVIDER_LTV_NOT_SET = "508"; //  Ltv is not set in pool for score
    string public constant SETTINGS_PROVIDER_DURATION_NOT_SET = "509"; //  Duration is not set in pool for score
    string public constant SETTINGS_PROVIDER_INTEREST_NOT_SET = "510"; //  Interest is not set in pool for score-ltv-duration
    string public constant SETTINGS_PROVIDER_COLLATERAL_NOT_SET = "511"; //  Collateral is not set in pool
    string public constant SETTINGS_PROVIDER_SCORE_OUTDATED = "512"; //  Score should be updated

    string public constant LIMIT_MANAGER_MIN_LIMIT = "601"; //  Not reaching min required limit
    string public constant LIMIT_MANAGER_MAX_LIMIT = "602"; //  Exceeding max allowed limit
    string public constant LIMIT_MANAGER_MAX_LIMIT_SCORE = "603"; //  Exceeding max allowed limit for score
    string public constant LIMIT_MANAGER_LOAN_NUMBER = "604"; //  Loan number is exceeded
    string public constant LIMIT_MANAGER_REPAY_OR_LIQUIDATE = "605"; // Amount should be lesser or equal
    string public constant LIMIT_MANAGER_OPEN_LOANS = "606"; // User open loans value should be greater then zero

    string public constant PRICE_FEED_TOKEN_NOT_SUPPORTED = "700"; // Token is not supported
    string public constant PRICE_FEED_TOKEN_BELOW_ZERO = "701"; // Token below zero price

    string public constant LIQUIDATOR_MINIMUM_SWAP_FAILED = "801"; // Swap amount out are less than minimum amount out
    string public constant LIQUIDATOR_LOAN_MANAGER_APPROVE = "802"; //Liquidator approve failed
    string public constant LIQUIDATOR_INSUFFICIENT_FUNDS = "803"; //Liquidator insufficient funds
    string public constant LIQUIDATOR_NOTHING_TO_SWAP = "804"; //Liquidator insufficient funds

    string public constant VERSION = "1000"; // Incorrect version of contract
    string public constant ZERO_VALUE = "1001"; // Zero value
    string public constant ZERO_ADDRESS = "1003"; // Zero value
    string public constant NO_ELEMENT_IN_ARRAY = "1005"; //  there is no element in array
    string public constant ELEMENT_IN_ARRAY = "1006"; //  there is already element in array
    string public constant ARGUMENTS_LENGTH = "1007"; // Arguments length are different
}
