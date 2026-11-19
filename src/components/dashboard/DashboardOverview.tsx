'use client';

import React, { useState, useMemo } from 'react';
import { BankAccount, Currency, StatementMetadata, Transaction } from '@/types';
import { formatCurrency, formatPercentage } from '@/lib/utils';
import {
  auditFinancialCalculations,
  computeCategorySummaries,
  computeDailyTimeline,
  computeHealthScore,
  computeMerchantSummaries,
  round2,
} from '@/lib/calculations/financialEngine';
import { FinancialReportModal } from '@/components/export/FinancialReportModal';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCard } from '@/components/ui/metric-card';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  PiggyBank, 
  Percent, 
  Activity, 
  CheckCircle2, 
  Building2, 
  Info, 
  ChevronRight, 
  FileText,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface DashboardOverviewProps {
  currency: Currency;
  transactions: Transaction[];
  account?: BankAccount | null;
  statement?: StatementMetadata | null;
  onViewTransactions: (filter?: { category?: string; type?: string; merchant?: string; search?: string }) => void;
  onUploadNew: () => void;
  onClearStatement?: () => void;
  onExportReport?: () => void;
}

interface CustomTooltipPayloadItem {
  name: string;
  value: number;
  color?: string;
}

interface CustomBarTooltipProps {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
  label?: string;
  currency?: Currency;
}

const CustomBarTooltip = ({ active, payload, label, currency = 'NGN' }: CustomBarTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-md dark:border-slate-800 dark:bg-slate-900 text-xs">
        <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">{label}</p>
        {payload.map((item, idx: number) => (
          <p key={idx} style={{ color: item.color }} className="font-medium">
            {item.name}: {formatCurrency(item.value, currency)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function DashboardOverview({
  currency,
  transactions,
  account,
  statement,
  onViewTransactions,
  onUploadNew,
  onClearStatement,
  onExportReport,
}: DashboardOverviewProps) {
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const handleOpenReport = () => {
    if (onExportReport) {
      onExportReport();
    } else {
      setIsReportModalOpen(true);
    }
  };

  const openingBalance = account?.openingBalance ?? 0;
  const closingBalance = account?.closingBalance ?? 0;

  // Compute audited calculations strictly in application code
  const report = useMemo(() => {
    return auditFinancialCalculations(
      transactions,
      openingBalance,
      closingBalance,
      currency
    );
  }, [transactions, openingBalance, closingBalance, currency]);

  // Compute category breakdown from transactions
  const categorySummaries = useMemo(() => {
    return computeCategorySummaries(transactions, report.expenses.grossLivingExpenses);
  }, [transactions, report.expenses.grossLivingExpenses]);

  // Compute top merchants from transactions
  const merchantSummaries = useMemo(() => {
    return computeMerchantSummaries(transactions, 6);
  }, [transactions]);

  // Compute daily timeline from transactions
  const dailyTimeline = useMemo(() => {
    return computeDailyTimeline(transactions);
  }, [transactions]);

  // Compute audited health score from real report
  const health = useMemo(() => {
    return computeHealthScore(report, transactions);
  }, [report, transactions]);

  // Average daily spending computed across active days
  const averageDailySpending = useMemo(() => {
    const days = dailyTimeline.length > 0 ? dailyTimeline.length : 30;
    return round2(report.expenses.netLivingExpenses / days);
  }, [report.expenses.netLivingExpenses, dailyTimeline.length]);

  if (!account || !statement || transactions.length === 0) {
    return (
      <EmptyState
        title="No Bank Statement Loaded"
        description="Upload your official Nigerian bank statement (PDF or CSV) to unlock automated financial auditing, income isolation, subscription tracking, and intelligent budgeting."
        actionLabel="Upload Bank Statement"
        onAction={onUploadNew}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner: Statement Header & Metadata */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                {account.bankName} Statement
              </h1>
              <Badge variant="success" size="sm">
                Verified Statement
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Account: <span className="font-medium text-slate-700 dark:text-slate-300">{account.accountName}</span> ({account.accountNumberMasked}) • Period: {statement.periodStart} – {statement.periodEnd}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
          <button
            onClick={handleOpenReport}
            className="px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            Financial Report (PDF)
          </button>
          <button
            onClick={() => onViewTransactions()}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
          >
            Audit {transactions.length} Transactions
          </button>
          <button
            onClick={onUploadNew}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            Upload New
          </button>
          {onClearStatement && (
            <button
              onClick={onClearStatement}
              className="px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold text-rose-600 dark:text-rose-400 transition-colors flex items-center gap-1"
              title="Clear active statement"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Primary Executive Metric Cards (Clickable for Traceability) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Income */}
        <div 
          onClick={() => onViewTransactions({ type: 'INCOME' })}
          className="cursor-pointer transition-transform hover:scale-[1.01]"
          title="Click to view all verified income credits"
        >
          <MetricCard
            title="Total Income"
            value={formatCurrency(report.income.totalIncome, currency)}
            subtitle="Verified client & salary credits"
            trend="up"
            accentColor="emerald"
            badge="Verified Income"
            icon={<ArrowUpRight className="w-4 h-4" />}
          />
        </div>

        {/* Total Spending */}
        <div 
          onClick={() => onViewTransactions({ type: 'EXPENSE' })}
          className="cursor-pointer transition-transform hover:scale-[1.01]"
          title="Click to view all net living expenses"
        >
          <MetricCard
            title="Total Spending"
            value={formatCurrency(report.expenses.netLivingExpenses, currency)}
            subtitle="Net living expenses (refunds subtracted)"
            trend="neutral"
            accentColor="rose"
            badge="Excludes Transfers"
            icon={<ArrowDownRight className="w-4 h-4" />}
          />
        </div>

        {/* Total Saved */}
        <div 
          onClick={() => onViewTransactions({ type: 'SAVINGS' })}
          className="cursor-pointer transition-transform hover:scale-[1.01]"
          title="Click to view all savings & wealth sweeps"
        >
          <MetricCard
            title="Total Saved"
            value={formatCurrency(report.wealth.savingsDeposits, currency)}
            subtitle="New savings contributions"
            trend="up"
            accentColor="purple"
            badge="Wealth Retained"
            icon={<PiggyBank className="w-4 h-4" />}
          />
        </div>

        {/* Savings Rate */}
        <MetricCard
          title="Savings Rate"
          value={formatPercentage(report.savingsRate)}
          subtitle="Contributions / external income"
          trend="up"
          accentColor="blue"
          badge="Contribution Rate"
          icon={<Percent className="w-4 h-4" />}
        />
      </div>

      {/* Secondary Liquidity & Cash Flow Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Net Retained Cash Flow</p>
            <p className={`text-lg font-bold font-mono mt-0.5 ${
              report.netCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}>
              {report.netCashFlow >= 0 ? '+' : ''}{formatCurrency(report.netCashFlow, currency)}
            </p>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">Income – Pure Spend</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Average Daily Spend</p>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
              {formatCurrency(averageDailySpending, currency)}/day
            </p>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">Across {dailyTimeline.length || 30} days</span>
        </div>

        <div 
          onClick={() => onViewTransactions({ type: 'TRANSFER' })}
          className="p-4 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs flex items-center justify-between cursor-pointer hover:border-amber-300 transition-colors"
          title="Click to view internal transfers"
        >
          <div>
            <p className="text-xs text-slate-500">Internal Transfers Isolated</p>
            <p className="text-lg font-bold text-slate-700 dark:text-slate-300 font-mono mt-0.5">
              {formatCurrency(report.transfers.internalTransfersOut, currency)}
            </p>
          </div>
          <span className="text-[11px] text-amber-600 font-medium">Not double counted</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Closing Balance</p>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
              {formatCurrency(report.reconciliation.closingBalance, currency)}
            </p>
          </div>
          <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Reconciled
          </span>
        </div>
      </div>

      {/* Financial Health Score & Disclaimers */}
      <Card className="border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
        <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base">Financial Health Diagnostic</CardTitle>
                <CardDescription className="text-xs">
                  Evaluated from verified transaction calculations across 8 pillars
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="success" size="md">
                Health Score: {health.overallScore} / 100 ({health.rating})
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
            <span className="font-semibold text-slate-900 dark:text-slate-100">Audited Assessment: </span>
            {health.summary}
          </p>

          {/* 8 Health Pillars Progress Bars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Saving Discipline', score: health.breakdown.saving, desc: `${report.savingsRate.toFixed(1)}% net savings rate` },
              { label: 'Spending Control', score: health.breakdown.spendingControl, desc: `${report.livingExpenseRatio.toFixed(1)}% spent on living` },
              { label: 'Cash Flow Stability', score: health.breakdown.cashFlowStability, desc: `${formatCurrency(report.netCashFlow, currency)} retained net` },
              { label: 'Emergency Liquidity', score: health.breakdown.emergencyLiquidity, desc: `${formatCurrency(report.reconciliation.closingBalance, currency)} closing balance` },
              { label: 'Subscription Mgmt', score: health.breakdown.subscriptionManagement, desc: `${transactions.filter(t => t.isRecurring).length} active recurring debits` },
              { label: 'Debt Servicing', score: health.breakdown.debtManagement, desc: `${formatCurrency(report.debt.loanRepayments, currency)} debt servicing` },
              { label: 'Discretionary Risk', score: health.breakdown.discretionarySpending, desc: `${formatCurrency(report.expenses.discretionaryExpenses, currency)} discretionary spend` },
              { label: 'Month Consistency', score: health.breakdown.consistency, desc: 'Verified ledger predictability' },
            ].map((pillar, i) => (
              <div key={i} className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">{pillar.label}</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">{pillar.score}/100</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${pillar.score}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 truncate">{pillar.desc}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{health.disclaimer}</span>
          </div>
        </CardContent>
      </Card>

      {/* Visual Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Spending Breakdown (Donut Chart) */}
        <Card className="border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Spending by Category</CardTitle>
            <CardDescription className="text-xs">
              Where your money actually went ({statement.periodStart} – {statement.periodEnd})
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categorySummaries.slice(0, 7)}
                    dataKey="totalAmount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {categorySummaries.slice(0, 7).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: unknown) => [formatCurrency(Number(value) || 0, currency), 'Spent']}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Category breakdown table summary (Clickable for Traceability) */}
            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800 text-xs">
              {categorySummaries.slice(0, 6).map((cat) => (
                <div 
                  key={cat.category} 
                  onClick={() => onViewTransactions({ category: cat.category })}
                  className="py-2 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 px-1 rounded transition-colors group"
                  title={`Click to view all ${cat.category} transactions`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 transition-colors">
                      {cat.category}
                    </span>
                    <span className="text-[10px] text-slate-400">({cat.group})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono">
                      {formatCurrency(cat.totalAmount, currency)}
                    </span>
                    <span className="text-slate-400 text-[11px] w-12 text-right">
                      {cat.percentageOfSpending.toFixed(1)}%
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Daily Spending & Income Flow (Bar Chart) */}
        <Card className="border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Daily Cash Flow</CardTitle>
            <CardDescription className="text-xs">
              Actual Inflows vs Outflows across the statement timeline
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyTimeline}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(val: number) => `₦${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomBarTooltip currency={currency} />} />
                  <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="spending" name="Spending" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top Merchants Strip (Clickable for Traceability) */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Top Merchants by Spending
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {merchantSummaries.map((mch) => (
                  <div
                    key={mch.merchant}
                    onClick={() => onViewTransactions({ search: mch.merchant })}
                    className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
                    title={`Click to view all transactions with ${mch.merchant}`}
                  >
                    <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{mch.merchant}</p>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">{formatCurrency(mch.totalSpent, currency)}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Audit Notice */}
      <div className="p-4 rounded-xl border border-blue-200/60 bg-blue-50/40 dark:border-blue-900/50 dark:bg-blue-950/20 text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
        <p className="font-semibold flex items-center gap-1.5 text-blue-900 dark:text-blue-300">
          <CheckCircle2 className="w-4 h-4 text-blue-600" />
          Strict Accounting Audit Verification & Balance Reconciliation
        </p>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          ₦{report.wealth.savingsDeposits.toLocaleString()} saved into wealth sweeps was isolated and counted as capital preserved rather than operational expenses. ₦{report.transfers.internalTransfersOut.toLocaleString()} in internal sweeps was tagged and omitted from living expenses. Net living expenses after deducting ₦{report.expenses.refundsOffset.toLocaleString()} in refunds stand at exactly ₦{report.expenses.netLivingExpenses.toLocaleString()}.
        </p>
        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-1 border-t border-blue-200/40 dark:border-blue-900/40">
          {report.reconciliation.reconciliationNotes}
        </p>
      </div>

      {/* Financial Report Modal */}
      <FinancialReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        transactions={transactions}
        account={account}
        statement={statement}
        currency={currency}
      />
    </div>
  );
}
