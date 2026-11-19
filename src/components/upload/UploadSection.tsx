'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  UploadCloud, 
  FileText, 
  Sparkles,
  Lock,
  FileSpreadsheet,
  AlertCircle,
  X,
} from 'lucide-react';
import type { ParsedUploadResponse } from '@/app/page';

interface UploadSectionProps {
  onUploadSuccess?: (file: File) => void;
  onCustomUploadSuccess?: (data: ParsedUploadResponse) => void;
}

export function UploadSection({ onUploadSuccess: _onUploadSuccess, onCustomUploadSuccess }: UploadSectionProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<'idle' | 'processing' | 'ready'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setUploadState('processing');
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (json.success && json.data) {
        if (onCustomUploadSuccess) {
          onCustomUploadSuccess(json.data);
        }
      } else {
        setUploadError(json.error || 'Failed to parse statement.');
      }
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Unknown upload error';
      setUploadError('Upload failed: ' + msg);
    } finally {
      setUploadState('idle');
    }
  };

  const supportedBanks = [
    'Zenith Bank',
    'GTBank (Guaranty Trust)',
    'Access Bank',
    'Kuda Bank',
    'OPay',
    'Moniepoint',
    'First Bank of Nigeria',
    'United Bank for Africa (UBA)',
    'Stanbic IBTC',
    'Sterling Bank',
    'Fidelity Bank',
    'Wema Bank / ALAT',
    'Generic CSV/Excel',
  ];

  const pipelineSteps = [
    { number: 1, title: 'Upload & Parse', desc: 'PDF, CSV, or Excel ingestion' },
    { number: 2, title: 'Transaction Extraction', desc: 'Multi-page date, debit, credit & balance' },
    { number: 3, title: 'Normalization', desc: 'Clean merchant, reference & clean descriptions' },
    { number: 4, title: 'Intelligent Classification', desc: 'Deterministic + AI confidence scoring' },
    { number: 5, title: 'Transfers & Refund Isolation', desc: 'Prevent double-counting' },
    { number: 6, title: 'Executive Analytics', desc: 'True savings rate, cash flow & health score' },
  ];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileSelected(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setUploadState('ready');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Hero Headline */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Intelligent Bank Statement Engine</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
          Understand where your money really goes.
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base leading-relaxed">
          Upload your bank statement and get an audit-grade financial breakdown that isolates internal transfers, tracks genuine savings, and computes accurate cash flow.
        </p>
      </div>

      {/* Upload Error Alert */}
      {uploadError && (
        <div className="max-w-3xl mx-auto p-4 rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 flex items-start justify-between gap-3 text-rose-800 dark:text-rose-200 text-xs animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-900 dark:text-rose-100">Upload / Extraction Notice</p>
              <p className="mt-0.5 text-rose-700 dark:text-rose-300">{uploadError}</p>
            </div>
          </div>
          <button
            onClick={() => setUploadError(null)}
            className="text-rose-500 hover:text-rose-800 dark:hover:text-rose-100 p-1"
            title="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Upload Dropzone */}
      <Card className="max-w-3xl mx-auto border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 transition-all hover:border-emerald-500/70 dark:hover:border-emerald-500/70 shadow-sm">
        <CardContent className="p-8 sm:p-12">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center text-center cursor-pointer p-6 rounded-xl transition-all ${
              isDragging ? 'bg-emerald-50/50 dark:bg-emerald-950/20 scale-[0.99]' : ''
            }`}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 mb-4 shadow-sm">
              <UploadCloud className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Drag & Drop your bank statement here
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Supports e-statements in PDF, CSV, XLSX, or XLS format (Up to 25MB)
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <label htmlFor="file-upload">
                <input
                  id="file-upload"
                  type="file"
                  accept=".pdf,.csv,.xlsx,.xls"
                  className="sr-only"
                  onChange={handleFileInputChange}
                />
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  className="gap-2 pointer-events-none"
                >
                  <FileText className="w-4 h-4" />
                  Select File from Computer
                </Button>
              </label>
            </div>

            {selectedFile && (
              <div className="mt-6 w-full max-w-md p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-left">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div className="truncate">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Ready for extraction
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={uploadState === 'processing'}
                  onClick={handleAnalyze}
                >
                  {uploadState === 'processing' ? 'Extracting & Auditing...' : 'Analyze'}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Architecture Steps */}
      <div className="max-w-4xl mx-auto pt-4">
        <div className="text-center mb-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            How MoneyLens Analyzes Your Money
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Phase 1 Foundation • Deterministic pipeline prevents false positives and double-counting
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pipelineSteps.map((step) => (
            <div
              key={step.number}
              className="p-3.5 rounded-xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 flex items-start gap-3 shadow-xs"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                {step.number}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {step.title}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Supported Financial Institutions */}
      <div className="max-w-4xl mx-auto pt-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 text-center mb-3">
          Supported Statement Formats & Banks
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {supportedBanks.map((bank) => (
            <span
              key={bank}
              className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 text-xs font-medium"
            >
              {bank}
            </span>
          ))}
        </div>
      </div>

      {/* Privacy and Security Guarantee */}
      <div className="max-w-3xl mx-auto rounded-xl border border-emerald-200/60 bg-emerald-50/40 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Bank-Grade Privacy & Local Processing
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              MoneyLens analyzes bank statements without storing internet banking credentials, BVNs, or card CVVs. Financial calculations are computed deterministically in your private workspace.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
