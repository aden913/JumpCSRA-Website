// Utility functions for handling database sync issues

import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Check if there's pending user data that needs to be synced to Firestore
export const checkPendingUserSync = async () => {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) return false;
  
  const pendingData = localStorage.getItem('pendingUserData');
  if (!pendingData) return false;
  
  try {
    const userData = JSON.parse(pendingData);
    
    // Verify this is the same user
    if (userData.uid !== user.uid) {
      localStorage.removeItem('pendingUserData');
      return false;
    }
    
    console.log('Found pending user data, attempting to sync to Firestore...');
    
    const db = getFirestore();
    const userRef = doc(db, "users", user.uid);
    
    // Extract firstName and lastName from displayName
    const displayName = userData.displayName || "";
    const nameParts = displayName.split(' ');
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(' ') || "";

    // Try to sync the data
    await setDoc(
      userRef,
      {
        firstName,
        lastName,
        name: displayName,
        email: userData.email || "",
        uid: userData.uid,
        emailVerified: userData.emailVerified || false,
        createdAt: new Date(userData.timestamp).toISOString(),
        lastUpdated: new Date().toISOString(),
        syncedAt: new Date().toISOString()
      },
      { merge: true }
    );
    
    console.log('Successfully synced pending user data to Firestore');
    localStorage.removeItem('pendingUserData');
    
    return true;
  } catch (error: any) {
    console.error('Failed to sync pending user data:', error);
    
    if (error.code === 'permission-denied') {
      console.log('Database access still denied, keeping data in localStorage');
    }
    
    return false;
  }
};

// Test database connectivity
export const testDatabaseAccess = async () => {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) {
    return { success: false, error: 'No authenticated user' };
  }
  
  try {
    const db = getFirestore();
    const userRef = doc(db, "users", user.uid);
    
    // Test read access
    await getDoc(userRef);
    console.log('Database read access: OK');
    
    // Test write access
    await setDoc(
      userRef,
      { testTimestamp: new Date().toISOString() },
      { merge: true }
    );
    console.log('Database write access: OK');
    
    return { success: true, message: 'Full database access available' };
    
  } catch (error: any) {
    console.error('Database access test failed:', error);
    
    return { 
      success: false, 
      error: error.code,
      message: error.code === 'permission-denied' 
        ? 'Database rules need to be updated' 
        : `Database error: ${error.message}`
    };
  }
};

// Get user data (from Firestore or localStorage fallback)
export const getUserData = async () => {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) return null;
  
  try {
    // Try to get from Firestore first
    const db = getFirestore();
    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      console.log('Retrieved user data from Firestore');
      return userDoc.data();
    }
  } catch (error: any) {
    console.log('Firestore access failed, checking localStorage...');
  }
  
  // Fallback to localStorage
  const pendingData = localStorage.getItem('pendingUserData');
  if (pendingData) {
    try {
      const userData = JSON.parse(pendingData);
      if (userData.uid === user.uid) {
        console.log('Retrieved user data from localStorage fallback');
        
        // Extract firstName and lastName from displayName
        const displayName = userData.displayName || "";
        const nameParts = displayName.split(' ');
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(' ') || "";
        
        return {
          firstName,
          lastName,
          name: displayName,
          email: userData.email || "",
          uid: userData.uid,
          emailVerified: userData.emailVerified || false,
          source: 'localStorage'
        };
      }
    } catch (error) {
      console.error('Error parsing localStorage user data:', error);
    }
  }
  
  return null;
};