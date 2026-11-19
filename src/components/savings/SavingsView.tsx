'use client';

import React, { useState, useMemo } from 'react';
import type { Currency, Transaction } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { computeSavingsReport } from '@/lib/savings/savingsEngine';
import { EmptyState } from '@/components/ui/empty-state';
import type { SavingsMovementKind } from '@/lib/savings/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  PiggyBank,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Search,
  Wallet,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface SavingsViewProps {
  currency: Currency;
  transactions: Transaction[];
  onViewTransactions: (filter?: {
    category?: string;
    type?: string;
    merchant?: string;
    search?: string;
  }) => void;
}

interface ChartTooltipItem {
  payload?: Record<string, unknown>;
  value?: number;
  name?: string;
  color?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipItem[];
  label?: string;
}

const DailySavingsTooltip = ({
  active,
  payload,
  currency,
}: ChartTooltipProps & { currency: Currency }) => {
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload as {
    date: string;
    deposits: number;
    withdrawals: number;
    interest: number;
    cumulativeNetFlow: number;
  } | undefined;
  if (!pt) return null;
  return (
    <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-md text-xs space-y-1">
      <p className="font-bold text-slate-900 dark:text-slate-100">{pt.date}</p>
      <p className="text-emerald-600">Deposits: {formatCurrency(pt.deposits, currency)}</p>
      <p className="text-amber-600">Withdrawals: {formatCurrency(pt.withdrawals, currency)}</p>
      {pt.interest > 0 && <p className="text-blue-600">Interest: {formatCurrency(pt.interest, currency)}</p>}
      <p className="font-semibold text-purple-600">Cumulative Net: {formatCurrency(pt.cumulativeNetFlow, currency)}</p>
    </div>
  );
};

const WeeklySavingsTooltip = ({
  active,
  payload,
  currency,
}: ChartTooltipProps & { currency: Currency }) => {
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload as {
    label: string;
    deposits: number;
    withdrawals: number;
    netFlow: number;
  } | undefined;
  if (!pt) return null;
  return (
    <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-md text-xs space-y-1">
      <p className="font-bold text-slate-900 dark:text-slate-100">{pt.label}</p>
      <p className="text-emerald-600">Deposits: {formatCurrency(pt.deposits, currency)}</p>
      <p className="text-amber-600">Withdrawals: {formatCurrency(pt.withdrawals, currency)}</p>
      <p className="font-semibold text-purple-600">Net: {formatCurrency(pt.netFlow, currency)}</p>
    </div>
  );
};

export function SavingsView({ currency, transactions, onViewTransactions }: SavingsViewProps) {
  const [filterKind, setFilterKind] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [timelineView, setTimelineView] = useState<'daily' | 'weekly'>('daily');

  const report = useMemo(() => {
    return computeSavingsReport(transactions, undefined, currency);
  }, [transactions, currency]);

  const { metrics, providers, patterns, movements, timeline, weekly } = report;

  // Filtered movements for the ledger table
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const matchKind =
        filterKind === 'ALL' ||
        (filterKind === 'DEPOSIT' && (m.kind === 'DEPOSIT' || m.kind === 'INVESTMENT_CONTRIBUTION')) ||
        (filterKind === 'WITHDRAWAL' && (m.kind === 'WITHDRAWAL' || m.kind === 'INVESTMENT_WITHDRAWAL')) ||
        (filterKind === 'INTEREST' && m.kind === 'INTEREST') ||
        (filterKind === 'INTERNAL' && m.kind === 'INTERNAL_SAVINGS_TRANSFER');

      const matchSearch =
        !searchQuery ||
        m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.provider.toLowerCase().includes(searchQuery.toLowerCase());

      return matchKind && matchSearch;
    });
  }, [movements, filterKind, searchQuery]);

  // Movement Kind Badge styling
  const getKindBadge = (kind: SavingsMovementKind) => {
    switch (kind) {
      case 'DEPOSIT':
        return <Badge variant="success" className="text-[10px]">Savings Deposit</Badge>;
      case 'WITHDRAWAL':
        return <Badge variant="warning" className="text-[10px]">Savings Withdrawal</Badge>;
      case 'INVESTMENT_CONTRIBUTION':
        return <Badge variant="purple" className="text-[10px]">Investment Inflow</Badge>;
      case 'INVESTMENT_WITHDRAWAL':
        return <Badge variant="danger" className="text-[10px]">Investment Outflow</Badge>;
      case 'INTEREST':
        return <Badge variant="info" className="text-[10px]">Interest Earned</Badge>;
      case 'INTERNAL_SAVINGS_TRANSFER':
        return <Badge variant="neutral" className="text-[10px]">Vault-to-Vault Transfer</Badge>;
      default:
        return <Badge variant="default" className="text-[10px]">{kind}</Badge>;
    }
  };

  // Pattern Severity styling
  const getPatternBadge = (severity: 'positive' | 'neutral' | 'attention' | 'warning') => {
    switch (severity) {
      case 'positive':
        return (
          <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </span>
        );
      case 'warning':
        return (
          <span className="p-2 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shrink-0">
            <AlertCircle className="w-4 h-4" />
          </span>
        );
      case 'attention':
        return (
          <span className="p-2 rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </span>
        );
      default:
        return (
          <span className="p-2 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 shrink-0">
            <Sparkles className="w-4 h-4" />
          </span>
        );
    }
  };

  if (transactions.length === 0) {
    return (
      <EmptyState
        badge="Savings & Wealth"
        badgeVariant="purple"
        title="No Savings Tracker Data"
        description="Upload your bank statement to analyze savings deposits, sweeps (OWealth, PiggyVest, Cowrywise), withdrawals, net retention, and interest earned."
        actionLabel="Upload Bank Statement"
        onAction={() => onViewTransactions()}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Top Banner: Savings & Wealth Tracker Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 rounded-xl bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <PiggyBank className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Dedicated Savings & Wealth Tracker
              </h1>
              <Badge variant="neutral" className="gap-1 text-[11px] font-mono border-purple-200 text-purple-700 dark:border-purple-800 dark:text-purple-300">
                <ShieldCheck className="w-3 h-3" /> Audited Sweeps
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Multi-vault analysis tracking money moving into and out of savings accounts, retention velocity, and interest yields.
            </p>
          </div>
        </div>

        {/* Retention Grade Badge */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 self-start lg:self-auto">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Sweep Retention</div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
              {metrics.retentionRate.toFixed(1)}% Retained
            </div>
          </div>
          <div className={`p-1.5 rounded-lg ${metrics.retentionRate >= 50 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>
            <Activity className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Primary Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Inflows into Savings */}
        <Card className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Savings Swept In</span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {formatCurrency(metrics.totalSaved, currency)}
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Across {metrics.depositCount} deposits ({metrics.depositsPerWeek.toFixed(1)}/week)
            </p>
          </CardContent>
        </Card>

        {/* Total Savings Withdrawn */}
        <Card className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Savings Withdrawn</span>
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {formatCurrency(metrics.totalWithdrawn + metrics.totalInvestmentWithdrawn, currency)}
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Across {metrics.withdrawalCount} withdrawals ({metrics.withdrawalsPerWeek.toFixed(1)}/week)
            </p>
          </CardContent>
        </Card>

        {/* Net Preserved Savings */}
        <Card className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Net Retained Capital</span>
              <div className="p-1.5 rounded-lg bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className={`mt-2 text-2xl font-bold tracking-tight ${metrics.netSavings >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {formatCurrency(metrics.netSavings, currency)}
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {metrics.savingsRate !== null ? `${metrics.savingsRate.toFixed(1)}% net savings rate vs income` : 'Capital preserved'}
            </p>
          </CardContent>
        </Card>

        {/* Interest Earned */}
        <Card className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Verified Interest Yield</span>
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {formatCurrency(metrics.interestEarned, currency)}
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {metrics.interestCreditCount} interest credits
              {metrics.annualizedInterestRunRate !== null ? ` (~${formatCurrency(metrics.annualizedInterestRunRate, currency)}/yr)` : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Velocity & Contribution Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="text-[11px] text-slate-500 font-medium">Average Savings Contribution</div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
            {formatCurrency(metrics.averageContribution, currency)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Largest sweep: {metrics.largestContribution ? formatCurrency(metrics.largestContribution.amount, currency) : 'N/A'}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="text-[11px] text-slate-500 font-medium">Average Withdrawal</div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
            {formatCurrency(metrics.averageWithdrawal, currency)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Largest drawdown: {metrics.largestWithdrawal ? formatCurrency(metrics.largestWithdrawal.amount, currency) : 'N/A'}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="text-[11px] text-slate-500 font-medium">Internal Vault-to-Vault Transfers</div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
            {formatCurrency(metrics.internalTransfersTotal, currency)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {metrics.internalTransferCount} movements (SafeBox ↔ OWealth)
          </div>
        </div>
      </div>

      {/* Behavioral Savings Dynamics & Patterns */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 pl-1">
          Observed Savings Behaviors & Patterns
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {patterns.map((p, idx) => (
            <Card key={idx} className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <CardContent className="p-4 sm:p-5 flex items-start gap-3.5">
                {getPatternBadge(p.severity)}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {p.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {p.message}
                  </p>

                  {p.figures.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1 text-[10px]">
                      {p.figures.map((f, fIdx) => (
                        <span key={fIdx} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                          {f.label}: {typeof f.value === 'number' && f.label.includes('%') ? `${f.value.toFixed(1)}%` : formatCurrency(f.value, currency)}
                        </span>
                      ))}
                    </div>
                  )}

                  {p.relatedTransactionIds.length > 0 && (
                    <button
                      onClick={() => onViewTransactions({ search: p.relatedTransactionIds[0] })}
                      className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline font-medium inline-flex items-center gap-1 pt-1"
                    >
                      <span>Inspect related transactions</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Visual Savings Trajectory Timeline Chart */}
      <Card className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Visual Savings Inflow vs Withdrawal Trajectory
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tracking capital sweeps, drawdown velocity, and cumulative balance trajectory over time
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setTimelineView('daily')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  timelineView === 'daily'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold shadow-2xs'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                Daily Timeline
              </button>
              <button
                onClick={() => setTimelineView('weekly')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  timelineView === 'weekly'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold shadow-2xs'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                Weekly/Monthly Aggregate
              </button>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {timelineView === 'daily' ? (
                <AreaChart data={timeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="savingsDepGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="savingsWdGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#888888" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#888888" tickFormatter={(v: number) => `₦${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<DailySavingsTooltip currency={currency} />} />
                  <Area type="monotone" dataKey="deposits" stroke="#10b981" fill="url(#savingsDepGrad)" strokeWidth={2} name="Deposits" />
                  <Area type="monotone" dataKey="withdrawals" stroke="#f59e0b" fill="url(#savingsWdGrad)" strokeWidth={2} name="Withdrawals" />
                </AreaChart>
              ) : (
                <BarChart data={weekly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#888888" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#888888" tickFormatter={(v: number) => `₦${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<WeeklySavingsTooltip currency={currency} />} />
                  <Bar dataKey="deposits" fill="#10b981" radius={[4, 4, 0, 0]} name="Deposits" />
                  <Bar dataKey="withdrawals" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Withdrawals" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Provider Breakdown Table */}
      <Card className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <CardContent className="p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Savings & Investment Providers
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Breakdown of reserves by provider, distinguishing savings vaults from regulated investments
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase">
                <tr>
                  <th className="py-2.5 px-3">Provider</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Deposited</th>
                  <th className="py-2.5 px-3 text-right">Withdrawn</th>
                  <th className="py-2.5 px-3 text-right">Interest</th>
                  <th className="py-2.5 px-3 text-right">Net Change</th>
                  <th className="py-2.5 px-3 text-center">Movements</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {providers.map((p) => (
                  <tr key={p.provider} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-semibold text-slate-900 dark:text-slate-100">
                      <div>{p.provider}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{p.evidence}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${p.providerType === 'investment' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                        {p.providerType === 'investment' ? 'Regulated Investment' : 'Savings Vault'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-medium text-emerald-600">
                      {formatCurrency(p.deposited + p.invested, currency)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-medium text-amber-600">
                      {formatCurrency(p.withdrawn + p.investmentWithdrawn, currency)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-medium text-blue-600">
                      {formatCurrency(p.interest, currency)}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono font-bold ${p.netChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatCurrency(p.netChange, currency)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => onViewTransactions({ search: p.provider.split(' ')[0] })}
                        className="px-2 py-0.5 rounded text-[11px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium"
                      >
                        {p.movementCount} records
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Savings Movements Ledger */}
      <Card className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Savings Movements Ledger
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Traceable log of all verified savings, investment, and vault movements ({filteredMovements.length} records)
              </p>
            </div>

            {/* Search and Filter Pills */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search provider or memo..."
                  className="pl-8 pr-3 py-1 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full sm:w-48"
                />
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {['ALL', 'DEPOSIT', 'WITHDRAWAL', 'INTERNAL', 'INTEREST'].map((k) => (
                  <button
                    key={k}
                    onClick={() => setFilterKind(k)}
                    className={`px-3 py-1 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                      filterKind === k
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {k === 'ALL' ? 'All' : k === 'INTERNAL' ? 'Vault Transfers' : `${k.charAt(0) + k.slice(1).toLowerCase()}s`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Provider</th>
                  <th className="py-2.5 px-3">Movement Type</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredMovements.slice(0, 50).map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                      {formatDate(m.date)}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {m.provider}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {getKindBadge(m.kind)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                      {m.description}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap ${
                      m.kind === 'DEPOSIT' || m.kind === 'INVESTMENT_CONTRIBUTION'
                        ? 'text-emerald-600'
                        : m.kind === 'WITHDRAWAL' || m.kind === 'INVESTMENT_WITHDRAWAL'
                        ? 'text-amber-600'
                        : m.kind === 'INTEREST'
                        ? 'text-blue-600'
                        : 'text-purple-600'
                    }`}>
                      {formatCurrency(m.amount, currency)}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => onViewTransactions({ search: m.sourceTransactionIds[0] })}
                        className="text-[11px] text-purple-600 hover:underline font-medium"
                      >
                        Ledger
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
