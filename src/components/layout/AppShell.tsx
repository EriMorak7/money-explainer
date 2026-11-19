'use client';

import React, { useState } from 'react';
import { BankAccount, Currency, StatementMetadata } from '@/types';
import { Header } from '@/components/layout/Header';
import { Sidebar, NavTab } from '@/components/layout/Sidebar';
import { LayoutDashboard, UploadCloud, Receipt, PieChart, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppShellProps {
  account?: BankAccount;
  statement?: StatementMetadata;
  onOpenReportModal?: () => void;
  children: (props: {
    activeTab: NavTab;
    currency: Currency;
    setCurrency: (currency: Currency) => void;
    setActiveTab: (tab: NavTab) => void;
  }) => React.ReactNode;
}

export function AppShell({ account, statement, onOpenReportModal, children }: AppShellProps) {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [currency, setCurrency] = useState<Currency>('NGN');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-100/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased">
      {/* Desktop Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setMobileMenuOpen(false);
        }}
        transactionCount={statement?.transactionCount}
        className="hidden md:flex min-h-screen sticky top-0"
      />

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-950 p-4 transition-transform duration-300 md:hidden flex flex-col justify-between border-r border-slate-200 dark:border-slate-800',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <span className="font-bold text-lg text-slate-900 dark:text-slate-50">
            MoneyLens
          </span>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-1 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setMobileMenuOpen(false);
          }}
          transactionCount={statement?.transactionCount}
          className="border-none w-full p-0 my-4"
        />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-3 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <Header
              currentCurrency={currency}
              onCurrencyChange={setCurrency}
              activeTab={activeTab}
              account={account}
              statement={statement}
              onOpenReportModal={onOpenReportModal}
            />
          </div>
        </div>

        {/* Page Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-8">
          {children({ activeTab, currency, setCurrency, setActiveTab })}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <div className="fixed bottom-0 inset-x-0 z-30 flex items-center justify-around border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:hidden">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              'flex flex-col items-center gap-1 p-2 text-xs font-medium',
              activeTab === 'dashboard'
                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'text-slate-500 dark:text-slate-400'
            )}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={cn(
              'flex flex-col items-center gap-1 p-2 text-xs font-medium',
              activeTab === 'upload'
                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'text-slate-500 dark:text-slate-400'
            )}
          >
            <UploadCloud className="w-5 h-5" />
            <span>Upload</span>
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={cn(
              'flex flex-col items-center gap-1 p-2 text-xs font-medium',
              activeTab === 'transactions'
                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'text-slate-500 dark:text-slate-400'
            )}
          >
            <Receipt className="w-5 h-5" />
            <span>Ledger</span>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={cn(
              'flex flex-col items-center gap-1 p-2 text-xs font-medium',
              activeTab === 'analytics'
                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'text-slate-500 dark:text-slate-400'
            )}
          >
            <PieChart className="w-5 h-5" />
            <span>Analytics</span>
          </button>
        </div>
      </div>
    </div>
  );
}
