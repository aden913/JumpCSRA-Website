import { initializeApp, getApp, FirebaseApp } from "firebase/app";

// Firebase configuration with environment variable support for SSR
const getEnvVar = (name: string) => {
  if (typeof process !== 'undefined' && process.env) {
    // Server-side: try non-prefixed first, then VITE_ prefixed
    return process.env[name] || process.env[`VITE_${name}`];
  }
  // Client-side: use window.__ENV__ (injected by server)
  if (typeof window !== 'undefined' && (window as any).__ENV__) {
    return (window as any).__ENV__[name];
  }
  return '';
};

export const firebaseConfig = {
  apiKey: getEnvVar('FIREBASE_API_KEY'),
  authDomain: getEnvVar('FIREBASE_AUTH_DOMAIN'),
  databaseURL: getEnvVar('FIREBASE_DATABASE_URL'),
  projectId: getEnvVar('FIREBASE_PROJECT_ID'),
  storageBucket: getEnvVar('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvVar('FIREBASE_APP_ID')
};

/**
 * Initialize Firebase app or return existing instance
 */
export const initFirebase = (): FirebaseApp => {
  try {
    // Try to get existing app first
    return getApp();
  } catch {
    // If no app exists, initialize a new one
    return initializeApp(firebaseConfig);
  }
};
