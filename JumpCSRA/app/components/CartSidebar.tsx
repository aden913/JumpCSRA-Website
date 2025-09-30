import React, { useEffect, useState } from "react";

export type CartItem = {
  name: string;
  price: number;
  wetDry: string;
  quantity: number;
  category: string; // e.g. 'party essential', 'inflateable', 'game', etc.
  wet?: boolean;
  dry?: boolean;
};

export type CartSidebarProps = {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  setCart: (cart: CartItem[]) => void;
};

export function CartSidebar({ open, onClose, cart, setCart }: CartSidebarProps) {
  useEffect(() => {
    if (open && cart.length > 0) {
      cart.forEach((item, idx) => {
      });
    }
  }, [open, cart]);
  // Helper: is item a party essential?
  const isPartyEssential = (item: CartItem) => {
    return item.category && item.category.toLowerCase() === "party-essentials";
  };
  // Helper: does item support both wet and dry?
  // Use wetDry property from cart item
  const supportsWetDry = (item: CartItem) => {
    return item.wetDry === "Wet/Dry";
  };
  // Track wet/dry selection for each item
  const [wetDrySelections, setWetDrySelections] = useState<{[idx: number]: string}>({});
  // ...existing code...
  const [orderInfo, setOrderInfo] = useState("");
  const [surface, setSurface] = useState<string>("");
  const [deliveryTime, setDeliveryTime] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [duration, setDuration] = useState<string>("");

  // Pricing adjustments
  const surfacePrices: Record<string, number> = {
    "grass-stakes": 0,
    "grass-sandbags": 50,
    "concrete": 50,
    "indoor": 40,
  };
  const timePrices: Record<string, number> = {
    "8am": 50,
    "9am": 40,
    "10am": 30,
    "11am": 20,
    "12pm": 10,
    "": 0,
  };
  const durationMultipliers: Record<string, number> = {
    "4hours": 0.9,  // 10% discount
    "24hours": 1.0, // Base price
    "48hours": 1.5, // 50% increase
  };
  // Location is for documentation only
  const locationOptions = [
    "personal home",
    "someone else's home",
    "business",
    "park",
    "church/school",
  ];

  // Calculate total
  // Calculate total with duration multiplier
  const durationMultiplier = duration ? durationMultipliers[duration] || 1.0 : 1.0;
  const cartTotal = cart.reduce((sum, item, idx) => {
    let itemTotal = item.price * item.quantity * durationMultiplier;
    if (supportsWetDry(item) && wetDrySelections[idx] === "Wet") {
      itemTotal += 50 * item.quantity;
    }
    return sum + itemTotal;
  }, 0);
  const surfaceAdj = surface ? surfacePrices[surface] || 0 : 0;
  const timeAdj = deliveryTime ? timePrices[deliveryTime] || 0 : 0;
  const total = cartTotal + surfaceAdj + timeAdj;
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
                {supportsWetDry(item) && (
                  <select
                    className="wet-dry-select"
                    value={wetDrySelections[idx] || ""}
                    onChange={e => {
                      const value = e.target.value;
                      setWetDrySelections(prev => ({ ...prev, [idx]: value }));
                    }}
                    style={{ marginLeft: '0.5rem' }}
                    required
                  >
                    <option value="">Choose Wet or Dry</option>
                    <option value="Dry">Dry</option>
                    <option value="Wet">Wet (+$50)</option>
                  </select>
                )}
                {isPartyEssential(item) && (
                  <input
                    type="number"
                    value={item.quantity}
                    min={1}
                    onChange={e => updateQuantity(idx, parseInt(e.target.value))}
                  />
                )}
                <button onClick={() => removeFromCart(idx)}>Remove</button>
              </div>
            ))
          )}
        </div>
        {/* Dropdowns for order requirements */}
        <div className="cart-dropdowns" style={{ margin: '1rem 0' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Event Duration:
            <select value={duration} onChange={e => setDuration(e.target.value)} required style={{ marginLeft: '0.5rem' }}>
              <option value="">Select duration</option>
              <option value="4hours">4 Hours (-10%)</option>
              <option value="24hours">24 Hours (Standard)</option>
              <option value="48hours">48 Hours (+50%)</option>
            </select>
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Surface:
            <select value={surface} onChange={e => setSurface(e.target.value)} required style={{ marginLeft: '0.5rem' }}>
              <option value="">Select surface</option>
              <option value="grass-stakes">Grass (stakes)</option>
              <option value="grass-sandbags">Grass (sandbags)</option>
              <option value="concrete">Concrete/Pavement</option>
              <option value="indoor">Indoor</option>
            </select>
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Delivery Time:
            <select value={deliveryTime} onChange={e => setDeliveryTime(e.target.value)} required style={{ marginLeft: '0.5rem' }}>
              <option value="">Select time</option>
              <option value="8am">8am</option>
              <option value="9am">9am</option>
              <option value="10am">10am</option>
              <option value="11am">11am</option>
              <option value="12pm">12pm</option>
            </select>
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Location:
            <select value={location} onChange={e => setLocation(e.target.value)} required style={{ marginLeft: '0.5rem' }}>
              <option value="">Select location</option>
              {locationOptions.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </label>
        </div>
        {/* Total price display */}
        <div className="cart-total" style={{ fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '1rem', textAlign: 'center' }}>
          Total: ${total.toFixed(2)}
        </div>
        <div className="cart-footer">
          <button
            id="proceedButton"
            disabled={cart.length === 0 || !duration || !surface || !deliveryTime || !location}
            onClick={() => {}}
          >
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
