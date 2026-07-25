export const ACCOUNT_STATUSES = ["INVITED", "ACTIVE", "LOCKED", "DISABLED"] as const;

export type AccountStatusValue = (typeof ACCOUNT_STATUSES)[number];

export type AccountWorkflowState = {
  status: AccountStatusValue;
  lockedUntil: Date | null;
};
