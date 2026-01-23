import React, { useState, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { useNavigate, useSearchParams } from "react-router";
import { LocalStorageDebugger } from "../components/LocalStorageDebugger";
import { RouterNav } from "../components/RouterNav";
import { SearchBar } from "../components/SearchBar";
import { GooglePlacesAutocomplete } from "../components/GooglePlacesAutocomplete";
import { MobileBottomMenu } from "../components/MobileBottomMenu";
import { ProfileMenuSidebar } from "../components/ProfileMenuSidebar";
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
  addWalletTransaction,
  deletePendingBookingsWithOverlappingItems
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
    // Getting available quantity for item
    
    if (item.category !== 'party-essentials') {
      // Not a party essential, returning 10
      return 10; // Default for non-party essentials
    }
    
    // Use the availability system if dates are selected
    const startDate = calendarDateRange[0];
    const endDate = startDate && cartSettings.duration ? calculateEndDate(startDate, cartSettings.duration) : null;
    
    // Date info validation removed
    
    if (startDate && endDate) {
      const availability = itemAvailability.get(item.name);
      // Availability data check
      
      if (availability) {
        // Ensure minimum of current item quantity if already in cart
        const currentQuantity = item.quantity || 1;
        const availableQuantity = availability.availableQuantity || 0;
        const result = Math.max(currentQuantity, availableQuantity);
        
        // Availability calculation
        
        return result;
      } else {
        // No availability data found for item
      }
    } else {
      // No valid dates or duration
    }
    
    // Default if no availability data - ensure minimum of current quantity
    const fallback = Math.max(item.quantity || 1, 10);
    // Using fallback quantity
    return fallback;
  };

  // Function to update cart item quantity
  const updateCartItemQuantity = (cartIndex: number, newQuantity: number) => {
    const item = cart[cartIndex];
    // Debug log removed
    
    if (!item || item.category !== 'party-essentials') {
      // Item not found or not party essential, skipping
      return;
    }

    const maxAvailable = getAvailableQuantityForCartItem(item, cartIndex);
    // Debug log removed
    
    if (newQuantity > maxAvailable) {
      // Fail silently for delivery-related availability issues
      return;
    }

    const updatedCart = [...cart];
    updatedCart[cartIndex] = { ...item, quantity: newQuantity };
    // Setting updated cart
    setCart(updatedCart);
    
    // Update localStorage
    localStorage.setItem('cart', JSON.stringify(updatedCart));
    
    // Delivery-related notifications removed - fail silently
  };

  // Checkout-specific state
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [deliveryCost, setDeliveryCost] = useState<number>(0);
  const [deliverySkipped, setDeliverySkipped] = useState<boolean>(false); // Track if delivery was skipped for dev
  const [addressConfirmed, setAddressConfirmed] = useState<boolean>(false); // Track if user confirmed their address
  const [contractSigned, setContractSigned] = useState<boolean>(false);
  const [contractValidData, setContractValidData] = useState<any>(null);
  const [isContractValid, setIsContractValid] = useState<boolean>(false);
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
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [eventNotes, setEventNotes] = useState<string>('');
  
  // Store completed order data for display after cart is cleared
  const [completedOrderCart, setCompletedOrderCart] = useState<CartItem[]>([]);
  
  // Profile menu sidebar state
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  // Wallet State
  const [userWallet, setUserWallet] = useState<UserWallet | null>(null);
  const [useWalletFirst, setUseWalletFirst] = useState<boolean>(false);
  const [walletAppliedAmount, setWalletAppliedAmount] = useState<number>(0);
  
  // Checkout step management - dynamically determine starting step
  type CheckoutStep = 'cart-delivery' | 'party-essentials' | 'contract' | 'payment';
  
  // Initialize starting step based on cart contents
  const getInitialStep = (): CheckoutStep => {
    // All orders start at cart-delivery step
    return 'cart-delivery';
  };
  
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('cart-delivery'); // Default to first step
  const [visitedSteps, setVisitedSteps] = useState<Set<CheckoutStep>>(() => new Set(['cart-delivery'])); // Default to first step

  // Update step when cart loads from localStorage
  useEffect(() => {
    if (!loading && user) {
      const correctStep = getInitialStep();
      // Debug log removed
      
      // Always set the correct step when cart is first loaded
      if (visitedSteps.size === 1 && visitedSteps.has('cart-delivery')) {
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
  
  // Party essentials carousel navigation state
  const [carouselScrollPosition, setCarouselScrollPosition] = useState<number>(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  
  // Availability tracking state
  const [itemAvailability, setItemAvailability] = useState<Map<string, ItemAvailability>>(new Map());
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availableDurations, setAvailableDurations] = useState<Set<string>>(new Set(['4hours', '24hours', '48hours']));
  
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

  // Helper function to calculate display price for a cart item including wet surcharge
  const getItemDisplayPrice = (item: CartItem, index: number): number => {
    let basePrice = item.price;
    
    if (item.isGiftCard) {
      return item.giftCardValue || item.price;
    }
    
    if (item.isMembership) {
      return item.price;
    }
    
    // Apply duration multiplier for regular items
    const durationMultiplier = cartSettings.duration ? durationMultipliers[cartSettings.duration] || 1.0 : 1.0;
    let displayPrice = basePrice * durationMultiplier;
    
    // Add wet surcharge if applicable
    const supportsWetDry = item.wetDry === "Wet/Dry";
    if (supportsWetDry && cartSettings.wetDrySelections?.[index] === "Wet") {
      displayPrice += 50;
    }
    
    return displayPrice;
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
      "1pm": 0,
      "2pm": 0,
      "3pm": 0,
      "4pm": 0,
      "5pm": 0,
    };
    
    const allTimeOptions = [
      { value: "8am", label: "8am (+$40)", hour: 8, price: timePrices["8am"] },
      { value: "9am", label: "9am (+$30)", hour: 9, price: timePrices["9am"] },
      { value: "10am", label: "10am (+$20)", hour: 10, price: timePrices["10am"] },
      { value: "11am", label: "11am (+$10)", hour: 11, price: timePrices["11am"] },
      { value: "12pm", label: "12pm", hour: 12, price: timePrices["12pm"] },
      { value: "1pm", label: "1pm", hour: 13, price: timePrices["1pm"] },
      { value: "2pm", label: "2pm", hour: 14, price: timePrices["2pm"] },
      { value: "3pm", label: "3pm", hour: 15, price: timePrices["3pm"] },
      { value: "4pm", label: "4pm", hour: 16, price: timePrices["4pm"] },
      { value: "5pm", label: "5pm", hour: 17, price: timePrices["5pm"] }
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
      // Gift cards and/or memberships only: skip party-essentials and contract
      return ['cart-delivery', 'payment'];
    } else {
      // Has inflateables: cart-delivery -> party-essentials -> contract -> payment
      return ['cart-delivery', 'party-essentials', 'contract', 'payment'];
    }
  };
  
  const stepOrder = getStepOrder();
  
  const stepTitles = {
    'cart-delivery': 'Cart & Delivery',
    'party-essentials': 'Party Essentials',
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
            // Debug log removed
            try {
              // Always set status to confirmed for gift card/membership-only orders
              const initialStatus = 'confirmed';
              // Debug log removed
              const result = await saveBookingAndContract(initialStatus);
              if (result) {
                const { orderID } = result;
                setPendingBookingId(orderID);
                setContractSigned(true);
                // Debug log removed
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
        // Smoothly scroll to top of page
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const goToPreviousStep = () => {
    const currentStepOrder = getStepOrder();
    const currentIndex = currentStepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(currentStepOrder[currentIndex - 1]);
      // Smoothly scroll to top of page
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Validation functions for step progression
  const canProceedFromCurrentStep = () => {
    const hasInflateables = cart.some(item => !item.isGiftCard && !item.isMembership);
    
    switch (currentStep) {
      case 'cart-delivery':
        // Must have items in cart
        if (cart.length === 0) return false;
        // If has inflateables, must have delivery address, location, all event settings, calculated delivery, AND address confirmed
        if (hasInflateables) {
          return deliveryAddress.trim().length > 0 && 
                 deliveryCost >= 0 && 
                 !calculatingDistance && // Block progression while calculating
                 addressConfirmed && // Require address confirmation
                 cartSettings.location.trim().length > 0 &&
                 cartSettings.duration && 
                 cartSettings.surface && 
                 cartSettings.deliveryTime &&
                 areWetDrySelectionsComplete();
        }
        // For gift cards only, just need cart items
        return true;
      case 'party-essentials':
        // Party essentials are optional, always allow progression
        return true;
      case 'contract':
        return contractSigned; // Allow progression when contract is signed
      default:
        return true;
    }
  };

  const getNextStepButtonText = () => {
    const hasInflateables = cart.some(item => !item.isGiftCard && !item.isMembership);
    
    switch (currentStep) {
      case 'cart-delivery':
        return hasInflateables ? 'Continue to Party Essentials' : 'Proceed to Payment';
      case 'party-essentials':
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
        case 'cart-delivery':
          // Must have items in cart
          if (cart.length === 0) return false;
          // If has inflateables, must have delivery address, location, all event settings, calculated delivery, AND address confirmed
          if (hasInflateables) {
            return deliveryAddress.trim().length > 0 && 
                   deliveryCost >= 0 &&
                   !calculatingDistance && // Block button while calculating
                   addressConfirmed && // Require address confirmation
                   cartSettings.location.trim().length > 0 &&
                   cartSettings.duration && 
                   cartSettings.surface && 
                   cartSettings.deliveryTime &&
                   areWetDrySelectionsComplete();
          }
          // For gift cards only, just need cart items
          return true;
        case 'party-essentials':
          // Party essentials are optional, always allow progression
          return true;
        default:
          return false;
      }
    })();
    
    return result;
  };

  // Handle cart changes and adjust current step if needed
  useEffect(() => {
    const currentStepOrder = getStepOrder();
    
    // If current step is not in the new step order, adjust to a valid step
    if (!currentStepOrder.includes(currentStep)) {
      // If we're on party-essentials or contract but cart only has gift cards/memberships, skip to payment
      if (currentStep === 'party-essentials' || currentStep === 'contract') {
        const hasInflateables = cart.some(item => !item.isGiftCard && !item.isMembership);
        if (!hasInflateables) {
          // Debug log removed
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
      console.log('🔍 [BOOKING LOAD DEBUG] Loading booking ID:', bookingId);
      
      // Sanitize booking ID for Firebase path compatibility
      // Firebase paths cannot contain ".", "#", "$", "[", or "]"
      const sanitizedBookingId = bookingId.replace(/[\.\#\$\[\]]/g, '_');
      console.log('🔧 [BOOKING LOAD DEBUG] Sanitized booking ID:', sanitizedBookingId);
      
      // Try to load as orderID first (new structure) - use original ID
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

        // Restore cart from booking data
        if (bookingData.orderDetails?.items) {
          const restoredCart = bookingData.orderDetails.items.map((item, index) => ({
            id: `${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${index}`,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            category: 'inflateable', // Default category
            wetDry: (item as any).wetDry || 'Wet/Dry',
            wet: true,
            dry: true
          }));
          
          setCart(restoredCart);
          
          notifications.show({
            title: '🛒 Cart Restored',
            message: `Restored ${restoredCart.length} items from your booking.`,
            color: 'blue',
            autoClose: 3000,
          });
        }

        // Restore delivery address from booking
        if (bookingData.orderDetails?.deliveryAddress) {
          setDeliveryAddress(bookingData.orderDetails.deliveryAddress);
          localStorage.setItem('deliveryAddress', bookingData.orderDetails.deliveryAddress);
        }

        // Restore cart settings from booking
        if (bookingData.orderDetails) {
          const bookingSettings = bookingData.orderDetails;
          
          // Update cart settings if available
          if (bookingSettings.duration && cartSettings.duration !== bookingSettings.duration) {
            cartSettings.setDuration(bookingSettings.duration);
          }
          if (bookingSettings.surface && cartSettings.surface !== bookingSettings.surface) {
            cartSettings.setSurface(bookingSettings.surface);
          }
          if (bookingSettings.deliveryTime && cartSettings.deliveryTime !== bookingSettings.deliveryTime) {
            cartSettings.setDeliveryTime(bookingSettings.deliveryTime);
          }
        }

        // Parse and restore date range if available
        if (bookingData.orderDetails?.eventDate) {
          try {
            const eventDateStr = bookingData.orderDetails.eventDate;
            if (eventDateStr.includes(' - ')) {
              const [startDateStr, endDateStr] = eventDateStr.split(' - ');
              const startDate = new Date(startDateStr);
              const endDate = new Date(endDateStr);
              
              if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                setCalendarDateRange([startDate, endDate]);
                localStorage.setItem('calendarDateRange', JSON.stringify([startDate.toISOString(), endDate.toISOString()]));
              }
            }
          } catch (dateError) {
            console.warn("Could not parse event date from booking:", dateError);
          }
        }
        
        // Debug log removed:", bookingId);
        
      } else {
        // Fallback: try loading from old structure (legacy contracts)
        console.log('📁 [BOOKING LOAD DEBUG] Trying legacy structure with sanitized ID:', sanitizedBookingId);
        const database = getDatabase();
        
        // Since Firebase paths can't contain $, #, ., [, ], we use the sanitized version
        const contractRef = ref(database, `contracts/${sanitizedBookingId}`);
        const snapshot = await get(contractRef);
        
        if (!snapshot.exists()) {
          throw new Error(`Booking not found. The booking ID '${bookingId}' may contain invalid characters. Please contact support with this booking ID.`);
        }
        
        const legacyBookingData = snapshot.val() as ContractMetadata;
        
        // Verify booking is available for payment (deferred or pending)
        if (legacyBookingData.status !== 'deferred' && legacyBookingData.status !== 'pending' && legacyBookingData.status !== 'deposited') {
          throw new Error("Booking is not available for payment");
        }
        
        // Load legacy booking data into checkout state
        setContractMetadata(legacyBookingData);
        setPendingBookingId(bookingId); // Keep original ID for display
        setContractSigned(true);
        setBookingLoadedFromUrl(true);
        
        console.log('✅ [BOOKING LOAD DEBUG] Successfully loaded from legacy structure');

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

        // Restore cart from legacy booking data
        if (legacyBookingData.orderDetails?.items) {
          const restoredCart = legacyBookingData.orderDetails.items.map((item: any, index: number) => ({
            id: `${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${index}`,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            category: 'inflateable', // Default category
            wetDry: (item as any).wetDry || 'Wet/Dry',
            wet: true,
            dry: true
          }));
          
          setCart(restoredCart);
          
          notifications.show({
            title: '🛒 Cart Restored',
            message: `Restored ${restoredCart.length} items from your booking.`,
            color: 'blue',
            autoClose: 3000,
          });
        }

        // Restore delivery address from legacy booking
        if (legacyBookingData.deliveryAddress) {
          setDeliveryAddress(legacyBookingData.deliveryAddress);
          localStorage.setItem('deliveryAddress', legacyBookingData.deliveryAddress);
        }

        // Parse and restore date range from legacy booking if available
        if (legacyBookingData.eventDate) {
          try {
            const eventDateStr = legacyBookingData.eventDate;
            if (eventDateStr.includes(' - ')) {
              const [startDateStr, endDateStr] = eventDateStr.split(' - ');
              const startDate = new Date(startDateStr);
              const endDate = new Date(endDateStr);
              
              if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                setCalendarDateRange([startDate, endDate]);
                localStorage.setItem('calendarDateRange', JSON.stringify([startDate.toISOString(), endDate.toISOString()]));
              }
            }
          } catch (dateError) {
            console.warn("Could not parse event date from legacy booking:", dateError);
          }
        }
        
        // Debug log removed:", bookingId);
      }

      // Handle special case for deferred bookings
      const currentStatus = bookingData?.status || contractMetadata?.status;
      if (currentStatus === 'deferred') {
        // Check if the deferred booking is approved
        const isApproved = bookingData?.approved === true;
        
        if (!isApproved) {
          // Booking is deferred but not approved yet
          notifications.show({
            title: '⏰ Booking Not Ready',
            message: `This booking is awaiting approval and cannot be paid for yet. Please check back later or contact us.`,
            color: 'orange',
            autoClose: 8000,
          });
          navigate('/profile');
          return;
        }
        
        // If approved, treat it as a normal booking (not deferred for UI purposes)
        setIsDeferredBooking(false);
        
        // Show special message for approved deferred bookings
        notifications.show({
          title: '✅ Deferred Booking Approved',
          message: `This booking has been approved and is now ready for payment.`,
          color: 'green',
          autoClose: 8000,
        });
      } else {
        setIsDeferredBooking(false);
      }
      
      // Navigate directly to payment step
      setCurrentStep('payment');
      setVisitedSteps(prev => new Set([...prev, 'payment']));
      
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
    // Debug log removed
  }, [deliveryAddress]);

  // Handle contract validation changes
  const handleContractValidationChange = (isValid: boolean, contractData: any) => {
    setIsContractValid(isValid);
    setContractValidData(contractData);
  };

  // Handle contract completion - called by ContractSigning component
  const handleContractCompletion = async (contractData: { 
    sections: any[], 
    signature: string, 
    initials: string 
  }) => {
    // Contract completed by component, proceeding with booking
    
    try {
      // Determine initial booking status based on event date
      const eventDateString = calendarDateRange[0]?.toLocaleDateString() || '';
      const isWithinTwoDays = isCurrentBookingWithinTwoDays();
      
      // Check if cart only contains gift cards and/or memberships
      const onlyGiftCards = cart.every(item => item.isGiftCard || item.isMembership);
      
      // Determine initial status - deferred if within 2 days AND has inflateables, otherwise proceed to payment
      const needsPhoneCall = isWithinTwoDays && !onlyGiftCards;
      const initialStatus = needsPhoneCall ? 'deferred' : 'pending';
      
      // Event date check
      
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
          // Debug log removed
        } else if (isWithinTwoDays && onlyGiftCards) {
          // Debug log removed
        } else {
          // Debug log removed
        }
        
        // Direct navigation to payment step to avoid state dependency issues
        setCurrentStep('payment');
        setVisitedSteps(prev => new Set([...prev, 'payment']));
        
        // Navigated directly to payment step
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
    console.log('🔍 [CALCULATE DISTANCE] Function called with destinationAddress:', destinationAddress);
    console.log('🔍 [CALCULATE DISTANCE] destinationAddress length:', destinationAddress.length);
    // Delivery cost calculation started
    // Debug log removed
    // Debug log removed
    // Debug log removed
    // Debug log removed
    // Debug log removed);
    
    setCalculatingDistance(true);
    try {
      // First, geocode both addresses
      // Geocoding step
      
      const [baseResponse, destResponse] = await Promise.all([
        fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(BASE_LOCATION)}`),
        fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(destinationAddress)}`)
      ]);

      const [baseData, destData] = await Promise.all([
        baseResponse.json(),
        destResponse.json()
      ]);
      
      // Geocoding results

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

      // Debug log removed
      // Debug log removed
      // Debug log removed
      // Debug log removed
      // Debug log removed

      // Use OSRM API for driving distance calculation
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${baseLon},${baseLat};${destLon},${destLat}?overview=false`;
      // Debug log removed
      // Debug log removed
      
      const routeResponse = await fetch(osrmUrl);
      const routeData = await routeResponse.json();

      // Debug log removed
      // Debug log removed
      // Debug log removed

      if (routeData.routes && routeData.routes.length > 0) {
        const distanceMeters = routeData.routes[0].distance;
        const distanceMiles = distanceMeters * 0.000621371; // Convert meters to miles
        const cost = Math.round(distanceMiles * 6); // $6 per mile, rounded
        
        // Debug log removed
        // Debug log removed
        // Debug log removed);
        // Debug log removed
        // Debug log removed
        // Debug log removed
        // Debug log removed
        // Debug log removed);
        
        setDeliveryCost(cost);
        // Delivery cost calculated successfully - no notification needed
      } else {
        throw new Error("Could not calculate route");
      }
    } catch (error) {
      console.error('❌ DELIVERY COST CALCULATION ERROR:', error);
      // Debug log removed
      // Debug log removed
      // Debug log removed
      // Set delivery cost to 0 and fail silently
      setDeliveryCost(0);
    } finally {
      // Debug log removed
      setCalculatingDistance(false);
    }
  };

  // Handle Google Places address selection
  // Handle Google Places address selection
  // NOTE: The address is actually set via onChange callback from GooglePlacesAutocomplete component
  // This function just tracks that it was a valid Google selection and triggers calculation
  const handlePlaceSelected = (place: google.maps.places.PlaceResult) => {
    console.log('🔍 [PLACE SELECTED] handlePlaceSelected called');
    console.log('  - place.formatted_address:', place.formatted_address);
    console.log('  - place.address_components:', place.address_components);
    
    // Only accept valid places with formatted address and location
    if (place.formatted_address && place.geometry?.location && place.place_id) {
      // Set flag to prevent manual input from overriding this selection
      setIsSelectingGooglePlace(true);
      
      // The address will be set by onChange callback from GooglePlacesAutocomplete
      // which has already validated and constructed the address with zip code
      
      // We'll trigger the distance calculation after the state updates
      // Use a short timeout to ensure deliveryAddress state is updated first
      setTimeout(() => {
        setIsSelectingGooglePlace(false);
        
        // At this point, deliveryAddress should be set by onChange
        // Trigger calculation with the current state
        if (deliveryAddress) {
          console.log('🔍 [PLACE SELECTED] Triggering calculateDeliveryDistance with:', deliveryAddress);
          calculateDeliveryDistance(deliveryAddress);
        }
      }, 150); // Longer delay to ensure onChange has updated deliveryAddress
    }
  };

  // Handle manual address input change
  const handleAddressChange = (value: string) => {
    console.log('🔍 [ADDRESS DEBUG] handleAddressChange called');
    console.log('  - New value:', value);
    console.log('  - New value length:', value.length);
    console.log('  - Current deliveryAddress state:', deliveryAddress);
    
    // Clear the failed addresses set when user changes the address
    // This allows them to retry calculation with a corrected address
    if (value !== deliveryAddress) {
      console.log('  - Value changed, resetting failed addresses and delivery cost');
      setFailedAddresses(new Set());
      setDeliveryCost(0); // Reset delivery cost for new address
      setAddressConfirmed(false); // Reset confirmation when address changes
    }
    
    console.log('  - Setting deliveryAddress to:', value);
    console.log('  - Setting deliveryAddress LENGTH:', value.length);
    setDeliveryAddress(value);
    console.log('  - After setDeliveryAddress, state should be:', value);
  };

  // Authentication guard
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u) {
        // User not logged in, redirect to login with auto-signup parameter
        navigate("/?signup=true");
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
          // Debug log removed
          const booking = await loadBookingData(resumeBookingId);
          
          if (booking && booking.customerID === user.uid) {
            // Check if booking is already completed or confirmed - can't resume completed bookings
            // Note: Deferred bookings should be handled separately through the profile page
            const bookingStatus = booking.status || 'pending';
            // Debug log removed
            
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
            
            // Check if booking is deferred - should not be resumed through this flow
            if (bookingStatus === 'deferred') {
              console.warn('⚠️ [RESUME] Cannot resume deferred booking through this flow:', resumeBookingId, 'Status:', bookingStatus);
              localStorage.removeItem('resumeBookingId');
              
              notifications.show({
                title: '⏰ Deferred Booking',
                message: `Booking #${resumeBookingId} is deferred. Please manage it from your profile page.`,
                color: 'yellow',
                autoClose: 8000,
              });
              
              // Redirect to profile page
              return;
            }
            
            // Check if booking is in a resumable state (pending, confirmed)
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
            
            // Debug log removed
            setPendingBookingId(resumeBookingId);
            
            // Set as not deferred since deferred bookings are handled separately
            setIsDeferredBooking(false);
            
            // Restore cart from booking data - always try this for resumed bookings
            // Debug log removed
            if (booking.orderDetails?.items) {
              // Debug log removed
              // Debug log removed
              // Debug log removed
              
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
              
              // Debug log removed
              setCart(restoredCart);
              
              // Debug log removed
              
              notifications.show({
                title: '🛒 Cart Restored',
                message: `Restored ${restoredCart.length} items from your booking.`,
                color: 'blue',
                autoClose: 3000,
              });
            } else {
              console.warn('⚠️ [CART RESTORE] Cannot restore cart - no items in booking orderDetails');
              // Debug log removed
            }
            
            // Bookings are created after contract signing, so go directly to payment step
            setCurrentStep('payment');
            setVisitedSteps(new Set(['cart-delivery', 'party-essentials', 'contract', 'payment']));
            setContractSigned(true);
            
            // Restore tip if it was set
            if (booking.paymentDetails?.tip) {
              setTipAmount(booking.paymentDetails.tip);
            }

            // Restore event notes if they were set
            if (booking.orderDetails?.notes) {
              setEventNotes(booking.orderDetails.notes);
            }
            
            // Clear the resume flag
            localStorage.removeItem('resumeBookingId');
            // Debug log removed
            
            notifications.show({
              title: '📝 Booking Resumed',
              message: `Successfully loaded your incomplete booking #${resumeBookingId} (${bookingStatus}). Please complete payment.`,
              color: 'green',
              autoClose: 5000,
            });
            
            // Debug log removed
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
    console.log('🔍 [ADDRESS DEBUG] deliveryAddress state changed:', deliveryAddress);
    if (deliveryAddress.trim().length > 0) {
      localStorage.setItem('deliveryAddress', deliveryAddress);
      console.log('  - Saved to localStorage');
    }
  }, [deliveryAddress]);

  // Load delivery address from localStorage on component mount
  useEffect(() => {
    if (!loading && user) {
      const savedDeliveryAddress = localStorage.getItem('deliveryAddress');
      console.log('🔍 [ADDRESS DEBUG] Load from localStorage effect triggered');
      console.log('  - savedDeliveryAddress:', savedDeliveryAddress);
      console.log('  - current deliveryAddress:', deliveryAddress);
      if (savedDeliveryAddress && !deliveryAddress) {
        console.log('  - Loading saved address:', savedDeliveryAddress);
        setDeliveryAddress(savedDeliveryAddress);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]); // Only run when loading/user changes, not deliveryAddress

  // Load cart and settings from localStorage
  useEffect(() => {
    if (!loading && user) {
      // Debug log removed
      
      // Check if we're resuming a booking - if so, delay cart loading
      const resumeBookingId = localStorage.getItem('resumeBookingId');
      if (resumeBookingId) {
        // Debug log removed
        return; // Don't load cart from localStorage if resuming booking
      }
      
      // Check if we have a booking URL parameter - if so, delay cart loading
      const urlParams = new URLSearchParams(window.location.search);
      const bookingUrlParam = urlParams.get('booking');
      if (bookingUrlParam && !bookingLoadedFromUrl) {
        console.log('🔍 [CART LOAD] Booking URL parameter detected, skipping cart load from localStorage');
        return; // Don't load cart from localStorage if we're loading from URL
      }
      
      // Load cart from localStorage
      const savedCart = localStorage.getItem("cart");
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart);
          // Debug log removed
          setCart(parsedCart);
        } catch (error) {
          console.error("❌ [CART LOAD] Error parsing cart from localStorage:", error);
          setCart([]);
        }
      } else {
        // Debug log removed
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
          // Debug log removed
        } catch (error) {
          console.error("❌ [CART LOAD] Error parsing date range from localStorage:", error);
        }
      }
    }
  }, [loading, user, bookingLoadedFromUrl]);

  // Get party essentials for carousel (must be defined before useEffect that uses it)
  const partyEssentials = inflateables.filter(item => 
    item.category && item.category.toLowerCase() === "party-essentials" && 
    !item.isGiftCard // Exclude gift cards from last-minute additions
  );

  // Check availability for party essentials when cart or dates change
  useEffect(() => {
    // Debug log removed
    
    const checkAvailability = async () => {
      if (calendarDateRange[0] && cartSettings.duration && partyEssentials.length > 0) {
        // Debug log removed
        setLoadingAvailability(true);
        const startDate = calendarDateRange[0];
        const endDate = calculateEndDate(startDate, cartSettings.duration);
        
        // Debug log removed
        
        try {
          const inflateablesData = await loadInflateablesData();
          // Debug log removed
          
          const availabilityMap = new Map<string, ItemAvailability>();
          
          const promises = partyEssentials.map(async (item) => {
            // Debug log removed
            const inflateable = inflateablesData.find(inf => inf.name === item.name);
            if (inflateable) {
              const totalQuantity = inflateable.quantity || 1;
              // Debug log removed
              
              const availability = await checkItemAvailability(
                item.name,
                totalQuantity,
                startDate,
                endDate
              );
              
              // Debug log removed
              
              availabilityMap.set(item.name, availability);
            } else {
              // Debug log removed
            }
          });
          
          await Promise.all(promises);
          // Debug log removed
          // Debug log removed
          setItemAvailability(availabilityMap);
          
        } catch (error) {
          console.error('❌ [AVAILABILITY DEBUG] Error checking availability:', error);
        } finally {
          setLoadingAvailability(false);
        }
      } else {
        // Debug log removed
      }
    };

    checkAvailability();
  }, [calendarDateRange[0], cartSettings.duration, cart, lastMinuteAdditions, partyEssentials.length]);

  // Update carousel scroll position when party essentials step is active
  useEffect(() => {
    if (currentStep === 'party-essentials' && carouselRef.current) {
      // Use setTimeout to ensure the carousel is fully rendered
      const timer = setTimeout(() => {
        updateCarouselScrollPosition();
        // Force a re-render by updating the scroll position state
        if (carouselRef.current) {
          setCarouselScrollPosition(carouselRef.current.scrollLeft);
        }
      }, 0);
      
      return () => clearTimeout(timer);
    }
  }, [currentStep, partyEssentials.length]);

  // Check available durations when selected date or cart changes
  useEffect(() => {
    if (calendarDateRange[0]) {
      checkAvailableDurations(calendarDateRange[0]);
    }
  }, [calendarDateRange[0], cart]);

  // Current cart state debug removed
  // Validate and clean cart when dates change
  useEffect(() => {
    const validateCart = async () => {
      // Only validate if we have both start and end dates and cart items
      if (calendarDateRange[0] && calendarDateRange[1] && cart.length > 0) {
        // Debug log removed, '-', calendarDateRange[1].toLocaleDateString());
        
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
            },
            pendingBookingId || undefined // Exclude current booking from availability check
          );
          
          // Update cart if items were removed
          if (validatedCart.length !== cart.length) {
            setCart(validatedCart);
            localStorage.setItem('cart', JSON.stringify(validatedCart));
            // Debug log removed
          }
          
        } catch (error) {
          console.error('❌ Error validating cart:', error);
        }
      }
    };
    
    validateCart();
  }, [calendarDateRange[0], calendarDateRange[1], pendingBookingId]); // Added pendingBookingId to dependencies

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
    "1pm": 0,
    "2pm": 0,
    "3pm": 0,
    "4pm": 0,
    "5pm": 0,
    "": 0,
  };
  
  const durationMultipliers: Record<string, number> = {
    "4hours": 0.9,  // 10% discount
    "24hours": 1.0, // Base price
    "24hours-pickup6": 1.0, // Base price + $10 pickup fee
    "24hours-pickup7": 1.0, // Base price + $20 pickup fee
    "24hours-pickup8": 1.0, // Base price + $30 pickup fee
    "48hours": 1.5, // 50% increase
  };

  // Pickup time fees for 24-hour duration options
  const pickupTimeFees: Record<string, number> = {
    "24hours-pickup6": 10,
    "24hours-pickup7": 20,
    "24hours-pickup8": 30,
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
  const pickupFee = cartSettings.duration && pickupTimeFees[cartSettings.duration] ? pickupTimeFees[cartSettings.duration] : 0;
  const subtotal = cartTotal + lastMinuteTotal + surfaceAdj + timeAdj + pickupFee;
  const salesTax = subtotal * 0.08; // 8% sales tax
  const total = subtotal + salesTax + deliveryCost + tipAmount;

  // Load inflateables data function (similar to CartSidebar)
  const loadInflateablesData = async (): Promise<any[]> => {
    // Debug log removed
    
    const database = getDatabase();
    const inflateablesRef = ref(database, 'inflateables');
    
    try {
      const snapshot = await get(inflateablesRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        return Object.values(data);
      } else {
        // Debug log removed
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
    console.log(`🔍 [CALC END DATE] startDate: ${startDate.toISOString()}, duration: "${duration}"`);
    if (duration === "24hours") {
      endDate.setDate(startDate.getDate() + 1);
      console.log(`  ✅ Added 1 day, endDate: ${endDate.toISOString()}`);
    } else if (duration === "48hours") {
      endDate.setDate(startDate.getDate() + 2);
      console.log(`  ✅ Added 2 days, endDate: ${endDate.toISOString()}`);
    } else { // 4hours
      endDate.setHours(startDate.getHours() + 4);
      console.log(`  ✅ Added 4 hours, endDate: ${endDate.toISOString()}`);
    }
    return endDate;
  };

  // Check which durations are available for all items in the cart
  const checkAvailableDurations = async (startDate: Date) => {
    if (!startDate || cart.length === 0) {
      setAvailableDurations(new Set(['4hours', '24hours', '48hours']));
      return;
    }

    // Skip checking for gift cards and memberships only
    const itemsToCheck = cart.filter(item => !item.isGiftCard && !item.isMembership);
    if (itemsToCheck.length === 0) {
      setAvailableDurations(new Set(['4hours', '24hours', '48hours']));
      return;
    }

    try {
      const inflateablesData = await loadInflateablesData();
      const durations = ['4hours', '24hours', '48hours'];
      const availableDurationsSet = new Set<string>();

      // Check each duration
      for (const duration of durations) {
        const endDate = calculateEndDate(startDate, duration);
        let allItemsAvailable = true;

        // Check availability for each item in cart
        for (const item of itemsToCheck) {
          const inflateable = inflateablesData.find(inf => inf.name === item.name);
          if (!inflateable) continue;

          const totalQuantity = inflateable.quantity || 1;
          const availability = await checkItemAvailability(
            item.name,
            totalQuantity,
            startDate,
            endDate,
            pendingBookingId // Exclude current booking if editing
          );

          // Check if enough quantity is available for this item
          if (availability.availableQuantity < (item.quantity || 1)) {
            allItemsAvailable = false;
            break;
          }
        }

        if (allItemsAvailable) {
          availableDurationsSet.add(duration);
        }
      }

      setAvailableDurations(availableDurationsSet);
    } catch (error) {
      console.error('Error checking duration availability:', error);
      // On error, allow all durations to avoid blocking user
      setAvailableDurations(new Set(['4hours', '24hours', '48hours']));
    }
  };

  // Calculate event start time from event date and delivery time
  const calculateEventStart = (eventDate: Date, deliveryTime: string): Date => {
    const eventStart = new Date(eventDate);
    
    // Parse delivery time (e.g., "8am", "12pm", "3pm")
    const timeStr = deliveryTime.toLowerCase();
    const hour = parseInt(timeStr);
    const isPM = timeStr.includes('pm');
    
    // Convert to 24-hour format
    let hour24 = hour;
    if (isPM && hour !== 12) {
      hour24 = hour + 12;
    } else if (!isPM && hour === 12) {
      hour24 = 0;
    }
    
    eventStart.setHours(hour24, 0, 0, 0);
    return eventStart;
  };

  // Calculate event end time from event start and duration
  const calculateEventEnd = (eventStart: Date, duration: string): Date => {
    const eventEnd = new Date(eventStart);
    
    if (duration === "24hours") {
      eventEnd.setDate(eventStart.getDate() + 1);
    } else if (duration === "24hours-pickup6") {
      // 24 hours with pickup at 6 PM
      eventEnd.setDate(eventStart.getDate() + 1);
      eventEnd.setHours(18, 0, 0, 0); // 6 PM
    } else if (duration === "24hours-pickup7") {
      // 24 hours with pickup at 7 PM
      eventEnd.setDate(eventStart.getDate() + 1);
      eventEnd.setHours(19, 0, 0, 0); // 7 PM
    } else if (duration === "24hours-pickup8") {
      // 24 hours with pickup at 8 PM
      eventEnd.setDate(eventStart.getDate() + 1);
      eventEnd.setHours(20, 0, 0, 0); // 8 PM
    } else if (duration === "48hours") {
      eventEnd.setDate(eventStart.getDate() + 2);
    } else { // 4hours
      eventEnd.setHours(eventStart.getHours() + 4);
    }
    
    return eventEnd;
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

  // Carousel navigation functions
  const scrollCarousel = (direction: 'left' | 'right') => {
    if (!carouselRef.current) return;
    
    const scrollAmount = 300; // Adjust based on your item width
    const newPosition = direction === 'left' 
      ? carouselRef.current.scrollLeft - scrollAmount
      : carouselRef.current.scrollLeft + scrollAmount;
    
    carouselRef.current.scrollTo({
      left: newPosition,
      behavior: 'smooth'
    });
  };

  const updateCarouselScrollPosition = () => {
    if (carouselRef.current) {
      setCarouselScrollPosition(carouselRef.current.scrollLeft);
    }
  };

  const canScrollLeft = () => {
    return carouselScrollPosition > 0;
  };

  const canScrollRight = () => {
    if (!carouselRef.current) return false;
    const maxScroll = carouselRef.current.scrollWidth - carouselRef.current.clientWidth;
    return carouselScrollPosition < maxScroll - 10; // -10 for small buffer
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
    
    // Add last-minute additions, surface/time adjustments, delivery cost, and tip for inflatables
    const adjustments = lastMinuteTotal + surfaceAdj + timeAdj + deliveryCost + tipAmount;
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
          
          // Debug log removed
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
        // Debug log removed
      }

      // Schedule event confirmation (2 days before)
      await scheduleEventConfirmationEmail(commonBookingData);
      // Debug log removed

      // Schedule post-event thank you (1 day after)
      await schedulePostEventThanksEmail(commonBookingData);
      // Debug log removed

      // Schedule rebooking reminder (9 months after)
      await scheduleRebookingReminderEmail(commonBookingData);
      // Debug log removed

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
    
    // Debug log removed
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
          // Calculate correct totalAmount by removing old tip and adding current tip
          const oldTip = existingBooking.paymentDetails.tip || 0;
          const baseTotalAmount = existingBooking.orderDetails.totalAmount - oldTip;
          const totalAmount = baseTotalAmount + tipAmount;
          const depositAmount = walletAppliedAmount;

          // Update booking status
          const statusUpdated = await updateBookingStatusBasedOnPayment(pendingBookingId, depositAmount, totalAmount);
          
          if (!statusUpdated) {
            console.error('❌ PAYPAL PAYMENT - Failed to update booking status');
            throw new Error('Failed to update booking status after payment');
          }
          
          // Debug log removed
          
          if (!statusUpdated) {
            console.error('❌ WALLET PAYMENT - Failed to update booking status');
            throw new Error('Failed to update booking status after payment');
          }
          
          // Debug log removed
          
          if (statusUpdated) {
            // Update both orderDetails and paymentDetails with correct totalAmount
            existingBooking.orderDetails.totalAmount = totalAmount;
            existingBooking.paymentDetails.totalAmount = totalAmount;
            existingBooking.paymentDetails.depositAmount = depositAmount;
            existingBooking.paymentDetails.remainingBalance = totalAmount - depositAmount;
            existingBooking.paymentDetails.tip = tipAmount;
            existingBooking.paymentDetails.paymentStatus = 'completed';
            existingBooking.paymentDetails.paymentDate = new Date().toISOString();
            existingBooking.updatedAt = new Date().toISOString();
            
            const success = await saveBookingData(existingBooking);
            if (success) {
              setPaymentId(`wallet-${Date.now()}`);
              setPaymentCompleted(true);
              
              // Delete pending/deferred bookings with overlapping items
              if (user && existingBooking.orderDetails?.items) {
                const itemNames = existingBooking.orderDetails.items.map(item => item.name);
                await deletePendingBookingsWithOverlappingItems(
                  user.uid,
                  pendingBookingId,
                  itemNames
                );
              }
              
              // Handle gift card creation
              const giftCardsInCart = cart.filter(item => item.isGiftCard);
              // Debug log removed));
              // Debug log removed
              
              if (giftCardsInCart.length > 0) {
                // Debug log removed
                for (const giftCardItem of giftCardsInCart) {
                  // Debug log removed
                  for (let i = 0; i < giftCardItem.quantity; i++) {
                    const giftCardCode = await generateUniqueGiftCardCode();
                    const giftCardValue = giftCardItem.giftCardValue || giftCardItem.price;
                    
                    // Debug log removed
                    
                    const success = await createGiftCardInDatabase(
                      giftCardCode,
                      giftCardValue,
                      user.uid,
                      user.email || '',
                      user.displayName || '',
                      false
                    );
                    
                    if (success) {
                      // Debug log removed
                    } else {
                      console.error(`❌ WALLET PAYMENT - Failed to create gift card: ${giftCardCode}`);
                    }
                  }
                }
              } else {
                // Debug log removed
              }

              // Create promotional gift card for GOGO discount if applicable (wallet payment)
              if (discounts.bogoGiftCard && giftCardsInCart.length > 0 && user) {
                try {
                  // Debug log removed
                  
                  // Find the highest value gift card in the cart
                  let highestValue = 0;
                  for (const giftCardItem of giftCardsInCart) {
                    const value = giftCardItem.giftCardValue || giftCardItem.price;
                    if (value > highestValue) {
                      highestValue = value;
                    }
                  }
                  
                  // Debug log removed
                  
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
                    // Debug log removed
                    
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
                        // Debug log removed
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
                
                  // Debug log removed
                  // Debug log removed
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
          // Debug log removed}`);
          
          const walletTransactionSuccess = await addWalletTransaction(user.uid, {
            amount: -walletAppliedAmount, // Negative amount for deduction
            type: 'withdrawal',
            description: `Order payment - ${cart.length} item(s)`,
            orderID: data.orderID,
            paypalTransactionId: paymentId
          });
          
          if (walletTransactionSuccess) {
            // Debug log removed
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
          // Calculate correct totalAmount by removing old tip and adding current tip
          const oldTip = existingBooking.paymentDetails.tip || 0;
          const baseTotalAmount = existingBooking.orderDetails.totalAmount - oldTip;
          const totalAmount = baseTotalAmount + tipAmount;
          
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
            
            // Update both orderDetails and paymentDetails with correct totalAmount
            updatedBooking.orderDetails.totalAmount = totalAmount;
            updatedBooking.paymentDetails.totalAmount = totalAmount;
            updatedBooking.paymentDetails.depositAmount = depositAmount;
            updatedBooking.paymentDetails.remainingBalance = totalAmount - depositAmount;
            updatedBooking.paymentDetails.tip = tipAmount;
            updatedBooking.paymentDetails.paypalOrderId = data.orderID;
            updatedBooking.paymentDetails.paypalTransactionId = paymentId;
            updatedBooking.paymentDetails.paymentStatus = 'completed';
            updatedBooking.paymentDetails.paymentDate = new Date().toISOString();
            updatedBooking.updatedAt = new Date().toISOString();
            
            const success = await saveBookingData(updatedBooking);
            if (success) {
              setPaymentId(paymentId);
              setPaymentCompleted(true);
              
              // Delete pending/deferred bookings with overlapping items
              if (user && updatedBooking.orderDetails?.items) {
                const itemNames = updatedBooking.orderDetails.items.map(item => item.name);
                await deletePendingBookingsWithOverlappingItems(
                  user.uid,
                  pendingBookingId,
                  itemNames
                );
              }
              
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
              // Debug log removed));
              // Debug log removed
              
              if (giftCardsInCart.length > 0 && user) {
                let anyGiftCardFailed = false;
                try {
                  // Debug log removed
                  for (const giftCardItem of giftCardsInCart) {
                    // Log all fields for debugging
                    // Debug log removed);
                    const quantity = giftCardItem.quantity || 1;
                    const value = giftCardItem.giftCardValue || giftCardItem.price;
                    if (!value || value <= 0) {
                      console.error('❌ Invalid gift card value:', value, giftCardItem);
                      anyGiftCardFailed = true;
                      continue;
                    }
                    for (let i = 0; i < quantity; i++) {
                      const giftCardCode = await generateUniqueGiftCardCode();
                      // Debug log removed
                      const success = await createGiftCardInDatabase(
                        giftCardCode,
                        value,
                        user.uid,
                        user.email || '',
                        user.displayName || '',
                        false // isGift = false for purchased cards
                      );
                      if (success) {
                        // Debug log removed
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
                    // Debug log removed
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
                // Debug log removed
              }

              // Create promotional gift card for GOGO discount if applicable
              if (discounts.bogoGiftCard && giftCardsInCart.length > 0 && user) {
                try {
                  // Debug log removed
                  
                  // Find the highest value gift card in the cart
                  let highestValue = 0;
                  for (const giftCardItem of giftCardsInCart) {
                    const value = giftCardItem.giftCardValue || giftCardItem.price;
                    if (value > highestValue) {
                      highestValue = value;
                    }
                  }
                  
                  // Debug log removed
                  
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
                    // Debug log removed
                    
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
                        // Debug log removed
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
                // Debug log removed
                
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

                // Debug log removed

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
                
                  // Debug log removed
                  // Debug log removed
                  
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
              
              // Debug log removed
              // Debug log removed
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
      
      // Debug log removed
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
      
      // Debug log removed
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
          totalAmount: total,
          ...(tipAmount > 0 && { tip: tipAmount })
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
      
      // Debug log removed
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
      let phone = userData?.phone || userData?.phoneNumber || "";
      
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

      // Calculate event start and end times
      let eventStart: string | undefined;
      let eventEnd: string | undefined;
      
      if (calendarDateRange[0] && cartSettings.deliveryTime && cartSettings.duration) {
        const startTime = calculateEventStart(calendarDateRange[0], cartSettings.deliveryTime);
        const endTime = calculateEventEnd(startTime, cartSettings.duration);
        eventStart = startTime.toISOString();
        eventEnd = endTime.toISOString();
      }

      // Prepare booking data
      const bookingData: BookingData = {
        orderID,
        customerID: user.uid,
        status: bookingStatus,
        customerInfo: {
          firstName,
          lastName,
          name: fullName,
          email: user.email || "",
          phone: phone
        },
        orderDetails: {
          eventDate: `${calendarDateRange[0]?.toLocaleDateString()} - ${calendarDateRange[1]?.toLocaleDateString()}`,
          duration: cartSettings.duration,
          deliveryAddress: deliveryAddress,
          surface: cartSettings.surface,
          deliveryTime: cartSettings.deliveryTime,
          ...(eventStart && { eventStart }),
          ...(eventEnd && { eventEnd }),
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
          totalAmount: total,
          ...(tipAmount > 0 && { tip: tipAmount })
        },
        paymentDetails: {
          totalAmount: total,
          depositAmount: depositAmount,
          remainingBalance: total - depositAmount,
          paymentType: paymentType,
          tip: tipAmount,
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
        // Debug log removed
        
        // Use intelligent deferred booking strategy
        const deferredStrategy = getDeferredBookingStrategy();
        // Debug log removed
        
        if (deferredStrategy.strategy === 'partial') {
          // Partial processing: Complete gift cards/memberships, defer rental items
          // Debug log removed
          
          const partialTotals = calculatePartialTotals();
          
          // Update booking with partial status and notes
          const partialDeferred = await deferBooking(
            orderID, 
            `Partial booking: Gift cards/memberships processed ($${partialTotals.processableTotal.toFixed(2)}), rental items deferred due to same-day booking rules`
          );
          
          if (partialDeferred) {
            // Debug log removed
            notifications.show({
              title: '✨ Partial Order Complete',
              message: `Gift cards and memberships processed! Call (803) 221-0466 to confirm your rental items.`,
              color: 'blue',
              autoClose: 10000,
            });
          }
          
        } else if (deferredStrategy.strategy === 'deferred') {
          // Full deferral for rental-only carts
          // Debug log removed
          
          const deferred = await deferBooking(orderID, deferredStrategy.reason);
          if (deferred) {
            // Debug log removed
            notifications.show({
              title: '📞 Booking Deferred',
              message: 'Since your event is within 2 days, we\'ll contact you to confirm details.',
              color: 'orange',
              autoClose: 8000,
            });
          }
          
        } else {
          // Normal processing - no deferral needed
          // Debug log removed
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
          totalAmount: total,
          ...(tipAmount > 0 && { tip: tipAmount })
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
      
      // Debug log removed
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
  // BUT allow deferred bookings (with pendingBookingId) to proceed even with empty cart
  if (cart.length === 0 && completedOrderCart.length === 0 && !isMembershipCheckout && !pendingBookingId && !bookingLoadedFromUrl && !loadingBookingFromUrl) {
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
              userName={user?.displayName || undefined}
              isLoggedIn={!!user}
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
              userName={user?.displayName || undefined}
              isLoggedIn={!!user}
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
                    // Show initial notification
                    notifications.show({
                      title: '🔄 Deleting Booking',
                      message: 'Deleting booking and updating availability...',
                      color: 'blue',
                      autoClose: false,
                      id: 'deleting-booking'
                    });
                    
                    // Delete the booking first
                    await updateBookingStatus(pendingBookingId, 'cancelled');
                    
                    // Clear the booking state
                    setPendingBookingId('');
                    setIsDeferredBooking(false);
                    localStorage.removeItem('resumeBookingId');
                    
                    // Refresh availability for all items that were in the cancelled booking
                    if (calendarDateRange[0] && cartSettings.duration && partyEssentials.length > 0) {
                      const startDate = calendarDateRange[0];
                      const endDate = calculateEndDate(startDate, cartSettings.duration);
                      
                      // Check availability for party essentials to update after cancellation
                      const availabilityPromises = partyEssentials.map(async (item) => {
                        try {
                          const availability = await checkItemAvailability(item.name, 1, startDate, endDate);
                          return { itemName: item.name, availability };
                        } catch (error) {
                          console.error(`Error checking availability for ${item.name}:`, error);
                          return { itemName: item.name, availability: null };
                        }
                      });
                      
                      const results = await Promise.all(availabilityPromises);
                      const newAvailabilityMap = new Map();
                      
                      results.forEach(({ itemName, availability }) => {
                        if (availability) {
                          newAvailabilityMap.set(itemName, availability);
                        }
                      });
                      
                      setItemAvailability(newAvailabilityMap);
                    }
                    
                    // Update notification and refresh
                    notifications.update({
                      id: 'deleting-booking',
                      title: '✅ Booking Deleted',
                      message: 'Booking deleted and availability updated. Refreshing...',
                      color: 'green',
                      autoClose: 1000,
                    });
                    
                    // Refresh page after availability update
                    setTimeout(() => {
                      window.location.reload();
                    }, 1000);
                    
                  } catch (error) {
                    console.error('Error deleting booking:', error);
                    
                    // Clear state even if deletion failed
                    setPendingBookingId('');
                    setIsDeferredBooking(false);
                    localStorage.removeItem('resumeBookingId');
                    
                    notifications.update({
                      id: 'deleting-booking',
                      title: '⚠️ Deletion Error',
                      message: 'Booking state cleared locally. Refreshing...',
                      color: 'orange',
                      autoClose: 1000,
                    });
                    
                    setTimeout(() => {
                      window.location.reload();
                    }, 1000);
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
      {currentStep === 'cart-delivery' && (
      <div className="step-container">
        
        {/* Cart Items */}
        <div className="order-items">
          {getDisplayCart().map((item, idx) => {
            // Get max available quantity from database
            let maxAvailable = 10; // Default fallback
            
            if (item.category === 'party-essentials') {
              maxAvailable = getAvailableQuantityForCartItem(item, idx);
            } else {
              // For regular inflateables, get quantity from database
              const inflateableData = inflateables.find(inf => inf.name === item.name);
              if (inflateableData && inflateableData.quantity) {
                maxAvailable = inflateableData.quantity;
              }
            }
            
            const showQuantityDropdown = maxAvailable > 1;
            
            return (
            <div key={idx} className="order-item" style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              marginBottom: '1rem',
              backgroundColor: 'white',
              padding: '0.4rem'
            }}>
              {/* Left side: Image and Details */}
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                flex: 1,
                alignItems: 'center',
                marginRight: '1rem'
              }} className="order-item-content-wrapper">
                {/* Product Image */}
                <img 
                  src={getProductImage(item.name)} 
                  alt={item.name}
                  className="order-item-image"
                  onError={(e) => {
                    // Fallback if image fails to load
                    e.currentTarget.src = 'https://storage.googleapis.com/pppro-b060e.firebasestorage.app/inflateables/default.webp';
                  }}
                  style={{
                    width: '150px',
                    maxWidth: '150px',
                    height: 'auto',
                    borderRadius: '8px',
                    flexShrink: 0,
                    marginRight: '1rem'
                  }}
                />
                
                {/* Product Details */}
                <div className="order-item-details" style={{ 
                  flex: '1'
                }}>
                  {/* Item Name and Price Row */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    marginBottom: '0.75rem',
                    flexWrap: 'wrap'
                  }}>
                    <div className="order-item-name" style={{ 
                      fontSize: '1.2rem',
                      fontWeight: 'bold',
                      marginRight: '0.5rem'
                    }}>
                      {item.name}
                    </div>
                    <div className="order-item-price" style={{
                      fontSize: '1.2rem',
                      fontWeight: 'bold',
                      color: '#28a745'
                    }}>
                      ${item.isGiftCard 
                        ? ((item.giftCardValue || item.price) * item.quantity).toFixed(2)
                        : (item.price * item.quantity * durationMultiplier).toFixed(2)
                      }
                    </div>
                  </div>
                  
                  {/* Quantity and Wet/Dry Row */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    marginBottom: '0.75rem'
                  }}>
                    {/* Quantity Selector - only show if more than 1 available */}
                    {showQuantityDropdown && (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        marginRight: '1rem',
                        marginBottom: '0.5rem'
                      }}>
                        <label htmlFor={`order-quantity-${idx}`} style={{ fontWeight: '500', marginRight: '0.5rem' }}>Quantity:</label>
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
                            padding: '0.5rem',
                            borderRadius: '4px',
                            border: '1px solid #ddd',
                            fontSize: '1rem',
                            marginRight: '0.5rem'
                          }}
                        >
                          {item.category === 'party-essentials' ? (
                            (() => {
                              return Array.from({ length: Math.max(1, maxAvailable) }, (_, i) => i + 1).map(qty => (
                                <option key={qty} value={qty} disabled={qty > maxAvailable}>
                                  {qty}{qty > maxAvailable ? ' (unavailable)' : ''}
                                </option>
                              ));
                            })()
                          ) : (
                            Array.from({ length: maxAvailable }, (_, i) => i + 1).map(qty => (
                              <option key={qty} value={qty}>{qty}</option>
                            ))
                          )}
                        </select>
                        {item.category === 'party-essentials' && (
                          <span style={{ fontSize: '0.85rem', color: '#666' }}>
                            ({maxAvailable} available)
                          </span>
                        )}
                      </div>
                    )}
                    
                    {/* Wet/Dry Selector */}
                    {!item.isGiftCard && !item.isMembership && item.wetDry === "Wet/Dry" && (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        marginRight: '1rem',
                        marginBottom: '0.5rem'
                      }}>
                        <label style={{ fontWeight: '500', marginRight: '0.5rem' }}>Type:</label>
                        <select
                          value={cartSettings.wetDrySelections[idx] || 'Dry'}
                          onChange={(e) => cartSettings.updateWetDrySelection(idx, e.target.value as 'Wet' | 'Dry')}
                          style={{
                            padding: '0.5rem',
                            borderRadius: '4px',
                            border: '1px solid #ddd',
                            fontSize: '1rem'
                          }}
                        >
                          <option value="Dry">Dry</option>
                          <option value="Wet">Wet (+$50)</option>
                        </select>
                      </div>
                    )}
                    
                    {/* Gift Card Price Info */}
                    {item.isGiftCard && (
                      <span style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
                        ${item.giftCardValue || item.price} each
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Right side: Remove Button */}
              <button
                id={`btn-remove-item-${idx}`}
                className="btn-remove-item"
                onClick={() => removeItemFromCart(idx)}
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.25rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  flexShrink: 0,
                  alignSelf: 'center',
                  whiteSpace: 'nowrap'
                }}
              >
                Remove
              </button>
              
              {/* Mobile-responsive styles */}
              <style>{`
                @media (max-width: 767px) {
                  .order-item {
                    -webkit-box-orient: vertical !important;
                    -webkit-box-direction: normal !important;
                    -webkit-flex-direction: column !important;
                    -ms-flex-direction: column !important;
                    flex-direction: column !important;
                    -webkit-box-align: stretch !important;
                    -webkit-align-items: stretch !important;
                    -ms-flex-align: stretch !important;
                    align-items: stretch !important;
                  }
                  
                  .order-item-content-wrapper {
                    -webkit-box-orient: vertical !important;
                    -webkit-box-direction: normal !important;
                    -webkit-flex-direction: column !important;
                    -ms-flex-direction: column !important;
                    flex-direction: column !important;
                    margin-right: 0 !important;
                  }
                  
                  .order-item-image {
                    width: 90% !important;
                    max-width: 500px !important;
                    margin: 0 auto 1rem auto !important;
                  }
                  
                  .btn-remove-item {
                    width: 100%;
                    margin-top: 0.5rem;
                  }
                }
              `}</style>
            </div>
            );
          })}
        </div>

        {/* Delivery Address Section - only show for inflatable orders */}
        {(() => {
          const hasInflateables = cart.some(item => !item.isGiftCard && !item.isMembership);
          return hasInflateables ? (
            <div className="delivery-input-section" style={{ marginTop: '2rem', marginBottom: '2rem' }}>
              <h3 style={{fontWeight:'bold'}}>Delivery Address</h3>
              <label style={{ display: 'block', marginBottom: '1rem' }}>
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
              
              <button
                id="btn-calculate-delivery"
                onClick={() => {
                  const inputValue = addressInputRef.current?.value?.trim() || '';
                  console.log('🔍 [CALCULATE BUTTON] deliveryAddress state:', deliveryAddress);
                  console.log('🔍 [CALCULATE BUTTON] addressInputRef value:', inputValue);
                  if (inputValue) {
                    // Sync the state with the full address from the input
                    setDeliveryAddress(inputValue);
                    // IMPORTANT: Save to localStorage immediately when user confirms
                    localStorage.setItem('deliveryAddress', inputValue);
                    console.log('🔍 [CALCULATE BUTTON] Saved to localStorage:', inputValue);
                    console.log('🔍 [CALCULATE BUTTON] Calling calculateDeliveryDistance with:', inputValue);
                    calculateDeliveryDistance(inputValue);
                    // Set address as confirmed when user clicks this button
                    setAddressConfirmed(true);
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
                style={{
                  backgroundColor: calculatingDistance ? '#6c757d' : (addressConfirmed ? '#28a745' : '#007bff'),
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  cursor: calculatingDistance || !deliveryAddress.trim() ? 'not-allowed' : 'pointer',
                  opacity: calculatingDistance || !deliveryAddress.trim() ? 0.6 : 1,
                  marginBottom: '1rem'
                }}
              >
                {calculatingDistance ? 'Calculating...' : (addressConfirmed ? '✓ Address Confirmed' : 'Confirm Address')}
              </button>
              
              {/* Development Skip Button */}
              {import.meta.env.DEV && (
                <button
                  id="btn-skip-delivery"
                  onClick={() => {
                    if (!deliveryAddress.trim()) {
                      setDeliveryAddress('123 Test Street, Augusta, GA 30901');
                    }
                    if (!cartSettings.location) {
                      cartSettings.setLocation('personal home');
                    }
                    setDeliveryCost(0);
                    setCalculatingDistance(false);
                    setAddressConfirmed(true); // Skip address confirmation in dev mode
                    notifications.show({
                      title: '🚧 Development Mode',
                      message: 'Delivery calculation skipped for testing',
                      color: 'yellow',
                      autoClose: 3000,
                    });
                  }}
                  style={{
                    backgroundColor: '#ffc107',
                    color: '#000',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    marginLeft: '1rem'
                  }}
                >
                  🚧 Skip Delivery (Dev Mode)
                </button>
              )}
            </div>
          ) : (
            <div style={{ marginTop: '2rem', marginBottom: '2rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <p style={{ margin: 0, color: '#666' }}>✓ Gift card orders do not require delivery</p>
            </div>
          );
        })()}

        {/* Event Details - only show when cart has inflateables */}
        {(() => {
          const hasInflateables = cart.some(item => !item.isGiftCard && !item.isMembership);
          return hasInflateables ? (
            <div className="event-details" style={{
              marginTop: '2rem',
              marginBottom: '2rem'
            }}>
              <h3 style={{
                margin: '0 0 1.5rem 0',
                fontSize: '1.5rem',
                fontWeight: '600',
                color: '#212529',
                borderBottom: '2px solid #007bff',
                paddingBottom: '0.5rem'
              }}>Event Settings</h3>
              
              <div className="cart-dropdowns" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1.25rem',
                marginBottom: '1.5rem'
              }}>
                <label style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  color: '#495057'
                }}>
                  <span style={{ color: '#212529' }}>Event Start Time:</span>
                  <select 
                    value={cartSettings.deliveryTime} 
                    onChange={e => cartSettings.setDeliveryTime(e.target.value)} 
                    required
                    style={{
                      padding: '0.75rem',
                      border: '1px solid #ced4da',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out'
                    }}
                  >
                    <option value="">Select time</option>
                    {getAvailableDeliveryTimes().map(timeOption => (
                      <option key={timeOption.value} value={timeOption.value}>
                        {timeOption.label}
                      </option>
                    ))}
                    {getAvailableDeliveryTimes().length === 0 && (
                      <option value="" disabled>
                        No times available
                      </option>
                    )}
                  </select>
                  {getAvailableDeliveryTimes().length === 0 && calendarDateRange[0] && (
                    <div style={{ 
                      color: '#dc3545', 
                      fontSize: '0.8rem', 
                      marginTop: '0.25rem',
                      fontStyle: 'italic',
                      lineHeight: '1.4'
                    }}>
                      Same-day bookings require at least 2 hours notice. Please select a different date or call (803) 221-0466 for urgent requests.
                    </div>
                  )}
                </label>

                <label style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  color: '#495057'
                }}>
                  <span style={{ color: '#212529' }}>Event Duration:</span>
                  <select 
                    value={cartSettings.duration} 
                    onChange={e => cartSettings.setDuration(e.target.value)} 
                    required
                    style={{
                      padding: '0.75rem',
                      border: '1px solid #ced4da',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out'
                    }}
                  >
                    <option value="">Select duration</option>
                    <option value="4hours" disabled={!availableDurations.has('4hours')}>
                      4 Hours (-10%){!availableDurations.has('4hours') ? ' - Unavailable' : ''}
                    </option>
                    <option value="24hours" disabled={!availableDurations.has('24hours')}>
                      24 Hours (Standard){!availableDurations.has('24hours') ? ' - Unavailable' : ''}
                    </option>
                    <option value="24hours-pickup6" disabled={!availableDurations.has('24hours')}>
                      24 Hours (pick up at 6 PM +$10){!availableDurations.has('24hours') ? ' - Unavailable' : ''}
                    </option>
                    <option value="24hours-pickup7" disabled={!availableDurations.has('24hours')}>
                      24 Hours (pick up at 7 PM +$20){!availableDurations.has('24hours') ? ' - Unavailable' : ''}
                    </option>
                    <option value="24hours-pickup8" disabled={!availableDurations.has('24hours')}>
                      24 Hours (pick up at 8 PM +$30){!availableDurations.has('24hours') ? ' - Unavailable' : ''}
                    </option>
                    <option value="48hours" disabled={!availableDurations.has('48hours')}>
                      48 Hours (+50%){!availableDurations.has('48hours') ? ' - Unavailable' : ''}
                    </option>
                  </select>
                  {calendarDateRange[0] && !availableDurations.has(cartSettings.duration) && cartSettings.duration && (
                    <div style={{
                      backgroundColor: '#fff3cd',
                      border: '1px solid #ffc107',
                      borderRadius: '4px',
                      padding: '0.5rem',
                      fontSize: '0.85rem',
                      color: '#856404',
                      marginTop: '0.25rem'
                    }}>
                      ⚠️ Selected duration unavailable - items are booked during this timeframe. Please choose another duration.
                    </div>
                  )}
                </label>

                <label style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  color: '#495057'
                }}>
                  <span style={{ color: '#212529' }}>Event Location Type:</span>
                  <select 
                    value={cartSettings.location} 
                    onChange={e => cartSettings.setLocation(e.target.value)} 
                    required
                    style={{
                      padding: '0.75rem',
                      border: '1px solid #ced4da',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out'
                    }}
                  >
                    <option value="">Select location type</option>
                    {locationOptions.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </label>

                <label style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  color: '#495057'
                }}>
                  <span style={{ color: '#212529' }}>Surface Type:</span>
                  <select 
                    value={cartSettings.surface} 
                    onChange={e => cartSettings.setSurface(e.target.value)} 
                    required
                    style={{
                      padding: '0.75rem',
                      border: '1px solid #ced4da',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out'
                    }}
                  >
                    <option value="">Select surface</option>
                    <option value="grass-stakes">Grass (stakes)</option>
                    <option value="grass-sandbags">Grass (sandbags) (+$50)</option>
                    <option value="concrete">Concrete/Pavement (+$50)</option>
                    <option value="indoor">Indoor (+$50)</option>
                  </select>
                </label>
              </div>

              <div style={{
                backgroundColor: 'white',
                marginTop: '1rem'
              }}>
                <p style={{
                  margin: 0,
                  fontSize: '1rem',
                  color: '#495057'
                }}>
                  <strong style={{ color: '#212529' }}>Event Dates:</strong>{' '}
                  {(() => {
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
                  })()}
                </p>
              </div>
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
                  <span>Event Duration:</span>
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
              <span>Early Delivery:</span>
              <span>${timeAdj.toFixed(2)}</span>
            </div>
          )}
          {pickupFee > 0 && (
            <div className="pricing-row">
              <span>Late Pickup Fee:</span>
              <span>${pickupFee.toFixed(2)}</span>
            </div>
          )}
          
          {deliveryCost > 0 && (
            <div className="pricing-row">
              <span>Delivery Cost:</span>
              <span>${deliveryCost.toFixed(2)}</span>
            </div>
          )}
          <div className="pricing-row">
            <span>Sales Tax (8%):</span>
            <span>${salesTax.toFixed(2)}</span>
          </div>
          <div className="pricing-total">
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
        
        {/* Navigation Buttons */}
        <div className="checkout-navigation-buttons">
          <button
            className="btn-next"
            id="btn-main-flow"
            onClick={() => goToNextStep()}
            disabled={!canShowNextButton()}
          >
            {getNextStepButtonText()}
          </button>
        </div>
      </div>
      )}

      {/* Party Essentials Step - only for orders with inflateables */}
      {currentStep === 'party-essentials' && (
      <div className="step-container">
       
        
        {/* Party Essentials Carousel */}
        <div className="party-essentials-section" style={{ marginTop: '2rem', marginBottom: '2rem' }}>
         
          <div style={{ position: 'relative' }}>
            {/* Left Arrow */}
            <button
              onClick={() => scrollCarousel('left')}
              disabled={!canScrollLeft()}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 10,
                backgroundColor: canScrollLeft() ? 'rgba(0, 123, 255, 0.9)' : 'rgba(128, 128, 128, 0.5)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '50px',
                height: '50px',
                fontSize: '24px',
                cursor: canScrollLeft() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                transition: 'all 0.2s ease',
                opacity: canScrollLeft() ? 1 : 0.5
              }}
              onMouseEnter={(e) => {
                if (canScrollLeft()) {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 123, 255, 1)';
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (canScrollLeft()) {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 123, 255, 0.9)';
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                }
              }}
            >
              ‹
            </button>
            
            {/* Right Arrow */}
            <button
              onClick={() => scrollCarousel('right')}
              disabled={!canScrollRight()}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 10,
                backgroundColor: canScrollRight() ? 'rgba(0, 123, 255, 0.9)' : 'rgba(128, 128, 128, 0.5)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '50px',
                height: '50px',
                fontSize: '24px',
                cursor: canScrollRight() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                transition: 'all 0.2s ease',
                opacity: canScrollRight() ? 1 : 0.5
              }}
              onMouseEnter={(e) => {
                if (canScrollRight()) {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 123, 255, 1)';
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (canScrollRight()) {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 123, 255, 0.9)';
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                }
              }}
            >
              ›
            </button>
            
            <div 
              ref={carouselRef}
              className="party-essentials-carousel"
              onScroll={updateCarouselScrollPosition}
            >
            {partyEssentials.map((item) => {
              const isWeekend = calendarDateRange[0] && (calendarDateRange[0].getDay() === 0 || calendarDateRange[0].getDay() === 6);
              const price = isWeekend ? item.weekendPrice : item.weekdayPrice;
              const currentQuantity = lastMinuteAdditions[item.name] || 0;
              const itemSubtotal = currentQuantity * price * durationMultiplier;
              const itemTax = itemSubtotal * 0.08;
              const itemTotal = itemSubtotal + itemTax;
              
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
                        Added: {currentQuantity} x ${price} = ${itemTotal.toFixed(2)}
                        <br />
                        <small style={{ color: '#666' }}>(includes ${itemTax.toFixed(2)} tax)</small>
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
                                className="btn-add-to-order"
                                disabled
                                style={{
                                  opacity: 0.5,
                                  cursor: 'not-allowed'
                                }}
                              >
                                Unavailable
                              </button>
                            </>
                          ) : (
                            <button
                              id={`btn-add-last-minute-${item.name.replace(/\s+/g, '-').toLowerCase()}`}
                              className="btn-add-to-order"
                              onClick={() => handleAddToOrderClick(item.name)}
                            >
                              Add to Order
                            </button>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
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
                  const itemSubtotal = quantity * price * durationMultiplier;
                  const itemTax = itemSubtotal * 0.08;
                  const itemTotal = itemSubtotal + itemTax;
                  return (
                    <div key={itemName} className="essentials-item-row">
                      <span>{itemName} x{quantity}</span>
                      <span>${itemTotal.toFixed(2)}</span>
                    </div>
                  );
                })
              }
              <div className="essentials-subtotal" style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #dee2e6' }}>
                <span>Subtotal:</span>
                <span>${lastMinuteTotal.toFixed(2)}</span>
              </div>
              <div className="essentials-tax">
                <span>Sales Tax (8%):</span>
                <span>${(lastMinuteTotal * 0.08).toFixed(2)}</span>
              </div>
              <div className="essentials-total">
                <span>Essentials Total:</span>
                <span>${(lastMinuteTotal + lastMinuteTotal * 0.08).toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Navigation Buttons */}
        <div className="checkout-navigation-buttons">
          <button
            className="btn-back"
            id="btn-back-party-essentials"
            onClick={goToPreviousStep}
          >
            ← Back to Cart & Delivery
          </button>
          <button
            className="btn-next"
            id="btn-continue-party-essentials"
            onClick={() => goToNextStep()}
            disabled={!canShowNextButton()}
          >
            {getNextStepButtonText()}
          </button>
        </div>
      </div>
      )}

      {currentStep === 'contract' && (
        <div className={currentStep === 'contract' ? 'contract-container' : 'step-container'}>
        {/* Contract Section - Only show when currentStep is 'contract' */}
        {currentStep === 'contract' && (
          <ContractSigning
            user={user}
            userProfile={userProfile}
            calendarDateRange={calendarDateRange}
            deliveryAddress={deliveryAddress}
            total={total}
            onContractComplete={handleContractCompletion}
            onValidationChange={handleContractValidationChange}
          />
        )}
        
        {/* Contract Navigation Buttons - Back and complete buttons in same row */}
        {currentStep === 'contract' && (
          <div className="checkout-navigation-buttons">
            <button
              className="btn-back"
              id="btn-back-contract-only"
              onClick={goToPreviousStep}
            >
              ← Back to Order Summary
            </button>
            <button
              className="btn-next"
              id="btn-complete-contract"
              onClick={() => contractValidData && handleContractCompletion(contractValidData)}
              disabled={!isContractValid}
            >
              {isContractValid
                ? 'Complete Contract & Proceed to Payment'
                : 'Complete All Required Fields Above'}
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
                    setCurrentStep('cart-delivery');
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
                        // Debug log removed
                        const booking = await loadBookingData(pendingBookingId);
                        // Debug log removed
                        
                        if (booking?.orderDetails?.items) {
                          // Debug log removed
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
                          
                          // Debug log removed
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
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Items:</strong>
              {getDisplayCart().map((item, index) => {
                const wetDrySelection = cartSettings.wetDrySelections[index] || 'Dry';
                return (
                  <div key={index} className="payment-summary-item">
                    {!item.isGiftCard && !item.isMembership && (
                      <img 
                        src={getProductImage(item.name)} 
                        alt={item.name}
                        className="payment-summary-image"
                        onError={(e) => {
                          e.currentTarget.src = 'https://storage.googleapis.com/pppro-b060e.firebasestorage.app/inflateables/default.webp';
                        }}
                      />
                    )}
                    <div className="payment-summary-details">
                      <div className="payment-summary-name">• {item.name} - ${item.price.toFixed(2)}</div>
                      {!item.isGiftCard && !item.isMembership && (
                        <div className="payment-summary-type">
                          Type: {wetDrySelection}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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

          {/* Detailed Pricing Breakdown */}
          <div style={{ 
            marginBottom: '2rem', 
            padding: '1rem', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '4px' 
          }}>
            <div className="pricing-breakdown">
              <div className="pricing-row">
                <span>Cart Subtotal:</span>
                <span>${(() => {
                  const baseCartTotal = cart.reduce((sum, item) => {
                    if (item.isGiftCard) {
                      return sum + (item.giftCardValue || item.price) * item.quantity;
                    } else {
                      return sum + item.price * item.quantity;
                    }
                  }, 0);
                  return baseCartTotal.toFixed(2);
                })()}</span>
              </div>
              {(() => {
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
                      <span>Event Duration:</span>
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
                  <span>Early Delivery:</span>
                  <span>${timeAdj.toFixed(2)}</span>
                </div>
              )}
              {pickupFee > 0 && (
                <div className="pricing-row">
                  <span>Late Pickup Fee:</span>
                  <span>${pickupFee.toFixed(2)}</span>
                </div>
              )}
              {lastMinuteTotal > 0 && (
                <div className="pricing-row">
                  <span>Party Essentials:</span>
                  <span>${lastMinuteTotal.toFixed(2)}</span>
                </div>
              )}
              {deliveryCost > 0 && (
                <div className="pricing-row">
                  <span>Delivery Cost:</span>
                  <span>${deliveryCost.toFixed(2)}</span>
                </div>
              )}
              <div className="pricing-row">
                <span>Sales Tax (8%):</span>
                <span>${salesTax.toFixed(2)}</span>
              </div>
              <div className="pricing-total">
                <span>Total:</span>
                <span>${total.toFixed(2)}</span>
              </div>
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

          {/* Tip Your Driver Section */}
          {!requiresPhoneCall && (
            <div style={{ 
              marginBottom: '2rem',
              padding: '1rem',
              backgroundColor: '#f0f8ff',
              border: '2px solid #4a90e2',
              borderRadius: '8px'
            }}>
              <h3 style={{ marginBottom: '1rem', color: '#2c5aa0' }}>Tip Your Driver?</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <label htmlFor="tip-amount" style={{ fontWeight: '500', color: '#333' }}>
                  Show your appreciation:
                </label>
                <select
                  id="tip-amount"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(parseFloat(e.target.value))}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '4px',
                    border: '1px solid #4a90e2',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    backgroundColor: 'white'
                  }}
                >
                  <option value={0}>No Tip</option>
                  <option value={5}>$5</option>
                  <option value={10}>$10</option>
                  <option value={20}>$20</option>
                </select>
                {tipAmount > 0}
              </div>
            </div>
          )}

          {/* Event Notes Section */}
          {!requiresPhoneCall && (
            <div style={{ 
              marginBottom: '2rem',
              padding: '1rem',
              backgroundColor: '#fff9e6',
              border: '2px solid #ffa726',
              borderRadius: '8px'
            }}>
              <h3 style={{ marginBottom: '1rem', color: '#f57c00' }}>Event Notes (Optional)</h3>
              <div>
                <label htmlFor="event-notes" style={{ fontWeight: '500', color: '#333', display: 'block', marginBottom: '0.5rem' }}>
                  Any special instructions or notes about your event?
                </label>
                <textarea
                  id="event-notes"
                  value={eventNotes}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length <= 500) {
                      setEventNotes(value);
                    }
                  }}
                  maxLength={500}
                  placeholder="Add any special instructions, setup preferences, or notes for the event..."
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    padding: '0.75rem',
                    borderRadius: '4px',
                    border: '1px solid #ffa726',
                    fontSize: '1rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    backgroundColor: 'white'
                  }}
                />
                <div style={{ 
                  marginTop: '0.5rem', 
                  fontSize: '0.875rem', 
                  color: '#666',
                  textAlign: 'right'
                }}>
                  {eventNotes.length}/500 characters
                </div>
              </div>
            </div>
          )}

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
                
                <div className="payment-options-container">
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
                className="btn-back"
                id="btn-back-contract"
                onClick={goToPreviousStep}
                disabled={processingPayment}
              >
                ← Back to Contract
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
        onMenuClick={() => setIsProfileMenuOpen(prev => !prev)}
      />
      
      {/* Profile Menu Sidebar */}
      <ProfileMenuSidebar
        isOpen={isProfileMenuOpen}
        onClose={() => setIsProfileMenuOpen(false)}
      />
          </>
        )}
      </MantineProvider>
    </>
  );
}
