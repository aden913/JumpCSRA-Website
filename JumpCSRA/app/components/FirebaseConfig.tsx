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

// Determine environment context
const isServer = typeof process !== 'undefined' && process.env;
const isClient = typeof window !== 'undefined';
const isDev = import.meta.env?.DEV || false;
const mode = import.meta.env?.MODE || 'unknown';

console.group('🔥 Firebase Configuration Debug');
console.log('Environment Context:', {
  isServer,
  isClient,
  isDev,
  mode,
  nodeEnv: isServer ? process.env.NODE_ENV : 'N/A'
});

// Log available import.meta.env keys (client-side)
if (typeof import.meta !== 'undefined' && import.meta.env) {
  const envKeys = Object.keys(import.meta.env).filter(k => k.includes('FIREBASE') || k.includes('VITE'));
  console.log('Available import.meta.env keys:', envKeys);
  console.log('import.meta.env VITE_ prefixed:', {
    VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY ? `${String(import.meta.env.VITE_FIREBASE_API_KEY).substring(0, 10)}...` : 'MISSING',
    VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'MISSING',
    VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'MISSING'
  });
}

// Log available process.env keys (server-side)
if (isServer && process.env) {
  const envKeys = Object.keys(process.env).filter(k => k.includes('FIREBASE'));
  console.log('Available process.env FIREBASE keys:', envKeys.length > 0 ? envKeys : 'NONE');
}

const getEnvVar = (name: string) => {
  let value;
  
  if (typeof process !== 'undefined' && process.env) {
    // Server-side: try non-prefixed first, then VITE_ prefixed
    value = process.env[name] || process.env[`VITE_${name}`];
    console.log(`[Server] ${name}:`, value ? `${value.substring(0, 15)}... (${value.length} chars)` : '❌ MISSING');
  } else {
    // Client-side: use import.meta.env with VITE_ prefix
    value = (import.meta.env as any)[`VITE_${name}`];
    console.log(`[Client] ${name}:`, value ? `${String(value).substring(0, 15)}... (${String(value).length} chars)` : '❌ MISSING');
  }
  
  if (!value) {
    console.warn(`⚠️  Missing environment variable: ${name} (looking for VITE_${name})`);
  }
  
  return value;
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
let app, auth, firestore, functions, database, storage;

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