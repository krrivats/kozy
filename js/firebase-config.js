// Firebase web app config for project "kozy-7ef39" (Firebase console → Project settings → Your apps → kozy-web).
// This is NOT a secret: every web app ships it. The data is protected by firestore.rules.
export const firebaseConfig = {
  apiKey: 'AIzaSyBCHTiw3SbzuwSEmbp4w2GWky7rDRzuJKA',
  authDomain: 'kozy-7ef39.firebaseapp.com',
  projectId: 'kozy-7ef39',
  storageBucket: 'kozy-7ef39.firebasestorage.app',
  messagingSenderId: '770066142588',
  appId: '1:770066142588:web:afd37ddc590bfe4ef9c0f9',
  measurementId: 'G-P467WVTNJM',
};

// Phone reminders: Firebase console → Project settings → Cloud Messaging → Web Push certificates →
// "Generate key pair" → copy the long "Key pair" string here.
export const VAPID_KEY = 'PASTE_VAPID_KEY';
