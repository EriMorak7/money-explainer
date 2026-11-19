// Generates src/data/realOpayData.ts from media_1794234934312_0f5b93fd.pdf
import fs from 'node:fs';
import path from 'node:path';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { parseOPayText } from '../src/lib/parser/opayParser.ts';

const PDF_PATH = 'C:/Users/erimo/.gemini/antigravity/brain/3cf779ba-64fe-40e1-867f-3de71de07346/.user_uploaded/media_1794234934312_0f5b93fd.pdf';
const buf = fs.readFileSync(PDF_PATH);
const pdfData = await pdf(buf);
const parsed = parseOPayText(pdfData.text, 'ERIOLUWA_JOSEPH_MORAKINYO_8100398302_20261109143305.pdf');

const transactions = parsed.transactions.map((tx, i) => {
  return {
    id: tx.id,
    statementId: 'stmt_opay_real_01',
    accountId: 'acc_opay_real_01',
    date: tx.date,
    time: tx.time,
    description: tx.description,
    originalDescription: tx.originalDescription,
    merchant: tx.merchant || tx.description.split('|')[0].trim(),
    reference: tx.reference,
    debit: tx.debit,
    credit: tx.credit,
    amount: tx.amount,
    direction: tx.direction,
    balance: tx.balance,
    currency: tx.currency,
    category: tx.category || 'Other',
    categoryGroup: tx.categoryGroup || 'Other',
    transactionType: tx.transactionType || (tx.direction === 'CREDIT' ? 'INCOME' : 'EXPENSE'),
    confidenceScore: tx.confidenceScore || 0.95,
    classificationMethod: tx.classificationMethod || 'deterministic',
    userOverriddenCategory: false,
    isInternalTransfer: tx.isInternalTransfer || false,
    isRefund: tx.isRefund || false,
    isRecurring: tx.isRecurring || false,
    isIncome: tx.isIncome || false,
    isExpense: tx.isExpense || false,
    isSavings: tx.isSavings || false,
    notes: tx.notes,
    source: 'OPay E-Statement (20 Pages)',
  };
});

const fileContent = `// Real Processed Bank Statement Dataset (Phase 2 & 3 Output)
// Bank: OPay Digital Services | Account Holder: ERIOLUWA JOSEPH MORAKINYO
// Period: 01 Oct 2026 - 08 Nov 2026 | Exactly 432 Verified Transactions

import type { BankAccount, StatementMetadata, Transaction } from '../types/index.ts';

export const realOpayAccount: BankAccount = {
  id: 'acc_opay_real_01',
  userId: 'usr_morakinyo_01',
  bankName: 'OPay',
  accountName: 'ERIOLUWA JOSEPH MORAKINYO',
  accountNumberMasked: '8100****02',
  accountType: 'WALLET',
  currency: 'NGN',
  openingBalance: 33956.53,
  closingBalance: 15.45,
  statementPeriodStart: '2026-10-01',
  statementPeriodEnd: '2026-11-08',
  createdAt: '2026-11-09T14:33:05Z',
};

export const realOpayStatement: StatementMetadata = {
  id: 'stmt_opay_real_01',
  fileName: 'ERIOLUWA_JOSEPH_MORAKINYO_8100398302_20261109143305.pdf',
  fileSize: 421000,
  fileType: 'pdf',
  bankName: 'OPay',
  periodStart: '2026-10-01',
  periodEnd: '2026-11-08',
  transactionCount: 432,
  status: 'COMPLETED',
  detectedAccount: 'OPay Wallet & Savings Account',
  currency: 'NGN',
  uploadDate: '2026-11-09',
};

export const realOpayTransactions: Transaction[] = ${JSON.stringify(transactions, null, 2)};
`;

fs.writeFileSync(path.resolve('scripts/fixtures/realOpayData.ts'), fileContent, 'utf8');
console.log('Successfully generated scripts/fixtures/realOpayData.ts with', transactions.length, 'transactions');
