// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, type Functions } from "firebase/functions";
import { getDatabase, connectDatabaseEmulator, type Database } from "firebase/database";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// Check if already initialized (prevent re-initialization on every SSR request)
const existingApps = getApps();
const alreadyInitialized = existingApps.length > 0;

// Only log detailed debug info on first initialization
if (!alreadyInitialized) {
  console.log('🔥 Firebase: First initialization');
}

const getEnvVar = (name: string) => {
  // ALWAYS use import.meta.env for Vite builds (both client and server)
  // Vite bakes these values into both bundles at build time
  const value = (import.meta.env as any)[`VITE_${name}`];
  
  if (!value && !alreadyInitialized) {
    console.error(`❌ Missing Firebase config: VITE_${name}`);
  }
  
  return value;
};

const firebaseConfig = {
  apiKey: getEnvVar("FIREBASE_API_KEY"),
  authDomain: getEnvVar("FIREBASE_AUTH_DOMAIN"),
  databaseURL: getEnvVar("FIREBASE_DATABASE_URL"),
  projectId: getEnvVar("FIREBASE_PROJECT_ID"),
  storageBucket: getEnvVar("FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getEnvVar("FIREBASE_MESSAGING_SENDER_ID"),
  appId: getEnvVar("FIREBASE_APP_ID"),
};

// Validate on first init only
if (!alreadyInitialized) {
  const missingFields = Object.entries(firebaseConfig)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingFields.length > 0) {
    console.error('❌ Firebase Config Error - Missing fields:', missingFields);
  } else {
    console.log('✅ Firebase config validated');
  }
}

// Initialize Firebase (only once)
let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;
let functions: Functions;
let database: Database;
let storage: FirebaseStorage;

if (alreadyInitialized) {
  // Reuse existing app
  app = existingApps[0];
  auth = getAuth(app);
  firestore = getFirestore(app);
  functions = getFunctions(app);
  database = getDatabase(app);
  storage = getStorage(app);
} else {
  // First initialization
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    firestore = getFirestore(app);
    functions = getFunctions(app);
    database = getDatabase(app);
    storage = getStorage(app);
    console.log('✅ Firebase initialized successfully');
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    throw error;
  }
}

export { app, auth, firestore, functions, database, storage, firebaseConfig };