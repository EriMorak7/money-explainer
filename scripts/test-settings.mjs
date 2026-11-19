import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PREFERENCES,
  addCustomRule,
  deleteCustomRule,
  toggleCustomRule,
  updateCategoryBudget,
  matchCustomRules,
  createWorkspaceBackup,
  validateAndRestoreBackup,
  resetWorkspacePreferences,
} from '../src/lib/settings/settingsEngine.ts';
import {
  classifyTransaction,
  setActiveCustomRules,
} from '../src/lib/classification/classifier.ts';

describe('Phase 15: Preferences & Workspace Settings Engine', () => {
  it('1. Default Preferences Integrity', () => {
    assert.equal(DEFAULT_PREFERENCES.defaultCurrency, 'NGN');
    assert.equal(DEFAULT_PREFERENCES.maskSensitiveData, true);
    assert.equal(DEFAULT_PREFERENCES.largeTransactionThreshold, 50000);
    assert.equal(DEFAULT_PREFERENCES.autoDetectRecurring, true);
    assert.equal(DEFAULT_PREFERENCES.autoDetectSavingsSweeps, true);
    assert.ok(DEFAULT_PREFERENCES.customCategoryBudgets.Food > 0);
    assert.ok(DEFAULT_PREFERENCES.customCategoryBudgets.Groceries > 0);
  });

  it('2. Custom Rule Management (Add, Toggle, Delete)', () => {
    let prefs = { ...DEFAULT_PREFERENCES, customRules: [] };

    // Add Rule
    const { preferences: withRule, newRule } = addCustomRule(prefs, {
      pattern: 'CROSSFIT LAGOS',
      matchType: 'contains',
      category: 'Entertainment',
      merchant: 'CrossFit Gym',
      transactionType: 'EXPENSE',
      enabled: true,
    });

    assert.equal(withRule.customRules.length, 1);
    assert.equal(newRule.pattern, 'CROSSFIT LAGOS');
    assert.equal(newRule.merchant, 'CrossFit Gym');
    assert.equal(newRule.enabled, true);

    // Toggle Rule
    const disabled = toggleCustomRule(withRule, newRule.id, false);
    assert.equal(disabled.customRules[0].enabled, false);

    const reEnabled = toggleCustomRule(disabled, newRule.id, true);
    assert.equal(reEnabled.customRules[0].enabled, true);

    // Delete Rule
    const deleted = deleteCustomRule(reEnabled, newRule.id);
    assert.equal(deleted.customRules.length, 0);
  });

  it('3. Custom Rule Matching: Substring, Exact, and RegEx Matching', () => {
    const rules = [
      {
        id: 'r1',
        pattern: 'special client pay',
        matchType: 'contains',
        category: 'Client Payment',
        merchant: 'Client X',
        transactionType: 'INCOME',
        enabled: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'r2',
        pattern: 'exact transfer to sister',
        matchType: 'exact',
        category: 'Family Support',
        merchant: 'Sister',
        transactionType: 'GIVING',
        enabled: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'r3',
        pattern: '^uber\\s+trip\\s+[0-9]+$',
        matchType: 'regex',
        category: 'Transportation',
        merchant: 'Uber Ride',
        transactionType: 'EXPENSE',
        enabled: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'r4',
        pattern: 'disabled keyword',
        matchType: 'contains',
        category: 'Shopping',
        enabled: false,
        createdAt: new Date().toISOString(),
      },
    ];

    // Contains match
    const match1 = matchCustomRules('Transfer from special client pay invoice 99', rules, true);
    assert.ok(match1);
    assert.equal(match1.category, 'Client Payment');
    assert.equal(match1.merchant, 'Client X');
    assert.equal(match1.isIncome, true);

    // Exact match
    const matchExact = matchCustomRules('exact transfer to sister', rules, false);
    assert.ok(matchExact);
    assert.equal(matchExact.category, 'Family Support');

    const matchExactFail = matchCustomRules('exact transfer to sister extra text', rules, false);
    assert.equal(matchExactFail, null);

    // RegEx match
    const matchRegex = matchCustomRules('uber trip 98124', rules, false);
    assert.ok(matchRegex);
    assert.equal(matchRegex.category, 'Transportation');
    assert.equal(matchRegex.merchant, 'Uber Ride');

    // Disabled rule is ignored
    const matchDisabled = matchCustomRules('this has disabled keyword in it', rules, false);
    assert.equal(matchDisabled, null);
  });

  it('4. Custom Rules Take Tier-1 Priority in Classifier', () => {
    const customRule = {
      id: 'r_prio',
      pattern: 'netflix.com',
      matchType: 'contains',
      category: 'Education', // Override standard Streaming to Education
      merchant: 'Educational Netflix Doc',
      transactionType: 'EXPENSE',
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    setActiveCustomRules([customRule]);

    const result = classifyTransaction('Payment to NETFLIX.COM 12345', 4500, 0);
    assert.equal(result.category, 'Education', 'Custom user rule overrides default dictionary classification');
    assert.equal(result.merchant, 'Educational Netflix Doc');
    assert.equal(result.method, 'manual');

    // Clear active custom rules after test
    setActiveCustomRules([]);
  });

  it('5. Workspace Backup Export & Restore Cycle', () => {
    const prefs = {
      ...DEFAULT_PREFERENCES,
      defaultCurrency: 'USD',
      largeTransactionThreshold: 75000,
      customRules: [
        {
          id: 'b1',
          pattern: 'AWS Cloud Hosting',
          matchType: 'contains',
          category: 'Utilities',
          merchant: 'Amazon Web Services',
          transactionType: 'EXPENSE',
          enabled: true,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    // Export
    const backup = createWorkspaceBackup(prefs);
    assert.equal(backup.version, '1.0.0');
    assert.equal(backup.rulesCount, 1);
    assert.equal(backup.preferences.defaultCurrency, 'USD');

    // Restore valid
    const jsonStr = JSON.stringify(backup);
    const restored = validateAndRestoreBackup(jsonStr);
    assert.equal(restored.success, true);
    assert.equal(restored.preferences?.defaultCurrency, 'USD');
    assert.equal(restored.preferences?.customRules.length, 1);
    assert.equal(restored.preferences?.customRules[0].pattern, 'AWS Cloud Hosting');

    // Reject corrupted JSON
    const corrupt = validateAndRestoreBackup('{"corrupt": invalid}');
    assert.equal(corrupt.success, false);
    assert.ok(corrupt.error?.includes('Corrupt') || corrupt.error?.includes('JSON'));
  });

  it('6. Category Budget Ceiling Updates & Factory Reset', () => {
    let prefs = { ...DEFAULT_PREFERENCES };

    // Update Category Budget
    prefs = updateCategoryBudget(prefs, 'Food', 85000);
    assert.equal(prefs.customCategoryBudgets.Food, 85000);

    // Negative ceiling clamped to 0
    prefs = updateCategoryBudget(prefs, 'Transportation', -500);
    assert.equal(prefs.customCategoryBudgets.Transportation, 0);

    // Factory Reset
    const reset = resetWorkspacePreferences();
    assert.equal(reset.defaultCurrency, 'NGN');
    assert.equal(reset.customRules.length, 0);
    assert.equal(reset.customCategoryBudgets.Food, 60000);
  });
});
