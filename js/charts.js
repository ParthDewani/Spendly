/* =========================================================
   Spendly — charts.js
   Thin wrapper around Chart.js so app.js never touches Chart
   instances directly. Handles re-render + theme colors.
   ========================================================= */

const ChartsModule = (() => {
  const instances = {};

  const PALETTE = [
    "#322F87", "#1B8F5F", "#D93A3A", "#B4720C", "#3E7CB1",
    "#8B5CF6", "#E05C97", "#2AA6A6", "#C77B3D", "#6C7A89",
  ];

  function themeColors() {
    const styles = getComputedStyle(document.body);
    return {
      text: styles.getPropertyValue("--text-secondary").trim() || "#6A6C87",
      border: styles.getPropertyValue("--border").trim() || "#E7E7F2",
      success: styles.getPropertyValue("--success").trim() || "#1B8F5F",
      danger: styles.getPropertyValue("--danger").trim() || "#D93A3A",
      primary: styles.getPropertyValue("--primary").trim() || "#322F87",
    };
  }

  function destroy(id) {
    if (instances[id]) {
      instances[id].destroy();
      delete instances[id];
    }
  }

  function renderDoughnut(canvasId, dataMap) {
    const el = document.getElementById(canvasId);
    if (!el) return;
    destroy(canvasId);
    const labels = Object.keys(dataMap);
    const values = Object.values(dataMap);
    const colors = themeColors();

    instances[canvasId] = new Chart(el, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
          borderWidth: 0,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: colors.text, boxWidth: 10, boxHeight: 10, padding: 14, font: { size: 11.5, family: "Inter" } },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${Utils.formatCurrency(ctx.parsed)}`,
            },
          },
        },
      },
    });
  }

  function renderGroupedBar(canvasId, monthLabels, incomeData, expenseData) {
    const el = document.getElementById(canvasId);
    if (!el) return;
    destroy(canvasId);
    const colors = themeColors();

    instances[canvasId] = new Chart(el, {
      type: "bar",
      data: {
        labels: monthLabels,
        datasets: [
          { label: "Income", data: incomeData, backgroundColor: colors.success, borderRadius: 5, maxBarThickness: 22 },
          { label: "Expenses", data: expenseData, backgroundColor: colors.danger, borderRadius: 5, maxBarThickness: 22 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { color: colors.text, boxWidth: 10, boxHeight: 10, font: { size: 11.5 } } },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${Utils.formatCurrency(ctx.parsed.y)}` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: colors.text, font: { size: 11.5 } } },
          y: {
            grid: { color: colors.border },
            ticks: { color: colors.text, font: { size: 11 }, callback: (v) => Utils.formatCurrency(v) },
          },
        },
      },
    });
  }

  function renderLine(canvasId, labels, series) {
    // series: [{ label, data, color }]
    const el = document.getElementById(canvasId);
    if (!el) return;
    destroy(canvasId);
    const colors = themeColors();

    instances[canvasId] = new Chart(el, {
      type: "line",
      data: {
        labels,
        datasets: series.map((s) => ({
          label: s.label,
          data: s.data,
          borderColor: s.color,
          backgroundColor: s.color + "22",
          tension: 0.35,
          fill: true,
          pointRadius: 3,
          pointBackgroundColor: s.color,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: series.length > 1, position: "bottom", labels: { color: colors.text, boxWidth: 10, boxHeight: 10, font: { size: 11.5 } } },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${Utils.formatCurrency(ctx.parsed.y)}` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: colors.text, font: { size: 11.5 } } },
          y: { grid: { color: colors.border }, ticks: { color: colors.text, font: { size: 11 }, callback: (v) => Utils.formatCurrency(v) } },
        },
      },
    });
  }

  return { renderDoughnut, renderGroupedBar, renderLine, destroy, PALETTE };
})();
