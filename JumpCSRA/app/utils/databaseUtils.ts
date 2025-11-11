// Utility functions for handling database sync issues

import { getFirestore, doc, setDoc, getDoc, collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getDatabase, ref, set, get, child, push } from "firebase/database";

// Type definitions for new data structures
export interface BookingData {
  orderID: string;
  customerID: string;
  status: 'deferred' | 'pending' | 'confirmed' | 'completed' | 'cancelled';
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
  notes?: Array<{
    type: 'system' | 'admin' | 'customer';
    message: string;
    timestamp: string;
  }>;
  emails?: {
    depositReminder: boolean;
    eventConfirmation: boolean;
    thanks: boolean;
    rebooking: boolean;
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

// Wallet and Payment Information Types
export interface WalletTransaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'gift_card_redemption';
  amount: number;
  description: string;
  orderID?: string; // For withdrawals/purchases
  giftCardCode?: string; // For gift card redemptions
  paypalTransactionId?: string; // For deposits
  createdAt: string;
}

export interface UserWallet {
  userId: string;
  balance: number;
  transactions: WalletTransaction[];
  createdAt: string;
  updatedAt: string;
}

export interface SavedPaymentMethod {
  id: string;
  paypalVaultId: string; // PayPal vault token
  type: 'card' | 'paypal';
  lastFour?: string; // Last 4 digits for cards
  cardType?: string; // Visa, Mastercard, etc.
  expiryMonth?: string;
  expiryYear?: string;
  isDefault: boolean;
  createdAt: string;
}

export interface UserPaymentInfo {
  userId: string;
  savedPaymentMethods: SavedPaymentMethod[];
  paypalVaultId?: string; // PayPal vault customer ID for recurring billing
  billingAddress: {
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Booking Database Functions
export const saveBookingData = async (bookingData: BookingData): Promise<boolean> => {
  try {
    const database = getDatabase();
    const bookingsRef = ref(database, `bookings/${bookingData.orderID}`);
    
    // Initialize email tracking collection if it doesn't exist
    const dataToSave = {
      ...bookingData,
      updatedAt: new Date().toISOString(),
      // Initialize email tracking flags for scheduled emails
      emails: bookingData.emails || {
        depositReminder: false,
        eventConfirmation: false,
        thanks: false,
        rebooking: false
      }
    };
    
    await set(bookingsRef, dataToSave);
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
      return snapshot.val() as BookingData;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error loading booking data:', error);
    return null;
  }
};

export const updateBookingStatus = async (orderID: string, status: 'deferred' | 'pending' | 'confirmed' | 'completed' | 'cancelled'): Promise<boolean> => {
  try {
    const database = getDatabase();
    const statusRef = ref(database, `bookings/${orderID}/status`);
    const updatedAtRef = ref(database, `bookings/${orderID}/updatedAt`);
    
    await set(statusRef, status);
    await set(updatedAtRef, new Date().toISOString());
    
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
      return snapshot.val() as ContractData;
    } else {
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
          return contracts[contractID] as ContractData;
        }
      }
    }
    
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
    
    localStorage.removeItem('pendingUserData');
    
    return true;
  } catch (error: any) {
    console.error('Failed to sync pending user data:', error);
    
    if (error.code === 'permission-denied') {
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
    
    // Test write access
    await setDoc(
      userRef,
      { testTimestamp: new Date().toISOString() },
      { merge: true }
    );
    
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

// Booking Status Logic Functions
export const isBookingWithinTwoDays = (eventDate: string): boolean => {
  try {
    const today = new Date();
    const bookingDate = new Date(eventDate);
    const twoDaysFromNow = new Date(today);
    twoDaysFromNow.setDate(today.getDate() + 2);
    
    // Reset time to start of day for accurate comparison
    today.setHours(0, 0, 0, 0);
    bookingDate.setHours(0, 0, 0, 0);
    twoDaysFromNow.setHours(23, 59, 59, 999);
    
    return bookingDate >= today && bookingDate <= twoDaysFromNow;
  } catch (error) {
    console.error('Error checking if booking is within two days:', error);
    return false;
  }
};

export const isBookingPastEventDate = (eventDate: string): boolean => {
  try {
    const today = new Date();
    const bookingDate = new Date(eventDate);
    
    // Set today to end of day and booking date to end of day for comparison
    today.setHours(23, 59, 59, 999);
    bookingDate.setHours(23, 59, 59, 999);
    
    return today > bookingDate;
  } catch (error) {
    console.error('Error checking if booking is past event date:', error);
    return false;
  }
};

export const determineInitialBookingStatus = (eventDate: string, isContractSigned: boolean, depositAmount: number, totalAmount: number, isGiftCardOnly: boolean = false): 'deferred' | 'pending' | 'confirmed' => {
  // Gift card only purchases are always confirmed when payment is complete
  if (isGiftCardOnly && depositAmount >= totalAmount) {
    return 'confirmed';
  }
  
  // Check if booking is within 2 days and contract is signed
  if (isContractSigned && isBookingWithinTwoDays(eventDate)) {
    return 'deferred';
  }
  
  // Check payment status if contract is signed and not within 2 days
  if (isContractSigned && !isBookingWithinTwoDays(eventDate)) {
    if (depositAmount >= totalAmount) {
      // Full payment made
      return 'confirmed';
    } else if (depositAmount > 0) {
      // Deposit made (50% payment)
      return 'pending';
    }
  }
  
  // Default case - this shouldn't happen in normal flow since bookings 
  // are only saved after contract signing, but included for safety
  return 'deferred';
};

export const updateBookingStatusBasedOnPayment = async (orderID: string, depositAmount: number, totalAmount: number): Promise<boolean> => {
  try {
    
    // Load existing booking to get event date and other details
    const bookingData = await loadBookingData(orderID);
    if (!bookingData) {
      console.error('❌ Booking not found for payment status update:', orderID);
      return false;
    }
    
    
    // Parse event date from orderDetails.eventDate (format: "MM/DD/YYYY - MM/DD/YYYY")
    const eventDateString = bookingData.orderDetails.eventDate.split(' - ')[0];
    
    // Check if this is a gift card only order
    const isGiftCardOnly = bookingData.orderDetails.items.every(item => 
      item.name.toLowerCase().includes('gift card') || 
      item.name.toLowerCase().includes('giftcard')
    );
    
    
    let newStatus: 'deferred' | 'pending' | 'confirmed';
    
    // Gift card only orders are always confirmed when payment is complete
    if (isGiftCardOnly && depositAmount >= totalAmount) {
      newStatus = 'confirmed';
    } else if (bookingData.status === 'deferred') {
      // If booking was deferred, it should move to pending or confirmed based on payment
      if (depositAmount >= totalAmount) {
        newStatus = 'confirmed'; // Full payment
      } else if (depositAmount > 0) {
        newStatus = 'pending'; // Deposit payment
      } else {
        newStatus = 'deferred'; // No payment yet
      }
    } else {
      // For non-deferred bookings, determine status based on payment
      if (depositAmount >= totalAmount) {
        newStatus = 'confirmed'; // Full payment
      } else if (depositAmount > 0) {
        newStatus = 'pending'; // Deposit payment  
      } else {
        // This shouldn't happen - bookings should have payment when this is called
        newStatus = bookingData.status as 'pending' | 'confirmed';
      }
    }
    
    
    // Update booking status and payment details
    const database = getDatabase();
    
    await set(ref(database, `bookings/${orderID}/status`), newStatus);
    await set(ref(database, `bookings/${orderID}/paymentDetails/depositAmount`), depositAmount);
    await set(ref(database, `bookings/${orderID}/paymentDetails/remainingBalance`), totalAmount - depositAmount);
    await set(ref(database, `bookings/${orderID}/updatedAt`), new Date().toISOString());
    
    return true;
  } catch (error) {
    console.error('❌ Error updating booking status based on payment:', error);
    console.error('❌ Error details:', {
      orderID,
      depositAmount,
      totalAmount,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined
    });
    return false;
  }
};

// Function to check and update completed bookings (to be run as a scheduled job)
export const checkAndMarkCompletedBookings = async (): Promise<number> => {
  try {
    const database = getDatabase();
    const bookingsRef = ref(database, 'bookings');
    const snapshot = await get(bookingsRef);
    
    if (!snapshot.exists()) {
      return 0;
    }
    
    const bookings = snapshot.val();
    let updatedCount = 0;
    
    for (const orderID in bookings) {
      const booking = bookings[orderID] as BookingData;
      
      // Only update confirmed bookings that are past their event date
      if (booking.status === 'confirmed') {
        const eventDateString = booking.orderDetails.eventDate.split(' - ')[0]; // Get start date
        
        if (isBookingPastEventDate(eventDateString)) {
          await updateBookingStatus(orderID, 'completed');
          updatedCount++;
        }
      }
    }
    
    return updatedCount;
  } catch (error) {
    console.error('Error checking and marking completed bookings:', error);
    return 0;
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
      return userDoc.data();
    }
  } catch (error: any) {
  }
  
  // Fallback to localStorage
  const pendingData = localStorage.getItem('pendingUserData');
  if (pendingData) {
    try {
      const userData = JSON.parse(pendingData);
      if (userData.uid === user.uid) {
        
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

// Wallet Database Functions
export const createUserWallet = async (userId: string): Promise<boolean> => {
  try {
    const firestore = getFirestore();
    const walletRef = doc(firestore, 'wallets', userId);
    
    const newWallet: UserWallet = {
      userId,
      balance: 0,
      transactions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await setDoc(walletRef, newWallet);
    return true;
  } catch (error) {
    console.error('Error creating user wallet:', error);
    return false;
  }
};

export const getUserWallet = async (userId: string): Promise<UserWallet | null> => {
  try {
    const firestore = getFirestore();
    const walletRef = doc(firestore, 'wallets', userId);
    const walletSnap = await getDoc(walletRef);
    
    if (walletSnap.exists()) {
      return walletSnap.data() as UserWallet;
    } else {
      // Create wallet if it doesn't exist
      await createUserWallet(userId);
      return await getUserWallet(userId);
    }
  } catch (error) {
    console.error('Error getting user wallet:', error);
    return null;
  }
};

export const addWalletTransaction = async (
  userId: string, 
  transaction: Omit<WalletTransaction, 'id' | 'createdAt'>
): Promise<boolean> => {
  try {
    const firestore = getFirestore();
    const walletRef = doc(firestore, 'wallets', userId);
    const walletSnap = await getDoc(walletRef);
    
    if (!walletSnap.exists()) {
      await createUserWallet(userId);
    }
    
    const currentWallet = walletSnap.data() as UserWallet;
    const newTransaction: WalletTransaction = {
      ...transaction,
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    
    // Calculate new balance
    let newBalance = currentWallet.balance;
    if (transaction.type === 'deposit' || transaction.type === 'gift_card_redemption') {
      newBalance += transaction.amount;
    } else if (transaction.type === 'withdrawal') {
      // withdrawal amount should be negative, so add it
      newBalance += transaction.amount;
    }
    
    const updatedWallet: UserWallet = {
      ...currentWallet,
      balance: Math.max(0, newBalance), // Ensure balance doesn't go negative
      transactions: [newTransaction, ...currentWallet.transactions],
      updatedAt: new Date().toISOString()
    };
    
    await setDoc(walletRef, updatedWallet);
    return true;
  } catch (error) {
    console.error('Error adding wallet transaction:', error);
    return false;
  }
};

export const updateWalletBalance = async (userId: string, newBalance: number): Promise<boolean> => {
  try {
    const firestore = getFirestore();
    const walletRef = doc(firestore, 'wallets', userId);
    const walletSnap = await getDoc(walletRef);
    
    if (!walletSnap.exists()) {
      return false;
    }
    
    const currentWallet = walletSnap.data() as UserWallet;
    const updatedWallet: UserWallet = {
      ...currentWallet,
      balance: Math.max(0, newBalance),
      updatedAt: new Date().toISOString()
    };
    
    await setDoc(walletRef, updatedWallet);
    return true;
  } catch (error) {
    console.error('Error updating wallet balance:', error);
    return false;
  }
};

// Payment Information Database Functions
export const saveUserPaymentInfo = async (paymentInfo: UserPaymentInfo): Promise<boolean> => {
  try {
    const firestore = getFirestore();
    // Store in users collection instead of root paymentInfo collection
    const paymentRef = doc(firestore, 'users', paymentInfo.userId, 'paymentInfo', 'data');
    
    const dataToSave = {
      ...paymentInfo,
      updatedAt: new Date().toISOString()
    };
    
    await setDoc(paymentRef, dataToSave);
    return true;
  } catch (error) {
    console.error('Error saving user payment info:', error);
    return false;
  }
};

export const getUserPaymentInfo = async (userId: string): Promise<UserPaymentInfo | null> => {
  try {
    const firestore = getFirestore();
    // Get from users collection instead of root paymentInfo collection
    const paymentRef = doc(firestore, 'users', userId, 'paymentInfo', 'data');
    const paymentSnap = await getDoc(paymentRef);
    
    if (paymentSnap.exists()) {
      return paymentSnap.data() as UserPaymentInfo;
    } else {
      // Create empty payment info if it doesn't exist
      const newPaymentInfo: UserPaymentInfo = {
        userId,
        savedPaymentMethods: [],
        billingAddress: {
          firstName: '',
          lastName: '',
          address: '',
          city: '',
          state: '',
          zipCode: '',
          country: 'US'
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await saveUserPaymentInfo(newPaymentInfo);
      return newPaymentInfo;
    }
  } catch (error) {
    console.error('Error getting user payment info:', error);
    return null;
  }
};

export const addSavedPaymentMethod = async (
  userId: string, 
  paymentMethod: Omit<SavedPaymentMethod, 'id' | 'createdAt'>
): Promise<boolean> => {
  try {
    const currentPaymentInfo = await getUserPaymentInfo(userId);
    if (!currentPaymentInfo) return false;
    
    const newPaymentMethod: SavedPaymentMethod = {
      ...paymentMethod,
      id: `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    
    // If this is set as default, make others non-default
    if (paymentMethod.isDefault) {
      currentPaymentInfo.savedPaymentMethods = currentPaymentInfo.savedPaymentMethods.map(pm => ({
        ...pm,
        isDefault: false
      }));
    }
    
    const updatedPaymentInfo: UserPaymentInfo = {
      ...currentPaymentInfo,
      savedPaymentMethods: [newPaymentMethod, ...currentPaymentInfo.savedPaymentMethods],
      updatedAt: new Date().toISOString()
    };
    
    return await saveUserPaymentInfo(updatedPaymentInfo);
  } catch (error) {
    console.error('Error adding saved payment method:', error);
    return false;
  }
};

// Get incomplete bookings for a user (for booking recovery)
export async function getIncompleteBookingsForUser(userId: string): Promise<BookingData[]> {
  try {
    const db = getDatabase();
    const bookingsRef = ref(db, 'bookings');
    const snapshot = await get(bookingsRef);
    
    if (!snapshot.exists()) {
      return [];
    }
    
    const allBookings = snapshot.val();
    const incompleteBookings: BookingData[] = [];
    
    // Find bookings for this user that are incomplete (pending/deferred and no payment)
    Object.keys(allBookings).forEach(bookingId => {
      const booking = allBookings[bookingId];
      if (booking.customerID === userId && 
          (booking.status === 'pending' || booking.status === 'deferred') &&
          (!booking.paymentDetails.paymentStatus || booking.paymentDetails.paymentStatus === 'pending')) {
        incompleteBookings.push(booking);
      }
    });
    
    // Sort by creation date (most recent first)
    incompleteBookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return incompleteBookings;
  } catch (error) {
    console.error('Error getting incomplete bookings for user:', error);
    return [];
  }
}

// Check if booking should be deferred (event within 2 days)
export function shouldDeferBooking(eventDate: string): boolean {
  const event = new Date(eventDate);
  const now = new Date();
  const twoDaysFromNow = new Date(now.getTime() + (2 * 24 * 60 * 60 * 1000));
  
  return event <= twoDaysFromNow;
}

// Update booking to deferred status
export async function deferBooking(bookingId: string, reason?: string): Promise<boolean> {
  try {
    const booking = await loadBookingData(bookingId);
    if (!booking) {
      console.error('Booking not found for deferral:', bookingId);
      return false;
    }
    
    booking.status = 'deferred';
    booking.updatedAt = new Date().toISOString();
    
    // Add a note about why it was deferred
    if (!booking.notes) {
      booking.notes = [];
    }
    
    booking.notes.push({
      type: 'system',
      message: reason || 'Booking deferred due to event date within 2 days of contract signing',
      timestamp: new Date().toISOString()
    });
    
    const success = await saveBookingData(booking);
    if (success) {
    }
    
    return success;
  } catch (error) {
    console.error('Error deferring booking:', error);
    return false;
  }
}

// Delete all user data (for account deletion)
export async function deleteAllUserData(userId: string): Promise<{
  success: boolean;
  deletedWalletBalance?: number;
  error?: string;
}> {
  try {
    const db = getDatabase();
    const firestore = getFirestore();
    
    // Get user wallet to check balance
    let walletBalance = 0;
    try {
      const userWallet = await getUserWallet(userId);
      if (userWallet) {
        walletBalance = userWallet.balance;
      }
    } catch (error) {
      console.warn('Could not get wallet balance during deletion:', error);
    }
    
    // Delete from Realtime Database
    
    // Delete user wallet data
    const walletRef = ref(db, `userWallets/${userId}`);
    await set(walletRef, null);
    
    // Delete user payment info
    const paymentInfoRef = ref(db, `userPaymentInfo/${userId}`);
    await set(paymentInfoRef, null);
    
    // Delete user bookings (mark as deleted to preserve order history)
    const bookingsRef = ref(db, 'bookings');
    const bookingsSnapshot = await get(bookingsRef);
    
    if (bookingsSnapshot.exists()) {
      const allBookings = bookingsSnapshot.val();
      const updates: Record<string, any> = {};
      
      Object.keys(allBookings).forEach(bookingId => {
        const booking = allBookings[bookingId];
        if (booking.customerID === userId) {
          updates[`bookings/${bookingId}/status`] = 'deleted';
          updates[`bookings/${bookingId}/customerInfo/deleted`] = true;
          updates[`bookings/${bookingId}/deletedAt`] = new Date().toISOString();
        }
      });
      
      if (Object.keys(updates).length > 0) {
        await set(ref(db), updates);
      }
    }
    
    // Delete gift cards purchased by user (but not promotional ones)
    const giftCardsRef = ref(db, 'giftCards');
    const giftCardsSnapshot = await get(giftCardsRef);
    
    if (giftCardsSnapshot.exists()) {
      const allGiftCards = giftCardsSnapshot.val();
      const giftCardUpdates: Record<string, any> = {};
      
      Object.keys(allGiftCards).forEach(giftCardCode => {
        const giftCard = allGiftCards[giftCardCode];
        if (giftCard.purchaserUserId === userId && !giftCard.isGift) {
          // Mark as deleted instead of removing completely
          giftCardUpdates[`giftCards/${giftCardCode}/status`] = 'deleted';
          giftCardUpdates[`giftCards/${giftCardCode}/deletedAt`] = new Date().toISOString();
        }
      });
      
      if (Object.keys(giftCardUpdates).length > 0) {
        await set(ref(db), giftCardUpdates);
      }
    }
    
    // Delete from Firestore collections
    
    try {
      // Delete from paymentInfo collection
      const { collection, query, where, getDocs, deleteDoc } = await import('firebase/firestore');
      
      const paymentInfoQuery = query(
        collection(firestore, 'paymentInfo'), 
        where('userId', '==', userId)
      );
      const paymentInfoSnapshot = await getDocs(paymentInfoQuery);
      
      const paymentInfoDeletions = paymentInfoSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(paymentInfoDeletions);
      
      // Delete from wallets collection
      const walletsQuery = query(
        collection(firestore, 'wallets'), 
        where('userId', '==', userId)
      );
      const walletsSnapshot = await getDocs(walletsQuery);
      
      const walletsDeletions = walletsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(walletsDeletions);
      
    } catch (firestoreError) {
      console.error('Error deleting Firestore collections:', firestoreError);
      // Continue with deletion even if Firestore deletion partially fails
    }
    
    
    return {
      success: true,
      deletedWalletBalance: walletBalance
    };
    
  } catch (error) {
    console.error('Error deleting user data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Membership interfaces
export interface UserMembership {
  weekday: boolean;
  weekend: boolean;
  dateStarted?: string; // ISO date when membership started
  cancelled?: boolean; // If true, cancel at next billing cycle
  createdAt?: string;
  updatedAt?: string;
}

export interface MembershipPayment {
  id: string;
  userId: string;
  membershipType: 'weekday' | 'weekend';
  amount: number;
  paymentDate: string;
  nextBillingDate: string;
  paymentMethodId?: string;
  paypalTransactionId?: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  failureReason?: string;
  createdAt: string;
}

// Membership utility functions
export const getUserMembership = async (userId: string): Promise<UserMembership | null> => {
  try {
    const firestore = getFirestore();
    const membershipRef = doc(firestore, 'users', userId, 'membership', 'status');
    const membershipSnap = await getDoc(membershipRef);
    
    if (!membershipSnap.exists()) {
      return null;
    }
    
    return membershipSnap.data() as UserMembership;
  } catch (error) {
    console.error('Error getting user membership:', error);
    return null;
  }
};

export const updateUserMembership = async (
  userId: string, 
  membershipType: 'weekday' | 'weekend', 
  isActive: boolean
): Promise<boolean> => {
  try {
    const firestore = getFirestore();
    const membershipRef = doc(firestore, 'users', userId, 'membership', 'status');
    
    // Get existing membership or create new one
    const existingMembership = await getUserMembership(userId);
    const currentMembership: UserMembership = existingMembership || {
      weekday: false,
      weekend: false,
      createdAt: new Date().toISOString()
    };
    
    // Update the specific membership type
    currentMembership[membershipType] = isActive;
    currentMembership.updatedAt = new Date().toISOString();
    
    // Set dateStarted when activating a membership for the first time
    if (isActive && !currentMembership.dateStarted) {
      currentMembership.dateStarted = new Date().toISOString();
    }
    
    // Clear dateStarted if deactivating all memberships
    if (!isActive && !currentMembership.weekday && !currentMembership.weekend) {
      delete currentMembership.dateStarted;
      delete currentMembership.cancelled;
    }
    
    await setDoc(membershipRef, currentMembership);
    
    return true;
  } catch (error) {
    console.error('Error updating user membership:', error);
    return false;
  }
};

export const isUserMember = async (userId: string, membershipType?: 'weekday' | 'weekend'): Promise<boolean> => {
  try {
    const membership = await getUserMembership(userId);
    
    if (!membership) {
      return false;
    }
    
    if (membershipType) {
      return membership[membershipType];
    }
    
    // If no specific type provided, check if user has any membership
    return membership.weekday || membership.weekend;
  } catch (error) {
    console.error('Error checking user membership:', error);
    return false;
  }
};

// Helper function to apply membership discount to cart total
export const applyMembershipDiscount = (
  cartTotal: number, 
  hasMembership: boolean, 
  excludeGiftCardsAndMemberships: boolean = true
): number => {
  if (!hasMembership) {
    return cartTotal;
  }
  
  // Apply 25% discount
  return cartTotal * 0.75;
};

// Membership Payment Functions
export const saveMembershipPayment = async (payment: MembershipPayment): Promise<boolean> => {
  try {
    const firestore = getFirestore();
    const paymentRef = doc(firestore, 'membershipPayments', payment.id);
    
    await setDoc(paymentRef, {
      ...payment,
      createdAt: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    console.error('Error saving membership payment:', error);
    return false;
  }
};

export const getUsersMembershipPayments = async (userId: string): Promise<MembershipPayment[]> => {
  try {
    const firestore = getFirestore();
    const paymentsRef = collection(firestore, 'membershipPayments');
    const q = query(
      paymentsRef, 
      where('userId', '==', userId), 
      orderBy('paymentDate', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as MembershipPayment);
  } catch (error) {
    console.error('Error getting membership payments:', error);
    return [];
  }
};

export const updateMembershipDateStarted = async (userId: string, membershipType: 'weekday' | 'weekend'): Promise<boolean> => {
  try {
    const firestore = getFirestore();
    const membershipRef = doc(firestore, 'users', userId, 'membership', 'status');
    
    const updateData: Partial<UserMembership> = {
      dateStarted: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Set the membership type
    updateData[membershipType] = true;
    
    await setDoc(membershipRef, updateData, { merge: true });
    return true;
  } catch (error) {
    console.error('Error updating membership dateStarted:', error);
    return false;
  }
};

export const cancelMembership = async (userId: string): Promise<boolean> => {
  try {
    const firestore = getFirestore();
    const membershipRef = doc(firestore, 'users', userId, 'membership', 'status');
    
    const updateData: Partial<UserMembership> = {
      cancelled: true,
      updatedAt: new Date().toISOString()
    };
    
    await setDoc(membershipRef, updateData, { merge: true });
    return true;
  } catch (error) {
    console.error('Error cancelling membership:', error);
    return false;
  }
};
