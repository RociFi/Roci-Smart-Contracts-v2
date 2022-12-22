import { contracts } from "../typechain-types/factories";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import {
  CollateralManager,
  LimitManager,
  LoanManager,
  MockERC20,
  MockPriceFeed,
  NFCS,
  Pool,
  Pool__factory,
  ScoreDB,
  SettingsProvider,
} from "../typechain-types";

export type Factories = {
  Pool: Pool__factory;
  LoanManager: contracts.LoanManager__factory;
  CollateralManager: contracts.CollateralManager__factory;
  SettingsProvider: contracts.SettingsProvider__factory;
  NFCS: contracts.NFCS__factory;
  MockNFCS: contracts.mocks.MockNFCS__factory;
  PriceFeed: contracts.PriceFeed__factory;
  MockPriceFeed: contracts.mocks.MockPriceFeed__factory;
  ScoreDB: contracts.ScoreDB__factory;
  LimitManager: contracts.LimitManager__factory;
  ListMapUsage: contracts.mocks.ListMapUsage__factory;
};

export type TestContracts = {
  LoanManager: LoanManager;
  CollateralManager: CollateralManager;
  SettingsProvider: SettingsProvider;
  NFCS: NFCS;
  PriceFeed: MockPriceFeed;
  Pools: Pools;
  Tokens: Tokens;
  ScoreDB: ScoreDB;
  LimitManager: LimitManager;
};

export type TestTokenParams = {
  name: string;
  symbol: string;
  decimals: number;
};

export interface Tokens {
  [name: string]: MockERC20;
}

export type PoolParams = {
  decimals: number;
  symbol: PoolSymbol;
};

type USDCSymbol = "rUSDC" | `rUSDC${number}`;
type DAISymbol = "rDAI" | `rDAI${number}`;
type USDTSymbol = "rUSDT" | `rUSDT${number}`;
type AAVESymbol = "rAAVE" | `rAAVE${number}`;
type WETHSymbol = "rWETH" | `rWETH${number}`;

export type PoolSymbol =
  | USDCSymbol
  | DAISymbol
  | USDTSymbol
  | AAVESymbol
  | WETHSymbol;

export type Pools = {
  [name in PoolSymbol]: Pool;
};

export type Feeds = "WETH_USD" | "USDC_USD" | "BTC_USD" | "DAI_USD";

export type Answers = {
  [key in Feeds]: {
    address: string;
    from: string;
    to: string;
    value: BigNumber;
  };
};

type digit = "1" | "2" | "3" | "4" | "5" | "6";
type byte = "0" | digit | "7" | "8" | "9" | "a" | "b" | "c" | "d" | "e" | "f";
export type NetworkState = `0x${"" | digit}${byte}`;

export type DefaultBorrowArgs = {
  cs: TestContracts;
  user: SignerWithAddress;
  pool: Pool;
  collateralAddress: string;
  collateralAmount: BigNumber;
  ltv: BigNumber;
  duration: number;
};

export type Snapshot = {
  initial: NetworkState;
};

export enum RociContract {
  Pool = "Pool",
  LoanManager = "LoanManager",
  CollateralManager = "CollateralManager",
  SettingsProvider = "SettingsProvider",
  NFCS = "NFCS",
  PriceFeed = "PriceFeed",
  MockPriceFeed = "MockPriceFeed",
  ScoreDB = "ScoreDB",
  LimitManager = "LimitManager",
  Liquidator = "Liquidator",
}
export type Score = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type InterestMatrixItem = {
  score: Score;
  LTV: BigNumber;
  duration: number;
  interest: BigNumber;
};

export type PoolsSettings = {
  [key: string]: {
    poolCollaterals: string[];
    interestMatrix: InterestMatrixItem[];
    gracePeriod: BigNumber;
    lateFee: BigNumber;
  };
};

export const convertToStruct = <A extends Array<unknown>>(
  arr: A,
): ExtractPropsFromArray<A> => {
  const keys = Object.keys(arr).filter((key) => isNaN(Number(key)));
  const result = {};
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  arr.forEach((item, index) => (result[keys[index]] = item));
  return result as A;
};

export type ExtractPropsFromArray<T> = Omit<
  T,
  keyof Array<unknown> | `${number}`
>;
