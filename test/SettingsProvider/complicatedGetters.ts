import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Errors, proxyOpts, ROLES } from "../../scripts/constants";
import { getACErrorText } from "../../scripts/common";
import { SettingsProvider } from "../../typechain-types";

describe("Settings provider unit test", async () => {
  let settingsProvider: SettingsProvider;
  const poolScores = [1, 2, 3];
  const interest = 1000;
  const ltvs = [50, 100, 150];
  const durations = [1000, 2000, 3000];
  let admin: SignerWithAddress,
    user: SignerWithAddress,
    pool1: SignerWithAddress,
    pool2: SignerWithAddress,
    weth: SignerWithAddress;

  before(async () => {
    [admin, user, pool1, pool2, weth] = await ethers.getSigners();
    const SettingsProviderFactory = await ethers.getContractFactory(
      "SettingsProvider",
    );
    settingsProvider = (await upgrades
      .deployProxy(SettingsProviderFactory, [admin.address], proxyOpts)
      .then((f) => f.deployed())) as SettingsProvider;
  });

  it("Should NOT addPoolCollaterals under address without ADMIN role", async () => {
    await expect(
      settingsProvider
        .connect(user)
        .addPoolCollaterals(pool1.address, [weth.address]),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));
  });

  it("Should NOT removePoolCollaterals under address without ADMIN role", async () => {
    await expect(
      settingsProvider
        .connect(user)
        .removePoolCollaterals(pool1.address, [weth.address]),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));
  });

  it("Should NOT addPoolScores under address without ADMIN role", async () => {
    await expect(
      settingsProvider.connect(user).addPoolScores(pool1.address, poolScores),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));
  });

  it("Should NOT removePoolScores under address without ADMIN role", async () => {
    await expect(
      settingsProvider
        .connect(user)
        .removePoolScores(pool1.address, poolScores),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));
  });

  it("Should NOT addPoolToScoreLtvs under address without ADMIN role", async () => {
    await expect(
      settingsProvider
        .connect(user)
        .addPoolToScoreLtvs(pool1.address, poolScores[0], ltvs),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));
  });

  it("Should NOT removePoolToScoreLtvs under address without ADMIN role", async () => {
    await expect(
      settingsProvider
        .connect(user)
        .removePoolToScoreLtvs(pool1.address, poolScores[0], ltvs),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));
  });

  it("Should NOT addPoolToScoreDurations under address without ADMIN role", async () => {
    await expect(
      settingsProvider
        .connect(user)
        .addPoolToScoreDurations(pool1.address, poolScores[0], durations),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));
  });

  it("Should NOT removePoolToScoreDurations under address without ADMIN role", async () => {
    await expect(
      settingsProvider
        .connect(user)
        .removePoolToScoreDurations(pool1.address, poolScores[0], durations),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));
  });

  it("Should NOT setPoolToScoreToLtvToDurationInterest from address without ADMIN role", async () => {
    await expect(
      settingsProvider
        .connect(user)
        .setPoolToScoreToLtvToDurationInterest(
          pool1.address,
          poolScores[0],
          ltvs[0],
          durations[0],
          interest,
        ),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));
  });

  it("Should get empty poolCollaterals", async () => {
    expect(
      await settingsProvider.connect(admin).getPoolCollaterals(pool1.address),
    ).to.have.all.members([]);
  });

  it("Should NOT addPoolCollaterals if pool didn't set", async () => {
    await expect(
      settingsProvider
        .connect(admin)
        .addPoolCollaterals(pool1.address, [weth.address]),
    ).to.be.revertedWith(Errors.SETTINGS_PROVIDER_POOL_NOT_SET);
  });

  it("Should NOT addPoolScores if pool didn't set", async () => {
    await expect(
      settingsProvider.connect(admin).addPoolScores(pool1.address, poolScores),
    ).to.be.revertedWith(Errors.SETTINGS_PROVIDER_POOL_NOT_SET);
  });

  it("Should NOT addPoolToScoreLtvs if score is not set in pool", async () => {
    await expect(
      settingsProvider
        .connect(admin)
        .addPoolToScoreLtvs(pool1.address, poolScores[0], ltvs),
    ).to.be.revertedWith(Errors.SETTINGS_PROVIDER_SCORE_NOT_SET);
  });

  it("Should NOT addPoolToScoreDurations if score is not set in pool", async () => {
    await expect(
      settingsProvider
        .connect(admin)
        .addPoolToScoreDurations(pool1.address, poolScores[0], durations),
    ).to.be.revertedWith(Errors.SETTINGS_PROVIDER_SCORE_NOT_SET);
  });

  it("Should NOT removePoolCollaterals if pool didn't set", async () => {
    await expect(
      settingsProvider
        .connect(admin)
        .removePoolCollaterals(pool1.address, [weth.address]),
    ).to.be.revertedWith(Errors.SETTINGS_PROVIDER_POOL_NOT_SET);
  });

  it("Should NOT removePoolScores if pool didn't set", async () => {
    await expect(
      settingsProvider
        .connect(admin)
        .removePoolScores(pool1.address, poolScores),
    ).to.be.revertedWith(Errors.SETTINGS_PROVIDER_POOL_NOT_SET);
  });

  it("Should NOT removePoolToScoreLtvs if score is not set in pool", async () => {
    await expect(
      settingsProvider
        .connect(admin)
        .removePoolToScoreLtvs(pool1.address, poolScores[0], ltvs),
    ).to.be.revertedWith(Errors.SETTINGS_PROVIDER_SCORE_NOT_SET);
  });

  it("Should NOT removePoolToScoreDurations if score is not set in pool", async () => {
    await expect(
      settingsProvider
        .connect(admin)
        .removePoolToScoreDurations(pool1.address, poolScores[0], durations),
    ).to.be.revertedWith(Errors.SETTINGS_PROVIDER_SCORE_NOT_SET);
  });

  it("Should NOT setPoolToScoreToLtvToDurationInterest if pool didn't set", async () => {
    await expect(
      settingsProvider
        .connect(admin)
        .setPoolToScoreToLtvToDurationInterest(
          pool1.address,
          poolScores[0],
          ltvs[0],
          durations[0],
          interest,
        ),
    ).to.be.revertedWith(Errors.SETTINGS_PROVIDER_POOL_NOT_SET);
  });

  it("Should NOT getLoanInterest if pool didn't set", async () => {
    await expect(
      settingsProvider
        .connect(admin)
        .getLoanInterest(pool1.address, poolScores[0], ltvs[0], durations[0]),
    ).to.be.revertedWith(Errors.SETTINGS_PROVIDER_POOL_NOT_SET);
  });

  it("Should NOT setPoolToScoreToLtvToDurationInterest if score is not set in pool", async () => {
    await settingsProvider
      .connect(admin)
      .addPools([pool1.address, pool2.address]);

    await expect(
      settingsProvider
        .connect(admin)
        .setPoolToScoreToLtvToDurationInterest(
          pool1.address,
          poolScores[0],
          ltvs[0],
          durations[0],
          interest,
        ),
    ).to.be.revertedWith(Errors.SETTINGS_PROVIDER_SCORE_NOT_SET);
  });

  it("Should NOT getLoanInterest if score is not set in pool", async () => {
    await expect(
      settingsProvider
        .connect(admin)
        .getLoanInterest(pool1.address, poolScores[0], ltvs[0], durations[0]),
    ).to.be.revertedWith(Errors.SETTINGS_PROVIDER_SCORE_NOT_SET);
  });

  it("Should addPoolScores", async () => {
    await settingsProvider
      .connect(admin)
      .addPoolScores(pool1.address, poolScores);
    expect(
      await settingsProvider.getPoolScores(pool1.address),
    ).to.have.all.members(poolScores);
  });

  it("Should NOT setPoolToScoreToLtvToDurationInterest if ltv is not set in pool for score", async () => {
    await expect(
      settingsProvider
        .connect(admin)
        .setPoolToScoreToLtvToDurationInterest(
          pool1.address,
          poolScores[0],
          ltvs[0],
          durations[0],
          interest,
        ),
    ).to.be.revertedWith(Errors.SETTINGS_PROVIDER_LTV_NOT_SET);
  });

  it("Should NOT getLoanInterest if ltv is not set in pool for score", async () => {
    await expect(
      settingsProvider
        .connect(admin)
        .getLoanInterest(pool1.address, poolScores[0], ltvs[0], durations[0]),
    ).to.be.revertedWith(Errors.SETTINGS_PROVIDER_LTV_NOT_SET);
  });

  it("Should addPoolToScoreLtvs", async () => {
    await settingsProvider
      .connect(admin)
      .addPoolToScoreLtvs(pool1.address, poolScores[0], ltvs);

    const value = await settingsProvider.getPoolToScoreLtvs(
      pool1.address,
      poolScores[0],
    );
    for (let i = 0; i < value.length; i++) {
      expect(value[i].toNumber()).to.equal(ltvs[i]);
    }
  });

  it("Should NOT setPoolToScoreToLtvToDurationInterest if duration is not set in pool for score", async () => {
    await expect(
      settingsProvider
        .connect(admin)
        .setPoolToScoreToLtvToDurationInterest(
          pool1.address,
          poolScores[0],
          ltvs[0],
          durations[0],
          interest,
        ),
    ).to.be.revertedWith(Errors.SETTINGS_PROVIDER_DURATION_NOT_SET);
  });

  it("Should NOT getLoanInterest if duration is not set in pool for score", async () => {
    await expect(
      settingsProvider
        .connect(admin)
        .getLoanInterest(pool1.address, poolScores[0], ltvs[0], durations[0]),
    ).to.be.revertedWith(Errors.SETTINGS_PROVIDER_DURATION_NOT_SET);
  });

  it("Should addPoolToScoreDuration", async () => {
    await settingsProvider
      .connect(admin)
      .addPoolToScoreDurations(pool1.address, poolScores[0], durations);

    const value = await settingsProvider.getPoolToScoreDurations(
      pool1.address,
      poolScores[0],
    );
    for (let i = 0; i < value.length; i++) {
      expect(value[i].toNumber()).to.equal(durations[i]);
    }
  });

  it("Should NOT getLoanSettings if collateral is not set in pool", async () => {
    await expect(
      settingsProvider
        .connect(admin)
        .getLoanSettings(
          pool1.address,
          poolScores[0],
          ltvs[0],
          durations[0],
          weth.address,
        ),
    ).to.be.revertedWith(Errors.SETTINGS_PROVIDER_COLLATERAL_NOT_SET);
  });

  it("Should addPoolCollaterals", async () => {
    await settingsProvider
      .connect(admin)
      .addPoolCollaterals(pool1.address, [weth.address]);
    expect(
      await settingsProvider.connect(admin).getPoolCollaterals(pool1.address),
    ).to.have.all.members([weth.address]);
  });

  it("Should NOT getLoanSettings if interest is not set in pool for score-ltv-duration", async () => {
    await expect(
      settingsProvider
        .connect(admin)
        .getLoanSettings(
          pool1.address,
          poolScores[0],
          ltvs[0],
          durations[0],
          weth.address,
        ),
    ).to.be.revertedWith(Errors.SETTINGS_PROVIDER_INTEREST_NOT_SET);
  });

  it("Should setPoolToScoreToLtvToDurationInterest", async () => {
    await settingsProvider
      .connect(admin)
      .setPoolToScoreToLtvToDurationInterest(
        pool1.address,
        poolScores[0],
        ltvs[0],
        durations[0],
        interest,
      );
  });

  it("Should getLoanInterest", async () => {
    const value = await settingsProvider.getLoanInterest(
      pool1.address,
      poolScores[0],
      ltvs[0],
      durations[0],
    );
    expect(value.toNumber()).to.equal(interest);
  });

  it("Should getLoanSettings", async () => {
    const loanSettings = await settingsProvider
      .connect(admin)
      .getLoanSettings(
        pool1.address,
        poolScores[0],
        ltvs[0],
        durations[0],
        weth.address,
      );

    expect(loanSettings.interest.toNumber()).to.equal(interest);
    expect(loanSettings.gracePeriod.toNumber()).to.equal(0);
    expect(loanSettings.lateFee.toNumber()).to.equal(0);
  });
});
