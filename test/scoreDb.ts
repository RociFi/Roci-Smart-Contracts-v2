import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat";
import { Errors, ONE_DAY, proxyOpts, ROLES } from "../scripts/constants";
import {
  bn,
  currentTimestamp,
  getACErrorText,
  mine,
  signScore,
  txTimestamp,
} from "../scripts/common";
import { ScoreDB } from "../typechain-types";

describe("ScoreDB unit test", async () => {
  let scoreDB: ScoreDB;
  let sig: string;
  let admin: SignerWithAddress, user: SignerWithAddress;
  let version: string;
  let nfcsId: BigNumber;
  const minScore = 1;
  const maxScore = 10;
  const scoreValidityPeriod = 10000;

  before(async () => {
    [admin, user] = await ethers.getSigners();
    const ScoreDBFactory = await ethers.getContractFactory("ScoreDB");
    scoreDB = (await upgrades
      .deployProxy(ScoreDBFactory, [admin.address], proxyOpts)
      .then((f) => f.deployed())) as ScoreDB;
    version = await scoreDB.currentVersion();
    nfcsId = BigNumber.from("1");
  });

  it("Should NOT setMinScore from address without ADMIN role", async () => {
    await expect(
      scoreDB.connect(user).setMinScore(minScore),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));
  });

  it("Should NOT setMaxScore from address without ADMIN role", async () => {
    await expect(
      scoreDB.connect(user).setMaxScore(maxScore),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));
  });

  it("Should NOT setNFCSSignerAddress from address without ADMIN role", async () => {
    await expect(
      scoreDB.connect(user).setNFCSSignerAddress(user.address),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));
  });

  it("Should NOT setScoreValidityPeriod from address without ADMIN role", async () => {
    await expect(
      scoreDB.connect(user).setScoreValidityPeriod(scoreValidityPeriod),
    ).to.be.revertedWith(getACErrorText(user.address, ROLES.ADMIN));
  });

  it("Should NOT updateScore because unknown error fetching score", async () => {
    sig = await signScore(nfcsId, maxScore, admin);

    await expect(
      scoreDB
        .connect(admin)
        .updateScore(nfcsId, maxScore, currentTimestamp(), sig, version),
    ).to.be.revertedWith(Errors.SCORE_DB_UNKNOWN_FETCHING_SCORE);
  });

  it("Should NOT updateScore because score unverified", async () => {
    sig = await signScore(nfcsId, maxScore, user);

    await scoreDB.connect(admin).setNFCSSignerAddress(admin.address);

    await expect(
      scoreDB
        .connect(admin)
        .updateScore(nfcsId, maxScore, currentTimestamp(), sig, version),
    ).to.be.revertedWith(Errors.SCORE_DB_UNKNOWN_FETCHING_SCORE);
  });

  it("Should NOT updateScore because contract version incorrect", async () => {
    sig = await signScore(nfcsId, maxScore, admin);

    await expect(
      scoreDB
        .connect(admin)
        .updateScore(nfcsId, maxScore, currentTimestamp(), sig, version + 1),
    ).to.be.revertedWith(Errors.VERSION);
  });

  it("Contract should NOT be paused from address without PAUSER role", async () => {
    await expect(scoreDB.connect(admin).pause()).to.be.revertedWith(
      getACErrorText(admin.address, ROLES.PAUSER),
    );
  });

  it("Contract should NOT be unpaused from address without PAUSER role", async () => {
    await expect(scoreDB.connect(admin).unpause()).to.be.revertedWith(
      getACErrorText(admin.address, ROLES.PAUSER),
    );
  });

  it("Contract should be paused", async () => {
    await scoreDB.connect(admin).grantRole(ROLES.PAUSER, admin.address);
    await expect(scoreDB.connect(admin).pause())
      .to.emit(scoreDB, "Paused")
      .withArgs(admin.address);
  });

  it("Should NOT updateScore because contract paused", async () => {
    sig = await signScore(nfcsId, maxScore, admin);

    await expect(
      scoreDB
        .connect(admin)
        .updateScore(nfcsId, maxScore, currentTimestamp(), sig, version),
    ).to.be.revertedWith(Errors.PAUSED);
  });

  it("Contract should be unpaused", async () => {
    await expect(scoreDB.connect(admin).unpause())
      .to.emit(scoreDB, "Unpaused")
      .withArgs(admin.address);
  });

  it("Should setNFCSSignerAddress", async () => {
    const receipt = await scoreDB
      .connect(admin)
      .setNFCSSignerAddress(admin.address);
    await expect(receipt)
      .to.emit(scoreDB, "NFCSSignerAddressChanged")
      .withArgs(await txTimestamp(receipt), admin.address);
  });

  it("Should setMinScore from address with ADMIN role", async () => {
    await scoreDB.connect(admin).setMinScore(minScore);
    expect(await scoreDB.minScore()).to.equal(minScore);
  });

  it("Should setMaxScore from address with ADMIN role", async () => {
    await scoreDB.connect(admin).setMaxScore(maxScore);
    expect(await scoreDB.maxScore()).to.equal(maxScore);
  });

  it("Should setScoreValidityPeriod", async () => {
    await scoreDB.connect(admin).setScoreValidityPeriod(scoreValidityPeriod);
    expect(await scoreDB.scoreValidityPeriod()).to.equal(scoreValidityPeriod);
  });

  it("Should updateScore", async () => {
    sig = await signScore(nfcsId, maxScore, admin);
    const receipt = await scoreDB
      .connect(admin)
      .updateScore(nfcsId, maxScore, currentTimestamp(), sig, version);

    await expect(receipt)
      .to.emit(scoreDB, "ScoreUpdated")
      .withArgs(await txTimestamp(receipt), nfcsId, maxScore);
  });

  it("Should getScore", async () => {
    const receipt = await scoreDB.connect(admin).getScore(nfcsId);
    expect(receipt.creditScore).to.equal(maxScore);
  });

  it("Should getCreditScoreAndValidate", async () => {
    const creditScore = await scoreDB
      .connect(admin)
      .getCreditScoreAndValidate(nfcsId);
    expect(creditScore).to.equal(maxScore);
  });

  it("Should NOT getCreditScoreAndValidate because score should be updated", async () => {
    sig = await signScore(nfcsId, maxScore, admin);

    const timeStampBefore = await currentTimestamp();
    await scoreDB
      .connect(admin)
      .updateScore(nfcsId, maxScore, timeStampBefore, sig, version);

    await ethers.provider.send("evm_mine", [timeStampBefore + ONE_DAY]);

    await expect(
      scoreDB.connect(admin).getCreditScoreAndValidate(nfcsId),
    ).to.be.revertedWith(Errors.SETTINGS_PROVIDER_SCORE_OUTDATED);
  });

  it("Cannot reuse outdated signature to update score", async () => {
    const score1 = 10;
    const timestamp1 = await currentTimestamp();
    const objectHash = ethers.utils.solidityKeccak256(
      ["uint256", "uint16", "uint256"],
      [nfcsId, score1, bn(timestamp1)],
    );
    const signature1 = await admin.signMessage(
      ethers.utils.arrayify(objectHash),
    );
    await scoreDB
      .connect(admin)
      .updateScore(nfcsId, score1, timestamp1, signature1, version);

    await mine(scoreValidityPeriod);

    const score2 = 4;
    const signature2 = await signScore(nfcsId, score2, admin);
    await scoreDB
      .connect(admin)
      .updateScore(nfcsId, score2, currentTimestamp(), signature2, version);

    // will fail since signature was signed before scoreValidityPeriod
    await expect(
      scoreDB
        .connect(admin)
        .updateScore(nfcsId, score1, timestamp1, signature1, version),
    ).revertedWith(Errors.SCORE_DB_OUTDATED_SIGNATURE);
  });
});
