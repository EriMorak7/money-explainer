import type { Transaction } from '../../types/index.ts';
import { round2 } from '../calculations/financialEngine.ts';

export interface CsvExportOptions {
  maskSensitive?: boolean;
}

/**
 * Escapes a cell value according to RFC 4180 rules.
 */
function escapeCsvCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Optionally masks 10-digit NUBAN account numbers in text descriptions.
 */
function maskSensitiveInText(text: string): string {
  if (!text) return '';
  return text.replace(/\b(\d{2})\d{6}(\d{2})\b/g, '$1******$2');
}

/**
 * Generates RFC 4180 compliant CSV string containing the exact required columns:
 * Date, Description, Merchant, Category, Debit, Credit, Balance, Transaction Type, Confidence
 */
export function exportTransactionsToCsv(
  transactions: Transaction[],
  options: CsvExportOptions = {}
): string {
  const headers = [
    'Date',
    'Description',
    'Merchant',
    'Category',
    'Debit',
    'Credit',
    'Balance',
    'Transaction Type',
    'Confidence',
  ];

  const rows: string[] = [headers.join(',')];

  for (const tx of transactions) {
    const desc = options.maskSensitive ? maskSensitiveInText(tx.description) : tx.description;
    const merchant = tx.merchant || tx.description.split('|')[0].trim();
    const debit = tx.debit > 0 ? round2(tx.debit).toFixed(2) : '0.00';
    const credit = tx.credit > 0 ? round2(tx.credit).toFixed(2) : '0.00';
    const balance = round2(tx.balance).toFixed(2);
    const confidence = `${Math.round((tx.confidenceScore ?? 1.0) * 100)}%`;

    const row = [
      escapeCsvCell(tx.date),
      escapeCsvCell(desc),
      escapeCsvCell(merchant),
      escapeCsvCell(tx.category),
      escapeCsvCell(debit),
      escapeCsvCell(credit),
      escapeCsvCell(balance),
      escapeCsvCell(tx.transactionType),
      escapeCsvCell(confidence),
    ];

    rows.push(row.join(','));
  }

  return rows.join('\r\n');
}

/**
 * Triggers a client-side browser download for a CSV string.
 */
export function downloadCsvBlob(csvContent: string, fileName: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName.endsWith('.csv') ? fileName : `${fileName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
