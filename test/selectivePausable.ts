import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {
  MockSelectivePausableA,
  MockSelectivePausableB,
} from "../typechain-types";

describe("SelectivePausable lib test.", async () => {
  let MockPausableA: MockSelectivePausableA;
  let MockPausableB: MockSelectivePausableB;

  before(async () => {
    const SelectivePausableFactoryA = await ethers.getContractFactory(
      "MockSelectivePausableA",
    );

    const SelectivePausableFactoryB = await ethers.getContractFactory(
      "MockSelectivePausableB",
    );

    MockPausableA = (await upgrades.deployProxy(
      SelectivePausableFactoryA,
    )) as MockSelectivePausableA;

    MockPausableB = await SelectivePausableFactoryB.deploy(
      MockPausableA.address,
    );
  });

  it("Should setValue, readValue but not setZero.", async () => {
    await MockPausableA.setValue(777);

    expect(await MockPausableA.readValue()).equal(777);

    await MockPausableA.setValue(1);

    await MockPausableB.callSetValueA(777);

    expect(await MockPausableA.readValue()).equal(777);

    await expect(MockPausableA.setZero()).to.be.revertedWith(
      "setZero function is on pause.",
    );

    await expect(MockPausableB.callSetZeroA()).to.be.revertedWith(
      "setZero function is on pause.",
    );
  });

  it("Unpause setZero, pause setValue. Should setZero, readValue, revert setValue.", async () => {
    await MockPausableA.setFuncPaused("setZero", false);

    await MockPausableA.setZero();

    expect(await MockPausableA.readValue()).equal(0);

    await MockPausableA.setValue(1);

    await MockPausableB.callSetZeroA();

    expect(await MockPausableA.readValue()).equal(0);

    await MockPausableA.setFuncPaused("setValue", true);

    await expect(MockPausableA.setValue(777)).to.be.revertedWith(
      "setValue function is on pause.",
    );

    await expect(MockPausableB.callSetValueA(777)).to.be.revertedWith(
      "setValue function is on pause.",
    );
  });

  it("Ultimate pause. Should revert at all.", async () => {
    await MockPausableA.pause();

    await expect(MockPausableA.readValue()).to.be.revertedWith(
      "Pausable: paused",
    );

    await expect(MockPausableA.setValue(777)).to.be.revertedWith(
      "Pausable: paused",
    );

    await expect(MockPausableA.setZero()).to.be.revertedWith(
      "Pausable: paused",
    );

    await expect(MockPausableB.callSetValueA(777)).to.be.revertedWith(
      "Pausable: paused",
    );

    await expect(MockPausableB.callSetZeroA()).to.be.revertedWith(
      "Pausable: paused",
    );

    await expect(MockPausableB.readValueFromA()).to.be.revertedWith(
      "Pausable: paused",
    );
  });
});
