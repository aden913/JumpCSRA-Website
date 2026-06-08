import { ModalCarousel } from "../components/ModalCarousel";
import { OptionsCarousel, OptionsCarouselRef } from "../components/OptionsCarousel";
import { ProductDetailModal } from "../components/ProductDetailModal";
import { QuantitySelectionModal } from "../components/QuantitySelectionModal";
import { CalendarSidebar } from "../components/CalendarSidebar";
import { MobileBottomMenu } from "../components/MobileBottomMenu";
import { ProfileMenuSidebar } from "../components/ProfileMenuSidebar";
import { Notifications } from '@mantine/notifications';
import { notifications } from '@mantine/notifications';
import { useInflateables } from '../hooks/useInflateables';
import { useCartSidebar } from '../hooks/useCartSidebar';
import { useCalendarSidebar } from '../hooks/useCalendarSidebar';
import { useCategories } from '../hooks/useCategories';
import { useProductDetails } from '../hooks/useProductDetails';
import { useCart } from '../hooks/useCart';
import { useDiscounts, usePromoCards, getDiscountDescription, getPromoCardImage, type PromoCard, type DiscountType } from '../hooks/useDiscounts';
import Login from "../login";

import React, { useEffect, useLayoutEffect, useState, useRef, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { getDatabase, ref, onValue } from "firebase/database";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { firebaseConfig } from "../components/FirebaseConfig";
import { initializeApp, getApps } from "firebase/app";
import { getIncompleteBookingsForUser } from "../utils/databaseUtils";
import type { BookingData } from "../utils/databaseUtils";
import { Swiper, SwiperSlide } from "swiper/react";
import { BannerCarousel } from "../components/BannerCarousel";
import { SearchBar } from "../components/SearchBar";
import { RouterNav } from "../components/RouterNav";
import ChatWidget from "../components/ChatWidget";
import type { CartItem } from "../components/CartSidebar";
import { Link } from "react-router";

import "../styles/index.css";
import "../styles/dev-4k-scale.css";
import "react-multi-carousel/lib/styles.css";
import "../styles/membership.css";
import "../styles/promo.css";
import "../styles/specials.css";
import "swiper/css";
import "swiper/css/navigation";
import '@mantine/notifications/styles.css';
import "../styles/notifications-center.css";
import "../styles/mobile-bottom-menu.css";

import { MantineProvider } from "@mantine/core";
import { useWelcomeLogic } from './useWelcomeLogic';
import { getUnavailableInflateables } from '../utils/bookingUtils';
import { ViewportDebugger } from '../components/ViewportDebugger';
import { DevModeToggle } from '../components/DevModeToggle';
import { LocalStorageDebugger } from '../components/LocalStorageDebugger';

type OptionCardProps = {
  name: string;
  img: string;
  description: string;
  dimensions: string;
  dry: boolean;
  wet: boolean;
  weekdayPrice: number;
  weekdayWaterPrice: number;
  weekendPrice: number;
  weekendWaterPrice: number;
  onOrder?: (name: string) => void;
  unavailable?: boolean;
};

function OptionCard({ name, img, onOrder, unavailable }: OptionCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflow, setIsOverflow] = useState(true);

  useLayoutEffect(() => {
    function checkOverflow() {
      if (containerRef.current && textRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const textWidth = textRef.current.scrollWidth;
        setIsOverflow(textWidth > containerWidth);
      }
    }
    const id = requestAnimationFrame(checkOverflow);
    window.addEventListener("resize", checkOverflow);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", checkOverflow);
    };
  }, [name]);

  const handleOrder = () => {
    if (unavailable) {
      return;
    }
    if (onOrder) onOrder(name);
  };

  return (
    <div className={`option-card${unavailable ? " option-card-unavailable" : ""}`}>
      <div className="option-title marquee-container" ref={containerRef}>
        <span ref={textRef} className={isOverflow ? "marquee-text" : ""}>
          {name}
        </span>
      </div>
      <img src={img} alt={name} className="option-img" style={unavailable ? { filter: "grayscale(1)", opacity: 0.6 } : {}} />
      <button
        className="order-btn"
        onClick={handleOrder}
        disabled={unavailable}
        style={unavailable ? { backgroundColor: "#ccc", cursor: "not-allowed" } : {}}
      >
        {unavailable ? "UNAVAILABLE" : "ADD TO CART"}
      </button>
    </div>
  );
}

function filterOptions(inflateables: any[], selectedCategory: string): any[] {
  if (selectedCategory.toLowerCase() === 'all') return inflateables;
  return inflateables.filter((item: any) =>
    Array.isArray(item.category)
      ? item.category.some((cat: string) => cat.toLowerCase() === selectedCategory.toLowerCase())
      : item.category?.toLowerCase() === selectedCategory.toLowerCase()
  );
}
function isDateRangeValid(range: [Date | null, Date | null]) {
  const now = new Date();
  return (
    range[0] instanceof Date &&
    range[1] instanceof Date &&
    range[0] >= now &&
    range[1] >= now
  );
}

export function Welcome() {
  const optionsCarouselRef = useRef<OptionsCarouselRef>(null);
  const logic = useWelcomeLogic();
  const discountLogic = useDiscounts();
  const { promoCards: dynamicPromoCards, loading: promoCardsLoading } = usePromoCards();
  const navigate = useNavigate();

  const [unavailableInflateables, setUnavailableInflateables] = useState<Set<string>>(new Set());
  const [user, setUser] = useState<User | null>(null);
  const [incompleteBookings, setIncompleteBookings] = useState<BookingData[]>([]);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [showBookingRecovery, setShowBookingRecovery] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // Calculate cart subtotal with discount applied
  const [discountedCartSubtotal, setDiscountedCartSubtotal] = useState<number>(0);
  
  useEffect(() => {
    const calculateCartSubtotal = async () => {
      const baseSubtotal = logic.cart.reduce((sum: number, item: CartItem) => sum + (item.price * item.quantity), 0);
      
      // Calculate discount
      const discountCalculation = await discountLogic.calculateDiscount(
        logic.cart, 
        baseSubtotal, 
        logic.calendarDateRange
      );
      
      // Apply discount to subtotal
      const discountAmount = discountCalculation?.discountAmount || 0;
      const finalSubtotal = Math.max(0, baseSubtotal - discountAmount);
      
      setDiscountedCartSubtotal(finalSubtotal);
    };
    
    calculateCartSubtotal();
  }, [logic.cart, logic.calendarDateRange, discountLogic.discounts]);

  // Combine static membership card with dynamic promo cards
  const allPromoCards = useMemo(() => {
   /*  const membershipCard = { 
      title: "Become a member", 
      img: "/assets/cartoon-bouncehouse.png",
      isMembership: true,
      code: undefined,
      notificationTitle: undefined,
      notificationMessage: undefined,
      promoCard: undefined,
    }; */
    
    const dynamicCards = dynamicPromoCards.map((card: PromoCard) => ({
      title: card.cardText,
      img: getPromoCardImage(card.code), // Use static image based on code
      code: card.code,
      notificationTitle: card.notificationTitle,
      notificationMessage: card.notificationMessage,
      isMembership: false,
      promoCard: card, // Include full promo card configuration
    }));
    
    // return [membershipCard, ...dynamicCards];
    return [...dynamicCards];
  }, [dynamicPromoCards]);

  // Initialize Firebase Auth
  const auth = getAuth();

  // Handle user authentication and booking recovery
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Check for incomplete bookings when user logs in
        try {
          const incomplete = await getIncompleteBookingsForUser(currentUser.uid);
          setIncompleteBookings(incomplete);
          
          if (incomplete.length > 0) {
            // Show notification about incomplete booking after a delay
            setTimeout(() => {
              setShowBookingRecovery(true);
            }, 2000);
          }
        } catch (error) {
          console.error('Error checking for incomplete bookings:', error);
        }
      } else {
        setIncompleteBookings([]);
        setShowBookingRecovery(false);
      }
    });

    return () => unsubscribe();
  }, [auth]);

  // Function to continue incomplete booking
  const continueIncompleteBooking = (booking: BookingData) => {
    // Store booking ID in localStorage to be picked up by checkout
    localStorage.setItem('resumeBookingId', booking.orderID);
    
    // Navigate to checkout with the incomplete booking
    navigate('/checkout');
    
    notifications.show({
      title: '📝 Resuming Booking',
      message: `Continuing with your incomplete booking #${booking.orderID}`,
      color: 'blue',
      autoClose: 3000,
    });
  };

  // Function to dismiss booking recovery notification
  const dismissBookingRecovery = () => {
    setShowBookingRecovery(false);
  };

  // Function to delete incomplete booking
  const deleteIncompleteBooking = async (booking: BookingData) => {
    if (!confirm(`Are you sure you want to delete booking #${booking.orderID}? This action cannot be undone.`)) {
      return;
    }

    try {
      // Delete the booking by setting status to 'cancelled'
      const { updateBookingStatus } = await import('../utils/databaseUtils');
      const success = await updateBookingStatus(booking.orderID, 'cancelled');
      
      if (success) {
        notifications.show({
          title: '🗑️ Booking Deleted',
          message: `Booking #${booking.orderID} has been deleted`,
          color: 'red',
          autoClose: 3000,
        });
        
        // Remove from incomplete bookings and hide notification
        setIncompleteBookings(prev => prev.filter(b => b.orderID !== booking.orderID));
        if (incompleteBookings.length <= 1) {
          setShowBookingRecovery(false);
        }

        // Refresh the page to update availability in the options carousel
        setTimeout(() => {
          window.location.reload();
        }, 1000); // Small delay to let the notification show
      } else {
        notifications.show({
          title: '❌ Delete Failed',
          message: 'Failed to delete booking. Please try again.',
          color: 'red',
          autoClose: 5000,
        });
      }
    } catch (error) {
      console.error('Error deleting booking:', error);
      notifications.show({
        title: '❌ Delete Failed',
        message: 'An error occurred while deleting the booking.',
        color: 'red',
        autoClose: 5000,
      });
    }
  };

  // Wrapper function to handle category change and reset carousel
  const handleCategoryChange = (category: string) => {
    // Debug log removed
    // Debug log removed
    // Debug log removed
    
    logic.setSelectedCategory(category);
    
    // Log after state change (note: state update is async, so this might not show the new value immediately)
    setTimeout(() => {
      // Debug log removed
      // Debug log removed
    }, 50);
    
    // Reset carousel to beginning after a short delay to allow re-render
    setTimeout(() => {
      // Debug log removed
      if (optionsCarouselRef.current) {
        optionsCarouselRef.current.resetToBeginning();
        // Debug log removed
      } else {
        console.warn('⚠️ [CAROUSEL] Carousel ref not available for reset');
      }
    }, 150); // Increased timeout slightly for better reliability
  };

  // Fetch unavailable inflateables whenever date range changes
  useEffect(() => {
    async function fetchUnavailable() {
      const [start, end] = logic.calendarDateRange;
      if (start && end) {
        const unavailable = await getUnavailableInflateables(start, end);
        setUnavailableInflateables(unavailable);
      } else {
        setUnavailableInflateables(new Set());
      }
    }
    fetchUnavailable();
  }, [logic.calendarDateRange]);

   // Load dates from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("calendarDateRange");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const range: [Date | null, Date | null] = [
          parsed[0] ? new Date(parsed[0]) : null,
          parsed[1] ? new Date(parsed[1]) : null,
        ];
        if (isDateRangeValid(range)) {
          logic.setCalendarDateRange(range);
        } else {
          localStorage.removeItem("calendarDateRange");
        }
      } catch {
        localStorage.removeItem("calendarDateRange");
      }
    }
  }, []);

  // Save dates to localStorage whenever they change
  useEffect(() => {
    if (logic.calendarDateRange[0] && logic.calendarDateRange[1]) {
      if (isDateRangeValid(logic.calendarDateRange)) {
        localStorage.setItem(
          "calendarDateRange",
          JSON.stringify([
            logic.calendarDateRange[0].toISOString(),
            logic.calendarDateRange[1].toISOString(),
          ])
        );
      } else {
        localStorage.removeItem("calendarDateRange");
      }
    }
  }, [logic.calendarDateRange]);

  // Handle URL parameters from checkout navigation
  const [searchParams, setSearchParams] = useSearchParams();
  
  useEffect(() => {
    const category = searchParams.get('category');
    const productName = searchParams.get('product');
    const focus = searchParams.get('focus');
    const signin = searchParams.get('signin');
    
    // Handle signin parameter
    if (signin === 'true') {
      setShowLoginModal(true);
      // Clear the signin parameter from URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('signin');
      setSearchParams(newParams);
    }
    
    if (category) {
      // Set the selected category and reset carousel
      handleCategoryChange(category);
      // Clear the URL parameter
      setSearchParams(new URLSearchParams());
      // Scroll to options section
      setTimeout(() => {
        const optionsSection = document.querySelector('.options-section');
        if (optionsSection) {
          optionsSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }
      }, 100);
    }
    
    if (productName) {
      // Find the product and show its details
      const product = logic.inflateables.find(item => 
        item.name && item.name.toLowerCase() === productName.toLowerCase()
      );
      if (product) {
        logic.setSelectedProduct(product);
        logic.setProductOpen(true);
      }
      // Clear the URL parameter
      setSearchParams(new URLSearchParams());
    }
    
    if (focus === 'carousel') {
      // Scroll to options carousel
      setTimeout(() => {
        const optionsSection = document.querySelector('.options-section');
        if (optionsSection) {
          optionsSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }
      }, 200);
      // Clear the URL parameter
      setSearchParams(new URLSearchParams());
    }
  }, [searchParams, logic.inflateables, logic.setSelectedCategory, logic.setSelectedProduct, logic.setProductOpen, setSearchParams]);

  return (
    <>
      <MantineProvider>
        {/* Dev Tools - Hidden for mobile testing */}
        {/* <ViewportDebugger /> */}
        {/* <DevModeToggle /> */}
        {/* <LocalStorageDebugger /> */}
        <Notifications position="top-right" />
        
        {/* Booking Recovery Notification */}
        {showBookingRecovery && incompleteBookings.length > 0 && (
          <div style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'white',
            border: '2px solid var(--lightBlue)',
            borderRadius: '8px',
            padding: '15px 20px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            maxWidth: '500px',
            textAlign: 'center'
          }}>
            <div style={{ fontWeight: 'bold', color: 'var(--darkBlue)', marginBottom: '10px' }}>
              📝 Resume Your Booking
            </div>
            <div style={{ color: 'var(--darkBlue)', marginBottom: '15px', fontSize: '14px' }}>
              You have an incomplete booking from {new Date(incompleteBookings[0].createdAt).toLocaleDateString()}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => continueIncompleteBooking(incompleteBookings[0])}
                style={{
                  backgroundColor: 'var(--lightBlue)',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                Continue Booking
              </button>
              <button
                onClick={() => deleteIncompleteBooking(incompleteBookings[0])}
                style={{
                  backgroundColor: 'var(--darkBlue)',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel Booking
              </button>
              <button
                onClick={dismissBookingRecovery}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        
        <div className="landing-page">
        {/* Header */}
        <header className="banner">
          <BannerCarousel />
        </header>

        {/* Navigation */}
        <RouterNav
          onNavClick={logic.handleNavClick}
          cartCount={logic.cart.reduce((sum: number, item: CartItem) => sum + item.quantity, 0)}
          cartSubtotal={discountedCartSubtotal}
          selectedDates={logic.calendarDateRange}
          categories={logic.categories}
          onCategoryChange={handleCategoryChange}
          hideNavbarDropdown={true}
          useMobileBottomMenu={true}
          userName={user?.displayName || undefined}
          isLoggedIn={!!user}
          searchBarComponent={
            <SearchBar
              inflateables={logic.inflateables}
              categories={logic.categories}
              onCategorySelect={handleCategoryChange}
              onInflateableSelect={product => {
                logic.setSelectedProduct(product);
                logic.setProductOpen(true);
              }}
              focusCarousel={() => {
                if (logic.carouselRef.current) {
                  logic.carouselRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
                }
              }}
            />
          }
        />
        <CalendarSidebar
          open={logic.calendarOpen || !logic.hasValidDates}
          onClose={logic.handleCalendarClose}
          value={logic.calendarDateRange}
          onChange={logic.setCalendarDateRange}
          selectedWetDry={logic.selectedWetDry}
          onWetDryChange={(wetDry: string) => {
            // Debug log removed
            logic.setSelectedWetDry(wetDry);
            setTimeout(() => {
              // Debug log removed
              // Debug log removed
            }, 50);
          }}
        />
        {/* Options Section */}
        <section className="options-section">
          <div
            ref={logic.carouselRef}
            className="category-dropdown-container"
            style={{ marginBottom: "1rem", textAlign: "center" }}
          >
            <label htmlFor="category-dropdown" style={{ marginRight: "0.5rem" }}>
              Filter by Category:
            </label>
            <select
              id="category-dropdown"
              value={logic.selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              style={{ padding: "0.5rem", fontSize: "1rem" }}
            >
              {logic.categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <h2>SWIPE FOR MORE FUN</h2>

          <OptionsCarousel
            ref={optionsCarouselRef}
            options={logic.filteredOptions.map((opt: any) => {
              const isUnavailable = unavailableInflateables.has(opt.name);
              return {
                ...opt,
                unavailable: isUnavailable,
                onOrder: () => logic.addToCart(opt), // Order button adds directly to cart
              };
            })}
            onPurchase={logic.addToCart}
            onCardClick={logic.handleOrderNow} // Card click shows details popup
            isLandingPage={true} // Identify this as landing page
            selectedDates={logic.calendarDateRange}
          />

        </section>

        {/* Main Section */}
        <section className="main-section">
          {/* Search card hidden - SearchBar moved to navbar */}

          {/* Promo Cards */}
          <div className="promo-cards">
            {allPromoCards.map((card, idx) => (
              <button
                className="promo-card"
                key={idx}
                type="button"
                onClick={async () => {
                  if (card.isMembership) {
                    logic.setMembershipOpen(true);
                  } else if (card.promoCard) {
                    // Handle promo card activation using full configuration
                    const isAuthenticated = getAuth().currentUser !== null;
                    
                    if (!isAuthenticated) {
                      notifications.show({
                        title: 'Login Required ❌',
                        message: 'Please log in to use discount codes',
                        color: 'red',
                        autoClose: 5000,
                      });
                      return;
                    }

                    // Check if already active
                    const isCurrentlyActive = discountLogic.activePromoCard?.code === card.promoCard.code;

                    if (isCurrentlyActive) {
                      // Deactivate
                      discountLogic.setActivePromoCard(null);
                      notifications.show({
                        title: 'Discount Removed 🔓',
                        message: card.notificationMessage ? `${card.notificationMessage} has been deactivated.` : `Discount has been deactivated.`,
                        color: 'blue',
                        autoClose: 4000,
                      });
                    } else {
                      // Check if user has already used this discount
                      const hasUsed = await discountLogic.hasUserUsedDiscount(card.promoCard.code as DiscountType);
                      
                      if (hasUsed) {
                        notifications.show({
                          title: 'Cannot Use Discount ❌',
                          message: 'You have already used this discount code',
                          color: 'red',
                          autoClose: 6000,
                        });
                        return;
                      }

                      // Activate
                      discountLogic.setActivePromoCard(card.promoCard);
                      notifications.show({
                        title: card.notificationTitle || 'Discount Activated! 🎉',
                        message: card.notificationMessage || 'Discount is now active in your cart!',
                        color: 'green',
                        autoClose: 6000,
                      });
                    }
                  }
                }}
                style={{
                  // Visual feedback for active discounts
                  ...((() => {
                    if (card.isMembership) return {};
                    const isActive = card.promoCard && discountLogic.activePromoCard?.code === card.promoCard.code;
                    return isActive ? {
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      boxShadow: '0 4px 15px rgba(76, 175, 80, 0.4)',
                      transform: 'scale(1.02)',
                      border: '3px solid #2E7D32'
                    } : {};
                  })())
                }}
              >
                {card.isMembership ? (
                  <div className="promo-title">{card.title}</div>
                ) : (
                  <div className="promo-title">
                    {card.title}
                    {(() => {
                      const isActive = card.promoCard && discountLogic.activePromoCard?.code === card.promoCard.code;
                      return isActive ? <div style={{ fontSize: '0.8rem', marginTop: '5px' }}>✅ ACTIVE</div> : null;
                    })()}
                  </div>
                )}
                {card.img && <img src={card.img} alt={card.title} className="promo-img" />}
              </button>
            ))}
          </div>
        </section>

        {/* Modal for carousel */}
        <ModalCarousel
          open={logic.modalOpen}
          onClose={() => logic.setModalOpen(false)}
          options={logic.filteredOptions.map((opt: any) => ({ ...opt, onOrder: logic.handleOrderNow, ...opt }))}
          title={logic.modalType || ""}
        />
        <ProductDetailModal
          open={logic.productOpen}
          product={logic.selectedProduct ? { ...logic.selectedProduct } : null}
          onClose={() => logic.setProductOpen(false)}
          onPurchase={(product, quantity) => logic.addToCart(product, quantity)}
          getQuantityOptions={logic.getQuantityOptions}
          getAvailableQuantityForItem={logic.getAvailableQuantityForItem}
          itemAvailability={logic.itemAvailability}
          hasValidDates={!!logic.hasValidDates}
        />
        
        {/* Quantity Selection Modal for Party Essentials */}
        <QuantitySelectionModal
          open={logic.showQuantityModal}
          product={logic.quantityModalItem}
          selectedQuantity={logic.selectedQuantity}
          setSelectedQuantity={logic.setSelectedQuantity}
          availableQuantity={logic.quantityModalItem ? logic.getAvailableQuantityForItem(logic.quantityModalItem.name) : 0}
          onConfirm={logic.handleQuantityModalConfirm}
          onClose={logic.handleQuantityModalClose}
        />

        {/* Cart Sidebar - Removed: Cart button now navigates directly to checkout */}

        {/* Membership Modal */}
        {logic.membershipOpen && (
          <div className="modal-overlay fade-in" onClick={() => logic.setMembershipOpen(false)}>
            <div className="modal-shadow" />
            <div className="membership-modal" onClick={(e) => e.stopPropagation()}>
              <h2 className="membership-modal-title">Why choose a membership?</h2>
              
              <div className="membership-benefits-list">
                <div className="membership-benefit">Zero Hassle, Zero Stress – We deliver, set up, and take down every month — no planning required.</div>
                <div className="membership-benefit">Automatic Fun Day – Same day each month, guaranteed — the kids count down, and you don't lift a finger.</div>
                <div className="membership-benefit">Fresh & Exciting Every Time – A new inflatable each month keeps the excitement alive.</div>
                <div className="membership-benefit">All-Inclusive Pricing – One flat monthly rate covers delivery, setup, and cleaning.</div>
                <div className="membership-benefit">Built-In Family Memories – Create a monthly tradition your kids will remember forever.</div>
                <div className="membership-benefit">Save even more money – Get 25% off all other reservations.</div>
              </div>

              <div className="membership-cta">
                <h3>Join the Jump Club</h3>
                <p>Get our best inflatables delivered to your house.<br />
                We will bring your kids a new inflatable each month.</p>
              </div>

              <div className="membership-buttons">
                <button 
                  className="membership-btn jump-club-btn"
                  onClick={() => window.location.href = '/checkout?membership=jump-club'}
                  style={{ background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)', width: '100%', marginBottom: '1rem' }}
                >
                  Jump Club Membership<br />
                  <span className="price">$149/month</span>
                </button>
              </div>

              <button className="modal-close" onClick={() => logic.setMembershipOpen(false)}>
                ×
              </button>
            </div>
          </div>
        )}

        {/* Login Modal */}
        {showLoginModal && (
          <div className="modal-overlay fade-in" onClick={() => setShowLoginModal(false)}>
            <div className="modal-shadow" />
            <div className="login-modal" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowLoginModal(false)}>
                ×
              </button>
              <Login />
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="footer">
          <div>
            <strong>Jump CSRA Party Rental</strong>
            <br />
            410 Carolina Springs Rd.
            <br />
            North Augusta, SC. 29841
          </div>
          <div>
            <a 
              href="tel:+18032210466" 
              id="phone-link"
              title="Call us now"
              rel="noopener"
            >
              803-221-0466
            </a>
            <br />
            <a 
              href="mailto:JumpCSRA@gmail.com" 
              id="email-link"
              title="Send us an email"
            >
              JumpCSRA@gmail.com
            </a>
          </div>
          <div className="social-icons">
            <a href="https://www.instagram.com/jumpcsra/" target="_blank" rel="noopener noreferrer">
              <img src="/assets/instagram-icon.avif" alt="Instagram Logo" className="footer-icons" />
            </a>
         
            <a href="https://www.facebook.com/JUMPCSRA/" target="_blank" rel="noopener noreferrer">
              <img src="/assets/fb-icon.avif" alt="Facebook Logo" className="footer-icons" />
            </a>
          </div>
        </footer>
      </div>
      
      {/* Mobile Bottom Menu */}
      <MobileBottomMenu 
        user={user}
        selectedDates={logic.calendarDateRange}
        onCalendarClick={() => logic.handleNavClick("Calendar")}
        cartCount={logic.cart.reduce((sum: number, item: CartItem) => sum + item.quantity, 0)}
        cartSubtotal={discountedCartSubtotal}
        onCartClick={() => logic.handleNavClick("Cart")}
        onMenuClick={() => setIsProfileMenuOpen(true)}
      />
      
      <ProfileMenuSidebar
        isOpen={isProfileMenuOpen}
        onClose={() => setIsProfileMenuOpen(false)}
      />
      
      {/* Chat Widget */}
      <ChatWidget />
    </MantineProvider>
    </>
  );
}
