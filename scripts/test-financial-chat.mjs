import test from 'node:test';
import assert from 'node:assert/strict';
import { realOpayTransactions } from './fixtures/realOpayData.ts';
import { demoTransactions } from './fixtures/demoData.ts';
import { auditFinancialCalculations } from '../src/lib/calculations/financialEngine.ts';
import {
  classifyQueryIntent,
  executeFinancialQuery,
  generateChatResponse,
} from '../src/lib/chat/chatEngine.ts';

test('1. Intent Classifier Correctly Identifies Financial Queries', () => {
  // Test category queries
  const qFood = classifyQueryIntent('How much did I spend on food this month?', realOpayTransactions);
  assert.equal(qFood.intent, 'CATEGORY_SPEND');
  assert.equal(qFood.entities.category, 'Food');

  const qTransport = classifyQueryIntent('Show me transport and Uber expenses', realOpayTransactions);
  assert.equal(qTransport.intent, 'CATEGORY_SPEND');
  assert.equal(qTransport.entities.category, 'Transportation');

  const qFuel = classifyQueryIntent('How much petrol and fuel did I buy?', realOpayTransactions);
  assert.equal(qFuel.intent, 'CATEGORY_SPEND');
  assert.equal(qFuel.entities.category, 'Fuel');

  // Test income queries
  const qIncome = classifyQueryIntent('What was my total true income or salary?', realOpayTransactions);
  assert.equal(qIncome.intent, 'INCOME_TOTAL');

  // Test savings queries
  const qSavings = classifyQueryIntent('How much did I put into savings and owealth?', realOpayTransactions);
  assert.equal(qSavings.intent, 'SAVINGS_TOTAL');

  // Test bank charges
  const qCharges = classifyQueryIntent('Did I pay any bank fees or stamp duties?', realOpayTransactions);
  assert.equal(qCharges.intent, 'BANK_CHARGES');

  // Test refunds
  const qRefunds = classifyQueryIntent('Show me any refunds or reversed money', realOpayTransactions);
  assert.equal(qRefunds.intent, 'REFUNDS');

  // Test largest transactions
  const qLargest = classifyQueryIntent('What were my largest and biggest transactions?', realOpayTransactions);
  assert.equal(qLargest.intent, 'LARGEST_TRANSACTIONS');

  // Test daily burn rate
  const qBurn = classifyQueryIntent('What was my daily burn rate and average spend per day?', realOpayTransactions);
  assert.equal(qBurn.intent, 'DAILY_BURN_RATE');

  // Test net cash flow
  const qCashflow = classifyQueryIntent('What is my net cash flow or surplus?', realOpayTransactions);
  assert.equal(qCashflow.intent, 'NET_CASH_FLOW');
});

test('2. Deterministic Query Execution Matches Audited Financial Engine', () => {
  const audit = auditFinancialCalculations(realOpayTransactions, 33956.53, 15.45, 'NGN');

  // Income query
  const resIncome = executeFinancialQuery('What was my total income?', realOpayTransactions, 'NGN');
  assert.equal(resIncome.intent, 'INCOME_TOTAL');
  assert.equal(resIncome.totalAmount, audit.income.totalIncome);
  assert.equal(resIncome.isGroundingVerified, true);

  // Living expenses query
  const resExpenses = executeFinancialQuery('How much did I spend in total?', realOpayTransactions, 'NGN');
  assert.equal(resExpenses.intent, 'EXPENSE_TOTAL');
  assert.equal(resExpenses.totalAmount, audit.expenses.grossLivingExpenses);

  // Net Cash Flow query
  const resCashflow = executeFinancialQuery('What is my net cash flow?', realOpayTransactions, 'NGN');
  assert.equal(resCashflow.intent, 'NET_CASH_FLOW');
  assert.equal(resCashflow.totalAmount, audit.netCashFlow);

  // Bank Charges query
  const resCharges = executeFinancialQuery('How much did I pay in bank charges?', realOpayTransactions, 'NGN');
  assert.equal(resCharges.intent, 'BANK_CHARGES');
  assert.equal(resCharges.totalAmount, audit.expenses.bankCharges);

  // Refunds query
  const resRefunds = executeFinancialQuery('Show me refunds', realOpayTransactions, 'NGN');
  assert.equal(resRefunds.intent, 'REFUNDS');
  assert.equal(resRefunds.totalAmount, audit.expenses.refundsOffset);
});

test('3. Zero-Fabrication Guarantee: Non-Existent Merchants and Categories Return Exactly 0', () => {
  // Query merchant that does NOT exist anywhere in Nigerian bank statement
  const resStarbucks = executeFinancialQuery('How much did I spend at Starbucks?', realOpayTransactions, 'NGN');
  assert.equal(resStarbucks.intent, 'MERCHANT_SPEND');
  assert.equal(resStarbucks.totalAmount, 0, 'Must return ₦0 for non-existent merchant');
  assert.equal(resStarbucks.transactionCount, 0, 'Must cite 0 transactions');
  assert.equal(resStarbucks.citedTransactions.length, 0, 'Must have 0 cited transactions');

  const msgStarbucks = generateChatResponse('How much did I spend at Starbucks?', realOpayTransactions, 'NGN');
  assert.ok(msgStarbucks.content.includes('0.00'), 'Chat response must explicitly state 0.00');
  assert.ok(msgStarbucks.content.includes('No transactions were found'), 'Chat response must clearly state no transactions');

  // Query category with 0 transactions in OPay (e.g. Rent)
  const resRent = executeFinancialQuery('How much did I spend on rent?', realOpayTransactions, 'NGN');
  assert.equal(resRent.intent, 'CATEGORY_SPEND');
  assert.equal(resRent.totalAmount, 0);
  assert.equal(resRent.transactionCount, 0);

  const msgRent = generateChatResponse('How much did I spend on rent?', realOpayTransactions, 'NGN');
  assert.ok(msgRent.content.includes('0.00'), 'Chat response must state 0 for 0-spend category');
});

test('4. Citation Integrity: All Cited Transactions Map to Real Dataset Records', () => {
  const opayMap = new Map(realOpayTransactions.map((t) => [t.id, t]));

  // Test Food Category citations
  const resFood = executeFinancialQuery('How much did I spend on food?', realOpayTransactions, 'NGN');
  assert.ok(resFood.citedTransactions.length > 0, 'Must cite food transactions');

  for (const cited of resFood.citedTransactions) {
    const orig = opayMap.get(cited.id);
    assert.ok(orig, `Cited transaction ${cited.id} must exist in statement dataset`);
    assert.equal(cited.amount, orig.debit || orig.amount, 'Cited amount must match source debit');
    assert.equal(cited.direction, 'DEBIT', 'Food expense must be a debit');
  }

  // Test Largest Transactions citations
  const resLargest = executeFinancialQuery('What were my biggest transactions?', realOpayTransactions, 'NGN');
  assert.ok(resLargest.citedTransactions.length > 0, 'Must cite top debits');
  // Must be sorted in descending order
  for (let i = 0; i < resLargest.citedTransactions.length - 1; i++) {
    assert.ok(
      resLargest.citedTransactions[i].amount >= resLargest.citedTransactions[i + 1].amount,
      'Largest transactions must be sorted descending'
    );
  }
});

test('5. Multi-Bank Dataset Verification: Chat Engine Operates Flawlessly on Zenith Bank Statement', () => {
  const zenithAudit = auditFinancialCalculations(demoTransactions, 0, 0, 'NGN');

  // Income query on Zenith data
  const resIncome = executeFinancialQuery('What was my income?', demoTransactions, 'NGN');
  assert.equal(resIncome.totalAmount, zenithAudit.income.totalIncome);

  // Living expenses on Zenith data
  const resExpenses = executeFinancialQuery('How much did I spend in total?', demoTransactions, 'NGN');
  assert.equal(resExpenses.totalAmount, zenithAudit.expenses.grossLivingExpenses);

  // Chat response on Zenith data
  const chatMsg = generateChatResponse('What is my net cash flow?', demoTransactions, 'NGN');
  assert.ok(chatMsg.content.includes('net cash flow'));
  assert.equal(chatMsg.queryResult?.totalAmount, zenithAudit.netCashFlow);
});
