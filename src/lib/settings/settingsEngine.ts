import type { CustomClassificationRule, WorkspaceBackupPayload, WorkspacePreferences } from './types.ts';
import type { ClassificationResult } from '../classification/types.ts';
import type { SpendingCategoryGroup, TransactionType } from '../../types/index.ts';

export const DEFAULT_PREFERENCES: WorkspacePreferences = {
  defaultCurrency: 'NGN',
  maskSensitiveData: true,
  largeTransactionThreshold: 50000,
  themePreference: 'system',
  autoDetectRecurring: true,
  autoDetectSavingsSweeps: true,
  customCategoryBudgets: {
    Food: 60000,
    Groceries: 50000,
    Transportation: 40000,
    Fuel: 35000,
    Utilities: 25000,
    Airtime: 10000,
    Data: 15000,
    Subscriptions: 20000,
    Shopping: 30000,
    Restaurants: 30000,
  },
  customRules: [],
};

const STORAGE_KEY = 'moneylens_workspace_preferences';

/**
 * Loads preferences from localStorage if in a browser environment,
 * falling back to DEFAULT_PREFERENCES.
 */
export function loadWorkspacePreferences(): WorkspacePreferences {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_PREFERENCES };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      customCategoryBudgets: {
        ...DEFAULT_PREFERENCES.customCategoryBudgets,
        ...(parsed.customCategoryBudgets || {}),
      },
      customRules: Array.isArray(parsed.customRules) ? parsed.customRules : [],
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

/**
 * Persists preferences to localStorage if available.
 */
export function saveWorkspacePreferences(prefs: WorkspacePreferences): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Graceful no-op on quota or private browsing restrictions
  }
}

/**
 * Adds a new custom classification rule.
 */
export function addCustomRule(
  prefs: WorkspacePreferences,
  ruleInput: Omit<CustomClassificationRule, 'id' | 'createdAt'>
): { preferences: WorkspacePreferences; newRule: CustomClassificationRule } {
  const newRule: CustomClassificationRule = {
    ...ruleInput,
    id: `crule_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    createdAt: new Date().toISOString(),
  };

  const updatedPrefs: WorkspacePreferences = {
    ...prefs,
    customRules: [newRule, ...prefs.customRules],
  };

  saveWorkspacePreferences(updatedPrefs);
  return { preferences: updatedPrefs, newRule };
}

/**
 * Removes a custom classification rule by ID.
 */
export function deleteCustomRule(
  prefs: WorkspacePreferences,
  ruleId: string
): WorkspacePreferences {
  const updatedPrefs: WorkspacePreferences = {
    ...prefs,
    customRules: prefs.customRules.filter((r) => r.id !== ruleId),
  };

  saveWorkspacePreferences(updatedPrefs);
  return updatedPrefs;
}

/**
 * Toggles or updates the enabled state of a custom classification rule.
 */
export function toggleCustomRule(
  prefs: WorkspacePreferences,
  ruleId: string,
  forceEnabled?: boolean
): WorkspacePreferences {
  const updatedPrefs: WorkspacePreferences = {
    ...prefs,
    customRules: prefs.customRules.map((r) => {
      if (r.id !== ruleId) return r;
      return {
        ...r,
        enabled: forceEnabled !== undefined ? forceEnabled : !r.enabled,
      };
    }),
  };

  saveWorkspacePreferences(updatedPrefs);
  return updatedPrefs;
}

/**
 * Updates a specific category budget ceiling.
 */
export function updateCategoryBudget(
  prefs: WorkspacePreferences,
  category: string,
  limit: number
): WorkspacePreferences {
  const updatedPrefs: WorkspacePreferences = {
    ...prefs,
    customCategoryBudgets: {
      ...prefs.customCategoryBudgets,
      [category]: Math.max(0, limit),
    },
  };

  saveWorkspacePreferences(updatedPrefs);
  return updatedPrefs;
}

/**
 * Evaluates a transaction description against active custom rules.
 * Returns ClassificationResult if a rule matches, or null otherwise.
 */
export function matchCustomRules(
  description: string,
  rules: CustomClassificationRule[],
  isCredit: boolean
): ClassificationResult | null {
  const descLower = description.toLowerCase().trim();

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const patternLower = rule.pattern.toLowerCase().trim();
    let matches = false;

    if (rule.matchType === 'exact') {
      matches = descLower === patternLower;
    } else if (rule.matchType === 'regex') {
      try {
        const re = new RegExp(rule.pattern, 'i');
        matches = re.test(description);
      } catch {
        matches = false;
      }
    } else {
      // Default: contains
      matches = descLower.includes(patternLower);
    }

    if (matches) {
      const category = rule.category;
      let categoryGroup: SpendingCategoryGroup = 'Lifestyle';
      let transactionType: TransactionType = rule.transactionType || (isCredit ? 'INCOME' : 'EXPENSE');

      if (['Salary', 'Client Payment', 'Freelance', 'Business Income', 'Investment Return'].includes(category)) {
        categoryGroup = 'Income';
        transactionType = 'INCOME';
      } else if (['Food', 'Groceries', 'Transportation', 'Fuel', 'Rent', 'Utilities', 'Healthcare', 'Airtime', 'Data'].includes(category)) {
        categoryGroup = 'Essential Spending';
        transactionType = 'EXPENSE';
      } else if (['Savings', 'Investment'].includes(category)) {
        categoryGroup = 'Financial';
        transactionType = isCredit ? 'SAVINGS_WITHDRAWAL' : 'SAVINGS_DEPOSIT';
      } else if (['Transfers'].includes(category)) {
        categoryGroup = 'Financial';
        transactionType = 'INTERNAL_TRANSFER';
      } else if (['Church & Tithe', 'Charity', 'Family Support'].includes(category)) {
        categoryGroup = 'Giving';
        transactionType = isCredit ? 'INCOME' : 'GIVING';
      } else if (['Betting & Gambling', 'Gaming', 'Impulse Spending'].includes(category)) {
        categoryGroup = 'Discretionary';
        transactionType = 'EXPENSE';
      }

      return {
        category,
        categoryGroup,
        transactionType,
        merchant: rule.merchant || rule.pattern,
        confidence: 1.0,
        method: 'manual',
        isInternalTransfer: transactionType === 'INTERNAL_TRANSFER',
        isRefund: transactionType === 'REFUND',
        isRecurring: false,
        isIncome: transactionType === 'INCOME',
        isExpense: ['EXPENSE', 'BANK_CHARGE', 'LOAN_REPAYMENT', 'GIVING'].includes(transactionType),
        isSavings: ['SAVINGS_DEPOSIT', 'SAVINGS_WITHDRAWAL', 'SAVINGS_TRANSFER', 'INVESTMENT_CONTRIBUTION'].includes(transactionType),
        notes: `Custom user rule matched pattern "${rule.pattern}"`,
      };
    }
  }

  return null;
}

/**
 * Creates an exportable JSON backup of workspace preferences and rules.
 */
export function createWorkspaceBackup(prefs: WorkspacePreferences): WorkspaceBackupPayload {
  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    preferences: prefs,
    rulesCount: prefs.customRules.length,
  };
}

/**
 * Validates and restores a workspace backup from JSON.
 */
export function validateAndRestoreBackup(
  jsonString: string
): { success: boolean; preferences?: WorkspacePreferences; error?: string } {
  try {
    const payload = JSON.parse(jsonString) as Partial<WorkspaceBackupPayload>;
    if (!payload.preferences) {
      return { success: false, error: 'Invalid backup file: missing preferences payload.' };
    }

    const restored: WorkspacePreferences = {
      ...DEFAULT_PREFERENCES,
      ...payload.preferences,
      customRules: Array.isArray(payload.preferences.customRules)
        ? payload.preferences.customRules
        : [],
    };

    saveWorkspacePreferences(restored);
    return { success: true, preferences: restored };
  } catch {
    return { success: false, error: 'Corrupt or unreadable JSON backup file.' };
  }
}

/**
 * Clears stored preferences from localStorage and returns defaults.
 */
export function resetWorkspacePreferences(): WorkspacePreferences {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Graceful no-op
    }
  }
  return { ...DEFAULT_PREFERENCES };
}
