import { expect } from "chai";
import { ethers } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";
import {
  ONE_YEAR,
  poolsParams,
  tokensParams,
  VERSIONS,
} from "../../scripts/constants";
import { deployForTests } from "../../scripts/deployTest";
import { TestContracts } from "../../scripts/types";
import {
  backToSnapshot,
  bn,
  configureForBorrow,
  currentTimestamp,
  getRandomAddress,
  initiateSnapshot,
  makeSnapshot,
  mine,
  mintNFCS,
  setBalance,
  toWei,
  toWei6,
  updateScore,
} from "../../scripts/common";

describe("LoanManager interest unit test", async function () {
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

  it("Correct interest", async () => {
    await backToSnapshot(snapshot);

    const APR = 12;
    const score = 10;
    const LTV = parseEther("60");
    const duration = ONE_YEAR * 2;
    const gracePeriod = bn(0);
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

    await setBalance(user, cs.Tokens.WETH, toWei("2"));

    await cs.Tokens.USDC.mint(cs.Pools.rUSDC1.address, toWei6("1000"));

    await cs.Tokens.WETH.connect(user).approve(
      cs.CollateralManager.address,
      wethAmount,
    );

    await cs.CollateralManager.connect(user).addCollateral(
      user.address,
      cs.Tokens.WETH.address,
      toWei("2"),
    );

    await cs.LoanManager.connect(user).borrow(
      toWei6("1"),
      cs.Pools.rUSDC1.address,
      cs.Tokens.WETH.address,
      LTV,
      duration,
      VERSIONS.LOAN_MANAGER_VERSION,
    );

    const [loanId] = await cs.LoanManager.getUserLoanIds(user.address);

    await mine(ONE_YEAR);

    const interest = await cs.LoanManager.getInterest(
      loanId,
      currentTimestamp(),
    );

    // the difference can be 1 WEI
    expect(toWei6("1").mul(12).div(100).sub(interest)).lte(1);
  });
});
