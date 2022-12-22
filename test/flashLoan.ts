import { expect } from "chai";
import { ethers } from "hardhat";
import { Errors } from "../scripts/constants";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  backToSnapshot,
  initiateSnapshot,
  makeSnapshot,
  toWei6,
} from "../scripts/common";
import { TestContracts } from "../scripts/types";
import { deployForTests } from "../scripts/deployTest";
import { poolsParams, tokensParams, VERSIONS } from "../scripts/constants";
import { MockFlashLoan } from "../typechain-types";

describe("MockFlashLoan test", async function () {
  this.timeout(0);

  let admin: SignerWithAddress;

  let MockFlashLoan: MockFlashLoan;
  let cs: TestContracts;

  const depositedAmount = toWei6("100");

  const snapshot = initiateSnapshot();

  before(async () => {
    [, admin] = await ethers.getSigners();

    cs = await deployForTests(tokensParams, poolsParams, admin);

    const MockFlashLoanFactory = await ethers.getContractFactory(
      "MockFlashLoan",
    );
    MockFlashLoan = await MockFlashLoanFactory.deploy(
      cs.Pools.rUSDC1.address,
      cs.Tokens.USDC.address,
    ).then((f) => f.deployed());

    makeSnapshot(snapshot);
  });

  it("Should revert executeOperation from side contract, lockupPeriod is 15", async () => {
    await backToSnapshot(snapshot);

    await cs.Pools.rUSDC1.setLockupPeriod(15);

    expect(await cs.Pools.rUSDC1.lockupPeriod()).to.equal(15);

    await cs.Tokens.USDC.mint(MockFlashLoan.address, toWei6("1000"));
    await MockFlashLoan.approve(cs.Pools.rUSDC1.address, depositedAmount);

    await expect(
      MockFlashLoan.executeOperation(depositedAmount, VERSIONS.POOL_VERSION),
    ).to.be.revertedWith(Errors.POOL_LOCKUP);
  });

  it("Should revert executeOperation from side contract, lockupPeriod is 0", async () => {
    await backToSnapshot(snapshot);

    expect(await cs.Pools.rUSDC1.lockupPeriod()).to.equal(0);

    await cs.Tokens.USDC.mint(MockFlashLoan.address, toWei6("1000"));
    await MockFlashLoan.approve(cs.Pools.rUSDC1.address, depositedAmount);

    await expect(
      MockFlashLoan.executeOperation(depositedAmount, VERSIONS.POOL_VERSION),
    ).to.be.revertedWith(Errors.POOL_LOCKUP);

    await cs.Pools.rUSDC1.setLockupPeriod(0);
    expect(await cs.Pools.rUSDC1.lockupPeriod()).to.equal(0);

    await expect(
      MockFlashLoan.executeOperation(depositedAmount, VERSIONS.POOL_VERSION),
    ).to.be.revertedWith(Errors.POOL_LOCKUP);
  });
});
