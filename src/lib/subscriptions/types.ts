import type { TransactionCategory } from '@/types';

export type RecurringCadence =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'annual'
  | 'irregular';

export type RecurringClassification = 'confirmed' | 'probable' | 'one_time';

export type UserLabelOverride =
  | 'subscription'
  | 'business_expense'
  | 'personal_expense'
  | 'not_recurring'
  | 'ignore';

export type SubscriptionCategory =
  | 'Streaming'
  | 'Software & SaaS'
  | 'Cloud & Hosting'
  | 'Telecom & Mobile'
  | 'Gaming & App Store'
  | 'Education & Learning'
  | 'Utilities'
  | 'Other';

export interface RecurringMerchant {
  merchant: string;
  cleanMerchant: string;
  category: TransactionCategory;
  frequency: RecurringCadence;
  cadenceLabel: string;
  averagePayment: number;
  lastPaymentDate: string;
  lastPaymentAmount: number;
  nextEstimatedPaymentDate: string;
  daysSinceLastPayment: number;
  averageIntervalDays: number;
  intervalStdDev: number;
  amountVariancePercent: number;
  transactionCount: number;
  totalPaid: number;
  monthlyCost: number;
  annualEstimatedCost: number;
  classification: RecurringClassification;
  confidenceScore: number; // 0.0 to 1.0
  confidenceRationale: string;
  isPotentialSubscription: boolean;
  subscriptionCategory?: SubscriptionCategory;
  status: 'active' | 'recently_stopped';
  userLabel: UserLabelOverride;
  transactionIds: string[];
  firstPaymentDate: string;
}

export interface SubscriptionAuditMetrics {
  totalMonthlyRecurringCost: number;
  totalAnnualRecurringCost: number;
  activeSubscriptionsCount: number;
  totalActiveRecurringCount: number;
  potentialSubscriptionsMonthlyCost: number;
  recentlyStoppedCount: number;
  savedMonthlyFromStopped: number;
}

export interface SubscriptionAuditReport {
  activeRecurring: RecurringMerchant[];
  potentialSubscriptions: RecurringMerchant[];
  recentlyStopped: RecurringMerchant[];
  highestRecurringCosts: RecurringMerchant[];
  metrics: SubscriptionAuditMetrics;
  allMerchants: RecurringMerchant[];
}
