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
// These are public Firebase client keys - safe to commit
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDs39ycP3-tg21iBpWul8cp6hoqoKhI2cE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "pppro-b060e.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://pppro-b060e-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "pppro-b060e",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "pppro-b060e.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "819237875595",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:819237875595:web:1ee4ce4c815c1b4d2f498e"
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