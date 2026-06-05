import { useState, useEffect, useMemo } from 'react';
import { getAuth } from 'firebase/auth';
import { getDoc, doc, updateDoc, arrayUnion, setDoc, addDoc, collection } from 'firebase/firestore';
import { firestore } from '../components/FirebaseConfig';
import { getDatabase, ref, set, get } from 'firebase/database';
import type { CartItem } from '../components/CartSidebar';
import {
  getDashboardInformationLastUpdate,
  isWebsiteCacheStale,
  readWebsiteCache,
  writeWebsiteCache,
} from '../utils/websiteInformationCache';

// Development-only logging helper
const devLog = (...args: any[]) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};

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

// Promo card configuration from database
export interface PromoCard {
  id: string;                 // Unique identifier (database key)
  slot: '1' | '2' | '3';     // Website position slot
  cardText: string;           // Display text on card
  code: string;               // Discount code/identifier
  enabled: boolean;           // Whether this card is active
  notificationTitle: string;  // Mantine notification title when activated
  notificationMessage: string; // Mantine notification message
  discountApplication: 'price' | 'items' | 'bogo'; // Apply discount to total, specific items, or BOGO
  discountType: 'percent' | 'static'; // Percentage or fixed amount
  discountValue: number;      // Discount amount
  itemCategories: string[];   // Categories when discountApplication is 'items'
  requirementType: 'none' | 'minimumCartValue' | 'containsProducts' | 'containsCategory' | 'byDay';
  requirement?: number | string[] | string; // Value depends on requirementType
  bogoProductId?: string;     // Product ID for BOGO offer (when discountApplication is 'bogo')
  bogoDiscountType?: 'free' | 'percent' | 'static'; // Type of discount for second item
  bogoDiscountValue?: number; // Value for BOGO discount (0 for free)
}

// Static image mapping based on discount code
export function getPromoCardImage(code: string): string {
  switch (code) {
    case 'sunday10':
      return '/assets/cartoon-bouncehouse-slide.png';
    case 'freeGame':
      return '/assets/cartoon-bouncehouse-kids.png';
    case 'bogoGiftCard':
      return '/assets/cartoon-bouncehouse-big.png';
    default:
      return '/assets/cartoon-bouncehouse.png';
  }
}

export function useDiscounts() {
  // Active promo card configuration
  const [activePromoCard, setActivePromoCard] = useState<PromoCard | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem('activePromoCard');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (error) {
        console.error('Error loading saved promo card:', error);
      }
    }
    return null;
  });

  // Legacy discount state for backward compatibility
  const [discounts, setDiscounts] = useState<DiscountState>(() => {
    // Check if we're in the browser (not SSR)
    if (typeof window === 'undefined') {
      return {
        sunday10: false,
        freeGame: false,
        bogoGiftCard: false,
      };
    }
    
    const saved = localStorage.getItem('activeDiscounts');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (error) {
        console.error('Error loading saved discounts:', error);
      }
    }
    return {
      sunday10: false,
      freeGame: false,
      bogoGiftCard: false,
    };
  });

  // Save active promo card to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (activePromoCard) {
        localStorage.setItem('activePromoCard', JSON.stringify(activePromoCard));
      } else {
        localStorage.removeItem('activePromoCard');
      }
    }
  }, [activePromoCard]);

  // Save discount state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeDiscounts', JSON.stringify(discounts));
    }
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
        devLog('✅ Created user document with usedDiscounts array');
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
    devLog('\n🎛️ ========== TOGGLE DISCOUNT ==========');
    devLog('🎯 Attempting to toggle discount:', discountType);
    devLog('📊 Current discount state:', discounts);
    
    // Check if user is authenticated
    if (!isUserAuthenticated()) {
      devLog('❌ User not authenticated');
      devLog('🎛️ ====================================\n');
      return {
        success: false,
        error: 'Please log in to use discount codes'
      };
    }

    devLog('✅ User is authenticated');
    const wasActive = discounts[discountType];
    devLog('📍 Discount was previously active:', wasActive);
    
    // Check account age requirement for BOGO gift card
    if (!wasActive && discountType === 'bogoGiftCard') {
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        try {
          const userDocRef = doc(firestore, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const createdAt = userData?.createdAt;
            if (createdAt) {
              const accountDate = new Date(createdAt);
              const now = new Date();
              const monthInMs = 30 * 24 * 60 * 60 * 1000; // 30 days
              const accountAge = now.getTime() - accountDate.getTime();
              
              if (accountAge < monthInMs) {
                devLog('❌ Account too new for BOGO discount');
                devLog('🎛️ ====================================\n');
                return {
                  success: false,
                  error: 'Promotion is valid for 1 month of membership'
                };
              }
            }
          }
        } catch (error) {
          console.error('Error checking account age:', error);
        }
      }
    }
    
    // If activating discount, check if user has already used it
    if (!wasActive) {
      devLog('🔍 Checking if user has used this discount before...');
      const hasUsed = await hasUserUsedDiscount(discountType);
      devLog('📝 User has used discount:', hasUsed);
      if (hasUsed) {
        devLog('❌ User has already used this discount');
        devLog('🎛️ ====================================\n');
        return {
          success: false,
          error: 'You have already used this discount code'
        };
      }
    }

    // Toggle the discount
    devLog('🔄 Toggling discount state...');
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
        devLog(`✅ Activated ${discountType} discount`);
      } else {
        devLog(`ℹ️ Deactivated ${discountType} discount`);
      }
      
      devLog('📊 New discount state:', newState);
      return newState;
    });

    // NOTE: We don't mark as used here anymore - only when purchase is finalized
    // This allows users to try different discounts without "consuming" them

    devLog('✅ Toggle successful');
    devLog('🎛️ ====================================\n');
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
    setActivePromoCard(null);
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
    devLog('\n🔄 ========== DISCOUNT CALCULATION START ==========');
    devLog('📊 Current discount state:', discounts);
    devLog('Active promo card:', activePromoCard?.cardText || 'None');
    devLog('🛒 Cart items:', cart.length);
    devLog('💰 Cart total:', cartTotal);
    devLog('📅 Calendar date range:', calendarDateRange);
    
    cart.forEach((item, index) => {
      devLog(`  Cart Item ${index + 1}:`, {
        name: item.name,
        category: item.category,
        price: item.price,
        quantity: item.quantity,
        isGiftCard: item.isGiftCard || false
      });
    });

    // Check if there's an active promo card
    if (activePromoCard) {
      devLog('🎯 Processing promo card discount...');
      
      // Check authentication
      const isAuthenticated = isUserAuthenticated();
      if (!isAuthenticated) {
        devLog('❌ User not authenticated');
        return {
          discountAmount: 0,
          appliedDiscount: null,
          freeItemId: null,
          addedGiftCards: [],
          hasValidDiscount: false,
          userCanUse: false,
          usageError: 'Please log in to use discounts',
        };
      }

      // Check if user has already used this promo card
      const hasUsed = await hasUserUsedDiscount(activePromoCard.code as DiscountType);
      if (hasUsed) {
        devLog('❌ User has already used this discount');
        return {
          discountAmount: 0,
          appliedDiscount: activePromoCard.code as DiscountType,
          freeItemId: null,
          addedGiftCards: [],
          hasValidDiscount: false,
          userCanUse: false,
          usageError: 'You have already used this discount code',
        };
      }

      // Check if promo card requirements are met
      const requirementsMet = checkPromoCardRequirements(
        activePromoCard,
        cart,
        cartTotal,
        calendarDateRange
      );

      if (!requirementsMet) {
        devLog('❌ Promo card requirements not met');
        return {
          discountAmount: 0,
          appliedDiscount: activePromoCard.code as DiscountType,
          freeItemId: null,
          addedGiftCards: [],
          hasValidDiscount: false,
          userCanUse: true,
        };
      }

      devLog('✅ Requirements met! Calculating discount...');

      if (activePromoCard.code === 'bogoGiftCard') {
        return calculateBogoGiftCardDiscount(cart, cartTotal);
      }

      // Apply discount based on card configuration
      let discountAmount = 0;
      let freeItemId: string | null = null;
      let addedGiftCards: CartItem[] = [];

      switch (activePromoCard.discountApplication) {
        case 'price':
          // Apply discount to cart total (excluding gift cards)
          const discountableTotal = cart.reduce((sum, item) => {
            const isGiftCardItem = item.name?.toLowerCase().includes('gift card') || item.isGiftCard;
            if (isGiftCardItem) return sum;
            return sum + (item.price * item.quantity);
          }, 0);

          if (activePromoCard.discountType === 'percent') {
            discountAmount = discountableTotal * (activePromoCard.discountValue / 100);
          } else { // static
            discountAmount = activePromoCard.discountValue;
          }
          devLog(`💰 Price discount: $${discountAmount} (${activePromoCard.discountType})`);
          break;

        case 'items':
          // Apply discount to specific item categories
          const categoryItems = cart.filter(item =>
            activePromoCard.itemCategories?.some(cat =>
              item.category?.toLowerCase().includes(cat.toLowerCase())
            )
          );

          if (categoryItems.length > 0) {
            if (activePromoCard.discountType === 'static' && activePromoCard.discountValue === 0) {
              // Free item - find cheapest in category
              const cheapestItem = categoryItems.reduce((min, item) =>
                item.price < min.price ? item : min
              );              freeItemId = cheapestItem.id;
              discountAmount = cheapestItem.price;
              devLog(`🎁 Free item: ${cheapestItem.name} ($${discountAmount})`);
            } else {
              // Calculate discount on category items
              const categoryTotal = categoryItems.reduce(
                (sum, item) => sum + (item.price * item.quantity),
                0
              );
              if (activePromoCard.discountType === 'percent') {
                discountAmount = categoryTotal * (activePromoCard.discountValue / 100);
              } else {
                discountAmount = activePromoCard.discountValue;
              }
              devLog(`📦 Category discount: $${discountAmount}`);
            }
          }
          break;

        case 'bogo':
          // BOGO logic (keep existing implementation)
          const result = calculateBogoGiftCardDiscount(cart, cartTotal);
          return result;
      }

      devLog('\n📊 Final promo card discount result:', {
        discountAmount,
        appliedDiscount: activePromoCard.code,
        hasValidDiscount: discountAmount > 0 || freeItemId !== null,
      });
      devLog('🔄 ========== DISCOUNT CALCULATION END ==========\n');

      return {
        discountAmount,
        appliedDiscount: activePromoCard.code as DiscountType,
        freeItemId,
        addedGiftCards,
        hasValidDiscount: discountAmount > 0 || freeItemId !== null,
        userCanUse: true,
      };
    }
    
    // Legacy discount system support
    const activeDiscount = getActiveDiscount();
    devLog('🎯 Active discount (legacy):', activeDiscount);
    
    if (!activeDiscount) {
      devLog('⚠️ No active discount - returning default calculation');
      devLog('🔄 ========== DISCOUNT CALCULATION END ==========\n');
      return {
        discountAmount: 0,
        appliedDiscount: null,
        freeItemId: null,
        addedGiftCards: [],
        hasValidDiscount: false,
        userCanUse: true,
      };
    }

    devLog('🔍 Checking user authentication and usage...');
    
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
    devLog('🔄 Has user used this discount before:', hasUsed);
    
    if (hasUsed) {
      devLog('❌ User has already used this discount');
      devLog('🔄 ========== DISCOUNT CALCULATION END ==========\n');
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

    devLog('✅ User can use discount - proceeding with calculation...');
    devLog('\n🎯 Calculating discount for type:', activeDiscount);

    let result: DiscountCalculation;
    
    switch (activeDiscount) {
      case 'sunday10':
        devLog('📅 Calculating Sunday 10% discount...');
        result = calculateSunday10Discount(cart, cartTotal, calendarDateRange);
        break;
      
      case 'freeGame':
        devLog('🎮 Calculating free game discount...');
        result = calculateFreeGameDiscount(cart, cartTotal);
        break;
      
      case 'bogoGiftCard':
        devLog('🎁 Calculating BOGO gift card discount...');
        result = calculateBogoGiftCardDiscount(cart, cartTotal);
        break;
      
      default:
        devLog('❓ Unknown discount type');
        result = {
          discountAmount: 0,
          appliedDiscount: null,
          freeItemId: null,
          addedGiftCards: [],
          hasValidDiscount: false,
          userCanUse: true,
        };
    }
    
    devLog('\n📊 Final discount result:', {
      discountAmount: result.discountAmount,
      appliedDiscount: result.appliedDiscount,
      hasValidDiscount: result.hasValidDiscount,
      addedGiftCards: result.addedGiftCards.length,
      userCanUse: result.userCanUse
    });
    devLog('🔄 ========== DISCOUNT CALCULATION END ==========\n');
    
    return result;
  };

  return {
    discounts,
    activePromoCard,
    setActivePromoCard,
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
    // Check for active promo card first
    if (activePromoCard) {
      try {
        const success = await markDiscountAsUsed(activePromoCard.code as DiscountType);
        if (success) {
          clearDiscounts();
          return true;
        } else {
          console.error(`❌ Failed to finalize promo card ${activePromoCard.code}`);
          return false;
        }
      } catch (error) {
        console.error('Error finalizing promo card:', error);
        return false;
      }
    }

    // Legacy discount system
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
  devLog('🎯 CALCULATING SUNDAY 10% DISCOUNT:');
  devLog('Calendar Date Range:', calendarDateRange);
  
  const [startDate, endDate] = calendarDateRange;
  
  // Check if the date range includes a Sunday
  const includesSunday = checkIfRangeIncludesSunday(startDate, endDate);
  devLog('Sunday qualification result:', includesSunday);
  
  if (!includesSunday) {
    devLog('❌ Sunday discount not qualified - no Sunday detected');
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
  devLog('✅ Sunday discount qualified! Discount amount:', discountAmount, 'on discountable total:', discountableTotal);
  
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
  devLog('\n🎮 ========== FREE GAME DISCOUNT CALCULATION ==========');
  devLog('📊 Cart items:', cart.length);
  devLog('💰 Cart total:', cartTotal);
  
  // Log all cart items with their categories
  cart.forEach((item, index) => {
    devLog(`  ${index + 1}. ${item.name}`);
    devLog(`     - Category: "${item.category}"`);
    devLog(`     - Price: $${item.price}`);
    devLog(`     - Includes "game": ${item.category?.toLowerCase().includes('game')}`);
  });
  
  // Find all games in the cart
  const games = cart.filter(item => 
    item.category && item.category.toLowerCase().includes('game')
  );
  
  devLog(`\n🎯 Found ${games.length} game(s) in cart:`);
  games.forEach((game, index) => {
    devLog(`  ${index + 1}. ${game.name} - $${game.price}`);
  });
  
  if (games.length === 0) {
    devLog('❌ No games found - discount not applicable');
    devLog('🎮 ===============================================\n');
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

  devLog(`\n✅ Cheapest game selected: ${cheapestGame.name}`);
  devLog(`   - Price (discount amount): $${cheapestGame.price}`);
  devLog(`   - Item ID: ${cheapestGame.id}`);
  devLog('🎮 ===============================================\n');

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
  devLog('\n🎁 ========== BOGO GIFT CARD CALCULATION ==========');
  devLog('📊 Input cart items:', cart.length);
  devLog('💰 Cart total:', cartTotal);
  
  // Check if there are any gift cards in cart
  const giftCards = cart.filter(item => {
    const isGift = (
      (item.name && item.name.toLowerCase().includes('gift card')) ||
      (item.category && item.category.toLowerCase().includes('gift')) ||
      item.isGiftCard
    );
    devLog(`  - ${item.name}: isGiftCard=${isGift}, category=${item.category}`);
    if (isGift && item.giftCardValue) {
      devLog(`    💳 Gift Card Value: $${item.giftCardValue}`);
    }
    return isGift;
  });
  
  devLog('🎯 Found', giftCards.length, 'gift cards in cart:');
  giftCards.forEach((card, index) => {
    devLog(`  ${index + 1}. ${card.name} - Price: $${card.price}, Value: $${card.giftCardValue || card.price}`);
  });
  
  if (giftCards.length === 0) {
    devLog('⚠️ No gift cards found - BOGO not applicable');
    devLog('🎁 ================================================\n');
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
    devLog('🎫 Generated gift card code:', code);
    return code;
  };

  devLog('\n🔄 Finding highest value gift card for BOGO...');
  
  // Find the highest value gift card to give one free (not one for each)
  const highestValueGiftCard = giftCards.reduce((highest, current) => {
    const currentValue = current.giftCardValue || current.price;
    const highestValue = highest.giftCardValue || highest.price;
    
    devLog(`  - Comparing: $${currentValue} vs current highest $${highestValue}`);
    
    return currentValue > highestValue ? current : highest;
  });
  
  const highestValue = highestValueGiftCard.giftCardValue || highestValueGiftCard.price;
  
  devLog(`\n🎁 Highest value gift card selected:`);
  devLog(`  - Name: ${highestValueGiftCard.name}`);
  devLog(`  - Price: $${highestValueGiftCard.price}`);
  devLog(`  - Gift Card Value: $${highestValue}`);
  
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
  
  devLog(`✅ Generated ONE free card:`, {
    id: freeCard.id,
    name: freeCard.name,
    value: freeCard.giftCardValue,
    price: freeCard.price,
    code: freeCard.giftCardCode
  });
  
  const freeGiftCards: CartItem[] = [freeCard]; // Only one free card
  
  const totalFreeValue = freeGiftCards.reduce((sum, card) => sum + (card.giftCardValue || 0), 0);
  
  devLog('\n📊 BOGO Summary:');
  devLog(`  - Total paid gift cards in cart: ${giftCards.length}`);
  devLog(`  - Static free cards provided: 2 (both $50 and $100 options)`);
  devLog(`  - CartSidebar will filter and display appropriate free card`);
  devLog(`  - Has valid discount: ${freeGiftCards.length > 0}`);
  devLog('🎁 ================================================\n');
  
  return {
    discountAmount: 0, // The "discount" is the free items added
    appliedDiscount: 'bogoGiftCard',
    freeItemId: null,
    addedGiftCards: freeGiftCards,
    hasValidDiscount: true,
    userCanUse: true,
  };
}

// Helper function to check if date range includes a specific day
function checkIfRangeIncludesDay(
  startDate: Date | null, 
  endDate: Date | null, 
  dayName: string
): boolean {
  devLog(`🔍 CHECKING FOR ${dayName.toUpperCase()}:`);
  devLog('Start Date:', startDate);
  devLog('End Date:', endDate);
  
  if (!startDate || !endDate) {
    devLog('❌ Missing dates - no day qualification');
    return false;
  }
  
  // Map day names to day numbers (0=Sunday, 1=Monday, ..., 6=Saturday)
  const dayMap: { [key: string]: number } = {
    'sunday': 0,
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6
  };
  
  const targetDay = dayMap[dayName.toLowerCase()];
  if (targetDay === undefined) {
    devLog(`❌ Unknown day name: ${dayName}`);
    return false;
  }
  
  const startDay = startDate.getDay();
  devLog(`Start Day of Week: ${startDay} (0=Sunday, 6=Saturday), Target: ${targetDay}`);
  
  // Check if start date matches the target day
  if (startDay === targetDay) {
    devLog(`✅ Start date is ${dayName}!`);
    return true;
  }
  
  // Check if the day before target day with 48+ hour duration
  const dayBefore = (targetDay - 1 + 7) % 7;
  if (startDay === dayBefore) {
    const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    devLog(`📅 Day before ${dayName} detected! Duration: ${durationHours} hours`);
    if (durationHours >= 48) {
      devLog(`✅ Day before + 48+ hours = ${dayName} qualification!`);
      return true;
    } else {
      devLog(`❌ Day before ${dayName} but less than 48 hours duration`);
    }
  }
  
  // Check if any day in the range matches the target day
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  devLog(`🔄 Checking each day in range for ${dayName}...`);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    devLog('Checking date:', current.toDateString(), 'Day:', dayOfWeek);
    if (dayOfWeek === targetDay) {
      devLog(`✅ Found ${dayName} in date range!`);
      return true;
    }
    current.setDate(current.getDate() + 1);
  }
  
  devLog(`❌ No ${dayName} found in date range`);
  return false;
}

// Helper function to check if date range includes a Sunday (legacy support)
function checkIfRangeIncludesSunday(startDate: Date | null, endDate: Date | null): boolean {
  return checkIfRangeIncludesDay(startDate, endDate, 'sunday');
}

// Check if promo card requirements are met
function checkPromoCardRequirements(
  card: PromoCard,
  cart: CartItem[],
  cartTotal: number,
  calendarDateRange: [Date | null, Date | null]
): boolean {
  devLog('🎯 CHECKING PROMO CARD REQUIREMENTS:');
  devLog('Card:', card.cardText);
  devLog('Requirement Type:', card.requirementType);
  devLog('Requirement:', card.requirement);

  switch (card.requirementType) {
    case 'none':
      devLog('✅ No requirements - always valid');
      return true;

    case 'minimumCartValue':
      const minValue = card.requirement as number;
      const meetsMinimum = cartTotal >= minValue;
      devLog(`Cart total: $${cartTotal}, Minimum: $${minValue}, Meets: ${meetsMinimum}`);
      return meetsMinimum;

    case 'containsProducts':
      const requiredProducts = card.requirement as string[];
      const hasAllProducts = requiredProducts.every(productId =>
        cart.some(item => item.id === productId)
      );
      devLog(`Required products: ${requiredProducts.length}, Has all: ${hasAllProducts}`);
      return hasAllProducts;

    case 'containsCategory':
      const requiredCategories = Array.isArray(card.requirement) 
        ? card.requirement 
        : [card.requirement];
      const hasCategory = cart.some(item =>
        requiredCategories.some(cat => {
          if (typeof cat !== 'string') return false;
          const categoryStr = Array.isArray(item.category) 
            ? item.category.join(',').toLowerCase() 
            : item.category?.toLowerCase() || '';
          return categoryStr.includes(cat.toLowerCase());
        })
      );
      devLog(`Required categories: ${requiredCategories}, Has category: ${hasCategory}`);
      return hasCategory;

    case 'byDay':
      const requiredDay = card.requirement as string;
      const [startDate, endDate] = calendarDateRange;
      const hasDay = checkIfRangeIncludesDay(startDate, endDate, requiredDay);
      devLog(`Required day: ${requiredDay}, Event has day: ${hasDay}`);
      return hasDay;

    default:
      devLog('❌ Unknown requirement type');
      return false;
  }
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
export async function generateUniqueGiftCardCode(): Promise<string> {
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
export async function createGiftCardInDatabase(
  code: string,
  amount: number,
  purchaserUserId: string,
  purchaserEmail: string,
  purchaserName: string,
  isGift: boolean = false,
  giftedTo?: string,
  restrictedForUserId?: string
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
      giftedTo: giftedTo || null,
      restrictedForUserId: restrictedForUserId || null, // User ID who cannot redeem this card
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

  const db = getDatabase();
  await set(ref(db, `giftCards/${code}`), giftCardData);
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
      return '10% off when your event starts on a Sunday';
    case 'freeGame':
      return 'Free yard game';
    case 'bogoGiftCard':
      return 'Buy a gift card, get one of equal value free';
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

// Fetch active promo cards from database
export async function fetchPromoCards(): Promise<PromoCard[]> {
  try {
    const db = getDatabase();
    const promoCardsRef = ref(db, 'dashboardInformation/promoCards');
    const snapshot = await get(promoCardsRef);
    
    if (snapshot.exists()) {
      const promoCardsData = snapshot.val();
      const promoCardsList: PromoCard[] = [];
      
      Object.entries(promoCardsData).forEach(([id, data]: [string, any]) => {
        // Only include enabled cards
        if (data.enabled === true) {
          promoCardsList.push({
            id: id,
            slot: data.slot || (id as '1' | '2' | '3'), // Backward compatibility
            cardText: data.cardText || '',
            code: data.code || '',
            enabled: data.enabled,
            notificationTitle: data.notificationTitle || 'Discount Activated!',
            notificationMessage: data.notificationMessage || '',
            discountApplication: data.discountApplication || 'price',
            discountType: data.discountType || 'percent',
            discountValue: data.discountValue || 0,
            itemCategories: data.itemCategories || [],
            requirementType: data.requirementType || 'none',
            requirement: data.requirement,
            bogoProductId: data.bogoProductId,
            bogoDiscountType: data.bogoDiscountType || 'free',
            bogoDiscountValue: data.bogoDiscountValue || 0,
          });
        }
      });
      
      // Sort by slot to maintain consistent order
      promoCardsList.sort((a, b) => parseInt(a.slot) - parseInt(b.slot));
      
      return promoCardsList;
    }
    
    // If no cards found in database, return default cards
    return [
      {
        id: '1',
        slot: '1',
        cardText: '10% OFF Sunday',
        code: 'sunday10',
        enabled: true,
        notificationTitle: 'Sunday Discount Activated! 🎉',
        notificationMessage: '10% off when your event starts on a Sunday',
        discountApplication: 'price' as const,
        discountType: 'percent' as const,
        discountValue: 10,
        itemCategories: [],
        requirementType: 'byDay' as const,
        requirement: 'sunday',
        bogoProductId: undefined,
        bogoDiscountType: 'free' as const,
        bogoDiscountValue: 0,
      },
      {
        id: '2',
        slot: '2',
        cardText: 'Free Game Upgrade',
        code: 'freeGame',
        enabled: true,
        notificationTitle: 'Free Game Activated! 🎉',
        notificationMessage: 'Free yard game included with your order',
        discountApplication: 'items' as const,
        discountType: 'static' as const,
        discountValue: 0,
        itemCategories: ['game'],
        requirementType: 'none' as const,
        bogoProductId: undefined,
        bogoDiscountType: 'free' as const,
        bogoDiscountValue: 0,
      },
      {
        id: '3',
        slot: '3',
        cardText: 'GOGO Give One Get One Gift Card',
        code: 'bogoGiftCard',
        enabled: true,
        notificationTitle: 'GOGO Gift Card Activated! 🎉',
        notificationMessage: 'Buy a gift card, get one of equal value free',
        discountApplication: 'bogo' as const,
        discountType: 'static' as const,
        discountValue: 0,
        itemCategories: [],
        requirementType: 'none' as const,
        bogoProductId: undefined,
        bogoDiscountType: 'free' as const,
        bogoDiscountValue: 0,
      },
    ];
  } catch (error) {
    console.error('Error fetching promo cards:', error);
    // Return default cards on error
    return [
      {
        id: '1',
        slot: '1',
        cardText: '10% OFF Sunday',
        code: 'sunday10',
        enabled: true,
        notificationTitle: 'Sunday Discount Activated! 🎉',
        notificationMessage: '10% off when your event starts on a Sunday',
        discountApplication: 'price' as const,
        discountType: 'percent' as const,
        discountValue: 10,
        itemCategories: [],
        requirementType: 'byDay' as const,
        requirement: 'sunday',
        bogoProductId: undefined,
        bogoDiscountType: 'free' as const,
        bogoDiscountValue: 0,
      },
      {
        id: '2',
        slot: '2',
        cardText: 'Free Game Upgrade',
        code: 'freeGame',
        enabled: true,
        notificationTitle: 'Free Game Activated! 🎉',
        notificationMessage: 'Free yard game included with your order',
        discountApplication: 'items' as const,
        discountType: 'static' as const,
        discountValue: 0,
        itemCategories: ['game'],
        requirementType: 'none' as const,
        bogoProductId: undefined,
        bogoDiscountType: 'free' as const,
        bogoDiscountValue: 0,
      },
      {
        id: '3',
        slot: '3',
        cardText: 'GOGO Give One Get One Gift Card',
        code: 'bogoGiftCard',
        enabled: true,
        notificationTitle: 'GOGO Gift Card Activated! 🎉',
        notificationMessage: 'Buy a gift card, get one of equal value free',
        discountApplication: 'bogo' as const,
        discountType: 'static' as const,
        discountValue: 0,
        itemCategories: [],
        requirementType: 'none' as const,
        bogoProductId: undefined,
        bogoDiscountType: 'free' as const,
        bogoDiscountValue: 0,
      },
    ];
  }
}

// Hook to manage promo cards state
export function usePromoCards() {
  const [promoCards, setPromoCards] = useState<PromoCard[]>(() => {
    return readWebsiteCache<PromoCard[]>('promoCards') ?? [];
  });
  const [loading, setLoading] = useState(() => {
    return readWebsiteCache<PromoCard[]>('promoCards') === null;
  });

  useEffect(() => {
    const loadPromoCards = async () => {
      const cachedCards = readWebsiteCache<PromoCard[]>('promoCards');

      try {
        const sourceLastUpdate = await getDashboardInformationLastUpdate();

        if (cachedCards && !isWebsiteCacheStale(sourceLastUpdate, 'promoCards')) {
          setPromoCards(cachedCards);
          setLoading(false);
          return;
        }

        setLoading(!cachedCards);
        const cards = await fetchPromoCards();
        setPromoCards(cards);
        writeWebsiteCache('promoCards', cards, sourceLastUpdate);
      } catch (error) {
        console.error('Error loading promo cards cache:', error);

        if (cachedCards) {
          setPromoCards(cachedCards);
        } else {
          const cards = await fetchPromoCards();
          setPromoCards(cards);
        }
      } finally {
        setLoading(false);
      }
    };

    loadPromoCards();
  }, []);

  return { promoCards, loading };
}

// Gift card redemption and management functions
export async function redeemGiftCardToWallet(
  giftCardCode: string,
  userId: string,
  userEmail: string,
  userName: string
): Promise<{ success: boolean; message: string; amount?: number }> {
  try {
    const db = getDatabase();
    const giftCardRef = ref(db, `giftCards/${giftCardCode}`);
    const snapshot = await import('firebase/database').then(({ get }) => get(giftCardRef));
    if (!snapshot.exists()) {
      return { success: false, message: 'Gift card not found' };
    }
    const giftCard = snapshot.val();
    if (giftCard.status !== 'active') {
      return { success: false, message: 'Gift card is not active' };
    }
    if (giftCard.currentBalance <= 0) {
      return { success: false, message: 'Gift card has no remaining balance' };
    }
    if (new Date(giftCard.expirationDate) < new Date()) {
      return { success: false, message: 'Gift card has expired' };
    }
    const redeemAmount = giftCard.currentBalance;
    const updatedUsageHistory = [
      ...(giftCard.usageHistory || []),
      {
        type: 'wallet',
        amount: redeemAmount,
        date: new Date().toISOString(),
        walletUserId: userId,
        description: `Redeemed to wallet by ${userName} (${userEmail})`
      }
    ];
    const updatedGiftCard = {
      ...giftCard,
      currentBalance: 0,
      status: 'empty',
      emptyDate: new Date().toISOString(),
      usageHistory: updatedUsageHistory,
      lastUpdated: new Date().toISOString()
    };
    await set(giftCardRef, updatedGiftCard);
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
    const db = getDatabase();
    const giftCardRef = ref(db, `giftCards/${giftCardCode}`);
    const snapshot = await import('firebase/database').then(({ get }) => get(giftCardRef));
    if (!snapshot.exists()) {
      return { valid: false, message: 'Gift card not found' };
    }
    const giftCard = snapshot.val();
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
    devLog('Gift card cleanup should be handled by a server-side scheduled function');
    return 0;
  } catch (error) {
    console.error('Error during gift card cleanup:', error);
    return 0;
  }
}

// Get full gift card details for balance checker
export async function getGiftCardDetails(giftCardCode: string): Promise<{
  success: boolean;
  giftCard?: any;
  message: string;
}> {
  try {
    const db = getDatabase();
    const giftCardRef = ref(db, `giftCards/${giftCardCode}`);
    const snapshot = await import('firebase/database').then(({ get }) => get(giftCardRef));
    if (!snapshot.exists()) {
      return { success: false, message: 'Gift card not found' };
    }
    const giftCard = snapshot.val();
    if (giftCard.status !== 'active') {
      return { success: false, message: 'Gift card is not active' };
    }
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


