import { ethers } from "hardhat";
import { expect } from "chai";
import { ListMapUsage } from "../typechain-types";
import { Errors } from "../scripts/constants";
import { getRandomAddress } from "../scripts/common";

describe("ListMapUsage unit test", async () => {
  let ListMapUsage: ListMapUsage;
  const uint16list = [1, 2, 3];
  const uint256list = [10000000, 20000000, 3000000000];
  let erc20metadataList: string[];
  let poolList: string[];

  before(async () => {
    const ListMapUsageFactory = await ethers.getContractFactory("ListMapUsage");
    ListMapUsage = await ListMapUsageFactory.deploy().then((f) => f.deployed());
    erc20metadataList = [
      getRandomAddress(),
      getRandomAddress(),
      getRandomAddress(),
    ];
    poolList = [getRandomAddress(), getRandomAddress(), getRandomAddress()];
  });

  it("Should addUint16 and get it", async () => {
    await ListMapUsage.addUint16(uint16list);
    const list = await ListMapUsage.getUint16list();
    expect(list).to.have.all.members(uint16list);
  });

  it("Should NOT addUint16 because element already in array", async () => {
    await expect(ListMapUsage.addUint16([1])).to.be.revertedWith(
      Errors.ELEMENT_IN_ARRAY,
    );
  });

  it("Should NOT removeUint16 because this element is not in array", async () => {
    await expect(ListMapUsage.removeUint16([4])).to.be.revertedWith(
      Errors.NO_ELEMENT_IN_ARRAY,
    );
  });

  it("Should removeUint16 and get zero length list", async () => {
    await ListMapUsage.removeUint16(uint16list);
    expect(await ListMapUsage.getUint16list()).length(0);
  });

  it("Should addUint256 and get it", async () => {
    await ListMapUsage.addUint256(uint256list);
    const list = await ListMapUsage.getUint256list();
    for (let i = 0; i < list.length; i++) {
      expect(list[i]).to.equal(uint256list[i]);
    }
  });

  it("Should NOT addUint256 because element already in array", async () => {
    await expect(ListMapUsage.addUint256([10000000])).to.be.revertedWith(
      Errors.ELEMENT_IN_ARRAY,
    );
  });

  it("Should NOT removeUint256 because this element is not in array", async () => {
    await expect(ListMapUsage.removeUint256([4])).to.be.revertedWith(
      Errors.NO_ELEMENT_IN_ARRAY,
    );
  });

  it("Should removeUint16 and get zero length list", async () => {
    await ListMapUsage.removeUint256(uint256list);
    expect(await ListMapUsage.getUint256list()).length(0);
  });

  it("Should addErc20metadata and get it", async () => {
    await ListMapUsage.addErc20metadata(erc20metadataList);
    const list = await ListMapUsage.getErc20metadataList();
    expect(list).to.have.all.members(erc20metadataList);
  });

  it("Should NOT addErc20metadata because element already in array", async () => {
    await expect(
      ListMapUsage.addErc20metadata([erc20metadataList[0]]),
    ).to.be.revertedWith(Errors.ELEMENT_IN_ARRAY);
  });

  it("Should NOT removeUint256 because this element is not in array", async () => {
    await expect(
      ListMapUsage.removeErc20metadata([poolList[0]]),
    ).to.be.revertedWith(Errors.NO_ELEMENT_IN_ARRAY);
  });

  it("Should removeErc20metadata and get zero length list", async () => {
    await ListMapUsage.removeErc20metadata(erc20metadataList);
    expect(await ListMapUsage.getErc20metadataList()).length(0);
  });

  it("Should addPool and get it", async () => {
    await ListMapUsage.addPool(poolList);
    const list = await ListMapUsage.getPoolList();
    expect(list).to.have.all.members(poolList);
  });

  it("Should NOT addPool because this element is not in array", async () => {
    await expect(ListMapUsage.addPool([poolList[0]])).to.be.revertedWith(
      Errors.ELEMENT_IN_ARRAY,
    );
  });

  it("Should NOT removePool because element already in array", async () => {
    await expect(
      ListMapUsage.removePool([erc20metadataList[0]]),
    ).to.be.revertedWith(Errors.NO_ELEMENT_IN_ARRAY);
  });

  it("Should removePool and get zero length list", async () => {
    await ListMapUsage.removePool(poolList);
    expect(await ListMapUsage.getPoolList()).length(0);
  });
});
