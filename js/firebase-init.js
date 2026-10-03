/* =========================================================
   Spendly — firebase-init.js  (ES module)
   Initializes Firebase and exposes a small, promise-based
   bridge (window.SpendlyAuth) so the rest of the app — which
   is plain classic scripts, not modules — can drive Auth
   without touching the Firebase SDK directly.

   Sign-in methods: Email/Password and Google. (Phone auth was
   intentionally left out — not needed on the Spark plan setup
   this project is using.)
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAqsAOeDy_yhKBK9OagK3U7cKku-HeoS8A",
  authDomain: "spendly-41d72.firebaseapp.com",
  projectId: "spendly-41d72",
  storageBucket: "spendly-41d72.firebasestorage.app",
  messagingSenderId: "735580535431",
  appId: "1:735580535431:web:2e74063500a9aa76c79622",
  measurementId: "G-NGCNW7DRH5",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app, auth };

const listeners = [];

onAuthStateChanged(auth, (user) => {
  listeners.forEach((cb) => {
    try { cb(user); } catch (e) { console.error(e); }
  });
  window.dispatchEvent(new CustomEvent("spendly:auth-changed", { detail: { user } }));
});

window.SpendlyAuth = {
  ready: true,

  onChange(callback) {
    listeners.push(callback);
  },

  getCurrentUser() {
    return auth.currentUser;
  },

  async signUpEmail(email, password, displayName) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
    return cred.user;
  },

  async signInEmail(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  },

  async signInGoogle() {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  },

  async logout() {
    await signOut(auth);
  },
};

window.dispatchEvent(new CustomEvent("spendly:auth-ready"));
