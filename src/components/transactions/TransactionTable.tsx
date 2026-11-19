'use client';

import React, { useState, useMemo } from 'react';
import { Currency, Transaction, TransactionCategory } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { setUserCategoryOverride } from '@/lib/classification/classifier';
import { exportTransactionsToCsv, downloadCsvBlob } from '@/lib/export/csvExport';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  ArrowUpDown, 
  Eye, 
  FileText, 
  X, 
  SlidersHorizontal,
  Download
} from 'lucide-react';

interface TransactionTableProps {
  currency: Currency;
  transactions?: Transaction[];
  onTransactionsChange?: (transactions: Transaction[]) => void;
  initialCategory?: string;
  initialType?: string;
  initialSearch?: string;
}

export function TransactionTable({
  currency,
  transactions: externalTransactions,
  onTransactionsChange,
  initialCategory,
  initialType,
  initialSearch,
}: TransactionTableProps) {
  const [internalTransactions, setInternalTransactions] = useState<Transaction[]>(
    externalTransactions || []
  );

  const transactions = externalTransactions !== undefined ? externalTransactions : internalTransactions;

  const [searchQuery, setSearchQuery] = useState(initialSearch || '');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'ALL');
  const [selectedType, setSelectedType] = useState<string>(initialType || 'ALL');
  const [selectedDirection, setSelectedDirection] = useState<'ALL' | 'DEBIT' | 'CREDIT'>('ALL');
  const [sortField, setSortField] = useState<'date' | 'amount' | 'balance'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Sync with initial filter props if they change
  const [prevCategory, setPrevCategory] = useState(initialCategory);
  const [prevType, setPrevType] = useState(initialType);
  const [prevSearch, setPrevSearch] = useState(initialSearch);

  if (initialCategory !== prevCategory) {
    setPrevCategory(initialCategory);
    if (initialCategory !== undefined) setSelectedCategory(initialCategory);
  }
  if (initialType !== prevType) {
    setPrevType(initialType);
    if (initialType !== undefined) setSelectedType(initialType);
  }
  if (initialSearch !== prevSearch) {
    setPrevSearch(initialSearch);
    if (initialSearch !== undefined) setSearchQuery(initialSearch);
  }

  // Comprehensive list of all available categories for reclassification
  const ALL_CATEGORIES: TransactionCategory[] = [
    'Income',
    'Salary',
    'Freelance',
    'Business Income',
    'Client Payment',
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
    'Gaming',
    'Streaming',
    'Savings',
    'Investment',
    'Loan Repayment',
    'Bank Charges',
    'Transfers',
    'Cash Withdrawal',
    'Giving',
    'Family Support',
    'Church & Tithe',
    'Charity',
    'Gifts',
    'Betting & Gambling',
    'Refund',
    'Other',
    'Uncategorized',
  ];

  // Categories list for filter
  const categories: TransactionCategory[] = useMemo(() => {
    const set = new Set<TransactionCategory>();
    transactions.forEach((tx) => set.add(tx.category));
    return Array.from(set).sort();
  }, [transactions]);

  // Handle reclassification
  const handleCategoryChange = (txId: string, newCategory: TransactionCategory) => {
    const targetTx = transactions.find((t) => t.id === txId);
    if (targetTx) {
      setUserCategoryOverride(targetTx.description, newCategory, targetTx.merchant);
    }

    const updated = transactions.map((tx) => {
      if (tx.id === txId) {
        const isIncome = ['Salary', 'Freelance', 'Business Income', 'Client Payment', 'Transfers Received', 'Investment Return', 'Other Income', 'Income'].includes(newCategory);
        const isSavings = ['Savings', 'Investment'].includes(newCategory);
        const isInternal = newCategory === 'Transfers';
        const isRefund = newCategory === 'Refund';
        const isExpense = !isIncome && !isSavings && !isInternal && !isRefund;

        return {
          ...tx,
          category: newCategory,
          confidenceScore: 1.0,
          classificationMethod: 'manual' as const,
          userOverriddenCategory: true,
          isIncome,
          isSavings,
          isInternalTransfer: isInternal,
          isRefund,
          isExpense,
        };
      }
      return tx;
    });

    setInternalTransactions(updated);
    if (onTransactionsChange) {
      onTransactionsChange(updated);
    }

    if (selectedTransaction && selectedTransaction.id === txId) {
      const isIncome = ['Salary', 'Freelance', 'Business Income', 'Client Payment', 'Transfers Received', 'Investment Return', 'Other Income', 'Income'].includes(newCategory);
      const isSavings = ['Savings', 'Investment'].includes(newCategory);
      const isInternal = newCategory === 'Transfers';
      const isRefund = newCategory === 'Refund';
      const isExpense = !isIncome && !isSavings && !isInternal && !isRefund;

      setSelectedTransaction((prev) =>
        prev
          ? {
              ...prev,
              category: newCategory,
              confidenceScore: 1.0,
              classificationMethod: 'manual' as const,
              userOverriddenCategory: true,
              isIncome,
              isSavings,
              isInternalTransfer: isInternal,
              isRefund,
              isExpense,
            }
          : null
      );
    }
  };

  // Filter & Sort
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchDesc = tx.description.toLowerCase().includes(q);
          const matchOrig = tx.originalDescription.toLowerCase().includes(q);
          const matchMerchant = tx.merchant?.toLowerCase().includes(q) || false;
          const matchRef = tx.reference?.toLowerCase().includes(q) || false;
          if (!matchDesc && !matchOrig && !matchMerchant && !matchRef) return false;
        }

        // Category filter
        if (selectedCategory !== 'ALL' && tx.category !== selectedCategory) {
          return false;
        }

        // Type filter
        if (selectedType !== 'ALL') {
          if (selectedType === 'INCOME' && !tx.isIncome) return false;
          if (selectedType === 'EXPENSE' && (!tx.isExpense || tx.financialType === 'SAVINGS_WITHDRAWAL' || tx.financialType === 'INTERNAL_WEALTH_TRANSFER')) return false;
          if (selectedType === 'SAVINGS' && !tx.isSavings) return false;
          if (selectedType === 'SAVINGS_CONTRIBUTION' && tx.financialType !== 'SAVINGS_CONTRIBUTION') return false;
          if (selectedType === 'SAVINGS_WITHDRAWAL' && tx.financialType !== 'SAVINGS_WITHDRAWAL') return false;
          if (selectedType === 'INTERNAL_WEALTH_TRANSFER' && tx.financialType !== 'INTERNAL_WEALTH_TRANSFER') return false;
          if (selectedType === 'TRANSFER' && !tx.isInternalTransfer) return false;
          if (selectedType === 'REFUND' && !tx.isRefund) return false;
        }

        // Direction filter
        if (selectedDirection !== 'ALL' && tx.direction !== selectedDirection) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === 'date') {
          cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
        } else if (sortField === 'amount') {
          cmp = a.amount - b.amount;
        } else if (sortField === 'balance') {
          cmp = a.balance - b.balance;
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [transactions, searchQuery, selectedCategory, selectedType, selectedDirection, sortField, sortOrder]);

  const toggleSort = (field: 'date' | 'amount' | 'balance') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleExportCsv = () => {
    const csvString = exportTransactionsToCsv(filteredTransactions, { maskSensitive: true });
    const countTag = filteredTransactions.length < transactions.length ? `_filtered_${filteredTransactions.length}` : '_all';
    downloadCsvBlob(csvString, `transactions${countTag}.csv`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Statement Transactions
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Showing {filteredTransactions.length} of {transactions.length} normalized transactions
          </p>
        </div>

        {/* Search input and Export CSV button */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search merchant, reference, keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={handleExportCsv}
            title="Export transactions as CSV"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 shrink-0 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium pr-2 border-r border-slate-200 dark:border-slate-700">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Filters:</span>
        </div>

        {/* Type Filter */}
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none font-medium"
        >
          <option value="ALL">All Financial Types</option>
          <option value="INCOME">Income Only</option>
          <option value="EXPENSE">Living Expenses Only</option>
          <option value="SAVINGS_CONTRIBUTION">Savings Contributions</option>
          <option value="SAVINGS_WITHDRAWAL">Savings Withdrawals</option>
          <option value="INTERNAL_WEALTH_TRANSFER">Internal Wealth Transfers</option>
          <option value="SAVINGS">All Savings & Wealth</option>
          <option value="TRANSFER">Internal Transfers Only</option>
          <option value="REFUND">Refunds Only</option>
        </select>

        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none font-medium"
        >
          <option value="ALL">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {/* Direction Filter */}
        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5 text-xs font-medium">
          {(['ALL', 'DEBIT', 'CREDIT'] as const).map((dir) => (
            <button
              key={dir}
              onClick={() => setSelectedDirection(dir)}
              className={`px-2 py-1 rounded-md transition-all ${
                selectedDirection === dir
                  ? 'bg-white font-semibold text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              {dir === 'ALL' ? 'All Rows' : dir === 'DEBIT' ? 'Debits' : 'Credits'}
            </button>
          ))}
        </div>

        {(selectedCategory !== 'ALL' || selectedType !== 'ALL' || selectedDirection !== 'ALL' || searchQuery) && (
          <button
            onClick={() => {
              setSelectedCategory('ALL');
              setSelectedType('ALL');
              setSelectedDirection('ALL');
              setSearchQuery('');
            }}
            className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-medium ml-auto"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
            <tr>
              <th
                onClick={() => toggleSort('date')}
                className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-slate-100"
              >
                <div className="flex items-center gap-1">
                  <span>Date</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-4">Description & Merchant</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Type / Flag</th>
              <th
                onClick={() => toggleSort('amount')}
                className="py-3 px-4 text-right cursor-pointer hover:text-slate-900 dark:hover:text-slate-100"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Amount</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('balance')}
                className="py-3 px-4 text-right cursor-pointer hover:text-slate-900 dark:hover:text-slate-100"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Balance</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-4 text-center">Confidence</th>
              <th className="py-3 px-4 text-center">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  No transactions match your search or filter criteria.
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx) => {
                const isCredit = tx.direction === 'CREDIT';
                return (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Date */}
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatDate(tx.date)}
                    </td>

                    {/* Description & Merchant */}
                    <td className="py-3 px-4 max-w-xs sm:max-w-md">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {tx.merchant || tx.description}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate font-mono">
                        {tx.originalDescription}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge
                        variant={
                          tx.isIncome
                            ? 'success'
                            : tx.isSavings
                            ? 'purple'
                            : tx.isInternalTransfer
                            ? 'neutral'
                            : tx.isRefund
                            ? 'info'
                            : 'default'
                        }
                        size="sm"
                      >
                        {tx.category}
                      </Badge>
                    </td>

                    {/* Type / Flag */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {tx.financialType === 'SAVINGS_CONTRIBUTION' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-300 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                          Savings Contribution • Not Spending
                        </span>
                      ) : tx.financialType === 'SAVINGS_WITHDRAWAL' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-300 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                          Savings Withdrawal • Not Spending
                        </span>
                      ) : tx.financialType === 'INTERNAL_WEALTH_TRANSFER' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                          Internal Wealth Transfer • Not Spending
                        </span>
                      ) : tx.financialType === 'INTERNAL_TRANSFER' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                          Internal Transfer • Not Spending
                        </span>
                      ) : tx.financialType === 'INTEREST_INCOME' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          Interest Earned • Income
                        </span>
                      ) : tx.financialType === 'EXTERNAL_INCOME' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          External Inflow • Income
                        </span>
                      ) : tx.isRefund ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 bg-sky-50 dark:bg-sky-950/40 dark:text-sky-300 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800">
                          Refund Credit
                        </span>
                      ) : tx.isExpense ? (
                        <span className="text-[10px] text-slate-500 font-medium">
                          Living Expense
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">
                          {tx.transactionType}
                        </span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-4 text-right font-mono font-semibold whitespace-nowrap">
                      <span
                        className={
                          isCredit
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-900 dark:text-slate-100'
                        }
                      >
                        {isCredit ? '+' : '-'}
                        {formatCurrency(tx.amount, currency)}
                      </span>
                    </td>

                    {/* Running Balance */}
                    <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatCurrency(tx.balance, currency)}
                    </td>

                    {/* Confidence Score & Method */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {(tx.confidenceScore * 100).toFixed(0)}%
                        </span>
                        <span className={`text-[9px] uppercase tracking-wider font-semibold px-1 rounded ${
                          tx.classificationMethod === 'manual'
                            ? 'text-purple-600 bg-purple-50 dark:bg-purple-950/40'
                            : tx.classificationMethod === 'ai'
                            ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/40'
                            : tx.classificationMethod === 'rule_engine'
                            ? 'text-sky-600 bg-sky-50 dark:bg-sky-950/40'
                            : 'text-slate-500 bg-slate-50 dark:bg-slate-800'
                        }`}>
                          {tx.classificationMethod === 'deterministic'
                            ? 'Rule'
                            : tx.classificationMethod === 'rule_engine'
                            ? 'Memo'
                            : tx.classificationMethod === 'ai'
                            ? 'AI'
                            : tx.classificationMethod === 'manual'
                            ? 'Manual'
                            : 'Rule'}
                        </span>
                      </div>
                    </td>

                    {/* Inspect button */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => setSelectedTransaction(tx)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        title="Audit original statement record"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Raw Statement Transaction Inspector Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-6 shadow-xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Transaction Audit Record
                </h3>
              </div>
              <button
                onClick={() => setSelectedTransaction(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                  Original Raw Bank Statement Line
                </p>
                <p className="font-mono text-slate-800 dark:text-slate-200 break-words leading-relaxed">
                  {selectedTransaction.originalDescription}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400">Transaction Date</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {formatDate(selectedTransaction.date)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Direction & Amount</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">
                    {selectedTransaction.direction}: {formatCurrency(selectedTransaction.amount, currency)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Running Balance</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">
                    {formatCurrency(selectedTransaction.balance, currency)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Reference #</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">
                    {selectedTransaction.reference || 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Classification Method</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                      {selectedTransaction.classificationMethod.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {(selectedTransaction.confidenceScore * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Statement Source</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                    {selectedTransaction.source}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Account & Type</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {selectedTransaction.accountType || 'WALLET'} ({selectedTransaction.isInternal ? 'Internal' : 'External'})
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Financial Type</span>
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                    {selectedTransaction.financialType || selectedTransaction.transactionType}
                  </p>
                </div>
                {selectedTransaction.pairedTransactionId && (
                  <div>
                    <span className="text-slate-400">Paired Transaction</span>
                    <p className="font-mono text-xs text-purple-600 dark:text-purple-400 mt-0.5 truncate">
                      {selectedTransaction.pairedTransactionId}
                    </p>
                  </div>
                )}
                {selectedTransaction.fundingTransactionId && (
                  <div>
                    <span className="text-slate-400">Funding Transaction</span>
                    <p className="font-mono text-xs text-indigo-600 dark:text-indigo-400 mt-0.5 truncate">
                      {selectedTransaction.fundingTransactionId}
                    </p>
                  </div>
                )}
              </div>

              {selectedTransaction.classificationReason && (
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-[11px]">
                  <span className="font-semibold">Classification Reason: </span>
                  {selectedTransaction.classificationReason}
                </div>
              )}

              {/* Manual Category Override */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-slate-500 font-medium mb-1.5">
                  Change / Override Category:
                </label>
                <select
                  value={selectedTransaction.category}
                  onChange={(e) =>
                    handleCategoryChange(
                      selectedTransaction.id,
                      e.target.value as TransactionCategory
                    )
                  }
                  className="w-full text-xs py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {ALL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Manual adjustments are tracked with 100% confidence and remember this merchant for future statements.
                </p>
              </div>

              {selectedTransaction.notes && (
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-[11px]">
                  <span className="font-semibold">Accounting Note: </span>
                  {selectedTransaction.notes}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedTransaction(null)}
              >
                Close Audit Record
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
