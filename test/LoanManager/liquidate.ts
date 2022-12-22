import { expect } from "chai";
import { ethers } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";
import {
  Errors,
  ONE_DAY,
  ONE_MONTH,
  poolsParams,
  ROLES,
  tokensParams,
  VERSIONS,
} from "../../scripts/constants";
import { deployForTests } from "../../scripts/deployTest";
import { STATUS } from "../../scripts/status";
import { TestContracts } from "../../scripts/types";
import {
  backToSnapshot,
  balanceDelta,
  bn,
  configureForBorrow,
  currentTimestamp,
  getLoanAmount,
  getPercent,
  getRandomAddress,
  initiateSnapshot,
  makeSnapshot,
  mine,
  mintNFCS,
  setBalance,
  setNextBlockTimestamp,
  toWei,
  toWei6,
  txTimestamp,
  updateScore,
} from "../../scripts/common";

describe("LoanManager liquidation unit testing.", async function () {
  this.timeout(0);
  let admin: SignerWithAddress;
  let user: SignerWithAddress;
  let user2: SignerWithAddress;
  let treasury: SignerWithAddress;

  let cs: TestContracts;
  let pricesToUSD: {
    asset: string;
    priceToUSD: BigNumber;
    feederAddress: string;
  }[];

  const snapshot = initiateSnapshot();

  before(async () => {
    [, admin, user, user2, treasury] = await ethers.getSigners();

    cs = await deployForTests(tokensParams, poolsParams, admin);

    pricesToUSD = [
      {
        asset: cs.Tokens.USDC.address,
        priceToUSD: bn(99993109),
        feederAddress: getRandomAddress(),
      },
      {
        asset: cs.Tokens.DAI.address,
        priceToUSD: bn(100000000),
        feederAddress: getRandomAddress(),
      },
      {
        asset: cs.Tokens.WETH.address,
        priceToUSD: bn(127504531414),
        feederAddress: getRandomAddress(),
      },
      {
        asset: cs.Tokens.WBTC.address,
        priceToUSD: bn(1909918602146),
        feederAddress: getRandomAddress(),
      },
    ];

    makeSnapshot(snapshot);
  });

  it("LoanManager.getDelinquencyInfo(). Linquent loan = false, delinquent = true with values.", async () => {
    await backToSnapshot(snapshot);

    const APR = 1;
    const score = 3;
    const LTV = parseEther("70");
    const duration = ONE_MONTH;
    const gracePeriod = bn(ONE_DAY * 5);
    const lateFee = parseEther("2");

    const wethAmount = toWei("2");

    const treasuryPercent = toWei("5");

    await configureForBorrow(
      cs,
      [cs.Pools.rUSDC1],
      [cs.Tokens.WETH.address],
      pricesToUSD,
      APR,
      score,
      LTV,
      duration,
      gracePeriod,
      lateFee,
    );

    await cs.SettingsProvider.setTreasuryAddress(treasury.address);
    await cs.SettingsProvider.setTreasuryPercent(treasuryPercent);

    const nfcs = await mintNFCS(cs, user);
    await updateScore(cs, admin, nfcs, score);

    await setBalance(user, cs.Tokens.WETH, wethAmount);

    await cs.Tokens.WETH.connect(user).approve(
      cs.CollateralManager.address,
      ethers.constants.MaxUint256,
    );

    const loanAmount = await getLoanAmount(
      cs.PriceFeed,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
      wethAmount,
      LTV,
    );

    await setBalance(admin, cs.Tokens.USDC, loanAmount);
    await cs.Tokens.USDC.connect(admin).approve(
      cs.Pools.rUSDC1.address,
      loanAmount,
    );
    await cs.Pools.rUSDC1
      .connect(admin)
      .deposit(loanAmount, VERSIONS.POOL_VERSION);

    await cs.LoanManager.connect(user).borrow(
      loanAmount,
      cs.Pools.rUSDC1.address,
      cs.Tokens.WETH.address,
      LTV,
      duration,
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    const loanId = (await cs.LoanManager.getUserLoanIds(user.address))[0];

    expect(await cs.LoanManager.isDelinquent(loanId)).false;

    await mine(ONE_MONTH + ONE_DAY * 6);

    expect(await cs.LoanManager.isDelinquent(loanId)).true;

    const timestamp = await currentTimestamp();

    const interestAccrued = await cs.LoanManager.getInterest(loanId, timestamp);

    const interestAccruedAsCollateral = await cs.PriceFeed.convert(
      interestAccrued,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
    );

    const loanAmountAsCollateral = await cs.PriceFeed.convert(
      loanAmount,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
    );

    expect(await cs.LoanManager.getDelinquencyInfo(loanId)).to.eqls([
      loanAmountAsCollateral.add(interestAccruedAsCollateral),
      bn(0),
      interestAccrued,
    ]);
  });

  it("LoanManager.getDelinquencyInfo(). Delinquent. frozenCollateralAmount > remainingAmountAsCollateral", async () => {
    await backToSnapshot(snapshot);

    const APR = 8;
    const score = 3;
    const LTV = parseEther("70");
    const duration = ONE_MONTH;
    const gracePeriod = bn(ONE_DAY * 5);
    const lateFee = parseEther("2");

    const wethAmount = toWei("2");

    const treasuryPercent = toWei("5");

    await configureForBorrow(
      cs,
      [cs.Pools.rUSDC1],
      [cs.Tokens.WETH.address],
      pricesToUSD,
      APR,
      score,
      LTV,
      duration,
      gracePeriod,
      lateFee,
    );

    await cs.SettingsProvider.setTreasuryAddress(treasury.address);
    await cs.SettingsProvider.setTreasuryPercent(treasuryPercent);

    const nfcs = await mintNFCS(cs, user);
    await updateScore(cs, admin, nfcs, score);

    await setBalance(user, cs.Tokens.WETH, wethAmount);

    await cs.Tokens.WETH.connect(user).approve(
      cs.CollateralManager.address,
      ethers.constants.MaxUint256,
    );

    const loanAmount = await getLoanAmount(
      cs.PriceFeed,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
      wethAmount,
      LTV,
    );

    await setBalance(admin, cs.Tokens.USDC, loanAmount);
    await cs.Tokens.USDC.connect(admin).approve(
      cs.Pools.rUSDC1.address,
      loanAmount,
    );
    await cs.Pools.rUSDC1
      .connect(admin)
      .deposit(loanAmount, VERSIONS.POOL_VERSION);

    await cs.LoanManager.connect(user).borrow(
      loanAmount,
      cs.Pools.rUSDC1.address,
      cs.Tokens.WETH.address,
      LTV,
      duration,
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    const loanId = (await cs.LoanManager.getUserLoanIds(user.address))[0];

    expect(await cs.LoanManager.isDelinquent(loanId)).false;

    await mine(ONE_MONTH + ONE_DAY * 6);

    expect(await cs.LoanManager.isDelinquent(loanId)).true;

    const timestamp = await currentTimestamp();

    let interestAccrued = await cs.LoanManager.getInterest(loanId, timestamp);

    let interestAccruedAsCollateral = await cs.PriceFeed.convert(
      interestAccrued,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
    );

    let loanAmountAsCollateral = await cs.PriceFeed.convert(
      loanAmount,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
    );

    const frozenCollateralAmount = (await cs.LoanManager.loans(loanId))
      .frozenCollateralAmount;

    const wethFeeder = pricesToUSD.filter(
      (pair) => pair.asset == cs.Tokens.WETH.address,
    )[0];

    await cs.PriceFeed.setLatestAnswer(
      wethFeeder.feederAddress,
      wethFeeder.priceToUSD
        .mul(loanAmountAsCollateral)
        .div(frozenCollateralAmount)
        .add(interestAccruedAsCollateral.div(wethFeeder.priceToUSD)),
    );

    interestAccrued = await cs.LoanManager.getInterest(loanId, timestamp + 1);

    interestAccruedAsCollateral = await cs.PriceFeed.convert(
      interestAccrued,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
    );

    loanAmountAsCollateral = await cs.PriceFeed.convert(
      loanAmount,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
    );

    const notCovered = await cs.PriceFeed.convert(
      interestAccruedAsCollateral
        .add(loanAmountAsCollateral)
        .sub(frozenCollateralAmount),
      cs.Tokens.WETH.address,
      cs.Tokens.USDC.address,
    );

    const poolValue = await cs.PriceFeed.convert(
      frozenCollateralAmount.sub(loanAmountAsCollateral),
      cs.Tokens.WETH.address,
      cs.Tokens.USDC.address,
    );

    expect(await cs.LoanManager.getDelinquencyInfo(loanId)).to.eqls([
      frozenCollateralAmount,
      notCovered,
      poolValue,
    ]);
  });

  it("LoanManager.getDelinquencyInfo(). Delinquent. frozenCollateralAmount > remainingAmountAsCollateral && frozenCollateralAmount < interestAccruedAsCollateral", async () => {
    await backToSnapshot(snapshot);

    const APR = 8;
    const score = 3;
    const LTV = parseEther("70");
    const duration = ONE_MONTH;
    const gracePeriod = bn(ONE_DAY * 5);
    const lateFee = parseEther("2");

    const wethAmount = toWei("2");

    const treasuryPercent = toWei("5");

    await configureForBorrow(
      cs,
      [cs.Pools.rUSDC1],
      [cs.Tokens.WETH.address],
      pricesToUSD,
      APR,
      score,
      LTV,
      duration,
      gracePeriod,
      lateFee,
    );

    await cs.SettingsProvider.setTreasuryAddress(treasury.address);
    await cs.SettingsProvider.setTreasuryPercent(treasuryPercent);

    const nfcs = await mintNFCS(cs, user);
    await updateScore(cs, admin, nfcs, score);

    await setBalance(user, cs.Tokens.WETH, wethAmount);

    await cs.Tokens.WETH.connect(user).approve(
      cs.CollateralManager.address,
      ethers.constants.MaxUint256,
    );

    const loanAmount = await getLoanAmount(
      cs.PriceFeed,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
      wethAmount,
      LTV,
    );

    await setBalance(admin, cs.Tokens.USDC, loanAmount);
    await cs.Tokens.USDC.connect(admin).approve(
      cs.Pools.rUSDC1.address,
      loanAmount,
    );
    await cs.Pools.rUSDC1
      .connect(admin)
      .deposit(loanAmount, VERSIONS.POOL_VERSION);

    await cs.LoanManager.connect(user).borrow(
      loanAmount,
      cs.Pools.rUSDC1.address,
      cs.Tokens.WETH.address,
      LTV,
      duration,
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    const loanId = (await cs.LoanManager.getUserLoanIds(user.address))[0];

    expect(await cs.LoanManager.isDelinquent(loanId)).false;

    await mine(ONE_MONTH + ONE_DAY * 6);

    expect(await cs.LoanManager.isDelinquent(loanId)).true;

    const timestamp = await currentTimestamp();

    let loanAmountAsCollateral = await cs.PriceFeed.convert(
      loanAmount,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
    );

    const frozenCollateralAmount = (await cs.LoanManager.loans(loanId))
      .frozenCollateralAmount;

    const wethFeeder = pricesToUSD.filter(
      (pair) => pair.asset == cs.Tokens.WETH.address,
    )[0];

    const interestAccrued = await cs.LoanManager.getInterest(
      loanId,
      timestamp + 1,
    );

    let interestAccruedAsCollateral = await cs.PriceFeed.convert(
      interestAccrued,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
    );

    await cs.PriceFeed.setLatestAnswer(
      wethFeeder.feederAddress,
      wethFeeder.priceToUSD
        .mul(
          loanAmountAsCollateral.add(interestAccruedAsCollateral.mul(2).div(3)),
        )
        .div(frozenCollateralAmount),
    );

    interestAccruedAsCollateral = await cs.PriceFeed.convert(
      interestAccrued,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
    );

    loanAmountAsCollateral = await cs.PriceFeed.convert(
      loanAmount,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
    );

    const notCovered = await cs.PriceFeed.convert(
      loanAmountAsCollateral
        .add(interestAccruedAsCollateral)
        .sub(frozenCollateralAmount),
      cs.Tokens.WETH.address,
      cs.Tokens.USDC.address,
    );

    const poolValueAdjust = await cs.PriceFeed.convert(
      frozenCollateralAmount.sub(loanAmountAsCollateral),
      cs.Tokens.WETH.address,
      cs.Tokens.USDC.address,
    );

    expect(await cs.LoanManager.getDelinquencyInfo(loanId)).to.eqls([
      frozenCollateralAmount,
      notCovered,
      poolValueAdjust,
    ]);
  });

  it("LoanManager.getDelinquencyInfo(). Delinquent. frozenCollateralAmount = remainingAmountAsCollateral", async () => {
    await backToSnapshot(snapshot);

    const APR = 8;
    const score = 3;
    const LTV = parseEther("70");
    const duration = ONE_MONTH;
    const gracePeriod = bn(ONE_DAY * 5);
    const lateFee = parseEther("2");

    const wethAmount = toWei("2");

    const treasuryPercent = toWei("5");

    await configureForBorrow(
      cs,
      [cs.Pools.rUSDC1],
      [cs.Tokens.WETH.address],
      pricesToUSD,
      APR,
      score,
      LTV,
      duration,
      gracePeriod,
      lateFee,
    );

    await cs.SettingsProvider.setTreasuryAddress(treasury.address);
    await cs.SettingsProvider.setTreasuryPercent(treasuryPercent);

    const nfcs = await mintNFCS(cs, user);
    await updateScore(cs, admin, nfcs, score);

    await setBalance(user, cs.Tokens.WETH, wethAmount);

    await cs.Tokens.WETH.connect(user).approve(
      cs.CollateralManager.address,
      ethers.constants.MaxUint256,
    );

    const loanAmount = await getLoanAmount(
      cs.PriceFeed,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
      wethAmount,
      LTV,
    );

    await setBalance(admin, cs.Tokens.USDC, loanAmount);
    await cs.Tokens.USDC.connect(admin).approve(
      cs.Pools.rUSDC1.address,
      loanAmount,
    );
    await cs.Pools.rUSDC1
      .connect(admin)
      .deposit(loanAmount, VERSIONS.POOL_VERSION);

    await cs.LoanManager.connect(user).borrow(
      loanAmount,
      cs.Pools.rUSDC1.address,
      cs.Tokens.WETH.address,
      LTV,
      duration,
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    const loanId = (await cs.LoanManager.getUserLoanIds(user.address))[0];

    expect(await cs.LoanManager.isDelinquent(loanId)).false;

    await mine(ONE_MONTH + ONE_DAY * 6);

    expect(await cs.LoanManager.isDelinquent(loanId)).true;

    const timestamp = await currentTimestamp();

    let interestAccrued = await cs.LoanManager.getInterest(loanId, timestamp);

    let interestAccruedAsCollateral = await cs.PriceFeed.convert(
      interestAccrued,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
    );

    let loanAmountAsCollateral = await cs.PriceFeed.convert(
      loanAmount,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
    );

    const frozenCollateralAmount = (await cs.LoanManager.loans(loanId))
      .frozenCollateralAmount;

    const wethFeeder = pricesToUSD.filter(
      (pair) => pair.asset == cs.Tokens.WETH.address,
    )[0];

    await cs.PriceFeed.setLatestAnswer(
      wethFeeder.feederAddress,
      wethFeeder.priceToUSD
        .mul(loanAmountAsCollateral)
        .div(frozenCollateralAmount),
    );

    interestAccrued = await cs.LoanManager.getInterest(loanId, timestamp + 1);

    interestAccruedAsCollateral = await cs.PriceFeed.convert(
      interestAccrued,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
    );

    loanAmountAsCollateral = await cs.PriceFeed.convert(
      loanAmount,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
    );

    const notCovered = await cs.PriceFeed.convert(
      interestAccruedAsCollateral
        .add(loanAmountAsCollateral)
        .sub(frozenCollateralAmount),
      cs.Tokens.WETH.address,
      cs.Tokens.USDC.address,
    );

    expect(await cs.LoanManager.getDelinquencyInfo(loanId)).to.eqls([
      frozenCollateralAmount,
      notCovered,
      BigNumber.from(0),
    ]);
  });

  it("LoanManager.getDelinquencyInfo(). Delinquent. frozenCollateralAmount < remainingAmountAsCollateral", async () => {
    await backToSnapshot(snapshot);

    const APR = 8;
    const score = 3;
    const LTV = parseEther("70");
    const duration = ONE_MONTH;
    const gracePeriod = bn(ONE_DAY * 5);
    const lateFee = parseEther("2");

    const wethAmount = toWei("2");

    const treasuryPercent = toWei("5");

    await configureForBorrow(
      cs,
      [cs.Pools.rUSDC1],
      [cs.Tokens.WETH.address],
      pricesToUSD,
      APR,
      score,
      LTV,
      duration,
      gracePeriod,
      lateFee,
    );

    await cs.SettingsProvider.setTreasuryAddress(treasury.address);
    await cs.SettingsProvider.setTreasuryPercent(treasuryPercent);

    const nfcs = await mintNFCS(cs, user);
    await updateScore(cs, admin, nfcs, score);

    await setBalance(user, cs.Tokens.WETH, wethAmount);

    await cs.Tokens.WETH.connect(user).approve(
      cs.CollateralManager.address,
      ethers.constants.MaxUint256,
    );

    const loanAmount = await getLoanAmount(
      cs.PriceFeed,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
      wethAmount,
      LTV,
    );

    await setBalance(admin, cs.Tokens.USDC, loanAmount);
    await cs.Tokens.USDC.connect(admin).approve(
      cs.Pools.rUSDC1.address,
      loanAmount,
    );
    await cs.Pools.rUSDC1
      .connect(admin)
      .deposit(loanAmount, VERSIONS.POOL_VERSION);

    await cs.LoanManager.connect(user).borrow(
      loanAmount,
      cs.Pools.rUSDC1.address,
      cs.Tokens.WETH.address,
      LTV,
      duration,
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    const loanId = (await cs.LoanManager.getUserLoanIds(user.address))[0];

    expect(await cs.LoanManager.isDelinquent(loanId)).false;

    await mine(ONE_MONTH + ONE_DAY * 6);

    expect(await cs.LoanManager.isDelinquent(loanId)).true;

    const timestamp = await currentTimestamp();

    let interestAccrued = await cs.LoanManager.getInterest(loanId, timestamp);

    let interestAccruedAsCollateral = await cs.PriceFeed.convert(
      interestAccrued,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
    );

    let loanAmountAsCollateral = await cs.PriceFeed.convert(
      loanAmount,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
    );

    const frozenCollateralAmount = (await cs.LoanManager.loans(loanId))
      .frozenCollateralAmount;

    const wethFeeder = pricesToUSD.filter(
      (pair) => pair.asset == cs.Tokens.WETH.address,
    )[0];

    await cs.PriceFeed.setLatestAnswer(
      wethFeeder.feederAddress,
      wethFeeder.priceToUSD
        .mul(loanAmountAsCollateral)
        .div(frozenCollateralAmount)
        .mul(2)
        .div(3),
    );

    interestAccrued = await cs.LoanManager.getInterest(loanId, timestamp + 1);

    interestAccruedAsCollateral = await cs.PriceFeed.convert(
      interestAccrued,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
    );

    loanAmountAsCollateral = await cs.PriceFeed.convert(
      loanAmount,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
    );

    const notCovered = await cs.PriceFeed.convert(
      interestAccruedAsCollateral
        .add(loanAmountAsCollateral)
        .sub(frozenCollateralAmount),
      cs.Tokens.WETH.address,
      cs.Tokens.USDC.address,
    );

    const poolValue = await cs.PriceFeed.convert(
      loanAmountAsCollateral.sub(frozenCollateralAmount),
      cs.Tokens.WETH.address,
      cs.Tokens.USDC.address,
    );

    const info = await cs.LoanManager.getDelinquencyInfo(loanId);

    expect(info.toLiquidate).equal(frozenCollateralAmount);
    expect(info.notCovered).equal(notCovered);
    expect(info.poolValueAdjust).equal(poolValue.mul(-1));
  });

  it("LoanManager.liquidate(). Should take loan.amount from liquidator and transfer collateral to liquidator.", async () => {
    await backToSnapshot(snapshot);

    await cs.LoanManager.grantRole(ROLES.LIQUIDATOR, admin.address);

    const APR = 8;
    const score = 3;
    const LTV = parseEther("70");
    const duration = ONE_MONTH;
    const gracePeriod = bn(ONE_DAY * 5);
    const lateFee = parseEther("2");

    const wethAmount = toWei("2");

    const treasuryPercent = toWei("5");

    await configureForBorrow(
      cs,
      [cs.Pools.rUSDC1],
      [cs.Tokens.WETH.address],
      pricesToUSD,
      APR,
      score,
      LTV,
      duration,
      gracePeriod,
      lateFee,
    );

    await cs.SettingsProvider.setTreasuryAddress(treasury.address);
    await cs.SettingsProvider.setTreasuryPercent(treasuryPercent);

    const nfcs = await mintNFCS(cs, user);
    await updateScore(cs, admin, nfcs, score);

    await setBalance(user, cs.Tokens.WETH, wethAmount);

    await cs.Tokens.WETH.connect(user).approve(
      cs.CollateralManager.address,
      ethers.constants.MaxUint256,
    );

    const loanAmount = await getLoanAmount(
      cs.PriceFeed,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
      wethAmount,
      LTV,
    );

    await setBalance(admin, cs.Tokens.USDC, loanAmount);
    await cs.Tokens.USDC.connect(admin).approve(
      cs.Pools.rUSDC1.address,
      loanAmount,
    );
    await cs.Pools.rUSDC1
      .connect(admin)
      .deposit(loanAmount, VERSIONS.POOL_VERSION);

    await cs.LoanManager.connect(user).borrow(
      loanAmount,
      cs.Pools.rUSDC1.address,
      cs.Tokens.WETH.address,
      LTV,
      duration,
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    const loanId = (await cs.LoanManager.getUserLoanIds(user.address))[0];

    expect(await cs.LoanManager.isDelinquent(loanId)).false;

    await mine(ONE_MONTH + ONE_DAY * 6);

    expect(await cs.LoanManager.isDelinquent(loanId)).true;

    const targetTimestamp = await currentTimestamp().then(
      (timestamp) => timestamp + 100,
    );

    const liquidateInterest = await cs.LoanManager.getInterest(
      loanId,
      targetTimestamp + 1,
    );

    const liquidatorRequired = loanAmount.add(liquidateInterest);

    await expect(
      cs.LoanManager.liquidate(loanId, VERSIONS.LOAN_MANAGER_VERSION),
    ).to.be.revertedWith("ERC20: insufficient allowance");

    await cs.Tokens.USDC.connect(admin).approve(
      cs.LoanManager.address,
      liquidatorRequired,
    );

    await expect(
      cs.LoanManager.liquidate(loanId, VERSIONS.LOAN_MANAGER_VERSION),
    ).to.be.revertedWith("ERC20: transfer amount exceeds balance");

    const userFrozenCollatral =
      await cs.CollateralManager.collateralToFreezerToUserToAmount(
        cs.Tokens.WETH.address,
        cs.LoanManager.address,
        user.address,
      );

    await setBalance(admin, cs.Tokens.USDC, liquidatorRequired);

    const beforeGetInfo = initiateSnapshot();

    await makeSnapshot(beforeGetInfo);

    await setNextBlockTimestamp(targetTimestamp);

    await setBalance(admin, cs.Tokens.USDC, liquidatorRequired);

    const [toLiquidate, , poolValueAdjust] =
      await cs.LoanManager.getDelinquencyInfo(loanId);

    const poolValueAdjustTreasury = poolValueAdjust.sub(
      poolValueAdjust.mul(treasuryPercent).div(toWei("100")),
    );

    await backToSnapshot(beforeGetInfo);

    await setNextBlockTimestamp(targetTimestamp);

    const liquidateTx = await cs.LoanManager.liquidate(
      loanId,
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    const loan = await cs.LoanManager.loans(loanId);

    expect(
      await balanceDelta(liquidateTx, cs.Tokens.USDC, admin.address),
    ).equal(liquidatorRequired);

    expect(await cs.Tokens.WETH.balanceOf(admin.address)).equal(toLiquidate);

    expect(await cs.LoanManager.isDelinquent(loanId)).false;

    const unfrozenCollateral =
      await cs.CollateralManager.collateralToUserToAmount(
        cs.Tokens.WETH.address,
        user.address,
      );

    expect(userFrozenCollatral.sub(toLiquidate)).equal(unfrozenCollateral);

    await expect(Promise.resolve(liquidateTx))
      .to.emit(cs.LoanManager, "LoanLiquidated")
      .withArgs(
        user.address,
        cs.Pools.rUSDC1.address,
        loanId,
        poolValueAdjustTreasury,
        await txTimestamp(liquidateTx),
        0,
        toLiquidate,
        unfrozenCollateral,
        poolValueAdjustTreasury,
      );

    expect(loan.status).equal(STATUS.DEFAULT_FULL_LIQUIDATED);
  });

  it("LoanManager.liquidate(). Positive scenario, collateral covers loan principal + interest.", async () => {
    await backToSnapshot(snapshot);

    await cs.LoanManager.grantRole(ROLES.LIQUIDATOR, admin.address);

    const APR = 8;
    const score = 3;
    const LTV = parseEther("70");
    const duration = ONE_MONTH;
    const gracePeriod = bn(ONE_DAY * 5);
    const lateFee = parseEther("2");

    const wethAmount = toWei("2000");

    await configureForBorrow(
      cs,
      [cs.Pools.rUSDC1],
      [cs.Tokens.WETH.address],
      pricesToUSD,
      APR,
      score,
      LTV,
      duration,
      gracePeriod,
      lateFee,
    );

    await cs.SettingsProvider.setTreasuryAddress(treasury.address);
    await cs.SettingsProvider.setTreasuryPercent(toWei("10"));

    const nfcs = await mintNFCS(cs, user);
    await updateScore(cs, admin, nfcs, score);

    await setBalance(user, cs.Tokens.WETH, wethAmount);

    await cs.Tokens.WETH.connect(user).approve(
      cs.CollateralManager.address,
      ethers.constants.MaxUint256,
    );

    const loanAmount = await getLoanAmount(
      cs.PriceFeed,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
      wethAmount,
      LTV,
    );

    await setBalance(user2, cs.Tokens.USDC, toWei6("10000000"));
    await cs.Tokens.USDC.connect(user2).approve(
      cs.Pools.rUSDC1.address,
      toWei6("10000000"),
    );
    await cs.Pools.rUSDC1
      .connect(user2)
      .deposit(toWei6("10000000"), VERSIONS.POOL_VERSION);

    const poolValueBeforeLiquidation = await cs.Pools.rUSDC1.poolValue();
    const poolBalanceBeforeLiquidation = await cs.Tokens.USDC.balanceOf(
      cs.Pools.rUSDC1.address,
    );
    const treasuryBalanceBeforeLiquidation = await cs.Tokens.USDC.balanceOf(
      treasury.address,
    );

    expect(treasuryBalanceBeforeLiquidation).equal(0);

    await cs.LoanManager.connect(user).borrow(
      loanAmount,
      cs.Pools.rUSDC1.address,
      cs.Tokens.WETH.address,
      LTV,
      duration,
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    const loanId = (await cs.LoanManager.getUserLoanIds(user.address))[0];

    expect(await cs.LoanManager.isDelinquent(loanId)).false;

    await mine(ONE_MONTH + ONE_DAY * 6);

    expect(await cs.LoanManager.isDelinquent(loanId)).true;

    ///////////////////////////////////////////////////////////////////////////////////////

    const targetTimestamp = (await currentTimestamp()) + 100;

    ///targetTimestamp + 1 because of write transaction will increment time by 1
    const liquidateInterest = await cs.LoanManager.getInterest(
      loanId,
      targetTimestamp + 1,
    );

    const liquidatorRequired = loanAmount.add(liquidateInterest);

    await setBalance(admin, cs.Tokens.USDC, liquidatorRequired);

    await cs.Tokens.USDC.connect(admin).approve(
      cs.LoanManager.address,
      liquidatorRequired,
    );

    await setNextBlockTimestamp(targetTimestamp);

    await cs.LoanManager.connect(admin).liquidate(
      loanId,
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    const poolValueAfterLiquidation = await cs.Pools.rUSDC1.poolValue();
    const poolBalanceAfterLiquidation = await cs.Tokens.USDC.balanceOf(
      cs.Pools.rUSDC1.address,
    );
    const treasuryBalanceAfterLiquidation = await cs.Tokens.USDC.balanceOf(
      treasury.address,
    );

    expect(poolValueAfterLiquidation).equal(poolBalanceAfterLiquidation);

    expect(liquidateInterest.div(10)).equal(treasuryBalanceAfterLiquidation);

    expect(poolBalanceAfterLiquidation.sub(poolBalanceBeforeLiquidation)).equal(
      liquidateInterest.sub(treasuryBalanceAfterLiquidation),
    );

    expect(poolValueAfterLiquidation.sub(poolValueBeforeLiquidation)).equal(
      liquidateInterest.sub(treasuryBalanceAfterLiquidation),
    );
  });

  it("LoanManager.liquidate(). Positive scenario, collateral covers loan amount + part of interest.", async () => {
    await backToSnapshot(snapshot);

    await cs.LoanManager.grantRole(ROLES.LIQUIDATOR, admin.address);

    const APR = 8;
    const score = 3;
    const LTV = parseEther("70");
    const duration = ONE_MONTH;
    const gracePeriod = bn(ONE_DAY * 5);
    const lateFee = parseEther("2");

    const wethAmount = toWei("2");

    const treasuryPercent = toWei("5");

    await configureForBorrow(
      cs,
      [cs.Pools.rUSDC1],
      [cs.Tokens.WETH.address],
      pricesToUSD,
      APR,
      score,
      LTV,
      duration,
      gracePeriod,
      lateFee,
    );

    await cs.SettingsProvider.setTreasuryAddress(treasury.address);
    await cs.SettingsProvider.setTreasuryPercent(treasuryPercent);

    const nfcs = await mintNFCS(cs, user);
    await updateScore(cs, admin, nfcs, score);

    await setBalance(user, cs.Tokens.WETH, wethAmount);

    await cs.Tokens.WETH.connect(user).approve(
      cs.CollateralManager.address,
      ethers.constants.MaxUint256,
    );

    const loanAmount = await getLoanAmount(
      cs.PriceFeed,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
      wethAmount,
      LTV,
    );

    await setBalance(admin, cs.Tokens.USDC, loanAmount);

    await cs.Tokens.USDC.connect(admin).approve(
      cs.Pools.rUSDC1.address,
      loanAmount,
    );

    await cs.Pools.rUSDC1
      .connect(admin)
      .deposit(loanAmount, VERSIONS.POOL_VERSION);

    await cs.LoanManager.connect(user).borrow(
      loanAmount,
      cs.Pools.rUSDC1.address,
      cs.Tokens.WETH.address,
      LTV,
      duration,
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    const loanId = (await cs.LoanManager.getUserLoanIds(user.address))[0];

    expect(await cs.LoanManager.isDelinquent(loanId)).false;

    await mine(ONE_MONTH + ONE_DAY * 6);

    expect(await cs.LoanManager.isDelinquent(loanId)).true;

    const wethFeeder = pricesToUSD.filter(
      (pair) => pair.asset == cs.Tokens.WETH.address,
    )[0];

    const loanAmountAsCollateral = await cs.PriceFeed.convert(
      loanAmount,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
    );

    const frozenCollateralAmount = (await cs.LoanManager.loans(loanId))
      .frozenCollateralAmount;

    const interestAccrued = await cs.LoanManager.getInterest(
      loanId,
      await currentTimestamp().then((t) => t + 1),
    );

    const interestAccruedAsCollateral = await cs.PriceFeed.convert(
      interestAccrued,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
    );

    await cs.PriceFeed.setLatestAnswer(
      wethFeeder.feederAddress,
      wethFeeder.priceToUSD
        .mul(
          loanAmountAsCollateral.add(interestAccruedAsCollateral.mul(2).div(3)),
        )
        .div(frozenCollateralAmount),
    );

    const liquidateExtraInterest = await cs.LoanManager.getInterest(
      loanId,
      currentTimestamp().then((timestamp) => timestamp + 100),
    );

    const liquidatorRequired = loanAmount.add(liquidateExtraInterest);

    await setBalance(admin, cs.Tokens.USDC, liquidatorRequired);

    await cs.Tokens.USDC.connect(admin).approve(
      cs.LoanManager.address,
      liquidatorRequired,
    );

    const poolValue = await cs.Pools.rUSDC1.poolValue();

    const targetTimestamp = (await currentTimestamp()) + 100;

    const beforeGetInfo = initiateSnapshot();

    await makeSnapshot(beforeGetInfo);

    await setNextBlockTimestamp(targetTimestamp);

    await setBalance(admin, cs.Tokens.USDC, liquidatorRequired);

    const [toLiquidate, notCovered, poolValueAdjust] =
      await cs.LoanManager.getDelinquencyInfo(loanId);

    await backToSnapshot(beforeGetInfo);

    await setNextBlockTimestamp(targetTimestamp);

    await cs.LoanManager.liquidate(loanId, VERSIONS.LOAN_MANAGER_VERSION);

    expect((await cs.Pools.rUSDC1.poolValue()).sub(poolValue)).equal(
      poolValueAdjust.sub(
        poolValueAdjust.mul(treasuryPercent).div(toWei("100")),
      ),
    );

    expect(await cs.Tokens.WETH.balanceOf(admin.address)).equal(toLiquidate);

    expect((await cs.LoanManager.loans(loanId)).amount).equals(notCovered);
    expect((await cs.LoanManager.loans(loanId)).status).equal(
      STATUS.DEFAULT_PART,
    );
  });

  it("LoanManager.liquidate(). Liquidate undercoll loan, loan.amount should be > 0.", async () => {
    await backToSnapshot(snapshot);

    await cs.LoanManager.grantRole(ROLES.LIQUIDATOR, admin.address);

    const APR = 8;
    const score = 3;
    const LTV = parseEther("70");
    const duration = ONE_MONTH;
    const gracePeriod = bn(ONE_DAY * 5);
    const lateFee = parseEther("2");

    const wethAmount = toWei("2");

    const treasuryPercent = toWei("5");

    await configureForBorrow(
      cs,
      [cs.Pools.rUSDC1],
      [cs.Tokens.WETH.address],
      pricesToUSD,
      APR,
      score,
      LTV,
      duration,
      gracePeriod,
      lateFee,
    );

    await cs.SettingsProvider.setTreasuryAddress(treasury.address);
    await cs.SettingsProvider.setTreasuryPercent(treasuryPercent);

    const nfcs = await mintNFCS(cs, user);
    await updateScore(cs, admin, nfcs, score);

    await setBalance(user, cs.Tokens.WETH, wethAmount);

    await cs.Tokens.WETH.connect(user).approve(
      cs.CollateralManager.address,
      ethers.constants.MaxUint256,
    );

    const loanAmount = await getLoanAmount(
      cs.PriceFeed,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
      wethAmount,
      LTV,
    );

    await setBalance(admin, cs.Tokens.USDC, loanAmount);
    await cs.Tokens.USDC.connect(admin).approve(
      cs.Pools.rUSDC1.address,
      loanAmount,
    );
    await cs.Pools.rUSDC1
      .connect(admin)
      .deposit(loanAmount, VERSIONS.POOL_VERSION);

    await cs.LoanManager.connect(user).borrow(
      loanAmount,
      cs.Pools.rUSDC1.address,
      cs.Tokens.WETH.address,
      LTV,
      duration,
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    const loanId = (await cs.LoanManager.getUserLoanIds(user.address))[0];

    expect(await cs.LoanManager.isDelinquent(loanId)).false;

    await mine(ONE_MONTH + ONE_DAY * 6);

    expect(await cs.LoanManager.isDelinquent(loanId)).true;

    const wethFeeder = pricesToUSD.filter(
      (pair) => pair.asset == cs.Tokens.WETH.address,
    )[0];

    const loanAmountAsCollateral = await cs.PriceFeed.convert(
      loanAmount,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
    );

    const frozenCollateralAmount = (await cs.LoanManager.loans(loanId))
      .frozenCollateralAmount;

    await cs.PriceFeed.setLatestAnswer(
      wethFeeder.feederAddress,
      wethFeeder.priceToUSD
        .mul(loanAmountAsCollateral)
        .div(frozenCollateralAmount)
        .mul(2)
        .div(3),
    );

    const liquidateExtraInterest = await cs.LoanManager.getInterest(
      loanId,
      currentTimestamp().then((timestamp) => timestamp + 100),
    );

    const liquidatorRequired = loanAmount.add(liquidateExtraInterest);

    await setBalance(admin, cs.Tokens.USDC, liquidatorRequired);

    await cs.Tokens.USDC.connect(admin).approve(
      cs.LoanManager.address,
      liquidatorRequired,
    );

    const poolValue = await cs.Pools.rUSDC1.poolValue();

    const targetTimestamp = (await currentTimestamp()) + 100;

    const beforeGetInfo = initiateSnapshot();

    await makeSnapshot(beforeGetInfo);

    await setNextBlockTimestamp(targetTimestamp);

    await setBalance(admin, cs.Tokens.USDC, liquidatorRequired);

    const [toLiquidate, notCovered, poolValueAdjust] =
      await cs.LoanManager.getDelinquencyInfo(loanId);

    await backToSnapshot(beforeGetInfo);

    await setNextBlockTimestamp(targetTimestamp);

    await cs.LoanManager.liquidate(loanId, VERSIONS.LOAN_MANAGER_VERSION);

    expect((await cs.Pools.rUSDC1.poolValue()).sub(poolValue)).equal(
      poolValueAdjust,
    );

    expect(await cs.Tokens.WETH.balanceOf(admin.address)).equal(toLiquidate);

    expect((await cs.LoanManager.loans(loanId)).amount).equals(notCovered);
    expect((await cs.LoanManager.loans(loanId)).status).equal(
      STATUS.DEFAULT_PART,
    );
  });

  it("LoanManager.liquidate(). Liquidate to poolValue < 0", async () => {
    await backToSnapshot(snapshot);

    await cs.LoanManager.grantRole(ROLES.LIQUIDATOR, admin.address);

    const APR = 8;
    const score = 3;
    const LTV = parseEther("70");
    const duration = ONE_MONTH;
    const gracePeriod = bn(ONE_DAY * 5);
    const lateFee = parseEther("2");

    const wethAmount = toWei("2");

    const treasuryPercent = toWei("5");

    await configureForBorrow(
      cs,
      [cs.Pools.rUSDC1],
      [cs.Tokens.WETH.address],
      pricesToUSD,
      APR,
      score,
      LTV,
      duration,
      gracePeriod,
      lateFee,
    );

    await cs.SettingsProvider.setTreasuryAddress(treasury.address);
    await cs.SettingsProvider.setTreasuryPercent(treasuryPercent);

    const nfcs = await mintNFCS(cs, user);
    await updateScore(cs, admin, nfcs, score);

    await setBalance(user, cs.Tokens.WETH, wethAmount);

    await cs.Tokens.WETH.connect(user).approve(
      cs.CollateralManager.address,
      ethers.constants.MaxUint256,
    );

    const loanAmount = await getLoanAmount(
      cs.PriceFeed,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
      wethAmount,
      LTV,
    );

    await cs.Tokens.USDC.mint(cs.Pools.rUSDC1.address, loanAmount);

    await cs.LoanManager.connect(user).borrow(
      loanAmount,
      cs.Pools.rUSDC1.address,
      cs.Tokens.WETH.address,
      LTV,
      duration,
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    const loanId = (await cs.LoanManager.getUserLoanIds(user.address))[0];

    expect(await cs.LoanManager.isDelinquent(loanId)).false;

    await mine(ONE_MONTH + ONE_DAY * 6);

    expect(await cs.LoanManager.isDelinquent(loanId)).true;

    const wethFeeder = pricesToUSD.filter(
      (pair) => pair.asset == cs.Tokens.WETH.address,
    )[0];

    const loanAmountAsCollateral = await cs.PriceFeed.convert(
      loanAmount,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
    );

    const frozenCollateralAmount = (await cs.LoanManager.loans(loanId))
      .frozenCollateralAmount;

    await cs.PriceFeed.setLatestAnswer(
      wethFeeder.feederAddress,
      wethFeeder.priceToUSD
        .mul(loanAmountAsCollateral)
        .div(frozenCollateralAmount)
        .mul(2)
        .div(3),
    );

    const liquidateExtraInterest = await cs.LoanManager.getInterest(
      loanId,
      currentTimestamp().then((timestamp) => timestamp + 100),
    );

    const liquidatorRequired = loanAmount.add(liquidateExtraInterest);

    await setBalance(admin, cs.Tokens.USDC, liquidatorRequired);

    await cs.Tokens.USDC.connect(admin).approve(
      cs.LoanManager.address,
      liquidatorRequired,
    );

    await expect(
      cs.LoanManager.liquidate(loanId, VERSIONS.LOAN_MANAGER_VERSION),
    ).to.be.revertedWith(Errors.POOL_VALUE_LT_ZERO);
  });

  //Hexlens audit test case
  //   1. User A loans 100 X underlying for 100 Y collateral.
  // 2. User A defaults on the loan.
  // 3. Now 100 Y is only worth 90 X, so the liquidation is partial.
  // 4. This results in the loan manager seizing 100 Y and the loan having a
  // remaining amount of 10 X.
  // 5. The borrower starts a new loan for 90 X underlying and 100 Y
  // collateral.
  // 6. The borrower repays the old loan for 10 X.
  // 7. This results in the Loan Manager unfreezing 100 Y for the borrower,
  // making the second loan collateral-free.
  // 8. The borrower nets 180 X underlying for only 100 Y collateral.
  it("LoanManager.liquidate(). V2 audit deficiency-2 fix test", async () => {
    await backToSnapshot(snapshot);

    await cs.LoanManager.grantRole(ROLES.LIQUIDATOR, admin.address);

    const APR = 8;
    const score = 3;
    const LTV = parseEther("100");
    const duration = ONE_MONTH;
    const gracePeriod = bn(ONE_DAY * 5);
    const lateFee = parseEther("2");

    const wethAmount = toWei("2");

    const treasuryPercent = toWei("5");

    await configureForBorrow(
      cs,
      [cs.Pools.rUSDC1],
      [cs.Tokens.WETH.address],
      pricesToUSD,
      APR,
      score,
      LTV,
      duration,
      gracePeriod,
      lateFee,
    );

    await cs.SettingsProvider.setTreasuryAddress(treasury.address);
    await cs.SettingsProvider.setTreasuryPercent(treasuryPercent);

    const nfcs = await mintNFCS(cs, user);
    await updateScore(cs, admin, nfcs, score);

    await setBalance(user, cs.Tokens.WETH, wethAmount);

    await cs.Tokens.WETH.connect(user).approve(
      cs.CollateralManager.address,
      ethers.constants.MaxUint256,
    );

    let loanAmount = await getLoanAmount(
      cs.PriceFeed,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
      wethAmount,
      LTV,
    );

    await setBalance(user2, cs.Tokens.USDC, loanAmount.mul(10));

    await cs.Tokens.USDC.connect(user2).approve(
      cs.Pools.rUSDC1.address,
      loanAmount.mul(10),
    );

    await cs.Pools.rUSDC1
      .connect(user2)
      .deposit(loanAmount.mul(10), VERSIONS.POOL_VERSION);

    await cs.LoanManager.connect(user).borrow(
      loanAmount,
      cs.Pools.rUSDC1.address,
      cs.Tokens.WETH.address,
      LTV,
      duration,
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    const loanId = (await cs.LoanManager.getUserLoanIds(user.address))[0];

    expect(await cs.LoanManager.isDelinquent(loanId)).false;

    await mine(ONE_MONTH + ONE_DAY * 6);

    expect(await cs.LoanManager.isDelinquent(loanId)).true;

    const wethFeeder = pricesToUSD.filter(
      (pair) => pair.asset == cs.Tokens.WETH.address,
    )[0];

    await cs.PriceFeed.setLatestAnswer(
      wethFeeder.feederAddress,
      wethFeeder.priceToUSD.mul(90).div(100),
    );

    const liquidateExtraInterest = await cs.LoanManager.getInterest(
      loanId,
      currentTimestamp().then((timestamp) => timestamp + 100),
    );

    const liquidatorRequired = loanAmount.add(liquidateExtraInterest);

    await setBalance(admin, cs.Tokens.USDC, liquidatorRequired);

    await cs.Tokens.USDC.connect(admin).approve(
      cs.LoanManager.address,
      liquidatorRequired,
    );

    await cs.LoanManager.liquidate(loanId, VERSIONS.LOAN_MANAGER_VERSION);

    await updateScore(cs, admin, nfcs, score);

    loanAmount = await getLoanAmount(
      cs.PriceFeed,
      cs.Tokens.USDC.address,
      cs.Tokens.WETH.address,
      wethAmount,
      LTV,
    );

    await setBalance(user, cs.Tokens.WETH, wethAmount);

    await cs.LoanManager.connect(user).borrow(
      loanAmount,
      cs.Pools.rUSDC1.address,
      cs.Tokens.WETH.address,
      LTV,
      duration,
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    await cs.Tokens.USDC.connect(user).approve(
      cs.LoanManager.address,
      getPercent(loanAmount, 120),
    );

    await cs.LoanManager.connect(user).repay(
      loanId,
      getPercent(loanAmount, 120),
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    expect(
      await cs.CollateralManager.collateralToUserToAmount(
        cs.Tokens.WETH.address,
        user.address,
      ),
    ).equal(0);
  });
});
