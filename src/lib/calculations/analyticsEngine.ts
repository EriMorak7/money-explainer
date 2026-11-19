import type { Currency, SpendingCategoryGroup, Transaction, TransactionCategory } from '../../types/index.ts';
import {
  auditFinancialCalculations,
  CATEGORY_COLORS,
  isExcludedFromLivingExpenses,
  round2,
} from './financialEngine.ts';
import type {
  AnalyticsReport,
  CategoryAnalyticsItem,
  CategoryGroupAnalyticsItem,
  DailyTrendPoint,
  DayOfWeekFrequencyItem,
  HighestSpendingDayItem,
  LargestTransactionsAnalytics,
  MerchantAnalyticsItem,
  MonthlyTrendPoint,
  SavingsTrendAnalytics,
  SavingsTrendPoint,
  TimeOfDayFrequencyItem,
  TopCreditTransactionItem,
  TopDebitTransactionItem,
  TransactionFrequencyAnalytics,
  WeeklyTrendPoint,
} from './analyticsTypes.ts';

const GROUP_COLORS: Record<SpendingCategoryGroup, string> = {
  'Essential Spending': '#2563eb', // Blue
  'Lifestyle': '#f43f5e', // Rose
  'Financial': '#0d9488', // Teal
  'Giving': '#8b5cf6', // Violet
  'Discretionary': '#dc2626', // Red
  'Income': '#10b981', // Emerald
  'Other': '#64748b', // Slate
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Computes granular spending analytics broken down by category.
 */
export function computeCategoryAnalytics(
  transactions: Transaction[],
  grossLivingExpenses: number
): CategoryAnalyticsItem[] {
  const map = new Map<
    TransactionCategory,
    {
      group: SpendingCategoryGroup;
      totalSpent: number;
      count: number;
      max: number;
    }
  >();

  for (const tx of transactions) {
    if (tx.isExpense && !isExcludedFromLivingExpenses(tx)) {
      const amt = tx.debit || tx.amount;
      const cat = tx.category || 'Other';
      const existing = map.get(cat) || {
        group: tx.categoryGroup || 'Other',
        totalSpent: 0,
        count: 0,
        max: 0,
      };

      existing.totalSpent = round2(existing.totalSpent + amt);
      existing.count += 1;
      if (amt > existing.max) {
        existing.max = round2(amt);
      }
      map.set(cat, existing);
    }
  }

  const items: CategoryAnalyticsItem[] = [];
  const baseSpending = grossLivingExpenses > 0 ? grossLivingExpenses : 1;

  for (const [cat, data] of map.entries()) {
    items.push({
      category: cat,
      categoryGroup: data.group,
      totalSpent: round2(data.totalSpent),
      percentageOfTotal: round2((data.totalSpent / baseSpending) * 100),
      transactionCount: data.count,
      averageTransaction: round2(data.totalSpent / (data.count || 1)),
      maxTransaction: round2(data.max),
      color: CATEGORY_COLORS[cat] || '#64748b',
    });
  }

  return items.sort((a, b) => b.totalSpent - a.totalSpent);
}

/**
 * Computes high-level spending analytics broken down by category group (Essential, Lifestyle, etc.).
 */
export function computeCategoryGroupAnalytics(
  categoryItems: CategoryAnalyticsItem[],
  grossLivingExpenses: number
): CategoryGroupAnalyticsItem[] {
  const map = new Map<SpendingCategoryGroup, { totalSpent: number; count: number; catCount: number }>();
  const baseSpending = grossLivingExpenses > 0 ? grossLivingExpenses : 1;

  for (const item of categoryItems) {
    const grp = item.categoryGroup;
    const existing = map.get(grp) || { totalSpent: 0, count: 0, catCount: 0 };
    existing.totalSpent = round2(existing.totalSpent + item.totalSpent);
    existing.count += item.transactionCount;
    existing.catCount += 1;
    map.set(grp, existing);
  }

  const items: CategoryGroupAnalyticsItem[] = [];
  for (const [group, val] of map.entries()) {
    items.push({
      group,
      totalSpent: round2(val.totalSpent),
      percentageOfTotal: round2((val.totalSpent / baseSpending) * 100),
      transactionCount: val.count,
      categoryCount: val.catCount,
      color: GROUP_COLORS[group] || '#64748b',
    });
  }

  return items.sort((a, b) => b.totalSpent - a.totalSpent);
}

/**
 * Computes spending by merchant with frequency, average ticket, and date spans.
 */
export function computeMerchantAnalytics(
  transactions: Transaction[],
  grossLivingExpenses: number,
  limit = 25
): MerchantAnalyticsItem[] {
  const map = new Map<
    string,
    {
      category: TransactionCategory;
      group: SpendingCategoryGroup;
      totalSpent: number;
      count: number;
      max: number;
      firstDate: string;
      lastDate: string;
    }
  >();

  for (const tx of transactions) {
    if (tx.isExpense && !isExcludedFromLivingExpenses(tx)) {
      const merchant = tx.merchant || tx.description.split('|')[0].trim();
      const amt = tx.debit || tx.amount;
      const existing = map.get(merchant) || {
        category: tx.category,
        group: tx.categoryGroup || 'Other',
        totalSpent: 0,
        count: 0,
        max: 0,
        firstDate: tx.date,
        lastDate: tx.date,
      };

      existing.totalSpent = round2(existing.totalSpent + amt);
      existing.count += 1;
      if (amt > existing.max) existing.max = round2(amt);
      if (tx.date < existing.firstDate) existing.firstDate = tx.date;
      if (tx.date > existing.lastDate) existing.lastDate = tx.date;

      map.set(merchant, existing);
    }
  }

  const baseSpending = grossLivingExpenses > 0 ? grossLivingExpenses : 1;
  const items: MerchantAnalyticsItem[] = [];

  for (const [merchant, val] of map.entries()) {
    items.push({
      merchant,
      category: val.category,
      categoryGroup: val.group,
      totalSpent: round2(val.totalSpent),
      percentageOfTotal: round2((val.totalSpent / baseSpending) * 100),
      transactionCount: val.count,
      averageTransaction: round2(val.totalSpent / val.count),
      maxTransaction: round2(val.max),
      firstDate: val.firstDate,
      lastDate: val.lastDate,
    });
  }

  return items.sort((a, b) => b.totalSpent - a.totalSpent).slice(0, limit);
}

/**
 * Computes daily, weekly, and monthly trends across the statement timeframe.
 */
export function computeTimelineTrends(transactions: Transaction[]): {
  daily: DailyTrendPoint[];
  weekly: WeeklyTrendPoint[];
  monthly: MonthlyTrendPoint[];
} {
  const dailyMap = new Map<
    string,
    {
      spending: number;
      income: number;
      savingsDeposits: number;
      savingsWithdrawals: number;
      count: number;
    }
  >();

  for (const tx of transactions) {
    const d = tx.date;
    const existing = dailyMap.get(d) || {
      spending: 0,
      income: 0,
      savingsDeposits: 0,
      savingsWithdrawals: 0,
      count: 0,
    };

    existing.count += 1;

    // True External Income
    if (tx.isIncome && !tx.isInternalTransfer && !tx.isRefund && !tx.isSavings) {
      existing.income = round2(existing.income + (tx.credit || tx.amount));
    }

    // Gross Living Expenses
    if (tx.isExpense && !isExcludedFromLivingExpenses(tx)) {
      existing.spending = round2(existing.spending + (tx.debit || tx.amount));
    }

    // Savings sweeps
    if (
      tx.isSavings ||
      tx.transactionType === 'SAVINGS_TRANSFER' ||
      (tx.direction === 'DEBIT' && /owealth|piggyvest|cowrywise|savings/i.test(tx.description))
    ) {
      existing.savingsDeposits = round2(existing.savingsDeposits + (tx.debit || tx.amount));
    }

    // Savings withdrawals
    if (
      tx.direction === 'CREDIT' &&
      (tx.isSavings || /owealth withdrawal|savings withdrawal/i.test(tx.description))
    ) {
      existing.savingsWithdrawals = round2(existing.savingsWithdrawals + (tx.credit || tx.amount));
    }

    dailyMap.set(d, existing);
  }

  // Sort daily dates
  const sortedDates = Array.from(dailyMap.keys()).sort();

  const daily: DailyTrendPoint[] = sortedDates.map((date) => {
    const v = dailyMap.get(date)!;
    const parts = date.split('-');
    let dayLabel = date;
    if (parts.length === 3) {
      const mIdx = parseInt(parts[1], 10) - 1;
      dayLabel = `${parseInt(parts[2], 10)} ${MONTH_NAMES[mIdx] || parts[1]}`;
    }

    const netSavings = round2(v.savingsDeposits - v.savingsWithdrawals);
    const netCashFlow = round2(v.income - v.spending);

    return {
      date,
      dayLabel,
      spending: v.spending,
      income: v.income,
      savingsDeposits: v.savingsDeposits,
      savingsWithdrawals: v.savingsWithdrawals,
      netSavings,
      netCashFlow,
      transactionCount: v.count,
    };
  });

  // Aggregate Weekly Trends
  const weeklyMap = new Map<
    string,
    {
      weekNumber: number;
      startDate: string;
      endDate: string;
      spending: number;
      income: number;
      savingsDeposits: number;
      savingsWithdrawals: number;
      count: number;
    }
  >();

  for (const pt of daily) {
    const dt = new Date(`${pt.date}T12:00:00Z`);
    // Find Monday of the week
    const day = dt.getUTCDay();
    const diff = dt.getUTCDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(dt.setDate(diff));
    const startStr = monday.toISOString().slice(0, 10);

    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const endStr = sunday.toISOString().slice(0, 10);

    // Compute simple week key
    const weekKey = `${startStr}_${endStr}`;
    const existing = weeklyMap.get(weekKey) || {
      weekNumber: Math.ceil((dt.getUTCDate() + 6) / 7),
      startDate: startStr,
      endDate: endStr,
      spending: 0,
      income: 0,
      savingsDeposits: 0,
      savingsWithdrawals: 0,
      count: 0,
    };

    existing.spending = round2(existing.spending + pt.spending);
    existing.income = round2(existing.income + pt.income);
    existing.savingsDeposits = round2(existing.savingsDeposits + pt.savingsDeposits);
    existing.savingsWithdrawals = round2(existing.savingsWithdrawals + pt.savingsWithdrawals);
    existing.count += pt.transactionCount;

    weeklyMap.set(weekKey, existing);
  }

  const sortedWeeks = Array.from(weeklyMap.keys()).sort();
  const weekly: WeeklyTrendPoint[] = sortedWeeks.map((key, idx) => {
    const v = weeklyMap.get(key)!;
    const startParts = v.startDate.split('-');
    const endParts = v.endDate.split('-');
    const sLabel = `${parseInt(startParts[2], 10)} ${MONTH_NAMES[parseInt(startParts[1], 10) - 1]}`;
    const eLabel = `${parseInt(endParts[2], 10)} ${MONTH_NAMES[parseInt(endParts[1], 10) - 1]}`;

    return {
      weekKey: `W${idx + 1}`,
      weekNumber: idx + 1,
      label: `${sLabel} - ${eLabel}`,
      startDate: v.startDate,
      endDate: v.endDate,
      spending: v.spending,
      income: v.income,
      savingsDeposits: v.savingsDeposits,
      savingsWithdrawals: v.savingsWithdrawals,
      netSavings: round2(v.savingsDeposits - v.savingsWithdrawals),
      netCashFlow: round2(v.income - v.spending),
      transactionCount: v.count,
    };
  });

  // Aggregate Monthly Trends
  const monthlyMap = new Map<
    string,
    {
      year: number;
      month: number;
      spending: number;
      income: number;
      savingsDeposits: number;
      savingsWithdrawals: number;
      count: number;
    }
  >();

  for (const pt of daily) {
    const ym = pt.date.slice(0, 7); // YYYY-MM
    const parts = ym.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);

    const existing = monthlyMap.get(ym) || {
      year: y,
      month: m,
      spending: 0,
      income: 0,
      savingsDeposits: 0,
      savingsWithdrawals: 0,
      count: 0,
    };

    existing.spending = round2(existing.spending + pt.spending);
    existing.income = round2(existing.income + pt.income);
    existing.savingsDeposits = round2(existing.savingsDeposits + pt.savingsDeposits);
    existing.savingsWithdrawals = round2(existing.savingsWithdrawals + pt.savingsWithdrawals);
    existing.count += pt.transactionCount;

    monthlyMap.set(ym, existing);
  }

  const sortedMonths = Array.from(monthlyMap.keys()).sort();
  const monthly: MonthlyTrendPoint[] = sortedMonths.map((ym) => {
    const v = monthlyMap.get(ym)!;
    return {
      monthKey: ym,
      label: `${MONTH_NAMES[v.month - 1]} ${v.year}`,
      year: v.year,
      month: v.month,
      spending: v.spending,
      income: v.income,
      savingsDeposits: v.savingsDeposits,
      savingsWithdrawals: v.savingsWithdrawals,
      netSavings: round2(v.savingsDeposits - v.savingsWithdrawals),
      netCashFlow: round2(v.income - v.spending),
      transactionCount: v.count,
    };
  });

  return { daily, weekly, monthly };
}

/**
 * Computes savings inflows, outflows, net retained capital, and cumulative balance trajectory over time.
 */
export function computeSavingsTrends(transactions: Transaction[]): SavingsTrendAnalytics {
  const dailySavingsMap = new Map<string, { deposits: number; withdrawals: number }>();

  let totalDeposited = 0;
  let totalWithdrawn = 0;
  let highestSingleDeposit = { amount: 0, date: '', description: '' };

  for (const tx of transactions) {
    const isSweep =
      tx.isSavings ||
      tx.transactionType === 'SAVINGS_TRANSFER' ||
      (tx.direction === 'DEBIT' && /owealth|piggyvest|cowrywise|savings/i.test(tx.description));

    const isWithdrawal =
      tx.direction === 'CREDIT' &&
      (tx.isSavings || /owealth withdrawal|savings withdrawal/i.test(tx.description));

    if (isSweep || isWithdrawal) {
      const d = tx.date;
      const existing = dailySavingsMap.get(d) || { deposits: 0, withdrawals: 0 };
      const amt = tx.direction === 'DEBIT' ? tx.debit || tx.amount : tx.credit || tx.amount;

      if (isSweep) {
        existing.deposits = round2(existing.deposits + amt);
        totalDeposited = round2(totalDeposited + amt);
        if (amt > highestSingleDeposit.amount) {
          highestSingleDeposit = {
            amount: round2(amt),
            date: tx.date,
            description: tx.description,
          };
        }
      }

      if (isWithdrawal) {
        existing.withdrawals = round2(existing.withdrawals + amt);
        totalWithdrawn = round2(totalWithdrawn + amt);
      }

      dailySavingsMap.set(d, existing);
    }
  }

  const sortedDates = Array.from(dailySavingsMap.keys()).sort();
  let runningCumulative = 0;

  const points: SavingsTrendPoint[] = sortedDates.map((date) => {
    const val = dailySavingsMap.get(date)!;
    const net = round2(val.deposits - val.withdrawals);
    runningCumulative = round2(runningCumulative + net);

    const parts = date.split('-');
    let label = date;
    if (parts.length === 3) {
      label = `${parseInt(parts[2], 10)} ${MONTH_NAMES[parseInt(parts[1], 10) - 1]}`;
    }

    return {
      date,
      label,
      deposits: val.deposits,
      withdrawals: val.withdrawals,
      netSavings: net,
      cumulativeRetained: runningCumulative,
    };
  });

  const netRetainedSavings = round2(totalDeposited - totalWithdrawn);
  const retentionRate = totalDeposited > 0 ? round2((netRetainedSavings / totalDeposited) * 100) : 0;

  return {
    points,
    totalDeposited,
    totalWithdrawn,
    netRetainedSavings,
    retentionRate,
    highestSingleDeposit,
  };
}

/**
 * Computes behavioral transaction frequency by day-of-week, time-of-day, and debit vs credit splits.
 */
export function computeTransactionFrequency(
  transactions: Transaction[],
  grossLivingExpenses: number
): TransactionFrequencyAnalytics {
  const totalTransactions = transactions.length;
  let debitCount = 0;
  let creditCount = 0;

  // Day of week buckets (0 = Sun, 1 = Mon ... 6 = Sat)
  const dayBuckets = Array.from({ length: 7 }, (_, i) => ({
    dayOfWeek: i,
    dayName: DAY_NAMES[i],
    shortDay: SHORT_DAY_NAMES[i],
    transactionCount: 0,
    spending: 0,
    income: 0,
  }));

  // Time of day buckets
  const timeBuckets = {
    morning: { count: 0, spending: 0 }, // 06:00 - 11:59
    afternoon: { count: 0, spending: 0 }, // 12:00 - 17:59
    evening: { count: 0, spending: 0 }, // 18:00 - 23:59
    night: { count: 0, spending: 0 }, // 00:00 - 05:59
  };

  const uniqueDates = new Set<string>();
  const activeSpendingDates = new Set<string>();

  for (const tx of transactions) {
    uniqueDates.add(tx.date);

    if (tx.direction === 'DEBIT') debitCount += 1;
    if (tx.direction === 'CREDIT') creditCount += 1;

    // Day of week
    const dt = new Date(`${tx.date}T12:00:00Z`);
    const dow = dt.getUTCDay();
    const bucket = dayBuckets[dow];
    bucket.transactionCount += 1;

    const isExp = tx.isExpense && !isExcludedFromLivingExpenses(tx);
    const amt = tx.debit || tx.amount;

    if (isExp) {
      bucket.spending = round2(bucket.spending + amt);
      activeSpendingDates.add(tx.date);
    }

    if (tx.isIncome && !tx.isInternalTransfer && !tx.isRefund && !tx.isSavings) {
      bucket.income = round2(bucket.income + (tx.credit || tx.amount));
    }

    // Time of day
    let hour = 12;
    if (tx.time) {
      const hourPart = parseInt(tx.time.split(':')[0], 10);
      if (!isNaN(hourPart) && hourPart >= 0 && hourPart <= 23) {
        hour = hourPart;
      }
    }

    if (hour >= 6 && hour < 12) {
      timeBuckets.morning.count += 1;
      if (isExp) timeBuckets.morning.spending = round2(timeBuckets.morning.spending + amt);
    } else if (hour >= 12 && hour < 18) {
      timeBuckets.afternoon.count += 1;
      if (isExp) timeBuckets.afternoon.spending = round2(timeBuckets.afternoon.spending + amt);
    } else if (hour >= 18 && hour <= 23) {
      timeBuckets.evening.count += 1;
      if (isExp) timeBuckets.evening.spending = round2(timeBuckets.evening.spending + amt);
    } else {
      timeBuckets.night.count += 1;
      if (isExp) timeBuckets.night.spending = round2(timeBuckets.night.spending + amt);
    }
  }

  const totalDays = uniqueDates.size || 1;
  const avgTxPerDay = round2(totalTransactions / totalDays);
  const avgDailyBurn = round2(grossLivingExpenses / totalDays);

  const baseTx = totalTransactions > 0 ? totalTransactions : 1;

  const dayOfWeekDistribution: DayOfWeekFrequencyItem[] = dayBuckets.map((b) => ({
    dayOfWeek: b.dayOfWeek,
    dayName: b.dayName,
    shortDay: b.shortDay,
    transactionCount: b.transactionCount,
    spending: round2(b.spending),
    income: round2(b.income),
    averagePerTransaction: b.transactionCount > 0 ? round2(b.spending / b.transactionCount) : 0,
    percentageOfTransactions: round2((b.transactionCount / baseTx) * 100),
  }));

  const timeOfDayDistribution: TimeOfDayFrequencyItem[] = [
    {
      periodKey: 'morning',
      label: 'Morning (6am - 12pm)',
      transactionCount: timeBuckets.morning.count,
      spending: timeBuckets.morning.spending,
      percentageOfTransactions: round2((timeBuckets.morning.count / baseTx) * 100),
    },
    {
      periodKey: 'afternoon',
      label: 'Afternoon (12pm - 6pm)',
      transactionCount: timeBuckets.afternoon.count,
      spending: timeBuckets.afternoon.spending,
      percentageOfTransactions: round2((timeBuckets.afternoon.count / baseTx) * 100),
    },
    {
      periodKey: 'evening',
      label: 'Evening (6pm - 12am)',
      transactionCount: timeBuckets.evening.count,
      spending: timeBuckets.evening.spending,
      percentageOfTransactions: round2((timeBuckets.evening.count / baseTx) * 100),
    },
    {
      periodKey: 'night',
      label: 'Night (12am - 6am)',
      transactionCount: timeBuckets.night.count,
      spending: timeBuckets.night.spending,
      percentageOfTransactions: round2((timeBuckets.night.count / baseTx) * 100),
    },
  ];

  // Most active day by transaction volume
  const mostActive = [...dayOfWeekDistribution].sort((a, b) => b.transactionCount - a.transactionCount)[0];
  // Highest spending day by living expenses
  const highestSpendDay = [...dayOfWeekDistribution].sort((a, b) => b.spending - a.spending)[0];

  return {
    totalTransactions,
    totalDaysInPeriod: totalDays,
    activeSpendingDays: activeSpendingDates.size,
    averageTransactionsPerDay: avgTxPerDay,
    averageDailyBurnRate: avgDailyBurn,
    debitCount,
    creditCount,
    debitPercentage: round2((debitCount / baseTx) * 100),
    creditPercentage: round2((creditCount / baseTx) * 100),
    dayOfWeekDistribution,
    timeOfDayDistribution,
    mostActiveDayOfWeek: mostActive ? mostActive.dayName : 'N/A',
    highestSpendingDayOfWeek: highestSpendDay ? highestSpendDay.dayName : 'N/A',
  };
}

/**
 * Extracts and classifies the largest debit and credit transactions.
 */
export function computeLargestTransactions(
  transactions: Transaction[],
  limit = 10
): LargestTransactionsAnalytics {
  const debits: TopDebitTransactionItem[] = [];
  const credits: TopCreditTransactionItem[] = [];

  for (const tx of transactions) {
    if (tx.direction === 'DEBIT') {
      const isLiving = tx.isExpense && !isExcludedFromLivingExpenses(tx);
      const isSavingsSweep =
        tx.isSavings ||
        tx.transactionType === 'SAVINGS_TRANSFER' ||
        /owealth|piggyvest|cowrywise|savings/i.test(tx.description);
      const isInternal = tx.isInternalTransfer || tx.transactionType === 'INTERNAL_TRANSFER';
      const isBankCharge = tx.category === 'Bank Charges' || tx.transactionType === 'BANK_CHARGE';

      debits.push({
        id: tx.id,
        date: tx.date,
        description: tx.description,
        merchant: tx.merchant || tx.description.split('|')[0].trim(),
        amount: round2(tx.debit || tx.amount),
        category: tx.category,
        categoryGroup: tx.categoryGroup || 'Other',
        isLivingExpense: isLiving,
        isSavingsSweep,
        isInternalTransfer: isInternal,
        isBankCharge,
      });
    }

    if (tx.direction === 'CREDIT') {
      const isExtIncome =
        tx.isIncome && !tx.isInternalTransfer && !tx.isRefund && !tx.isSavings;
      const isWithdrawal =
        (tx.isSavings || /owealth withdrawal|savings withdrawal/i.test(tx.description));
      const isInternal = tx.isInternalTransfer || tx.transactionType === 'INTERNAL_TRANSFER';

      credits.push({
        id: tx.id,
        date: tx.date,
        description: tx.description,
        sender: tx.merchant || tx.description.split('|')[0].trim(),
        amount: round2(tx.credit || tx.amount),
        category: tx.category,
        isExternalIncome: isExtIncome,
        isSavingsWithdrawal: isWithdrawal,
        isInternalTransfer: isInternal,
        isRefund: tx.isRefund,
      });
    }
  }

  return {
    topDebits: debits.sort((a, b) => b.amount - a.amount).slice(0, limit),
    topCredits: credits.sort((a, b) => b.amount - a.amount).slice(0, limit),
  };
}

/**
 * Computes ranked highest spending days with top category, top merchant, and transaction counts.
 */
export function computeHighestSpendingDays(
  transactions: Transaction[],
  limit = 10
): HighestSpendingDayItem[] {
  const dayMap = new Map<
    string,
    {
      spending: number;
      count: number;
      maxTx: number;
      categoryMap: Map<string, number>;
      merchantMap: Map<string, number>;
    }
  >();

  for (const tx of transactions) {
    if (tx.isExpense && !isExcludedFromLivingExpenses(tx)) {
      const d = tx.date;
      const amt = tx.debit || tx.amount;
      const cat = tx.category || 'Other';
      const merch = tx.merchant || tx.description.split('|')[0].trim();

      const existing = dayMap.get(d) || {
        spending: 0,
        count: 0,
        maxTx: 0,
        categoryMap: new Map<string, number>(),
        merchantMap: new Map<string, number>(),
      };

      existing.spending = round2(existing.spending + amt);
      existing.count += 1;
      if (amt > existing.maxTx) existing.maxTx = round2(amt);

      const catSum = existing.categoryMap.get(cat) || 0;
      existing.categoryMap.set(cat, round2(catSum + amt));

      const merchSum = existing.merchantMap.get(merch) || 0;
      existing.merchantMap.set(merch, round2(merchSum + amt));

      dayMap.set(d, existing);
    }
  }

  const items: HighestSpendingDayItem[] = [];

  for (const [date, val] of dayMap.entries()) {
    // Determine top category
    let topCat = 'None';
    let topCatAmt = 0;
    for (const [cat, amt] of val.categoryMap.entries()) {
      if (amt > topCatAmt) {
        topCat = cat;
        topCatAmt = amt;
      }
    }

    // Determine top merchant
    let topMerch = 'None';
    let topMerchAmt = 0;
    for (const [m, amt] of val.merchantMap.entries()) {
      if (amt > topMerchAmt) {
        topMerch = m;
        topMerchAmt = amt;
      }
    }

    const dt = new Date(`${date}T12:00:00Z`);
    const dayOfWeek = DAY_NAMES[dt.getUTCDay()] || 'N/A';
    const parts = date.split('-');
    const formattedDate = `${dayOfWeek}, ${parseInt(parts[2], 10)} ${MONTH_NAMES[parseInt(parts[1], 10) - 1]} ${parts[0]}`;

    items.push({
      date,
      formattedDate,
      dayOfWeek,
      totalSpending: round2(val.spending),
      transactionCount: val.count,
      topCategory: topCat,
      topCategoryAmount: round2(topCatAmt),
      topMerchant: topMerch,
      topMerchantAmount: round2(topMerchAmt),
      largestTransaction: round2(val.maxTx),
    });
  }

  return items.sort((a, b) => b.totalSpending - a.totalSpending).slice(0, limit);
}

/**
 * Master analytics calculation engine that builds the complete verified AnalyticsReport.
 */
export function computeAnalyticsReport(
  transactions: Transaction[],
  currency: Currency = 'NGN'
): AnalyticsReport {
  // Deterministic calculation audit
  const audit = auditFinancialCalculations(transactions, 0, 0, currency);
  const grossLivingExpenses = audit.expenses.grossLivingExpenses;
  const netLivingExpenses = audit.expenses.netLivingExpenses;
  const totalIncome = audit.income.totalIncome;
  const netCashFlow = audit.netCashFlow;

  const dates = transactions.map((t) => t.date).filter(Boolean).sort();
  const periodStart = dates[0] || 'N/A';
  const periodEnd = dates[dates.length - 1] || 'N/A';

  const categoryAnalytics = computeCategoryAnalytics(transactions, grossLivingExpenses);
  const categoryGroupAnalytics = computeCategoryGroupAnalytics(categoryAnalytics, grossLivingExpenses);
  const merchantAnalytics = computeMerchantAnalytics(transactions, grossLivingExpenses, 25);
  const timelineTrends = computeTimelineTrends(transactions);
  const savingsTrends = computeSavingsTrends(transactions);
  const frequencyAnalytics = computeTransactionFrequency(transactions, grossLivingExpenses);
  const largestTransactions = computeLargestTransactions(transactions, 10);
  const highestSpendingDays = computeHighestSpendingDays(transactions, 10);

  return {
    currency,
    periodStart,
    periodEnd,
    totalTransactions: transactions.length,
    grossLivingExpenses,
    netLivingExpenses,
    totalIncome,
    netCashFlow,
    categoryAnalytics,
    categoryGroupAnalytics,
    merchantAnalytics,
    dailyTrends: timelineTrends.daily,
    weeklyTrends: timelineTrends.weekly,
    monthlyTrends: timelineTrends.monthly,
    savingsTrends,
    frequencyAnalytics,
    largestTransactions,
    highestSpendingDays,
  };
}
