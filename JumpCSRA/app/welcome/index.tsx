import { ModalCarousel } from "../components/ModalCarousel";
import { OptionsCarousel, OptionsCarouselRef } from "../components/OptionsCarousel";
import { ProductDetailModal } from "../components/ProductDetailModal";
import { CalendarSidebar } from "../components/CalendarSidebar";
import { Notifications } from '@mantine/notifications';
import { notifications } from '@mantine/notifications';
import { useInflateables } from '../hooks/useInflateables';
import { useCartSidebar } from '../hooks/useCartSidebar';
import { useCalendarSidebar } from '../hooks/useCalendarSidebar';
import { useCategories } from '../hooks/useCategories';
import { useProductDetails } from '../hooks/useProductDetails';
import { useCart } from '../hooks/useCart';
import { useDiscounts, getPromoCardDiscount, getDiscountDescription } from '../hooks/useDiscounts';

import React, { useEffect, useLayoutEffect, useState, useRef, useMemo } from "react";
import { useSearchParams } from "react-router";
import { getDatabase, ref, onValue } from "firebase/database";
import { firebaseConfig } from "../components/FirebaseConfig";
import { initializeApp, getApps } from "firebase/app";
import { Swiper, SwiperSlide } from "swiper/react";
import { BannerCarousel } from "../components/BannerCarousel";
import { SearchBar } from "../components/SearchBar";
import { RouterNav } from "../components/RouterNav";
import { CartSidebar } from "../components/CartSidebar";
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

import { MantineProvider } from "@mantine/core";
import { useWelcomeLogic } from './useWelcomeLogic';
import { getUnavailableInflateables } from '../utils/bookingUtils';
import { ViewportDebugger } from '../components/ViewportDebugger';
import { DevModeToggle } from '../components/DevModeToggle';
import { LocalStorageDebugger } from '../components/LocalStorageDebugger';

const promoCards = [
  { title: "Become a member", img: "/assets/cartoon-bouncehouse.png" },
  { title: "10% OFF Sunday", img: "/assets/cartoon-bouncehouse-slide.png" },
  { title: "Free Game Upgrade", img: "/assets/cartoon-bouncehouse-kids.png" },
  { title: "GOGO Give One Get One Gift Card", img: "/assets/cartoon-bouncehouse-big.png" },
];

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
        {unavailable ? "UNAVAILABLE" : "ORDER NOW"}
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
export function getDetailImages(name: string) {
  const folder = name.replace(/ /g, "-").replace(/[^a-zA-Z0-9\-]/g, "").toLowerCase();
  const basePath = `/assets/inflateables/detail-images/${name}/`;
  return [1, 2, 3, 4, 5].map((i) => `${basePath}${folder}-${i}.png`);
}

export function Welcome() {
  const optionsCarouselRef = useRef<OptionsCarouselRef>(null);
  const logic = useWelcomeLogic();
  const discountLogic = useDiscounts();

  const [unavailableInflateables, setUnavailableInflateables] = useState<Set<string>>(new Set());

  // Wrapper function to handle category change and reset carousel
  const handleCategoryChange = (category: string) => {
    logic.setSelectedCategory(category);
    // Reset carousel to beginning after a short delay to allow re-render
    setTimeout(() => {
      optionsCarouselRef.current?.resetToBeginning();
    }, 100);
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
      {/* Google Maps API for Places Autocomplete */}
      <script
        src="https://maps.googleapis.com/maps/api/js?key=AIzaSyDKebl8CoMNh9pw_-GtRjiHbn2KG52m6pQ&libraries=places"
        async
        defer
      ></script>
      <MantineProvider>
        <ViewportDebugger />
        <DevModeToggle />
        <LocalStorageDebugger />
        <Notifications position="top-right" />
        <div className="landing-page">
        {/* Header */}
        <header className="banner">
          <BannerCarousel />
        </header>

        {/* Navigation */}
        <RouterNav
          onNavClick={logic.handleNavClick}
          cartCount={logic.cart.reduce((sum: number, item: CartItem) => sum + item.quantity, 0)}
          selectedDates={logic.calendarDateRange}
          categories={logic.categories}
          onCategoryChange={handleCategoryChange}
          hideNavbarDropdown={true}
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
        />
        {/* Main Section */}
        <section className="main-section">
          {/* Search card hidden - SearchBar moved to navbar */}

          {/* Promo Cards */}
          <div className="promo-cards">
            {promoCards.map((card, idx) => (
              <button
                className="promo-card"
                key={idx}
                type="button"
                onClick={async () => {
                  if (card.title.includes("Become a member")) {
                    logic.setMembershipOpen(true);
                  } else {
                    // Handle discount promo cards
                    const discountType = getPromoCardDiscount(card.title);
                    if (discountType) {
                      const result = await discountLogic.toggleDiscount(discountType);
                      
                      if (result.success) {
                        if (result.wasActive) {
                          notifications.show({
                            title: 'Discount Removed 🔓',
                            message: `${getDiscountDescription(discountType)} has been deactivated.`,
                            color: 'blue',
                            autoClose: 4000,
                          });
                        } else {
                          notifications.show({
                            title: 'Discount Activated! 🎉',
                            message: `${getDiscountDescription(discountType)} is now active in your cart!`,
                            color: 'green',
                            autoClose: 6000,
                          });
                        }
                      } else {
                        // Show error notification
                        notifications.show({
                          title: 'Cannot Use Discount ❌',
                          message: result.error || 'Unable to apply discount',
                          color: 'red',
                          autoClose: 6000,
                        });
                      }
                    }
                  }
                }}
                style={{
                  // Visual feedback for active discounts
                  ...((() => {
                    const discountType = getPromoCardDiscount(card.title);
                    const isActive = discountType && discountLogic.discounts[discountType];
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
                {card.title.includes("Become a member") ? (
                  <div className="promo-title">{card.title}</div>
                ) : card.title.includes("Give One Get One") ? (
                  <div className="promo-title">
                    GOGO
                    <br />
                    <span className="promo-subtext">Give One Get One</span>
                    <br />
                    Gift Card
                    {(() => {
                      const isActive = discountLogic.discounts.bogoGiftCard;
                      return isActive ? <div style={{ fontSize: '0.8rem', marginTop: '5px' }}>✅ ACTIVE</div> : null;
                    })()}
                  </div>
                ) : (
                  <div className="promo-title">
                    {card.title}
                    {(() => {
                      const discountType = getPromoCardDiscount(card.title);
                      const isActive = discountType && discountLogic.discounts[discountType];
                      return isActive ? <div style={{ fontSize: '0.8rem', marginTop: '5px' }}>✅ ACTIVE</div> : null;
                    })()}
                  </div>
                )}
                {card.img && <img src={card.img} alt={card.title} className="promo-img" />}
              </button>
            ))}
          </div>
        </section>

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
                onOrder: () => logic.handleOrderNow(opt)
              };
            })}
            onPurchase={logic.addToCart}
          />
          
          {/* Specials Card */}
          <div className="specials-card">
            <div className="specials-img">
              <img src="/assets/kids-bg.png" alt="End of Summer Specials" />
            </div>
            <div className="specials-text">End of Summer Specials</div>
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
          onPurchase={logic.addToCart}
        />

        {/* Cart Sidebar */}
        <CartSidebar 
          open={logic.cartOpen} 
          onClose={() => logic.setCartOpen(false)} 
          cart={logic.cart} 
          setCart={logic.setCart}
          calendarDateRange={logic.calendarDateRange}
          discountLogic={discountLogic}
          cartSettings={logic.cartSettings}
        />

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
                <h3>Become a Member</h3>
                <p>Get our best inflatables delivered to your house.<br />
                We will bring your kids a new inflatable each month.</p>
              </div>

              <div className="membership-buttons">
                <button 
                  className="membership-btn weekday-btn"
                  onClick={() => logic.addMembershipToCart('weekday')}
                >
                  Weekday Membership<br />
                  <span className="price">$199/month</span>
                </button>
                <button 
                  className="membership-btn weekend-btn"
                  onClick={() => logic.addMembershipToCart('weekend')}
                >
                  Weekend Membership<br />
                  <span className="price">$249/month</span>
                </button>
              </div>

              <button className="modal-close" onClick={() => logic.setMembershipOpen(false)}>
                ×
              </button>
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
            803-221-0466
            <br />
            JumpCSRA@gmail.com
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
    </MantineProvider>
    </>
  );
}
