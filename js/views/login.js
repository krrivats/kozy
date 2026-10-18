// Sign-in screen (Firebase mode). Accounts are made by the owner in Firebase console → Authentication → Users,
// so there is no "create account" here.
import { logo } from '../ui.js';
import { loginEmail } from '../config.js';

const MESSAGES = {
  'auth/invalid-credential': 'Wrong name or password.',
  'auth/wrong-password': 'Wrong name or password.',
  'auth/user-not-found': 'No account with this name. Ask Krrish to add it.',
  'auth/invalid-email': 'That name doesn’t look right.',
  'auth/too-many-requests': 'Too many tries. Wait a minute and try again.',
  'auth/network-request-failed': 'No internet. Connect and try again.',
  'auth/operation-not-allowed': 'This sign-in method is turned off in Firebase.',
  'auth/popup-closed-by-user': 'Sign-in window was closed.',
};

export function renderLogin(adapter, onDone) {
  const root = document.getElementById('view');
  document.body.classList.add('no-tabs');
  root.innerHTML = `
  <section class="login">
    ${logo(72)}
    <h1>Kozy</h1>
    <p class="muted">Home budget, kitchen stock & milk — for our family.</p>
    <form class="stack" data-email>
      <input class="input" name="email" type="text" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false"
        placeholder="Your name (krrish / preeti)" aria-label="Your name" required>
      <input class="input" name="password" type="password" autocomplete="current-password" placeholder="Password" required>
      <button class="btn primary huge" type="submit">Sign in</button>
    </form>
    <p class="form-error" hidden></p>
    <div class="or"><span>or</span></div>
    <button class="btn ghost" data-google>Continue with Google</button>
    <button class="btn ghost" data-guest data-test="guest">👤 Try as guest</button>
    <p class="muted tiny">Only our family accounts can open the family data. A guest gets a sample copy that stays on this phone.</p>
  </section>`;
  const err = root.querySelector('.form-error');
  const show = (e) => {
    err.textContent = MESSAGES[e?.code] || e?.message?.replace('Firebase: ', '') || String(e);
    err.hidden = false;
  };
  const done = () => { document.body.classList.remove('no-tabs'); onDone(); };

  const f = root.querySelector('[data-email]');
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const btn = f.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try { await adapter.signInEmail(loginEmail(f.email.value), f.password.value); done(); } catch (e) { show(e); btn.disabled = false; btn.textContent = 'Sign in'; }
  };
  root.querySelector('[data-guest]').onclick = () => {
    try { localStorage.setItem('kozy.guest', '1'); } catch { /* private mode: guest can't start */ }
    location.reload();
  };
  root.querySelector('[data-google]').onclick = async () => {
    try { if (await adapter.signInGoogle()) done(); } catch (e) { show(e); }
  };
}
