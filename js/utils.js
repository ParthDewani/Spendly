/* =========================================================
   Spendly — utils.js
   Small, dependency-free helper functions used across modules.
   ========================================================= */

const Utils = (() => {
  const currencyFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });

  const currencyFormatterDecimal = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });

  function formatCurrency(amount, withDecimals = false) {
    const value = Number(amount) || 0;
    return withDecimals ? currencyFormatterDecimal.format(value) : currencyFormatter.format(value);
  }

  function generateId() {
    return `txn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function todayISO() {
    const d = new Date();
    return toISODate(d);
  }

  function toISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // "2026-09-03" -> "2026-09"
  function monthKeyFromDate(isoDate) {
    return isoDate.slice(0, 7);
  }

  function monthKeyToLabel(monthKey) {
    const [y, m] = monthKey.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  function monthKeyToShortLabel(monthKey) {
    const [y, m] = monthKey.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString("en-US", { month: "short" });
  }

  function shiftMonthKey(monthKey, delta) {
    const [y, m] = monthKey.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function relativeDateLabel(isoDate) {
    const today = new Date();
    const target = new Date(isoDate + "T00:00:00");
    const diffDays = Math.round((stripTime(today) - stripTime(target)) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
    return target.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }

  function stripTime(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function formatDateLong(isoDate) {
    const d = new Date(isoDate + "T00:00:00");
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  function formatDateShort(isoDate) {
    const d = new Date(isoDate + "T00:00:00");
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" }).replace(/\//g, "/");
  }

  function percentChange(current, previous) {
    if (!previous || previous === 0) {
      if (!current || current === 0) return null;
      return null; // undefined baseline, avoid misleading infinite %
    }
    return ((current - previous) / previous) * 100;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str ?? "");
    return div.innerHTML;
  }

  function debounce(fn, wait = 200) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  // ---- Toasts ----
  function showToast(message, type = "success") {
    const stack = document.getElementById("toastStack");
    if (!stack) return;
    const icon = type === "warning" ? "alert-triangle" : type === "danger" ? "x-circle" : "check-circle-2";
    const el = document.createElement("div");
    el.className = `toast toast--${type}`;
    el.innerHTML = `<i data-lucide="${icon}"></i><span></span>`;
    el.querySelector("span").textContent = message;
    stack.appendChild(el);
    if (window.lucide) window.lucide.createIcons({ nameAttr: "data-lucide", attrs: {} });
    if (window.lucide) window.lucide.createIcons();
    setTimeout(() => {
      el.classList.add("is-leaving");
      setTimeout(() => el.remove(), 200);
    }, 3200);
  }

  return {
    formatCurrency,
    generateId,
    todayISO,
    toISODate,
    monthKeyFromDate,
    monthKeyToLabel,
    monthKeyToShortLabel,
    shiftMonthKey,
    relativeDateLabel,
    formatDateLong,
    formatDateShort,
    percentChange,
    clamp,
    escapeHtml,
    debounce,
    showToast,
  };
})();
