import { ModalCarousel } from "../components/ModalCarousel";
import { OptionsCarousel } from "../components/OptionsCarousel";
import { ProductDetailModal } from "../components/ProductDetailModal";

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

import "./index.css";
import "react-multi-carousel/lib/styles.css";
import "../styles/membership.css";
import "swiper/css";
import "../styles/cart.css";

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

export function Welcome() {
  // Modal & product states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<string | null>(null);
  const [membershipOpen, setMembershipOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Cart state
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      const saved = window.localStorage.getItem("cart");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  // Firebase data
  const [inflateables, setInflateables] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  useEffect(() => {
    // Initialize Firebase once
    if (!getApps().length) {
      initializeApp(firebaseConfig);
    }
    const db = getDatabase();
    const inflateablesRef = ref(db, "inflateables");
    onValue(inflateablesRef, (snapshot) => {
      const val = snapshot.val();
      if (Array.isArray(val)) {
        setInflateables(val);
      } else if (val && typeof val === "object") {
        setInflateables(Object.values(val));
      } else {
        setInflateables([]);
      }
    });
  }, []);

  function handleNavClick(type: string) {
    console.log("handleNavClick called with type:", type);
    if (type === "Cart") {
      setCartOpen(true);
      console.log("Cart sidebar should open, cartOpen:", true);
      return;
    }
    setModalType(type);
    setModalOpen(true);
  }

  // Unique categories
  const categories = useMemo(() => {
    const catSet = new Set<string>();
    inflateables.forEach((item) => {
      if (Array.isArray(item.category)) {
        item.category.forEach((cat: string) => catSet.add(cat));
      } else if (typeof item.category === "string") {
        catSet.add(item.category);
      }
    });
    return ["All", ...Array.from(catSet)];
  }, [inflateables]);

  // Filter options (case-insensitive)
  const filteredOptions = useMemo(() => {
    if (selectedCategory.toLowerCase() === "all") {
      return inflateables;
    }
    return inflateables.filter((item) =>
      Array.isArray(item.category)
        ? item.category.some((cat: string) => cat.toLowerCase() === selectedCategory.toLowerCase())
        : item.category?.toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [inflateables, selectedCategory]);

  // If selectedProduct is an object, use it directly; if string, find in inflateables
  const productDetails = selectedProduct
    ? typeof selectedProduct === "object"
      ? selectedProduct
      : inflateables.find((p: any) => (p.name || "").trim().toLowerCase() === selectedProduct.trim().toLowerCase()) || null
    : null;

  const getDetailImages = (name: string) => {
    const folder = name.replace(/ /g, "-").replace(/[^a-zA-Z0-9\-]/g, "").toLowerCase();
    const basePath = `/assets/inflateables/detail-images/${name}/`;
    return [1, 2, 3, 4, 5].map((i) => `${basePath}${folder}-${i}.png`);
  };

  const handleOrderNow = (product: any) => {
    setSelectedProduct(product);
    setProductOpen(true);
  };

  // Add to cart function
  const addToCart = (product: any) => {
    const wetDry = product.wet && product.dry ? "Wet/Dry" : product.wet ? "Wet" : "Dry";
    const price = typeof product.weekdayPrice === "number" ? product.weekdayPrice : 0; // Placeholder, update later
    const existing = cart.find(item => item.name === product.name && item.wetDry === wetDry);
    let newCart;
    if (existing) {
      newCart = cart.map(item =>
        item.name === product.name && item.wetDry === wetDry
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      newCart = [...cart, { name: product.name, price, wetDry, quantity: 1 }];
    }
    setCart(newCart);
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("cart", JSON.stringify(newCart));
    }
  };

  return (
    <div className="landing-page">
      {/* Header */}
      <header className="banner">
        <BannerCarousel />
      </header>

      {/* Navigation */}
  <RouterNav onNavClick={handleNavClick} cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)} />

      {/* Main Section */}
      <section className="main-section">
        <div className="search-promo">
          <div className="search-card">
            <h2>Find Your Fun</h2>
            <div className="search-bar">
              <SearchBar
                inflateables={inflateables}
                categories={categories}
                onCategorySelect={category => setSelectedCategory(category)}
                onInflateableSelect={product => {
                  setSelectedProduct(product);
                  setProductOpen(true);
                }}
                focusCarousel={() => {
                  if (carouselRef.current) {
                    carouselRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
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
                  setMembershipOpen(true);
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
          ref={carouselRef}
          className="category-dropdown-container"
          style={{ marginBottom: "1rem", textAlign: "center" }}
        >
          <label htmlFor="category-dropdown" style={{ marginRight: "0.5rem" }}>
            Filter by Category:
          </label>
          <select
            id="category-dropdown"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ padding: "0.5rem", fontSize: "1rem" }}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <OptionsCarousel
          options={filteredOptions.map((opt) => ({
            ...opt,
            onOrder: () => handleOrderNow(opt)
          }))}
        />
      </section>

      {/* Modal for carousel */}
      <ModalCarousel
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        options={filteredOptions.map((opt) => ({ ...opt, onOrder: handleOrderNow }))}
        title={modalType || ""}
      />

  <ProductDetailModal open={productOpen} product={selectedProduct} onClose={() => setProductOpen(false)} />

  {/* Cart Sidebar */}
  <CartSidebar open={cartOpen} onClose={() => setCartOpen(false)} cart={cart} setCart={setCart} />

      {/* Membership Modal */}
      {membershipOpen && (
        <div className="modal-overlay fade-in" onClick={() => setMembershipOpen(false)}>
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
            <button className="modal-close" onClick={() => setMembershipOpen(false)}>
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
        <div>
          <a href="https://www.instagram.com/jumpcsra/" target="_blank" rel="noopener noreferrer">
            <img src="/assets/instagram-icon.avif" alt="Instagram Logo" className="footer-icons" />
          </a>
        </div>
        <div>
          <a href="https://www.facebook.com/JUMPCSRA/" target="_blank" rel="noopener noreferrer">
            <img src="/assets/fb-icon.avif" alt="Facebook Logo" className="footer-icons" />
          </a>
        </div>
      </footer>
    </div>
  );
}
