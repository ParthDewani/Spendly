/* =========================================================
   Spendly — transactions.js
   Pure(ish) calculation and query helpers over the transaction list.
   ========================================================= */

const TransactionsModule = (() => {
  function all() {
    return Storage.getTransactions();
  }

  function getTransactionsByMonth(monthKey) {
    return all().filter((t) => Utils.monthKeyFromDate(t.date) === monthKey);
  }

  function availableMonths() {
    const set = new Set(all().map((t) => Utils.monthKeyFromDate(t.date)));
    // Always include the current month so the selector never empties out.
    set.add(Utils.monthKeyFromDate(Utils.todayISO()));
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1)); // newest first
  }

  function calculateIncome(monthKey) {
    return getTransactionsByMonth(monthKey)
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }

  function calculateExpenses(monthKey) {
    return getTransactionsByMonth(monthKey)
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }

  function calculateBalance(monthKey) {
    return calculateIncome(monthKey) - calculateExpenses(monthKey);
  }

  function calculateSavingsRate(monthKey) {
    const income = calculateIncome(monthKey);
    const expenses = calculateExpenses(monthKey);
    if (income <= 0) return 0;
    return Utils.clamp(((income - expenses) / income) * 100, -999, 100);
  }

  function getExpensesByCategory(monthKey) {
    const map = {};
    getTransactionsByMonth(monthKey)
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        map[t.category] = (map[t.category] || 0) + Number(t.amount);
      });
    return map; // { category: total }
  }

  function lastNMonths(n, fromMonthKey) {
    const anchor = fromMonthKey || Utils.monthKeyFromDate(Utils.todayISO());
    const out = [];
    for (let i = n - 1; i >= 0; i--) out.push(Utils.shiftMonthKey(anchor, -i));
    return out;
  }

  function recentTransactions(monthKey, limit = 6) {
    return getTransactionsByMonth(monthKey)
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);
  }

  // ---- Filtering & sorting for the Transactions page ----
  function filterAndSort(opts) {
    const { search = "", type = "all", category = "all", dateRange = "all", sort = "newest" } = opts;
    const currentMonth = Utils.monthKeyFromDate(Utils.todayISO());
    const lastMonth = Utils.shiftMonthKey(currentMonth, -1);

    let list = all();

    if (type !== "all") list = list.filter((t) => t.type === type);
    if (category !== "all") list = list.filter((t) => t.category === category);
    if (dateRange === "this-month") list = list.filter((t) => Utils.monthKeyFromDate(t.date) === currentMonth);
    if (dateRange === "last-month") list = list.filter((t) => Utils.monthKeyFromDate(t.date) === lastMonth);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) => t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
      );
    }

    switch (sort) {
      case "oldest":
        list.sort((a, b) => new Date(a.date) - new Date(b.date));
        break;
      case "highest":
        list.sort((a, b) => Number(b.amount) - Number(a.amount));
        break;
      case "lowest":
        list.sort((a, b) => Number(a.amount) - Number(b.amount));
        break;
      case "newest":
      default:
        list.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    return list;
  }

  // ---- CRUD wrappers ----
  function create(data) {
    const txn = { id: Utils.generateId(), ...data, amount: Number(data.amount) };
    Storage.addTransaction(txn);
    return txn;
  }
  function update(id, data) {
    return Storage.updateTransaction(id, { ...data, amount: Number(data.amount) });
  }
  function remove(id) {
    Storage.deleteTransaction(id);
  }
  function getById(id) {
    return all().find((t) => t.id === id) || null;
  }

  // ---- CSV export ----
  function toCsv() {
    const header = ["Date", "Type", "Category", "Description", "Amount"];
    const rows = all()
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((t) => [
        t.date,
        t.type,
        t.category,
        `"${String(t.description).replace(/"/g, '""')}"`,
        t.amount,
      ]);
    return [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  function downloadCsv() {
    const csv = toCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spendly-transactions.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ---- CSV import ----
  // Returns { rows: [...], errors: [...] }
  function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return { rows: [], errors: ["The file is empty."] };

    const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    const idx = {
      date: header.indexOf("date"),
      type: header.indexOf("type"),
      category: header.indexOf("category"),
      description: header.indexOf("description"),
      amount: header.indexOf("amount"),
    };
    const missing = Object.entries(idx).filter(([, v]) => v === -1).map(([k]) => k);
    if (missing.length) {
      return { rows: [], errors: [`Missing required column(s): ${missing.join(", ")}`] };
    }

    const rows = [];
    const errors = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = splitCsvLine(lines[i]);
      if (cells.length < header.length) {
        errors.push(`Row ${i + 1}: not enough columns, skipped.`);
        continue;
      }
      const date = cells[idx.date].trim();
      const type = cells[idx.type].trim().toLowerCase();
      const category = cells[idx.category].trim();
      const description = cells[idx.description].trim();
      const amount = parseFloat(cells[idx.amount]);

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        errors.push(`Row ${i + 1}: invalid date "${date}", skipped.`);
        continue;
      }
      if (type !== "income" && type !== "expense") {
        errors.push(`Row ${i + 1}: type must be "income" or "expense", skipped.`);
        continue;
      }
      if (!category) {
        errors.push(`Row ${i + 1}: missing category, skipped.`);
        continue;
      }
      if (isNaN(amount) || amount <= 0) {
        errors.push(`Row ${i + 1}: invalid amount, skipped.`);
        continue;
      }
      rows.push({ date, type, category, description: description || "Imported transaction", amount });
    }

    return { rows, errors };
  }

  function splitCsvLine(line) {
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else cur += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ",") { out.push(cur); cur = ""; }
        else cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  function importRows(rows) {
    const list = Storage.getTransactions();
    rows.forEach((r) => list.push({ id: Utils.generateId(), ...r }));
    Storage.saveTransactions(list);
  }

  return {
    all, getTransactionsByMonth, availableMonths,
    calculateIncome, calculateExpenses, calculateBalance, calculateSavingsRate,
    getExpensesByCategory, lastNMonths, recentTransactions,
    filterAndSort, create, update, remove, getById,
    toCsv, downloadCsv, parseCsv, importRows,
  };
})();
