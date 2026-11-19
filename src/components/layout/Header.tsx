'use client';

import React from 'react';
import { BankAccount, Currency, StatementMetadata } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { 
  Building2, 
  Wallet,
  Sparkles,
  FileText,
} from 'lucide-react';

interface HeaderProps {
  currentCurrency: Currency;
  onCurrencyChange: (currency: Currency) => void;
  activeTab?: string;
  account?: BankAccount | null;
  statement?: StatementMetadata | null;
  onOpenReportModal?: () => void;
}

export function Header({
  currentCurrency,
  onCurrencyChange,
  activeTab: _activeTab,
  account,
  statement,
  onOpenReportModal,
}: HeaderProps) {
  // Format current time greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = account?.accountName ? account.accountName.split(' ')[0] : 'there';

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {getGreeting()},
            </span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {firstName}
            </span>
            {account && statement ? (
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Active Statement
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                No Statement Loaded
              </span>
            )}
          </div>
          {account && statement ? (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>{account.bankName}</span>
              <span>•</span>
              <span className="truncate max-w-[200px]" title={statement.fileName}>{statement.fileName}</span>
            </div>
          ) : (
            <p className="hidden md:block text-xs text-slate-500 dark:text-slate-400">
              Upload a bank statement to begin financial analysis
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Active Account Balance Pill */}
        {account && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 dark:bg-slate-800/80 dark:border-slate-700/80 text-xs">
            <Wallet className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-500 dark:text-slate-400">Closing Balance:</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono">
              {formatCurrency(account.closingBalance, currentCurrency)}
            </span>
          </div>
        )}

        {/* Currency Switcher */}
        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-800">
          {(['NGN', 'USD', 'GBP'] as Currency[]).map((curr) => (
            <button
              key={curr}
              onClick={() => onCurrencyChange(curr)}
              className={`px-2 py-1 rounded-md transition-all ${
                currentCurrency === curr
                  ? 'bg-white font-semibold text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {curr === 'NGN' ? '₦ NGN' : curr === 'USD' ? '$ USD' : '£ GBP'}
            </button>
          ))}
        </div>

        {/* Export Report Action */}
        {account && statement && onOpenReportModal && (
          <button
            onClick={onOpenReportModal}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold shadow-xs transition-colors"
            title="Export PDF / CSV Financial Report"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export Report</span>
          </button>
        )}

        {/* AI Readiness Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Engine: Ready</span>
        </div>

        {/* User Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
            OK
          </div>
        </div>
      </div>
    </header>
  );
}
