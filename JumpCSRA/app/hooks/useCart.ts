import { useState, useEffect } from 'react';
import type { CartItem } from '../components/CartSidebar';
import { updateCartAbandonment, clearCartAbandonment, checkPendingReminders } from '../utils/cartAbandonmentTracker';
import { getAuth, onAuthStateChanged, User } from "firebase/auth";

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [user, setUser] = useState<User | null>(null);

  // Track authentication state
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Load cart from localStorage and check for pending reminders
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('cart');
      if (saved) setCart(JSON.parse(saved));
      
      // Check for any pending cart reminders on app startup
      checkPendingReminders();
    }
  }, []);

  const updateCart = (newCart: CartItem[]) => {
    setCart(newCart);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('cart', JSON.stringify(newCart));
      
      // Track cart abandonment if user is logged in
      if (user && user.email) {
        const cartTotal = newCart.reduce((total, item) => total + (item.price * (item.quantity || 1)), 0);
        const userName = user.displayName || 'Customer';
        
        if (newCart.length === 0) {
          // Cart is empty - clear abandonment tracking
          clearCartAbandonment(user.uid);
        } else {
          // Cart has items - update abandonment tracking (resets 24-hour timer)
          updateCartAbandonment(user.uid, user.email, userName, newCart, cartTotal);
        }
      }
    }
  };

  return [cart, updateCart] as const;
}
