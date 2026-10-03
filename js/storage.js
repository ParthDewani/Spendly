/* =========================================================
   Spendly — storage.js
   Single source of truth for all LocalStorage read/writes.
   Nothing else in the app should call localStorage directly.
   ========================================================= */

const Storage = (() => {
  const KEYS = {
    transactions: "spendly.transactions",
    budgets: "spendly.budgets",
    categories: "spendly.categories",
    settings: "spendly.settings",
    savingsGoal: "spendly.savingsGoal",
    theme: "spendly.theme",
    initialized: "spendly.initialized",
    dataVersion: "spendly.dataVersion",
  };

  // Fires whenever any data-bearing key (transactions/budgets/categories/
  // settings/savingsGoal) is written. The cloud sync module (a separate ES
  // module) subscribes to this to know when to push local changes up to
  // Firestore, without storage.js needing to know Firestore exists.
  const writeListeners = [];
  function onWrite(callback) {
    writeListeners.push(callback);
  }
  function notifyWrite() {
    writeListeners.forEach((cb) => {
      try { cb(); } catch (e) { console.error("Spendly: onWrite listener failed", e); }
    });
  }

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`Spendly: failed to read ${key}`, e);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn(`Spendly: failed to write ${key}`, e);
      return false;
    }
  }

  // ---- Transactions ----
  function getTransactions() {
    return read(KEYS.transactions, []);
  }
  function saveTransactions(list) {
    const ok = write(KEYS.transactions, list);
    notifyWrite();
    return ok;
  }
  function addTransaction(txn) {
    const list = getTransactions();
    list.push(txn);
    saveTransactions(list);
    return txn;
  }
  function updateTransaction(id, updates) {
    const list = getTransactions();
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates };
    saveTransactions(list);
    return list[idx];
  }
  function deleteTransaction(id) {
    const list = getTransactions().filter((t) => t.id !== id);
    saveTransactions(list);
  }

  // ---- Budgets ----
  // shape: { category: string, limit: number }[]
  function getBudgets() {
    return read(KEYS.budgets, []);
  }
  function saveBudgets(list) {
    const ok = write(KEYS.budgets, list);
    notifyWrite();
    return ok;
  }
  function upsertBudget(category, limit) {
    const list = getBudgets();
    const idx = list.findIndex((b) => b.category === category);
    if (idx === -1) list.push({ category, limit });
    else list[idx].limit = limit;
    saveBudgets(list);
  }
  function deleteBudget(category) {
    saveBudgets(getBudgets().filter((b) => b.category !== category));
  }

  // ---- Categories ----
  // shape: { name: string, icon: string, custom: boolean }[]
  function getCategories() {
    return read(KEYS.categories, []);
  }
  function saveCategories(list) {
    const ok = write(KEYS.categories, list);
    notifyWrite();
    return ok;
  }
  function addCategory(cat) {
    const list = getCategories();
    list.push(cat);
    saveCategories(list);
  }
  function deleteCategory(name) {
    saveCategories(getCategories().filter((c) => c.name !== name));
  }

  // ---- Settings ----
  function getSettings() {
    return read(KEYS.settings, { currency: "INR" });
  }
  function saveSettings(settings) {
    const ok = write(KEYS.settings, settings);
    notifyWrite();
    return ok;
  }

  // ---- Savings goal ----
  function getSavingsGoal() {
    return read(KEYS.savingsGoal, null);
  }
  function saveSavingsGoal(goal) {
    const ok = write(KEYS.savingsGoal, goal);
    notifyWrite();
    return ok;
  }
  function deleteSavingsGoal() {
    localStorage.removeItem(KEYS.savingsGoal);
    notifyWrite();
  }

  // ---- Theme ----
  function getTheme() {
    return read(KEYS.theme, "light");
  }
  function saveTheme(theme) {
    return write(KEYS.theme, theme);
  }

  // ---- Init flag ----
  function isInitialized() {
    return read(KEYS.initialized, false) === true;
  }
  function markInitialized() {
    write(KEYS.initialized, true);
  }

  // ---- Data version (used to force one-time resets across app updates) ----
  function getDataVersion() {
    return read(KEYS.dataVersion, 0);
  }
  function saveDataVersion(v) {
    return write(KEYS.dataVersion, v);
  }

  function clearAll() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  }

  return {
    KEYS,
    onWrite,
    getTransactions, saveTransactions, addTransaction, updateTransaction, deleteTransaction,
    getBudgets, saveBudgets, upsertBudget, deleteBudget,
    getCategories, saveCategories, addCategory, deleteCategory,
    getSettings, saveSettings,
    getSavingsGoal, saveSavingsGoal, deleteSavingsGoal,
    getTheme, saveTheme,
    isInitialized, markInitialized,
    getDataVersion, saveDataVersion,
    clearAll,
  };
})();

// Expose on window too: ES module scripts (like firestore-sync.js) can't see
// plain `const` globals declared in classic scripts, only window properties.
window.Storage = Storage;
