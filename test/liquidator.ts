import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { solidityPack } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";
import { Errors, proxyOpts, ROLES, VERSIONS } from "../scripts/constants";
import { STATUS } from "../scripts/status";

import {
  applyPoolFee,
  backToSnapshot,
  balanceDelta,
  bn,
  configureMockPriceFeed,
  currentTimestamp,
  deployed,
  getACErrorText,
  getRandomAddress,
  initiateSnapshot,
  makeSnapshot,
  mine,
  toWei,
  txTimestamp,
} from "../scripts/common";
import { deployTestToken } from "../scripts/deployLib";
import {
  CollateralManager,
  LimitManager,
  MockERC20,
  MockLoanManager,
  MockPriceFeed,
  MockSwapRouter,
  Pool,
  SettingsProvider,
} from "../typechain-types";
import { Liquidator } from "../typechain-types/contracts/Liquidator";
import { LoanLib } from "../typechain-types/contracts/LoanManager";
import { MockLimitManager } from "../typechain-types/contracts/mocks/MockLimitManager";

const maxUint = ethers.constants.MaxUint256;
const lot = maxUint.div(2);

describe("Liquidator unit testing", async function () {
  this.timeout(0);

  let usdc: MockERC20;
  let weth: MockERC20;
  let dai: MockERC20;
  let wbtc: MockERC20;

  let pool: Pool;

  let admin: SignerWithAddress;
  let user: SignerWithAddress;
  let loanManager: MockLoanManager;
  let liquidator: Liquidator;
  let priceFeed: MockPriceFeed;
  let collateralManager: CollateralManager;
  let settingsProvider: SettingsProvider;
  let limitManager: MockLimitManager;
  let swapRouter: MockSwapRouter;

  let loan: LoanLib.LoanStruct;

  const snapshot = initiateSnapshot();

  before(async function () {
    [admin, user] = await ethers.getSigners();

    usdc = (
      await deployTestToken({
        name: "USDC",
        symbol: "USDC",
        decimals: 6,
      })
    ).connect(admin);

    dai = (
      await deployTestToken({
        name: "DAI",
        symbol: "DAI",
        decimals: 18,
      })
    ).connect(admin);

    weth = (
      await deployTestToken({
        name: "WETH",
        symbol: "WETH",
        decimals: 18,
      })
    ).connect(admin);

    wbtc = (
      await deployTestToken({
        name: "WBTC",
        symbol: "WBTC",
        decimals: 18,
      })
    ).connect(admin);

    pool = (
      await upgrades
        .deployProxy(
          await ethers.getContractFactory("Pool"),
          [usdc.address, "rUSDC", "Roci Token", admin.address],
          proxyOpts,
        )
        .then(deployed)
    ).connect(admin) as Pool;

    loanManager = (
      await upgrades
        .deployProxy(
          await ethers.getContractFactory("MockLoanManager", admin),
          [admin.address],
          proxyOpts,
        )
        .then(deployed)
    ).connect(admin) as MockLoanManager;

    liquidator = (
      await upgrades
        .deployProxy(
          await ethers.getContractFactory("Liquidator", admin),
          [admin.address],
          proxyOpts,
        )
        .then(deployed)
    ).connect(admin) as Liquidator;

    priceFeed = (
      await upgrades
        .deployProxy(
          await ethers.getContractFactory("MockPriceFeed", admin),
          [admin.address],
          proxyOpts,
        )
        .then(deployed)
    ).connect(admin) as MockPriceFeed;

    collateralManager = (
      await upgrades
        .deployProxy(
          await ethers.getContractFactory("CollateralManager", admin),
          [admin.address],
          proxyOpts,
        )
        .then(deployed)
    ).connect(admin) as CollateralManager;

    settingsProvider = (
      await upgrades
        .deployProxy(
          await ethers.getContractFactory("SettingsProvider", admin),
          [admin.address],
          proxyOpts,
        )
        .then(deployed)
    ).connect(admin) as SettingsProvider;

    limitManager = (
      await (await ethers.getContractFactory("MockLimitManager", admin))
        .deploy()
        .then(deployed)
    ).connect(admin) as LimitManager;

    swapRouter = await (
      await ethers.getContractFactory("MockSwapRouter", admin)
    ).deploy();

    const pricesToUSD = [
      {
        asset: usdc.address,
        priceToUSD: bn(99993109),
        feederAddress: getRandomAddress(),
      },
      {
        asset: dai.address,
        priceToUSD: bn(100000000),
        feederAddress: getRandomAddress(),
      },
      {
        asset: weth.address,
        priceToUSD: bn(127504531414),
        feederAddress: getRandomAddress(),
      },
      {
        asset: wbtc.address,
        priceToUSD: bn(1909918602146),
        feederAddress: getRandomAddress(),
      },
    ];

    await configureMockPriceFeed(priceFeed, pricesToUSD);

    await loanManager.setPriceFeed(priceFeed.address);

    await loanManager.grantRole(ROLES.LIQUIDATOR, liquidator.address);

    await liquidator.setLoanManager(loanManager.address);

    await liquidator.setPriceFeed(priceFeed.address);

    await liquidator.setUniSwapV3Router(swapRouter.address);

    await liquidator.grantRole(ROLES.LIQUIDATION_BOT, admin.address);

    await liquidator.approveAsset(usdc.address, lot);

    await collateralManager.addCollaterals([weth.address]);

    await loanManager.setCollateralManager(collateralManager.address);

    await collateralManager.grantRole(ROLES.LOAN_MANAGER, loanManager.address);

    await loanManager.setSettingsProvider(settingsProvider.address);

    await loanManager.setLimitManager(limitManager.address);

    await swapRouter.setPriceFeed(priceFeed.address);

    await pool.grantRole(ROLES.LOAN_MANAGER, loanManager.address);

    await pool.approveLoanManager(
      loanManager.address,
      ethers.constants.MaxUint256,
    );

    await weth
      .connect(user)
      .approve(collateralManager.address, ethers.constants.MaxUint256);

    await makeSnapshot(snapshot);
  });

  it("Restrictions test", async function () {
    const unauthorized = liquidator.connect(user);

    await expect(
      unauthorized.setLoanManager(getRandomAddress()),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));

    await expect(
      unauthorized.setPriceFeed(getRandomAddress()),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));

    await expect(
      unauthorized.setUniSwapV3Router(getRandomAddress()),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));

    await expect(
      unauthorized.liquidateAndStore(77, VERSIONS.LIQUIDATOR_VERSION),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.LIQUIDATION_BOT));

    await expect(
      unauthorized.swapLastDirect(500, 3, VERSIONS.LIQUIDATOR_VERSION),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.LIQUIDATION_BOT));

    await expect(
      unauthorized.swapLastMultihop("0x77", 3, VERSIONS.LIQUIDATOR_VERSION),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.LIQUIDATION_BOT));

    await expect(
      unauthorized.emergencyWithdraw(
        getRandomAddress(),
        77,
        VERSIONS.LIQUIDATOR_VERSION,
      ),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));
  });

  it("Should liquidate loan and create liquidity record", async function () {
    await backToSnapshot(snapshot);

    const loanAmount = bn("1000000000000");
    const collateralToAdd = toWei("10000");
    const loanDuration = 100;
    const gracePeriod = 20;
    const loanId = 77;

    await usdc.mint(liquidator.address, lot);

    await usdc.mint(pool.address, loanAmount);
    await weth.mint(user.address, collateralToAdd);

    const now = await currentTimestamp();

    loan = {
      pool: pool.address,
      borrower: user.address,
      amount: loanAmount,
      apr: toWei("10"),
      ltv: toWei("70"),
      lateFee: 0,
      issueDate: now,
      dueDate: now + loanDuration,
      liquidationDate: now + loanDuration + gracePeriod,
      lastRepay: now,
      frozenCollateralToken: weth.address,
      frozenCollateralAmount: collateralToAdd,
      status: STATUS.NEW,
    };

    await loanManager.connect(user).addLoan(loan, loanId);

    expect(await loanManager.isDelinquent(loanId)).false;

    await expect(
      liquidator.liquidateAndStore(loanId, VERSIONS.LIQUIDATOR_VERSION),
    ).to.be.revertedWith(Errors.LOAN_MANAGER_LOAN_IS_LIQUID);

    await mine(now + loanDuration + gracePeriod);

    expect(await loanManager.isDelinquent(loanId)).true;

    const [toLiquidate, , poolValueAdjust] =
      await loanManager.getDelinquencyInfo(loanId);

    const liquidateAndStoreTx = liquidator.liquidateAndStore(
      loanId,
      VERSIONS.LIQUIDATOR_VERSION,
    );

    await expect(liquidateAndStoreTx)
      .to.emit(liquidator, "LiquidityStored")
      .withArgs(weth.address, usdc.address, toLiquidate, pool.address);

    expect(
      await balanceDelta(liquidateAndStoreTx, weth, liquidator.address),
    ).equal(toLiquidate);

    expect(
      await balanceDelta(liquidateAndStoreTx, usdc, liquidator.address),
    ).equal(loanAmount.add(poolValueAdjust));

    expect(await balanceDelta(liquidateAndStoreTx, usdc, pool.address)).equal(
      loanAmount.add(poolValueAdjust),
    );

    const liquidityRecord = await liquidator.getLastLiquidity();

    expect(liquidityRecord.collateralToken).equal(weth.address);
    expect(liquidityRecord.underlyingToken).equal(usdc.address);
    expect(liquidityRecord.amount).equal(toLiquidate);
    expect(liquidityRecord.pool).equal(pool.address);
  });

  it("Should withdraw funds to admin", async function () {
    await backToSnapshot(snapshot);

    await usdc.mint(liquidator.address, lot);

    const emergencyTx = liquidator.emergencyWithdraw(
      usdc.address,
      lot,
      VERSIONS.LIQUIDATOR_VERSION,
    );

    await expect(emergencyTx)
      .to.emit(liquidator, "EmergencyWithdraw")
      .withArgs(
        usdc.address,
        admin.address,
        lot,
        await txTimestamp(await emergencyTx),
      );

    expect(await balanceDelta(emergencyTx, usdc, admin.address)).equal(lot);
  });

  it("Should swap liquidity in direct", async function () {
    await backToSnapshot(snapshot);
    const loanAmount = bn("1000000000000");
    const collateralToAdd = toWei("10000");
    const loanDuration = 100;
    const gracePeriod = 20;
    const loanId = 77;

    const poolFee = 500;

    await usdc.mint(liquidator.address, lot);

    await usdc.mint(pool.address, loanAmount);
    await weth.mint(user.address, collateralToAdd);

    const now = await currentTimestamp();

    loan = {
      pool: pool.address,
      borrower: user.address,
      amount: loanAmount,
      apr: toWei("10"),
      ltv: toWei("70"),
      lateFee: 0,
      issueDate: now,
      dueDate: now + loanDuration,
      liquidationDate: now + loanDuration + gracePeriod,
      lastRepay: now,
      frozenCollateralToken: weth.address,
      frozenCollateralAmount: collateralToAdd,
      status: STATUS.NEW,
    };

    await loanManager.connect(user).addLoan(loan, loanId);

    await mine(now + loanDuration + gracePeriod);

    const [toLiquidate] = await loanManager.getDelinquencyInfo(loanId);

    await liquidator.liquidateAndStore(loanId, VERSIONS.LIQUIDATOR_VERSION);

    await liquidator.emergencyWithdraw(
      weth.address,
      toLiquidate,
      VERSIONS.LIQUIDATOR_VERSION,
    );

    await expect(
      liquidator.swapLastDirect(poolFee, 3, VERSIONS.LIQUIDATOR_VERSION),
    ).to.be.revertedWith(Errors.LIQUIDATOR_INSUFFICIENT_FUNDS);

    await weth.mint(liquidator.address, toLiquidate);

    const swapTx = liquidator.swapLastDirect(
      poolFee,
      3,
      VERSIONS.LIQUIDATOR_VERSION,
    );

    const expectRedeemed = await priceFeed
      .convert(toLiquidate, weth.address, usdc.address)
      .then(applyPoolFee(poolFee));

    await expect(swapTx)
      .to.emit(liquidator, "LiquiditySwapped")
      .withArgs(0, toLiquidate, expectRedeemed);

    expect(await balanceDelta(swapTx, usdc, liquidator.address)).equal(
      expectRedeemed,
    );

    expect(await balanceDelta(swapTx, weth, liquidator.address)).equal(
      toLiquidate,
    );

    await expect(
      liquidator.swapLastDirect(500, 3, VERSIONS.LIQUIDATOR_VERSION),
    ).to.be.revertedWith(Errors.LIQUIDATOR_NOTHING_TO_SWAP);
  });

  it("Should swap liquidity in multihop", async function () {
    await backToSnapshot(snapshot);
    const loanAmount = bn("1000000000000");
    const collateralToAdd = toWei("10000");
    const loanDuration = 100;
    const gracePeriod = 20;
    const loanId = 77;

    const wethDaiFee = 500;
    const daiWbtcFee = 300;
    const wbtcUsdcFee = 1000;

    const wethDaiPath: [string, number, string] = [
      weth.address,
      wethDaiFee,
      dai.address,
    ];

    const daiWbtcPath: [string, number, string] = [
      dai.address,
      daiWbtcFee,
      wbtc.address,
    ];

    const wbtcUsdcPath: [string, number, string] = [
      wbtc.address,
      wbtcUsdcFee,
      usdc.address,
    ];

    //Not a profitable path, but ok for tests
    const swapPath = [
      ...wethDaiPath.slice(-2),
      ...daiWbtcPath.slice(-2),
      wbtcUsdcPath[1],
    ];

    const pathEncoded = solidityPack(
      ["uint24", "address", "uint24", "address", "uint24"],
      swapPath,
    );

    await usdc.mint(liquidator.address, lot);

    await usdc.mint(pool.address, loanAmount);
    await weth.mint(user.address, collateralToAdd);

    const now = await currentTimestamp();

    loan = {
      pool: pool.address,
      borrower: user.address,
      amount: loanAmount,
      apr: toWei("10"),
      ltv: toWei("70"),
      lateFee: 0,
      issueDate: now,
      dueDate: now + loanDuration,
      liquidationDate: now + loanDuration + gracePeriod,
      lastRepay: now,
      frozenCollateralToken: weth.address,
      frozenCollateralAmount: collateralToAdd,
      status: STATUS.NEW,
    };

    await loanManager.connect(user).addLoan(loan, loanId);

    await mine(now + loanDuration + gracePeriod);

    const [toLiquidate] = await loanManager.getDelinquencyInfo(loanId);

    await liquidator.liquidateAndStore(loanId, VERSIONS.LIQUIDATOR_VERSION);

    await liquidator.emergencyWithdraw(
      weth.address,
      toLiquidate,
      VERSIONS.LIQUIDATOR_VERSION,
    );

    await expect(
      liquidator.swapLastMultihop(pathEncoded, 3, VERSIONS.LIQUIDATOR_VERSION),
    ).to.be.revertedWith(Errors.LIQUIDATOR_INSUFFICIENT_FUNDS);

    await weth.mint(liquidator.address, toLiquidate);

    const wethUsdcPriced = await priceFeed.convert(
      toLiquidate,
      weth.address,
      usdc.address,
    );

    //Expected
    const wethDaiExpected = await priceFeed
      .convert(toLiquidate, wethDaiPath[0], wethDaiPath[2])
      .then(applyPoolFee(wethDaiFee));

    const daiWbtcExpected = await priceFeed
      .convert(wethDaiExpected, daiWbtcPath[0], daiWbtcPath[2])
      .then(applyPoolFee(daiWbtcFee));

    const wbtcUsdcExpected = await priceFeed
      .convert(daiWbtcExpected, wbtcUsdcPath[0], wbtcUsdcPath[2])
      .then(applyPoolFee(wbtcUsdcFee));

    const slippage = wbtcUsdcExpected.mul(100).div(wethUsdcPriced).add(1);

    const swapTx = liquidator.swapLastMultihop(
      pathEncoded,
      slippage,
      VERSIONS.LIQUIDATOR_VERSION,
    );

    await expect(swapTx)
      .to.emit(liquidator, "LiquiditySwapped")
      .withArgs(0, toLiquidate, wbtcUsdcExpected);

    expect(await balanceDelta(swapTx, usdc, liquidator.address)).equal(
      wbtcUsdcExpected,
    );

    expect(await balanceDelta(swapTx, weth, liquidator.address)).equal(
      toLiquidate,
    );
  });
});
