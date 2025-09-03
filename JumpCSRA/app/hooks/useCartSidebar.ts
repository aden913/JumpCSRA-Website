import { useState } from 'react';
import type { CartItem } from '../components/CartSidebar';

export function useCartSidebar() {
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [productOpen, setProductOpen] = useState(false);
  const [membershipOpen, setMembershipOpen] = useState(false);
  return {
    cartOpen,
    setCartOpen,
    selectedProduct,
    setSelectedProduct,
    productOpen,
    setProductOpen,
    membershipOpen,
    setMembershipOpen,
  };
}
