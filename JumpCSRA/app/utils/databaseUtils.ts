// Utility functions for handling database sync issues

import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getDatabase, ref, set, get, child, push } from "firebase/database";

// Type definitions for new data structures
export interface BookingData {
  orderID: string;
  customerID: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  customerInfo: {
    firstName: string;
    lastName: string;
    name: string;
    email: string;
    phone?: string;
  };
  orderDetails: {
    eventDate: string;
    duration: string;
    deliveryAddress: string;
    surface: string;
    deliveryTime: string;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
    totalAmount: number;
  };
  paymentDetails: {
    totalAmount: number;
    depositAmount: number;
    remainingBalance: number;
    paymentType: 'full' | 'deposit';
    paypalOrderId?: string;
    paypalTransactionId?: string;
    paymentStatus: 'pending' | 'completed' | 'failed';
    paymentDate?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ContractData {
  contractID: string;
  orderID: string;
  customerID: string;
  agreementSections: Array<{
    id: string;
    title: string;
    content: string;
    isInitialed: boolean;
    initialedAt?: string;
    isFinePrint?: boolean;
  }>;
  signature: {
    signatureData: string;
    signedAt: string;
  } | null;
  contractDate: string;
  initials: string;
  contractStatus: 'unsigned' | 'signed';
}

// Booking Database Functions
export const saveBookingData = async (bookingData: BookingData): Promise<boolean> => {
  try {
    const database = getDatabase();
    const bookingsRef = ref(database, `bookings/${bookingData.orderID}`);
    
    const dataToSave = {
      ...bookingData,
      updatedAt: new Date().toISOString()
    };
    
    await set(bookingsRef, dataToSave);
    console.log('Booking data saved successfully:', bookingData.orderID);
    return true;
  } catch (error) {
    console.error('Error saving booking data:', error);
    return false;
  }
};

export const loadBookingData = async (orderID: string): Promise<BookingData | null> => {
  try {
    const database = getDatabase();
    const bookingRef = ref(database, `bookings/${orderID}`);
    const snapshot = await get(bookingRef);
    
    if (snapshot.exists()) {
      console.log('Booking data loaded successfully:', orderID);
      return snapshot.val() as BookingData;
    } else {
      console.log('No booking data found for orderID:', orderID);
      return null;
    }
  } catch (error) {
    console.error('Error loading booking data:', error);
    return null;
  }
};

export const updateBookingStatus = async (orderID: string, status: 'pending' | 'confirmed' | 'cancelled'): Promise<boolean> => {
  try {
    const database = getDatabase();
    const statusRef = ref(database, `bookings/${orderID}/status`);
    const updatedAtRef = ref(database, `bookings/${orderID}/updatedAt`);
    
    await set(statusRef, status);
    await set(updatedAtRef, new Date().toISOString());
    
    console.log('Booking status updated:', orderID, status);
    return true;
  } catch (error) {
    console.error('Error updating booking status:', error);
    return false;
  }
};

// Contract Database Functions
export const saveContractData = async (contractData: ContractData): Promise<boolean> => {
  try {
    const database = getDatabase();
    const contractsRef = ref(database, `contracts/${contractData.contractID}`);
    
    await set(contractsRef, contractData);
    console.log('Contract data saved successfully:', contractData.contractID);
    return true;
  } catch (error) {
    console.error('Error saving contract data:', error);
    return false;
  }
};

export const loadContractData = async (contractID: string): Promise<ContractData | null> => {
  try {
    const database = getDatabase();
    const contractRef = ref(database, `contracts/${contractID}`);
    const snapshot = await get(contractRef);
    
    if (snapshot.exists()) {
      console.log('Contract data loaded successfully:', contractID);
      return snapshot.val() as ContractData;
    } else {
      console.log('No contract data found for contractID:', contractID);
      return null;
    }
  } catch (error) {
    console.error('Error loading contract data:', error);
    return null;
  }
};

export const loadContractByOrderID = async (orderID: string): Promise<ContractData | null> => {
  try {
    const database = getDatabase();
    const contractsRef = ref(database, 'contracts');
    const snapshot = await get(contractsRef);
    
    if (snapshot.exists()) {
      const contracts = snapshot.val();
      // Find contract with matching orderID
      for (const contractID in contracts) {
        if (contracts[contractID].orderID === orderID) {
          console.log('Contract found for orderID:', orderID);
          return contracts[contractID] as ContractData;
        }
      }
    }
    
    console.log('No contract found for orderID:', orderID);
    return null;
  } catch (error) {
    console.error('Error loading contract by orderID:', error);
    return null;
  }
};

export const updateContractStatus = async (contractID: string, contractStatus: 'unsigned' | 'signed'): Promise<boolean> => {
  try {
    const database = getDatabase();
    const statusRef = ref(database, `contracts/${contractID}/contractStatus`);
    
    await set(statusRef, contractStatus);
    console.log('Contract status updated:', contractID, contractStatus);
    return true;
  } catch (error) {
    console.error('Error updating contract status:', error);
    return false;
  }
};

// Utility function to generate unique IDs
export const generateOrderID = (): string => {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
};

export const generateContractID = (): string => {
  return 'CONTRACT_' + Date.now().toString() + Math.random().toString(36).substr(2, 9);
};

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