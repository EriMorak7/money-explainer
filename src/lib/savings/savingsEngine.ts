import type { Currency, Transaction } from '../../types/index.ts';
import { round2 } from '../calculations/financialEngine.ts';
import { auditFinancialCalculations } from '../calculations/financialEngine.ts';
import type {
  SavingsBalanceAnchor,
  SavingsBalanceReconciliation,
  SavingsMetrics,
  SavingsMovement,
  SavingsMovementKind,
  SavingsPattern,
  SavingsProviderSummary,
  SavingsProviderType,
  SavingsReport,
  SavingsTimelinePoint,
  SavingsWeeklyPoint,
} from './types.ts';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Extracts the explicit provider name from a transaction.
 * Never assumes an investment provider unless the transaction data supports it.
 */
function extractProvider(description: string, category?: string): { provider: string; providerType: SavingsProviderType; evidence: string } {
  const d = description.toLowerCase();

  if (d.includes('safebox')) {
    return { provider: 'SafeBox (OPay)', providerType: 'savings', evidence: 'Explicit "SafeBox" vault in narration' };
  }
  if (d.includes('owealth')) {
    return { provider: 'OWealth (OPay)', providerType: 'savings', evidence: 'Explicit "OWealth" sweep/vault in narration' };
  }
  if (d.includes('piggyvest')) {
    return { provider: 'PiggyVest', providerType: 'savings', evidence: 'Explicit "PiggyVest" keyword in transaction description' };
  }
  if (d.includes('cowrywise')) {
    const isInvest = d.includes('mutual funds') || d.includes('investment') || category === 'Investment';
    return {
      provider: 'Cowrywise',
      providerType: isInvest ? 'investment' : 'savings',
      evidence: isInvest ? 'Explicit "Cowrywise Mutual Funds Investment" in narration' : 'Cowrywise savings',
    };
  }
  if (d.includes('risevest') || d.includes('bamboo') || d.includes('chaka')) {
    return { provider: d.includes('risevest') ? 'Risevest' : d.includes('bamboo') ? 'Bamboo' : 'Chaka', providerType: 'investment', evidence: 'Regulated micro-investment provider' };
  }
  if (category === 'Investment') {
    return { provider: 'Direct Investment', providerType: 'investment', evidence: 'Classified under Investment category' };
  }
  if (category === 'Savings' || /savings|vault|auto-save/i.test(description)) {
    return { provider: 'Bank Savings Vault', providerType: 'savings', evidence: 'Tagged under Savings category/narration' };
  }

  return { provider: 'Other Reserves', providerType: 'unverified', evidence: 'General reserve outflow/inflow' };
}

/**
 * Checks if a transaction relates to savings, investment, or vault sweeps.
 */
function isSavingsOrInvestmentCandidate(tx: Transaction): boolean {
  if (tx.isSavings) return true;
  if (tx.category === 'Savings' || tx.category === 'Investment' || tx.transactionType === 'SAVINGS_TRANSFER' || tx.transactionType === 'INVESTMENT') {
    return true;
  }
  const d = tx.description.toLowerCase();
  return (
    d.includes('owealth') ||
    d.includes('safebox') ||
    d.includes('piggyvest') ||
    d.includes('cowrywise') ||
    d.includes('risevest') ||
    d.includes('bamboo') ||
    d.includes('auto-save') ||
    d.includes('interest earned') ||
    (d.includes('savings') && !d.includes('saving energy'))
  );
}

/**
 * Main parser that translates raw transactions into normalized canonical savings movements.
 * Handles mirrored pairs from multi-account statements (e.g. OPay Wallet Debit vs Savings Credit for the same sweep).
 */
export function extractSavingsMovements(transactions: Transaction[]): {
  movements: SavingsMovement[];
  mirroredCount: number;
} {
  const candidates = transactions.filter(isSavingsOrInvestmentCandidate);
  const movements: SavingsMovement[] = [];
  const processedIds = new Set<string>();
  let mirroredCount = 0;

  // Sort chronologically
  const sorted = [...candidates].sort((a, b) => {
    const da = `${a.date} ${a.time || '00:00:00'}`;
    const db = `${b.date} ${b.time || '00:00:00'}`;
    return da.localeCompare(db);
  });

  for (let i = 0; i < sorted.length; i++) {
    const tx = sorted[i];
    if (processedIds.has(tx.id)) continue;

    const desc = tx.description;
    const lowerDesc = desc.toLowerCase();
    const amt = round2(tx.amount || (tx.direction === 'DEBIT' ? tx.debit : tx.credit));
    const { provider, providerType } = extractProvider(desc, tx.category);

    // 1. Interest Earned
    if (lowerDesc.includes('interest earned') || (tx.category === 'Investment Return' && lowerDesc.includes('interest'))) {
      processedIds.add(tx.id);
      movements.push({
        id: tx.id,
        date: tx.date,
        time: tx.time,
        kind: 'INTEREST',
        amount: amt,
        provider,
        description: tx.description,
        direction: 'CREDIT',
        sourceTransactionIds: [tx.id],
        mirrored: false,
      });
      continue;
    }

    // 2. Internal Vault Transfer (e.g. SafeBox Withdrawal <-> OWealth Deposit from SafeBox)
    if (lowerDesc.includes('safebox withdrawal') || lowerDesc.includes('owealth deposit(from safebox)')) {
      // Find matching paired transaction with same amount on same date
      const pair = sorted.find(
        (other) =>
          !processedIds.has(other.id) &&
          other.id !== tx.id &&
          other.date === tx.date &&
          Math.abs(round2((other.amount || other.debit || other.credit) - amt)) < 0.01 &&
          (other.description.toLowerCase().includes('safebox withdrawal') ||
            other.description.toLowerCase().includes('owealth deposit'))
      );

      processedIds.add(tx.id);
      const sources = [tx.id];
      if (pair) {
        processedIds.add(pair.id);
        sources.push(pair.id);
        mirroredCount++;
      }

      movements.push({
        id: tx.id,
        date: tx.date,
        time: tx.time,
        kind: 'INTERNAL_SAVINGS_TRANSFER',
        amount: amt,
        provider: 'SafeBox (OPay)',
        toProvider: 'OWealth (OPay)',
        description: 'Internal Vault Transfer: SafeBox → OWealth',
        direction: tx.direction,
        sourceTransactionIds: sources,
        mirrored: Boolean(pair),
      });
      continue;
    }

    // 3. Auto-save Sweep (Look for paired debit in wallet and credit in savings)
    if (lowerDesc.includes('auto-save to owealth')) {
      const pair = sorted.find(
        (other) =>
          !processedIds.has(other.id) &&
          other.id !== tx.id &&
          other.date === tx.date &&
          other.direction !== tx.direction &&
          Math.abs(round2((other.amount || other.debit || other.credit) - amt)) < 0.01 &&
          other.description.toLowerCase().includes('auto-save to owealth')
      );

      processedIds.add(tx.id);
      const sources = [tx.id];
      if (pair) {
        processedIds.add(pair.id);
        sources.push(pair.id);
        mirroredCount++;
      }

      movements.push({
        id: tx.id,
        date: tx.date,
        time: tx.time,
        kind: 'DEPOSIT',
        amount: amt,
        provider: 'OWealth (OPay)',
        description: 'Auto-save to OWealth Sweep',
        direction: 'DEBIT',
        sourceTransactionIds: sources,
        mirrored: Boolean(pair),
      });
      continue;
    }

    // 4. SafeBox Direct Deposit
    if (lowerDesc.includes('safebox deposit')) {
      processedIds.add(tx.id);
      movements.push({
        id: tx.id,
        date: tx.date,
        time: tx.time,
        kind: 'DEPOSIT',
        amount: amt,
        provider: 'SafeBox (OPay)',
        description: tx.description,
        direction: 'DEBIT',
        sourceTransactionIds: [tx.id],
        mirrored: false,
      });
      continue;
    }

    // 5. OWealth Withdrawal (Transaction Payment / Withdrawal to Wallet)
    if (lowerDesc.includes('owealth withdrawal') || lowerDesc === '(transaction payment)') {
      // Check for mirrored pair (one debit, one credit row for the same sweep)
      const pair = sorted.find(
        (other) =>
          !processedIds.has(other.id) &&
          other.id !== tx.id &&
          other.date === tx.date &&
          other.direction !== tx.direction &&
          Math.abs(round2((other.amount || other.debit || other.credit) - amt)) < 0.01 &&
          other.description.toLowerCase().includes('owealth withdrawal')
      );

      processedIds.add(tx.id);
      const sources = [tx.id];
      if (pair) {
        processedIds.add(pair.id);
        sources.push(pair.id);
        mirroredCount++;
      }

      movements.push({
        id: tx.id,
        date: tx.date,
        time: tx.time,
        kind: 'WITHDRAWAL',
        amount: amt,
        provider: 'OWealth (OPay)',
        description: tx.description,
        direction: 'CREDIT',
        sourceTransactionIds: sources,
        mirrored: Boolean(pair),
      });
      continue;
    }

    // 6. Generic or external savings / investment
    processedIds.add(tx.id);
    let kind: SavingsMovementKind = 'DEPOSIT';

    if (providerType === 'investment') {
      kind = tx.direction === 'DEBIT' ? 'INVESTMENT_CONTRIBUTION' : 'INVESTMENT_WITHDRAWAL';
    } else {
      kind = tx.direction === 'DEBIT' ? 'DEPOSIT' : 'WITHDRAWAL';
    }

    movements.push({
      id: tx.id,
      date: tx.date,
      time: tx.time,
      kind,
      amount: amt,
      provider,
      description: tx.description,
      direction: tx.direction,
      sourceTransactionIds: [tx.id],
      mirrored: false,
    });
  }

  return { movements, mirroredCount };
}

/**
 * Aggregates provider summaries.
 */
function computeProviderSummaries(movements: SavingsMovement[]): SavingsProviderSummary[] {
  const map = new Map<string, SavingsProviderSummary>();

  for (const m of movements) {
    const existing = map.get(m.provider) || {
      provider: m.provider,
      providerType: m.kind.includes('INVESTMENT') ? 'investment' : 'savings',
      evidence: `Observed ${m.provider} transactions in statement records`,
      deposited: 0,
      withdrawn: 0,
      invested: 0,
      investmentWithdrawn: 0,
      interest: 0,
      transfersIn: 0,
      transfersOut: 0,
      netChange: 0,
      movementCount: 0,
    };

    existing.movementCount++;

    if (m.kind === 'DEPOSIT') {
      existing.deposited = round2(existing.deposited + m.amount);
      existing.netChange = round2(existing.netChange + m.amount);
    } else if (m.kind === 'WITHDRAWAL') {
      existing.withdrawn = round2(existing.withdrawn + m.amount);
      existing.netChange = round2(existing.netChange - m.amount);
    } else if (m.kind === 'INVESTMENT_CONTRIBUTION') {
      existing.invested = round2(existing.invested + m.amount);
      existing.netChange = round2(existing.netChange + m.amount);
      existing.providerType = 'investment';
    } else if (m.kind === 'INVESTMENT_WITHDRAWAL') {
      existing.investmentWithdrawn = round2(existing.investmentWithdrawn + m.amount);
      existing.netChange = round2(existing.netChange - m.amount);
      existing.providerType = 'investment';
    } else if (m.kind === 'INTEREST') {
      existing.interest = round2(existing.interest + m.amount);
      existing.netChange = round2(existing.netChange + m.amount);
    } else if (m.kind === 'INTERNAL_SAVINGS_TRANSFER') {
      existing.transfersOut = round2(existing.transfersOut + m.amount);
      existing.netChange = round2(existing.netChange - m.amount);

      // Also record transfersIn on target provider if known
      if (m.toProvider) {
        const target = map.get(m.toProvider) || {
          provider: m.toProvider,
          providerType: 'savings',
          evidence: `Destination for internal transfer from ${m.provider}`,
          deposited: 0,
          withdrawn: 0,
          invested: 0,
          investmentWithdrawn: 0,
          interest: 0,
          transfersIn: 0,
          transfersOut: 0,
          netChange: 0,
          movementCount: 0,
        };
        target.transfersIn = round2(target.transfersIn + m.amount);
        target.netChange = round2(target.netChange + m.amount);
        map.set(m.toProvider, target);
      }
    }

    map.set(m.provider, existing);
  }

  return Array.from(map.values()).sort((a, b) => (b.deposited + b.invested) - (a.deposited + a.invested));
}

/**
 * Builds daily and weekly visual savings timeline points.
 */
function buildTimelines(
  movements: SavingsMovement[],
  periodStart: string,
  periodEnd: string,
  anchorOpeningBalance?: number
): { timeline: SavingsTimelinePoint[]; weekly: SavingsWeeklyPoint[] } {
  const dailyMap = new Map<string, { deposits: number; withdrawals: number; interest: number }>();

  for (const m of movements) {
    const cur = dailyMap.get(m.date) || { deposits: 0, withdrawals: 0, interest: 0 };
    if (m.kind === 'DEPOSIT' || m.kind === 'INVESTMENT_CONTRIBUTION') {
      cur.deposits = round2(cur.deposits + m.amount);
    } else if (m.kind === 'WITHDRAWAL' || m.kind === 'INVESTMENT_WITHDRAWAL') {
      cur.withdrawals = round2(cur.withdrawals + m.amount);
    } else if (m.kind === 'INTEREST') {
      cur.interest = round2(cur.interest + m.amount);
    }
    dailyMap.set(m.date, cur);
  }

  // Ensure all days between start and end or distinct active days exist
  const sortedDates = Array.from(dailyMap.keys()).sort();
  let cumulative = 0;
  let runningEstimated = anchorOpeningBalance !== undefined ? anchorOpeningBalance : undefined;

  const timeline: SavingsTimelinePoint[] = sortedDates.map((date) => {
    const d = dailyMap.get(date)!;
    const netFlow = round2(d.deposits + d.interest - d.withdrawals);
    cumulative = round2(cumulative + netFlow);
    if (runningEstimated !== undefined) {
      runningEstimated = round2(runningEstimated + netFlow);
    }

    const parts = date.split('-');
    const label = parts.length === 3 ? `${parseInt(parts[2], 10)} ${MONTH_NAMES[parseInt(parts[1], 10) - 1]}` : date;

    return {
      date,
      label,
      deposits: d.deposits,
      withdrawals: d.withdrawals,
      interest: d.interest,
      netFlow,
      cumulativeNetFlow: cumulative,
      estimatedBalance: runningEstimated,
    };
  });

  // Build weekly points
  const weeklyMap = new Map<string, { deposits: number; withdrawals: number; netFlow: number }>();

  for (const pt of timeline) {
    // Week start: calculate Monday or date slice
    const weekKey = pt.date.slice(0, 7); // group by week/month slice for clean display
    const w = weeklyMap.get(weekKey) || { deposits: 0, withdrawals: 0, netFlow: 0 };
    w.deposits = round2(w.deposits + pt.deposits);
    w.withdrawals = round2(w.withdrawals + pt.withdrawals);
    w.netFlow = round2(w.netFlow + pt.netFlow);
    weeklyMap.set(weekKey, w);
  }

  const weekly: SavingsWeeklyPoint[] = Array.from(weeklyMap.entries()).map(([k, v]) => ({
    weekStart: k,
    label: k,
    deposits: v.deposits,
    withdrawals: v.withdrawals,
    netFlow: v.netFlow,
  }));

  return { timeline, weekly };
}

/**
 * Detects behavioral savings patterns:
 * - Vault-to-vault internal wealth movements (e.g. SafeBox -> OWealth)
 * - OWealth auto-funding sweep for living expenses
 * - Immediate savings sweep from external inflow
 * - Deposit then immediate withdrawal leakage (e.g. ₦100,000 in, ₦70,000 out within 12 days)
 * - Consistent saver vs frequent withdrawal leakage
 * - Interest earned patterns
 * - Net accumulation vs Net drawdown
 */
export function detectSavingsPatterns(
  movements: SavingsMovement[],
  metrics: SavingsMetrics,
  allTransactions: Transaction[] = []
): SavingsPattern[] {
  const patterns: SavingsPattern[] = [];

  if (movements.length === 0) {
    patterns.push({
      type: 'NO_SAVINGS_ACTIVITY',
      severity: 'neutral',
      title: 'No Dedicated Savings Activity Detected',
      message: 'No transfers to external savings vaults (OWealth, SafeBox, PiggyVest, Cowrywise) were detected in this statement period.',
      figures: [],
      relatedTransactionIds: [],
    });
    return patterns;
  }

  // 1. Vault-to-Vault Internal Wealth Movement
  const vaultTransfers = movements.filter((m) => m.kind === 'INTERNAL_SAVINGS_TRANSFER');
  if (vaultTransfers.length > 0) {
    const firstVt = vaultTransfers[0];
    patterns.push({
      type: 'VAULT_TO_VAULT_TRANSFER',
      severity: 'positive',
      title: 'Internal Wealth Movement (Vault-to-Vault)',
      message: `Internal transfers between savings vaults (${firstVt.provider} → ${firstVt.toProvider || 'OWealth'}) totaling ₦${firstVt.amount.toLocaleString()} were detected on ${firstVt.date}. These movements are preserved as wealth and not counted as income or spending.`,
      figures: [
        { label: 'Vault Movement', value: firstVt.amount },
        { label: 'Total Vault Transfers', value: vaultTransfers.reduce((sum, v) => sum + v.amount, 0) },
      ],
      relatedTransactionIds: firstVt.sourceTransactionIds,
    });
  }

  // 2. OWealth Auto-Funding of Living Expenses
  const owealthWithdrawals = movements.filter((m) => m.provider.includes('OWealth') && m.kind === 'WITHDRAWAL');
  for (const ow of owealthWithdrawals) {
    const expenseMatch = allTransactions.find((tx) =>
      tx.isExpense &&
      tx.date === ow.date &&
      Math.abs(round2(tx.amount - ow.amount)) < 0.01 &&
      !tx.description.toLowerCase().includes('owealth') &&
      !tx.description.toLowerCase().includes('safebox')
    );
    if (expenseMatch) {
      patterns.push({
        type: 'OWEALTH_EXPENSE_FUNDING',
        severity: 'neutral',
        title: 'OWealth Sweep Used as Expense Funding Source',
        message: `₦${ow.amount.toLocaleString()} was swept from OWealth to your wallet on ${ow.date} to fund an expense for "${expenseMatch.merchant || expenseMatch.description}". The withdrawal acts as a funding source, not income.`,
        figures: [
          { label: 'OWealth Sweep', value: ow.amount },
          { label: 'Funded Expense', value: expenseMatch.amount },
        ],
        relatedTransactionIds: [...ow.sourceTransactionIds, expenseMatch.id],
      });
      break;
    }
  }

  // 3. Immediate Savings Sweep from Inflow
  const autoSaves = movements.filter((m) => m.description.toLowerCase().includes('auto-save') && m.kind === 'DEPOSIT');
  for (const as of autoSaves) {
    const inflowMatch = allTransactions.find((tx) =>
      tx.direction === 'CREDIT' &&
      tx.date === as.date &&
      Math.abs(round2(tx.amount - as.amount)) < 0.01 &&
      !tx.description.toLowerCase().includes('owealth') &&
      !tx.description.toLowerCase().includes('safebox')
    );
    if (inflowMatch) {
      patterns.push({
        type: 'INFLOW_TO_SAVINGS_SWEEP',
        severity: 'positive',
        title: 'Inflow Immediately Swept to OWealth',
        message: `₦${inflowMatch.amount.toLocaleString()} received on ${as.date} was auto-saved to OWealth Balance on the same day. This internal transfer preserves capital without double-counting as an expense.`,
        figures: [
          { label: 'External Inflow', value: inflowMatch.amount },
          { label: 'Auto-Saved to OWealth', value: as.amount },
        ],
        relatedTransactionIds: [inflowMatch.id, ...as.sourceTransactionIds],
      });
      break;
    }
  }

  // 4. Specific Pattern: Deposit followed by subsequent withdrawal
  const deposits = movements.filter((m) => m.kind === 'DEPOSIT' || m.kind === 'INVESTMENT_CONTRIBUTION');
  const withdrawals = movements.filter((m) => m.kind === 'WITHDRAWAL' || m.kind === 'INVESTMENT_WITHDRAWAL');

  for (const dep of deposits) {
    if (dep.amount >= 20000) {
      // Find subsequent withdrawal within 14 days of substantial size
      const subsequent = withdrawals.filter((w) => {
        if (w.date < dep.date) return false;
        const diffDays = Math.round((new Date(w.date).getTime() - new Date(dep.date).getTime()) / (1000 * 3600 * 24));
        return diffDays >= 0 && diffDays <= 14 && w.amount >= dep.amount * 0.4;
      });

      if (subsequent.length > 0) {
        const firstW = subsequent[0];
        const diffDays = Math.round((new Date(firstW.date).getTime() - new Date(dep.date).getTime()) / (1000 * 3600 * 24));
        const dayLabel = diffDays === 0 ? 'same day' : `${diffDays} days later`;

        patterns.push({
          type: 'DEPOSIT_THEN_WITHDRAWAL',
          severity: 'attention',
          title: 'Deposit Followed by Subsequent Withdrawal',
          message: `₦${dep.amount.toLocaleString()} was deposited into ${dep.provider} on ${dep.date} and ₦${firstW.amount.toLocaleString()} was withdrawn ${dayLabel} (${firstW.date}).`,
          figures: [
            { label: 'Deposited', value: dep.amount },
            { label: 'Withdrawn', value: firstW.amount },
            { label: 'Days Between', value: diffDays },
          ],
          relatedTransactionIds: [...dep.sourceTransactionIds, ...firstW.sourceTransactionIds],
        });
        break; // Only show most significant example
      }
    }
  }

  // 5. Consistent Saver vs Frequent Withdrawals
  if (metrics.depositCount >= 4 && metrics.withdrawalCount >= 8) {
    patterns.push({
      type: 'FREQUENT_WITHDRAWALS',
      severity: 'warning',
      title: 'Frequent Savings Drawdown Observed',
      message: `You saved consistently with ${metrics.depositCount} contributions (totaling ₦${metrics.totalDeposited.toLocaleString()}), but withdrew savings ${metrics.withdrawalCount} times (totaling ₦${metrics.totalWithdrawn.toLocaleString()}), resulting in a ${metrics.retentionRate.toFixed(1)}% retention rate.`,
      figures: [
        { label: 'Contributions', value: metrics.depositCount },
        { label: 'Withdrawals', value: metrics.withdrawalCount },
        { label: 'Retention Rate %', value: metrics.retentionRate },
      ],
      relatedTransactionIds: withdrawals.slice(0, 5).flatMap((w) => w.sourceTransactionIds),
    });
  } else if (metrics.depositCount >= 2 && metrics.retentionRate >= 70) {
    patterns.push({
      type: 'CONSISTENT_SAVER',
      severity: 'positive',
      title: 'High Capital Retention Habit',
      message: `Strong wealth preservation: ${metrics.retentionRate.toFixed(1)}% of your ₦${metrics.totalSaved.toLocaleString()} savings contributions were retained without premature drawdown.`,
      figures: [
        { label: 'Total Saved', value: metrics.totalSaved },
        { label: 'Net Preserved', value: metrics.netSavings },
        { label: 'Retention %', value: metrics.retentionRate },
      ],
      relatedTransactionIds: deposits.slice(0, 5).flatMap((d) => d.sourceTransactionIds),
    });
  }

  // 6. Interest Earned
  if (metrics.interestEarned > 0) {
    const annualProj = metrics.annualizedInterestRunRate ? ` (~₦${metrics.annualizedInterestRunRate.toLocaleString()} annualized projection)` : '';
    patterns.push({
      type: 'INTEREST_EARNED',
      severity: 'positive',
      title: 'Yield Generation Verified',
      message: `Your savings generated ₦${metrics.interestEarned.toLocaleString()} in interest yield across ${metrics.interestCreditCount} credits${annualProj}.`,
      figures: [
        { label: 'Interest Earned', value: metrics.interestEarned },
        { label: 'Credits Count', value: metrics.interestCreditCount },
      ],
      relatedTransactionIds: movements.filter((m) => m.kind === 'INTEREST').slice(0, 5).map((m) => m.id),
    });
  }

  // 7. Net Drawdown vs Accumulation
  if (metrics.netSavings < 0) {
    patterns.push({
      type: 'NET_DRAWDOWN',
      severity: 'warning',
      title: 'Net Savings Depletion',
      message: `Withdrawals exceeded new savings contributions by ₦${Math.abs(metrics.netSavings).toLocaleString()} over this statement period.`,
      figures: [
        { label: 'Net Deficit', value: Math.abs(metrics.netSavings) },
      ],
      relatedTransactionIds: withdrawals.slice(0, 5).flatMap((w) => w.sourceTransactionIds),
    });
  }

  return patterns;
}

/**
 * Computes dedicated savings & wealth report from transaction records.
 */
export function computeSavingsReport(
  transactions: Transaction[],
  anchor?: SavingsBalanceAnchor,
  currency: Currency = 'NGN'
): SavingsReport {
  const audit = auditFinancialCalculations(transactions, 0, 0, currency);
  const { movements, mirroredCount } = extractSavingsMovements(transactions);

  // Period Days
  const dates = transactions.map((t) => t.date).filter(Boolean).sort();
  const periodStart = dates[0] || '2026-01-01';
  const periodEnd = dates[dates.length - 1] || '2026-12-31';
  let periodDays = 30;
  if (dates.length >= 2) {
    const diff = Math.round((new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / (1000 * 3600 * 24)) + 1;
    if (diff > 0 && diff <= 365) periodDays = diff;
  }

  // Group movement totals
  let totalDeposited = 0;
  let totalWithdrawn = 0;
  let totalInvested = 0;
  let totalInvestmentWithdrawn = 0;
  let interestEarned = 0;
  let interestCreditCount = 0;
  let internalTransfersTotal = 0;
  let internalTransferCount = 0;

  const depositMovements: SavingsMovement[] = [];
  const withdrawalMovements: SavingsMovement[] = [];

  for (const m of movements) {
    if (m.kind === 'DEPOSIT') {
      totalDeposited = round2(totalDeposited + m.amount);
      depositMovements.push(m);
    } else if (m.kind === 'WITHDRAWAL') {
      totalWithdrawn = round2(totalWithdrawn + m.amount);
      withdrawalMovements.push(m);
    } else if (m.kind === 'INVESTMENT_CONTRIBUTION') {
      totalInvested = round2(totalInvested + m.amount);
      depositMovements.push(m);
    } else if (m.kind === 'INVESTMENT_WITHDRAWAL') {
      totalInvestmentWithdrawn = round2(totalInvestmentWithdrawn + m.amount);
      withdrawalMovements.push(m);
    } else if (m.kind === 'INTEREST') {
      interestEarned = round2(interestEarned + m.amount);
      interestCreditCount++;
    } else if (m.kind === 'INTERNAL_SAVINGS_TRANSFER') {
      internalTransfersTotal = round2(internalTransfersTotal + m.amount);
      internalTransferCount++;
    }
  }

  const totalSaved = round2(totalDeposited + totalInvested);
  const netSavings = round2(totalSaved - totalWithdrawn - totalInvestmentWithdrawn);
  const netSavingsIncludingInterest = round2(netSavings + interestEarned);

  // Ratios
  const retentionRate = totalSaved > 0 ? Math.max(0, Math.min(100, round2((netSavings / totalSaved) * 100))) : 0;
  const withdrawalToDepositRatio = totalSaved > 0 ? round2((totalWithdrawn + totalInvestmentWithdrawn) / totalSaved) : null;
  const savingsRate = audit.income.totalIncome > 0 ? round2((netSavings / audit.income.totalIncome) * 100) : null;
  const grossSavingsRate = audit.income.totalIncome > 0 ? round2((totalSaved / audit.income.totalIncome) * 100) : null;

  // Velocity & Averages
  const depositCount = depositMovements.length;
  const withdrawalCount = withdrawalMovements.length;
  const averageContribution = depositCount > 0 ? round2(totalSaved / depositCount) : 0;
  const averageWithdrawal = withdrawalCount > 0 ? round2((totalWithdrawn + totalInvestmentWithdrawn) / withdrawalCount) : 0;

  const largestContribution = depositMovements.length > 0
    ? [...depositMovements].sort((a, b) => b.amount - a.amount)[0]
    : null;

  const largestWithdrawal = withdrawalMovements.length > 0
    ? [...withdrawalMovements].sort((a, b) => b.amount - a.amount)[0]
    : null;

  const weeksCount = Math.max(1, Math.round(periodDays / 7));
  const depositsPerWeek = round2(depositCount / weeksCount);
  const withdrawalsPerWeek = round2(withdrawalCount / weeksCount);

  // Annualized interest estimation
  const annualizedInterestRunRate = interestEarned > 0 && periodDays > 0
    ? round2((interestEarned / periodDays) * 365)
    : null;

  // Average days from deposit to next withdrawal
  let avgDaysToWithdrawal: number | null = null;
  if (depositMovements.length > 0 && withdrawalMovements.length > 0) {
    let totalDaysDiff = 0;
    let pairedCount = 0;
    for (const d of depositMovements) {
      const nextW = withdrawalMovements.find((w) => w.date >= d.date);
      if (nextW) {
        const diff = Math.round((new Date(nextW.date).getTime() - new Date(d.date).getTime()) / (1000 * 3600 * 24));
        totalDaysDiff += diff;
        pairedCount++;
      }
    }
    if (pairedCount > 0) {
      avgDaysToWithdrawal = round2(totalDaysDiff / pairedCount);
    }
  }

  const metrics: SavingsMetrics = {
    totalDeposited,
    totalWithdrawn,
    totalInvested,
    totalInvestmentWithdrawn,
    totalSaved,
    netSavings,
    netSavingsIncludingInterest,
    interestEarned,
    interestCreditCount,
    annualizedInterestRunRate,
    internalTransfersTotal,
    internalTransferCount,
    savingsRate,
    grossSavingsRate,
    depositCount,
    withdrawalCount,
    averageContribution,
    averageWithdrawal,
    largestContribution,
    largestWithdrawal,
    retentionRate,
    withdrawalToDepositRatio,
    periodDays,
    depositsPerWeek,
    withdrawalsPerWeek,
    averageDaysDepositToNextWithdrawal: avgDaysToWithdrawal,
    weeksWithDeposits: Math.min(weeksCount, depositCount),
    weeksWithWithdrawals: Math.min(weeksCount, withdrawalCount),
    totalWeeks: weeksCount,
  };

  const providers = computeProviderSummaries(movements);
  const { timeline, weekly } = buildTimelines(movements, periodStart, periodEnd, anchor?.openingBalance);
  const patterns = detectSavingsPatterns(movements, metrics, transactions);

  // Balance reconciliation if anchor provided
  let reconciliation: SavingsBalanceReconciliation | null = null;
  if (anchor) {
    const observedChange = round2(anchor.closingBalance - anchor.openingBalance);
    const explainedChange = netSavingsIncludingInterest;
    const difference = round2(observedChange - explainedChange);
    reconciliation = {
      provider: anchor.provider,
      openingBalance: anchor.openingBalance,
      closingBalance: anchor.closingBalance,
      observedChange,
      explainedChange,
      difference,
      isReconciled: Math.abs(difference) <= 1.0,
    };
  }

  return {
    currency,
    periodStart,
    periodEnd,
    metrics,
    movements,
    providers,
    timeline,
    weekly,
    patterns,
    reconciliation,
    mirroredRowsRemoved: mirroredCount,
    auditedExternalIncome: audit.income.totalIncome,
  };
}
