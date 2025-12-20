import React, { useState, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { useNavigate, useSearchParams } from "react-router";
import { LocalStorageDebugger } from "../components/LocalStorageDebugger";
import { RouterNav } from "../components/RouterNav";
import { SearchBar } from "../components/SearchBar";
import { GooglePlacesAutocomplete } from "../components/GooglePlacesAutocomplete";
import { MobileBottomMenu } from "../components/MobileBottomMenu";
import MembershipCheckout from "../components/MembershipCheckout";
import ContractSigning from "../components/ContractSigning";
import { onAuthStateChanged } from "firebase/auth";
import { auth, firestore } from "../components/FirebaseConfig";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { getDatabase, ref, push, set, get } from "firebase/database";
import type { User as FirebaseUser } from "firebase/auth";
import type { CartItem } from "../components/CartSidebar";
import { useInflateables } from "../hooks/useInflateables";
import { useCartSettings } from "../hooks/useCartSettings";
import { useCategories } from "../hooks/useCategories";
import { generateUniqueGiftCardCode, createGiftCardInDatabase, useDiscounts } from "../hooks/useDiscounts";
import { sendOrderConfirmationEmail, createGiftCardInfoFromCart, OrderConfirmationEmailData, GiftCardInfo } from "../utils/emailUtils";
import { scheduleCartReminderEmail, scheduleDepositReminderEmail, scheduleEventConfirmationEmail, schedulePostEventThanksEmail, scheduleRebookingReminderEmail } from "../utils/backendEmailService";
import { clearCartAbandonment } from "../utils/cartAbandonmentTracker";
import { notifications } from '@mantine/notifications';
import { Notifications } from '@mantine/notifications';
import { MantineProvider } from '@mantine/core';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { 
  saveBookingData, 
  loadBookingData, 
  saveContractData, 
  loadContractData,
  loadContractByOrderID,
  updateBookingStatus,
  updateContractStatus,
  generateOrderID,
  generateContractID,
  isBookingWithinTwoDays,
  determineInitialBookingStatus,
  updateBookingStatusBasedOnPayment,
  getIncompleteBookingsForUser,
  shouldDeferBooking,
  deferBooking,
  getUserWallet,
  addWalletTransaction
} from "../utils/databaseUtils";
import type { BookingData, ContractData, UserWallet } from "../utils/databaseUtils";

// Define ContractMetadata type for legacy bookings
interface ContractMetadata {
  contractId: string;
  orderId?: string;
  userId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  eventDate?: string;
  eventEndDate?: string;
  deliveryDate?: string;
  deliveryTime?: string;
  deliveryAddress?: string;
  contractStatus?: 'pending' | 'signed' | 'completed';
  status?: 'deferred' | 'pending' | 'deposited' | 'confirmed' | 'completed' | 'cancelled';
  deposit?: number;
  customerInfo?: {
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
  };
  contractDate?: string;
  createdAt?: string;
  agreementSections?: any[];
  signature?: {
    signatureData: string;
    signedAt: string;
    signatureMethod: string;
  };
  initials?: string;
  orderDetails?: any;
}
import { checkItemAvailability, type ItemAvailability } from "../utils/availabilityUtils";
import '@mantine/notifications/styles.css';
import '../styles/notifications-center.css';
import '../styles/checkout-buttons.css';
import '../styles/checkout.css';

export function meta() {
  return [
    { title: "Checkout - Jump CSRA Party Rental" },
    { name: "description", content: "Complete your party rental order" },
  ];
}

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const inflateables = useInflateables();
  const categories = useCategories(inflateables);
  
  // Check if this is a membership checkout
  const isMembershipCheckout = searchParams.get('membership') === 'jump-club';
  
  // Cart sidebar options - use persistent cart settings
  const cartSettings = useCartSettings();
  
  const [calendarDateRange, setCalendarDateRange] = useState<[Date | null, Date | null]>([null, null]);

  // Helper function to get product image from inflateables data
  const getProductImage = (productName: string): string => {
    if (!productName) {
      console.warn('getProductImage: No product name provided');
      return 'https://storage.googleapis.com/pppro-b060e.firebasestorage.app/inflateables/default.webp';
    }
    
    const product = inflateables.find(item => 
      item.name && item.name.toLowerCase() === productName.toLowerCase()
    );
    
    if (!product) {
      console.warn(`getProductImage: Product "${productName}" not found in inflateables data`);
      return 'https://storage.googleapis.com/pppro-b060e.firebasestorage.app/inflateables/default.webp';
    }
    
    if (!product.img) {
      console.warn(`getProductImage: Product "${productName}" has no image path`);
      return 'https://storage.googleapis.com/pppro-b060e.firebasestorage.app/inflateables/default.webp';
    }
    
    return product.img;
  };

  // Function to remove item from cart
  const removeItemFromCart = (indexToRemove: number) => {
    const updatedCart = cart.filter((_, index) => index !== indexToRemove);
    setCart(updatedCart);
    
    // Update localStorage
    if (updatedCart.length === 0) {
      localStorage.removeItem('cart');
    } else {
      localStorage.setItem('cart', JSON.stringify(updatedCart));
    }
  };

  // Function to get available quantity for a cart item (for party essentials)
  const getAvailableQuantityForCartItem = (item: CartItem, cartIndex: number) => {
    console.log('🔍 [QUANTITY DEBUG] Getting available quantity for:', {
      itemName: item.name,
      category: item.category,
      cartIndex,
      currentQuantity: item.quantity
    });
    
    if (item.category !== 'party-essentials') {
      console.log('🔍 [QUANTITY DEBUG] Not a party essential, returning 10');
      return 10; // Default for non-party essentials
    }
    
    // Use the availability system if dates are selected
    const startDate = calendarDateRange[0];
    const endDate = startDate && cartSettings.duration ? calculateEndDate(startDate, cartSettings.duration) : null;
    
    console.log('🔍 [QUANTITY DEBUG] Date info:', {
      startDate,
      endDate,
      duration: cartSettings.duration,
      calendarDateRange
    });
    
    if (startDate && endDate) {
      const availability = itemAvailability.get(item.name);
      console.log('🔍 [QUANTITY DEBUG] Availability data:', {
        itemName: item.name,
        availability,
        availabilityMapSize: itemAvailability.size,
        availabilityKeys: Array.from(itemAvailability.keys())
      });
      
      if (availability) {
        // Ensure minimum of current item quantity if already in cart
        const currentQuantity = item.quantity || 1;
        const availableQuantity = availability.availableQuantity || 0;
        const result = Math.max(currentQuantity, availableQuantity);
        
        console.log('🔍 [QUANTITY DEBUG] Availability calculation:', {
          currentQuantity,
          availableQuantity,
          result,
          fullAvailability: availability
        });
        
        return result;
      } else {
        console.log('🔍 [QUANTITY DEBUG] No availability data found for item:', item.name);
      }
    } else {
      console.log('🔍 [QUANTITY DEBUG] No valid dates or duration');
    }
    
    // Default if no availability data - ensure minimum of current quantity
    const fallback = Math.max(item.quantity || 1, 10);
    console.log('🔍 [QUANTITY DEBUG] Using fallback quantity:', fallback);
    return fallback;
  };

  // Function to update cart item quantity
  const updateCartItemQuantity = (cartIndex: number, newQuantity: number) => {
    const item = cart[cartIndex];
    console.log('🔍 [UPDATE DEBUG] Updating cart item quantity:', {
      cartIndex,
      newQuantity,
      itemName: item?.name,
      itemCategory: item?.category
    });
    
    if (!item || item.category !== 'party-essentials') {
      console.log('🔍 [UPDATE DEBUG] Item not found or not party essential, skipping');
      return;
    }

    const maxAvailable = getAvailableQuantityForCartItem(item, cartIndex);
    console.log('🔍 [UPDATE DEBUG] Max available check:', {
      maxAvailable,
      newQuantity,
      exceedsMax: newQuantity > maxAvailable
    });
    
    if (newQuantity > maxAvailable) {
      notifications.show({
        title: 'Quantity Exceeded',
        message: `Only ${maxAvailable} ${item.name}${maxAvailable !== 1 ? 's' : ''} available for your selected dates.`,
        color: 'red',
      });
      return;
    }

    const updatedCart = [...cart];
    updatedCart[cartIndex] = { ...item, quantity: newQuantity };
    console.log('🔍 [UPDATE DEBUG] Setting updated cart, current step should remain:', currentStep);
    setCart(updatedCart);
    
    // Update localStorage
    localStorage.setItem('cart', JSON.stringify(updatedCart));
    
    notifications.show({
      title: 'Quantity Updated',
      message: `${item.name} quantity updated to ${newQuantity}`,
      color: 'green',
    });
  };

  // Checkout-specific state
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [deliveryCost, setDeliveryCost] = useState<number>(0);
  const [deliverySkipped, setDeliverySkipped] = useState<boolean>(false); // Track if delivery was skipped for dev
  const [contractSigned, setContractSigned] = useState<boolean>(false);
  const [showContract, setShowContract] = useState<boolean>(false);
  const [calculatingDistance, setCalculatingDistance] = useState<boolean>(false);
  const [failedAddresses, setFailedAddresses] = useState<Set<string>>(new Set()); // Track failed calculation attempts
  
  // Payment state
  const [paymentCompleted, setPaymentCompleted] = useState<boolean>(false);
  const [paymentId, setPaymentId] = useState<string>("");
  const [processingPayment, setProcessingPayment] = useState<boolean>(false);
  const [pendingBookingId, setPendingBookingId] = useState<string>("");
  const [requiresPhoneCall, setRequiresPhoneCall] = useState<boolean>(false);
  const [loadingBookingFromUrl, setLoadingBookingFromUrl] = useState<boolean>(false);
  const [bookingLoadedFromUrl, setBookingLoadedFromUrl] = useState<boolean>(false);
  const [paymentType, setPaymentType] = useState<'full' | 'deposit'>('full');
  const [actualAmountPaid, setActualAmountPaid] = useState<number | null>(null);
  const [isDeferredBooking, setIsDeferredBooking] = useState<boolean>(false);
  
  // Store completed order data for display after cart is cleared
  const [completedOrderCart, setCompletedOrderCart] = useState<CartItem[]>([]);

  // Wallet State
  const [userWallet, setUserWallet] = useState<UserWallet | null>(null);
  const [useWalletFirst, setUseWalletFirst] = useState<boolean>(false);
  const [walletAppliedAmount, setWalletAppliedAmount] = useState<number>(0);
  
  // Checkout step management - dynamically determine starting step
  type CheckoutStep = 'order-summary' | 'delivery' | 'quick-add-totals' | 'contract' | 'payment';
  
  // Initialize starting step based on cart contents
  const getInitialStep = (): CheckoutStep => {
    const hasInflateables = cart.some(item => !item.isGiftCard && !item.isMembership);
    console.log('🔍 [INITIAL STEP DEBUG] Determining initial step:', {
      cartLength: cart.length,
      hasInflateables,
      cartItems: cart.map(item => ({ name: item.name, isGiftCard: item.isGiftCard, isMembership: item.isMembership })),
      initialStep: hasInflateables ? 'quick-add-totals' : 'order-summary'
    });
    return hasInflateables ? 'quick-add-totals' : 'order-summary';
  };
  
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('quick-add-totals'); // Default to first step, will be corrected when cart loads
  const [visitedSteps, setVisitedSteps] = useState<Set<CheckoutStep>>(() => new Set(['quick-add-totals'])); // Default to first step

  // Update step when cart loads from localStorage
  useEffect(() => {
    if (!loading && user) {
      const correctStep = getInitialStep();
      console.log('🔄 [STEP UPDATE] Setting correct initial step:', {
        currentStep,
        correctStep,
        cartLength: cart.length,
        visitedStepsSize: visitedSteps.size
      });
      
      // Always set the correct step when cart is first loaded
      if (visitedSteps.size === 1 && (visitedSteps.has('quick-add-totals') || visitedSteps.has('order-summary'))) {
        setCurrentStep(correctStep);
        setVisitedSteps(new Set([correctStep]));
      }
    }
  }, [loading, user, cart.length]); // React to cart length changes to detect when cart is loaded
  
  // Google Places validation state
  const [googlePlacesAddresses, setGooglePlacesAddresses] = useState<Set<string>>(new Set());
  const addressInputRef = useRef<HTMLInputElement>(null);
  const [isSelectingGooglePlace, setIsSelectingGooglePlace] = useState<boolean>(false);
  
  // Last-minute additions state
  const [lastMinuteAdditions, setLastMinuteAdditions] = useState<{[key: string]: number}>({});
  const [showQuantityModal, setShowQuantityModal] = useState<string | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  
  // Availability tracking state
  const [itemAvailability, setItemAvailability] = useState<Map<string, ItemAvailability>>(new Map());
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  
  // Email state for promotional gift cards
  const [promotionalGiftCardEmail, setPromotionalGiftCardEmail] = useState<string>("");
  
  // Contract state variables
  const [customerInitials, setCustomerInitials] = useState<string>("");
  const [typedSignature, setTypedSignature] = useState<string>("");
  const [contractSections, setContractSections] = useState<any[]>([]);
  const [contractMetadata, setContractMetadata] = useState<any>(null);
  
  // Contract helper function
  const allSectionsInitialed = (): boolean => {
    return contractSections.length > 0 && contractSections.every(section => section.initialed);
  };
  
  // Helper function to get the current cart for display
  // Uses completed order cart if payment is done, otherwise uses active cart
  const getDisplayCart = (): CartItem[] => {
    return paymentCompleted && completedOrderCart.length > 0 ? completedOrderCart : cart;
  };

  // Helper function to calculate totals for display
  // Uses the display cart (either active or completed order)
  const getDisplayCartTotal = (): number => {
    const displayCart = getDisplayCart();
    const durationMultiplier = cartSettings.duration ? durationMultipliers[cartSettings.duration] || 1.0 : 1.0;
    return displayCart.reduce((sum, item) => {
      if (item.isGiftCard) {
        return sum + (item.giftCardValue || item.price) * item.quantity;
      } else {
        return sum + item.price * item.quantity * durationMultiplier;
      }
    }, 0);
  };

  // Discount management
  const { discounts, calculateDiscount, getActiveDiscount } = useDiscounts();

  // Base location for distance calculation
  const BASE_LOCATION = "410 Carolina Springs Rd, North Augusta, SC 29841";

  // Cart settings helper functions and constants
  const locationOptions = [
    "Personal home",
    "Someone else's home",
    "Business",
    "Park",
    "Church/school",
  ];

  const getAvailableDeliveryTimes = () => {
    const timePrices: Record<string, number> = {
      "8am": 40,
      "9am": 30,
      "10am": 20,
      "11am": 10,
      "12pm": 0,
    };
    
    const allTimeOptions = [
      { value: "8am", label: "8am (+$40)", hour: 8, price: timePrices["8am"] },
      { value: "9am", label: "9am (+$30)", hour: 9, price: timePrices["9am"] },
      { value: "10am", label: "10am (+$20)", hour: 10, price: timePrices["10am"] },
      { value: "11am", label: "11am (+$10)", hour: 11, price: timePrices["11am"] },
      { value: "12pm", label: "12pm", hour: 12, price: timePrices["12pm"] }
    ];
    
    // If no date selected or not booking for today, show all options
    if (!calendarDateRange[0]) {
      return allTimeOptions;
    }
    
    const bookingDate = new Date(calendarDateRange[0]);
    const today = new Date();
    
    // Reset time for accurate date comparison
    const bookingDateOnly = new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    // If booking is not for today, show all options
    if (bookingDateOnly.getTime() !== todayOnly.getTime()) {
      return allTimeOptions;
    }
    
    // Booking is for today - filter times that are at least 2 hours from now
    const currentHour = today.getHours();
    const currentMinutes = today.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinutes;
    const twoHoursFromNow = currentTimeInMinutes + 120; // 2 hours = 120 minutes
    
    return allTimeOptions.filter(timeOption => {
      const deliveryTimeInMinutes = timeOption.hour * 60;
      return deliveryTimeInMinutes >= twoHoursFromNow;
    });
  };

  // Check if all wet/dry selections are complete
  const areWetDrySelectionsComplete = () => {
    return cart.every((item, idx) => {
      // Skip items that don't need wet/dry selection
      if (item.isGiftCard || item.isMembership || item.wetDry !== "Wet/Dry") {
        return true;
      }
      // Check if this item has a wet/dry selection (default to "Dry" if not set)
      const selection = cartSettings.wetDrySelections[idx] || "Dry";
      return selection === "Wet" || selection === "Dry";
    });
  };

  // Checkout step management functions
  const getStepOrder = (): CheckoutStep[] => {
    const hasInflateables = cart.some(item => !item.isGiftCard && !item.isMembership);
    
    if (!hasInflateables) {
      // Gift cards and/or memberships only: skip delivery, contract, and quick-add entirely
      return ['order-summary', 'payment'];
    } else {
      // Has inflateables: new order - quick-add first, then delivery, then order-summary, contract, payment
      return ['quick-add-totals', 'delivery', 'order-summary', 'contract', 'payment'];
    }
  };
  
  const stepOrder = getStepOrder();
  
  const stepTitles = {
    'order-summary': 'Cart Summary',
    'delivery': 'Delivery',
    'quick-add-totals': 'Cart & Essentials',
    'contract': 'Contract',
    'payment': 'Payment'
  };

  const goToNextStep = async () => {
    const currentStepOrder = getStepOrder();
    const currentIndex = currentStepOrder.indexOf(currentStep);
    if (currentIndex < currentStepOrder.length - 1) {
      // Validate current step before allowing progression
      if (canProceedFromCurrentStep()) {
        const nextStep = currentStepOrder[currentIndex + 1];
        
        // Special handling for gift card-only and membership-only orders moving to payment
        if (nextStep === 'payment' && !pendingBookingId) {
          const onlyGiftCardsAndMemberships = cart.every(item => item.isGiftCard || item.isMembership);
          if (onlyGiftCardsAndMemberships) {
            console.log('🎁 Gift card/membership-only order moving to payment - creating booking first');
            try {
              // Always set status to confirmed for gift card/membership-only orders
              const initialStatus = 'confirmed';
              console.log(`Creating gift card/membership booking - Status: ${initialStatus}`);
              const result = await saveBookingAndContract(initialStatus);
              if (result) {
                const { orderID } = result;
                setPendingBookingId(orderID);
                setContractSigned(true);
                console.log('✅ Gift card/membership booking created successfully:', orderID);
              } else {
                alert("Error creating booking. Please try again.");
                return;
              }
            } catch (error) {
              console.error("Error creating gift card/membership booking:", error);
              alert("Error creating booking. Please try again.");
              return;
            }
          }
        }
        
        setCurrentStep(nextStep);
        // Track that this step has been visited
        setVisitedSteps(prev => new Set([...prev, nextStep]));
      }
    }
  };

  const goToPreviousStep = () => {
    const currentStepOrder = getStepOrder();
    const currentIndex = currentStepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(currentStepOrder[currentIndex - 1]);
    }
  };

  // Validation functions for step progression
  const canProceedFromCurrentStep = () => {
    const hasInflateables = cart.some(item => !item.isGiftCard && !item.isMembership);
    
    switch (currentStep) {
      case 'order-summary':
        // Must have items in cart
        if (cart.length === 0) return false;
        // If has inflateables, must have all event settings completed (except location, which is now in delivery step)
        if (hasInflateables) {
          return cartSettings.duration && cartSettings.surface && cartSettings.deliveryTime;
        }
        return true;
      case 'delivery':
        // Must have delivery address and location type
        return deliveryAddress.trim().length > 0 && cartSettings.location.trim().length > 0;
      case 'quick-add-totals':
        // Must have items in cart and all wet/dry selections complete
        return cart.length > 0 && areWetDrySelectionsComplete();
      case 'contract':
        return contractSigned; // Allow progression when contract is signed
      default:
        return true;
    }
  };

  const getNextStepButtonText = () => {
    const hasInflateables = cart.some(item => !item.isGiftCard && !item.isMembership);
    
    switch (currentStep) {
      case 'quick-add-totals':
        return 'Continue to Delivery';
      case 'delivery':
        return 'Continue to Order Summary';
      case 'order-summary':
        return 'Proceed to Contract';
      case 'contract':
        return 'Proceed to Payment';
      default:
        return 'Next';
    }
  };

  const canShowNextButton = () => {
    const hasInflateables = cart.some(item => !item.isGiftCard && !item.isMembership);
    
    const result = (() => {
      switch (currentStep) {
        case 'order-summary':
          // Must have items in cart
          if (cart.length === 0) return false;
          // Must have all wet/dry selections complete
          if (!areWetDrySelectionsComplete()) return false;
          // If has inflateables, must have all event settings completed (except location, which is now in delivery step)
          if (hasInflateables) {
            return cartSettings.duration && cartSettings.surface && cartSettings.deliveryTime;
          }
          return true;
        case 'delivery':
          // Must have delivery address and location type
          return deliveryAddress.trim().length > 0 && cartSettings.location.trim().length > 0;
        case 'quick-add-totals':
          // Must have items in cart
          return cart.length > 0;
        default:
          return false;
      }
    })();
    
    // Debug logging
    if (currentStep === 'delivery') {
      console.log('canShowNextButton DEBUG:', {
        currentStep,
        deliveryAddress: deliveryAddress.trim(),
        deliveryCost,
        deliverySkipped,
        result
      });
    }
    
    return result;
  };

  // Handle cart changes and adjust current step if needed
  useEffect(() => {
    const currentStepOrder = getStepOrder();
    
    // If current step is not in the new step order, adjust to a valid step
    if (!currentStepOrder.includes(currentStep)) {
      // If we're on delivery or contract but cart only has gift cards/memberships, skip to payment
      if (currentStep === 'delivery' || currentStep === 'contract') {
        const hasInflateables = cart.some(item => !item.isGiftCard && !item.isMembership);
        if (!hasInflateables) {
          console.log('Gift card/membership-only cart detected, skipping to payment from', currentStep);
          setCurrentStep('payment');
          setVisitedSteps(prev => new Set([...prev, 'payment']));
        }
      }
    }
  }, [cart, currentStep]);

  // Handle payment type when cart changes
  useEffect(() => {
    // If cart only has gift cards, force full payment
    if (!hasInflatables() && paymentType === 'deposit') {
      setPaymentType('full');
    }
  }, [cart, paymentType]);

  // Load booking from URL parameter for payment completion
  const loadBookingFromUrl = async (bookingId: string) => {
    setLoadingBookingFromUrl(true);
    
    try {
      // Try to load as orderID first (new structure)
      let bookingData = await loadBookingData(bookingId);
      let contractData: ContractData | null = null;
      
      if (bookingData) {
        // New structure: load contract by orderID
        contractData = await loadContractByOrderID(bookingId);
        
        if (!contractData) {
          throw new Error("Contract not found for booking");
        }
        
        // Verify booking is available for payment (deferred or pending)
        if (bookingData.status !== 'deferred' && bookingData.status !== 'pending' && bookingData.status !== 'deposited') {
          throw new Error("Booking is not available for payment");
        }
        
        // Set state from new structure
        setPendingBookingId(bookingId); // This is now orderID
        setContractSigned(true);
        setBookingLoadedFromUrl(true);
        
        // Populate customer initials and signature from contract data
        if (contractData.initials) {
          setCustomerInitials(contractData.initials);
        }
        
        if (contractData.signature?.signatureData) {
          setTypedSignature(contractData.signature.signatureData);
        }
        
        // Set contract sections from contract data
        if (contractData.agreementSections) {
          setContractSections(contractData.agreementSections);
        }
        
        console.log("✅ Booking loaded successfully (new structure):", bookingId);
        
      } else {
        // Fallback: try loading from old structure
        const database = getDatabase();
        const contractRef = ref(database, `contracts/${bookingId}`);
        const snapshot = await get(contractRef);
        
        if (!snapshot.exists()) {
          throw new Error("Booking not found");
        }
        
        const legacyBookingData = snapshot.val() as ContractMetadata;
        
        // Verify booking is available for payment (deferred or pending)
        if (legacyBookingData.status !== 'deferred' && legacyBookingData.status !== 'pending' && legacyBookingData.status !== 'deposited') {
          throw new Error("Booking is not available for payment");
        }
        
        // Load legacy booking data into checkout state
        setContractMetadata(legacyBookingData);
        setPendingBookingId(bookingId);
        setContractSigned(true);
        setBookingLoadedFromUrl(true);
        
        // Populate customer initials from legacy booking data
        if (legacyBookingData.initials) {
          setCustomerInitials(legacyBookingData.initials);
        }
        
        // Populate signature from legacy booking data
        if (legacyBookingData.signature?.signatureData) {
          setTypedSignature(legacyBookingData.signature.signatureData);
        }
        
        // Set contract sections from legacy booking data
        if (legacyBookingData.agreementSections) {
          setContractSections(legacyBookingData.agreementSections);
        }
        
        console.log("✅ Booking loaded successfully (legacy structure):", bookingId);
      }
      
      // Navigate directly to payment step
      setCurrentStep('payment');
      
      notifications.show({
        title: '✅ Booking Loaded',
        message: 'Your booking has been loaded. You can now complete payment.',
        color: 'green',
        autoClose: 5000,
      });
      
    } catch (error) {
      console.error("Error loading booking:", error);
      notifications.show({
        title: '❌ Error Loading Booking',
        message: 'Could not load booking. Please check the link or contact support.',
        color: 'red',
        autoClose: 8000,
      });
      navigate('/');
    } finally {
      setLoadingBookingFromUrl(false);
    }
  };

  // Check for booking ID in URL parameters on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('booking');
    
    if (bookingId && !bookingLoadedFromUrl) {
      loadBookingFromUrl(bookingId);
    }
  }, [bookingLoadedFromUrl]);

  // Track deliveryAddress state changes for debugging
  useEffect(() => {
    console.log('🔄 DELIVERY ADDRESS STATE CHANGED:', deliveryAddress);
  }, [deliveryAddress]);

  // Handle contract completion - called by ContractSigning component
  const handleContractCompletion = async (contractData: { 
    sections: any[], 
    signature: string, 
    initials: string 
  }) => {
    console.log('🔥 Contract completed by component, proceeding with booking', contractData);
    
    try {
      // Determine initial booking status based on event date
      const eventDateString = calendarDateRange[0]?.toLocaleDateString() || '';
      const isWithinTwoDays = isCurrentBookingWithinTwoDays();
      
      // Check if cart only contains gift cards and/or memberships
      const onlyGiftCards = cart.every(item => item.isGiftCard || item.isMembership);
      
      // Determine initial status - deferred if within 2 days AND has inflateables, otherwise proceed to payment
      const needsPhoneCall = isWithinTwoDays && !onlyGiftCards;
      const initialStatus = needsPhoneCall ? 'deferred' : 'pending';
      
      console.log(`Event date: ${eventDateString}, Within 2 days: ${isWithinTwoDays}, Only gift cards: ${onlyGiftCards}, Initial status: ${initialStatus}`);
      
      // Save contract and booking with determined status
      const result = await saveBookingAndContract(initialStatus, 'full', 0, undefined, undefined, contractData);
      if (result) {
        const { orderID, contractID } = result;
        setPendingBookingId(orderID); // Store orderID for payment processing
        
        // Use flushSync to ensure state update completes before navigation
        flushSync(() => {
          setContractSigned(true);
        });
        
        // Set phone call requirement flag - only if within 2 days AND has inflateables
        setRequiresPhoneCall(needsPhoneCall);
        
        if (needsPhoneCall) {
          console.log('📞 Booking within 2 days with inflateables - saved as deferred, phone call required');
        } else if (isWithinTwoDays && onlyGiftCards) {
          console.log('🎁 Booking within 2 days but only gift cards - proceeding to payment');
        } else {
          console.log('✅ Booking not urgent - proceeding to payment');
        }
        
        // Direct navigation to payment step to avoid state dependency issues
        setCurrentStep('payment');
        setVisitedSteps(prev => new Set([...prev, 'payment']));
        
        console.log('🚀 Navigated directly to payment step');
      } else {
        alert("Error saving booking. Please try again.");
      }
    } catch (error) {
      console.error("Error completing contract:", error);
      alert("Error saving booking. Please try again.");
    }
  };

  // Calculate driving distance using OSRM (free routing service)
  const calculateDeliveryDistance = async (destinationAddress: string) => {
    console.log('🚚 DELIVERY COST CALCULATION STARTED:');
    console.log('  - Function called with destinationAddress:', destinationAddress);
    console.log('  - Current deliveryAddress state:', deliveryAddress);
    console.log('  - Current input field value:', addressInputRef.current?.value);
    console.log('  - Base location:', BASE_LOCATION);
    console.log('  - Known Google Places addresses:', Array.from(googlePlacesAddresses));
    
    setCalculatingDistance(true);
    try {
      // First, geocode both addresses
      console.log('  📍 GEOCODING STEP:');
      console.log('    - Base location for geocoding:', BASE_LOCATION);
      console.log('    - Destination address for geocoding:', destinationAddress);
      console.log('    - Base geocoding URL:', `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(BASE_LOCATION)}`);
      console.log('    - Destination geocoding URL:', `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(destinationAddress)}`);
      
      const [baseResponse, destResponse] = await Promise.all([
        fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(BASE_LOCATION)}`),
        fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(destinationAddress)}`)
      ]);

      const [baseData, destData] = await Promise.all([
        baseResponse.json(),
        destResponse.json()
      ]);
      
      console.log('    - Base geocoding results:', baseData);
      console.log('    - Destination geocoding results:', destData);
      console.log('    - Base results count:', baseData.length, '| Destination results count:', destData.length);

      if (baseData.length === 0 || destData.length === 0) {
        console.warn('⚠️ Geocoding failed - Base results:', baseData.length, 'Destination results:', destData.length);
        
        // Add this address to failed addresses to prevent infinite retries
        setFailedAddresses(prev => new Set(prev).add(destinationAddress));
        
        notifications.show({
          title: '⚠️ Address Verification',
          message: 'Please enter a complete address with city and state (e.g., "123 Main St, Augusta, GA 30901")',
          color: 'orange',
          autoClose: 5000,
        });
        return;
      }

      const baseLat = parseFloat(baseData[0].lat);
      const baseLon = parseFloat(baseData[0].lon);
      const destLat = parseFloat(destData[0].lat);
      const destLon = parseFloat(destData[0].lon);

      console.log('  📍 COORDINATE EXTRACTION:');
      console.log('    - Base coordinates:', { lat: baseLat, lon: baseLon });
      console.log('    - Destination coordinates:', { lat: destLat, lon: destLon });
      console.log('    - Base location name:', baseData[0].display_name);
      console.log('    - Destination location name:', destData[0].display_name);

      // Use OSRM API for driving distance calculation
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${baseLon},${baseLat};${destLon},${destLat}?overview=false`;
      console.log('  🛣️  OSRM ROUTING REQUEST:');
      console.log('    - OSRM URL:', osrmUrl);
      
      const routeResponse = await fetch(osrmUrl);
      const routeData = await routeResponse.json();

      console.log('    - OSRM response status:', routeResponse.status);
      console.log('    - OSRM route data:', routeData);
      console.log('    - Number of routes found:', routeData.routes?.length || 0);

      if (routeData.routes && routeData.routes.length > 0) {
        const distanceMeters = routeData.routes[0].distance;
        const distanceMiles = distanceMeters * 0.000621371; // Convert meters to miles
        const cost = Math.round(distanceMiles * 6); // $6 per mile, rounded
        
        console.log('  💰 COST CALCULATION:');
        console.log('    - Distance in meters:', distanceMeters);
        console.log('    - Distance in miles:', distanceMiles.toFixed(2));
        console.log('    - Rate per mile: $6');
        console.log('    - Raw cost calculation:', distanceMiles * 6);
        console.log('    - Final rounded cost: $' + cost);
        console.log('    - Address used for calculation:', destinationAddress);
        console.log('    - Is this a Google Places address?:', googlePlacesAddresses.has(destinationAddress));
        
        setDeliveryCost(cost);
        notifications.show({
          title: '🚚 Delivery Cost Calculated',
          message: `Distance: ${distanceMiles.toFixed(1)} miles • Cost: $${cost}`,
          color: 'blue',
          autoClose: 5000,
        });
      } else {
        throw new Error("Could not calculate route");
      }
    } catch (error) {
      console.error('❌ DELIVERY COST CALCULATION ERROR:', error);
      console.log('  - Failed with address:', destinationAddress);
      console.log('  - Current deliveryAddress state:', deliveryAddress);
      console.log('  - Current input field value:', addressInputRef.current?.value);
      notifications.show({
        title: '❌ Delivery Calculation Error',
        message: 'Could not calculate delivery distance. Please verify the address and try again.',
        color: 'red',
        autoClose: 7000,
      });
    } finally {
      console.log('🏁 DELIVERY COST CALCULATION FINISHED');
      setCalculatingDistance(false);
    }
  };

  // Handle Google Places address selection
  const handlePlaceSelected = (place: google.maps.places.PlaceResult) => {
    // Only accept valid places with formatted address and location
    if (place.formatted_address && place.geometry?.location && place.place_id) {
      const googleAddress = place.formatted_address;
      
      console.log('🎯 GOOGLE PLACES SELECTION:');
      console.log('  - Raw place object:', place);
      console.log('  - Formatted address from Google:', googleAddress);
      console.log('  - Current input field value:', addressInputRef.current?.value);
      console.log('  - Current deliveryAddress state:', deliveryAddress);
      
      // Set flag to prevent manual input from overriding this selection
      setIsSelectingGooglePlace(true);
      
      // Add this address to our set of valid Google Places addresses
      setGooglePlacesAddresses(prev => new Set(prev).add(googleAddress));
      
      // Update delivery address with the Google address using flushSync for immediate update
      flushSync(() => {
        setDeliveryAddress(googleAddress);
      });
      
      // Also update the input field directly to ensure it shows the Google address
      if (addressInputRef.current) {
        addressInputRef.current.value = googleAddress;
      }
      
      console.log('  - Called setDeliveryAddress with flushSync:', googleAddress);
      console.log('  - Updated input field to:', googleAddress);
      console.log('  - Immediate deliveryAddress state is now:', deliveryAddress);
      
      // Double-check that the state was updated properly
      if (deliveryAddress !== googleAddress) {
        console.warn('  - WARNING: State did not update immediately!');
        console.log('  - Expected:', googleAddress);
        console.log('  - Actual:', deliveryAddress);
        // Try setting it again as fallback
        setDeliveryAddress(googleAddress);
      }
      
      // Clear the flag after a short delay
      setTimeout(() => {
        setIsSelectingGooglePlace(false);
      }, 100);
      
      // Automatically calculate distance when a place is selected
      calculateDeliveryDistance(googleAddress);
    }
  };

  // Handle manual address input change
  const handleAddressChange = (value: string) => {
    console.log('📝 MANUAL ADDRESS CHANGE:');
    console.log('  - Typed value:', value);
    console.log('  - Previous deliveryAddress state:', deliveryAddress);
    console.log('  - Current input field value:', addressInputRef.current?.value);
    console.log('  - Is currently selecting Google Place?:', isSelectingGooglePlace);
    
    // Don't override if we're currently selecting a Google Place
    if (isSelectingGooglePlace) {
      console.log('  - BLOCKED: Google Place selection in progress, ignoring manual change');
      return;
    }
    
    // Clear the failed addresses set when user changes the address
    // This allows them to retry calculation with a corrected address
    if (value !== deliveryAddress) {
      setFailedAddresses(new Set());
      setDeliveryCost(0); // Reset delivery cost for new address
    }
    
    setDeliveryAddress(value);
    
    console.log('  - Updated deliveryAddress to:', value);
  };

  // Authentication guard
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u) {
        // User not logged in, redirect to login
        navigate("/");
        return;
      }
      setUser(u);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  // Load user profile data
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user) return;
      
      try {
        const userDocRef = doc(firestore, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
        }
      } catch (error) {
        console.error("Error loading user profile:", error);
      }
    };

    loadUserProfile();
  }, [user]);

  // Check for resumed booking and load it
  useEffect(() => {
    const checkResumedBooking = async () => {
      if (!user) return;
      
      const resumeBookingId = localStorage.getItem('resumeBookingId');
      if (resumeBookingId && !pendingBookingId) {
        try {
          console.log('🔄 [RESUME] Loading resumed booking:', resumeBookingId);
          const booking = await loadBookingData(resumeBookingId);
          
          if (booking && booking.customerID === user.uid) {
            // Check if booking is already completed or confirmed - can't resume completed bookings
            // Pending and deferred bookings can be resumed
            const bookingStatus = booking.status || 'pending';
            console.log('🔍 [RESUME] Resume booking status check:', bookingStatus);
            
            if (bookingStatus === 'completed') {
              console.warn('⚠️ [RESUME] Cannot resume completed booking:', resumeBookingId, 'Status:', bookingStatus);
              localStorage.removeItem('resumeBookingId');
              
              notifications.show({
                title: '⚠️ Booking Already Completed',
                message: `Booking #${resumeBookingId} is already completed. You cannot resume completed bookings.`,
                color: 'orange',
                autoClose: 8000,
              });
              
              // Redirect to home page since this booking can't be resumed
              return;
            }
            
            // Check if booking is in a resumable state (pending, deferred, confirmed)
            // Note: confirmed bookings can be resumed if they need remaining payment (deposit scenario)
            if (bookingStatus === 'cancelled') {
              console.warn('⚠️ [RESUME] Booking is cancelled and cannot be resumed:', resumeBookingId, 'Status:', bookingStatus);
              localStorage.removeItem('resumeBookingId');
              
              notifications.show({
                title: '❌ Cannot Resume Cancelled Booking',
                message: `Booking #${resumeBookingId} has been cancelled and cannot be resumed.`,
                color: 'red',
                autoClose: 8000,
              });
              
              return;
            }
            
            console.log('✅ [RESUME] Valid booking found for resumption:', booking);
            setPendingBookingId(resumeBookingId);
            
            // Special handling for deferred bookings
            if (bookingStatus === 'deferred') {
              console.log('🔄 [DEFERRED] Deferred booking resumed - showing phone call option');
              setIsDeferredBooking(true);
              
              notifications.show({
                title: '⏰ Deferred Booking Resumed',
                message: `Booking #${resumeBookingId} was deferred due to same-day booking rules. You can delete this booking or call us to complete it manually.`,
                color: 'yellow',
                autoClose: 10000,
              });
              
              // Don't automatically proceed to payment for deferred bookings
              // Let them see the special UI first
              setCurrentStep('order-summary');
              setContractSigned(false);
            } else {
              console.log('🔄 [NORMAL] Normal booking resumed - proceeding to payment');
              setIsDeferredBooking(false);
            }
            
            // Restore cart from booking data - always try this for resumed bookings
            console.log('🔍 [RESUME] Checking for cart restoration...');
            if (booking.orderDetails?.items) {
              console.log('🔄 [CART RESTORE] Restoring cart from booking data:', booking.orderDetails.items);
              console.log('🔄 [CART RESTORE] Current cart length:', cart.length);
              console.log('🔄 [CART RESTORE] Booking items count:', booking.orderDetails.items.length);
              
              // Convert booking items back to cart format
              const restoredCart = booking.orderDetails.items.map((item, index) => ({
                id: `${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${index}`,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                category: 'inflateable', // Default category
                wetDry: (item as any).wetDry || 'Wet/Dry', // Use saved wetDry or default
                wet: true,
                dry: true
              }));
              
              console.log('🔄 [CART RESTORE] Restored cart format:', restoredCart);
              setCart(restoredCart);
              
              console.log('✅ [CART RESTORE] Cart restored from booking:', restoredCart);
              
              notifications.show({
                title: '🛒 Cart Restored',
                message: `Restored ${restoredCart.length} items from your booking.`,
                color: 'blue',
                autoClose: 3000,
              });
            } else {
              console.warn('⚠️ [CART RESTORE] Cannot restore cart - no items in booking orderDetails');
              console.log('🔍 [CART RESTORE] Booking structure:', booking);
            }
            
            // Set appropriate step based on booking type and status
            if (!isDeferredBooking) {
              // For normal bookings, go to payment step since contract is already signed
              setCurrentStep('payment');
              setContractSigned(true);
              console.log('📍 [STEP] Set to payment step for normal booking');
            }
            
            // Clear the resume flag
            localStorage.removeItem('resumeBookingId');
            console.log('🗑️ [CLEANUP] Cleared resumeBookingId from localStorage');
            
            notifications.show({
              title: '📝 Booking Resumed',
              message: `Successfully loaded your incomplete booking #${resumeBookingId} (${bookingStatus})`,
              color: 'green',
              autoClose: 5000,
            });
            
            console.log('✅ [RESUME] Booking resumed successfully:', booking);
          } else {
            console.warn('❌ [RESUME] Resume booking not found or not owned by user:', resumeBookingId);
            localStorage.removeItem('resumeBookingId');
            
            notifications.show({
              title: '❌ Booking Not Found',
              message: 'The booking you tried to resume could not be found or does not belong to you.',
              color: 'red',
              autoClose: 8000,
            });
          }
        } catch (error) {
          console.error('❌ [RESUME] Error resuming booking:', error);
          localStorage.removeItem('resumeBookingId');
          
          notifications.show({
            title: '❌ Resume Error',
            message: 'An error occurred while trying to resume your booking.',
            color: 'red',
            autoClose: 8000,
          });
        }
      }
    };

    checkResumedBooking();
  }, [user, pendingBookingId]);

  // Load user wallet data  
  useEffect(() => {
    const loadWallet = async () => {
      if (!user) return;
      
      try {
        const wallet = await getUserWallet(user.uid);
        setUserWallet(wallet);
      } catch (error) {
        console.error("Error loading user wallet:", error);
        setUserWallet(null);
      }
    };

    loadWallet();
  }, [user]);

  // Save delivery address to localStorage when it changes
  useEffect(() => {
    if (deliveryAddress.trim().length > 0) {
      localStorage.setItem('deliveryAddress', deliveryAddress);
      console.log('📍 Delivery address saved to localStorage:', deliveryAddress);
    }
  }, [deliveryAddress]);

  // Load delivery address from localStorage on component mount
  useEffect(() => {
    if (!loading && user) {
      const savedDeliveryAddress = localStorage.getItem('deliveryAddress');
      if (savedDeliveryAddress && !deliveryAddress) {
        setDeliveryAddress(savedDeliveryAddress);
        console.log('📍 Delivery address loaded from localStorage:', savedDeliveryAddress);
      }
    }
  }, [loading, user, deliveryAddress]);


  // Load cart and settings from localStorage
  useEffect(() => {
    if (!loading && user) {
      console.log('📥 [CART LOAD] Loading cart and settings from localStorage');
      
      // Check if we're resuming a booking - if so, delay cart loading
      const resumeBookingId = localStorage.getItem('resumeBookingId');
      if (resumeBookingId) {
        console.log('⏳ [CART LOAD] Resume booking detected, skipping localStorage cart load for now');
        return; // Don't load cart from localStorage if resuming booking
      }
      
      // Load cart from localStorage
      const savedCart = localStorage.getItem("cart");
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart);
          console.log('📦 [CART LOAD] Loaded cart from localStorage:', parsedCart);
          setCart(parsedCart);
        } catch (error) {
          console.error("❌ [CART LOAD] Error parsing cart from localStorage:", error);
          setCart([]);
        }
      } else {
        console.log('🔍 [CART LOAD] No cart found in localStorage');
      }
      
      // Load calendar date range from localStorage
      const savedDateRange = localStorage.getItem("calendarDateRange");
      if (savedDateRange) {
        try {
          const parsed = JSON.parse(savedDateRange);
          const range: [Date | null, Date | null] = [
            parsed[0] ? new Date(parsed[0]) : null,
            parsed[1] ? new Date(parsed[1]) : null,
          ];
          setCalendarDateRange(range);
          console.log('📅 [CART LOAD] Loaded date range from localStorage:', range);
        } catch (error) {
          console.error("❌ [CART LOAD] Error parsing date range from localStorage:", error);
        }
      }
    }
  }, [loading, user]);

  // Get party essentials for carousel (must be defined before useEffect that uses it)
  const partyEssentials = inflateables.filter(item => 
    item.category && item.category.toLowerCase() === "party-essentials" && 
    !item.isGiftCard // Exclude gift cards from last-minute additions
  );

  // Check availability for party essentials when cart or dates change
  useEffect(() => {
    console.log('🔍 [AVAILABILITY DEBUG] useEffect triggered:', {
      hasStartDate: !!calendarDateRange[0],
      hasDuration: !!cartSettings.duration,
      partyEssentialsCount: partyEssentials.length,
      calendarDateRange,
      duration: cartSettings.duration
    });
    
    const checkAvailability = async () => {
      if (calendarDateRange[0] && cartSettings.duration && partyEssentials.length > 0) {
        console.log('🔍 [AVAILABILITY DEBUG] Starting availability check...');
        setLoadingAvailability(true);
        const startDate = calendarDateRange[0];
        const endDate = calculateEndDate(startDate, cartSettings.duration);
        
        console.log('🔍 [AVAILABILITY DEBUG] Calculated dates:', { startDate, endDate });
        
        try {
          const inflateablesData = await loadInflateablesData();
          console.log('🔍 [AVAILABILITY DEBUG] Loaded inflateables data:', inflateablesData.length, 'items');
          
          const availabilityMap = new Map<string, ItemAvailability>();
          
          const promises = partyEssentials.map(async (item) => {
            console.log('🔍 [AVAILABILITY DEBUG] Checking availability for:', item.name);
            const inflateable = inflateablesData.find(inf => inf.name === item.name);
            if (inflateable) {
              const totalQuantity = inflateable.quantity || 1;
              console.log('🔍 [AVAILABILITY DEBUG] Found inflateable with quantity:', totalQuantity);
              
              const availability = await checkItemAvailability(
                item.name,
                totalQuantity,
                startDate,
                endDate
              );
              
              console.log('🔍 [AVAILABILITY DEBUG] Availability result:', {
                itemName: item.name,
                availability
              });
              
              availabilityMap.set(item.name, availability);
            } else {
              console.log('🔍 [AVAILABILITY DEBUG] No inflateable data found for:', item.name);
            }
          });
          
          await Promise.all(promises);
          console.log('🔍 [AVAILABILITY DEBUG] Final availability map:', {
            size: availabilityMap.size,
            entries: Array.from(availabilityMap.entries())
          });
          console.log('🔍 [AVAILABILITY DEBUG] Setting itemAvailability map:', {
            size: availabilityMap.size,
            entries: Array.from(availabilityMap.entries())
          });
          setItemAvailability(availabilityMap);
          
        } catch (error) {
          console.error('❌ [AVAILABILITY DEBUG] Error checking availability:', error);
        } finally {
          setLoadingAvailability(false);
        }
      } else {
        console.log('🔍 [AVAILABILITY DEBUG] Skipping availability check:', {
          reason: !calendarDateRange[0] ? 'No start date' : 
                  !cartSettings.duration ? 'No duration' : 
                  partyEssentials.length === 0 ? 'No party essentials' : 'Unknown'
        });
      }
    };

    checkAvailability();
  }, [calendarDateRange[0], cartSettings.duration, cart, lastMinuteAdditions, partyEssentials.length]);

  console.log('🔍 [CART DEBUG] Current cart state:', {
    cartLength: cart.length,
    cartItems: cart.map(item => ({ name: item.name, quantity: item.quantity, category: item.category })),
    itemAvailabilitySize: itemAvailability.size,
    calendarDateRange,
    duration: cartSettings.duration
  });
  // Validate and clean cart when dates change
  useEffect(() => {
    const validateCart = async () => {
      // Only validate if we have both start and end dates and cart items
      if (calendarDateRange[0] && calendarDateRange[1] && cart.length > 0) {
        console.log('🛒 Validating cart for date change:', calendarDateRange[0].toLocaleDateString(), '-', calendarDateRange[1].toLocaleDateString());
        
        try {
          // Import the validation function
          const { validateAndCleanCart } = await import('../utils/bookingUtils');
          
          const validatedCart = await validateAndCleanCart(
            cart,
            calendarDateRange[0],
            calendarDateRange[1],
            (removedItems) => {
              // Show notification about removed items
              if (removedItems.length > 0) {
                const itemNames = removedItems.map(item => item.name).join(', ');
                notifications.show({
                  title: '⚠️ Items Removed from Cart',
                  message: `The following items were removed because they are not available for your selected dates: ${itemNames}`,
                  color: 'yellow',
                  autoClose: 8000,
                });
              }
            }
          );
          
          // Update cart if items were removed
          if (validatedCart.length !== cart.length) {
            setCart(validatedCart);
            localStorage.setItem('cart', JSON.stringify(validatedCart));
            console.log('✅ Cart updated after validation:', validatedCart.length, 'items remaining');
          }
          
        } catch (error) {
          console.error('❌ Error validating cart:', error);
        }
      }
    };
    
    validateCart();
  }, [calendarDateRange[0], calendarDateRange[1]]); // Only trigger when dates change, not cart changes to avoid infinite loops

  // Pricing calculations (copied from CartSidebar logic)
  const surfacePrices: Record<string, number> = {
    "grass-stakes": 0,
    "grass-sandbags": 25,
    "concrete": 25,
    "indoor": 25,
  };
  
  const timePrices: Record<string, number> = {
    "8am": 40,
    "9am": 30,
    "10am": 20,
    "11am": 10,
    "12pm": 0,
    "": 0,
  };
  
  const durationMultipliers: Record<string, number> = {
    "4hours": 0.9,  // 10% discount
    "24hours": 1.0, // Base price
    "48hours": 1.5, // 50% increase
  };



  // Calculate cart total including last-minute additions
  const durationMultiplier = cartSettings.duration ? durationMultipliers[cartSettings.duration] || 1.0 : 1.0;
  
  // Check if cart contains a membership (for discount calculation)
  const hasMembership = cart.some(item => item.isMembership);
  
  const cartTotal = cart.reduce((sum, item, index) => {
    let itemTotal: number;
    if (item.isGiftCard) {
      itemTotal = (item.giftCardValue || item.price) * item.quantity;
    } else if (item.isMembership) {
      // Membership items don't get duration multiplier or other discounts
      itemTotal = item.price * item.quantity;
    } else {
      // Regular items with duration multiplier
      itemTotal = item.price * item.quantity * durationMultiplier;
      
      // Add wet surcharge if applicable (same logic as CartSidebar)
      const supportsWetDry = item.wetDry === "Wet/Dry";
      if (supportsWetDry && cartSettings.wetDrySelections?.[index] === "Wet") {
        const wetSurcharge = 50 * item.quantity;
        itemTotal += wetSurcharge;
      }
      
      // Apply 25% membership discount to non-membership items if membership is in cart
      if (hasMembership && !item.excludeFromDiscounts) {
        const originalItemTotal = itemTotal;
        itemTotal = itemTotal * 0.75; // 25% discount
      }
    }
    return sum + itemTotal;
  }, 0);

  // Calculate last-minute additions total
  const lastMinuteTotal = Object.entries(lastMinuteAdditions).reduce((sum, [itemName, quantity]) => {
    if (quantity === 0) return sum;
    const item = partyEssentials.find(p => p.name === itemName);
    if (item) {
      const isWeekend = calendarDateRange[0] && calendarDateRange[0].getDay() === 0 || calendarDateRange[0]?.getDay() === 6;
      const price = isWeekend ? item.weekendPrice : item.weekdayPrice;
      return sum + (price * quantity * durationMultiplier);
    }
    return sum;
  }, 0);
  
  // Calculate number of non-gift card items for per-item pricing
  const nonGiftCardItemCount = cart.reduce((count, item) => {
    if (!item.isGiftCard) {
      return count + item.quantity;
    }
    return count;
  }, 0);
  
  // Count unique non-gift-card items (for early delivery surcharge - only charge once per item type)
  const uniqueNonGiftCardItemCount = cart.filter(item => !item.isGiftCard).length;
  
  const surfaceAdj = cartSettings.surface ? (surfacePrices[cartSettings.surface] || 0) * nonGiftCardItemCount : 0;
  const timeAdj = cartSettings.deliveryTime ? (timePrices[cartSettings.deliveryTime] || 0) * uniqueNonGiftCardItemCount : 0;
  const subtotal = cartTotal + lastMinuteTotal + surfaceAdj + timeAdj;
  const total = subtotal + deliveryCost;

  // Load inflateables data function (similar to CartSidebar)
  const loadInflateablesData = async (): Promise<any[]> => {
    console.log('🔄 [DEBUG] Checkout: Loading inflateables data from Firebase...');
    
    const database = getDatabase();
    const inflateablesRef = ref(database, 'inflateables');
    
    try {
      const snapshot = await get(inflateablesRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        return Object.values(data);
      } else {
        console.log('⚠️ [DEBUG] Checkout: No inflateables data found in Firebase');
        return [];
      }
    } catch (error) {
      console.error('❌ [DEBUG] Checkout: Error loading inflateables:', error);
      return [];
    }
  };

  // Calculate end date based on duration (similar to CartSidebar)
  const calculateEndDate = (startDate: Date, duration: string): Date => {
    const endDate = new Date(startDate);
    if (duration === "24hours") {
      endDate.setDate(startDate.getDate() + 1);
    } else if (duration === "48hours") {
      endDate.setDate(startDate.getDate() + 2);
    } else { // 4hours
      endDate.setHours(startDate.getHours() + 4);
    }
    return endDate;
  };

  // Calculate available quantity for an item considering cart items and last-minute additions
  const getAvailableQuantityForItem = (itemName: string): number => {
    const availability = itemAvailability.get(itemName);
    if (!availability) {
      return 1; // Default to 1 if no availability data
    }

    // Calculate how much is already in cart and last-minute additions
    const cartQuantity = cart
      .filter(item => item.name === itemName)
      .reduce((sum, item) => sum + item.quantity, 0);
    
    const lastMinuteQuantity = lastMinuteAdditions[itemName] || 0;
    const totalAlreadySelected = cartQuantity + lastMinuteQuantity;
    
    const availableToAdd = Math.max(0, availability.availableQuantity - totalAlreadySelected);
    
    return availableToAdd;
  };

  // Generate quantity options based on availability (similar to CartSidebar)
  const getQuantityOptions = (itemName: string): number[] => {
    const maxQuantity = Math.max(1, getAvailableQuantityForItem(itemName));
    const options = Array.from({ length: maxQuantity }, (_, i) => i + 1);
    
    return options;
  };

  // Add item to last-minute additions
  const handleAddLastMinuteItem = (itemName: string, quantity: number) => {
    // Validate availability before adding
    const availableQuantity = getAvailableQuantityForItem(itemName);
    
    if (quantity > availableQuantity) {
      notifications.show({
        title: 'Insufficient Availability',
        message: `Only ${availableQuantity} of ${itemName} available for your selected dates.`,
        color: 'red',
      });
      return;
    }
    
    setLastMinuteAdditions(prev => ({
      ...prev,
      [itemName]: quantity
    }));
    setShowQuantityModal(null);
  };

  // Handle "Add to Order" click with smart logic
  const handleAddToOrderClick = (itemName: string) => {
    const availableQuantity = getAvailableQuantityForItem(itemName);
    
    if (availableQuantity === 0) {
      // Should not happen due to UI disabled state, but extra safety
      notifications.show({
        title: 'Not Available',
        message: `${itemName} is not available for your selected dates.`,
        color: 'red',
      });
      return;
    }
    
    if (availableQuantity === 1) {
      // Only 1 available, add directly without showing popup
      handleAddLastMinuteItem(itemName, 1);
      return;
    }
    
    // Multiple available, show quantity selection modal
    
    // Set dropdown to current quantity if item is already added, otherwise default to 1
    const currentQuantity = lastMinuteAdditions[itemName] || 1;
    setSelectedQuantity(currentQuantity);
    setShowQuantityModal(itemName);
  };

  // Handle quantity submission from dropdown modal
  const handleQuantitySubmit = () => {
    if (showQuantityModal) {
      handleAddLastMinuteItem(showQuantityModal, selectedQuantity);
    }
  };

  // Signature handling functions
  const handleSignatureClick = () => {
    // Auto-populate with user's full name if available
    if (!typedSignature.trim() && userProfile?.firstName && userProfile?.lastName) {
      const fullName = `${userProfile.firstName} ${userProfile.lastName}`;
      setTypedSignature(fullName);
    }
  };

  const clearSignature = () => {
    setTypedSignature("");
  };

  // Calculate total payment amount
  const calculateTotalAmount = () => {
    // Use the comprehensive total calculation that's already implemented above
    const result = total.toFixed(2);
    
    return result;
  };

  // Calculate gift card total (always paid in full)
  const calculateGiftCardTotal = () => {
    return cart.reduce((sum, item) => {
      if (item.isGiftCard) {
        return sum + (item.giftCardValue || item.price) * item.quantity;
      }
      return sum;
    }, 0);
  };

  // Calculate inflatable total (eligible for deposit)
  const calculateInflatableTotal = () => {
    const inflatableCartTotal = cart.reduce((sum, item) => {
      if (!item.isGiftCard) {
        return sum + item.price * item.quantity * durationMultiplier;
      }
      return sum;
    }, 0);
    
    // Add last-minute additions, surface/time adjustments, and delivery cost for inflatables
    const adjustments = lastMinuteTotal + surfaceAdj + timeAdj + deliveryCost;
    return inflatableCartTotal + adjustments;
  };

  // Calculate 50% deposit amount (only for inflatables)
  const calculateDepositAmount = () => {
    const giftCardTotal = calculateGiftCardTotal();
    const inflatableTotal = calculateInflatableTotal();
    const depositOnInflatables = inflatableTotal * 0.5;
    
    // Total deposit payment = full gift card amount + 50% of inflatables
    const result = (giftCardTotal + depositOnInflatables).toFixed(2);
    
    return result;
  };

  // Calculate the actual amount paid based on payment type
  const calculateActualAmountPaid = () => {
    // If we have the actual amount paid from the payment success, use that
    if (actualAmountPaid !== null) {
      return actualAmountPaid.toFixed(2);
    }
    
    // Fallback to calculated amounts if actual amount not yet available
    const depositAmount = calculateDepositAmount();
    const totalAmount = calculateTotalAmount();
    
    const result = paymentType === 'deposit' ? depositAmount : totalAmount;
    
    return result;
  };

  // Check if deposit option should be available
  const hasInflatables = () => {
    return cart.some(item => !item.isGiftCard && !item.isMembership);
  };

  // Calculate remaining balance after deposit
  const calculateRemainingBalance = () => {
    const inflatableTotal = calculateInflatableTotal();
    const remainingOnInflatables = inflatableTotal * 0.5;
    // Gift cards are paid in full with deposit, so no remaining balance for them
    return remainingOnInflatables.toFixed(2);
  };

  // Calculate how much wallet balance can be applied
  const calculateWalletApplicableAmount = () => {
    if (!userWallet || !useWalletFirst) return 0;
    
    const paymentAmount = parseFloat(paymentType === 'deposit' ? calculateDepositAmount() : calculateTotalAmount());
    return Math.min(userWallet.balance, paymentAmount);
  };

  // Calculate the amount that needs to be paid via PayPal after wallet application
  const calculatePayPalAmount = () => {
    const strategy = getDeferredBookingStrategy();
    
    let totalPayment;
    if (strategy.strategy === 'partial') {
      // For partial processing, only charge for gift cards and memberships (they're always paid in full)
      totalPayment = calculatePaymentAmountForStrategy();
    } else {
      // For normal/deferred processing, use standard payment logic
      totalPayment = parseFloat(paymentType === 'deposit' ? calculateDepositAmount() : calculateTotalAmount());
    }
    
    const walletApplied = calculateWalletApplicableAmount();
    return Math.max(0, totalPayment - walletApplied);
  };

  // Smart deferred booking logic - analyze cart composition
  const analyzeCartComposition = () => {
    const giftCardItems = cart.filter(item => item.isGiftCard);
    const membershipItems = cart.filter(item => item.isMembership);
    const rentalItems = cart.filter(item => !item.isGiftCard && !item.isMembership);

    return {
      hasGiftCards: giftCardItems.length > 0,
      hasMemberships: membershipItems.length > 0,
      hasRentals: rentalItems.length > 0,
      giftCardItems,
      membershipItems,
      rentalItems,
      isOnlyGiftCardsAndMemberships: rentalItems.length === 0,
      isMixedCart: (giftCardItems.length > 0 || membershipItems.length > 0) && rentalItems.length > 0
    };
  };

  // Calculate totals for partial processing
  const calculatePartialTotals = () => {
    const { giftCardItems, membershipItems, rentalItems } = analyzeCartComposition();
    
    const giftCardTotal = giftCardItems.reduce((sum, item) => {
      return sum + (item.giftCardValue || item.price) * item.quantity;
    }, 0);

    const membershipTotal = membershipItems.reduce((sum, item) => {
      return sum + item.price * item.quantity;
    }, 0);

    // For rental items, include duration multiplier and wet surcharges
    const durationMultiplier = cartSettings.duration ? durationMultipliers[cartSettings.duration] || 1.0 : 1.0;
    const rentalTotal = rentalItems.reduce((sum, item) => {
      let itemTotal = item.price * item.quantity * durationMultiplier;
      
      // Add wet surcharge if applicable (same logic as main calculation)
      const cartIndex = cart.findIndex(cartItem => cartItem.id === item.id);
      if (item.wetDry === "Wet/Dry" && cartSettings.wetDrySelections?.[cartIndex] === "Wet") {
        itemTotal += 50 * item.quantity;
      }
      
      return sum + itemTotal;
    }, 0);

    return {
      giftCardTotal,
      membershipTotal,
      rentalTotal,
      processableTotal: giftCardTotal + membershipTotal,
      totalWithRentals: giftCardTotal + membershipTotal + rentalTotal
    };
  };

  // Determine if booking should be processed normally, deferred, or partially processed
  const getDeferredBookingStrategy = () => {
    const composition = analyzeCartComposition();
    const eventDate = calendarDateRange[0];
    const isWithinTwoDays = eventDate && shouldDeferBooking(eventDate.toISOString());

    // Scenario 1: Only gift cards and/or memberships - always process normally
    if (composition.isOnlyGiftCardsAndMemberships) {
      return {
        strategy: 'normal',
        reason: 'Gift cards and memberships do not require manual confirmation'
      };
    }

    // Scenario 2: Mixed cart within two days - partial processing
    if (composition.isMixedCart && isWithinTwoDays) {
      return {
        strategy: 'partial',
        reason: 'Process gift cards/memberships immediately, defer rental items due to same-day booking rules',
        ...calculatePartialTotals()
      };
    }

    // Scenario 3: Only rental items within two days - full deferral
    if (composition.hasRentals && !composition.hasGiftCards && !composition.hasMemberships && isWithinTwoDays) {
      return {
        strategy: 'deferred',
        reason: 'Rental items require manual confirmation for same-day bookings'
      };
    }

    // Default: Normal processing
    return {
      strategy: 'normal',
      reason: 'Standard booking flow'
    };
  };

  // Calculate payment amount considering partial processing
  const calculatePaymentAmountForStrategy = () => {
    const strategy = getDeferredBookingStrategy();
    
    if (strategy.strategy === 'partial') {
      // For partial processing, only charge for gift cards and memberships
      const partialTotals = calculatePartialTotals();
      return partialTotals.processableTotal;
    } else {
      // For normal/deferred processing, use standard total
      return parseFloat(calculateTotalAmount());
    }
  };

  // Update wallet applied amount when toggle changes
  useEffect(() => {
    setWalletAppliedAmount(calculateWalletApplicableAmount());
  }, [useWalletFirst, paymentType, userWallet?.balance, total]);

  // Cart abandonment tracking
  useEffect(() => {
    let cartAbandonmentTimeout: NodeJS.Timeout | null = null;

    const scheduleCartReminder = async () => {
      if (cart.length > 0 && user && user.email) {
        try {
          const cartValue = cart.reduce((sum, item) => sum + item.price, 0);
          
          await scheduleCartReminderEmail({
            userID: user.uid,
            cartItems: cart,
            cartValue: cartValue,
            customerEmail: user.email,
            customerName: user.displayName || userProfile?.firstName || 'Customer'
          });
          
          console.log('📧 Cart abandonment reminder scheduled for 24 hours');
        } catch (error) {
          console.error('Failed to schedule cart abandonment reminder:', error);
        }
      }
    };

    // Schedule reminder if cart has items and user is logged in
    if (cart.length > 0 && user) {
      // Clear any existing timeout
      if (cartAbandonmentTimeout) {
        clearTimeout(cartAbandonmentTimeout);
      }
      
      // Schedule reminder for 5 minutes from now (for testing - change to longer in production)
      cartAbandonmentTimeout = setTimeout(scheduleCartReminder, 5 * 60 * 1000); // 5 minutes for demo
    }

    // Cleanup function
    return () => {
      if (cartAbandonmentTimeout) {
        clearTimeout(cartAbandonmentTimeout);
      }
    };
  }, [cart, user, userProfile]);

  // Schedule automated emails after successful payment
  const scheduleAutomatedEmails = async (bookingData: any) => {
    if (!user || !user.email) return;

    const commonBookingData = {
      bookingID: bookingData.orderID,
      customerEmail: user.email,
      customerName: user.displayName || userProfile?.firstName || 'Customer',
      eventDate: calendarDateRange[0]?.toISOString() || new Date().toISOString(),
      bookingDetails: {
        deliveryAddress: deliveryAddress,
        deliveryTime: cartSettings.deliveryTime,
        items: cart.filter(item => !item.isGiftCard).map(item => ({
          name: item.name,
          quantity: item.quantity || 1,
          price: item.price
        }))
      }
    };

    try {
      // Schedule deposit reminder if this was a deposit payment
      if (paymentType === 'deposit') {
        await scheduleDepositReminderEmail({
          ...commonBookingData,
          remainingAmount: bookingData.remainingBalance || 0
        });
        console.log('📧 Deposit reminder scheduled');
      }

      // Schedule event confirmation (2 days before)
      await scheduleEventConfirmationEmail(commonBookingData);
      console.log('📧 Event confirmation scheduled');

      // Schedule post-event thank you (1 day after)
      await schedulePostEventThanksEmail(commonBookingData);
      console.log('📧 Post-event thank you scheduled');

      // Schedule rebooking reminder (9 months after)
      await scheduleRebookingReminderEmail(commonBookingData);
      console.log('📧 Rebooking reminder scheduled');

    } catch (error) {
      console.error('Failed to schedule automated emails:', error);
    }
  };

  // Check if current booking is within the next 2 days (using calendar dates)
  const isCurrentBookingWithinTwoDays = () => {
    if (!calendarDateRange || !calendarDateRange[0]) {
      return false;
    }
    
    const eventDateString = calendarDateRange[0].toLocaleDateString();
    return isBookingWithinTwoDays(eventDateString);
  };

  // Contract completion handler - called by ContractSigning component
  const onContractComplete = (orderID: string, contractID: string) => {
    setPendingBookingId(orderID);
    
    // Use flushSync to ensure state update completes before navigation
    flushSync(() => {
      setContractSigned(true);
    });
    
    // Navigate to payment step
    setCurrentStep('payment');
    setVisitedSteps(prev => new Set([...prev, 'payment']));
    
    console.log('🚀 Contract completed, navigated to payment step');
  };

  // Status change handler - called by ContractSigning component
  const handleContractStatusChange = (requiresPhoneCall: boolean) => {
    setRequiresPhoneCall(requiresPhoneCall);
  };

  // PayPal payment handlers
  const createPayPalOrder = (data: any, actions: any) => {
    // Calculate PayPal amount (total payment minus wallet application)
    const payPalAmount = calculatePayPalAmount();
    
    // Skip PayPal if fully covered by wallet
    if (payPalAmount <= 0) {
      throw new Error("Order is fully covered by wallet balance");
    }

    const strategy = getDeferredBookingStrategy();
    
    let baseDescription;
    if (strategy.strategy === 'partial') {
      const composition = analyzeCartComposition();
      baseDescription = `Jump CSRA Partial Order - Gift Cards/Memberships (${composition.giftCardItems.length + composition.membershipItems.length} item(s))`;
    } else {
      baseDescription = paymentType === 'deposit' 
        ? `Jump CSRA Rental - 50% Deposit (${cart.length} item(s))`
        : `Jump CSRA Party Rental - Full Payment (${cart.length} item(s))`;
    }
      
    const description = useWalletFirst 
      ? `${baseDescription} - After Wallet: $${walletAppliedAmount.toFixed(2)}`
      : baseDescription;
    
    return actions.order.create({
      purchase_units: [
        {
          amount: {
            value: payPalAmount.toFixed(2),
            currency_code: "USD"
          },
          description: description
        }
      ],
      intent: "CAPTURE"
    });
  };

  // Handle wallet-only payment (no PayPal required)
  const onWalletOnlyPayment = async () => {
    setProcessingPayment(true);
    
    try {
      if (!user || !userWallet || walletAppliedAmount <= 0) {
        throw new Error("Invalid wallet payment conditions");
      }

      // Process wallet transaction
      const walletTransactionSuccess = await addWalletTransaction(user.uid, {
        amount: -walletAppliedAmount,
        type: 'withdrawal',
        description: `Order payment - ${cart.length} item(s) (Wallet Only)`,
        orderID: pendingBookingId || `wallet-${Date.now()}`
      });

      if (!walletTransactionSuccess) {
        throw new Error("Failed to process wallet transaction");
      }

      // Refresh wallet data
      const updatedWallet = await getUserWallet(user.uid);
      setUserWallet(updatedWallet);

      if (pendingBookingId) {
        // Load existing booking
        const existingBooking = await loadBookingData(pendingBookingId);
        if (existingBooking) {
          const totalAmount = existingBooking.orderDetails.totalAmount;
          const depositAmount = walletAppliedAmount;

          // Update booking status
          const statusUpdated = await updateBookingStatusBasedOnPayment(pendingBookingId, depositAmount, totalAmount);
          
          if (!statusUpdated) {
            console.error('❌ PAYPAL PAYMENT - Failed to update booking status');
            throw new Error('Failed to update booking status after payment');
          }
          
          console.log('✅ PAYPAL PAYMENT - Booking status updated successfully');
          
          if (!statusUpdated) {
            console.error('❌ WALLET PAYMENT - Failed to update booking status');
            throw new Error('Failed to update booking status after payment');
          }
          
          console.log('✅ WALLET PAYMENT - Booking status updated successfully');
          
          if (statusUpdated) {
            // Update payment details
            existingBooking.paymentDetails.depositAmount = depositAmount;
            existingBooking.paymentDetails.remainingBalance = totalAmount - depositAmount;
            existingBooking.paymentDetails.paymentStatus = 'completed';
            existingBooking.paymentDetails.paymentDate = new Date().toISOString();
            existingBooking.updatedAt = new Date().toISOString();
            
            const success = await saveBookingData(existingBooking);
            if (success) {
              setPaymentId(`wallet-${Date.now()}`);
              setPaymentCompleted(true);
              
              // Handle gift card creation
              const giftCardsInCart = cart.filter(item => item.isGiftCard);
              console.log('🎁 WALLET PAYMENT - Gift card debug - Cart items:', cart.map(item => ({ name: item.name, isGiftCard: item.isGiftCard, giftCardValue: item.giftCardValue })));
              console.log('🎁 WALLET PAYMENT - Filtered gift cards:', giftCardsInCart);
              
              if (giftCardsInCart.length > 0) {
                console.log(`🎁 WALLET PAYMENT - Creating ${giftCardsInCart.length} gift card database entries...`);
                for (const giftCardItem of giftCardsInCart) {
                  console.log(`🎁 WALLET PAYMENT - Processing gift card item:`, giftCardItem);
                  for (let i = 0; i < giftCardItem.quantity; i++) {
                    const giftCardCode = await generateUniqueGiftCardCode();
                    const giftCardValue = giftCardItem.giftCardValue || giftCardItem.price;
                    
                    console.log(`🎁 WALLET PAYMENT - Creating gift card ${i + 1}/${giftCardItem.quantity}: Code=${giftCardCode}, Value=$${giftCardValue}`);
                    
                    const success = await createGiftCardInDatabase(
                      giftCardCode,
                      giftCardValue,
                      user.uid,
                      user.email || '',
                      user.displayName || '',
                      false
                    );
                    
                    if (success) {
                      console.log(`✅ WALLET PAYMENT - Gift card created successfully: ${giftCardCode} - $${giftCardValue}`);
                    } else {
                      console.error(`❌ WALLET PAYMENT - Failed to create gift card: ${giftCardCode}`);
                    }
                  }
                }
              } else {
                console.log('🎁 WALLET PAYMENT - No gift cards in cart:', { giftCardsCount: giftCardsInCart.length });
              }

              // Create promotional gift card for GOGO discount if applicable (wallet payment)
              if (discounts.bogoGiftCard && giftCardsInCart.length > 0 && user) {
                try {
                  console.log('🎁 WALLET GOGO DISCOUNT - Creating promotional gift card...');
                  
                  // Find the highest value gift card in the cart
                  let highestValue = 0;
                  for (const giftCardItem of giftCardsInCart) {
                    const value = giftCardItem.giftCardValue || giftCardItem.price;
                    if (value > highestValue) {
                      highestValue = value;
                    }
                  }
                  
                  console.log(`🎁 WALLET GOGO DISCOUNT - Creating promotional gift card with value: $${highestValue}`);
                  
                  const promoGiftCardCode = await generateUniqueGiftCardCode();
                  const recipientEmail = promotionalGiftCardEmail || user.email || '';
                  
                  const success = await createGiftCardInDatabase(
                    promoGiftCardCode,
                    highestValue,
                    user.uid,
                    user.email || '',
                    user.displayName || '',
                    true, // isGift = true for promotional cards
                    recipientEmail // giftedTo parameter
                  );
                  
                  if (success) {
                    console.log(`✅ WALLET GOGO promotional gift card created: ${promoGiftCardCode} - $${highestValue} for ${recipientEmail}`);
                    
                    // Send separate gift card email for promotional gift card
                    try {
                      const { getFunctions, httpsCallable } = await import('firebase/functions');
                      const { app } = await import('../components/FirebaseConfig');
                      
                      const functions = getFunctions(app);
                      const sendGiftCardEmail = httpsCallable(functions, 'sendGiftCardEmail');
                      
                      const giftCardEmailData = {
                        recipientEmail: recipientEmail,
                        recipientName: user.displayName || 'Customer',
                        giftCardCode: promoGiftCardCode,
                        giftCardBalance: highestValue,
                        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
                        purchaseDate: new Date().toLocaleDateString(),
                        isPromotional: true,
                        promotionalMessage: 'GOGO Special Offer - Free gift card with your purchase!'
                      };
                      
                      const emailResult = await sendGiftCardEmail(giftCardEmailData);
                      const result = emailResult.data as any;
                      
                      if (result.success) {
                        console.log('✅ WALLET GOGO promotional gift card email sent successfully');
                        notifications.show({
                          title: '🎁 Promotional Gift Card Sent!',
                          message: `A free gift card worth $${highestValue} has been sent to ${recipientEmail}`,
                          color: 'green',
                          autoClose: 8000,
                        });
                      } else {
                        console.error('❌ Failed to send wallet promotional gift card email:', result.message);
                      }
                    } catch (emailError) {
                      console.error('❌ Error sending wallet promotional gift card email:', emailError);
                    }
                  } else {
                    console.error(`❌ Failed to create WALLET GOGO promotional gift card: ${promoGiftCardCode}`);
                  }
                } catch (promoError) {
                  console.error('❌ Exception during WALLET GOGO promotional gift card creation:', promoError);
                }
              }

              // Send comprehensive order confirmation via enhanced backend email system
              try {
                // Convert cart to gift card info (simplified for now)
                const giftCardInfo = cart.filter(item => item.isGiftCard).map(item => ({
                  code: `GC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`, // This would be actual gift card codes
                  balance: item.giftCardValue || item.price,
                  expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
                  isPromotional: false
                }));
                
                // Prepare invoice data for backend
                const invoiceData = {
                  recipientEmail: user?.email || '',
                  recipientName: user?.displayName || userProfile?.firstName || 'Customer',
                  orderID: pendingBookingId || 'N/A',
                  orderDate: new Date().toISOString(),
                  
                  // Event details
                  eventDate: calendarDateRange[0]?.toLocaleDateString() || new Date().toLocaleDateString(),
                  deliveryAddress: deliveryAddress || '',
                  deliveryTime: cartSettings.deliveryTime || '',
                  duration: `${cart.length > 0 ? '6' : '6'} hours`, // Default duration, adjust as needed
                  surface: undefined, // Add surface selection if available
                  
                  // Items (converting cart to the expected format)
                  rentalItems: cart.filter(item => !item.isGiftCard).map(item => ({
                    name: item.name,
                    quantity: item.quantity || 1,
                    price: item.price,
                    wetDry: item.wetDry
                  })),
                  lastMinuteAdditions: [],
                  
                  // Pricing
                  subtotal: cart.reduce((sum, item) => sum + item.price, 0),
                  surfaceAdjustment: 0,
                  timeAdjustment: 0,
                  deliveryCost: deliveryCost,
                  totalAmount: totalAmount,
                  
                  // Payment info
                  paymentType: paymentType as 'full' | 'deposit',
                  amountPaid: walletAppliedAmount,
                  remainingBalance: paymentType === 'deposit' ? totalAmount - depositAmount : 0,
                  paymentMethod: 'Wallet',
                  
                  // Gift cards and booking
                  giftCards: giftCardInfo,
                  bookingStatus: 'confirmed',
                  requiresPhoneCall: false, // Set based on your business logic
                  
                  // PayPal transaction details (none for wallet-only payments)
                  paypalOrderId: undefined,
                  paypalTransactionId: undefined
                };

                // Call Cloud Function to send order confirmation email
                try {
                  const { getFunctions, httpsCallable } = await import('firebase/functions');
                  const { initializeApp, getApps } = await import('firebase/app');
                  
                  let app;
                  if (getApps().length === 0) {
                    const { firebaseConfig } = await import('../components/FirebaseConfig');
                    app = initializeApp(firebaseConfig);
                  } else {
                    app = getApps()[0];
                  }
                  
                  const functions = getFunctions(app);
                  const sendOrderConfirmation = httpsCallable(functions, 'sendOrderConfirmationEmail');
                  const result = await sendOrderConfirmation(invoiceData);
                
                  console.log(`📧 WALLET PAYMENT - Order confirmation email sent successfully for order ${pendingBookingId}`);
                  console.log('  ✅ Cloud Function Response:', result.data);
                } catch (emailError) {
                  console.error(`📧 WALLET PAYMENT - Error sending order confirmation email for order ${pendingBookingId}:`, emailError);
                }
              } catch (invoiceError) {
                console.error(`📧 WALLET PAYMENT - Error sending order confirmation email for order ${pendingBookingId}:`, invoiceError);
              }

              const message = paymentType === 'deposit' 
                ? `Deposit of $${walletAppliedAmount.toFixed(2)} paid with wallet. Remaining balance: $${(totalAmount - depositAmount).toFixed(2)}.`
                : `Full payment of $${walletAppliedAmount.toFixed(2)} completed with wallet.`;

              notifications.show({
                title: '✅ Payment Successful!',
                message: message,
                color: 'green',
                autoClose: 8000,
              });

              // Store cart data before clearing for order summary display
              setCompletedOrderCart([...cart]);

              // Clear cart abandonment tracking (user completed checkout)
              if (user) {
                clearCartAbandonment(user.uid);
              }

              // Clear cart
              localStorage.removeItem("cart");
              setCart([]);
            }
          }
        }
      }
    } catch (error) {
      console.error('Wallet payment error:', error);
      notifications.show({
        title: '❌ Payment Failed',
        message: 'There was an error processing your wallet payment. Please try again.',
        color: 'red',
        autoClose: 5000,
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  const onPayPalApprove = async (data: any, actions: any) => {
    setProcessingPayment(true);
    
    try {
      const details = await actions.order.capture();
      const paymentId = details.id;
      const payPalAmount = parseFloat(details.purchase_units[0].amount.value);
      
      // Handle wallet transaction if wallet was used
      let walletTransactionId = null;
      if (useWalletFirst && walletAppliedAmount > 0 && user) {
        try {
          console.log(`Processing wallet deduction: $${walletAppliedAmount.toFixed(2)}`);
          
          const walletTransactionSuccess = await addWalletTransaction(user.uid, {
            amount: -walletAppliedAmount, // Negative amount for deduction
            type: 'withdrawal',
            description: `Order payment - ${cart.length} item(s)`,
            orderID: data.orderID,
            paypalTransactionId: paymentId
          });
          
          if (walletTransactionSuccess) {
            console.log(`✅ Wallet transaction completed successfully`);
            // Refresh wallet data
            const updatedWallet = await getUserWallet(user.uid);
            setUserWallet(updatedWallet);
          } else {
            console.error('Failed to create wallet transaction');
          }
        } catch (walletError) {
          console.error('Wallet transaction error:', walletError);
        }
      }
      
      // Calculate total paid amount (PayPal + Wallet)
      const totalPaidAmount = payPalAmount + walletAppliedAmount;
      
      // Store the actual amount paid for display purposes
      setActualAmountPaid(totalPaidAmount);
      
      if (pendingBookingId) {
        // Load existing booking to get total amount and current status
        const existingBooking = await loadBookingData(pendingBookingId);
        if (existingBooking) {
          const totalAmount = existingBooking.orderDetails.totalAmount;
          
          // Determine deposit amount based on payment type
          let depositAmount: number;
          if (paymentType === 'deposit') {
            depositAmount = totalPaidAmount; // The total paid amount (PayPal + Wallet) is the deposit
          } else {
            depositAmount = totalPaidAmount; // Full payment means the full amount is the deposit
          }
          
          // Update booking status based on payment using the new utility function
          const statusUpdated = await updateBookingStatusBasedOnPayment(pendingBookingId, depositAmount, totalAmount);
          
          if (statusUpdated) {
            // Get the updated booking with the new status before updating payment details
            const updatedBooking = await loadBookingData(pendingBookingId);
            if (!updatedBooking) {
              throw new Error("Could not load updated booking data");
            }
            
            // Update payment details in the booking (preserving the updated status)
            updatedBooking.paymentDetails.depositAmount = depositAmount;
            updatedBooking.paymentDetails.remainingBalance = totalAmount - depositAmount;
            updatedBooking.paymentDetails.paypalOrderId = data.orderID;
            updatedBooking.paymentDetails.paypalTransactionId = paymentId;
            updatedBooking.paymentDetails.paymentStatus = 'completed';
            updatedBooking.paymentDetails.paymentDate = new Date().toISOString();
            updatedBooking.updatedAt = new Date().toISOString();
            
            const success = await saveBookingData(updatedBooking);
            if (success) {
              setPaymentId(paymentId);
              setPaymentCompleted(true);
              
              // Use the status from the updated booking
              const finalStatus = updatedBooking.status || 'unknown';
              
              let message: string;
              if (paymentType === 'deposit') {
                const walletPart = useWalletFirst && walletAppliedAmount > 0 ? ` (PayPal: $${payPalAmount.toFixed(2)}, Wallet: $${walletAppliedAmount.toFixed(2)})` : '';
                message = `Deposit of $${totalPaidAmount.toFixed(2)}${walletPart} received. Booking status: ${finalStatus}. Remaining balance: $${(totalAmount - depositAmount).toFixed(2)}.`;
              } else {
                const walletPart = useWalletFirst && walletAppliedAmount > 0 ? ` (PayPal: $${payPalAmount.toFixed(2)}, Wallet: $${walletAppliedAmount.toFixed(2)})` : '';
                message = `Full payment of $${totalPaidAmount.toFixed(2)}${walletPart} completed. Booking confirmed successfully.`;
              }
              
              notifications.show({
                title: '✅ Payment Successful!',
                message: message,
                color: 'green',
                autoClose: 8000,
              });
              
              // Create gift card database entries for purchased gift cards
              const giftCardsInCart = cart.filter(item => item.isGiftCard);
              console.log('🎁 GIFT CARD DEBUG - Cart items:', cart.map(item => ({ name: item.name, isGiftCard: item.isGiftCard, giftCardValue: item.giftCardValue })));
              console.log('🎁 GIFT CARD DEBUG - Filtered gift cards:', giftCardsInCart);
              
              if (giftCardsInCart.length > 0 && user) {
                let anyGiftCardFailed = false;
                try {
                  console.log(`🎁 Creating ${giftCardsInCart.length} gift card database entries...`);
                  for (const giftCardItem of giftCardsInCart) {
                    // Log all fields for debugging
                    console.log('🎁 Gift card item details:', JSON.stringify(giftCardItem));
                    const quantity = giftCardItem.quantity || 1;
                    const value = giftCardItem.giftCardValue || giftCardItem.price;
                    if (!value || value <= 0) {
                      console.error('❌ Invalid gift card value:', value, giftCardItem);
                      anyGiftCardFailed = true;
                      continue;
                    }
                    for (let i = 0; i < quantity; i++) {
                      const giftCardCode = await generateUniqueGiftCardCode();
                      console.log(`🎁 Creating gift card ${i + 1}/${quantity}: Code=${giftCardCode}, Value=$${value}`);
                      const success = await createGiftCardInDatabase(
                        giftCardCode,
                        value,
                        user.uid,
                        user.email || '',
                        user.displayName || '',
                        false // isGift = false for purchased cards
                      );
                      if (success) {
                        console.log(`✅ Gift card created successfully: ${giftCardCode} - $${value}`);
                      } else {
                        console.error(`❌ Failed to create gift card: ${giftCardCode} - $${value}`);
                        anyGiftCardFailed = true;
                      }
                    }
                  }
                  if (anyGiftCardFailed) {
                    notifications.show({
                      title: '⚠️ Gift Card Warning',
                      message: 'Some gift cards failed to be created. Please check the logs or contact support.',
                      color: 'yellow',
                      autoClose: 12000,
                    });
                  } else {
                    console.log(`🎁 Successfully processed all gift card database entries for order ${pendingBookingId}`);
                  }
                } catch (giftCardError) {
                  console.error('❌ Exception during gift card creation:', giftCardError);
                  notifications.show({
                    title: '⚠️ Gift Card Error',
                    message: 'Payment successful, but there was an error creating gift card entries. Please contact support.',
                    color: 'red',
                    autoClose: 12000,
                  });
                }
              } else {
                console.log('🎁 No gift cards in cart or user not found:', { giftCardsCount: giftCardsInCart.length, hasUser: !!user });
              }

              // Create promotional gift card for GOGO discount if applicable
              if (discounts.bogoGiftCard && giftCardsInCart.length > 0 && user) {
                try {
                  console.log('🎁 GOGO DISCOUNT - Creating promotional gift card...');
                  
                  // Find the highest value gift card in the cart
                  let highestValue = 0;
                  for (const giftCardItem of giftCardsInCart) {
                    const value = giftCardItem.giftCardValue || giftCardItem.price;
                    if (value > highestValue) {
                      highestValue = value;
                    }
                  }
                  
                  console.log(`🎁 GOGO DISCOUNT - Creating promotional gift card with value: $${highestValue}`);
                  
                  const promoGiftCardCode = await generateUniqueGiftCardCode();
                  const recipientEmail = promotionalGiftCardEmail || user.email || '';
                  
                  const success = await createGiftCardInDatabase(
                    promoGiftCardCode,
                    highestValue,
                    user.uid,
                    user.email || '',
                    user.displayName || '',
                    true, // isGift = true for promotional cards
                    recipientEmail // giftedTo parameter
                  );
                  
                  if (success) {
                    console.log(`✅ GOGO promotional gift card created: ${promoGiftCardCode} - $${highestValue} for ${recipientEmail}`);
                    
                    // Send separate invoice for promotional gift card
                    try {
                      const { createAndSendPayPalInvoice } = await import('../utils/paypalInvoiceUtils');
                      
                      const promoInvoiceData = {
                        recipientEmail: recipientEmail,
                        recipientName: user.displayName || 'Customer',
                        orderID: 'PROMO-' + Date.now(),
                        orderDate: new Date().toISOString(),
                        rentalItems: [],
                        lastMinuteAdditions: [],
                        subtotal: 0,
                        surfaceAdjustment: 0,
                        timeAdjustment: 0,
                        deliveryCost: 0,
                        totalAmount: 0,
                        paymentType: 'full' as const,
                        amountPaid: 0,
                        remainingBalance: 0,
                        paymentMethod: 'Promotional Gift Card',
                        giftCards: [{
                          code: promoGiftCardCode,
                          balance: highestValue,
                          expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                          isPromotional: true,
                          promotionalMessage: 'GOGO Special Offer - Free gift card with your purchase!',
                          recipientEmail: recipientEmail
                        }],
                        bookingStatus: 'promotional_gift_card'
                      };
                      
                      const invoiceResult = await createAndSendPayPalInvoice(promoInvoiceData);
                      
                      if (invoiceResult.success) {
                        console.log('✅ GOGO promotional gift card invoice sent successfully');
                        notifications.show({
                          title: '🎁 Promotional Gift Card Sent!',
                          message: `A free gift card worth $${highestValue} has been sent to ${recipientEmail}`,
                          color: 'green',
                          autoClose: 8000,
                        });
                      } else {
                        console.error('❌ Failed to send promotional gift card invoice:', invoiceResult.error);
                      }
                    } catch (invoiceError) {
                      console.error('❌ Error sending promotional gift card invoice:', invoiceError);
                    }
                  } else {
                    console.error(`❌ Failed to create GOGO promotional gift card: ${promoGiftCardCode}`);
                  }
                } catch (promoError) {
                  console.error('❌ Exception during GOGO promotional gift card creation:', promoError);
                }
              }

              // Send comprehensive order confirmation via enhanced backend email system
              try {
                console.log(`📧 PAYPAL PAYMENT - Preparing order confirmation email for order ${pendingBookingId}`);
                
                // Convert cart to gift card info (simplified for now)
                const giftCardInfo = cart.filter(item => item.isGiftCard).map(item => ({
                  code: `GC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`, // This would be actual gift card codes
                  balance: item.giftCardValue || item.price,
                  expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
                  isPromotional: false
                }));
                
                // Prepare invoice data for backend
                const invoiceData = {
                  recipientEmail: user?.email || '',
                  recipientName: user?.displayName || userProfile?.firstName || 'Customer',
                  orderID: pendingBookingId || 'N/A',
                  orderDate: new Date().toISOString(),
                  
                  // Event details
                  eventDate: calendarDateRange[0]?.toLocaleDateString() || new Date().toLocaleDateString(),
                  deliveryAddress: deliveryAddress || '',
                  deliveryTime: cartSettings.deliveryTime || '',
                  duration: `${cart.length > 0 ? '6' : '6'} hours`, // Default duration, adjust as needed
                  surface: undefined, // Add surface selection if available
                  
                  // Items (converting cart to the expected format)
                  rentalItems: cart.filter(item => !item.isGiftCard).map(item => ({
                    name: item.name,
                    quantity: item.quantity || 1,
                    price: item.price,
                    wetDry: item.wetDry
                  })),
                  lastMinuteAdditions: [],
                  
                  // Pricing
                  subtotal: cart.reduce((sum, item) => sum + item.price, 0),
                  surfaceAdjustment: 0,
                  timeAdjustment: 0,
                  deliveryCost: deliveryCost,
                  totalAmount: totalAmount,
                  
                  // Payment info
                  paymentType: paymentType as 'full' | 'deposit',
                  amountPaid: totalPaidAmount,
                  remainingBalance: paymentType === 'deposit' ? totalAmount - depositAmount : 0,
                  paymentMethod: useWalletFirst && walletAppliedAmount > 0 
                    ? `PayPal ($${payPalAmount.toFixed(2)}) + Wallet ($${walletAppliedAmount.toFixed(2)})`
                    : 'PayPal',
                  
                  // Gift cards and booking
                  giftCards: giftCardInfo,
                  bookingStatus: finalStatus || 'confirmed',
                  requiresPhoneCall: false, // Set based on your business logic
                  
                  // PayPal transaction details (for reference)
                  paypalOrderId: data.orderID,
                  paypalTransactionId: paymentId
                };

                console.log(`📧 PAYPAL PAYMENT - Sending order confirmation email with data:`, {
                  email: invoiceData.recipientEmail,
                  orderID: invoiceData.orderID,
                  amount: invoiceData.amountPaid,
                  items: invoiceData.rentalItems.length
                });

                // Call Cloud Function to send order confirmation email
                try {
                  const { getFunctions, httpsCallable } = await import('firebase/functions');
                  const { initializeApp, getApps } = await import('firebase/app');
                  
                  let app;
                  if (getApps().length === 0) {
                    const { firebaseConfig } = await import('../components/FirebaseConfig');
                    app = initializeApp(firebaseConfig);
                  } else {
                    app = getApps()[0];
                  }
                  
                  const functions = getFunctions(app);
                  const sendOrderConfirmation = httpsCallable(functions, 'sendOrderConfirmationEmail');
                  const result = await sendOrderConfirmation(invoiceData);
                
                  console.log(`📧 PAYPAL PAYMENT - Order confirmation email result:`, result.data);
                  console.log(`✅ PAYPAL PAYMENT - Order confirmation email sent successfully for order ${pendingBookingId}`);
                  
                  // Show user notification
                  notifications.show({
                    title: '📧 Email Sent',
                    message: 'Order confirmation email sent successfully!',
                    color: 'green',
                    autoClose: 5000,
                  });
                } catch (emailError) {
                  console.warn(`⚠️ PAYPAL PAYMENT - Order confirmation email had issues for order ${pendingBookingId}:`, emailError);
                  
                  // Show user notification
                  notifications.show({
                    title: '⚠️ Email Issue',
                    message: 'Order confirmed but email may be delayed. Check your inbox in a few minutes.',
                    color: 'yellow',
                    autoClose: 8000,
                  });
                }
              } catch (invoiceError) {
                console.error(`❌ PAYPAL PAYMENT - Error sending order confirmation email for order ${pendingBookingId}:`, invoiceError);
                
                // Show user notification
                notifications.show({
                  title: '❌ Email Error',
                  message: 'Order confirmed but confirmation email failed. Please save your order details.',
                  color: 'red',
                  autoClose: 10000,
                });
              }
              
              // Store cart data before clearing for order summary display
              setCompletedOrderCart([...cart]);
              
              // Clear cart abandonment tracking (user completed checkout)
              if (user) {
                clearCartAbandonment(user.uid);
              }
              
              // Clear cart after successful payment
              localStorage.removeItem("cart");
              setCart([]);
              
              console.log("Payment completed:", details);
              console.log(`Booking status updated to ${finalStatus} with orderID:`, pendingBookingId);
            } else {
              throw new Error("Failed to update booking payment details");
            }
          } else {
            throw new Error("Failed to update booking status after payment");
          }
        } else {
          throw new Error("Could not find existing booking to update");
        }
      } else {
        throw new Error("No pending booking ID found");
      }
    } catch (error) {
      console.error("Payment processing error:", error);
      notifications.show({
        title: '❌ Payment Error',
        message: 'There was an error processing your payment. Please try again.',
        color: 'red',
        autoClose: 8000,
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  const onPayPalError = (err: any) => {
    console.error("PayPal error:", err);
    notifications.show({
      title: '❌ Payment Error',
      message: 'There was an error with PayPal. Please try again.',
      color: 'red',
      autoClose: 8000,
    });
  };

  // Update booking status in database (legacy function for old contracts table)
  const updateLegacyBookingStatus = async (contractId: string, status: 'deferred' | 'pending' | 'confirmed' | 'completed' | 'cancelled', paymentId?: string): Promise<string | null> => {
    try {
      const database = getDatabase();
      const contractRef = ref(database, `contracts/${contractId}`);
      
      const updateData: any = {
        status: status,
        updatedAt: new Date().toISOString()
      };
      
      if (paymentId) {
        updateData.paymentId = paymentId;
        updateData.paidAt = new Date().toISOString();
      }
      
      if (status === 'cancelled') {
        updateData.cancelledAt = new Date().toISOString();
      }
      
      await set(contractRef, {
        ...contractMetadata,
        ...updateData
      });
      
      console.log(`Booking ${contractId} updated to ${status}`);
      return contractId;
    } catch (error) {
      console.error("Error updating booking status:", error);
      return null;
    }
  };

  // Update booking status with deposit information (legacy function)
  const updateLegacyBookingStatusWithDeposit = async (contractId: string, status: 'deferred' | 'pending' | 'confirmed' | 'completed' | 'cancelled', paymentId?: string, depositAmount?: number): Promise<string | null> => {
    try {
      const database = getDatabase();
      const contractRef = ref(database, `contracts/${contractId}`);
      
      const updateData: any = {
        status: status,
        updatedAt: new Date().toISOString()
      };
      
      if (paymentId) {
        updateData.paymentId = paymentId;
        updateData.paidAt = new Date().toISOString();
      }
      
      if (depositAmount !== undefined) {
        updateData.deposit = depositAmount;
      }
      
      if (status === 'cancelled') {
        updateData.cancelledAt = new Date().toISOString();
      }
      
      await set(contractRef, {
        ...contractMetadata,
        ...updateData
      });
      
      console.log(`Booking ${contractId} updated to ${status} with deposit: $${depositAmount}`);
      return contractId;
    } catch (error) {
      console.error("Error updating booking status:", error);
      return null;
    }
  };

  // Save contract metadata with deposit information (legacy function)
  const saveContractMetadataWithDeposit = async (status: 'deferred' | 'pending' | 'confirmed' = 'confirmed', depositAmount: number = 0): Promise<string | null> => {
    if (!user || !allSectionsInitialed() || !typedSignature.trim() || !customerInitials.trim()) {
      console.error("Missing required contract data");
      return null;
    }

    try {
      // Fetch user profile data to get firstName and lastName
      const userDocRef = doc(firestore, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      const userData = userDoc.data();
      
      // Extract firstName and lastName, with fallbacks
      let firstName = userData?.firstName || "";
      let lastName = userData?.lastName || "";
      let fullName = userData?.name || user.displayName || "";
      
      // If we don't have firstName/lastName but have a full name, split it
      if (!firstName && !lastName && fullName) {
        const nameParts = fullName.split(' ');
        firstName = nameParts[0] || "";
        lastName = nameParts.slice(1).join(' ') || "";
      }
      
      // If we have firstName/lastName but no full name, combine them
      if ((firstName || lastName) && !fullName) {
        fullName = `${firstName} ${lastName}`.trim();
      }

      const database = getDatabase();
      const contractsRef = ref(database, 'contracts');
      const newContractRef = push(contractsRef);
      
      const contractMetadata: ContractMetadata = {
        contractId: newContractRef.key || `contract_${user.uid}_${Date.now()}`,
        userId: user.uid,
        status: status,
        deposit: depositAmount, // Set the deposit amount
        customerInfo: {
          firstName,
          lastName,
          name: fullName,
          email: user.email || ""
        },
        orderDetails: {
          eventDate: `${calendarDateRange[0]?.toLocaleDateString()} - ${calendarDateRange[1]?.toLocaleDateString()}`,
          duration: cartSettings.duration,
          deliveryAddress: deliveryAddress,
          surface: cartSettings.surface,
          deliveryTime: cartSettings.deliveryTime,
          items: [
            ...cart.map(item => ({
              name: item.name,
              quantity: item.quantity,
              price: item.isGiftCard ? (item.giftCardValue || item.price) : item.price
            })),
            ...Object.entries(lastMinuteAdditions)
              .filter(([_, quantity]) => quantity > 0)
              .map(([itemName, quantity]) => {
                const item = partyEssentials.find(p => p.name === itemName);
                const isWeekend = calendarDateRange[0] && (calendarDateRange[0].getDay() === 0 || calendarDateRange[0].getDay() === 6);
                const price = item ? (isWeekend ? item.weekendPrice : item.weekdayPrice) : 0;
                return { name: itemName, quantity, price };
              })
          ],
          totalAmount: total
        },
        agreementSections: contractSections,
        signature: {
          signatureData: typedSignature,
          signedAt: new Date().toISOString(),
          signatureMethod: 'typed'
        },
        contractDate: new Date().toLocaleDateString(),
        initials: customerInitials
      };

      await set(newContractRef, contractMetadata);
      setContractMetadata(contractMetadata);
      
      console.log("Contract metadata saved successfully with deposit:", contractMetadata.contractId);
      return contractMetadata.contractId;
    } catch (error) {
      console.error("Error saving contract metadata:", error);
      throw error;
    }
  };

  // Handle booking cancellation
  const handleCancelBooking = async () => {
    if (!pendingBookingId) {
      alert("No booking found to cancel.");
      return;
    }

    const confirmCancel = window.confirm(
      "Are you sure you want to cancel your booking? This action cannot be undone."
    );

    if (!confirmCancel) return;

    try {
      const cancelled = await updateBookingStatus(pendingBookingId, 'cancelled');
      if (cancelled) {
        notifications.show({
          title: '❌ Booking Cancelled',
          message: 'Your booking has been cancelled successfully.',
          color: 'red',
          autoClose: 5000,
        });
        
        // Redirect to home page after cancellation
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } else {
        alert("Error cancelling booking. Please try again.");
      }
    } catch (error) {
      console.error("Error cancelling booking:", error);
      alert("Error cancelling booking. Please try again.");
    }
  };

  // Save signed contract to database
  // Save contract metadata to Firebase Realtime Database
  // New function to save booking and contract data separately
  const saveBookingAndContract = async (
    bookingStatus: 'deferred' | 'pending' | 'confirmed' = 'confirmed',
    paymentType: 'full' | 'deposit' = 'full',
    depositAmount: number = 0,
    paypalOrderId?: string,
    paypalTransactionId?: string,
    contractInfo?: { sections: any[], signature: string, initials: string }
  ): Promise<{orderID: string, contractID: string} | null> => {

    const onlyGiftCards = cart.every(item => item.isGiftCard || item.isMembership);
    if (!user) {
      console.error("Missing user for booking creation");
      return null;
    }
    // Contract validation only needed if not gift cards and contract data provided
    if (!onlyGiftCards && !contractInfo) {
      console.error("Missing required contract data for non-gift-card order");
      return null;
    }

    try {
      // Fetch user profile data to get firstName and lastName
      const userDocRef = doc(firestore, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      const userData = userDoc.data();
      
      // Extract firstName and lastName, with fallbacks
      let firstName = userData?.firstName || "";
      let lastName = userData?.lastName || "";
      let fullName = userData?.name || user.displayName || "";
      
      // If we don't have firstName/lastName but have a full name, split it
      if (!firstName && !lastName && fullName) {
        const nameParts = fullName.split(' ');
        firstName = nameParts[0] || "";
        lastName = nameParts.slice(1).join(' ') || "";
      }
      
      // If we have firstName/lastName but no full name, combine them
      if ((firstName || lastName) && !fullName) {
        fullName = `${firstName} ${lastName}`.trim();
      }


      // Generate unique IDs
      const orderID = generateOrderID();
      const contractID = generateContractID();

      // Prepare booking data
      const bookingData: BookingData = {
        orderID,
        customerID: user.uid,
        status: bookingStatus,
        customerInfo: {
          firstName,
          lastName,
          name: fullName,
          email: user.email || ""
        },
        orderDetails: {
          eventDate: `${calendarDateRange[0]?.toLocaleDateString()} - ${calendarDateRange[1]?.toLocaleDateString()}`,
          duration: cartSettings.duration,
          deliveryAddress: deliveryAddress,
          surface: cartSettings.surface,
          deliveryTime: cartSettings.deliveryTime,
          items: [
            ...cart.map(item => ({
              name: item.name,
              quantity: item.quantity,
              price: item.isGiftCard ? (item.giftCardValue || item.price) : item.price
            })),
            ...Object.entries(lastMinuteAdditions)
              .filter(([_, quantity]) => quantity > 0)
              .map(([itemName, quantity]) => {
                const item = partyEssentials.find(p => p.name === itemName);
                const isWeekend = calendarDateRange[0] && (calendarDateRange[0].getDay() === 0 || calendarDateRange[0].getDay() === 6);
                const price = item ? (isWeekend ? item.weekendPrice : item.weekdayPrice) : 0;
                return { name: itemName, quantity, price };
              })
          ],
          totalAmount: total
        },
        paymentDetails: {
          totalAmount: total,
          depositAmount: depositAmount,
          remainingBalance: total - depositAmount,
          paymentType: paymentType,
          ...(paypalOrderId && { paypalOrderId }),
          ...(paypalTransactionId && { paypalTransactionId }),
          paymentStatus: bookingStatus === 'confirmed' ? 'completed' : 'pending',
          ...(bookingStatus === 'confirmed' && { paymentDate: new Date().toISOString() })
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      let bookingSaved = false;
      let contractSaved = false;

      // If only gift cards, skip contract saving
      if (onlyGiftCards) {
        bookingSaved = await saveBookingData(bookingData);
        contractSaved = true;
      } else {
        // Prepare contract data
        const contractData: ContractData = {
          contractID,
          orderID,
          customerID: user.uid,
          agreementSections: contractInfo?.sections || [],
          signature: {
            signatureData: contractInfo?.signature || '',
            signedAt: new Date().toISOString()
          },
          contractDate: new Date().toLocaleDateString(),
          initials: contractInfo?.initials || '',
          contractStatus: 'signed'
        };
        bookingSaved = await saveBookingData(bookingData);
        contractSaved = await saveContractData(contractData);
      }

      if (bookingSaved && contractSaved) {
        console.log("Booking and contract saved successfully:", orderID, contractID);
        
        // Use intelligent deferred booking strategy
        const deferredStrategy = getDeferredBookingStrategy();
        console.log("Deferred booking strategy:", deferredStrategy);
        
        if (deferredStrategy.strategy === 'partial') {
          // Partial processing: Complete gift cards/memberships, defer rental items
          console.log("Partial processing - completing gift cards/memberships, deferring rentals:", orderID);
          
          const partialTotals = calculatePartialTotals();
          
          // Update booking with partial status and notes
          const partialDeferred = await deferBooking(
            orderID, 
            `Partial booking: Gift cards/memberships processed ($${partialTotals.processableTotal.toFixed(2)}), rental items deferred due to same-day booking rules`
          );
          
          if (partialDeferred) {
            console.log("Booking partially processed:", orderID);
            notifications.show({
              title: '✨ Partial Order Complete',
              message: `Gift cards and memberships processed! Call (803) 221-0466 to confirm your rental items.`,
              color: 'blue',
              autoClose: 10000,
            });
          }
          
        } else if (deferredStrategy.strategy === 'deferred') {
          // Full deferral for rental-only carts
          console.log("Full deferral - all rental items:", orderID);
          
          const deferred = await deferBooking(orderID, deferredStrategy.reason);
          if (deferred) {
            console.log("Booking fully deferred:", orderID);
            notifications.show({
              title: '📞 Booking Deferred',
              message: 'Since your event is within 2 days, we\'ll contact you to confirm details.',
              color: 'orange',
              autoClose: 8000,
            });
          }
          
        } else {
          // Normal processing - no deferral needed
          console.log("Normal processing - no deferral required:", deferredStrategy.reason);
        }
        
        return { orderID, contractID };
      } else {
        console.error("Failed to save booking or contract data");
        return null;
      }
      
    } catch (error) {
      console.error("Error saving booking and contract:", error);
      return null;
    }
  };

  const saveContractMetadata = async (status: 'deferred' | 'pending' | 'confirmed' = 'confirmed'): Promise<string | null> => {
    if (!user || !allSectionsInitialed() || !typedSignature.trim() || !customerInitials.trim()) {
      console.error("Missing required contract data");
      return null;
    }

    try {
      // Fetch user profile data to get firstName and lastName
      const userDocRef = doc(firestore, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      const userData = userDoc.data();
      
      // Extract firstName and lastName, with fallbacks
      let firstName = userData?.firstName || "";
      let lastName = userData?.lastName || "";
      let fullName = userData?.name || user.displayName || "";
      
      // If we don't have firstName/lastName but have a full name, split it
      if (!firstName && !lastName && fullName) {
        const nameParts = fullName.split(' ');
        firstName = nameParts[0] || "";
        lastName = nameParts.slice(1).join(' ') || "";
      }
      
      // If we have firstName/lastName but no full name, combine them
      if ((firstName || lastName) && !fullName) {
        fullName = `${firstName} ${lastName}`.trim();
      }

      const database = getDatabase();
      const contractsRef = ref(database, 'contracts');
      const newContractRef = push(contractsRef);
      
      const contractMetadata: ContractMetadata = {
        contractId: newContractRef.key || `contract_${user.uid}_${Date.now()}`,
        userId: user.uid,
        status: status, // Add booking status
        deposit: 0, // Default deposit amount (will be updated when payment is made)
        customerInfo: {
          firstName,
          lastName,
          name: fullName,
          email: user.email || ""
        },
        orderDetails: {
          eventDate: `${calendarDateRange[0]?.toLocaleDateString()} - ${calendarDateRange[1]?.toLocaleDateString()}`,
          duration: cartSettings.duration,
          deliveryAddress: deliveryAddress,
          surface: cartSettings.surface,
          deliveryTime: cartSettings.deliveryTime,
          items: [
            ...cart.map(item => ({
              name: item.name,
              quantity: item.quantity,
              price: item.isGiftCard ? (item.giftCardValue || item.price) : item.price
            })),
            ...Object.entries(lastMinuteAdditions)
              .filter(([_, quantity]) => quantity > 0)
              .map(([itemName, quantity]) => {
                const item = partyEssentials.find(p => p.name === itemName);
                const isWeekend = calendarDateRange[0] && (calendarDateRange[0].getDay() === 0 || calendarDateRange[0].getDay() === 6);
                const price = item ? (isWeekend ? item.weekendPrice : item.weekdayPrice) : 0;
                return { name: itemName, quantity, price };
              })
          ],
          totalAmount: total
        },
        agreementSections: contractSections,
        signature: {
          signatureData: typedSignature,
          signedAt: new Date().toISOString(),
          signatureMethod: 'typed'
        },
        contractDate: new Date().toLocaleDateString(),
        initials: customerInitials
      };

      await set(newContractRef, contractMetadata);
      setContractMetadata(contractMetadata);
      
      console.log("Contract metadata saved successfully:", contractMetadata.contractId);
      return contractMetadata.contractId;
    } catch (error) {
      console.error("Error saving contract metadata:", error);
      throw error;
    }
  };

  if (loading || loadingBookingFromUrl) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '1.5rem'
      }}>
        {loadingBookingFromUrl ? 'Loading your booking...' : 'Loading checkout...'}
      </div>
    );
  }

  // If cart is empty and no completed order and not a membership checkout, redirect back to home
  if (cart.length === 0 && completedOrderCart.length === 0 && !isMembershipCheckout) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        gap: '1rem'
      }}>
        <h2>Your cart is empty</h2>
        <button id="btn-continue-shopping" onClick={() => navigate("/home")}>
          Continue Shopping
        </button>
      </div>
    );
  }

  return (
    <>
      <MantineProvider>
        <Notifications position="top-right" />
        {/* Dev Tools - Hidden for mobile testing */}
        {/* <LocalStorageDebugger /> */}
        
        {/* Conditional rendering for membership checkout */}
        {isMembershipCheckout ? (
          <>
            <RouterNav
              categories={categories}
              onCategoryChange={() => {}} 
              hideCartIcon={true}
              hideNavbarDropdown={true}
              hideMobileSidebar={true}
            />
            <div className="membership-checkout-wrapper">
              <MembershipCheckout onSuccess={() => navigate('/profile')} />
            </div>
          </>
        ) : (
          <>
            <RouterNav
              categories={categories}
              onCategoryChange={() => {}} // No-op on checkout page since we don't filter products here
              hideCartIcon={true} // Hide cart icon on checkout page
              hideNavbarDropdown={true} // Hide the navbar category dropdown
              hideMobileSidebar={true} // Hide mobile menu toggle on checkout page
          walletBalance={userWallet?.balance || 0}
          searchBarComponent={
            <SearchBar
              inflateables={inflateables}
              categories={categories}
              onCategorySelect={(category) => {
                // Navigate to home page with category parameter
                navigate(`/home?category=${encodeURIComponent(category)}`);
              }}
              onInflateableSelect={(product) => {
                // Navigate to home page with product parameter
                navigate(`/home?product=${encodeURIComponent(product.name)}`);
              }}
              focusCarousel={() => {
                // Navigate to home page and focus on carousel
                navigate('/home?focus=carousel');
              }}
            />
          }
        />
      <div className="checkout-container">
      <h1 className="checkout-title">
        Complete Your Order
      </h1>

      {/* Deferred Booking Special Handling */}
      {pendingBookingId && isDeferredBooking && (
        <div style={{
          backgroundColor: '#fff3cd',
          border: '2px solid #ffc107',
          borderRadius: '12px',
          padding: '2rem',
          marginBottom: '2rem',
          textAlign: 'center',
          boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ color: '#856404', marginBottom: '1rem', fontSize: '1.5rem' }}>
            ⏰ Same-Day Booking Requires Phone Call
          </h2>
          <p style={{ color: '#856404', marginBottom: '1.5rem', fontSize: '1.1rem', lineHeight: '1.5' }}>
            This booking was deferred because it's for today and requires at least 2 hours advance notice. 
            To complete your booking, please call us directly.
          </p>
          
          <div style={{
            backgroundColor: '#fff',
            border: '2px solid #28a745',
            borderRadius: '8px',
            padding: '1.5rem',
            marginBottom: '2rem',
            fontSize: '1.2rem'
          }}>
            <strong style={{ color: '#155724', fontSize: '1.4rem' }}>📞 Call us at: (803) 221-0466</strong>
            <br />
            <span style={{ color: '#155724', fontSize: '1rem' }}>
              Our team will help you complete your same-day booking
            </span>
          </div>
          
          <div style={{ 
            display: 'flex', 
            gap: '1rem', 
            justifyContent: 'center', 
            flexWrap: 'wrap',
            marginTop: '1.5rem'
          }}>
            <button
              onClick={async () => {
                if (pendingBookingId && confirm('Are you sure you want to delete this booking? This action cannot be undone.')) {
                  try {
                    // Delete the booking
                    await updateBookingStatus(pendingBookingId, 'cancelled');
                    
                    // Clear the booking state
                    setPendingBookingId('');
                    setIsDeferredBooking(false);
                    localStorage.removeItem('resumeBookingId');
                    
                    notifications.show({
                      title: '✅ Booking Deleted',
                      message: 'Your deferred booking has been successfully deleted.',
                      color: 'green',
                      autoClose: 5000,
                    });
                    
                    // Navigate back to home
                    navigate('/');
                  } catch (error) {
                    console.error('Error deleting booking:', error);
                    notifications.show({
                      title: '❌ Delete Failed',
                      message: 'Failed to delete booking. Please try again.',
                      color: 'red',
                      autoClose: 5000,
                    });
                  }
                }
              }}
              style={{
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                padding: '1rem 2rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 'bold'
              }}
            >
              🗑️ Delete This Booking
            </button>
            
            <button
              onClick={() => navigate('/')}
              style={{
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '1rem 2rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 'bold'
              }}
            >
              📝 Start New Booking
            </button>
          </div>
        </div>
      )}

      {/* Progress Indicator */}
      <div className="progress-indicator">
        <div className="progress-steps" data-current-step={(() => {
          const currentStepOrder = getStepOrder();
          return currentStepOrder.indexOf(currentStep);
        })()}>
          {(() => {
            const currentStepOrder = getStepOrder();
            return currentStepOrder.map((step, index) => {
              const isCurrentOrPast = currentStepOrder.indexOf(currentStep) >= index;
              const canGoBack = visitedSteps.has(step) && index < currentStepOrder.indexOf(currentStep);
              
              return (
                <div 
                  key={step} 
                  className={`progress-step ${canGoBack ? 'clickable' : ''}`} 
                  data-step-index={index}
                  onClick={() => {
                    if (canGoBack) {
                      setCurrentStep(step);
                    }
                  }}
                  style={{
                    cursor: canGoBack ? 'pointer' : 'default'
                  }}
                >
                  <span className={`progress-step-circle ${isCurrentOrPast ? 'active' : 'inactive'}`}>
                    {index + 1}
                  </span>
                  <label className={`progress-step-label ${isCurrentOrPast ? 'active' : 'inactive'}`}>
                    {stepTitles[step]}
                  </label>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Step Content */}
      {currentStep === 'order-summary' && (
      <div className="step-container">
        <h2 className="step-title">Order Summary</h2>
        
        {/* Cart Items */}
        <div className="order-items">
          <h3>Items:</h3>
          {getDisplayCart().map((item, idx) => (
            <div key={idx} className="order-item">
              <div className="order-item-content">
                {/* Product Image */}
                <img 
                  src={getProductImage(item.name)} 
                  alt={item.name}
                  className="order-item-image"
                  onError={(e) => {
                    // Fallback if image fails to load
                    e.currentTarget.src = 'https://storage.googleapis.com/pppro-b060e.firebasestorage.app/inflateables/default.webp';
                  }}
                />
                
                {/* Product Details */}
                <div className="order-item-details">
                  <div className="order-item-name">
                    {item.name}
                  </div>
                  <div className="order-item-info">
                    <div style={{ marginBottom: '0.5rem' }}>
                      <label htmlFor={`order-quantity-${idx}`}>Quantity: </label>
                      <select
                        id={`order-quantity-${idx}`}
                        value={item.quantity || 1}
                        onChange={(e) => {
                          if (item.category === 'party-essentials') {
                            updateCartItemQuantity(idx, parseInt(e.target.value));
                          } else {
                            // For non-party essentials, just update the cart directly
                            const updatedCart = [...cart];
                            updatedCart[idx] = { ...item, quantity: parseInt(e.target.value) };
                            setCart(updatedCart);
                            localStorage.setItem('cart', JSON.stringify(updatedCart));
                          }
                        }}
                        style={{
                          padding: '0.25rem',
                          borderRadius: '4px',
                          border: '1px solid #ddd',
                          fontSize: '0.9rem',
                          marginLeft: '0.25rem'
                        }}
                      >
                        {item.category === 'party-essentials' ? (
                          (() => {
                            const maxAvailable = getAvailableQuantityForCartItem(item, idx);
                            return Array.from({ length: Math.max(1, maxAvailable) }, (_, i) => i + 1).map(qty => (
                              <option key={qty} value={qty} disabled={qty > maxAvailable}>
                                {qty}{qty > maxAvailable ? ' (unavailable)' : ''}
                              </option>
                            ));
                          })()
                        ) : (
                          Array.from({ length: 10 }, (_, i) => i + 1).map(qty => (
                            <option key={qty} value={qty}>{qty}</option>
                          ))
                        )}
                      </select>
                      {item.category === 'party-essentials' && (
                        <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '0.5rem' }}>
                          ({getAvailableQuantityForCartItem(item, idx)} available)
                        </span>
                      )}
                    </div>
                    {item.isGiftCard ? (
                      ` ($${item.giftCardValue || item.price} each)`
                    ) : !item.isMembership && item.wetDry === "Wet/Dry" ? (
                      <span>
                        {' - '}
                        <select
                          value={cartSettings.wetDrySelections[idx] || 'Dry'}
                          onChange={(e) => cartSettings.updateWetDrySelection(idx, e.target.value as 'Wet' | 'Dry')}
                          style={{
                            padding: '0.25rem',
                            borderRadius: '4px',
                            border: '1px solid #ddd',
                            fontSize: '0.9rem',
                            marginLeft: '0.25rem'
                          }}
                        >
                          <option value="Dry">Dry</option>
                          <option value="Wet">Wet (+$50)</option>
                        </select>
                      </span>
                    ) : (
                      ''
                    )}
                  </div>
                </div>
              </div>
              
              {/* Price and Remove Button */}
              <div className="order-item-price-section">
                <div className="order-item-price">
                  ${item.isGiftCard 
                    ? ((item.giftCardValue || item.price) * item.quantity).toFixed(2)
                    : (item.price * item.quantity * durationMultiplier).toFixed(2)
                  }
                </div>
                <button
                  id={`btn-remove-item-${idx}`}
                  className="btn-remove-item"
                  onClick={() => removeItemFromCart(idx)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Event Details - only show when cart has inflateables */}
        {(() => {
          const hasInflateables = cart.some(item => !item.isGiftCard && !item.isMembership);
          return hasInflateables ? (
            <div className="event-details">
              <h3>Event Settings:</h3>
              <div className="cart-dropdowns" style={{ margin: '1rem 0' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Event Duration:
                  <select 
                    value={cartSettings.duration} 
                    onChange={e => cartSettings.setDuration(e.target.value)} 
                    required 
                    style={{ marginLeft: '0.5rem' }}
                  >
                    <option value="">Select duration</option>
                    <option value="4hours">4 Hours (-10%)</option>
                    <option value="24hours">24 Hours (Standard)</option>
                    <option value="48hours">48 Hours (+50%)</option>
                  </select>
                </label>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Surface:
                  <select 
                    value={cartSettings.surface} 
                    onChange={e => cartSettings.setSurface(e.target.value)} 
                    required 
                    style={{ marginLeft: '0.5rem' }}
                  >
                    <option value="">Select surface</option>
                    <option value="grass-stakes">Grass (stakes)</option>
                    <option value="grass-sandbags">Grass (sandbags)</option>
                    <option value="concrete">Concrete/Pavement</option>
                    <option value="indoor">Indoor</option>
                  </select>
                </label>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Delivery Time:
                  <select 
                    value={cartSettings.deliveryTime} 
                    onChange={e => cartSettings.setDeliveryTime(e.target.value)} 
                    required 
                    style={{ marginLeft: '0.5rem' }}
                  >
                    <option value="">Select time</option>
                    {getAvailableDeliveryTimes().map(timeOption => (
                      <option key={timeOption.value} value={timeOption.value}>
                        {timeOption.label}
                      </option>
                    ))}
                    {getAvailableDeliveryTimes().length === 0 && (
                      <option value="" disabled>
                        No times available (booking too soon)
                      </option>
                    )}
                  </select>
                  {getAvailableDeliveryTimes().length === 0 && calendarDateRange[0] && (
                    <div style={{ 
                      color: '#dc3545', 
                      fontSize: '0.8rem', 
                      marginTop: '0.25rem',
                      fontStyle: 'italic'
                    }}>
                      Same-day bookings require at least 2 hours notice. Please select a different date or call (803) 221-0466 for urgent requests.
                    </div>
                  )}
                </label>
              </div>
              <p><strong>Event Dates:</strong> {(() => {
                const startDate = calendarDateRange[0];
                const endDate = calendarDateRange[1];
                if (!startDate || !endDate) return 'Not selected';
                
                if (cartSettings.duration === '4hours') {
                  return startDate.toLocaleDateString();
                } else if (cartSettings.duration === '24hours') {
                  const nextDay = new Date(startDate);
                  nextDay.setDate(nextDay.getDate() + 1);
                  return `${startDate.toLocaleDateString()} - ${nextDay.toLocaleDateString()}`;
                } else if (cartSettings.duration === '48hours') {
                  const twoDaysLater = new Date(startDate);
                  twoDaysLater.setDate(twoDaysLater.getDate() + 2);
                  return `${startDate.toLocaleDateString()} - ${twoDaysLater.toLocaleDateString()}`;
                } else {
                  return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
                }
              })()}</p>
            </div>
          ) : null;
        })()}

        {/* Pricing Breakdown */}
        <div className="pricing-breakdown">
          <div className="pricing-row">
            <span>Cart Subtotal:</span>
            <span>${(() => {
              // Calculate base price without duration multiplier
              const baseCartTotal = cart.reduce((sum, item) => {
                if (item.isGiftCard) {
                  return sum + (item.giftCardValue || item.price) * item.quantity;
                } else {
                  return sum + item.price * item.quantity; // No duration multiplier here
                }
              }, 0);
              return baseCartTotal.toFixed(2);
            })()}</span>
          </div>
          {(() => {
            // Calculate duration charge
            const baseCartTotal = cart.reduce((sum, item) => {
              if (item.isGiftCard) {
                return sum + (item.giftCardValue || item.price) * item.quantity;
              } else {
                return sum + item.price * item.quantity;
              }
            }, 0);
            const rentalSubtotal = cart.reduce((sum, item) => {
              if (!item.isGiftCard && !item.isMembership) {
                return sum + item.price * item.quantity;
              }
              return sum;
            }, 0);
            const durationCharge = rentalSubtotal * (durationMultiplier - 1);
            
            if (durationCharge !== 0 && rentalSubtotal > 0) {
              return (
                <div className="pricing-row">
                  <span>Event Duration Charge ({cartSettings.duration}):</span>
                  <span>{durationCharge > 0 ? '+' : ''}${durationCharge.toFixed(2)}</span>
                </div>
              );
            }
            return null;
          })()}
          {surfaceAdj > 0 && (
            <div className="pricing-row">
              <span>Surface Adjustment (per item):</span>
              <span>${surfaceAdj.toFixed(2)}</span>
            </div>
          )}
          {timeAdj > 0 && (
            <div className="pricing-row">
              <span>Early Delivery Surcharge:</span>
              <span>${timeAdj.toFixed(2)}</span>
            </div>
          )}
          
          {deliveryCost > 0 && (
            <div className="pricing-row">
              <span>Delivery Cost:</span>
              <span>${deliveryCost.toFixed(2)}</span>
            </div>
          )}
          <div className="pricing-total">
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
        
        {/* Navigation Buttons */}
        <div className="checkout-navigation-buttons">
          <button
            id="btn-back-delivery"
            onClick={goToPreviousStep}
          >
            Back to Delivery
          </button>
          <button
            id="btn-main-flow"
            onClick={() => goToNextStep()}
            disabled={!canShowNextButton()}
          >
            {getNextStepButtonText()}
          </button>
        </div>
      </div>
      )}

      {currentStep === 'delivery' && (
      <div className="step-container">
        <h2 className="step-title">Delivery Information</h2>
        <p className="delivery-description">
          Enter the address where you want your rental items delivered and select the event location type.
        </p>
        
        <div className="delivery-input-section">
          <label style={{ display: 'block', marginBottom: '1rem' }}>
            Delivery Address:
            <GooglePlacesAutocomplete
              value={deliveryAddress}
              onChange={handleAddressChange}
              onPlaceSelected={handlePlaceSelected}
              placeholder="Select delivery address..."
              inputRef={addressInputRef}
              style={{ 
                width: '100%', 
                padding: '0.75rem', 
                fontSize: '1rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                marginTop: '0.5rem'
              }}
            />
          </label>
          
          <label style={{ display: 'block', marginBottom: '1rem' }}>
            Event Location:
            <select 
              value={cartSettings.location} 
              onChange={e => cartSettings.setLocation(e.target.value)} 
              required 
              style={{ 
                marginLeft: '0.5rem',
                padding: '0.75rem', 
                fontSize: '1rem',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            >
              <option value="">Select location type</option>
              {locationOptions.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </label>
        </div>
        
        <button
          id="btn-calculate-distance"
          onClick={() => {
            const inputValue = addressInputRef.current?.value?.trim();
            if (inputValue) {
              console.log('🔄 CALCULATE BUTTON CLICKED:');
              console.log('  - Input field value:', inputValue);
              console.log('  - Current deliveryAddress state:', deliveryAddress);
              
              // Update deliveryAddress state to match input field content
              flushSync(() => {
                setDeliveryAddress(inputValue);
              });
              
              console.log('  - Updated deliveryAddress to:', inputValue);
              
              // If this looks like a Google Places address, add it to the validation set
              const looksLikeGooglePlaces = inputValue.includes(',') && 
                (inputValue.toUpperCase().includes('USA') || 
                 inputValue.toUpperCase().includes('UNITED STATES') || 
                 /,\s*[A-Z]{2}[\s,]/.test(inputValue));
              
              if (looksLikeGooglePlaces) {
                setGooglePlacesAddresses(prev => new Set(prev).add(inputValue));
                console.log('  - Added to Google Places addresses:', inputValue);
              }
              
              calculateDeliveryDistance(inputValue);
            } else {
              notifications.show({
                title: '📍 Address Required',
                message: 'Please enter a delivery address first.',
                color: 'yellow',
                autoClose: 4000,
              });
            }
          }}
          disabled={calculatingDistance || !deliveryAddress.trim()}
          style={{ display: 'none' }}
        >
          {calculatingDistance ? 'Calculating...' : 'Calculate Delivery Cost'}
        </button>
        
        {/* Development Skip Button */}
        {import.meta.env.DEV && (
          <button
            id="btn-skip-delivery"
            onClick={() => {
              console.log('🚀 SKIPPING DELIVERY CALCULATION FOR DEVELOPMENT');
              console.log('Before skip - deliverySkipped:', deliverySkipped);
              console.log('Before skip - deliveryCost:', deliveryCost);
              console.log('Before skip - canShowNextButton():', canShowNextButton());
              
              // Set a default address if none exists
              if (!deliveryAddress.trim()) {
                setDeliveryAddress('123 Test Street, Test City, SC 29841');
              }
              
              // Set default location if not selected
              if (!cartSettings.location) {
                cartSettings.setLocation('personal home');
              }
              
              setDeliveryCost(0);
              setDeliverySkipped(true); // Mark delivery as skipped
              setCalculatingDistance(false);
              
              // Add current address to failed addresses to prevent automatic retries
              if (deliveryAddress.trim()) {
                setFailedAddresses(prev => new Set(prev).add(deliveryAddress));
              }
              
              // Use setTimeout to check state after React updates
              setTimeout(() => {
                console.log('After skip - deliverySkipped should be true');
                console.log('After skip - deliveryCost:', deliveryCost);
              }, 100);
              
              notifications.show({
                title: '🚀 Development Mode',
                message: 'Delivery calculation skipped - you can now proceed to next step',
                color: 'blue',
                autoClose: 3000,
              });
            }}
            style={{
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              marginTop: '1rem',
              marginBottom: '1rem'
            }}
          >
            Skip Delivery (Dev)
          </button>
        )}
        
        {/* Automatically calculate delivery in the background */}
        {deliveryAddress.trim() && (

          <div style={{ display: 'none' }}>

            {(() => {

              // Automatically trigger delivery calculation when address is entered

              // Only calculate if we have a valid address and haven't calculated yet

              const isValidAddress = deliveryAddress.trim().length > 10 && 

                (deliveryAddress.includes(',') || deliveryAddress.toLowerCase().includes('sc') || deliveryAddress.toLowerCase().includes('ga'));

              

              // Don't retry addresses that have already failed

              const hasAlreadyFailed = failedAddresses.has(deliveryAddress);

              

              // Don't calculate if delivery was skipped or if address has failed

              if (isValidAddress && !calculatingDistance && deliveryCost === 0 && !hasAlreadyFailed && !deliverySkipped) {

                setTimeout(() => {

                  if (!calculatingDistance && deliveryCost === 0 && !failedAddresses.has(deliveryAddress) && !deliverySkipped) {

                    calculateDeliveryDistance(deliveryAddress);

                  }

                }, 500);

              }

              return null;

            })()}

          </div>

        )}
        
        {/* Hide the delivery cost display - it will be included in the total automatically */}
        
        {/* Navigation Buttons */}
        <div className="checkout-navigation-buttons">
          <button
            id="btn-back-quick-add"
            onClick={goToPreviousStep}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '1rem 2rem',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: 'pointer'
            }}
          >
            Back to Quick Add
          </button>
          <button
            id="btn-forward-delivery"
            onClick={() => goToNextStep()}
            disabled={!canShowNextButton()}
          >
            {getNextStepButtonText()}
          </button>
        </div>
      </div>
      )}

      {(currentStep === 'quick-add-totals' || currentStep === 'contract') && (
        <div className={currentStep === 'contract' ? 'contract-container' : 'step-container'}>
          {currentStep === 'quick-add-totals' && (
            <>
              <h2 className="step-title">Cart Items & Party Essentials</h2>
              <p className="quick-add-description">
                Complete your cart item selections and add any last-minute party essentials.
              </p>

              {/* Display Current Cart Items */}
              <div className="cart-items-display">
                <h3>Your Cart Items</h3>
                {cart.length > 0 ? (
                  <div className="cart-items-list">
                    {cart.map((item, index) => (
                      <div key={index} className="cart-item-preview">
                        <img 
                          src={getProductImage(item.name)} 
                          alt={item.name} 
                          className="cart-item-image"
                          onError={(e) => {
                            e.currentTarget.src = 'https://storage.googleapis.com/pppro-b060e.firebasestorage.app/inflateables/default.webp';
                          }}
                        />
                        <div className="cart-item-info">
                          <h4>{item.name}</h4>
                          {/* Quantity Selection Dropdown - All Items */}
                          <div className="quantity-selection" style={{ marginBottom: '0.5rem' }}>
                            <label htmlFor={`quantity-${index}`}>Quantity: </label>
                            <select
                              id={`quantity-${index}`}
                              value={item.quantity || 1}
                              onChange={(e) => {
                                if (item.category === 'party-essentials') {
                                  updateCartItemQuantity(index, parseInt(e.target.value));
                                } else {
                                  // For non-party essentials, just update the cart directly
                                  const updatedCart = [...cart];
                                  updatedCart[index] = { ...item, quantity: parseInt(e.target.value) };
                                  setCart(updatedCart);
                                  localStorage.setItem('cart', JSON.stringify(updatedCart));
                                }
                              }}
                              style={{
                                padding: '0.25rem',
                                borderRadius: '4px',
                                border: '1px solid #ddd',
                                fontSize: '0.9rem',
                                marginLeft: '0.25rem'
                              }}
                            >
                              {item.category === 'party-essentials' ? (
                                (() => {
                                  const maxAvailable = getAvailableQuantityForCartItem(item, index);
                                  console.log('🔍 [DROPDOWN DEBUG] Rendering dropdown for:', {
                                    itemName: item.name,
                                    maxAvailable,
                                    category: item.category
                                  });
                                  return Array.from({ length: Math.max(1, maxAvailable) }, (_, i) => i + 1).map(qty => (
                                    <option key={qty} value={qty} disabled={qty > maxAvailable}>
                                      {qty}{qty > maxAvailable ? ' (unavailable)' : ''}
                                    </option>
                                  ));
                                })()
                              ) : (
                                Array.from({ length: 10 }, (_, i) => i + 1).map(qty => (
                                  <option key={qty} value={qty}>{qty}</option>
                                ))
                              )}
                            </select>
                            {item.category === 'party-essentials' && (
                              <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '0.5rem' }}>
                                ({getAvailableQuantityForCartItem(item, index)} available)
                              </span>
                            )}
                          </div>
                          {/* Date display removed - selectedDates not in CartItem type */}
                          {/* Wet/Dry Selection Dropdown */}
                          {item.wetDry === 'Wet/Dry' && !item.isGiftCard && !item.isMembership && (
                            <div className="wet-dry-selection">
                              <label htmlFor={`wetdry-${index}`}>Type: </label>
                              <select
                                id={`wetdry-${index}`}
                                value={cartSettings.wetDrySelections[index] || 'Dry'}
                                onChange={(e) => cartSettings.updateWetDrySelection(index, e.target.value as 'Wet' | 'Dry')}
                                style={{
                                  padding: '0.25rem',
                                  borderRadius: '4px',
                                  border: '1px solid #ddd',
                                  fontSize: '0.9rem'
                                }}
                              >
                                <option value="Dry">Dry</option>
                                <option value="Wet">Wet (+$50)</option>
                              </select>
                            </div>
                          )}

                        </div>
                        <div className="cart-item-price">
                          ${typeof item.price === 'number' ? item.price.toFixed(2) : item.price}
                        </div>
                        {/* Delete Button */}
                        <button
                          className="cart-item-delete"
                          onClick={() => removeItemFromCart(index)}
                          style={{
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            marginLeft: '1rem'
                          }}
                          title={`Remove ${item.name} from cart`}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-cart-items">No items in cart</p>
                )}
              </div>

              <h3>Add Party Essentials</h3>
            </>
          )}
          
          {currentStep === 'contract' && (
            <>
              {/* Contract Header */}
              <div className="contract-header">
                <h1 className="contract-title">
                  JUMP CSRA PARTY RENTAL AGREEMENT
                </h1>
                <p className="contract-date">
                  Event Date: {calendarDateRange[0]?.toLocaleDateString()} - {calendarDateRange[1]?.toLocaleDateString()}
                </p>
              </div>
            </>
          )}
          
          {currentStep === 'quick-add-totals' && (
            <>
              {/* Party Essentials Carousel */}
              <div className="party-essentials-carousel">
            {partyEssentials.map((item) => {
              const isWeekend = calendarDateRange[0] && (calendarDateRange[0].getDay() === 0 || calendarDateRange[0].getDay() === 6);
              const price = isWeekend ? item.weekendPrice : item.weekdayPrice;
              const currentQuantity = lastMinuteAdditions[item.name] || 0;
              
              return (
                <div
                  key={item.name}
                  className={`party-essential-item ${currentQuantity > 0 ? 'selected' : ''}`}
                >
                  <img 
                    src={item.img} 
                    alt={item.name}
                    className="party-essential-image"
                  />
                  <h4 className="party-essential-name">{item.name}</h4>
                  <p className="party-essential-price">
                    ${price}/each
                  </p>
                  
                  {currentQuantity > 0 ? (
                    <div className="party-essential-selected">
                      <p className="party-essential-added-info">
                        Added: {currentQuantity} x ${price} = ${(currentQuantity * price * durationMultiplier).toFixed(2)}
                      </p>
                      <button
                        id={`btn-change-qty-${item.name.replace(/\s+/g, '-').toLowerCase()}`}
                        className="btn-change-qty"
                        onClick={() => handleAddToOrderClick(item.name)}
                      >
                        Change Qty
                      </button>
                      <button
                        id={`btn-remove-last-minute-${item.name.replace(/\s+/g, '-').toLowerCase()}`}
                        className="btn-remove-last-minute"
                        onClick={() => handleAddLastMinuteItem(item.name, 0)}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      {loadingAvailability ? (
                        <p className="party-essential-loading">
                          Checking availability...
                        </p>
                      ) : (
                        <>
                          {getAvailableQuantityForItem(item.name) === 0 ? (
                            <>
                              <p className="party-essential-unavailable">
                                Not Available
                              </p>
                              <button
                                id={`btn-add-to-order-${item.name.replace(/\s+/g, '-').toLowerCase()}`}
                                className="btn-add-to-order disabled"
                                disabled
                              >
                                Out of Stock
                              </button>
                            </>
                          ) : (
                            <>
                              <p className="party-essential-available">
                                {getAvailableQuantityForItem(item.name)} available
                              </p>
                              <button
                                id={`btn-add-to-order-${item.name.replace(/\s+/g, '-').toLowerCase()}`}
                                className="btn-add-to-order"
                                onClick={() => handleAddToOrderClick(item.name)}
                              >
                                Add to Order
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Last-minute additions summary */}
          {Object.values(lastMinuteAdditions).some(qty => qty > 0) && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              border: '1px solid #dee2e6'
            }}>
              <h4 className="essentials-header">Added Essentials:</h4>
              {Object.entries(lastMinuteAdditions)
                .filter(([_, quantity]) => quantity > 0)
                .map(([itemName, quantity]) => {
                  const item = partyEssentials.find(p => p.name === itemName);
                  if (!item) return null;
                  const isWeekend = calendarDateRange[0] && (calendarDateRange[0].getDay() === 0 || calendarDateRange[0].getDay() === 6);
                  const price = isWeekend ? item.weekendPrice : item.weekdayPrice;
                  return (
                    <div key={itemName} className="essentials-item-row">
                      <span>{itemName} x{quantity}</span>
                      <span>${(quantity * price * durationMultiplier).toFixed(2)}</span>
                    </div>
                  );
                })
              }
              <div className="essentials-total">
                <span>Essentials Total:</span>
                <span>${lastMinuteTotal.toFixed(2)}</span>
              </div>
            </div>
          )}
        
        {/* Navigation Buttons */}
        {(deliveryCost > 0 || Object.values(lastMinuteAdditions).some(qty => qty > 0)) && (
          <div style={{ 
            backgroundColor: 'white', 
            padding: '2rem', 
            borderRadius: '8px', 
            marginBottom: '2rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h2 className="step-title">Updated Order Total</h2>
          
          {/* Pricing Breakdown */}
          <div className="pricing-breakdown">
            <div className="pricing-row">
              <span>Original Cart:</span>
              <span>${cartTotal.toFixed(2)}</span>
            </div>
            {lastMinuteTotal > 0 && (
              <div className="pricing-row">
                <span>Party Essentials:</span>
                <span>${lastMinuteTotal.toFixed(2)}</span>
              </div>
            )}
            {surfaceAdj > 0 && (
              <div className="pricing-row">
                <span>Surface Adjustment (per item):</span>
                <span>${surfaceAdj.toFixed(2)}</span>
              </div>
            )}
            {timeAdj > 0 && (
              <div className="pricing-row">
                <span>Delivery Time Adjustment (per item):</span>
                <span>${timeAdj.toFixed(2)}</span>
              </div>
            )}
            {deliveryCost > 0 && (
              <div className="pricing-row">
                <span>Delivery Cost:</span>
                <span>${deliveryCost.toFixed(2)}</span>
              </div>
            )}
            <div className="pricing-total">
              <span>Final Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
        )}
            </>
        )}
        
        {/* Contract Section - Only show when currentStep is 'contract' */}
        {currentStep === 'contract' && (
          <ContractSigning
            user={user}
            userProfile={userProfile}
            calendarDateRange={calendarDateRange}
            deliveryAddress={deliveryAddress}
            total={total}
            onContractComplete={handleContractCompletion}
          />
        )}
        
        {/* Navigation Buttons - Show different buttons based on current step */}
        {visitedSteps.has('quick-add-totals') && (
          <div className="checkout-navigation-buttons">
            {currentStep === 'quick-add-totals' && (
              <>
                <button
                  id="btn-forward-quick-add"
                  onClick={() => goToNextStep()}
                  disabled={!canShowNextButton()}
                >
                  {getNextStepButtonText()}
                </button>
              </>
            )}
            {currentStep === 'contract' && (
              <>
                <button
                  id="btn-back-order-summary"
                  onClick={goToPreviousStep}
                  style={{
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    padding: '1rem 2rem',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    cursor: 'pointer'
                  }}
                >
                  ← Back to Order Summary
                </button>
              </>
            )}
          </div>
        )}

        {/* Contract Step Back Button - Always show when in contract step */}
        {currentStep === 'contract' && !visitedSteps.has('quick-add-totals') && (
          <div className="checkout-navigation-buttons">
            <button
              id="btn-back-contract-only"
              onClick={goToPreviousStep}
              style={{
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '1rem 2rem',
                borderRadius: '4px',
                fontSize: '1rem',
                cursor: 'pointer'
              }}
            >
              ← Back to Order Summary
            </button>
          </div>
        )}
        </div>
      )}

      {currentStep === 'payment' && !paymentCompleted && (
        <div style={{ 
          backgroundColor: 'white', 
          padding: '2rem', 
          borderRadius: '8px', 
          marginBottom: '2rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ marginBottom: '1rem', color: '#333' }}>Payment</h2>
          
          {/* Empty Cart Check for Resumed Bookings */}
          {cart.length === 0 && pendingBookingId && (
            <div style={{
              backgroundColor: '#fff3cd',
              border: '1px solid #ffeaa7',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              <h3 style={{ color: '#856404', marginBottom: '0.5rem' }}>⚠️ Cart is Empty</h3>
              <p style={{ color: '#856404', marginBottom: '1rem' }}>
                Your cart is empty, but you have a booking in progress. This might happen if your session expired or the booking data couldn't be restored.
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    // Clear the booking and redirect to home
                    setPendingBookingId('');
                    setCurrentStep('order-summary');
                    localStorage.removeItem('resumeBookingId');
                    navigate('/');
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
                  Start New Booking
                </button>
                <button
                  onClick={async () => {
                    // Try to reload booking data
                    if (pendingBookingId) {
                      try {
                        console.log('🔄 [RESTORE] Attempting to restore cart from booking:', pendingBookingId);
                        const booking = await loadBookingData(pendingBookingId);
                        console.log('🔍 [RESTORE] Loaded booking data:', booking);
                        
                        if (booking?.orderDetails?.items) {
                          console.log('✅ [RESTORE] Found items in booking:', booking.orderDetails.items);
                          const restoredCart = booking.orderDetails.items.map((item, index) => ({
                            id: `${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${index}`,
                            name: item.name,
                            price: item.price,
                            quantity: item.quantity,
                            category: 'inflateable',
                            wetDry: (item as any).wetDry || 'Wet/Dry',
                            wet: true,
                            dry: true
                          }));
                          
                          console.log('🔄 [RESTORE] Restored cart format:', restoredCart);
                          setCart(restoredCart);
                          
                          notifications.show({
                            title: '✅ Cart Restored',
                            message: 'Successfully restored your cart items.',
                            color: 'green',
                            autoClose: 3000,
                          });
                        } else {
                          console.warn('❌ [RESTORE] No items found in booking orderDetails');
                          notifications.show({
                            title: '⚠️ No Items Found',
                            message: 'No items found in the booking to restore.',
                            color: 'orange',
                            autoClose: 5000,
                          });
                        }
                      } catch (error) {
                        console.error('❌ [RESTORE] Error reloading booking:', error);
                        notifications.show({
                          title: '❌ Restore Failed',
                          message: 'Could not restore cart items from booking.',
                          color: 'red',
                          autoClose: 5000,
                        });
                      }
                    } else {
                      console.warn('❌ [RESTORE] No pendingBookingId available');
                      notifications.show({
                        title: '❌ No Booking ID',
                        message: 'No booking ID found to restore from.',
                        color: 'red',
                        autoClose: 5000,
                      });
                    }
                  }}
                  style={{
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Try to Restore Cart
                </button>
              </div>
            </div>
          )}
          
          {/* Call Requirement Notice */}
          {requiresPhoneCall && (
            <div style={{ 
              backgroundColor: '#fff3cd', 
              border: '1px solid #ffeaa7',
              borderRadius: '8px',
              padding: '1.5rem',
              marginBottom: '2rem',
              textAlign: 'center'
            }}>
              <h3 style={{ 
                color: '#856404', 
                marginBottom: '1rem',
                fontSize: '1.2rem',
                fontWeight: 'bold'
              }}>
                📞 Phone Verification Required
              </h3>
              <p style={{ 
                color: '#856404', 
                marginBottom: '1rem',
                fontSize: '1rem',
                lineHeight: '1.5'
              }}>
                Your booking is scheduled within the next 2 days. To ensure availability and proper setup, 
                please call us to verify your order before completing payment.
              </p>
              <div style={{ 
                fontSize: '1.3rem', 
                fontWeight: 'bold',
                color: '#dc3545',
                marginBottom: '1rem'
              }}>
                📞 (803) 221-0466
              </div>
              <p style={{ 
                color: '#856404', 
                fontSize: '0.9rem',
                fontStyle: 'italic',
                marginBottom: '1.5rem'
              }}>
                Your booking is scheduled within the next 2 days and requires manual verification. 
                Your booking has been saved as deferred. Please call us to confirm availability.
                After confirmation, we will send you a payment link via email.
              </p>
              
              <button
                onClick={handleCancelBooking}
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Cancel Booking
              </button>
            </div>
          )}
          
          {/* Order Summary */}
          <div style={{ 
            marginBottom: '2rem', 
            padding: '1rem', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '4px' 
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#333' }}>Order Summary</h3>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Items:</strong>
              {getDisplayCart().map((item, index) => (
                <div key={index} style={{ marginLeft: '1rem', color: '#666' }}>
                  • {item.name} - ${item.price.toFixed(2)}
                  {item.wetDry && ` (${item.wetDry})`}
                </div>
              ))}
            </div>
            <div style={{ marginBottom: '0.5rem', color: '#666' }}>
              <strong>Subtotal:</strong> ${getDisplayCartTotal().toFixed(2)}
            </div>
            <div style={{ marginBottom: '0.5rem', color: '#666' }}>
              <strong>Delivery:</strong> ${deliveryCost.toFixed(2)}
            </div>
            <div style={{ 
              fontSize: '1.2rem', 
              fontWeight: 'bold', 
              borderTop: '1px solid #ddd', 
              paddingTop: '0.5rem',
              color: '#333'
            }}>
              <strong>Total: ${calculateTotalAmount()}</strong>
            </div>
          </div>

          {/* Promotional Gift Card Section - Show when GOGO discount is active AND has gift cards */}
          {discounts.bogoGiftCard && cart.some(item => item.isGiftCard) && (
            <div style={{ 
              marginBottom: '2rem',
              padding: '1rem',
              backgroundColor: '#fff9c4',
              border: '2px solid #f9ca24',
              borderRadius: '8px'
            }}>
              <h3 style={{ marginBottom: '1rem', color: '#f39801' }}>🎁 GOGO Special Offer!</h3>
              <p style={{ color: '#8c6d00', marginBottom: '1rem' }}>
                You qualify for a FREE gift card with your purchase! 
                The promotional gift card will be sent separately and must be used by someone else.
              </p>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: 'bold',
                  color: '#8c6d00'
                }}>
                  Send promotional gift card to (optional):
                </label>
                <input
                  type="email"
                  placeholder="Recipient's email address (leave blank to send to your email)"
                  value={promotionalGiftCardEmail}
                  onChange={(e) => setPromotionalGiftCardEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #f9ca24',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    backgroundColor: '#fffef5'
                  }}
                />
              </div>
              <div style={{ fontSize: '0.8rem', color: '#8c6d00', fontStyle: 'italic' }}>
                * If no email is provided, the promotional gift card will be sent to your account email
              </div>
            </div>
          )}

          {/* Partial Processing Notification */}
          {(() => {
            const strategy = getDeferredBookingStrategy();
            if (strategy.strategy === 'partial') {
              const composition = analyzeCartComposition();
              const partialTotals = calculatePartialTotals();
              return (
                <div style={{
                  backgroundColor: '#e3f2fd',
                  border: '2px solid #2196f3',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  marginBottom: '2rem',
                  textAlign: 'center'
                }}>
                  <h3 style={{ color: '#1565c0', marginBottom: '1rem', fontSize: '1.2rem' }}>
                    🔄 Partial Order Processing
                  </h3>
                  <div style={{ color: '#1976d2', marginBottom: '1rem' }}>
                    <strong>Today's Payment:</strong> ${partialTotals.processableTotal.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#1565c0', marginBottom: '0.5rem' }}>
                    ✅ <strong>Processing Now:</strong> {composition.giftCardItems.length} gift card(s) + {composition.membershipItems.length} membership(s)
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#1565c0', marginBottom: '1rem' }}>
                    📞 <strong>Requires Call:</strong> {composition.rentalItems.length} rental item(s) - ${partialTotals.rentalTotal.toFixed(2)}
                  </div>
                  <div style={{ 
                    backgroundColor: '#fff3e0',
                    padding: '0.8rem',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    color: '#f57c00'
                  }}>
                    Your gift cards and memberships will be processed immediately. 
                    For rental items, please call <strong>(803) 221-0466</strong> to complete booking.
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Wallet Section */}
          {!requiresPhoneCall && userWallet && userWallet.balance > 0 && (
            <div style={{ 
              marginBottom: '2rem',
              padding: '1rem',
              backgroundColor: '#e8f5e8',
              border: '2px solid #4CAF50',
              borderRadius: '8px'
            }}>
              <h3 style={{ marginBottom: '1rem', color: '#2e7d32' }}>💰 Wallet Balance</h3>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}>
                <div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#2e7d32' }}>
                    Available: ${userWallet.balance.toFixed(2)}
                  </div>
                  {useWalletFirst && (
                    <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                      Applied: ${walletAppliedAmount.toFixed(2)} | 
                      PayPal: ${calculatePayPalAmount().toFixed(2)}
                    </div>
                  )}
                </div>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  cursor: 'pointer',
                  fontSize: '1rem',
                  color: '#2e7d32',
                  fontWeight: '600'
                }}>
                  <input
                    type="checkbox"
                    checked={useWalletFirst}
                    onChange={(e) => setUseWalletFirst(e.target.checked)}
                    style={{ 
                      marginRight: '0.5rem',
                      transform: 'scale(1.2)'
                    }}
                  />
                  Use Wallet First
                </label>
              </div>
              {useWalletFirst && walletAppliedAmount >= parseFloat(paymentType === 'deposit' ? calculateDepositAmount() : calculateTotalAmount()) && (
                <div style={{ 
                  padding: '1rem',
                  backgroundColor: '#c8e6c9',
                  borderRadius: '4px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: '#1b5e20'
                }}>
                  🎉 Order fully covered by wallet! No additional payment needed.
                </div>
              )}
            </div>
          )}

          {/* PayPal Payment */}
          {!requiresPhoneCall && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', color: '#333' }}>
                {useWalletFirst && calculatePayPalAmount() > 0 ? 'Complete Remaining Payment' : 'Complete Payment'}
              </h3>
              
              {/* Show wallet-only completion button if fully covered */}
              {useWalletFirst && calculatePayPalAmount() <= 0 && (
                <div style={{ 
                  textAlign: 'center',
                  padding: '2rem',
                  backgroundColor: '#e8f5e8',
                  borderRadius: '8px',
                  border: '2px solid #4CAF50'
                }}>
                  <div style={{ 
                    fontSize: '1.3rem', 
                    color: '#2e7d32',
                    marginBottom: '1rem',
                    fontWeight: 'bold'
                  }}>
                    🎉 Order fully covered by wallet balance!
                  </div>
                  <button
                    onClick={async () => {
                      // Process wallet-only payment
                      await onWalletOnlyPayment();
                    }}
                    style={{
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      border: 'none',
                      padding: '1rem 2rem',
                      borderRadius: '8px',
                      fontSize: '1.1rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      boxShadow: '0 4px 8px rgba(76, 175, 80, 0.3)'
                    }}
                  >
                    Complete Order with Wallet
                  </button>
                </div>
              )}
              
              {/* Hide payment options if booking is deferred */}
              {!isDeferredBooking && (
                <div>
                  {/* Payment Type Selection */}
                  <div style={{ 
                    marginBottom: '2rem', 
                    padding: '1rem', 
                    backgroundColor: '#f8f9fa', 
                    borderRadius: '4px',
                    border: '1px solid #dee2e6'
                  }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: '#333' }}>Choose Payment Option:</h4>
                
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    cursor: 'pointer',
                    padding: '1rem',
                    border: paymentType === 'full' ? '2px solid #28a745' : '2px solid #ddd',
                    borderRadius: '4px',
                    backgroundColor: paymentType === 'full' ? '#f8fff8' : '#fff',
                    flex: hasInflatables() ? 1 : 'auto'
                  }}>
                    <input
                      type="radio"
                      name="paymentType"
                      value="full"
                      checked={paymentType === 'full'}
                      onChange={() => {
                        setPaymentType('full');
                      }}
                      style={{ margin: 0 }}
                    />
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#333' }}>Full Payment</div>
                      <div style={{ color: '#666', fontSize: '0.9rem' }}>
                        {useWalletFirst && userWallet && userWallet.balance > 0 ? (
                          <>
                            Total: ${calculateTotalAmount()}{' '}
                            {calculateWalletApplicableAmount() > 0 && (
                              <span style={{ color: '#2e7d32' }}>
                                (Wallet: ${Math.min(userWallet.balance, parseFloat(calculateTotalAmount())).toFixed(2)}, 
                                PayPal: ${Math.max(0, parseFloat(calculateTotalAmount()) - Math.min(userWallet.balance, parseFloat(calculateTotalAmount()))).toFixed(2)})
                              </span>
                            )}
                          </>
                        ) : (
                          `Pay ${calculateTotalAmount()} - Booking confirmed immediately`
                        )}
                      </div>
                    </div>
                  </label>
                  
                  {/* Only show deposit option if there are inflateables and it's not partial processing */}
                  {(() => {
                    const strategy = getDeferredBookingStrategy();
                    const hasInflatablesInCart = hasInflatables();
                    
                    // Don't show deposit option for partial processing (gift cards/memberships are always paid in full)
                    return hasInflatablesInCart && strategy.strategy !== 'partial';
                  })() && (
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      cursor: 'pointer',
                      padding: '1rem',
                      border: paymentType === 'deposit' ? '2px solid #28a745' : '2px solid #ddd',
                      borderRadius: '4px',
                      backgroundColor: paymentType === 'deposit' ? '#f8fff8' : '#fff',
                      flex: 1
                    }}>
                      <input
                        type="radio"
                        name="paymentType"
                        value="deposit"
                        checked={paymentType === 'deposit'}
                        onChange={() => {
                          setPaymentType('deposit');
                        }}
                        style={{ margin: 0 }}
                      />
                      <div>
                        <div style={{ fontWeight: 'bold', color: '#333' }}>50% Deposit</div>
                        <div style={{ color: '#666', fontSize: '0.9rem' }}>
                          {useWalletFirst && userWallet && userWallet.balance > 0 ? (
                            <>
                              Deposit: ${calculateDepositAmount()}{' '}
                              {calculateWalletApplicableAmount() > 0 && (
                                <span style={{ color: '#2e7d32' }}>
                                  (Wallet: ${Math.min(userWallet.balance, parseFloat(calculateDepositAmount())).toFixed(2)}, 
                                  PayPal: ${Math.max(0, parseFloat(calculateDepositAmount()) - Math.min(userWallet.balance, parseFloat(calculateDepositAmount()))).toFixed(2)})
                                </span>
                              )}
                              <br />
                              Remaining: ${calculateRemainingBalance()} before event
                            </>
                          ) : (
                            `Pay ${calculateDepositAmount()} now, ${calculateRemainingBalance()} before event`
                          )}
                        </div>
                      </div>
                    </label>
                  )}
                </div>
                
                {paymentType === 'deposit' && (
                  <div style={{ 
                    padding: '0.75rem', 
                    backgroundColor: '#fff3cd', 
                    border: '1px solid #ffeaa7',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    color: '#856404'
                  }}>
                    <strong>Deposit Information:</strong> Your booking will be secured with this deposit. 
                    The remaining balance of ${calculateRemainingBalance()} must be paid before your event date.
                  </div>
                )}
              </div>
              
              {processingPayment && (
                <div style={{ 
                  padding: '1rem', 
                  backgroundColor: '#e3f2fd', 
                  borderRadius: '4px', 
                  marginBottom: '1rem',
                  textAlign: 'center'
                }}>
                  <p style={{ margin: 0, color: '#1976d2' }}>Processing payment...</p>
                </div>
              )}
              
              {/* Only show PayPal buttons if there's an amount to pay via PayPal */}
              {/* Always show PayPal buttons if there's an amount to pay via PayPal */}
              {(!useWalletFirst || calculatePayPalAmount() > 0) && (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: '1rem',
                  width: '100%',
                  maxWidth: '500px',
                  margin: '0 auto'
                }}>
                  <PayPalScriptProvider options={{ 
                    clientId: "AWT5np0jyr8BIdzyJvoWm0X9158l2F0l0rPjE6q925D5VnZVix4uwDRSivBe8Vs4sjCO8Hu-io5mSxM0", // Your PayPal sandbox client ID
                    currency: "USD",
                    intent: "capture",
                    components: "buttons,funding-eligibility",
                    "enable-funding": "card,paylater",
                    "disable-funding": "venmo"
                  }}>
                    {/* Credit/Debit Card Button */}
                    <div style={{ width: '100%' }}>
                      <PayPalButtons
                        style={{ 
                          layout: "vertical",
                          color: "black",
                          shape: "rect",
                          label: "pay",
                          height: 45,
                          tagline: false
                        }}
                        fundingSource="card"
                        createOrder={createPayPalOrder}
                        onApprove={onPayPalApprove}
                        onError={onPayPalError}
                        disabled={processingPayment}
                        forceReRender={[calculatePayPalAmount()]}
                      />
                    </div>
                    
                    {/* PayPal Button */}
                    <div style={{ width: '100%' }}>
                      <PayPalButtons
                        style={{ 
                          layout: "vertical",
                          color: "gold",
                          shape: "rect",
                          label: "paypal",
                          height: 45,
                          tagline: false
                        }}
                        fundingSource="paypal"
                        createOrder={createPayPalOrder}
                        onApprove={onPayPalApprove}
                        onError={onPayPalError}
                        disabled={processingPayment}
                        forceReRender={[calculatePayPalAmount()]}
                      />
                    </div>
                  </PayPalScriptProvider>
                </div>
              )}
            </div>
          )}
        </div>
      )}
        
        {/* Show message for deferred bookings */}
        {isDeferredBooking && (
            <div style={{
              backgroundColor: '#fff3cd',
              border: '2px solid #ffc107',
              borderRadius: '8px',
              padding: '2rem',
              marginBottom: '2rem',
              textAlign: 'center'
            }}>
              <h3 style={{ color: '#856404', marginBottom: '1rem' }}>
                ⏰ Payment Not Available for Deferred Bookings
              </h3>
              <p style={{ color: '#856404', marginBottom: '1rem' }}>
                This booking was deferred due to same-day booking rules. You must call us to complete the payment.
              </p>
              <div style={{
                backgroundColor: '#fff',
                border: '2px solid #28a745',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <strong style={{ color: '#155724', fontSize: '1.2rem' }}>📞 Call: (803) 221-0466</strong>
              </div>
              <p style={{ color: '#856404', fontSize: '0.9rem', fontStyle: 'italic' }}>
                Our team will process your payment over the phone and confirm your booking.
              </p>
            </div>
          )}
          
          <div className="checkout-navigation-buttons">
            {!isDeferredBooking && (
              <button
                id="btn-back-contract"
                onClick={goToPreviousStep}
                disabled={processingPayment}
              >
                Back to Contract
              </button>
            )}
          </div>
        </div>
      )}

      {currentStep === 'payment' && paymentCompleted && (
        <div style={{ 
          backgroundColor: 'white', 
          padding: '2rem', 
          borderRadius: '8px', 
          marginBottom: '2rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h2 style={{ marginBottom: '1rem', color: '#28a745' }}>✅ Payment Successful!</h2>
          <p style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#333' }}>
            Thank you for your order! Your payment has been processed and your rental contract has been saved.
          </p>
          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '4px',
            marginBottom: '1rem'
          }}>
            <p style={{ margin: '0.5rem 0', color: '#666' }}>
              <strong>Payment ID:</strong> {paymentId}
            </p>
            <p style={{ margin: '0.5rem 0', color: '#666' }}>
              <strong>Total Paid:</strong> ${(() => {
                const result = calculateActualAmountPaid();
                return result;
              })()}
            </p>
          </div>
          <p style={{ color: '#666' }}>
            You will receive a confirmation email shortly. We'll contact you to confirm delivery details.
          </p>
        </div>
      )}

      {/* Quantity Selection Modal */}
      {showQuantityModal && (
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
            minWidth: '300px',
            textAlign: 'center'
          }}>
            <h3 style={{ marginBottom: '1rem' }}>Select Quantity</h3>
            <p style={{ marginBottom: '1rem', color: '#666' }}>
              How many {showQuantityModal} would you like to add?
            </p>
            {loadingAvailability ? (
              <p style={{ color: '#666', fontStyle: 'italic' }}>Checking availability...</p>
            ) : (
              <>
                {getAvailableQuantityForItem(showQuantityModal || '') === 0 ? (
                  <p style={{ color: '#dc3545', fontWeight: 'bold' }}>
                    No more {showQuantityModal} available for your selected dates.
                  </p>
                ) : (
                  <>
                    <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
                      Available: {getAvailableQuantityForItem(showQuantityModal || '')} items
                    </p>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label htmlFor="quantity-select" style={{ 
                        display: 'block', 
                        marginBottom: '0.5rem',
                        fontWeight: 'bold',
                        color: '#333'
                      }}>
                        Quantity:
                      </label>
                      <select
                        id="quantity-select"
                        value={selectedQuantity}
                        onChange={(e) => setSelectedQuantity(parseInt(e.target.value))}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          fontSize: '1rem',
                          border: '2px solid #ddd',
                          borderRadius: '4px',
                          backgroundColor: 'white',
                          cursor: 'pointer'
                        }}
                      >
                        {getQuantityOptions(showQuantityModal || '').map(qty => (
                          <option key={qty} value={qty}>
                            {qty}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button
                        id="btn-quantity-submit"
                        onClick={handleQuantitySubmit}
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
                        Add to Order
                      </button>
                      <button
                        id="btn-quantity-cancel"
                        onClick={() => setShowQuantityModal(null)}
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
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Back to Cart */}
      <div className="checkout-back-shopping-container">
        <button
          id="btn-back-to-shopping"
          onClick={() => navigate("/home")}
        >
          ← Back to Shopping
        </button>
      </div>

      {/* Footer */}
      <footer className="footer">
        <div>
          <strong>Jump CSRA Party Rental</strong>
          <br />
          410 Carolina Springs Rd.
          <br />
          North Augusta, SC. 29841
        </div>
        <div>
          <a 
            href="tel:+18032210466" 
            id="phone-link"
            title="Call us now"
            rel="noopener"
          >
            803-221-0466
          </a>
          <br />
          <a 
            href="mailto:JumpCSRA@gmail.com" 
            id="email-link"
            title="Send us an email"
          >
            JumpCSRA@gmail.com
          </a>
        </div>
        <div className="social-icons">
          <a href="https://www.instagram.com/jumpcsra/" target="_blank" rel="noopener noreferrer">
            <img src="/assets/instagram-icon.avif" alt="Instagram Logo" className="footer-icons" />
          </a>
       
          <a href="https://www.facebook.com/JUMPCSRA/" target="_blank" rel="noopener noreferrer">
            <img src="/assets/fb-icon.avif" alt="Facebook Logo" className="footer-icons" />
          </a>
        </div>
      </footer>
      </div>

      {/* Mobile Bottom Menu */}
      <MobileBottomMenu
        user={user}
        selectedDates={calendarDateRange}
        onCalendarClick={() => {/* No calendar action needed on checkout */}}
        cartCount={cart.reduce((sum: number, item: CartItem) => sum + item.quantity, 0)}
        cartSubtotal={cart.reduce((sum: number, item: CartItem) => sum + (item.price * item.quantity), 0)}
        onCartClick={() => navigate("/checkout")}
      />
          </>
        )}
      </MantineProvider>
    </>
  );
}