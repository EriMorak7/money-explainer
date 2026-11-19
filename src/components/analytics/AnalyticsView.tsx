'use client';

import React, { useState, useMemo } from 'react';
import type { Currency, Transaction } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { computeAnalyticsReport } from '@/lib/calculations/analyticsEngine';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MetricCard } from '@/components/ui/metric-card';
import {
  ArrowUpRight,
  ArrowDownRight,
  PiggyBank,
  Clock,
  Flame,
  ChevronRight,
  Receipt,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

interface AnalyticsViewProps {
  currency: Currency;
  transactions: Transaction[];
  onViewTransactions: (filter?: {
    category?: string;
    type?: string;
    merchant?: string;
    search?: string;
  }) => void;
}

// Standalone tooltip components defined outside render to satisfy React Hook rules
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
  currency?: Currency;
}

const TrendTooltip = ({ active, payload, label, currency = 'NGN' }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-800 dark:bg-slate-900 text-xs">
        <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1.5">{label}</p>
        <div className="space-y-1">
          {payload.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name}:
              </span>
              <span className="font-semibold font-mono text-slate-900 dark:text-slate-100">
                {formatCurrency(item.value, currency)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const SavingsTooltip = ({ active, payload, label, currency = 'NGN' }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-white p-3 shadow-lg dark:border-emerald-950 dark:bg-slate-900 text-xs">
        <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1.5">{label}</p>
        <div className="space-y-1">
          {payload.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name}:
              </span>
              <span className="font-semibold font-mono text-slate-900 dark:text-slate-100">
                {formatCurrency(item.value, currency)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export function AnalyticsView({ currency, transactions, onViewTransactions }: AnalyticsViewProps) {
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [largestFilter, setLargestFilter] = useState<'debits' | 'credits'>('debits');
  const [activeTabSection, setActiveTabSection] = useState<'all' | 'categories' | 'trends' | 'savings' | 'merchants' | 'frequency'>('all');

  // Compute full analytics report deterministically from verified transaction data
  const report = useMemo(() => {
    return computeAnalyticsReport(transactions, currency);
  }, [transactions, currency]);

  // Selected trend data based on timeframe toggle
  const activeTrendData = useMemo(() => {
    if (timeframe === 'daily') {
      return report.dailyTrends.map((d) => ({
        label: d.dayLabel,
        spending: d.spending,
        income: d.income,
        netCashFlow: d.netCashFlow,
        transactionCount: d.transactionCount,
      }));
    }
    if (timeframe === 'weekly') {
      return report.weeklyTrends.map((w) => ({
        label: w.label,
        spending: w.spending,
        income: w.income,
        netCashFlow: w.netCashFlow,
        transactionCount: w.transactionCount,
      }));
    }
    return report.monthlyTrends.map((m) => ({
      label: m.label,
      spending: m.spending,
      income: m.income,
      netCashFlow: m.netCashFlow,
      transactionCount: m.transactionCount,
    }));
  }, [timeframe, report]);

  if (transactions.length === 0) {
    return (
      <EmptyState
        title="No Financial Analytics Available"
        description="Upload your bank statement to visualize spending trends, cash flow velocities, top merchants, and category distributions."
        actionLabel="Upload Bank Statement"
        onAction={() => onViewTransactions()}
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner: Statement Period & Analytics Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Financial Analytics & Trends
            </h1>
            <Badge variant="success" className="gap-1 font-mono text-[10px]">
              <CheckCircle2 className="w-3 h-3" /> Audited Real Data
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Analyzing {report.totalTransactions} transactions across {report.periodStart} to {report.periodEnd}
          </p>
        </div>

        {/* Quick Section Filter Navigation */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-medium">
          {(
            [
              { id: 'all', label: 'Overview' },
              { id: 'trends', label: 'Trends' },
              { id: 'categories', label: 'Categories' },
              { id: 'savings', label: 'Savings' },
              { id: 'merchants', label: 'Merchants' },
              { id: 'frequency', label: 'Frequency' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTabSection(tab.id)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                activeTabSection === tab.id
                  ? 'bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Gross Living Expenses"
          value={formatCurrency(report.grossLivingExpenses, currency)}
          subtitle="Strict living spending"
          icon={<Receipt className="w-5 h-5" />}
          badge="Verified debits"
          accentColor="rose"
          onClick={() => onViewTransactions({ type: 'EXPENSE' })}
        />

        <MetricCard
          title="True External Income"
          value={formatCurrency(report.totalIncome, currency)}
          subtitle="Non-loan, non-transfer"
          icon={<ArrowDownRight className="w-5 h-5" />}
          badge="Inflows"
          accentColor="emerald"
          onClick={() => onViewTransactions({ type: 'INCOME' })}
        />

        <MetricCard
          title="Average Daily Burn Rate"
          value={formatCurrency(report.frequencyAnalytics.averageDailyBurnRate, currency)}
          subtitle={`Across ${report.frequencyAnalytics.totalDaysInPeriod} statement days`}
          icon={<Flame className="w-5 h-5" />}
          badge={`${report.frequencyAnalytics.activeSpendingDays} active days`}
          accentColor="amber"
        />

        <MetricCard
          title="Retained Savings"
          value={formatCurrency(report.savingsTrends.netRetainedSavings, currency)}
          subtitle={`${report.savingsTrends.retentionRate.toFixed(1)}% sweep retention`}
          icon={<PiggyBank className="w-5 h-5" />}
          badge="Vault balance"
          accentColor="emerald"
          onClick={() => onViewTransactions({ category: 'Savings' })}
        />
      </div>

      {/* SECTION 1: SPENDING & CASH FLOW TRENDS (Daily / Weekly / Monthly) */}
      {(activeTabSection === 'all' || activeTabSection === 'trends') && (
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">Spending & Cash Flow Velocity</CardTitle>
                <Badge variant="neutral" className="text-[10px]">Time Series</Badge>
              </div>
              <CardDescription className="text-xs">
                Real periodic living expenses vs external income and resulting net cash flow
              </CardDescription>
            </div>

            {/* Timeframe Toggle Buttons */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 self-start sm:self-auto">
              {(['daily', 'weekly', 'monthly'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeframe(t)}
                  className={`px-3 py-1 rounded-md capitalize transition-all ${
                    timeframe === t
                      ? 'bg-white font-semibold text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="pt-2">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activeTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(val: number) => `₦${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<TrendTooltip currency={currency} />} />
                  <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px', paddingBottom: '12px' }} />
                  <Bar dataKey="income" name="External Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="spending" name="Living Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Micro Trend Insights Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <p className="text-slate-500 dark:text-slate-400">Total Net Cash Flow</p>
                <p className={`font-semibold font-mono text-sm ${report.netCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {report.netCashFlow >= 0 ? '+' : ''}{formatCurrency(report.netCashFlow, currency)}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <p className="text-slate-500 dark:text-slate-400">Avg Weekly Spending</p>
                <p className="font-semibold font-mono text-sm text-slate-900 dark:text-slate-100">
                  {formatCurrency(
                    report.weeklyTrends.length > 0 ? report.grossLivingExpenses / report.weeklyTrends.length : 0,
                    currency
                  )}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <p className="text-slate-500 dark:text-slate-400">Most Active Day</p>
                <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                  {report.frequencyAnalytics.mostActiveDayOfWeek}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <p className="text-slate-500 dark:text-slate-400">Peak Spend Day</p>
                <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                  {report.frequencyAnalytics.highestSpendingDayOfWeek}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SECTION 2: CATEGORY BREAKDOWN & LIFESTYLE GROUPS */}
      {(activeTabSection === 'all' || activeTabSection === 'categories') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Category Groups (Essential vs Lifestyle vs Giving vs Financial) */}
          <Card className="border border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Spending by Category Group</CardTitle>
                <Badge variant="neutral" className="text-[10px]">Macro View</Badge>
              </div>
              <CardDescription className="text-xs">
                Essential needs vs lifestyle & discretionary allocation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {report.categoryGroupAnalytics.map((grp) => (
                <div key={grp.group} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: grp.color }} />
                      {grp.group} ({grp.categoryCount} categories)
                    </span>
                    <span className="font-semibold font-mono text-slate-900 dark:text-slate-100">
                      {formatCurrency(grp.totalSpent, currency)} ({grp.percentageOfTotal.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(2, grp.percentageOfTotal))}%`,
                        backgroundColor: grp.color,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{grp.transactionCount} transactions</span>
                    <span>Avg: {formatCurrency(grp.totalSpent / (grp.transactionCount || 1), currency)}/tx</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Granular Spending by Category Table / Chart */}
          <Card className="lg:col-span-2 border border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Spending by Category</CardTitle>
                  <CardDescription className="text-xs">
                    Ranked living expenses with average and maximum ticket size (Click to inspect transactions)
                  </CardDescription>
                </div>
                <Badge variant="neutral" className="text-[10px]">
                  {report.categoryAnalytics.length} Categories
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                      <th className="pb-2 font-medium">Category</th>
                      <th className="pb-2 font-medium">Group</th>
                      <th className="pb-2 text-right font-medium">Total Spent</th>
                      <th className="pb-2 text-right font-medium">Share</th>
                      <th className="pb-2 text-right font-medium">Count</th>
                      <th className="pb-2 text-right font-medium">Avg Ticket</th>
                      <th className="pb-2 text-right font-medium">Max Ticket</th>
                      <th className="pb-2 text-center font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {report.categoryAnalytics.map((cat) => (
                      <tr
                        key={cat.category}
                        onClick={() => onViewTransactions({ category: cat.category })}
                        className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                          {cat.category}
                        </td>
                        <td className="py-2.5 text-slate-500 dark:text-slate-400">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 font-mono">
                            {cat.categoryGroup}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-semibold font-mono text-slate-900 dark:text-slate-100">
                          {formatCurrency(cat.totalSpent, currency)}
                        </td>
                        <td className="py-2.5 text-right font-medium text-slate-600 dark:text-slate-300">
                          {cat.percentageOfTotal.toFixed(1)}%
                        </td>
                        <td className="py-2.5 text-right text-slate-500 dark:text-slate-400">
                          {cat.transactionCount}
                        </td>
                        <td className="py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                          {formatCurrency(cat.averageTransaction, currency)}
                        </td>
                        <td className="py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                          {formatCurrency(cat.maxTransaction, currency)}
                        </td>
                        <td className="py-2.5 text-center text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                          <ChevronRight className="w-3.5 h-3.5 inline" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SECTION 3: SAVINGS DYNAMICS & WEALTH RETENTION */}
      {(activeTabSection === 'all' || activeTabSection === 'savings') && (
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">Savings & Capital Accumulation Trends</CardTitle>
                <Badge variant="success" className="text-[10px]">
                  {report.savingsTrends.retentionRate.toFixed(1)}% Retained
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Trajectory of automated savings sweeps into vaults (OWealth/PiggyVest) vs withdrawals over time
              </CardDescription>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Deposits ({formatCurrency(report.savingsTrends.totalDeposited, currency)})
              </span>
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Withdrawals ({formatCurrency(report.savingsTrends.totalWithdrawn, currency)})
              </span>
            </div>
          </CardHeader>

          <CardContent className="pt-2">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={report.savingsTrends.points} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(val: number) => `₦${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<SavingsTooltip currency={currency} />} />
                  <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px', paddingBottom: '12px' }} />
                  <Area
                    type="monotone"
                    dataKey="cumulativeRetained"
                    name="Cumulative Retained"
                    stroke="#059669"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#savingsGradient)"
                  />
                  <Bar dataKey="deposits" name="Savings Deposits" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="withdrawals" name="Savings Withdrawals" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Savings Highlights Footer */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/40">
                <p className="text-emerald-700 dark:text-emerald-400 font-medium">Total Capital Swept</p>
                <p className="text-base font-bold font-mono text-emerald-900 dark:text-emerald-200 mt-0.5">
                  {formatCurrency(report.savingsTrends.totalDeposited, currency)}
                </p>
                <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-1">
                  Transferred into interest-bearing vaults
                </p>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/40">
                <p className="text-amber-700 dark:text-amber-400 font-medium">Capital Redeemed / Withdrawn</p>
                <p className="text-base font-bold font-mono text-amber-900 dark:text-amber-200 mt-0.5">
                  {formatCurrency(report.savingsTrends.totalWithdrawn, currency)}
                </p>
                <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-1">
                  Swept back into main wallet for transactions
                </p>
              </div>

              <div className="p-3 rounded-xl bg-teal-50/50 border border-teal-100 dark:bg-teal-950/20 dark:border-teal-900/40">
                <p className="text-teal-700 dark:text-teal-400 font-medium">Net Retained Capital</p>
                <p className="text-base font-bold font-mono text-teal-900 dark:text-teal-200 mt-0.5">
                  {formatCurrency(report.savingsTrends.netRetainedSavings, currency)}
                </p>
                <p className="text-[10px] text-teal-600/80 dark:text-teal-400/80 mt-1">
                  Highest sweep: {formatCurrency(report.savingsTrends.highestSingleDeposit.amount, currency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SECTION 4: SPENDING BY MERCHANT */}
      {(activeTabSection === 'all' || activeTabSection === 'merchants') && (
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">Spending by Merchant</CardTitle>
                <Badge variant="neutral" className="text-[10px]">
                  Top {report.merchantAnalytics.length} Recipients
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Where your living expenses actually went (Click merchant to view underlying transactions)
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {report.merchantAnalytics.map((m, idx) => (
                <div
                  key={m.merchant}
                  onClick={() => onViewTransactions({ merchant: m.merchant, search: m.merchant })}
                  className="group flex flex-col justify-between p-3.5 rounded-xl border border-slate-200/80 bg-white hover:border-emerald-300 hover:shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-700 cursor-pointer transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500">
                          {idx + 1}
                        </span>
                        <h4 className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                          {m.merchant}
                        </h4>
                      </div>
                      <span className="text-[11px] font-mono font-semibold text-slate-900 dark:text-slate-100 flex-shrink-0">
                        {formatCurrency(m.totalSpent, currency)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 font-medium">
                        {m.category}
                      </span>
                      <span>•</span>
                      <span>{m.transactionCount} txs</span>
                      <span>•</span>
                      <span>{m.percentageOfTotal.toFixed(1)}% of spend</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Avg: {formatCurrency(m.averageTransaction, currency)}</span>
                    <span className="flex items-center gap-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 font-medium">
                      Inspect <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SECTION 5: TRANSACTION FREQUENCY & BEHAVIORAL RHYTHM */}
      {(activeTabSection === 'all' || activeTabSection === 'frequency') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Day of Week Frequency Distribution */}
          <Card className="border border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Transaction Frequency by Day of Week</CardTitle>
                <Badge variant="neutral" className="text-[10px]">Weekly Rhythm</Badge>
              </div>
              <CardDescription className="text-xs">
                Transaction counts and spend volume distributed Monday through Sunday
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={report.frequencyAnalytics.dayOfWeekDistribution}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                    <XAxis dataKey="shortDay" tick={{ fontSize: 11 }} />
                    <YAxis
                      yAxisId="left"
                      orientation="left"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(val: number) => `₦${(val / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(val: number) => `${val} tx`}
                    />
                    <Tooltip content={<TrendTooltip currency={currency} />} />
                    <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }} />
                    <Bar yAxisId="left" dataKey="spending" name="Living Spending" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                    <Bar yAxisId="right" dataKey="transactionCount" name="Transaction Count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-slate-500 dark:text-slate-400">Busiest Day:</span>{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {report.frequencyAnalytics.mostActiveDayOfWeek}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-slate-500 dark:text-slate-400">Costliest Day:</span>{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {report.frequencyAnalytics.highestSpendingDayOfWeek}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time of Day Distribution */}
          <Card className="border border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Time of Day Activity</CardTitle>
                <Badge variant="neutral" className="text-[10px]">Timestamp Audit</Badge>
              </div>
              <CardDescription className="text-xs">
                When during the day you initiate debits and purchases
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {report.frequencyAnalytics.timeOfDayDistribution.map((t) => (
                <div key={t.periodKey} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {t.label}
                    </span>
                    <span className="font-semibold font-mono text-slate-900 dark:text-slate-100">
                      {formatCurrency(t.spending, currency)} ({t.percentageOfTransactions.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(2, t.percentageOfTransactions))}%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t.transactionCount} transactions logged
                  </p>
                </div>
              ))}

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Debit vs Credit Split:</span>
                  <span className="font-semibold font-mono text-slate-900 dark:text-slate-100">
                    {report.frequencyAnalytics.debitCount} Debits ({report.frequencyAnalytics.debitPercentage}%) / {report.frequencyAnalytics.creditCount} Credits ({report.frequencyAnalytics.creditPercentage}%)
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SECTION 6: HIGHEST SPENDING DAYS */}
      {(activeTabSection === 'all' || activeTabSection === 'trends') && (
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">Highest Spending Days</CardTitle>
                <Badge variant="warning" className="text-[10px]">Peak Days</Badge>
              </div>
              <CardDescription className="text-xs">
                Days with the highest total living expenses (Click a day to view that day&apos;s ledger)
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="pb-2 font-medium">Rank</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Day</th>
                    <th className="pb-2 text-right font-medium">Total Spent</th>
                    <th className="pb-2 text-right font-medium">Txs</th>
                    <th className="pb-2 font-medium pl-4">Top Category</th>
                    <th className="pb-2 font-medium">Top Merchant</th>
                    <th className="pb-2 text-right font-medium">Largest Single Tx</th>
                    <th className="pb-2 text-center font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {report.highestSpendingDays.map((d, idx) => (
                    <tr
                      key={d.date}
                      onClick={() => onViewTransactions({ search: d.date })}
                      className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 font-bold text-slate-400 group-hover:text-slate-700">
                        #{idx + 1}
                      </td>
                      <td className="py-2.5 font-medium text-slate-900 dark:text-slate-100">
                        {d.date}
                      </td>
                      <td className="py-2.5 text-slate-500 dark:text-slate-400">
                        {d.dayOfWeek}
                      </td>
                      <td className="py-2.5 text-right font-semibold font-mono text-rose-600 dark:text-rose-400">
                        {formatCurrency(d.totalSpending, currency)}
                      </td>
                      <td className="py-2.5 text-right text-slate-500 dark:text-slate-400">
                        {d.transactionCount}
                      </td>
                      <td className="py-2.5 pl-4 font-medium text-slate-700 dark:text-slate-300">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800">
                          {d.topCategory} ({formatCurrency(d.topCategoryAmount, currency)})
                        </span>
                      </td>
                      <td className="py-2.5 font-medium text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                        {d.topMerchant}
                      </td>
                      <td className="py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                        {formatCurrency(d.largestTransaction, currency)}
                      </td>
                      <td className="py-2.5 text-center text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                        <ChevronRight className="w-3.5 h-3.5 inline" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SECTION 7: LARGEST TRANSACTIONS (DEBITS VS CREDITS) */}
      {(activeTabSection === 'all' || activeTabSection === 'trends') && (
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">Largest Transactions</CardTitle>
                <Badge variant="neutral" className="text-[10px]">Extremes</Badge>
              </div>
              <CardDescription className="text-xs">
                Inspect top single inflows and outflows with accurate accounting classification
              </CardDescription>
            </div>

            {/* Inflows vs Outflows Toggle */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 self-start sm:self-auto">
              <button
                onClick={() => setLargestFilter('debits')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                  largestFilter === 'debits'
                    ? 'bg-white font-semibold text-rose-600 shadow-xs dark:bg-slate-900 dark:text-rose-400'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                Largest Outflows ({report.largestTransactions.topDebits.length})
              </button>
              <button
                onClick={() => setLargestFilter('credits')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                  largestFilter === 'credits'
                    ? 'bg-white font-semibold text-emerald-600 shadow-xs dark:bg-slate-900 dark:text-emerald-400'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <ArrowDownRight className="w-3.5 h-3.5" />
                Largest Inflows ({report.largestTransactions.topCredits.length})
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Description</th>
                    <th className="pb-2 font-medium">Party / Merchant</th>
                    <th className="pb-2 font-medium">Accounting Role</th>
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 text-right font-medium">Amount</th>
                    <th className="pb-2 text-center font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {largestFilter === 'debits'
                    ? report.largestTransactions.topDebits.map((tx) => (
                        <tr
                          key={tx.id}
                          onClick={() => onViewTransactions({ search: tx.id })}
                          className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                        >
                          <td className="py-2.5 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {tx.date}
                          </td>
                          <td className="py-2.5 font-medium text-slate-900 dark:text-slate-100 max-w-xs truncate">
                            {tx.description}
                          </td>
                          <td className="py-2.5 font-medium text-slate-700 dark:text-slate-300 truncate max-w-[160px]">
                            {tx.merchant}
                          </td>
                          <td className="py-2.5">
                            {tx.isSavingsSweep ? (
                              <Badge variant="success" className="text-[10px]">Savings Sweep</Badge>
                            ) : tx.isInternalTransfer ? (
                              <Badge variant="neutral" className="text-[10px]">Internal Transfer</Badge>
                            ) : tx.isBankCharge ? (
                              <Badge variant="neutral" className="text-[10px]">Bank Fee</Badge>
                            ) : (
                              <Badge variant="warning" className="text-[10px]">Living Expense</Badge>
                            )}
                          </td>
                          <td className="py-2.5 text-slate-500 dark:text-slate-400">
                            {tx.category}
                          </td>
                          <td className="py-2.5 text-right font-semibold font-mono text-rose-600 dark:text-rose-400 whitespace-nowrap">
                            -{formatCurrency(tx.amount, currency)}
                          </td>
                          <td className="py-2.5 text-center text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                            <ChevronRight className="w-3.5 h-3.5 inline" />
                          </td>
                        </tr>
                      ))
                    : report.largestTransactions.topCredits.map((tx) => (
                        <tr
                          key={tx.id}
                          onClick={() => onViewTransactions({ search: tx.id })}
                          className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                        >
                          <td className="py-2.5 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {tx.date}
                          </td>
                          <td className="py-2.5 font-medium text-slate-900 dark:text-slate-100 max-w-xs truncate">
                            {tx.description}
                          </td>
                          <td className="py-2.5 font-medium text-slate-700 dark:text-slate-300 truncate max-w-[160px]">
                            {tx.sender}
                          </td>
                          <td className="py-2.5">
                            {tx.isSavingsWithdrawal ? (
                              <Badge variant="neutral" className="text-[10px]">Savings Return</Badge>
                            ) : tx.isInternalTransfer ? (
                              <Badge variant="neutral" className="text-[10px]">Internal Transfer</Badge>
                            ) : tx.isRefund ? (
                              <Badge variant="info" className="text-[10px]">Refund</Badge>
                            ) : (
                              <Badge variant="success" className="text-[10px]">External Income</Badge>
                            )}
                          </td>
                          <td className="py-2.5 text-slate-500 dark:text-slate-400">
                            {tx.category}
                          </td>
                          <td className="py-2.5 text-right font-semibold font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            +{formatCurrency(tx.amount, currency)}
                          </td>
                          <td className="py-2.5 text-center text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                            <ChevronRight className="w-3.5 h-3.5 inline" />
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
