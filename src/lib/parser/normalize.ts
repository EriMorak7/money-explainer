import type { Currency } from '../../types/index.ts';
import type { NormalizedTransactionData, RawExtractedTransaction } from './types.ts';

// Month lookup for 3-letter month parsing
const MONTH_MAP: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

/**
 * Normalizes date strings like "01 Oct 2026" or "01-10-2026" or "2026/10/01" to ISO "YYYY-MM-DD"
 */
export function normalizeDate(dateStr: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();

  // Pattern: "01 Oct 2026" or "1 Oct 2026"
  const textMonthMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/i);
  if (textMonthMatch) {
    const day = textMonthMatch[1].padStart(2, '0');
    const month = MONTH_MAP[textMonthMatch[2].toLowerCase()] || '01';
    const year = textMonthMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Pattern: "DD/MM/YYYY" or "DD-MM-YYYY"
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Pattern: "YYYY-MM-DD"
  const isoMatch = trimmed.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  return trimmed;
}

/**
 * Cleans Nigerian Naira formatted amounts: "₦747,915.58", "10,000.00", "--", "0.00" -> number
 */
export function normalizeNairaAmount(val: string | number | undefined | null): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return Math.abs(val);

  const str = val.trim();
  if (str === '--' || str === '-' || str === '' || str === '0') return 0;

  // Strip currency symbols (₦, NGN, $, etc.), spaces, and commas
  const cleaned = str.replace(/[₦$£€\s,]/g, '').replace(/^-/, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
}

/**
 * Cleans multi-line transaction description text:
 * Unwraps lines, removes control characters, and collapses whitespace.
 */
export function normalizeDescription(desc: string): string {
  if (!desc) return '';
  return desc
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Transforms a raw extracted transaction into the standard normalized transaction structure.
 */
export function normalizeTransaction(
  raw: RawExtractedTransaction,
  index: number,
  sourceFileName: string,
  currency: Currency = 'NGN'
): NormalizedTransactionData {
  const debit = normalizeNairaAmount(raw.debitRaw);
  const credit = normalizeNairaAmount(raw.creditRaw);
  const balance = normalizeNairaAmount(raw.balanceRaw);

  const direction = credit > 0 && debit === 0 ? 'CREDIT' : 'DEBIT';
  const amount = direction === 'CREDIT' ? credit : debit;

  const normalizedDate = normalizeDate(raw.dateRaw);
  const normalizedValueDate = raw.valueDateRaw ? normalizeDate(raw.valueDateRaw) : normalizedDate;
  const cleanedDesc = normalizeDescription(raw.descriptionRaw);

  // Generate deterministic ID from date, amounts, and reference/index
  const refPart = raw.referenceRaw ? raw.referenceRaw.slice(-6) : String(index).padStart(4, '0');
  const id = `tx_${normalizedDate.replace(/-/g, '')}_${refPart}_${index}`;

  return {
    id,
    date: normalizedDate,
    time: raw.timeRaw?.trim(),
    valueDate: normalizedValueDate,
    description: cleanedDesc,
    originalDescription: raw.descriptionRaw.trim(),
    debit,
    credit,
    amount,
    direction,
    balance,
    currency,
    reference: raw.referenceRaw ? raw.referenceRaw.trim() : undefined,
    channel: raw.channelRaw ? raw.channelRaw.trim() : undefined,
    accountType: raw.accountType || 'Standard Account',
    source: sourceFileName,
  };
}
