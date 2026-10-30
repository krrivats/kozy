// Settings → 👥 Household (Firebase mode only). Admin: rename, people list, add / change role / remove.
// Editor and Viewer: see the household, their own role, and can leave.
import * as store from '../store.js';
import { ROLE_LABEL } from '../config.js';
import { esc } from '../logic/format.js';
import { icon, toast, confirmSheet, shareText } from '../ui.js';

const APP_LINK = 'https://krrivats.github.io/kozy/';
let members = null; // admin only: [{email, name, role, joinedAt, ...}] — kept so a re-render doesn't lose the list

const adapter = () => store.getAdapter();
const admins = () => (members || []).filter((m) => m.role === 'admin');

function inviteText(m) {
  return `Join “${adapter().householdName || 'our household'}” on Kozy 🏡\nOpen ${APP_LINK} and sign in or create an account with ${m.email}.`;
}

export function teamBody() {
  const a = adapter();
  const role = a.memberRole();
  const name = esc(a.householdName || 'My household');
  if (role !== 'admin') {
    return `<div class="stack-s" data-team>
      <p class="small">Household: <b data-test="hh-name">${name}</b></p>
      <p class="small">Your role: <b>${ROLE_LABEL[role] || ''}</b></p>
      <button class="btn ghost danger-text" data-team-act="leave" data-test="leave">Leave household</button>
    </div>`;
  }
  const opts = (cur) => Object.entries(ROLE_LABEL).map(([k, l]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${l}</option>`).join('');
  const me = a.userEmail();
  return `<div class="stack-s" data-team>
    <form class="row gap-s" data-team-form="rename">
      <input class="input grow" name="hname" value="${esc(a.householdName)}" aria-label="Household name" maxlength="40" required data-test="hh-name-in">
      <button class="btn ghost" type="submit">Rename</button>
    </form>
    <div class="team-list" data-test="members">
      ${members === null ? '<p class="muted small">Loading people…</p>' : members.map((m) => `<div class="member" data-member="${esc(m.email)}">
        <div class="grow"><b>${esc(m.name)}</b>${m.email === me ? ' <span class="tag">you</span>' : ''}
          <span class="muted small block">${esc(m.email)}</span></div>
        <span class="chip ${m.joinedAt ? 'ok' : 'warn'}" data-test="chip">${m.joinedAt ? 'Joined' : 'Invited'}</span>
        <select class="input role-sel" data-team-role="${esc(m.email)}" aria-label="Role of ${esc(m.name)}">${opts(m.role)}</select>
        ${m.joinedAt ? '' : `<button class="icon-btn" data-team-act="share" data-email="${esc(m.email)}" aria-label="Share invite">${icon('share')}</button>`}
        <button class="icon-btn" data-team-act="remove" data-email="${esc(m.email)}" aria-label="Remove ${esc(m.name)}">${icon('trash')}</button>
      </div>`).join('')}
    </div>
    <form class="stack-s" data-team-form="add">
      <p class="small"><b>Add a person</b></p>
      <div class="row gap-s">
        <input class="input grow" name="pname" placeholder="Name" aria-label="Name" required data-test="p-name">
        <select class="input role-sel" name="prole" aria-label="Role" data-test="p-role">${opts('editor')}</select>
      </div>
      <input class="input" name="pemail" type="email" autocapitalize="off" placeholder="Their email" aria-label="Their email" required data-test="p-email">
      <p class="muted tiny">Admin: everything. Editor: adds and edits everything, no setup. Viewer: only looks. They sign in or create an account with THIS email and land inside your household.</p>
      <p class="form-error" hidden></p>
      <button class="btn primary" type="submit" data-test="p-add">${icon('plus')} Add person</button>
    </form>
  </div>`;
}

export async function loadTeam(rerender) {
  if (adapter()?.memberRole?.() !== 'admin') return;
  try {
    members = (await adapter().listMembers()).sort((x, y) => (y.role === 'admin') - (x.role === 'admin') || x.name.localeCompare(y.name));
  } catch (e) { console.error(e); members = []; toast('Could not load the people list', 'err'); }
  rerender();
}

export function bindTeam(root, rerender) {
  const reload = () => loadTeam(rerender);

  root.addEventListener('submit', async (ev) => {
    const f = ev.target.closest('[data-team-form]');
    if (!f) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    const a = adapter();
    if (f.dataset.teamForm === 'rename') {
      try { await a.renameHousehold(f.hname.value); toast('Household renamed ✓'); rerender(); } catch (e) { toast(e.message, 'err'); }
      return;
    }
    const err = f.querySelector('.form-error');
    err.hidden = true;
    const person = { name: f.pname.value.trim(), email: f.pemail.value.trim().toLowerCase(), role: f.prole.value };
    if ((members || []).some((m) => m.email === person.email)) { err.textContent = 'This person is already in your household.'; err.hidden = false; return; }
    try {
      await a.addMember(person);
    } catch (e) { err.textContent = e.message; err.hidden = false; return; }
    toast(`${person.name} added ✓`);
    await reload();
    if (await confirmSheet({ title: `Send ${person.name} an invite?`, body: 'It says to sign in or create an account with their email.', ok: 'Share invite' })) {
      const res = await shareText('Kozy invite', inviteText(person));
      if (res === 'copied') toast('Invite copied ✓ Paste in WhatsApp');
    }
  }, true);

  root.addEventListener('change', async (ev) => {
    const sel = ev.target.closest('[data-team-role]');
    if (!sel) return;
    const email = sel.dataset.teamRole;
    const m = (members || []).find((x) => x.email === email);
    if (!m || sel.value === m.role) return;
    if (m.role === 'admin' && admins().length < 2) {
      toast('Make someone else Admin first — a household needs one Admin', 'err');
      sel.value = m.role;
      return;
    }
    try { await adapter().setMemberRole(email, sel.value); toast(`${m.name} is now ${ROLE_LABEL[sel.value]} ✓`); } catch (e) { toast(e.message, 'err'); }
    if (email === adapter().userEmail()) { location.reload(); return; } // my own role changed: start again with the new rights
    reload();
  });

  root.addEventListener('click', async (ev) => {
    const t = ev.target.closest('[data-team-act]');
    if (!t) return;
    const a = adapter();
    const act = t.dataset.teamAct;
    const m = (members || []).find((x) => x.email === t.dataset.email);
    if (act === 'share' && m) {
      const res = await shareText('Kozy invite', inviteText(m));
      if (res === 'copied') toast('Invite copied ✓ Paste in WhatsApp');
    } else if (act === 'remove' && m) {
      if (m.role === 'admin' && admins().length < 2) { toast('A household needs one Admin — you can’t remove the last one', 'err'); return; }
      if (await confirmSheet({ title: `Remove ${m.name}?`, body: `${esc(m.email)} will lose access to this household’s data.`, ok: 'Remove', danger: true })) {
        try { await a.removeMember(m.email); toast(`${m.name} removed`); } catch (e) { toast(e.message, 'err'); }
        if (m.email === a.userEmail()) { location.reload(); return; }
        reload();
      }
    } else if (act === 'leave') {
      if (a.memberRole() === 'admin' && admins().length < 2) { toast('Make someone else Admin before you leave', 'err'); return; }
      if (await confirmSheet({ title: 'Leave this household?', body: 'You lose access to its data. An admin can add you back.', ok: 'Leave', danger: true })) {
        try { await a.leaveHousehold(); location.reload(); } catch (e) { toast(e.message, 'err'); }
      }
    }
  });
}
