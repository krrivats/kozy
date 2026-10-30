// Kozy app config.
// USE_FIREBASE = true  → data syncs through Firestore (project kozy-7ef39), both phones share it.
// USE_FIREBASE = false → data stays on this device only (localStorage).
export const USE_FIREBASE = true;

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();

// Testing only: ?emulator=1 runs Firebase mode against the local Firebase emulators (tests-rules/).
export const EMULATOR = params.has('emulator');

// Guest mode ("Try as guest" on the login screen): a private sample copy of Kozy on this device only.
// It never signs in and never reads or writes the family's data.
export const GUEST_KEY = 'kozy.guest';
export const GUEST = (() => { try { return localStorage.getItem(GUEST_KEY) === '1'; } catch { return false; } })();

// Local mode anyway (no sign-in, data only in this browser): add ?local=1 to the URL.
// The Playwright test server (port 5174) always runs locally so tests never touch the real data.
export const FORCE_LOCAL = GUEST || params.has('local') || (typeof location !== 'undefined' && location.port === '5174' && !EMULATOR);

// The two family accounts made by hand before sign-up opened. They keep the old household (no data move);
// the app writes their membership docs on first sign-in. Keep in sync with legacy() in firestore.rules.
export const LEGACY_HID = 'kozy-home';
export const LEGACY = {
  'krrish@krrivats.app': { name: 'Krrish', role: 'admin' },
  'preeti@krrivats.app': { name: 'Preeti', role: 'editor' },
};

// Roles inside a household: admin (setup + people), editor (adds/edits everything), viewer (read only).
// The app keeps the short internal names owner / member / viewer; the screens say Admin / Editor / Viewer.
export const ROLE_TO_INTERNAL = { admin: 'owner', editor: 'member', viewer: 'viewer' };
export const ROLE_LABEL = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' };

// Quiet shortcut: "krrish" → "krrish@krrivats.app" (the two family accounts). A full email (with @) is used as typed.
export const LOGIN_DOMAIN = 'krrivats.app';
export function loginEmail(input) {
  const v = String(input || '').trim().toLowerCase();
  return !v || v.includes('@') ? v : `${v}@${LOGIN_DOMAIN}`;
}

// Local mode is the owner. Add ?role=member or ?role=viewer to the URL to preview the other views.
export const LOCAL_USER = { label: 'Me', role: 'owner' };
export const LOCAL_PREVIEW_USERS = {
  member: { label: 'Wife', role: 'member' },
  viewer: { label: 'Viewer', role: 'viewer' },
};

export const APP_VERSION = '2.0.0';
