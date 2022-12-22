import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { proxyOpts, ROLES } from "../../scripts/constants";
import { getACErrorText, toWei } from "../../scripts/common";
import { SettingsProvider } from "../../typechain-types";

describe("Settings provider unit test", async () => {
  let settingsProvider: SettingsProvider;
  const treasuryPercent = 10;
  const lateFee = toWei("1");
  const gracePeriod = 5 * 60 * 60 * 24;
  let admin: SignerWithAddress,
    user: SignerWithAddress,
    pool1: SignerWithAddress,
    pool2: SignerWithAddress,
    treasuryAddress: SignerWithAddress;

  before(async () => {
    [admin, user, treasuryAddress, pool1, pool2] = await ethers.getSigners();

    const SettingsProviderFactory = await ethers.getContractFactory(
      "SettingsProvider",
    );
    settingsProvider = (await upgrades
      .deployProxy(SettingsProviderFactory, [admin.address], proxyOpts)
      .then((f) => f.deployed())) as SettingsProvider;
  });

  it("Should NOT set treasuryAddress from address without ADMIN role", async () => {
    await expect(
      settingsProvider
        .connect(user)
        .setTreasuryAddress(treasuryAddress.address),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));
  });

  it("Should set treasuryAddress from address with ADMIN role", async () => {
    await settingsProvider
      .connect(admin)
      .setTreasuryAddress(treasuryAddress.address);
    expect(await settingsProvider.treasuryAddress()).to.equal(
      treasuryAddress.address,
    );
  });

  it("Should NOT set setTreasuryPercent from address without ADMIN role", async () => {
    await expect(
      settingsProvider
        .connect(user)
        .setTreasuryPercent(treasuryAddress.address),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));
  });

  it("Should setTreasuryPercent from address with ADMIN role", async () => {
    await settingsProvider.connect(admin).setTreasuryPercent(treasuryPercent);
    expect(await settingsProvider.treasuryPercent()).to.equal(treasuryPercent);
  });

  it("Should getTreasuryInfo from address with ADMIN role", async () => {
    const [treasury, percent] = await settingsProvider.getTreasuryInfo();

    expect(treasury).to.equal(treasuryAddress.address);
    expect(percent).to.equal(treasuryPercent);
  });

  it("Should NOT setPoolToLateFee from address without ADMIN role", async () => {
    await expect(
      settingsProvider.connect(user).setPoolToLateFee(pool1.address, lateFee),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));
  });

  it("Should setPoolToLateFee from address with ADMIN role", async () => {
    await settingsProvider
      .connect(admin)
      .setPoolToLateFee(pool1.address, lateFee);
    expect(await settingsProvider.poolToLateFee(pool1.address)).to.equal(
      lateFee,
    );
  });

  it("Should NOT setPoolToGracePeriod from address without ADMIN role", async () => {
    await expect(
      settingsProvider
        .connect(user)
        .setPoolToGracePeriod(pool1.address, gracePeriod),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));
  });

  it("Should setPoolToGracePeriod from address with ADMIN role", async () => {
    await settingsProvider
      .connect(admin)
      .setPoolToGracePeriod(pool1.address, gracePeriod);
    expect(await settingsProvider.poolToGracePeriod(pool1.address)).to.equal(
      gracePeriod,
    );
  });

  it("Should NOT addPools from address without ADMIN role", async () => {
    await expect(
      settingsProvider.connect(user).addPools([pool1.address, pool2.address]),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));
  });

  it("Should addPools from address with ADMIN role", async () => {
    await settingsProvider
      .connect(admin)
      .addPools([pool1.address, pool2.address]);
    expect(await settingsProvider.getPools()).to.have.all.members([
      pool1.address,
      pool2.address,
    ]);
  });

  it("Should NOT removePools from address without ADMIN role", async () => {
    await expect(
      settingsProvider
        .connect(user)
        .removePools([pool1.address, pool2.address]),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));
  });

  it("Should removePools from address with ADMIN role", async () => {
    await settingsProvider
      .connect(admin)
      .removePools([pool1.address, pool2.address]);
    expect(await settingsProvider.getPools()).lengthOf(0);
  });
});
