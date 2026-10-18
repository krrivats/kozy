// Kozy app config.
// USE_FIREBASE = false → data stays on this device (localStorage).
// USE_FIREBASE = true  → data syncs through Firestore (paste real values in firebase-config.js first).
export const USE_FIREBASE = false;

// Testing only: ?emulator=1 runs Firebase mode against the local Firebase emulators (tests-rules/).
export const EMULATOR = typeof location !== 'undefined' && new URLSearchParams(location.search).has('emulator');
export const EMULATOR_MEMBERS = {
  'me@test.com': { label: 'Me', role: 'owner' },
  'wife@test.com': { label: 'Wife', role: 'member' },
  'papa@test.com': { label: 'Papa', role: 'viewer' },
};

// One shared household document in Firestore: households/{HOUSEHOLD_ID}
export const HOUSEHOLD_ID = 'kozy-home';

// Who is who, and what they may do. Keep the emails in sync with firestore.rules.
//   'owner'  = everything, and the only one who changes setup (limits, bills, goals, milk rate, reset)
//   'member' = sees everything; adds spends, stock, sabzi, milk; edits/deletes only own spends
//   'viewer' = sees everything, changes nothing
// To add a view-only person: add a line here AND their email to the viewers list in firestore.rules.
export const MEMBERS = {
  'ME_EMAIL': { label: 'Me', role: 'owner' },
  'WIFE_EMAIL': { label: 'Wife', role: 'member' },
  // 'VIEWER_EMAIL': { label: 'Papa', role: 'viewer' },
};

// Local mode is the owner. Add ?role=member or ?role=viewer to the URL to preview the other views.
export const LOCAL_USER = { label: 'Me', role: 'owner' };
export const LOCAL_PREVIEW_USERS = {
  member: { label: 'Wife', role: 'member' },
  viewer: { label: 'Viewer', role: 'viewer' },
};

export const APP_VERSION = '1.3.0';
