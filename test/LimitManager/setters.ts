import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { ROLES, proxyOpts } from "../../scripts/constants";
import { getACErrorText } from "../../scripts/common";
import { LimitManager } from "../../typechain-types";

describe("LimitManager setter's unit test", async () => {
  let LimitManager: LimitManager;
  const maxBorrowLimit = 1000000;
  const scoreBorrowLimit = 1000000;
  const minBorrowLimit = 10;
  const maxLoanNumber = 10;
  const score = 10;
  let admin: SignerWithAddress,
    loanManager: SignerWithAddress,
    user: SignerWithAddress;

  before(async () => {
    [admin, loanManager, user] = await ethers.getSigners();
    const LimitManagerFactory = await ethers.getContractFactory("LimitManager");
    LimitManager = (await upgrades
      .deployProxy(LimitManagerFactory, [admin.address], proxyOpts)
      .then((f) => f.deployed())) as LimitManager;
    await LimitManager.connect(admin).grantRole(
      ROLES.LOAN_MANAGER,
      loanManager.address,
    );
  });

  it("Should NOT setPoolToMaxBorrowLimit because user has no ADMIN role", async () => {
    await expect(
      LimitManager.connect(user).setPoolToMaxBorrowLimit(
        loanManager.address,
        maxBorrowLimit,
      ),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));
  });

  it("Should NOT setPoolToMinBorrowLimit because user has no ADMIN role", async () => {
    await expect(
      LimitManager.connect(user).setPoolToMinBorrowLimit(
        loanManager.address,
        minBorrowLimit,
      ),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));
  });

  it("Should NOT setPoolToScoreBorrowLimit because user has no ADMIN role", async () => {
    await expect(
      LimitManager.connect(user).setPoolToScoreBorrowLimit(
        loanManager.address,
        score,
        scoreBorrowLimit,
      ),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));
  });

  it("Should NOT setPoolToMaxLoanNumber because user has no ADMIN role", async () => {
    await expect(
      LimitManager.connect(user).setPoolToMaxLoanNumber(
        loanManager.address,
        maxLoanNumber,
      ),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));
  });

  it("Should setPoolToMaxBorrowLimit from ADMIN", async () => {
    await LimitManager.connect(admin).setPoolToMaxBorrowLimit(
      loanManager.address,
      maxBorrowLimit,
    );
    expect(
      await LimitManager.poolToMaxBorrowLimit(loanManager.address),
    ).to.equal(maxBorrowLimit);
  });

  it("Should setPoolToMinBorrowLimit from ADMIN", async () => {
    await LimitManager.connect(admin).setPoolToMinBorrowLimit(
      loanManager.address,
      minBorrowLimit,
    );
    expect(
      await LimitManager.poolToMinBorrowLimit(loanManager.address),
    ).to.equal(minBorrowLimit);
  });

  it("Should setPoolToScoreBorrowLimit from ADMIN", async () => {
    await LimitManager.connect(admin).setPoolToScoreBorrowLimit(
      loanManager.address,
      score,
      scoreBorrowLimit,
    );
    expect(
      await LimitManager.poolToScoreToBorrowLimit(loanManager.address, score),
    ).to.equal(scoreBorrowLimit);
  });

  it("Should setPoolToMaxLoanNumber from ADMIN", async () => {
    await LimitManager.connect(admin).setPoolToMaxLoanNumber(
      loanManager.address,
      maxLoanNumber,
    );
    expect(
      await LimitManager.poolToMaxLoanNumber(loanManager.address),
    ).to.equal(maxLoanNumber);
  });
});
