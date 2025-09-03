import { useState, useEffect } from 'react';
import type { CartItem } from '../components/CartSidebar';

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>([]);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('cart');
      if (saved) setCart(JSON.parse(saved));
    }
  }, []);
  const updateCart = (newCart: CartItem[]) => {
    setCart(newCart);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('cart', JSON.stringify(newCart));
    }
  };
  return [cart, updateCart] as const;
}
