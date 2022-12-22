import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Errors, proxyOpts, ROLES, VERSIONS } from "../../scripts/constants";
import { getACErrorText, getRandomAddress } from "../../scripts/common";
import { LimitManager } from "../../typechain-types";

async function expectLoanParams(
  LimitManager: LimitManager,
  loanManager: SignerWithAddress,
  borrowedAmount: number,
  iterator: number,
) {
  expect(
    await LimitManager.poolToUserOpenLoans(
      loanManager.address,
      loanManager.address,
    ),
  ).to.equal(iterator);

  expect(await LimitManager.poolToBorrowedAmount(loanManager.address)).to.equal(
    borrowedAmount * iterator,
  );

  expect(
    await LimitManager.poolToUserToBorrowedAmount(
      loanManager.address,
      loanManager.address,
    ),
  ).to.equal(borrowedAmount * iterator);
}

describe("LimitManager loan functions unit test", async () => {
  let LimitManager: LimitManager;
  let iterator = 0;
  const scoreBorrowLimit = 1000000;
  const maxBorrowLimit = 1000000;
  const maxLoanNumber = 4;
  const minBorrowLimit = 10;
  const score = 10;
  const borrowedAmount = 250000;
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

  it("Should NOT call onBorrow because user has no LOAN_MANAGER role", async () => {
    await expect(
      LimitManager.connect(user).onBorrow(
        loanManager.address,
        loanManager.address,
        score,
        borrowedAmount,
      ),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.LOAN_MANAGER));
  });

  it("Should NOT call onBorrow because amount its less than minBorrowLimit", async () => {
    await expect(
      LimitManager.connect(user).onBorrow(
        loanManager.address,
        loanManager.address,
        score,
        borrowedAmount,
      ),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.LOAN_MANAGER));
    await LimitManager.setPoolToMinBorrowLimit(
      loanManager.address,
      minBorrowLimit,
    );
  });

  it("Should call onBorrow without max limits", async () => {
    await LimitManager.connect(loanManager).onBorrow(
      loanManager.address,
      loanManager.address,
      score,
      borrowedAmount,
    );

    iterator++;

    await expectLoanParams(LimitManager, loanManager, borrowedAmount, iterator);
  });

  it("Should call onBorrow with poolToMaxLoanNumber limit", async () => {
    await LimitManager.connect(admin).setPoolToMaxLoanNumber(
      loanManager.address,
      maxLoanNumber,
    );

    expect(
      await LimitManager.poolToMaxLoanNumber(loanManager.address),
    ).to.equal(maxLoanNumber);

    await LimitManager.connect(loanManager).onBorrow(
      loanManager.address,
      loanManager.address,
      score,
      borrowedAmount,
    );

    iterator++;

    await expectLoanParams(LimitManager, loanManager, borrowedAmount, iterator);
  });

  it("Should call onBorrow with poolToMaxBorrowLimit limit", async () => {
    await LimitManager.connect(admin).setPoolToMaxBorrowLimit(
      loanManager.address,
      maxBorrowLimit,
    );

    expect(
      await LimitManager.poolToMaxBorrowLimit(loanManager.address),
    ).to.equal(maxBorrowLimit);

    await LimitManager.connect(loanManager).onBorrow(
      loanManager.address,
      loanManager.address,
      score,
      borrowedAmount,
    );

    iterator++;

    await expectLoanParams(LimitManager, loanManager, borrowedAmount, iterator);
  });

  it("Should call onBorrow with poolToScoreToBorrowLimit limit", async () => {
    await LimitManager.connect(admin).setPoolToScoreBorrowLimit(
      loanManager.address,
      score,
      scoreBorrowLimit,
    );

    expect(
      await LimitManager.poolToMaxBorrowLimit(loanManager.address),
    ).to.equal(maxBorrowLimit);

    await LimitManager.connect(loanManager).onBorrow(
      loanManager.address,
      loanManager.address,
      score,
      borrowedAmount,
    );

    iterator++;

    await expectLoanParams(LimitManager, loanManager, borrowedAmount, iterator);
  });

  it("Should NOT call onRepayOrLiquidate because user has no LOAN_MANAGER role", async () => {
    await expect(
      LimitManager.connect(user).onRepayOrLiquidate(
        loanManager.address,
        getRandomAddress(),
        borrowedAmount,
      ),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.LOAN_MANAGER));
  });

  it("Should NOT call onRepayOrLiquidate because amount more then current", async () => {
    await expect(
      LimitManager.connect(loanManager).onRepayOrLiquidate(
        loanManager.address,
        getRandomAddress(),
        borrowedAmount * iterator + 1,
      ),
    ).to.be.revertedWith(Errors.LIMIT_MANAGER_REPAY_OR_LIQUIDATE);
  });

  it("Should call onRepayOrLiquidate", async () => {
    for (let index = 0; index < 4; index++) {
      await LimitManager.connect(loanManager).onRepayOrLiquidate(
        loanManager.address,
        loanManager.address,
        borrowedAmount,
      );
    }

    expect(
      await LimitManager.poolToBorrowedAmount(loanManager.address),
    ).to.equal(0);

    expect(
      await LimitManager.poolToUserToBorrowedAmount(
        loanManager.address,
        loanManager.address,
      ),
    ).to.equal(0);
  });

  it("Should call onLoanFulfillment", async () => {
    for (let index = 0; index < 4; index++) {
      await LimitManager.connect(loanManager).onLoanFulfillment(
        loanManager.address,
        loanManager.address,
      );
    }

    expect(
      await LimitManager.poolToUserOpenLoans(
        loanManager.address,
        loanManager.address,
      ),
    ).to.equal(0);
  });

  it("Should NOT call onLoanFulfillment because of user doesn't have open loans", async () => {
    await expect(
      LimitManager.connect(loanManager).onLoanFulfillment(
        loanManager.address,
        getRandomAddress(),
      ),
    ).to.be.revertedWith(Errors.LIMIT_MANAGER_OPEN_LOANS);
  });

  it("Should check current version of a contract", async () => {
    const version = await LimitManager.currentVersion();
    expect(version).to.equal(VERSIONS.LIMIT_MANAGER_VERSION);
  });
});
