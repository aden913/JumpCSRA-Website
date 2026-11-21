import { useCartSidebar } from '../hooks/useCartSidebar';
import { useCart } from '../hooks/useCart';
import { useCalendarSidebar } from '../hooks/useCalendarSidebar';
import { useInflateables } from '../hooks/useInflateables';
import { useCategories } from '../hooks/useCategories';
import { useProductDetails } from '../hooks/useProductDetails';
import { useCartSettings } from '../hooks/useCartSettings';
import { notifications } from '@mantine/notifications';
import { useState, useRef, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../components/FirebaseConfig';
import { isUserMember } from '../utils/databaseUtils';
import { useNavigate } from 'react-router';
import { isPartyEssentialProduct } from '../utils/availabilityUtils';
import type { CartItem } from '../components/CartSidebar';
import type { UserMembership } from '../utils/databaseUtils';

// Map display categories to database categories
const categoryMapping: { [key: string]: string[] } = {
  'all': [],
  'bounce houses': ['bounce-house'],
  'slides': ['slide'],
  'obstacle courses': ['obstacle'],
  'interactive games': ['game'],
  'party essentials': ['party-essentials']
};

function filterOptions(inflateables: any[], selectedCategory: string, selectedWetDry: string): any[] {
  // Debug log removed
  
  let filtered = inflateables;
  
  // Apply category filter
  if (selectedCategory.toLowerCase() !== 'all') {
    const dbCategories = categoryMapping[selectedCategory.toLowerCase()] || [];
    
    filtered = filtered.filter((item: any) => {
      let matches = false;
      
      if (Array.isArray(item.category)) {
        // Item has multiple categories
        matches = item.category.some((cat: string) => 
          dbCategories.includes(cat.toLowerCase())
        );
      } else if (item.category) {
        // Item has single category
        matches = dbCategories.includes(item.category.toLowerCase());
      }
      
      return matches;
    });
  }
  
  // Category filter debug logging removed
  
  // Apply wet/dry filter
  if (selectedWetDry === 'wet') {
    filtered = filtered.filter((item: any) => {
      const isWet = item.wet === true;
      const isNeither = item.wet === false && item.dry === false;
      return isWet || isNeither; // Show wet items and items that are neither wet nor dry (e.g., gift cards)
    });
  } else if (selectedWetDry === 'dry') {
    filtered = filtered.filter((item: any) => {
      const isDry = item.dry === true;
      const isNeither = item.wet === false && item.dry === false;
      return isDry || isNeither; // Show dry items and items that are neither wet nor dry (e.g., gift cards)
    });
  }
  
  // Final filtered result debug logging removed
  
  return filtered;
}

export function useWelcomeLogic() {
  const navigate = useNavigate();
  
  // Cart, modal, membership state
  const {
    selectedProduct,
    setSelectedProduct,
    productOpen,
    setProductOpen,
    membershipOpen,
    setMembershipOpen,
  } = useCartSidebar();
  const [cart, setCart] = useCart();
  const carouselRef = useRef<HTMLDivElement>(null);

  // User authentication and membership state
  const [user, setUser] = useState<User | null>(null);
  const [userMembership, setUserMembership] = useState<UserMembership | null>(null);

  // Monitor auth state and load membership
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          // Check if user is a member by checking active subscriptions
          const isMember = await isUserMember(firebaseUser.uid);
          
          // Create membership object for compatibility
          const membershipData = isMember ? {
            jumpClub: true,
            dateStarted: new Date().toISOString(), // We don't have exact date from isUserMember
            cancelled: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          } : null;
          
          setUserMembership(membershipData);
        } catch (error) {
          console.error('Error fetching user membership:', error);
          setUserMembership(null);
        }
      } else {
        setUserMembership(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Cart settings (duration, surface, delivery time, location, wet/dry selections)
  const cartSettings = useCartSettings();

  // Calendar state
  const {
    calendarOpen,
    setCalendarOpen,
    calendarDateRange,
    setCalendarDateRange,
    hasValidDates,
  } = useCalendarSidebar();

  // Firebase data
  const inflateables = useInflateables();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedWetDry, setSelectedWetDry] = useState('dry'); // Default to dry
  const filteredOptions = filterOptions(inflateables, selectedCategory, selectedWetDry);
  const categories = useCategories(inflateables);
  const productDetails = useProductDetails(selectedProduct, inflateables);

  function handleNavClick(type: string) {
    if (type === "Cart") {
      navigate('/checkout');
      return;
    }
    if (type === "Calendar") {
      setCalendarOpen(true);
      return;
    }
    setModalType(type);
    setModalOpen(true);
  }

  // Modal logic
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<string | null>(null);

  const handleOrderNow = (product: any) => {
    setSelectedProduct(product);
    setProductOpen(true);
  };

  const addToCart = (product: any, quantity: number = 1) => {
    const wetDry = product.wet && product.dry ? "Wet/Dry" : product.wet ? "Wet" : "Dry";
    const price = typeof product.weekdayPrice === "number" ? product.weekdayPrice : 0;
    
    // Check if this is a gift card
    const isGiftCard = product.name?.toLowerCase().includes('gift card') || product.isGiftCard;
    
    // Check if this is a party essential
    const isPartyEssential = isPartyEssentialProduct(product);
    
    let newCart;
    
    if (isPartyEssential) {
      // For party essentials, check if item already exists and update quantity
      const existingIndex = cart.findIndex((item: CartItem) => item.name === product.name && item.wetDry === wetDry);
      
      if (existingIndex !== -1) {
        notifications.show({ title: 'Already in Cart', message: 'You can change the quantity at checkout.', color: 'orange' });
        setProductOpen(false);
        setModalOpen(false);
        return;
      } else {
        // Add new item
        newCart = [...cart, { 
          id: product.id || product.name,
          name: product.name, 
          price, 
          wetDry, 
          quantity, 
          category: "party-essentials",
          image: product.image,
          isGiftCard: isGiftCard
        }];
      }
    } else {
      // For non-party essentials, keep existing logic
      if (!isGiftCard) {
        const existing = cart.find((item: CartItem) => item.name === product.name && item.wetDry === wetDry);
        if (existing) {
          notifications.show({
            title: 'Already in Cart',
            message: `${product.name} is already in your cart. Only one of each item can be selected.`,
            color: 'orange',
          });
          setProductOpen(false);
          setModalOpen(false);
          return;
        }
      }
      
      newCart = [...cart, { 
        id: isGiftCard ? `${product.id || product.name}-${Date.now()}` : (product.id || product.name),
        name: product.name, 
        price: isGiftCard ? quantity : price, 
        wetDry, 
        quantity: 1, 
        category: product.category,
        image: product.image,
        giftCardValue: isGiftCard ? quantity : undefined,
        isGiftCard: isGiftCard
      }];
    }
    
    setCart(newCart);
    setProductOpen(false);
    setModalOpen(false);
    
    const quantityMessage = isPartyEssential && quantity > 1 ? 
      ` (${quantity})` : '';
    notifications.show({
      title: 'Added to Cart',
      message: `${product.name}${quantityMessage} has been added to your cart!`,
      color: 'green',
    });
  };

  function handleCalendarClose() {
    // Check if at least one date is selected (for single-day events, both dates are the same)
    const hasAtLeastOneDate = calendarDateRange[0] !== null;
    if (hasAtLeastOneDate) {
      setCalendarOpen(false);
    } else {
      notifications.show({
        title: 'Select a date',
        message: 'Please select an event date before closing the calendar.',
        color: 'orange',
      });
    }
  }

  const addMembershipToCart = (membershipType: 'jump-club') => {
    const price = 149; // Fixed Jump Club price
    const membershipItem: CartItem = {
      id: `membership-${membershipType}`,
      name: `Jump Club Membership`,
      price,
      wetDry: 'N/A',
      quantity: 1,
      category: 'membership',
      image: '/assets/membership-icon.png',
      isMembership: true,
      membershipType
    };

    // Check if user is already subscribed to Jump Club membership
    if (user && userMembership) {
      const isAlreadySubscribed = userMembership.jumpClub;
      
      if (isAlreadySubscribed && !userMembership.cancelled) {
        notifications.show({
          title: 'Already a Member!',
          message: `You already have an active Jump Club Membership. You can manage your membership in your profile.`,
          color: 'blue',
          autoClose: 5000,
        });
        setMembershipOpen(false);
        return;
      }
    }

    // Check if membership already in cart
    const hasExistingMembership = cart.some((item: CartItem) => item.isMembership);
    if (hasExistingMembership) {
      notifications.show({
        title: 'Membership Already Added',
        message: 'You already have a membership in your cart. Only one membership can be selected.',
        color: 'orange',
      });
      setMembershipOpen(false);
      return;
    }

    const newCart = [...cart, membershipItem];
    setCart(newCart);
    setMembershipOpen(false);
    
    notifications.show({
      title: 'Membership Added!',
      message: `${membershipItem.name} has been added to your cart! You'll get 25% off all other items.`,
      color: 'green',
    });
  };

  return {
    selectedProduct,
    setSelectedProduct,
    productOpen,
    setProductOpen,
    membershipOpen,
    setMembershipOpen,
    cart,
    setCart,
    carouselRef,
    calendarOpen,
    setCalendarOpen,
    calendarDateRange,
    setCalendarDateRange,
    hasValidDates,
    inflateables,
    selectedCategory,
    setSelectedCategory,
    selectedWetDry,
    setSelectedWetDry,
    filteredOptions,
    categories,
    productDetails,
    modalOpen,
    setModalOpen,
    modalType,
    setModalType,
    handleNavClick,
    handleOrderNow,
    addToCart,
    handleCalendarClose,
    addMembershipToCart,
    cartSettings,
    user,
    userMembership,
  };
}
