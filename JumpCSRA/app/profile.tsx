import React, { useState, useEffect, useRef } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { useNavigate } from "react-router";
import { RouterNav } from "./components/RouterNav";
import { GooglePlacesAutocomplete } from "./components/GooglePlacesAutocomplete";
import { auth, firestore } from "./components/FirebaseConfig";
import { onAuthStateChanged, unlink  } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { getDatabase, ref, get } from "firebase/database";
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import "./styles/profile.css";
import { useInflateables } from "./hooks/useInflateables";
import { useCategories } from "./hooks/useCategories";
import type { CartItem } from "./components/CartSidebar";
import { loadBookingData, loadContractData, loadContractByOrderID, getUserWallet, getUserPaymentInfo, addWalletTransaction, addSavedPaymentMethod, deleteAllUserData, updateBookingStatus } from "./utils/databaseUtils";
import type { BookingData, ContractData, UserWallet, UserPaymentInfo, SavedPaymentMethod, UserMembership } from "./utils/databaseUtils";

// Helper function to clear all localStorage data on sign out
const clearAllLocalStorage = () => {
  // Cart-related data
  localStorage.removeItem('cart');
  localStorage.removeItem('cart_duration');
  localStorage.removeItem('cart_surface');
  localStorage.removeItem('cart_deliveryTime');
  localStorage.removeItem('cart_location');
  localStorage.removeItem('cart_wetDrySelections');
  localStorage.removeItem('cart_giftCardValues');
  localStorage.removeItem('orderMessage');
  
  // User session data
  localStorage.removeItem('pendingEmail');
  localStorage.removeItem('calendarDateRange');
  localStorage.removeItem('resumeBookingId');
  localStorage.removeItem('pendingUserData');
  
};
import { redeemGiftCardToWallet, validateGiftCard, getGiftCardDetails } from "./hooks/useDiscounts";
import { WalletFundingModal } from "./components/WalletFundingModal";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

// Base tabs that are always available
const BASE_TABS = ["Profile Information", "Bookings", "Membership", "Payment Information"];

export default function Profile() {
  const [canEditEmail, setCanEditEmail] = useState(false);
  const [canEditPassword, setCanEditPassword] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [emailChangeMsg, setEmailChangeMsg] = useState<string | null>(null);
  const [passwordChangeMsg, setPasswordChangeMsg] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState<"email" | "password" | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTab = localStorage.getItem('profile_activeTab');
      return savedTab ? parseInt(savedTab, 10) : 0;
    }
    return 0;
  });
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    name: "", // Keep for compatibility
    email: "",
    phone: "",
    company: "",
    address: "", // Full address including street, city, state, zip
  });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [guest, setGuest] = useState(false);

  // New states for email verification flow
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [showVerifyNewEmail, setShowVerifyNewEmail] = useState(false);

  // Add phone validation state
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Payment Information tab state
  const [userWallet, setUserWallet] = useState<UserWallet | null>(null);
  const [userPaymentInfo, setUserPaymentInfo] = useState<UserPaymentInfo | null>(null);
  const [userMembership, setUserMembership] = useState<UserMembership | null>(null);
  const [userSubscription, setUserSubscription] = useState<any | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  const [showPasswordVerification, setShowPasswordVerification] = useState(false);
  const [verificationPassword, setVerificationPassword] = useState("");
  const [passwordVerified, setPasswordVerified] = useState(false);

  const [loadingWallet, setLoadingWallet] = useState(false);
  const [loadingPaymentInfo, setLoadingPaymentInfo] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  
  // Gift Card Balance Checker State
  const [showGiftCardModal, setShowGiftCardModal] = useState(false);
  const [giftCardCode, setGiftCardCode] = useState("");
  const [giftCardLookupResult, setGiftCardLookupResult] = useState<any>(null);

  // Membership Booking State
  const [membershipBookingData, setMembershipBookingData] = useState<any>(null);
  const [loadingMembershipBooking, setLoadingMembershipBooking] = useState(false);
  const [membershipDataLoaded, setMembershipDataLoaded] = useState(false);
  
  // Membership Booking Selection State with localStorage persistence
  const [selectedWeekday, setSelectedWeekday] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('membershipBooking_weekday') || '';
    }
    return '';
  });
  const [selectedInflatable, setSelectedInflatable] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('membershipBooking_inflatable');
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });
  const [selectedSurface, setSelectedSurface] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('membershipBooking_surface') || 'grass';
    }
    return 'grass';
  });
  const [selectedStakesOrSandbags, setSelectedStakesOrSandbags] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('membershipBooking_stakesOrSandbags') || '';
    }
    return '';
  });
  const [deliveryAddress, setDeliveryAddress] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('membershipBooking_address') || '';
    }
    return '';
  });
  const [membershipBookingError, setMembershipBookingError] = useState<string | null>(null);

  // Create dynamic tabs based on subscription status
  const isActiveSubscriber = userSubscription?.status === 'ACTIVE' || userSubscription?.status === 'Active';
  const TABS = BASE_TABS; // Use base tabs only - membership booking moved to membership tab
  
  // Adjust active tab index when tabs change (simplified since tabs are now consistent)
  const adjustActiveTabForSubscription = () => {
    return activeTab; // No adjustment needed since tabs are consistent
  };
  const [loadingGiftCardLookup, setLoadingGiftCardLookup] = useState(false);
  const [giftCardError, setGiftCardError] = useState<string | null>(null);

  // Payment Method Storage Modal State
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [storingPaymentMethod, setStoringPaymentMethod] = useState(false);

  const navigate = useNavigate();
  
  // Add hooks for navbar functionality
  const inflateables = useInflateables();
  const categories = useCategories(inflateables);

  // Handle URL parameters for direct navigation
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab === 'membership') {
      setActiveTab(2); // Membership tab
    }
  }, [isActiveSubscriber]);

  // Adjust active tab when subscription status changes
  useEffect(() => {
    const adjustedTab = adjustActiveTabForSubscription();
    if (adjustedTab !== activeTab) {
      setActiveTab(adjustedTab);
    }
  }, [isActiveSubscriber]);

  // Helper function to get the tab index based on subscription status
  const getTabIndex = (tabName: string) => {
    // Tab indices are now consistent regardless of subscription status
    switch (tabName) {
      case 'profile': return 0;
      case 'bookings': return 1;
      case 'membership': return 2;
      case 'payment': return 3;
      default: return 0;
    }
  };

  // Membership Booking Helper Functions
  const validateMembershipBooking = (): string | null => {
    if (!selectedWeekday) return "Please select a delivery day";
    if (!selectedSurface) return "Please select a surface type";
    if (!profile.address) return "Please add your address in Profile Information tab";
    
    return null;
  };

  // Function to calculate the actual event date based on membership signup timing
  const calculateActualEventDate = (): Date | null => {
    if (!selectedWeekday || !userSubscription?.activatedAt) return null;
    
    const activatedDate = new Date(userSubscription.activatedAt.seconds ? 
      userSubscription.activatedAt.seconds * 1000 : userSubscription.activatedAt);
    
    // Find the next first occurrence of the selected weekday after today
    const today = new Date();
    const targetWeekday = ['monday', 'tuesday', 'wednesday', 'thursday'].indexOf(selectedWeekday.toLowerCase());
    
    if (targetWeekday === -1) return null;
    
    // Start from today and find the next first occurrence of weekday in a month
    let currentDate = new Date(today);
    
    // Look ahead up to 4 months
    while (currentDate <= new Date(today.getTime() + 120 * 24 * 60 * 60 * 1000)) {
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const targetDay = targetWeekday + 1; // Convert to Date.getDay() format
      const dayOfMonth = currentDate.getDate();
      
      // Check if this is the first occurrence of this weekday in the month (within first 7 days)
      if (dayOfWeek === targetDay && dayOfMonth <= 7) {
        // Check if it's at least 2 days in the future for delivery logistics
        const diffInDays = Math.ceil((currentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffInDays >= 2) {
          return currentDate;
        }
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return null;
  };

  // Helper function to safely format status strings
  const formatStatus = (status?: string): string => {
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
  };

  // Helper function to get status color
  const getStatusColor = (status?: string): string => {
    switch (status?.toLowerCase()) {
      case 'deferred':
        return '#ffc107'; // Yellow
      case 'pending':
        return '#17a2b8'; // Blue
      case 'confirmed':
        return '#28a745'; // Green
      case 'completed':
        return '#6c757d'; // Gray
      case 'cancelled':
        return '#dc3545'; // Red
      default:
        return '#6c757d'; // Default gray
    }
  };

  // Helper function to calculate days until event
  const calculateDaysUntilEvent = (eventDateStr: string): number => {
    const eventDate = new Date(eventDateStr);
    const today = new Date();
    const timeDiff = eventDate.getTime() - today.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  };

  // Helper function to determine cancellation policy outcome
  const getCancellationPolicyOutcome = (booking: BookingData) => {
    const eventDate = booking.orderDetails?.eventDate;
    if (!eventDate) {
      return {
        daysUntil: 0,
        refundType: 'none',
        refundAmount: 0,
        walletAmount: 0,
        policyText: 'Event date not found'
      };
    }

    const daysUntil = calculateDaysUntilEvent(eventDate);
    
    // Calculate total amount paid based on payment type
    let totalPaid = 0;
    if (booking.paymentDetails?.paymentStatus === 'completed') {
      if (booking.paymentDetails.paymentType === 'full') {
        totalPaid = booking.paymentDetails.totalAmount;
      } else if (booking.paymentDetails.paymentType === 'deposit') {
        totalPaid = booking.paymentDetails.depositAmount;
      }
    }

    if (daysUntil >= 14) {
      // 14+ days: Full refund
      return {
        daysUntil,
        refundType: 'full_refund',
        refundAmount: totalPaid,
        walletAmount: 0,
        policyText: 'You will receive a full refund to your original payment method.'
      };
    } else if (daysUntil >= 6 && daysUntil <= 13) {
      // 6-13 days: 100% to wallet as gift card
      return {
        daysUntil,
        refundType: 'wallet_full',
        refundAmount: 0,
        walletAmount: totalPaid,
        policyText: 'You will receive 100% as wallet credit (gift card) for any future rental—no expiration date.'
      };
    } else {
      // <6 days: 50% to wallet, 50% non-refundable
      const walletAmount = totalPaid * 0.5;
      return {
        daysUntil,
        refundType: 'wallet_partial',
        refundAmount: 0,
        walletAmount,
        policyText: `You will receive 50% ($${walletAmount.toFixed(2)}) as wallet credit. The remaining 50% is non-refundable.`
      };
    }
  };

  // Handle booking cancellation
  const handleCancelBooking = async (booking: BookingData) => {
    const outcome = getCancellationPolicyOutcome(booking);
    
    if (outcome.refundAmount === 0 && outcome.walletAmount === 0) {
      alert('Cannot cancel this booking: No payment to process or event date not found.');
      return;
    }

    setBookingToCancel(booking);
    setShowCancelConfirmation(true);
  };

  // Process the actual cancellation
  const processCancellation = async () => {
    if (!bookingToCancel || !user) {
      return;
    }

    setCancellingBooking(true);
    
    try {
      const outcome = getCancellationPolicyOutcome(bookingToCancel);
      
      // Update booking status to cancelled
      const cancelled = await updateBookingStatus(bookingToCancel.orderID, 'cancelled');
      if (!cancelled) {
        throw new Error('Failed to update booking status');
      }

      // Process refund if needed
      if (outcome.refundAmount > 0 && bookingToCancel.paymentDetails?.paypalTransactionId) {
        try {
          // Call cloud function for PayPal refund
          const { httpsCallable } = await import('firebase/functions');
          const { getFunctions } = await import('firebase/functions');
          
          const functions = getFunctions();
          const processRefund = httpsCallable(functions, 'processPayPalBookingRefund');
          
          await processRefund({
            captureId: bookingToCancel.paymentDetails.paypalTransactionId,
            amount: outcome.refundAmount,
            reason: 'Booking cancellation'
          });
          
        } catch (refundError) {
          console.error('❌ PayPal refund failed:', refundError);
          // Continue with cancellation even if refund fails - user can contact support
          alert('Booking cancelled, but refund processing failed. Please contact support for manual refund processing.');
        }
      }

      // Add wallet credit if needed
      if (outcome.walletAmount > 0) {
        await addWalletTransaction(user.uid, {
          amount: outcome.walletAmount,
          type: 'deposit',
          description: `Booking cancellation refund - Order ${bookingToCancel.orderID}`,
          orderID: bookingToCancel.orderID
        });
      }

      // Show success message
      alert(`Booking cancelled successfully! ${outcome.policyText}`);
      
      // Refresh bookings
      await loadUserBookings(user.uid);
      
      // Close modal
      setShowCancelConfirmation(false);
      setBookingToCancel(null);

    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert('Error cancelling booking. Please try again or contact support.');
    } finally {
      setCancellingBooking(false);
    }
  };
  
  // Cart and calendar data for navbar
  const [cart, setCart] = useState<CartItem[]>([]);
  const [calendarDateRange, setCalendarDateRange] = useState<[Date | null, Date | null]>([null, null]);

  // Load all bookings for the current user
  const loadUserBookings = async (userId: string) => {
    setLoadingBookings(true);
    try {
      const database = getDatabase();
      
      // Load new structure bookings
      const bookingsRef = ref(database, 'bookings');
      const bookingsSnapshot = await get(bookingsRef);
      const newBookings: BookingData[] = [];
      
      if (bookingsSnapshot.exists()) {
        const allBookings = bookingsSnapshot.val();
        Object.entries(allBookings).forEach(([orderID, booking]: [string, any]) => {
          if (booking.customerID === userId) {
            newBookings.push(booking as BookingData);
          }
        });
      }
      
      // Load legacy structure bookings (contracts table)
      const contractsRef = ref(database, 'contracts');
      const contractsSnapshot = await get(contractsRef);
      const legacyBookings: any[] = [];
      
      if (contractsSnapshot.exists()) {
        const allContracts = contractsSnapshot.val();
        Object.entries(allContracts).forEach(([contractId, contract]: [string, any]) => {
          if (contract.userId === userId) {
            legacyBookings.push({ ...contract, contractId });
          }
        });
      }
      
      // Sort bookings by date (newest first)
      newBookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      legacyBookings.sort((a, b) => {
        const dateA = new Date(a.contractDate || a.createdAt || 0);
        const dateB = new Date(b.contractDate || b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      setBookings(newBookings);
      setLegacyBookings(legacyBookings);
      
      
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoadingBookings(false);
    }
  };

  // Load contract for viewing
  const loadContract = async (booking: BookingData | any) => {
    setLoadingContract(true);
    try {
      let contract = null;
      
      if (booking.orderID) {
        // New structure: load contract by orderID
        contract = await loadContractByOrderID(booking.orderID);
      } else if (booking.contractId) {
        // Legacy structure: booking already contains contract data
        contract = {
          contractID: booking.contractId,
          orderID: booking.contractId, // Use contractId as fallback
          customerID: booking.userId,
          agreementSections: booking.agreementSections || [],
          signature: booking.signature,
          contractDate: booking.contractDate,
          initials: booking.initials,
          contractStatus: 'signed'
        };
      }
      
      if (contract) {
        setSelectedContract(contract);
        setShowContract(true);
      } else {
        alert('Contract not found for this booking.');
      }
    } catch (error) {
      console.error('Error loading contract:', error);
      alert('Error loading contract. Please try again.');
    } finally {
      setLoadingContract(false);
    }
  };
  
  // Track if address is from Google Places
  // Track Google Places selections for validation on save
  const [googlePlacesAddresses, setGooglePlacesAddresses] = useState<Set<string>>(new Set());
  const addressInputRef = useRef<HTMLInputElement>(null);
  const [isSelectingGooglePlace, setIsSelectingGooglePlace] = useState<boolean>(false);

  // Past Events state
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [legacyBookings, setLegacyBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingData | any | null>(null);
  const [showBookingDetails, setShowBookingDetails] = useState(false);
  
  // Contract viewing state
  const [selectedContract, setSelectedContract] = useState<ContractData | any | null>(null);
  const [showContract, setShowContract] = useState(false);
  const [loadingContract, setLoadingContract] = useState(false);
  
  // Booking card collapse/expand state
  const [expandedBookings, setExpandedBookings] = useState<Set<string>>(new Set());
  
  // Booking filter and sort state
  const [sortBy, setSortBy] = useState<'date' | 'price' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterStatus, setFilterStatus] = useState<'all' | 'deferred' | 'pending' | 'confirmed' | 'completed' | 'cancelled'>('all');

  // Booking cancellation state
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<BookingData | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState(false);

  // Toggle booking card expanded state
  const toggleBookingExpansion = (bookingId: string) => {
    setExpandedBookings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bookingId)) {
        newSet.delete(bookingId);
      } else {
        newSet.add(bookingId);
      }
      return newSet;
    });
  };

  // Filter and sort bookings
  const filterAndSortBookings = (bookingArray: BookingData[] | any[], isLegacy: boolean = false) => {
    let filtered = [...bookingArray];
    
    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(booking => booking.status === filterStatus);
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let compareValue = 0;
      
      switch (sortBy) {
        case 'date':
          const dateA = new Date(isLegacy ? (a.contractDate || a.createdAt || 0) : a.createdAt);
          const dateB = new Date(isLegacy ? (b.contractDate || b.createdAt || 0) : b.createdAt);
          compareValue = dateA.getTime() - dateB.getTime();
          break;
        case 'price':
          const priceA = isLegacy ? (a.orderDetails?.totalAmount || 0) : (a.orderDetails?.totalAmount || 0);
          const priceB = isLegacy ? (b.orderDetails?.totalAmount || 0) : (b.orderDetails?.totalAmount || 0);
          compareValue = priceA - priceB;
          break;
        case 'status':
          const statusA = a.status || 'unknown';
          const statusB = b.status || 'unknown';
          compareValue = statusA.localeCompare(statusB);
          break;
      }
      
      return sortOrder === 'asc' ? compareValue : -compareValue;
    });
    
    return filtered;
  };

  // 🔐 Re-authenticate user
  const handleConfirmPassword = async () => {
    if (!user || !profile.email) return;
    setAuthError(null);
    try {
      const { EmailAuthProvider, reauthenticateWithCredential } = await import("firebase/auth");
      const credential = EmailAuthProvider.credential(profile.email, confirmPassword);
      await reauthenticateWithCredential(user, credential);

      if (showPasswordModal === "email") setCanEditEmail(true);
      if (showPasswordModal === "password") setCanEditPassword(true);

      setShowPasswordModal(null);
      setConfirmPassword("");
    } catch (err: any) {
      if (err.code === "auth/wrong-password") {
        setAuthError("Incorrect password. Please try again.");
      } else {
        setAuthError("Authentication failed. Please try again.");
      }
    }
  };

  // 🔄 Load user + Firestore profile
  useEffect(() => {
     // On mount, restore pendingEmail from localStorage if present
  const storedPendingEmail = localStorage.getItem("pendingEmail");
  if (storedPendingEmail) {
    setPendingEmail(storedPendingEmail);
    setShowVerifyNewEmail(true);
  }
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setGuest(true);
        setLoading(false);
        return;
      }

    await u.reload(); // Refresh user info from Firebase

      setUser(u);

      // If pendingEmail and user.emailVerified, unlink Google
    if (pendingEmail && u.email === pendingEmail && u.emailVerified) {
      try {
        await unlink(u, "google.com");
        setPendingEmail(null);
        localStorage.removeItem("pendingEmail");
        setShowVerifyNewEmail(false);
        setEmailChangeMsg("Email verified and Google account unlinked.");
      } catch (err: any) {
        setEmailChangeMsg("Email verified, but failed to unlink Google: " + err.message);
      }
    }

      const db = firestore;
      const docRef = doc(db, "users", u.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Convert phone to E.164 format if it exists and doesn't start with +
        let phone = data.phone || "";
        if (phone && !phone.startsWith("+")) {
          // Assume US number if no country code
          phone = phone.startsWith("1") ? `+${phone}` : `+1${phone}`;
        }
        
        // Handle migration from single name to firstName/lastName
        let firstName = data.firstName || "";
        let lastName = data.lastName || "";
        let name = data.name || "";
        
        // If we have old data (name but no firstName/lastName), split the name
        if (name && !firstName && !lastName) {
          const nameParts = name.trim().split(' ');
          firstName = nameParts[0] || "";
          lastName = nameParts.slice(1).join(' ') || "";
        }
        // If we have firstName/lastName but no name, combine them
        else if ((firstName || lastName) && !name) {
          name = `${firstName} ${lastName}`.trim();
        }
        
        setProfile((prev) => ({
          ...prev,
          ...data,
          firstName,
          lastName,
          name,
          phone,
        }));
        
        // If we have a valid address, add it to known Google addresses
        if (data.address && typeof data.address === 'string') {
          const hasCommas = data.address.includes(',');
          const hasCountry = data.address.toUpperCase().includes('USA') || 
                            data.address.toUpperCase().includes('UNITED STATES');
          const hasStateZip = /,\s*[A-Z]{2}[\s,]/.test(data.address);
          
          if (hasCommas && (hasCountry || hasStateZip)) {
            setGooglePlacesAddresses(prev => new Set(prev).add(data.address));
          }
        }
      } else {
        // Convert phone to E.164 format if it exists and doesn't start with +
        let phone = u.phoneNumber || "";
        if (phone && !phone.startsWith("+")) {
          phone = phone.startsWith("1") ? `+${phone}` : `+1${phone}`;
        }
        
        setProfile({
          ...profile,
          name: u.displayName || "",
          firstName: u.displayName ? u.displayName.split(' ')[0] || "" : "",
          lastName: u.displayName ? u.displayName.split(' ').slice(1).join(' ') || "" : "",
          email: u.email || "",
          phone,
          company: "",
          address: "",
        });
      }

      // 🔄 Always sync email from Firebase Auth to Firestore
      if (u.email && profile.email !== u.email) {
        await updateDoc(docRef, { email: u.email });
        setProfile((prev) => ({ ...prev, email: u.email || "" }));
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [pendingEmail]);

  // Sync input field with profile address when profile loads
  useEffect(() => {
    if (addressInputRef.current && profile.address && !isSelectingGooglePlace) {
      addressInputRef.current.value = profile.address;
    }
  }, [profile.address, isSelectingGooglePlace]);

  // Load cart and calendar data for navbar
  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (error) {
        console.error('Error loading cart from localStorage:', error);
      }
    }

    const savedDates = localStorage.getItem('calendarDateRange');
    if (savedDates) {
      try {
        const parsed = JSON.parse(savedDates);
        setCalendarDateRange([
          parsed[0] ? new Date(parsed[0]) : null,
          parsed[1] ? new Date(parsed[1]) : null,
        ]);
      } catch (error) {
        console.error('Error loading calendar dates from localStorage:', error);
      }
    }
  }, []);

  // Load user bookings when user changes or Bookings tab is accessed
  useEffect(() => {
    if (user && activeTab === getTabIndex('bookings')) {
      loadUserBookings(user.uid);
    }
  }, [user, activeTab]);

  // Load user membership when user changes or Membership tab is accessed (optimize to load only once per session)
  useEffect(() => {
    if (user && activeTab === getTabIndex('membership') && !membershipDataLoaded) {
      loadMembershipData();
    }
  }, [user, activeTab, membershipDataLoaded]);

  // Initialize delivery address from profile
  useEffect(() => {
    if (profile.address) {
      setDeliveryAddress(profile.address);
    }
  }, [profile.address]);

  // Save membership booking state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('membershipBooking_weekday', selectedWeekday);
    }
  }, [selectedWeekday]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('membershipBooking_inflatable', JSON.stringify(selectedInflatable));
    }
  }, [selectedInflatable]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('membershipBooking_surface', selectedSurface);
    }
  }, [selectedSurface]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('membershipBooking_stakesOrSandbags', selectedStakesOrSandbags);
    }
  }, [selectedStakesOrSandbags]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('membershipBooking_address', deliveryAddress);
    }
  }, [deliveryAddress]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('profile_activeTab', activeTab.toString());
    }
  }, [activeTab]);



  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'firstName' || name === 'lastName') {
      // Update firstName/lastName and automatically update combined name
      const updatedProfile = { ...profile, [name]: value };
      if (name === 'firstName') {
        updatedProfile.name = `${value} ${profile.lastName}`.trim();
      } else {
        updatedProfile.name = `${profile.firstName} ${value}`.trim();
      }
      setProfile(updatedProfile);
    } else {
      setProfile({ ...profile, [name]: value });
    }
  };

  // PhoneInput change handler
  const handlePhoneChange = (value: string | undefined) => {
    setProfile({ ...profile, phone: value ?? "" });
    setPhoneError(null);
  };

  // Handle Google Places address selection
  const handlePlaceSelected = (place: google.maps.places.PlaceResult) => {
    // Only accept valid places with formatted address and location
    if (place.formatted_address && place.geometry?.location && place.place_id) {
      const googleAddress = place.formatted_address;
      
      
      // Set flag to prevent manual input from overriding this selection
      setIsSelectingGooglePlace(true);
      
      // Add this address to our set of valid Google Places addresses
      setGooglePlacesAddresses(prev => new Set(prev).add(googleAddress));
      
      // Update profile with the Google address immediately
      setProfile(prev => ({
        ...prev,
        address: googleAddress,
      }));
      
      // Also update the input field directly to ensure it shows the Google address
      if (addressInputRef.current) {
        addressInputRef.current.value = googleAddress;
      }
      
      
      // Clear the flag after a short delay
      setTimeout(() => {
        setIsSelectingGooglePlace(false);
      }, 100);
    }
  };

  // Handle manual address input change
  const handleAddressChange = (value: string) => {
    
    // Don't override if we're currently selecting a Google Place
    if (isSelectingGooglePlace) {
      return;
    }
    
    setProfile(prev => ({ ...prev, address: value }));
    // No validation here - we'll only validate on save
  };

  const handleSave = async () => {
    if (!user) return;

    // Get the actual value from the input field (this will be the Google Places formatted address)
    const actualAddressValue = addressInputRef.current?.value || '';

    // Validate address - must be from Google Places if provided
    if (actualAddressValue && actualAddressValue.trim()) {
      const isGooglePlacesAddress = googlePlacesAddresses.has(actualAddressValue);
      
      // Check if address has Google Places formatting characteristics
      const hasCommas = actualAddressValue.includes(',');
      const hasCountry = actualAddressValue.toUpperCase().includes('USA') || 
                        actualAddressValue.toUpperCase().includes('UNITED STATES');
      const hasStateZip = /,\s*[A-Z]{2}[\s,]/.test(actualAddressValue); // Pattern like ", SC " or ", SC,"
      
      const looksLikeGooglePlaces = hasCommas && (hasCountry || hasStateZip);
      
      if (!isGooglePlacesAddress && !looksLikeGooglePlaces) {
        alert("Please select a valid address from the Google Places suggestions instead of typing manually.");
        setEditing(true);
        return;
      }
      
      // Update the profile state with the actual input field value
      setProfile(prev => ({ ...prev, address: actualAddressValue }));
      
      // If it looks like Google Places but wasn't in our set, add it
      if (looksLikeGooglePlaces && !isGooglePlacesAddress) {
        setGooglePlacesAddresses(prev => new Set(prev).add(actualAddressValue));
      }
    }

    setEditing(false);

    // Ensure phone number is in E.164 format
    let formattedPhone = profile.phone;
    if (formattedPhone && !formattedPhone.startsWith("+")) {
      // Assume US number if no country code
      formattedPhone = formattedPhone.startsWith("1") ? `+${formattedPhone}` : `+1${formattedPhone}`;
    }

    // Validate phone number (must be E.164 format and at least 10 digits)
    if (!formattedPhone || !/^\+?[1-9]\d{9,14}$/.test(formattedPhone)) {
      setPhoneError("Please enter a valid phone number.");
      setEditing(true);
      return;
    }

    const db = firestore;
    const docRef = doc(db, "users", user.uid);
    
    // Use the actual address value from the input field for saving
    const addressToSave = actualAddressValue || profile.address;

    await updateDoc(docRef, {
      phone: formattedPhone,
      company: profile.company,
      address: addressToSave,
      firstName: profile.firstName,
      lastName: profile.lastName,
      name: profile.name, // Combined name for backward compatibility
    });

    // Update local state with formatted phone and correct address
    setProfile(prev => ({ 
      ...prev, 
      phone: formattedPhone,
      address: addressToSave 
    }));
  };

  // Payment Information tab functions
  const loadPaymentTabData = async () => {
    if (!user || activeTab !== 3) return;
    
    setLoadingWallet(true);
    setLoadingPaymentInfo(true);
    
    try {
      const [walletData, paymentData] = await Promise.all([
        getUserWallet(user.uid),
        getUserPaymentInfo(user.uid)
      ]);
      
      setUserWallet(walletData);
      setUserPaymentInfo(paymentData);
    } catch (error) {
      console.error('Error loading payment tab data:', error);
    } finally {
      setLoadingWallet(false);
      setLoadingPaymentInfo(false);
    }
  };

  // Load subscription data - Updated to use only subscription subcollection
  const loadMembershipData = async () => {
    if (!user) return;
    
    setLoadingSubscription(true);
    
    try {
      console.log('📊 PROFILE: Loading subscription data for user:', user.uid);
      
      // Load subscription data from Firestore activeSubscriptions collection (fast query)
      const { collection, query, where, getDocs, limit, orderBy } = await import('firebase/firestore');
      const activeSubscriptionsRef = collection(firestore, 'users', user.uid, 'activeSubscriptions');
      
      // Get active subscriptions (should be fast since we only store active ones here)
      console.log('📊 PROFILE: Fetching active subscriptions from activeSubscriptions collection...');
      const activeSubscriptionsQuery = query(activeSubscriptionsRef, orderBy('createdAt', 'desc'), limit(10));
      const activeSubscriptionsSnapshot = await getDocs(activeSubscriptionsQuery);
      
      console.log('📊 PROFILE: Found', activeSubscriptionsSnapshot.size, 'active subscriptions');
      
      let activeSubscriptionData: any = null;
      let anySubscriptionData: any = null;
      
      // Log all active subscriptions for debugging
      activeSubscriptionsSnapshot.forEach((doc: any) => {
        const data = doc.data();
        console.log(`� PROFILE: Subscription details:`, {
          docId: doc.id,
          subscriptionId: data.subscriptionId,
          status: data.status,
          createdAt: data.createdAt,
          isActive: data.status === 'Active' || data.status === 'ACTIVE'
        });
        
        // Store the first active subscription we find
        if (!activeSubscriptionData && (data.status === 'Active' || data.status === 'ACTIVE')) {
          console.log('✅ PROFILE: Found active subscription:', doc.id);
          activeSubscriptionData = data;
        }
        
        // Store any subscription as fallback
        if (!anySubscriptionData) {
          anySubscriptionData = data;
        }
      });
      
      // Use active subscription if found, otherwise use any subscription
      const subscriptionData = activeSubscriptionData || anySubscriptionData;
      
      if (subscriptionData) {
        console.log('📊 PROFILE: Using subscription data:', subscriptionData);
        console.log('📊 PROFILE: This subscription is active?', 
          subscriptionData.status === 'Active' || subscriptionData.status === 'ACTIVE');

        // Create userMembership object from subscription data for compatibility
        const membershipData = {
          jumpClub: subscriptionData.status === 'Active' || subscriptionData.status === 'ACTIVE',
          dateStarted: subscriptionData.createdAt ? 
            (subscriptionData.createdAt.seconds ? 
              new Date(subscriptionData.createdAt.seconds * 1000).toISOString() : 
              subscriptionData.createdAt) : 
            undefined,
          cancelled: subscriptionData.status === 'Cancelled' || subscriptionData.status === 'CANCELLED',
          createdAt: subscriptionData.createdAt,
          updatedAt: subscriptionData.lastUpdated || subscriptionData.updatedAt
        };
        
        setUserMembership(membershipData);
        
        // If subscription is active, get next billing date from PayPal
        if ((subscriptionData.status === 'ACTIVE' || subscriptionData.status === 'Active') && subscriptionData.subscriptionId) {
          try {
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const functions = getFunctions(undefined, 'us-central1');
            const getSubscriptionDetails = httpsCallable(functions, 'getPayPalSubscriptionDetails');
            
            const result = await getSubscriptionDetails({ subscriptionId: subscriptionData.subscriptionId });
            if (result.data && (result.data as any).success) {
              subscriptionData.paypalDetails = (result.data as any).subscription;
            }
          } catch (error) {
            console.error('Error loading PayPal subscription details:', error);
          }
        }
        
        setUserSubscription(subscriptionData);
        
        // Debug logging for cancel button troubleshooting
        console.log('🔍 PROFILE DEBUG: userSubscription set to:', subscriptionData);
        console.log('🔍 PROFILE DEBUG: subscriptionData.status:', subscriptionData.status);
        console.log('🔍 PROFILE DEBUG: subscriptionData.subscriptionId:', subscriptionData.subscriptionId);
        console.log('🔍 PROFILE DEBUG: Cancel button should show?', 
          (subscriptionData.status === 'ACTIVE' || subscriptionData.status === 'Active'));
      } else {
        console.log('📊 PROFILE: No subscription documents found');
        setUserMembership(null);
        setUserSubscription(null);
      }
    } catch (error) {
      console.error('Error loading membership data:', error);
    } finally {
      setLoadingSubscription(false);
      setMembershipDataLoaded(true); // Mark as loaded for this session
    }
  };

  // Cancel subscription function
  const handleCancelSubscription = async () => {
    console.log('🚨 CANCEL DEBUG: handleCancelSubscription called');
    console.log('🔍 CANCEL DEBUG: user exists?', !!user);
    console.log('🔍 CANCEL DEBUG: user.uid:', user?.uid);
    console.log('🔍 CANCEL DEBUG: userSubscription:', userSubscription);
    console.log('🔍 CANCEL DEBUG: userSubscription.subscriptionId:', userSubscription?.subscriptionId);
    console.log('🔍 CANCEL DEBUG: userSubscription.status:', userSubscription?.status);
    
    if (!user || !userSubscription?.subscriptionId) {
      console.error('❌ CANCEL DEBUG: Missing requirements');
      console.error('❌ CANCEL DEBUG: user exists:', !!user);
      console.error('❌ CANCEL DEBUG: user.uid:', user?.uid);
      console.error('❌ CANCEL DEBUG: subscriptionId exists:', !!userSubscription?.subscriptionId);
      console.error('❌ CANCEL DEBUG: subscriptionId value:', userSubscription?.subscriptionId);
      alert('Error: Missing user authentication or subscription ID. Please refresh the page and try again.');
      return;
    }
    
    const confirmCancel = confirm(
      'Are you sure you want to cancel your membership?\n\n' +
      'Your membership will remain active until the next billing date, then it will be cancelled.\n' +
      'You can reactivate before the billing date if you change your mind.'
    );
    
    if (!confirmCancel) return;
    
    try {
      setLoadingSubscription(true);
      
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions(undefined, 'us-central1');
      const cancelSubscription = httpsCallable(functions, 'cancelPayPalSubscription');
      
      const result = await cancelSubscription({ 
        subscriptionId: userSubscription.subscriptionId,
        reason: 'User requested cancellation'
      });
      
      if (result.data && (result.data as any).success) {
        alert('Your membership cancellation has been scheduled. You will remain a member until your next billing date.');
        await loadMembershipData(); // Reload data
      } else {
        throw new Error((result.data as any)?.error || 'Failed to cancel subscription');
      }
      
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      alert('Failed to cancel subscription. Please try again or contact support.');
    } finally {
      setLoadingSubscription(false);
    }
  };

  // Reactivate subscription function
  const handleReactivateSubscription = async () => {
    if (!user || !userSubscription?.subscriptionId) return;
    
    const confirmReactivate = confirm(
      'Reactivate your membership subscription?\n\n' +
      'Your membership will continue with the next billing cycle as scheduled.'
    );
    
    if (!confirmReactivate) return;
    
    try {
      setLoadingSubscription(true);
      
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions(undefined, 'us-central1');
      const reactivateSubscription = httpsCallable(functions, 'reactivatePayPalSubscription');
      
      const result = await reactivateSubscription({ 
        subscriptionId: userSubscription.subscriptionId
      });
      
      if (result.data && (result.data as any).success) {
        const responseData = result.data as any;
        
        // Check if the reactivation requires approval (new subscription created)
        if (responseData.requiresApproval && responseData.approvalUrl) {
          const shouldProceed = confirm(
            'Your previous subscription was cancelled and cannot be directly reactivated. ' +
            'We need to create a new subscription. You will be redirected to PayPal to approve it. ' +
            'Continue?'
          );
          
          if (shouldProceed) {
            // Redirect to PayPal for approval
            window.location.href = responseData.approvalUrl;
          } else {
            alert('Reactivation cancelled. Your membership status remains unchanged.');
          }
        } else {
          // Direct reactivation successful
          alert('Your membership has been reactivated and will continue as scheduled.');
          await loadMembershipData(); // Reload data
        }
      } else {
        throw new Error((result.data as any)?.error || 'Failed to reactivate subscription');
      }
      
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      alert('Failed to reactivate subscription. Please try again or contact support.');
    } finally {
      setLoadingSubscription(false);
    }
  };

  // Gift Card Balance Checker Function
  const handleGiftCardLookup = async () => {
    if (!giftCardCode.trim()) {
      console.warn('[GiftCardBalanceCheck] No code entered');
      setGiftCardError("Please enter a gift card code");
      return;
    }

    setLoadingGiftCardLookup(true);
    setGiftCardError(null);
    setGiftCardLookupResult(null);

    try {
      const trimmedCode = giftCardCode.trim();
      const result = await getGiftCardDetails(trimmedCode);
      if (result.success && result.giftCard) {
        setGiftCardLookupResult(result.giftCard);
      } else {
        console.warn('[GiftCardBalanceCheck] Lookup failed:', result.message);
        setGiftCardError(result.message || "Gift card not found or invalid");
      }
    } catch (error) {
      console.error('[GiftCardBalanceCheck] Error looking up gift card:', error);
      setGiftCardError("Error looking up gift card. Please try again.");
    } finally {
      setLoadingGiftCardLookup(false);
    }
  };

  // Handle redeeming gift card to wallet from balance checker
  const handleRedeemFromChecker = async (amount?: number) => {
    if (!user || !giftCardLookupResult || !profile) return;

    try {
      const success = await redeemGiftCardToWallet(
        giftCardCode.trim(),
        user.uid,
        user.email || '',
        profile.name || user.displayName || 'Customer'
      );

      if (success.success) {
        alert(`Successfully redeemed $${success.amount?.toFixed(2) || '0.00'} to your wallet!`);
        
        // Refresh data
        await loadPaymentTabData();
        await handleGiftCardLookup(); // Refresh gift card data
      } else {
        alert(`Failed to redeem gift card: ${success.message}`);
      }
    } catch (error) {
      console.error('Error redeeming gift card:', error);
      alert("Error redeeming gift card. Please try again.");
    }
  };

  // Reset gift card checker
  const resetGiftCardChecker = () => {
    setGiftCardCode("");
    setGiftCardLookupResult(null);
    setGiftCardError(null);
    setLoadingGiftCardLookup(false);
  };

  const verifyPassword = async () => {
    if (!user || !verificationPassword) return;
    
    try {
      const { signInWithEmailAndPassword } = await import("firebase/auth");
      await signInWithEmailAndPassword(auth, user.email!, verificationPassword);
      setPasswordVerified(true);
      setShowPasswordVerification(false);
      setVerificationPassword("");
      await loadPaymentTabData();
    } catch (error) {
      console.error('Password verification failed:', error);
      alert('Incorrect password. Please try again.');
    }
  };





  const setDefaultPaymentMethod = async (methodId: string) => {
    if (!user || !userPaymentInfo) return;
    
    try {
      const updatedMethods = userPaymentInfo.savedPaymentMethods.map(method => ({
        ...method,
        isDefault: method.id === methodId
      }));
      
      const updatedPaymentInfo = {
        ...userPaymentInfo,
        savedPaymentMethods: updatedMethods
      };
      
      const { saveUserPaymentInfo } = await import("./utils/databaseUtils");
      const success = await saveUserPaymentInfo(updatedPaymentInfo);
      
      if (success) {
        setUserPaymentInfo(updatedPaymentInfo);
      } else {
        alert('Failed to update default payment method');
      }
    } catch (error) {
      console.error('Error setting default payment method:', error);
      alert('An error occurred while updating payment method');
    }
  };

  const removePaymentMethod = async (methodId: string) => {
    if (!user || !userPaymentInfo) return;
    
    if (!confirm('Are you sure you want to remove this payment method?')) {
      return;
    }
    
    try {
      const updatedMethods = userPaymentInfo.savedPaymentMethods.filter(method => method.id !== methodId);
      
      // If we removed the default method, set the first remaining method as default
      if (updatedMethods.length > 0 && !updatedMethods.some(method => method.isDefault)) {
        updatedMethods[0].isDefault = true;
      }
      
      const updatedPaymentInfo = {
        ...userPaymentInfo,
        savedPaymentMethods: updatedMethods
      };
      
      const { saveUserPaymentInfo } = await import("./utils/databaseUtils");
      const success = await saveUserPaymentInfo(updatedPaymentInfo);
      
      if (success) {
        setUserPaymentInfo(updatedPaymentInfo);
      } else {
        alert('Failed to remove payment method');
      }
    } catch (error) {
      console.error('Error removing payment method:', error);
      alert('An error occurred while removing payment method');
    }
  };

  // Store payment method functions
  const createPaymentMethodOrder = async (data: any, actions: any) => {
    return actions.order.create({
      intent: "CAPTURE",
      purchase_units: [{
        amount: {
          currency_code: "USD",
          value: "0.50" // Small verification amount
        },
        description: "Payment method verification"
      }],
      payment_source: {
        paypal: {
          experience_context: {
            return_url: `${window.location.origin}/profile`,
            cancel_url: `${window.location.origin}/profile`
          },
          attributes: {
            vault: {
              store_in_vault: "ON_SUCCESS",
              usage_pattern: "IMMEDIATE",
              usage_type: "MERCHANT"
            }
          }
        }
      }
    });
  };

  const onPaymentMethodApprove = async (data: any, actions: any) => {
    if (!user) return;
    
    setStoringPaymentMethod(true);
    try {
      const details = await actions.order.capture();
      
      // Refund the verification amount immediately
      try {
        // Note: In production, you'd call your backend to process the refund
      } catch (refundError) {
        console.error('Error processing refund:', refundError);
        // Continue with saving payment method even if refund fails
      }
      
      // Extract vault information from the response
      let vaultId = null;
      let paymentMethodInfo: Omit<SavedPaymentMethod, 'id' | 'createdAt'> | null = null;
      
      // Check multiple places where vault info might be stored
      if (details.payment_source?.paypal?.attributes?.vault?.id) {
        vaultId = details.payment_source.paypal.attributes.vault.id;
        paymentMethodInfo = {
          type: 'paypal' as const,
          paypalVaultId: vaultId,
          isDefault: !userPaymentInfo?.savedPaymentMethods?.length
        };
      } else if (details.payment_source?.card?.attributes?.vault?.id) {
        const cardData = details.payment_source.card;
        vaultId = cardData.attributes.vault.id;
        paymentMethodInfo = {
          type: 'card' as const,
          paypalVaultId: vaultId,
          lastFour: cardData.last_digits,
          cardType: cardData.brand,
          expiryMonth: cardData.expiry?.split('/')[0],
          expiryYear: cardData.expiry?.split('/')[1],
          isDefault: !userPaymentInfo?.savedPaymentMethods?.length
        };
      } else if (details.payment_source?.paypal?.vault_id) {
        // Alternative location for vault ID
        vaultId = details.payment_source.paypal.vault_id;
        paymentMethodInfo = {
          type: 'paypal' as const,
          paypalVaultId: vaultId,
          isDefault: !userPaymentInfo?.savedPaymentMethods?.length
        };
      } else if (details.payment_source?.card?.vault_id) {
        const cardData = details.payment_source.card;
        vaultId = cardData.vault_id;
        paymentMethodInfo = {
          type: 'card' as const,
          paypalVaultId: vaultId,
          lastFour: cardData.last_digits,
          cardType: cardData.brand,
          expiryMonth: cardData.expiry?.split('/')[0],
          expiryYear: cardData.expiry?.split('/')[1],
          isDefault: !userPaymentInfo?.savedPaymentMethods?.length
        };
      }
      
      
      if (vaultId && paymentMethodInfo) {
        const success = await addSavedPaymentMethod(user.uid, paymentMethodInfo);
        
        if (success) {
          alert('Payment method stored successfully!');
          await loadPaymentTabData(); // Refresh payment data
          setShowPaymentMethodModal(false);
        } else {
          alert('Failed to store payment method in database');
        }
      } else {
        console.error('No vault ID found in PayPal response');
        alert('Payment method could not be stored - no vault information received from PayPal');
      }
      
    } catch (error) {
      console.error('Error storing payment method:', error);
      alert('Error storing payment method. Please try again.');
    } finally {
      setStoringPaymentMethod(false);
    }
  };

  const onPaymentMethodError = (err: any) => {
    console.error("PayPal payment method error:", err);
    alert('Error setting up payment method. Please try again.');
    setStoringPaymentMethod(false);
  };

  // Enhanced delete account function
  const handleDeleteAccount = async () => {
    if (!user) return;
    
    try {
      // First, check wallet balance
      const walletData = await getUserWallet(user.uid);
      const walletBalance = walletData?.balance || 0;
      
      let confirmMessage = "Are you sure you want to delete your account? This action cannot be undone and will permanently delete:\n\n" +
                          "• Your profile information\n" +
                          "• Your booking history\n" +
                          "• Your saved payment methods\n" +
                          "• Your gift cards";
      
      if (walletBalance > 0) {
        confirmMessage += `\n• Your wallet balance of $${walletBalance.toFixed(2)} (THIS MONEY WILL BE LOST!)`;
      }
      
      confirmMessage += "\n\nType 'DELETE' to confirm account deletion:";
      
      const userInput = prompt(confirmMessage);
      
      if (userInput !== 'DELETE') {
        if (userInput !== null) { // User didn't cancel
          alert('Account deletion cancelled. You must type "DELETE" exactly to confirm.');
        }
        return;
      }
      
      // Show final warning if wallet has balance
      if (walletBalance > 0) {
        const finalConfirm = confirm(
          `⚠️ FINAL WARNING ⚠️\n\n` +
          `You have $${walletBalance.toFixed(2)} in your wallet that will be permanently lost!\n\n` +
          `Are you absolutely sure you want to proceed with account deletion?`
        );
        
        if (!finalConfirm) {
          return;
        }
      }
      
      // Delete all user data from database
      const deletionResult = await deleteAllUserData(user.uid);
      
      if (!deletionResult.success) {
        throw new Error(deletionResult.error || 'Failed to delete user data');
      }
      
      // Send account deletion email notification since we're on Blaze plan
      try {
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const functions = getFunctions();
        const sendAccountDeletionEmail = httpsCallable(functions, 'sendAccountDeletionEmail');
        
        await sendAccountDeletionEmail({
          userEmail: user.email,
          userName: profile.name || user.displayName || 'Customer',
          deletedWalletBalance: deletionResult.deletedWalletBalance || 0,
          deletionDate: new Date().toISOString()
        });
        
      } catch (emailError) {
        console.error('Failed to send deletion email:', emailError);
        // Continue with deletion even if email fails
      }
      
      // Delete Firestore user document
      const docRef = doc(firestore, "users", user.uid);
      await updateDoc(docRef, { 
        deleted: true,
        deletedAt: new Date().toISOString(),
        deletedWalletBalance: deletionResult.deletedWalletBalance || 0
      });
      await (await import("firebase/firestore")).deleteDoc(docRef);

      // Delete Firebase Auth user
      await user.delete();

      // Clear all localStorage data
      localStorage.clear();

      // Show success message
      alert(
        'Your account has been successfully deleted.\n\n' +
        `${deletionResult.deletedWalletBalance && deletionResult.deletedWalletBalance > 0 
          ? `Your wallet balance of $${deletionResult.deletedWalletBalance.toFixed(2)} has been forfeited.\n` 
          : ''
        }` +
        'You will receive an email confirmation shortly.\n\n' +
        'Thank you for using JumpCSRA Party Rentals.'
      );

      // Sign out and redirect
      clearAllLocalStorage(); // Clear all localStorage data before signing out
      await auth.signOut();
      navigate("/");
      
    } catch (err: any) {
      console.error('Account deletion error:', err);
      
      let errorMessage = "Failed to delete account: ";
      
      if (err.code === 'auth/requires-recent-login') {
        errorMessage += "Please sign out and sign back in, then try again.";
      } else {
        errorMessage += (err.message || err);
      }
      
      alert(errorMessage);
    }
  };

  // Load payment data when tab changes
  React.useEffect(() => {
    if (activeTab === getTabIndex('payment') && user && !passwordVerified) {
      setShowPasswordVerification(true);
    } else if (activeTab === getTabIndex('payment') && passwordVerified) {
      loadPaymentTabData();
    }
  }, [activeTab, user, passwordVerified]);

  if (loading) return <div className="profile-loading">Loading...</div>;
  if (guest) {
    return (
      <div className="profile-guest">
        <h2>Sign in to view your profile</h2>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
          <button className="profile-signin-btn" onClick={() => navigate("/")}>
            Sign In
          </button>
          <button className="profile-signin-btn" onClick={() => navigate("/home")}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <RouterNav hideIcons={true} />
      <div className="profile-container">
        

        <div className="profile-left">
        <div className="profile-tabs">
          {TABS.map((tab, idx) => (
            <button
              key={tab}
              className={`profile-tab${activeTab === idx ? " active" : ""}`}
              onClick={() => setActiveTab(idx)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="profile-right">
        {/* Profile Information Tab */}
        {activeTab === getTabIndex('profile') ? (
          <div className="profile-info">
            {/* First Name */}
            <div className="profile-row">
              <label>First Name:</label>
              <input
                name="firstName"
                value={profile.firstName}
                onChange={handleChange}
                disabled={!editing}
                style={!editing ? { backgroundColor: "#f0f0f0", color: "#888" } : {}}
              />
            </div>

            {/* Last Name */}
            <div className="profile-row">
              <label>Last Name:</label>
              <input
                name="lastName"
                value={profile.lastName}
                onChange={handleChange}
                disabled={!editing}
                style={!editing ? { backgroundColor: "#f0f0f0", color: "#888" } : {}}
              />
            </div>

            {/* Email */}
            <div className="profile-row">
              <label>Email:</label>
              {showVerifyNewEmail && pendingEmail ? (
                <div className="verify-msg">
                  <p>
                    We’ve sent a verification link to <b>{pendingEmail}</b>.
                  </p>
                  <p>Please check your inbox and confirm your new email address.</p>

                  <button
                    className="resend-btn"
                    onClick={async () => {
                      if (user) {
                        const { verifyBeforeUpdateEmail } = await import("firebase/auth");
                        const verificationUrl = "http://localhost:5173/profile";
                        await verifyBeforeUpdateEmail(user, pendingEmail, {
                          url: "http://localhost:5173/profile",
                          handleCodeInApp: true,
                        });
                        setEmailChangeMsg("Verification email resent!");
                      }
                    }}
                  >
                    Resend Verification Email
                  </button>

                  <button
                    className="back-btn"
                    onClick={() => {
                      setShowVerifyNewEmail(false);
                      setPendingEmail(null);
                      localStorage.removeItem("pendingEmail");
                    }}
                  >
                    Cancel
                  </button>

                  {emailChangeMsg && (
                    <div style={{ marginTop: "0.5rem", color: "#1976d2" }}>
                      {emailChangeMsg}
                    </div>
                  )}
                </div>
              ) : canEditEmail ? (
                <>
                  <input
                    name="newEmail"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Enter new email"
                    style={{ width: "60%" }}
                  />
                 <button
  className="profile-save-btn"
  onClick={async () => {
    setEmailChangeMsg(null);
    try {
      if (!user) return;
      const { verifyBeforeUpdateEmail } = await import("firebase/auth");
      await verifyBeforeUpdateEmail(user, newEmail, {
        url: "http://localhost:5173/profile",
        handleCodeInApp: true,
      });

      setPendingEmail(newEmail);
      localStorage.setItem("pendingEmail", newEmail);
      setShowVerifyNewEmail(true);
      setCanEditEmail(false);
    } catch (err: any) {
      console.error("verifyBeforeUpdateEmail error:", err);
      if (err.code === "auth/email-already-in-use") {
        setEmailChangeMsg("That email is already in use.");
      } else if (err.code === "auth/requires-recent-login") {
        setEmailChangeMsg("Please re-login to confirm this action.");
      } else if (err.code === "auth/invalid-continue-uri") {
        setEmailChangeMsg("The verification link is not allowed. Check your Firebase authorized domains.");
      } else {
        setEmailChangeMsg(err.message || "Failed to update email");
      }
    }
  }}
>
  Save
</button>
                  <button
                    className="profile-edit-btn"
                    style={{ marginLeft: "1rem" }}
                    onClick={() => {
                      setCanEditEmail(false);
                      setNewEmail("");
                    }}
                  >
                    Cancel
                  </button>
                  {emailChangeMsg && (
                    <div style={{ color: "#c00", marginTop: "0.5rem" }}>{emailChangeMsg}</div>
                  )}
                </>
              ) : (
                <>
                  <input
                    name="email"
                    value={profile.email}
                    disabled
                    style={{ backgroundColor: "#f0f0f0", color: "#888" }}
                  />
                  <button
                    className="profile-edit-btn"
                    onClick={() => setShowPasswordModal("email")}
                  >
                    Change
                  </button>
                </>
              )}
            </div>

            {/* Phone */}
            <div className="profile-row">
              <label>Phone:</label>
              {editing ? (
                <>
                  <PhoneInput
                    defaultCountry="US"
                    value={profile.phone}
                    onChange={handlePhoneChange}
                    className="identifier-input"
                    disabled={!editing}
                    placeholder="Enter phone number"
                  />
                  {phoneError && (
                    <div style={{ color: "#c00", marginTop: "0.25rem" }}>{phoneError}</div>
                  )}
                </>
              ) : (
                <PhoneInput
                  defaultCountry="US"
                  value={profile.phone}
                  onChange={() => {}}
                  className="identifier-input"
                  disabled
                  placeholder="Enter phone number"
                />
              )}
            </div>

            {/* Password */}
            <div className="profile-row">
              <label>Password:</label>
              {canEditPassword ? (
                <>
                  <input
                    name="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    style={{ width: "60%" }}
                  />
                  <button
                    className="profile-save-btn"
                    onClick={async () => {
                      setPasswordChangeMsg(null);

                      if (
                        newPassword.length < 8 ||
                        !/[A-Z]/.test(newPassword) ||
                        !/[0-9]/.test(newPassword)
                      ) {
                        setPasswordChangeMsg(
                          "Password must be at least 8 characters, include a number and an uppercase letter."
                        );
                        return;
                      }

                      try {
                        if (!user) return;
                        const { updatePassword } = await import("firebase/auth");
                        await updatePassword(user, newPassword);
                        setPasswordChangeMsg("Password updated!");
                        setCanEditPassword(false);
                      } catch (err: any) {
                        setPasswordChangeMsg(err.message || "Failed to update password");
                      }
                    }}
                  >
                    Save
                  </button>
                  <button
                    className="profile-edit-btn"
                    style={{ marginLeft: "1rem" }}
                    onClick={() => {
                      setCanEditPassword(false);
                      setNewPassword("");
                    }}
                  >
                    Cancel
                  </button>
                  {passwordChangeMsg && (
                    <div
                      style={{
                        color: passwordChangeMsg.includes("updated") ? "#1976d2" : "#c00",
                        marginTop: "0.5rem",
                      }}
                    >
                      {passwordChangeMsg}
                    </div>
                  )}
                </>
              ) : (
                <button
                  className="profile-edit-btn"
                  onClick={() => setShowPasswordModal("password")}
                >
                  View/Change (Re-login)
                </button>
              )}
            </div>

            {/* Re-authentication modal */}
            {showPasswordModal && (
              <div
                className="modal-overlay fade-in"
                onClick={() => setShowPasswordModal(null)}
              >
                <div className="modal-shadow" />
                <div
                  className="modal-content popup"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2 className="modal-title">Confirm Your Password</h2>
                  <div style={{ marginBottom: "1rem" }}>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="identifier-input"
                      style={{ width: "100%", padding: "0.5rem", fontSize: "1rem" }}
                    />
                  </div>
                  {authError && (
                    <div style={{ color: "#c00", marginBottom: "1rem" }}>{authError}</div>
                  )}
                  <button className="profile-save-btn" onClick={handleConfirmPassword}>
                    Confirm
                  </button>
                  <button
                    className="profile-edit-btn"
                    style={{ marginLeft: "1rem" }}
                    onClick={() => setShowPasswordModal(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Company + Address */}
            <div className="profile-row">
              <label>Company/Org:</label>
              <input
                name="company"
                value={profile.company}
                onChange={handleChange}
                disabled={!editing}
                style={!editing ? { backgroundColor: "#f0f0f0", color: "#888" } : {}}
              />
            </div>
            <div className="profile-row">
              <label>Address:</label>
              <div style={{ position: 'relative' }}>
                <GooglePlacesAutocomplete
                  name="address"
                  value={profile.address}
                  onChange={handleAddressChange}
                  onPlaceSelected={handlePlaceSelected}
                  disabled={!editing}
                  style={!editing ? { backgroundColor: "#f0f0f0", color: "#888" } : {}}
                  placeholder="Select an address from Google Places suggestions"
                  inputRef={addressInputRef}
                />
              </div>
            </div>

            <div className="profile-actions">
              {editing ? (
                <button className="profile-save-btn" onClick={handleSave}>
                  Save
                </button>
              ) : (
                <button className="profile-edit-btn" onClick={() => setEditing(true)}>
                  Edit
                </button>
              )}
            </div>
            
            {/* Account Actions */}
            <div style={{ marginTop: "2rem", textAlign: "center", display: "flex", gap: "1rem", justifyContent: "center" }}>
              {/* Sign Out Button */}
              <button
                className="profile-signout-btn"
                style={{ background: "#1976d2", color: "#fff", padding: "0.75rem 2rem", borderRadius: "6px", border: "none", fontWeight: "bold" }}
                onClick={async () => {
                  try {
                    // Clear all localStorage data before signing out
                    clearAllLocalStorage();
                    await auth.signOut();
                    navigate("/");
                  } catch (err: any) {
                    alert("Failed to sign out: " + (err.message || err));
                  }
                }}
              >
                Sign Out
              </button>
              
              {/* Delete Account Button */}
              <button
                className="profile-delete-btn"
                style={{ background: "#c00", color: "#fff", padding: "0.75rem 2rem", borderRadius: "6px", border: "none", fontWeight: "bold" }}
                onClick={handleDeleteAccount}
              >
                Delete Account
              </button>
            </div>
          </div>
        ) : 
        
        /* Bookings Tab */
        activeTab === getTabIndex('bookings') ? (
          <div className="profile-events">
            <h3>Bookings</h3>
            
            {/* Filter and Sort Controls */}
            <div className="booking-filters">
              <div className="filter-group">
                <label htmlFor="sort-by">Sort by:</label>
                <select 
                  id="sort-by"
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value as 'date' | 'price' | 'status')}
                  className="filter-select"
                >
                  <option value="date">Date</option>
                  <option value="price">Price</option>
                  <option value="status">Status</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label htmlFor="sort-order">Order:</label>
                <select 
                  id="sort-order"
                  value={sortOrder} 
                  onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                  className="filter-select"
                >
                  <option value="desc">{sortBy === 'date' ? 'Newest First' : 'High to Low'}</option>
                  <option value="asc">{sortBy === 'date' ? 'Oldest First' : 'Low to High'}</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label htmlFor="filter-status">Filter by Status:</label>
                <select 
                  id="filter-status"
                  value={filterStatus} 
                  onChange={(e) => setFilterStatus(e.target.value as 'all' | 'deferred' | 'pending' | 'confirmed' | 'completed' | 'cancelled')}
                  className="filter-select"
                >
                  <option value="all">All Statuses</option>
                  <option value="deferred">Deferred</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            
            {loadingBookings ? (
              <div className="booking-loading">
                <p>Loading your booking history...</p>
              </div>
            ) : (
              <div className="bookings-container">
                {/* New Structure Bookings */}
                {(() => {
                  const filteredAndSortedBookings = filterAndSortBookings(bookings);
                  return filteredAndSortedBookings.length > 0 ? (
                    <div className="bookings-section">
                      <h4>Recent Bookings ({filteredAndSortedBookings.length})</h4>
                      {filteredAndSortedBookings.map((booking) => {
                      const isExpanded = expandedBookings.has(booking.orderID);
                      return (
                        <div key={booking.orderID} className="booking-card">
                          <div 
                            className="booking-header clickable" 
                            onClick={() => toggleBookingExpansion(booking.orderID)}
                          >
                            <div className="booking-info">
                              <h5>Order #{booking.orderID.slice(-8)}</h5>
                              <span 
                                className={`booking-status status-${booking.status || 'unknown'}`}
                                style={{ 
                                  backgroundColor: getStatusColor(booking.status),
                                  color: 'white',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '4px',
                                  fontSize: '0.8rem',
                                  fontWeight: 'bold'
                                }}
                              >
                                {formatStatus(booking.status)}
                              </span>
                            </div>
                            <div className="booking-header-right">
                              <div className="booking-date">
                                {booking.createdAt ? new Date(booking.createdAt).toLocaleDateString() : 'Date unknown'}
                              </div>
                              <div className={`expand-chevron ${isExpanded ? 'expanded' : ''}`}>
                                ▼
                              </div>
                            </div>
                          </div>
                          
                          <div className={`booking-details ${isExpanded ? 'expanded' : 'collapsed'}`}>
                          <p><strong>Event Date:</strong> {booking.orderDetails?.eventDate || 'Not specified'}</p>
                          <p><strong>Duration:</strong> {booking.orderDetails?.duration || 'Not specified'}</p>
                          <p><strong>Delivery:</strong> {booking.orderDetails?.deliveryAddress || 'Not specified'}</p>
                          <p><strong>Total:</strong> ${booking.orderDetails?.totalAmount || 0}</p>
                          
                          {booking.paymentDetails?.depositAmount > 0 && (
                            <p><strong>Deposit Paid:</strong> ${booking.paymentDetails.depositAmount}</p>
                          )}
                          
                          {booking.orderDetails?.items && booking.orderDetails.items.length > 0 && (
                            <div className="booking-items">
                              <strong>Items ({booking.orderDetails.items.length}):</strong>
                              <div className="items-list">
                                {booking.orderDetails.items.slice(0, 3).map((item: any, idx: number) => (
                                  <span key={idx} className="item-tag">
                                    {item.quantity}x {item.name}
                                  </span>
                                ))}
                                {booking.orderDetails.items.length > 3 && (
                                  <span className="item-tag more">
                                    +{booking.orderDetails.items.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className={`booking-actions ${isExpanded ? 'expanded' : 'collapsed'}`}>
                          <button 
                            className="btn-view-details"
                            onClick={() => {
                              setSelectedBooking(booking);
                              setShowBookingDetails(true);
                            }}
                          >
                            View Details
                          </button>
                          
                          <button 
                            className="btn-view-contract"
                            onClick={() => loadContract(booking)}
                            disabled={loadingContract}
                          >
                            {loadingContract ? 'Loading...' : 'View Contract'}
                          </button>
                          
                            {booking.status === 'pending' && booking.paymentDetails?.remainingBalance > 0 && (
                              <button 
                                className="btn-complete-payment"
                                onClick={() => navigate(`/checkout?booking=${booking.orderID}`)}
                              >
                                Complete Payment (${booking.paymentDetails.remainingBalance})
                              </button>
                            )}

                            {/* Cancel button for deferred, confirmed, or pending bookings */}
                            {(booking.status === 'deferred' || booking.status === 'confirmed' || booking.status === 'pending') && (
                              <button 
                                className="btn-cancel-booking"
                                onClick={() => handleCancelBooking(booking)}
                                style={{
                                  backgroundColor: '#dc3545',
                                  color: 'white',
                                  border: 'none',
                                  padding: '0.5rem 1rem',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '0.9rem'
                                }}
                              >
                                Cancel Booking
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null;
                })()}
                
                {/* Legacy Structure Bookings */}
                {(() => {
                  const filteredAndSortedLegacyBookings = filterAndSortBookings(legacyBookings, true);
                  return filteredAndSortedLegacyBookings.length > 0 ? (
                    <div className="bookings-section">
                      <h4>Previous Bookings ({filteredAndSortedLegacyBookings.length})</h4>
                      {filteredAndSortedLegacyBookings.map((booking) => {
                      const isExpanded = expandedBookings.has(booking.contractId);
                      return (
                        <div key={booking.contractId} className="booking-card legacy">
                          <div 
                            className="booking-header clickable" 
                            onClick={() => toggleBookingExpansion(booking.contractId)}
                          >
                            <div className="booking-info">
                              <h5>Contract #{booking.contractId.slice(-8)}</h5>
                              <span className={`booking-status status-${booking.status || 'unknown'}`}>
                                {formatStatus(booking.status)}
                              </span>
                            </div>
                            <div className="booking-header-right">
                              <div className="booking-date">
                                {booking.contractDate || 'Date not available'}
                              </div>
                              <div className={`expand-chevron ${isExpanded ? 'expanded' : ''}`}>
                                ▼
                              </div>
                            </div>
                          </div>
                          
                          <div className={`booking-details ${isExpanded ? 'expanded' : 'collapsed'}`}>
                          <p><strong>Event Date:</strong> {booking.orderDetails?.eventDate || 'Not specified'}</p>
                          <p><strong>Duration:</strong> {booking.orderDetails?.duration || 'Not specified'}</p>
                          <p><strong>Delivery:</strong> {booking.orderDetails?.deliveryAddress || 'Not specified'}</p>
                          <p><strong>Total:</strong> ${booking.orderDetails?.totalAmount || 0}</p>
                          
                          {booking.deposit > 0 && (
                            <p><strong>Deposit:</strong> ${booking.deposit}</p>
                          )}
                          
                          {booking.orderDetails?.items && (
                            <div className="booking-items">
                              <strong>Items ({booking.orderDetails.items.length}):</strong>
                              <div className="items-list">
                                {booking.orderDetails.items.slice(0, 3).map((item: any, idx: number) => (
                                  <span key={idx} className="item-tag">
                                    {item.quantity}x {item.name}
                                  </span>
                                ))}
                                {booking.orderDetails.items.length > 3 && (
                                  <span className="item-tag more">
                                    +{booking.orderDetails.items.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className={`booking-actions ${isExpanded ? 'expanded' : 'collapsed'}`}>
                          <button 
                            className="btn-view-details"
                            onClick={() => {
                              setSelectedBooking(booking);
                              setShowBookingDetails(true);
                            }}
                          >
                            View Details
                          </button>
                          
                          <button 
                            className="btn-view-contract"
                            onClick={() => loadContract(booking)}
                            disabled={loadingContract}
                          >
                            {loadingContract ? 'Loading...' : 'View Contract'}
                          </button>
                          
                            {booking.status === 'pending' && (
                              <button 
                                className="btn-complete-payment"
                                onClick={() => navigate(`/checkout?booking=${booking.contractId}`)}
                              >
                                Complete Payment
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null;
                })()}
                
                {/* No Bookings Message */}
                {(() => {
                  const filteredBookings = filterAndSortBookings(bookings);
                  const filteredLegacyBookings = filterAndSortBookings(legacyBookings, true);
                  const hasNoResults = filteredBookings.length === 0 && filteredLegacyBookings.length === 0;
                  const hasNoBookings = bookings.length === 0 && legacyBookings.length === 0;
                  
                  if (!loadingBookings && (hasNoBookings || hasNoResults)) {
                    return (
                      <div className="no-bookings">
                        <h4>{hasNoBookings ? 'No Bookings Yet' : 'No Matching Bookings'}</h4>
                        <p>
                          {hasNoBookings 
                            ? "You haven't made any bookings yet. Start planning your next event!" 
                            : "No bookings match your current filter criteria. Try adjusting your filters."
                          }
                        </p>
                        {hasNoBookings && (
                          <button 
                            className="btn-start-booking"
                            onClick={() => navigate('/home')}
                          >
                            Browse Rentals
                          </button>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
          </div>
        ) : 
        
        /* Membership Status Tab */
        activeTab === getTabIndex('membership') ? (
          <div className="profile-membership">
            <h3>Membership</h3>
            
            {loadingSubscription ? (
              <div className="loading">
                <p>Loading membership data...</p>
              </div>
            ) : (
              <div className="membership-content">
                
                {/* Membership Status Section */}
                <div className="membership-status-card">
                  <h4>🎪 Membership Status</h4>
                  
                  {userSubscription ? (
                    <div className="subscription-details">
                      <div className="status-indicator">
                        <div className={`status-badge ${userSubscription.status?.toLowerCase()}`}>
                          {(userSubscription.status === 'ACTIVE' || userSubscription.status === 'Active') && '✅ Active'}
                          {userSubscription.status === 'PENDING_APPROVAL' && '⏳ Pending Approval'}
                          {(userSubscription.status === 'CANCELLED' || userSubscription.status === 'Cancelled') && '❌ Cancelled'}
                          {(userSubscription.status === 'SUSPENDED' || userSubscription.status === 'Suspended') && '⏸️ Suspended'}
                        </div>
                      </div>
                      
                      <div className="subscription-info">
                        <div className="info-row">
                          <strong>Plan:</strong> Monthly Membership ($149/month)
                        </div>
                        
                        <div className="info-row">
                          <strong>Member Since:</strong> {userSubscription.createdAt ? new Date(userSubscription.createdAt.seconds ? userSubscription.createdAt.seconds * 1000 : userSubscription.createdAt).toLocaleDateString() : 'N/A'}
                        </div>
                        
                        {userSubscription.activatedAt && (
                          <div className="info-row">
                            <strong>Activated:</strong> {new Date(userSubscription.activatedAt.seconds ? userSubscription.activatedAt.seconds * 1000 : userSubscription.activatedAt).toLocaleDateString()}
                          </div>
                        )}
                        
                        {userSubscription.paypalDetails?.billing_info?.next_billing_time && (
                          <div className="info-row">
                            <strong>Next Billing:</strong> {new Date(userSubscription.paypalDetails.billing_info.next_billing_time).toLocaleDateString()}
                          </div>
                        )}
                        
                        {(userSubscription.status === 'CANCELLED' || userSubscription.status === 'Cancelled') && userSubscription.cancelledAt && (
                          <div className="info-row">
                            <strong>Cancelled:</strong> {new Date(userSubscription.cancelledAt.seconds ? userSubscription.cancelledAt.seconds * 1000 : userSubscription.cancelledAt).toLocaleDateString()}
                          </div>
                        )}
                        
                        <div className="info-row">
                          <strong>Subscription ID:</strong> 
                          <code style={{ fontSize: '0.8rem', backgroundColor: '#f0f0f0', padding: '0.2rem 0.4rem', borderRadius: '3px' }}>
                            {userSubscription.subscriptionId}
                          </code>
                        </div>
                      </div>
                      
                      {/* Subscription Management Actions */}
                      <div className="subscription-actions">
                        {(() => {
                          console.log('🔍 BUTTON DEBUG: Checking cancel button visibility');
                          console.log('🔍 BUTTON DEBUG: userSubscription exists?', !!userSubscription);
                          console.log('🔍 BUTTON DEBUG: userSubscription.status:', userSubscription?.status);
                          console.log('🔍 BUTTON DEBUG: Status is ACTIVE?', userSubscription?.status === 'ACTIVE');
                          console.log('🔍 BUTTON DEBUG: Status is Active?', userSubscription?.status === 'Active');
                          console.log('🔍 BUTTON DEBUG: Should show cancel button?', 
                            userSubscription?.status === 'ACTIVE' || userSubscription?.status === 'Active');
                          return null;
                        })()}
                        
                        {(userSubscription.status === 'ACTIVE' || userSubscription.status === 'Active') && (
                          <>
                            <div className="membership-benefits-highlight">
                              <p style={{ color: '#2e7d32', fontWeight: 'bold', textAlign: 'center', margin: '1rem 0' }}>
                                🎉 You're enjoying 25% off all rentals plus monthly inflatable delivery!
                              </p>
                            </div>
                            
                            <button 
                              className="btn-cancel-subscription"
                              onClick={handleCancelSubscription}
                              disabled={loadingSubscription}
                              style={{
                                backgroundColor: '#ff9800',
                                color: 'white',
                                border: 'none',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                width: '100%'
                              }}
                            >
                              {loadingSubscription ? 'Processing...' : 'Cancel Membership'}
                            </button>
                            
                            <p style={{ fontSize: '0.9rem', color: '#666', textAlign: 'center', marginTop: '0.5rem' }}>
                              Your membership will remain active until the next billing date
                            </p>
                          </>
                        )}
                        
                        {(userSubscription.status === 'CANCELLED' || userSubscription.status === 'Cancelled') && (
                          <>
                            <div className="cancelled-notice">
                              <p style={{ color: '#f44336', fontWeight: 'bold', textAlign: 'center', margin: '1rem 0' }}>
                                Your membership is scheduled for cancellation.
                              </p>
                              {userSubscription.paypalDetails?.billing_info?.next_billing_time && (
                                <p style={{ textAlign: 'center', marginBottom: '1rem' }}>
                                  Access remains until: {new Date(userSubscription.paypalDetails.billing_info.next_billing_time).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            
                            <button 
                              className="btn-reactivate-subscription"
                              onClick={handleReactivateSubscription}
                              disabled={loadingSubscription}
                              style={{
                                backgroundColor: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                width: '100%'
                              }}
                            >
                              {loadingSubscription ? 'Processing...' : 'Reactivate Membership'}
                            </button>
                          </>
                        )}
                        
                        {userSubscription.status === 'PENDING_APPROVAL' && (
                          <div className="pending-notice">
                            <p style={{ color: '#ff9800', fontWeight: 'bold', textAlign: 'center', margin: '1rem 0' }}>
                              ⏳ Your membership is pending PayPal approval
                            </p>
                            <p style={{ textAlign: 'center', color: '#666' }}>
                              Please complete the payment process in PayPal to activate your membership.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : userMembership && userMembership.jumpClub ? (
                    <div className="legacy-membership">
                      <div style={{ color: '#4CAF50', marginBottom: '0.5rem' }}>
                        ✅ <strong>Jump Club Member</strong> - You have an active membership!
                      </div>
                      <p style={{ color: '#2e7d32', fontStyle: 'italic' }}>
                        Enjoy 25% off all rental items with your active membership!
                      </p>
                      <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '1rem' }}>
                        Note: This appears to be a legacy membership. For full subscription management, 
                        please contact support or upgrade to our new subscription system.
                      </p>
                    </div>
                  ) : (
                    <div className="no-membership">
                      <p><strong>You are not currently a member.</strong></p>
                      <p>Join our membership program to get monthly inflatables delivered to your home with exclusive benefits!</p>
                    </div>
                  )}
                </div>
                
                {/* Membership Benefits - Only show for non-active subscribers */}
                {!isActiveSubscriber && (
                  <div className="membership-benefits-card">
                    <h4>🎯 Membership Benefits</h4>
                    <ul className="benefits-list">
                      <li>📦 Monthly inflatable delivery to your home</li>
                      <li>💰 25% off all other reservations</li>
                      <li>🔧 No setup or takedown hassle</li>
                      <li>⭐ Priority booking for special events</li>
                      <li>🆕 Fresh new inflatable each month</li>
                      <li>📞 Dedicated member support</li>
                    </ul>
                  </div>
                )}
                
                {/* Membership Booking Section (only for active subscribers) */}
                {isActiveSubscriber && (
                  <div className="membership-booking-card">
                    <h4>🎪 Monthly Membership Booking</h4>
                    <p>Schedule your monthly inflatable delivery!</p>
                    
                    {/* Error Message */}
                    {membershipBookingError && (
                      <div style={{
                        backgroundColor: '#ffebee',
                        border: '1px solid #f44336',
                        borderRadius: '4px',
                        padding: '0.75rem',
                        margin: '1rem 0',
                        color: '#c62828'
                      }}>
                        {membershipBookingError}
                      </div>
                    )}
                    
                    <div className="membership-booking-form">
                      {/* Step 1: Weekday Selection */}
                      <div className={`booking-step ${selectedWeekday ? 'completed' : 'active'}`}>
                        <h5>📅 Step 1: Choose Delivery Day</h5>
                        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.75rem' }}>
                          Select your preferred delivery day of the week (Monday-Thursday only)
                        </p>
                        
                        <div className="weekday-selection" style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, 1fr)',
                          gap: '0.5rem',
                          marginBottom: '1rem'
                        }}>
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday'].map((day) => (
                            <button
                              key={day}
                              type="button"
                              onClick={() => setSelectedWeekday(day)}
                              style={{
                                padding: '0.75rem 0.5rem',
                                border: `2px solid ${selectedWeekday === day ? '#4CAF50' : '#ddd'}`,
                                backgroundColor: selectedWeekday === day ? '#e8f5e8' : '#fff',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: selectedWeekday === day ? 'bold' : 'normal',
                                color: selectedWeekday === day ? '#2e7d32' : '#333',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Step 2: Surface and Anchoring Selection */}
                      {selectedWeekday && (
                        <div className={`booking-step ${selectedSurface ? 'completed' : 'active'}`}>
                          <h5>🏠 Step 2: Surface Type & Setup</h5>
                          <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.75rem' }}>
                            Select the surface where the inflatable will be set up
                          </p>
                          
                          <div className="surface-selection" style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                            gap: '0.5rem',
                            marginBottom: '1rem'
                          }}>
                            {[
                              { 
                                value: 'grass-stakes', 
                                surface: 'grass',
                                anchoring: 'stakes',
                                label: 'Grass (Stakes)', 
                                description: 'Metal stakes driven into ground',
                                fee: 0 
                              },
                              { 
                                value: 'grass-sandbags', 
                                surface: 'grass',
                                anchoring: 'sandbags',
                                label: 'Grass (Sandbags)', 
                                description: 'Weighted bags for safety',
                                fee: 0 
                              },
                              { 
                                value: 'concrete', 
                                surface: 'concrete',
                                anchoring: null,
                                label: 'Concrete/Pavement', 
                                description: 'Hard surface setup',
                                fee: 20 
                              }
                            ].map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  setSelectedSurface(option.surface);
                                  setSelectedStakesOrSandbags(option.anchoring || '');
                                }}
                                style={{
                                  padding: '0.75rem 0.5rem',
                                  border: `2px solid ${selectedSurface === option.surface && (option.surface === 'concrete' || selectedStakesOrSandbags === option.anchoring) ? '#4CAF50' : '#ddd'}`,
                                  backgroundColor: selectedSurface === option.surface && (option.surface === 'concrete' || selectedStakesOrSandbags === option.anchoring) ? '#e8f5e8' : '#fff',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontWeight: selectedSurface === option.surface && (option.surface === 'concrete' || selectedStakesOrSandbags === option.anchoring) ? 'bold' : 'normal',
                                  color: selectedSurface === option.surface && (option.surface === 'concrete' || selectedStakesOrSandbags === option.anchoring) ? '#2e7d32' : '#333',
                                  transition: 'all 0.2s ease',
                                  textAlign: 'center',
                                  fontSize: '0.85rem'
                                }}
                              >
                                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>{option.label}</div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: '0.25rem' }}>{option.description}</div>
                                {option.fee > 0 && (
                                  <div style={{ fontSize: '0.75rem', color: '#f57c00', fontWeight: 'bold' }}>
                                    +${option.fee}
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}


                      {/* Address Validation */}
                      {selectedSurface && (
                        <div className={`booking-step ${profile.address ? 'completed' : 'active'}`}>
                          <h5>📍 Step 3: Delivery Address</h5>
                          <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.75rem' }}>
                            Confirm your delivery address
                          </p>
                          
                          {profile.address ? (
                            <div style={{
                              padding: '0.75rem',
                              backgroundColor: '#f8f9fa',
                              border: '1px solid #dee2e6',
                              borderRadius: '8px',
                              marginBottom: '1rem'
                            }}>
                              <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                                📍 Delivery Address:
                              </div>
                              <div>{profile.address}</div>
                              <button
                                type="button"
                                onClick={() => setActiveTab(0)} // Navigate to Profile Information tab
                                style={{
                                  marginTop: '0.5rem',
                                  padding: '0.25rem 0.75rem',
                                  backgroundColor: '#2196F3',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem'
                                }}
                              >
                                Update Address
                              </button>
                            </div>
                          ) : (
                            <div style={{
                              padding: '1rem',
                              backgroundColor: '#fff3cd',
                              border: '1px solid #ffeaa7',
                              borderRadius: '8px',
                              textAlign: 'center',
                              marginBottom: '1rem'
                            }}>
                              <div style={{ color: '#856404', marginBottom: '0.5rem' }}>
                                ⚠️ Address Required
                              </div>
                              <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}>
                                Please add your address in the Profile Information tab before booking.
                              </p>
                              <button
                                type="button"
                                onClick={() => setActiveTab(0)} // Navigate to Profile Information tab
                                style={{
                                  padding: '0.5rem 1rem',
                                  backgroundColor: '#ffc107',
                                  color: '#212529',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold'
                                }}
                              >
                                Add Address
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Summary and Submit */}
                      {profile.address && selectedSurface && (
                        <div className="booking-step active">
                          <h5>📋 Step 4: Review & Book</h5>
                          
                          {(() => {
                            const validationError = validateMembershipBooking();
                            if (validationError) {
                              return (
                                <div style={{
                                  padding: '1rem',
                                  backgroundColor: '#ffebee',
                                  border: '1px solid #f44336',
                                  borderRadius: '8px',
                                  color: '#c62828',
                                  marginBottom: '1rem'
                                }}>
                                  ⚠️ {validationError}
                                </div>
                              );
                            }

                            const surfaceFee = selectedSurface === 'concrete' ? 20 : 0;
                            const actualEventDate = calculateActualEventDate();
                            
                            return (
                              <div>
                                {/* Event Date Notice */}
                                {actualEventDate && (
                                  <div style={{
                                    padding: '1rem',
                                    backgroundColor: '#e3f2fd',
                                    border: '1px solid #2196f3',
                                    borderRadius: '8px',
                                    marginBottom: '1rem'
                                  }}>
                                    <h6 style={{ margin: '0 0 0.5rem 0', color: '#1565c0' }}>📅 Actual Event Date</h6>
                                    <p style={{ margin: '0', fontSize: '0.9rem' }}>
                                      Your membership booking will be scheduled for <strong>{actualEventDate.toLocaleDateString('en-US', { 
                                        weekday: 'long', 
                                        year: 'numeric', 
                                        month: 'long', 
                                        day: 'numeric' 
                                      })}</strong> - the next first {selectedWeekday} of the month.
                                    </p>
                                  </div>
                                )}

                                <div style={{
                                  padding: '1rem',
                                  backgroundColor: '#f8f9fa',
                                  border: '1px solid #dee2e6',
                                  borderRadius: '8px',
                                  marginBottom: '1rem'
                                }}>
                                  <h6 style={{ margin: '0 0 0.5rem 0' }}>Booking Summary</h6>
                                  <div style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>
                                    <div>📅 <strong>Preferred Day:</strong> {selectedWeekday}s (first of each month)</div>
                                    <div>🏠 <strong>Surface & Setup:</strong> {
                                      selectedSurface === 'grass' ? 
                                        `Grass with ${selectedStakesOrSandbags === 'stakes' ? 'Stakes' : 'Sandbags'}` : 
                                        'Concrete/Pavement'
                                    }</div>
                                    <div>📍 <strong>Address:</strong> {profile.address}</div>
                                    <div>💰 <strong>Additional Fee:</strong> {surfaceFee > 0 ? `$${surfaceFee} (concrete surface)` : 'None'}</div>
                                  </div>
                                </div>
                                
                                <button
                                  type="button"
                                  onClick={() => {
                                    // TODO: Implement booking submission
                                    setMembershipBookingError("Booking submission functionality coming soon!");
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    backgroundColor: '#4CAF50',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  🎪 Confirm Membership Booking
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Join/Upgrade Action */}
                {!userSubscription && (
                  <div className="membership-action-card">
                    <h4>Ready to Join?</h4>
                    <p>Start your monthly membership for just $149/month</p>
                    <button 
                      className="btn-become-member"
                      onClick={() => {
                        navigate('/checkout?membership=jump-club');
                      }}
                      style={{
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        padding: '1rem 2rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                        width: '100%'
                      }}
                    >
                      🎪 Become a Member - $149/month
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : 
        
        /* Payment Information Tab */
        activeTab === getTabIndex('payment') ? (
          <div className="profile-payment">
            <h3>Payment Information</h3>
            
            {/* Password Verification Modal */}
            {showPasswordVerification && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
              }}>
                <div style={{
                  backgroundColor: 'white',
                  padding: '2rem',
                  borderRadius: '8px',
                  minWidth: '400px',
                  textAlign: 'center'
                }}>
                  <h4 style={{ marginBottom: '1rem' }}>Verify Your Password</h4>
                  <p style={{ marginBottom: '1rem', color: '#666' }}>
                    For security, please enter your password to access payment information:
                  </p>
                  
                  <input
                    type="password"
                    value={verificationPassword}
                    onChange={(e) => setVerificationPassword(e.target.value)}
                    placeholder="Enter your password"
                    style={{
                      padding: '0.75rem',
                      fontSize: '1rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      width: '100%',
                      marginBottom: '1rem'
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && verifyPassword()}
                  />
                  
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <button
                      onClick={() => {
                        setShowPasswordVerification(false);
                        setVerificationPassword("");
                        setActiveTab(0); // Go back to profile tab
                      }}
                      style={{
                        backgroundColor: '#6c757d',
                        color: 'white',
                        border: 'none',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    
                    <button
                      onClick={verifyPassword}
                      disabled={!verificationPassword.trim()}
                      style={{
                        backgroundColor: verificationPassword.trim() ? '#28a745' : '#ccc',
                        color: 'white',
                        border: 'none',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '4px',
                        cursor: verificationPassword.trim() ? 'pointer' : 'not-allowed'
                      }}
                    >
                      Verify
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Payment Information Content */}
            {passwordVerified && (
              <div className="payment-content">
                {/* Wallet Section */}
                <div className="wallet-section">
                  <h4>💰 Your Wallet</h4>
                  {loadingWallet ? (
                    <div>Loading wallet information...</div>
                  ) : userWallet ? (
                    <div className="wallet-info">
                      <div className="wallet-balance">
                        <h5>Current Balance: ${userWallet.balance.toFixed(2)}</h5>
                      </div>
                      
                      {/* Add to Wallet Button */}
                      <div className="wallet-actions" style={{ marginTop: '1rem' }}>
                        <button
                          onClick={() => setShowWalletModal(true)}
                          style={{
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '1rem'
                          }}
                        >
                          💰 Add to Wallet
                        </button>
                      </div>
                      

                      
                      {/* Transaction History */}
                      {userWallet.transactions.length > 0 && (
                        <div className="wallet-transactions">
                          <h6>Recent Transactions</h6>
                          <div className="transaction-list">
                            {userWallet.transactions.slice(0, 5).map((transaction) => (
                              <div key={transaction.id} className="transaction-item" style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.5rem',
                                borderBottom: '1px solid #eee'
                              }}>
                                <div>
                                  <div style={{ fontWeight: 'bold' }}>{transaction.description}</div>
                                  <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                    {new Date(transaction.createdAt).toLocaleDateString()}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{
                                    color: transaction.type === 'withdrawal' ? '#dc3545' : '#28a745',
                                    fontWeight: 'bold'
                                  }}>
                                    {transaction.type === 'withdrawal' ? '-' : '+'}${transaction.amount.toFixed(2)}
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: '#888' }}>
                                    {/* Calculate balance after this transaction */}
                                    Balance: ${(() => {
                                      // Start from current balance and walk backwards
                                      const idx = userWallet.transactions.findIndex(t => t.id === transaction.id);
                                      let balance = userWallet.balance;
                                      for (let i = 0; i < idx; i++) {
                                        const t = userWallet.transactions[i];
                                        if (t.type === 'deposit' || t.type === 'gift_card_redemption') {
                                          balance -= t.amount;
                                        } else if (t.type === 'withdrawal') {
                                          balance += t.amount;
                                        }
                                      }
                                      return balance.toFixed(2);
                                    })()}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>Error loading wallet information</div>
                  )}
                </div>
                
                {/* Gift Card Balance Checker Section */}
                <div className="gift-card-checker-section" style={{ marginBottom: '2rem' }}>
                  <h4>🎁 Gift Card Balance Checker</h4>
                  <div style={{ 
                    background: '#f8f9fa', 
                    padding: '1.5rem', 
                    borderRadius: '8px', 
                    border: '1px solid #dee2e6',
                    textAlign: 'center'
                  }}>
                    <p style={{ marginBottom: '1rem', color: '#666' }}>
                      Check your gift card balance and redeem to your wallet.
                    </p>
                    <button
                      onClick={() => setShowGiftCardModal(true)}
                      style={{
                        backgroundColor: '#4a90e2',
                        color: 'white',
                        border: 'none',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '6px',
                        fontSize: '1rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(74, 144, 226, 0.3)',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#357abd';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = '#4a90e2';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      Check Gift Card Balance
                    </button>
                  </div>
                </div>
                
                {/* Saved Payment Methods Section */}
                <div className="payment-methods-section">
                  <h4>💳 Saved Payment Methods</h4>
                  {loadingPaymentInfo ? (
                    <div>Loading payment methods...</div>
                  ) : userPaymentInfo ? (
                    <div className="payment-methods-content">
                      {/* Add Payment Method Button */}
                      <div style={{ 
                        marginBottom: '1.5rem', 
                        textAlign: 'center',
                        padding: '1rem',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '8px',
                        border: '1px solid #dee2e6'
                      }}>
                        <p style={{ marginBottom: '1rem', color: '#666' }}>
                          Store a payment method for faster checkout without adding to wallet.
                        </p>
                        <button
                          onClick={() => setShowPaymentMethodModal(true)}
                          style={{
                            backgroundColor: '#0070ba',
                            color: 'white',
                            border: 'none',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '6px',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0, 112, 186, 0.3)',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = '#005fa3';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = '#0070ba';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          💳 Store Payment Method
                        </button>
                      </div>

                      {userPaymentInfo.savedPaymentMethods.length > 0 ? (
                        <div className="payment-methods-list">
                          {userPaymentInfo.savedPaymentMethods.map((method) => (
                            <div key={method.id} className="payment-method-item" style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '1rem',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              marginBottom: '0.5rem',
                              backgroundColor: method.isDefault ? '#f8fff8' : '#fff'
                            }}>
                              <div className="payment-method-info">
                                <div style={{ fontWeight: 'bold' }}>
                                  {method.type === 'card' ? (
                                    `${method.cardType} ****${method.lastFour}`
                                  ) : (
                                    'PayPal Account'
                                  )}
                                  {method.isDefault && <span style={{ color: '#28a745', marginLeft: '0.5rem' }}>(Default)</span>}
                                </div>
                                {method.type === 'card' && method.expiryMonth && method.expiryYear && (
                                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                                    Expires {method.expiryMonth}/{method.expiryYear}
                                  </div>
                                )}
                                <div style={{ fontSize: '0.8rem', color: '#999' }}>
                                  Added {new Date(method.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                              
                              <div className="payment-method-actions">
                                <button
                                  onClick={() => setDefaultPaymentMethod(method.id)}
                                  style={{
                                    backgroundColor: method.isDefault ? '#6c757d' : '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.8rem',
                                    cursor: method.isDefault ? 'not-allowed' : 'pointer',
                                    marginRight: '0.5rem'
                                  }}
                                  disabled={method.isDefault}
                                >
                                  {method.isDefault ? 'Default' : 'Set Default'}
                                </button>
                                
                                <button
                                  onClick={() => removePaymentMethod(method.id)}
                                  style={{
                                    backgroundColor: '#dc3545',
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ 
                          textAlign: 'center', 
                          padding: '2rem',
                          color: '#666',
                          fontStyle: 'italic'
                        }}>
                          <p>No saved payment methods yet.</p>
                          <p>Click "Store Payment Method" above to add your first payment method!</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>Error loading payment methods</div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>Unknown tab selected</div>
        )}

        {/* Back button */}
      <div style={{ marginBottom: "1rem" }}>
        <button
          className="profile-back-btn"
          onClick={() => navigate("/home")}
        >
          &larr; Back
        </button>
      </div>
      </div>
    </div>
    
    {/* Booking Details Modal */}
    {showBookingDetails && selectedBooking && (
      <div className="modal-overlay fade-in" onClick={() => setShowBookingDetails(false)}>
        <div className="modal-shadow" />
        <div className="booking-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>
              {selectedBooking.orderID ? 
                `Booking Details - Order #${selectedBooking.orderID.slice(-8)}` : 
                `Booking Details - Contract #${selectedBooking.contractId.slice(-8)}`
              }
            </h2>
            <button className="modal-close" onClick={() => setShowBookingDetails(false)}>×</button>
          </div>
          
          <div className="modal-content">
            <div className="booking-detail-section">
              <h3>Event Information</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <strong>Event Date:</strong>
                  <span>{selectedBooking.orderDetails?.eventDate || 'Not specified'}</span>
                </div>
                <div className="detail-item">
                  <strong>Duration:</strong>
                  <span>{selectedBooking.orderDetails?.duration || 'Not specified'}</span>
                </div>
                <div className="detail-item">
                  <strong>Delivery Time:</strong>
                  <span>{selectedBooking.orderDetails?.deliveryTime || 'Not specified'}</span>
                </div>
                <div className="detail-item">
                  <strong>Surface:</strong>
                  <span>{selectedBooking.orderDetails?.surface || 'Not specified'}</span>
                </div>
                <div className="detail-item full-width">
                  <strong>Delivery Address:</strong>
                  <span>{selectedBooking.orderDetails?.deliveryAddress || 'Not specified'}</span>
                </div>
              </div>
            </div>
            
            <div className="booking-detail-section">
              <h3>Booking Status</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <strong>Status:</strong>
                  <span className={`booking-status status-${selectedBooking.status || 'unknown'}`}>
                    {formatStatus(selectedBooking.status)}
                  </span>
                </div>
                <div className="detail-item">
                  <strong>Booking Date:</strong>
                  <span>
                    {selectedBooking.createdAt ? 
                      new Date(selectedBooking.createdAt).toLocaleDateString() : 
                      (selectedBooking.contractDate || 'Not available')
                    }
                  </span>
                </div>
              </div>
            </div>
            
            <div className="booking-detail-section">
              <h3>Payment Information</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <strong>Total Amount:</strong>
                  <span>${selectedBooking.orderDetails?.totalAmount || 0}</span>
                </div>
                {selectedBooking.paymentDetails ? (
                  <>
                    <div className="detail-item">
                      <strong>Payment Type:</strong>
                      <span>{selectedBooking.paymentDetails.paymentType === 'deposit' ? 'Deposit Payment' : 'Full Payment'}</span>
                    </div>
                    <div className="detail-item">
                      <strong>Amount Paid:</strong>
                      <span>${selectedBooking.paymentDetails.depositAmount || 0}</span>
                    </div>
                    {selectedBooking.paymentDetails.remainingBalance > 0 && (
                      <div className="detail-item">
                        <strong>Remaining Balance:</strong>
                        <span>${selectedBooking.paymentDetails.remainingBalance}</span>
                      </div>
                    )}
                    <div className="detail-item">
                      <strong>Payment Status:</strong>
                      <span className={`payment-status status-${selectedBooking.paymentDetails.paymentStatus || 'unknown'}`}>
                        {formatStatus(selectedBooking.paymentDetails.paymentStatus)}
                      </span>
                    </div>
                  </>
                ) : selectedBooking.deposit > 0 && (
                  <div className="detail-item">
                    <strong>Deposit:</strong>
                    <span>${selectedBooking.deposit}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="booking-detail-section">
              <h3>Rental Items</h3>
              <div className="items-detail-list">
                {selectedBooking.orderDetails?.items?.map((item: any, idx: number) => (
                  <div key={idx} className="item-detail-row">
                    <span className="item-name">{item.name}</span>
                    <span className="item-quantity">Qty: {item.quantity}</span>
                    <span className="item-price">${item.price}</span>
                  </div>
                )) || <p>No items found</p>}
              </div>
            </div>
            
            <div className="booking-detail-section">
              <h3>Customer Information</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <strong>Name:</strong>
                  <span>
                    {selectedBooking.customerInfo?.firstName && selectedBooking.customerInfo?.lastName ? 
                      `${selectedBooking.customerInfo.firstName} ${selectedBooking.customerInfo.lastName}` :
                      (selectedBooking.customerInfo?.name || 'Not specified')
                    }
                  </span>
                </div>
                <div className="detail-item">
                  <strong>Email:</strong>
                  <span>{selectedBooking.customerInfo?.email || 'Not specified'}</span>
                </div>
                {selectedBooking.customerInfo?.phone && (
                  <div className="detail-item">
                    <strong>Phone:</strong>
                    <span>{selectedBooking.customerInfo.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="modal-actions">
            {selectedBooking.status === 'pending' && (
              <button 
                className="btn-complete-payment"
                onClick={() => {
                  const bookingId = selectedBooking.orderID || selectedBooking.contractId;
                  navigate(`/checkout?booking=${bookingId}`);
                }}
              >
                Complete Payment
                {selectedBooking.paymentDetails?.remainingBalance && 
                  ` ($${selectedBooking.paymentDetails.remainingBalance})`
                }
              </button>
            )}
            <button className="btn-close" onClick={() => setShowBookingDetails(false)}>
              Close
            </button>
          </div>
        </div>
      </div>
    )}
    
    {/* Contract Viewing Modal */}
    {showContract && selectedContract && (
      <div className="modal-overlay fade-in" onClick={() => setShowContract(false)}>
        <div className="modal-shadow" />
        <div className="contract-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>
              Signed Contract - {selectedContract.contractID ? 
                `Contract #${selectedContract.contractID.slice(-8)}` : 
                'Contract Details'
              }
            </h2>
            <button className="modal-close" onClick={() => setShowContract(false)}>×</button>
          </div>
          
          <div className="contract-content">
            <div className="contract-header-info">
              <div className="contract-meta">
                <p><strong>Contract Date:</strong> {selectedContract.contractDate || 'Not specified'}</p>
                <p><strong>Customer:</strong> {selectedContract.customerID}</p>
                {selectedContract.initials && (
                  <p><strong>Initials:</strong> {selectedContract.initials}</p>
                )}
              </div>
            </div>
            
            <div className="contract-sections">
              <h3>Agreement Terms</h3>
              {selectedContract.agreementSections && selectedContract.agreementSections.length > 0 ? (
                selectedContract.agreementSections.map((section: any, index: number) => (
                  <div key={section.id || index} className="contract-section">
                    <div className="section-header">
                      <h4>{section.title || `Section details`}</h4>
                      <div className="section-status">
                        {section.isInitialed ? (
                          <span className="initialed">
                            ✓ Initialed
                            {section.initialedAt && (
                              <small> on {new Date(section.initialedAt).toLocaleDateString()}</small>
                            )}
                          </span>
                        ) : section.isFinePrint || 
                           section.title === 'Hold Harmless Provision' || 
                           section.title === 'Merger Clause' ? (
                          <span className="fine-print-section">
                            📄 Standard Terms
                          </span>
                        ) : (
                          <span className="not-initialed">Not Initialed</span>
                        )}
                      </div>
                    </div>
                    <div className="section-content">
                      {section.content ? (
                        <div dangerouslySetInnerHTML={{ __html: section.content.replace(/\n/g, '<br>') }} />
                      ) : (
                        <p>No content available</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p>No contract sections found.</p>
              )}
            </div>
            
            {selectedContract.signature && (
              <div className="contract-signature">
                <h3>Signature</h3>
                <div className="signature-section">
                  <div className="signature-display">
                    <strong>Typed Signature:</strong>
                    <div className="signature-text">{selectedContract.signature.signatureData}</div>
                  </div>
                  <div className="signature-date">
                    <strong>Signed on:</strong> {new Date(selectedContract.signature.signedAt).toLocaleDateString()} at {new Date(selectedContract.signature.signedAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            )}
            
            <div className="contract-footer">
              <p><em>This is a digital copy of the signed contract. All terms and agreements are legally binding.</em></p>
            </div>
          </div>
          
          <div className="modal-actions">
            <button className="btn-print" onClick={() => window.print()}>
              Print Contract
            </button>
            <button className="btn-close" onClick={() => setShowContract(false)}>
              Close
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Wallet Funding Modal */}
    {user && (
      <WalletFundingModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        userId={user.uid}
        onSuccess={(amount, method) => {
          
          // Show success notification
          const methodText = method === 'gift_card' ? 'gift card' : 'PayPal';
          alert(`Successfully added $${amount.toFixed(2)} to your wallet via ${methodText}!`);
          
          // Refresh wallet data
          loadPaymentTabData();
        }}
        onError={(message) => {
          console.error('Wallet funding error:', message);
          alert(`Funding failed: ${message}`);
        }}
      />
    )}

    {/* Gift Card Balance Checker Modal */}
    {showGiftCardModal && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '8px',
          minWidth: '500px',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflowY: 'auto',
          textAlign: 'center'
        }}>
          <h3 style={{ marginBottom: '1rem', color: '#4a90e2' }}>🎁 Check Gift Card Balance</h3>
          <p style={{ marginBottom: '1.5rem', color: '#666' }}>
            Enter your gift card code to check the current balance and redeem to your wallet.
          </p>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem',
              fontWeight: 'bold',
              color: '#333',
              textAlign: 'left'
            }}>
              Gift Card Code:
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={giftCardCode}
                onChange={(e) => {
                  const input = e.target.value;
                  // Remove all dashes first
                  const cleaned = input.replace(/-/g, '');
                  
                  // Only allow alphanumeric characters (letters and numbers)
                  const alphanumeric = cleaned.replace(/[^A-Za-z0-9]/g, '');
                  
                  // Limit to 12 characters max
                  const limited = alphanumeric.slice(0, 12);
                  
                  // Add dashes automatically: XXXX-XXXX-XXXX
                  let formatted = limited;
                  if (limited.length > 4) {
                    formatted = limited.slice(0, 4) + '-' + limited.slice(4);
                  }
                  if (limited.length > 8) {
                    formatted = limited.slice(0, 4) + '-' + limited.slice(4, 8) + '-' + limited.slice(8);
                  }
                  
                  setGiftCardCode(formatted);
                  setGiftCardError(null);
                  setGiftCardLookupResult(null);
                }}
                placeholder="Enter gift card code (e.g., Ab3X-Yz9M-Qp2K)"
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: '2px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  textAlign: 'center',
                  letterSpacing: '0.5px',
                  fontFamily: 'monospace'
                }}
                disabled={loadingGiftCardLookup}
                maxLength={14} // XXXX-XXXX-XXXX = 14 characters
              />
              <button
                onClick={handleGiftCardLookup}
                disabled={loadingGiftCardLookup || !giftCardCode.trim()}
                style={{
                  backgroundColor: loadingGiftCardLookup || !giftCardCode.trim() ? '#ccc' : '#4a90e2',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '4px',
                  cursor: loadingGiftCardLookup || !giftCardCode.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}
              >
                {loadingGiftCardLookup ? 'Checking...' : 'Check Balance'}
              </button>
            </div>
          </div>

          {giftCardError && (
            <div style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              borderRadius: '6px',
              backgroundColor: '#f8d7da',
              border: '1px solid #f5c6cb',
              color: '#721c24'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                ❌ Error
              </div>
              <div>{giftCardError}</div>
            </div>
          )}

          {giftCardLookupResult && (
            <div style={{
              marginBottom: '1.5rem',
              padding: '1.5rem',
              borderRadius: '8px',
              backgroundColor: '#d4edda',
              border: '1px solid #c3e6cb',
              color: '#155724',
              textAlign: 'left'
            }}>
              <h5 style={{ 
                color: '#155724', 
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                🎁 Gift Card Details
              </h5>
              
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Code:</strong> {giftCardLookupResult.redemptionCode}
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Current Balance:</strong> 
                  <span style={{ 
                    color: '#28a745', 
                    fontSize: '1.2rem', 
                    fontWeight: 'bold', 
                    marginLeft: '0.5rem' 
                  }}>
                    ${giftCardLookupResult.currentBalance.toFixed(2)}
                  </span>
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Original Amount:</strong> ${giftCardLookupResult.originalAmount.toFixed(2)}
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Expires:</strong> {new Date(giftCardLookupResult.expirationDate).toLocaleDateString()}
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Purchased:</strong> {new Date(giftCardLookupResult.purchaseDate).toLocaleDateString()}
                </div>
              </div>

              {giftCardLookupResult.currentBalance > 0 && (
                <div style={{ 
                  borderTop: '1px solid #c3e6cb',
                  paddingTop: '1rem',
                  textAlign: 'center'
                }}>
                  <button
                    onClick={() => handleRedeemFromChecker()}
                    style={{
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    💰 Add Full Balance to Wallet (${giftCardLookupResult.currentBalance.toFixed(2)})
                  </button>
                </div>
              )}

              {giftCardLookupResult.usageHistory && giftCardLookupResult.usageHistory.length > 0 && (
                <div style={{ 
                  borderTop: '1px solid #c3e6cb',
                  paddingTop: '1rem',
                  marginTop: '1rem'
                }}>
                  <h6>Usage History:</h6>
                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {giftCardLookupResult.usageHistory.map((usage: any, index: number) => (
                      <div key={index} style={{ 
                        fontSize: '0.9rem', 
                        marginBottom: '0.5rem',
                        padding: '0.5rem',
                        backgroundColor: 'rgba(255,255,255,0.5)',
                        borderRadius: '4px'
                      }}>
                        <div style={{ fontWeight: 'bold' }}>
                          {usage.type === 'order' ? '🛒' : '💰'} {usage.description}
                        </div>
                        <div style={{ color: '#666' }}>
                          Amount: ${usage.amount.toFixed(2)} • {new Date(usage.date).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            {giftCardLookupResult && (
              <button
                onClick={resetGiftCardChecker}
                style={{
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}
              >
                Check Another
              </button>
            )}
            
            <button
              onClick={() => {
                setShowGiftCardModal(false);
                resetGiftCardChecker();
              }}
              style={{
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Close
            </button>
          </div>

          <div style={{ 
            marginTop: '1rem', 
            fontSize: '0.8rem', 
            color: '#666',
            fontStyle: 'italic',
            textAlign: 'left'
          }}>
            <strong>Need help?</strong><br />
            • Gift card codes are 12 characters in format: XXXX-XXXX-XXXX<br />
            • Codes contain letters (both cases) and numbers<br />
            • Codes are case-sensitive - enter exactly as shown<br />
            • Contact us at (803) 221-0466 if you have issues
          </div>
        </div>
      </div>
    )}

    {/* Payment Method Storage Modal */}
    {showPaymentMethodModal && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '8px',
          minWidth: '500px',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflowY: 'auto',
          textAlign: 'center'
        }}>
          <h3 style={{ marginBottom: '1rem', color: '#0070ba' }}>💳 Store Payment Method</h3>
          <p style={{ marginBottom: '1.5rem', color: '#666' }}>
            We'll securely store your payment method for faster checkout. A small verification charge of $0.50 will be processed and immediately refunded.
          </p>
          
          {storingPaymentMethod && (
            <div style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              borderRadius: '6px',
              backgroundColor: '#e3f2fd',
              border: '1px solid #bbdefb',
              color: '#1976d2'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                🔄 Processing...
              </div>
              <div>Storing your payment method securely...</div>
            </div>
          )}

          <div style={{ marginBottom: '1.5rem' }}>
            <PayPalScriptProvider options={{
              clientId: "AWT5np0jyr8BIdzyJvoWm0X9158l2F0l0rPjE6q925D5VnZVix4uwDRSivBe8Vs4sjCO8Hu-io5mSxM0",
              currency: "USD",
              intent: "capture",
              vault: true
            }}>
              <PayPalButtons
                style={{
                  layout: "vertical",
                  color: "blue",
                  shape: "rect",
                  label: "pay"
                }}
                createOrder={createPaymentMethodOrder}
                onApprove={onPaymentMethodApprove}
                onError={onPaymentMethodError}
                disabled={storingPaymentMethod}
              />
            </PayPalScriptProvider>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button
              onClick={() => {
                setShowPaymentMethodModal(false);
                setStoringPaymentMethod(false);
              }}
              style={{
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Cancel
            </button>
          </div>

          <div style={{ 
            marginTop: '1rem', 
            fontSize: '0.8rem', 
            color: '#666',
            fontStyle: 'italic',
            textAlign: 'left'
          }}>
            <strong>Security Note:</strong><br />
            • Your payment information is securely stored by PayPal<br />
            • We never store your actual card details<br />
            • The $0.50 verification charge is immediately refunded<br />
            • You can remove stored methods anytime from this page
          </div>
        </div>
      </div>
    )}

    {/* Booking Cancellation Confirmation Modal */}
    {showCancelConfirmation && bookingToCancel && (
      <div className="modal-overlay" onClick={() => setShowCancelConfirmation(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: '2rem' }}>
            <h2 style={{ color: '#dc3545', marginBottom: '1rem' }}>⚠️ Cancel Booking</h2>
            
            <div className="booking-cancel-details">
              <div style={{ marginBottom: '1.5rem' }}>
                <h3>Booking Details:</h3>
                <p><strong>Order ID:</strong> {bookingToCancel.orderID}</p>
                <p><strong>Event Date:</strong> {bookingToCancel.orderDetails?.eventDate}</p>
                <p><strong>Status:</strong> {formatStatus(bookingToCancel.status)}</p>
              </div>

              {(() => {
                const outcome = getCancellationPolicyOutcome(bookingToCancel);
                return (
                  <div style={{ 
                    backgroundColor: '#f8f9fa', 
                    padding: '1.5rem', 
                    borderRadius: '8px',
                    border: '1px solid #dee2e6',
                    marginBottom: '1.5rem'
                  }}>
                    <h4 style={{ color: '#495057', marginBottom: '1rem' }}>Cancellation Policy Details:</h4>
                    <p><strong>Days until event:</strong> {outcome.daysUntil}</p>
                    
                    {outcome.refundAmount > 0 && (
                      <p style={{ color: '#28a745' }}>
                        <strong>PayPal Refund:</strong> ${outcome.refundAmount.toFixed(2)}
                      </p>
                    )}
                    
                    {outcome.walletAmount > 0 && (
                      <p style={{ color: '#007bff' }}>
                        <strong>Wallet Credit:</strong> ${outcome.walletAmount.toFixed(2)}
                      </p>
                    )}
                    
                    <div style={{ 
                      marginTop: '1rem',
                      padding: '1rem',
                      backgroundColor: outcome.refundAmount > 0 ? '#d4edda' : outcome.walletAmount > 0 ? '#d1ecf1' : '#f8d7da',
                      borderRadius: '4px',
                      fontSize: '0.95rem'
                    }}>
                      {outcome.policyText}
                    </div>
                  </div>
                );
              })()}

              <div style={{ 
                backgroundColor: '#fff3cd',
                padding: '1rem',
                borderRadius: '4px',
                border: '1px solid #ffc107',
                marginBottom: '1.5rem'
              }}>
                <strong>⚠️ Warning:</strong> This action cannot be undone. Are you sure you want to cancel this booking?
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCancelConfirmation(false)}
                disabled={cancellingBooking}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '4px',
                  cursor: cancellingBooking ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  opacity: cancellingBooking ? 0.6 : 1
                }}
              >
                Keep Booking
              </button>
              <button
                onClick={processCancellation}
                disabled={cancellingBooking}
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '4px',
                  cursor: cancellingBooking ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  opacity: cancellingBooking ? 0.6 : 1
                }}
              >
                {cancellingBooking ? 'Cancelling...' : 'Cancel Booking'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    </>
  );
}
