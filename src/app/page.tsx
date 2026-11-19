'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { NavTab } from '@/components/layout/Sidebar';
import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
import { UploadSection } from '@/components/upload/UploadSection';
import { TransactionTable } from '@/components/transactions/TransactionTable';
import { AnalyticsView } from '@/components/analytics/AnalyticsView';
import { InsightsView } from '@/components/insights/InsightsView';
import { FinancialChatView } from '@/components/chat/FinancialChatView';
import { BudgetView } from '@/components/budget/BudgetView';
import { SavingsView } from '@/components/savings/SavingsView';
import { SubscriptionAuditView } from '@/components/subscriptions/SubscriptionAuditView';
import { SettingsView } from '@/components/settings/SettingsView';
import { FinancialReportModal } from '@/components/export/FinancialReportModal';
import { loadWorkspacePreferences } from '@/lib/settings/settingsEngine';
import type { WorkspacePreferences } from '@/lib/settings/types';
import { setActiveCustomRules } from '@/lib/classification/classifier';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ArrowRight } from 'lucide-react';
import { BankAccount, Currency, StatementMetadata, Transaction } from '@/types';

export interface ParsedUploadResponse {
  fileName?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  currency?: Currency;
  periodStart?: string;
  periodEnd?: string;
  accounts?: Array<{ openingBalance?: number; closingBalance?: number }>;
  transactions?: Transaction[];
}

export default function Home() {
  // Pure User Statement State (Zero hardcoded data)
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [statement, setStatement] = useState<StatementMetadata | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [preferences, setPreferences] = useState<WorkspacePreferences>(() => {
    const loaded = loadWorkspacePreferences();
    setActiveCustomRules(loaded.customRules);
    return loaded;
  });

  const handlePreferencesChange = (newPrefs: WorkspacePreferences) => {
    setPreferences(newPrefs);
    setActiveCustomRules(newPrefs.customRules);
  };

  // Filter state passed when navigating from dashboard to transactions (Traceability)
  const [tableFilter, setTableFilter] = useState<{
    category?: string;
    type?: string;
    search?: string;
    merchant?: string;
  }>({});

  const handleTransactionsChange = (updatedTxs: Transaction[]) => {
    setTransactions(updatedTxs);
  };

  const handleClearStatement = () => {
    setTransactions([]);
    setAccount(null);
    setStatement(null);
    setTableFilter({});
  };

  const handleCustomUploadSuccess = (parseData: ParsedUploadResponse) => {
    if (parseData && parseData.transactions) {
      const txs: Transaction[] = parseData.transactions.map((tx: Transaction) => ({
        id: tx.id,
        statementId: 'stmt_custom',
        accountId: 'acc_custom',
        date: tx.date,
        time: tx.time,
        description: tx.description,
        originalDescription: tx.originalDescription,
        merchant: tx.merchant || tx.description.split('|')[0].trim(),
        reference: tx.reference,
        debit: tx.debit,
        credit: tx.credit,
        amount: tx.amount,
        direction: tx.direction,
        balance: tx.balance,
        currency: tx.currency,
        category: tx.category || 'Other',
        categoryGroup: tx.categoryGroup || 'Other',
        transactionType: tx.transactionType || (tx.direction === 'CREDIT' ? 'INCOME' : 'EXPENSE'),
        confidenceScore: tx.confidenceScore || 0.95,
        classificationMethod: tx.classificationMethod || 'deterministic',
        isInternalTransfer: tx.isInternalTransfer || false,
        isRefund: tx.isRefund || false,
        isRecurring: tx.isRecurring || false,
        isIncome: tx.isIncome || false,
        isExpense: tx.isExpense || false,
        isSavings: tx.isSavings || false,
        notes: tx.notes,
        source: parseData.fileName || 'Uploaded Statement',
      }));

      const acc: BankAccount = {
        id: 'acc_custom',
        userId: 'usr_custom',
        bankName: parseData.bankName || 'Verified Bank',
        accountName: parseData.accountName || 'Verified Account Holder',
        accountNumberMasked: parseData.accountNumber ? `${parseData.accountNumber.slice(0, 4)}****` : '****',
        accountType: 'WALLET',
        currency: parseData.currency || 'NGN',
        openingBalance: parseData.accounts?.[0]?.openingBalance || 0,
        closingBalance: parseData.accounts?.[0]?.closingBalance || 0,
        statementPeriodStart: parseData.periodStart || '2026-10-01',
        statementPeriodEnd: parseData.periodEnd || '2026-11-08',
        createdAt: new Date().toISOString(),
      };

      const stmt: StatementMetadata = {
        id: 'stmt_custom',
        fileName: parseData.fileName || 'Uploaded_Statement.pdf',
        fileSize: 500000,
        fileType: 'pdf',
        bankName: parseData.bankName || 'Verified Bank',
        periodStart: parseData.periodStart || '2026-10-01',
        periodEnd: parseData.periodEnd || '2026-11-08',
        transactionCount: txs.length,
        status: 'COMPLETED',
        detectedAccount: parseData.accountName || 'Bank Account',
        currency: parseData.currency || 'NGN',
        uploadDate: new Date().toISOString().split('T')[0],
      };

      setTransactions(txs);
      setAccount(acc);
      setStatement(stmt);
    }
  };

  const renderTabContent = (
    activeTab: NavTab,
    currency: Currency,
    setCurrency: (c: Currency) => void,
    setActiveTab: (tab: NavTab) => void
  ) => {
    if (activeTab === 'dashboard') {
      return (
        <DashboardOverview
          currency={currency}
          transactions={transactions}
          account={account}
          statement={statement}
          onViewTransactions={(filter) => {
            if (filter) setTableFilter(filter);
            else setTableFilter({});
            setActiveTab('transactions');
          }}
          onUploadNew={() => setActiveTab('upload')}
          onClearStatement={handleClearStatement}
          onExportReport={() => setIsReportModalOpen(true)}
        />
      );
    }

    if (activeTab === 'upload') {
      return (
        <UploadSection
          onCustomUploadSuccess={(data) => {
            handleCustomUploadSuccess(data);
            setActiveTab('dashboard');
          }}
        />
      );
    }

    if (activeTab === 'transactions') {
      return (
        <TransactionTable
          currency={currency}
          transactions={transactions}
          onTransactionsChange={handleTransactionsChange}
          initialCategory={tableFilter.category}
          initialType={tableFilter.type}
          initialSearch={tableFilter.search || tableFilter.merchant}
        />
      );
    }

    if (activeTab === 'analytics') {
      return (
        <AnalyticsView
          currency={currency}
          transactions={transactions}
          onViewTransactions={(filter) => {
            if (filter) setTableFilter(filter);
            else setTableFilter({});
            setActiveTab('transactions');
          }}
        />
      );
    }

    if (activeTab === 'insights') {
      return (
        <InsightsView
          currency={currency}
          transactions={transactions}
          onViewTransactions={(filter) => {
            if (filter) setTableFilter(filter);
            else setTableFilter({});
            setActiveTab('transactions');
          }}
        />
      );
    }

    if (activeTab === 'chat') {
      return (
        <FinancialChatView
          currency={currency}
          transactions={transactions}
          onViewTransactions={(filter) => {
            if (filter) setTableFilter(filter);
            else setTableFilter({});
            setActiveTab('transactions');
          }}
        />
      );
    }

    if (activeTab === 'budget') {
      return (
        <BudgetView
          currency={currency}
          transactions={transactions}
          onViewTransactions={(filter) => {
            if (filter) setTableFilter(filter);
            else setTableFilter({});
            setActiveTab('transactions');
          }}
        />
      );
    }

    if (activeTab === 'savings') {
      return (
        <SavingsView
          currency={currency}
          transactions={transactions}
          onViewTransactions={(filter) => {
            if (filter) setTableFilter(filter);
            else setTableFilter({});
            setActiveTab('transactions');
          }}
        />
      );
    }

    if (activeTab === 'subscriptions') {
      return (
        <SubscriptionAuditView
          currency={currency}
          transactions={transactions}
          onViewTransactions={(filter) => {
            if (filter) setTableFilter(filter);
            else setTableFilter({});
            setActiveTab('transactions');
          }}
        />
      );
    }

    if (activeTab === 'settings') {
      return (
        <SettingsView
          currency={currency}
          onCurrencyChange={setCurrency}
          transactions={transactions}
          onTransactionsChange={handleTransactionsChange}
          onClearStatement={handleClearStatement}
          preferences={preferences}
          onPreferencesChange={handlePreferencesChange}
        />
      );
    }

    // Upcoming phase placeholder tabs
    const upcomingInfo: Record<string, { title: string; phase: string; desc: string }> = {
      settings: {
        title: 'Preferences & Workspace Settings',
        phase: 'Phase 15',
        desc: 'Bank statement parsing rules, default currency, custom merchant categories, and local data export.',
      },
    };

    const current = upcomingInfo[activeTab] || {
      title: 'Upcoming Feature',
      phase: 'Roadmap',
      desc: 'This feature will be unlocked in an upcoming phase of MoneyLens.',
    };

    return (
      <div className="max-w-2xl mx-auto py-12 animate-in fade-in duration-300">
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm text-center p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 mb-4 border border-emerald-200 dark:border-emerald-800">
            <Sparkles className="w-7 h-7" />
          </div>
          <Badge variant="purple" size="md" className="mx-auto mb-2">
            Scheduled for {current.phase}
          </Badge>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {current.title}
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-lg mx-auto">
            {current.desc}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
            >
              Return to Dashboard Overview
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </Card>
      </div>
    );
  };

  return (
    <AppShell
      account={account || undefined}
      statement={statement || undefined}
      onOpenReportModal={() => setIsReportModalOpen(true)}
    >
      {({ activeTab, currency, setCurrency, setActiveTab }) => (
        <>
          {renderTabContent(activeTab, currency, setCurrency, setActiveTab)}
          {account && statement && (
            <FinancialReportModal
              isOpen={isReportModalOpen}
              onClose={() => setIsReportModalOpen(false)}
              transactions={transactions}
              account={account}
              statement={statement}
              currency={currency}
            />
          )}
        </>
      )}
    </AppShell>
  );
}
