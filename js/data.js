/* =========================================================
   Spendly — data.js
   Default categories, icon palette, and first-run sample data.
   ========================================================= */

const SpendlyData = (() => {
  const DEFAULT_CATEGORIES = [
    { name: "Food", icon: "🍔", type: "expense", custom: false },
    { name: "Transport", icon: "🚕", type: "expense", custom: false },
    { name: "Shopping", icon: "🛍️", type: "expense", custom: false },
    { name: "Bills", icon: "🏠", type: "expense", custom: false },
    { name: "Entertainment", icon: "🎬", type: "expense", custom: false },
    { name: "Health", icon: "🏥", type: "expense", custom: false },
    { name: "Education", icon: "📚", type: "expense", custom: false },
    { name: "Salary", icon: "💰", type: "income", custom: false },
    { name: "Freelance", icon: "💻", type: "income", custom: false },
    { name: "Scholarship", icon: "🎓", type: "income", custom: false },
    { name: "Other Income", icon: "💵", type: "income", custom: false },
  ];

  const ICON_PALETTE = [
    "😀", "🍔", "🚕", "🛍️", "🎮", "📚", "🏠", "💻",
    "🎬", "💰", "🏥", "✈️", "🎓", "⚡", "📱", "🎁",
    "🐾", "🧾", "🏋️", "🍿", "🚗", "☕", "🧴", "🎵",
  ];

  // Bump this whenever a stored-data shape or seeding policy changes.
  // Older builds of Spendly auto-seeded demo transactions/budgets/goals;
  // this forces a one-time clean wipe for anyone who already has that
  // leftover sample data sitting in their browser's localStorage.
  const CURRENT_DATA_VERSION = 2;

  function defaultCategories() {
    return DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  }

  function resetToEmpty() {
    Storage.clearAll();
    Storage.saveCategories(defaultCategories());
    Storage.saveTransactions([]);
    Storage.saveBudgets([]);
    Storage.saveSettings({ currency: "INR" });
    Storage.saveDataVersion(CURRENT_DATA_VERSION);
    Storage.markInitialized();
  }

  // First-run (or post-update) initialization. The app is only ever
  // pre-loaded with the default category list so its dropdowns have
  // options — transactions, budgets, and the savings goal all start
  // empty/zero. Nothing is pre-entered.
  function seedIfNeeded() {
    if (Storage.getDataVersion() !== CURRENT_DATA_VERSION) {
      resetToEmpty();
      return;
    }
    if (!Storage.isInitialized()) {
      Storage.saveTransactions([]);
      Storage.saveCategories(defaultCategories());
      Storage.saveBudgets([]);
      Storage.saveSettings({ currency: "INR" });
      Storage.markInitialized();
    }
  }

  return { DEFAULT_CATEGORIES, ICON_PALETTE, defaultCategories, seedIfNeeded };
})();

// Expose on window: the ES-module cloud sync layer needs defaultCategories()
// when resetting local data, and modules can't see classic-script `const` globals.
window.SpendlyData = SpendlyData;
