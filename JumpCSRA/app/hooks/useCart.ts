import { useState, useEffect } from 'react';
import type { CartItem } from '../components/CartSidebar';

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('cart');
      if (saved) {
        const parsedCart = JSON.parse(saved);

        const fixedCart = parsedCart.map((item: CartItem) => {
          const isGiftCard = item.name?.toLowerCase().includes('gift card') || item.isGiftCard;
          if (isGiftCard && !item.isGiftCard) {
            console.log('[CART FIX - useCart] Fixing gift card flag for:', item.name);
            return { ...item, isGiftCard: true };
          }
          return item;
        });

        setCart(fixedCart);

        if (JSON.stringify(parsedCart) !== JSON.stringify(fixedCart)) {
          window.localStorage.setItem('cart', JSON.stringify(fixedCart));
          console.log('[CART FIX - useCart] Updated localStorage with corrected gift card flags');
        }
      }
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
