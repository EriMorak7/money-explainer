'use client';

import React, { useState, useMemo } from 'react';
import type { Currency, Transaction } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { computeSubscriptionAudit } from '@/lib/subscriptions/recurringEngine';
import { EmptyState } from '@/components/ui/empty-state';
import type {
  RecurringMerchant,
  UserLabelOverride,
} from '@/lib/subscriptions/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Calendar,
  Receipt,
  ArrowRight,
  Search,
} from 'lucide-react';

interface SubscriptionAuditViewProps {
  currency: Currency;
  transactions: Transaction[];
  onViewTransactions: (filter?: {
    category?: string;
    type?: string;
    merchant?: string;
    search?: string;
  }) => void;
}

export function SubscriptionAuditView({
  currency,
  transactions,
  onViewTransactions,
}: SubscriptionAuditViewProps) {
  const [userOverrides, setUserOverrides] = useState<Record<string, UserLabelOverride>>({});
  const [activeTab, setActiveTab] = useState<'all' | 'subscriptions' | 'active' | 'stopped' | 'highest'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Deterministically compute subscription audit from verified transactions + user overrides
  const report = useMemo(() => {
    return computeSubscriptionAudit(transactions, userOverrides, currency);
  }, [transactions, userOverrides, currency]);

  const { metrics, activeRecurring, potentialSubscriptions, recentlyStopped, highestRecurringCosts, allMerchants } = report;

  // Filter merchants based on search
  const filterList = (list: RecurringMerchant[]) => {
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (m) =>
        m.cleanMerchant.toLowerCase().includes(q) ||
        m.merchant.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        (m.subscriptionCategory && m.subscriptionCategory.toLowerCase().includes(q))
    );
  };

  const handleOverride = (merchantKey: string, label: UserLabelOverride) => {
    setUserOverrides((prev) => ({
      ...prev,
      [merchantKey]: label,
    }));
  };

  // Helper for label badge styling
  const renderLabelBadge = (label: UserLabelOverride) => {
    switch (label) {
      case 'subscription':
        return <Badge variant="purple" className="text-[10px]">Subscription</Badge>;
      case 'business_expense':
        return <Badge variant="neutral" className="text-[10px]">Business Expense</Badge>;
      case 'personal_expense':
        return <Badge variant="neutral" className="text-[10px]">Personal Expense</Badge>;
      case 'not_recurring':
        return <Badge variant="danger" className="text-[10px]">Not Recurring</Badge>;
      case 'ignore':
        return <Badge variant="danger" className="text-[10px]">Ignored</Badge>;
    }
  };

  if (transactions.length === 0) {
    return (
      <EmptyState
        badge="Subscription Audit"
        badgeVariant="purple"
        title="No Recurring Charges Found"
        description="Upload your bank statement to automatically audit subscriptions, recurring bills, SaaS tools, and recently stopped memberships."
        actionLabel="Upload Bank Statement"
        onAction={() => onViewTransactions()}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              Recurring Payments & Subscription Audit
            </h1>
            <Badge variant="purple" size="md">
              Phase 10 Verified
            </Badge>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Automated detection of recurring commitments, SaaS subscriptions, cadences, renewal dates, and annual run-rates.
          </p>
        </div>

        {/* Global Search */}
        <div className="relative self-start sm:self-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search merchant or service..."
            className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-56"
          />
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Estimated Annual Recurring Cost */}
        <Card className="border border-indigo-200/80 dark:border-indigo-900/40 bg-linear-to-br from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-slate-900 shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Estimated Annual Cost</span>
              <span className="p-1 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                <CreditCard className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
              {formatCurrency(metrics.totalAnnualRecurringCost, currency)}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Projected 12-month run-rate for {metrics.totalActiveRecurringCount} active commitments
            </p>
          </CardContent>
        </Card>

        {/* Total Monthly Recurring Cost */}
        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Monthly Recurring Burn</span>
              <span className="p-1 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <TrendingUp className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
              {formatCurrency(metrics.totalMonthlyRecurringCost, currency)}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Current monthly baseline spend across all active recurring charges
            </p>
          </CardContent>
        </Card>

        {/* Potential Subscriptions */}
        <Card className="border border-purple-200/80 dark:border-purple-900/40 bg-white dark:bg-slate-900 shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Potential Subscriptions</span>
              <span className="p-1 rounded-md bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400">
                {metrics.activeSubscriptionsCount}
              </p>
              <span className="text-xs font-mono text-slate-500">
                ({formatCurrency(metrics.potentialSubscriptionsMonthlyCost, currency)}/mo)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Identified SaaS, digital streaming, and app subscriptions
            </p>
          </CardContent>
        </Card>

        {/* Recently Stopped / Potential Savings */}
        <Card className="border border-amber-200/80 dark:border-amber-900/40 bg-white dark:bg-slate-900 shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Recently Stopped</span>
              <span className="p-1 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {metrics.recentlyStoppedCount}
              </p>
              <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
                (+{formatCurrency(metrics.savedMonthlyFromStopped, currency)}/mo saved)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Past-due recurring charges no longer hitting your account
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
        {[
          { id: 'all', label: `All Recurring (${allMerchants.length})` },
          { id: 'subscriptions', label: `Potential Subscriptions (${potentialSubscriptions.length})` },
          { id: 'active', label: `Active Commitments (${activeRecurring.length})` },
          { id: 'stopped', label: `Recently Stopped (${recentlyStopped.length})` },
          { id: 'highest', label: 'Highest Annual Costs' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SECTION 1: POTENTIAL SUBSCRIPTIONS SPOTLIGHT */}
      {(activeTab === 'all' || activeTab === 'subscriptions') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Audited Subscriptions & Digital Memberships
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Identified using merchant signatures, cadence consistency, and amount stability. (Confidence score threshold &gt; 50%).
              </p>
            </div>
          </div>

          {filterList(potentialSubscriptions).length === 0 ? (
            <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center p-8">
              <p className="text-xs text-slate-500">No active digital subscriptions matching criteria.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filterList(potentialSubscriptions).map((sub) => (
                <Card
                  key={sub.cleanMerchant}
                  className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-300 dark:hover:border-purple-800 transition-all shadow-xs"
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {sub.cleanMerchant}
                          </h3>
                        </div>
                        <span className="text-[11px] text-slate-400">{sub.subscriptionCategory || 'Digital Service'}</span>
                      </div>
                      <Badge variant="purple" className="text-[10px] font-mono">
                        {Math.round(sub.confidenceScore * 100)}% Match
                      </Badge>
                    </div>

                    <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 dark:text-slate-400">Cadence:</span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">{sub.cadenceLabel}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 dark:text-slate-400">Average Charge:</span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrency(sub.averagePayment, currency)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 dark:text-slate-400">Monthly Run-Rate:</span>
                        <span className="font-mono font-semibold text-purple-600 dark:text-purple-400">
                          {formatCurrency(sub.monthlyCost, currency)}/mo
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 dark:text-slate-400">Next Estimated Renewal:</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {sub.nextEstimatedPaymentDate}
                        </span>
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Audit Proof: </span>
                      {sub.confidenceRationale}
                    </div>

                    {/* Classification Selector */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">Label:</span>
                        <select
                          value={sub.userLabel}
                          onChange={(e) => handleOverride(sub.cleanMerchant, e.target.value as UserLabelOverride)}
                          className="text-[11px] bg-slate-100 dark:bg-slate-800 border-0 rounded px-2 py-0.5 font-medium text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-purple-500"
                        >
                          <option value="subscription">Subscription</option>
                          <option value="business_expense">Business Expense</option>
                          <option value="personal_expense">Personal Expense</option>
                          <option value="not_recurring">Not Recurring</option>
                          <option value="ignore">Ignore</option>
                        </select>
                      </div>

                      <button
                        onClick={() => onViewTransactions({ search: sub.cleanMerchant })}
                        className="text-[11px] font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 flex items-center gap-0.5"
                      >
                        {sub.transactionCount} records
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: ACTIVE RECURRING PAYMENTS LEDGER */}
      {(activeTab === 'all' || activeTab === 'active') && (
        <Card className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-indigo-600" />
                  Active Recurring Commitments Ledger
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Comprehensive audit of verified regular bills, utility obligations, and frequent merchant charges.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Merchant</th>
                    <th className="py-2.5 px-3">Cadence</th>
                    <th className="py-2.5 px-3 text-right">Avg Payment</th>
                    <th className="py-2.5 px-3">Last Payment</th>
                    <th className="py-2.5 px-3">Next Due</th>
                    <th className="py-2.5 px-3 text-right">Monthly Run-Rate</th>
                    <th className="py-2.5 px-3 text-right">Annual Impact</th>
                    <th className="py-2.5 px-3">Classification</th>
                    <th className="py-2.5 px-3 text-center">User Override</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filterList(activeRecurring).map((item) => (
                    <tr
                      key={item.cleanMerchant}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {item.cleanMerchant}
                        </div>
                        <div className="text-[10px] text-slate-400">{item.category}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {item.cadenceLabel}
                        </span>
                        <div className="text-[10px] text-slate-400">
                          ~{item.averageIntervalDays > 0 ? Math.round(item.averageIntervalDays) : '-'} days gap
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-medium text-slate-900 dark:text-slate-100">
                        {formatCurrency(item.averagePayment, currency)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-slate-700 dark:text-slate-300">{item.lastPaymentDate}</div>
                        <div className="text-[10px] text-slate-400">{item.daysSinceLastPayment}d ago</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-medium text-indigo-600 dark:text-indigo-400">
                          {item.nextEstimatedPaymentDate}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(item.monthlyCost, currency)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(item.annualEstimatedCost, currency)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1 items-start">
                          <Badge
                            variant={item.classification === 'confirmed' ? 'success' : 'neutral'}
                            className="text-[10px]"
                          >
                            {item.classification === 'confirmed' ? 'Confirmed' : 'Probable'}
                          </Badge>
                          {renderLabelBadge(item.userLabel)}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <select
                          value={item.userLabel}
                          onChange={(e) => handleOverride(item.cleanMerchant, e.target.value as UserLabelOverride)}
                          className="text-[10px] bg-slate-100 dark:bg-slate-800 border-0 rounded px-1.5 py-0.5 font-medium text-slate-700 dark:text-slate-300"
                        >
                          <option value="subscription">Subscription</option>
                          <option value="business_expense">Business Expense</option>
                          <option value="personal_expense">Personal Expense</option>
                          <option value="not_recurring">Not Recurring</option>
                          <option value="ignore">Ignore</option>
                        </select>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => onViewTransactions({ search: item.cleanMerchant })}
                          className="px-2 py-0.5 rounded text-[11px] bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 font-medium"
                        >
                          {item.transactionCount} records
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SECTION 3: RECENTLY STOPPED RECURRING CHARGES */}
      {(activeTab === 'all' || activeTab === 'stopped') && (
        <Card className="border border-amber-200/80 dark:border-amber-900/40 bg-white dark:bg-slate-900 shadow-xs">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-600" />
                  Recently Stopped Recurring Payments ({recentlyStopped.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Recurring services past their expected renewal window by &gt; 1.75x cadence. (Potential freed cash flow: {formatCurrency(metrics.savedMonthlyFromStopped, currency)}/mo).
                </p>
              </div>
            </div>

            {recentlyStopped.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                All identified recurring payments are currently active and up to date.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Merchant</th>
                      <th className="py-2.5 px-3">Previous Cadence</th>
                      <th className="py-2.5 px-3 text-right">Avg Payment</th>
                      <th className="py-2.5 px-3">Last Billed Date</th>
                      <th className="py-2.5 px-3">Days Since Last Charge</th>
                      <th className="py-2.5 px-3 text-right">Freed Monthly Cash</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filterList(recentlyStopped).map((stopped) => (
                      <tr key={stopped.cleanMerchant} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-3 font-semibold text-slate-900 dark:text-slate-100">
                          {stopped.cleanMerchant}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                          {stopped.cadenceLabel}
                        </td>
                        <td className="py-3 px-3 text-right font-mono">
                          {formatCurrency(stopped.averagePayment, currency)}
                        </td>
                        <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                          {stopped.lastPaymentDate}
                        </td>
                        <td className="py-3 px-3 font-medium text-amber-600">
                          {stopped.daysSinceLastPayment} days ago
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600">
                          +{formatCurrency(stopped.monthlyCost, currency)}/mo
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Badge variant="neutral" className="text-[10px]">
                            Inactive / Cancelled
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* SECTION 4: HIGHEST RECURRING COSTS (Ranked Annualized Impact) */}
      {(activeTab === 'all' || activeTab === 'highest') && (
        <Card className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardContent className="p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-rose-500" />
                Highest Annual Recurring Commitments
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Top recurring commitments ranked by cumulative 12-month drain on your cash flow.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {highestRecurringCosts.map((item, idx) => (
                <div
                  key={item.cleanMerchant}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-500">#{idx + 1}</span>
                    <Badge variant="neutral" className="text-[9px]">
                      {item.cadenceLabel}
                    </Badge>
                  </div>
                  <h3 className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                    {item.cleanMerchant}
                  </h3>
                  <p className="text-base font-bold font-mono text-rose-600 dark:text-rose-400">
                    {formatCurrency(item.annualEstimatedCost, currency)}
                    <span className="text-[10px] font-normal text-slate-400"> /yr</span>
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span>{formatCurrency(item.monthlyCost, currency)}/mo</span>
                    <button
                      onClick={() => onViewTransactions({ search: item.cleanMerchant })}
                      className="text-indigo-600 hover:underline font-medium"
                    >
                      Audit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
