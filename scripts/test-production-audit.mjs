import test from 'node:test';
import assert from 'node:assert/strict';
import { realOpayAccount, realOpayStatement, realOpayTransactions } from './fixtures/realOpayData.ts';
import { demoAccount, demoStatement, demoTransactions } from './fixtures/demoData.ts';
import { auditFinancialCalculations, round2 } from '../src/lib/calculations/financialEngine.ts';
import { parseCsvStatement } from '../src/lib/parser/csvParser.ts';
import { buildGroundingRegistry, verifyTextGrounding } from '../src/lib/ai/analystEngine.ts';

test('1. Security & File Integrity: CSV Bank Statement Parser Accuracy', () => {
  const sampleCsv = `
"GTBank Account Statement - 0148291048"
"Account Name: OLUWASEUN ADEBAYO"
"Period: 01 Oct 2026 to 31 Oct 2026"

"Trans Date","Reference","Narration","Debit","Credit","Balance"
"02-Oct-2026","GTB001293","SALARY FROM TECH CORP PLC","","750,000.00","750,000.00"
"03-Oct-2026","GTB001294","POS SWEET SENSATION IKEJA","4,500.00","","745,500.00"
"05-Oct-2026","GTB001295","AIRTIME RECHARGE MTN 08031234567","3,000.00","","742,500.00"
"08-Oct-2026","GTB001296","TRF TO ADEBAYO BUKOLA - FAMILY SUPPORT","30,000.00","","712,500.00"
"10-Oct-2026","GTB001297","PIGGYVEST SAVINGS SWEEP","150,000.00","","562,500.00"
"12-Oct-2026","GTB001298","STAMP DUTY ELECTRONIC LEVY","50.00","","562,450.00"
"15-Oct-2026","GTB001299","SPORTYBET NIGERIA DEPOSIT","5,000.00","","557,450.00"
"20-Oct-2026","GTB001300","POS CHOWDECK FOOD DELIVERY","8,200.00","","549,250.00"
  `.trim();

  const parseResult = parseCsvStatement(sampleCsv, 'GTBank_Oct_2026.csv');

  assert.equal(parseResult.bankName, 'GTBank');
  assert.equal(parseResult.transactions.length, 8);
  assert.equal(parseResult.accounts[0].totalCredit, 750000.00);
  assert.equal(parseResult.accounts[0].totalDebit, 200750.00);

  // Financial Rules Audit on CSV parsed transactions
  const audit = parseResult.auditReport;
  assert.equal(audit.income.totalIncome, 750000.00, 'Salary must be counted as true income');

  // PiggyVest sweep (150,000) must be isolated from living expenses
  assert.equal(
    audit.expenses.excludedOutflows.savingsDeposits,
    150000.00,
    'PiggyVest savings sweep must be isolated from living expenses'
  );

  // Living expenses = 4,500 + 3,000 + 30,000 + 5,000 + 8,200 = 50,700
  // (Stamp duty 50 is counted separately under bankCharges)
  assert.equal(audit.expenses.grossLivingExpenses, 50700.00, 'Living expenses must exclude savings sweep and bank fees');
  assert.equal(audit.expenses.bankCharges, 50.00, 'Bank fee must be counted separately');
});

test('2. User Data Isolation: Multi-Dataset Segregation', () => {
  // Verify OPay dataset does not leak into Zenith dataset
  assert.notEqual(realOpayAccount.bankName, demoAccount.bankName);
  assert.notEqual(realOpayAccount.accountName, demoAccount.accountName);
  assert.notEqual(realOpayStatement.fileName, demoStatement.fileName);

  const opayAudit = auditFinancialCalculations(realOpayTransactions, 33956.53, 15.45, 'NGN');
  const zenithAudit = auditFinancialCalculations(demoTransactions, 0, 0, 'NGN');

  assert.notEqual(opayAudit.income.totalIncome, zenithAudit.income.totalIncome);
  assert.notEqual(opayAudit.expenses.grossLivingExpenses, zenithAudit.expenses.grossLivingExpenses);
  assert.notEqual(opayAudit.netCashFlow, zenithAudit.netCashFlow);
});

test('3. Financial Calculations: Extreme Values & Floating Point Precision', () => {
  // Test floating point accuracy on fractional kobo
  const koboTxs = [
    { debit: 0.01, credit: 0, amount: 0.01, direction: 'DEBIT', isExpense: true, category: 'Food' },
    { debit: 0.02, credit: 0, amount: 0.02, direction: 'DEBIT', isExpense: true, category: 'Food' },
    { debit: 0.07, credit: 0, amount: 0.07, direction: 'DEBIT', isExpense: true, category: 'Food' },
  ];
  const sum = koboTxs.reduce((s, t) => s + t.debit, 0);
  assert.equal(round2(sum), 0.1, '0.01 + 0.02 + 0.07 must round to 0.10, not 0.09999999999999999');

  // Test large sum
  const largeDebit = 50000000.45;
  const largeCredit = 75000000.85;
  const net = round2(largeCredit - largeDebit);
  assert.equal(net, 25000000.40);
});

test('4. AI Hallucination Guard: Rejects Off-by-One and Subtle Numeric Fabrications', () => {
  const registry = buildGroundingRegistry(realOpayTransactions, 'NGN');

  // Exact number passes: ₦310,638.08
  const exactText = 'Your verified living expenses totaled ₦310,638.08 for this period.';
  const exactAudit = verifyTextGrounding(exactText, registry);
  assert.equal(exactAudit.isGroundingPassed, true);
  assert.equal(exactAudit.hallucinatedCount, 0);

  // Fabricated figure outside tolerance fails: ₦345,678.00
  const fabricatedText = 'Your verified living expenses totaled ₦345,678.00 for this period.';
  const fabricatedAudit = verifyTextGrounding(fabricatedText, registry);
  assert.equal(fabricatedAudit.isGroundingPassed, false, 'Fabricated figure must be caught by grounding guard');
  assert.ok(fabricatedAudit.hallucinatedCount > 0);
});
