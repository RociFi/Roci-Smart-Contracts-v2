import { upgrades } from "hardhat";

import {
  PoolParams,
  Pools,
  TestContracts,
  TestTokenParams,
  Tokens,
} from "./types";

import {
  CollateralManager,
  LimitManager,
  LoanManager,
  MockPriceFeed,
  NFCS,
  Pool,
  ScoreDB,
  SettingsProvider,
} from "../typechain-types";

import { deployTestToken, getFactories } from "./deployLib";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployed } from "./common";
import { proxyOpts } from "./constants";

export async function deployForTests(
  tokensParams: TestTokenParams[],
  poolsParams: PoolParams[],
  admin: SignerWithAddress,
): Promise<TestContracts> {
  const factories = await getFactories();

  const SettingsProvider = (
    await upgrades
      .deployProxy(factories.SettingsProvider, [admin.address], proxyOpts)
      .then(deployed)
  ).connect(admin) as SettingsProvider;

  const ScoreDB = (
    await upgrades
      .deployProxy(factories.ScoreDB, [admin.address], proxyOpts)
      .then(deployed)
  ).connect(admin) as ScoreDB;

  const LoanManager = (
    await upgrades
      .deployProxy(factories.LoanManager, [admin.address], proxyOpts)
      .then(deployed)
  ).connect(admin) as LoanManager;

  const CollateralManager = (
    await upgrades
      .deployProxy(factories.CollateralManager, [admin.address], proxyOpts)
      .then(deployed)
  ).connect(admin) as CollateralManager;

  const PriceFeed = (
    await upgrades
      .deployProxy(factories.MockPriceFeed, [admin.address], {
        initializer: "init",
        kind: "uups",
      })
      .then(deployed)
  ).connect(admin) as MockPriceFeed;

  const NFCS = (
    await upgrades
      .deployProxy(factories.NFCS, [admin.address], proxyOpts)
      .then(deployed)
  ).connect(admin) as NFCS;

  const LimitManager = (
    await upgrades
      .deployProxy(factories.LimitManager, [admin.address], proxyOpts)
      .then(deployed)
  ).connect(admin) as LimitManager;

  const Tokens: Tokens = {};

  const Pools: Pools = {} as Pools;

  for (let index = 0; index < tokensParams.length; index++) {
    const tokenParams = tokensParams[index];

    const token = await deployTestToken(tokenParams);

    Tokens[tokenParams.symbol] = token;

    if (index <= poolsParams.length - 1) {
      const poolParams = poolsParams[index];

      const pool = (
        await upgrades
          .deployProxy(
            factories.Pool,
            [token.address, poolParams.symbol, "Roci Token", admin.address],
            proxyOpts,
          )
          .then(deployed)
      ).connect(admin) as Pool;

      Pools[poolParams.symbol] = pool;
    }
  }

  const cs: TestContracts = {
    Tokens,
    NFCS,
    ScoreDB,
    LimitManager,
    SettingsProvider,
    CollateralManager,
    PriceFeed,
    Pools,
    LoanManager,
  };

  return cs;
}
