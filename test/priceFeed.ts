import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Answers } from "../scripts/types";
import {
  bn,
  getPercent,
  getRandomAddress,
  toWei,
  toWei6,
  toWei8,
} from "../scripts/common";
import { MockPriceFeed } from "../typechain-types";
import { USD_ADDRESS } from "../scripts/constants";

describe("PriceFeed unit tests", () => {
  let MockPriceFeed: MockPriceFeed;
  let WETH_ADDRESS: string;
  let USDC_ADDRESS: string;
  let BTC_ADDRESS: string;
  let DAI_ADDRESS: string;
  let latestAnswers: Answers;
  let owner: SignerWithAddress;

  before(async () => {
    const tokenFactory = await ethers.getContractFactory("MockERC20");
    WETH_ADDRESS = (await tokenFactory.deploy("WETH", "WETH", 18)).address;
    USDC_ADDRESS = (await tokenFactory.deploy("USDC", "USDC", 6)).address;
    BTC_ADDRESS = (await tokenFactory.deploy("BTC", "BTC", 18)).address;
    DAI_ADDRESS = (await tokenFactory.deploy("DAI", "DAI", 18)).address;
    [owner] = await ethers.getSigners();
    const MockPriceFeedFactory = await ethers.getContractFactory(
      "MockPriceFeed",
    );
    MockPriceFeed = (await upgrades
      .deployProxy(MockPriceFeedFactory, [owner.address], {
        initializer: "init",
        kind: "uups",
      })
      .then((f) => f.deployed())) as MockPriceFeed;
    // real numbers from chainlink feed
    latestAnswers = {
      WETH_USD: {
        address: getRandomAddress(),
        from: WETH_ADDRESS,
        to: USD_ADDRESS,
        value: bn("145162000000"),
      },
      USDC_USD: {
        address: getRandomAddress(),
        from: USDC_ADDRESS,
        to: USD_ADDRESS,
        value: bn("100003775"),
      },
      BTC_USD: {
        address: getRandomAddress(),
        from: BTC_ADDRESS,
        to: USD_ADDRESS,
        value: bn("2040113706281"),
      },
      DAI_USD: {
        address: getRandomAddress(),
        from: DAI_ADDRESS,
        to: USD_ADDRESS,
        value: bn("99949700"),
      },
    };
    for (const { address, from, to, value } of Object.values(latestAnswers)) {
      await MockPriceFeed.setLatestAnswer(address, value);
      await MockPriceFeed.connect(owner).setPriceFeed(address, from, to);
    }
  });

  it("Converts from WETH to USDC and back", async () => {
    const usdcToConvert = toWei6("1000");

    const directEther = await MockPriceFeed.convert(
      usdcToConvert,
      USDC_ADDRESS,
      WETH_ADDRESS,
    );

    const ether = await MockPriceFeed.convert(
      usdcToConvert,
      USDC_ADDRESS,
      WETH_ADDRESS,
    );

    expect(directEther.sub(ether)).lt(getPercent(directEther, 1));

    const usdc = await MockPriceFeed.convert(ether, WETH_ADDRESS, USDC_ADDRESS);

    expect(usdcToConvert.sub(usdc)).lte(bn("1"));
  });

  it("Converts from BTC to DAI and back", async () => {
    const daiToConvert = toWei("20400");
    const btc = await MockPriceFeed.convert(
      daiToConvert,
      DAI_ADDRESS,
      BTC_ADDRESS,
    );

    expect(toWei("1").sub(btc)).lt(getPercent(toWei("1"), 1));

    const dai = await MockPriceFeed.convert(btc, BTC_ADDRESS, DAI_ADDRESS);
    expect(daiToConvert.sub(dai)).lt(getPercent(daiToConvert, 1));
  });

  it("Converts small numbers", async () => {
    const cases = [
      {
        value: bn("1"),
        from: USDC_ADDRESS,
        to: WETH_ADDRESS,
      },
      {
        value: bn("1"),
        from: USDC_ADDRESS,
        to: USD_ADDRESS,
      },
      {
        value: toWei8("0.00001"),
        from: USD_ADDRESS,
        to: USDC_ADDRESS,
      },
      {
        value: toWei("0.000000001"),
        from: WETH_ADDRESS,
        to: USDC_ADDRESS,
      },
      {
        value: toWei("0.000000000001"),
        from: BTC_ADDRESS,
        to: WETH_ADDRESS,
      },
    ];

    for (const { value, from, to } of cases) {
      expect(await MockPriceFeed.convert(value, from, to)).gt(0);
    }
  });
});
