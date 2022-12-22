import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { proxyOpts, ROLES, VERSIONS } from "../scripts/constants";

import { Errors } from "../scripts/constants";
import {
  getACErrorText,
  getRandomAddress,
  mine,
  setBalance,
  toWei6,
} from "../scripts/common";
import { deployTestToken } from "../scripts/deployLib";
import { MockERC20, Pool } from "../typechain-types";

describe("Pool unit tests", () => {
  let admin: SignerWithAddress,
    admin2: SignerWithAddress,
    pauser: SignerWithAddress,
    updater: SignerWithAddress,
    mockLoanManager: SignerWithAddress,
    userA: SignerWithAddress,
    userB: SignerWithAddress,
    usdc: MockERC20,
    pool: Pool;

  before(async () => {
    [admin, admin2, pauser, updater, mockLoanManager, userA, userB] =
      await ethers.getSigners();

    usdc = await deployTestToken({
      decimals: 6,
      name: "usdc",
      symbol: "usdc",
    });

    const PoolFactory = await ethers.getContractFactory("Pool", admin);

    pool = (await upgrades.deployProxy(
      PoolFactory,
      [usdc.address, "rUSDC1", "Roci Token", admin.address],
      proxyOpts,
    )) as Pool;

    await usdc
      .connect(userA)
      .approve(pool.address, ethers.constants.MaxUint256);

    await usdc
      .connect(userB)
      .approve(pool.address, ethers.constants.MaxUint256);

    await pool.connect(admin).grantRole(ROLES.PAUSER, pauser.address);
    await pool.connect(admin).grantRole(ROLES.UPDATER, updater.address);
  });

  it("Pool.initialize()", async () => {
    expect(await pool.hasRole(ROLES.ADMIN, admin.address)).true;
    expect(await pool.underlyingToken()).equal(usdc.address);
    expect(await pool.decimals()).equal(6);

    const zero = ethers.constants.AddressZero;

    await expect(pool.initialize(zero, zero, zero, zero)).to.be.revertedWith(
      "Initializable: contract is already initialized",
    );
  });

  it("Only admin can grantRole and revokeRole", async () => {
    await expect(
      pool.connect(userA).grantRole(ROLES.PAUSER, userB.address),
    ).to.be.rejectedWith(getACErrorText(userA.address, ROLES.ADMIN));
    expect(await pool.hasRole(ROLES.PAUSER, userA.address)).false;

    await expect(
      pool.connect(userA).grantRole(ROLES.UPDATER, userB.address),
    ).to.be.rejectedWith(getACErrorText(userA.address, ROLES.ADMIN));
    expect(await pool.hasRole(ROLES.UPDATER, userA.address)).false;

    await expect(
      pool.connect(userA).grantRole(ROLES.LOAN_MANAGER, userB.address),
    ).to.be.rejectedWith(getACErrorText(userA.address, ROLES.ADMIN));
    expect(await pool.hasRole(ROLES.LOAN_MANAGER, userA.address)).false;

    await expect(
      pool.connect(userA).grantRole(ROLES.ADMIN, userA.address),
    ).to.be.rejectedWith(getACErrorText(userA.address, ROLES.ADMIN));
    expect(await pool.hasRole(ROLES.ADMIN, userA.address)).false;

    await pool.connect(admin).grantRole(ROLES.PAUSER, pauser.address);
    await pool.connect(admin).grantRole(ROLES.UPDATER, updater.address);
    await pool
      .connect(admin)
      .grantRole(ROLES.LOAN_MANAGER, mockLoanManager.address);
    await pool.connect(admin).grantRole(ROLES.ADMIN, admin2.address);

    expect(await pool.hasRole(ROLES.PAUSER, pauser.address)).true;
    expect(await pool.hasRole(ROLES.UPDATER, updater.address)).true;
    expect(await pool.hasRole(ROLES.LOAN_MANAGER, mockLoanManager.address))
      .true;
    expect(await pool.hasRole(ROLES.ADMIN, admin2.address)).true;

    await expect(
      pool.connect(userA).revokeRole(ROLES.ADMIN, admin2.address),
    ).to.be.rejectedWith(getACErrorText(userA.address, ROLES.ADMIN));
    expect(await pool.hasRole(ROLES.ADMIN, admin2.address)).true;

    await pool.revokeRole(ROLES.ADMIN, admin2.address);
    expect(await pool.hasRole(ROLES.ADMIN, admin2.address)).false;
  });

  it("Only pauser can pause/unpause contract", async () => {
    await expect(pool.connect(admin).pause()).to.be.rejectedWith(
      getACErrorText(admin.address, ROLES.PAUSER),
    );
    expect(await pool.paused()).to.be.false;

    await pool.connect(pauser).pause();
    expect(await pool.paused()).to.be.true;

    await expect(pool.connect(admin).unpause()).to.be.rejectedWith(
      getACErrorText(admin.address, ROLES.PAUSER),
    );
    expect(await pool.paused()).to.be.true;

    await pool.connect(pauser).unpause();
    expect(await pool.paused()).to.be.false;
  });

  it("Only updater can update pool", async () => {
    await pool.connect(pauser).pause();
    await expect(
      upgrades.upgradeProxy(
        pool,
        await ethers.getContractFactory("MockPool", admin),
      ),
    ).to.be.revertedWith(getACErrorText(admin.address, ROLES.UPDATER));

    await upgrades.upgradeProxy(
      pool,
      await ethers.getContractFactory("MockPool", updater),
    );

    expect(await pool.currentVersion()).equal("11.11.11");

    await upgrades.upgradeProxy(
      pool,
      await ethers.getContractFactory("Pool", updater),
    );
    await pool.connect(pauser).unpause();

    expect(await pool.currentVersion()).equal(VERSIONS.POOL_VERSION);
  });

  it("Pool.deposit()", async () => {
    await setBalance(userA, usdc, toWei6("1000"));
    await pool.connect(userA).deposit(toWei6("1000"), VERSIONS.POOL_VERSION);
    expect(await pool.totalSupply()).equal(toWei6("1000"));
    expect(await pool.poolValue()).equal(toWei6("1000"));

    await setBalance(userB, usdc, toWei6("400"));
    await pool.connect(userB).deposit(toWei6("400"), VERSIONS.POOL_VERSION);
    expect(await pool.totalSupply()).equal(toWei6("1400"));
    expect(await pool.poolValue()).equal(toWei6("1400"));
  });

  it("Only loanManager can call updatePoolValue", async () => {
    await expect(
      pool.connect(admin).updatePoolValue(toWei6("100")),
    ).to.be.revertedWith(getACErrorText(admin.address, ROLES.LOAN_MANAGER));
    expect(await pool.poolValue()).equal(toWei6("1400"));

    await pool.connect(mockLoanManager).updatePoolValue(toWei6("300"));
    expect(await pool.poolValue()).equal(toWei6("1700"));

    await setBalance(mockLoanManager, usdc, toWei6("200"));
    await usdc.connect(mockLoanManager).transfer(pool.address, toWei6("200"));
    await pool.connect(mockLoanManager).updatePoolValue(toWei6("-100"));
    expect(await pool.poolValue()).equal(toWei6("1600"));
  });

  it("Pool.withdraw()", async () => {
    const userAReward = await pool.rTokenToStablecoin(toWei6("1000"));
    await pool.connect(userA).withdraw(toWei6("1000"), VERSIONS.POOL_VERSION);
    expect(await usdc.balanceOf(userA.address))
      .gt(toWei6("1000"))
      .equal(userAReward);

    const userBReward = await pool.rTokenToStablecoin(toWei6("400"));

    await pool.connect(userB).withdraw(toWei6("400"), VERSIONS.POOL_VERSION);
    expect(await usdc.balanceOf(userB.address))
      .gt(toWei6("400"))
      .equal(userBReward);

    expect(await pool.poolValue()).equal(0);
    expect(await pool.totalSupply()).equal(0);
  });

  it("Pool.approveLoanManager()", async () => {
    await pool
      .connect(admin)
      .grantRole(ROLES.LOAN_MANAGER, mockLoanManager.address);

    await expect(
      pool
        .connect(userA)
        .approveLoanManager(
          mockLoanManager.address,
          ethers.constants.MaxUint256,
        ),
    ).to.be.revertedWith(getACErrorText(userA.address, ROLES.ADMIN));
    const randomAddress = getRandomAddress();
    await expect(
      pool
        .connect(admin)
        .approveLoanManager(randomAddress, ethers.constants.MaxUint256),
    ).to.be.revertedWith(getACErrorText(randomAddress, ROLES.LOAN_MANAGER));

    await pool
      .connect(admin)
      .approveLoanManager(mockLoanManager.address, ethers.constants.MaxUint256);

    await setBalance(mockLoanManager, usdc, toWei6("200"));
    await usdc.connect(mockLoanManager).transfer(pool.address, toWei6("200"));

    expect(await usdc.balanceOf(mockLoanManager.address)).equal(0);

    await usdc
      .connect(mockLoanManager)
      .transferFrom(pool.address, mockLoanManager.address, toWei6("200"));

    expect(await usdc.balanceOf(mockLoanManager.address)).equal(toWei6("200"));
  });

  it("Set lockup period", async () => {
    expect(await pool.lockupPeriod()).equal(0);

    await expect(pool.connect(userA).setLockupPeriod(10)).revertedWith(
      getACErrorText(userA.address, ROLES.ADMIN),
    );

    await pool.connect(admin).setLockupPeriod(10);
    expect(await pool.lockupPeriod()).equal(10);
    await pool.connect(admin).setLockupPeriod(0);
    expect(await pool.lockupPeriod()).equal(0);
  });

  it("Lock up period", async () => {
    expect(await pool.lockupPeriod()).equal(0);
    await setBalance(userA, usdc, toWei6("1000"));

    // user can deposit and withdraw directly after that if lock up period is zero
    await pool.connect(userA).deposit(toWei6("1000"), VERSIONS.POOL_VERSION);
    await pool.connect(userA).withdraw(toWei6("1000"), VERSIONS.POOL_VERSION);

    await pool.connect(admin).setLockupPeriod(10);
    await pool.connect(userA).deposit(toWei6("1000"), VERSIONS.POOL_VERSION);

    // if lock up period has not passed withdraw will revert
    await expect(
      pool.connect(userA).withdraw(toWei6("1000"), VERSIONS.POOL_VERSION),
    ).revertedWith(Errors.POOL_LOCKUP);

    await mine(10);

    // after 10 seconds withdraw is possible
    await pool.connect(userA).withdraw(toWei6("1000"), VERSIONS.POOL_VERSION);
  });
});
