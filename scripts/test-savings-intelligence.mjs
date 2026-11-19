import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyTransaction } from '../src/lib/classification/classifier.ts';
import { auditFinancialCalculations } from '../src/lib/calculations/financialEngine.ts';
import { computeSavingsReport, extractSavingsMovements, detectSavingsPatterns } from '../src/lib/savings/savingsEngine.ts';
import { realOpayTransactions, realOpayAccount } from './fixtures/realOpayData.ts';

function createMockTx(overrides = {}) {
  return {
    id: `tx_${Math.random().toString(36).substring(7)}`,
    statementId: 'stmt_mock',
    accountId: 'acc_mock',
    date: '2026-11-02',
    time: '10:00:00',
    description: 'Mock Transaction',
    originalDescription: 'Mock Transaction Raw',
    debit: 0,
    credit: 0,
    amount: 0,
    direction: 'DEBIT',
    balance: 100000,
    currency: 'NGN',
    category: 'Other',
    categoryGroup: 'Other',
    transactionType: 'EXPENSE',
    confidenceScore: 1.0,
    classificationMethod: 'deterministic',
    isInternalTransfer: false,
    isRefund: false,
    isRecurring: false,
    isIncome: false,
    isExpense: true,
    isSavings: false,
    source: 'test.pdf',
    ...overrides,
  };
}

test('1. Example 1: Inflow ₦57,000 Followed by Auto-Save ₦57,000 to OWealth', () => {
  // Scenario: Fidelity Bank -> OPay: ₦57,000, then OPay -> Auto-save to OWealth: ₦57,000
  const inflowTx = createMockTx({
    id: 'tx_inflow_57k',
    date: '2026-11-02',
    description: 'Transfer from MORAKINYO ERIOLUWA | Fidelity Bank',
    direction: 'CREDIT',
    credit: 57000,
    amount: 57000,
    balance: 57000,
    ...classifyTransaction('Transfer from MORAKINYO ERIOLUWA | Fidelity Bank', 0, 57000, 'REF57K_1', 'ERIOLUWA JOSEPH MORAKINYO'),
  });

  const autoSaveTx = createMockTx({
    id: 'tx_autosave_57k',
    date: '2026-11-02',
    description: 'Auto-save to OWealth Balance',
    direction: 'DEBIT',
    debit: 57000,
    amount: 57000,
    balance: 0,
    ...classifyTransaction('Auto-save to OWealth Balance', 57000, 0, 'REF57K_2', 'ERIOLUWA JOSEPH MORAKINYO'),
  });

  assert.equal(inflowTx.isIncome, true, 'External inflow from Fidelity bank must be recognized as external income');
  assert.equal(inflowTx.financialType, 'EXTERNAL_INCOME', 'Fidelity -> OPay inflow is EXTERNAL_INCOME');
  assert.equal(autoSaveTx.isSavings, true, 'Auto-save must be classified as savings');
  assert.equal(autoSaveTx.financialType, 'SAVINGS_CONTRIBUTION', 'Auto-save is SAVINGS_CONTRIBUTION');
  assert.equal(autoSaveTx.isExpense, false, 'Auto-save must NOT be marked as living expense');

  const report = auditFinancialCalculations([inflowTx, autoSaveTx], 0, 0, 'NGN');
  assert.equal(report.income.totalIncome, 57000, 'Recognized income must accurately reflect external inflow ₦57,000');
  assert.equal(report.expenses.netLivingExpenses, 0, 'Living expenses must be ₦0, not inflated by ₦57,000');
  assert.equal(report.wealth.savingsDeposits, 57000, 'Savings deposit must be exactly ₦57,000');
  assert.equal(report.savingsRate, 100, 'Savings contribution rate must be 100%');

  // Verify savings pattern detection
  const savingsReport = computeSavingsReport([inflowTx, autoSaveTx], undefined, 'NGN');
  const sweepPattern = savingsReport.patterns.find((p) => p.type === 'INFLOW_TO_SAVINGS_SWEEP');
  assert.ok(sweepPattern, 'Must detect immediate sweep from inflow to OWealth');
});

test('2. Example 2: OWealth ₦4,500 Withdrawal as Expense Funding Source for NextGen PG Data', () => {
  // Scenario: OWealth -> Wallet: ₦4,500, then Wallet -> NextGen PG: ₦4,500 for data
  const owealthWithdrawalTx = createMockTx({
    id: 'tx_ow_4500',
    date: '2026-11-03',
    description: 'OWealth Withdrawal(Transaction Payment)',
    direction: 'CREDIT',
    credit: 4500,
    amount: 4500,
    balance: 4500,
    ...classifyTransaction('OWealth Withdrawal(Transaction Payment)', 0, 4500, 'REF4500_1', 'ERIOLUWA JOSEPH MORAKINYO'),
  });

  const dataExpenseTx = createMockTx({
    id: 'tx_exp_4500',
    date: '2026-11-03',
    description: 'NextGen PG Data Topup',
    merchant: 'NextGen PG',
    direction: 'DEBIT',
    debit: 4500,
    amount: 4500,
    balance: 0,
    ...classifyTransaction('NextGen PG Data Topup', 4500, 0, 'REF4500_2', 'ERIOLUWA JOSEPH MORAKINYO'),
  });

  assert.equal(owealthWithdrawalTx.isIncome, false, 'OWealth withdrawal is the funding source, NOT earned income');
  assert.equal(dataExpenseTx.isExpense, true, 'Data topup is a genuine living expense');

  const report = auditFinancialCalculations([owealthWithdrawalTx, dataExpenseTx], 0, 0, 'NGN');
  assert.equal(report.income.totalIncome, 0, 'Income must strictly be ₦0');
  assert.equal(report.expenses.netLivingExpenses, 4500, 'Living expenses must accurately reflect ₦4,500 data expense');
  assert.equal(report.transfers.internalTransfersIn, 4500, 'Auto-funding sweep must be tracked as internal transit inflow');

  // Verify pattern detector tags OWealth funding source
  const patterns = detectSavingsPatterns(
    extractSavingsMovements([owealthWithdrawalTx, dataExpenseTx]).movements,
    computeSavingsReport([owealthWithdrawalTx, dataExpenseTx]).metrics,
    [owealthWithdrawalTx, dataExpenseTx]
  );
  const fundingPattern = patterns.find((p) => p.type === 'OWEALTH_EXPENSE_FUNDING');
  assert.ok(fundingPattern, 'Must detect OWealth withdrawal as the funding source for NextGen PG');
});

test('3. Example 3: SafeBox Withdrawal ₦4,463.12 Followed by OWealth Deposit (Internal Vault Movement)', () => {
  // Scenario: SafeBox Withdrawal: ₦4,463.12, followed by OWealth Deposit: ₦4,463.12
  const safeboxWithdrawalTx = createMockTx({
    id: 'tx_sb_draw',
    date: '2026-11-04',
    description: 'SafeBox Withdrawal',
    direction: 'CREDIT',
    credit: 4463.12,
    amount: 4463.12,
    balance: 4463.12,
    ...classifyTransaction('SafeBox Withdrawal', 0, 4463.12, 'REFSB_1', 'ERIOLUWA JOSEPH MORAKINYO'),
  });

  const owealthDepositTx = createMockTx({
    id: 'tx_ow_dep',
    date: '2026-11-04',
    description: 'OWealth Deposit(from SafeBox)',
    direction: 'DEBIT',
    debit: 4463.12,
    amount: 4463.12,
    balance: 0,
    ...classifyTransaction('OWealth Deposit(from SafeBox)', 4463.12, 0, 'REFSB_2', 'ERIOLUWA JOSEPH MORAKINYO'),
  });

  assert.equal(safeboxWithdrawalTx.isIncome, false, 'SafeBox withdrawal must NOT count as income');
  assert.equal(safeboxWithdrawalTx.isExpense, false);
  assert.equal(owealthDepositTx.isIncome, false);
  assert.equal(owealthDepositTx.isExpense, false, 'OWealth deposit from SafeBox must NOT count as spending');
  assert.equal(owealthDepositTx.isInternalTransfer, true, 'Vault movement must be recognized as internal transfer');

  const report = auditFinancialCalculations([safeboxWithdrawalTx, owealthDepositTx], 0, 0, 'NGN');
  assert.equal(report.income.totalIncome, 0, 'Total income must be ₦0');
  assert.equal(report.expenses.netLivingExpenses, 0, 'Living expenses must be ₦0');

  // Verify pattern detection
  const movements = extractSavingsMovements([safeboxWithdrawalTx, owealthDepositTx]).movements;
  const vaultPattern = detectSavingsPatterns(movements, computeSavingsReport([safeboxWithdrawalTx, owealthDepositTx]).metrics, [safeboxWithdrawalTx, owealthDepositTx])
    .find((p) => p.type === 'VAULT_TO_VAULT_TRANSFER');
  assert.ok(vaultPattern, 'Must detect internal vault-to-vault transfer');
});

test('4. Self-Account Transfer vs Family Support Disambiguation', () => {
  const accountHolder = 'ERIOLUWA JOSEPH MORAKINYO';

  // 1. Own account outgoing transfer: 2 tokens match -> INTERNAL_TRANSFER
  const selfTransferOut = classifyTransaction(
    'Transfer to MORAKINYO ERIOLUWA | Fidelity Bank',
    100000,
    0,
    'REF_SELF_OUT',
    accountHolder
  );
  assert.equal(selfTransferOut.transactionType, 'INTERNAL_TRANSFER');
  assert.equal(selfTransferOut.isInternalTransfer, true);
  assert.equal(selfTransferOut.isIncome, false);
  assert.equal(selfTransferOut.isExpense, false);

  // 1b. Inflow from own external account -> EXTERNAL_INCOME
  const selfTransferIn = classifyTransaction(
    'Transfer from MORAKINYO ERIOLUWA | Fidelity Bank',
    0,
    100000,
    'REF_SELF_IN',
    accountHolder
  );
  assert.equal(selfTransferIn.financialType, 'EXTERNAL_INCOME');
  assert.equal(selfTransferIn.isIncome, true);
  assert.equal(selfTransferIn.isInternalTransfer, false);

  // 2. Family member transfer: exactly 1 token matches (surname only) -> Family Support
  const familyTransfer = classifyTransaction(
    'Transfer from MORAKINYO BOLA | GTBank',
    0,
    25000,
    'REF_FAM',
    accountHolder
  );
  assert.equal(familyTransfer.category, 'Family Support');
  assert.equal(familyTransfer.categoryGroup, 'Giving');
  assert.equal(familyTransfer.isInternalTransfer, false);
  assert.equal(familyTransfer.isIncome, true);

  // 3. Unrelated external sender -> Not internal transfer
  const externalTransfer = classifyTransaction(
    'Transfer from ADEBAYO BABATUNDE | Access Bank',
    0,
    50000,
    'REF_EXT',
    accountHolder
  );
  assert.equal(externalTransfer.isInternalTransfer, false);
});

test('5. Real 20-Page OPay Statement Execution: Full Wealth & Savings Audit', () => {
  assert.equal(realOpayTransactions.length, 432, 'Must audit all 432 transactions');

  const report = auditFinancialCalculations(
    realOpayTransactions,
    realOpayAccount.openingBalance,
    realOpayAccount.closingBalance,
    'NGN'
  );

  // Core metrics check
  assert.ok(report.income.totalIncome > 0);
  assert.ok(report.expenses.netLivingExpenses > 0);
  assert.ok(report.wealth.savingsDeposits > 0);
  assert.ok(typeof report.wealth.netSavings === 'number');
  assert.ok(report.transfers.internalTransfersIn > 0);

  // Run savings engine on real data
  const savings = computeSavingsReport(realOpayTransactions, undefined, 'NGN');
  assert.ok(savings.metrics.totalSaved > 0);
  assert.ok(savings.metrics.interestEarned === 181.92);
  assert.ok(savings.providers.length > 0);
  assert.ok(savings.patterns.length > 0);

  // Ensure internal movements were not counted as living expenses
  assert.ok(report.expenses.excludedOutflows.savingsDeposits > 0);
  assert.ok(report.expenses.excludedOutflows.internalTransfersOut > 0);
});
