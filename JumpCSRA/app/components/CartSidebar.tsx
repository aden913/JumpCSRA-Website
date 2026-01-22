import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router";
import { onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, get } from "firebase/database";
import { initializeApp, getApps } from "firebase/app";
import { auth, firebaseConfig, firestore } from "./FirebaseConfig";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getUnavailableInflateables } from '../utils/bookingUtils';
import { useDiscounts, getDiscountDescription, type DiscountCalculation } from '../hooks/useDiscounts';
import { checkItemAvailability, type ItemAvailability } from '../utils/availabilityUtils';
import { getIncompleteBookingsForUser, saveBookingData, loadBookingData, isUserMember } from '../utils/databaseUtils';
import type { BookingData } from '../utils/databaseUtils';
import '../styles/cart.css';

export type CartItem = {
  id: string;
  name: string;
  price: number;
  wetDry: string;
  quantity: number;
  category: string; // e.g. 'party essential', 'inflateable', 'game', 'membership', etc.
  wet?: boolean;
  dry?: boolean;
  image?: string;
  isGiftCard?: boolean;
  giftCardValue?: number; // For gift cards: 50 or 100
  excludeFromDiscounts?: boolean;
  isMembership?: boolean; // For membership items
  membershipType?: 'jump-club'; // Type of membership
};

export type CartSidebarProps = {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  setCart: (cart: CartItem[]) => void;
  calendarDateRange: [Date | null, Date | null];
  discountLogic: ReturnType<typeof useDiscounts>;
  cartSettings?: {
    duration: string;
    setDuration: (duration: string) => void;
    surface: string;
    setSurface: (surface: string) => void;
    deliveryTime: string;
    setDeliveryTime: (deliveryTime: string) => void;
    location: string;
    setLocation: (location: string) => void;
    wetDrySelections: {[idx: number]: string};
    setWetDrySelections: (selections: {[idx: number]: string}) => void;
    giftCardValues: {[idx: number]: number};
    setGiftCardValues: (values: {[idx: number]: number}) => void;
  };
};

// Utility functions for comparing cart with resumable bookings
interface CartComparison {
  itemsMatch: boolean;
  settingsMatch: boolean;
  hasChanges: boolean;
  changedItems?: string[];
  changedSettings?: string[];
}

// Compare cart items with booking items
const compareCartItems = (cartItems: CartItem[], bookingItems: any[], wetDrySelections: {[idx: number]: string}): { match: boolean; changes: string[] } => {
  const changes: string[] = [];
  
  // Check if same number of items
  if (cartItems.length !== bookingItems.length) {
    changes.push(`Different number of items: cart has ${cartItems.length}, booking has ${bookingItems.length}`);
    return { match: false, changes };
  }
  
  // Sort both arrays by name for comparison
  const sortedCartItems = [...cartItems].sort((a, b) => a.name.localeCompare(b.name));
  const sortedBookingItems = [...bookingItems].sort((a, b) => a.name.localeCompare(b.name));
  
  for (let i = 0; i < sortedCartItems.length; i++) {
    const cartItem = sortedCartItems[i];
    const bookingItem = sortedBookingItems[i];
    
    // Check name match
    if (cartItem.name !== bookingItem.name) {
      changes.push(`Item ${i}: "${cartItem.name}" vs "${bookingItem.name}"`);
      continue;
    }
    
    // Check quantity
    if (cartItem.quantity !== bookingItem.quantity) {
      changes.push(`${cartItem.name}: quantity ${cartItem.quantity} vs ${bookingItem.quantity}`);
    }
    
    // Check price (for gift cards and other variable pricing)
    const cartPrice = cartItem.isGiftCard ? (cartItem.giftCardValue || cartItem.price) : cartItem.price;
    if (Math.abs(cartPrice - bookingItem.price) > 0.01) {
      changes.push(`${cartItem.name}: price $${cartPrice} vs $${bookingItem.price}`);
    }
  }
  
  return { match: changes.length === 0, changes };
};

// Compare cart settings with booking settings
const compareCartSettings = (
  cartSettings: {
    duration: string;
    surface: string;
    deliveryTime: string;
    location: string;
  },
  booking: BookingData
): { match: boolean; changes: string[] } => {
  const changes: string[] = [];
  
  if (cartSettings.duration !== booking.orderDetails.duration) {
    changes.push(`Duration: "${cartSettings.duration}" vs "${booking.orderDetails.duration}"`);
  }
  
  if (cartSettings.surface !== booking.orderDetails.surface) {
    changes.push(`Surface: "${cartSettings.surface}" vs "${booking.orderDetails.surface}"`);
  }
  
  if (cartSettings.deliveryTime !== booking.orderDetails.deliveryTime) {
    changes.push(`Delivery time: "${cartSettings.deliveryTime}" vs "${booking.orderDetails.deliveryTime}"`);
  }
  
  // Extract location from delivery address (simplified check)
  const bookingLocation = booking.orderDetails.deliveryAddress || '';
  if (cartSettings.location !== bookingLocation) {
    changes.push(`Location: "${cartSettings.location}" vs "${bookingLocation}"`);
  }
  
  return { match: changes.length === 0, changes };
};

// Find best matching resumable booking
const findMatchingBooking = async (
  userId: string,
  cartItems: CartItem[],
  cartSettings: {
    duration: string;
    surface: string;
    deliveryTime: string;
    location: string;
  },
  wetDrySelections: {[idx: number]: string}
): Promise<{ booking: BookingData | null; comparison: CartComparison | null }> => {
  try {
    const incompleteBookings = await getIncompleteBookingsForUser(userId);
    console.log('🔍 [DEBUG] Found incomplete bookings:', incompleteBookings.length);
    
    if (incompleteBookings.length === 0) {
      return { booking: null, comparison: null };
    }
    
    // Find exact matches first, then partial matches
    for (const booking of incompleteBookings) {
      const itemComparison = compareCartItems(cartItems, booking.orderDetails.items, wetDrySelections);
      const settingsComparison = compareCartSettings(cartSettings, booking);
      
      const comparison: CartComparison = {
        itemsMatch: itemComparison.match,
        settingsMatch: settingsComparison.match,
        hasChanges: !itemComparison.match || !settingsComparison.match,
        changedItems: itemComparison.changes,
        changedSettings: settingsComparison.changes
      };
      
      console.log(`🔍 [DEBUG] Booking ${booking.orderID} comparison:`, comparison);
      
      // Return first exact match
      if (!comparison.hasChanges) {
        console.log(`✅ [DEBUG] Found exact match: ${booking.orderID}`);
        return { booking, comparison };
      }
      
      // Return first partial match (for now - could be improved to rank matches)
      if (comparison.itemsMatch && !comparison.settingsMatch) {
        console.log(`⚠️ [DEBUG] Found partial match (settings changed): ${booking.orderID}`);
        return { booking, comparison };
      }
    }
    
    console.log('❌ [DEBUG] No matching bookings found');
    return { booking: null, comparison: null };
  } catch (error) {
    console.error('❌ Error finding matching booking:', error);
    return { booking: null, comparison: null };
  }
};

// Update existing booking with current cart data
const updateExistingBooking = async (
  existingBooking: BookingData,
  cartItems: CartItem[],
  cartSettings: {
    duration: string;
    surface: string;
    deliveryTime: string;
    location: string;
  },
  wetDrySelections: {[idx: number]: string},
  calendarDateRange: [Date | null, Date | null]
): Promise<BookingData | null> => {
  try {
    console.log('🔄 [DEBUG] Updating existing booking:', existingBooking.orderID);
    
    // Calculate the new total amount with current cart and settings
    const durationMultipliers: Record<string, number> = {
      "4hours": 0.9,
      "24hours": 1.0,
      "48hours": 1.5,
    };
    
    const surfacePrices: Record<string, number> = {
      "grass-stakes": 0,
      "grass-sandbags": 50,
      "concrete": 50,
      "indoor": 40,
    };
    
    const timePrices: Record<string, number> = {
      "8am": 50,
      "9am": 40,
      "10am": 30,
      "11am": 20,
      "12pm": 10,
      "": 0,
    };
    
    const durationMultiplier = durationMultipliers[cartSettings.duration] || 1.0;
    
    // Calculate cart total
    let cartTotal = 0;
    let nonGiftCardItemCount = 0;
    const updatedItems = cartItems.map((item, index) => {
      let itemTotal;
      
      if (item.isGiftCard) {
        itemTotal = (item.giftCardValue || item.price) * item.quantity;
      } else {
        itemTotal = item.price * item.quantity * durationMultiplier;
        nonGiftCardItemCount += item.quantity; // Count non-gift card items for per-item pricing
        
        // Add wet surcharge if applicable
        if (item.wetDry === "Wet/Dry" && wetDrySelections[index] === "Wet") {
          itemTotal += 50 * item.quantity;
        }
      }
      
      cartTotal += itemTotal;
      
      return {
        name: item.name,
        quantity: item.quantity,
        price: item.isGiftCard ? (item.giftCardValue || item.price) : item.price
      };
    });
    
    // Calculate per-item adjustments for surface and time (excluding gift cards)
    const surfaceAdj = (surfacePrices[cartSettings.surface] || 0) * nonGiftCardItemCount;
    const timeAdj = (timePrices[cartSettings.deliveryTime] || 0) * nonGiftCardItemCount;
    
    const newTotalAmount = cartTotal + surfaceAdj + timeAdj;
    
    console.log('💰 [DEBUG] New total amount calculated:', newTotalAmount);
    
    // Update the booking data
    const updatedBooking: BookingData = {
      ...existingBooking,
      orderDetails: {
        ...existingBooking.orderDetails,
        eventDate: calendarDateRange[0]?.toISOString() || existingBooking.orderDetails.eventDate,
        duration: cartSettings.duration,
        surface: cartSettings.surface,
        deliveryTime: cartSettings.deliveryTime,
        deliveryAddress: cartSettings.location,
        items: updatedItems,
        totalAmount: newTotalAmount
      },
      paymentDetails: {
        ...existingBooking.paymentDetails,
        totalAmount: newTotalAmount,
        // Recalculate deposit amount if this was a deposit booking
        depositAmount: existingBooking.paymentDetails.paymentType === 'deposit' 
          ? newTotalAmount * 0.5 // Simplified - adjust based on actual logic
          : newTotalAmount
      }
    };
    
    // Save the updated booking
    await saveBookingData(updatedBooking);
    
    console.log('✅ [DEBUG] Booking updated successfully');
    return updatedBooking;
  } catch (error) {
    console.error('❌ [DEBUG] Error updating existing booking:', error);
    return null;
  }
};

export function CartSidebar({ open, onClose, cart, setCart, calendarDateRange, discountLogic, cartSettings }: CartSidebarProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [userIsMember, setUserIsMember] = useState<boolean>(false);
  
  // Check if booking is for today and filter delivery times accordingly
  const getAvailableDeliveryTimes = () => {
    const allTimeOptions = [
      { value: "8am", label: "8am", hour: 8 },
      { value: "9am", label: "9am", hour: 9 },
      { value: "10am", label: "10am", hour: 10 },
      { value: "11am", label: "11am", hour: 11 },
      { value: "12pm", label: "12pm", hour: 12 }
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
  
  // Check authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Check user membership status when user changes
  useEffect(() => {
    const checkMembershipStatus = async () => {
      if (user) {
        const isMember = await isUserMember(user.uid);
        setUserIsMember(isMember);
        console.log(`🎖️ User membership status: ${isMember}`);
      } else {
        setUserIsMember(false);
      }
    };
    
    checkMembershipStatus();
  }, [user]);
  
  useEffect(() => {
    if (open && cart.length > 0) {
      cart.forEach((item, idx) => {
      });
    }
  }, [open, cart]);
  // Helper: is item a party essential?
  const isPartyEssential = (item: CartItem) => {
    return item.category && item.category.toLowerCase() === "party-essentials";
  };
  // Helper: does item support both wet and dry?
  // Use wetDry property from cart item
  const supportsWetDry = (item: CartItem) => {
    return item.wetDry === "Wet/Dry";
  };

  // Helper: is item a gift card?
  const isGiftCard = (item: CartItem) => {
    return item.name?.toLowerCase().includes('gift card') || item.isGiftCard;
  };

  // Track wet/dry selection for each item - use cartSettings if provided
  const [localWetDrySelections, setLocalWetDrySelections] = useState<{[idx: number]: string}>({});
  const wetDrySelections = cartSettings?.wetDrySelections ?? localWetDrySelections;
  const updateWetDrySelections = (updater: ((prev: {[idx: number]: string}) => {[idx: number]: string}) | {[idx: number]: string}) => {
    if (cartSettings?.setWetDrySelections) {
      if (typeof updater === 'function') {
        cartSettings.setWetDrySelections(updater(cartSettings.wetDrySelections));
      } else {
        cartSettings.setWetDrySelections(updater);
      }
    } else {
      if (typeof updater === 'function') {
        setLocalWetDrySelections(updater);
      } else {
        setLocalWetDrySelections(updater);
      }
    }
  };
  
  // Track gift card value selection for each gift card item - use cartSettings if provided
  const [localGiftCardValues, setLocalGiftCardValues] = useState<{[idx: number]: number}>({});
  const giftCardValues = cartSettings?.giftCardValues ?? localGiftCardValues;
  const updateGiftCardValues = (updater: ((prev: {[idx: number]: number}) => {[idx: number]: number}) | {[idx: number]: number}) => {
    if (cartSettings?.setGiftCardValues) {
      if (typeof updater === 'function') {
        cartSettings.setGiftCardValues(updater(cartSettings.giftCardValues));
      } else {
        cartSettings.setGiftCardValues(updater);
      }
    } else {
      if (typeof updater === 'function') {
        setLocalGiftCardValues(updater);
      } else {
        setLocalGiftCardValues(updater);
      }
    }
  };
  
  // ...existing code...
  const [orderInfo, setOrderInfo] = useState("");
  const [surface, setSurface] = useState<string>("");
  const [deliveryTime, setDeliveryTime] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [duration, setDuration] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [unavailableItems, setUnavailableItems] = useState<Set<string>>(new Set());
  const [itemAvailability, setItemAvailability] = useState<Map<string, ItemAvailability>>(new Map());
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [discountCalculation, setDiscountCalculation] = useState<DiscountCalculation>({
    discountAmount: 0,
    appliedDiscount: null,
    freeItemId: null,
    addedGiftCards: [],
    hasValidDiscount: false,
    userCanUse: true,
  });

  // Track if calendar dates have been initialized to avoid resetting quantities on page load
  const initialCalendarLoadRef = useRef(true);

  // Load cart sidebar options from localStorage on component mount
  useEffect(() => {
    setIsHydrated(true);
    
    const savedDuration = localStorage.getItem("cart_duration") || "";
    const savedSurface = localStorage.getItem("cart_surface") || "";
    const savedDeliveryTime = localStorage.getItem("cart_deliveryTime") || "";
    const savedLocation = localStorage.getItem("cart_location") || "";
    
    setDuration(savedDuration);
    setSurface(savedSurface);
    setDeliveryTime(savedDeliveryTime);
    setLocation(savedLocation);
    setIsLoaded(true);

    // Load wet/dry selections
    const savedWetDrySelections = localStorage.getItem("cart_wetDrySelections");
    if (savedWetDrySelections) {
      try {
        const parsedWetDry = JSON.parse(savedWetDrySelections);
        
        // Update both local state and cartSettings if available
        setLocalWetDrySelections(parsedWetDry);
        if (cartSettings?.setWetDrySelections) {
          cartSettings.setWetDrySelections(parsedWetDry);
        }
      } catch (error) {
        console.error("Error parsing wet/dry selections from localStorage:", error);
      }
    }

    // Load gift card values
    const savedGiftCardValues = localStorage.getItem("cart_giftCardValues");
    if (savedGiftCardValues) {
      try {
        const parsedGiftCards = JSON.parse(savedGiftCardValues);
        
        // Update both local state and cartSettings if available
        setLocalGiftCardValues(parsedGiftCards);
        if (cartSettings?.setGiftCardValues) {
          cartSettings.setGiftCardValues(parsedGiftCards);
        }
      } catch (error) {
        console.error("Error parsing gift card values from localStorage:", error);
      }
    }
  }, []); // Empty dependency array - only run once on mount

  // Save cart sidebar options to localStorage when they change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("cart_duration", duration);
    }
  }, [duration, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("cart_surface", surface);
    }
  }, [surface, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("cart_deliveryTime", deliveryTime);
    }
  }, [deliveryTime, isLoaded]);

  // Validate delivery time when calendar dates change (clear if no longer valid)
  useEffect(() => {
    if (deliveryTime && calendarDateRange[0]) {
      const availableTimes = getAvailableDeliveryTimes();
      const isCurrentTimeValid = availableTimes.some(time => time.value === deliveryTime);
      
      if (!isCurrentTimeValid) {
        setDeliveryTime("");
        if (cartSettings?.setDeliveryTime) {
          cartSettings.setDeliveryTime("");
        }
      }
    }
  }, [calendarDateRange, deliveryTime, cartSettings]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("cart_location", location);
    }
  }, [location, isLoaded]);

  // Save wet/dry selections to localStorage when they change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("cart_wetDrySelections", JSON.stringify(wetDrySelections));
    }
  }, [wetDrySelections, isLoaded]);

  // Save gift card values to localStorage when they change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("cart_giftCardValues", JSON.stringify(giftCardValues));
    }
  }, [giftCardValues, isLoaded]);

  // Clear surface and delivery time selections when cart contains only gift cards/memberships
  useEffect(() => {
    if (isLoaded && cart.length > 0) {
      const hasInflateables = cart.some(item => !isGiftCard(item) && !item.isMembership);
      
      if (!hasInflateables) {
        // Cart contains only gift cards and/or memberships - clear additional cost settings
        // This prevents surface fees ($50) and delivery time fees ($10-$50) from persisting
        if (surface) {
          setSurface("");
          if (cartSettings?.setSurface) {
            cartSettings.setSurface("");
          }
        }
        if (deliveryTime) {
          setDeliveryTime("");
          if (cartSettings?.setDeliveryTime) {
            cartSettings.setDeliveryTime("");
          }
        }
        // Note: We keep duration and location as they might be needed for gift card delivery
        // but they don't add extra costs for gift cards/memberships
      }
    }
  }, [cart, isLoaded, surface, deliveryTime, cartSettings]);

  // Calculate end date based on duration
  const calculateEndDate = (startDate: Date, durationOption: string): Date => {
    const endDate = new Date(startDate);
    switch (durationOption) {
      case "4hours":
        endDate.setHours(endDate.getHours() + 4);
        break;
      case "24hours":
        endDate.setDate(endDate.getDate() + 1);
        break;
      case "48hours":
        endDate.setDate(endDate.getDate() + 2);
        break;
      default:
        endDate.setDate(endDate.getDate() + 1); // Default to 24 hours
    }
    return endDate;
  };

  // Load inflateables data function - now from Firebase instead of JSON
  const loadInflateablesData = async (): Promise<any[]> => {
    try {
      // Load from Firebase Realtime Database instead of JSON file
      if (!getApps().length) {
        initializeApp(firebaseConfig);
      }
      const database = getDatabase();
      const inflateablesRef = ref(database, 'inflateables');
      const snapshot = await get(inflateablesRef);
      
      if (!snapshot.exists()) {
        console.warn('⚠️ [DEBUG] CartSidebar: No inflateables data found in Firebase database');
        return [];
      }
      
      const inflateablesData = snapshot.val();
      
      // Handle both array and object formats
      let result;
      if (Array.isArray(inflateablesData)) {
        result = inflateablesData;
      } else if (inflateablesData && typeof inflateablesData === 'object') {
        result = Object.values(inflateablesData);
      } else {
        result = [];
      }
      
      // Log some sample items with quantities
      const itemsWithQuantity = result.filter(item => item.quantity && item.quantity > 1);
      
      return result;
    } catch (error) {
      console.error('❌ [DEBUG] CartSidebar: Error loading inflateables data from Firebase:', error);
      return [];
    }
  };

  // Check availability when duration or date changes
  useEffect(() => {
    
    const checkAvailability = async () => {
      if (calendarDateRange[0] && duration && cart.length > 0) {
        
        setLoadingAvailability(true);
        const startDate = calendarDateRange[0];
        const endDate = calculateEndDate(startDate, duration);
        
        try {
          // Get old unavailable items for binary check
          const unavailable = await getUnavailableInflateables(startDate, endDate);
          setUnavailableItems(unavailable);
          
          // Get detailed availability for all items in cart
          const inflateables = await loadInflateablesData();
          const availabilityMap = new Map<string, ItemAvailability>();
          
          
          const promises = cart.map(async (item) => {
            const inflateable = inflateables.find(inf => inf.name === item.name);
            
            if (inflateable) {
              const totalQuantity = inflateable.quantity || 1;
              
              const availability = await checkItemAvailability(
                item.name,
                totalQuantity,
                startDate,
                endDate
              );
              
              availabilityMap.set(item.name, availability);
            } else {
            }
          });
          
          await Promise.all(promises);
          
          setItemAvailability(availabilityMap);
        } catch (error) {
          console.error('❌ [DEBUG] CartSidebar: Error checking availability:', error);
        } finally {
          setLoadingAvailability(false);
        }
      } else {
        setUnavailableItems(new Set());
        setItemAvailability(new Map());
      }
    };
    
    checkAvailability();
  }, [calendarDateRange, duration, cart]);

  // Pricing adjustments
  const surfacePrices: Record<string, number> = {
    "grass-stakes": 0,
    "grass-sandbags": 50,
    "concrete": 50,
    "indoor": 40,
  };
  const timePrices: Record<string, number> = {
    "8am": 50,
    "9am": 40,
    "10am": 30,
    "11am": 20,
    "12pm": 10,
    "": 0,
  };
  const durationMultipliers: Record<string, number> = {
    "4hours": 0.9,  // 10% discount
    "24hours": 1.0, // Base price
    "48hours": 1.5, // 50% increase
  };
  // Location is for documentation only
  const locationOptions = [
    "personal home",
    "someone else's home",
    "business",
    "park",
    "church/school",
  ];

  // Calculate total
  // Calculate total with duration multiplier, excluding unavailable items
  const durationMultiplier = duration ? durationMultipliers[duration] || 1.0 : 1.0;
  
  // Filter out any existing free gift cards from cart display (they're now handled via email notification)
  const displayCart = cart.filter(item => !item.category?.includes('gift-card-free'));
  
  // Helper: Check if all wet/dry selections are complete
  const areWetDrySelectionsComplete = () => {
    return cart.every((item, idx) => {
      // Skip unavailable items
      if (unavailableItems.has(item.id)) {
        return true;
      }
      
      // Skip gift cards, memberships, and party essentials - they don't need wet/dry selection
      if (isGiftCard(item) || item.isMembership || isPartyEssential(item)) {
        return true;
      }
      
      // If item supports wet/dry, check if selection is made
      if (supportsWetDry(item)) {
        return wetDrySelections[idx] && wetDrySelections[idx] !== "";
      }
      
      // If item doesn't support wet/dry, it's complete
      return true;
    });
  };

  // Check if cart contains a membership
  const hasMembership = cart.some(item => item.isMembership);
  
  // User gets membership discount if they are a member OR if they're purchasing a membership
  const shouldApplyMembershipDiscount = userIsMember || hasMembership;
  
  const cartTotal = displayCart.reduce((sum, item, displayIdx) => {
    // Skip unavailable items
    if (unavailableItems.has(item.id)) {
      return sum;
    }
    
    let itemTotal: number;
    
    // Handle gift cards differently - use selected value, no duration multiplier
    if (isGiftCard(item)) {
      // Find original index in full cart for giftCardValues
      const originalIdx = cart.findIndex(cartItem => cartItem.id === item.id);
      const selectedValue = giftCardValues[originalIdx] || 50; // Default to $50
      itemTotal = selectedValue * item.quantity;
    } else if (item.isMembership) {
      // Membership items don't get discounted
      itemTotal = item.price * item.quantity;
    } else {
      // Regular items with duration multiplier
      itemTotal = item.price * item.quantity * durationMultiplier;
      
      // Add wet surcharge if applicable
      const originalIdx = cart.findIndex(cartItem => cartItem.id === item.id);
      if (supportsWetDry(item) && wetDrySelections[originalIdx] === "Wet") {
        itemTotal += 50 * item.quantity; // $50 surcharge for wet items
      }

      // Apply 25% membership discount to non-membership items if user is a member or purchasing membership
      if (shouldApplyMembershipDiscount && !item.excludeFromDiscounts) {
        itemTotal = itemTotal * 0.75; // 25% discount
      }
    }
    
    return sum + itemTotal;
  }, 0);
  
  // Count non-gift card items for per-item pricing adjustments
  const nonGiftCardItemCount = displayCart.reduce((count, item) => {
    // Skip unavailable items
    if (unavailableItems.has(item.id)) {
      return count;
    }
    // Skip gift cards
    if (isGiftCard(item)) {
      return count;
    }
    return count + item.quantity;
  }, 0);
  
  const surfaceAdj = surface ? (surfacePrices[surface] || 0) * nonGiftCardItemCount : 0;
  const timeAdj = deliveryTime ? (timePrices[deliveryTime] || 0) * nonGiftCardItemCount : 0;
  
  // Apply discount to total
  const subtotal = cartTotal + surfaceAdj + timeAdj;
  const total = subtotal - discountCalculation.discountAmount;

  // Calculate discount asynchronously
  useEffect(() => {
    const calculateDiscountAsync = async () => {
      // Calculate proper date range with duration for discount calculation
      let dateRangeForDiscount: [Date | null, Date | null] = calendarDateRange;
      
      if (calendarDateRange[0] && duration) {
        const startDate = calendarDateRange[0];
        const endDate = calculateEndDate(startDate, duration);
        dateRangeForDiscount = [startDate, endDate];
      }
      
      const calculation = await discountLogic.calculateDiscount(cart, cartTotal, dateRangeForDiscount);
      setDiscountCalculation(calculation);
    };
    
    calculateDiscountAsync();
  }, [cart, cartTotal, calendarDateRange, duration, discountLogic.discounts, giftCardValues]);



  // Update cart items with selected gift card values
  useEffect(() => {
    const updatedCart = cart.map((item, idx) => {
      if (isGiftCard(item) && giftCardValues[idx]) {
        return {
          ...item,
          giftCardValue: giftCardValues[idx],
          price: giftCardValues[idx] // Update price to match selection for BOGO logic
        };
      }
      return item;
    });
    
    // Only update if there are actual changes to prevent infinite loops
    const hasChanges = cart.some((item, idx) => 
      isGiftCard(item) && giftCardValues[idx] && item.giftCardValue !== giftCardValues[idx]
    );
    
    if (hasChanges) {
      setCart(updatedCart);
    }
  }, [giftCardValues, cart, setCart]);
  useEffect(() => {
    const savedInfo = localStorage.getItem("orderMessage") || "";
    setOrderInfo(savedInfo);
  }, [open]);

  useEffect(() => {
    localStorage.setItem("orderMessage", orderInfo);
  }, [orderInfo]);

  // Helper function to determine the free gift card value for BOGO notification
  const getFreeGiftCardValue = (): number | null => {
    if (discountCalculation.appliedDiscount !== 'bogoGiftCard' || !discountCalculation.hasValidDiscount) {
      return null;
    }
    
    // Find paid gift cards in cart
    const paidGiftCards = cart.filter(item => 
      isGiftCard(item) && !item.category?.includes('gift-card-free')
    );
    
    if (paidGiftCards.length === 0) {
      return null;
    }
    
    // Get the highest value from paid gift cards, using current selections
    const cardValues: number[] = paidGiftCards.map((card, cardIndex) => {
      const originalIndex = cart.findIndex(cartItem => cartItem.id === card.id);
      return giftCardValues[originalIndex] || card.giftCardValue || card.price;
    });
    
    return Math.max(...cardValues);
  };

  // Use ref to access current cart state without dependency
  const cartRef = useRef<CartItem[]>(cart);
  cartRef.current = cart;

  // Note: BOGO gift cards are now handled via email notification instead of cart display

  // Note: Free gift cards are now handled via email notification instead of cart management

  // Note: Free gift card cleanup no longer needed since they're handled via email

  const updateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    // Check if this quantity is available
    const item = cart[index];
    const availability = itemAvailability.get(item.name);
    
    
    if (availability && newQuantity > availability.availableQuantity) {
      alert(`Only ${availability.availableQuantity} of ${item.name} available for your selected dates.`);
      return;
    }
    
    const newCart = [...cart];
    newCart[index].quantity = newQuantity;
    setCart(newCart); // This automatically saves to localStorage via useCart hook
  };

  // Reset quantities to 1 when dates change (but not on initial load)
  useEffect(() => {
    if (calendarDateRange[0] && cart.length > 0) {
      if (initialCalendarLoadRef.current) {
        // This is the initial calendar load from localStorage - don't reset quantities
        initialCalendarLoadRef.current = false;
        return;
      }
      
      // This is a user-initiated date change - reset quantities
      const resetCart = cart.map(item => ({ ...item, quantity: 1 }));
      setCart(resetCart); // This automatically saves to localStorage via useCart hook
    }
  }, [calendarDateRange[0], calendarDateRange[1]]);

  // Generate quantity options based on availability
  const getQuantityOptions = (itemName: string, currentQuantity: number): number[] => {
    const availability = itemAvailability.get(itemName);
    
    if (!availability) {
      return [1]; // Default to 1 if no availability data
    }
    
    const maxQuantity = Math.max(1, availability.availableQuantity);
    const options = Array.from({ length: maxQuantity }, (_, i) => i + 1);
    
    return options;
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart); // This automatically saves to localStorage via useCart hook
  };

  // Save cart to Firestore for abandonment tracking
  const saveCartToFirestore = async (user: any) => {
    if (!user || cart.length === 0) return;

    try {
      const cartData = {
        userId: user.uid,
        customerEmail: user.email,
        customerName: user.displayName || 'Customer',
        cartItems: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          category: item.category,
          wetDry: item.wetDry,
          isGiftCard: item.isGiftCard || false,
          giftCardValue: item.giftCardValue || null
        })),
        cartValue: total,
        eventDetails: {
          startDate: calendarDateRange[0]?.toISOString(),
          duration: duration,
          surface: surface,
          deliveryTime: deliveryTime,
          location: location
        },
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        status: 'active', // Will be marked as 'abandoned' if not completed within 1 hour
        source: 'cart-sidebar'
      };

      await setDoc(doc(firestore, 'carts', user.uid), cartData);
    } catch (error) {
      console.error('❌ Error saving cart to Firestore:', error);
    }
  };

  return (
    <>
      <div className={`cart-overlay${open ? " open" : ""}`} onClick={onClose}></div>
      <div className={`cart-sidebar${open ? " open" : ""}`}>
        <button className="close-btn" onClick={onClose}>
          X
        </button>
        <h2 className="cart-sidebar-title">Your Cart</h2>
        <div className="cart-items">
          {cart.length === 0 ? (
            <div className="cart-empty">Your cart is empty.</div>
          ) : (
            displayCart.map((item, idx) => {
              // Find the original index in the full cart for giftCardValues
              const originalIdx = cart.findIndex(cartItem => cartItem.id === item.id);
              const isUnavailable = unavailableItems.has(item.id);
              const isFreeItem = discountCalculation.freeItemId === item.id;
              const isSpecialItem = isFreeItem;
              
              return (
                <div 
                  className="cart-item" 
                  key={item.name + idx}
                  style={{
                    opacity: isUnavailable ? 0.6 : 1,
                    backgroundColor: isUnavailable ? '#ffebee' : isSpecialItem ? '#e8f5e8' : 'transparent',
                    border: isUnavailable ? '2px solid #f44336' : isSpecialItem ? '2px solid #4CAF50' : 'none',
                    borderRadius: '8px',
                    padding: '10px',
                    margin: '5px 0',
                    position: 'relative'
                  }}
                >
                  {isUnavailable && (
                    <div style={{
                      position: 'absolute',
                      top: '5px',
                      right: '5px',
                      backgroundColor: '#f44336',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      UNAVAILABLE
                    </div>
                  )}
                  {isSpecialItem && (
                    <div style={{
                      position: 'absolute',
                      top: '5px',
                      right: '5px',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      🎁 FREE
                    </div>
                  )}
                  <span style={{ 
                    color: isUnavailable ? '#666' : isSpecialItem ? '#2e7d32' : 'inherit',
                    fontWeight: isSpecialItem ? 'bold' : 'normal'
                  }}>
                    {item.name} - ${
                      isUnavailable ? '0.00' : 
                      isFreeItem ? '0.00 (FREE)' :
                      isGiftCard(item) ? (giftCardValues[originalIdx] || 50).toFixed(2) :
                      (item.price * durationMultiplier).toFixed(2)
                    } {!isGiftCard(item) && !item.isMembership && `(${item.wetDry})`}
                  </span>
                  
                  {/* Gift Card Value Selection */}
                  {isGiftCard(item) && (
                    <select
                      className="gift-card-value-select"
                      value={giftCardValues[originalIdx] || 50}
                      onChange={e => {
                        const value = parseInt(e.target.value);
                        const newGiftCardValues = { ...giftCardValues, [originalIdx]: value };
                        updateGiftCardValues(newGiftCardValues);
                      }}
                      style={{ marginLeft: '0.5rem' }}
                      required
                      disabled={isUnavailable}
                    >
                      <option value={50}>$50 Gift Card</option>
                      <option value={100}>$100 Gift Card</option>
                    </select>
                  )}
                  
                  {/* Wet/Dry Selection for regular items */}
                  {!isGiftCard(item) && !item.isMembership && supportsWetDry(item) && (
                    <select
                      className="wet-dry-select"
                      value={wetDrySelections[originalIdx] || ""}
                      onChange={e => {
                        const value = e.target.value;
                        updateWetDrySelections(prev => ({ ...prev, [originalIdx]: value }));
                      }}
                      style={{ marginLeft: '0.5rem' }}
                      required
                      disabled={isUnavailable}
                    >
                      <option value="">Choose Wet or Dry</option>
                      <option value="Dry">Dry</option>
                      <option value="Wet">Wet (+$50)</option>
                    </select>
                  )}
                  
                  {/* Quantity Selection for non-gift card items only */}
                  {!isGiftCard(item) && !item.isMembership && (() => {
                    const availability = itemAvailability.get(item.name);
                    const maxQuantity = availability ? availability.availableQuantity : 1;
                    
                    // Only show quantity dropdown if more than 1 quantity is available
                    if (maxQuantity > 1) {
                      return (
                        <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <label htmlFor={`quantity-${idx}`} style={{ fontSize: '0.9rem' }}>
                            Quantity:
                          </label>
                          <select
                            id={`quantity-${idx}`}
                            className="quantity-select"
                            value={item.quantity}
                            onChange={e => updateQuantity(idx, parseInt(e.target.value))}
                            disabled={isUnavailable || loadingAvailability}
                            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc' }}
                          >
                            {loadingAvailability ? (
                              <option value={item.quantity}>Loading...</option>
                            ) : (
                              getQuantityOptions(item.name, item.quantity).map(num => (
                                <option key={num} value={num}>
                                  {num}
                                </option>
                              ))
                            )}
                          </select>
                        </div>
                      );
                    }
                    return null; // Don't show anything if only 1 quantity available
                  })()}
                  <button 
                    onClick={() => removeFromCart(idx)}
                    disabled={false}
                    style={{
                      opacity: 1,
                      cursor: 'pointer'
                    }}
                    title='Remove item from cart'
                  >
                    Remove
                  </button>
                </div>
              );
            })
          )}
        </div>
        {/* Dropdowns for order requirements - only show when cart has inflateables */}
        {(() => {
          const hasInflateables = cart.some(item => !isGiftCard(item) && !item.isMembership);
          return hasInflateables ? (
            <div className="cart-dropdowns" style={{ margin: '1rem 0' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                Event Duration:
                <select value={duration} onChange={e => setDuration(e.target.value)} required style={{ marginLeft: '0.5rem' }}>
                  <option value="">Select duration</option>
                  <option value="4hours">4 Hours (-10%)</option>
                  <option value="24hours">24 Hours (Standard)</option>
                  <option value="48hours">48 Hours (+50%)</option>
                </select>
              </label>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                Surface:
                <select value={surface} onChange={e => setSurface(e.target.value)} required style={{ marginLeft: '0.5rem' }}>
                  <option value="">Select surface</option>
                  <option value="grass-stakes">Grass (stakes)</option>
                  <option value="grass-sandbags">Grass (sandbags)</option>
                  <option value="concrete">Concrete/Pavement</option>
                  <option value="indoor">Indoor</option>
                </select>
              </label>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                Delivery Time:
                <select value={deliveryTime} onChange={e => setDeliveryTime(e.target.value)} required style={{ marginLeft: '0.5rem' }}>
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
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                Location:
                <select value={location} onChange={e => setLocation(e.target.value)} required style={{ marginLeft: '0.5rem' }}>
                  <option value="">Select location</option>
                  {locationOptions.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </label>
            </div>
          ) : null;
        })()}
        {/* Discount Section */}
        <div className="cart-discounts" style={{ 
          margin: '1rem 0', 
          padding: '1rem', 
          border: (isHydrated && discountLogic.hasActiveDiscount()) ? '2px solid #4CAF50' : '1px solid #ddd', 
          borderRadius: '8px',
          backgroundColor: (isHydrated && discountLogic.hasActiveDiscount()) ? '#f8fff8' : 'transparent'
        }}>
          <h3 style={{ 
            margin: '0 0 1rem 0', 
            fontSize: '1.1rem',
            color: (isHydrated && discountLogic.hasActiveDiscount()) ? '#2e7d32' : 'inherit'
          }}>
            Active Discounts {(isHydrated && discountLogic.hasActiveDiscount()) ? '🎁' : ''}
          </h3>
          
          {(isHydrated && discountLogic.hasActiveDiscount()) ? (
            <div>
              {/* Show active discount */}
              <div style={{ 
                backgroundColor: '#e8f5e8', 
                padding: '1rem', 
                borderRadius: '8px', 
                border: '2px solid #4caf50',
                marginBottom: '1rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 'bold', color: '#2e7d32', fontSize: '1.1rem' }}>
                    ✅ {isHydrated ? (() => {
                      const activeDiscount = discountLogic.getActiveDiscount();
                      switch (activeDiscount) {
                        case 'sunday10': return 'Sunday 10% Off';
                        case 'freeGame': return 'Free Game';
                        case 'bogoGiftCard': return 'BOGO Gift Card';
                        default: return 'Discount';
                      }
                    })() : 'Discount'} Applied!
                  </span>
                  <button 
                    onClick={() => isHydrated && discountLogic.clearDiscounts()}
                    style={{
                      backgroundColor: '#f44336',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    🗑️ Remove
                  </button>
                </div>
                <div style={{ fontSize: '0.9rem', color: '#2e7d32', marginBottom: '0.5rem' }}>
                  📝 {isHydrated ? getDiscountDescription(discountLogic.getActiveDiscount()) : 'Discount details will appear after loading'}
                </div>
                
                {/* BOGO Gift Card Notification */}
                {discountCalculation.appliedDiscount === 'bogoGiftCard' && 
                 discountCalculation.hasValidDiscount && (() => {
                  const freeCardValue = getFreeGiftCardValue();
                  return freeCardValue ? (
                    <div style={{
                      backgroundColor: '#e8f5e8',
                      border: '1px solid #4caf50',
                      borderRadius: '8px',
                      padding: '12px',
                      margin: '8px 0',
                      fontSize: '14px',
                      color: '#2e7d32'
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                        🎁 FREE $${freeCardValue} Gift Card Included!
                      </div>
                      <div style={{ fontSize: '13px', lineHeight: '1.4' }}>
                        Your free gift card will be emailed to you after your order is confirmed.
                      </div>
                    </div>
                  ) : null;
                })()}
                
                {/* Discount status */}
                {!discountCalculation.userCanUse ? (
                  <div style={{ fontSize: '0.9rem', color: '#f44336', fontWeight: 'bold' }}>
                    ❌ {discountCalculation.usageError || 'Cannot use this discount'}
                  </div>
                ) : discountCalculation.hasValidDiscount ? (
                  <div>
                    {discountCalculation.discountAmount > 0 && (
                      <div style={{ fontSize: '0.9rem', color: '#2e7d32', fontWeight: 'bold' }}>
                        💰 Savings: ${discountCalculation.discountAmount.toFixed(2)}
                      </div>
                    )}
                    {discountCalculation.freeItemId && (
                      <div style={{ fontSize: '0.9rem', color: '#2e7d32', fontWeight: 'bold' }}>
                        🎁 Free Item: {cart.find(item => item.id === discountCalculation.freeItemId)?.name || 'Cheapest Game'}
                      </div>
                    )}
                    {discountCalculation.addedGiftCards.length > 0 && (
                      <div style={{ fontSize: '0.9rem', color: '#2e7d32', fontWeight: 'bold' }}>
                        🎁 Free Gift Cards: {discountCalculation.addedGiftCards.length}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.9rem', color: '#ff9800', fontStyle: 'italic' }}>
                    ⚠️ {isHydrated ? (() => {
                      const activeDiscount = discountLogic.getActiveDiscount();
                      switch (activeDiscount) {
                        case 'sunday10': return 'Discount only applies if your event includes a Sunday';
                        case 'freeGame': return 'Add a yard game to your cart to activate this discount';
                        case 'bogoGiftCard': return 'Add a $50 gift card to your cart to activate this discount';
                        default: return 'Discount requirements not met';
                      }
                    })() : 'Discount requirements not met'}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#666', fontSize: '0.9rem', fontStyle: 'italic' }}>
              {!isHydrated ? (
                <span>🔒 Please log in to use discount codes</span>
              ) : discountLogic.isUserAuthenticated() ? (
                <span>💡 Click a promo card above to activate a discount</span>
              ) : (
                <span>🔒 Please log in to use discount codes</span>
              )}
            </div>
          )}
        </div>

        {/* Total price display */}
        <div className="cart-total" style={{ fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '1rem', textAlign: 'center' }}>
          {shouldApplyMembershipDiscount && (
            <div style={{ fontSize: '0.9rem', color: '#4CAF50', marginBottom: '0.5rem' }}>
              🎉 Membership Discount: 25% off other items!
              {userIsMember && !hasMembership && (
                <div style={{ fontSize: '0.8rem', color: '#2e7d32', fontStyle: 'italic' }}>
                  Active member discount applied
                </div>
              )}
            </div>
          )}
          {discountCalculation.discountAmount > 0 ? (
            <div>
              <div style={{ fontSize: '1rem', color: '#666', textDecoration: 'line-through' }}>
                Subtotal: ${subtotal.toFixed(2)}
              </div>
              <div style={{ color: '#4CAF50' }}>
                Total: ${total.toFixed(2)} <span style={{ fontSize: '0.9rem' }}>(Save ${discountCalculation.discountAmount.toFixed(2)})</span>
              </div>
            </div>
          ) : (
            <div>Total: ${total.toFixed(2)}</div>
          )}
        </div>
        <div className="cart-footer">
          <button
            id="proceedButton"
            disabled={(() => {
              const hasInflateables = cart.some(item => !isGiftCard(item) && !item.isMembership);
              return (
                cart.length === 0 || 
                (hasInflateables && (!duration || !surface || !deliveryTime || !location)) ||
                !areWetDrySelectionsComplete()
              );
            })()}
            onClick={async () => {
              const hasInflateables = cart.some(item => !isGiftCard(item) && !item.isMembership);
              const eventFieldsValid = !hasInflateables || (duration && surface && deliveryTime && location);
              
              if (cart.length > 0 && eventFieldsValid && areWetDrySelectionsComplete()) {
                if (user) {
                  
                  // Check for matching resumable bookings
                  const currentCartSettings = {
                    duration: cartSettings?.duration || duration,
                    surface: cartSettings?.surface || surface,
                    deliveryTime: cartSettings?.deliveryTime || deliveryTime,
                    location: cartSettings?.location || location
                  };
                  
                  const matchResult = await findMatchingBooking(
                    user.uid, 
                    cart, 
                    currentCartSettings, 
                    cartSettings?.wetDrySelections || localWetDrySelections
                  );
                  
                  if (matchResult.booking && matchResult.comparison) {
                    
                    if (!matchResult.comparison.hasChanges) {
                      // Exact match - resume the booking directly
                      localStorage.setItem('resumeBookingId', matchResult.booking.orderID);
                      onClose(); // Close cart sidebar
                      navigate('/checkout');
                      return;
                    } else {
                      // Partial match - show confirmation dialog
                      const changeDescription = [
                        ...(matchResult.comparison.changedItems || []),
                        ...(matchResult.comparison.changedSettings || [])
                      ].join('\n• ');
                      
                      const confirmMessage = matchResult.comparison.itemsMatch
                        ? `We found a similar booking (${matchResult.booking.orderID}) with different settings:\n\n• ${changeDescription}\n\nWould you like to update that booking with your current selections instead of creating a new one?`
                        : `We found a booking (${matchResult.booking.orderID}) with similar items but some changes:\n\n• ${changeDescription}\n\nWould you like to update that booking instead of creating a new one?`;
                      
                      const userConfirmed = confirm(confirmMessage);
                      
                      if (userConfirmed) {
                        
                        // Show loading state
                        const proceedButton = document.getElementById('proceedButton') as HTMLButtonElement;
                        if (proceedButton) {
                          proceedButton.disabled = true;
                          proceedButton.textContent = 'Updating Booking...';
                        }
                        
                        try {
                          const updatedBooking = await updateExistingBooking(
                            matchResult.booking, 
                            cart, 
                            currentCartSettings, 
                            cartSettings?.wetDrySelections || localWetDrySelections,
                            calendarDateRange
                          );
                          
                          if (updatedBooking) {
                            localStorage.setItem('resumeBookingId', matchResult.booking.orderID);
                            onClose(); // Close cart sidebar
                            navigate('/checkout');
                            return;
                          } else {
                            throw new Error('Failed to update booking');
                          }
                        } catch (error) {
                          console.error('❌ Error updating booking:', error);
                          alert('Failed to update existing booking. Creating a new booking instead.');
                        } finally {
                          // Restore button state
                          if (proceedButton) {
                            proceedButton.disabled = false;
                            proceedButton.textContent = 'Proceed to Purchase';
                          }
                        }
                      } else {
                      }
                    }
                  } else {
                  }
                  
                  // No match found or user declined update - proceed with normal flow
                  
                  // Save cart to Firestore for abandonment tracking before proceeding
                  await saveCartToFirestore(user);
                  // User is logged in, proceed to checkout
                  navigate('/checkout');
                } else {
                  // User is not logged in, show prompt
                  setShowLoginPrompt(true);
                }
              }
            }}
          >
            Proceed to Purchase
          </button>
          {/* Show validation message if wet/dry selections are incomplete */}
          {!areWetDrySelectionsComplete() && (
            <div style={{
              color: '#f44336',
              fontSize: '0.9rem',
              marginTop: '0.5rem',
              textAlign: 'center',
              fontWeight: 'bold'
            }}>
              ⚠️ Please select Wet or Dry for all applicable items
            </div>
          )}
        </div>
        <div id="sidebar-footer" className="candal-regular">
          <p>
            Upon proceeding to purchase you will be required to create an account/login for order records
          </p>
        </div>
      </div>

      {/* Login Prompt Modal */}
      {showLoginPrompt && (
        <div 
          className="modal-overlay fade-in"
          onClick={() => setShowLoginPrompt(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 20000
          }}
        >
          <div 
            className="modal-content popup"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '8px',
              maxWidth: '400px',
              width: '90%',
              textAlign: 'center',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
            }}
          >
            <h2 style={{ 
              marginBottom: '1rem', 
              color: '#333',
              fontSize: '1.5rem'
            }}>
              Login Required
            </h2>
            <p style={{ 
              marginBottom: '2rem', 
              color: '#666',
              lineHeight: '1.4'
            }}>
              You must be logged in to proceed with your purchase. Please sign in or create an account to continue.
            </p>
            <div style={{ 
              display: 'flex', 
              gap: '1rem', 
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => setShowLoginPrompt(false)}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid #ccc',
                  color: '#666',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowLoginPrompt(false);
                  navigate('/?signin=true');
                }}
                style={{
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
