// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, type Functions } from "firebase/functions";
import { getDatabase, connectDatabaseEmulator, type Database } from "firebase/database";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// Singleton pattern for SSR - use globalThis to persist across requests
declare global {
  var __firebaseApp: FirebaseApp | undefined;
  var __firebaseAuth: Auth | undefined;
  var __firebaseFirestore: Firestore | undefined;
  var __firebaseFunctions: Functions | undefined;
  var __firebaseDatabase: Database | undefined;
  var __firebaseStorage: FirebaseStorage | undefined;
  var __firebaseInitialized: boolean | undefined;
}

const getEnvVar = (name: string) => {
  // ALWAYS use import.meta.env for Vite builds (both client and server)
  // Vite bakes these values into both bundles at build time
  const value = (import.meta.env as any)[`VITE_${name}`];
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

// Initialize Firebase using singleton pattern
let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;
let functions: Functions;
let database: Database;
let storage: FirebaseStorage;

// Check if already initialized globally (works across SSR requests and browser)
if (globalThis.__firebaseInitialized && globalThis.__firebaseApp) {
  // Reuse existing instances
  app = globalThis.__firebaseApp;
  auth = globalThis.__firebaseAuth!;
  firestore = globalThis.__firebaseFirestore!;
  functions = globalThis.__firebaseFunctions!;
  database = globalThis.__firebaseDatabase!;
  storage = globalThis.__firebaseStorage!;
} else {
  // First initialization - also check getApps() as fallback
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
  } else {
    app = initializeApp(firebaseConfig);
  }
  
  auth = getAuth(app);
  firestore = getFirestore(app);
  functions = getFunctions(app);
  database = getDatabase(app);
  storage = getStorage(app);
  
  // Store in globalThis for persistence (works in both Node.js and browser)
  globalThis.__firebaseApp = app;
  globalThis.__firebaseAuth = auth;
  globalThis.__firebaseFirestore = firestore;
  globalThis.__firebaseFunctions = functions;
  globalThis.__firebaseDatabase = database;
  globalThis.__firebaseStorage = storage;
  globalThis.__firebaseInitialized = true;
}

export { app, auth, firestore, functions, database, storage, firebaseConfig };