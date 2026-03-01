// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getDatabase, connectDatabaseEmulator } from "firebase/database";
import { getStorage } from "firebase/storage";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// All values must be provided via environment variables (.env file)
// For SSR: Use process.env (server) or import.meta.env (client)
const getEnvVar = (name: string) => {
  if (typeof process !== 'undefined' && process.env) {
    // Server-side: try non-prefixed first, then VITE_ prefixed
    return process.env[name] || process.env[`VITE_${name}`];
  }
  // Client-side: use import.meta.env with VITE_ prefix
  return (import.meta.env as any)[`VITE_${name}`];
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);
const functions = getFunctions(app);
const database = getDatabase(app);
const storage = getStorage(app);

// Connect to emulators in development (only in browser environment)
if (false && typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  // Connect Functions emulator
  try {
    connectFunctionsEmulator(functions, 'localhost', 5001);
  } catch (error) {
    // Functions emulator already connected or not available
  }
  
  // Note: Database emulator not configured, using production database
}

export { app, auth, firestore, functions, database, storage };