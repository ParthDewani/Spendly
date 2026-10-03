/* =========================================================
   Spendly — app.js
   Wires up UI events, renders every view, owns transient state
   (current view, selected month, filters, modal state).
   ========================================================= */

(function App() {
  "use strict";

  const state = {
    view: "dashboard",
    month: null,
    filters: { search: "", type: "all", category: "all", dateRange: "all", sort: "newest" },
    pendingDeleteId: null,
    pendingBudgetCategory: null,
    editingGoal: false,
    selectedCategoryIcon: SpendlyData.ICON_PALETTE[0],
    selectedCategoryType: "expense",
    importRows: [],
    authUser: null,
    authMode: "signin", // "signin" | "signup"
  };

  // ---------------------------------------------------------
  // Init
  // ---------------------------------------------------------
  function init() {
    SpendlyData.seedIfNeeded();
    applyTheme(Storage.getTheme());
    setGreeting();
    checkProtocolWarning();
    state.month = TransactionsModule.availableMonths()[0];

    bindNav();
    bindMobileNav();
    bindThemeToggle();
    bindMonthSelector();
    bindModals();
    bindTransactionForm();
    bindBudgetForm();
    bindCategoryForm();
    bindGoalForm();
    bindImport();
    bindSettingsActions();
    bindNotifButton();
    bindDeleteModal();
    initAuthUI();
    bindCloudSyncEvents();

    refreshIcons();
    populateMonthSelector();
    switchView("dashboard");
  }

  function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
  }

  function setGreeting() {
    const hour = new Date().getHours();
    const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
    const el = document.getElementById("greetingText");
    if (state.authUser) {
      el.innerHTML = `Good ${part}, ${Utils.escapeHtml(authDisplayName(state.authUser))} <span class="wave">👋</span>`;
    } else {
      el.innerHTML = `Good ${part} <span class="wave">👋</span>`;
    }
  }

  function checkProtocolWarning() {
    if (window.location.protocol !== "file:") return;
    const banner = document.getElementById("protocolWarning");
    banner.hidden = false;
    document.getElementById("dismissProtocolWarning").addEventListener("click", () => {
      banner.hidden = true;
    });
  }

  // ---------------------------------------------------------
  // Theme
  // ---------------------------------------------------------
  function applyTheme(theme) {
    document.body.setAttribute("data-theme", theme);
    document.getElementById("themeToggleLabel").textContent = theme === "dark" ? "Dark mode" : "Light mode";
    document.querySelectorAll(".appearance-option").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.themeChoice === theme);
    });
  }

  function bindThemeToggle() {
    document.getElementById("themeToggle").addEventListener("click", () => {
      const next = Storage.getTheme() === "dark" ? "light" : "dark";
      Storage.saveTheme(next);
      applyTheme(next);
      renderCurrentView(); // charts need re-render for theme colors
    });

    document.querySelectorAll("[data-theme-choice]").forEach((btn) => {
      btn.addEventListener("click", () => {
        Storage.saveTheme(btn.dataset.themeChoice);
        applyTheme(btn.dataset.themeChoice);
        renderCurrentView();
      });
    });
  }

  // ---------------------------------------------------------
  // Navigation / views
  // ---------------------------------------------------------
  function bindNav() {
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => switchView(btn.dataset.view));
    });
    document.querySelectorAll("[data-view-link]").forEach((btn) => {
      btn.addEventListener("click", () => switchView(btn.dataset.viewLink));
    });
  }

  function bindMobileNav() {
    const sidebar = document.getElementById("sidebar");
    const scrim = document.getElementById("sidebarScrim");
    const openBtn = document.getElementById("mobileMenuBtn");
    const addBtn = document.getElementById("mobileAddBtn");

    function open() {
      sidebar.classList.add("is-open");
      scrim.classList.add("is-open");
      openBtn.setAttribute("aria-expanded", "true");
    }
    function close() {
      sidebar.classList.remove("is-open");
      scrim.classList.remove("is-open");
      openBtn.setAttribute("aria-expanded", "false");
    }
    openBtn.addEventListener("click", () => {
      sidebar.classList.contains("is-open") ? close() : open();
    });
    scrim.addEventListener("click", close);
    document.querySelectorAll(".nav-item").forEach((btn) => btn.addEventListener("click", close));
    addBtn.addEventListener("click", () => openTransactionModal());
  }

  function switchView(view) {
    state.view = view;
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("is-active", b.dataset.view === view));
    document.querySelectorAll("[data-view-panel]").forEach((panel) => {
      panel.hidden = panel.id !== `view-${view}`;
    });
    renderCurrentView();
  }

  function renderCurrentView() {
    switch (state.view) {
      case "dashboard": return renderDashboard();
      case "transactions": return renderTransactionsPage();
      case "budgets": return renderBudgetsPage();
      case "analytics": return renderAnalyticsPage();
      case "settings": return renderSettingsPage();
    }
  }

  function refreshAfterDataChange() {
    populateMonthSelector();
    renderCurrentView();
  }

  // ---------------------------------------------------------
  // Month selector
  // ---------------------------------------------------------
  function bindMonthSelector() {
    document.getElementById("monthSelector").addEventListener("change", (e) => {
      state.month = e.target.value;
      renderCurrentView();
    });
  }

  function populateMonthSelector() {
    const sel = document.getElementById("monthSelector");
    const months = TransactionsModule.availableMonths();
    if (!months.includes(state.month)) state.month = months[0];
    sel.innerHTML = months.map((m) => `<option value="${m}">${Utils.monthKeyToLabel(m)}</option>`).join("");
    sel.value = state.month;
  }

  // ---------------------------------------------------------
  // Category helpers
  // ---------------------------------------------------------
  function categoriesByType(type) {
    return Storage.getCategories().filter((c) => c.type === type);
  }
  function findCategory(name) {
    return Storage.getCategories().find((c) => c.name === name);
  }
  function categoryIcon(name) {
    const c = findCategory(name);
    return c ? c.icon : "💳";
  }
  function populateCategorySelect(selectEl, type, selected) {
    const cats = categoriesByType(type);
    selectEl.innerHTML = cats.map((c) => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join("");
    if (selected) selectEl.value = selected;
  }

  // =========================================================
  // DASHBOARD
  // =========================================================
  function renderDashboard() {
    const m = state.month;
    const prevM = Utils.shiftMonthKey(m, -1);

    const income = TransactionsModule.calculateIncome(m);
    const expenses = TransactionsModule.calculateExpenses(m);
    const balance = income - expenses;
    const savingsRate = TransactionsModule.calculateSavingsRate(m);

    const prevIncome = TransactionsModule.calculateIncome(prevM);
    const prevExpenses = TransactionsModule.calculateExpenses(prevM);
    const prevBalance = prevIncome - prevExpenses;

    setStat("statBalance", Utils.formatCurrency(balance), "statBalanceDelta", Utils.percentChange(balance, prevBalance), "from last month");
    setStat("statIncome", Utils.formatCurrency(income), "statIncomeDelta", Utils.percentChange(income, prevIncome), "from last month");
    setStat("statExpenses", Utils.formatCurrency(expenses), "statExpensesDelta", Utils.percentChange(expenses, prevExpenses), "from last month", true);

    const savingsEl = document.getElementById("statSavings");
    savingsEl.textContent = `${Math.round(savingsRate)}%`;
    const savingsDelta = document.getElementById("statSavingsDelta");
    savingsDelta.textContent = savingsRate >= 50 ? "Excellent" : savingsRate >= 20 ? "Good" : savingsRate >= 0 ? "Needs attention" : "Overspending";
    savingsDelta.className = "stat-card__delta " + (savingsRate >= 20 ? "is-up" : savingsRate < 0 ? "is-down" : "");

    // Spending doughnut
    const byCat = TransactionsModule.getExpensesByCategory(m);
    const hasSpending = Object.keys(byCat).length > 0;
    document.getElementById("emptySpendingOverview").hidden = hasSpending;
    document.getElementById("chartSpendingOverview").style.visibility = hasSpending ? "visible" : "hidden";
    if (hasSpending) ChartsModule.renderDoughnut("chartSpendingOverview", byCat);
    else ChartsModule.destroy("chartSpendingOverview");

    // Income vs expense bar (last 6 months)
    const months = TransactionsModule.lastNMonths(6, m);
    ChartsModule.renderGroupedBar(
      "chartIncomeExpense",
      months.map(Utils.monthKeyToShortLabel),
      months.map((mm) => TransactionsModule.calculateIncome(mm)),
      months.map((mm) => TransactionsModule.calculateExpenses(mm))
    );

    renderInsights(m);
    renderGoalCard();
    renderRecentTransactions(m);
    refreshIcons();
  }

  function setStat(valueId, valueText, deltaId, pct, suffix, invert) {
    document.getElementById(valueId).textContent = valueText;
    const el = document.getElementById(deltaId);
    if (pct === null) {
      el.textContent = "No data last month";
      el.className = "stat-card__delta";
      return;
    }
    const rounded = Math.round(pct * 10) / 10;
    const positive = invert ? rounded < 0 : rounded > 0;
    const arrow = rounded >= 0 ? "+" : "";
    el.textContent = `${arrow}${rounded}% ${suffix}`;
    el.className = "stat-card__delta " + (rounded === 0 ? "" : positive ? "is-up" : "is-down");
  }

  function renderInsights(m) {
    const list = document.getElementById("insightList");
    const insights = InsightsModule.generateInsights(m);
    list.innerHTML = insights
      .map(
        (i) => `<li class="insight-item ${i.type === "warning" ? "is-warning" : i.type === "positive" ? "is-positive" : ""}">
          <span class="insight-item__icon"><i data-lucide="${i.icon}"></i></span>
          <span>${Utils.escapeHtml(i.text)}</span>
        </li>`
      )
      .join("");
    refreshIcons();
  }

  function renderGoalCard() {
    const goal = Storage.getSavingsGoal();
    const el = document.getElementById("goalContent");
    if (!goal) {
      el.innerHTML = emptyStateHtml("target", "No savings goal yet", "Set a target and track your progress toward it.", "+ Add Savings Goal", "openGoal");
      bindEmptyStateAction(el, () => openGoalModal());
      return;
    }
    const pct = goal.target > 0 ? Utils.clamp((goal.saved / goal.target) * 100, 0, 100) : 0;
    el.innerHTML = `
      <p class="goal-card__name">${Utils.escapeHtml(goal.name)}</p>
      <div class="goal-card__amounts">
        <span class="goal-card__saved">${Utils.formatCurrency(goal.saved)}</span>
        <span class="goal-card__target">saved of ${Utils.formatCurrency(goal.target)} goal</span>
      </div>
      <div class="progress-bar"><div class="progress-bar__fill" style="width:${pct}%"></div></div>
      <p class="goal-card__pct">${pct.toFixed(1)}% complete</p>
      <div class="goal-card__actions">
        <button class="btn btn--ghost btn--small" data-action="edit-goal">Edit Goal</button>
      </div>
    `;
    el.querySelector("[data-action='edit-goal']").addEventListener("click", () => openGoalModal());
  }

  function emptyStateHtml(icon, title, text, actionLabel, actionKey) {
    return `<div class="empty-state">
      <i data-lucide="${icon}"></i>
      <h3>${Utils.escapeHtml(title)}</h3>
      <p>${Utils.escapeHtml(text)}</p>
      ${actionLabel ? `<button class="btn btn--primary btn--small" data-empty-action="${actionKey}">${Utils.escapeHtml(actionLabel)}</button>` : ""}
    </div>`;
  }
  function bindEmptyStateAction(container, handler) {
    const btn = container.querySelector("[data-empty-action]");
    if (btn) btn.addEventListener("click", handler);
    refreshIcons();
  }

  function renderRecentTransactions(m) {
    const el = document.getElementById("recentTransactionsList");
    const recent = TransactionsModule.recentTransactions(m, 7);
    if (recent.length === 0) {
      el.innerHTML = emptyStateHtml("receipt", "No transactions found", "You haven't added any transactions for this month.", "+ Add Transaction", "addTxn");
      bindEmptyStateAction(el, () => openTransactionModal());
      return;
    }
    el.innerHTML = recent
      .map((t) => txnRowHtml(t))
      .join("");
    refreshIcons();
  }

  function txnRowHtml(t) {
    const isIncome = t.type === "income";
    return `<div class="txn-row">
      <div class="txn-row__icon">${categoryIcon(t.category)}</div>
      <div class="txn-row__body">
        <p class="txn-row__desc">${Utils.escapeHtml(t.description)}</p>
        <p class="txn-row__meta">${Utils.escapeHtml(t.category)} · ${Utils.relativeDateLabel(t.date)}</p>
      </div>
      <div class="txn-row__amount ${isIncome ? "is-income" : "is-expense"}">${isIncome ? "+" : "-"}${Utils.formatCurrency(t.amount)}</div>
    </div>`;
  }

  // =========================================================
  // TRANSACTIONS PAGE
  // =========================================================
  function bindTransactionsPageControls() {
    const search = document.getElementById("searchInput");
    search.addEventListener("input", Utils.debounce((e) => {
      state.filters.search = e.target.value;
      renderTransactionsPage(false);
    }, 200));

    document.getElementById("filterType").addEventListener("change", (e) => {
      state.filters.type = e.target.value;
      renderTransactionsPage(false);
    });
    document.getElementById("filterCategory").addEventListener("change", (e) => {
      state.filters.category = e.target.value;
      renderTransactionsPage(false);
    });
    document.getElementById("filterDate").addEventListener("change", (e) => {
      state.filters.dateRange = e.target.value;
      renderTransactionsPage(false);
    });
    document.getElementById("sortBy").addEventListener("change", (e) => {
      state.filters.sort = e.target.value;
      renderTransactionsPage(false);
    });

    document.getElementById("exportCsvBtn").addEventListener("click", () => {
      TransactionsModule.downloadCsv();
      Utils.showToast("Transactions exported to CSV");
    });
    document.getElementById("importCsvBtn").addEventListener("click", () => openImportModal());
  }

  let transactionsControlsBound = false;
  function renderTransactionsPage(refreshControls = true) {
    if (!transactionsControlsBound) {
      bindTransactionsPageControls();
      transactionsControlsBound = true;
    }

    // Populate category filter (once per render, cheap)
    const catSelect = document.getElementById("filterCategory");
    const allCats = Storage.getCategories();
    const currentVal = state.filters.category;
    catSelect.innerHTML = `<option value="all">All categories</option>` + allCats.map((c) => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join("");
    catSelect.value = currentVal;

    document.getElementById("searchInput").value = state.filters.search;
    document.getElementById("filterType").value = state.filters.type;
    document.getElementById("filterDate").value = state.filters.dateRange;
    document.getElementById("sortBy").value = state.filters.sort;

    const rows = TransactionsModule.filterAndSort(state.filters);
    const wrap = document.getElementById("transactionsTableWrap");

    if (rows.length === 0) {
      wrap.innerHTML = emptyStateHtml("search-x", "No transactions found", "Try adjusting your search or filters.", null, null);
      refreshIcons();
      return;
    }

    const tableRows = rows.map((t) => {
      const isIncome = t.type === "income";
      return `<tr data-id="${t.id}">
        <td>
          <div class="data-table__desc-cell">
            <span class="txn-row__icon">${categoryIcon(t.category)}</span>
            <span>${Utils.escapeHtml(t.description)}</span>
          </div>
        </td>
        <td>${Utils.escapeHtml(t.category)}</td>
        <td>${Utils.formatDateLong(t.date)}</td>
        <td><span class="pill pill--${t.type}">${isIncome ? "Income" : "Expense"}</span></td>
        <td class="data-table__amount ${isIncome ? "is-income" : "is-expense"}">${isIncome ? "+" : "-"}${Utils.formatCurrency(t.amount)}</td>
        <td>
          <div class="row-actions">
            <button data-action="edit" aria-label="Edit"><i data-lucide="pencil"></i></button>
            <button data-action="delete" aria-label="Delete"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>`;
    }).join("");

    const cards = rows.map((t) => {
      const isIncome = t.type === "income";
      return `<div class="txn-card" data-id="${t.id}">
        <div class="txn-card__top">
          <span class="txn-row__icon">${categoryIcon(t.category)}</span>
          <div>
            <p class="txn-card__desc">${Utils.escapeHtml(t.description)}</p>
            <p class="txn-card__meta">${Utils.escapeHtml(t.category)} · ${Utils.formatDateLong(t.date)}</p>
          </div>
          <span class="txn-card__amount ${isIncome ? "is-income" : "is-expense"}">${isIncome ? "+" : "-"}${Utils.formatCurrency(t.amount)}</span>
        </div>
        <div class="txn-card__bottom">
          <span class="pill pill--${t.type}">${isIncome ? "Income" : "Expense"}</span>
          <div class="row-actions">
            <button data-action="edit" aria-label="Edit"><i data-lucide="pencil"></i></button>
            <button data-action="delete" aria-label="Delete"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
      </div>`;
    }).join("");

    wrap.innerHTML = `
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Transaction</th><th>Category</th><th>Date</th><th>Type</th><th>Amount</th><th>Actions</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      <div class="txn-cards">${cards}</div>
    `;

    wrap.querySelectorAll("[data-action='edit']").forEach((btn) => {
      btn.addEventListener("click", (e) => openTransactionModal(e.target.closest("[data-id]").dataset.id));
    });
    wrap.querySelectorAll("[data-action='delete']").forEach((btn) => {
      btn.addEventListener("click", (e) => openDeleteModal(e.target.closest("[data-id]").dataset.id));
    });

    refreshIcons();
  }

  // =========================================================
  // BUDGETS PAGE
  // =========================================================
  function renderBudgetsPage() {
    const grid = document.getElementById("budgetGrid");
    const progress = BudgetsModule.calculateBudgetProgress(state.month);

    if (progress.length === 0) {
      grid.innerHTML = emptyStateHtml("pie-chart", "No budgets set", "Create a monthly budget to start tracking your spending limits.", "+ Set Budget", "addBudget");
      bindEmptyStateAction(grid, () => openBudgetModal());
      return;
    }

    grid.innerHTML = progress.map((p) => {
      const label = BudgetsModule.STATUS_LABEL[p.status];
      const icon = BudgetsModule.STATUS_ICON[p.status];
      const statusText = p.status === "exceeded" ? `Budget exceeded by ${Utils.formatCurrency(p.overBy)}` : label;
      return `<div class="budget-card" data-category="${Utils.escapeHtml(p.category)}">
        <div class="budget-card__top">
          <span class="budget-card__icon">${categoryIcon(p.category)}</span>
          <span class="budget-card__name">${Utils.escapeHtml(p.category)}</span>
          <button class="budget-card__edit" data-action="edit-budget" aria-label="Edit budget"><i data-lucide="pencil"></i></button>
        </div>
        <p class="budget-card__amounts"><strong>${Utils.formatCurrency(p.spent)}</strong> / ${Utils.formatCurrency(p.limit)}</p>
        <div class="progress-bar"><div class="progress-bar__fill is-${p.status}" style="width:${Math.min(p.pct, 100)}%"></div></div>
        <p class="budget-card__status status-${p.status}"><i data-lucide="${icon}"></i> ${statusText}</p>
      </div>`;
    }).join("");

    grid.querySelectorAll("[data-action='edit-budget']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const category = e.target.closest("[data-category]").dataset.category;
        openBudgetModal(category);
      });
    });

    refreshIcons();
  }

  // =========================================================
  // ANALYTICS PAGE
  // =========================================================
  function renderAnalyticsPage() {
    const m = state.month;
    const byCat = TransactionsModule.getExpensesByCategory(m);

    if (Object.keys(byCat).length > 0) ChartsModule.renderDoughnut("chartAnalyticsCategory", byCat);
    else ChartsModule.destroy("chartAnalyticsCategory");

    const months = TransactionsModule.lastNMonths(6, m);
    const labels = months.map(Utils.monthKeyToShortLabel);
    const expensesSeries = months.map((mm) => TransactionsModule.calculateExpenses(mm));
    const incomeSeries = months.map((mm) => TransactionsModule.calculateIncome(mm));
    const savingsSeries = months.map((mm) => TransactionsModule.calculateSavingsRate(mm));

    ChartsModule.renderLine("chartAnalyticsTrend", labels, [{ label: "Spending", data: expensesSeries, color: ChartsModule.PALETTE[2] }]);
    ChartsModule.renderGroupedBar("chartAnalyticsIncomeExpense", labels, incomeSeries, expensesSeries);
    ChartsModule.renderLine("chartSavingsTrend", labels, [{ label: "Savings rate %", data: savingsSeries.map((v) => Math.round(v)), color: ChartsModule.PALETTE[1] }]);

    const topList = document.getElementById("topCategoriesList");
    const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxVal = sorted.length ? sorted[0][1] : 1;
    if (sorted.length === 0) {
      topList.innerHTML = emptyStateHtml("bar-chart-3", "No spending yet", "Categories will rank here once you log expenses this month.", null, null);
    } else {
      topList.innerHTML = sorted.map(([cat, amt], i) => `
        <li class="rank-item">
          <span class="rank-item__num">${i + 1}</span>
          <div class="rank-item__bar-wrap">
            <div class="rank-item__label"><strong>${Utils.escapeHtml(cat)}</strong><span class="rank-item__amount">${Utils.formatCurrency(amt)}</span></div>
            <div class="progress-bar"><div class="progress-bar__fill" style="width:${(amt / maxVal) * 100}%"></div></div>
          </div>
        </li>`).join("");
    }
    refreshIcons();
  }

  // =========================================================
  // SETTINGS PAGE
  // =========================================================
  function renderSettingsPage() {
    applyTheme(Storage.getTheme());
    renderCategoryList();
    renderSettingsGoal();
  }

  function renderCategoryList() {
    const el = document.getElementById("categoryList");
    const cats = Storage.getCategories();
    const txns = TransactionsModule.all();
    const budgets = BudgetsModule.all();

    el.innerHTML = cats.map((c) => {
      const inUse = txns.some((t) => t.category === c.name) || budgets.some((b) => b.category === c.name);
      const disabled = inUse ? "disabled" : "";
      const title = inUse ? "title=\"Category is in use and can't be deleted\"" : "";
      return `<div class="category-row" data-name="${Utils.escapeHtml(c.name)}">
        <span class="category-row__icon">${c.icon}</span>
        <span class="category-row__name">${Utils.escapeHtml(c.name)}</span>
        <span class="category-row__badge">${c.type === "income" ? "Income" : "Expense"}</span>
        <button data-action="delete-category" ${disabled} ${title} aria-label="Delete category"><i data-lucide="trash-2"></i></button>
      </div>`;
    }).join("");

    el.querySelectorAll("[data-action='delete-category']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const name = e.target.closest("[data-name]").dataset.name;
        Storage.deleteCategory(name);
        Utils.showToast("Category deleted");
        renderCategoryList();
      });
    });
    refreshIcons();
  }

  function renderSettingsGoal() {
    const goal = Storage.getSavingsGoal();
    const el = document.getElementById("settingsGoalContent");
    if (!goal) {
      el.innerHTML = emptyStateHtml("target", "No savings goal yet", "Set a target and track your progress toward it.", "+ Add Savings Goal", "openGoal");
      bindEmptyStateAction(el, () => openGoalModal());
      return;
    }
    const pct = goal.target > 0 ? Utils.clamp((goal.saved / goal.target) * 100, 0, 100) : 0;
    el.innerHTML = `
      <p class="goal-card__name">${Utils.escapeHtml(goal.name)}</p>
      <div class="goal-card__amounts">
        <span class="goal-card__saved">${Utils.formatCurrency(goal.saved)}</span>
        <span class="goal-card__target">saved of ${Utils.formatCurrency(goal.target)} goal</span>
      </div>
      <div class="progress-bar"><div class="progress-bar__fill" style="width:${pct}%"></div></div>
      <p class="goal-card__pct">${pct.toFixed(1)}% complete</p>
      <div class="goal-card__actions">
        <button class="btn btn--ghost btn--small" data-action="edit-goal">Edit Goal</button>
      </div>
    `;
    el.querySelector("[data-action='edit-goal']").addEventListener("click", () => openGoalModal());
  }

  function bindSettingsActions() {
    document.getElementById("addCategoryBtn").addEventListener("click", () => openCategoryModal());
    document.getElementById("addBudgetBtn").addEventListener("click", () => openBudgetModal());
    document.getElementById("addTransactionBtn").addEventListener("click", () => openTransactionModal());

    document.getElementById("settingsExportBtn").addEventListener("click", () => {
      const payload = {
        transactions: Storage.getTransactions(),
        budgets: Storage.getBudgets(),
        categories: Storage.getCategories(),
        settings: Storage.getSettings(),
        savingsGoal: Storage.getSavingsGoal(),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "spendly-data.json";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      Utils.showToast("Data exported");
    });

    const importInput = document.createElement("input");
    importInput.type = "file";
    importInput.accept = "application/json";
    importInput.hidden = true;
    document.body.appendChild(importInput);
    document.getElementById("settingsImportBtn").addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", () => {
      const file = importInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (data.transactions) Storage.saveTransactions(data.transactions);
          if (data.budgets) Storage.saveBudgets(data.budgets);
          if (data.categories) Storage.saveCategories(data.categories);
          if (data.settings) Storage.saveSettings(data.settings);
          if (data.savingsGoal) Storage.saveSavingsGoal(data.savingsGoal);
          Storage.markInitialized();
          Utils.showToast("Data imported successfully");
          refreshAfterDataChange();
        } catch (err) {
          Utils.showToast("Couldn't read that file. Please choose a valid Spendly export.", "danger");
        }
      };
      reader.readAsText(file);
      importInput.value = "";
    });

    document.getElementById("clearDataBtn").addEventListener("click", () => openModal("clearDataModalOverlay"));
    document.getElementById("confirmClearDataBtn").addEventListener("click", () => {
      Storage.clearAll();
      SpendlyData.seedIfNeeded();
      closeModal("clearDataModalOverlay");
      Utils.showToast("All data cleared");
      state.month = TransactionsModule.availableMonths()[0];
      refreshAfterDataChange();
    });
  }

  function bindNotifButton() {
    document.getElementById("notifBtn").addEventListener("click", () => {
      const progress = BudgetsModule.calculateBudgetProgress(state.month);
      const exceeded = progress.filter((p) => p.status === "exceeded");
      const almost = progress.filter((p) => p.status === "almost");
      if (exceeded.length) {
        Utils.showToast(`${exceeded.length} budget${exceeded.length > 1 ? "s" : ""} exceeded this month`, "danger");
      } else if (almost.length) {
        Utils.showToast(`${almost.length} budget${almost.length > 1 ? "s" : ""} almost at the limit`, "warning");
      } else {
        Utils.showToast("You're all caught up — no budget alerts");
      }
    });
    updateNotifDot();
  }

  function updateNotifDot() {
    const progress = BudgetsModule.calculateBudgetProgress(state.month || TransactionsModule.availableMonths()[0]);
    const hasAlert = progress.some((p) => p.status === "exceeded" || p.status === "almost");
    document.getElementById("notifDot").hidden = !hasAlert;
  }

  // =========================================================
  // MODALS — generic open/close
  // =========================================================
  function bindModals() {
    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
    });
    document.querySelectorAll(".modal-overlay").forEach((overlay) => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal(overlay.id);
      });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-overlay:not([hidden])").forEach((o) => closeModal(o.id));
      }
    });
  }
  function openModal(id) {
    document.getElementById(id).hidden = false;
    refreshIcons();
  }
  function closeModal(id) {
    document.getElementById(id).hidden = true;
  }

  // =========================================================
  // TRANSACTION MODAL
  // =========================================================
  function bindTransactionForm() {
    document.getElementById("addTransactionBtn").addEventListener("click", () => openTransactionModal());

    document.querySelectorAll("#transactionForm .type-toggle__option").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#transactionForm .type-toggle__option").forEach((b) => {
          b.classList.remove("is-active");
          b.setAttribute("aria-checked", "false");
        });
        btn.classList.add("is-active");
        btn.setAttribute("aria-checked", "true");
        populateCategorySelect(document.getElementById("transactionCategory"), btn.dataset.type);
      });
    });

    document.getElementById("transactionForm").addEventListener("submit", (e) => {
      e.preventDefault();
      submitTransactionForm();
    });
  }

  function openTransactionModal(id) {
    const form = document.getElementById("transactionForm");
    form.reset();
    clearFieldError("errAmount"); clearFieldError("errCategory"); clearFieldError("errDescription"); clearFieldError("errDate");

    const editing = Boolean(id);
    document.getElementById("transactionModalTitle").textContent = editing ? "Edit Transaction" : "Add Transaction";
    document.getElementById("transactionSubmitBtn").textContent = editing ? "Save Changes" : "Add Transaction";
    document.getElementById("transactionId").value = id || "";

    const txn = editing ? TransactionsModule.getById(id) : null;
    const type = txn ? txn.type : "expense";

    document.querySelectorAll("#transactionForm .type-toggle__option").forEach((b) => {
      const active = b.dataset.type === type;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-checked", String(active));
    });
    populateCategorySelect(document.getElementById("transactionCategory"), type, txn ? txn.category : undefined);

    document.getElementById("transactionAmount").value = txn ? txn.amount : "";
    document.getElementById("transactionDescription").value = txn ? txn.description : "";
    document.getElementById("transactionDate").value = txn ? txn.date : Utils.todayISO();

    openModal("transactionModalOverlay");
    document.getElementById("transactionAmount").focus();
  }

  function submitTransactionForm() {
    const id = document.getElementById("transactionId").value;
    const type = document.querySelector("#transactionForm .type-toggle__option.is-active").dataset.type;
    const amount = document.getElementById("transactionAmount").value;
    const category = document.getElementById("transactionCategory").value;
    const description = document.getElementById("transactionDescription").value.trim();
    const date = document.getElementById("transactionDate").value;

    let valid = true;
    clearFieldError("errAmount"); clearFieldError("errCategory"); clearFieldError("errDescription"); clearFieldError("errDate");

    if (!amount || isNaN(amount) || Number(amount) <= 0) { showFieldError("errAmount", "Enter an amount greater than zero."); valid = false; }
    if (!category) { showFieldError("errCategory", "Please select a category."); valid = false; }
    if (!description) { showFieldError("errDescription", "Please add a short description."); valid = false; }
    if (!date) { showFieldError("errDate", "Please choose a date."); valid = false; }

    if (!valid) {
      Utils.showToast("Please fix the highlighted fields", "warning");
      return;
    }

    const data = { type, amount, category, description, date };

    if (id) {
      TransactionsModule.update(id, data);
      Utils.showToast("Transaction updated");
    } else {
      TransactionsModule.create(data);
      Utils.showToast("Transaction added successfully");
    }

    closeModal("transactionModalOverlay");
    updateNotifDot();
    refreshAfterDataChange();
  }

  function showFieldError(errId, msg) {
    const errEl = document.getElementById(errId);
    errEl.textContent = msg;
    errEl.hidden = false;
    errEl.closest(".field")?.classList.add("has-error");
  }
  function clearFieldError(errId) {
    const errEl = document.getElementById(errId);
    if (!errEl) return;
    errEl.hidden = true;
    errEl.closest(".field")?.classList.remove("has-error");
  }

  // =========================================================
  // DELETE MODAL
  // =========================================================
  function openDeleteModal(id) {
    const txn = TransactionsModule.getById(id);
    if (!txn) return;
    state.pendingDeleteId = id;
    document.getElementById("deleteModalText").textContent =
      `Are you sure you want to delete "${txn.description}" for ${Utils.formatCurrency(txn.amount)}?`;
    openModal("deleteModalOverlay");
  }

  function bindDeleteModal() {
    document.getElementById("confirmDeleteBtn").addEventListener("click", () => {
      if (state.pendingDeleteId) {
        TransactionsModule.remove(state.pendingDeleteId);
        Utils.showToast("Transaction deleted");
        state.pendingDeleteId = null;
      }
      closeModal("deleteModalOverlay");
      updateNotifDot();
      refreshAfterDataChange();
    });

    document.getElementById("confirmLogoutBtn").addEventListener("click", () => {
      closeModal("logoutModalOverlay");
      doLogout();
    });
  }

  // =========================================================
  // BUDGET MODAL
  // =========================================================
  function bindBudgetForm() {
    document.getElementById("budgetForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const category = document.getElementById("budgetCategory").value;
      const amount = document.getElementById("budgetAmount").value;
      clearFieldError("errBudgetAmount");
      if (!amount || isNaN(amount) || Number(amount) <= 0) {
        showFieldError("errBudgetAmount", "Enter a limit greater than zero.");
        return;
      }
      BudgetsModule.upsert(category, amount);
      Utils.showToast("Budget updated");
      closeModal("budgetModalOverlay");
      updateNotifDot();
      refreshAfterDataChange();
    });
  }

  function openBudgetModal(category) {
    const select = document.getElementById("budgetCategory");
    const expenseCats = categoriesByType("expense");
    const existingBudgets = BudgetsModule.all().map((b) => b.category);
    const available = expenseCats.filter((c) => c.name === category || !existingBudgets.includes(c.name));

    select.innerHTML = available.map((c) => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join("");
    document.getElementById("budgetModalTitle").textContent = category ? "Edit Budget" : "Set Budget";
    clearFieldError("errBudgetAmount");

    if (category) {
      select.value = category;
      select.disabled = true;
      const existing = BudgetsModule.all().find((b) => b.category === category);
      document.getElementById("budgetAmount").value = existing ? existing.limit : "";
    } else {
      select.disabled = false;
      document.getElementById("budgetAmount").value = "";
    }
    openModal("budgetModalOverlay");
  }

  // =========================================================
  // CATEGORY MODAL
  // =========================================================
  function bindCategoryForm() {
    document.querySelectorAll("#categoryForm .type-toggle__option").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#categoryForm .type-toggle__option").forEach((b) => {
          b.classList.remove("is-active"); b.setAttribute("aria-checked", "false");
        });
        btn.classList.add("is-active"); btn.setAttribute("aria-checked", "true");
        state.selectedCategoryType = btn.dataset.catType;
      });
    });

    document.getElementById("categoryForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("categoryName").value.trim();
      clearFieldError("errCategoryName");
      if (!name) { showFieldError("errCategoryName", "Please enter a category name."); return; }
      const exists = Storage.getCategories().some((c) => c.name.toLowerCase() === name.toLowerCase());
      if (exists) { showFieldError("errCategoryName", "A category with this name already exists."); return; }

      Storage.addCategory({ name, icon: state.selectedCategoryIcon, type: state.selectedCategoryType, custom: true });
      Utils.showToast("Category created");
      closeModal("categoryModalOverlay");
      renderCategoryList();
      if (state.view === "transactions") renderTransactionsPage();
    });
  }

  function openCategoryModal() {
    document.getElementById("categoryForm").reset();
    clearFieldError("errCategoryName");
    state.selectedCategoryType = "expense";
    state.selectedCategoryIcon = SpendlyData.ICON_PALETTE[0];

    document.querySelectorAll("#categoryForm .type-toggle__option").forEach((b) => {
      const active = b.dataset.catType === "expense";
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-checked", String(active));
    });

    const picker = document.getElementById("iconPicker");
    picker.innerHTML = SpendlyData.ICON_PALETTE.map((icon, i) =>
      `<button type="button" data-icon="${icon}" class="${i === 0 ? "is-active" : ""}">${icon}</button>`
    ).join("");
    picker.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        picker.querySelectorAll("button").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        state.selectedCategoryIcon = btn.dataset.icon;
      });
    });

    openModal("categoryModalOverlay");
  }

  // =========================================================
  // SAVINGS GOAL MODAL
  // =========================================================
  function bindGoalForm() {
    document.getElementById("goalForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("goalName").value.trim();
      const target = document.getElementById("goalTarget").value;
      const saved = document.getElementById("goalSaved").value || 0;

      clearFieldError("errGoalName"); clearFieldError("errGoalTarget");
      let valid = true;
      if (!name) { showFieldError("errGoalName", "Please name your goal."); valid = false; }
      if (!target || isNaN(target) || Number(target) <= 0) { showFieldError("errGoalTarget", "Enter a target greater than zero."); valid = false; }
      if (!valid) return;

      const existing = Storage.getSavingsGoal();
      Storage.saveSavingsGoal({ id: existing ? existing.id : Utils.generateId(), name, target: Number(target), saved: Number(saved) });
      Utils.showToast("Savings goal updated");
      closeModal("goalModalOverlay");
      renderGoalCard();
      if (state.view === "settings") renderSettingsGoal();
    });

    document.getElementById("deleteGoalBtn").addEventListener("click", () => {
      Storage.deleteSavingsGoal();
      Utils.showToast("Savings goal deleted");
      closeModal("goalModalOverlay");
      renderGoalCard();
      if (state.view === "settings") renderSettingsGoal();
    });
  }

  function openGoalModal() {
    const goal = Storage.getSavingsGoal();
    document.getElementById("goalForm").reset();
    clearFieldError("errGoalName"); clearFieldError("errGoalTarget");
    document.getElementById("goalName").value = goal ? goal.name : "";
    document.getElementById("goalTarget").value = goal ? goal.target : "";
    document.getElementById("goalSaved").value = goal ? goal.saved : "";
    document.getElementById("deleteGoalBtn").hidden = !goal;
    openModal("goalModalOverlay");
  }

  // =========================================================
  // CSV IMPORT MODAL
  // =========================================================
  function bindImport() {
    const fileInput = document.getElementById("importFileInput");
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => handleCsvParsed(reader.result);
      reader.readAsText(file);
    });

    document.getElementById("importCancelBtn").addEventListener("click", () => closeModal("importModalOverlay"));
    document.getElementById("importConfirmBtn").addEventListener("click", () => {
      TransactionsModule.importRows(state.importRows);
      Utils.showToast(`${state.importRows.length} transaction${state.importRows.length > 1 ? "s" : ""} imported`);
      closeModal("importModalOverlay");
      updateNotifDot();
      refreshAfterDataChange();
    });
  }

  function openImportModal() {
    document.getElementById("importDropZone").hidden = false;
    document.getElementById("importPreview").hidden = true;
    document.getElementById("importFileInput").value = "";
    state.importRows = [];
    openModal("importModalOverlay");
  }

  function handleCsvParsed(text) {
    const { rows, errors } = TransactionsModule.parseCsv(text);
    state.importRows = rows;

    document.getElementById("importDropZone").hidden = true;
    document.getElementById("importPreview").hidden = false;
    document.getElementById("importCount").textContent = `${rows.length} transaction${rows.length === 1 ? "" : "s"} found.`;

    const table = document.getElementById("importTable");
    if (rows.length === 0) {
      table.innerHTML = "";
    } else {
      table.innerHTML = `
        <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Amount</th></tr></thead>
        <tbody>${rows.slice(0, 20).map((r) => `<tr><td>${Utils.formatDateShort(r.date)}</td><td>${r.type}</td><td>${Utils.escapeHtml(r.category)}</td><td>${Utils.formatCurrency(r.amount)}</td></tr>`).join("")}</tbody>
      `;
    }

    const errEl = document.getElementById("importError");
    if (errors.length) {
      errEl.hidden = false;
      errEl.textContent = errors.slice(0, 4).join(" ");
    } else {
      errEl.hidden = true;
    }

    document.getElementById("importConfirmBtn").disabled = rows.length === 0;
  }

  // =========================================================
  // AUTH — Firebase-backed login (Email/Password, Google)
  // =========================================================
  function initAuthUI() {
    renderUserChip(null);
    bindAuthModal();

    if (window.SpendlyAuth) {
      wireAuthListener();
    } else {
      // firebase-init.js is a module script; it always finishes executing
      // before this classic script runs, but guard anyway in case the
      // Firebase CDN failed to load (offline, ad-blocker, etc.).
      window.addEventListener("spendly:auth-ready", wireAuthListener, { once: true });
      setTimeout(() => {
        if (!window.SpendlyAuth) {
          console.warn("Spendly: Firebase Auth did not load — continuing in guest-only mode.");
        }
      }, 4000);
    }
  }

  function wireAuthListener() {
    state.authUser = window.SpendlyAuth.getCurrentUser();
    renderUserChip(state.authUser);
    setGreeting();
    window.SpendlyAuth.onChange((user) => {
      const wasLoggedOut = !state.authUser;
      state.authUser = user;
      renderUserChip(user);
      setGreeting();
      if (user && wasLoggedOut) {
        closeModal("authModalOverlay");
        Utils.showToast(`Welcome, ${authDisplayName(user)}`);
      }
    });
  }

  function authDisplayName(user) {
    if (!user) return "there";
    if (user.displayName) return user.displayName.split(" ")[0];
    if (user.email) return user.email.split("@")[0];
    if (user.phoneNumber) return user.phoneNumber;
    return "there";
  }

  function authInitials(user) {
    if (user.displayName) return user.displayName.trim().charAt(0).toUpperCase();
    if (user.email) return user.email.charAt(0).toUpperCase();
    if (user.phoneNumber) return "#";
    return "?";
  }

  function renderUserChip(user, statusOverride) {
    const el = document.getElementById("userChip");
    if (!user) {
      el.className = "user-chip user-chip--guest";
      el.innerHTML = `
        <div class="user-chip__avatar"><i data-lucide="user"></i></div>
        <div class="user-chip__info">
          <p class="user-chip__name">Guest</p>
          <p class="user-chip__role">Not signed in</p>
        </div>
        <button class="user-chip__login-btn" type="button">Log In</button>
      `;
      el.onclick = () => openAuthModal();
    } else {
      const name = user.displayName || (user.email ? user.email.split("@")[0] : user.phoneNumber || "Signed in");
      const subtitle = statusOverride || user.email || user.phoneNumber || "Signed in with Google";
      el.className = "user-chip";
      el.onclick = null;
      el.innerHTML = `
        <div class="user-chip__avatar">${user.photoURL ? `<img src="${user.photoURL}" alt="">` : Utils.escapeHtml(authInitials(user))}</div>
        <div class="user-chip__info">
          <p class="user-chip__name">${Utils.escapeHtml(name)}</p>
          <p class="user-chip__role">${Utils.escapeHtml(subtitle)}</p>
        </div>
        <button class="user-chip__logout" id="logoutBtn" type="button" aria-label="Log out"><i data-lucide="log-out"></i></button>
      `;
      el.querySelector("#logoutBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        openModal("logoutModalOverlay");
      });
    }
    refreshIcons();
  }

  async function doLogout() {
    if (!window.SpendlyAuth) return;
    try {
      await window.SpendlyAuth.logout();
      Utils.showToast("Logged out");
    } catch (err) {
      Utils.showToast(mapFirebaseError(err), "danger");
    }
  }

  function mapFirebaseError(err) {
    const code = err && err.code;
    switch (code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Incorrect email or password.";
      case "auth/email-already-in-use":
        return "An account with this email already exists — try logging in instead.";
      case "auth/weak-password":
        return "Password should be at least 6 characters.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/too-many-requests":
        return "Too many attempts. Please wait a moment and try again.";
      case "auth/popup-closed-by-user":
      case "auth/cancelled-popup-request":
        return null; // user just closed the popup — nothing to show
      default:
        return (err && err.message) || "Something went wrong. Please try again.";
    }
  }

  function bindAuthModal() {
    document.getElementById("googleSignInBtn").addEventListener("click", async () => {
      if (!window.SpendlyAuth) return Utils.showToast("Login isn't available right now.", "danger");
      try {
        await window.SpendlyAuth.signInGoogle();
      } catch (err) {
        const msg = mapFirebaseError(err);
        if (msg) Utils.showToast(msg, "danger");
      }
    });

    document.getElementById("authSwitchModeBtn").addEventListener("click", () => {
      state.authMode = state.authMode === "signin" ? "signup" : "signin";
      applyAuthMode();
    });

    document.getElementById("emailAuthForm").addEventListener("submit", (e) => {
      e.preventDefault();
      submitEmailAuthForm();
    });
  }

  function applyAuthMode() {
    const isSignup = state.authMode === "signup";
    document.getElementById("authModalTitle").textContent = isSignup ? "Create your account" : "Log in to Spendly";
    document.getElementById("fieldAuthName").hidden = !isSignup;
    document.getElementById("emailAuthSubmitBtn").textContent = isSignup ? "Sign Up" : "Log In";
    document.getElementById("authSwitchText").textContent = isSignup ? "Already have an account?" : "Don't have an account?";
    document.getElementById("authSwitchModeBtn").textContent = isSignup ? "Log in" : "Sign up";
  }

  function openAuthModal() {
    state.authMode = "signin";
    document.getElementById("emailAuthForm").reset();
    clearFieldError("errAuthEmail"); clearFieldError("errAuthPassword"); clearFieldError("errAuthGeneral");
    applyAuthMode();
    openModal("authModalOverlay");
  }

  async function submitEmailAuthForm() {
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    const name = document.getElementById("authName").value.trim();

    clearFieldError("errAuthEmail"); clearFieldError("errAuthPassword"); clearFieldError("errAuthGeneral");
    let valid = true;
    if (!email) { showFieldError("errAuthEmail", "Please enter your email."); valid = false; }
    if (!password || password.length < 6) { showFieldError("errAuthPassword", "Password must be at least 6 characters."); valid = false; }
    if (!valid) return;

    if (!window.SpendlyAuth) { showFieldError("errAuthGeneral", "Login isn't available right now."); return; }

    const btn = document.getElementById("emailAuthSubmitBtn");
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = "Please wait…";

    try {
      if (state.authMode === "signup") {
        await window.SpendlyAuth.signUpEmail(email, password, name || undefined);
      } else {
        await window.SpendlyAuth.signInEmail(email, password);
      }
    } catch (err) {
      const msg = mapFirebaseError(err);
      if (msg) showFieldError("errAuthGeneral", msg);
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  // =========================================================
  // CLOUD SYNC — reacts to events dispatched by firestore-sync.js
  // =========================================================
  let hasShownSyncedToast = false;
  function bindCloudSyncEvents() {
    window.addEventListener("spendly:cloud-sync-start", () => {
      if (state.authUser) renderUserChip(state.authUser, "Syncing…");
    });

    window.addEventListener("spendly:cloud-sync-complete", () => {
      if (state.authUser) renderUserChip(state.authUser);
      if (!hasShownSyncedToast) {
        Utils.showToast("Your data is synced to this account");
        hasShownSyncedToast = true;
      }
    });

    window.addEventListener("spendly:cloud-remote-update", () => {
      populateMonthSelector();
      renderCurrentView();
    });

    window.addEventListener("spendly:cloud-sync-error", () => {
      Utils.showToast("Couldn't sync your data right now — changes are still saved on this device.", "warning");
      if (state.authUser) renderUserChip(state.authUser);
    });
  }

  // ---------------------------------------------------------
  init();
})();
