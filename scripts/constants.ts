import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import { PoolParams, TestTokenParams } from "./types";

export const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
export const USDT_ADDRESS = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
export const WETH_ADDRESS = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
export const DAI_ADDRESS = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";
export const WMATIC_ADDRESS = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
export const WBTC_ADDRESS = "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6";
export const USD_ADDRESS = "0x0000000000000000000000000000000000000001";

export const proxyOpts: DeployProxyOptions = {
  initializer: "initialize",
  kind: "uups",
};

export const ONE_MINUTE = 60;

export const ONE_HOUR = ONE_MINUTE * 60;
export const TWO_HOURS = ONE_HOUR * 2;

export const ONE_DAY = ONE_HOUR * 24;
export const TWO_DAY = ONE_DAY * 2;
export const THREE_DAY = ONE_DAY * 3;
export const ONE_WEEK = ONE_DAY * 7;

export const ONE_MONTH = ONE_DAY * 30;

export const ONE_YEAR = ONE_DAY * 365;

export const ROLES = {
  ADMIN: "0xb055000000000000000000000000000000000000000000000000000000000000",
  LOAN_MANAGER:
    "0xdeb7000000000000000000000000000000000000000000000000000000000000",
  LIQUIDATOR:
    "0xc105e00000000000000000000000000000000000000000000000000000000000",
  PAUSER: "0xc105e12000000000000000000000000000000000000000000000000000000000",
  UPDATER: "0xc105e10000000000000000000000000000000000000000000000000000000000",
  LIQUIDATION_BOT:
    "0xdeaf000000000000000000000000000000000000000000000000000000000000",
};

export const tokensParams: TestTokenParams[] = [
  { name: "USDC Token", symbol: "USDC", decimals: 6 },
  { name: "DAI Token", symbol: "DAI", decimals: 18 },
  { name: "Wrapped ETH", symbol: "WETH", decimals: 18 },
  { name: "Wrapped BTC", symbol: "WBTC", decimals: 18 },
];

export const poolsParams: PoolParams[] = [
  { symbol: "rUSDC1", decimals: 6 },
  { symbol: "rDAI1", decimals: 18 },
];

export const Errors = {
  NFCS_TOKEN_MINTED: "0", //  Token already minted
  NFCS_TOKEN_NOT_MINTED: "1", //  No token minted for address
  NFCS_ADDRESS_BUNDLED: "2", // Address already bundled
  NFCS_WALLET_VERIFICATION_FAILED: "3", //  Wallet verification failed
  NFCS_NONEXISTENT_TOKEN: "4", // Nonexistent NFCS token
  NFCS_TOKEN_HAS_BUNDLE: "5", //  Token already has an associated bundle
  NFCS_TOKEN_HAS_NOT_BUNDLE: "6", //  Token does not have an associated bundle
  NFCS_NO_PRIMARY_ADDRESS: "8", //  No primary address found
  NFCS_ALREADY_POPULATED: "9", //  Mapping of secondary addresses to primary is already performed
  NFCS_NOTHING_TO_POPULATE: "10", //  There is nothing to transfer
  NFCS_APPROVE_DISABLED: "11", // ModifiedApprove: cannot approve other addresses
  NFCS_GET_APPROVED_DISABLED: "12", // ModifiedGetApproved: cannot get approved address
  NFCS_SET_APPROVAL_DISABLED: "13", // ModifiedSetApprovedForAll: cannot set approved address for all owned tokens
  NFCS_IS_APPROVED_DISABLED: "14", // ModifiedIsApprovedForAll: cannot check approval
  NFCS_TRANSFER_FROM_DISABLED: "15", // ModifiedTransferFrom: transferFrom not supported
  NFCS_SAFE_TRANSFER_FROM_DISABLED: "16", // ModifiedSafeTransferFrom: safeTransferFrom not supported

  POOL_TOTAL_SUPPLY_ZERO: "100", // rToken totalSupply zero
  POOL_VALUE_LT_ZERO: "101", //pooValueUpdate leads to poolValue < 0
  POOL_LOCKUP: "102", // withdraw before passing lockup period

  LOAN_MANAGER_ZERO_REPAY: "200", //Loan repay zero
  LOAN_MANAGER_LOAN_AMOUNT_ZERO: "201", //Loan amount is zero
  LOAN_MANAGER_LOAN_IS_LIQUID: "202", //Loan is linquent

  COLLATERAL_MANAGER_TOKEN_NOT_SUPPORTED: "300", // CollateralManager does not support provided token
  COLLATERAL_MANAGER_FREEZER: "301", // Provided contract address is not allowed to freeze/unfreeze collateral
  COLLATERAL_MANAGER_FREEZER_OR_USER: "302", // Provided contract / user address is not allowed to freeze/unfreeze collateral
  COLLATERAL_MANAGER_INSUFFICIENT_AMOUNT: "303", // Not enough funds to perform transaction
  COLLATERAL_MANAGER_FROZEN_INSUFFICIENT_AMOUNT: "304", // Not enough funds to perform transaction
  COLLATERAL_MANAGER_WRAPPER_ZERO: "305", // Wrapper are not set
  COLLATERAL_MANAGER_NATIVE_TRANSFER: "306", //Native token transfer error

  SCORE_DB_VERIFICATION: "401", // Unverified score
  SCORE_DB_UNKNOWN_FETCHING_SCORE: "402", //  Unknown error fetching score.
  SCORE_DB_OUTDATED_SIGNATURE: "403", // Attempt to update score with outdated signature

  SETTINGS_PROVIDER_POOL_NOT_SET: "506", //  Pool is not set
  SETTINGS_PROVIDER_SCORE_NOT_SET: "507", //  Score is not set in pool
  SETTINGS_PROVIDER_LTV_NOT_SET: "508", //  Ltv is not set in pool for score
  SETTINGS_PROVIDER_DURATION_NOT_SET: "509", //  Duration is not set in pool for score
  SETTINGS_PROVIDER_INTEREST_NOT_SET: "510", //  Interest is not set in pool for score-ltv-duration
  SETTINGS_PROVIDER_COLLATERAL_NOT_SET: "511", //  Collateral is not set in pool
  SETTINGS_PROVIDER_SCORE_OUTDATED: "512", //  Score should be updated

  LIMIT_MANAGER_MIN_LIMIT: "601", //  Not reaching min required limit
  LIMIT_MANAGER_MAX_LIMIT: "602", //  Exceeding max allowed limit
  LIMIT_MANAGER_MAX_LIMIT_SCORE: "603", //  Exceeding max allowed limit for score
  LIMIT_MANAGER_LOAN_NUMBER: "604", //  Loan number is exceeded
  LIMIT_MANAGER_REPAY_OR_LIQUIDATE: "605", // Amount should be lesser or equal
  LIMIT_MANAGER_OPEN_LOANS: "606", // User open loans value should be greater then zero

  PRICE_FEED_TOKEN_NOT_SUPPORTED: "700", // Token is not supported
  PRICE_FEED_TOKEN_BELOW_ZERO: "701", // Token below zero price

  LIQUIDATOR_MINIMUM_SWAP_FAILED: "801", // Swap amount out are less than minimum amount out
  LIQUIDATOR_LOAN_MANAGER_APPROVE: "802", //Liquidator approve failed
  LIQUIDATOR_INSUFFICIENT_FUNDS: "803", //Liquidator insufficient funds
  LIQUIDATOR_NOTHING_TO_SWAP: "804",

  VERSION: "1000", // Incorrect version of contract
  ZERO_VALUE: "1001", // Zero value
  ARGUMENTS_LENGTH: "1002", // Length of two arrays differs
  NO_ELEMENT_IN_ARRAY: "1005", // there is no element in array
  ELEMENT_IN_ARRAY: "1006", // there is already element in array
  PAUSED: "Pausable: paused",
};

export const VERSIONS = {
  COLLATERAL_MANAGER_VERSION: "2.0.0",
  LIMIT_MANAGER_VERSION: "2.0.0",
  LOAN_MANAGER_VERSION: "2.0.0",
  NFCS_VERSION: "2.0.0",
  POOL_VERSION: "2.0.0",
  PRICE_FEED_VERSION: "2.0.0",
  SCORE_DB_VERSION: "2.0.0",
  SETTINGS_PROVIDER_VERSION: "2.0.0",
  LIQUIDATOR_VERSION: "2.0.0",
};
