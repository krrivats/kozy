// Sign-in screen (only used when USE_FIREBASE = true).
import { logo } from '../ui.js';

export function renderLogin(adapter, onDone) {
  const root = document.getElementById('view');
  document.body.classList.add('no-tabs');
  root.innerHTML = `
  <section class="login">
    ${logo(72)}
    <h1>Kozy</h1>
    <p class="muted">Home budget, kitchen stock & milk — for our family.</p>
    <button class="btn primary huge" data-google>Continue with Google</button>
    <div class="or"><span>or</span></div>
    <form class="stack" data-email>
      <input class="input" name="email" type="email" autocomplete="email" placeholder="Email" required>
      <input class="input" name="password" type="password" autocomplete="current-password" placeholder="Password" minlength="6" required>
      <div class="row gap">
        <button class="btn primary grow" type="submit">Sign in</button>
        <button class="btn ghost grow" type="button" data-create>Create account</button>
      </div>
    </form>
    <p class="form-error" hidden></p>
    <p class="muted tiny">Only our two family emails can open the data.</p>
  </section>`;
  const err = root.querySelector('.form-error');
  const show = (e) => { err.textContent = e?.message?.replace('Firebase: ', '') || String(e); err.hidden = false; };
  const done = () => { document.body.classList.remove('no-tabs'); onDone(); };

  root.querySelector('[data-google]').onclick = async () => {
    try { if (await adapter.signInGoogle()) done(); } catch (e) { show(e); }
  };
  const f = root.querySelector('[data-email]');
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    try { await adapter.signInEmail(f.email.value.trim(), f.password.value); done(); } catch (e) { show(e); }
  };
  root.querySelector('[data-create]').onclick = async () => {
    if (!f.reportValidity()) return;
    try { await adapter.createEmailAccount(f.email.value.trim(), f.password.value); done(); } catch (e) { show(e); }
  };
}
