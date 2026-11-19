import type { AccountType, Transaction } from '../../types/index.ts';

/**
 * Normalizes raw account strings to standardized AccountType.
 */
export function normalizeAccountType(raw?: string, description?: string): AccountType {
  const s = (raw || '').toLowerCase();
  const d = (description || '').toLowerCase();

  if (s.includes('safebox') || d.includes('safebox')) return 'SAFEBOX';
  if (s.includes('savings') || s.includes('owealth') || d.includes('owealth')) return 'SAVINGS';
  if (s.includes('wallet') || s.includes('current') || s.includes('opay')) return 'WALLET';
  if (s.includes('bank') || d.includes('fidelity bank') || d.includes('zenith') || d.includes('gtbank') || d.includes('access bank') || d.includes('first bank')) {
    return 'BANK';
  }
  return 'UNKNOWN';
}

/**
 * Helper to compute seconds difference between ISO date/time strings.
 */
function getTimestampDiffSeconds(t1: Transaction, t2: Transaction): number {
  const d1 = new Date(`${t1.date}T${t1.time || '12:00:00'}`).getTime();
  const d2 = new Date(`${t2.date}T${t2.time || '12:00:00'}`).getTime();
  if (isNaN(d1) || isNaN(d2)) return 0;
  return Math.abs((d1 - d2) / 1000);
}

/**
 * Pairs multi-account transactions into an intelligent relationship graph.
 * Resolves:
 * 1. SafeBox <-> OWealth internal wealth transfers (reallocations)
 * 2. Wallet <-> OWealth auto-save contributions
 * 3. OWealth withdrawals <-> Wallet transit sweeps <-> Actual merchant spending
 * 4. External bank inflows (e.g. Fidelity -> OPay)
 * 5. Interest earned
 */
export function pairAndReconcileTransactions(transactions: Transaction[]): Transaction[] {
  // Clone to avoid mutating input references
  const txs: Transaction[] = transactions.map((t) => {
    const accType: AccountType = t.accountType || normalizeAccountType(undefined, t.description);
    return {
      ...t,
      accountType: accType,
      isInternal: t.isInternal ?? false,
      isExternal: t.isExternal ?? true,
    };
  });

  // Track paired IDs to prevent duplicate pairing
  const pairedIds = new Set<string>();

  // --- PASS 1: SAFEBOX <-> OWEALTH INTERNAL REALLOCATION ---
  // A: SafeBox Withdrawal (Debit)
  // B: OWealth Deposit(from SafeBox) (Credit)
  // Matching amount & near timestamp
  for (let i = 0; i < txs.length; i++) {
    const t1 = txs[i];
    const desc1 = t1.description.toLowerCase();

    if (
      !pairedIds.has(t1.id) &&
      desc1.includes('safebox withdrawal') &&
      t1.direction === 'DEBIT'
    ) {
      // Find matching OWealth Deposit
      for (let j = 0; j < txs.length; j++) {
        if (i === j) continue;
        const t2 = txs[j];
        if (pairedIds.has(t2.id)) continue;
        const desc2 = t2.description.toLowerCase();

        if (
          desc2.includes('owealth deposit') &&
          desc2.includes('safebox') &&
          t2.direction === 'CREDIT' &&
          Math.abs(t1.amount - t2.amount) < 0.01 &&
          (t1.date === t2.date || getTimestampDiffSeconds(t1, t2) <= 300)
        ) {
          // Link pair
          t1.pairedTransactionId = t2.id;
          t2.pairedTransactionId = t1.id;
          t1.financialType = 'INTERNAL_WEALTH_TRANSFER';
          t2.financialType = 'INTERNAL_WEALTH_TRANSFER';
          t1.isInternal = true;
          t2.isInternal = true;
          t1.isExternal = false;
          t2.isExternal = false;
          t1.isInternalTransfer = true;
          t2.isInternalTransfer = true;
          t1.isExpense = false;
          t2.isExpense = false;
          t1.isIncome = false;
          t2.isIncome = false;
          t1.isSavings = false;
          t2.isSavings = false;
          t1.classificationReason = 'SafeBox to OWealth internal reallocation (source)';
          t2.classificationReason = 'SafeBox to OWealth internal reallocation (destination)';

          pairedIds.add(t1.id);
          pairedIds.add(t2.id);
          break;
        }
      }
    }
  }

  // --- PASS 2: AUTO-SAVE TO OWEALTH (WALLET -> OWEALTH) ---
  // A: Auto-save to OWealth in Wallet (Debit)
  // B: Auto-save to OWealth in Savings/OWealth (Credit)
  for (let i = 0; i < txs.length; i++) {
    const t1 = txs[i];
    const desc1 = t1.description.toLowerCase();

    if (
      !pairedIds.has(t1.id) &&
      desc1.includes('auto-save to owealth') &&
      t1.direction === 'DEBIT'
    ) {
      for (let j = 0; j < txs.length; j++) {
        if (i === j) continue;
        const t2 = txs[j];
        if (pairedIds.has(t2.id)) continue;
        const desc2 = t2.description.toLowerCase();

        if (
          desc2.includes('auto-save to owealth') &&
          t2.direction === 'CREDIT' &&
          Math.abs(t1.amount - t2.amount) < 0.01 &&
          (t1.date === t2.date || getTimestampDiffSeconds(t1, t2) <= 300)
        ) {
          t1.pairedTransactionId = t2.id;
          t2.pairedTransactionId = t1.id;
          t1.financialType = 'SAVINGS_CONTRIBUTION';
          t2.financialType = 'SAVINGS_CONTRIBUTION';
          t1.isSavings = true;
          t2.isSavings = true;
          t1.isInternal = true;
          t2.isInternal = true;
          t1.isExpense = false;
          t2.isExpense = false;
          t1.isIncome = false;
          t2.isIncome = false;
          t1.classificationReason = 'Auto-save transfer from Wallet into OWealth savings vault';
          t2.classificationReason = 'Auto-save deposit received into OWealth savings vault';

          pairedIds.add(t1.id);
          pairedIds.add(t2.id);
          break;
        }
      }
    }
  }

  // --- PASS 3: OWEALTH WITHDRAWAL FUNDING ACTUAL WALLET EXPENSES ---
  // 1. OWealth Debit: "OWealth Withdrawal (Transaction Payment)" in Savings
  // 2. Wallet Credit: "OWealth Withdrawal(Transaction Payment)" in Wallet
  // 3. Wallet Debit: The actual merchant expense (e.g. NextGen PG, Google Play, etc.)
  for (let i = 0; i < txs.length; i++) {
    const t1 = txs[i];
    const desc1 = t1.description.toLowerCase();

    const isOwealthDebit =
      t1.direction === 'DEBIT' &&
      (desc1.includes('owealth withdrawal') || desc1 === '(transaction payment)');

    if (!pairedIds.has(t1.id) && isOwealthDebit) {
      t1.financialType = 'SAVINGS_WITHDRAWAL';
      t1.isSavings = true;
      t1.isExpense = false;
      t1.isIncome = false;
      t1.isInternal = true;
      t1.isInternalTransfer = true;
      t1.classificationReason = 'OWealth savings withdrawal to fund transaction payment';

      // Look for Wallet Credit transit
      let walletTransit: Transaction | null = null;
      for (let j = 0; j < txs.length; j++) {
        if (i === j) continue;
        const t2 = txs[j];
        if (pairedIds.has(t2.id)) continue;
        const desc2 = t2.description.toLowerCase();

        if (
          t2.direction === 'CREDIT' &&
          (desc2.includes('owealth withdrawal') || desc2.includes('transaction payment')) &&
          Math.abs(t1.amount - t2.amount) < 0.01 &&
          (t1.date === t2.date || getTimestampDiffSeconds(t1, t2) <= 300)
        ) {
          walletTransit = t2;
          t1.pairedTransactionId = t2.id;
          t2.pairedTransactionId = t1.id;
          t2.financialType = 'INTERNAL_TRANSFER';
          t2.isInternalTransfer = true;
          t2.isInternal = true;
          t2.isIncome = false;
          t2.isExpense = false;
          t2.classificationReason = 'Transit inflow from OWealth withdrawal to fund wallet spend';
          pairedIds.add(t2.id);
          break;
        }
      }

      // Look for corresponding actual merchant expense in wallet
      for (let k = 0; k < txs.length; k++) {
        const t3 = txs[k];
        if (t3.id === t1.id || (walletTransit && t3.id === walletTransit.id)) continue;
        if (t3.fundingTransactionId) continue;

        const desc3 = t3.description.toLowerCase();
        const isNotInternal =
          !desc3.includes('owealth withdrawal') &&
          !desc3.includes('auto-save to owealth') &&
          !desc3.includes('safebox');

        if (
          t3.direction === 'DEBIT' &&
          isNotInternal &&
          Math.abs(t1.amount - t3.amount) < 0.01 &&
          (t1.date === t3.date || getTimestampDiffSeconds(t1, t3) <= 600)
        ) {
          t3.fundingTransactionId = t1.id;
          t1.fundingTransactionId = t3.id;
          if (walletTransit) {
            walletTransit.fundingTransactionId = t3.id;
          }
          t3.isExpense = true;
          t3.isExternal = true;
          t3.notes = `Funded by OWealth withdrawal (${t1.id})`;
          break;
        }
      }

      pairedIds.add(t1.id);
    }
  }

  // --- PASS 4: REMAINING UNPAIRED OWEALTH WITHDRAWALS & TRANSFERS ---
  for (const t of txs) {
    const desc = t.description.toLowerCase();

    // Any OWealth withdrawal debit in savings that was not paired
    if (
      !t.financialType &&
      (desc.includes('owealth withdrawal') || desc === '(transaction payment)') &&
      t.direction === 'DEBIT'
    ) {
      t.financialType = 'SAVINGS_WITHDRAWAL';
      t.isSavings = true;
      t.isExpense = false;
      t.isIncome = false;
      t.isInternal = true;
      t.isInternalTransfer = true;
      t.classificationReason = 'OWealth savings withdrawal';
    }

    // Auto-funding transit sweep credit in wallet
    if (
      desc.includes('transaction payment') &&
      t.direction === 'CREDIT'
    ) {
      t.financialType = 'INTERNAL_TRANSFER';
      t.isInternalTransfer = true;
      t.isInternal = true;
      t.isIncome = false;
      t.isExpense = false;
      t.isSavings = false;
      t.classificationReason = 'OWealth withdrawal transit credit into wallet';
    } else if (
      desc.includes('owealth withdrawal') &&
      t.direction === 'CREDIT'
    ) {
      // Direct OWealth withdrawal credit into wallet
      t.financialType = 'SAVINGS_WITHDRAWAL';
      t.isSavings = true;
      t.isIncome = false;
      t.isExpense = false;
      t.isInternal = true;
      t.isInternalTransfer = true;
      t.classificationReason = 'OWealth savings withdrawal into wallet';
    }

    // OWealth Interest Earned
    if (
      desc.includes('owealth interest earned') ||
      desc.includes('owealth interest')
    ) {
      t.financialType = 'INTEREST_INCOME';
      t.isIncome = true;
      t.isExpense = false;
      t.isInternal = false;
      t.isExternal = true;
      t.classificationReason = 'OWealth yield / interest earned';
    }

    // Auto-save to OWealth Balance (unpaired fallback)
    if (desc.includes('auto-save to owealth')) {
      t.financialType = 'SAVINGS_CONTRIBUTION';
      t.isSavings = true;
      t.isExpense = false;
      t.isIncome = false;
      t.isInternal = true;
      t.classificationReason = 'Auto-save contribution into OWealth savings vault';
    }

    // SafeBox Withdrawal to Wallet or Credit into wallet from SafeBox
    if (
      desc.includes('safebox withdrawal to wallet') ||
      (desc.includes('safebox withdrawal') && t.direction === 'CREDIT')
    ) {
      t.financialType = 'SAVINGS_WITHDRAWAL';
      t.isSavings = true;
      t.isExpense = false;
      t.isIncome = false;
      t.isInternal = true;
      t.isInternalTransfer = true;
      t.classificationReason = 'SafeBox savings withdrawal into wallet';
    } else if (desc.includes('safebox withdrawal')) {
      // SafeBox Withdrawal (unpaired fallback)
      t.financialType = 'INTERNAL_WEALTH_TRANSFER';
      t.isInternalTransfer = true;
      t.isInternal = true;
      t.isExpense = false;
      t.isIncome = false;
      t.isSavings = false;
      t.classificationReason = 'SafeBox withdrawal';
    }

    // OWealth Deposit from SafeBox (unpaired fallback)
    if (desc.includes('owealth deposit') && desc.includes('safebox')) {
      t.financialType = 'INTERNAL_WEALTH_TRANSFER';
      t.isInternalTransfer = true;
      t.isInternal = true;
      t.isExpense = false;
      t.isIncome = false;
      t.isSavings = false;
      t.classificationReason = 'SafeBox to OWealth deposit';
    }

    // External Inflows from Commercial Banks (e.g. Fidelity Bank -> OPay)
    if (
      t.direction === 'CREDIT' &&
      (desc.includes('fidelity bank') ||
        desc.includes('zenith bank') ||
        desc.includes('access bank') ||
        desc.includes('first bank') ||
        desc.includes('gtbank') ||
        desc.includes('uba') ||
        desc.includes('stanbic') ||
        desc.includes('kuda') ||
        desc.includes('moniepoint') ||
        desc.includes('palmpay') ||
        desc.includes('paystack')) &&
      !desc.includes('owealth') &&
      !desc.includes('safebox')
    ) {
      t.financialType = 'EXTERNAL_INCOME';
      t.isIncome = true;
      t.isInternalTransfer = false;
      t.isInternal = false;
      t.isExternal = true;
      t.isExpense = false;
      t.classificationReason = 'External bank inflow recognized as external income';
    }

    // Default fallback financialType if not yet set
    if (!t.financialType) {
      if (t.isIncome || t.transactionType === 'INCOME') {
        t.financialType = 'EXTERNAL_INCOME';
      } else if (t.transactionType === 'INTEREST') {
        t.financialType = 'INTEREST_INCOME';
      } else if (t.isInternalTransfer || t.transactionType === 'INTERNAL_TRANSFER') {
        t.financialType = 'INTERNAL_TRANSFER';
      } else if (t.transactionType === 'SAVINGS_DEPOSIT' || t.transactionType === 'SAVINGS_TRANSFER') {
        t.financialType = 'SAVINGS_CONTRIBUTION';
      } else if (t.transactionType === 'SAVINGS_WITHDRAWAL') {
        t.financialType = 'SAVINGS_WITHDRAWAL';
      } else if (t.isRefund || t.transactionType === 'REFUND') {
        t.financialType = 'REFUND';
      } else if (t.transactionType === 'BANK_CHARGE') {
        t.financialType = 'FEE';
      } else if (t.transactionType === 'GIVING') {
        t.financialType = 'GIVING';
      } else if (t.isExpense || t.transactionType === 'EXPENSE') {
        t.financialType = 'EXPENSE';
      } else {
        t.financialType = 'UNKNOWN';
      }
    }
  }

  return txs;
}
