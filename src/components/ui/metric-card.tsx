import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  accentColor?: 'emerald' | 'rose' | 'amber' | 'blue' | 'purple' | 'slate';
  badge?: string;
  className?: string;
  onClick?: () => void;
}

export function MetricCard({
  title,
  value,
  subtitle,
  change,
  trend,
  icon,
  accentColor = 'slate',
  badge,
  className,
  onClick,
}: MetricCardProps) {
  const accentStyles = {
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900',
    rose: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900',
    blue: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/30 border-sky-100 dark:border-sky-900',
    purple: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 border-purple-100 dark:border-purple-900',
    slate: 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-800',
  };

  return (
    <Card
      onClick={onClick}
      className={cn(
        'overflow-hidden hover:border-slate-300 dark:hover:border-slate-700 transition-all',
        onClick && 'cursor-pointer hover:shadow-xs',
        className
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <div className="flex items-center gap-1.5">
            {badge && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                {badge}
              </span>
            )}
            {icon && (
              <div className={cn('p-2 rounded-lg border', accentStyles[accentColor])}>
                {icon}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {value}
          </h2>
          {(subtitle || change) && (
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              {change && (
                <span
                  className={cn(
                    'font-medium',
                    trend === 'up' && 'text-emerald-600 dark:text-emerald-400',
                    trend === 'down' && 'text-rose-600 dark:text-rose-400',
                    trend === 'neutral' && 'text-slate-500'
                  )}
                >
                  {change}
                </span>
              )}
              {subtitle && <span>{subtitle}</span>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
