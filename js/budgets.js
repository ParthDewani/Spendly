/* =========================================================
   Spendly — budgets.js
   Budget progress calculation and status classification.
   ========================================================= */

const BudgetsModule = (() => {
  function all() {
    return Storage.getBudgets();
  }

  function upsert(category, limit) {
    Storage.upsertBudget(category, Number(limit));
  }

  function remove(category) {
    Storage.deleteBudget(category);
  }

  // Returns { category, limit, spent, remaining, pct, status }
  function calculateBudgetProgress(monthKey) {
    const spentMap = TransactionsModule.getExpensesByCategory(monthKey);
    return all().map((b) => {
      const spent = spentMap[b.category] || 0;
      const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
      return {
        category: b.category,
        limit: b.limit,
        spent,
        remaining: Math.max(b.limit - spent, 0),
        pct: Math.min(pct, 999),
        status: statusFor(pct),
        overBy: spent > b.limit ? spent - b.limit : 0,
      };
    });
  }

  function statusFor(pct) {
    if (pct > 100) return "exceeded";
    if (pct >= 90) return "almost";
    if (pct >= 70) return "approaching";
    return "ok";
  }

  const STATUS_LABEL = {
    ok: "On track",
    approaching: "Approaching limit",
    almost: "Almost at limit",
    exceeded: "Budget exceeded",
  };

  const STATUS_ICON = {
    ok: "check-circle-2",
    approaching: "alert-circle",
    almost: "alert-triangle",
    exceeded: "octagon-alert",
  };

  return { all, upsert, remove, calculateBudgetProgress, statusFor, STATUS_LABEL, STATUS_ICON };
})();
