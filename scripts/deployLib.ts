import { ethers } from "hardhat";

import { MockERC20 } from "../typechain-types/contracts/mocks/MockERC20";
import { Factories, RociContract, TestTokenParams } from "./types";

const rociContracts = Object.keys(
  RociContract,
) as unknown as (keyof typeof RociContract)[];

function zip<T>(r: unknown[][]) {
  return Object.fromEntries(r) as T;
}

export const getFactory = (name: keyof typeof RociContract) =>
  ethers.getContractFactory(name).then((factory) => [name, factory]);

export async function getFactories(): Promise<Factories> {
  return Promise.all(rociContracts.map(getFactory)).then((factories) =>
    zip<Factories>(factories),
  );
}

export const deployTestToken = async (
  params: TestTokenParams,
): Promise<MockERC20> => {
  const factory = await ethers.getContractFactory("MockERC20");

  const token = await factory.deploy(
    params.name,
    params.symbol,
    params.decimals,
  );

  await token.deployed();

  return token;
};
