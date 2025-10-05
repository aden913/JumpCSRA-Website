import { useState, useEffect, useMemo } from 'react';
import { getAuth } from 'firebase/auth';
import { getDoc, doc, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';
import { firestore } from '../components/FirebaseConfig';
import type { CartItem } from '../components/CartSidebar';

// Discount types
export type DiscountType = 'sunday10' | 'freeGame' | 'bogoGiftCard';

export interface DiscountState {
  sunday10: boolean;
  freeGame: boolean;
  bogoGiftCard: boolean;
}

export interface DiscountCalculation {
  discountAmount: number;
  appliedDiscount: DiscountType | null;
  freeItemId: string | null;
  addedGiftCards: CartItem[];
  hasValidDiscount: boolean;
  userCanUse: boolean;
  usageError?: string;
}

export function useDiscounts() {
  // Discount state - only one can be true at a time
  const [discounts, setDiscounts] = useState<DiscountState>({
    sunday10: false,
    freeGame: false,
    bogoGiftCard: false,
  });

  // Load discount state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('activeDiscounts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setDiscounts(parsed);
      } catch (error) {
        console.error('Error loading saved discounts:', error);
      }
    }
  }, []);

  // Save discount state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('activeDiscounts', JSON.stringify(discounts));
  }, [discounts]);

  // Check if user is authenticated
  const isUserAuthenticated = (): boolean => {
    const auth = getAuth();
    return !!auth.currentUser;
  };

  // Ensure user document exists with required fields
  const ensureUserDocument = async (): Promise<boolean> => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        return false;
      }
      
      const userDocRef = doc(firestore, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        // Create user document with initial structure
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
          usedDiscounts: [], // Initialize empty array
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        });
        console.log('✅ Created user document with usedDiscounts array');
      } else {
        // Ensure usedDiscounts array exists in existing document
        const userData = userDoc.data();
        if (!userData?.usedDiscounts) {
          await updateDoc(userDocRef, {
            usedDiscounts: [],
            lastUpdated: new Date().toISOString(),
          });
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error ensuring user document:', error);
      return false;
    }
  };

  // Check if user has already used a specific discount
  const hasUserUsedDiscount = async (discountType: DiscountType): Promise<boolean> => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        return false; // If not logged in, assume they haven't used it
      }
      
      // Ensure user document exists first
      await ensureUserDocument();
      
      // Get user document from Firestore
      const userDocRef = doc(firestore, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const usedDiscounts = userData?.usedDiscounts || [];
        return usedDiscounts.includes(discountType);
      }
      
      return false; // User document doesn't exist = no discounts used
    } catch (error) {
      console.error('Error checking discount usage:', error);
      return false;
    }
  };

  // Mark discount as used for current user (call this when purchase is finalized)
  const markDiscountAsUsed = async (discountType: DiscountType): Promise<boolean> => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        return false;
      }
      
      // Ensure user document exists first
      await ensureUserDocument();
      
      // Add discount to user's usedDiscounts array in Firestore
      const userDocRef = doc(firestore, 'users', user.uid);
      
      await updateDoc(userDocRef, {
        usedDiscounts: arrayUnion(discountType),
        lastDiscountUsed: {
          discountType,
          usedAt: new Date().toISOString(),
        },
        lastUpdated: new Date().toISOString(),
      });
      
      return true;
    } catch (error) {
      console.error('Error marking discount as used:', error);
      return false;
    }
  };

  // Toggle a specific discount (disables others) with usage check
  const toggleDiscount = async (discountType: DiscountType): Promise<{
    success: boolean;
    error?: string;
    wasActive?: boolean;
  }> => {
    // Check if user is authenticated
    if (!isUserAuthenticated()) {
      return {
        success: false,
        error: 'Please log in to use discount codes'
      };
    }

    const wasActive = discounts[discountType];
    
    // If activating discount, check if user has already used it
    if (!wasActive) {
      const hasUsed = await hasUserUsedDiscount(discountType);
      if (hasUsed) {
        return {
          success: false,
          error: 'You have already used this discount code'
        };
      }
    }

    // Toggle the discount
    setDiscounts(prev => {
      const newState: DiscountState = {
        sunday10: false,
        freeGame: false,
        bogoGiftCard: false,
      };
      
      // If the discount was already active, keep it disabled
      // Otherwise, activate only this discount
      if (!prev[discountType]) {
        newState[discountType] = true;
      }
      
      return newState;
    });

    // NOTE: We don't mark as used here anymore - only when purchase is finalized
    // This allows users to try different discounts without "consuming" them

    return {
      success: true,
      wasActive
    };
  };

  // Clear all discounts
  const clearDiscounts = () => {
    setDiscounts({
      sunday10: false,
      freeGame: false,
      bogoGiftCard: false,
    });
  };

  // Get currently active discount
  const getActiveDiscount = (): DiscountType | null => {
    if (discounts.sunday10) return 'sunday10';
    if (discounts.freeGame) return 'freeGame';
    if (discounts.bogoGiftCard) return 'bogoGiftCard';
    return null;
  };

  // Check if any discount is active
  const hasActiveDiscount = (): boolean => {
    return discounts.sunday10 || discounts.freeGame || discounts.bogoGiftCard;
  };

  // Calculate discount application
  const calculateDiscount = async (
    cart: CartItem[], 
    cartTotal: number, 
    calendarDateRange: [Date | null, Date | null]
  ): Promise<DiscountCalculation> => {
    const activeDiscount = getActiveDiscount();
    
    if (!activeDiscount) {
      return {
        discountAmount: 0,
        appliedDiscount: null,
        freeItemId: null,
        addedGiftCards: [],
        hasValidDiscount: false,
        userCanUse: true,
      };
    }

    // Check if user can use this discount
    const isAuthenticated = isUserAuthenticated();
    if (!isAuthenticated) {
      return {
        discountAmount: 0,
        appliedDiscount: activeDiscount,
        freeItemId: null,
        addedGiftCards: [],
        hasValidDiscount: false,
        userCanUse: false,
        usageError: 'Please log in to use discounts',
      };
    }

    const hasUsed = await hasUserUsedDiscount(activeDiscount);
    if (hasUsed) {
      return {
        discountAmount: 0,
        appliedDiscount: activeDiscount,
        freeItemId: null,
        addedGiftCards: [],
        hasValidDiscount: false,
        userCanUse: false,
        usageError: 'You have already used this discount code',
      };
    }

    switch (activeDiscount) {
      case 'sunday10':
        return calculateSunday10Discount(cart, cartTotal, calendarDateRange);
      
      case 'freeGame':
        return calculateFreeGameDiscount(cart, cartTotal);
      
      case 'bogoGiftCard':
        return calculateBogoGiftCardDiscount(cart, cartTotal);
      
      default:
        return {
          discountAmount: 0,
          appliedDiscount: null,
          freeItemId: null,
          addedGiftCards: [],
          hasValidDiscount: false,
          userCanUse: true,
        };
    }
  };

  return {
    discounts,
    toggleDiscount,
    clearDiscounts,
    getActiveDiscount,
    hasActiveDiscount,
    calculateDiscount,
    isUserAuthenticated,
    hasUserUsedDiscount,
    markDiscountAsUsed, // Export for purchase finalization
    finalizePurchaseWithDiscount, // New function for purchase completion
  };

  // Finalize discount usage when purchase is completed
  async function finalizePurchaseWithDiscount(): Promise<boolean> {
    const activeDiscount = getActiveDiscount();
    if (!activeDiscount) {
      return true; // No discount to finalize
    }

    try {
      // Mark the discount as permanently used
      const success = await markDiscountAsUsed(activeDiscount);
      
      if (success) {
        // Clear the active discount after successful purchase
        clearDiscounts();
        return true;
      } else {
        console.error(`❌ Failed to finalize discount ${activeDiscount}`);
        return false;
      }
    } catch (error) {
      console.error('Error finalizing purchase with discount:', error);
      return false;
    }
  }
}

// Sunday 10% off discount - only applies if event includes a Sunday
function calculateSunday10Discount(
  cart: CartItem[], 
  cartTotal: number, 
  calendarDateRange: [Date | null, Date | null]
): DiscountCalculation {
  console.log('🎯 CALCULATING SUNDAY 10% DISCOUNT:');
  console.log('Calendar Date Range:', calendarDateRange);
  
  const [startDate, endDate] = calendarDateRange;
  
  // Check if the date range includes a Sunday
  const includesSunday = checkIfRangeIncludesSunday(startDate, endDate);
  console.log('Sunday qualification result:', includesSunday);
  
  if (!includesSunday) {
    console.log('❌ Sunday discount not qualified - no Sunday detected');
    return {
      discountAmount: 0,
      appliedDiscount: 'sunday10',
      freeItemId: null,
      addedGiftCards: [],
      hasValidDiscount: false,
      userCanUse: true,
    };
  }

  const discountAmount = cartTotal * 0.1; // 10% off
  console.log('✅ Sunday discount qualified! Discount amount:', discountAmount);
  
  return {
    discountAmount,
    appliedDiscount: 'sunday10',
    freeItemId: null,
    addedGiftCards: [],
    hasValidDiscount: true,
    userCanUse: true,
  };
}

// Free game discount - makes the cheapest game in cart free
function calculateFreeGameDiscount(
  cart: CartItem[], 
  cartTotal: number
): DiscountCalculation {
  // Find all games in the cart
  const games = cart.filter(item => 
    item.category && item.category.toLowerCase().includes('game')
  );
  
  if (games.length === 0) {
    return {
      discountAmount: 0,
      appliedDiscount: 'freeGame',
      freeItemId: null,
      addedGiftCards: [],
      hasValidDiscount: false,
      userCanUse: true,
    };
  }

  // Find the cheapest game
  const cheapestGame = games.reduce((cheapest, current) => 
    current.price < cheapest.price ? current : cheapest
  );

  return {
    discountAmount: cheapestGame.price,
    appliedDiscount: 'freeGame',
    freeItemId: cheapestGame.id,
    addedGiftCards: [],
    hasValidDiscount: true,
    userCanUse: true,
  };
}

// BOGO Gift Card - buy one $50 gift card, get one free
function calculateBogoGiftCardDiscount(
  cart: CartItem[], 
  cartTotal: number
): DiscountCalculation {
  // Check if there's at least one $50 gift card in cart
  const giftCards = cart.filter(item => 
    item.category && item.category.toLowerCase().includes('gift') && item.price === 50
  );
  
  if (giftCards.length === 0) {
    return {
      discountAmount: 0,
      appliedDiscount: 'bogoGiftCard',
      freeItemId: null,
      addedGiftCards: [],
      hasValidDiscount: false,
      userCanUse: true,
    };
  }

  // Add a free gift card for each paid gift card
  const freeGiftCards: CartItem[] = giftCards.map((giftCard, index) => ({
    id: `free-gift-card-${index}-${Date.now()}`,
    name: 'FREE $50 Gift Card (BOGO)',
    price: 0,
    wetDry: 'N/A',
    quantity: giftCard.quantity,
    category: 'gift-card-free',
  }));

  return {
    discountAmount: 0, // The "discount" is the free items added
    appliedDiscount: 'bogoGiftCard',
    freeItemId: null,
    addedGiftCards: freeGiftCards,
    hasValidDiscount: true,
    userCanUse: true,
  };
}

// Helper function to check if date range includes a Sunday
function checkIfRangeIncludesSunday(startDate: Date | null, endDate: Date | null): boolean {
  console.log('🔍 SUNDAY DETECTION DEBUG:');
  console.log('Start Date:', startDate);
  console.log('End Date:', endDate);
  
  if (!startDate || !endDate) {
    console.log('❌ Missing dates - no Sunday qualification');
    return false;
  }
  
  const startDay = startDate.getDay(); // 0=Sunday, 1=Monday, ... 6=Saturday
  console.log('Start Day of Week:', startDay, '(0=Sunday, 6=Saturday)');
  
  // Check if start date is Saturday and duration is 48+ hours
  if (startDay === 6) { // Saturday is day 6
    const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    console.log('📅 Saturday detected! Duration:', durationHours, 'hours');
    if (durationHours >= 48) {
      console.log('✅ Saturday + 48+ hours = Sunday qualification!');
      return true; // Saturday + 48 hours extends into Sunday
    } else {
      console.log('❌ Saturday but less than 48 hours duration');
    }
  }
  
  // Original logic: check if any day in the range is Sunday
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  console.log('🔄 Checking each day in range for Sunday...');
  while (current <= end) {
    const dayOfWeek = current.getDay();
    console.log('Checking date:', current.toDateString(), 'Day:', dayOfWeek);
    if (dayOfWeek === 0) { // Sunday is day 0
      console.log('✅ Found Sunday in date range!');
      return true;
    }
    current.setDate(current.getDate() + 1);
  }
  
  console.log('❌ No Sunday found in date range');
  return false;
}

// Helper function to get discount description
export function getDiscountDescription(discountType: DiscountType | null): string {
  switch (discountType) {
    case 'sunday10':
      return '10% off when your event includes a Sunday';
    case 'freeGame':
      return 'Free yard game (cheapest game in cart)';
    case 'bogoGiftCard':
      return 'Buy one $50 gift card, get one free';
    default:
      return '';
  }
}

// Helper function to get promo card discount mapping
export function getPromoCardDiscount(cardTitle: string): DiscountType | null {
  if (cardTitle.includes('Saturday') || cardTitle.includes('Sunday') || cardTitle.includes('10%')) {
    return 'sunday10';
  }
  if (cardTitle.includes('Free Game') || cardTitle.includes('Free') && cardTitle.includes('Game')) {
    return 'freeGame';
  }
  if (cardTitle.includes('GOGO') || cardTitle.includes('Give One Get One')) {
    return 'bogoGiftCard';
  }
  return null;
}