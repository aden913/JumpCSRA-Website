import { useCartSidebar } from '../hooks/useCartSidebar';
import { useCart } from '../hooks/useCart';
import { useCalendarSidebar } from '../hooks/useCalendarSidebar';
import { useInflateables } from '../hooks/useInflateables';
import { useCategories } from '../hooks/useCategories';
import { useProductDetails } from '../hooks/useProductDetails';
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
    const newCart = [...cart, { 
      id: product.id || product.name, // Use id if available, fallback to name
      name: product.name, 
      price, 
      wetDry, 
      quantity: 1, 
      category: product.category,
      image: product.image
    }];
    setCart(newCart);
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("cart", JSON.stringify(newCart));
    }
    setProductOpen(false);
    setModalOpen(false);
    notifications.show({
      title: 'Added to Cart',
      message: `${product.name} has been added to your cart!`,
      color: 'green',
    });
  };

  function handleCalendarClose() {
    if (hasValidDates) {
      setCalendarOpen(false);
    } else {
      notifications.show({
        title: 'Select a date range',
        message: 'Please select both a start and end date before closing the calendar.',
        color: 'orange',
      });
    }
  }

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
  };
}
