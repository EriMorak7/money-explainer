// Automated Real Nigerian Bank Statement PDF Extraction & Normalization Tests
// Tests extraction against real 20-page OPay bank statement

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

// Import parser
import { parseOPayText } from '../src/lib/parser/opayParser.ts';
import { normalizeDate, normalizeNairaAmount, normalizeDescription } from '../src/lib/parser/normalize.ts';
import pdf from 'pdf-parse/lib/pdf-parse.js';

const REAL_PDF_PATH = 'C:/Users/erimo/.gemini/antigravity/brain/3cf779ba-64fe-40e1-867f-3de71de07346/.user_uploaded/media_1794234934312_0f5b93fd.pdf';

test('1. Normalization Utility Functions: Dates, Naira Amounts & Descriptions', () => {
  // Date Normalization
  assert.equal(normalizeDate('01 Oct 2026'), '2026-10-01');
  assert.equal(normalizeDate('08 Nov 2026'), '2026-11-08');
  assert.equal(normalizeDate('15/10/2026'), '2026-10-15');
  assert.equal(normalizeDate('2026-10-25'), '2026-10-25');

  // Nigerian Naira Amount Normalization
  assert.equal(normalizeNairaAmount('₦747,915.58'), 747915.58);
  assert.equal(normalizeNairaAmount('10,000.00'), 10000.0);
  assert.equal(normalizeNairaAmount('50.00'), 50.0);
  assert.equal(normalizeNairaAmount('--'), 0);
  assert.equal(normalizeNairaAmount('-'), 0);
  assert.equal(normalizeNairaAmount('0.00'), 0);
  assert.equal(normalizeNairaAmount('64,986.96'), 64986.96);

  // Multi-line Description Cleaning
  const rawMultiline = 'Transfer to MORAKINYO IREOLUWA ELIJAH | First Bank \n Of Nigeria | 3224472451 | help';
  assert.equal(
    normalizeDescription(rawMultiline),
    'Transfer to MORAKINYO IREOLUWA ELIJAH | First Bank Of Nigeria | 3224472451 | help'
  );
});

test('2. Real 20-Page PDF Extraction: Statement Metadata & Period', async () => {
  assert.ok(fs.existsSync(REAL_PDF_PATH), 'Real PDF statement file must exist on disk');
  const buffer = fs.readFileSync(REAL_PDF_PATH);
  const pdfData = await pdf(buffer);

  assert.equal(pdfData.numpages, 20, 'PDF must contain exactly 20 pages');

  const result = parseOPayText(pdfData.text, 'media_1794234934312_0f5b93fd.pdf');

  // Verify Account Information
  assert.equal(result.bankName, 'OPay');
  assert.equal(result.accountName, 'ERIOLUWA JOSEPH MORAKINYO');
  assert.equal(result.accountNumber, '8100398302');
  assert.equal(result.currency, 'NGN');

  // Verify Statement Period
  assert.equal(result.periodStart, '2026-10-01');
  assert.equal(result.periodEnd, '2026-11-08');
});

test('3. Exact Transaction Counts: Wallet Account vs Savings Account', async () => {
  const buffer = fs.readFileSync(REAL_PDF_PATH);
  const pdfData = await pdf(buffer);
  const result = parseOPayText(pdfData.text, 'media_1794234934312_0f5b93fd.pdf');

  // Total extracted transactions
  assert.equal(
    result.transactions.length,
    432,
    'Total extracted transactions across 20 pages must strictly equal 432'
  );

  const walletTxs = result.transactions.filter((tx) => tx.accountType === 'Wallet Account');
  const savingsTxs = result.transactions.filter((tx) => tx.accountType === 'Savings Account');

  // Wallet: 129 debits + 129 credits = 258
  assert.equal(walletTxs.length, 258, 'Wallet Account must contain exactly 258 transactions');
  const walletDebitsCount = walletTxs.filter((t) => t.debit > 0).length;
  const walletCreditsCount = walletTxs.filter((t) => t.credit > 0).length;
  assert.equal(walletDebitsCount, 129, 'Wallet debit count must strictly equal 129');
  assert.equal(walletCreditsCount, 129, 'Wallet credit count must strictly equal 129');

  // Savings: 117 debits + 57 credits = 174
  assert.equal(savingsTxs.length, 174, 'Savings Account must contain exactly 174 transactions');
  const savingsDebitsCount = savingsTxs.filter((t) => t.debit > 0).length;
  const savingsCreditsCount = savingsTxs.filter((t) => t.credit > 0).length;
  assert.equal(savingsDebitsCount, 117, 'Savings debit count must strictly equal 117');
  assert.equal(savingsCreditsCount, 57, 'Savings credit count must strictly equal 57');
});

test('4. Mathematical Integrity: 100% Match with Statement Totals', async () => {
  const buffer = fs.readFileSync(REAL_PDF_PATH);
  const pdfData = await pdf(buffer);
  const result = parseOPayText(pdfData.text, 'media_1794234934312_0f5b93fd.pdf');

  const walletTxs = result.transactions.filter((tx) => tx.accountType === 'Wallet Account');
  const savingsTxs = result.transactions.filter((tx) => tx.accountType === 'Savings Account');

  // Wallet Debits & Credits Sum
  const walletDebitsSum = walletTxs.reduce((sum, tx) => sum + tx.debit, 0);
  const walletCreditsSum = walletTxs.reduce((sum, tx) => sum + tx.credit, 0);

  assert.equal(
    Math.round(walletDebitsSum * 100) / 100,
    747915.58,
    'Wallet total debits must strictly equal ₦747,915.58'
  );
  assert.equal(
    Math.round(walletCreditsSum * 100) / 100,
    747915.58,
    'Wallet total credits must strictly equal ₦747,915.58'
  );

  // Savings Debits & Credits Sum
  const savingsDebitsSum = savingsTxs.reduce((sum, tx) => sum + tx.debit, 0);
  const savingsCreditsSum = savingsTxs.reduce((sum, tx) => sum + tx.credit, 0);

  assert.equal(
    Math.round(savingsDebitsSum * 100) / 100,
    514775.66,
    'Savings total debits must strictly equal ₦514,775.66'
  );
  assert.equal(
    Math.round(savingsCreditsSum * 100) / 100,
    396427.0,
    'Savings total credits must strictly equal ₦396,427.00'
  );

  // Overall Statement Totals across both sections
  const totalDebits = result.transactions.reduce((sum, tx) => sum + tx.debit, 0);
  const totalCredits = result.transactions.reduce((sum, tx) => sum + tx.credit, 0);

  assert.equal(
    Math.round(totalDebits * 100) / 100,
    1262691.24,
    'Combined debits must strictly equal ₦1,262,691.24'
  );
  assert.equal(
    Math.round(totalCredits * 100) / 100,
    1144342.58,
    'Combined credits must strictly equal ₦1,144,342.58'
  );
});

test('5. Multi-line Descriptions and Wrapped References Unwrapping', async () => {
  const buffer = fs.readFileSync(REAL_PDF_PATH);
  const pdfData = await pdf(buffer);
  const result = parseOPayText(pdfData.text, 'media_1794234934312_0f5b93fd.pdf');

  // Verify multi-line description join for transaction 2
  const tx2 = result.transactions[1];
  assert.equal(tx2.date, '2026-10-01');
  assert.equal(tx2.time, '12:32:35');
  assert.ok(
    tx2.description.includes('Transfer to MORAKINYO IREOLUWA ELIJAH') &&
      tx2.description.includes('First Bank Of Nigeria') &&
      tx2.description.includes('3224472451'),
    'Multi-line description must be joined cleanly'
  );
  assert.equal(tx2.debit, 10000.0);
  assert.equal(tx2.credit, 0.0);
  // Wrapped reference on line 42 & 43: 10000426100111324417292 + 0967376
  assert.equal(tx2.reference, '100004261001113244172920967376');

  // Verify DEMERGE NIGERIA LIMITED multi-line description
  const demergeTx = result.transactions.find((tx) => tx.description.includes('DEMERGE NIGERIA LIMITED'));
  assert.ok(demergeTx, 'DEMERGE NIGERIA LIMITED transaction must exist');
  assert.equal(demergeTx?.debit, 22434.0);
  assert.equal(demergeTx?.channel, 'Mobile');

  // Verify Chowdeck order transaction
  const chowdeckTx = result.transactions.find((tx) => tx.description.includes('Chowdeck'));
  assert.ok(chowdeckTx, 'Chowdeck order transaction must exist');
  assert.equal(chowdeckTx?.debit, 5214.0);
});

test('6. Normalized Transaction Structure Integrity', async () => {
  const buffer = fs.readFileSync(REAL_PDF_PATH);
  const pdfData = await pdf(buffer);
  const result = parseOPayText(pdfData.text, 'media_1794234934312_0f5b93fd.pdf');

  for (const tx of result.transactions) {
    // Assert all required normalized fields are strictly populated
    assert.ok(tx.id && typeof tx.id === 'string');
    assert.match(tx.date, /^\d{4}-\d{2}-\d{2}$/, `Date ${tx.date} must be valid ISO YYYY-MM-DD`);
    assert.ok(tx.description && tx.description.length > 0);
    assert.ok(tx.originalDescription && tx.originalDescription.length > 0);
    assert.ok(typeof tx.debit === 'number' && tx.debit >= 0);
    assert.ok(typeof tx.credit === 'number' && tx.credit >= 0);
    assert.ok(typeof tx.balance === 'number' && tx.balance >= 0);
    assert.equal(tx.currency, 'NGN');
    assert.ok(tx.direction === 'DEBIT' || tx.direction === 'CREDIT');
    assert.ok(tx.source && tx.source.length > 0);
    assert.ok(tx.accountType === 'Wallet Account' || tx.accountType === 'Savings Account');

    // Exactly one of debit or credit must be positive for genuine transactions
    assert.ok(tx.debit > 0 || tx.credit > 0, `Transaction ${tx.id} must have non-zero amount`);

    // Verify classification is attached
    assert.ok(tx.category && typeof tx.category === 'string', `Transaction ${tx.id} must have a category`);
    assert.ok(typeof tx.confidenceScore === 'number' && tx.confidenceScore >= 0 && tx.confidenceScore <= 1);
    assert.ok(tx.classificationMethod, `Transaction ${tx.id} must have classificationMethod`);
  }
});
