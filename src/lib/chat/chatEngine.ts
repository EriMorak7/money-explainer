import type { Currency, Transaction, TransactionCategory } from '../../types/index.ts';
import { formatCurrency } from '../utils.ts';
import {
  auditFinancialCalculations,
  isExcludedFromLivingExpenses,
  round2,
} from '../calculations/financialEngine.ts';
import {
  computeAnalyticsReport,
} from '../calculations/analyticsEngine.ts';
import type { ChatIntent, ChatMessage, ChatQueryResult, CitedTransaction } from './types.ts';

const KNOWN_CATEGORIES: { name: TransactionCategory; keywords: string[] }[] = [
  { name: 'Food Delivery', keywords: ['food delivery', 'delivery', 'chowdeck', 'glovo', 'bolt food'] },
  { name: 'Restaurants', keywords: ['restaurant', 'dining out', 'fast food', 'eatery', 'chicken', 'bukka'] },
  { name: 'Groceries', keywords: ['groceries', 'supermarket', 'market', 'provisions', 'store'] },
  { name: 'Food', keywords: ['food', 'eating', 'meals', 'lunch', 'dinner', 'breakfast', 'cook', 'kitchen'] },
  { name: 'Transportation', keywords: ['transport', 'transportation', 'uber', 'bolt', 'ride', 'bus', 'fare', 'cab'] },
  { name: 'Fuel', keywords: ['fuel', 'petrol', 'gas', 'diesel', 'filling station', 'nnpc', 'total', 'conoil'] },
  { name: 'Airtime', keywords: ['airtime', 'recharge', 'vtu', 'topup', 'top-up', 'call credit'] },
  { name: 'Data', keywords: ['data', 'internet', 'bundle', 'wifi', 'spectranet', 'fiber'] },
  { name: 'Subscriptions', keywords: ['subscription', 'subscriptions', 'netflix', 'spotify', 'apple', 'youtube', 'google play'] },
  { name: 'Entertainment', keywords: ['entertainment', 'cinema', 'movie', 'show', 'outing'] },
  { name: 'Gaming', keywords: ['gaming', 'game', 'playstation', 'steam', 'xbox'] },
  { name: 'Shopping', keywords: ['shopping', 'clothes', 'shoes', 'gadgets', 'jumia', 'konga', 'amazon'] },
  { name: 'Rent', keywords: ['rent', 'landlord', 'apartment', 'housing', 'lease'] },
  { name: 'Utilities', keywords: ['utilities', 'electricity', 'nepa', 'ekedc', 'ikedc', 'water', 'waste'] },
  { name: 'Healthcare', keywords: ['healthcare', 'health', 'hospital', 'pharmacy', 'drugs', 'medication', 'doctor'] },
  { name: 'Education', keywords: ['education', 'school', 'tuition', 'course', 'books', 'exam'] },
  { name: 'Savings', keywords: ['savings', 'save', 'saved', 'vault', 'owealth', 'piggyvest', 'cowrywise', 'lock'] },
  { name: 'Church & Tithe', keywords: ['church', 'tithe', 'offering', 'pastor', 'mosque'] },
  { name: 'Family Support', keywords: ['family', 'parents', 'mom', 'dad', 'sister', 'brother', 'family support'] },
  { name: 'Giving', keywords: ['giving', 'charity', 'donation', 'gift'] },
  { name: 'Betting & Gambling', keywords: ['bet', 'betting', 'gambling', 'sportybet', 'bet9ja', '1xbet'] },
  { name: 'Bank Charges', keywords: ['bank charge', 'bank charges', 'bank fee', 'fees', 'stamp duty', 'sms fee', 'vat', 'maintenance fee'] },
];

/**
 * Classifies user prompt into a structured financial query intent and extracts target entities.
 */
export function classifyQueryIntent(query: string, transactions: Transaction[]): {
  intent: ChatIntent;
  entities: {
    category?: TransactionCategory | string;
    merchant?: string;
    keyword?: string;
  };
} {
  const q = query.toLowerCase().trim();

  // 1. Bank Charges
  if (q.includes('bank charge') || q.includes('bank fee') || q.includes('stamp duty') || q.includes('sms charge') || q.includes('charges')) {
    return { intent: 'BANK_CHARGES', entities: { category: 'Bank Charges' } };
  }

  // 2. Refunds / Reversals
  if (q.includes('refund') || q.includes('reversal') || q.includes('reversed') || q.includes('returned money')) {
    return { intent: 'REFUNDS', entities: {} };
  }

  // 3. Largest / Top / Peak Transactions
  if (
    q.includes('largest') ||
    q.includes('biggest') ||
    q.includes('most expensive') ||
    q.includes('highest transaction') ||
    q.includes('top transaction') ||
    q.includes('highest debit') ||
    q.includes('highest credit')
  ) {
    return { intent: 'LARGEST_TRANSACTIONS', entities: {} };
  }

  // 4. Burn Rate & Daily Velocity
  if (q.includes('burn rate') || q.includes('daily spend') || q.includes('spend per day') || q.includes('daily average')) {
    return { intent: 'DAILY_BURN_RATE', entities: {} };
  }

  // 5. Highest Spending Days
  if (q.includes('highest spending day') || q.includes('costliest day') || q.includes('busiest day') || q.includes('peak day')) {
    return { intent: 'HIGHEST_SPENDING_DAYS', entities: {} };
  }

  // 6. Net Cash Flow
  if (q.includes('cash flow') || q.includes('net cash') || q.includes('surplus') || q.includes('deficit') || q.includes('profit') || q.includes('cashflow')) {
    return { intent: 'NET_CASH_FLOW', entities: {} };
  }

  // 7. Savings Queries
  if (
    q.includes('how much did i save') ||
    q.includes('how much did i put into savings') ||
    q.includes('savings rate') ||
    q.includes('savings sweep') ||
    q.includes('owealth') ||
    q.includes('piggyvest') ||
    q.includes('cowrywise') ||
    (q.includes('savings') && !q.includes('food') && !q.includes('merchant'))
  ) {
    return { intent: 'SAVINGS_TOTAL', entities: { category: 'Savings' } };
  }

  // 8. Income Queries
  if (
    q.includes('income') ||
    q.includes('how much did i make') ||
    q.includes('how much came in') ||
    q.includes('salary') ||
    q.includes('earnings') ||
    q.includes('total credit') ||
    q.includes('inflow')
  ) {
    return { intent: 'INCOME_TOTAL', entities: {} };
  }

  // 9. Overall Spending / Expense Queries
  if (
    q.includes('total spend') ||
    q.includes('how much did i spend in total') ||
    q.includes('total expenses') ||
    q.includes('overall spend') ||
    q.includes('total out')
  ) {
    return { intent: 'EXPENSE_TOTAL', entities: {} };
  }

  // 10. Category Spend Match
  for (const cat of KNOWN_CATEGORIES) {
    for (const kw of cat.keywords) {
      if (q.includes(kw)) {
        return { intent: 'CATEGORY_SPEND', entities: { category: cat.name, keyword: kw } };
      }
    }
  }

  // 11. Known Merchant Match in Transactions
  // Extract all distinct merchant names from active dataset
  const merchantNames = Array.from(
    new Set(transactions.map((t) => (t.merchant || t.description.split('|')[0]).trim()).filter(Boolean))
  );

  for (const m of merchantNames) {
    if (m.length > 2 && q.includes(m.toLowerCase())) {
      return { intent: 'MERCHANT_SPEND', entities: { merchant: m } };
    }
  }

  // 12. Check if user explicitly asked "How much at [word]" or "at [word]"
  const atMatch = q.match(/(?:at|on|for|to)\s+([a-zA-Z0-9_\s&'-]+?)(?:\?|$|\.|\,)/i);
  if (atMatch && atMatch[1]) {
    const candidate = atMatch[1].trim();
    if (candidate.length > 2 && !['this', 'the', 'my', 'october', 'november', 'week', 'month'].includes(candidate.toLowerCase())) {
      return { intent: 'MERCHANT_SPEND', entities: { merchant: candidate } };
    }
  }

  // 13. General Summary
  if (q.includes('summary') || q.includes('overview') || q.includes('breakdown') || q.includes('what happened') || q.includes('statement')) {
    return { intent: 'GENERAL_FINANCIAL_SUMMARY', entities: {} };
  }

  return { intent: 'NO_MATCH', entities: { keyword: q } };
}

/**
 * Executes deterministic data queries against the verified transaction dataset.
 * Guarantees zero fabrication or hallucination: every number is strictly calculated from data.
 */
export function executeFinancialQuery(
  query: string,
  transactions: Transaction[],
  currency: Currency = 'NGN'
): ChatQueryResult {
  const { intent, entities } = classifyQueryIntent(query, transactions);
  const audit = auditFinancialCalculations(transactions, 0, 0, currency);
  const analytics = computeAnalyticsReport(transactions, currency);

  function makeResult(
    totalAmount: number,
    transactionCount: number,
    cited: Transaction[],
    groundingExplanation: string,
    traceFilter?: ChatQueryResult['traceFilter']
  ): ChatQueryResult {
    const citedTransactions: CitedTransaction[] = cited.slice(0, 10).map((t) => ({
      id: t.id,
      date: t.date,
      description: t.description,
      merchant: t.merchant || t.description.split('|')[0].trim(),
      amount: round2(t.direction === 'DEBIT' ? t.debit || t.amount : t.credit || t.amount),
      direction: t.direction,
      category: t.category,
    }));

    return {
      intent,
      query,
      entities,
      totalAmount: round2(totalAmount),
      transactionCount,
      averageAmount: transactionCount > 0 ? round2(totalAmount / transactionCount) : 0,
      citedTransactions,
      traceFilter,
      isGroundingVerified: true,
      groundingExplanation,
    };
  }

  switch (intent) {
    case 'CATEGORY_SPEND': {
      const targetCategory = entities.category as TransactionCategory;
      const isGeneralFood = targetCategory === 'Food';
      const isGeneralGiving = targetCategory === 'Giving';

      const matchingTxs = transactions.filter((t) => {
        if (!t.isExpense || isExcludedFromLivingExpenses(t)) return false;
        if (isGeneralFood) {
          return (
            t.category === 'Food' ||
            t.category === 'Food Delivery' ||
            t.category === 'Restaurants' ||
            t.category === 'Groceries'
          );
        }
        if (isGeneralGiving) {
          return (
            t.category === 'Giving' ||
            t.category === 'Church & Tithe' ||
            t.category === 'Family Support' ||
            t.category === 'Charity' ||
            t.category === 'Gifts'
          );
        }
        return t.category === targetCategory;
      });
      const sum = matchingTxs.reduce((s, t) => s + (t.debit || t.amount), 0);
      const displayLabel = isGeneralFood ? 'Food & Dining' : isGeneralGiving ? 'Giving & Support' : targetCategory;

      return makeResult(
        sum,
        matchingTxs.length,
        matchingTxs,
        `Audited from ${matchingTxs.length} living expense debits under category "${displayLabel}". Internal transfers and savings sweeps are excluded.`,
        { category: targetCategory }
      );
    }

    case 'MERCHANT_SPEND': {
      const targetMerchant = (entities.merchant || '').toLowerCase();
      const matchingTxs = transactions.filter((t) => {
        const m = (t.merchant || t.description).toLowerCase();
        return m.includes(targetMerchant);
      });

      const expenseTxs = matchingTxs.filter((t) => t.direction === 'DEBIT');
      const sum = expenseTxs.reduce((s, t) => s + (t.debit || t.amount), 0);

      return makeResult(
        sum,
        expenseTxs.length,
        expenseTxs,
        matchingTxs.length > 0
          ? `Calculated from ${expenseTxs.length} debit transactions matching vendor "${entities.merchant}".`
          : `No transactions found matching vendor "${entities.merchant}" in this statement period.`,
        matchingTxs.length > 0 ? { search: entities.merchant } : undefined
      );
    }

    case 'INCOME_TOTAL': {
      const incomeTxs = transactions.filter(
        (t) => t.isIncome && !t.isInternalTransfer && !t.isRefund && !t.isSavings
      );

      return makeResult(
        audit.income.totalIncome,
        incomeTxs.length,
        incomeTxs,
        `Audited true external income. Excludes internal transfers in (₦${audit.income.excludedInflows.internalTransfersIn.toLocaleString()}) and savings withdrawals (₦${audit.income.excludedInflows.savingsWithdrawals.toLocaleString()}) to prevent false income inflation.`,
        { type: 'INCOME' }
      );
    }

    case 'SAVINGS_TOTAL': {
      const savings = analytics.savingsTrends;
      const savingsTxs = transactions.filter(
        (t) => t.isSavings || /owealth|piggyvest|cowrywise|savings/i.test(t.description)
      );

      return makeResult(
        savings.netRetainedSavings,
        savingsTxs.length,
        savingsTxs,
        `Net retained savings = ₦${savings.totalDeposited.toLocaleString()} deposited into vaults minus ₦${savings.totalWithdrawn.toLocaleString()} withdrawn, achieving a ${savings.retentionRate.toFixed(1)}% sweep retention rate.`,
        { category: 'Savings' }
      );
    }

    case 'EXPENSE_TOTAL': {
      const expenseTxs = transactions.filter((t) => t.isExpense && !isExcludedFromLivingExpenses(t));

      return makeResult(
        audit.expenses.grossLivingExpenses,
        expenseTxs.length,
        expenseTxs,
        `Audited gross living expenses. Excludes savings deposits (₦${audit.expenses.excludedOutflows.savingsDeposits.toLocaleString()}) and peer transfers to ensure accurate lifestyle burn.`,
        { type: 'EXPENSE' }
      );
    }

    case 'NET_CASH_FLOW': {
      return makeResult(
        audit.netCashFlow,
        transactions.length,
        transactions.slice(0, 10),
        `Audited Net Cash Flow = True External Income (₦${audit.income.totalIncome.toLocaleString()}) minus Gross Living Expenses (₦${audit.expenses.grossLivingExpenses.toLocaleString()}) = ₦${audit.netCashFlow.toLocaleString()}.`,
        undefined
      );
    }

    case 'LARGEST_TRANSACTIONS': {
      const topDebits = transactions
        .filter((t) => t.direction === 'DEBIT')
        .sort((a, b) => (b.debit || b.amount) - (a.debit || a.amount));

      const sumTop5 = topDebits.slice(0, 5).reduce((s, t) => s + (t.debit || t.amount), 0);

      return makeResult(
        sumTop5,
        topDebits.length,
        topDebits.slice(0, 5),
        `Top 5 largest debit transactions extracted directly from the verified transaction ledger.`,
        undefined
      );
    }

    case 'BANK_CHARGES': {
      const chargeTxs = transactions.filter(
        (t) => t.category === 'Bank Charges' || t.transactionType === 'BANK_CHARGE'
      );

      return makeResult(
        audit.expenses.bankCharges,
        chargeTxs.length,
        chargeTxs,
        `Audited cumulative bank transfer fees, stamp duties, and SMS charges across ${chargeTxs.length} fee deductions.`,
        { category: 'Bank Charges' }
      );
    }

    case 'REFUNDS': {
      const refundTxs = transactions.filter((t) => t.isRefund || t.category === 'Refund');

      return makeResult(
        audit.expenses.refundsOffset,
        refundTxs.length,
        refundTxs,
        `Audited refunds and transaction reversals offsetting living expenses.`,
        { category: 'Refund' }
      );
    }

    case 'DAILY_BURN_RATE': {
      const freq = analytics.frequencyAnalytics;
      return makeResult(
        freq.averageDailyBurnRate,
        freq.totalTransactions,
        transactions.slice(0, 5),
        `Average living expense burn rate = ₦${audit.expenses.grossLivingExpenses.toLocaleString()} divided by ${freq.totalDaysInPeriod} statement days = ₦${freq.averageDailyBurnRate.toLocaleString()}/day across ${freq.activeSpendingDays} active spending days.`,
        undefined
      );
    }

    case 'HIGHEST_SPENDING_DAYS': {
      const topDay = analytics.highestSpendingDays[0];
      const sumTop3 = analytics.highestSpendingDays.slice(0, 3).reduce((s, d) => s + d.totalSpending, 0);
      const topDayTxs = transactions.filter((t) => t.date === topDay?.date && t.direction === 'DEBIT');

      return makeResult(
        sumTop3,
        analytics.highestSpendingDays.length,
        topDayTxs,
        `Ranked highest spending day is ${topDay?.formattedDate || 'N/A'} at ₦${topDay?.totalSpending.toLocaleString()} with top category "${topDay?.topCategory}".`,
        topDay ? { search: topDay.date } : undefined
      );
    }

    case 'GENERAL_FINANCIAL_SUMMARY':
    default: {
      return makeResult(
        audit.netCashFlow,
        transactions.length,
        transactions.slice(0, 5),
        `Statement Period: ${analytics.periodStart} to ${analytics.periodEnd}. Income: ₦${audit.income.totalIncome.toLocaleString()} | Living Expenses: ₦${audit.expenses.grossLivingExpenses.toLocaleString()} | Retained Savings: ₦${analytics.savingsTrends.netRetainedSavings.toLocaleString()} | Net Cash Flow: ₦${audit.netCashFlow.toLocaleString()}.`,
        undefined
      );
    }
  }
}

/**
 * Formulates the conversational response from the query result.
 * Never fabricates numbers; only cites exact figures from the query result.
 */
export function generateChatResponse(
  query: string,
  transactions: Transaction[],
  currency: Currency = 'NGN'
): ChatMessage {
  const result = executeFinancialQuery(query, transactions, currency);
  const fmt = (val: number) => formatCurrency(val, currency);

  let content = '';

  switch (result.intent) {
    case 'CATEGORY_SPEND': {
      const cat = result.entities.category;
      if (result.transactionCount > 0) {
        content = `According to your verified statement, you spent **${fmt(result.totalAmount)}** on **${cat}** across **${result.transactionCount} transactions** (averaging ${fmt(result.averageAmount)} per transaction).\n\nThis represents strictly verified living expenditures; non-expense transfers and sweeps are excluded.`;
      } else {
        content = `No expenses were found under the category **${cat}** in your uploaded statement for this period. Total spent is **${fmt(0)}**.`;
      }
      break;
    }

    case 'MERCHANT_SPEND': {
      const m = result.entities.merchant;
      if (result.transactionCount > 0) {
        content = `You have spent **${fmt(result.totalAmount)}** with **${m}** across **${result.transactionCount} transactions** in this period (averaging ${fmt(result.averageAmount)} per transaction).`;
      } else {
        content = `No transactions were found for merchant **"${m}"** in your statement between the recorded period. You have spent **${fmt(0)}** with this vendor.`;
      }
      break;
    }

    case 'INCOME_TOTAL': {
      content = `Your **true external income** for this statement period is **${fmt(result.totalAmount)}** across **${result.transactionCount} inflow transactions**.\n\n*Accounting Note:* Internal transfers and savings withdrawals are strictly excluded so your income is never artificially inflated.`;
      break;
    }

    case 'SAVINGS_TOTAL': {
      content = `Your **net retained savings** for this period is **${fmt(result.totalAmount)}** across **${result.transactionCount} savings vault transactions** (OWealth/PiggyVest).\n\n${result.groundingExplanation}`;
      break;
    }

    case 'EXPENSE_TOTAL': {
      content = `Your total **gross living expenses** amounted to **${fmt(result.totalAmount)}** across **${result.transactionCount} expense debits**.\n\n*Accounting Rule:* Capital preserved in savings vaults and peer transfers are isolated from living costs.`;
      break;
    }

    case 'NET_CASH_FLOW': {
      const prefix = result.totalAmount >= 0 ? '+' : '';
      content = `Your audited **net cash flow** is **${prefix}${fmt(result.totalAmount)}**.\n\n${result.groundingExplanation}`;
      break;
    }

    case 'LARGEST_TRANSACTIONS': {
      content = `Here are your largest transactions on record. Your top 5 debit transactions totaled **${fmt(result.totalAmount)}**.\n\nCheck the cited transactions below for exact dates, merchants, and references.`;
      break;
    }

    case 'BANK_CHARGES': {
      content = `You incurred **${fmt(result.totalAmount)}** in cumulative bank charges and transaction fees across **${result.transactionCount} fee deductions**.`;
      break;
    }

    case 'REFUNDS': {
      content = `You received **${fmt(result.totalAmount)}** in refunds or transaction reversals across **${result.transactionCount} records**, offsetting your gross expenses.`;
      break;
    }

    case 'DAILY_BURN_RATE': {
      content = `Your calculated **average daily burn rate** is **${fmt(result.totalAmount)} per day**.\n\n${result.groundingExplanation}`;
      break;
    }

    case 'HIGHEST_SPENDING_DAYS': {
      content = `Your top 3 highest spending days accumulated **${fmt(result.totalAmount)}** in living expenses.\n\n${result.groundingExplanation}`;
      break;
    }

    case 'GENERAL_FINANCIAL_SUMMARY':
    default: {
      content = `Here is your verified financial breakdown for this statement period:\n\n${result.groundingExplanation}\n\nYou can ask me specific questions like *"How much did I spend on food?"*, *"Who was my top merchant?"*, or *"What was my savings rate?"*.`;
      break;
    }
  }

  return {
    id: `msg_asst_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    role: 'assistant',
    content,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    queryResult: result,
  };
}
