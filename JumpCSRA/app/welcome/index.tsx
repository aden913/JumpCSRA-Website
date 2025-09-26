import { ModalCarousel } from "../components/ModalCarousel";
import { OptionsCarousel } from "../components/OptionsCarousel";
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

import React, { useEffect, useLayoutEffect, useState, useRef, useMemo } from "react";
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
import "react-multi-carousel/lib/styles.css";
import "../styles/membership.css";
import "../styles/promo.css";
import "../styles/specials.css";
import "swiper/css";
import '@mantine/notifications/styles.css';

import { MantineProvider } from "@mantine/core";
import { useWelcomeLogic } from './useWelcomeLogic';

const promoCards = [
  { title: "Become a member", img: "/assets/cartoon-bouncehouse.png" },
  { title: "10% OFF This Saturday", img: "/assets/cartoon-bouncehouse-slide.png" },
  { title: "Free SnoK", img: "/assets/cartoon-bouncehouse-kids.png" },
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
};

function OptionCard({ name, img, onOrder }: OptionCardProps) {
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

  return (
    <div className="option-card">
      <div className="option-title marquee-container" ref={containerRef}>
        <span ref={textRef} className={isOverflow ? "marquee-text" : ""}>
          {name}
        </span>
      </div>
      <img src={img} alt={name} className="option-img" />
      <button className="order-btn" onClick={() => onOrder && onOrder(name)}>
        ORDER NOW
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
  const logic = useWelcomeLogic();

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

  
  return (
    <>
      {/* Google Maps API for Places Autocomplete */}
      <script
        src="https://maps.googleapis.com/maps/api/js?key=AIzaSyDKebl8CoMNh9pw_-GtRjiHbn2KG52m6pQ&libraries=places"
        async
        defer
      ></script>
      <MantineProvider>
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
        />
        <CalendarSidebar
          open={logic.calendarOpen || !logic.hasValidDates}
          onClose={logic.handleCalendarClose}
          value={logic.calendarDateRange}
          onChange={logic.setCalendarDateRange}
        />
        {/* Main Section */}
        <section className="main-section">
          <div className="search-promo">
            <div className="search-card">
              <h2>Find Your Fun</h2>
              <div className="search-bar">
                <SearchBar
                  inflateables={logic.inflateables}
                  categories={logic.categories}
                  onCategorySelect={logic.setSelectedCategory}
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
              </div>
            </div>
            <div className="specials-card">
              <div className="specials-img">
                <img src="/assets/kids-bg.png" alt="End of Summer Specials" />
              </div>
              <div className="specials-text">End of Summer Specials</div>
            </div>
          </div>

          {/* Promo Cards */}
          <div className="promo-cards">
            {promoCards.map((card, idx) => (
              <button
                className="promo-card"
                key={idx}
                type="button"
                onClick={() => {
                  if (card.title.includes("Become a member")) {
                    logic.setMembershipOpen(true);
                  }
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
                  </div>
                ) : (
                  <div className="promo-title">{card.title}</div>
                )}
                {card.img && <img src={card.img} alt={card.title} className="promo-img" />}
              </button>
            ))}
          </div>
        </section>

        {/* Options Section */}
        <section className="options-section">
          <h2>SWIPE FOR MORE FUN</h2>
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
              onChange={(e) => logic.setSelectedCategory(e.target.value)}
              style={{ padding: "0.5rem", fontSize: "1rem" }}
            >
              {logic.categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <OptionsCarousel
            options={logic.filteredOptions.map((opt: any) => {
              return {
                ...opt,
                onOrder: () => logic.handleOrderNow(opt)
              };
            })}
            onPurchase={logic.addToCart}
          />
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
          product={logic.selectedProduct ? (() => { console.log('ProductDetailModal category:', logic.selectedProduct.category); return { ...logic.selectedProduct }; })() : null}
          onClose={() => logic.setProductOpen(false)}
          onPurchase={logic.addToCart}
        />

        {/* Cart Sidebar */}
        <CartSidebar open={logic.cartOpen} onClose={() => logic.setCartOpen(false)} cart={logic.cart} setCart={logic.setCart} />

        {/* Membership Modal */}
        {logic.membershipOpen && (
          <div className="modal-overlay fade-in" onClick={() => logic.setMembershipOpen(false)}>
            <div className="modal-shadow" />
            <div className="modal-content popup" onClick={(e) => e.stopPropagation()}>
              <h2 className="modal-title">Membership Information</h2>
              <div style={{ textAlign: "left", maxWidth: "600px", margin: "0 auto" }}>
                <div className="membership-div">
                  <h3 id="membership-title">Jump CSRA Membership</h3>
                </div>
                <ul style={{ fontSize: "1.2rem", lineHeight: "2" }}>
                  <div className="membership-div">
                    <li>Exclusive member discounts on all rentals</li>
                    <li>Priority booking for popular dates</li>
                    <li>Free delivery within service area</li>
                    <li>Special member-only events and offers</li>
                    <li>Early access to new inflatables</li>
                  </div>
                </ul>
                <div className="membership-getstarted" style={{ marginTop: "2rem" }}>
                  <strong>Ready to join?</strong>
                  <br />
                  Call <a href="tel:803-221-0466">803-221-0466</a> or email{" "}
                  <a href="mailto:JumpCSRA@gmail.com">JumpCSRA@gmail.com</a>
                </div>
              </div>
              <button className="modal-close" onClick={() => logic.setMembershipOpen(false)}>
                Close
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
