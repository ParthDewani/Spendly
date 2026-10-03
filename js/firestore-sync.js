/* =========================================================
   Spendly — firestore-sync.js  (ES module)
   Keeps localStorage (the app's synchronous source of truth for
   rendering) mirrored to Firestore in the background, so a
   signed-in user's data follows them across devices.

   Design: everything the app already reads/writes stays exactly
   as it was (Storage, TransactionsModule, BudgetsModule, ... are
   all untouched and still synchronous). This module only:
     1. On login: pulls the user's cloud document and overwrites
        local storage with it (or, if it's their first-ever login,
        pushes whatever's currently local up as the initial copy).
     2. Keeps a live listener open so changes made on another
        device apply here automatically.
     3. Whenever local data changes (Storage.onWrite fires), pushes
        a debounced snapshot up to Firestore.
     4. On logout: clears local data back to a clean guest state,
        so the next person on a shared device doesn't see it.
   ========================================================= */

import { app, auth } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const db = getFirestore(app);

let unsubscribeSnapshot = null;
let currentUid = null;
let applyingRemote = false;
let pushTimer = null;
const PUSH_DEBOUNCE_MS = 700;

function waitForGlobals() {
  return new Promise((resolve) => {
    const check = () => (window.Storage && window.SpendlyData ? resolve() : setTimeout(check, 20));
    check();
  });
}

function userDocRef(uid) {
  return doc(db, "users", uid);
}

function readLocalSnapshot() {
  return {
    transactions: window.Storage.getTransactions(),
    budgets: window.Storage.getBudgets(),
    categories: window.Storage.getCategories(),
    settings: window.Storage.getSettings(),
    savingsGoal: window.Storage.getSavingsGoal() || null,
  };
}

function normalize(data) {
  return {
    transactions: data.transactions || [],
    budgets: data.budgets || [],
    categories: data.categories && data.categories.length ? data.categories : window.SpendlyData.defaultCategories(),
    settings: data.settings || { currency: "INR" },
    savingsGoal: data.savingsGoal || null,
  };
}

function snapshotsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function applyRemoteSnapshot(rawData) {
  const data = normalize(rawData);
  applyingRemote = true;
  try {
    window.Storage.saveTransactions(data.transactions);
    window.Storage.saveBudgets(data.budgets);
    window.Storage.saveCategories(data.categories);
    window.Storage.saveSettings(data.settings);
    if (data.savingsGoal) window.Storage.saveSavingsGoal(data.savingsGoal);
    else window.Storage.deleteSavingsGoal();
    window.Storage.markInitialized();
  } finally {
    applyingRemote = false;
  }
  window.dispatchEvent(new CustomEvent("spendly:cloud-remote-update"));
}

async function pushLocalToCloud(uid) {
  try {
    const snapshot = readLocalSnapshot();
    await setDoc(userDocRef(uid), { ...snapshot, updatedAt: serverTimestamp() });
  } catch (err) {
    console.error("Spendly: cloud push failed", err);
    window.dispatchEvent(new CustomEvent("spendly:cloud-sync-error", { detail: { error: err } }));
  }
}

function schedulePush() {
  if (applyingRemote || !currentUid) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushLocalToCloud(currentUid), PUSH_DEBOUNCE_MS);
}

async function startSync(uid) {
  currentUid = uid;
  window.dispatchEvent(new CustomEvent("spendly:cloud-sync-start"));

  try {
    const ref = userDocRef(uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      applyRemoteSnapshot(snap.data());
    } else {
      // First-ever login for this account: seed the cloud with whatever's
      // currently local (e.g. data from using the app as a guest).
      await pushLocalToCloud(uid);
    }

    unsubscribeSnapshot = onSnapshot(ref, (docSnap) => {
      if (!docSnap.exists()) return;
      const remote = normalize(docSnap.data());
      const local = normalize(readLocalSnapshot());
      if (snapshotsEqual(remote, local)) return; // just the echo of our own write
      applyRemoteSnapshot(remote);
    });

    window.dispatchEvent(new CustomEvent("spendly:cloud-sync-complete"));
  } catch (err) {
    console.error("Spendly: initial cloud sync failed", err);
    window.dispatchEvent(new CustomEvent("spendly:cloud-sync-error", { detail: { error: err } }));
  }
}

function stopSync() {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }
  clearTimeout(pushTimer);
  currentUid = null;
}

function resetLocalToGuestState() {
  applyingRemote = true;
  try {
    window.Storage.saveTransactions([]);
    window.Storage.saveBudgets([]);
    window.Storage.saveCategories(window.SpendlyData.defaultCategories());
    window.Storage.saveSettings({ currency: "INR" });
    window.Storage.deleteSavingsGoal();
  } finally {
    applyingRemote = false;
  }
  window.dispatchEvent(new CustomEvent("spendly:cloud-remote-update"));
}

waitForGlobals().then(() => {
  window.Storage.onWrite(schedulePush);

  onAuthStateChanged(auth, (user) => {
    stopSync();
    if (user) {
      startSync(user.uid);
    } else {
      resetLocalToGuestState();
    }
  });
});

window.SpendlyCloud = { ready: true };
