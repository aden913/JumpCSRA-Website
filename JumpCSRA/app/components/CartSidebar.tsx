import React, { useEffect, useState, useRef } from "react";
import { getUnavailableInflateables } from '../utils/bookingUtils';
import { useDiscounts, getDiscountDescription, type DiscountCalculation } from '../hooks/useDiscounts';
import '../styles/cart.css';

export type CartItem = {
  id: string;
  name: string;
  price: number;
  wetDry: string;
  quantity: number;
  category: string; // e.g. 'party essential', 'inflateable', 'game', etc.
  wet?: boolean;
  dry?: boolean;
  image?: string;
  isGiftCard?: boolean;
  giftCardValue?: number; // For gift cards: 50 or 100
  excludeFromDiscounts?: boolean;
};

export type CartSidebarProps = {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  setCart: (cart: CartItem[]) => void;
  calendarDateRange: [Date | null, Date | null];
  discountLogic: ReturnType<typeof useDiscounts>;
};

export function CartSidebar({ open, onClose, cart, setCart, calendarDateRange, discountLogic }: CartSidebarProps) {
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

  // Helper: is item a gift card?
  const isGiftCard = (item: CartItem) => {
    return item.name?.toLowerCase().includes('gift card') || item.isGiftCard;
  };

  // Track wet/dry selection for each item
  const [wetDrySelections, setWetDrySelections] = useState<{[idx: number]: string}>({});
  
  // Track gift card value selection for each gift card item
  const [giftCardValues, setGiftCardValues] = useState<{[idx: number]: number}>({});
  
  // Debug: Track giftCardValues state changes
  useEffect(() => {
    console.log('🔍 giftCardValues state changed:', giftCardValues);
  }, [giftCardValues]);
  // ...existing code...
  const [orderInfo, setOrderInfo] = useState("");
  const [surface, setSurface] = useState<string>("");
  const [deliveryTime, setDeliveryTime] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [duration, setDuration] = useState<string>("");
  const [unavailableItems, setUnavailableItems] = useState<Set<string>>(new Set());
  const [discountCalculation, setDiscountCalculation] = useState<DiscountCalculation>({
    discountAmount: 0,
    appliedDiscount: null,
    freeItemId: null,
    addedGiftCards: [],
    hasValidDiscount: false,
    userCanUse: true,
  });

  // Calculate end date based on duration
  const calculateEndDate = (startDate: Date, durationOption: string): Date => {
    const endDate = new Date(startDate);
    switch (durationOption) {
      case "4hours":
        endDate.setHours(endDate.getHours() + 4);
        break;
      case "24hours":
        endDate.setDate(endDate.getDate() + 1);
        break;
      case "48hours":
        endDate.setDate(endDate.getDate() + 2);
        break;
      default:
        endDate.setDate(endDate.getDate() + 1); // Default to 24 hours
    }
    return endDate;
  };

  // Check availability when duration or date changes
  useEffect(() => {
    const checkAvailability = async () => {
      if (calendarDateRange[0] && duration) {
        const startDate = calendarDateRange[0];
        const endDate = calculateEndDate(startDate, duration);
        
        const unavailable = await getUnavailableInflateables(startDate, endDate);
        
        setUnavailableItems(unavailable);
      } else {
        setUnavailableItems(new Set());
      }
    };
    
    checkAvailability();
  }, [calendarDateRange, duration]);

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
  // Calculate total with duration multiplier, excluding unavailable items
  const durationMultiplier = duration ? durationMultipliers[duration] || 1.0 : 1.0;
  
  // Filter out any existing free gift cards from cart display (they're now handled via email notification)
  const displayCart = cart.filter(item => !item.category?.includes('gift-card-free'));
  
  const cartTotal = displayCart.reduce((sum, item, displayIdx) => {
    // Skip unavailable items
    if (unavailableItems.has(item.id)) {
      return sum;
    }
    
    let itemTotal: number;
    
    // Handle gift cards differently - use selected value, no duration multiplier
    if (isGiftCard(item)) {
      // Find original index in full cart for giftCardValues
      const originalIdx = cart.findIndex(cartItem => cartItem.id === item.id);
      const selectedValue = giftCardValues[originalIdx] || 50; // Default to $50
      itemTotal = selectedValue * item.quantity;
    } else {
      // Regular items with duration multiplier
      itemTotal = item.price * item.quantity * durationMultiplier;
      
      // Add wet surcharge if applicable
      const originalIdx = cart.findIndex(cartItem => cartItem.id === item.id);
      if (supportsWetDry(item) && wetDrySelections[originalIdx] === "Wet") {
        itemTotal += 50 * item.quantity; // $50 surcharge for wet items
      }
    }
    
    return sum + itemTotal;
  }, 0);
  
  const surfaceAdj = surface ? surfacePrices[surface] || 0 : 0;
  const timeAdj = deliveryTime ? timePrices[deliveryTime] || 0 : 0;
  
  // Apply discount to total
  const subtotal = cartTotal + surfaceAdj + timeAdj;
  const total = subtotal - discountCalculation.discountAmount;

  // Calculate discount asynchronously
  useEffect(() => {
    const calculateDiscountAsync = async () => {
      // Calculate proper date range with duration for discount calculation
      let dateRangeForDiscount: [Date | null, Date | null] = calendarDateRange;
      
      if (calendarDateRange[0] && duration) {
        const startDate = calendarDateRange[0];
        const endDate = calculateEndDate(startDate, duration);
        dateRangeForDiscount = [startDate, endDate];
      }
      
      const calculation = await discountLogic.calculateDiscount(cart, cartTotal, dateRangeForDiscount);
      setDiscountCalculation(calculation);
    };
    
    calculateDiscountAsync();
  }, [cart, cartTotal, calendarDateRange, duration, discountLogic.discounts, giftCardValues]);

  // Debug: Track discountCalculation changes
  useEffect(() => {
    console.log('🔍 discountCalculation state changed:', {
      appliedDiscount: discountCalculation.appliedDiscount,
      hasValidDiscount: discountCalculation.hasValidDiscount,
      addedGiftCards: discountCalculation.addedGiftCards.length,
      addedGiftCardDetails: discountCalculation.addedGiftCards.map(card => ({
        name: card.name,
        value: card.giftCardValue,
        category: card.category,
        id: card.id
      }))
    });
  }, [discountCalculation]);

  // Update cart items with selected gift card values
  useEffect(() => {
    const updatedCart = cart.map((item, idx) => {
      if (isGiftCard(item) && giftCardValues[idx]) {
        return {
          ...item,
          giftCardValue: giftCardValues[idx],
          price: giftCardValues[idx] // Update price to match selection for BOGO logic
        };
      }
      return item;
    });
    
    // Only update if there are actual changes to prevent infinite loops
    const hasChanges = cart.some((item, idx) => 
      isGiftCard(item) && giftCardValues[idx] && item.giftCardValue !== giftCardValues[idx]
    );
    
    if (hasChanges) {
      setCart(updatedCart);
    }
  }, [giftCardValues, cart, setCart]);
  useEffect(() => {
    const savedInfo = localStorage.getItem("orderMessage") || "";
    setOrderInfo(savedInfo);
  }, [open]);

  useEffect(() => {
    localStorage.setItem("orderMessage", orderInfo);
  }, [orderInfo]);

  // Helper function to determine the free gift card value for BOGO notification
  const getFreeGiftCardValue = (): number | null => {
    if (discountCalculation.appliedDiscount !== 'bogoGiftCard' || !discountCalculation.hasValidDiscount) {
      return null;
    }
    
    // Find paid gift cards in cart
    const paidGiftCards = cart.filter(item => 
      isGiftCard(item) && !item.category?.includes('gift-card-free')
    );
    
    if (paidGiftCards.length === 0) {
      return null;
    }
    
    // Get the highest value from paid gift cards, using current selections
    const cardValues: number[] = paidGiftCards.map((card, cardIndex) => {
      const originalIndex = cart.findIndex(cartItem => cartItem.id === card.id);
      return giftCardValues[originalIndex] || card.giftCardValue || card.price;
    });
    
    return Math.max(...cardValues);
  };

  // Use ref to access current cart state without dependency
  const cartRef = useRef<CartItem[]>(cart);
  cartRef.current = cart;

  // Note: BOGO gift cards are now handled via email notification instead of cart display

  // Note: Free gift cards are now handled via email notification instead of cart management

  // Note: Free gift card cleanup no longer needed since they're handled via email

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
            displayCart.map((item, idx) => {
              // Find the original index in the full cart for giftCardValues
              const originalIdx = cart.findIndex(cartItem => cartItem.id === item.id);
              const isUnavailable = unavailableItems.has(item.id);
              const isFreeItem = discountCalculation.freeItemId === item.id;
              const isSpecialItem = isFreeItem;
              
              return (
                <div 
                  className="cart-item" 
                  key={item.name + idx}
                  style={{
                    opacity: isUnavailable ? 0.6 : 1,
                    backgroundColor: isUnavailable ? '#ffebee' : isSpecialItem ? '#e8f5e8' : 'transparent',
                    border: isUnavailable ? '2px solid #f44336' : isSpecialItem ? '2px solid #4CAF50' : 'none',
                    borderRadius: '8px',
                    padding: '10px',
                    margin: '5px 0',
                    position: 'relative'
                  }}
                >
                  {isUnavailable && (
                    <div style={{
                      position: 'absolute',
                      top: '5px',
                      right: '5px',
                      backgroundColor: '#f44336',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      UNAVAILABLE
                    </div>
                  )}
                  {isSpecialItem && (
                    <div style={{
                      position: 'absolute',
                      top: '5px',
                      right: '5px',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      🎁 FREE
                    </div>
                  )}
                  <span style={{ 
                    color: isUnavailable ? '#666' : isSpecialItem ? '#2e7d32' : 'inherit',
                    fontWeight: isSpecialItem ? 'bold' : 'normal'
                  }}>
                    {item.name} - ${
                      isUnavailable ? '0.00' : 
                      isFreeItem ? '0.00 (FREE)' :
                      isGiftCard(item) ? (giftCardValues[originalIdx] || 50).toFixed(2) :
                      (item.price * durationMultiplier).toFixed(2)
                    } {!isGiftCard(item) && `(${item.wetDry})`}
                  </span>
                  
                  {/* Gift Card Value Selection */}
                  {isGiftCard(item) && (
                    <select
                      className="gift-card-value-select"
                      value={giftCardValues[originalIdx] || 50}
                      onChange={e => {
                        const value = parseInt(e.target.value);
                        console.log('\n💳 ========== GIFT CARD VALUE DROPDOWN CHANGE ==========');
                        console.log('🎯 Item:', item.name);
                        console.log('🎯 Item index (originalIdx):', originalIdx);
                        console.log('🎯 Old value:', giftCardValues[originalIdx] || 50);
                        console.log('🎯 New value selected:', value);
                        console.log('🎯 Current giftCardValues state:', giftCardValues);
                        
                        const newGiftCardValues = { ...giftCardValues, [originalIdx]: value };
                        console.log('🎯 New giftCardValues state:', newGiftCardValues);
                        
                        setGiftCardValues(newGiftCardValues);
                        console.log('🎯 setGiftCardValues called with:', newGiftCardValues);
                        console.log('💳 ========== GIFT CARD DROPDOWN CHANGE END ==========\n');
                      }}
                      style={{ marginLeft: '0.5rem' }}
                      required
                      disabled={isUnavailable}
                    >
                      <option value={50}>$50 Gift Card</option>
                      <option value={100}>$100 Gift Card</option>
                    </select>
                  )}
                  
                  {/* Wet/Dry Selection for regular items */}
                  {!isGiftCard(item) && supportsWetDry(item) && (
                    <select
                      className="wet-dry-select"
                      value={wetDrySelections[idx] || ""}
                      onChange={e => {
                        const value = e.target.value;
                        setWetDrySelections(prev => ({ ...prev, [idx]: value }));
                      }}
                      style={{ marginLeft: '0.5rem' }}
                      required
                      disabled={isUnavailable}
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
                      disabled={isUnavailable}
                    />
                  )}
                  <button 
                    onClick={() => removeFromCart(idx)}
                    disabled={false}
                    style={{
                      opacity: 1,
                      cursor: 'pointer'
                    }}
                    title='Remove item from cart'
                  >
                    Remove
                  </button>
                </div>
              );
            })
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
        {/* Discount Section */}
        <div className="cart-discounts" style={{ 
          margin: '1rem 0', 
          padding: '1rem', 
          border: discountLogic.hasActiveDiscount() ? '2px solid #4CAF50' : '1px solid #ddd', 
          borderRadius: '8px',
          backgroundColor: discountLogic.hasActiveDiscount() ? '#f8fff8' : 'transparent'
        }}>
          <h3 style={{ 
            margin: '0 0 1rem 0', 
            fontSize: '1.1rem',
            color: discountLogic.hasActiveDiscount() ? '#2e7d32' : 'inherit'
          }}>
            Active Discounts {discountLogic.hasActiveDiscount() ? '🎁' : ''}
          </h3>
          
          {discountLogic.hasActiveDiscount() ? (
            <div>
              {/* Show active discount */}
              <div style={{ 
                backgroundColor: '#e8f5e8', 
                padding: '1rem', 
                borderRadius: '8px', 
                border: '2px solid #4caf50',
                marginBottom: '1rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 'bold', color: '#2e7d32', fontSize: '1.1rem' }}>
                    ✅ {(() => {
                      const activeDiscount = discountLogic.getActiveDiscount();
                      switch (activeDiscount) {
                        case 'sunday10': return 'Sunday 10% Off';
                        case 'freeGame': return 'Free Game';
                        case 'bogoGiftCard': return 'BOGO Gift Card';
                        default: return 'Discount';
                      }
                    })()} Applied!
                  </span>
                  <button 
                    onClick={() => discountLogic.clearDiscounts()}
                    style={{
                      backgroundColor: '#f44336',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    🗑️ Remove
                  </button>
                </div>
                <div style={{ fontSize: '0.9rem', color: '#2e7d32', marginBottom: '0.5rem' }}>
                  📝 {getDiscountDescription(discountLogic.getActiveDiscount())}
                </div>
                
                {/* BOGO Gift Card Notification */}
                {discountCalculation.appliedDiscount === 'bogoGiftCard' && 
                 discountCalculation.hasValidDiscount && (() => {
                  const freeCardValue = getFreeGiftCardValue();
                  return freeCardValue ? (
                    <div style={{
                      backgroundColor: '#e8f5e8',
                      border: '1px solid #4caf50',
                      borderRadius: '8px',
                      padding: '12px',
                      margin: '8px 0',
                      fontSize: '14px',
                      color: '#2e7d32'
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                        🎁 FREE $${freeCardValue} Gift Card Included!
                      </div>
                      <div style={{ fontSize: '13px', lineHeight: '1.4' }}>
                        Your free gift card will be emailed to you after your order is confirmed.
                      </div>
                    </div>
                  ) : null;
                })()}
                
                {/* Discount status */}
                {!discountCalculation.userCanUse ? (
                  <div style={{ fontSize: '0.9rem', color: '#f44336', fontWeight: 'bold' }}>
                    ❌ {discountCalculation.usageError || 'Cannot use this discount'}
                  </div>
                ) : discountCalculation.hasValidDiscount ? (
                  <div>
                    {discountCalculation.discountAmount > 0 && (
                      <div style={{ fontSize: '0.9rem', color: '#2e7d32', fontWeight: 'bold' }}>
                        💰 Savings: ${discountCalculation.discountAmount.toFixed(2)}
                      </div>
                    )}
                    {discountCalculation.freeItemId && (
                      <div style={{ fontSize: '0.9rem', color: '#2e7d32', fontWeight: 'bold' }}>
                        🎁 Free Item: {cart.find(item => item.id === discountCalculation.freeItemId)?.name || 'Cheapest Game'}
                      </div>
                    )}
                    {discountCalculation.addedGiftCards.length > 0 && (
                      <div style={{ fontSize: '0.9rem', color: '#2e7d32', fontWeight: 'bold' }}>
                        🎁 Free Gift Cards: {discountCalculation.addedGiftCards.length}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.9rem', color: '#ff9800', fontStyle: 'italic' }}>
                    ⚠️ {(() => {
                      const activeDiscount = discountLogic.getActiveDiscount();
                      switch (activeDiscount) {
                        case 'sunday10': return 'Discount only applies if your event includes a Sunday';
                        case 'freeGame': return 'Add a yard game to your cart to activate this discount';
                        case 'bogoGiftCard': return 'Add a $50 gift card to your cart to activate this discount';
                        default: return 'Discount requirements not met';
                      }
                    })()}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#666', fontSize: '0.9rem', fontStyle: 'italic' }}>
              {discountLogic.isUserAuthenticated() ? (
                <span>💡 Click a promo card above to activate a discount</span>
              ) : (
                <span>🔒 Please log in to use discount codes</span>
              )}
            </div>
          )}
        </div>

        {/* Total price display */}
        <div className="cart-total" style={{ fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '1rem', textAlign: 'center' }}>
          {discountCalculation.discountAmount > 0 ? (
            <div>
              <div style={{ fontSize: '1rem', color: '#666', textDecoration: 'line-through' }}>
                Subtotal: ${subtotal.toFixed(2)}
              </div>
              <div style={{ color: '#4CAF50' }}>
                Total: ${total.toFixed(2)} <span style={{ fontSize: '0.9rem' }}>(Save ${discountCalculation.discountAmount.toFixed(2)})</span>
              </div>
            </div>
          ) : (
            <div>Total: ${total.toFixed(2)}</div>
          )}
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
            Upon proceeding to purchase you will be required to create an account/login for order records
          </p>
        </div>
      </div>
    </>
  );
}
