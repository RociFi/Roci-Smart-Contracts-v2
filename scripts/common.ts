import { ethers, network } from "hardhat";

import {
  BigNumber,
  BigNumberish,
  Contract,
  ContractTransaction,
  utils,
  Wallet,
} from "ethers";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "ethers/lib/utils";
import { USD_ADDRESS } from "../scripts/constants";
import {
  CollateralManager,
  ERC20,
  MockERC20,
  MockPriceFeed,
  NFCS,
  Pool,
  PriceFeed,
  SettingsProvider,
} from "../typechain-types";
import { PromiseOrValue } from "../typechain-types/common";
import { ROLES, VERSIONS } from "./constants";
import { STATUS_MATRIX } from "./status";
import {
  InterestMatrixItem,
  PoolsSettings,
  Score,
  Snapshot,
  TestContracts,
} from "./types";

export const bn = (num: BigNumberish) => {
  return BigNumber.from(num);
};

export const toWei6 = (value: string) => utils.parseUnits(value, 6);
export const toWei8 = (value: string) => utils.parseUnits(value, 8);
export const toWei = (value: string) => utils.parseUnits(value, 18);

export const currentTimestamp = () =>
  ethers.provider
    .getBlock(ethers.provider.getBlockNumber())
    .then((block) => block.timestamp);

export const getPercent = (value: BigNumber, percent: number) =>
  value.mul(percent).div(100);

export const deployed = (c: Contract) => c.deployed();

export const getRandomAddress = () => Wallet.createRandom().address;

export const makeSnapshot = async (
  snapshot: Snapshot | undefined,
): Promise<Snapshot> => {
  const snap = await network.provider.send("evm_snapshot");

  if (snapshot != undefined) {
    snapshot.initial = snap;
    return snapshot;
  }
  return snap;
};

export const backToSnapshot = async (snapshot: Snapshot) => {
  await network.provider.send("evm_revert", [snapshot.initial]);
  return makeSnapshot(snapshot);
};

export const initiateSnapshot = (): Snapshot => ({
  initial: "0x0",
});

export const getLoanAmount = (
  PriceFeed: MockPriceFeed | PriceFeed,
  underlyingToken: string,
  collateralAddress: string,
  collateralValue: BigNumber,
  ltv: BigNumber,
): Promise<BigNumber> => {
  return PriceFeed.convert(
    collateralValue,
    collateralAddress,
    underlyingToken,
  ).then((collateralInStables) =>
    collateralInStables.mul(ltv).div(parseEther("100")),
  );
};

export const setBalance = (
  account: SignerWithAddress,
  token: MockERC20,
  req: BigNumber,
) => {
  return token
    .balanceOf(account.address)
    .then((cB) =>
      req.gte(cB)
        ? token.mint(account.address, req.sub(cB))
        : token.connect(account).burn(cB.sub(req)),
    );
};

export const getBundleWithSignatures = async (
  accounts: SignerWithAddress[],
  nfcs: NFCS,
) => {
  const domain = {
    name: "NFCS",
    version: await nfcs.currentVersion(),
  };

  const primaryType = {
    PrimaryAddressSignature: [{ name: "bundle", type: "address[]" }],
  };

  const secondaryType = {
    SecondaryAddressSignature: [{ name: "primary", type: "address" }],
  };

  const bundle = accounts.map((acc) => acc.address);

  const signatures = [] as string[];

  const primaryMessage = {
    bundle,
  };

  signatures.push(
    await accounts[0]._signTypedData(domain, primaryType, primaryMessage),
  );

  if (accounts.length > 1) {
    const secondaryMessage = {
      primary: bundle[0],
    };

    for (let i = 1; i < accounts.length; i++) {
      const signature = await accounts[i]._signTypedData(
        domain,
        secondaryType,
        secondaryMessage,
      );

      signatures.push(signature);
    }
  }

  return { bundle, signatures };
};

export const signScore = async (
  nfcsId: BigNumber,
  score: number,
  user: SignerWithAddress,
) => {
  const objectHash = ethers.utils.solidityKeccak256(
    ["uint256", "uint16", "uint256"],
    [nfcsId, score, bn(await currentTimestamp())],
  );

  return user.signMessage(ethers.utils.arrayify(objectHash));
};

export const getACErrorText = (address: string, role: string) =>
  `AccessControl: account ${address.toLowerCase()} is missing role ${role}`;

export const getPausedFuncErrorText = (functionName: string) =>
  `${functionName} function is on pause.`;

export const mintNFCS = async (cs: TestContracts, user: SignerWithAddress) => {
  const { bundle, signatures } = await getBundleWithSignatures([user], cs.NFCS);

  await cs.NFCS.connect(user).mintToken(
    bundle,
    signatures,
    VERSIONS.NFCS_VERSION,
  );

  return cs.NFCS.getToken(user.address);
};

export const updateScore = async (
  cs: TestContracts,
  admin: SignerWithAddress,
  nfcs: BigNumber,
  score: number,
) => {
  await cs.ScoreDB.setNFCSSignerAddress(admin.address);

  const timestamp = await currentTimestamp();

  await cs.ScoreDB.updateScore(
    nfcs,
    score,
    timestamp,
    signScore(nfcs, score, admin),
    VERSIONS.SCORE_DB_VERSION,
  );
};

export const configureLoanManager = async (cs: TestContracts) => {
  const lm = cs.LoanManager;

  await lm.setCollateralManager(cs.CollateralManager.address);
  await lm.setNFCS(cs.NFCS.address);
  await lm.setPriceFeed(cs.PriceFeed.address);
  await lm.setSettingsProvider(cs.SettingsProvider.address);
  await lm.setScoreDB(cs.ScoreDB.address);
  await lm.setLimitManager(cs.LimitManager.address);

  await lm.grantRole(ROLES.LIQUIDATOR, await lm.signer.getAddress());

  for (const status of STATUS_MATRIX) {
    await lm.setStatus(...status);
  }
};
export const configureCollateralManager = async (
  CollateralManager: CollateralManager,
  LoanManagerAddress: string,
  collaterals: string[],
) => {
  await CollateralManager.grantRole(ROLES.LOAN_MANAGER, LoanManagerAddress);
  await CollateralManager.addCollaterals(collaterals);
};

export const configureSettingsProvider = async (
  SettingsProvider: SettingsProvider,
  poolsSettings: PoolsSettings,
) => {
  const pools = Object.keys(poolsSettings);
  await SettingsProvider.addPools(pools);

  for (const pool of pools) {
    const poolParams = poolsSettings[pool];

    const interestMatrix = poolParams.interestMatrix;

    await SettingsProvider.addPoolCollaterals(pool, poolParams.poolCollaterals);

    const scores = Array.from(
      new Set(interestMatrix.map((elem) => elem.score)),
    );

    await SettingsProvider.addPoolScores(pool, scores);

    const scoresToLTVsDurations = interestMatrix.reduce((res, curr) => {
      const collected = res.get(curr.score);

      res.set(
        curr.score,
        collected
          ? {
              LTVs: [...collected.LTVs, curr.LTV],
              durations: [...collected.durations, curr.duration],
            }
          : {
              LTVs: [curr.LTV],
              durations: [curr.duration],
            },
      );

      return res;
    }, new Map<number, { LTVs: BigNumber[]; durations: number[] }>());

    for (const score of scoresToLTVsDurations.keys()) {
      await SettingsProvider.addPoolToScoreLtvs(
        pool,
        score,
        scoresToLTVsDurations.get(score)?.LTVs as BigNumber[],
      );

      await SettingsProvider.addPoolToScoreDurations(
        pool,
        score,
        scoresToLTVsDurations.get(score)?.durations as number[],
      );
    }

    for (const interParams of poolParams.interestMatrix) {
      await SettingsProvider.setPoolToScoreToLtvToDurationInterest(
        pool,
        interParams.score,
        interParams.LTV,
        interParams.duration,
        interParams.interest,
      );
    }

    await SettingsProvider.setPoolToGracePeriod(pool, poolParams.gracePeriod);

    await SettingsProvider.setPoolToLateFee(pool, poolParams.lateFee);
  }
};

export const configureMockPriceFeed = async (
  PriceFeed: MockPriceFeed,
  pairs: { asset: string; priceToUSD: BigNumber; feederAddress: string }[],
) => {
  for (const pair of pairs) {
    await PriceFeed.setPriceFeed(pair.feederAddress, pair.asset, USD_ADDRESS);

    await PriceFeed.setLatestAnswer(pair.feederAddress, pair.priceToUSD);
  }
};

export const balanceDelta = async (
  tx: PromiseOrValue<ContractTransaction>,
  token: ERC20 | MockERC20,
  account: string,
): Promise<BigNumber> => {
  const pendingTx: ContractTransaction = await tx;

  const beforeBlock = pendingTx.blockNumber
    ? pendingTx.blockNumber - 1
    : (await ethers.provider.getBlockNumber()) - 1;

  await mine();

  const afterBlock = await ethers.provider.getBlockNumber();

  const beforeBalance = await token.provider.call(
    await token.populateTransaction.balanceOf(account),
    beforeBlock,
  );

  const afterBalance = await token.provider.call(
    await token.populateTransaction.balanceOf(account),
    afterBlock,
  );

  const beforeAmount = bn(
    token.interface.decodeFunctionResult("balanceOf", beforeBalance).toString(),
  );

  const afterAmount = bn(
    token.interface.decodeFunctionResult("balanceOf", afterBalance).toString(),
  );

  return afterAmount.sub(beforeAmount).abs();
};

export const mine = async (sleepDuration?: number) => {
  if (sleepDuration) {
    await ethers.provider.send("evm_increaseTime", [sleepDuration]);
  }

  return ethers.provider.send("evm_mine", []);
};

export const txTimestamp = (
  tx: ContractTransaction,
): PromiseOrValue<BigNumber> => {
  if (tx.blockNumber == undefined) {
    throw Error("Transacion block number is undefined");
  }

  return ethers.provider
    .getBlock(tx.blockNumber)
    .then((block) => bn(block.timestamp));
};

export const configureForBorrow = async (
  cs: TestContracts,
  Pools: Pool[],
  collaterals: string[],
  prices: { asset: string; priceToUSD: BigNumber; feederAddress: string }[],
  APR: number,
  score: number,
  LTV: BigNumber,
  duration: number,
  gracePeriod: BigNumber,
  lateFee: BigNumber,
) => {
  const interestMatrix: InterestMatrixItem[] = [
    {
      score: score as Score,
      LTV,
      duration,
      interest: parseEther(APR.toString()),
    },
  ];

  const poolsSettings: PoolsSettings = {};

  for (const pool of Pools) {
    poolsSettings[pool.address] = {
      poolCollaterals: collaterals,
      interestMatrix,
      gracePeriod,
      lateFee,
    };
  }
  await configureSettingsProvider(cs.SettingsProvider, poolsSettings);

  await configureMockPriceFeed(cs.PriceFeed, prices);

  await configureCollateralManager(
    cs.CollateralManager,
    cs.LoanManager.address,
    collaterals,
  );

  await configureLoanManager(cs);

  await cs.ScoreDB.setMinScore(0);
  await cs.ScoreDB.setMaxScore(10);

  await cs.ScoreDB.setScoreValidityPeriod(1000);

  await cs.LimitManager.grantRole(ROLES.LOAN_MANAGER, cs.LoanManager.address);

  for (const pool of Pools) {
    await pool.grantRole(ROLES.LOAN_MANAGER, cs.LoanManager.address);

    await pool.approveLoanManager(
      cs.LoanManager.address,
      ethers.constants.MaxUint256,
    );

    await pool.grantRole(ROLES.LOAN_MANAGER, cs.LoanManager.address);
  }
};

export const setNextBlockTimestamp = async (timestamp: number) => {
  await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
  await ethers.provider.send("evm_mine", []);
};

export const applyPoolFee = (fee: number) => (priced: BigNumber) =>
  priced.sub(priced.mul(fee).div(1000000));
