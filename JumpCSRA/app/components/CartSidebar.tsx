import React, { useEffect, useState } from "react";

export type CartItem = {
  name: string;
  price: number;
  wetDry: string;
  quantity: number;
};

export type CartSidebarProps = {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  setCart: (cart: CartItem[]) => void;
};

export function CartSidebar({ open, onClose, cart, setCart }: CartSidebarProps) {
  const [orderInfo, setOrderInfo] = useState("");

  useEffect(() => {
    const savedInfo = localStorage.getItem("orderMessage") || "";
    setOrderInfo(savedInfo);
  }, [open]);

  useEffect(() => {
    localStorage.setItem("orderMessage", orderInfo);
  }, [orderInfo]);

  const updateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    const newCart = [...cart];
    newCart[index].quantity = newQuantity;
    setCart(newCart);
    localStorage.setItem("cart", JSON.stringify(newCart));
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
    localStorage.setItem("cart", JSON.stringify(newCart));
  };

  return (
    <>
      <div className={`cart-overlay${open ? " open" : ""}`} onClick={onClose}></div>
      <div className={`cart-sidebar${open ? " open" : ""}`}>
        <button className="close-btn" onClick={onClose}>
          X
        </button>
        <h2 className="cart-sidebar-title">Your Cart</h2>
        <div className="cart-items">
          {cart.length === 0 ? (
            <div className="cart-empty">Your cart is empty.</div>
          ) : (
            cart.map((item, idx) => (
              <div className="cart-item" key={item.name + idx}>
                <span>
                  {item.name} - ${item.price.toFixed(2)} ({item.wetDry})
                </span>
                <input
                  type="number"
                  value={item.quantity}
                  min={1}
                  onChange={e => updateQuantity(idx, parseInt(e.target.value))}
                />
                <button onClick={() => removeFromCart(idx)}>Remove</button>
              </div>
            ))
          )}
        </div>
        <div className="cart-footer">
          <button id="proceedButton" disabled={cart.length === 0} onClick={() => {}}>
            Proceed to Purchase
          </button>
        </div>
        <div id="sidebar-footer" className="candal-regular">
          <p>
            Additional Details...
          </p>
        </div>
      </div>
    </>
  );
}
