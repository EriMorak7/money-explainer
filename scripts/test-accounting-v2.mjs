import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyTransaction } from '../src/lib/classification/classifier.ts';
import { auditFinancialCalculations, computeCategorySummaries, computeMerchantSummaries } from '../src/lib/calculations/financialEngine.ts';
import { pairAndReconcileTransactions } from '../src/lib/accounting/pairingEngine.ts';

function createTx(overrides = {}) {
  return {
    id: `tx_${Math.random().toString(36).substring(7)}`,
    statementId: 'stmt_nov_reg',
    accountId: 'acc_wallet',
    date: '2026-11-02',
    time: '12:00:00',
    description: 'Transaction',
    originalDescription: 'Transaction',
    debit: 0,
    credit: 0,
    amount: 0,
    direction: 'DEBIT',
    balance: 0,
    currency: 'NGN',
    category: 'Other',
    categoryGroup: 'Other',
    transactionType: 'EXPENSE',
    confidenceScore: 0.99,
    classificationMethod: 'deterministic',
    isInternalTransfer: false,
    isRefund: false,
    isRecurring: false,
    isIncome: false,
    isExpense: true,
    isSavings: false,
    source: 'OPay Nov Statement',
    ...overrides,
  };
}

test('Accounting Engine v2: Test 1 — External Income Recognition', () => {
  // Input: Fidelity -> OPay ₦57,000
  const classification = classifyTransaction(
    'Transfer from MORAKINYO ERIOLUWA | Fidelity Bank',
    0,
    57000,
    'REF_FID_57K',
    'ERIOLUWA JOSEPH MORAKINYO'
  );

  const tx = createTx({
    id: 'tx_fid_57k',
    date: '2026-11-02',
    description: 'Transfer from MORAKINYO ERIOLUWA | Fidelity Bank',
    direction: 'CREDIT',
    credit: 57000,
    amount: 57000,
    balance: 57000,
    ...classification,
  });

  assert.equal(tx.financialType, 'EXTERNAL_INCOME');
  assert.equal(tx.isIncome, true);
  assert.equal(tx.isExpense, false);
  assert.equal(tx.isInternalTransfer, false);

  const report = auditFinancialCalculations([tx], 0, 57000, 'NGN');
  assert.equal(report.income.totalIncome, 57000);
  assert.equal(report.income.externalIncome, 57000);
  assert.equal(report.expenses.netLivingExpenses, 0);
});

test('Accounting Engine v2: Test 2 — Savings Contribution (Auto-save)', () => {
  // Input: OPay -> OWealth ₦57,000
  const classification = classifyTransaction(
    'Auto-save to OWealth Balance',
    57000,
    0,
    'REF_AS_57K',
    'ERIOLUWA JOSEPH MORAKINYO'
  );

  const tx = createTx({
    id: 'tx_as_57k',
    date: '2026-11-02',
    description: 'Auto-save to OWealth Balance',
    direction: 'DEBIT',
    debit: 57000,
    amount: 57000,
    balance: 0,
    ...classification,
  });

  assert.equal(tx.financialType, 'SAVINGS_CONTRIBUTION');
  assert.equal(tx.isSavings, true);
  assert.equal(tx.isExpense, false);
  assert.equal(tx.isIncome, false);

  const report = auditFinancialCalculations([tx], 57000, 0, 'NGN');
  assert.equal(report.income.totalIncome, 0);
  assert.equal(report.expenses.netLivingExpenses, 0);
  assert.equal(report.wealth.savingsDeposits, 57000);
});

test('Accounting Engine v2: Test 3 — Savings Withdrawal Funding an Expense', () => {
  // Input: OWealth withdrawal ₦4,500 + OPay transfer to NextGen PG ₦4,500
  const owealthDebit = createTx({
    id: 'tx_ow_debit',
    date: '2026-11-03',
    time: '14:20:00',
    description: 'OWealth Withdrawal (Transaction Payment)',
    accountType: 'SAVINGS',
    direction: 'DEBIT',
    debit: 4500,
    amount: 4500,
    balance: 38815.76,
    ...classifyTransaction('OWealth Withdrawal (Transaction Payment)', 4500, 0, 'REF_OW_4500', 'ERIOLUWA JOSEPH MORAKINYO'),
  });

  const walletCredit = createTx({
    id: 'tx_w_credit',
    date: '2026-11-03',
    time: '14:20:00',
    description: 'OWealth Withdrawal(Transaction Payment)',
    accountType: 'WALLET',
    direction: 'CREDIT',
    credit: 4500,
    amount: 4500,
    balance: 4500,
    ...classifyTransaction('OWealth Withdrawal(Transaction Payment)', 0, 4500, 'REF_OW_4500', 'ERIOLUWA JOSEPH MORAKINYO'),
  });

  const expenseTx = createTx({
    id: 'tx_data_exp',
    date: '2026-11-03',
    time: '14:20:05',
    description: 'Transfer to NextGen PG | Sterling Bank | 5293138057 | data',
    accountType: 'WALLET',
    merchant: 'NextGen PG',
    direction: 'DEBIT',
    debit: 4500,
    amount: 4500,
    balance: 0,
    ...classifyTransaction('Transfer to NextGen PG | Sterling Bank | 5293138057 | data', 4500, 0, 'REF_DATA_4500', 'ERIOLUWA JOSEPH MORAKINYO'),
  });

  const report = auditFinancialCalculations([owealthDebit, walletCredit, expenseTx], 0, 0, 'NGN');
  assert.equal(report.wealth.savingsWithdrawals, 4500, 'Savings withdrawal must be ₦4,500');
  assert.equal(report.expenses.netLivingExpenses, 4500, 'Total spending must count ₦4,500 EXACTLY ONCE');
  assert.equal(report.income.totalIncome, 0, 'OWealth funding is NOT income');

  // Verify category breakdown does NOT contain OWealth Withdrawal
  const categories = computeCategorySummaries([owealthDebit, walletCredit, expenseTx], report.expenses.netLivingExpenses);
  const uncategorizedOwealth = categories.find((c) => c.category === 'Uncategorized' || c.category === 'Savings');
  assert.equal(uncategorizedOwealth, undefined, 'OWealth withdrawal must NOT appear in spending categories');
});

test('Accounting Engine v2: Test 4 — SafeBox → OWealth Internal Wealth Transfer', () => {
  // Input: SafeBox withdrawal ₦4,463.12, OWealth deposit ₦4,463.12
  const safeboxWithdrawal = createTx({
    id: 'tx_sb_w',
    date: '2026-11-04',
    time: '10:21:16',
    description: 'SafeBox Withdrawal',
    accountType: 'SAFEBOX',
    direction: 'DEBIT',
    debit: 4463.12,
    amount: 4463.12,
    balance: 0,
    ...classifyTransaction('SafeBox Withdrawal', 4463.12, 0, 'REF_SB_W', 'ERIOLUWA JOSEPH MORAKINYO'),
  });

  const owealthDeposit = createTx({
    id: 'tx_ow_d',
    date: '2026-11-04',
    time: '10:21:17',
    description: 'OWealth Deposit(from SafeBox)',
    accountType: 'SAVINGS',
    direction: 'CREDIT',
    credit: 4463.12,
    amount: 4463.12,
    balance: 4463.12,
    ...classifyTransaction('OWealth Deposit(from SafeBox)', 0, 4463.12, 'REF_OW_D', 'ERIOLUWA JOSEPH MORAKINYO'),
  });

  const report = auditFinancialCalculations([safeboxWithdrawal, owealthDeposit], 0, 0, 'NGN');
  assert.equal(report.wealth.internalWealthTransfers, 4463.12, 'Must record ₦4,463.12 internal wealth transfer');
  assert.equal(report.income.totalIncome, 0, 'Internal reallocation is NOT income');
  assert.equal(report.expenses.netLivingExpenses, 0, 'Internal reallocation is NOT spending');
  assert.equal(report.wealth.savingsDeposits, 0, 'Internal reallocation is NOT a new savings contribution');
});

test('Accounting Engine v2: Test 5 — Interest Earned Recognition', () => {
  // Input: OWealth interest ₦4.95
  const interestTx = createTx({
    id: 'tx_yield_495',
    date: '2026-11-05',
    time: '02:00:00',
    description: 'OWealth Interest Earned',
    accountType: 'SAVINGS',
    direction: 'CREDIT',
    credit: 4.95,
    amount: 4.95,
    balance: 20263.82,
    ...classifyTransaction('OWealth Interest Earned', 0, 4.95, 'REF_YIELD_1', 'ERIOLUWA JOSEPH MORAKINYO'),
  });

  assert.equal(interestTx.financialType, 'INTEREST_INCOME');
  assert.equal(interestTx.isIncome, true);
  assert.equal(interestTx.isExpense, false);

  const report = auditFinancialCalculations([interestTx], 0, 4.95, 'NGN');
  assert.equal(report.income.interestIncome, 4.95);
  assert.equal(report.income.totalIncome, 4.95);
  assert.equal(report.expenses.netLivingExpenses, 0);
});

test('Accounting Engine v2: Test 6 — Full November 1–13 Mandatory Regression Fixture', () => {
  // Construct the verified November 1–13 statement dataset:
  const transactions = [
    // 1. External Inflows from Fidelity Bank (₦77,000)
    createTx({
      id: 'tx_fid_20k',
      date: '2026-11-02',
      time: '09:00:00',
      description: 'Transfer from MORAKINYO ERIOLUWA | Fidelity Bank',
      accountType: 'WALLET',
      direction: 'CREDIT',
      credit: 20000,
      amount: 20000,
      balance: 20000,
      ...classifyTransaction('Transfer from MORAKINYO ERIOLUWA | Fidelity Bank', 0, 20000, 'REF_FID_1', 'ERIOLUWA JOSEPH MORAKINYO'),
    }),
    createTx({
      id: 'tx_fid_57k',
      date: '2026-11-02',
      time: '09:05:00',
      description: 'Transfer from MORAKINYO ERIOLUWA | Fidelity Bank',
      accountType: 'WALLET',
      direction: 'CREDIT',
      credit: 57000,
      amount: 57000,
      balance: 77000,
      ...classifyTransaction('Transfer from MORAKINYO ERIOLUWA | Fidelity Bank', 0, 57000, 'REF_FID_2', 'ERIOLUWA JOSEPH MORAKINYO'),
    }),

    // 2. Auto-save to OWealth (₦77,000)
    // Wallet Debits
    createTx({
      id: 'tx_as_w_20k',
      date: '2026-11-02',
      time: '09:00:01',
      description: 'Auto-save to OWealth Balance',
      accountType: 'WALLET',
      direction: 'DEBIT',
      debit: 20000,
      amount: 20000,
      balance: 0,
      ...classifyTransaction('Auto-save to OWealth Balance', 20000, 0, 'REF_AS_1', 'ERIOLUWA JOSEPH MORAKINYO'),
    }),
    createTx({
      id: 'tx_as_w_57k',
      date: '2026-11-02',
      time: '09:05:01',
      description: 'Auto-save to OWealth Balance',
      accountType: 'WALLET',
      direction: 'DEBIT',
      debit: 57000,
      amount: 57000,
      balance: 0,
      ...classifyTransaction('Auto-save to OWealth Balance', 57000, 0, 'REF_AS_2', 'ERIOLUWA JOSEPH MORAKINYO'),
    }),
    // OWealth Credits
    createTx({
      id: 'tx_as_ow_20k',
      date: '2026-11-02',
      time: '09:00:01',
      description: 'Auto-save to OWealth Balance',
      accountType: 'SAVINGS',
      direction: 'CREDIT',
      credit: 20000,
      amount: 20000,
      balance: 40258.87,
      ...classifyTransaction('Auto-save to OWealth Balance', 0, 20000, 'REF_AS_1', 'ERIOLUWA JOSEPH MORAKINYO'),
    }),
    createTx({
      id: 'tx_as_ow_57k',
      date: '2026-11-02',
      time: '09:05:01',
      description: 'Auto-save to OWealth Balance',
      accountType: 'SAVINGS',
      direction: 'CREDIT',
      credit: 57000,
      amount: 57000,
      balance: 97258.87,
      ...classifyTransaction('Auto-save to OWealth Balance', 0, 57000, 'REF_AS_2', 'ERIOLUWA JOSEPH MORAKINYO'),
    }),

    // 3. SafeBox to OWealth Reallocations (₦18,938.12)
    // 4463.12 + 4825.00 + 4825.00 + 4825.00 = 18938.12
    createTx({
      id: 'tx_sb_w_1',
      date: '2026-11-04',
      time: '10:21:16',
      description: 'SafeBox Withdrawal',
      accountType: 'SAFEBOX',
      direction: 'DEBIT',
      debit: 4463.12,
      amount: 4463.12,
      balance: 0,
      ...classifyTransaction('SafeBox Withdrawal', 4463.12, 0, 'REF_SB_1', 'ERIOLUWA JOSEPH MORAKINYO'),
    }),
    createTx({
      id: 'tx_sb_d_1',
      date: '2026-11-04',
      time: '10:21:17',
      description: 'OWealth Deposit(from SafeBox)',
      accountType: 'SAVINGS',
      direction: 'CREDIT',
      credit: 4463.12,
      amount: 4463.12,
      balance: 101721.99,
      ...classifyTransaction('OWealth Deposit(from SafeBox)', 0, 4463.12, 'REF_SB_1', 'ERIOLUWA JOSEPH MORAKINYO'),
    }),
    createTx({
      id: 'tx_sb_w_2',
      date: '2026-11-05',
      time: '17:45:58',
      description: 'SafeBox Withdrawal',
      accountType: 'SAFEBOX',
      direction: 'DEBIT',
      debit: 4825.00,
      amount: 4825.00,
      balance: 0,
      ...classifyTransaction('SafeBox Withdrawal', 4825.00, 0, 'REF_SB_2', 'ERIOLUWA JOSEPH MORAKINYO'),
    }),
    createTx({
      id: 'tx_sb_d_2',
      date: '2026-11-05',
      time: '17:45:59',
      description: 'OWealth Deposit(from SafeBox)',
      accountType: 'SAVINGS',
      direction: 'CREDIT',
      credit: 4825.00,
      amount: 4825.00,
      balance: 106546.99,
      ...classifyTransaction('OWealth Deposit(from SafeBox)', 0, 4825.00, 'REF_SB_2', 'ERIOLUWA JOSEPH MORAKINYO'),
    }),
    createTx({
      id: 'tx_sb_w_3',
      date: '2026-11-06',
      time: '14:12:40',
      description: 'SafeBox Withdrawal',
      accountType: 'SAFEBOX',
      direction: 'DEBIT',
      debit: 4825.00,
      amount: 4825.00,
      balance: 0,
      ...classifyTransaction('SafeBox Withdrawal', 4825.00, 0, 'REF_SB_3', 'ERIOLUWA JOSEPH MORAKINYO'),
    }),
    createTx({
      id: 'tx_sb_d_3',
      date: '2026-11-06',
      time: '14:12:41',
      description: 'OWealth Deposit(from SafeBox)',
      accountType: 'SAVINGS',
      direction: 'CREDIT',
      credit: 4825.00,
      amount: 4825.00,
      balance: 111371.99,
      ...classifyTransaction('OWealth Deposit(from SafeBox)', 0, 4825.00, 'REF_SB_3', 'ERIOLUWA JOSEPH MORAKINYO'),
    }),
    createTx({
      id: 'tx_sb_w_4',
      date: '2026-11-07',
      time: '11:00:00',
      description: 'SafeBox Withdrawal',
      accountType: 'SAFEBOX',
      direction: 'DEBIT',
      debit: 4825.00,
      amount: 4825.00,
      balance: 0,
      ...classifyTransaction('SafeBox Withdrawal', 4825.00, 0, 'REF_SB_4', 'ERIOLUWA JOSEPH MORAKINYO'),
    }),
    createTx({
      id: 'tx_sb_d_4',
      date: '2026-11-07',
      time: '11:00:01',
      description: 'OWealth Deposit(from SafeBox)',
      accountType: 'SAVINGS',
      direction: 'CREDIT',
      credit: 4825.00,
      amount: 4825.00,
      balance: 116196.99,
      ...classifyTransaction('OWealth Deposit(from SafeBox)', 0, 4825.00, 'REF_SB_4', 'ERIOLUWA JOSEPH MORAKINYO'),
    }),

    // 4. OWealth Interest Earned (₦11.35)
    createTx({
      id: 'tx_yield_nov',
      date: '2026-11-08',
      time: '02:00:00',
      description: 'OWealth Interest Earned',
      accountType: 'SAVINGS',
      direction: 'CREDIT',
      credit: 11.35,
      amount: 11.35,
      balance: 116208.34,
      ...classifyTransaction('OWealth Interest Earned', 0, 11.35, 'REF_YIELD_NOV', 'ERIOLUWA JOSEPH MORAKINYO'),
    }),

    // 5. OWealth Withdrawals funding actual living expenses (₦72,892.58)
    // OWealth Debits
    createTx({
      id: 'tx_ow_w_72k',
      date: '2026-11-03',
      time: '15:00:00',
      description: 'OWealth Withdrawal (Transaction Payment)',
      accountType: 'SAVINGS',
      direction: 'DEBIT',
      debit: 72892.58,
      amount: 72892.58,
      balance: 43315.76,
      ...classifyTransaction('OWealth Withdrawal (Transaction Payment)', 72892.58, 0, 'REF_OW_SWEEP_72K', 'ERIOLUWA JOSEPH MORAKINYO'),
    }),
    // Wallet Credit
    createTx({
      id: 'tx_w_c_72k',
      date: '2026-11-03',
      time: '15:00:00',
      description: 'OWealth Withdrawal(Transaction Payment)',
      accountType: 'WALLET',
      direction: 'CREDIT',
      credit: 72892.58,
      amount: 72892.58,
      balance: 72892.58,
      ...classifyTransaction('OWealth Withdrawal(Transaction Payment)', 0, 72892.58, 'REF_OW_SWEEP_72K', 'ERIOLUWA JOSEPH MORAKINYO'),
    }),
    // Actual Wallet Living Expenses (Data, Subscriptions, Church, Family Support, etc.)
    createTx({
      id: 'tx_real_exp_data',
      date: '2026-11-03',
      time: '15:00:05',
      description: 'Transfer to NextGen PG | Sterling Bank | 5293138057 | data',
      accountType: 'WALLET',
      merchant: 'NextGen PG',
      direction: 'DEBIT',
      debit: 4500,
      amount: 4500,
      balance: 68392.58,
      ...classifyTransaction('Transfer to NextGen PG | Sterling Bank | 5293138057 | data', 4500, 0, 'REF_DATA_1', 'ERIOLUWA JOSEPH MORAKINYO'),
    }),
    createTx({
      id: 'tx_real_exp_gplay',
      date: '2026-11-04',
      time: '12:00:00',
      description: 'OPay Card Payment | Google Play',
      accountType: 'WALLET',
      merchant: 'Google Play',
      direction: 'DEBIT',
      debit: 4710,
      amount: 4710,
      balance: 63682.58,
      ...classifyTransaction('OPay Card Payment | Google Play', 4710, 0, 'REF_GPLAY_1', 'ERIOLUWA JOSEPH MORAKINYO'),
    }),
    createTx({
      id: 'tx_real_exp_tithe',
      date: '2026-11-05',
      time: '10:00:00',
      description: 'Transfer to LIVING FAITH CHURCH | tithe',
      accountType: 'WALLET',
      merchant: 'LIVING FAITH CHURCH',
      direction: 'DEBIT',
      debit: 35000,
      amount: 35000,
      balance: 28682.58,
      ...classifyTransaction('Transfer to LIVING FAITH CHURCH | tithe', 35000, 0, 'REF_TITHE_1', 'ERIOLUWA JOSEPH MORAKINYO'),
    }),
    createTx({
      id: 'tx_real_exp_family',
      date: '2026-11-06',
      time: '11:00:00',
      description: 'Transfer to MORAKINYO IREOLUWA ELIJAH | First Bank | 3224472451 | help',
      accountType: 'WALLET',
      merchant: 'MORAKINYO IREOLUWA ELIJAH',
      direction: 'DEBIT',
      debit: 10000,
      amount: 10000,
      balance: 18682.58,
      ...classifyTransaction('Transfer to MORAKINYO IREOLUWA ELIJAH | First Bank | 3224472451 | help', 10000, 0, 'REF_FAM_1', 'ERIOLUWA JOSEPH MORAKINYO'),
    }),
    createTx({
      id: 'tx_real_exp_food',
      date: '2026-11-07',
      time: '13:00:00',
      description: 'Transfer to CHOWDECK | food delivery',
      accountType: 'WALLET',
      merchant: 'Chowdeck',
      direction: 'DEBIT',
      debit: 18682.58,
      amount: 18682.58,
      balance: 0,
      ...classifyTransaction('Transfer to CHOWDECK | food delivery', 18682.58, 0, 'REF_CHOW_1', 'ERIOLUWA JOSEPH MORAKINYO'),
    }),
  ];

  // Audit execution
  const report = auditFinancialCalculations(transactions, 0, 0, 'NGN');

  // Mandatory assertions per Section 26:
  assert.equal(report.income.externalIncome, 77000, 'externalIncome must be exactly ₦77,000.00');
  assert.equal(report.income.interestIncome, 11.35, 'interestIncome must be exactly ₦11.35');
  assert.equal(report.income.totalIncome, 77011.35, 'totalRecognizedIncome must be exactly ₦77,011.35');

  assert.equal(report.wealth.savingsDeposits, 77000, 'savingsContributions must be exactly ₦77,000.00');
  assert.equal(report.wealth.savingsWithdrawals, 72892.58, 'savingsWithdrawals must be exactly ₦72,892.58');
  assert.equal(report.wealth.internalWealthTransfers, 18938.12, 'internalWealthTransfers must be exactly ₦18,938.12');
  assert.equal(report.wealth.owealthNetBalanceChange, 23056.89, 'owealthNetChange must be exactly ₦23,056.89');

  // Total spending must be derived from actual expenses ONLY
  assert.equal(report.expenses.netLivingExpenses, 72892.58, 'Total spending must be ₦72,892.58 (actual expenses only)');
  assert.equal(report.netCashFlow, 4118.77, 'netCashFlow must be 77,011.35 - 72,892.58 = ₦4,118.77');
  assert.equal(report.savingsRate, 100, 'Savings contribution rate must be 100%');

  // Verify exclusions from categories & merchants
  const categories = computeCategorySummaries(transactions, report.expenses.netLivingExpenses);
  const uncategorized = categories.find((c) => c.category === 'Uncategorized' || c.category === 'Savings');
  assert.equal(uncategorized, undefined, 'OWealth Withdrawal is NOT included in spending categories');

  const merchants = computeMerchantSummaries(transactions, 10);
  const owealthMerch = merchants.find((m) => m.merchant.toLowerCase().includes('owealth withdrawal'));
  assert.equal(owealthMerch, undefined, 'OWealth Withdrawal is NOT included in merchant rankings');
});
