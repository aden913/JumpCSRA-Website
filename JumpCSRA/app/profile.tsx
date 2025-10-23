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
import { loadBookingData, loadContractData, loadContractByOrderID, getUserWallet, getUserPaymentInfo, addWalletTransaction } from "./utils/databaseUtils";
import type { BookingData, ContractData, UserWallet, UserPaymentInfo } from "./utils/databaseUtils";
import { redeemGiftCardToWallet, validateGiftCard, getGiftCardDetails } from "./hooks/useDiscounts";
import { WalletFundingModal } from "./components/WalletFundingModal";

const TABS = ["Profile Information", "Past Events", "Membership", "Payment Information"];

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

  const [activeTab, setActiveTab] = useState(0);
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
  const [loadingGiftCardLookup, setLoadingGiftCardLookup] = useState(false);
  const [giftCardError, setGiftCardError] = useState<string | null>(null);

  const navigate = useNavigate();
  
  // Add hooks for navbar functionality
  const inflateables = useInflateables();
  const categories = useCategories(inflateables);

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
      
      console.log(`📋 Loaded ${newBookings.length} new bookings and ${legacyBookings.length} legacy bookings`);
      
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
      console.log('🔄 PROFILE - Synced input field with profile address:', profile.address);
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

  // Load user bookings when user changes or Past Events tab is accessed
  useEffect(() => {
    if (user && activeTab === 1) {
      loadUserBookings(user.uid);
    }
  }, [user, activeTab]);



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
      
      console.log('🎯 PROFILE - GOOGLE PLACES SELECTION:');
      console.log('  - Formatted address from Google:', googleAddress);
      console.log('  - Current input field value:', addressInputRef.current?.value);
      console.log('  - Current profile address state:', profile.address);
      
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
      
      console.log('  - Updated profile address to:', googleAddress);
      console.log('  - Updated input field to:', googleAddress);
      
      // Clear the flag after a short delay
      setTimeout(() => {
        setIsSelectingGooglePlace(false);
      }, 100);
    }
  };

  // Handle manual address input change
  const handleAddressChange = (value: string) => {
    console.log('📝 PROFILE - MANUAL ADDRESS CHANGE:');
    console.log('  - Typed value:', value);
    console.log('  - Previous profile address:', profile.address);
    console.log('  - Current input field value:', addressInputRef.current?.value);
    console.log('  - Is currently selecting Google Place?:', isSelectingGooglePlace);
    
    // Don't override if we're currently selecting a Google Place
    if (isSelectingGooglePlace) {
      console.log('  - BLOCKED: Google Place selection in progress, ignoring manual change');
      return;
    }
    
    setProfile(prev => ({ ...prev, address: value }));
    console.log('  - Updated profile address to:', value);
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

  // Gift Card Balance Checker Function
  const handleGiftCardLookup = async () => {
    if (!giftCardCode.trim()) {
      setGiftCardError("Please enter a gift card code");
      return;
    }

    setLoadingGiftCardLookup(true);
    setGiftCardError(null);
    setGiftCardLookupResult(null);

    try {
      const result = await getGiftCardDetails(giftCardCode.trim());
      
      if (result.success && result.giftCard) {
        setGiftCardLookupResult(result.giftCard);
      } else {
        setGiftCardError(result.message || "Gift card not found or invalid");
      }
    } catch (error) {
      console.error('Error looking up gift card:', error);
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

  // Load payment data when tab changes
  React.useEffect(() => {
    if (activeTab === 3 && user && !passwordVerified) {
      setShowPasswordVerification(true);
    } else if (activeTab === 3 && passwordVerified) {
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
        {activeTab === 0 ? (
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
                onClick={async () => {
                  if (!window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) return;
                  if (!user) return;
                  try {
                    // Delete Firestore user document
                    const docRef = doc(firestore, "users", user.uid);
                    await updateDoc(docRef, { deleted: true }); // Optional: mark as deleted before actual delete
                    await (await import("firebase/firestore")).deleteDoc(docRef);

                    // Delete Firebase Auth user
                    await user.delete();

                    // Sign out and redirect
                    await auth.signOut();
                    navigate("/");
                  } catch (err: any) {
                    alert("Failed to delete account: " + (err.message || err));
                  }
                }}
              >
                Delete Account
              </button>
            </div>
          </div>
        ) : activeTab === 1 ? (
          <div className="profile-events">
            <h3>Past Events & Bookings</h3>
            
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
        ) : activeTab === 2 ? (
          <div className="profile-membership">
            <h3>Membership</h3>
            <div className="membership-content">
              <div className="membership-status">
                <h4>Membership Status</h4>
                <p>You are not currently a member.</p>
                <p>Join our membership program to get monthly inflatables delivered to your home with exclusive benefits!</p>
              </div>
              
              <div className="membership-benefits">
                <h4>Membership Benefits</h4>
                <ul>
                  <li>Monthly inflatable delivery to your home</li>
                  <li>25% off all other reservations</li>
                  <li>No setup or takedown hassle</li>
                  <li>Priority booking for special events</li>
                  <li>Fresh new inflatable each month</li>
                </ul>
              </div>
              
              <div className="membership-action">
                <button 
                  className="btn-become-member"
                  onClick={() => {
                    navigate('/home');
                    // We'll add logic to auto-open membership popup later
                  }}
                >
                  Become a Member
                </button>
              </div>
            </div>
          </div>
        ) : (
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
                                padding: '0.5rem',
                                borderBottom: '1px solid #eee'
                              }}>
                                <div>
                                  <div style={{ fontWeight: 'bold' }}>{transaction.description}</div>
                                  <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                    {new Date(transaction.createdAt).toLocaleDateString()}
                                  </div>
                                </div>
                                <div style={{
                                  color: transaction.type === 'withdrawal' ? '#dc3545' : '#28a745',
                                  fontWeight: 'bold'
                                }}>
                                  {transaction.type === 'withdrawal' ? '-' : '+'}${transaction.amount.toFixed(2)}
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
                          <p>Add funds to your wallet to save your first payment method!</p>
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
                      <h4>{section.title || `Section ${index + 1}`}</h4>
                      <div className="section-status">
                        {section.isInitialed ? (
                          <span className="initialed">
                            ✓ Initialed
                            {section.initialedAt && (
                              <small> on {new Date(section.initialedAt).toLocaleDateString()}</small>
                            )}
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
          console.log(`Successfully added $${amount} to wallet via ${method}`);
          
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

    </>
  );
}
