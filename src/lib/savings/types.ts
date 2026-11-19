import type { Currency, TransactionDirection } from '../../types/index.ts';

/**
 * Kind of money movement relative to the user's savings/investment system.
 * - DEPOSIT: money moved from the spending balance into a savings product
 * - WITHDRAWAL: money moved out of a savings product back to the spending balance
 * - INVESTMENT_CONTRIBUTION / INVESTMENT_WITHDRAWAL: only when the statement explicitly supports it
 * - INTEREST: interest credited by the savings provider
 * - INTERNAL_SAVINGS_TRANSFER: vault-to-vault movement (e.g. SafeBox -> OWealth); neither saved nor withdrawn
 */
export type SavingsMovementKind =
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'INVESTMENT_CONTRIBUTION'
  | 'INVESTMENT_WITHDRAWAL'
  | 'INTEREST'
  | 'INTERNAL_SAVINGS_TRANSFER';

/** Provider type is only asserted when the transaction text/category supports it. */
export type SavingsProviderType = 'savings' | 'investment' | 'unverified';

export interface SavingsMovement {
  id: string; // canonical transaction id
  date: string;
  time?: string;
  kind: SavingsMovementKind;
  amount: number;
  provider: string;
  toProvider?: string; // for internal transfers
  description: string;
  direction: TransactionDirection; // direction of the canonical row
  sourceTransactionIds: string[]; // canonical row + any mirrored rows (traceability)
  mirrored: boolean;
}

export interface SavingsProviderSummary {
  provider: string;
  providerType: SavingsProviderType;
  evidence: string;
  deposited: number;
  withdrawn: number;
  invested: number;
  investmentWithdrawn: number;
  interest: number;
  transfersIn: number;
  transfersOut: number;
  netChange: number; // deposits + invested + interest + transfersIn - withdrawn - investmentWithdrawn - transfersOut
  movementCount: number;
}

export interface SavingsTimelinePoint {
  date: string;
  label: string;
  deposits: number;
  withdrawals: number;
  interest: number;
  netFlow: number;
  cumulativeNetFlow: number;
  estimatedBalance?: number; // only when an opening balance anchor exists
}

export interface SavingsWeeklyPoint {
  weekStart: string;
  label: string;
  deposits: number;
  withdrawals: number;
  netFlow: number;
}

export type SavingsPatternType =
  | 'DEPOSIT_THEN_WITHDRAWAL'
  | 'CONSISTENT_SAVER'
  | 'FREQUENT_WITHDRAWALS'
  | 'NET_DRAWDOWN'
  | 'NET_ACCUMULATION'
  | 'INTEREST_EARNED'
  | 'SAVINGS_FUNDED_SPENDING'
  | 'OWEALTH_EXPENSE_FUNDING'
  | 'INFLOW_TO_SAVINGS_SWEEP'
  | 'VAULT_TO_VAULT_TRANSFER'
  | 'NO_SAVINGS_ACTIVITY';

export interface SavingsPattern {
  type: SavingsPatternType;
  severity: 'positive' | 'neutral' | 'attention' | 'warning';
  title: string;
  message: string;
  /** Every number quoted in `message` is listed here with its source field. */
  figures: { label: string; value: number }[];
  relatedTransactionIds: string[];
}

export interface SavingsBalanceReconciliation {
  provider: string;
  openingBalance: number;
  closingBalance: number;
  observedChange: number;
  explainedChange: number;
  difference: number;
  isReconciled: boolean;
}

export interface SavingsMetrics {
  totalDeposited: number;
  totalWithdrawn: number;
  totalInvested: number;
  totalInvestmentWithdrawn: number;
  totalSaved: number; // gross: deposits + investment contributions
  netSavings: number; // totalSaved - totalWithdrawn - totalInvestmentWithdrawn
  netSavingsIncludingInterest: number;
  interestEarned: number;
  interestCreditCount: number;
  annualizedInterestRunRate: number | null; // projection from observed interest; null when no interest data
  internalTransfersTotal: number;
  internalTransferCount: number;
  savingsRate: number | null; // netSavings / audited external income (null when no income)
  grossSavingsRate: number | null; // totalSaved / audited external income
  depositCount: number;
  withdrawalCount: number;
  averageContribution: number;
  averageWithdrawal: number;
  largestContribution: SavingsMovement | null;
  largestWithdrawal: SavingsMovement | null;
  retentionRate: number; // share of deposited money not withdrawn, clamped 0-100
  withdrawalToDepositRatio: number | null;
  // velocity
  periodDays: number;
  depositsPerWeek: number;
  withdrawalsPerWeek: number;
  averageDaysDepositToNextWithdrawal: number | null;
  weeksWithDeposits: number;
  weeksWithWithdrawals: number;
  totalWeeks: number;
}

export interface SavingsReport {
  currency: Currency;
  periodStart: string;
  periodEnd: string;
  metrics: SavingsMetrics;
  movements: SavingsMovement[];
  providers: SavingsProviderSummary[];
  timeline: SavingsTimelinePoint[];
  weekly: SavingsWeeklyPoint[];
  patterns: SavingsPattern[];
  reconciliation: SavingsBalanceReconciliation | null;
  mirroredRowsRemoved: number;
  auditedExternalIncome: number;
}

export interface SavingsBalanceAnchor {
  provider: string;
  openingBalance: number;
  closingBalance: number;
}
