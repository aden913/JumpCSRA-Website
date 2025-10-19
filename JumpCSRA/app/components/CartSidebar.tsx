import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router";
import { onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, get } from "firebase/database";
import { initializeApp, getApps } from "firebase/app";
import { auth, firebaseConfig } from "./FirebaseConfig";
import { getUnavailableInflateables } from '../utils/bookingUtils';
import { useDiscounts, getDiscountDescription, type DiscountCalculation } from '../hooks/useDiscounts';
import { checkItemAvailability, type ItemAvailability } from '../utils/availabilityUtils';
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
  membershipType?: 'weekday' | 'weekend'; // Type of membership
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

export function CartSidebar({ open, onClose, cart, setCart, calendarDateRange, discountLogic, cartSettings }: CartSidebarProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  
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
      console.log('🛒 [DEBUG] CartSidebar: Loading inflateables data from Firebase...');
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
      console.log('📊 [DEBUG] CartSidebar: Raw Firebase inflateables data:', inflateablesData);
      
      // Handle both array and object formats
      let result;
      if (Array.isArray(inflateablesData)) {
        result = inflateablesData;
        console.log('📋 [DEBUG] CartSidebar: Data is array format, length:', result.length);
      } else if (inflateablesData && typeof inflateablesData === 'object') {
        result = Object.values(inflateablesData);
        console.log('📋 [DEBUG] CartSidebar: Data is object format, converted to array, length:', result.length);
      } else {
        result = [];
        console.log('⚠️ [DEBUG] CartSidebar: Data format not recognized, returning empty array');
      }
      
      // Log some sample items with quantities
      const itemsWithQuantity = result.filter(item => item.quantity && item.quantity > 1);
      console.log('🔢 [DEBUG] CartSidebar: Items with quantity > 1:', itemsWithQuantity.map(item => `${item.name}: ${item.quantity}`));
      
      return result;
    } catch (error) {
      console.error('❌ [DEBUG] CartSidebar: Error loading inflateables data from Firebase:', error);
      return [];
    }
  };

  // Check availability when duration or date changes
  useEffect(() => {
    console.log('🚀 [DEBUG] CartSidebar: useEffect triggered');
    console.log(`📊 [DEBUG] CartSidebar: Dependencies - calendarDateRange[0]: ${calendarDateRange[0]}, duration: ${duration}, cart.length: ${cart.length}`);
    
    const checkAvailability = async () => {
      if (calendarDateRange[0] && duration && cart.length > 0) {
        console.log('🔍 [DEBUG] CartSidebar: Starting availability check...');
        console.log(`📅 [DEBUG] CartSidebar: Date range: ${calendarDateRange[0].toISOString().split('T')[0]} for ${duration}`);
        console.log(`🛒 [DEBUG] CartSidebar: Cart items to check:`, cart.map(item => `${item.name} (qty: ${item.quantity})`));
        
        setLoadingAvailability(true);
        const startDate = calendarDateRange[0];
        const endDate = calculateEndDate(startDate, duration);
        
        try {
          // Get old unavailable items for binary check
          const unavailable = await getUnavailableInflateables(startDate, endDate);
          setUnavailableItems(unavailable);
          console.log('🚫 [DEBUG] CartSidebar: Unavailable items:', Array.from(unavailable));
          
          // Get detailed availability for all items in cart
          const inflateables = await loadInflateablesData();
          const availabilityMap = new Map<string, ItemAvailability>();
          
          console.log('🔄 [DEBUG] CartSidebar: Starting individual item availability checks...');
          
          const promises = cart.map(async (item) => {
            const inflateable = inflateables.find(inf => inf.name === item.name);
            console.log(`🔍 [DEBUG] CartSidebar: Looking for "${item.name}" in inflateables data...`);
            console.log(`📋 [DEBUG] CartSidebar: Found inflateable:`, inflateable);
            
            if (inflateable) {
              const totalQuantity = inflateable.quantity || 1;
              console.log(`🔢 [DEBUG] CartSidebar: Using total quantity ${totalQuantity} for "${item.name}"`);
              
              const availability = await checkItemAvailability(
                item.name,
                totalQuantity,
                startDate,
                endDate
              );
              
              console.log(`📊 [DEBUG] CartSidebar: Availability result for "${item.name}":`, availability);
              availabilityMap.set(item.name, availability);
            } else {
              console.log(`⚠️ [DEBUG] CartSidebar: No inflateable data found for "${item.name}"`);
            }
          });
          
          await Promise.all(promises);
          console.log('✅ [DEBUG] CartSidebar: All availability checks completed');
          console.log('📊 [DEBUG] CartSidebar: Final availability map:', Object.fromEntries(availabilityMap));
          
          setItemAvailability(availabilityMap);
        } catch (error) {
          console.error('❌ [DEBUG] CartSidebar: Error checking availability:', error);
        } finally {
          setLoadingAvailability(false);
        }
      } else {
        console.log('⚠️ [DEBUG] CartSidebar: Skipping availability check - conditions not met');
        console.log(`📊 [DEBUG] CartSidebar: calendarDateRange[0]: ${!!calendarDateRange[0]}, duration: ${!!duration}, cart.length: ${cart.length}`);
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
      
      // Skip gift cards and party essentials - they don't need wet/dry selection
      if (isGiftCard(item) || isPartyEssential(item)) {
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

      // Apply 25% membership discount to non-membership items if membership is in cart
      if (hasMembership && !item.excludeFromDiscounts) {
        itemTotal = itemTotal * 0.75; // 25% discount
      }
    }
    
    return sum + itemTotal;
  }, 0);
  
  const surfaceAdj = surface ? surfacePrices[surface] || 0 : 0;
  const timeAdj = deliveryTime ? timePrices[deliveryTime] || 0 : 0;
  
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
    
    console.log(`🔄 [DEBUG] CartSidebar: updateQuantity for "${item.name}" to ${newQuantity}`);
    console.log(`📊 [DEBUG] CartSidebar: Current availability for "${item.name}":`, availability);
    
    if (availability && newQuantity > availability.availableQuantity) {
      console.log(`⚠️ [DEBUG] CartSidebar: Quantity ${newQuantity} exceeds available ${availability.availableQuantity} for "${item.name}"`);
      alert(`Only ${availability.availableQuantity} of ${item.name} available for your selected dates.`);
      return;
    }
    
    console.log(`✅ [DEBUG] CartSidebar: Quantity update allowed for "${item.name}": ${newQuantity}`);
    console.log(`💾 [DEBUG] CartSidebar: Persisting quantity change to localStorage`);
    const newCart = [...cart];
    newCart[index].quantity = newQuantity;
    setCart(newCart); // This automatically saves to localStorage via useCart hook
  };

  // Reset quantities to 1 when dates change (but not on initial load)
  useEffect(() => {
    if (calendarDateRange[0] && cart.length > 0) {
      if (initialCalendarLoadRef.current) {
        // This is the initial calendar load from localStorage - don't reset quantities
        console.log(`� [DEBUG] CartSidebar: Initial calendar date load detected, preserving quantities`);
        initialCalendarLoadRef.current = false;
        return;
      }
      
      // This is a user-initiated date change - reset quantities
      console.log(`🔄 [DEBUG] CartSidebar: User changed dates, resetting all quantities to 1`);
      const resetCart = cart.map(item => ({ ...item, quantity: 1 }));
      setCart(resetCart); // This automatically saves to localStorage via useCart hook
    }
  }, [calendarDateRange[0], calendarDateRange[1]]);

  // Generate quantity options based on availability
  const getQuantityOptions = (itemName: string, currentQuantity: number): number[] => {
    const availability = itemAvailability.get(itemName);
    console.log(`🔢 [DEBUG] CartSidebar: getQuantityOptions for "${itemName}"`);
    console.log(`📊 [DEBUG] CartSidebar: Availability data:`, availability);
    
    if (!availability) {
      console.log(`⚠️ [DEBUG] CartSidebar: No availability data for "${itemName}", defaulting to [1]`);
      return [1]; // Default to 1 if no availability data
    }
    
    const maxQuantity = Math.max(1, availability.availableQuantity);
    const options = Array.from({ length: maxQuantity }, (_, i) => i + 1);
    console.log(`✅ [DEBUG] CartSidebar: Generated quantity options for "${itemName}": [${options.join(', ')}] (max: ${maxQuantity})`);
    
    return options;
  };

  const removeFromCart = (index: number) => {
    console.log(`🗑️ [DEBUG] CartSidebar: Removing item at index ${index} from cart`);
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart); // This automatically saves to localStorage via useCart hook
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
                    } {!isGiftCard(item) && `(${item.wetDry})`}
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
                  {!isGiftCard(item) && supportsWetDry(item) && (
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
                  
                  {/* Quantity Selection for all items */}
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
                    {(() => {
                      const availability = itemAvailability.get(item.name);
                      return availability ? (
                        <span style={{ 
                          fontSize: '0.8rem', 
                          color: availability.availableQuantity > 5 ? '#666' : '#f57c00',
                          fontStyle: 'italic'
                        }}>
                          ({availability.availableQuantity} available)
                        </span>
                      ) : null;
                    })()}
                  </div>
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
        {/* Dropdowns for order requirements */}
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
          {hasMembership && (
            <div style={{ fontSize: '0.9rem', color: '#4CAF50', marginBottom: '0.5rem' }}>
              🎉 Membership Discount: 25% off other items!
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
            disabled={
              cart.length === 0 || 
              !duration || 
              !surface || 
              !deliveryTime || 
              !location || 
              !areWetDrySelectionsComplete()
            }
            onClick={() => {
              if (cart.length > 0 && duration && surface && deliveryTime && location && areWetDrySelectionsComplete()) {
                if (user) {
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
            zIndex: 2000
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
                  navigate('/');
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
