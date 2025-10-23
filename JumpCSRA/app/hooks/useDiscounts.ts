import { useState, useEffect, useMemo } from 'react';
import { getAuth } from 'firebase/auth';
import { getDoc, doc, updateDoc, arrayUnion, setDoc, addDoc, collection } from 'firebase/firestore';
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
        // Extract firstName and lastName from displayName
        const displayName = user.displayName || "";
        const nameParts = displayName.split(' ');
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(' ') || "";
        
        // Create user document with initial structure
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email || '',
          firstName,
          lastName,
          name: displayName,
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
   
    
    cart.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.name} (${item.category}) - $${item.price}`);
      if (item.isGiftCard || (item.name && item.name.toLowerCase().includes('gift card'))) {
        console.log(`     🎫 Gift Card Value: $${item.giftCardValue || item.price}`);
      }
    });
    
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

    console.log('🔍 Checking user authentication and usage...');
    
    // Check if user can use this discount
    const isAuthenticated = isUserAuthenticated();
    console.log('👤 User authenticated:', isAuthenticated);
    
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
    console.log('🔄 Has user used this discount before:', hasUsed);
    
    if (hasUsed) {
      console.log('❌ User has already used this discount');
      console.log('🔄 ========== DISCOUNT CALCULATION END ==========\n');
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

    console.log('✅ User can use discount - proceeding with calculation...');
    console.log('\n🎯 Calculating discount for type:', activeDiscount);

    let result: DiscountCalculation;
    
    switch (activeDiscount) {
      case 'sunday10':
        console.log('📅 Calculating Sunday 10% discount...');
        result = calculateSunday10Discount(cart, cartTotal, calendarDateRange);
        break;
      
      case 'freeGame':
        console.log('🎮 Calculating free game discount...');
        result = calculateFreeGameDiscount(cart, cartTotal);
        break;
      
      case 'bogoGiftCard':
        console.log('🎁 Calculating BOGO gift card discount...');
        result = calculateBogoGiftCardDiscount(cart, cartTotal);
        break;
      
      default:
        console.log('❓ Unknown discount type');
        result = {
          discountAmount: 0,
          appliedDiscount: null,
          freeItemId: null,
          addedGiftCards: [],
          hasValidDiscount: false,
          userCanUse: true,
        };
    }
    
    console.log('\n📊 Final discount result:', {
      discountAmount: result.discountAmount,
      appliedDiscount: result.appliedDiscount,
      hasValidDiscount: result.hasValidDiscount,
      addedGiftCards: result.addedGiftCards.length,
      userCanUse: result.userCanUse
    });
    console.log('🔄 ========== DISCOUNT CALCULATION END ==========\n');
    
    return result;
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

  // Calculate discount only on non-gift card items
  const discountableTotal = cart.reduce((sum, item) => {
    const isGiftCardItem = item.name?.toLowerCase().includes('gift card') || item.isGiftCard;
    if (isGiftCardItem) {
      return sum; // Exclude gift cards from Sunday discount
    }
    return sum + (item.price * item.quantity);
  }, 0);

  const discountAmount = discountableTotal * 0.1; // 10% off non-gift card items
  console.log('✅ Sunday discount qualified! Discount amount:', discountAmount, 'on discountable total:', discountableTotal);
  
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

// BOGO Gift Card - buy one gift card, get one free (matching value)
function calculateBogoGiftCardDiscount(
  cart: CartItem[], 
  cartTotal: number
): DiscountCalculation {
  console.log('\n🎁 ========== BOGO GIFT CARD CALCULATION ==========');
  console.log('📊 Input cart items:', cart.length);
  console.log('💰 Cart total:', cartTotal);
  
  // Check if there are any gift cards in cart
  const giftCards = cart.filter(item => {
    const isGift = (
      (item.name && item.name.toLowerCase().includes('gift card')) ||
      (item.category && item.category.toLowerCase().includes('gift')) ||
      item.isGiftCard
    );
    console.log(`  - ${item.name}: isGiftCard=${isGift}, category=${item.category}`);
    if (isGift && item.giftCardValue) {
      console.log(`    💳 Gift Card Value: $${item.giftCardValue}`);
    }
    return isGift;
  });
  
  console.log('🎯 Found', giftCards.length, 'gift cards in cart:');
  giftCards.forEach((card, index) => {
    console.log(`  ${index + 1}. ${card.name} - Price: $${card.price}, Value: $${card.giftCardValue || card.price}`);
  });
  
  if (giftCards.length === 0) {
    console.log('⚠️ No gift cards found - BOGO not applicable');
    console.log('🎁 ================================================\n');
    return {
      discountAmount: 0,
      appliedDiscount: 'bogoGiftCard',
      freeItemId: null,
      addedGiftCards: [],
      hasValidDiscount: false,
      userCanUse: true,
    };
  }

  // Generate unique gift card codes for free cards
  const generateGiftCardCode = (): string => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const generateSegment = () => {
      let result = '';
      for (let i = 0; i < 4; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      return result;
    };
    const code = `${generateSegment()}-${generateSegment()}-${generateSegment()}`;
    console.log('🎫 Generated gift card code:', code);
    return code;
  };

  console.log('\n🔄 Finding highest value gift card for BOGO...');
  
  // Find the highest value gift card to give one free (not one for each)
  const highestValueGiftCard = giftCards.reduce((highest, current) => {
    const currentValue = current.giftCardValue || current.price;
    const highestValue = highest.giftCardValue || highest.price;
    
    console.log(`  - Comparing: $${currentValue} vs current highest $${highestValue}`);
    
    return currentValue > highestValue ? current : highest;
  });
  
  const highestValue = highestValueGiftCard.giftCardValue || highestValueGiftCard.price;
  
  console.log(`\n� Highest value gift card selected:`);
  console.log(`  - Name: ${highestValueGiftCard.name}`);
  console.log(`  - Price: $${highestValueGiftCard.price}`);
  console.log(`  - Gift Card Value: $${highestValue}`);
  
  // Generate ONE free gift card matching the highest value
  const freeCard = {
    id: `free-gift-card-bogo-${Date.now()}`,
    name: `FREE $${highestValue} Gift Card (BOGO)`,
    price: 0,
    wetDry: 'N/A',
    quantity: 1, // Always just one free card
    category: 'gift-card-free',
    giftCardCode: generateGiftCardCode(),
    isGiftCard: true,
    giftCardValue: highestValue,
    isPromotionalGift: true,
  };
  
  console.log(`✅ Generated ONE free card:`, {
    id: freeCard.id,
    name: freeCard.name,
    value: freeCard.giftCardValue,
    price: freeCard.price,
    code: freeCard.giftCardCode
  });
  
  const freeGiftCards: CartItem[] = [freeCard]; // Only one free card
  
  const totalFreeValue = freeGiftCards.reduce((sum, card) => sum + (card.giftCardValue || 0), 0);
  
  console.log('\n📊 BOGO Summary:');
  console.log(`  - Total paid gift cards in cart: ${giftCards.length}`);
  console.log(`  - Static free cards provided: 2 (both $50 and $100 options)`);
  console.log(`  - CartSidebar will filter and display appropriate free card`);
  console.log(`  - Has valid discount: ${freeGiftCards.length > 0}`);
  console.log('🎁 ================================================\n');
  
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

// Helper function to generate unique gift card codes
function generateGiftCardCode(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const generateSegment = () => {
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  };
  return `${generateSegment()}-${generateSegment()}-${generateSegment()}`;
}

// Helper function to check if gift card code already exists
async function isGiftCardCodeUnique(code: string): Promise<boolean> {
  try {
    const giftCardDoc = await getDoc(doc(firestore, 'giftCards', code));
    return !giftCardDoc.exists();
  } catch (error) {
    console.error('Error checking gift card code uniqueness:', error);
    return false;
  }
}

// Helper function to generate unique gift card code (ensures uniqueness)
async function generateUniqueGiftCardCode(): Promise<string> {
  let code: string;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    code = generateGiftCardCode();
    isUnique = await isGiftCardCodeUnique(code);
    attempts++;
  } while (!isUnique && attempts < maxAttempts);

  if (!isUnique) {
    // Fallback with timestamp to ensure uniqueness
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const timestamp = Date.now().toString();
    let timestampSegment = '';
    for (let i = 0; i < 4; i++) {
      const index = parseInt(timestamp.charAt(i % timestamp.length)) % characters.length;
      timestampSegment += characters.charAt(index);
    }
    code = `${generateGiftCardCode().slice(0, -4)}${timestampSegment}`;
  }

  return code;
}

// Helper function to create gift card in database
async function createGiftCardInDatabase(
  code: string,
  amount: number,
  purchaserUserId: string,
  purchaserEmail: string,
  purchaserName: string,
  isGift: boolean = false
): Promise<boolean> {
  try {
    const now = new Date();
    const expirationDate = new Date(now);
    expirationDate.setFullYear(expirationDate.getFullYear() + 1); // 1 year expiration

    const giftCardData = {
      id: code,
      redemptionCode: code,
      purchaseDate: now.toISOString(),
      originalAmount: amount,
      currentBalance: amount,
      purchaserUserId,
      purchaserEmail,
      purchaserName,
      status: 'active', // 'active', 'empty', 'expired'
      expirationDate: expirationDate.toISOString(),
      isGift,
      usageHistory: [] as Array<{
        type: 'order' | 'wallet';
        amount: number;
        date: string;
        orderID?: string;
        walletUserId?: string;
        description: string;
      }>,
      transactionHistory: [
        {
          type: isGift ? 'promotional_grant' : 'purchase',
          amount,
          date: now.toISOString(),
          description: isGift ? 'Free gift card from BOGO promotion' : 'Gift card purchased',
        }
      ],
      emptyDate: null as string | null, // When balance reached 0
      createdAt: now.toISOString(),
      lastUpdated: now.toISOString(),
    };

    await setDoc(doc(firestore, 'giftCards', code), giftCardData);
    return true;
  } catch (error) {
    console.error('Error creating gift card in database:', error);
    return false;
  }
}

// Helper function to get discount description
export function getDiscountDescription(discountType: DiscountType | null): string {
  switch (discountType) {
    case 'sunday10':
      return '10% off when your event includes a Sunday';
    case 'freeGame':
      return 'Free yard game (cheapest game in cart)';
    case 'bogoGiftCard':
      return 'Buy any gift card, get one of equal value free';
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

// Export gift card utility functions for use in other components
export { generateUniqueGiftCardCode, createGiftCardInDatabase, getGiftCardDetails };

// Gift card redemption and management functions
export async function redeemGiftCardToWallet(
  giftCardCode: string,
  userId: string,
  userEmail: string,
  userName: string
): Promise<{ success: boolean; message: string; amount?: number }> {
  try {
    const giftCardDoc = await getDoc(doc(firestore, 'giftCards', giftCardCode));
    
    if (!giftCardDoc.exists()) {
      return { success: false, message: 'Gift card not found' };
    }
    
    const giftCard = giftCardDoc.data();
    
    if (giftCard.status !== 'active') {
      return { success: false, message: 'Gift card is not active' };
    }
    
    if (giftCard.currentBalance <= 0) {
      return { success: false, message: 'Gift card has no remaining balance' };
    }
    
    // Check if expired
    if (new Date(giftCard.expirationDate) < new Date()) {
      return { success: false, message: 'Gift card has expired' };
    }
    
    const redeemAmount = giftCard.currentBalance;
    
    // Add usage history to gift card
    const updatedUsageHistory = [
      ...(giftCard.usageHistory || []),
      {
        type: 'wallet' as const,
        amount: redeemAmount,
        date: new Date().toISOString(),
        walletUserId: userId,
        description: `Redeemed to wallet by ${userName} (${userEmail})`
      }
    ];
    
    // Update gift card - mark as empty
    const updatedGiftCard = {
      ...giftCard,
      currentBalance: 0,
      status: 'empty',
      emptyDate: new Date().toISOString(),
      usageHistory: updatedUsageHistory,
      lastUpdated: new Date().toISOString()
    };
    
    await setDoc(doc(firestore, 'giftCards', giftCardCode), updatedGiftCard);
    
    // Add to user's wallet (import from databaseUtils)
    const { addWalletTransaction } = await import('../utils/databaseUtils');
    const walletSuccess = await addWalletTransaction(userId, {
      type: 'gift_card_redemption',
      amount: redeemAmount,
      description: `Gift card redeemed: ${giftCardCode}`,
      giftCardCode
    });
    
    if (!walletSuccess) {
      return { success: false, message: 'Failed to add funds to wallet' };
    }
    
    return { 
      success: true, 
      message: `Successfully redeemed $${redeemAmount.toFixed(2)} to your wallet`, 
      amount: redeemAmount 
    };
    
  } catch (error) {
    console.error('Error redeeming gift card to wallet:', error);
    return { success: false, message: 'An error occurred while redeeming the gift card' };
  }
}

export async function validateGiftCard(giftCardCode: string): Promise<{
  valid: boolean;
  balance?: number;
  message: string;
}> {
  try {
    const giftCardDoc = await getDoc(doc(firestore, 'giftCards', giftCardCode));
    
    if (!giftCardDoc.exists()) {
      return { valid: false, message: 'Gift card not found' };
    }
    
    const giftCard = giftCardDoc.data();
    
    if (giftCard.status !== 'active') {
      return { valid: false, message: 'Gift card is not active' };
    }
    
    if (giftCard.currentBalance <= 0) {
      return { valid: false, message: 'Gift card has no remaining balance' };
    }
    
    if (new Date(giftCard.expirationDate) < new Date()) {
      return { valid: false, message: 'Gift card has expired' };
    }
    
    return {
      valid: true,
      balance: giftCard.currentBalance,
      message: `Gift card is valid with $${giftCard.currentBalance.toFixed(2)} balance`
    };
    
  } catch (error) {
    console.error('Error validating gift card:', error);
    return { valid: false, message: 'Error validating gift card' };
  }
}

// Function to cleanup empty gift cards (to be run as scheduled job)
export async function cleanupEmptyGiftCards(): Promise<number> {
  try {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    // This would typically be run as a server-side function
    // For now, we'll just return 0 as this should be handled by backend
    console.log('Gift card cleanup should be handled by a server-side scheduled function');
    return 0;
  } catch (error) {
    console.error('Error during gift card cleanup:', error);
    return 0;
  }
}

// Get full gift card details for balance checker
async function getGiftCardDetails(giftCardCode: string): Promise<{
  success: boolean;
  giftCard?: any;
  message: string;
}> {
  try {
    const giftCardDoc = await getDoc(doc(firestore, 'giftCards', giftCardCode));
    
    if (!giftCardDoc.exists()) {
      return { success: false, message: 'Gift card not found' };
    }
    
    const giftCard = giftCardDoc.data();
    
    if (giftCard.status !== 'active') {
      return { success: false, message: 'Gift card is not active' };
    }
    
    // Check if expired
    if (new Date(giftCard.expirationDate) < new Date()) {
      return { success: false, message: 'Gift card has expired' };
    }
    
    return { 
      success: true, 
      giftCard,
      message: 'Gift card found successfully'
    };
  } catch (error) {
    console.error('Error getting gift card details:', error);
    return { success: false, message: 'Error retrieving gift card details' };
  }
}