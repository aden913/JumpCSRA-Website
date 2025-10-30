const admin = require('firebase-admin');
const logger = require('../utils/logger');

let firebaseApp = null;

const initializeFirebase = async () => {
  try {
    if (firebaseApp) {
      return firebaseApp;
    }

    // Check if all required environment variables are present
    const requiredVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_CLIENT_EMAIL', 
      'FIREBASE_PRIVATE_KEY'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      logger.warn(`Missing Firebase environment variables: ${missingVars.join(', ')}`);
      logger.warn('Firebase features will be disabled. Server will continue without Firebase.');
      return null;
    }

    // Initialize Firebase Admin SDK
    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID
    });

    logger.info('Firebase Admin SDK initialized successfully');
    return firebaseApp;
  } catch (error) {
    logger.error('Failed to initialize Firebase:', error);
    logger.warn('Firebase features will be disabled. Server will continue without Firebase.');
    return null;
  }
};

const getFirestore = () => {
  if (!firebaseApp) {
    logger.warn('Firebase not initialized - Firestore operations will be skipped');
    return null;
  }
  return admin.firestore();
};

const getAuth = () => {
  if (!firebaseApp) {
    logger.warn('Firebase not initialized - Auth operations will be skipped');
    return null;
  }
  return admin.auth();
};

module.exports = {
  initializeFirebase,
  getFirestore,
  getAuth,
  admin
};