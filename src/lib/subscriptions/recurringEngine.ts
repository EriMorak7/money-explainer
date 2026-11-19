import type { Transaction, Currency } from '../../types/index.ts';
import { round2 } from '../calculations/financialEngine.ts';
import type {
  RecurringCadence,
  RecurringClassification,
  RecurringMerchant,
  SubscriptionAuditMetrics,
  SubscriptionAuditReport,
  SubscriptionCategory,
  UserLabelOverride,
} from './types';

// Curated subscription and recurring SaaS catalog with regex signatures and category tags
interface KnownSubscriptionSignature {
  pattern: RegExp;
  cleanName: string;
  category: SubscriptionCategory;
  defaultCadence: RecurringCadence;
}

const KNOWN_SUBSCRIPTIONS: KnownSubscriptionSignature[] = [
  // Streaming
  { pattern: /netflix/i, cleanName: 'Netflix', category: 'Streaming', defaultCadence: 'monthly' },
  { pattern: /spotify/i, cleanName: 'Spotify', category: 'Streaming', defaultCadence: 'monthly' },
  { pattern: /youtube\s*(?:premium|music)?/i, cleanName: 'YouTube Premium', category: 'Streaming', defaultCadence: 'monthly' },
  { pattern: /dstv|multichoice/i, cleanName: 'DSTV (MultiChoice)', category: 'Streaming', defaultCadence: 'monthly' },
  { pattern: /showmax/i, cleanName: 'Showmax', category: 'Streaming', defaultCadence: 'monthly' },
  { pattern: /startimes/i, cleanName: 'StarTimes', category: 'Streaming', defaultCadence: 'monthly' },
  { pattern: /disney\s*\+?/i, cleanName: 'Disney+', category: 'Streaming', defaultCadence: 'monthly' },
  { pattern: /prime\s*video|amazon\s*prime/i, cleanName: 'Amazon Prime', category: 'Streaming', defaultCadence: 'monthly' },
  { pattern: /apple\s*music|itunes/i, cleanName: 'Apple Music / iTunes', category: 'Streaming', defaultCadence: 'monthly' },
  { pattern: /audiomack/i, cleanName: 'Audiomack', category: 'Streaming', defaultCadence: 'monthly' },
  { pattern: /deezer/i, cleanName: 'Deezer', category: 'Streaming', defaultCadence: 'monthly' },

  // Software & SaaS
  { pattern: /adobe/i, cleanName: 'Adobe Creative Cloud', category: 'Software & SaaS', defaultCadence: 'monthly' },
  { pattern: /canva/i, cleanName: 'Canva', category: 'Software & SaaS', defaultCadence: 'monthly' },
  { pattern: /chatgpt|openai/i, cleanName: 'OpenAI / ChatGPT Plus', category: 'Software & SaaS', defaultCadence: 'monthly' },
  { pattern: /anthropic|claude(?:\.ai)?/i, cleanName: 'Anthropic Claude Pro', category: 'Software & SaaS', defaultCadence: 'monthly' },
  { pattern: /microsoft|msft\s*\*|office\s*365/i, cleanName: 'Microsoft 365', category: 'Software & SaaS', defaultCadence: 'monthly' },
  { pattern: /google\s*(?:storage|one|workspace)/i, cleanName: 'Google One / Workspace', category: 'Software & SaaS', defaultCadence: 'monthly' },
  { pattern: /github/i, cleanName: 'GitHub Copilot / Pro', category: 'Software & SaaS', defaultCadence: 'monthly' },
  { pattern: /figma/i, cleanName: 'Figma', category: 'Software & SaaS', defaultCadence: 'monthly' },
  { pattern: /notion/i, cleanName: 'Notion Labs', category: 'Software & SaaS', defaultCadence: 'monthly' },
  { pattern: /zoom(?:\.us)?/i, cleanName: 'Zoom Video', category: 'Software & SaaS', defaultCadence: 'monthly' },
  { pattern: /slack/i, cleanName: 'Slack Technologies', category: 'Software & SaaS', defaultCadence: 'monthly' },
  { pattern: /dropbox/i, cleanName: 'Dropbox', category: 'Software & SaaS', defaultCadence: 'monthly' },
  { pattern: /1password/i, cleanName: '1Password', category: 'Software & SaaS', defaultCadence: 'annual' },
  { pattern: /grammarly/i, cleanName: 'Grammarly', category: 'Software & SaaS', defaultCadence: 'monthly' },
  { pattern: /linkedin(?:\s*premium)?/i, cleanName: 'LinkedIn Premium', category: 'Software & SaaS', defaultCadence: 'monthly' },

  // Cloud & Hosting
  { pattern: /vercel/i, cleanName: 'Vercel', category: 'Cloud & Hosting', defaultCadence: 'monthly' },
  { pattern: /heroku/i, cleanName: 'Heroku', category: 'Cloud & Hosting', defaultCadence: 'monthly' },
  { pattern: /digitalocean/i, cleanName: 'DigitalOcean', category: 'Cloud & Hosting', defaultCadence: 'monthly' },
  { pattern: /aws|amazon\s*web\s*services/i, cleanName: 'Amazon Web Services', category: 'Cloud & Hosting', defaultCadence: 'monthly' },
  { pattern: /supabase/i, cleanName: 'Supabase', category: 'Cloud & Hosting', defaultCadence: 'monthly' },
  { pattern: /namecheap/i, cleanName: 'Namecheap', category: 'Cloud & Hosting', defaultCadence: 'annual' },
  { pattern: /cloudflare/i, cleanName: 'Cloudflare', category: 'Cloud & Hosting', defaultCadence: 'monthly' },
  { pattern: /starlink/i, cleanName: 'Starlink Internet', category: 'Cloud & Hosting', defaultCadence: 'monthly' },

  // App Store & Gaming
  { pattern: /google\s*\*?\s*play/i, cleanName: 'Google Play Services', category: 'Gaming & App Store', defaultCadence: 'monthly' },
  { pattern: /apple\.com\/bill/i, cleanName: 'Apple Services', category: 'Gaming & App Store', defaultCadence: 'monthly' },
  { pattern: /playstation|sony\s*ent/i, cleanName: 'PlayStation Network', category: 'Gaming & App Store', defaultCadence: 'monthly' },
  { pattern: /xbox|microsoft\s*games/i, cleanName: 'Xbox Game Pass', category: 'Gaming & App Store', defaultCadence: 'monthly' },
  { pattern: /steam\s*games?/i, cleanName: 'Steam Games', category: 'Gaming & App Store', defaultCadence: 'irregular' },

  // Telecom & Data Bundles
  { pattern: /spectranet/i, cleanName: 'Spectranet 4G LTE', category: 'Telecom & Mobile', defaultCadence: 'monthly' },
  { pattern: /swift\s*networks?/i, cleanName: 'Swift Networks', category: 'Telecom & Mobile', defaultCadence: 'monthly' },
  { pattern: /smile\s*telecom/i, cleanName: 'Smile Communications', category: 'Telecom & Mobile', defaultCadence: 'monthly' },
];

/**
 * Normalizes raw merchant strings and descriptions by stripping POS noise,
 * transaction rails, terminal numbers, and reference fragments.
 */
export function normalizeMerchantName(raw: string): { cleanName: string; knownMatch?: KnownSubscriptionSignature } {
  if (!raw) return { cleanName: 'Unspecified Merchant' };

  let s = raw.trim();

  // Check known subscription signature match first
  for (const sig of KNOWN_SUBSCRIPTIONS) {
    if (sig.pattern.test(s)) {
      return { cleanName: sig.cleanName, knownMatch: sig };
    }
  }

  // Strip common bank transfer / processor artifacts
  s = s.replace(/^(?:POS\s*PURCHASE|WEB\s*PURCHASE|TRF\s*TO|TRANSFER\s*TO|PAYMENT\s*TO|FLW\*|PAYSTACK\*|STRIPE\*|INTERSWITCH\*)\s*[:-]?\s*/i, '');
  s = s.replace(/\b(?:LTD|LIMITED|PLC|INC|LLC|ENTERPRISES?|VENTURES?|NIG(?:ERIA)?)\b/gi, '');
  s = s.replace(/[0-9]{5,}/g, ''); // strip long terminal/account numbers
  s = s.replace(/\|.*$/, ''); // take part before pipe
  s = s.replace(/\s+/g, ' ').trim();

  if (!s || s.length < 2) {
    s = raw.split('|')[0].trim();
  }

  return { cleanName: s };
}

/**
 * Determines whether a transaction is an eligible living expense debit
 * for recurring payment analysis (excluding internal transfers and savings sweeps).
 */
function isEligibleExpense(tx: Transaction): boolean {
  if (tx.credit && !tx.debit) return false;
  if (!tx.isExpense) return false;
  if (tx.isInternalTransfer || tx.isSavings || tx.isRefund || tx.isInternal) return false;
  if (
    tx.financialType === 'SAVINGS_WITHDRAWAL' ||
    tx.financialType === 'SAVINGS_CONTRIBUTION' ||
    tx.financialType === 'INTERNAL_WEALTH_TRANSFER' ||
    tx.financialType === 'INTERNAL_TRANSFER' ||
    tx.financialType === 'INTEREST_INCOME' ||
    tx.financialType === 'EXTERNAL_INCOME'
  ) {
    return false;
  }
  const desc = (tx.description || '').toLowerCase();
  const merch = (tx.merchant || '').toLowerCase();
  if (
    desc.includes('owealth withdrawal') ||
    merch.includes('owealth withdrawal') ||
    desc === '(transaction payment)' ||
    desc.includes('safebox') ||
    desc.includes('auto-save to owealth')
  ) {
    return false;
  }
  if (tx.category === 'Savings' || tx.category === 'Transfers' || tx.category === 'Investment') return false;
  if (tx.transactionType === 'INTERNAL_TRANSFER' || tx.transactionType === 'SAVINGS_TRANSFER' || tx.transactionType === 'INVESTMENT') return false;
  return true;
}

/**
 * Calculates days difference between two ISO date strings (YYYY-MM-DD).
 */
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1.slice(0, 10)).getTime();
  const d2 = new Date(date2.slice(0, 10)).getTime();
  return Math.abs(Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
}

/**
 * Adds N days to an ISO date string and returns YYYY-MM-DD.
 */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr.slice(0, 10));
  d.setDate(d.getDate() + Math.max(1, Math.round(days)));
  return d.toISOString().slice(0, 10);
}

/**
 * Computes mean and sample standard deviation of an array of numbers.
 */
function computeStats(values: number[]): { mean: number; stdDev: number; variancePercent: number } {
  if (!values.length) return { mean: 0, stdDev: 0, variancePercent: 0 };
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  if (values.length <= 1) return { mean, stdDev: 0, variancePercent: 0 };

  const sumSquares = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
  const stdDev = Math.sqrt(sumSquares / (values.length - 1));
  const variancePercent = mean > 0 ? (stdDev / mean) * 100 : 0;
  return { mean, stdDev, variancePercent };
}

/**
 * Classifies the recurring cadence based on mean day interval.
 */
function classifyCadence(meanInterval: number, stdDev: number, count: number): { cadence: RecurringCadence; label: string } {
  if (count <= 1 || meanInterval <= 0) {
    return { cadence: 'irregular', label: 'One-time' };
  }

  // Check standard intervals
  if (meanInterval >= 0.7 && meanInterval <= 2.2) {
    return { cadence: 'daily', label: 'Daily' };
  }
  if (meanInterval >= 5 && meanInterval <= 9.5) {
    return { cadence: 'weekly', label: 'Weekly (~7 days)' };
  }
  if (meanInterval >= 11 && meanInterval <= 18) {
    return { cadence: 'biweekly', label: 'Bi-weekly (~14 days)' };
  }
  if (meanInterval >= 25 && meanInterval <= 36) {
    return { cadence: 'monthly', label: 'Monthly (~30 days)' };
  }
  if (meanInterval >= 75 && meanInterval <= 105) {
    return { cadence: 'quarterly', label: 'Quarterly (~90 days)' };
  }
  if (meanInterval >= 330 && meanInterval <= 400) {
    return { cadence: 'annual', label: 'Annual (~365 days)' };
  }

  // If interval variance is low, describe by rounded days
  if (stdDev < 5 && meanInterval > 0) {
    return { cadence: 'irregular', label: `Every ~${Math.round(meanInterval)} days` };
  }

  return { cadence: 'irregular', label: 'Irregular' };
}

/**
 * Normalizes payment amount to monthly and annual projected run-rate cost.
 */
function computeRunRateCosts(
  avgPayment: number,
  cadence: RecurringCadence,
  meanInterval: number,
  totalPaid: number,
  totalStatementDays: number
): { monthlyCost: number; annualEstimatedCost: number } {
  let monthlyCost = 0;

  switch (cadence) {
    case 'daily':
      monthlyCost = avgPayment * 30.416;
      break;
    case 'weekly':
      monthlyCost = avgPayment * 4.333;
      break;
    case 'biweekly':
      monthlyCost = avgPayment * 2.166;
      break;
    case 'monthly':
      monthlyCost = avgPayment * 1.0;
      break;
    case 'quarterly':
      monthlyCost = avgPayment / 3.0;
      break;
    case 'annual':
      monthlyCost = avgPayment / 12.0;
      break;
    case 'irregular':
    default:
      if (meanInterval > 0 && meanInterval <= 60) {
        monthlyCost = (avgPayment / meanInterval) * 30.416;
      } else if (totalStatementDays > 0) {
        monthlyCost = (totalPaid / totalStatementDays) * 30.416;
      } else {
        monthlyCost = avgPayment;
      }
      break;
  }

  monthlyCost = round2(monthlyCost);
  const annualEstimatedCost = round2(monthlyCost * 12);
  return { monthlyCost, annualEstimatedCost };
}

/**
 * Main engine function to compute the complete recurring payment and subscription audit.
 */
export function computeSubscriptionAudit(
  transactions: Transaction[],
  userOverrides: Record<string, UserLabelOverride> = {},
  _currency: Currency = 'NGN'
): SubscriptionAuditReport {
  // 1. Filter to eligible living expenses
  const eligible = transactions.filter(isEligibleExpense);

  if (eligible.length === 0) {
    return {
      activeRecurring: [],
      potentialSubscriptions: [],
      recentlyStopped: [],
      highestRecurringCosts: [],
      metrics: {
        totalMonthlyRecurringCost: 0,
        totalAnnualRecurringCost: 0,
        activeSubscriptionsCount: 0,
        totalActiveRecurringCount: 0,
        potentialSubscriptionsMonthlyCost: 0,
        recentlyStoppedCount: 0,
        savedMonthlyFromStopped: 0,
      },
      allMerchants: [],
    };
  }

  // Determine global statement date boundaries
  const allDates = transactions.map((t) => t.date.slice(0, 10)).sort();
  const statementStart = allDates[0];
  const statementEnd = allDates[allDates.length - 1];
  const totalStatementDays = Math.max(1, daysBetween(statementStart, statementEnd));

  // 2. Group transactions by normalized merchant
  const groups = new Map<
    string,
    {
      cleanName: string;
      originalNames: Set<string>;
      knownMatch?: KnownSubscriptionSignature;
      txs: Transaction[];
    }
  >();

  for (const tx of eligible) {
    const rawMerchant = tx.merchant || tx.description.split('|')[0].trim();
    const { cleanName, knownMatch } = normalizeMerchantName(rawMerchant);
    const key = cleanName.toLowerCase();

    let entry = groups.get(key);
    if (!entry) {
      entry = {
        cleanName,
        originalNames: new Set(),
        knownMatch,
        txs: [],
      };
      groups.set(key, entry);
    }
    entry.originalNames.add(rawMerchant);
    entry.txs.push(tx);
  }

  // 3. Analyze each merchant group
  const analyzed: RecurringMerchant[] = [];

  for (const [, group] of groups.entries()) {
    // Sort transactions chronologically
    const sortedTxs = [...group.txs].sort((a, b) => a.date.localeCompare(b.date));
    const count = sortedTxs.length;
    const amounts = sortedTxs.map((t) => t.debit || t.amount);
    const totalPaid = round2(amounts.reduce((sum, a) => sum + a, 0));
    const firstTx = sortedTxs[0];
    const lastTx = sortedTxs[count - 1];

    const amountStats = computeStats(amounts);
    const avgPayment = round2(amountStats.mean);

    // Compute consecutive intervals in days
    const intervals: number[] = [];
    for (let i = 1; i < count; i++) {
      intervals.push(daysBetween(sortedTxs[i - 1].date, sortedTxs[i].date));
    }
    const intervalStats = computeStats(intervals);

    // Cadence determination
    const { cadence, label: cadenceLabel } = classifyCadence(
      intervalStats.mean,
      intervalStats.stdDev,
      count
    );

    // Run-rate costs
    const { monthlyCost, annualEstimatedCost } = computeRunRateCosts(
      avgPayment,
      cadence,
      intervalStats.mean,
      totalPaid,
      totalStatementDays
    );

    // Days since last payment relative to statement end
    const daysSinceLastPayment = daysBetween(lastTx.date, statementEnd);

    // Next estimated payment date
    const expectedInterval = intervalStats.mean > 0 ? intervalStats.mean : (cadence === 'monthly' ? 30 : 7);
    const nextEstimatedPaymentDate = addDays(lastTx.date, expectedInterval);

    // Classification: confirmed vs probable vs one_time
    let classification: RecurringClassification = 'one_time';
    if (count >= 3 && (intervalStats.variancePercent < 45 || amountStats.variancePercent < 15)) {
      classification = 'confirmed';
    } else if (count >= 2) {
      // If 2 occurrences with known subscription or close amounts
      if (group.knownMatch || amountStats.variancePercent < 20 || (intervalStats.mean >= 20 && intervalStats.mean <= 40)) {
        classification = 'confirmed';
      } else {
        classification = 'probable';
      }
    } else if (group.knownMatch && (firstTx.category === 'Subscriptions' || firstTx.categoryGroup === 'Lifestyle')) {
      classification = 'probable';
    }

    // Subscription Detection & Confidence Scoring
    // Rule: Do NOT assume a transaction is a subscription solely because it happened twice!
    let confidenceScore = 0.1;
    const rationaleParts: string[] = [];

    if (group.knownMatch) {
      confidenceScore += 0.45;
      rationaleParts.push(`Known service catalog match (${group.knownMatch.category})`);
    } else if (firstTx.category === 'Subscriptions') {
      confidenceScore += 0.35;
      rationaleParts.push('Classified as Subscriptions category');
    }

    // Cadence fit
    if (cadence === 'monthly' || cadence === 'weekly' || cadence === 'annual') {
      confidenceScore += 0.25;
      rationaleParts.push(`Regular ${cadence} billing interval (~${Math.round(intervalStats.mean)} days)`);
    } else if (cadence === 'biweekly') {
      confidenceScore += 0.15;
      rationaleParts.push(`Bi-weekly interval (~${Math.round(intervalStats.mean)} days)`);
    }

    // Amount uniformity
    if (count >= 2 && amountStats.variancePercent < 5) {
      confidenceScore += 0.20;
      rationaleParts.push('Exact or near-identical recurring billing amount');
    } else if (count >= 2 && amountStats.variancePercent < 20) {
      confidenceScore += 0.10;
      rationaleParts.push('Consistent price band with minor variance');
    }

    // Frequency depth
    if (count >= 4) {
      confidenceScore += 0.15;
      rationaleParts.push(`Repeated across ${count} billing cycles`);
    } else if (count === 3) {
      confidenceScore += 0.10;
      rationaleParts.push('Seen across 3 billing cycles');
    } else if (count === 2 && !group.knownMatch) {
      // Two occurrences without known subscription: cap confidence below subscription threshold
      confidenceScore = Math.min(confidenceScore, 0.48);
      rationaleParts.push('Occurred twice; insufficient pattern to confirm subscription');
    }

    // Clamp confidence score
    confidenceScore = round2(Math.min(0.99, Math.max(0.05, confidenceScore)));
    const confidenceRationale = rationaleParts.join('; ') || 'Standard expense repetition';

    // Status: Active vs Recently Stopped
    // If interval has passed by > 1.75x expected duration (minimum 40 days for monthly cadence)
    const thresholdDays = Math.max(35, expectedInterval * 1.75);
    const isStopped = count >= 2 && daysSinceLastPayment > thresholdDays;
    const status: 'active' | 'recently_stopped' = isStopped ? 'recently_stopped' : 'active';

    // User override handling
    const defaultLabel: UserLabelOverride =
      confidenceScore >= 0.55 || group.knownMatch
        ? 'subscription'
        : classification !== 'one_time'
        ? 'personal_expense'
        : 'not_recurring';

    const userLabel = userOverrides[group.cleanName] || userOverrides[group.cleanName.toLowerCase()] || defaultLabel;

    // Is it a potential subscription?
    const isPotentialSubscription =
      userLabel === 'subscription' ||
      (userLabel !== 'not_recurring' && userLabel !== 'ignore' && confidenceScore >= 0.55);

    const subscriptionCategory = group.knownMatch?.category || (firstTx.category === 'Subscriptions' ? 'Software & SaaS' : 'Other');

    analyzed.push({
      merchant: Array.from(group.originalNames)[0],
      cleanMerchant: group.cleanName,
      category: firstTx.category,
      frequency: cadence,
      cadenceLabel,
      averagePayment: avgPayment,
      lastPaymentDate: lastTx.date,
      lastPaymentAmount: round2(lastTx.debit || lastTx.amount),
      nextEstimatedPaymentDate,
      daysSinceLastPayment,
      averageIntervalDays: round2(intervalStats.mean),
      intervalStdDev: round2(intervalStats.stdDev),
      amountVariancePercent: round2(amountStats.variancePercent),
      transactionCount: count,
      totalPaid,
      monthlyCost,
      annualEstimatedCost,
      classification: userLabel === 'not_recurring' ? 'one_time' : classification,
      confidenceScore,
      confidenceRationale,
      isPotentialSubscription,
      subscriptionCategory,
      status,
      userLabel,
      transactionIds: sortedTxs.map((t) => t.id),
      firstPaymentDate: firstTx.date,
    });
  }

  // 4. Filter and partition into required sections
  // Exclude merchants marked as 'ignore'
  const nonIgnored = analyzed.filter((m) => m.userLabel !== 'ignore');

  // Active recurring payments: classification is confirmed/probable, status active, not labeled 'not_recurring'
  const activeRecurring = nonIgnored
    .filter((m) => m.classification !== 'one_time' && m.status === 'active' && m.userLabel !== 'not_recurring')
    .sort((a, b) => b.monthlyCost - a.monthlyCost);

  // Potential subscriptions: identified subscriptions with active status
  const potentialSubscriptions = nonIgnored
    .filter((m) => m.isPotentialSubscription && m.status === 'active')
    .sort((a, b) => b.confidenceScore - a.confidenceScore);

  // Recently stopped recurring payments
  const recentlyStopped = nonIgnored
    .filter((m) => m.status === 'recently_stopped' && m.classification !== 'one_time')
    .sort((a, b) => b.daysSinceLastPayment - a.daysSinceLastPayment);

  // Highest recurring costs (ranked by annual / monthly impact)
  const highestRecurringCosts = [...activeRecurring].sort((a, b) => b.annualEstimatedCost - a.annualEstimatedCost).slice(0, 8);

  // 5. Aggregate metrics
  const totalMonthlyRecurringCost = round2(activeRecurring.reduce((sum, m) => sum + m.monthlyCost, 0));
  const totalAnnualRecurringCost = round2(activeRecurring.reduce((sum, m) => sum + m.annualEstimatedCost, 0));
  const activeSubscriptionsCount = potentialSubscriptions.length;
  const totalActiveRecurringCount = activeRecurring.length;
  const potentialSubscriptionsMonthlyCost = round2(potentialSubscriptions.reduce((sum, m) => sum + m.monthlyCost, 0));
  const recentlyStoppedCount = recentlyStopped.length;
  const savedMonthlyFromStopped = round2(recentlyStopped.reduce((sum, m) => sum + m.monthlyCost, 0));

  const metrics: SubscriptionAuditMetrics = {
    totalMonthlyRecurringCost,
    totalAnnualRecurringCost,
    activeSubscriptionsCount,
    totalActiveRecurringCount,
    potentialSubscriptionsMonthlyCost,
    recentlyStoppedCount,
    savedMonthlyFromStopped,
  };

  return {
    activeRecurring,
    potentialSubscriptions,
    recentlyStopped,
    highestRecurringCosts,
    metrics,
    allMerchants: analyzed,
  };
}
