// Phase 3 Classification Pipeline Automated Tests
// Tests deterministic rules, contextual memo heuristics, AI classification fallback, and manual overrides

import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyTransaction, setUserCategoryOverride } from '../src/lib/classification/classifier.ts';

test('1. Deterministic Rule Matching: Food & Dining', () => {
  const chowdeck = classifyTransaction('POS/WEB CHOWDECK RESTAURANT SERVICES LAGOS NG', 5214, 0);
  assert.equal(chowdeck.category, 'Food Delivery');
  assert.equal(chowdeck.categoryGroup, 'Lifestyle');
  assert.equal(chowdeck.method, 'deterministic');
  assert.equal(chowdeck.isExpense, true);
  assert.ok(chowdeck.confidence >= 0.98);

  const dominos = classifyTransaction('POS DOMINOS PIZZA LEKKI PHASE 1 LAGOS', 14200, 0);
  assert.equal(dominos.category, 'Restaurants');
  assert.equal(dominos.method, 'deterministic');
  assert.ok(dominos.confidence >= 0.98);

  const item7 = classifyTransaction('Transfer to ITEM 7 GO Venture - Amilengbe | MONIE POINT', 11000, 0);
  assert.equal(item7.category, 'Restaurants');
  assert.equal(item7.method, 'deterministic');
});

test('2. Deterministic Rule Matching: Transportation & Fuel', () => {
  const bolt = classifyTransaction('OPay Card Payment | Bolt', 2900, 0);
  assert.equal(bolt.category, 'Transportation');
  assert.equal(bolt.method, 'deterministic');
  assert.equal(bolt.isExpense, true);

  const uber = classifyTransaction('POS/WEB UBER NIGERIA TRIP LAGOS', 7800, 0);
  assert.equal(uber.category, 'Transportation');
  assert.equal(uber.method, 'deterministic');

  const total = classifyTransaction('POS PURCHASE TOTAL ENERGIES LEKKI EXP LAGOS', 35000, 0);
  assert.equal(total.category, 'Fuel');
  assert.equal(total.method, 'deterministic');
  assert.equal(total.isExpense, true);

  const bovas = classifyTransaction('Transfer to BOVAS - COMPANY LIMITED - BOVAS AND COMPANY ELEYELE', 20000, 0);
  assert.equal(bovas.category, 'Fuel');
  assert.equal(bovas.method, 'deterministic');
});

test('3. Deterministic Rule Matching: Airtime, Data & Subscriptions', () => {
  const airtime = classifyTransaction('Airtime | 8100398302 | MTN', 1000, 0);
  assert.equal(airtime.category, 'Airtime');
  assert.equal(airtime.method, 'deterministic');

  const data = classifyTransaction('Mobile Data | 8100398302 | MTN | 1.5GB Weekly Plan', 1000, 0);
  assert.equal(data.category, 'Data');
  assert.equal(data.method, 'deterministic');

  const nextgen = classifyTransaction('Transfer to NextGen PG | Sterling Bank | 5258341292', 4500, 0);
  assert.equal(nextgen.category, 'Data');
  assert.equal(nextgen.method, 'deterministic');

  const googlePlay = classifyTransaction('OPay Card Payment | Google Play', 445, 0);
  assert.equal(googlePlay.category, 'Subscriptions');
  assert.equal(googlePlay.method, 'deterministic');
  assert.equal(googlePlay.isRecurring, true);

  const adobe = classifyTransaction('OPay Card Payment | Adobe Nigeria', 4837.5, 0);
  assert.equal(adobe.category, 'Subscriptions');
  assert.equal(adobe.method, 'deterministic');

  const netflix = classifyTransaction('POS/WEB NETFLIX SUBSCRIPTION AMSTERDAM NL', 5000, 0);
  assert.equal(netflix.category, 'Streaming');
  assert.equal(netflix.method, 'deterministic');
});

test('4. Deterministic Rule Matching: Savings Sweeps & Wealth Isolation', () => {
  const piggyvest = classifyTransaction('TRF/DEPOSIT PIGGYVEST CORE SAVINGS AUTOMATION', 150000, 0);
  assert.equal(piggyvest.category, 'Savings');
  assert.equal(piggyvest.isSavings, true);
  assert.equal(piggyvest.isExpense, false, 'Savings sweeps MUST NOT be marked as expense');
  assert.equal(piggyvest.method, 'deterministic');

  const cowrywise = classifyTransaction('TRF/DEPOSIT COWRYWISE MUTUAL FUNDS INVESTMENT', 100000, 0);
  assert.equal(cowrywise.category, 'Investment');
  assert.equal(cowrywise.isSavings, true);
  assert.equal(cowrywise.isExpense, false);

  const autoSave = classifyTransaction('Auto-save to OWealth Balance', 20000, 0);
  assert.equal(autoSave.category, 'Savings');
  assert.equal(autoSave.isSavings, true);
  assert.equal(autoSave.isExpense, false);

  const owealthSweep = classifyTransaction('OWealth Withdrawal(Transaction Payment)', 10000, 0);
  assert.equal(owealthSweep.isInternalTransfer, true, 'OWealth internal sweep must be flagged as internal transfer');
  assert.equal(owealthSweep.isExpense, false);
});

test('5. Deterministic Rule Matching: Betting & Bank Charges', () => {
  const sportybet = classifyTransaction('Betting | 8100398302 | SPORTYBET', 1000, 0);
  assert.equal(sportybet.category, 'Betting & Gambling');
  assert.equal(sportybet.categoryGroup, 'Discretionary');
  assert.equal(sportybet.method, 'deterministic');

  const stampDuty = classifyTransaction('Stamp Duty', 50, 0);
  assert.equal(stampDuty.category, 'Bank Charges');
  assert.equal(stampDuty.categoryGroup, 'Financial');
  assert.equal(stampDuty.isExpense, true);

  const ussd = classifyTransaction('USSD Charge', 10, 0);
  assert.equal(ussd.category, 'Bank Charges');
});

test('6. Deterministic Rule Matching: Refunds & Reversals', () => {
  const boltRefund = classifyTransaction('Transfer from Paystack Payments Limited | OPay | 559****288 | Bolt refunded', 0, 2900);
  assert.equal(boltRefund.category, 'Refund');
  assert.equal(boltRefund.isRefund, true);
  assert.equal(boltRefund.isIncome, false, 'Refund credit MUST NOT be marked as income');
  assert.equal(boltRefund.method, 'deterministic');

  const reversal = classifyTransaction('Reversal - OPay Card Payment', 0, 4710);
  assert.equal(reversal.category, 'Refund');
  assert.equal(reversal.isRefund, true);
  assert.equal(reversal.isIncome, false);
});

test('7. Contextual Rule Engine: Transfer Memos & Surnames', () => {
  // Fuel memo
  const fuelMemo = classifyTransaction('Transfer to IREOLUWA ELIJAH MORAKINYO | OPay | 8144122823 | fuel', 15000, 0);
  assert.equal(fuelMemo.category, 'Fuel');
  assert.equal(fuelMemo.method, 'rule_engine');
  assert.ok(fuelMemo.confidence >= 0.95);

  // Tithe memo & Church
  const titheMemo = classifyTransaction('Transfer to CHRIST HERITAGE MINISTRIES | First Bank Of Nigeria | 2012560686 | tithe', 15000, 0);
  assert.equal(titheMemo.category, 'Church & Tithe');
  assert.equal(titheMemo.categoryGroup, 'Giving');
  assert.equal(titheMemo.method, 'deterministic'); // Christ heritage ministries matched

  // Loan repayment memo
  const loanMemo = classifyTransaction('Transfer to EMMANUEL ENIOLA OLUFAYO | PalmPay | 8081792100 | loan repayment', 4000, 0);
  assert.equal(loanMemo.category, 'Loan Repayment');
  assert.equal(loanMemo.categoryGroup, 'Financial');
  assert.equal(loanMemo.method, 'rule_engine');

  // Same surname assistance
  const familyHelp = classifyTransaction(
    'Transfer to MORAKINYO IREOLUWA ELIJAH | First Bank Of Nigeria | 3224472451 | help',
    10000,
    0,
    undefined,
    'ERIOLUWA JOSEPH MORAKINYO'
  );
  assert.equal(familyHelp.category, 'Family Support');
  assert.equal(familyHelp.categoryGroup, 'Giving');
  assert.equal(familyHelp.method, 'rule_engine');
});

test('8. AI Heuristic Classification for Ambiguous Transactions', () => {
  // Obscure corporate credit
  const corpCredit = classifyTransaction('Transfer from DELOY CONSULTING LTD | First Bank | 204****108', 0, 50000);
  assert.ok(corpCredit.isIncome === true);
  assert.ok(corpCredit.method === 'deterministic' || corpCredit.method === 'ai');

  // Unrecognized merchant purchase
  const obscureMerchant = classifyTransaction('Third-Party Merchant Order | KAFEELAH TEXTILES VENTURES', 15000, 0);
  assert.equal(obscureMerchant.category, 'Shopping');
  assert.equal(obscureMerchant.method, 'ai');
  assert.ok(obscureMerchant.confidence <= 0.85);

  // Completely unknown line
  const unknown = classifyTransaction('MISCELLANEOUS TRANSACTION ADJUSTMENT #99102', 200, 0);
  assert.equal(unknown.category, 'Uncategorized');
  assert.equal(unknown.method, 'ai');
  assert.ok(unknown.confidence < 0.5);
});

test('9. User Manual Reclassification Overrides', () => {
  // Pre-override check
  const before = classifyTransaction('Third-Party Merchant Order | RANDOM VENDOR 99', 5000, 0);
  assert.equal(before.category, 'Shopping');
  assert.equal(before.method, 'ai');

  // Set manual user override
  setUserCategoryOverride('Third-Party Merchant Order | RANDOM VENDOR 99', 'Healthcare', 'Random Vendor Clinic');

  // Post-override check
  const after = classifyTransaction('Third-Party Merchant Order | RANDOM VENDOR 99', 5000, 0);
  assert.equal(after.category, 'Healthcare');
  assert.equal(after.method, 'manual');
  assert.equal(after.confidence, 1.0, 'Manual override must have 100% confidence');
});
