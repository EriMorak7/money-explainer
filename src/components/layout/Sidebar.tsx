'use client';

import React from 'react';
import { 
  LayoutDashboard, 
  UploadCloud, 
  Receipt, 
  PieChart, 
  PiggyBank, 
  CreditCard, 
  Target, 
  Sparkles, 
  MessageSquare, 
  Settings,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type NavTab = 
  | 'dashboard'
  | 'upload'
  | 'transactions'
  | 'analytics'
  | 'savings'
  | 'subscriptions'
  | 'budget'
  | 'insights'
  | 'chat'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  className?: string;
  transactionCount?: number;
}

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  isUpcoming?: boolean;
}

export function Sidebar({ activeTab, onTabChange, className, transactionCount }: SidebarProps) {
  const mainNavItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Overview',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'upload',
      label: 'Upload Statement',
      icon: <UploadCloud className="w-4 h-4" />,
    },
    {
      id: 'transactions',
      label: 'Transactions',
      icon: <Receipt className="w-4 h-4" />,
      badge: transactionCount !== undefined ? String(transactionCount) : undefined,
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: <PieChart className="w-4 h-4" />,
      badge: 'Live',
    },
    {
      id: 'savings',
      label: 'Savings Tracker',
      icon: <PiggyBank className="w-4 h-4" />,
      badge: 'Live',
    },
    {
      id: 'subscriptions',
      label: 'Subscriptions',
      icon: <CreditCard className="w-4 h-4" />,
      badge: 'Live',
    },
    {
      id: 'budget',
      label: 'Smart Budget',
      icon: <Target className="w-4 h-4" />,
      badge: 'Live',
    },
    {
      id: 'insights',
      label: 'AI Insights',
      icon: <Sparkles className="w-4 h-4" />,
      badge: 'Live',
    },
    {
      id: 'chat',
      label: 'Financial Chat',
      icon: <MessageSquare className="w-4 h-4" />,
      badge: 'Live',
    },
  ];

  return (
    <aside
      className={cn(
        'flex flex-col justify-between border-r border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-950 p-4 w-64 shrink-0',
        className
      )}
    >
      <div>
        {/* Brand Logo */}
        <div className="flex items-center gap-2.5 px-3 py-2 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-500/20">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-slate-900 dark:text-slate-50">
                MoneyLens
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                v1.0
              </span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              AI Financial Analyst
            </span>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="space-y-1">
          <p className="px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-2">
            Workspace
          </p>
          {mainNavItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer',
                  isActive
                    ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-xs border border-slate-200/60 dark:border-slate-700/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50'
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={cn(
                      'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                      isActive
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : item.isUpcoming
                        ? 'bg-slate-200/60 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Privacy & Health Section */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Strict Privacy Active</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Bank statements are processed in your isolated private workspace. No credentials stored.
          </p>
        </div>

        <button
          onClick={() => onTabChange('settings')}
          className={cn(
            'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 cursor-pointer',
            activeTab === 'settings' && 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs border border-slate-200/60 dark:border-slate-700/60'
          )}
        >
          <div className="flex items-center gap-3">
            <Settings className="w-4 h-4 text-slate-400" />
            <span>Settings</span>
          </div>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Live
          </span>
        </button>
      </div>
    </aside>
  );
}
