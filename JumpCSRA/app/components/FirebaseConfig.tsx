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
// All values must be provided via environment variables (.env file)
// For SSR: Use process.env (server) or import.meta.env (client)

// Determine environment context
const isServer = typeof process !== 'undefined' && process.env;
const isClient = typeof window !== 'undefined';
const isDev = import.meta.env?.DEV || false;
const mode = import.meta.env?.MODE || 'unknown';

console.group('🔥 Firebase Configuration Debug - ENHANCED');
console.log('Environment Context:', {
  isServer,
  isClient,
  isDev,
  mode,
  nodeEnv: isServer ? process.env.NODE_ENV : 'N/A',
  timestamp: new Date().toISOString(),
  buildTime: 'VITE vars are compiled at BUILD TIME, not runtime!'
});

// CRITICAL: Check if import.meta.env has the values AT BUILD TIME
console.log('🔍 Checking import.meta.env (these are BAKED IN at build time):');
console.log('  - VITE_FIREBASE_API_KEY:', typeof import.meta.env.VITE_FIREBASE_API_KEY, 
  import.meta.env.VITE_FIREBASE_API_KEY ? 
    `"${String(import.meta.env.VITE_FIREBASE_API_KEY).substring(0, 10)}...${String(import.meta.env.VITE_FIREBASE_API_KEY).slice(-4)}" (${String(import.meta.env.VITE_FIREBASE_API_KEY).length} chars)` : 
    '❌ UNDEFINED OR EMPTY');
console.log('  - VITE_FIREBASE_AUTH_DOMAIN:', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '❌ MISSING');
console.log('  - VITE_FIREBASE_PROJECT_ID:', import.meta.env.VITE_FIREBASE_PROJECT_ID || '❌ MISSING');
console.log('  - VITE_FIREBASE_APP_ID:', import.meta.env.VITE_FIREBASE_APP_ID ? 
    `"${String(import.meta.env.VITE_FIREBASE_APP_ID).substring(0, 20)}...${String(import.meta.env.VITE_FIREBASE_APP_ID).slice(-4)}"` : 
    '❌ MISSING');

// Log available import.meta.env keys (ALL of them)
if (typeof import.meta !== 'undefined' && import.meta.env) {
  const allKeys = Object.keys(import.meta.env);
  const firebaseKeys = allKeys.filter(k => k.includes('FIREBASE'));
  const viteKeys = allKeys.filter(k => k.startsWith('VITE_'));
  console.log(`📋 Total import.meta.env keys: ${allKeys.length}`);
  console.log(`📋 FIREBASE-related keys: ${firebaseKeys.length}`, firebaseKeys);
  console.log(`📋 VITE_-prefixed keys: ${viteKeys.length}`, viteKeys);
}

// Log available process.env keys (server-side - these DON'T WORK for Vite!)
if (isServer && process.env) {
  const envKeys = Object.keys(process.env).filter(k => k.includes('FIREBASE'));
  console.log('⚠️  Server process.env FIREBASE keys (NOT used by Vite!):', envKeys.length > 0 ? envKeys : 'NONE');
}

const getEnvVar = (name: string) => {
  // ALWAYS use import.meta.env for Vite builds (both client and server)
  // Vite bakes these values into both bundles at build time
  const value = (import.meta.env as any)[`VITE_${name}`];
  const source = `import.meta.env.VITE_${name} (baked in at BUILD TIME)`;
  
  const valuePreview = value ? 
    `${String(value).substring(0, 15)}...${String(value).slice(-4)} (${String(value).length} chars)` : 
    '❌ MISSING FROM BUILD';
  
  console.log(`${name}:`, valuePreview, `from ${source}`);
  
  if (!value) {
    console.error(`❌ CRITICAL: Missing ${name}! VITE_${name} was NOT set during build`);
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

console.log('📦 Final Firebase Config Object:');
console.log('  apiKey:', firebaseConfig.apiKey ? 
  `"${firebaseConfig.apiKey.substring(0, 8)}...${firebaseConfig.apiKey.slice(-4)}" (${firebaseConfig.apiKey.length} chars, type: ${typeof firebaseConfig.apiKey})` : 
  '❌ MISSING OR EMPTY');
console.log('  authDomain:', firebaseConfig.authDomain || '❌ MISSING');
console.log('  databaseURL:', firebaseConfig.databaseURL || '❌ MISSING');
console.log('  projectId:', firebaseConfig.projectId || '❌ MISSING');
console.log('  storageBucket:', firebaseConfig.storageBucket || '❌ MISSING');
console.log('  messagingSenderId:', firebaseConfig.messagingSenderId || '❌ MISSING');
console.log('  appId:', firebaseConfig.appId ? 
  `"${firebaseConfig.appId.substring(0, 15)}...${firebaseConfig.appId.slice(-4)}" (${firebaseConfig.appId.length} chars)` : 
  '❌ MISSING');

// Validate critical fields
const missingFields = Object.entries(firebaseConfig)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingFields.length > 0) {
  console.error('❌❌❌ Firebase Config Error: Missing required fields:', missingFields);
  console.error('');
  console.error('🔧 TROUBLESHOOTING STEPS:');
  console.error('1. Check that .env file exists with VITE_FIREBASE_* variables');
  console.error('2. Make sure you ran: export VITE_FIREBASE_API_KEY="..." (for each var)');
  console.error('3. Delete build folder: rm -rf build');
  console.error('4. Rebuild: npm run build');
  console.error('5. Check build logs above to see if VITE_ vars were available');
  console.error('6. Remember: VITE_ vars must be set BEFORE build, not at PM2 runtime!');
  console.error('');
  console.error('This will cause Firebase initialization to fail!');
} else {
  console.log('✅✅✅ All Firebase config fields present and valid');
}

console.log('Final Firebase Config:', {
  apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : '❌ MISSING',
  authDomain: firebaseConfig.authDomain || '❌ MISSING',
  projectId: firebaseConfig.projectId || '❌ MISSING',
  storageBucket: firebaseConfig.storageBucket || '❌ MISSING',
  messagingSenderId: firebaseConfig.messagingSenderId || '❌ MISSING',
  appId: firebaseConfig.appId ? `${firebaseConfig.appId.substring(0, 20)}...` : '❌ MISSING'
});

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

export { app, auth, firestore, functions, database, storage, firebaseConfig };