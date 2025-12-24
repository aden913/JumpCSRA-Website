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
import { checkItemAvailability, type ItemAvailability } from '../utils/availabilityUtils';
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
      return isWet;
    });
  } else if (selectedWetDry === 'dry') {
    filtered = filtered.filter((item: any) => {
      const isDry = item.dry === true;
      return isDry;
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

  // Party essentials availability state
  const [itemAvailability, setItemAvailability] = useState<Map<string, ItemAvailability>>(new Map());
  
  // Quantity selection modal state
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [quantityModalItem, setQuantityModalItem] = useState<any | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);

  // Load party essentials availability when dates change
  useEffect(() => {
    async function loadPartyEssentialsAvailability() {
      if (!hasValidDates || !calendarDateRange[0] || !calendarDateRange[1] || inflateables.length === 0) {
        // Debug log removed
        return;
      }

      try {
        // Debug log removed
        // Get party essentials from actual inflateables data
        const partyEssentials = inflateables.filter(item => 
          item.category && item.category.toLowerCase() === 'party-essentials'
        );
        
        // Debug log removed
        
        const newAvailability = new Map<string, ItemAvailability>();
        
        for (const item of partyEssentials) {
          try {
            const totalQuantity = item.quantity || 1; // Use actual quantity from database
            // Debug log removed
            
            const availability = await checkItemAvailability(
              item.name,
              totalQuantity,
              calendarDateRange[0],
              calendarDateRange[1]
            );
            
            // Debug log removed
            newAvailability.set(item.name, availability);
          } catch (error) {
            console.warn(`❌ Failed to check availability for ${item.name}:`, error);
            // Set default availability if check fails
            newAvailability.set(item.name, {
              itemName: item.name,
              availableQuantity: 0,
              totalQuantity: item.quantity || 1,
              bookedQuantity: 0
            });
          }
        }
        
        setItemAvailability(newAvailability);
        // Debug log removed
      } catch (error) {
        console.error('❌ Failed to load party essentials availability:', error);
      }
    }

    loadPartyEssentialsAvailability();
  }, [calendarDateRange, hasValidDates, inflateables]);

  // Get available quantity for an item, considering cart items
  const getAvailableQuantityForItem = (itemName: string): number => {
    const availability = itemAvailability.get(itemName);
    // Debug log removed
    
    if (!availability) {
      // Debug log removed
      return 0;
    }

    const availableFromBookings = availability.availableQuantity || 0;
    
    // Count how many of this item are already in cart
    const cartQuantity = cart.reduce((sum: number, cartItem: any) => {
      if (cartItem.name === itemName) {
        return sum + (cartItem.quantity || 1);
      }
      return sum;
    }, 0);

    const finalAvailable = Math.max(0, availableFromBookings - cartQuantity);
    // Debug log removed
    
    return finalAvailable;
  };

  // Get quantity options for party essentials
  const getQuantityOptions = (itemName: string): number[] => {
    const available = getAvailableQuantityForItem(itemName);
    if (available <= 0) return [];
    return Array.from({ length: Math.min(available, 10) }, (_, i) => i + 1);
  };

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
    // Check if this is a party essential
    const isPartyEssential = product.category === 'party-essentials';
    
    if (isPartyEssential) {
      // Show quantity selection modal for party essentials
      const available = getAvailableQuantityForItem(product.name);
      if (available <= 0) {
        notifications.show({
          title: 'Not Available',
          message: `${product.name} is not available for your selected dates.`,
          color: 'red',
        });
        return;
      }
      
      if (available === 1) {
        // If only 1 available, add directly
        addToCartWithQuantity(product, 1);
      } else {
        // Show quantity selection modal
        setQuantityModalItem(product);
        setSelectedQuantity(1);
        setShowQuantityModal(true);
      }
      return;
    }
    
    // For non-party essentials, use existing logic
    addToCartWithQuantity(product, quantity);
  };

  const addToCartWithQuantity = (product: any, quantity: number = 1) => {
    const wetDry = product.wet && product.dry ? "Wet/Dry" : product.wet ? "Wet" : "Dry";
    const price = typeof product.weekdayPrice === "number" ? product.weekdayPrice : 0;
    
    // Check if this is a gift card
    const isGiftCard = product.name?.toLowerCase().includes('gift card') || product.isGiftCard;
    
    // Check if this is a party essential
    const isPartyEssential = product.category === 'party-essentials';
    
    let newCart;
    
    if (isPartyEssential) {
      // Check availability for party essentials
      const available = getAvailableQuantityForItem(product.name);
      if (available < quantity) {
        notifications.show({
          title: 'Not Available',
          message: `Only ${available} ${product.name}${available !== 1 ? 's' : ''} available for your selected dates.`,
          color: 'red',
        });
        setProductOpen(false);
        setModalOpen(false);
        setShowQuantityModal(false);
        return;
      }

      // For party essentials, check if item already exists and update quantity
      const existingIndex = cart.findIndex((item: CartItem) => item.name === product.name && item.wetDry === wetDry);
      
      if (existingIndex !== -1) {
        // Update existing item quantity
        const updatedCart = [...cart];
        const newQuantity = updatedCart[existingIndex].quantity + quantity;
        
        // Check if new total quantity exceeds availability
        const currentInCart = updatedCart[existingIndex].quantity;
        if (newQuantity > available + currentInCart) {
          notifications.show({
            title: 'Quantity Exceeded',
            message: `Cannot add ${quantity} more. Only ${available} ${product.name}${available !== 1 ? 's' : ''} available.`,
            color: 'red',
          });
          setProductOpen(false);
          setModalOpen(false);
          setShowQuantityModal(false);
          return;
        }
        
        updatedCart[existingIndex].quantity = newQuantity;
        newCart = updatedCart;
      } else {
        // Add new item
        newCart = [...cart, { 
          id: product.id || product.name,
          name: product.name, 
          price, 
          wetDry, 
          quantity, 
          category: product.category,
          image: product.image,
          isGiftCard: false
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
        price, 
        wetDry, 
        quantity: 1, 
        category: product.category,
        image: product.image,
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

  const handleQuantityModalConfirm = () => {
    if (quantityModalItem) {
      addToCartWithQuantity(quantityModalItem, selectedQuantity);
      setShowQuantityModal(false);
      setQuantityModalItem(null);
      setSelectedQuantity(1);
      setProductOpen(false);
      setModalOpen(false);
    }
  };

  const handleQuantityModalClose = () => {
    setShowQuantityModal(false);
    setQuantityModalItem(null);
    setSelectedQuantity(1);
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
    showQuantityModal,
    setShowQuantityModal,
    quantityModalItem,
    setQuantityModalItem,
    selectedQuantity,
    setSelectedQuantity,
    handleQuantityModalConfirm,
    handleQuantityModalClose,
    userMembership,
    // Party essentials availability functions
    itemAvailability,
    getAvailableQuantityForItem,
    getQuantityOptions,
  };
}
