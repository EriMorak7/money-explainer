import type { Currency, TransactionCategory } from '../../types/index.ts';

export type InsightCategory =
  | 'executive'
  | 'income'
  | 'spending'
  | 'savings'
  | 'merchants'
  | 'risk'
  | 'actionable';

export type InsightSeverity = 'critical' | 'warning' | 'positive' | 'neutral';

export interface GroundedMetric {
  metricKey: string;
  label: string;
  value: number;
  formattedValue: string;
  provenance: string; // e.g. "auditFinancialCalculations().expenses.grossLivingExpenses"
}

export interface VerificationCheckItem {
  token: string;
  extractedValue: number;
  matchedMetricKey?: string;
  isVerified: boolean;
  provenance?: string;
}

export interface InsightVerificationAudit {
  isGroundingPassed: boolean;
  totalNumbersScanned: number;
  verifiedNumbersCount: number;
  hallucinatedCount: number;
  provenanceScore: number; // 0 - 100 percentage
  checks: VerificationCheckItem[];
  timestamp: string;
}

export interface FinancialInsight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  summary: string;
  detailedExplanation: string;
  groundedMetrics: GroundedMetric[];
  actionRecommendation?: string;
  potentialMonthlySavings?: number;
  traceFilter?: {
    category?: TransactionCategory | string;
    type?: string;
    merchant?: string;
    search?: string;
  };
  verification: InsightVerificationAudit;
}

export interface AIAnalystReport {
  executiveSummary: string;
  overallHealthAssessment: string;
  currency: Currency;
  periodStart: string;
  periodEnd: string;
  totalTransactions: number;
  
  // Categorized insights
  insights: FinancialInsight[];
  
  // Verification & Anti-Hallucination Safeguard Summary
  antiHallucinationAudit: {
    totalInsightsGenerated: number;
    passedInsightsCount: number;
    flaggedHallucinationsCount: number;
    overallProvenanceScore: number; // 100% means zero ungrounded figures
    registrySize: number; // Number of verified ground-truth values registered
    auditStatus: 'VERIFIED_100_PERCENT' | 'CONTAINS_FLAGGED_DATA';
    verifiedAt: string;
  };

  // High-priority actionable playbooks
  topActionableTakeaways: Array<{
    title: string;
    description: string;
    estimatedSavings: number;
    actionType: 'cancel_subscription' | 'reduce_dining' | 'optimize_airtime' | 'increase_savings_sweep';
  }>;
}
