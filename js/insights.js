/* =========================================================
   Spendly — insights.js
   Deterministic, rule-based insights computed from stored data.
   ========================================================= */

const InsightsModule = (() => {
  function generateInsights(monthKey) {
    const txns = TransactionsModule.getTransactionsByMonth(monthKey);
    if (txns.length < 3) {
      return [{ type: "info", icon: "sparkles", text: "Add more transactions to unlock personalized insights." }];
    }

    const insights = [];
    const income = TransactionsModule.calculateIncome(monthKey);
    const expenses = TransactionsModule.calculateExpenses(monthKey);
    const byCategory = TransactionsModule.getExpensesByCategory(monthKey);
    const prevMonth = Utils.shiftMonthKey(monthKey, -1);
    const prevExpenses = TransactionsModule.calculateExpenses(prevMonth);

    // Top category share of expenses
    const sortedCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    if (sortedCats.length > 0 && expenses > 0) {
      const [topCat, topAmt] = sortedCats[0];
      const share = Math.round((topAmt / expenses) * 100);
      insights.push({
        type: "info",
        icon: "lightbulb",
        text: `You spent ${share}% of your monthly expenses on ${topCat}.`,
      });
      insights.push({
        type: "info",
        icon: "trending-up",
        text: `Your highest spending category is ${topCat}.`,
      });
    }

    // Month-over-month expense trend
    if (prevExpenses > 0) {
      const change = ((expenses - prevExpenses) / prevExpenses) * 100;
      const rounded = Math.abs(Math.round(change));
      if (Math.abs(change) >= 1) {
        insights.push({
          type: change < 0 ? "positive" : "warning",
          icon: change < 0 ? "trending-down" : "trending-up",
          text: `Your spending ${change < 0 ? "decreased" : "increased"} by ${rounded}% compared with last month.`,
        });
      }
    }

    // Budget warnings
    const progress = BudgetsModule.calculateBudgetProgress(monthKey);
    progress
      .filter((p) => p.status === "exceeded")
      .forEach((p) => {
        insights.push({
          type: "warning",
          icon: "alert-triangle",
          text: `You have exceeded your ${p.category} budget by ${Utils.formatCurrency(p.overBy)}.`,
        });
      });
    progress
      .filter((p) => p.status === "almost")
      .forEach((p) => {
        insights.push({
          type: "warning",
          icon: "alert-circle",
          text: `You're almost at your ${p.category} budget limit (${Math.round(p.pct)}% used).`,
        });
      });

    // Savings rate
    if (income > 0) {
      const rate = Math.round(((income - expenses) / income) * 100);
      if (rate >= 0) {
        insights.push({
          type: "positive",
          icon: "target",
          text: `You saved ${rate}% of your income this month.`,
        });
      } else {
        insights.push({
          type: "warning",
          icon: "alert-triangle",
          text: `You spent ${Math.abs(rate)}% more than you earned this month.`,
        });
      }
    }

    return insights.slice(0, 6);
  }

  return { generateInsights };
})();
