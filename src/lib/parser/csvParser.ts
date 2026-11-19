import type { Transaction } from '../../types/index.ts';
import type { ExtractedAccountSummary, NormalizedTransactionData, ParseResult, RawExtractedTransaction } from './types.ts';
import { normalizeDate, normalizeDescription, normalizeNairaAmount } from './normalize.ts';
import { classifyTransaction } from '../classification/classifier.ts';
import { auditFinancialCalculations } from '../calculations/financialEngine.ts';

/**
 * Parses CSV bank statements across major Nigerian and international layouts.
 */
export function parseCsvStatement(csvContent: string, fileName: string): ParseResult {
  // Strip BOM if present
  const content = csvContent.replace(/^\uFEFF/, '');
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  if (lines.length < 2) {
    throw new Error(`The uploaded CSV file "${fileName}" does not contain sufficient transaction rows.`);
  }

  // Detect bank name and metadata from header comments/rows
  let detectedBank = 'Nigerian Bank';
  let accountName = 'Verified Account Holder';
  let accountNumber = '';

  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const rawLine = lines[i].replace(/"/g, '');
    const accNameMatch = rawLine.match(/account\s*name\s*[:\-]\s*(.+)/i);
    if (accNameMatch) accountName = accNameMatch[1].trim();
    const accNumMatch = rawLine.match(/account\s*(?:number|no)?\s*[:\-]\s*([0-9*]{6,})/i);
    if (accNumMatch) accountNumber = accNumMatch[1].trim();
  }

  const first20Lines = lines.slice(0, 20).join(' ').toLowerCase();

  if (first20Lines.includes('gtbank') || first20Lines.includes('guaranty trust')) detectedBank = 'GTBank';
  else if (first20Lines.includes('access bank') || first20Lines.includes('access')) detectedBank = 'Access Bank';
  else if (first20Lines.includes('zenith')) detectedBank = 'Zenith Bank';
  else if (first20Lines.includes('opay')) detectedBank = 'OPay';
  else if (first20Lines.includes('kuda')) detectedBank = 'Kuda Bank';
  else if (first20Lines.includes('firstbank') || first20Lines.includes('first bank')) detectedBank = 'FirstBank';
  else if (first20Lines.includes('moniepoint')) detectedBank = 'Moniepoint';
  else if (first20Lines.includes('stanbic')) detectedBank = 'Stanbic IBTC';

  // Helper to split CSV row taking quotes into account
  function parseCsvRow(row: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  }

  // Find header index: looks for row containing date and description/narration
  let headerIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(lines.length, 25); i++) {
    const cols = parseCsvRow(lines[i]).map((c) => c.toLowerCase());
    const hasDate = cols.some((c) => c.includes('date'));
    const hasDesc = cols.some((c) => c.includes('desc') || c.includes('narrat') || c.includes('remark') || c.includes('detail'));
    const hasAmount = cols.some((c) => c.includes('debit') || c.includes('credit') || c.includes('amount') || c.includes('withdrawal'));

    if (hasDate && (hasDesc || hasAmount)) {
      headerIndex = i;
      headers = cols;
      break;
    }
  }

  if (headerIndex === -1) {
    throw new Error(
      `Could not detect a valid tabular header in CSV file "${fileName}". Expected columns such as Date, Description, Debit, Credit, and Balance.`
    );
  }

  // Map column indexes
  const dateCol = headers.findIndex((c) => c.includes('date'));
  const descCol = headers.findIndex((c) => c.includes('desc') || c.includes('narrat') || c.includes('remark') || c.includes('particular') || c.includes('detail'));
  const debitCol = headers.findIndex((c) => c.includes('debit') || c.includes('withdrawal') || c.includes('paid out') || c.includes('outflow'));
  const creditCol = headers.findIndex((c) => c.includes('credit') || c.includes('deposit') || c.includes('paid in') || c.includes('inflow'));
  const amountCol = headers.findIndex((c) => c === 'amount');
  const typeCol = headers.findIndex((c) => c === 'type' || c.includes('trans type'));
  const balanceCol = headers.findIndex((c) => c.includes('balance') || c.includes('running'));
  const refCol = headers.findIndex((c) => c.includes('ref') || c.includes('id') || c.includes('trans no'));

  const rawTransactions: RawExtractedTransaction[] = [];
  const dates: string[] = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const row = parseCsvRow(lines[i]);
    if (row.length <= 1 || !row[dateCol]) continue;

    const rawDate = row[dateCol];
    const rawDesc = descCol !== -1 ? row[descCol] : 'Transaction';
    let rawDebit = '--';
    let rawCredit = '--';

    if (debitCol !== -1 && creditCol !== -1) {
      rawDebit = row[debitCol] || '--';
      rawCredit = row[creditCol] || '--';
    } else if (amountCol !== -1) {
      const amtVal = parseFloat(row[amountCol].replace(/[^0-9.-]/g, ''));
      const isDebit = typeCol !== -1 ? /debit|dr|out/i.test(row[typeCol]) : amtVal < 0;
      if (isDebit) rawDebit = Math.abs(amtVal).toString();
      else rawCredit = Math.abs(amtVal).toString();
    }

    const rawBalance = balanceCol !== -1 ? row[balanceCol] || '--' : '--';
    const rawRef = refCol !== -1 ? row[refCol] || '' : '';

    rawTransactions.push({
      dateRaw: rawDate,
      timeRaw: '12:00:00',
      valueDateRaw: rawDate,
      descriptionRaw: rawDesc,
      debitRaw: rawDebit,
      creditRaw: rawCredit,
      balanceRaw: rawBalance,
      channelRaw: 'Online',
      referenceRaw: rawRef,
      accountType: 'Current/Savings Account',
    });
  }

  if (rawTransactions.length === 0) {
    throw new Error(`No valid transactions could be parsed from "${fileName}".`);
  }

  // Normalize all transactions
  const normalizedTransactions: NormalizedTransactionData[] = rawTransactions.map((raw, idx) => {
    const normalizedDate = normalizeDate(raw.dateRaw);
    dates.push(normalizedDate);
    const normalizedDesc = normalizeDescription(raw.descriptionRaw);
    const debit = normalizeNairaAmount(raw.debitRaw);
    const credit = normalizeNairaAmount(raw.creditRaw);
    const balance = normalizeNairaAmount(raw.balanceRaw);
    const direction = debit > 0 ? 'DEBIT' : 'CREDIT';
    const amount = debit > 0 ? debit : credit;

    const classification = classifyTransaction(
      normalizedDesc,
      debit,
      credit,
      raw.referenceRaw,
      accountName
    );

    return {
      id: `tx_csv_${idx + 1}_${Math.random().toString(36).slice(2, 6)}`,
      date: normalizedDate,
      time: raw.timeRaw,
      valueDate: normalizedDate,
      description: normalizedDesc,
      originalDescription: raw.descriptionRaw,
      merchant: classification.merchant,
      debit,
      credit,
      amount,
      direction,
      balance,
      currency: 'NGN',
      channel: raw.channelRaw,
      reference: raw.referenceRaw,
      accountType: raw.accountType || 'Current/Savings Account',
      category: classification.category,
      categoryGroup: classification.categoryGroup,
      confidenceScore: classification.confidence,
      classificationMethod: classification.method,
      transactionType: classification.transactionType,
      isInternalTransfer: classification.isInternalTransfer,
      isRefund: classification.isRefund,
      isRecurring: classification.isRecurring,
      isIncome: classification.isIncome,
      isExpense: classification.isExpense,
      isSavings: classification.isSavings,
      notes: classification.notes,
      source: fileName,
    };
  });

  dates.sort();
  const periodStart = dates[0] || '2026-01-01';
  const periodEnd = dates[dates.length - 1] || '2026-12-31';

  const totalDebit = normalizedTransactions.reduce((sum, tx) => sum + tx.debit, 0);
  const totalCredit = normalizedTransactions.reduce((sum, tx) => sum + tx.credit, 0);

  const openingBalance = normalizedTransactions[0]?.balance || 0;
  const closingBalance = normalizedTransactions[normalizedTransactions.length - 1]?.balance || 0;

  const auditReport = auditFinancialCalculations(
    normalizedTransactions as unknown as Transaction[],
    openingBalance,
    closingBalance,
    'NGN'
  );

  const accounts: ExtractedAccountSummary[] = [
    {
      accountName,
      accountNumber,
      bankName: detectedBank,
      accountType: 'Bank Account',
      address: '',
      periodStart,
      periodEnd,
      openingBalance,
      closingBalance,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      debitCount: normalizedTransactions.filter((t) => t.debit > 0).length,
      creditCount: normalizedTransactions.filter((t) => t.credit > 0).length,
    },
  ];

  return {
    bankName: detectedBank,
    accountName,
    accountNumber,
    periodStart,
    periodEnd,
    currency: 'NGN',
    accounts,
    transactions: normalizedTransactions,
    auditReport,
    metadata: {
      pageCount: 1,
      rawTransactionCount: rawTransactions.length,
      normalizedTransactionCount: normalizedTransactions.length,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      extractionConfidence: 0.98,
    },
  };
}
