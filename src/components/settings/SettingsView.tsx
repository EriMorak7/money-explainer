'use client';

import React, { useState } from 'react';
import type { Currency, Transaction, TransactionCategory, TransactionType } from '@/types';
import { formatCurrency } from '@/lib/utils';
import {
  addCustomRule,
  deleteCustomRule,
  toggleCustomRule,
  updateCategoryBudget,
  createWorkspaceBackup,
  validateAndRestoreBackup,
  resetWorkspacePreferences,
} from '@/lib/settings/settingsEngine';
import type {
  CustomClassificationRule,
  PatternMatchType,
  WorkspacePreferences,
} from '@/lib/settings/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Settings,
  ShieldCheck,
  Tag,
  Target,
  Trash2,
  Plus,
  Download,
  Upload,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  ToggleLeft,
  ToggleRight,
  Sliders,
  DollarSign,
  X,
} from 'lucide-react';

interface SettingsViewProps {
  currency: Currency;
  onCurrencyChange: (currency: Currency) => void;
  transactions: Transaction[];
  onTransactionsChange?: (transactions: Transaction[]) => void;
  onClearStatement: () => void;
  preferences: WorkspacePreferences;
  onPreferencesChange: (preferences: WorkspacePreferences) => void;
}

const AVAILABLE_CATEGORIES: TransactionCategory[] = [
  'Income',
  'Salary',
  'Client Payment',
  'Freelance',
  'Business Income',
  'Transfers Received',
  'Investment Return',
  'Other Income',
  'Food',
  'Groceries',
  'Restaurants',
  'Food Delivery',
  'Transportation',
  'Fuel',
  'Rent',
  'Utilities',
  'Airtime',
  'Data',
  'Healthcare',
  'Education',
  'Shopping',
  'Entertainment',
  'Subscriptions',
  'Streaming',
  'Gaming',
  'Savings',
  'Investment',
  'Loan Repayment',
  'Bank Charges',
  'Transfers',
  'Church & Tithe',
  'Charity',
  'Family Support',
  'Betting & Gambling',
  'Refund',
  'Other',
];

export function SettingsView({
  currency,
  onCurrencyChange,
  transactions,
  onTransactionsChange,
  onClearStatement,
  preferences,
  onPreferencesChange,
}: SettingsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'rules' | 'budgets' | 'data'>('general');
  const [isAddRuleModalOpen, setIsAddRuleModalOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // New Rule Form State
  const [newPattern, setNewPattern] = useState('');
  const [newMatchType, setNewMatchType] = useState<PatternMatchType>('contains');
  const [newCategory, setNewCategory] = useState<TransactionCategory>('Food');
  const [newMerchant, setNewMerchant] = useState('');
  const [newTransactionType, setNewTransactionType] = useState<TransactionType>('EXPENSE');

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Re-evaluates transactions against custom rules
  const handleApplyRulesToTransactions = (rulesToApply: CustomClassificationRule[]) => {
    if (!transactions.length || !onTransactionsChange) return;

    let updatedCount = 0;
    const updated = transactions.map((tx) => {
      for (const rule of rulesToApply) {
        if (!rule.enabled) continue;
        const patternLower = rule.pattern.toLowerCase().trim();
        const descLower = tx.description.toLowerCase().trim();
        let matches = false;

        if (rule.matchType === 'exact') {
          matches = descLower === patternLower;
        } else if (rule.matchType === 'regex') {
          try {
            matches = new RegExp(rule.pattern, 'i').test(tx.description);
          } catch {
            matches = false;
          }
        } else {
          matches = descLower.includes(patternLower);
        }

        if (matches) {
          updatedCount++;
          return {
            ...tx,
            category: rule.category,
            merchant: rule.merchant || rule.pattern,
            transactionType: rule.transactionType || tx.transactionType,
            confidenceScore: 1.0,
            classificationMethod: 'manual' as const,
          };
        }
      }
      return tx;
    });

    onTransactionsChange(updated);
    showNotification(`Custom rules applied: ${updatedCount} transactions reclassified`);
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPattern.trim()) return;

    const { preferences: updated, newRule } = addCustomRule(preferences, {
      pattern: newPattern.trim(),
      matchType: newMatchType,
      category: newCategory,
      merchant: newMerchant.trim() || undefined,
      transactionType: newTransactionType,
      enabled: true,
      notes: `User rule created for pattern "${newPattern.trim()}"`,
    });

    onPreferencesChange(updated);
    setIsAddRuleModalOpen(false);
    setNewPattern('');
    setNewMerchant('');
    handleApplyRulesToTransactions(updated.customRules);
    showNotification(`Rule for "${newRule.pattern}" added successfully`);
  };

  const handleDeleteRule = (ruleId: string) => {
    const updated = deleteCustomRule(preferences, ruleId);
    onPreferencesChange(updated);
    showNotification('Rule removed');
  };

  const handleToggleRule = (ruleId: string) => {
    const updated = toggleCustomRule(preferences, ruleId);
    onPreferencesChange(updated);
    handleApplyRulesToTransactions(updated.customRules);
  };

  const handleBudgetChange = (category: string, valueStr: string) => {
    const num = parseFloat(valueStr) || 0;
    const updated = updateCategoryBudget(preferences, category, num);
    onPreferencesChange(updated);
  };

  const handleExportBackup = () => {
    const backup = createWorkspaceBackup(preferences);
    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `moneylens_workspace_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showNotification('Workspace backup exported successfully');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = validateAndRestoreBackup(content);
      if (res.success && res.preferences) {
        onPreferencesChange(res.preferences);
        onCurrencyChange(res.preferences.defaultCurrency);
        handleApplyRulesToTransactions(res.preferences.customRules);
        showNotification('Workspace backup restored successfully');
      } else {
        alert(res.error || 'Failed to restore backup.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetWorkspace = () => {
    const defaults = resetWorkspacePreferences();
    onPreferencesChange(defaults);
    onCurrencyChange(defaults.defaultCurrency);
    onClearStatement();
    setIsResetConfirmOpen(false);
    showNotification('Workspace reset to defaults. Cached statements purged.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12 max-w-6xl mx-auto">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xl text-xs font-semibold animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>{notification}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Settings className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              Workspace Preferences & Rules
            </h1>
            <Badge variant="purple" size="md">
              Phase 15 Verified
            </Badge>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Configure classification rules, default statement currencies, category budget ceilings, and local workspace backups.
          </p>
        </div>

        {/* Quick Backup Export Action */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportBackup}
            className="text-xs flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Backup Workspace
          </Button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveSubTab('general')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'general'
              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          General Preferences
        </button>
        <button
          onClick={() => setActiveSubTab('rules')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'rules'
              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          Custom Classification Rules ({preferences.customRules.length})
        </button>
        <button
          onClick={() => setActiveSubTab('budgets')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'budgets'
              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          Category Budget Targets
        </button>
        <button
          onClick={() => setActiveSubTab('data')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'data'
              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Data & Privacy Reset
        </button>
      </div>

      {/* 1. GENERAL PREFERENCES */}
      {activeSubTab === 'general' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Default Currency & Display
              </CardTitle>
              <CardDescription className="text-xs">
                Set primary reporting currency for imported statements.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Statement Primary Currency
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['NGN', 'USD', 'GBP'] as Currency[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        onCurrencyChange(c);
                        onPreferencesChange({ ...preferences, defaultCurrency: c });
                      }}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        currency === c
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 font-bold text-indigo-700 dark:text-indigo-300'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {c === 'NGN' ? '₦ Nigerian Naira' : c === 'USD' ? '$ US Dollar' : '£ British Pound'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Large Transaction Alert Threshold ({currency})
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={preferences.largeTransactionThreshold}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      onPreferencesChange({ ...preferences, largeTransactionThreshold: val });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-slate-400 whitespace-nowrap">
                    {formatCurrency(preferences.largeTransactionThreshold, currency)}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Transactions exceeding this limit trigger automated high-impact notifications.
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Privacy & Data Security Defaults
              </CardTitle>
              <CardDescription className="text-xs">
                Control sensitive bank information exposure in reports and views.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    Mask Sensitive Bank Account Numbers
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Masks 10-digit NUBAN numbers in statements and PDF/CSV exports (e.g. ****6407).
                  </p>
                </div>
                <button
                  onClick={() => {
                    onPreferencesChange({
                      ...preferences,
                      maskSensitiveData: !preferences.maskSensitiveData,
                    });
                  }}
                  className="text-indigo-600 dark:text-indigo-400 p-1"
                >
                  {preferences.maskSensitiveData ? (
                    <ToggleRight className="w-6 h-6" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-slate-400" />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    Automated Recurring Commitments Audit
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Continuously detect subscriptions, SaaS tools, and cadences from historical repetition.
                  </p>
                </div>
                <button
                  onClick={() => {
                    onPreferencesChange({
                      ...preferences,
                      autoDetectRecurring: !preferences.autoDetectRecurring,
                    });
                  }}
                  className="text-indigo-600 dark:text-indigo-400 p-1"
                >
                  {preferences.autoDetectRecurring ? (
                    <ToggleRight className="w-6 h-6" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-slate-400" />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    Isolate Internal Savings & Wealth Sweeps
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Prevents OWealth sweeps, PiggyVest, and SafeBox vault movements from counting as expenses.
                  </p>
                </div>
                <button
                  onClick={() => {
                    onPreferencesChange({
                      ...preferences,
                      autoDetectSavingsSweeps: !preferences.autoDetectSavingsSweeps,
                    });
                  }}
                  className="text-indigo-600 dark:text-indigo-400 p-1"
                >
                  {preferences.autoDetectSavingsSweeps ? (
                    <ToggleRight className="w-6 h-6" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-slate-400" />
                  )}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 2. CUSTOM CLASSIFICATION RULES */}
      {activeSubTab === 'rules' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Custom Classification Rules
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Define keyword rules to override default classification. Custom rules take Tier-1 priority over built-in dictionary patterns.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddRuleModalOpen(true)}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Custom Rule
            </Button>
          </div>

          {preferences.customRules.length === 0 ? (
            <Card className="border border-slate-200 dark:border-slate-800 p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 mb-3 border border-indigo-200 dark:border-indigo-800">
                <Tag className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                No Custom Rules Defined
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Add rules like &quot;when description contains Freelance Client, classify as Client Payment (Income)&quot; to personalize transaction intelligence.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddRuleModalOpen(true)}
                className="mt-4 text-xs"
              >
                Create Your First Rule
              </Button>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500">
                  <tr>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Keyword Pattern</th>
                    <th className="py-2.5 px-3">Match Type</th>
                    <th className="py-2.5 px-3">Target Category</th>
                    <th className="py-2.5 px-3">Merchant Name</th>
                    <th className="py-2.5 px-3">Transaction Type</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {preferences.customRules.map((r) => (
                    <tr key={r.id} className={r.enabled ? '' : 'opacity-50'}>
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => handleToggleRule(r.id)}
                          className="text-indigo-600 dark:text-indigo-400"
                          title={r.enabled ? 'Disable rule' : 'Enable rule'}
                        >
                          {r.enabled ? (
                            <ToggleRight className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-slate-400" />
                          )}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-900 dark:text-slate-100">
                        {r.pattern}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant="neutral" className="text-[10px]">
                          {r.matchType}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-indigo-700 dark:text-indigo-300">
                        {r.category}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        {r.merchant || '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant="purple" className="text-[10px]">
                          {r.transactionType || 'AUTO'}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleDeleteRule(r.id)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Delete rule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. CATEGORY BUDGET CEILINGS */}
      {activeSubTab === 'budgets' && (
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-600" />
              Monthly Category Budget Ceilings ({currency})
            </CardTitle>
            <CardDescription className="text-xs">
              Customize spending limits used by Smart Budget and Financial Insights.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {Object.entries(preferences.customCategoryBudgets).map(([cat, limit]) => (
                <div
                  key={cat}
                  className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-1.5"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{cat}</span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {formatCurrency(limit, currency)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={limit}
                      onChange={(e) => handleBudgetChange(cat, e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. DATA & PRIVACY RESET */}
      {activeSubTab === 'data' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Download className="w-4 h-4 text-indigo-600" />
                Workspace Backup & Migration
              </CardTitle>
              <CardDescription className="text-xs">
                Export and import your custom rules, category budget targets, and workspace preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 space-y-2">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  Export Settings Backup (JSON)
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Downloads a lightweight JSON backup containing your preferences, {preferences.customRules.length} custom rules, and budget limits.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportBackup}
                  className="text-xs mt-2 flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Backup JSON
                </Button>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 space-y-2">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  Restore Settings from Backup
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Upload a previously exported MoneyLens backup file to restore custom rules and budget ceilings.
                </p>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                  <Upload className="w-3.5 h-3.5" />
                  Select Backup JSON
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportBackup}
                    className="hidden"
                  />
                </label>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-rose-200/80 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Data Purge & Statement Reset
              </CardTitle>
              <CardDescription className="text-xs">
                Permanent local storage clearing and cached statement deletion.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 space-y-2">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  Clear Active Statement
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Unloads the currently parsed statement ({transactions.length} rows) and clears in-memory balances.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClearStatement}
                  className="text-xs text-slate-700 dark:text-slate-300 hover:text-rose-600 flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Unload Current Statement
                </Button>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 space-y-2">
                <p className="font-semibold text-rose-700 dark:text-rose-400">
                  Full Factory Reset
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Purges all stored custom rules, budget targets, loaded statements, and resets settings to default.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsResetConfirmOpen(true)}
                  className="text-xs bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Factory Reset Workspace
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ADD CUSTOM RULE MODAL */}
      {isAddRuleModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Add Custom Classification Rule
                </h3>
              </div>
              <button
                onClick={() => setIsAddRuleModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description Keyword / Pattern *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GYM FITNESS, CLIENT PAYMENT ABC, AMAZON WEB"
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Match Type
                  </label>
                  <select
                    value={newMatchType}
                    onChange={(e) => setNewMatchType(e.target.value as PatternMatchType)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value="contains">Contains substring</option>
                    <option value="exact">Exact match</option>
                    <option value="regex">Regular expression</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Category *
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as TransactionCategory)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    {AVAILABLE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Merchant Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Gold's Gym"
                    value={newMerchant}
                    onChange={(e) => setNewMerchant(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Transaction Type
                  </label>
                  <select
                    value={newTransactionType}
                    onChange={(e) => setNewTransactionType(e.target.value as TransactionType)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value="EXPENSE">Expense</option>
                    <option value="INCOME">Income</option>
                    <option value="SAVINGS_DEPOSIT">Savings Deposit</option>
                    <option value="SAVINGS_WITHDRAWAL">Savings Withdrawal</option>
                    <option value="INTERNAL_TRANSFER">Internal Transfer</option>
                    <option value="INVESTMENT_CONTRIBUTION">Investment Contribution</option>
                    <option value="BANK_CHARGE">Bank Charge</option>
                    <option value="REFUND">Refund</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddRuleModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Save & Apply Rule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET CONFIRMATION MODAL */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Factory Reset Workspace?
                </h3>
                <p className="text-xs text-slate-500">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              This will permanently delete all {preferences.customRules.length} custom rules, reset budget targets to factory defaults, and unload the active bank statement.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsResetConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleResetWorkspace}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                Confirm Factory Reset
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
