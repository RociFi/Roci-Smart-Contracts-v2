import { expect } from "chai";
import { ethers } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";
import {
  backToSnapshot,
  bn,
  configureForBorrow,
  currentTimestamp,
  getLoanAmount,
  getPausedFuncErrorText,
  getPercent,
  getRandomAddress,
  initiateSnapshot,
  makeSnapshot,
  mine,
  mintNFCS,
  setBalance,
  toWei,
  toWei6,
  txTimestamp,
  updateScore,
} from "../../scripts/common";
import {
  Errors,
  ONE_DAY,
  ONE_MONTH,
  ONE_YEAR,
  poolsParams,
  ROLES,
  tokensParams,
  VERSIONS,
} from "../../scripts/constants";
import { deployForTests } from "../../scripts/deployTest";
import { STATUS } from "../../scripts/status";
import { TestContracts } from "../../scripts/types";

describe("LoanManager.repay() unit testing.", async function () {
  this.timeout(0);

  let admin: SignerWithAddress;
  let user: SignerWithAddress;
  let user2: SignerWithAddress;
  let treasury: SignerWithAddress;

  let pricesToUSD: {
    asset: string;
    priceToUSD: BigNumber;
    feederAddress: string;
  }[];

  let cs: TestContracts;

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

    await makeSnapshot(snapshot);
  });

  it("Should properly calculate interest for loan.", async function () {
    await backToSnapshot(snapshot);

    const APR = 1;
    const score = 3;
    const LTV = parseEther("70");
    const duration = ONE_MONTH;
    const gracePeriod = bn(ONE_DAY * 5);
    const lateFee = parseEther("2");

    const wethAmount = toWei("2");

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

    const nfcs = await mintNFCS(cs, user);
    await updateScore(cs, admin, nfcs, score);

    const loanAmount = await getLoanAmount(
      cs.PriceFeed,
      await cs.Pools.rUSDC1.underlyingToken(),
      cs.Tokens.WETH.address,
      wethAmount,
      LTV,
    );

    await cs.Tokens.USDC.mint(cs.Pools.rUSDC1.address, loanAmount);

    await setBalance(user, cs.Tokens.WETH, wethAmount);

    await cs.Tokens.WETH.connect(user).approve(
      cs.CollateralManager.address,
      wethAmount,
    );

    await cs.CollateralManager.connect(user).addCollateral(
      user.address,
      cs.Tokens.WETH.address,
      wethAmount,
    );

    const loanId = await cs.LoanManager.nextLoanId();

    await cs.LoanManager.connect(user).borrow(
      loanAmount,
      cs.Pools.rUSDC1.address,
      cs.Tokens.WETH.address,
      LTV,
      duration,
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    await mine(ONE_MONTH / 2);

    let loan = await cs.LoanManager.loans(loanId);

    let now = await currentTimestamp();

    expect(await cs.LoanManager.getInterest(loanId, now)).equal(
      loan.amount
        .mul(loan.apr.div(ONE_YEAR))
        .mul(bn(now).sub(loan.lastRepay))
        .div(parseEther("100")),
    );

    await cs.Tokens.USDC.connect(user).approve(
      cs.LoanManager.address,
      loanAmount.div(2),
    );

    await cs.LoanManager.connect(user).repay(
      loanId,
      loanAmount.div(2),
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    await mine(ONE_MONTH / 2 + 10);

    now = await currentTimestamp();

    loan = await cs.LoanManager.loans(loanId);

    expect(await cs.LoanManager.getInterest(loanId, now)).equal(
      loan.amount
        .mul(loan.apr.div(ONE_YEAR))
        .mul(loan.dueDate.sub(loan.lastRepay))
        .div(parseEther("100"))
        .add(
          loan.amount
            .mul(loan.apr.div(ONE_YEAR))
            .mul(bn(now).sub(loan.dueDate))
            .div(parseEther("100"))
            .mul(loan.lateFee)
            .div(parseEther("1")),
        ),
    );

    await cs.Tokens.USDC.connect(user).approve(
      cs.LoanManager.address,
      loanAmount.div(4),
    );

    await cs.LoanManager.connect(user).repay(
      loanId,
      loanAmount.div(4),
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    await mine(ONE_DAY * 3);

    now = await currentTimestamp();

    loan = await cs.LoanManager.loans(loanId);

    expect(await cs.LoanManager.getInterest(loanId, now)).equal(
      loan.amount
        .mul(loan.apr.div(ONE_YEAR))
        .mul(bn(now).sub(loan.lastRepay))
        .div(parseEther("100"))
        .mul(loan.lateFee)
        .div(parseEther("1")),
    );
  });

  it("If repay() paused/wrong version.", async function () {
    await backToSnapshot(snapshot);

    await cs.LoanManager.grantRole(ROLES.PAUSER, admin.address);

    const APR = 8;
    const score = 3;
    const LTV = parseEther("70");
    const duration = ONE_MONTH;
    const gracePeriod = bn(ONE_DAY * 5);
    const lateFee = parseEther("2");

    const wethAmount = toWei("2");

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

    const nfcs = await mintNFCS(cs, user);
    await updateScore(cs, admin, nfcs, score);

    const loanAmount = await getLoanAmount(
      cs.PriceFeed,
      await cs.Pools.rUSDC1.underlyingToken(),
      cs.Tokens.WETH.address,
      wethAmount,
      LTV,
    );

    await cs.Tokens.USDC.mint(cs.Pools.rUSDC1.address, loanAmount);

    await setBalance(user, cs.Tokens.WETH, wethAmount);

    await cs.Tokens.WETH.connect(user).approve(
      cs.CollateralManager.address,
      wethAmount,
    );

    const loanId = await cs.LoanManager.nextLoanId();

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
      loanAmount,
    );

    await cs.LoanManager.setFuncPaused("repay", true);

    await expect(
      cs.LoanManager.connect(user).repay(
        loanId,
        loanAmount,
        VERSIONS.LOAN_MANAGER_VERSION,
      ),
    ).to.be.revertedWith(getPausedFuncErrorText("repay"));

    await cs.LoanManager.setFuncPaused("repay", false);

    await cs.LoanManager.pause();

    expect(await cs.LoanManager.paused()).true;

    await expect(
      cs.LoanManager.connect(user).repay(
        loanId,
        loanAmount,
        VERSIONS.LOAN_MANAGER_VERSION,
      ),
    ).to.be.revertedWith(Errors.PAUSED);

    await cs.LoanManager.unpause();

    await expect(
      cs.LoanManager.connect(user).repay(loanId, loanAmount, "7.7.7"),
    ).to.be.revertedWith(Errors.VERSION);

    await expect(
      cs.LoanManager.connect(user).repay(0, 0, VERSIONS.LOAN_MANAGER_VERSION),
    ).to.be.revertedWith(Errors.LOAN_MANAGER_ZERO_REPAY);

    await expect(
      cs.LoanManager.connect(user).repay(
        0,
        loanAmount,
        VERSIONS.LOAN_MANAGER_VERSION,
      ),
    ).to.be.revertedWith(Errors.LOAN_MANAGER_LOAN_AMOUNT_ZERO);

    await cs.Tokens.USDC.approve(cs.LoanManager.address, loanAmount);

    await cs.LoanManager.connect(user).repay(
      loanId,
      loanAmount,
      VERSIONS.LOAN_MANAGER_VERSION,
    );
  });

  it("Repayment flow.", async function () {
    await backToSnapshot(snapshot);

    await cs.LoanManager.grantRole(ROLES.PAUSER, admin.address);

    const APR = 8;
    const score = 3;
    const LTV = parseEther("70");
    const duration = ONE_MONTH;
    const gracePeriod = bn(ONE_DAY * 5);
    const lateFee = parseEther("2");

    const wethAmount = toWei("2");

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

    const nfcs = await mintNFCS(cs, user);
    await updateScore(cs, admin, nfcs, score);

    const loanAmount = await getLoanAmount(
      cs.PriceFeed,
      await cs.Pools.rUSDC1.underlyingToken(),
      cs.Tokens.WETH.address,
      wethAmount,
      LTV,
    );

    await cs.Tokens.USDC.mint(cs.Pools.rUSDC1.address, loanAmount);

    await setBalance(user, cs.Tokens.WETH, wethAmount);

    await cs.Tokens.WETH.connect(user).approve(
      cs.CollateralManager.address,
      wethAmount,
    );

    const loanId = await cs.LoanManager.nextLoanId();

    await cs.LoanManager.connect(user).borrow(
      loanAmount,
      cs.Pools.rUSDC1.address,
      cs.Tokens.WETH.address,
      LTV,
      duration,
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    await cs.Tokens.USDC.approve(cs.LoanManager.address, loanAmount);

    await expect(
      cs.LoanManager.connect(user).repay(0, 0, VERSIONS.LOAN_MANAGER_VERSION),
    ).to.be.revertedWith(Errors.LOAN_MANAGER_ZERO_REPAY);

    await expect(
      cs.LoanManager.connect(user).repay(
        0,
        loanAmount,
        VERSIONS.LOAN_MANAGER_VERSION,
      ),
    ).to.be.revertedWith(Errors.LOAN_MANAGER_LOAN_AMOUNT_ZERO);

    const beforeRepay = initiateSnapshot();
    await makeSnapshot(beforeRepay);

    await mine(ONE_MONTH / 4);

    let now = await currentTimestamp();

    let toPay = loanAmount.add(await cs.LoanManager.getInterest(loanId, now));

    await setBalance(user, cs.Tokens.USDC, getPercent(toPay, 150));

    await cs.Tokens.USDC.connect(user).approve(
      cs.LoanManager.address,
      getPercent(toPay, 150),
    );

    let loan = await cs.LoanManager.loans(loanId);

    const balanceBefore = await cs.Tokens.USDC.balanceOf(user.address);

    const repayTx = await cs.LoanManager.connect(user).repay(
      loanId,
      getPercent(toPay, 110),
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    const balanceAfter = await cs.Tokens.USDC.balanceOf(user.address);

    expect((await cs.LoanManager.loans(loanId)).status).equal(
      STATUS.PAID_EARLY_FULL,
    );

    await expect(Promise.resolve(repayTx))
      .to.emit(cs.LoanManager, "LoanClosed")
      .withArgs(user.address, cs.Pools.rUSDC1.address, loanId);

    const interestPayed = loan.amount
      .mul(loan.apr.div(ONE_YEAR))
      .mul((await txTimestamp(await repayTx)).sub(loan.lastRepay))
      .div(parseEther("100"));

    expect(
      balanceBefore.sub(balanceAfter).sub(loan.amount).sub(interestPayed),
    ).equal(0);

    await expect(Promise.resolve(repayTx))
      .to.emit(cs.LoanManager, "LoanPayed")
      .withArgs(
        user.address,
        user.address,
        cs.Pools.rUSDC1.address,
        loanId,
        interestPayed,
        loanAmount.add(interestPayed),
        0,
      );

    await expect(Promise.resolve(repayTx))
      .to.emit(cs.LoanManager, "LoanClosed")
      .withArgs(user.address, cs.Pools.rUSDC1.address, loanId);

    await backToSnapshot(beforeRepay);

    await mine(ONE_MONTH / 2);

    loan = await cs.LoanManager.loans(loanId);

    now = await currentTimestamp();

    toPay = (await cs.LoanManager.getInterest(loanId, now)).div(2);

    await setBalance(user, cs.Tokens.USDC, toPay);

    await cs.Tokens.USDC.connect(user).approve(cs.LoanManager.address, toPay);

    await cs.LoanManager.connect(user).repay(
      loanId,
      toPay,
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    expect((await cs.LoanManager.loans(loanId)).amount).equal(loan.amount);
  });

  it("Should send part of interest to treasury.", async function () {
    await backToSnapshot(snapshot);

    await cs.LoanManager.grantRole(ROLES.PAUSER, admin.address);

    const APR = 8;
    const score = 3;
    const LTV = parseEther("70");
    const duration = ONE_MONTH;
    const gracePeriod = bn(ONE_DAY * 5);
    const lateFee = parseEther("2");
    const treasuryPercent = parseEther("12");

    const wethAmount = toWei("2");

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

    const nfcs = await mintNFCS(cs, user);
    await updateScore(cs, admin, nfcs, score);

    const loanAmount = await getLoanAmount(
      cs.PriceFeed,
      await cs.Pools.rUSDC1.underlyingToken(),
      cs.Tokens.WETH.address,
      wethAmount,
      LTV,
    );

    await cs.Tokens.USDC.mint(cs.Pools.rUSDC1.address, loanAmount);

    await setBalance(user, cs.Tokens.WETH, wethAmount);

    await cs.Tokens.WETH.connect(user).approve(
      cs.CollateralManager.address,
      wethAmount,
    );

    const loanId = await cs.LoanManager.nextLoanId();

    await cs.LoanManager.connect(user).borrow(
      loanAmount,
      cs.Pools.rUSDC1.address,
      cs.Tokens.WETH.address,
      LTV,
      duration,
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    await cs.Tokens.USDC.approve(cs.LoanManager.address, loanAmount);

    await expect(
      cs.LoanManager.connect(user).repay(0, 0, VERSIONS.LOAN_MANAGER_VERSION),
    ).to.be.revertedWith(Errors.LOAN_MANAGER_ZERO_REPAY);

    await expect(
      cs.LoanManager.connect(user).repay(
        0,
        loanAmount,
        VERSIONS.LOAN_MANAGER_VERSION,
      ),
    ).to.be.revertedWith(Errors.LOAN_MANAGER_LOAN_AMOUNT_ZERO);

    const beforeRepay = initiateSnapshot();
    await makeSnapshot(beforeRepay);

    await mine(ONE_MONTH / 4);

    const now = await currentTimestamp();

    const toPay = loanAmount.add(await cs.LoanManager.getInterest(loanId, now));

    await setBalance(user, cs.Tokens.USDC, getPercent(toPay, 150));

    await cs.Tokens.USDC.connect(user).approve(
      cs.LoanManager.address,
      getPercent(toPay, 150),
    );

    await cs.SettingsProvider.setTreasuryAddress(treasury.address);
    await cs.SettingsProvider.setTreasuryPercent(treasuryPercent);

    const interestAccrued = await cs.LoanManager.getInterest(
      loanId,
      currentTimestamp().then((r) => r + 1),
    );

    await cs.LoanManager.connect(user).repay(
      loanId,
      getPercent(toPay, 110),
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    expect(await cs.Tokens.USDC.balanceOf(treasury.address)).equal(
      interestAccrued.mul(treasuryPercent).div(parseEther("100")),
    );
  });

  it("Anyone can repay the loan", async () => {
    await backToSnapshot(snapshot);

    const APR = 100;
    const score = 3;
    const LTV = toWei("70");
    const duration = ONE_MONTH;
    const gracePeriod = bn(ONE_DAY * 5);
    const lateFee = parseEther("2");

    await configureForBorrow(
      cs,
      [cs.Pools.rUSDC1],
      [cs.Tokens.WETH.address],
      [...pricesToUSD],
      APR,
      score,
      LTV,
      duration,
      gracePeriod,
      lateFee,
    );

    await setBalance(treasury, cs.Tokens.USDC, toWei("0"));
    await cs.SettingsProvider.setTreasuryAddress(treasury.address);
    await cs.SettingsProvider.setTreasuryPercent(toWei("10"));

    const nfcs = await mintNFCS(cs, user);
    await updateScore(cs, admin, nfcs, score);

    await cs.Tokens.USDC.mint(cs.Pools.rUSDC1.address, toWei6("10000"));

    await setBalance(user, cs.Tokens.WETH, toWei("10"));
    await cs.Tokens.WETH.connect(user).approve(
      cs.CollateralManager.address,
      toWei("10"),
    );

    await cs.LoanManager.connect(user).borrow(
      toWei6("100"),
      cs.Pools.rUSDC1.address,
      cs.Tokens.WETH.address,
      LTV,
      duration,
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    await mine(ONE_MONTH);

    await setBalance(user2, cs.Tokens.USDC, toWei6("1000"));
    await cs.Tokens.USDC.connect(user2).approve(
      cs.LoanManager.address,
      toWei("1000"),
    );

    const [loanId] = await cs.LoanManager.getUserLoanIds(user.address);
    await cs.LoanManager.connect(user2).repay(
      loanId,
      toWei6("150"),
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    const loan = await cs.LoanManager.loans(loanId);

    expect(loan.amount).equal(0);
    expect(await cs.Tokens.USDC.balanceOf(treasury.address)).gt(0);
  });
});
