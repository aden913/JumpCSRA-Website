// Import the functions you need from the SDKs you need
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, type Functions } from "firebase/functions";
import { getDatabase, connectDatabaseEmulator, type Database } from "firebase/database";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For SSR compatibility with React Router v7:
// - Server-side: Uses process.env
// - Client-side: Uses window.__ENV__ injected by the server

// Check if running on server or client
const isServer = typeof document === 'undefined';
const isDev = typeof process !== 'undefined' ? process.env.NODE_ENV === 'development' : false;

console.group('🔥 Firebase Configuration Debug');
console.log('Environment Context:', {
  isServer,
  isDev,
  nodeEnv: typeof process !== 'undefined' ? process.env.NODE_ENV : 'unknown'
});

/**
 * Get environment variable with fallback chain
 * Tries multiple naming conventions for backward compatibility
 */
const getEnvVar = (name: string): string => {
  let value: string | undefined;
  
  if (isServer && typeof process !== 'undefined') {
    // Server-side: check process.env
    value = process.env[name] || process.env[`VITE_${name}`];
    console.log(`[Server] ${name}:`, value ? `${value.substring(0, 15)}... (${value.length} chars)` : '❌ MISSING');
  } else if (typeof window !== 'undefined' && (window as any).__ENV__) {
    // Client-side: check window.__ENV__ (injected by server)
    value = (window as any).__ENV__[name];
    console.log(`[Client] ${name}:`, value ? `${String(value).substring(0, 15)}...` : '❌ MISSING');
  }
  
  if (!value) {
    console.warn(`⚠️  Missing environment variable: ${name}`);
  }
  
  return value || '';
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

console.log('Final Firebase Config:', {
  apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : '❌ MISSING',
  authDomain: firebaseConfig.authDomain || '❌ MISSING',
  projectId: firebaseConfig.projectId || '❌ MISSING',
  storageBucket: firebaseConfig.storageBucket || '❌ MISSING',
  messagingSenderId: firebaseConfig.messagingSenderId || '❌ MISSING',
  appId: firebaseConfig.appId ? `${firebaseConfig.appId.substring(0, 20)}...` : '❌ MISSING'
});

// Validate critical fields
const missingFields = Object.entries(firebaseConfig)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingFields.length > 0) {
  console.error('❌ Firebase Config Error: Missing required fields:', missingFields);
  console.error('This will cause Firebase initialization to fail!');
} else {
  console.log('✅ All Firebase config fields present');
}

console.groupEnd();

// Initialize Firebase
console.log('🚀 Initializing Firebase app...');
let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;
let functions: Functions;
let database: Database;
let storage: FirebaseStorage;

try {
  app = initializeApp(firebaseConfig);
  console.log('✅ Firebase app initialized successfully');
  
  auth = getAuth(app);
  console.log('✅ Firebase Auth initialized');
  
  firestore = getFirestore(app);
  console.log('✅ Firestore initialized');
  
  functions = getFunctions(app);
  console.log('✅ Functions initialized');
  
  database = getDatabase(app);
  console.log('✅ Realtime Database initialized');
  
  storage = getStorage(app);
  console.log('✅ Storage initialized');
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
  if (error instanceof Error) {
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
  }
  throw error;
}

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