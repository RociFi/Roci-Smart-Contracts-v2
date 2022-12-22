import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { proxyOpts } from "../scripts/constants";

import { ACTION, PERIOD, STATUS, STATUS_MATRIX } from "../scripts/status";
import { deployed } from "../scripts/common";
import { LoanManager } from "../typechain-types";

const EVENTS = [
  {
    name: "Partially payment during loan term",
    action: ACTION.REPAY_PARTIAL,
    period: PERIOD.BEFORE_MATURITY,
    to: [] as number[],
  },
  {
    name: "Payed in full during loan term",
    action: ACTION.REPAY_FULL,
    period: PERIOD.BEFORE_MATURITY,
    to: [] as number[],
  },
  {
    name: "Partial payment after maturity & before grace period ends",
    action: ACTION.REPAY_PARTIAL,
    period: PERIOD.BEFORE_LIQUIDATION,
    to: [] as number[],
  },
  {
    name: "Payed in full after maturity & before grace period ends",
    action: ACTION.REPAY_FULL,
    period: PERIOD.BEFORE_LIQUIDATION,
    to: [] as number[],
  },
  {
    name: "Liquidated & outstanding balance on loan = 0",
    action: ACTION.LIQUIDATION_COVERED,
    period: PERIOD.AFTER_LIQUIDATION,
    to: [] as number[],
  },
  {
    name: "Liquidated & outstanding balance on loan > 0",
    action: ACTION.LIQUIDATION_NOT_COVERED,
    period: PERIOD.AFTER_LIQUIDATION,
    to: [] as number[],
  },
  {
    name: "Partial payment after liquidation",
    action: ACTION.REPAY_PARTIAL,
    period: PERIOD.AFTER_LIQUIDATION,
    to: [] as number[],
  },
  {
    name: "Paid in full after liquidation",
    action: ACTION.REPAY_FULL,
    period: PERIOD.AFTER_LIQUIDATION,
    to: [] as number[],
  },
];

const CONDITIONS = [
  [
    STATUS.PAID_EARLY_PART,
    STATUS.PAID_EARLY_FULL,
    STATUS.PAID_LATE_PART,
    STATUS.PAID_LATE_FULL,
    STATUS.DEFAULT_FULL_LIQUIDATED,
    STATUS.DEFAULT_PART,
    STATUS.PAID_LATE_PART,
    STATUS.PAID_LATE_FULL,
  ],
  [
    STATUS.PAID_EARLY_PART,
    STATUS.PAID_EARLY_FULL,
    STATUS.PAID_LATE_PART,
    STATUS.PAID_LATE_FULL,
    STATUS.DEFAULT_FULL_LIQUIDATED,
    STATUS.DEFAULT_PART,
    STATUS.PAID_LATE_PART,
    STATUS.PAID_LATE_FULL,
  ],
  [
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
  ],
  [
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PAID_LATE_PART,
    STATUS.PAID_LATE_FULL,
    STATUS.DEFAULT_FULL_LIQUIDATED,
    STATUS.DEFAULT_PART,
    STATUS.PERSIST,
    STATUS.PAID_LATE_FULL,
  ],
  [
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
  ],
  [
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.DEFAULT_PART,
    STATUS.DEFAULT_FULL_PAID,
  ],
  [
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
  ],
  [
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
    STATUS.PERSIST,
  ],
];

for (let column = 0; column < CONDITIONS[0].length; column++) {
  for (let row = 0; row < CONDITIONS.length; row++) {
    EVENTS[row].to.push(CONDITIONS[column][row]);
  }
}

const fromStatuses = [
  STATUS.NEW,
  STATUS.PAID_EARLY_PART,
  STATUS.PAID_EARLY_FULL,
  STATUS.PAID_LATE_PART,
  STATUS.PAID_LATE_FULL,
  STATUS.DEFAULT_PART,
  STATUS.DEFAULT_FULL_LIQUIDATED,
  STATUS.DEFAULT_FULL_PAID,
];

describe("Statuses test", async function () {
  this.timeout(0);

  let loanManager: LoanManager;
  let owner: SignerWithAddress;

  before(async () => {
    [owner] = await ethers.getSigners();

    loanManager = (
      await upgrades
        .deployProxy(
          await ethers.getContractFactory("LoanManager", owner),
          [owner.address],
          proxyOpts,
        )
        .then(deployed)
    ).connect(owner) as LoanManager;

    for (const status of STATUS_MATRIX) {
      await loanManager.setStatus(...status);
    }
  });

  for (const record of EVENTS) {
    it(record.name, async () => {
      for (let i = 0; i < fromStatuses.length; i++) {
        const contractStatus = await loanManager.getStatus(
          fromStatuses[i],
          record.period,
          record.action,
        );

        const info = `From: ${fromStatuses[i]}, Actual: ${contractStatus}, Record status: ${record.to[i]}`;
        if (
          contractStatus == STATUS.PERSIST &&
          record.to[i] != STATUS.PERSIST
        ) {
          expect(fromStatuses[i], info).equal(record.to[i]);
        } else {
          expect(contractStatus, info).equal(record.to[i]);
        }
      }
    });
  }
});
