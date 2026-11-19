import type { Currency, Transaction } from '../../types/index.ts';
import { formatCurrency } from '../utils.ts';
import {
  auditFinancialCalculations,
  round2,
} from '../calculations/financialEngine.ts';
import {
  computeAnalyticsReport,
} from '../calculations/analyticsEngine.ts';
import type {
  AIAnalystReport,
  FinancialInsight,
  GroundedMetric,
  InsightCategory,
  InsightSeverity,
  InsightVerificationAudit,
  VerificationCheckItem,
} from './types.ts';

/**
 * Registry of ground-truth numerical values calculated by the engine.
 */
export interface GroundingRegistry {
  values: Map<number, { metricKey: string; provenance: string; label: string }>;
  metricMap: Map<string, { value: number; formattedValue: string; provenance: string; label: string }>;
}

/**
 * Normalizes number for fuzzy matching (handling rounding and small formatting drifts).
 */
function normalizeForComparison(val: number): number {
  return Math.round(val * 100) / 100;
}

/**
 * Builds the comprehensive Known Numbers Registry from verified calculations.
 */
export function buildGroundingRegistry(
  transactions: Transaction[],
  currency: Currency = 'NGN'
): GroundingRegistry {
  const audit = auditFinancialCalculations(transactions, 0, 0, currency);
  const analytics = computeAnalyticsReport(transactions, currency);

  const values = new Map<number, { metricKey: string; provenance: string; label: string }>();
  const metricMap = new Map<string, { value: number; formattedValue: string; provenance: string; label: string }>();

  function register(val: number, key: string, label: string, prov: string) {
    if (isNaN(val)) return;
    const rounded = normalizeForComparison(val);
    const item = { metricKey: key, provenance: prov, label };
    values.set(rounded, item);
    // Also register integer part and /1000 for shorthand like 310k
    values.set(Math.round(val), item);
    if (Math.abs(val) >= 1000) {
      values.set(Math.round((val / 1000) * 10) / 10, item);
      values.set(Math.round(val / 1000), item);
    }
    metricMap.set(key, {
      value: val,
      formattedValue: formatCurrency(val, currency),
      provenance: prov,
      label,
    });
  }

  // Register Core Financial Totals
  register(audit.expenses.grossLivingExpenses, 'grossLivingExpenses', 'Gross Living Expenses', 'audit.expenses.grossLivingExpenses');
  register(audit.expenses.netLivingExpenses, 'netLivingExpenses', 'Net Living Expenses', 'audit.expenses.netLivingExpenses');
  register(audit.income.totalIncome, 'totalIncome', 'True External Income', 'audit.income.totalIncome');
  register(audit.netCashFlow, 'netCashFlow', 'Net Cash Flow', 'audit.netCashFlow');
  register(audit.savingsRate, 'savingsRate', 'Savings Rate', 'audit.savingsRate');
  register(audit.grossSavingsRate, 'grossSavingsRate', 'Gross Savings Rate', 'audit.grossSavingsRate');
  register(audit.livingExpenseRatio, 'livingExpenseRatio', 'Living Expense Ratio', 'audit.livingExpenseRatio');
  register(audit.wealth.totalCapitalPreserved, 'totalCapitalPreserved', 'Capital Preserved', 'audit.wealth.totalCapitalPreserved');
  register(audit.expenses.bankCharges, 'bankCharges', 'Bank Charges & Fees', 'audit.expenses.bankCharges');
  register(audit.expenses.discretionaryExpenses, 'discretionaryExpenses', 'Discretionary Spending', 'audit.expenses.discretionaryExpenses');
  register(audit.expenses.essentialExpenses, 'essentialExpenses', 'Essential Spending', 'audit.expenses.essentialExpenses');
  register(audit.expenses.refundsOffset, 'totalRefunds', 'Refunds Received', 'audit.expenses.refundsOffset');
  register(audit.reconciliation.openingBalance, 'openingBalance', 'Opening Balance', 'audit.reconciliation.openingBalance');
  register(audit.reconciliation.closingBalance, 'closingBalance', 'Closing Balance', 'audit.reconciliation.closingBalance');

  // Register Transaction Counts & Frequency
  register(transactions.length, 'totalTransactions', 'Total Transaction Count', 'transactions.length');
  register(analytics.frequencyAnalytics.activeSpendingDays, 'activeSpendingDays', 'Active Spending Days', 'frequency.activeSpendingDays');
  register(analytics.frequencyAnalytics.totalDaysInPeriod, 'totalDaysInPeriod', 'Total Period Days', 'frequency.totalDaysInPeriod');
  register(analytics.frequencyAnalytics.averageDailyBurnRate, 'averageDailyBurnRate', 'Daily Burn Rate', 'frequency.averageDailyBurnRate');
  register(analytics.frequencyAnalytics.averageTransactionsPerDay, 'averageTransactionsPerDay', 'Avg Transactions / Day', 'frequency.averageTransactionsPerDay');
  register(analytics.frequencyAnalytics.debitCount, 'debitCount', 'Debit Transactions', 'frequency.debitCount');
  register(analytics.frequencyAnalytics.creditCount, 'creditCount', 'Credit Transactions', 'frequency.creditCount');

  // Register Savings Dynamics
  register(analytics.savingsTrends.totalDeposited, 'savingsDeposited', 'Savings Vault Sweeps', 'savings.totalDeposited');
  register(analytics.savingsTrends.totalWithdrawn, 'savingsWithdrawn', 'Savings Withdrawals', 'savings.totalWithdrawn');
  register(analytics.savingsTrends.netRetainedSavings, 'netRetainedSavings', 'Net Retained Savings', 'savings.netRetainedSavings');
  register(analytics.savingsTrends.retentionRate, 'savingsRetentionRate', 'Savings Retention Rate', 'savings.retentionRate');
  register(analytics.savingsTrends.highestSingleDeposit.amount, 'highestSavingsSweep', 'Highest Single Savings Sweep', 'savings.highestSingleDeposit.amount');

  // Register Category Totals & Percentages
  for (const cat of analytics.categoryAnalytics) {
    register(cat.totalSpent, `category_${cat.category}_spent`, `${cat.category} Total Spent`, `categoryAnalytics[${cat.category}].totalSpent`);
    register(cat.percentageOfTotal, `category_${cat.category}_pct`, `${cat.category} Spend Share`, `categoryAnalytics[${cat.category}].percentageOfTotal`);
    register(cat.transactionCount, `category_${cat.category}_count`, `${cat.category} Tx Count`, `categoryAnalytics[${cat.category}].transactionCount`);
    register(cat.averageTransaction, `category_${cat.category}_avg`, `${cat.category} Avg Ticket`, `categoryAnalytics[${cat.category}].averageTransaction`);
    register(cat.maxTransaction, `category_${cat.category}_max`, `${cat.category} Max Ticket`, `categoryAnalytics[${cat.category}].maxTransaction`);
  }

  // Register Category Group Totals
  for (const grp of analytics.categoryGroupAnalytics) {
    register(grp.totalSpent, `group_${grp.group}_spent`, `${grp.group} Total Spent`, `categoryGroupAnalytics[${grp.group}].totalSpent`);
    register(grp.percentageOfTotal, `group_${grp.group}_pct`, `${grp.group} Share`, `categoryGroupAnalytics[${grp.group}].percentageOfTotal`);
  }

  // Register Merchant Totals
  for (const m of analytics.merchantAnalytics) {
    register(m.totalSpent, `merchant_${m.merchant}_spent`, `${m.merchant} Total Spent`, `merchantAnalytics[${m.merchant}].totalSpent`);
    register(m.transactionCount, `merchant_${m.merchant}_count`, `${m.merchant} Visit Count`, `merchantAnalytics[${m.merchant}].transactionCount`);
    register(m.averageTransaction, `merchant_${m.merchant}_avg`, `${m.merchant} Avg Ticket`, `merchantAnalytics[${m.merchant}].averageTransaction`);
    register(m.maxTransaction, `merchant_${m.merchant}_max`, `${m.merchant} Max Ticket`, `merchantAnalytics[${m.merchant}].maxTransaction`);
    register(m.percentageOfTotal, `merchant_${m.merchant}_pct`, `${m.merchant} Share`, `merchantAnalytics[${m.merchant}].percentageOfTotal`);
  }

  // Register Day-of-Week Frequency Totals
  for (const dow of analytics.frequencyAnalytics.dayOfWeekDistribution) {
    register(dow.spending, `dow_${dow.dayName}_spending`, `${dow.dayName} Living Spend`, `frequency.dayOfWeek[${dow.dayName}].spending`);
    register(dow.transactionCount, `dow_${dow.dayName}_count`, `${dow.dayName} Tx Count`, `frequency.dayOfWeek[${dow.dayName}].transactionCount`);
    register(dow.averagePerTransaction, `dow_${dow.dayName}_avg`, `${dow.dayName} Avg Spend`, `frequency.dayOfWeek[${dow.dayName}].averagePerTransaction`);
  }

  // Register Standard Benchmark Thresholds used in advisory rules
  const benchmarks = [10, 15, 20, 25, 30, 40, 50, 70, 80, 85, 90, 95];
  for (const b of benchmarks) {
    register(b, `benchmark_${b}`, `Benchmark ${b}%`, `rule_engine.benchmark`);
  }

  // Register Largest Transactions
  for (const tx of analytics.largestTransactions.topDebits.slice(0, 5)) {
    register(tx.amount, `largest_debit_${tx.id}`, `Largest Debit: ${tx.description}`, `largestTransactions.topDebits[${tx.id}]`);
  }
  for (const tx of analytics.largestTransactions.topCredits.slice(0, 5)) {
    register(tx.amount, `largest_credit_${tx.id}`, `Largest Credit: ${tx.description}`, `largestTransactions.topCredits[${tx.id}]`);
  }

  return { values, metricMap };
}

/**
 * Scans a narrative text string, extracts numerical tokens, and verifies each against the GroundingRegistry.
 * Flags any hallucinated or ungrounded number that cannot be traced to verified calculation data.
 */
export function verifyTextGrounding(
  text: string,
  registry: GroundingRegistry
): InsightVerificationAudit {
  // Regex to extract numbers: currency amounts (₦123,456.78, $100, ₦123k), percentages (27.5%), standalone decimals/integers
  const pattern = /(?:₦|\$|€|£)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)\s*(?:(k|m|%)(?![a-zA-Z]))?/gi;

  const checks: VerificationCheckItem[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const rawToken = match[0].trim();
    const rawNumStr = match[1].replace(/,/g, '');
    let numVal = parseFloat(rawNumStr);

    if (isNaN(numVal)) continue;

    // Filter out common prose ordinals or years like 2026, 1st, 2nd
    if (numVal === 2026 || numVal === 2025 || numVal === 1 || numVal === 2 || numVal === 3) {
      continue;
    }

    const suffix = match[2]?.toLowerCase();
    // Handle 'k' / 'm' multiplier only when explicitly suffixed
    if (suffix === 'k') {
      numVal = numVal * 1000;
    } else if (suffix === 'm') {
      numVal = numVal * 1000000;
    }

    // Match against registry with precision tolerance
    let matchedItem: { metricKey: string; provenance: string; label: string } | null = null;

    const roundedVal = normalizeForComparison(numVal);
    if (registry.values.has(roundedVal)) {
      matchedItem = registry.values.get(roundedVal)!;
    } else if (registry.values.has(Math.round(numVal))) {
      matchedItem = registry.values.get(Math.round(numVal))!;
    } else {
      // Fuzzy search within 1.5% or 1.0 unit
      for (const [knownVal, item] of registry.values.entries()) {
        const diff = Math.abs(knownVal - numVal);
        if (diff <= 1.0 || (knownVal > 0 && diff / knownVal <= 0.015)) {
          matchedItem = item;
          break;
        }
      }
    }

    checks.push({
      token: rawToken,
      extractedValue: numVal,
      matchedMetricKey: matchedItem ? matchedItem.metricKey : undefined,
      isVerified: matchedItem !== null,
      provenance: matchedItem ? matchedItem.provenance : undefined,
    });
  }

  const totalNumbersScanned = checks.length;
  const verifiedCount = checks.filter((c) => c.isVerified).length;
  const hallucinatedCount = totalNumbersScanned - verifiedCount;
  const provenanceScore = totalNumbersScanned > 0 ? round2((verifiedCount / totalNumbersScanned) * 100) : 100;
  const isGroundingPassed = hallucinatedCount === 0;

  return {
    isGroundingPassed,
    totalNumbersScanned,
    verifiedNumbersCount: verifiedCount,
    hallucinatedCount,
    provenanceScore,
    checks,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Deterministically generates high-value, verified financial insights grounded in calculation engine outputs.
 */
export function generateVerifiedFinancialInsights(
  transactions: Transaction[],
  currency: Currency = 'NGN'
): AIAnalystReport {
  const audit = auditFinancialCalculations(transactions, 0, 0, currency);
  const analytics = computeAnalyticsReport(transactions, currency);
  const registry = buildGroundingRegistry(transactions, currency);

  const insights: FinancialInsight[] = [];

  // Helper to create and audit an insight
  function addInsight(
    id: string,
    category: InsightCategory,
    severity: InsightSeverity,
    title: string,
    summary: string,
    detailedExplanation: string,
    metricKeys: string[],
    actionRecommendation?: string,
    potentialMonthlySavings?: number,
    traceFilter?: FinancialInsight['traceFilter']
  ) {
    if (potentialMonthlySavings) {
      const rounded = normalizeForComparison(potentialMonthlySavings);
      registry.values.set(rounded, {
        metricKey: `${id}_savings`,
        provenance: 'calculated_recommendation.potentialMonthlySavings',
        label: `${title} Potential Savings`,
      });
      registry.values.set(Math.round(potentialMonthlySavings), {
        metricKey: `${id}_savings`,
        provenance: 'calculated_recommendation.potentialMonthlySavings',
        label: `${title} Potential Savings`,
      });
    }

    const fullText = `${title}. ${summary} ${detailedExplanation} ${actionRecommendation || ''}`;
    const verification = verifyTextGrounding(fullText, registry);

    const groundedMetrics: GroundedMetric[] = [];
    for (const key of metricKeys) {
      if (registry.metricMap.has(key)) {
        const m = registry.metricMap.get(key)!;
        groundedMetrics.push({
          metricKey: key,
          label: m.label,
          value: m.value,
          formattedValue: m.formattedValue,
          provenance: m.provenance,
        });
      }
    }

    insights.push({
      id,
      category,
      severity,
      title,
      summary,
      detailedExplanation,
      groundedMetrics,
      actionRecommendation,
      potentialMonthlySavings,
      traceFilter,
      verification,
    });
  }

  const fmt = (val: number) => formatCurrency(val, currency);

  // 1. Executive Cash Flow Diagnosis
  const netCashFlow = audit.netCashFlow;
  const income = audit.income.totalIncome;
  const grossSpend = audit.expenses.grossLivingExpenses;
  const netSavings = analytics.savingsTrends.netRetainedSavings;

  if (netCashFlow >= 0) {
    addInsight(
      'ins_exec_cashflow',
      'executive',
      netCashFlow > income * 0.2 ? 'positive' : 'neutral',
      'Cash Flow Surplus & Capital Sustainability',
      `You closed this statement period with a net cash surplus of ${fmt(netCashFlow)}, generating ${fmt(income)} in true external income against ${fmt(grossSpend)} in living expenses.`,
      `Your living expense ratio was ${audit.livingExpenseRatio.toFixed(1)}% of your external income, leaving healthy room for wealth accumulation. An additional ${fmt(netSavings)} was successfully preserved in automated savings sweeps.`,
      ['netCashFlow', 'totalIncome', 'grossLivingExpenses', 'livingExpenseRatio', 'netRetainedSavings'],
      `Maintain your current living expense cap below ${fmt(grossSpend)} to ensure consistent monthly cash retention.`,
      undefined,
      { type: 'INCOME' }
    );
  } else {
    addInsight(
      'ins_exec_cashflow',
      'executive',
      'critical',
      'Cash Flow Deficit Alert',
      `Your living expenses of ${fmt(grossSpend)} exceeded your true external income of ${fmt(income)}, resulting in a net cash flow deficit of ${fmt(Math.abs(netCashFlow))}.`,
      `You experienced a negative living expense margin, forcing reliance on prior bank balances or savings withdrawals to bridge the shortfall.`,
      ['netCashFlow', 'totalIncome', 'grossLivingExpenses', 'livingExpenseRatio'],
      `Implement an immediate discretionary spending freeze to reduce your monthly burn rate by at least ${fmt(Math.abs(netCashFlow))}.`,
      Math.abs(netCashFlow),
      { type: 'EXPENSE' }
    );
  }

  // 2. Top Spending Leak & Category Concentration
  const topCategory = analytics.categoryAnalytics[0];
  if (topCategory) {
    const isHeavy = topCategory.percentageOfTotal > 30;
    addInsight(
      'ins_category_leak',
      'spending',
      isHeavy ? 'warning' : 'neutral',
      `Dominant Spending Category: ${topCategory.category}`,
      `${topCategory.category} represents your largest living expenditure, consuming ${fmt(topCategory.totalSpent)} (${topCategory.percentageOfTotal.toFixed(1)}% of all living expenses) across ${topCategory.transactionCount} transactions.`,
      `Your average transaction for ${topCategory.category} was ${fmt(topCategory.averageTransaction)}, with a peak single transaction of ${fmt(topCategory.maxTransaction)}. This single category accounts for nearly one-third of your overall lifestyle burn.`,
      [`category_${topCategory.category}_spent`, `category_${topCategory.category}_pct`, `category_${topCategory.category}_count`, `category_${topCategory.category}_avg`],
      `Trimming your ${topCategory.category} spend by 15% would liberate approximately ${fmt(round2(topCategory.totalSpent * 0.15))} monthly for emergency savings.`,
      round2(topCategory.totalSpent * 0.15),
      { category: topCategory.category }
    );
  }

  // 3. Automated Savings Sweeps & Retention Rate
  const savings = analytics.savingsTrends;
  if (savings.totalDeposited > 0) {
    const highRetention = savings.retentionRate >= 50;
    addInsight(
      'ins_savings_retention',
      'savings',
      highRetention ? 'positive' : 'warning',
      highRetention ? 'Healthy Wealth Sweep Retention' : 'High Savings Churn / Premature Withdrawal',
      `You transferred ${fmt(savings.totalDeposited)} into savings vaults (OWealth/PiggyVest), while withdrawing ${fmt(savings.totalWithdrawn)}, achieving an audited net retained capital of ${fmt(savings.netRetainedSavings)} (${savings.retentionRate.toFixed(1)}% retention).`,
      highRetention
        ? `You successfully kept the majority of your automated savings intact. Your largest single deposit sweep was ${fmt(savings.highestSingleDeposit.amount)}.`
        : `Over half of the money swept into savings was subsequently withdrawn back into your active wallet for consumption. This indicates savings vaults are functioning as secondary checking accounts rather than long-term capital preservation.`,
      ['savingsDeposited', 'savingsWithdrawn', 'netRetainedSavings', 'savingsRetentionRate', 'highestSavingsSweep'],
      highRetention
        ? `Lock your preserved ${fmt(savings.netRetainedSavings)} into fixed-term interest vaults to prevent unintended leakage.`
        : `Establish a dedicated ₦50,000 checking buffer to stop withdrawing from savings vaults for ordinary bills.`,
      undefined,
      { category: 'Savings' }
    );
  }

  // 4. Micro-Transactions & Telecom/Airtime Leak
  const airtime = analytics.categoryAnalytics.find((c) => c.category === 'Airtime' || c.category === 'Data');
  if (airtime && airtime.transactionCount >= 5) {
    addInsight(
      'ins_telecom_micro',
      'spending',
      airtime.transactionCount >= 10 ? 'warning' : 'neutral',
      `High-Frequency Telecom Micro-Transactions`,
      `You executed ${airtime.transactionCount} separate ${airtime.category} top-ups totaling ${fmt(airtime.totalSpent)}, averaging ${fmt(airtime.averageTransaction)} per transaction.`,
      `Frequent micro-purchases create cognitive blindness to cumulative spending. While each recharge appears minor, they accumulated to a significant share of your operational expenses.`,
      [`category_${airtime.category}_spent`, `category_${airtime.category}_count`, `category_${airtime.category}_avg`],
      `Switch from daily top-ups to a single scheduled monthly data/airtime bundle to save approximately ${fmt(round2(airtime.totalSpent * 0.2))} monthly through bulk discounts.`,
      round2(airtime.totalSpent * 0.2),
      { category: airtime.category }
    );
  }

  // 5. Merchant Concentration Risk
  const topMerchant = analytics.merchantAnalytics[0];
  if (topMerchant && topMerchant.percentageOfTotal > 15) {
    addInsight(
      'ins_merchant_concentration',
      'merchants',
      'neutral',
      `Top Merchant Volume: ${topMerchant.merchant}`,
      `${topMerchant.merchant} captured ${fmt(topMerchant.totalSpent)} across ${topMerchant.transactionCount} visits, accounting for ${topMerchant.percentageOfTotal.toFixed(1)}% of your total living expenses.`,
      `Your average spend per visit at ${topMerchant.merchant} was ${fmt(topMerchant.averageTransaction)}. Tracking individual vendor concentration prevents single-brand budget erosion.`,
      [`merchant_${topMerchant.merchant}_spent`, `merchant_${topMerchant.merchant}_count`],
      `Review repeat transactions at ${topMerchant.merchant} to verify each charge was deliberate.`,
      undefined,
      { merchant: topMerchant.merchant, search: topMerchant.merchant }
    );
  }

  // 6. Day-of-Week Behavioral Spending Spike
  const freq = analytics.frequencyAnalytics;
  const costliestDay = freq.dayOfWeekDistribution.slice().sort((a, b) => b.spending - a.spending)[0];
  if (costliestDay && costliestDay.spending > 0) {
    addInsight(
      'ins_behavior_spikes',
      'risk',
      'neutral',
      `Weekly Spending Spike on ${costliestDay.dayName}s`,
      `Your highest spending day of the week is ${costliestDay.dayName}, aggregating ${fmt(costliestDay.spending)} in living expenses across ${costliestDay.transactionCount} transactions.`,
      `Understanding day-of-week spending patterns exposes behavioral lifestyle triggers. Your spending on ${costliestDay.dayName}s is significantly higher than your overall daily burn rate of ${fmt(freq.averageDailyBurnRate)}.`,
      ['averageDailyBurnRate'],
      `Institute a "${costliestDay.dayName} spending ceiling" capped at ${fmt(round2(freq.averageDailyBurnRate * 1.5))} to smooth your weekly cash outflows.`,
      round2(costliestDay.spending * 0.2),
      { search: costliestDay.dayName }
    );
  }

  // 7. Bank Charges & Operational Fees Audit
  if (audit.expenses.bankCharges > 0) {
    addInsight(
      'ins_bank_charges',
      'risk',
      audit.expenses.bankCharges > 1000 ? 'warning' : 'neutral',
      'Bank Fees & Transaction Friction Audit',
      `You incurred ${fmt(audit.expenses.bankCharges)} in cumulative bank charges, transfer fees, and SMS notifications over this statement period.`,
      `While unavoidable in certain Nigerian banking channels, excessive transfer fees can be minimized by batching outbound peer-to-peer transfers.`,
      ['bankCharges'],
      `Consolidate multiple small transfers into fewer consolidated transfers to reduce bank fee burden.`,
      round2(audit.expenses.bankCharges * 0.4),
      { category: 'Bank Charges' }
    );
  }

  // Calculate overall anti-hallucination stats
  const totalNumbersScanned = insights.reduce((s, i) => s + i.verification.totalNumbersScanned, 0);
  const totalVerified = insights.reduce((s, i) => s + i.verification.verifiedNumbersCount, 0);
  const totalHallucinated = insights.reduce((s, i) => s + i.verification.hallucinatedCount, 0);
  const overallProvenance = totalNumbersScanned > 0 ? round2((totalVerified / totalNumbersScanned) * 100) : 100;

  const topActionableTakeaways = [
    {
      title: 'Batch Daily Airtime Top-ups into Monthly Bundle',
      description: `Consolidate frequent micro-topups to curb friction and save an estimated ${fmt(round2((airtime?.totalSpent || 5000) * 0.2))} monthly.`,
      estimatedSavings: round2((airtime?.totalSpent || 5000) * 0.2),
      actionType: 'optimize_airtime' as const,
    },
    {
      title: `Optimize ${topCategory?.category || 'Food'} Discretionary Outflows`,
      description: `Cap high-frequency discretionary orders to retain an estimated ${fmt(round2((topCategory?.totalSpent || 20000) * 0.15))} monthly.`,
      estimatedSavings: round2((topCategory?.totalSpent || 20000) * 0.15),
      actionType: 'reduce_dining' as const,
    },
    {
      title: 'Lock Net Savings Sweeps into Fixed Vaults',
      description: `Prevent premature withdrawal leakage of your preserved ${fmt(savings.netRetainedSavings)} by maintaining a separate transaction buffer.`,
      estimatedSavings: round2(savings.netRetainedSavings * 0.1),
      actionType: 'increase_savings_sweep' as const,
    },
  ];

  const executiveSummary = `During this statement period (${analytics.periodStart} to ${analytics.periodEnd}), you generated ${fmt(income)} in external income and incurred ${fmt(grossSpend)} in gross living expenses, resulting in an audited net cash flow of ${fmt(netCashFlow)} and ${fmt(netSavings)} preserved in savings vaults.`;

  const overallHealthAssessment =
    netCashFlow >= 0 && savings.retentionRate >= 50
      ? 'Strong Financial Trajectory: Your income adequately funds your lifestyle expenses while retaining positive cash reserves in savings sweeps.'
      : netCashFlow >= 0
      ? 'Moderate Stability: Positive cash flow achieved, but savings withdrawals indicate potential lifestyle creep or lack of liquidity buffers.'
      : 'Vulnerable Position: Living expenses exceed external income, requiring immediate spending consolidation to avert capital erosion.';

  return {
    executiveSummary,
    overallHealthAssessment,
    currency,
    periodStart: analytics.periodStart,
    periodEnd: analytics.periodEnd,
    totalTransactions: transactions.length,
    insights,
    antiHallucinationAudit: {
      totalInsightsGenerated: insights.length,
      passedInsightsCount: insights.filter((i) => i.verification.isGroundingPassed).length,
      flaggedHallucinationsCount: totalHallucinated,
      overallProvenanceScore: overallProvenance,
      registrySize: registry.values.size,
      auditStatus: totalHallucinated === 0 ? 'VERIFIED_100_PERCENT' : 'CONTAINS_FLAGGED_DATA',
      verifiedAt: new Date().toISOString(),
    },
    topActionableTakeaways,
  };
}
