import { useCartSidebar } from '../hooks/useCartSidebar';
import { useCart } from '../hooks/useCart';
import { useCalendarSidebar } from '../hooks/useCalendarSidebar';
import { useInflateables } from '../hooks/useInflateables';
import { useCategories } from '../hooks/useCategories';
import { useProductDetails } from '../hooks/useProductDetails';
import { useCartSettings } from '../hooks/useCartSettings';
import { notifications } from '@mantine/notifications';
import { useState, useRef } from 'react';
import type { CartItem } from '../components/CartSidebar';

function filterOptions(inflateables: any[], selectedCategory: string): any[] {
  if (selectedCategory.toLowerCase() === 'all') return inflateables;
  return inflateables.filter((item: any) =>
    Array.isArray(item.category)
      ? item.category.some((cat: string) => cat.toLowerCase() === selectedCategory.toLowerCase())
      : item.category?.toLowerCase() === selectedCategory.toLowerCase()
  );
}

export function useWelcomeLogic() {
  // Cart, modal, membership state
  const {
    cartOpen,
    setCartOpen,
    selectedProduct,
    setSelectedProduct,
    productOpen,
    setProductOpen,
    membershipOpen,
    setMembershipOpen,
  } = useCartSidebar();
  const [cart, setCart] = useCart();
  const carouselRef = useRef<HTMLDivElement>(null);

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
  const filteredOptions = filterOptions(inflateables, selectedCategory);
  const categories = useCategories(inflateables);
  const productDetails = useProductDetails(selectedProduct, inflateables);

  function handleNavClick(type: string) {
    if (type === "Cart") {
      setCartOpen(true);
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

  const addToCart = (product: any) => {
    const wetDry = product.wet && product.dry ? "Wet/Dry" : product.wet ? "Wet" : "Dry";
    const price = typeof product.weekdayPrice === "number" ? product.weekdayPrice : 0;
    
    // Check if this is a gift card
    const isGiftCard = product.name?.toLowerCase().includes('gift card') || product.isGiftCard;
    
    // Only check for existing items if it's not a gift card
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
    const newCart = [...cart, { 
      id: isGiftCard ? `${product.id || product.name}-${Date.now()}` : (product.id || product.name), // Unique ID for gift cards
      name: product.name, 
      price, 
      wetDry, 
      quantity: 1, 
      category: product.category,
      image: product.image,
      isGiftCard: isGiftCard
    }];
    setCart(newCart); // This automatically saves to localStorage via useCart hook
    setProductOpen(false);
    setModalOpen(false);
    notifications.show({
      title: 'Added to Cart',
      message: `${product.name} has been added to your cart!`,
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

  const addMembershipToCart = (membershipType: 'weekday' | 'weekend') => {
    const price = membershipType === 'weekday' ? 199 : 249;
    const membershipItem: CartItem = {
      id: `membership-${membershipType}`,
      name: `${membershipType.charAt(0).toUpperCase() + membershipType.slice(1)} Membership`,
      price,
      wetDry: 'N/A',
      quantity: 1,
      category: 'membership',
      image: '/assets/membership-icon.png',
      isMembership: true,
      membershipType
    };

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
    cartOpen,
    setCartOpen,
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
  };
}
