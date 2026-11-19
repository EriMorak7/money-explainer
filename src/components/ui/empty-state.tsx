'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UploadCloud } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'purple' | 'info' | 'neutral';
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  badge = 'No Active Statement',
  badgeVariant = 'neutral',
  title,
  description,
  actionLabel = 'Upload Bank Statement',
  onAction,
}: EmptyStateProps) {
  return (
    <div className="max-w-2xl mx-auto py-12 animate-in fade-in duration-300">
      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm text-center p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 mb-4 border border-emerald-200 dark:border-emerald-800">
          {icon || <UploadCloud className="w-7 h-7" />}
        </div>
        {badge && (
          <Badge variant={badgeVariant} size="md" className="mx-auto mb-2">
            {badge}
          </Badge>
        )}
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-lg mx-auto">
          {description}
        </p>
        {onAction && (
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={onAction}
              className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              {actionLabel}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
