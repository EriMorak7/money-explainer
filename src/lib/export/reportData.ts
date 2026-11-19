import type { BankAccount, Currency, StatementMetadata, Transaction } from '../../types/index.ts';
import { auditFinancialCalculations, computeHealthScore, round2 } from '../calculations/financialEngine.ts';
import { computeAnalyticsReport } from '../calculations/analyticsEngine.ts';
import { computeSavingsReport } from '../savings/savingsEngine.ts';
import { computeSubscriptionAudit } from '../subscriptions/recurringEngine.ts';
import { generateVerifiedFinancialInsights } from '../ai/analystEngine.ts';
import { computePersonalizedBudget } from '../budget/budgetEngine.ts';

export interface FinancialReportData {
  generatedAt: string;
  currency: Currency;

  // 1. Statement Overview
  statementOverview: {
    bankName: string;
    accountName: string;
    accountNumberMasked: string;
    periodStart: string;
    periodEnd: string;
    totalTransactions: number;
    openingBalance: number;
    closingBalance: number;
    netBalanceChange: number;
  };

  // 2. Financial Summary
  financialSummary: {
    totalExternalIncome: number;
    totalActualExpenses: number;
    netCashFlow: number;
    savingsRatePercent: number;
    financialHealthScore: number;
    healthRating: string;
  };

  // 3. Income Analysis
  incomeAnalysis: {
    totalIncome: number;
    incomeTransactionCount: number;
    topIncomeSources: Array<{
      source: string;
      amount: number;
      percentage: number;
      count: number;
    }>;
    averageIncomePerCredit: number;
  };

  // 4. Expense Analysis
  expenseAnalysis: {
    grossLivingExpenses: number;
    dailyBurnRate: number;
    activeSpendingDays: number;
    groups: Array<{
      group: string;
      amount: number;
      percentage: number;
    }>;
  };

  // 5. Cash Flow
  cashFlow: {
    totalInflows: number;
    totalOutflows: number;
    netSurplus: number;
    savingsTransfersExcluded: number;
    internalTransfersExcluded: number;
  };

  // 6. Savings Analysis
  savingsAnalysis: {
    totalDeposited: number;
    totalWithdrawn: number;
    netRetainedSavings: number;
    retentionRatePercent: number;
    interestEarned: number;
    annualizedYieldRunRate: number | null;
    velocityAverageContribution: number;
    largestContribution: number;
    largestWithdrawal: number;
  };

  // 7. Spending Categories
  spendingCategories: Array<{
    category: string;
    group: string;
    amount: number;
    percentage: number;
    count: number;
  }>;

  // 8. Merchant Analysis
  merchantAnalysis: Array<{
    merchant: string;
    category: string;
    totalSpent: number;
    percentageOfTotal: number;
    transactionCount: number;
    averageTicket: number;
  }>;

  // 9. Recurring Payments
  recurringPayments: {
    activeCommitmentsCount: number;
    potentialSubscriptionsCount: number;
    totalMonthlyRecurringCost: number;
    totalAnnualRecurringCost: number;
    topRecurringItems: Array<{
      merchant: string;
      cadence: string;
      averagePayment: number;
      monthlyCost: number;
      annualCost: number;
      isSubscription: boolean;
      nextDue: string;
    }>;
  };

  // 10. Largest Transactions
  largestTransactions: {
    debits: Array<{
      date: string;
      description: string;
      merchant: string;
      amount: number;
      category: string;
    }>;
    credits: Array<{
      date: string;
      description: string;
      sender: string;
      amount: number;
      category: string;
    }>;
  };

  // 11. Financial Insights
  financialInsights: Array<{
    title: string;
    summary: string;
    severity: 'critical' | 'warning' | 'positive' | 'neutral';
    category: string;
  }>;

  // 12. Budget Analysis
  budgetAnalysis: {
    monthlyIncomeBaseline: number;
    targetSavings: number;
    targetNeeds: number;
    targetWants: number;
    recommendedLimits: Array<{
      category: string;
      currentSpent: number;
      recommendedLimit: number;
      variance: number;
      status: 'under' | 'on_track' | 'exceeded';
    }>;
  };

  // 13. Recommendations
  recommendations: string[];
}

/**
 * Builds the comprehensive Financial Report Data object using the EXACT
 * audited calculation engines used throughout the application.
 */
export function generateFinancialReportData(
  transactions: Transaction[],
  account: BankAccount,
  statement: StatementMetadata,
  currency: Currency = 'NGN'
): FinancialReportData {
  // Execute verified financial engines without duplication
  const audit = auditFinancialCalculations(
    transactions,
    account.openingBalance,
    account.closingBalance,
    currency
  );
  const healthScore = computeHealthScore(audit, transactions);
  const analytics = computeAnalyticsReport(transactions, currency);
  const savings = computeSavingsReport(transactions, undefined, currency);
  const subscriptions = computeSubscriptionAudit(transactions, {}, currency);
  const aiReport = generateVerifiedFinancialInsights(transactions, currency);
  const budget = computePersonalizedBudget(transactions, {}, currency);

  // Mask account number to never expose full sensitive numbers
  const rawNum = account.accountNumberMasked || account.id || '0000000000';
  const cleanMasked = rawNum.length >= 4 ? `****${rawNum.slice(-4)}` : '****';

  // 1. Statement Overview
  const statementOverview = {
    bankName: account.bankName,
    accountName: account.accountName,
    accountNumberMasked: cleanMasked,
    periodStart: statement.periodStart,
    periodEnd: statement.periodEnd,
    totalTransactions: transactions.length,
    openingBalance: round2(account.openingBalance || 0),
    closingBalance: round2(account.closingBalance || 0),
    netBalanceChange: round2((account.closingBalance || 0) - (account.openingBalance || 0)),
  };

  // 2. Financial Summary
  const financialSummary = {
    totalExternalIncome: audit.income.totalIncome,
    totalActualExpenses: audit.expenses.netLivingExpenses,
    netCashFlow: audit.netCashFlow,
    savingsRatePercent: audit.savingsRate,
    financialHealthScore: healthScore.overallScore,
    healthRating: healthScore.rating,
  };

  // 3. Income Analysis
  const incomeCredits = transactions.filter((t) => t.isIncome && !t.isInternalTransfer && !t.isRefund);
  const incomeTransactionCount = incomeCredits.length;
  const averageIncomePerCredit =
    incomeTransactionCount > 0 ? round2(audit.income.totalIncome / incomeTransactionCount) : 0;

  const topIncomeSources: Array<{ source: string; amount: number; percentage: number; count: number }> = [];
  if (audit.income.salary > 0) {
    topIncomeSources.push({
      source: 'Salary / Employment',
      amount: audit.income.salary,
      percentage: audit.income.totalIncome > 0 ? round2((audit.income.salary / audit.income.totalIncome) * 100) : 0,
      count: transactions.filter((t) => t.category === 'Salary').length,
    });
  }
  if (audit.income.businessIncome > 0) {
    topIncomeSources.push({
      source: 'Business / Commercial',
      amount: audit.income.businessIncome,
      percentage: audit.income.totalIncome > 0 ? round2((audit.income.businessIncome / audit.income.totalIncome) * 100) : 0,
      count: transactions.filter((t) => t.category === 'Business Income').length,
    });
  }
  if (audit.income.clientPayments > 0) {
    topIncomeSources.push({
      source: 'Client Invoicing & Freelance',
      amount: audit.income.clientPayments,
      percentage: audit.income.totalIncome > 0 ? round2((audit.income.clientPayments / audit.income.totalIncome) * 100) : 0,
      count: transactions.filter((t) => t.category === 'Client Payment' || t.category === 'Freelance').length,
    });
  }
  if (audit.income.investmentReturns > 0) {
    topIncomeSources.push({
      source: 'Investment Returns',
      amount: audit.income.investmentReturns,
      percentage: audit.income.totalIncome > 0 ? round2((audit.income.investmentReturns / audit.income.totalIncome) * 100) : 0,
      count: transactions.filter((t) => t.category === 'Investment Return').length,
    });
  }
  if (audit.income.externalIncome && audit.income.externalIncome > 0) {
    topIncomeSources.push({
      source: 'External Bank Inflows',
      amount: audit.income.externalIncome,
      percentage: audit.income.totalIncome > 0 ? round2((audit.income.externalIncome / audit.income.totalIncome) * 100) : 0,
      count: transactions.filter((t) => t.financialType === 'EXTERNAL_INCOME' || t.category === 'Transfers Received').length || 1,
    });
  } else if (audit.income.otherIncome > 0) {
    topIncomeSources.push({
      source: 'Other External Inflows',
      amount: audit.income.otherIncome,
      percentage: audit.income.totalIncome > 0 ? round2((audit.income.otherIncome / audit.income.totalIncome) * 100) : 0,
      count: transactions.filter((t) => t.category === 'Other Income' || t.category === 'Transfers Received' || t.category === 'Income').length,
    });
  }

  const incomeAnalysis = {
    totalIncome: audit.income.totalIncome,
    incomeTransactionCount,
    topIncomeSources,
    averageIncomePerCredit,
  };

  // 4. Expense Analysis
  const expenseAnalysis = {
    grossLivingExpenses: audit.expenses.netLivingExpenses,
    dailyBurnRate: analytics.frequencyAnalytics.averageDailyBurnRate,
    activeSpendingDays: analytics.frequencyAnalytics.activeSpendingDays,
    groups: analytics.categoryGroupAnalytics.map((g) => ({
      group: g.group,
      amount: g.totalSpent,
      percentage: g.percentageOfTotal,
    })),
  };

  // 5. Cash Flow
  const cashFlow = {
    totalInflows: audit.reconciliation.totalCredits,
    totalOutflows: audit.reconciliation.totalDebits,
    netSurplus: audit.netCashFlow,
    savingsTransfersExcluded: audit.wealth.savingsDeposits + audit.wealth.savingsWithdrawals,
    internalTransfersExcluded: audit.transfers.internalTransfersOut + audit.transfers.internalTransfersIn,
  };

  // 6. Savings Analysis
  const savingsAnalysis = {
    totalDeposited: savings.metrics.totalDeposited,
    totalWithdrawn: savings.metrics.totalWithdrawn,
    netRetainedSavings: savings.metrics.netSavings,
    retentionRatePercent: savings.metrics.retentionRate,
    interestEarned: savings.metrics.interestEarned,
    annualizedYieldRunRate: savings.metrics.annualizedInterestRunRate,
    velocityAverageContribution: savings.metrics.averageContribution,
    largestContribution: savings.metrics.largestContribution ? savings.metrics.largestContribution.amount : 0,
    largestWithdrawal: savings.metrics.largestWithdrawal ? savings.metrics.largestWithdrawal.amount : 0,
  };

  // 7. Spending Categories
  const spendingCategories = analytics.categoryAnalytics.slice(0, 10).map((c) => ({
    category: c.category,
    group: c.categoryGroup,
    amount: c.totalSpent,
    percentage: c.percentageOfTotal,
    count: c.transactionCount,
  }));

  // 8. Merchant Analysis
  const merchantAnalysis = analytics.merchantAnalytics.slice(0, 10).map((m) => ({
    merchant: m.merchant,
    category: m.category,
    totalSpent: m.totalSpent,
    percentageOfTotal: m.percentageOfTotal,
    transactionCount: m.transactionCount,
    averageTicket: m.averageTransaction,
  }));

  // 9. Recurring Payments
  const recurringPayments = {
    activeCommitmentsCount: subscriptions.metrics.totalActiveRecurringCount,
    potentialSubscriptionsCount: subscriptions.metrics.activeSubscriptionsCount,
    totalMonthlyRecurringCost: subscriptions.metrics.totalMonthlyRecurringCost,
    totalAnnualRecurringCost: subscriptions.metrics.totalAnnualRecurringCost,
    topRecurringItems: subscriptions.activeRecurring.slice(0, 8).map((r) => ({
      merchant: r.cleanMerchant,
      cadence: r.cadenceLabel,
      averagePayment: r.averagePayment,
      monthlyCost: r.monthlyCost,
      annualCost: r.annualEstimatedCost,
      isSubscription: r.isPotentialSubscription,
      nextDue: r.nextEstimatedPaymentDate,
    })),
  };

  // 10. Largest Transactions
  const largestTransactions = {
    debits: (analytics.largestTransactions.topDebits || []).slice(0, 5).map((d) => ({
      date: d.date,
      description: d.description,
      merchant: d.merchant,
      amount: d.amount,
      category: d.category,
    })),
    credits: (analytics.largestTransactions.topCredits || []).slice(0, 5).map((c) => ({
      date: c.date,
      description: c.description,
      sender: c.sender,
      amount: c.amount,
      category: c.category,
    })),
  };

  // 11. Financial Insights
  const financialInsights = aiReport.insights.slice(0, 5).map((vi) => ({
    title: vi.title,
    summary: vi.summary,
    severity: vi.severity,
    category: vi.category,
  }));

  // 12. Budget Analysis
  const budgetAnalysis = {
    monthlyIncomeBaseline: budget.summary.totalIncome,
    targetSavings: budget.summary.categoryDistribution.financial?.amount || 0,
    targetNeeds: budget.summary.categoryDistribution.essential?.amount || 0,
    targetWants: budget.summary.categoryDistribution.lifestyle?.amount || 0,
    recommendedLimits: budget.categories.slice(0, 8).map((cat) => {
      let status: 'under' | 'on_track' | 'exceeded' = 'on_track';
      if (cat.status === 'OVER_BUDGET') status = 'exceeded';
      else if (cat.actualSpend < cat.currentTarget * 0.8) status = 'under';
      else status = 'on_track';

      return {
        category: cat.category,
        currentSpent: cat.actualSpend,
        recommendedLimit: cat.currentTarget,
        variance: cat.variance,
        status,
      };
    }),
  };

  // 13. Recommendations
  const recommendations: string[] = [];
  if (audit.savingsRate < 15) {
    recommendations.push(
      `Your current savings rate is ${audit.savingsRate.toFixed(1)}%. Aim to reach at least 20% by establishing an automated sweep on payday.`
    );
  } else {
    recommendations.push(
      `Healthy savings retention of ${audit.savingsRate.toFixed(1)}%. Maintain consistent sweep frequency to protect against mid-month drawdown.`
    );
  }

  if (subscriptions.metrics.totalMonthlyRecurringCost > 0) {
    recommendations.push(
      `Review your ${subscriptions.metrics.totalActiveRecurringCount} active recurring commitments totaling ₦${subscriptions.metrics.totalMonthlyRecurringCost.toLocaleString()}/month to eliminate dormant or duplicate digital subscriptions.`
    );
  }

  if (analytics.categoryAnalytics.length > 0) {
    const topCat = analytics.categoryAnalytics[0];
    recommendations.push(
      `Your largest living expenditure is ${topCat.category} (₦${topCat.totalSpent.toLocaleString()}, ${topCat.percentageOfTotal.toFixed(1)}% of living expenses). Setting a weekly limit here will have the highest cash flow impact.`
    );
  }

  recommendations.push(
    `Financial Health Score stands at ${healthScore.overallScore}/100 (${healthScore.rating}). Maintain living expenses below ₦${audit.expenses.netLivingExpenses.toLocaleString()} to sustain positive cash flow.`
  );

  return {
    generatedAt: new Date().toISOString().slice(0, 10),
    currency,
    statementOverview,
    financialSummary,
    incomeAnalysis,
    expenseAnalysis,
    cashFlow,
    savingsAnalysis,
    spendingCategories,
    merchantAnalysis,
    recurringPayments,
    largestTransactions,
    financialInsights,
    budgetAnalysis,
    recommendations,
  };
}
