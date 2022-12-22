import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";
import {
  Errors,
  ONE_DAY,
  ONE_MONTH,
  poolsParams,
  proxyOpts,
  ROLES,
  tokensParams,
  VERSIONS,
} from "../../scripts/constants";
import { deployForTests } from "../../scripts/deployTest";
import { STATUS } from "../../scripts/status";
import { convertToStruct, TestContracts } from "../../scripts/types";
import {
  backToSnapshot,
  bn,
  configureCollateralManager,
  configureForBorrow,
  configureLoanManager,
  deployed,
  getLoanAmount,
  getPausedFuncErrorText,
  getPercent,
  getRandomAddress,
  initiateSnapshot,
  makeSnapshot,
  mintNFCS,
  setBalance,
  toWei,
  toWei6,
  txTimestamp,
  updateScore,
} from "../../scripts/common";
import { LoanManager } from "../../typechain-types";

describe("LoanManager.borrow() unit testing.", async function () {
  this.timeout(0);

  let admin: SignerWithAddress;
  let user: SignerWithAddress;

  let cs: TestContracts;

  let pricesToUSD: {
    asset: string;
    priceToUSD: BigNumber;
    feederAddress: string;
  }[];

  const snapshot = initiateSnapshot();

  before(async () => {
    [, admin, user] = await ethers.getSigners();

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

  it("If paused.", async function () {
    await cs.LoanManager.grantRole(ROLES.PAUSER, admin.address);

    await cs.LoanManager.pause();

    await expect(
      cs.LoanManager.borrow(
        user.address,
        cs.Pools.rUSDC1.address,
        cs.Tokens.WETH.address,
        0,
        0,
        "",
      ),
    ).to.be.revertedWith(Errors.PAUSED);

    await cs.LoanManager.unpause();

    await cs.LoanManager.setFuncPaused("borrow", true);

    await expect(
      cs.LoanManager.borrow(
        user.address,
        cs.Pools.rUSDC1.address,
        cs.Tokens.WETH.address,
        0,
        0,
        "",
      ),
    ).to.be.revertedWith(getPausedFuncErrorText("borrow"));
  });

  it("Wrong version.", async function () {
    await backToSnapshot(snapshot);

    await expect(
      cs.LoanManager.borrow(
        user.address,
        cs.Pools.rUSDC1.address,
        cs.Tokens.WETH.address,
        0,
        0,
        "",
      ),
    ).to.be.revertedWith(Errors.VERSION);
  });

  it("Single loan with different pools/collaterals.", async function () {
    await backToSnapshot(snapshot);

    const APR = 8;
    const score = 3;
    const LTV = toWei("70");
    const duration = ONE_MONTH;
    const gracePeriod = bn(ONE_DAY * 5);
    const lateFee = parseEther("2");

    const poolPairs = [
      { pool: cs.Pools.rUSDC1, asset: cs.Tokens.USDC },
      { pool: cs.Pools.rDAI1, asset: cs.Tokens.DAI },
    ];

    const collaterals = [
      { token: cs.Tokens.WETH, value: toWei("2") },
      { token: cs.Tokens.WBTC, value: toWei("1") },
    ];

    await configureForBorrow(
      cs,
      poolPairs.map((pair) => pair.pool),
      collaterals.map((collateral) => collateral.token.address),
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

    const readyToAddCollateral = initiateSnapshot();
    const readyToBorrow = initiateSnapshot();

    await makeSnapshot(readyToBorrow);
    for (const pair of poolPairs) {
      await backToSnapshot(readyToBorrow);
      for (const collateral of collaterals) {
        await backToSnapshot(readyToBorrow);

        const loanAmount = await getLoanAmount(
          cs.PriceFeed,
          await pair.pool.underlyingToken(),
          collateral.token.address,
          collateral.value,
          LTV,
        );

        const neededCollateralForBorrow = await cs.PriceFeed.convert(
          loanAmount.mul(toWei("100")).div(LTV),
          pair.asset.address,
          collateral.token.address,
        );

        await pair.asset.mint(pair.pool.address, loanAmount);
        await setBalance(user, collateral.token, collateral.value);

        await collateral.token
          .connect(user)
          .approve(
            cs.CollateralManager.address,
            getPercent(collateral.value, 50),
          );

        await makeSnapshot(readyToAddCollateral);

        await cs.CollateralManager.connect(user).addCollateral(
          user.address,
          collateral.token.address,
          getPercent(collateral.value, 50),
        );

        await expect(
          cs.LoanManager.connect(user).borrow(
            loanAmount,
            pair.pool.address,
            collateral.token.address,
            LTV,
            duration,
            VERSIONS.LOAN_MANAGER_VERSION,
          ),
        ).to.be.revertedWith("ERC20: insufficient allowance");

        const nextLoanId = await cs.LoanManager.nextLoanId();

        await collateral.token
          .connect(user)
          .approve(cs.CollateralManager.address, collateral.value);

        const settings = await cs.SettingsProvider.getLoanSettings(
          cs.Pools.rUSDC1.address,
          score,
          LTV,
          duration,
          cs.Tokens.WETH.address,
        );

        const borrowWOCollateral = await cs.LoanManager.connect(user).borrow(
          loanAmount,
          pair.pool.address,
          collateral.token.address,
          LTV,
          duration,
          VERSIONS.LOAN_MANAGER_VERSION,
        );

        expect(await pair.asset.balanceOf(user.address)).equal(loanAmount);

        await expect(Promise.resolve(borrowWOCollateral))
          .to.emit(cs.LoanManager, "LoanCreated")
          .withArgs(
            user.address,
            pair.pool.address,
            nextLoanId,
            settings.interest,
            loanAmount,
          );

        expect(
          await cs.CollateralManager.collateralToFreezerToUserToAmount(
            collateral.token.address,
            cs.LoanManager.address,
            user.address,
          ),
        ).equal(neededCollateralForBorrow);

        let loan = await cs.LoanManager.loans(nextLoanId);
        const issueDate = await txTimestamp(await borrowWOCollateral);

        expect(convertToStruct(loan)).eql({
          borrower: user.address,
          amount: loanAmount,
          apr: toWei(APR.toString()),
          ltv: LTV,
          lateFee: lateFee,
          issueDate: issueDate,
          dueDate: issueDate.add(duration),
          liquidationDate: issueDate.add(duration).add(gracePeriod),
          lastRepay: issueDate,
          frozenCollateralAmount: neededCollateralForBorrow,
          frozenCollateralToken: collateral.token.address,
          pool: pair.pool.address,
          status: STATUS.NEW,
        });

        await backToSnapshot(readyToAddCollateral);

        await collateral.token
          .connect(user)
          .approve(cs.CollateralManager.address, collateral.value);

        const borrowWCollateral = cs.LoanManager.connect(user).borrow(
          loanAmount,
          pair.pool.address,
          collateral.token.address,
          LTV,
          duration,
          VERSIONS.LOAN_MANAGER_VERSION,
        );

        const borrowTimestamp = await txTimestamp(await borrowWCollateral);
        loan = await cs.LoanManager.loans(nextLoanId);

        expect(convertToStruct(loan)).eql({
          borrower: user.address,
          amount: loanAmount,
          apr: toWei(APR.toString()),
          ltv: LTV,
          lateFee: lateFee,
          issueDate: borrowTimestamp,
          dueDate: borrowTimestamp.add(duration),
          liquidationDate: borrowTimestamp.add(duration).add(gracePeriod),
          lastRepay: borrowTimestamp,
          frozenCollateralAmount: neededCollateralForBorrow,
          frozenCollateralToken: collateral.token.address,
          pool: pair.pool.address,
          status: STATUS.NEW,
        });

        expect(await pair.asset.balanceOf(user.address)).equal(loanAmount);
      }
    }
  });

  it("Single loan with native token.", async function () {
    await backToSnapshot(snapshot);

    const APR = 8;
    const score = 3;
    const LTV = toWei("70");
    const duration = ONE_MONTH;
    const gracePeriod = bn(ONE_DAY * 5);
    const lateFee = parseEther("2");

    const poolPairs = [
      { pool: cs.Pools.rUSDC1, asset: cs.Tokens.USDC },
      { pool: cs.Pools.rDAI1, asset: cs.Tokens.DAI },
    ];

    const WMATIC = await (
      await ethers.getContractFactory("WMATIC", admin)
    ).deploy();

    const wmaticPrice = {
      asset: WMATIC.address,
      priceToUSD: bn(85333880),
      feederAddress: getRandomAddress(),
    };

    const MATIC_VALUE = toWei("1");

    const collaterals = [{ token: WMATIC, value: toWei("1") }];

    await configureForBorrow(
      cs,
      poolPairs.map((pair) => pair.pool),
      collaterals.map((collateral) => collateral.token.address),
      [...pricesToUSD, wmaticPrice],
      APR,
      score,
      LTV,
      duration,
      gracePeriod,
      lateFee,
    );

    await cs.CollateralManager.setNativeWrapper(WMATIC.address);

    const nfcs = await mintNFCS(cs, user);
    await updateScore(cs, admin, nfcs, score);

    const readyToBorrow = initiateSnapshot();

    await makeSnapshot(readyToBorrow);
    for (const pair of poolPairs) {
      await backToSnapshot(readyToBorrow);

      const loanAmount = await getLoanAmount(
        cs.PriceFeed,
        await pair.pool.underlyingToken(),
        WMATIC.address,
        MATIC_VALUE,
        LTV,
      );

      await pair.asset.mint(pair.pool.address, loanAmount);

      const nextLoanId = await cs.LoanManager.nextLoanId();

      const borrowWCollateral = cs.LoanManager.connect(user).borrow(
        loanAmount,
        pair.pool.address,
        WMATIC.address,
        LTV,
        duration,
        VERSIONS.LOAN_MANAGER_VERSION,
        { value: MATIC_VALUE },
      );

      expect(
        await cs.CollateralManager.collateralToUserToAmount(
          WMATIC.address,
          user.address,
        ),
      ).equal(0);

      const borrowTimestamp = await txTimestamp(await borrowWCollateral);
      const loan = await cs.LoanManager.loans(nextLoanId);

      const neededCollateralForBorrow = await cs.PriceFeed.convert(
        loanAmount.mul(toWei("100")).div(LTV),
        pair.asset.address,
        WMATIC.address,
      );

      expect(convertToStruct(loan)).eql({
        borrower: user.address,
        amount: loanAmount,
        apr: toWei(APR.toString()),
        ltv: LTV,
        lateFee: lateFee,
        issueDate: borrowTimestamp,
        dueDate: borrowTimestamp.add(duration),
        liquidationDate: borrowTimestamp.add(duration).add(gracePeriod),
        lastRepay: borrowTimestamp,
        frozenCollateralAmount: neededCollateralForBorrow,
        frozenCollateralToken: WMATIC.address,
        pool: pair.pool.address,
        status: STATUS.NEW,
      });

      expect(await pair.asset.balanceOf(user.address)).equal(loanAmount);
    }
  });

  it("Multiple loans.", async () => {
    await backToSnapshot(snapshot);

    const APR = 8;
    const score = 3;
    const LTV = parseEther("70");
    const duration = ONE_MONTH;
    const gracePeriod = bn(ONE_DAY * 5);
    const lateFee = parseEther("2");
    const loansNum = 5;

    const borrowFrom = [
      { pool: cs.Pools.rUSDC1, asset: cs.Tokens.USDC, amount: bn(0) },
      { pool: cs.Pools.rDAI1, asset: cs.Tokens.DAI, amount: bn(0) },
    ];

    const wethAmount = toWei("2");

    await configureForBorrow(
      cs,
      borrowFrom.map((info) => info.pool),
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

    const loanAmountRUSDC = await getLoanAmount(
      cs.PriceFeed,
      await cs.Pools.rUSDC1.underlyingToken(),
      cs.Tokens.WETH.address,
      wethAmount,
      LTV,
    );

    const loanAmountRDAI = await getLoanAmount(
      cs.PriceFeed,
      await cs.Pools.rDAI1.underlyingToken(),
      cs.Tokens.WETH.address,
      wethAmount,
      LTV,
    );

    borrowFrom[0].amount = loanAmountRUSDC;
    borrowFrom[1].amount = loanAmountRDAI;

    await setBalance(
      user,
      cs.Tokens.WETH,
      wethAmount.mul(loansNum).mul(borrowFrom.length),
    );

    await cs.Tokens.USDC.mint(
      cs.Pools.rUSDC1.address,
      loanAmountRUSDC.mul(loansNum),
    );
    await cs.Tokens.DAI.mint(
      cs.Pools.rDAI1.address,
      loanAmountRDAI.mul(loansNum),
    );

    for (const info of borrowFrom) {
      for (let i = 1; i <= loansNum; i++) {
        await cs.Tokens.WETH.connect(user).approve(
          cs.CollateralManager.address,
          wethAmount,
        );

        await cs.LoanManager.connect(user).borrow(
          info.amount,
          info.pool.address,
          cs.Tokens.WETH.address,
          LTV,
          duration,
          VERSIONS.LOAN_MANAGER_VERSION,
        );

        expect(await info.asset.balanceOf(user.address)).equal(
          info.amount.mul(i),
        );
      }
    }
  });

  it("Add native collateral and then borrow", async function () {
    await backToSnapshot(snapshot);

    const APR = 8;
    const score = 3;
    const LTV = toWei("70");
    const duration = ONE_MONTH;
    const gracePeriod = bn(ONE_DAY * 5);
    const lateFee = parseEther("2");

    const WMATIC = await (
      await ethers.getContractFactory("WMATIC", admin)
    ).deploy();

    const wmaticPrice = {
      asset: WMATIC.address,
      priceToUSD: bn(85333880),
      feederAddress: getRandomAddress(),
    };

    const MATIC_VALUE = toWei("1");

    await configureForBorrow(
      cs,
      [cs.Pools.rUSDC1],
      [WMATIC.address],
      [...pricesToUSD, wmaticPrice],
      APR,
      score,
      LTV,
      duration,
      gracePeriod,
      lateFee,
    );

    await cs.CollateralManager.setNativeWrapper(WMATIC.address);

    await cs.CollateralManager.connect(user).addCollateral(
      user.address,
      WMATIC.address,
      0,
      {
        value: toWei("100"),
      },
    );

    const nfcs = await mintNFCS(cs, user);
    await updateScore(cs, admin, nfcs, score);

    const loanAmount = await getLoanAmount(
      cs.PriceFeed,
      await cs.Pools.rUSDC1.underlyingToken(),
      WMATIC.address,
      MATIC_VALUE,
      LTV,
    );

    await cs.Tokens.USDC.mint(cs.Pools.rUSDC1.address, loanAmount);

    await cs.LoanManager.connect(user).borrow(
      loanAmount,
      cs.Pools.rUSDC1.address,
      WMATIC.address,
      LTV,
      duration,
      VERSIONS.LOAN_MANAGER_VERSION,
      { value: MATIC_VALUE },
    );

    expect(await cs.Tokens.USDC.balanceOf(user.address)).equal(loanAmount);
  });

  it("LoanManager native token holding prevention", async function () {
    await backToSnapshot(snapshot);

    const APR = 8;
    const score = 3;
    const LTV = toWei("70");
    const duration = ONE_MONTH;
    const gracePeriod = bn(ONE_DAY * 5);
    const lateFee = parseEther("2");

    const WMATIC = await (
      await ethers.getContractFactory("WMATIC", admin)
    ).deploy();

    const wmaticPrice = {
      asset: WMATIC.address,
      priceToUSD: bn(85333880),
      feederAddress: getRandomAddress(),
    };

    const MATIC_VALUE = toWei("1");

    await configureForBorrow(
      cs,
      [cs.Pools.rUSDC1],
      [WMATIC.address],
      [...pricesToUSD, wmaticPrice],
      APR,
      score,
      LTV,
      duration,
      gracePeriod,
      lateFee,
    );

    await cs.CollateralManager.setNativeWrapper(WMATIC.address);

    const nfcs = await mintNFCS(cs, user);
    await updateScore(cs, admin, nfcs, score);

    const loanAmount = await getLoanAmount(
      cs.PriceFeed,
      await cs.Pools.rUSDC1.underlyingToken(),
      WMATIC.address,
      MATIC_VALUE,
      LTV,
    );

    await cs.Tokens.USDC.mint(cs.Pools.rUSDC1.address, loanAmount);

    const extraMatic = toWei("0.5");

    const nativeBefore = await ethers.provider.getBalance(user.address);

    const expectedCollateralCalculated = await cs.PriceFeed.convert(
      loanAmount.mul(toWei("100")).div(LTV),
      cs.Tokens.USDC.address,
      WMATIC.address,
    );

    const borrowTx = await (
      await cs.LoanManager.connect(user).borrow(
        loanAmount,
        cs.Pools.rUSDC1.address,
        WMATIC.address,
        LTV,
        duration,
        VERSIONS.LOAN_MANAGER_VERSION,
        { value: MATIC_VALUE.add(extraMatic) },
      )
    ).wait();

    const nativeAfter = await ethers.provider.getBalance(user.address);

    const burned = borrowTx.gasUsed.mul(borrowTx.effectiveGasPrice);

    expect(nativeBefore.sub(nativeAfter)).equal(
      expectedCollateralCalculated.add(burned),
    );

    expect(await ethers.provider.getBalance(cs.LoanManager.address)).equal(0);

    expect(await cs.Tokens.USDC.balanceOf(user.address)).equal(loanAmount);
  });

  it("Works with two LoanManager contracts in protocol", async () => {
    await backToSnapshot(snapshot);

    const APR = 8;
    const score = 3;
    const LTV = toWei("70");
    const duration = ONE_MONTH;
    const gracePeriod = bn(ONE_DAY * 5);
    const lateFee = parseEther("2");

    const LoanManager1 = cs.LoanManager;

    await configureForBorrow(
      cs,
      [cs.Pools.rUSDC1],
      [cs.Tokens.WBTC.address, cs.Tokens.WETH.address],
      [...pricesToUSD],
      APR,
      score,
      LTV,
      duration,
      gracePeriod,
      lateFee,
    );

    const nfcs = await mintNFCS(cs, user);
    await updateScore(cs, admin, nfcs, score);
    await cs.Tokens.USDC.mint(cs.Pools.rUSDC1.address, toWei6("10000000"));

    const loanManagerFactory = await ethers.getContractFactory("LoanManager");
    const LoanManager2 = (
      await upgrades
        .deployProxy(loanManagerFactory, [admin.address], proxyOpts)
        .then(deployed)
    ).connect(admin) as LoanManager;

    await configureCollateralManager(
      cs.CollateralManager,
      LoanManager2.address,
      [],
    );
    cs.LoanManager = LoanManager2;
    await configureLoanManager(cs);
    await cs.LimitManager.grantRole(ROLES.LOAN_MANAGER, LoanManager2.address);
    await cs.Pools.rUSDC1.grantRole(ROLES.LOAN_MANAGER, LoanManager2.address);

    await cs.Pools.rUSDC1.approveLoanManager(
      LoanManager2.address,
      ethers.constants.MaxUint256,
    );
    await cs.Pools.rUSDC1.grantRole(ROLES.LOAN_MANAGER, LoanManager2.address);

    await setBalance(user, cs.Tokens.WETH, toWei("20"));

    await cs.Tokens.WETH.connect(user).approve(
      cs.CollateralManager.address,
      toWei("20"),
    );

    await cs.CollateralManager.connect(user).addCollateral(
      user.address,
      cs.Tokens.WETH.address,
      toWei("20"),
    );

    await LoanManager1.connect(user).borrow(
      toWei6("100"),
      cs.Pools.rUSDC1.address,
      cs.Tokens.WETH.address,
      LTV,
      duration,
      VERSIONS.LOAN_MANAGER_VERSION,
    );
    await LoanManager2.connect(user).borrow(
      toWei6("200"),
      cs.Pools.rUSDC1.address,
      cs.Tokens.WETH.address,
      LTV,
      duration,
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    expect(await LoanManager1.loans(1).then((r) => r.amount)).equal(
      toWei6("100"),
    );
    expect(await LoanManager1.loans(1).then((r) => r.borrower)).equal(
      user.address,
    );
    expect(await LoanManager2.loans(1).then((r) => r.amount)).equal(
      toWei6("200"),
    );
    expect(await LoanManager2.loans(1).then((r) => r.borrower)).equal(
      user.address,
    );

    expect(
      await cs.LimitManager.poolToUserToBorrowedAmount(
        cs.Pools.rUSDC1.address,
        user.address,
      ),
    ).equal(toWei6("300"));
  });
});
