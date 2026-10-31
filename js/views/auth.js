// Sign-in gate (Firebase mode). runGate() shows the right screen until the person is "ready":
//   signed-out → login / create account   unverified → check your inbox
//   no-household → create a household (or wait for an invite)   ready → the app starts
import { logo } from '../ui.js';
import { loginEmail, EMULATOR, GUEST_KEY } from '../config.js';
import { esc } from '../logic/format.js';

const MESSAGES = {
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'No account with this email. Tap “Create account”.',
  'auth/invalid-email': 'That email doesn’t look right.',
  'auth/missing-password': 'Type your password.',
  'auth/email-already-in-use': 'This email already has an account. Tap “Sign in”.',
  'auth/weak-password': 'Password needs at least 6 characters.',
  'auth/too-many-requests': 'Too many tries. Wait a minute and try again.',
  'auth/network-request-failed': 'No internet. Connect and try again.',
  'auth/operation-not-allowed': 'This sign-in method is turned off in Firebase.',
  'auth/popup-closed-by-user': 'Sign-in window was closed.',
  'auth/cancelled-popup-request': 'Sign-in window was closed.',
};
const msgOf = (e) => MESSAGES[e?.code] || String(e?.message || e).replace('Firebase: ', '');

// An invite link looks like https://…/kozy/?join=ABCD2345 — remember the code while the person signs up.
const JOIN_KEY = 'kozy.join';
(function keepLinkCode() {
  try {
    const c = new URLSearchParams(location.search).get('join');
    if (c) sessionStorage.setItem(JOIN_KEY, c);
  } catch { /* private mode */ }
})();
const pendingCode = () => { try { return sessionStorage.getItem(JOIN_KEY) || ''; } catch { return ''; } };
const clearCode = () => { try { sessionStorage.removeItem(JOIN_KEY); } catch { /* ignore */ } };

let tab = pendingCode() ? 'up' : 'in'; // 'in' | 'up' — remembered while the login screen re-renders

export function runGate(adapter) {
  const root = document.getElementById('view');
  return new Promise((resolve) => {
    let off = () => {};
    const step = async () => {
      off();
      off = () => {};
      let r;
      try { r = await adapter.resolve(); } catch (e) { screenError(root, adapter, e, step); return; }
      if (r.state === 'ready') { document.body.classList.remove('no-tabs'); resolve(adapter); return; }
      document.body.classList.add('no-tabs');
      if (r.state === 'signed-out') screenLogin(root, adapter, step);
      else if (r.state === 'unverified') off = screenInbox(root, adapter, step);
      else screenOnboarding(root, adapter, step);
    };
    step();
  });
}

function shell(root, inner) {
  root.innerHTML = `<section class="login" data-test="gate">${logo(72)}<h1>Kozy</h1>${inner}</section>`;
  const err = root.querySelector('[data-create-err]') || root.querySelector('.form-error');
  return {
    show(msg) { if (err) { err.textContent = msg; err.hidden = false; } },
    clear() { if (err) err.hidden = true; },
    note(msg) { const n = root.querySelector('[data-note]'); if (n) { n.textContent = msg; n.hidden = !msg; } },
  };
}

function signOutBtn(root, adapter) {
  root.querySelector('[data-signout]').onclick = async () => { await adapter.signOut(); location.reload(); };
}

function screenError(root, adapter, e, retry) {
  console.error(e);
  document.body.classList.add('no-tabs');
  const s = shell(root, `<p class="muted">Kozy could not check your account.</p>
    <p class="form-error"></p>
    <button class="btn primary huge" data-retry>Try again</button>
    <button class="btn ghost" data-signout>Sign out</button>`);
  s.show(msgOf(e));
  root.querySelector('[data-retry]').onclick = retry;
  signOutBtn(root, adapter);
}

// ---------- login / create account ----------
function screenLogin(root, adapter, next) {
  const up = tab === 'up';
  const s = shell(root, `
    <p class="muted">Home budget, kitchen stock & milk — for your family.</p>
    ${pendingCode() ? '<p class="card small" data-test="invite-banner">🎟️ You were invited. Create an account (or sign in), and you will join the household.</p>' : ''}
    <div class="seg" role="tablist" style="width:100%">
      <button type="button" class="${up ? '' : 'on'}" data-tab="in" role="tab" data-test="tab-in">Sign in</button>
      <button type="button" class="${up ? 'on' : ''}" data-tab="up" role="tab" data-test="tab-up">Create account</button>
    </div>
    <form class="stack" data-form>
      ${up ? '<input class="input" name="name" type="text" autocomplete="name" placeholder="Your name" aria-label="Your name" required>' : ''}
      <input class="input" name="email" type="${up ? 'email' : 'text'}" autocomplete="${up ? 'email' : 'username'}" autocapitalize="off" autocorrect="off" spellcheck="false"
        placeholder="Email" aria-label="Email" required>
      <input class="input" name="password" type="password" autocomplete="${up ? 'new-password' : 'current-password'}" placeholder="${up ? 'Password (6+ letters)' : 'Password'}" aria-label="Password" required>
      <button class="btn primary huge" type="submit" data-test="submit">${up ? 'Create account' : 'Sign in'}</button>
    </form>
    <p class="form-error" hidden></p>
    <p class="muted small" data-note hidden></p>
    ${up ? '' : '<button type="button" class="btn link" data-forgot>Forgot password?</button>'}
    <div class="or"><span>or</span></div>
    ${adapter.isHomeScreenApp() ? '<p class="muted tiny" data-test="no-google">Google sign-in does not work inside the Home Screen app (the phone keeps it separate from Safari). Use your email and password here.</p>' : '<button class="btn ghost" data-google>Continue with Google</button>'}
    <button class="btn ghost" data-guest data-test="guest">👤 Try as guest</button>
    <p class="muted tiny">A guest gets a sample copy that stays on this phone. Create an account to start your own household, or to join one you were invited to.</p>`);

  root.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { tab = b.dataset.tab; screenLogin(root, adapter, next); }; });

  const f = root.querySelector('[data-form]');
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    s.clear();
    const btn = f.querySelector('button[type="submit"]');
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = up ? 'Creating…' : 'Signing in…';
    try {
      if (up) await adapter.createEmailAccount(f.name.value.trim(), f.email.value.trim().toLowerCase(), f.password.value);
      else await adapter.signInEmail(loginEmail(f.email.value), f.password.value);
      next();
    } catch (e) { s.show(msgOf(e)); btn.disabled = false; btn.textContent = label; }
  };
  const forgot = root.querySelector('[data-forgot]');
  if (forgot) {
    forgot.onclick = async () => {
      s.clear();
      const email = loginEmail(f.email.value);
      if (!email.includes('@')) { s.show('Type your email above first, then tap “Forgot password?”.'); return; }
      try {
        await adapter.sendReset(email);
        s.note(`If ${email} has an account, a reset link is on its way. Check Spam too.`);
      } catch (e) { s.show(msgOf(e)); }
    };
  }
  root.querySelector('[data-guest]').onclick = () => {
    try { localStorage.setItem(GUEST_KEY, '1'); } catch { /* private mode: guest can't start */ }
    location.reload();
  };
  const g = root.querySelector('[data-google]');
  if (g) {
    g.onclick = async () => {
      s.clear();
      try { if (await adapter.signInGoogle()) next(); } catch (e) { s.show(msgOf(e)); }
    };
  }
}

// ---------- check your inbox ----------
function screenInbox(root, adapter, next) {
  const email = adapter.userEmail();
  const s = shell(root, `
    <h2>Check your inbox 📬</h2>
    <p class="muted">We sent a link to <b data-test="inbox-email">${esc(email)}</b>. Tap it, then come back here. Look in Spam too.</p>
    <button class="btn primary huge" data-verified data-test="verified">I’ve verified</button>
    <p class="form-error" hidden></p>
    <p class="muted small" data-note hidden></p>
    <button class="btn ghost" data-resend>Resend the email</button>
    ${EMULATOR ? '<button class="btn ghost" data-emu data-test="emu-verify">[Emulator] auto-verify</button>' : ''}
    <button class="btn link" data-signout>Use another email / sign out</button>`);
  signOutBtn(root, adapter);

  let finished = false;
  const check = async (quiet) => {
    if (finished) return;
    s.clear();
    try {
      await adapter.reloadUser();
      if (adapter.user?.emailVerified) { finished = true; next(); return; }
      if (!quiet) s.show('Not verified yet. Tap the link in the email first.');
    } catch (e) { if (!quiet) s.show(msgOf(e)); }
  };
  root.querySelector('[data-verified]').onclick = () => check(false);

  const resend = root.querySelector('[data-resend]');
  let cool = 0;
  let timer = null;
  const tick = () => {
    resend.disabled = cool > 0;
    resend.textContent = cool > 0 ? `Resend the email (${cool}s)` : 'Resend the email';
    if (cool > 0) timer = setTimeout(() => { cool--; tick(); }, 1000);
  };
  resend.onclick = async () => {
    s.clear();
    try { await adapter.resendVerification(); s.note('Sent again. Check Inbox and Spam.'); cool = 30; tick(); } catch (e) { s.show(msgOf(e)); }
  };

  const emu = root.querySelector('[data-emu]');
  if (emu) {
    emu.onclick = async () => {
      try {
        const r = await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-kozy/oobCodes');
        const { oobCodes } = await r.json();
        const hit = oobCodes.filter((c) => c.email?.toLowerCase() === email && c.requestType === 'VERIFY_EMAIL').pop();
        if (!hit) { s.show('[Emulator] no verification mail found.'); return; }
        await fetch(hit.oobLink, { mode: 'no-cors' }); // opening the link is what verifies
        await check(false);
      } catch (e) { s.show(`[Emulator] ${e.message}`); }
    };
  }

  // Coming back from the mail app: look again by itself.
  const onFocus = () => check(true);
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onFocus);
  return () => {
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onFocus);
    clearTimeout(timer);
  };
}

// ---------- create your household (or wait for an invite) ----------
function screenOnboarding(root, adapter, next) {
  const email = adapter.userEmail();
  const first = adapter.userLabel();
  const s = shell(root, `
    <h2>Join a household 🎟️</h2>
    <p class="muted small">Got a code from the admin? Type it here.</p>
    <form class="row gap-s" data-join style="width:100%">
      <input class="input grow" name="code" value="${esc(pendingCode())}" placeholder="Code, e.g. K7M2-QX9P" autocapitalize="characters" autocomplete="off" spellcheck="false" aria-label="Invite code" data-test="join-code">
      <button class="btn primary" type="submit" data-test="join-go">Join</button>
    </form>
    <p class="form-error" hidden data-join-err></p>
    <div class="or"><span>or start your own</span></div>
    <h2>Create your household 🏡</h2>
    <p class="muted">You will be its <b>Admin</b> and can add family later.</p>
    <form class="stack" data-form>
      <label class="field"><span>Household name</span>
        <input class="input" name="hname" value="${esc(`${first}’s home`)}" maxlength="40" required data-test="hname"></label>
      <label class="field"><span>Monthly budget ₹</span>
        <input class="input num" name="budget" type="number" inputmode="numeric" min="0" step="500" value="40000" data-test="hbudget"></label>
      <label class="switch"><input type="checkbox" name="demo" data-test="hdemo"> Start with sample data</label>
      <button class="btn primary huge" type="submit" data-test="create-household">Create household</button>
    </form>
    <p class="form-error" hidden data-create-err></p>
    <div class="or"><span>or</span></div>
    <p class="small"><b>Invited by email?</b> Ask the admin to add <b data-test="my-email">${esc(email)}</b> in Settings → Household, then tap Check again.</p>
    <button class="btn ghost" data-again data-test="check-again">Check again</button>
    <button class="btn link" data-signout>Sign out</button>`);
  signOutBtn(root, adapter);
  root.querySelector('[data-again]').onclick = () => next();

  const jf = root.querySelector('[data-join]');
  const jerr = root.querySelector('[data-join-err]');
  jf.onsubmit = async (ev) => {
    ev.preventDefault();
    jerr.hidden = true;
    const btn = jf.querySelector('button');
    btn.disabled = true;
    try { await adapter.joinWithCode(jf.code.value); clearCode(); next(); } catch (e) { jerr.textContent = msgOf(e); jerr.hidden = false; btn.disabled = false; }
  };

  const f = root.querySelector('[data-form]');
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    s.clear();
    const btn = f.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Creating…';
    try {
      await adapter.createHousehold({ name: f.hname.value });
      adapter.pendingSetup = { budget: Number(f.budget.value) || 0, demo: f.demo.checked };
      next();
    } catch (e) { s.show(msgOf(e)); btn.disabled = false; btn.textContent = 'Create household'; }
  };
}
