'use client';

import React, { useMemo } from 'react';
import type { BankAccount, Currency, StatementMetadata, Transaction } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { generateFinancialReportData } from '@/lib/export/reportData';
import { exportTransactionsToCsv, downloadCsvBlob } from '@/lib/export/csvExport';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Download,
  X,
  Building2,
  Calendar,
  CheckCircle2,
  TrendingUp,
  PiggyBank,
  Receipt,
  Sparkles,
  CreditCard,
  Target,
  ShieldCheck,
} from 'lucide-react';

interface FinancialReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  account: BankAccount;
  statement: StatementMetadata;
  currency?: Currency;
}

export function FinancialReportModal({
  isOpen,
  onClose,
  transactions,
  account,
  statement,
  currency = 'NGN',
}: FinancialReportModalProps) {
  const report = useMemo(() => {
    return generateFinancialReportData(transactions, account, statement, currency);
  }, [transactions, account, statement, currency]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCsv = () => {
    const csvString = exportTransactionsToCsv(transactions, { maskSensitive: true });
    const bankSafe = account.bankName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    downloadCsvBlob(csvString, `${bankSafe}_statement_report_${statement.periodEnd}.csv`);
  };

  const {
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
  } = report;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[92vh] flex flex-col print:max-h-none print:shadow-none print:border-none print:w-full">
        {/* Modal Top Bar (Hidden in Print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 print:hidden">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Executive Financial Statement Report
            </h2>
            <Badge variant="purple" size="sm">
              Phase 14 Audited
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadCsv}
              className="text-xs flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handlePrint}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              Print / Save as PDF
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Report Container */}
        <div
          id="financial-report-document"
          className="overflow-y-auto p-6 sm:p-10 space-y-8 text-slate-800 dark:text-slate-200 print:overflow-visible print:p-0 print:space-y-6"
        >
          {/* REPORT HEADER & INSTITUTION WATERMARK */}
          <div className="border-b-2 border-slate-900 dark:border-slate-100 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                  MoneyLens Executive Intelligence
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-400">Verified Financial Audit</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                {statementOverview.bankName} Financial Analysis
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Audited Period: <span className="font-semibold text-slate-700 dark:text-slate-300">{statementOverview.periodStart}</span> to <span className="font-semibold text-slate-700 dark:text-slate-300">{statementOverview.periodEnd}</span>
              </p>
            </div>

            <div className="text-right text-xs space-y-0.5 self-start sm:self-auto">
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                Account: {statementOverview.accountName}
              </p>
              <p className="font-mono text-slate-500">
                Number: {statementOverview.accountNumberMasked}
              </p>
              <p className="text-[11px] text-slate-400">
                Generated: {report.generatedAt}
              </p>
            </div>
          </div>

          {/* 1. STATEMENT OVERVIEW & RECONCILIATION */}
          <section className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Building2 className="w-4 h-4 text-slate-400" />
              1. Statement Overview & Balance Reconciliation
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                <span className="text-slate-400">Total Transactions</span>
                <p className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {statementOverview.totalTransactions} verified rows
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                <span className="text-slate-400">Opening Balance</span>
                <p className="text-base font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {formatCurrency(statementOverview.openingBalance, currency)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                <span className="text-slate-400">Closing Balance</span>
                <p className="text-base font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {formatCurrency(statementOverview.closingBalance, currency)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                <span className="text-slate-400">Net Balance Shift</span>
                <p className={`text-base font-mono font-bold mt-0.5 ${statementOverview.netBalanceChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {statementOverview.netBalanceChange >= 0 ? '+' : ''}{formatCurrency(statementOverview.netBalanceChange, currency)}
                </p>
              </div>
            </div>
          </section>

          {/* 2. EXECUTIVE FINANCIAL SUMMARY */}
          <section className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              2. Core Financial Executive Summary
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800">
                <span className="text-emerald-700 dark:text-emerald-300 font-medium">True External Income</span>
                <p className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {formatCurrency(financialSummary.totalExternalIncome, currency)}
                </p>
                <span className="text-[10px] text-slate-400">Excludes internal transfers & loans</span>
              </div>

              <div className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-800">
                <span className="text-rose-700 dark:text-rose-300 font-medium">Actual Living Expenses</span>
                <p className="text-lg font-bold font-mono text-rose-700 dark:text-rose-300 mt-0.5">
                  {formatCurrency(financialSummary.totalActualExpenses, currency)}
                </p>
                <span className="text-[10px] text-slate-400">Excludes savings sweeps & transfers</span>
              </div>

              <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-800">
                <span className="text-indigo-700 dark:text-indigo-300 font-medium">Net Cash Flow</span>
                <p className={`text-lg font-bold font-mono mt-0.5 ${financialSummary.netCashFlow >= 0 ? 'text-indigo-700 dark:text-indigo-300' : 'text-rose-700 dark:text-rose-300'}`}>
                  {financialSummary.netCashFlow >= 0 ? '+' : ''}{formatCurrency(financialSummary.netCashFlow, currency)}
                </p>
                <span className="text-[10px] text-slate-400">Income minus living expenses</span>
              </div>

              <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-800">
                <span className="text-purple-700 dark:text-purple-300 font-medium">Health & Savings Rate</span>
                <p className="text-lg font-bold font-mono text-purple-700 dark:text-purple-300 mt-0.5">
                  {financialSummary.savingsRatePercent.toFixed(1)}% ({financialSummary.financialHealthScore}/100)
                </p>
                <span className="text-[10px] text-slate-400">Rating: {financialSummary.healthRating}</span>
              </div>
            </div>
          </section>

          {/* 3. INCOME ANALYSIS & 4. EXPENSE ANALYSIS (SIDE-BY-SIDE) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 3. Income Analysis */}
            <section className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                3. Income Source Breakdown
              </div>
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Total External Credits</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {incomeAnalysis.incomeTransactionCount} deposits (Avg {formatCurrency(incomeAnalysis.averageIncomePerCredit, currency)})
                  </span>
                </div>
                {incomeAnalysis.topIncomeSources.map((s) => (
                  <div key={s.source} className="flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400">{s.source} ({s.count}x)</span>
                    <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(s.amount, currency)} ({s.percentage.toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* 4. Expense Analysis */}
            <section className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Receipt className="w-4 h-4 text-rose-500" />
                4. Expense Analysis by Lifestyle Group
              </div>
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Daily Burn Rate</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {formatCurrency(expenseAnalysis.dailyBurnRate, currency)}/day across {expenseAnalysis.activeSpendingDays} active days
                  </span>
                </div>
                {expenseAnalysis.groups.map((g) => (
                  <div key={g.group} className="flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400">{g.group}</span>
                    <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(g.amount, currency)} ({g.percentage.toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* 5. CASH FLOW AUDITING */}
          <section className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              5. Cash Flow Reconciliations & Non-Expense Deductions
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-400">Total Bank Inflows vs Outflows</span>
                <p className="font-mono font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                  +{formatCurrency(cashFlow.totalInflows, currency)} / -{formatCurrency(cashFlow.totalOutflows, currency)}
                </p>
              </div>
              <div>
                <span className="text-slate-400">Savings Sweeps Preserved</span>
                <p className="font-mono font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {formatCurrency(cashFlow.savingsTransfersExcluded, currency)} (Excluded from expenses)
                </p>
              </div>
              <div>
                <span className="text-slate-400">Internal Transfers Neutralized</span>
                <p className="font-mono font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                  {formatCurrency(cashFlow.internalTransfersExcluded, currency)} (No double-counting)
                </p>
              </div>
            </div>
          </section>

          {/* 6. SAVINGS & WEALTH ANALYSIS */}
          <section className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <PiggyBank className="w-4 h-4 text-emerald-600" />
              6. Savings & Wealth Accumulation Analysis
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400">Gross Deposited</span>
                <p className="font-mono font-bold text-emerald-600 text-sm mt-0.5">
                  +{formatCurrency(savingsAnalysis.totalDeposited, currency)}
                </p>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400">Gross Withdrawn</span>
                <p className="font-mono font-bold text-amber-600 text-sm mt-0.5">
                  -{formatCurrency(savingsAnalysis.totalWithdrawn, currency)}
                </p>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400">Net Retained Wealth</span>
                <p className="font-mono font-bold text-purple-600 text-sm mt-0.5">
                  {formatCurrency(savingsAnalysis.netRetainedSavings, currency)} ({savingsAnalysis.retentionRatePercent.toFixed(1)}%)
                </p>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400">OWealth Interest Earned</span>
                <p className="font-mono font-bold text-blue-600 text-sm mt-0.5">
                  +{formatCurrency(savingsAnalysis.interestEarned, currency)}
                  {savingsAnalysis.annualizedYieldRunRate && (
                    <span className="text-[10px] font-normal text-slate-400 block">
                      ({formatCurrency(savingsAnalysis.annualizedYieldRunRate, currency)}/yr run-rate)
                    </span>
                  )}
                </p>
              </div>
            </div>
          </section>

          {/* 7. TOP SPENDING CATEGORIES TABLE */}
          <section className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Receipt className="w-4 h-4 text-slate-400" />
              7. Top Spending Categories
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500">
                  <tr>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3">Group</th>
                    <th className="py-2 px-3 text-right">Total Spent</th>
                    <th className="py-2 px-3 text-right">% of Living Expenses</th>
                    <th className="py-2 px-3 text-center">Transactions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {spendingCategories.map((c) => (
                    <tr key={c.category}>
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">{c.category}</td>
                      <td className="py-2 px-3 text-slate-500">{c.group}</td>
                      <td className="py-2 px-3 text-right font-mono font-medium">{formatCurrency(c.amount, currency)}</td>
                      <td className="py-2 px-3 text-right font-mono">{c.percentage.toFixed(1)}%</td>
                      <td className="py-2 px-3 text-center font-mono text-slate-500">{c.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 8. TOP MERCHANTS ANALYSIS */}
          <section className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Building2 className="w-4 h-4 text-slate-400" />
              8. Merchant Spend & Transaction Frequency
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500">
                  <tr>
                    <th className="py-2 px-3">Merchant</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3 text-right">Total Spent</th>
                    <th className="py-2 px-3 text-right">% of Spending</th>
                    <th className="py-2 px-3 text-right">Avg Ticket</th>
                    <th className="py-2 px-3 text-center">Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {merchantAnalysis.map((m) => (
                    <tr key={m.merchant}>
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">{m.merchant}</td>
                      <td className="py-2 px-3 text-slate-500">{m.category}</td>
                      <td className="py-2 px-3 text-right font-mono font-medium">{formatCurrency(m.totalSpent, currency)}</td>
                      <td className="py-2 px-3 text-right font-mono">{m.percentageOfTotal.toFixed(1)}%</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-400">{formatCurrency(m.averageTicket, currency)}</td>
                      <td className="py-2 px-3 text-center font-mono text-slate-500">{m.transactionCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 9. RECURRING PAYMENTS & SUBSCRIPTIONS */}
          <section className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <CreditCard className="w-4 h-4 text-indigo-600" />
              9. Recurring Commitments & Subscription Audit
            </div>
            <div className="p-3.5 rounded-xl border border-indigo-200/80 dark:border-indigo-900/40 bg-indigo-50/30 dark:bg-indigo-950/20 text-xs mb-3 flex flex-wrap justify-between gap-3">
              <div>
                <span className="text-slate-400">Total Monthly Recurring</span>
                <p className="font-mono font-bold text-indigo-700 dark:text-indigo-300 text-sm">
                  {formatCurrency(recurringPayments.totalMonthlyRecurringCost, currency)}/mo
                </p>
              </div>
              <div>
                <span className="text-slate-400">Annual Projected Impact</span>
                <p className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {formatCurrency(recurringPayments.totalAnnualRecurringCost, currency)}/yr
                </p>
              </div>
              <div>
                <span className="text-slate-400">Active Commitments</span>
                <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                  {recurringPayments.activeCommitmentsCount} services ({recurringPayments.potentialSubscriptionsCount} digital subs)
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500">
                  <tr>
                    <th className="py-2 px-3">Service / Merchant</th>
                    <th className="py-2 px-3">Cadence</th>
                    <th className="py-2 px-3 text-right">Avg Payment</th>
                    <th className="py-2 px-3 text-right">Monthly Cost</th>
                    <th className="py-2 px-3 text-right">Annual Impact</th>
                    <th className="py-2 px-3">Next Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recurringPayments.topRecurringItems.map((r) => (
                    <tr key={r.merchant}>
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">
                        {r.merchant} {r.isSubscription && <span className="text-[10px] text-purple-600 font-normal">• Subscription</span>}
                      </td>
                      <td className="py-2 px-3 text-slate-500">{r.cadence}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatCurrency(r.averagePayment, currency)}</td>
                      <td className="py-2 px-3 text-right font-mono font-medium">{formatCurrency(r.monthlyCost, currency)}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-indigo-600">{formatCurrency(r.annualCost, currency)}</td>
                      <td className="py-2 px-3 font-medium text-slate-700 dark:text-slate-300">{r.nextDue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 10. LARGEST TRANSACTIONS */}
          <section className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Calendar className="w-4 h-4 text-slate-400" />
              10. Largest Statement Transactions
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Largest Debits */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300 block pb-1 border-b border-slate-100 dark:border-slate-800">
                  Top 5 Outflows / Debits
                </span>
                {largestTransactions.debits.map((d, i) => (
                  <div key={i} className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]">{d.merchant || d.description}</p>
                      <p className="text-[10px] text-slate-400">{d.date} • {d.category}</p>
                    </div>
                    <span className="font-mono font-bold text-rose-600 whitespace-nowrap">-{formatCurrency(d.amount, currency)}</span>
                  </div>
                ))}
              </div>

              {/* Largest Credits */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300 block pb-1 border-b border-slate-100 dark:border-slate-800">
                  Top 5 Inflows / Credits
                </span>
                {largestTransactions.credits.map((c, i) => (
                  <div key={i} className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]">{c.sender || c.description}</p>
                      <p className="text-[10px] text-slate-400">{c.date} • {c.category}</p>
                    </div>
                    <span className="font-mono font-bold text-emerald-600 whitespace-nowrap">+{formatCurrency(c.amount, currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 11. FINANCIAL INSIGHTS */}
          <section className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Sparkles className="w-4 h-4 text-purple-600" />
              11. Verified AI Financial Analyst Insights
            </div>
            <div className="space-y-2.5">
              {financialInsights.map((fi, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-xs space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={fi.severity === 'critical' ? 'danger' : fi.severity === 'warning' ? 'warning' : 'success'} className="text-[9px]">
                      {fi.category}
                    </Badge>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{fi.title}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{fi.summary}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 12. BUDGET ANALYSIS */}
          <section className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Target className="w-4 h-4 text-emerald-600" />
              12. Personalized Historical Budget Allocations
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500">
                  <tr>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3 text-right">Actual Spent</th>
                    <th className="py-2 px-3 text-right">Target Ceiling</th>
                    <th className="py-2 px-3 text-right">Variance</th>
                    <th className="py-2 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {budgetAnalysis.recommendedLimits.map((b) => (
                    <tr key={b.category}>
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">{b.category}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatCurrency(b.currentSpent, currency)}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-500">{formatCurrency(b.recommendedLimit, currency)}</td>
                      <td className={`py-2 px-3 text-right font-mono font-medium ${b.variance <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {b.variance > 0 ? `+${formatCurrency(b.variance, currency)}` : formatCurrency(b.variance, currency)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant={b.status === 'exceeded' ? 'danger' : 'success'} className="text-[9px]">
                          {b.status === 'exceeded' ? 'Exceeded' : 'Within Budget'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 13. STRATEGIC RECOMMENDATIONS */}
          <section className="space-y-3 pt-2 border-t-2 border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              <CheckCircle2 className="w-4 h-4" />
              13. Strategic Financial Recommendations
            </div>
            <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/60 text-xs space-y-2">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">•</span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          </section>

          {/* REPORT FOOTER */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 flex flex-col sm:flex-row justify-between gap-2">
            <p>Certified by MoneyLens Core Financial Engine • Strict Mathematical Consistency Guaranteed</p>
            <p>Confidential Personal Financial Document</p>
          </div>
        </div>
      </div>
    </div>
  );
}
