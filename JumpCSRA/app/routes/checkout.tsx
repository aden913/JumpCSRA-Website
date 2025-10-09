import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { onAuthStateChanged } from "firebase/auth";
import { auth, firestore } from "../components/FirebaseConfig";
import { doc, setDoc } from "firebase/firestore";
import type { User as FirebaseUser } from "firebase/auth";
import type { CartItem } from "../components/CartSidebar";
import { useInflateables } from "../hooks/useInflateables";

export function meta() {
  return [
    { title: "Checkout - Jump CSRA Party Rental" },
    { name: "description", content: "Complete your party rental order" },
  ];
}

export default function Checkout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const inflateables = useInflateables();
  
  // Cart sidebar options
  const [duration, setDuration] = useState<string>("");
  const [surface, setSurface] = useState<string>(""); 
  const [deliveryTime, setDeliveryTime] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [calendarDateRange, setCalendarDateRange] = useState<[Date | null, Date | null]>([null, null]);

  // Checkout-specific state
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [deliveryCost, setDeliveryCost] = useState<number>(0);
  const [contractSigned, setContractSigned] = useState<boolean>(false);
  const [showContract, setShowContract] = useState<boolean>(false);
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [calculatingDistance, setCalculatingDistance] = useState<boolean>(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState<string>("");
  const [searchCache, setSearchCache] = useState<{[key: string]: string[]}>({});
  
  // Last-minute additions state
  const [lastMinuteAdditions, setLastMinuteAdditions] = useState<{[key: string]: number}>({});
  const [showQuantityModal, setShowQuantityModal] = useState<string | null>(null);
  
  // Contract and signature state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState<string>("");
  const [contractData, setContractData] = useState<any>(null);

  // Base location for distance calculation
  const BASE_LOCATION = "410 Carolina Springs Rd, North Augusta, SC 29841";

  // Optimized address autocomplete with debouncing and caching
  const searchAddresses = async (query: string) => {
    // Don't search for very short queries
    if (query.length < 3) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Don't search if query hasn't changed significantly
    if (query === lastSearchQuery) {
      return;
    }

    // Check cache first
    const cacheKey = query.toLowerCase().trim();
    if (searchCache[cacheKey]) {
      setAddressSuggestions(searchCache[cacheKey]);
      setShowSuggestions(searchCache[cacheKey].length > 0);
      setLastSearchQuery(query);
      return;
    }

    try {
      // Using Nominatim API for free address autocomplete (restricted to US)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=us&q=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      
      const suggestions = data.map((item: any) => item.display_name);
      
      // Cache the results
      setSearchCache(prev => ({
        ...prev,
        [cacheKey]: suggestions
      }));
      
      setAddressSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
      setLastSearchQuery(query);
    } catch (error) {
      console.error("Error fetching address suggestions:", error);
      setAddressSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Debounced search function
  const debouncedSearchAddresses = (query: string) => {
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set new timeout
    const newTimeout = setTimeout(() => {
      searchAddresses(query);
    }, 500); // Wait 500ms after user stops typing

    setSearchTimeout(newTimeout);
  };

  // Calculate driving distance using OSRM (free routing service)
  const calculateDeliveryDistance = async (destinationAddress: string) => {
    setCalculatingDistance(true);
    try {
      // First, geocode both addresses
      const [baseResponse, destResponse] = await Promise.all([
        fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(BASE_LOCATION)}`),
        fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(destinationAddress)}`)
      ]);

      const [baseData, destData] = await Promise.all([
        baseResponse.json(),
        destResponse.json()
      ]);

      if (baseData.length === 0 || destData.length === 0) {
        throw new Error("Could not find one or both addresses");
      }

      const baseLat = parseFloat(baseData[0].lat);
      const baseLon = parseFloat(baseData[0].lon);
      const destLat = parseFloat(destData[0].lat);
      const destLon = parseFloat(destData[0].lon);

      // Use OSRM API for driving distance calculation
      const routeResponse = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${baseLon},${baseLat};${destLon},${destLat}?overview=false`
      );
      const routeData = await routeResponse.json();

      if (routeData.routes && routeData.routes.length > 0) {
        const distanceMeters = routeData.routes[0].distance;
        const distanceMiles = distanceMeters * 0.000621371; // Convert meters to miles
        const cost = Math.round(distanceMiles * 6); // $6 per mile, rounded
        
        setDeliveryCost(cost);
        alert(`Delivery distance: ${distanceMiles.toFixed(1)} miles\nDelivery cost: $${cost}`);
      } else {
        throw new Error("Could not calculate route");
      }
    } catch (error) {
      console.error("Error calculating delivery distance:", error);
      alert("Error calculating delivery distance. Please verify the address and try again.");
    } finally {
      setCalculatingDistance(false);
    }
  };

  // Authentication guard
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u) {
        // User not logged in, redirect to login
        navigate("/");
        return;
      }
      setUser(u);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  // Load cart and settings from localStorage
  useEffect(() => {
    if (!loading && user) {
      // Load cart from localStorage
      const savedCart = localStorage.getItem("cart");
      if (savedCart) {
        try {
          setCart(JSON.parse(savedCart));
        } catch (error) {
          console.error("Error parsing cart from localStorage:", error);
          setCart([]);
        }
      }

      // Load cart sidebar options from localStorage
      setDuration(localStorage.getItem("cartDuration") || "");
      setSurface(localStorage.getItem("cartSurface") || "");
      setDeliveryTime(localStorage.getItem("cartDeliveryTime") || "");
      setLocation(localStorage.getItem("cartLocation") || "");
      
      // Load calendar date range from localStorage
      const savedDateRange = localStorage.getItem("calendarDateRange");
      if (savedDateRange) {
        try {
          const parsed = JSON.parse(savedDateRange);
          const range: [Date | null, Date | null] = [
            parsed[0] ? new Date(parsed[0]) : null,
            parsed[1] ? new Date(parsed[1]) : null,
          ];
          setCalendarDateRange(range);
        } catch (error) {
          console.error("Error parsing date range from localStorage:", error);
        }
      }
    }
  }, [loading, user]);

  // Pricing calculations (copied from CartSidebar logic)
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

  // Calculate cart total including last-minute additions
  const durationMultiplier = duration ? durationMultipliers[duration] || 1.0 : 1.0;
  const cartTotal = cart.reduce((sum, item) => {
    if (item.isGiftCard) {
      return sum + (item.giftCardValue || item.price) * item.quantity;
    } else {
      return sum + item.price * item.quantity * durationMultiplier;
    }
  }, 0);

  // Calculate last-minute additions total
  const lastMinuteTotal = Object.entries(lastMinuteAdditions).reduce((sum, [itemName, quantity]) => {
    if (quantity === 0) return sum;
    const item = partyEssentials.find(p => p.name === itemName);
    if (item) {
      const isWeekend = calendarDateRange[0] && calendarDateRange[0].getDay() === 0 || calendarDateRange[0]?.getDay() === 6;
      const price = isWeekend ? item.weekendPrice : item.weekdayPrice;
      return sum + (price * quantity * durationMultiplier);
    }
    return sum;
  }, 0);
  
  const surfaceAdj = surface ? surfacePrices[surface] || 0 : 0;
  const timeAdj = deliveryTime ? timePrices[deliveryTime] || 0 : 0;
  const subtotal = cartTotal + lastMinuteTotal + surfaceAdj + timeAdj;
  const total = subtotal + deliveryCost;

  // Get party essentials for carousel
  const partyEssentials = inflateables.filter(item => 
    item.category && item.category.toLowerCase() === "party-essentials" && 
    !item.isGiftCard // Exclude gift cards from last-minute additions
  );

  // Add item to last-minute additions
  const handleAddLastMinuteItem = (itemName: string, quantity: number) => {
    setLastMinuteAdditions(prev => ({
      ...prev,
      [itemName]: quantity
    }));
    setShowQuantityModal(null);
  };

  // Canvas drawing functions for signature
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let x, y;
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let x, y;
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureData(canvas.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData("");
  };

  // Save signed contract to database
  const saveSignedContract = async () => {
    if (!user || !signatureData) {
      alert("Please sign the contract before proceeding.");
      return;
    }

    try {
      const contractId = `contract_${user.uid}_${Date.now()}`;
      const contractDoc = {
        id: contractId,
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || "",
        signatureData: signatureData,
        signedAt: new Date().toISOString(),
        orderDetails: {
          cart: cart,
          lastMinuteAdditions: lastMinuteAdditions,
          duration: duration,
          surface: surface,
          deliveryTime: deliveryTime,
          location: location,
          deliveryAddress: deliveryAddress,
          eventDate: calendarDateRange,
          total: total,
          subtotal: subtotal,
          deliveryCost: deliveryCost
        },
        contractText: `
JUMP CSRA PARTY RENTAL AGREEMENT

This rental agreement is between Jump CSRA Party Rental and ${user.displayName || user.email}.

RENTAL DETAILS:
- Event Date: ${calendarDateRange[0]?.toLocaleDateString()} - ${calendarDateRange[1]?.toLocaleDateString()}
- Duration: ${duration}
- Delivery Address: ${deliveryAddress}
- Total Amount: $${total.toFixed(2)}

TERMS AND CONDITIONS:
1. The renter agrees to use the equipment safely and responsibly.
2. The renter is responsible for any damage to the equipment during the rental period.
3. All equipment must be returned in the same condition as received.
4. Payment is due in full before delivery.
5. Cancellations must be made at least 24 hours in advance.

By signing below, the renter agrees to all terms and conditions of this rental agreement.

Signed on: ${new Date().toLocaleDateString()}
        `.trim()
      };

      await setDoc(doc(firestore, "contracts", contractId), contractDoc);
      setContractData(contractDoc);
      setContractSigned(true);
      setShowContract(false);
      
      alert("Contract signed and saved successfully!");
    } catch (error) {
      console.error("Error saving contract:", error);
      alert("Error saving contract. Please try again.");
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '1.5rem'
      }}>
        Loading checkout...
      </div>
    );
  }

  // If cart is empty, redirect back to home
  if (cart.length === 0) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        gap: '1rem'
      }}>
        <h2>Your cart is empty</h2>
        <button onClick={() => navigate("/home")} style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}>
          Continue Shopping
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      maxWidth: '1200px', 
      margin: '0 auto', 
      padding: '2rem',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <h1 style={{ textAlign: 'center', marginBottom: '2rem', color: '#333' }}>
        Complete Your Order
      </h1>

      {/* Order Summary Section */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '2rem', 
        borderRadius: '8px', 
        marginBottom: '2rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ marginBottom: '1rem', color: '#333' }}>Order Summary</h2>
        
        {/* Cart Items */}
        <div style={{ marginBottom: '1rem' }}>
          <h3>Items:</h3>
          {cart.map((item, idx) => (
            <div key={idx} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              padding: '0.5rem 0',
              borderBottom: '1px solid #eee'
            }}>
              <span>
                {item.name} x{item.quantity} 
                {item.isGiftCard ? ` ($${item.giftCardValue || item.price})` : ` (${item.wetDry})`}
              </span>
              <span>
                ${item.isGiftCard 
                  ? ((item.giftCardValue || item.price) * item.quantity).toFixed(2)
                  : (item.price * item.quantity * durationMultiplier).toFixed(2)
                }
              </span>
            </div>
          ))}
        </div>

        {/* Event Details */}
        <div style={{ marginBottom: '1rem' }}>
          <h3>Event Details:</h3>
          <p><strong>Date:</strong> {calendarDateRange[0]?.toLocaleDateString()} - {calendarDateRange[1]?.toLocaleDateString()}</p>
          <p><strong>Duration:</strong> {duration}</p>
          <p><strong>Surface:</strong> {surface}</p>
          <p><strong>Delivery Time:</strong> {deliveryTime}</p>
          <p><strong>Location Type:</strong> {location}</p>
        </div>

        {/* Pricing Breakdown */}
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '2px solid #ddd' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Cart Subtotal:</span>
            <span>${cartTotal.toFixed(2)}</span>
          </div>
          {surfaceAdj > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Surface Adjustment:</span>
              <span>${surfaceAdj.toFixed(2)}</span>
            </div>
          )}
          {timeAdj > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Time Adjustment:</span>
              <span>${timeAdj.toFixed(2)}</span>
            </div>
          )}
          {deliveryCost > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Delivery Cost:</span>
              <span>${deliveryCost.toFixed(2)}</span>
            </div>
          )}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            fontWeight: 'bold', 
            fontSize: '1.2rem',
            marginTop: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid #ddd'
          }}>
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Delivery Address Section */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '2rem', 
        borderRadius: '8px', 
        marginBottom: '2rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ marginBottom: '1rem', color: '#333' }}>Delivery Address</h2>
        <p style={{ marginBottom: '1rem', color: '#666' }}>
          Enter the address where you want your rental items delivered. 
          Delivery cost is $6 per mile from our location in North Augusta, SC.
        </p>
        
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Enter delivery address..."
            value={deliveryAddress}
            onChange={(e) => {
              setDeliveryAddress(e.target.value);
              debouncedSearchAddresses(e.target.value);
            }}
            onFocus={() => {
              if (addressSuggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            onBlur={() => {
              // Delay hiding suggestions to allow clicking on them
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            style={{ 
              width: '100%', 
              padding: '0.75rem', 
              fontSize: '1rem',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
          />
          
          {/* Address Suggestions Dropdown */}
          {showSuggestions && addressSuggestions.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderTop: 'none',
              borderRadius: '0 0 4px 4px',
              maxHeight: '200px',
              overflowY: 'auto',
              zIndex: 1000,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              {addressSuggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setDeliveryAddress(suggestion);
                    setShowSuggestions(false);
                  }}
                  style={{
                    padding: '0.75rem',
                    cursor: 'pointer',
                    borderBottom: idx < addressSuggestions.length - 1 ? '1px solid #eee' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8f9fa';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <button
          onClick={() => {
            if (deliveryAddress.trim()) {
              setShowSuggestions(false);
              calculateDeliveryDistance(deliveryAddress);
            } else {
              alert("Please enter a delivery address first.");
            }
          }}
          disabled={calculatingDistance || !deliveryAddress.trim()}
          style={{
            backgroundColor: calculatingDistance ? '#ccc' : '#007bff',
            color: 'white',
            padding: '0.75rem 1.5rem',
            border: 'none',
            borderRadius: '4px',
            cursor: calculatingDistance ? 'not-allowed' : 'pointer'
          }}
        >
          {calculatingDistance ? 'Calculating...' : 'Calculate Delivery Cost'}
        </button>
        
        {deliveryCost > 0 && (
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: '#e8f5e8',
            border: '1px solid #4caf50',
            borderRadius: '4px'
          }}>
            <strong>Delivery Cost Calculated: ${deliveryCost}</strong>
            <br />
            <small style={{ color: '#666' }}>
              This cost has been added to your total below.
            </small>
          </div>
        )}
      </div>

      {/* Last-Minute Party Essentials */}
      {deliveryCost >= 0 && (
        <div style={{ 
          backgroundColor: 'white', 
          padding: '2rem', 
          borderRadius: '8px', 
          marginBottom: '2rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ marginBottom: '1rem', color: '#333' }}>Add Party Essentials</h2>
          <p style={{ marginBottom: '1rem', color: '#666' }}>
            Need any last-minute additions? Add party essentials to complete your event setup.
          </p>
          
          {/* Party Essentials Carousel */}
          <div style={{ 
            display: 'flex', 
            overflowX: 'auto', 
            gap: '1rem', 
            padding: '1rem 0',
            scrollBehavior: 'smooth'
          }}>
            {partyEssentials.map((item) => {
              const isWeekend = calendarDateRange[0] && (calendarDateRange[0].getDay() === 0 || calendarDateRange[0].getDay() === 6);
              const price = isWeekend ? item.weekendPrice : item.weekdayPrice;
              const currentQuantity = lastMinuteAdditions[item.name] || 0;
              
              return (
                <div
                  key={item.name}
                  style={{
                    minWidth: '200px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '1rem',
                    textAlign: 'center',
                    backgroundColor: currentQuantity > 0 ? '#e8f5e8' : 'white'
                  }}
                >
                  <img 
                    src={item.img} 
                    alt={item.name}
                    style={{ 
                      width: '100px', 
                      height: '100px', 
                      objectFit: 'cover',
                      borderRadius: '4px',
                      marginBottom: '0.5rem'
                    }}
                  />
                  <h4 style={{ margin: '0.5rem 0', fontSize: '1rem' }}>{item.name}</h4>
                  <p style={{ margin: '0.25rem 0', color: '#666', fontSize: '0.9rem' }}>
                    ${price}/each
                  </p>
                  
                  {currentQuantity > 0 ? (
                    <div style={{ marginTop: '0.5rem' }}>
                      <p style={{ 
                        color: '#28a745', 
                        fontWeight: 'bold', 
                        margin: '0.25rem 0',
                        fontSize: '0.9rem'
                      }}>
                        Added: {currentQuantity} x ${price} = ${(currentQuantity * price * durationMultiplier).toFixed(2)}
                      </p>
                      <button
                        onClick={() => setShowQuantityModal(item.name)}
                        style={{
                          backgroundColor: '#ffc107',
                          color: 'black',
                          border: 'none',
                          padding: '0.5rem 1rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          marginRight: '0.5rem'
                        }}
                      >
                        Change Qty
                      </button>
                      <button
                        onClick={() => handleAddLastMinuteItem(item.name, 0)}
                        style={{
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          padding: '0.5rem 1rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.9rem'
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowQuantityModal(item.name)}
                      style={{
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginTop: '0.5rem',
                        width: '100%'
                      }}
                    >
                      Add to Order
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Last-minute additions summary */}
          {Object.values(lastMinuteAdditions).some(qty => qty > 0) && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              border: '1px solid #dee2e6'
            }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>Added Essentials:</h4>
              {Object.entries(lastMinuteAdditions)
                .filter(([_, quantity]) => quantity > 0)
                .map(([itemName, quantity]) => {
                  const item = partyEssentials.find(p => p.name === itemName);
                  if (!item) return null;
                  const isWeekend = calendarDateRange[0] && (calendarDateRange[0].getDay() === 0 || calendarDateRange[0].getDay() === 6);
                  const price = isWeekend ? item.weekendPrice : item.weekdayPrice;
                  return (
                    <div key={itemName} style={{ display: 'flex', justifyContent: 'space-between', margin: '0.25rem 0' }}>
                      <span>{itemName} x{quantity}</span>
                      <span>${(quantity * price * durationMultiplier).toFixed(2)}</span>
                    </div>
                  );
                })
              }
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontWeight: 'bold',
                marginTop: '0.5rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid #dee2e6'
              }}>
                <span>Essentials Total:</span>
                <span>${lastMinuteTotal.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Updated Order Summary with Last-Minute Additions */}
      {(deliveryCost > 0 || Object.values(lastMinuteAdditions).some(qty => qty > 0)) && (
        <div style={{ 
          backgroundColor: 'white', 
          padding: '2rem', 
          borderRadius: '8px', 
          marginBottom: '2rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ marginBottom: '1rem', color: '#333' }}>Updated Order Total</h2>
          
          {/* Pricing Breakdown */}
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Original Cart:</span>
              <span>${cartTotal.toFixed(2)}</span>
            </div>
            {lastMinuteTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Party Essentials:</span>
                <span>${lastMinuteTotal.toFixed(2)}</span>
              </div>
            )}
            {surfaceAdj > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Surface Adjustment:</span>
                <span>${surfaceAdj.toFixed(2)}</span>
              </div>
            )}
            {timeAdj > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Time Adjustment:</span>
                <span>${timeAdj.toFixed(2)}</span>
              </div>
            )}
            {deliveryCost > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Delivery Cost:</span>
                <span>${deliveryCost.toFixed(2)}</span>
              </div>
            )}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              fontWeight: 'bold', 
              fontSize: '1.2rem',
              marginTop: '1rem',
              paddingTop: '1rem',
              borderTop: '2px solid #ddd'
            }}>
              <span>Final Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Quantity Selection Modal */}
      {showQuantityModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            minWidth: '300px',
            textAlign: 'center'
          }}>
            <h3 style={{ marginBottom: '1rem' }}>Select Quantity</h3>
            <p style={{ marginBottom: '1rem', color: '#666' }}>
              How many {showQuantityModal} would you like to add?
            </p>
            
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {[1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20].map(qty => (
                <button
                  key={qty}
                  onClick={() => handleAddLastMinuteItem(showQuantityModal, qty)}
                  style={{
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    minWidth: '50px'
                  }}
                >
                  {qty}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setShowQuantityModal(null)}
              style={{
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ 
        display: 'flex', 
        gap: '1rem', 
        justifyContent: 'center',
        marginTop: '2rem'
      }}>
        <button
          onClick={() => setShowContract(true)}
          style={{
            backgroundColor: contractSigned ? '#28a745' : '#ffc107',
            color: contractSigned ? 'white' : 'black',
            padding: '1rem 2rem',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1.1rem'
          }}
        >
          {contractSigned ? '✓ Contract Signed' : 'Sign Contract'}
        </button>
        
        <button
          disabled={!contractSigned}
          onClick={() => {
            // TODO: Implement PayPal checkout
            alert("PayPal checkout will be implemented next");
          }}
          style={{
            backgroundColor: contractSigned ? '#007bff' : '#ccc',
            color: 'white',
            padding: '1rem 2rem',
            border: 'none',
            borderRadius: '4px',
            cursor: contractSigned ? 'pointer' : 'not-allowed',
            fontSize: '1.1rem'
          }}
        >
          Proceed to Payment
        </button>
      </div>

      {/* Contract Modal */}
      {showContract && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.9)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          zIndex: 1000,
          overflow: 'auto',
          padding: '2rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            width: '100%',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            {/* Contract Header */}
            <div style={{
              padding: '2rem 2rem 1rem 2rem',
              borderBottom: '1px solid #ddd',
              position: 'sticky',
              top: 0,
              backgroundColor: 'white',
              zIndex: 1001
            }}>
              <h2 style={{ margin: 0, textAlign: 'center' }}>Rental Agreement</h2>
              <button
                onClick={() => setShowContract(false)}
                style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>

            {/* Contract Content */}
            <div style={{ padding: '2rem', lineHeight: '1.6' }}>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <h3>JUMP CSRA PARTY RENTAL AGREEMENT</h3>
              </div>

              <p><strong>Agreement Date:</strong> {new Date().toLocaleDateString()}</p>
              <p><strong>Customer:</strong> {user?.displayName || user?.email}</p>
              <p><strong>Email:</strong> {user?.email}</p>

              <h4>RENTAL DETAILS:</h4>
              <ul>
                <li><strong>Event Date:</strong> {calendarDateRange[0]?.toLocaleDateString()} - {calendarDateRange[1]?.toLocaleDateString()}</li>
                <li><strong>Duration:</strong> {duration}</li>
                <li><strong>Delivery Address:</strong> {deliveryAddress}</li>
                <li><strong>Surface Type:</strong> {surface}</li>
                <li><strong>Delivery Time:</strong> {deliveryTime}</li>
                <li><strong>Total Amount:</strong> ${total.toFixed(2)}</li>
              </ul>

              <h4>RENTAL ITEMS:</h4>
              <ul>
                {cart.map((item, idx) => (
                  <li key={idx}>
                    {item.name} x{item.quantity} - ${(item.isGiftCard ? (item.giftCardValue || item.price) : item.price * durationMultiplier).toFixed(2)} each
                  </li>
                ))}
                {Object.entries(lastMinuteAdditions)
                  .filter(([_, quantity]) => quantity > 0)
                  .map(([itemName, quantity]) => {
                    const item = partyEssentials.find(p => p.name === itemName);
                    if (!item) return null;
                    const isWeekend = calendarDateRange[0] && (calendarDateRange[0].getDay() === 0 || calendarDateRange[0].getDay() === 6);
                    const price = isWeekend ? item.weekendPrice : item.weekdayPrice;
                    return (
                      <li key={itemName}>
                        {itemName} x{quantity} - ${(price * durationMultiplier).toFixed(2)} each
                      </li>
                    );
                  })
                }
              </ul>

              <h4>TERMS AND CONDITIONS:</h4>
              <ol>
                <li>The renter agrees to use all equipment safely and responsibly according to manufacturer guidelines.</li>
                <li>The renter is liable for any damage, loss, or theft of equipment during the rental period.</li>
                <li>All equipment must be returned in the same condition as received, normal wear excepted.</li>
                <li>Payment is due in full before delivery of equipment.</li>
                <li>Cancellations must be made at least 24 hours in advance for a full refund.</li>
                <li>Jump CSRA reserves the right to inspect equipment before and after rental.</li>
                <li>The renter must ensure adequate space and safe conditions for equipment setup.</li>
                <li>Weather-related cancellations will be handled on a case-by-case basis.</li>
                <li>The renter agrees to supervise children using the equipment at all times.</li>
                <li>Jump CSRA is not liable for injuries resulting from misuse of equipment.</li>
              </ol>

              <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                <p><strong>LIABILITY WAIVER:</strong> By signing this agreement, the renter acknowledges understanding of all terms and assumes all risks associated with the rental equipment. The renter releases Jump CSRA Party Rental from any liability for injuries or damages.</p>
              </div>
            </div>

            {/* Signature Section */}
            <div style={{
              padding: '2rem',
              borderTop: '1px solid #ddd',
              backgroundColor: '#f8f9fa'
            }}>
              <h4 style={{ marginBottom: '1rem' }}>Digital Signature</h4>
              <p style={{ marginBottom: '1rem', color: '#666' }}>
                Please sign below to agree to the terms and conditions:
              </p>
              
              <div style={{
                border: '2px solid #ddd',
                borderRadius: '4px',
                backgroundColor: 'white',
                marginBottom: '1rem'
              }}>
                <canvas
                  ref={canvasRef}
                  width={700}
                  height={200}
                  style={{
                    display: 'block',
                    cursor: 'crosshair',
                    width: '100%',
                    height: 'auto'
                  }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
              
              <div style={{ 
                display: 'flex', 
                gap: '1rem', 
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                <button
                  onClick={clearSignature}
                  style={{
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Clear Signature
                </button>
                
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    onClick={() => setShowContract(false)}
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid #6c757d',
                      color: '#6c757d',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  
                  <button
                    onClick={saveSignedContract}
                    disabled={!signatureData}
                    style={{
                      backgroundColor: signatureData ? '#28a745' : '#ccc',
                      color: 'white',
                      border: 'none',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '4px',
                      cursor: signatureData ? 'pointer' : 'not-allowed',
                      fontWeight: 'bold'
                    }}
                  >
                    Sign & Accept Contract
                  </button>
                </div>
              </div>
              
              {signatureData && (
                <p style={{ 
                  marginTop: '1rem', 
                  color: '#28a745', 
                  fontSize: '0.9rem',
                  textAlign: 'center'
                }}>
                  ✓ Signature captured. Click "Sign & Accept Contract" to proceed.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Back to Cart */}
      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <button
          onClick={() => navigate("/home")}
          style={{
            backgroundColor: 'transparent',
            border: '1px solid #ccc',
            padding: '0.75rem 1.5rem',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          ← Back to Shopping
        </button>
      </div>
    </div>
  );
}