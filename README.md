# Spendly

**Take control of your money.**

Spendly is a personal finance dashboard for tracking income and expenses, monitoring category budgets, visualizing spending trends, and surfacing simple rule-based financial insights. It's built entirely with vanilla HTML/CSS/JS (no framework, no build step), with data cached locally for instant, synchronous rendering and synced to your own account across devices via Firebase.

**Live demo:** `https://spendlylive.web.app`

---

## Features

**Dashboard**
- Total balance, income, expenses, and savings rate, calculated live from your transactions
- Month-over-month percentage deltas on every stat card
- Spending-by-category doughnut chart and a 6-month income vs. expenses bar chart
- Auto-generated financial insights (top category, spending trend, budget alerts, savings rate)
- Savings goal progress card
- Recent transactions feed

**Transactions**
- Add, edit, and delete transactions with full form validation
- Delete confirmation dialog
- Search by description/category
- Filter by type, category, and date range
- Sort by newest, oldest, highest, or lowest amount
- Responsive table on desktop, card list on mobile
- CSV export and CSV import with a preview step and malformed-row handling

**Budgets**
- Set a monthly limit per category
- Visual progress bars with four states: on track, approaching limit, almost at limit, and exceeded
- Status is always shown as text/icon, not color alone

**Analytics**
- Spending by category, monthly spending trend, income vs. expenses, savings rate trend (last 6 months)
- Top spending categories ranked list

**Accounts & Sync**
- Sign up / log in with Email+Password or Google
- Data automatically syncs across every device you log into, in real time
- Logging out clears the local cache so the next person on a shared device doesn't see it
- Fully usable as a guest too — nothing requires an account

**Settings**
- Light/dark theme toggle (persisted)
- Custom category creation (name + icon + income/expense type)
- Savings goal creation, editing, and deletion
- Export/import full app data as JSON
- Clear all data (with confirmation), resetting Spendly to a clean, empty state

**Everything else**
- Starts completely empty — zero transactions, zero budgets, no savings goal. Only the default category list is pre-loaded so the "Add Transaction" and "Set Budget" forms have something to select.
- Toast notifications for every action
- Empty states for every section
- Confirmation dialogs before any destructive action (delete transaction, log out, clear all data)
- Fully responsive: sidebar nav on desktop, collapsible mobile nav
- Keyboard-accessible modals, visible focus states, semantic HTML

---

## Tech Stack

- HTML5
- CSS3 (custom design system via CSS variables, no framework)
- Vanilla JavaScript (ES6+, no build step, no bundler)
- [Chart.js](https://www.chartjs.org/) for charts
- [Lucide Icons](https://lucide.dev/) for the icon set
- [Firebase Authentication](https://firebase.google.com/docs/auth) (Email/Password + Google sign-in)
- [Cloud Firestore](https://firebase.google.com/docs/firestore) for cross-device data sync
- Browser `localStorage` as the local, synchronous cache every screen renders from
- [Firebase Hosting](https://firebase.google.com/docs/hosting) for deployment

---

## Project Structure

```text
spendly/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── utils.js            # formatting, dates, ids, toasts
│   ├── storage.js          # single source of truth for localStorage + write-notify hook
│   ├── data.js              # default categories, icon palette, first-run seeding
│   ├── transactions.js       # calculations, filtering, CSV import/export
│   ├── budgets.js             # budget progress + status logic
│   ├── charts.js               # Chart.js wrapper
│   ├── insights.js              # rule-based insight generation
│   ├── firebase-init.js          # (ES module) Firebase Auth bridge → window.SpendlyAuth
│   ├── firestore-sync.js          # (ES module) mirrors localStorage ⇄ Firestore per user
│   └── app.js                      # view rendering + all event wiring
└── README.md
```

---


## How Cloud Sync Works

The app's `Storage` module (`js/storage.js`) is still the single, synchronous source of truth every screen renders from — none of the UI code is async. `js/firestore-sync.js` layers cloud sync underneath it without touching that logic:

- **On login:** if the account already has cloud data, it overwrites local storage (so a second device picks up the first device's data). On someone's very first login, whatever's currently local (e.g. data added while using the app as a guest) is pushed up as the initial copy.
- **While logged in:** a live Firestore listener applies changes made on another device in real time; local edits are pushed to the cloud (debounced ~700ms) automatically via a `Storage.onWrite()` hook.
- **On logout:** local data is wiped back to a clean, empty guest state.

Transactions, budgets, categories, settings, and the savings goal all sync this way; theme preference stays local per-device on purpose.

---

## Key Concepts Demonstrated

- DOM manipulation without a framework
- CRUD operations against localStorage, mirrored to a real cloud database
- Firebase Authentication (Email/Password + OAuth) integrated into a vanilla JS app via a small bridge pattern, since classic scripts and ES modules don't share scope
- Real-time data sync with Firestore listeners, including debouncing and echo/loop prevention
- Data visualization with Chart.js
- Responsive, mobile-first layout and navigation patterns
- Form validation and accessible modal dialogs
- CSV parsing/generation and file import/export in the browser
- Rule-based (non-AI) analytics over structured data

---

## Data & Privacy

Financial data — transactions, budgets, categories, and the savings goal — is cached locally via `localStorage` for instant rendering, and synced to Cloud Firestore under your own account when logged in. Firestore security rules ensure each user can only ever read or write their own data. Logging out clears the local cache so it doesn't linger on a shared device. Used as a guest (not logged in), everything stays local and nothing is sent anywhere.

---

## Future Improvements

- Bank/UPI API integration for automatic transaction import
- Multi-currency support
- Recurring transaction templates
- Shared/family budgets across multiple accounts
- Offline-first support with explicit conflict resolution UI (current sync is last-write-wins)

---

## About This Project

Built as a portfolio piece:

**Spendly — Personal Finance Dashboard**
A responsive personal finance web app featuring transaction tracking, budget monitoring, financial analytics, interactive charts, CSV import/export, and cross-device sync via Firebase Authentication and Cloud Firestore.

## License

MIT — feel free to fork, learn from, or build on this. If you do use it as a base, a credit link back is appreciated.