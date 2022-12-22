import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { parseEther } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";
import { Errors, proxyOpts, ROLES } from "../scripts/constants";
import {
  backToSnapshot,
  getACErrorText,
  getPausedFuncErrorText,
  initiateSnapshot,
  makeSnapshot,
  setBalance,
  toWei,
} from "../scripts/common";
import { deployTestToken } from "../scripts/deployLib";
import { CollateralManager, MockERC20, WMATIC } from "../typechain-types";

describe("CollateralManager unit tests", () => {
  let CollateralManager: CollateralManager,
    owner: SignerWithAddress,
    admin: SignerWithAddress,
    freezer: SignerWithAddress,
    pauser: SignerWithAddress,
    user: SignerWithAddress,
    user2: SignerWithAddress,
    WETH: MockERC20,
    WBTC: MockERC20,
    wmaticContract: WMATIC;

  const snapshot = initiateSnapshot();

  before(async () => {
    [owner, admin, freezer, pauser, user, user2] = await ethers.getSigners();
    const CollateralManagerFactory = await ethers.getContractFactory(
      "CollateralManager",
    );
    CollateralManager = (await upgrades
      .deployProxy(CollateralManagerFactory, [admin.address], proxyOpts)
      .then((f) => f.deployed())) as CollateralManager;

    WETH = await deployTestToken({
      name: "WETH",
      symbol: "WETH",
      decimals: 18,
    });

    WBTC = await deployTestToken({
      name: "WBTC",
      symbol: "WBTC",
      decimals: 18,
    });

    const wmaticFactory = await ethers.getContractFactory("WMATIC");
    wmaticContract = await wmaticFactory.deploy();

    await CollateralManager.connect(admin).addCollaterals([
      WETH.address,
      WBTC.address,
      wmaticContract.address,
    ]);

    await WETH.connect(user).approve(
      CollateralManager.address,
      ethers.constants.MaxUint256,
    );

    await WETH.connect(user2).approve(
      CollateralManager.address,
      ethers.constants.MaxUint256,
    );

    await WBTC.connect(user).approve(
      CollateralManager.address,
      ethers.constants.MaxUint256,
    );

    await WBTC.connect(user2).approve(
      CollateralManager.address,
      ethers.constants.MaxUint256,
    );

    await CollateralManager.connect(admin).grantRole(
      ROLES.LOAN_MANAGER,
      freezer.address,
    );

    await CollateralManager.connect(admin).grantRole(
      ROLES.PAUSER,
      pauser.address,
    );

    makeSnapshot(snapshot);
  });

  it("freeze function", async () => {
    await backToSnapshot(snapshot);

    // 1. Amount must be positive
    await expect(
      CollateralManager.connect(freezer).freeze(
        user.address,
        WETH.address,
        toWei("0"),
      ),
    ).to.be.revertedWith(Errors.ZERO_VALUE);

    // 2. User must have enough collateral
    await expect(
      CollateralManager.connect(freezer).freeze(
        user.address,
        WETH.address,
        toWei("0.5"),
      ),
    ).to.be.revertedWith(Errors.COLLATERAL_MANAGER_INSUFFICIENT_AMOUNT);

    // 3. Only freezer can call freeze
    // 3.1. User adds collateral
    await setBalance(user, WETH, toWei("1"));
    await CollateralManager.connect(user).addCollateral(
      user.address,
      WETH.address,
      toWei("0.5"),
    );

    // 3.2. Someone else is trying to freeze it
    await expect(
      CollateralManager.connect(user2).freeze(
        user.address,
        WETH.address,
        toWei("0.5"),
      ),
    ).to.be.revertedWith(getACErrorText(user2.address, ROLES.LOAN_MANAGER));

    // 3.3 Freezing of not allowed collateral
    await setBalance(user, WBTC, toWei("0.5"));

    await CollateralManager.connect(user).addCollateral(
      user.address,
      WBTC.address,
      toWei("0.5"),
    );

    await CollateralManager.connect(admin).removeCollaterals([WBTC.address]);

    await expect(
      CollateralManager.connect(freezer).freeze(
        user.address,
        WBTC.address,
        toWei("0.5"),
      ),
    ).to.be.revertedWith(Errors.COLLATERAL_MANAGER_TOKEN_NOT_SUPPORTED);

    // 4. Freezer freezes user's collateral
    await CollateralManager.connect(freezer).freeze(
      user.address,
      WETH.address,
      toWei("0.3"),
    );

    expect(
      await CollateralManager.collateralToUserToAmount(
        WETH.address,
        user.address,
      ),
    ).to.equal(toWei("0.2"));
    expect(
      await CollateralManager.collateralToFreezerToUserToAmount(
        WETH.address,
        freezer.address,
        user.address,
      ),
    ).to.equal(toWei("0.3"));
  });

  it("unfreeze function", async () => {
    await backToSnapshot(snapshot);

    // 1. Amount must be positive
    await expect(
      CollateralManager.connect(freezer).unfreeze(
        user.address,
        WETH.address,
        toWei("0"),
      ),
    ).to.be.revertedWith(Errors.ZERO_VALUE);

    // 2. Only freezer can call unfreeze
    // 2.1. User adds collateral
    await setBalance(user, WETH, toWei("1"));
    await CollateralManager.connect(user).addCollateral(
      user.address,
      WETH.address,
      toWei("0.5"),
    );

    // 2.2. Freezer freezes user's collateral
    await CollateralManager.connect(freezer).freeze(
      user.address,
      WETH.address,
      toWei("0.3"),
    );

    // 2.3. Someone else is trying to unfreeze it
    await expect(
      CollateralManager.connect(user2).unfreeze(
        user.address,
        WETH.address,
        toWei("0.3"),
      ),
    ).to.be.revertedWith(getACErrorText(user2.address, ROLES.LOAN_MANAGER));

    // 3. Amount to unfreeze shouldn't exceed frozen amount
    await expect(
      CollateralManager.connect(freezer).unfreeze(
        user.address,
        WETH.address,
        toWei("1"),
      ),
    ).to.be.revertedWith(Errors.COLLATERAL_MANAGER_FROZEN_INSUFFICIENT_AMOUNT);

    // 4. Freezer unfreezes user's collateral
    await CollateralManager.connect(freezer).unfreeze(
      user.address,
      WETH.address,
      toWei("0.2"),
    );

    expect(
      await CollateralManager.collateralToUserToAmount(
        WETH.address,
        user.address,
      ),
    ).to.equal(toWei("0.4"));
    expect(
      await CollateralManager.collateralToFreezerToUserToAmount(
        WETH.address,
        freezer.address,
        user.address,
      ),
    ).to.equal(toWei("0.1"));
  });

  it("add function", async () => {
    await backToSnapshot(snapshot);
    // 1. Amount must be positive
    await expect(
      CollateralManager.connect(user).addCollateral(
        user.address,
        WETH.address,
        toWei("0"),
      ),
    ).to.be.revertedWith(Errors.ZERO_VALUE);

    // 2. Caller should be a freezer or user that adds collateral to himself
    await setBalance(user, WETH, toWei("1"));

    // 2.1. Freezer is adding user's collateral
    await CollateralManager.connect(freezer).addCollateral(
      user.address,
      WETH.address,
      toWei("0.5"),
    );
    expect(
      await CollateralManager.collateralToUserToAmount(
        WETH.address,
        user.address,
      ),
    ).to.equal(toWei("0.5"));

    // 2.2. User is trying to add collateral of other user
    await setBalance(user2, WETH, toWei("1"));

    await expect(
      CollateralManager.connect(user).addCollateral(
        user2.address,
        WETH.address,
        toWei("0.5"),
      ),
    ).to.be.revertedWith(Errors.COLLATERAL_MANAGER_FREEZER_OR_USER);

    // 3. ifNotPaused modifier check

    // 3.1. Pause the whole contract
    await CollateralManager.connect(pauser).pause();

    await expect(
      CollateralManager.connect(user).addCollateral(
        user.address,
        WETH.address,
        toWei("0.5"),
      ),
    ).to.be.revertedWith(Errors.PAUSED);

    await CollateralManager.connect(pauser).unpause();

    // 3.2. Pause 'add' function
    await CollateralManager.connect(pauser).setFuncPaused("add", true);

    await expect(
      CollateralManager.connect(user).addCollateral(
        user.address,
        WETH.address,
        toWei("0.5"),
      ),
    ).to.be.revertedWith(getPausedFuncErrorText("add"));

    await CollateralManager.connect(pauser).setFuncPaused("add", false);

    // 4. Collateral asset should be allowed to use
    await setBalance(user, WETH, toWei("1"));

    await CollateralManager.connect(admin).removeCollaterals([WETH.address]);
    await expect(
      CollateralManager.connect(user).addCollateral(
        user.address,
        WETH.address,
        toWei("0.5"),
      ),
    ).to.be.revertedWith(Errors.COLLATERAL_MANAGER_TOKEN_NOT_SUPPORTED);
    await CollateralManager.connect(admin).addCollaterals([WETH.address]);

    // 4. User is trying to add his collateral
    await CollateralManager.connect(user).addCollateral(
      user.address,
      WETH.address,
      toWei("0.5"),
    );
    expect(
      await CollateralManager.collateralToUserToAmount(
        WETH.address,
        user.address,
      ),
    ).to.equal(toWei("1"));
    expect(await WETH.balanceOf(user.address)).to.equal(toWei("0.5"));
  });

  it("claim function", async () => {
    await backToSnapshot(snapshot);
    // 1. Amount must be positive
    await expect(
      CollateralManager.connect(user).claimCollateral(
        user.address,
        WETH.address,
        toWei("0"),
      ),
    ).to.be.revertedWith(Errors.ZERO_VALUE);

    // 2. Caller should be a freezer or user that claims collateral of himself

    // 2.1. User is adding collateral
    await setBalance(user, WETH, toWei("1"));
    await CollateralManager.connect(user).addCollateral(
      user.address,
      WETH.address,
      toWei("0.5"),
    );

    // 2.1. Freezer is claiming user's collateral
    await CollateralManager.connect(freezer).claimCollateral(
      user.address,
      WETH.address,
      toWei("0.5"),
    );
    expect(
      await CollateralManager.collateralToUserToAmount(
        WETH.address,
        user.address,
      ),
    ).to.equal(toWei("0"));

    // 2.2. User is trying to claim collateral of other user
    await setBalance(user2, WETH, toWei("1"));

    await expect(
      CollateralManager.connect(user).claimCollateral(
        user2.address,
        WETH.address,
        toWei("0.5"),
      ),
    ).to.be.revertedWith(Errors.COLLATERAL_MANAGER_FREEZER_OR_USER);

    // 3. ifNotPaused modifier check

    // 3.1. User is adding collateral
    await setBalance(user, WETH, toWei("1"));
    await CollateralManager.connect(user).addCollateral(
      user.address,
      WETH.address,
      toWei("0.5"),
    );

    // 3.2. Pause the whole contract
    await CollateralManager.connect(pauser).pause();

    await expect(
      CollateralManager.connect(user).claimCollateral(
        user.address,
        WETH.address,
        toWei("0.5"),
      ),
    ).to.be.revertedWith(Errors.PAUSED);

    await CollateralManager.connect(pauser).unpause();

    // 3.3. Pause 'claim' function
    await CollateralManager.connect(pauser).setFuncPaused("claim", true);

    await expect(
      CollateralManager.connect(user).claimCollateral(
        user.address,
        WETH.address,
        toWei("0.5"),
      ),
    ).to.be.revertedWith(getPausedFuncErrorText("claim"));

    await CollateralManager.connect(pauser).setFuncPaused("claim", false);

    // 4. User is trying to claim his collateral
    await CollateralManager.connect(user).claimCollateral(
      user.address,
      WETH.address,
      toWei("0.5"),
    );
    expect(
      await CollateralManager.collateralToUserToAmount(
        WETH.address,
        user.address,
      ),
    ).to.equal(toWei("0"));
    expect(await WETH.balanceOf(user.address)).to.equal(toWei("1"));
  });

  it("seize function", async () => {
    await backToSnapshot(snapshot);
    // 1. Amount must be positive
    await expect(
      CollateralManager.connect(user).seize(
        owner.address,
        WETH.address,
        user.address,
        toWei("0"),
      ),
    ).to.be.revertedWith(Errors.ZERO_VALUE);

    // 2. Users without loan_manager role can't seize the collateral
    await expect(
      CollateralManager.connect(user).seize(
        owner.address,
        WETH.address,
        user2.address,
        toWei("0.5"),
      ),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.LOAN_MANAGER));

    // 3. Amount to seize shouldn't exceed frozen amount
    await expect(
      CollateralManager.connect(freezer).seize(
        owner.address,
        WETH.address,
        user.address,
        toWei("1"),
      ),
    ).to.be.revertedWith(Errors.COLLATERAL_MANAGER_FROZEN_INSUFFICIENT_AMOUNT);

    // 4. Freezer seizes user's collateral

    // 4.1. User adds collateral
    await setBalance(user, WETH, toWei("1"));
    await CollateralManager.connect(user).addCollateral(
      user.address,
      WETH.address,
      toWei("0.5"),
    );

    // 4.2. Freezer freezes it
    await CollateralManager.connect(freezer).freeze(
      user.address,
      WETH.address,
      toWei("0.4"),
    );

    // 4.3. Freezer seizes the collateral in favor of owner
    await CollateralManager.connect(freezer).seize(
      owner.address,
      WETH.address,
      user.address,
      toWei("0.3"),
    );
    expect(await WETH.balanceOf(owner.address)).to.equal(toWei("0.3"));
    expect(
      await CollateralManager.collateralToFreezerToUserToAmount(
        WETH.address,
        freezer.address,
        user.address,
      ),
    ).to.equal(toWei("0.1"));
    expect(
      await CollateralManager.collateralToUserToAmount(
        WETH.address,
        user.address,
      ),
    ).to.equal(toWei("0.1"));
  });

  it("pause function", async () => {
    await backToSnapshot(snapshot);

    // 1. Only user with pauser role can pause the contract
    await expect(CollateralManager.connect(user).pause()).to.be.revertedWith(
      getACErrorText(user.address, ROLES.PAUSER),
    );

    // 2. Pause the contract
    await CollateralManager.connect(pauser).pause();

    expect(await CollateralManager.paused()).to.equal(true);
  });

  it("unpause function", async () => {
    await backToSnapshot(snapshot);

    // 1. Pause the contract
    await CollateralManager.connect(pauser).pause();

    // 2. Only user with pauser role can unpause the contract
    await expect(CollateralManager.connect(user).unpause()).to.be.revertedWith(
      getACErrorText(user.address, ROLES.PAUSER),
    );

    // 3. Unpause the contract
    await CollateralManager.connect(pauser).unpause();

    expect(await CollateralManager.paused()).to.equal(false);
  });

  it("setFuncPaused function", async () => {
    await backToSnapshot(snapshot);

    const functionName = "add";

    // 1. Only user with pauser role can pause the function
    await expect(
      CollateralManager.connect(user).setFuncPaused(functionName, true),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.PAUSER));

    // 2. Pause the function
    await CollateralManager.connect(pauser).setFuncPaused(functionName, true);

    // Try to use it
    await setBalance(user, WETH, toWei("1"));
    await expect(
      CollateralManager.connect(user).addCollateral(
        user.address,
        WETH.address,
        toWei("0.5"),
      ),
    ).to.be.revertedWith(getPausedFuncErrorText(functionName));
  });

  it("Add native token.", async () => {
    await backToSnapshot(snapshot);

    const maticAmount = parseEther("777");

    await expect(
      CollateralManager.connect(user).addCollateral(
        user.address,
        wmaticContract.address,
        0,
        { value: maticAmount },
      ),
    ).to.be.revertedWith(Errors.COLLATERAL_MANAGER_WRAPPER_ZERO);

    await CollateralManager.connect(admin).setNativeWrapper(
      wmaticContract.address,
    );

    const userBalance = await ethers.provider.getBalance(user.address);

    const wmaticBalance = await ethers.provider.getBalance(
      CollateralManager.address,
    );

    const addTx = await CollateralManager.connect(user).addCollateral(
      user.address,
      wmaticContract.address,
      0,
      { value: maticAmount },
    );

    const receipt = await addTx.wait();

    const gasConsumption = receipt.cumulativeGasUsed.mul(
      receipt.effectiveGasPrice,
    );

    expect(
      userBalance
        .sub(await ethers.provider.getBalance(user.address))
        .sub(gasConsumption),
    ).equal(maticAmount);

    expect(
      (await ethers.provider.getBalance(wmaticContract.address)).sub(
        wmaticBalance,
      ),
    ).equal(maticAmount);

    expect(await wmaticContract.balanceOf(CollateralManager.address)).equal(
      maticAmount,
    );

    expect(
      await CollateralManager.collateralToUserToAmount(
        wmaticContract.address,
        user.address,
      ),
    ).equal(maticAmount);
  });

  it("Claim native token.", async () => {
    await backToSnapshot(snapshot);

    const maticAmount = parseEther("777");

    await CollateralManager.connect(admin).setNativeWrapper(
      wmaticContract.address,
    );

    await CollateralManager.connect(user).addCollateral(
      user.address,
      wmaticContract.address,
      0,
      { value: maticAmount },
    );

    const balanceBeforeClaim = await ethers.provider.getBalance(user.address);

    const claimTx = await CollateralManager.connect(user).claimCollateral(
      user.address,
      wmaticContract.address,
      maticAmount,
    );

    const receipt = await claimTx.wait();

    const gasConsumption = receipt.cumulativeGasUsed.mul(
      receipt.effectiveGasPrice,
    );

    expect(
      (await ethers.provider.getBalance(user.address)).sub(balanceBeforeClaim),
    ).equal(maticAmount.sub(gasConsumption));

    expect(
      await CollateralManager.collateralToUserToAmount(
        wmaticContract.address,
        user.address,
      ),
    ).equal(0);

    expect(await wmaticContract.balanceOf(CollateralManager.address)).equal(0);
  });

  it("Add wrapped native token.", async () => {
    await backToSnapshot(snapshot);

    const maticAmount = parseEther("777");

    await CollateralManager.connect(admin).setNativeWrapper(
      wmaticContract.address,
    );

    const wmaticBalance = await ethers.provider.getBalance(
      CollateralManager.address,
    );

    await wmaticContract.connect(user).deposit({ value: maticAmount });

    await wmaticContract
      .connect(user)
      .approve(CollateralManager.address, maticAmount);

    await CollateralManager.connect(user).addCollateral(
      user.address,
      wmaticContract.address,
      maticAmount,
    );

    expect(await wmaticContract.balanceOf(user.address)).equal(0);

    expect(
      (await ethers.provider.getBalance(wmaticContract.address)).sub(
        wmaticBalance,
      ),
    ).equal(maticAmount);

    expect(await wmaticContract.balanceOf(CollateralManager.address)).equal(
      maticAmount,
    );

    expect(
      await CollateralManager.collateralToUserToAmount(
        wmaticContract.address,
        user.address,
      ),
    ).equal(maticAmount);
  });
});
