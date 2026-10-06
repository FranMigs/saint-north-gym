/* ==========================================================
   auth.js - Staff login and session handling.

   IMPORTANT: this is browser-only authentication for testing.
   Anyone with access to the browser can read the code, so it
   does NOT protect real data. For production, move login and
   the member database to a server (see README notes in chat).
   ========================================================== */
const Auth = (() => {
  const SESSION_KEY = 'sng_session';
  const SESSION_HOURS = 8;

  // Default test account. The password is stored as a SHA-256 hash,
  // not as plain text. Password: sainnorthgym2026
  const ACCOUNT = {
    username: 'admin',
    passwordHash: 'd614a75cfe74f6b25ab6548548a78fd5514a13bc135ec84125965d3ee81aa9a6'
  };

  async function sha256(text) {
    const bytes = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function login(username, password) {
    if (!window.crypto || !crypto.subtle) {
      return { ok: false, error: 'Secure hashing is unavailable. Open the app via http://localhost or https.' };
    }
    const hash = await sha256(password);
    if (username.trim() !== ACCOUNT.username || hash !== ACCOUNT.passwordHash) {
      return { ok: false, error: 'Incorrect username or password.' };
    }
    const session = { user: ACCOUNT.username, expires: Date.now() + SESSION_HOURS * 3600 * 1000 };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) { /* ignore */ }
    return { ok: true, user: session.user };
  }

  function currentUser() {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (s && s.expires > Date.now()) return s.user;
    } catch (e) { /* no valid session */ }
    return null;
  }

  function logout() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
  }

  return { login, logout, currentUser };
})();
