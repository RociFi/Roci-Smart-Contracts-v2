export const STATUS = {
  PERSIST: 0,
  NEW: 1,
  PAID_EARLY_PART: 2,
  PAID_EARLY_FULL: 3,
  PAID_LATE_PART: 4,
  PAID_LATE_FULL: 5,
  DEFAULT_PART: 6,
  DEFAULT_FULL_LIQUIDATED: 7,
  DEFAULT_FULL_PAID: 8,
};

export const PERIOD = {
  BEFORE_MATURITY: 0,
  BEFORE_LIQUIDATION: 1,
  AFTER_LIQUIDATION: 2,
};

export const ACTION = {
  REPAY_PARTIAL: 0,
  REPAY_FULL: 1,
  LIQUIDATION_COVERED: 2,
  LIQUIDATION_NOT_COVERED: 3,
};
/** 
  BEFORE_MATURITY LAYER:
  
  | FROM/ACTION             | REPAY_PARTIAL   | REPAY_FULL        |
  
  | NEW                     | PAID_EARLY_PART | PAID_EARLY_FULL   |
  | PAID_EARLY_PART         | 0               | PAID_EARLY_FULL   | 
  | PAID_EARLY_FULL         | 0               | 0                 | 
  | PAID_LATE_PART          | 0               | 0                 |
  | PAID_LATE_FULL          | 0               | 0                 | 
  | DEFAULT_PART            | 0               | 0                 | 
  | DEFAULT_FULL_LIQUIDATED | 0               | 0                 | 
  | DEFAULT_FULL_PAID       | 0               | 0                 | 
  */

const BEFORE_MATURITY_LAYER: [number, number, number, number][] = [
  [
    STATUS.NEW,
    PERIOD.BEFORE_MATURITY,
    ACTION.REPAY_PARTIAL,
    STATUS.PAID_EARLY_PART,
  ],
  [
    STATUS.NEW,
    PERIOD.BEFORE_MATURITY,
    ACTION.REPAY_FULL,
    STATUS.PAID_EARLY_FULL,
  ],

  [
    STATUS.PAID_EARLY_PART,
    PERIOD.BEFORE_MATURITY,
    ACTION.REPAY_FULL,
    STATUS.PAID_EARLY_FULL,
  ],
];
/** 
  BEFORE_LIQUIDATION LAYER:
  | FROM/ACTION             | REPAY_PARTIAL   | REPAY_FULL        | 
  
  | NEW                     | PAID_LATE_PART  | PAID_LATE_FULL    | 
  | PAID_EARLY_PART         | PAID_LATE_PART  | PAID_LATE_FULL    | 
  | PAID_EARLY_FULL         | 0               | 0                 | 
  | PAID_LATE_PART          | 0               | PAID_LATE_FULL    | 
  | PAID_LATE_FULL          | 0               | 0                 | 
  | DEFAULT_PART            | 0               | 0                 | 
  | DEFAULT_FULL_LIQUIDATED | 0               | 0                 |
  | DEFAULT_FULL_PAID       | 0               | 0                 |
  */

const BEFORE_LIQUIDATION_LAYER: [number, number, number, number][] = [
  [
    STATUS.NEW,
    PERIOD.BEFORE_LIQUIDATION,
    ACTION.REPAY_PARTIAL,
    STATUS.PAID_LATE_PART,
  ],
  [
    STATUS.NEW,
    PERIOD.BEFORE_LIQUIDATION,
    ACTION.REPAY_FULL,
    STATUS.PAID_LATE_FULL,
  ],

  [
    STATUS.PAID_EARLY_PART,
    PERIOD.BEFORE_LIQUIDATION,
    ACTION.REPAY_PARTIAL,
    STATUS.PAID_LATE_PART,
  ],
  [
    STATUS.PAID_EARLY_PART,
    PERIOD.BEFORE_LIQUIDATION,
    ACTION.REPAY_FULL,
    STATUS.PAID_LATE_FULL,
  ],

  [
    STATUS.PAID_LATE_PART,
    PERIOD.BEFORE_LIQUIDATION,
    ACTION.REPAY_FULL,
    STATUS.PAID_LATE_FULL,
  ],
];
/** 
  AFTER_LIQUIDATION LAYER:
  | FROM/ACTION             | REPAY_PARTIAL   | REPAY_FULL        | LIQUIDATION_COVERED      | LIQUIDATION_NOT_COVERED |
  
  | NEW                     | PAID_LATE_PART  | PAID_LATE_FULL    | DEFAULT_FULL_LIQUIDATED  | DEFAULT_PART            |
  | PAID_EARLY_PART         | PAID_LATE_PART  | PAID_LATE_FULL    | DEFAULT_FULL_LIQUIDATED  | DEFAULT_PART            | 
  | PAID_EARLY_FULL         | 0               | 0                 | 0                        | 0                       |
  | PAID_LATE_PART          | 0               | PAID_LATE_FULL    | DEFAULT_FULL_LIQUIDATED  | DEFAULT_PART            |
  | PAID_LATE_FULL          | 0               | 0                 | 0                        | 0                       |
  | DEFAULT_PART            | 0               | DEFAULT_FULL_PAID | 0                        | 0                       | 
  | DEFAULT_FULL_LIQUIDATED | 0               | 0                 | 0                        | 0                       |
  | DEFAULT_FULL_PAID       | 0               | 0                 | 0                        | 0                       |
  */

const AFTER_LIQUIDATION_LAYER: [number, number, number, number][] = [
  [
    STATUS.NEW,
    PERIOD.AFTER_LIQUIDATION,
    ACTION.LIQUIDATION_COVERED,
    STATUS.DEFAULT_FULL_LIQUIDATED,
  ],
  [
    STATUS.NEW,
    PERIOD.AFTER_LIQUIDATION,
    ACTION.LIQUIDATION_NOT_COVERED,
    STATUS.DEFAULT_PART,
  ],

  [
    STATUS.NEW,
    PERIOD.AFTER_LIQUIDATION,
    ACTION.REPAY_PARTIAL,
    STATUS.PAID_LATE_PART,
  ],
  [
    STATUS.NEW,
    PERIOD.AFTER_LIQUIDATION,
    ACTION.REPAY_FULL,
    STATUS.PAID_LATE_FULL,
  ],

  [
    STATUS.PAID_EARLY_PART,
    PERIOD.AFTER_LIQUIDATION,
    ACTION.LIQUIDATION_COVERED,
    STATUS.DEFAULT_FULL_LIQUIDATED,
  ],
  [
    STATUS.PAID_EARLY_PART,
    PERIOD.AFTER_LIQUIDATION,
    ACTION.LIQUIDATION_NOT_COVERED,
    STATUS.DEFAULT_PART,
  ],
  [
    STATUS.PAID_EARLY_PART,
    PERIOD.AFTER_LIQUIDATION,
    ACTION.REPAY_PARTIAL,
    STATUS.PAID_LATE_PART,
  ],
  [
    STATUS.PAID_EARLY_PART,
    PERIOD.AFTER_LIQUIDATION,
    ACTION.REPAY_FULL,
    STATUS.PAID_LATE_FULL,
  ],

  [
    STATUS.PAID_LATE_PART,
    PERIOD.AFTER_LIQUIDATION,
    ACTION.REPAY_FULL,
    STATUS.PAID_LATE_FULL,
  ],

  [
    STATUS.PAID_LATE_PART,
    PERIOD.AFTER_LIQUIDATION,
    ACTION.LIQUIDATION_COVERED,
    STATUS.DEFAULT_FULL_LIQUIDATED,
  ],

  [
    STATUS.PAID_LATE_PART,
    PERIOD.AFTER_LIQUIDATION,
    ACTION.LIQUIDATION_NOT_COVERED,
    STATUS.DEFAULT_PART,
  ],

  [
    STATUS.DEFAULT_PART,
    PERIOD.AFTER_LIQUIDATION,
    ACTION.REPAY_FULL,
    STATUS.DEFAULT_FULL_PAID,
  ],
];

export const STATUS_MATRIX = [
  ...BEFORE_MATURITY_LAYER,
  ...BEFORE_LIQUIDATION_LAYER,
  ...AFTER_LIQUIDATION_LAYER,
];
