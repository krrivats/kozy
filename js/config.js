// Kozy app config.
// USE_FIREBASE = true  → data syncs through Firestore (project kozy-7ef39), both phones share it.
// USE_FIREBASE = false → data stays on this device only (localStorage).
export const USE_FIREBASE = true;

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();

// Testing only: ?emulator=1 runs Firebase mode against the local Firebase emulators (tests-rules/).
export const EMULATOR = params.has('emulator');
export const EMULATOR_MEMBERS = {
  'me@test.com': { label: 'Me', role: 'owner' },
  'wife@test.com': { label: 'Wife', role: 'member' },
  'papa@test.com': { label: 'Papa', role: 'viewer' },
};

// Guest mode ("Try as guest" on the login screen): a private sample copy of Kozy on this device only.
// It never signs in and never reads or writes the family's data.
export const GUEST_KEY = 'kozy.guest';
export const GUEST = (() => { try { return localStorage.getItem(GUEST_KEY) === '1'; } catch { return false; } })();

// Local mode anyway (no sign-in, data only in this browser): add ?local=1 to the URL.
// The Playwright test server (port 5174) always runs locally so tests never touch the real data.
export const FORCE_LOCAL = GUEST || params.has('local') || (typeof location !== 'undefined' && location.port === '5174' && !EMULATOR);

// One shared household document in Firestore: households/{HOUSEHOLD_ID}
export const HOUSEHOLD_ID = 'kozy-home';

// Who is who, and what they may do. Keep the emails in sync with firestore.rules.
//   'owner'  = everything, and the only one who changes setup (limits, bills, goals, milk rate, reset)
//   'member' = sees everything; adds spends, stock, sabzi, milk; edits/deletes only own spends
//   'viewer' = sees everything, changes nothing
// To add a view-only person: add a line here AND their email to the viewers list in firestore.rules,
// and add their account in Firebase console → Authentication → Users → Add user.
export const MEMBERS = {
  'krrish@krrivats.app': { label: 'Krrish', role: 'owner' },
  'preeti@krrivats.app': { label: 'Preeti', role: 'member' },
  // 'someone@krrivats.app': { label: 'Papa', role: 'viewer' },
};

// Local mode is the owner. Add ?role=member or ?role=viewer to the URL to preview the other views.
export const LOCAL_USER = { label: 'Me', role: 'owner' };
export const LOCAL_PREVIEW_USERS = {
  member: { label: 'Wife', role: 'member' },
  viewer: { label: 'Viewer', role: 'viewer' },
};

export const APP_VERSION = '1.4.0';
