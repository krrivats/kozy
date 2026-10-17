// Kozy app config.
// USE_FIREBASE = false → data stays on this device (localStorage).
// USE_FIREBASE = true  → data syncs through Firestore (paste real values in firebase-config.js first).
export const USE_FIREBASE = false;

// One shared household document in Firestore: households/{HOUSEHOLD_ID}
export const HOUSEHOLD_ID = 'kozy-home';

// Who is who. In Firebase mode the signed-in email decides the label shown on entries.
// Keep these in sync with firestore.rules.
export const MEMBERS = {
  'ME_EMAIL': 'Me',
  'WIFE_EMAIL': 'Wife',
};

// Name used on entries in local mode.
export const LOCAL_USER = 'Me';

export const APP_VERSION = '1.0.0';
