'use client';

import React, { useState, useMemo } from 'react';
import type { Currency, SpendingCategoryGroup, Transaction } from '@/types';
import { formatCurrency } from '@/lib/utils';
import {
  computePersonalizedBudget,
  getPresetOverrides,
} from '@/lib/budget/budgetEngine';
import { EmptyState } from '@/components/ui/empty-state';
import type { BudgetCategoryTarget } from '@/lib/budget/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Target,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Receipt,
  Search,
  Edit2,
  Check,
  X,
  Wallet,
} from 'lucide-react';

interface BudgetViewProps {
  currency: Currency;
  transactions: Transaction[];
  onViewTransactions: (filter?: {
    category?: string;
    type?: string;
    merchant?: string;
    search?: string;
  }) => void;
}

export function BudgetView({ currency, transactions, onViewTransactions }: BudgetViewProps) {
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activePreset, setActivePreset] = useState<'recommended' | 'conservative' | 'aggressive' | 'custom'>('recommended');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [tempEditValue, setTempEditValue] = useState<string>('');

  // Compute budget report with active overrides
  const budgetReport = useMemo(() => {
    return computePersonalizedBudget(transactions, overrides, currency);
  }, [transactions, overrides, currency]);

  const { summary, categories } = budgetReport;

  // Handle preset application
  const handleApplyPreset = (preset: 'recommended' | 'conservative' | 'aggressive') => {
    const newOverrides = getPresetOverrides(categories, preset);
    setOverrides(newOverrides);
    setActivePreset(preset);
    setEditingCategory(null);
  };

  // Start inline editing
  const handleStartEdit = (cat: BudgetCategoryTarget) => {
    setEditingCategory(cat.category);
    setTempEditValue(cat.currentTarget.toString());
  };

  // Save inline edit
  const handleSaveEdit = (categoryName: string) => {
    const val = parseFloat(tempEditValue);
    if (!isNaN(val) && val >= 0) {
      setOverrides((prev) => ({
        ...prev,
        [categoryName]: Math.round(val),
      }));
      setActivePreset('custom');
    }
    setEditingCategory(null);
  };

  // Quick adjust (+/- 10%)
  const handleQuickAdjust = (cat: BudgetCategoryTarget, multiplier: number) => {
    const nextVal = Math.max(0, Math.round((cat.currentTarget * multiplier) / 500) * 500);
    setOverrides((prev) => ({
      ...prev,
      [cat.category]: nextVal,
    }));
    setActivePreset('custom');
  };

  // Filter categories
  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      const matchGroup = selectedGroup === 'ALL' || c.group === selectedGroup;
      const matchSearch =
        !searchQuery ||
        c.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.group.toLowerCase().includes(searchQuery.toLowerCase());
      return matchGroup && matchSearch;
    });
  }, [categories, selectedGroup, searchQuery]);

  // Group Badge styling
  const getGroupBadgeClass = (group: SpendingCategoryGroup) => {
    switch (group) {
      case 'Essential Spending':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
      case 'Lifestyle':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800';
      case 'Giving':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
      case 'Financial':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800';
      case 'Discretionary':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  // Status Badge styling
  const getStatusBadge = (status: BudgetCategoryTarget['status'], util: number) => {
    if (status === 'OVER_BUDGET') {
      return (
        <Badge variant="danger" className="gap-1 font-medium text-[10px]">
          <AlertCircle className="w-3 h-3" /> Over Budget ({util > 200 ? '>200%' : `${util.toFixed(0)}%`})
        </Badge>
      );
    }
    if (status === 'WARNING') {
      return (
        <Badge variant="warning" className="gap-1 font-medium text-[10px]">
          <AlertTriangle className="w-3 h-3" /> Near Limit ({util.toFixed(0)}%)
        </Badge>
      );
    }
    return (
      <Badge variant="success" className="gap-1 font-medium text-[10px]">
        <CheckCircle2 className="w-3 h-3" /> On Track ({util.toFixed(0)}%)
      </Badge>
    );
  };

  if (transactions.length === 0) {
    return (
      <EmptyState
        badge="Smart Budget"
        badgeVariant="info"
        title="No Spending History for Budgeting"
        description="Upload your bank statement to calculate an intelligent personalized budget based on your actual income and historical living expenses."
        actionLabel="Upload Bank Statement"
        onAction={() => onViewTransactions()}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Top Banner: Smart Budget Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Personalized Smart Budget
              </h1>
              <Badge variant="neutral" className="gap-1 text-[11px] font-mono border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="w-3 h-3" /> Statement Grounded
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Custom spending plan calculated from your actual {summary.periodDays}-day transaction history—no rigid or ungrounded 50/30/20 templates.
            </p>
          </div>
        </div>

        {/* Preset Selector */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 self-start lg:self-auto">
          <button
            onClick={() => handleApplyPreset('recommended')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activePreset === 'recommended'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            AI Baseline
          </button>
          <button
            onClick={() => handleApplyPreset('conservative')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activePreset === 'conservative'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            10% Trim
          </button>
          <button
            onClick={() => handleApplyPreset('aggressive')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activePreset === 'aggressive'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Aggressive Savings
          </button>
          {Object.keys(overrides).length > 0 && (
            <button
              onClick={() => handleApplyPreset('recommended')}
              title="Reset all custom edits to baseline"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 transition-colors ml-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* High-Level Financial Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Income Card */}
        <Card className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Audited True Income</span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {formatCurrency(summary.totalIncome, currency)}
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              True external inflows across statement period
            </p>
          </CardContent>
        </Card>

        {/* Total Budget Target */}
        <Card className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Budget Cap</span>
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <Target className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {formatCurrency(summary.totalBudgetTarget, currency)}
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {summary.totalIncome > 0
                ? `${((summary.totalBudgetTarget / summary.totalIncome) * 100).toFixed(1)}% of total income allocated`
                : 'Sum of all category targets'}
            </p>
          </CardContent>
        </Card>

        {/* Actual Spend */}
        <Card className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Actual Living Spend</span>
              <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {formatCurrency(summary.totalActualSpend, currency)}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px]">
              <span className={summary.totalActualSpend <= summary.totalBudgetTarget ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
                {summary.totalActualSpend <= summary.totalBudgetTarget
                  ? `₦${(summary.totalBudgetTarget - summary.totalActualSpend).toLocaleString()} under budget`
                  : `₦${(summary.totalActualSpend - summary.totalBudgetTarget).toLocaleString()} over budget`}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Free Surplus / Buffer */}
        <Card className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Unallocated Income Buffer</span>
              <Badge variant={summary.unallocatedIncome >= 0 ? 'success' : 'danger'} className="text-[10px]">
                Score: {summary.budgetHealthScore}/100
              </Badge>
            </div>
            <div className={`mt-2 text-2xl font-bold tracking-tight ${summary.unallocatedIncome >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {formatCurrency(summary.unallocatedIncome, currency)}
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {summary.unallocatedIncome >= 0
                ? 'Available for savings sweeps and wealth building'
                : 'Deficit: budget exceeds current income'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Budget Allocation Composition Bar */}
      <Card className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <CardContent className="p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Budget Allocation Breakdown
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Proportion of allocated capital tailored to verified living patterns
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Essential ({summary.categoryDistribution.essential.percentOfBudget.toFixed(0)}%)
              </span>
              <span className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> Lifestyle ({summary.categoryDistribution.lifestyle.percentOfBudget.toFixed(0)}%)
              </span>
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Giving ({summary.categoryDistribution.giving.percentOfBudget.toFixed(0)}%)
              </span>
            </div>
          </div>

          {/* Segmented Bar */}
          <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${summary.categoryDistribution.essential.percentOfBudget}%` }}
              className="bg-blue-500 h-full transition-all duration-300"
              title={`Essential: ${formatCurrency(summary.categoryDistribution.essential.amount, currency)}`}
            />
            <div
              style={{ width: `${summary.categoryDistribution.lifestyle.percentOfBudget}%` }}
              className="bg-purple-500 h-full transition-all duration-300"
              title={`Lifestyle: ${formatCurrency(summary.categoryDistribution.lifestyle.amount, currency)}`}
            />
            <div
              style={{ width: `${summary.categoryDistribution.giving.percentOfBudget}%` }}
              className="bg-emerald-500 h-full transition-all duration-300"
              title={`Giving: ${formatCurrency(summary.categoryDistribution.giving.amount, currency)}`}
            />
            <div
              style={{ width: `${summary.categoryDistribution.other.percentOfBudget + summary.categoryDistribution.financial.percentOfBudget}%` }}
              className="bg-slate-400 h-full transition-all duration-300"
              title="Other / Fees"
            />
          </div>
        </CardContent>
      </Card>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Group Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'Essential Spending', 'Lifestyle', 'Giving', 'Discretionary'].map((group) => (
            <button
              key={group}
              onClick={() => setSelectedGroup(group)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                selectedGroup === group
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs font-semibold'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'
              }`}
            >
              {group === 'ALL' ? 'All Categories' : group}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Category Envelopes Table / List */}
      <div className="space-y-3">
        {filteredCategories.map((cat) => {
          const isEditing = editingCategory === cat.category;
          const isOver = cat.status === 'OVER_BUDGET';
          const isWarning = cat.status === 'WARNING';
          const progressPercent = Math.min(100, cat.utilizationPercent);

          const progressColor = isOver
            ? 'bg-rose-500'
            : isWarning
            ? 'bg-amber-500'
            : 'bg-emerald-500';

          return (
            <Card
              key={cat.category}
              className={`border transition-all duration-200 ${
                isOver
                  ? 'border-rose-200 bg-rose-50/20 dark:border-rose-900/40 dark:bg-rose-950/10'
                  : 'border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900'
              } shadow-xs hover:shadow-sm`}
            >
              <CardContent className="p-4 sm:p-5 space-y-3">
                {/* Header Row: Category, Group, Status & Edit Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                      {cat.category}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${getGroupBadgeClass(cat.group)}`}>
                      {cat.group}
                    </span>
                    {cat.isUserEdited && (
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-mono">
                        Custom
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {getStatusBadge(cat.status, cat.utilizationPercent)}

                    <button
                      onClick={() => onViewTransactions({ category: cat.category })}
                      className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1 transition-colors"
                      title="Inspect underlying transactions"
                    >
                      <span>{cat.transactionCount} txs</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Numbers Grid: Actual vs Target */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Actual Spend */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Actual Spend</div>
                    <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                      {formatCurrency(cat.actualSpend, currency)}
                    </div>
                  </div>

                  {/* AI Recommended Target */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">AI Recommended Target</div>
                    <div className="text-base font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                      {formatCurrency(cat.recommendedTarget, currency)}
                    </div>
                  </div>

                  {/* Current Active Target (Editable!) */}
                  <div className={`p-3 rounded-xl border transition-all ${
                    isEditing
                      ? 'border-emerald-500 bg-emerald-50/20 ring-2 ring-emerald-500/20'
                      : 'border-slate-200/60 bg-slate-50 dark:border-slate-700/60 dark:bg-slate-800/60'
                  }`}>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Active Budget Cap</span>
                      {!isEditing && (
                        <button
                          onClick={() => handleStartEdit(cat)}
                          className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" /> Edit
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-semibold text-slate-500">₦</span>
                        <input
                          type="number"
                          value={tempEditValue}
                          onChange={(e) => setTempEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(cat.category);
                            if (e.key === 'Escape') setEditingCategory(null);
                          }}
                          className="w-full text-sm font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEdit(cat.category)}
                          className="p-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                          title="Save target"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingCategory(null)}
                          className="p-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition-colors"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                          {formatCurrency(cat.currentTarget, currency)}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleQuickAdjust(cat, 0.9)}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-mono transition-colors"
                            title="Trim 10%"
                          >
                            -10%
                          </button>
                          <button
                            onClick={() => handleQuickAdjust(cat, 1.1)}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-mono transition-colors"
                            title="Add 10%"
                          >
                            +10%
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Bar & Variance */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-medium text-[11px]">
                      Target Utilization
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                      {cat.currentTarget > 0 ? `${cat.utilizationPercent.toFixed(1)}%` : 'No budget set'}
                      {cat.variance > 0 ? (
                        <span className="text-rose-600 ml-1.5 font-bold">
                          (+{formatCurrency(cat.variance, currency)} over)
                        </span>
                      ) : (
                        <span className="text-emerald-600 ml-1.5 font-medium">
                          ({formatCurrency(Math.abs(cat.variance), currency)} remaining)
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${progressPercent}%` }}
                      className={`h-full ${progressColor} transition-all duration-300 rounded-full`}
                    />
                  </div>
                </div>

                {/* Recommendation Rationale */}
                <div className="pt-1 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5 border-t border-slate-100 dark:border-slate-800/80 mt-2">
                  <span className="font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    Why this target:
                  </span>
                  <span>{cat.recommendationReason}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredCategories.length === 0 && (
          <Card className="border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500">
            No budget categories match your current filter.
          </Card>
        )}
      </div>
    </div>
  );
}
