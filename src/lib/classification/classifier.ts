import type { TransactionCategory } from '../../types/index.ts';
import { DETERMINISTIC_MERCHANT_RULES } from './rules.ts';
import type { ClassificationResult } from './types.ts';
import type { CustomClassificationRule } from '../settings/types.ts';
import { matchCustomRules } from '../settings/settingsEngine.ts';

// In-memory user override dictionary (can be extended to persistent database)
export const userOverridesMap = new Map<string, { category: TransactionCategory; merchant?: string }>();

export function setUserCategoryOverride(patternOrId: string, category: TransactionCategory, merchant?: string) {
  userOverridesMap.set(patternOrId.toLowerCase().trim(), { category, merchant });
}

export let activeCustomRules: CustomClassificationRule[] = [];

export function setActiveCustomRules(rules: CustomClassificationRule[]) {
  activeCustomRules = rules;
}

/**
 * Classifies a financial transaction through a strict multi-tier pipeline:
 * Tier 1: User Manual Override & Custom Rules (100% confidence)
 * Tier 2: Deterministic Merchant & Keyword Rules (95% - 100% confidence)
 * Tier 3: Contextual Transfer Memo & Family Heuristics (90% - 98% confidence)
 * Tier 4: AI Contextual Evaluation for Ambiguous Transactions (40% - 85% confidence)
 */
export function classifyTransaction(
  description: string,
  debit: number,
  credit: number,
  reference?: string,
  userAccountHolderName?: string,
  customRules?: CustomClassificationRule[]
): ClassificationResult {
  const descLower = description.toLowerCase().trim();
  const isCredit = credit > 0 && debit === 0;

  // --- TIER 1: USER CUSTOM RULES & MANUAL CORRECTIONS ---
  const rulesToEvaluate = customRules || activeCustomRules;
  if (rulesToEvaluate && rulesToEvaluate.length > 0) {
    const customMatch = matchCustomRules(description, rulesToEvaluate, isCredit);
    if (customMatch) {
      return customMatch;
    }
  }

  if (userOverridesMap.has(descLower)) {
    const override = userOverridesMap.get(descLower)!;
    return mapCategoryToResult(override.category, override.merchant, 1.0, 'manual', isCredit);
  }

  // --- SPECIAL PRECEDENCE: REFUNDS & REVERSALS ---
  // (Prevents "Bolt refunded" or "Adobe refunded" from falsely matching as transport/subscription expense)
  if (
    descLower.includes('refund') ||
    descLower.includes('refunded') ||
    descLower.includes('reversal') ||
    descLower.includes('reversed')
  ) {
    return {
      category: 'Refund',
      categoryGroup: 'Other',
      transactionType: 'REFUND',
      financialType: 'REFUND',
      merchant: extractMerchantFromRefund(description),
      confidence: 0.99,
      method: 'deterministic',
      isInternalTransfer: false,
      isInternal: false,
      isExternal: true,
      isRefund: true,
      isRecurring: false,
      isIncome: false,
      isExpense: false,
      isSavings: false,
      notes: 'Automated refund or reversal credit detected',
      classificationReason: 'Automated refund or reversal credit detected',
    };
  }

  // --- TIER 2: DETERMINISTIC RULE MATCHING ---
  for (const rule of DETERMINISTIC_MERCHANT_RULES) {
    const isMatched = rule.patterns.some((pattern) => {
      if (typeof pattern === 'string') {
        return descLower.includes(pattern.toLowerCase());
      }
      return pattern.test(descLower);
    });

    if (isMatched) {
      // Special check for salary vs consulting income
      let cat = rule.category;
      if (cat === 'Salary' && (descLower.includes('consulting') || descLower.includes('invoice') || descLower.includes('goodsservicespayment'))) {
        cat = 'Client Payment';
      }

      const financialType =
        rule.financialType ||
        (rule.transactionType === 'INCOME'
          ? 'EXTERNAL_INCOME'
          : rule.transactionType === 'INTEREST'
          ? 'INTEREST_INCOME'
          : rule.transactionType === 'SAVINGS_DEPOSIT' || rule.transactionType === 'SAVINGS_TRANSFER'
          ? 'SAVINGS_CONTRIBUTION'
          : rule.transactionType === 'SAVINGS_WITHDRAWAL'
          ? 'SAVINGS_WITHDRAWAL'
          : rule.transactionType === 'INTERNAL_TRANSFER'
          ? 'INTERNAL_TRANSFER'
          : rule.transactionType === 'REFUND'
          ? 'REFUND'
          : rule.transactionType === 'BANK_CHARGE'
          ? 'FEE'
          : rule.transactionType === 'GIVING'
          ? 'GIVING'
          : 'EXPENSE');

      return {
        category: cat,
        categoryGroup: rule.categoryGroup,
        transactionType: rule.transactionType,
        financialType,
        merchant: rule.merchant,
        confidence: rule.confidence ?? 0.98,
        method: 'deterministic',
        isInternalTransfer: rule.isInternalTransfer ?? (rule.transactionType === 'INTERNAL_TRANSFER'),
        isInternal: rule.isInternal ?? (financialType === 'INTERNAL_TRANSFER' || financialType === 'INTERNAL_WEALTH_TRANSFER' || financialType === 'SAVINGS_WITHDRAWAL' || financialType === 'SAVINGS_CONTRIBUTION'),
        isExternal: rule.isExternal ?? (financialType === 'EXTERNAL_INCOME' || financialType === 'INTEREST_INCOME' || financialType === 'EXPENSE' || financialType === 'REFUND'),
        isRefund: rule.isRefund ?? false,
        isRecurring: rule.isRecurring ?? false,
        isIncome: rule.isIncome ?? (isCredit && (rule.transactionType === 'INCOME' || rule.transactionType === 'INTEREST')),
        isExpense: rule.isExpense ?? (!isCredit && rule.transactionType === 'EXPENSE'),
        isSavings: rule.isSavings ?? (rule.transactionType === 'SAVINGS_TRANSFER' || rule.transactionType === 'SAVINGS_DEPOSIT' || rule.transactionType === 'SAVINGS_WITHDRAWAL'),
        classificationReason: `Deterministic rule: ${rule.merchant}`,
      };
    }
  }

  // --- TIER 3: CONTEXTUAL TRANSFER MEMO & FAMILY HEURISTICS ---
  if (userAccountHolderName) {
    const nameParts = userAccountHolderName
      .toLowerCase()
      .split(/\s+/)
      .map((p) => p.replace(/[^a-z]/g, ''))
      .filter((p) => p.length >= 3);

    // 1. Self-Transfer Check: 2 or more name tokens match (e.g. "erioluwa" + "morakinyo")
    const matchedParts = nameParts.filter((part) => descLower.includes(part));
    if (matchedParts.length >= 2) {
      if (isCredit) {
        // External Inflow: Money entering this bank account from user's external bank account
        // (e.g. Fidelity Bank -> OPay). This is external inflow / income to this financial ecosystem.
        return {
          category: 'Transfers Received',
          categoryGroup: 'Income',
          transactionType: 'INCOME',
          financialType: 'EXTERNAL_INCOME',
          merchant: extractSenderFromTransfer(description),
          confidence: 0.98,
          method: 'deterministic',
          isInternalTransfer: false,
          isInternal: false,
          isExternal: true,
          isRefund: false,
          isRecurring: false,
          isIncome: true,
          isExpense: false,
          isSavings: false,
          notes: `External inflow from user's external bank account (e.g. Fidelity) recognized as external income`,
          classificationReason: 'External bank inflow recognized as EXTERNAL_INCOME',
        };
      }

      return {
        category: 'Transfers',
        categoryGroup: 'Financial',
        transactionType: 'INTERNAL_TRANSFER',
        financialType: 'INTERNAL_TRANSFER',
        merchant: 'Self Account Transfer',
        confidence: 0.99,
        method: 'deterministic',
        isInternalTransfer: true,
        isInternal: true,
        isExternal: false,
        isRefund: false,
        isRecurring: false,
        isIncome: false,
        isExpense: false,
        isSavings: false,
        notes: `Self-transfer across user's accounts matching ${matchedParts.join(' & ')}`,
        classificationReason: 'Self-transfer outgoing to external personal account',
      };
    }

    // 2. Family Surname Match: Exactly 1 token matches (first or last token / surname)
    const possibleSurnames = [nameParts[0], nameParts[nameParts.length - 1]].filter(Boolean);
    const surnameMatch = possibleSurnames.find((sn) => descLower.includes(sn));
    if (surnameMatch && matchedParts.length === 1) {
      return {
        category: 'Family Support',
        categoryGroup: 'Giving',
        transactionType: isCredit ? 'INCOME' : 'GIVING',
        financialType: isCredit ? 'EXTERNAL_INCOME' : 'GIVING',
        merchant: 'Family Member',
        confidence: 0.92,
        method: 'rule_engine',
        isInternalTransfer: false,
        isInternal: false,
        isExternal: true,
        isRefund: false,
        isRecurring: false,
        isIncome: isCredit,
        isExpense: !isCredit,
        isSavings: false,
        notes: `Surname match "${surnameMatch}" indicates family member transfer`,
        classificationReason: `Surname match "${surnameMatch}" indicates family member transfer`,
      };
    }
  }

  // Memo inspection (e.g. "Transfer to ... | memo" or "Transfer from ... | memo")
  const parts = description.split('|').map((p) => p.trim());
  const memo = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';

  if (memo) {
    // If incoming credit with memo from parent/family
    if (isCredit && (memo.includes('daddy') || memo.includes('mum') || memo.includes('family') || memo.includes('allowance'))) {
      return {
        category: 'Family Support',
        categoryGroup: 'Giving',
        transactionType: 'INCOME',
        merchant: parts[0].replace(/^transfer from /i, ''),
        confidence: 0.96,
        method: 'rule_engine',
        isInternalTransfer: false,
        isRefund: false,
        isRecurring: false,
        isIncome: true,
        isExpense: false,
        isSavings: false,
        notes: 'Family support inflow detected via memo tag',
      };
    }

    // Memo: Fuel (debit)
    if (!isCredit && (memo === 'fuel' || memo === 'petrol' || memo === 'diesel' || memo.includes('petrol'))) {
      return {
        category: 'Fuel',
        categoryGroup: 'Essential Spending',
        transactionType: 'EXPENSE',
        merchant: parts[0].replace(/^transfer to /i, ''),
        confidence: 0.98,
        method: 'rule_engine',
        isInternalTransfer: false,
        isRefund: false,
        isRecurring: false,
        isIncome: false,
        isExpense: true,
        isSavings: false,
        notes: `Classified via transfer memo: "${memo}"`,
      };
    }

    // Memo: Food & dining (debit)
    if (
      !isCredit &&
      (memo === 'food' ||
        memo === 'breaf' ||
        memo.includes('bread') ||
        memo.includes('snack') ||
        memo.includes('lunch') ||
        memo.includes('dinner'))
    ) {
      return {
        category: 'Food Delivery',
        categoryGroup: 'Lifestyle',
        transactionType: 'EXPENSE',
        merchant: parts[0].replace(/^transfer to /i, ''),
        confidence: 0.97,
        method: 'rule_engine',
        isInternalTransfer: false,
        isRefund: false,
        isRecurring: false,
        isIncome: false,
        isExpense: true,
        isSavings: false,
        notes: `Classified via transfer memo: "${memo}"`,
      };
    }

    // Memo: Church / Tithe
    if (memo.includes('tithe') || memo.includes('offering')) {
      return {
        category: 'Church & Tithe',
        categoryGroup: 'Giving',
        transactionType: 'GIVING',
        merchant: parts[0].replace(/^transfer to /i, ''),
        confidence: 0.99,
        method: 'rule_engine',
        isInternalTransfer: false,
        isRefund: false,
        isRecurring: true,
        isIncome: false,
        isExpense: true,
        isSavings: false,
        notes: 'Religious tithe detected via memo tag',
      };
    }

    // Memo: Family / Help
    if (memo === 'help' || memo.includes('allowance') || memo.includes('family') || memo.includes('mum') || memo.includes('dad')) {
      return {
        category: 'Family Support',
        categoryGroup: 'Giving',
        transactionType: isCredit ? 'INCOME' : 'GIVING',
        merchant: parts[0].replace(/^transfer (to|from) /i, ''),
        confidence: 0.97,
        method: 'rule_engine',
        isInternalTransfer: false,
        isRefund: false,
        isRecurring: false,
        isIncome: isCredit,
        isExpense: !isCredit,
        isSavings: false,
        notes: `Family assistance detected from transfer memo "${memo}"`,
      };
    }

    // Memo: Loan repayment
    if (!isCredit && (memo.includes('loan') || memo.includes('debt') || memo.includes('repay'))) {
      return {
        category: 'Loan Repayment',
        categoryGroup: 'Financial',
        transactionType: 'LOAN_REPAYMENT',
        merchant: parts[0].replace(/^transfer to /i, ''),
        confidence: 0.98,
        method: 'rule_engine',
        isInternalTransfer: false,
        isRefund: false,
        isRecurring: false,
        isIncome: false,
        isExpense: false,
        isSavings: false,
        notes: 'Debt repayment identified via transfer memo',
      };
    }

    // Memo: Data
    if (!isCredit && (memo === 'data' || memo.includes('gigabyte') || memo.includes('gb'))) {
      return {
        category: 'Data',
        categoryGroup: 'Essential Spending',
        transactionType: 'EXPENSE',
        merchant: parts[0].replace(/^transfer to /i, ''),
        confidence: 0.98,
        method: 'rule_engine',
        isInternalTransfer: false,
        isRefund: false,
        isRecurring: false,
        isIncome: false,
        isExpense: true,
        isSavings: false,
        notes: 'Mobile data topup memo',
      };
    }

    // Memo: Photocopy / Print / Education
    if (!isCredit && (memo.includes('photocopy') || memo.includes('print') || memo.includes('exam') || memo.includes('school'))) {
      return {
        category: 'Education',
        categoryGroup: 'Essential Spending',
        transactionType: 'EXPENSE',
        merchant: parts[0].replace(/^transfer to /i, ''),
        confidence: 0.95,
        method: 'rule_engine',
        isInternalTransfer: false,
        isRefund: false,
        isRecurring: false,
        isIncome: false,
        isExpense: true,
        isSavings: false,
      };
    }

    // Memo: Hair / Saloon / Personal Care
    if (!isCredit && (memo.includes('hair') || memo.includes('barber') || memo.includes('saloon'))) {
      return {
        category: 'Shopping',
        categoryGroup: 'Lifestyle',
        transactionType: 'EXPENSE',
        merchant: parts[0].replace(/^transfer to /i, ''),
        confidence: 0.94,
        method: 'rule_engine',
        isInternalTransfer: false,
        isRefund: false,
        isRecurring: false,
        isIncome: false,
        isExpense: true,
        isSavings: false,
      };
    }
  }

  // --- TIER 4: AI CONTEXTUAL EVALUATOR FOR AMBIGUOUS TRANSACTIONS ---
  const evaluated = evaluateAmbiguousTransaction(description, isCredit, debit, credit);
  if (isCredit) {
    evaluated.isExpense = false;
  } else {
    evaluated.isIncome = false;
  }
  return evaluated;
}

/**
 * Stage 4: Evaluates ambiguous transactions using semantic heuristics and confidence scoring.
 */
function evaluateAmbiguousTransaction(
  desc: string,
  isCredit: boolean,
  _debit: number,
  _credit: number
): ClassificationResult {
  const d = desc.toLowerCase();

  // If credit and contains company / Ltd / Ventures / Corp / consulting keywords
  if (isCredit) {
    if (d.includes('ltd') || d.includes('limited') || d.includes('ventures') || d.includes('consulting') || d.includes('corp')) {
      return {
        category: 'Business Income',
        categoryGroup: 'Income',
        transactionType: 'INCOME',
        financialType: 'EXTERNAL_INCOME',
        merchant: desc.replace(/^transfer from /i, '').split('|')[0].trim(),
        confidence: 0.85,
        method: 'ai',
        isInternalTransfer: false,
        isInternal: false,
        isExternal: true,
        isRefund: false,
        isRecurring: false,
        isIncome: true,
        isExpense: false,
        isSavings: false,
        notes: 'AI identified corporate/business entity credit inflow',
        classificationReason: 'AI identified corporate/business entity credit inflow',
      };
    }

    // Generic transfer received from an individual
    return {
      category: 'Transfers Received',
      categoryGroup: 'Income',
      transactionType: 'INCOME',
      financialType: 'EXTERNAL_INCOME',
      merchant: desc.replace(/^transfer from /i, '').split('|')[0].trim(),
      confidence: 0.75,
      method: 'ai',
      isInternalTransfer: false,
      isInternal: false,
      isExternal: true,
      isRefund: false,
      isRecurring: false,
      isIncome: true,
      isExpense: false,
      isSavings: false,
      notes: 'AI classified peer transfer received',
      classificationReason: 'AI classified peer transfer received',
    };
  }

  // If debit to person (Transfer to ...)
  if (d.startsWith('transfer to ') || d.includes(' trf to ')) {
    return {
      category: 'Transfers',
      categoryGroup: 'Financial',
      transactionType: 'EXPENSE',
      financialType: 'EXPENSE',
      merchant: desc.replace(/^transfer to /i, '').split('|')[0].trim(),
      confidence: 0.78,
      method: 'ai',
      isInternalTransfer: false,
      isInternal: false,
      isExternal: true,
      isRefund: false,
      isRecurring: false,
      isIncome: false,
      isExpense: true,
      isSavings: false,
      notes: 'AI identified peer outgoing transfer without specific memo',
      classificationReason: 'AI identified peer outgoing transfer without specific memo',
    };
  }

  // Merchant order with unrecognized vendor
  if (d.includes('merchant order') || d.includes('pos purchase') || d.includes('web purchase')) {
    return {
      category: 'Shopping',
      categoryGroup: 'Lifestyle',
      transactionType: 'EXPENSE',
      financialType: 'EXPENSE',
      merchant: desc.split('|')[1]?.trim() || desc.split('-')[0].trim(),
      confidence: 0.70,
      method: 'ai',
      isInternalTransfer: false,
      isInternal: false,
      isExternal: true,
      isRefund: false,
      isRecurring: false,
      isIncome: false,
      isExpense: true,
      isSavings: false,
      notes: 'AI inferred retail merchant order',
      classificationReason: 'AI inferred retail merchant order',
    };
  }

  // Uncategorized Fallback
  return {
    category: 'Uncategorized',
    categoryGroup: 'Other',
    transactionType: 'UNCATEGORIZED',
    financialType: isCredit ? 'EXTERNAL_INCOME' : 'EXPENSE',
    confidence: 0.42,
    method: 'ai',
    isInternalTransfer: false,
    isInternal: false,
    isExternal: true,
    isRefund: false,
    isRecurring: false,
    isIncome: isCredit,
    isExpense: !isCredit,
    isSavings: false,
    notes: 'Could not classify with high confidence. User confirmation recommended.',
    classificationReason: 'Ambiguous transaction fallback',
  };
}

function extractSenderFromTransfer(description: string): string {
  const parts = description.split('|').map((p) => p.trim());
  return parts[0].replace(/^transfer (from|to) /i, '').trim() || description;
}

function extractMerchantFromRefund(description: string): string {
  const parts = description.split('|').map((p) => p.trim());
  for (const part of parts) {
    if (part.toLowerCase().includes('refund')) {
      const cleaned = part.replace(/refund(ed)?/i, '').trim();
      if (cleaned.length > 0) return cleaned;
    }
  }
  const first = parts[0];
  if (first.toLowerCase().includes('reversal')) {
    return first.replace(/^reversal\s*[:-]?\s*/i, '').trim() || 'Refund';
  }
  return parts[0] || 'Refund';
}

function mapCategoryToResult(
  category: TransactionCategory,
  merchant: string | undefined,
  confidence: number,
  method: 'manual',
  isCredit: boolean
): ClassificationResult {
  const isIncome = isCredit;
  const isSavings = category === 'Savings' || category === 'Investment';
  const isInternal = category === 'Transfers';
  const isRefund = category === 'Refund';
  const financialType = isIncome
    ? 'EXTERNAL_INCOME'
    : isSavings
    ? isCredit
      ? 'SAVINGS_WITHDRAWAL'
      : 'SAVINGS_CONTRIBUTION'
    : isInternal
    ? 'INTERNAL_TRANSFER'
    : isRefund
    ? 'REFUND'
    : 'EXPENSE';

  return {
    category,
    categoryGroup: 'Other',
    transactionType: isIncome ? 'INCOME' : isSavings ? 'SAVINGS_TRANSFER' : 'EXPENSE',
    financialType,
    merchant,
    confidence,
    method,
    isInternalTransfer: isInternal,
    isInternal: isInternal || isSavings,
    isExternal: !isInternal && !isSavings,
    isRefund,
    isRecurring: false,
    isIncome,
    isExpense: !isIncome && !isSavings && !isInternal && !isRefund,
    isSavings,
    notes: 'User manually reclassified this transaction',
    classificationReason: 'User manual reclassification',
  };
}
