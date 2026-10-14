/* =========================================================
   firebase.js — Google Sign-In (Firebase Auth) + global
   high scores (Cloud Firestore), with a localStorage fallback.

   SETUP: paste your Firebase web-app config below (see README).
   Until then the game runs fully offline with local scores.
   ========================================================= */
(function () {
  'use strict';

  // -------------------------------------------------------
  // 1) YOUR FIREBASE CONFIG
  //    Firebase console → Project settings → General →
  //    "Your apps" → Web app → SDK setup and configuration → Config
  //    (Alternatively define window.SPD_FIREBASE_CONFIG in a
  //    script loaded before this file.)
  // -------------------------------------------------------
  // Placeholders only. The real config is NOT committed: it lives in the
  // gitignored js/firebase-config.js (locally) or is generated from the
  // FIREBASE_CONFIG GitHub Actions secret at deploy time, and is exposed to
  // this file as window.SPD_FIREBASE_CONFIG.
  const FIREBASE_CONFIG = {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_PROJECT_ID.appspot.com',
    messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
    appId: 'YOUR_APP_ID',
  };

  const SDK_VERSION = '10.12.2';
  const SDK_BASE = 'https://www.gstatic.com/firebasejs/' + SDK_VERSION;
  // Namespaced so it can live safely inside a Firebase project shared with other apps.
  const SCORES_COLLECTION = 'pixeldash_scores';
  const LOCAL_KEY = 'spd.localScores';
  const PENDING_KEY = 'spd.pendingScores';
  const GUEST_KEY = 'spd.guestName';
  const MAX_LOCAL = 50;
  const NETWORK_TIMEOUT = 12000;

  const config = window.SPD_FIREBASE_CONFIG || FIREBASE_CONFIG;
  const state = { status: 'idle', user: null, error: null };
  const listeners = new Set();
  let fb = null;
  let initPromise = null;

  // ---------- helpers ----------
  function isConfigured() {
    const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
    return required.every((k) => typeof config[k] === 'string' && config[k].length > 0 && !config[k].startsWith('YOUR_'));
  }

  function emit() {
    const snapshot = { status: state.status, user: state.user, error: state.error };
    listeners.forEach((cb) => {
      try { cb(snapshot); } catch (e) { console.error('[firebase] listener error', e); }
    });
  }

  function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error((label || 'Request') + ' timed out')), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  function clampInt(v, min, max) {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  function mapUser(u) {
    if (!u) return null;
    return {
      uid: u.uid,
      name: (u.displayName || (u.email ? u.email.split('@')[0] : 'PLAYER')).slice(0, 24),
      photoURL: u.photoURL || '',
    };
  }

  function sanitizeEntry(e) {
    const src = e || {};
    let ts = src.ts;
    if (src.createdAt && typeof src.createdAt.toMillis === 'function') ts = src.createdAt.toMillis();
    return {
      id: typeof src.id === 'string' ? src.id : '',
      uid: typeof src.uid === 'string' ? src.uid : null,
      name: String(src.name || 'PLAYER').replace(/[\u0000-\u001f]/g, '').slice(0, 24) || 'PLAYER',
      photoURL: typeof src.photoURL === 'string' && /^https:\/\//i.test(src.photoURL) ? src.photoURL.slice(0, 500) : '',
      level: clampInt(src.level, 1, 5),
      cleared: !!src.cleared,
      coins: clampInt(src.coins, 0, 9999),
      time: clampInt(src.time, 0, 359999),
      score: clampInt(src.score, 0, 9999999),
      ts: clampInt(ts || Date.now(), 0, 9e15),
    };
  }

  function friendlyError(e) {
    const code = (e && e.code) || '';
    const map = {
      'auth/unauthorized-domain': 'This domain is not authorized. Add it in Firebase → Authentication → Settings → Authorized domains.',
      'auth/network-request-failed': 'Network error — check your connection.',
      'auth/operation-not-allowed': 'Google sign-in is disabled. Enable it in Firebase → Authentication → Sign-in method.',
      'auth/configuration-not-found': 'Firebase Auth is not set up for this project yet.',
      'auth/invalid-api-key': 'Invalid Firebase API key — check js/firebase.js.',
      'permission-denied': 'Firestore rejected the request — check your security rules.',
      'unavailable': 'Firestore is unreachable (offline?).',
      'failed-precondition': 'Firestore index or database missing — see README.',
    };
    return map[code] || (e && e.message) || 'Unknown error';
  }

  // ---------- local storage leaderboard ----------
  function loadLocal() {
    const list = readJSON(LOCAL_KEY, []);
    return Array.isArray(list) ? list.map(sanitizeEntry).sort((a, b) => b.score - a.score) : [];
  }

  function saveLocal(entry) {
    const list = loadLocal();
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    writeJSON(LOCAL_KEY, list.slice(0, MAX_LOCAL));
  }

  function queuePending(entry) {
    const pending = readJSON(PENDING_KEY, []);
    if (!Array.isArray(pending)) return;
    if (!pending.some((p) => p.id === entry.id)) pending.push(entry);
    writeJSON(PENDING_KEY, pending.slice(-20));
  }

  // ---------- Firebase bootstrap (lazy, only when configured) ----------
  function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      if (!isConfigured()) {
        state.status = 'disabled';
        emit();
        return state.status;
      }
      state.status = 'loading';
      emit();
      try {
        const [appMod, authMod, fsMod] = await withTimeout(Promise.all([
          import(SDK_BASE + '/firebase-app.js'),
          import(SDK_BASE + '/firebase-auth.js'),
          import(SDK_BASE + '/firebase-firestore.js'),
        ]), NETWORK_TIMEOUT, 'Firebase SDK load');
        const app = appMod.initializeApp(config);
        const auth = authMod.getAuth(app);
        const db = fsMod.getFirestore(app);
        fb = { app, auth, db, A: authMod, F: fsMod };
        // Completes a sign-in that fell back to redirect mode.
        authMod.getRedirectResult(auth).catch((e) => console.warn('[firebase] redirect result:', friendlyError(e)));
        authMod.onAuthStateChanged(auth, (u) => {
          state.user = mapUser(u);
          emit();
          if (state.user) flushPending();
        });
        state.status = 'ready';
        state.error = null;
      } catch (e) {
        console.warn('[firebase] init failed — using local scores only:', e);
        state.status = 'error';
        state.error = friendlyError(e);
        initPromise = null; // allow a later retry
      }
      emit();
      return state.status;
    })();
    return initPromise;
  }

  async function signIn() {
    if (!isConfigured()) throw new Error('Firebase is not configured yet — add your config to js/firebase.js (see README).');
    await init();
    if (state.status !== 'ready') throw new Error(state.error || 'Could not reach Firebase.');
    const { A, auth } = fb;
    const provider = new A.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const res = await A.signInWithPopup(auth, provider);
      return mapUser(res.user);
    } catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
        await A.signInWithRedirect(auth, provider);
        return null;
      }
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return null;
      throw new Error(friendlyError(e));
    }
  }

  async function signOut() {
    if (fb) {
      try { await fb.A.signOut(fb.auth); } catch (e) { throw new Error(friendlyError(e)); }
    }
    state.user = null;
    emit();
  }

  async function writeRemote(entry) {
    const { F, db } = fb;
    const ref = F.doc(db, SCORES_COLLECTION, entry.id);
    await withTimeout(F.setDoc(ref, {
      uid: entry.uid,
      name: entry.name,
      photoURL: entry.photoURL,
      level: entry.level,
      cleared: entry.cleared,
      coins: entry.coins,
      time: entry.time,
      score: entry.score,
      createdAt: F.serverTimestamp(),
    }), NETWORK_TIMEOUT, 'Score upload');
  }

  async function flushPending() {
    const pending = readJSON(PENDING_KEY, []);
    if (!Array.isArray(pending) || !pending.length || !fb || !state.user) return;
    const remaining = [];
    for (const raw of pending) {
      const entry = sanitizeEntry(raw);
      if (entry.uid !== state.user.uid) { remaining.push(entry); continue; }
      try {
        await writeRemote(entry);
      } catch (e) {
        // permission-denied means it already exists or is invalid — drop it.
        if (e.code !== 'permission-denied') remaining.push(entry);
      }
    }
    writeJSON(PENDING_KEY, remaining);
  }

  async function submitScore(raw) {
    const u = state.user;
    const entry = sanitizeEntry({
      ...raw,
      uid: u ? u.uid : null,
      name: u ? u.name : getGuestName(),
      photoURL: u ? u.photoURL : '',
      ts: Date.now(),
    });
    entry.id = (u ? u.uid : 'guest') + '_' + entry.ts.toString(36) + Math.random().toString(36).slice(2, 6);
    saveLocal(entry);

    if (!isConfigured()) return { remote: false, reason: 'not-configured' };
    if (!u) return { remote: false, reason: 'signed-out' };
    await init();
    if (state.status !== 'ready') {
      queuePending(entry);
      return { remote: false, reason: 'offline' };
    }
    try {
      await writeRemote(entry);
      return { remote: true };
    } catch (e) {
      console.warn('[firebase] score upload failed, queued for retry:', e);
      if (e.code !== 'permission-denied') queuePending(entry);
      return { remote: false, reason: 'error', message: friendlyError(e) };
    }
  }

  async function fetchTop(n) {
    const limit = n || 20;
    if (isConfigured()) {
      await init();
      if (state.status === 'ready') {
        try {
          const { F, db } = fb;
          const q = F.query(F.collection(db, SCORES_COLLECTION), F.orderBy('score', 'desc'), F.limit(limit));
          const snap = await withTimeout(F.getDocs(q), NETWORK_TIMEOUT, 'Leaderboard fetch');
          const entries = snap.docs.map((d) => sanitizeEntry({ ...d.data(), id: d.id }));
          return { source: 'global', entries };
        } catch (e) {
          console.warn('[firebase] leaderboard fetch failed:', e);
          return { source: 'local', entries: loadLocal().slice(0, limit), error: friendlyError(e) };
        }
      }
      return { source: 'local', entries: loadLocal().slice(0, limit), error: state.error };
    }
    return { source: 'local', entries: loadLocal().slice(0, limit), error: null };
  }

  function getGuestName() {
    try { return (localStorage.getItem(GUEST_KEY) || 'GUEST').slice(0, 12); } catch (e) { return 'GUEST'; }
  }

  function setGuestName(name) {
    const clean = String(name || '').replace(/[^\w \-.!]/g, '').trim().slice(0, 12).toUpperCase() || 'GUEST';
    try { localStorage.setItem(GUEST_KEY, clean); } catch (e) { /* ignore */ }
    return clean;
  }

  window.Leaderboard = {
    init,
    isConfigured,
    signIn,
    signOut,
    submitScore,
    fetchTop,
    getGuestName,
    setGuestName,
    status: () => state.status,
    user: () => state.user,
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
})();
