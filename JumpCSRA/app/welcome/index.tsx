
import { ModalCarousel } from "../components/ModalCarousel";
import OptionsCarousel from "../components/OptionsCarousel";

import React, { useEffect, useLayoutEffect, useState, useRef } from "react";
import { getDatabase, ref, query, orderByChild, equalTo, onValue } from "firebase/database";
import { initializeApp } from "firebase/app";
import { firebaseConfig } from "../components/FirebaseConfig";
import { Swiper, SwiperSlide } from "swiper/react";
import { BannerCarousel } from "../components/BannerCarousel";
import { RouterNav } from "../components/RouterNav";
import { Link } from "react-router";

import "./index.css";
import "react-multi-carousel/lib/styles.css";
import "../styles/membership.css";
import "swiper/css";

const promoCards = [
  { title: "Become a member", img: "/assets/cartoon-bouncehouse.png" },
  { title: "10% OFF This Saturday", img: "/assets/cartoon-bouncehouse-slide.png" },
  { title: "Free SnoK", img: "/assets/cartoon-bouncehouse-kids.png" },
  { title: "GOGO Give One Get One Gift Card", img: "/assets/cartoon-bouncehouse-big.png" },
];

// import inflateableDescriptions from "../public/assets/inflateable-descriptions.json";


// Use inflateables from database
type Inflateable = {
  name: string;
  img: string;
  weekdayPrice?: number;
  weekendPrice?: number;
  weekdayWaterPrice?: number;
  weekendWaterPrice?: number;
  description?: string;
  dimensions?: string;
  wet?: boolean;
  dry?: boolean;
  category: string;
};


type OptionCardProps = {
  name: string;
  img: string;
  category: string[];
};

function OptionCard({ name, img, onOrder }: OptionCardProps & { onOrder?: (name: string) => void }) {
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
    window.addEventListener('resize', checkOverflow);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', checkOverflow);
    };
  }, [name]);

  return (
    <div className="option-card">
      <div className="option-title marquee-container" ref={containerRef}>
        <span
          ref={textRef}
          className={isOverflow ? "marquee-text" : ""}
        >
          {name}
        </span>
      </div>
      <img src={img} alt={name} className="option-img" />
      <button className="order-btn" onClick={() => onOrder && onOrder(name)}>ORDER NOW</button>
    </div>
  );
}

export function Welcome() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<string | null>(null);
  const [membershipOpen, setMembershipOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [inflateables, setInflateables] = useState<Inflateable[]>([]);
  const [filteredOptions, setFilteredOptions] = useState<Inflateable[]>([]);

  useEffect(() => {
    console.log('[Welcome] Fetching all inflateables from local JSON...');
    fetch('/assets/inflateables-firebase.json')
      .then(res => res.json())
      .then(data => {
        console.log('[Welcome] All inflateables loaded:', data.inflateables);
        setInflateables(data.inflateables || []);
      });
  }, []);

  function handleNavClick(type: string) {
    console.log(`[Welcome] Nav clicked: ${type}`);
    setModalType(type);
    setModalOpen(true);
    // Fetch from Firebase by category
    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app);
    let categoryKey = "";
    if (type === "Bounce House") categoryKey = "bounce-house";
    else if (type === "Water Slide") categoryKey = "slide";
    else if (type === "Obstacle Course") categoryKey = "obstacle";
    else if (type === "Games") categoryKey = "game";
    else if (type === "Party Essentials") categoryKey = "party-essentials";
    console.log(`[Welcome] Category key for query: ${categoryKey}`);
    if (categoryKey) {
      const inflateablesRef = ref(db, "inflateables");
      const q = query(inflateablesRef, orderByChild("category"), equalTo(categoryKey));
      console.log('[Welcome] Running Firebase query for category:', categoryKey);
      onValue(q, (snapshot) => {
        const data = snapshot.val();
        console.log('[Welcome] Firebase query result:', data);
        if (Array.isArray(data)) {
          setFilteredOptions(data);
          console.log('[Welcome] Set filteredOptions (array):', data);
        } else if (typeof data === "object" && data !== null) {
          setFilteredOptions(Object.values(data));
          console.log('[Welcome] Set filteredOptions (object values):', Object.values(data));
        } else {
          setFilteredOptions([]);
          console.log('[Welcome] No results, set filteredOptions to empty array');
        }
      });
    } else {
      setFilteredOptions([]);
      console.log('[Welcome] No categoryKey, set filteredOptions to empty array');
    }
  }

  // filteredOptions now comes from database query above

  const handleOrderNow = (product: Inflateable) => {
    setSelectedProduct(product.name);
    setProductOpen(true);
  };

  // Get product details from inflateables
  const productDetails = selectedProduct
    ? inflateables.find(p => p.name === selectedProduct)
    : null;

  // Get detail images for selected product
  const getDetailImages = (name: string) => {
    const folder = name.replace(/ /g, '-').replace(/[^a-zA-Z0-9\-]/g, '').toLowerCase();
    const basePath = `/assets/inflateables/detail-images/${name}/`;
    return [1,2,3,4,5].map(i => `${basePath}${folder}-${i}.png`);
  };

  return (
    <div className="landing-page">
      {/* Header - Carousel */}
      <header className="banner">
        <BannerCarousel />
      </header>
  {/* Navigation - RouterNav */}
  <RouterNav onNavClick={handleNavClick} />
      {/* Main Section */}
      <section className="main-section">
        <div className="search-promo">
          <div className="search-card">
            <h2>Find your fun</h2>
            <div className="search-bar">
              <input type="text" placeholder="Search..." />
            </div>
          </div>
          <div className="specials-card">
            <div className="specials-img"><img src="/assets/kids-bg.png" alt="End of Summer Specials" /></div>
            <div className="specials-text">End of Summer Specials</div>
          </div>
        </div>
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
                // Add other card click logic here as needed
              }}
            >
              {card.title.includes("Become a member") ? (
                <div className="promo-title">{card.title}</div>
              ) : card.title.includes("Give One Get One") ? (
                <div className="promo-title">
                  GOGO<br />
                  <span className="promo-subtext">Give One Get One</span><br />
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
  <OptionsCarousel options={inflateables.map(opt => ({ ...opt, onOrder: () => handleOrderNow(opt) }))} />
      </section>
      {/* Modal for filtered carousel */}
      <ModalCarousel
        open={modalOpen}
        onClose={() => setModalOpen(false)}
  options={filteredOptions.map(opt => ({ ...opt, onOrder: () => handleOrderNow(opt) }))}
        title={modalType || ""}
      />
  {/* Membership Info Popup */}
      {/* Product Detail Popup */}
      {productOpen && selectedProduct && (
        <div className="modal-overlay fade-in" onClick={() => setProductOpen(false)}>
          <div className="modal-shadow" />
          <div className="modal-content popup" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{selectedProduct}</h2>
            <div style={{display: "flex", flexDirection: "column", alignItems: "center"}}>
              {/* Image carousel */}
              <Swiper style={{width: "100%", maxWidth: "500px", marginBottom: "1.5rem"}}>
                {/* Main image first */}
                <SwiperSlide>
                  <img src={productDetails?.img} alt={selectedProduct} style={{width: "100%", borderRadius: "16px"}} />
                </SwiperSlide>
                {/* Detail images */}
                {getDetailImages(selectedProduct).map((src, idx) => (
                  <SwiperSlide key={src}>
                    <img src={src} alt={`${selectedProduct} detail ${idx+1}`} style={{width: "100%", borderRadius: "16px"}} />
                  </SwiperSlide>
                ))}
              </Swiper>
              {/* Product info */}
              {productDetails && (
                <div style={{textAlign: "left", maxWidth: "500px", width: "100%"}}>
                  <div style={{fontSize: "1.3rem", fontWeight: "bold", marginBottom: "0.5rem"}}>
                    {/* Show all price types if available */}
                    {productDetails.weekdayPrice && (
                      <div>Weekday Price: ${productDetails.weekdayPrice}</div>
                    )}
                    {productDetails.weekendPrice && (
                      <div>Weekend Price: ${productDetails.weekendPrice}</div>
                    )}
                    {productDetails.weekdayWaterPrice && (
                      <div>Weekday Water Price: ${productDetails.weekdayWaterPrice}</div>
                    )}
                    {productDetails.weekendWaterPrice && (
                      <div>Weekend Water Price: ${productDetails.weekendWaterPrice}</div>
                    )}
                  </div>
                  <div style={{fontSize: "1.1rem", marginBottom: "1rem"}}>
                    {productDetails.description || "No description yet."}
                  </div>
                </div>
              )}
            </div>
            <button className="modal-close" onClick={() => setProductOpen(false)}>Close</button>
          </div>
        </div>
      )}
      {membershipOpen && (
        <div className="modal-overlay fade-in" onClick={() => setMembershipOpen(false)}>
          <div className="modal-shadow" />
          <div className="modal-content popup" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Membership Information</h2>
            <div style={{textAlign: "left", maxWidth: "600px", margin: "0 auto"}}>
              <div className="membership-div">
              <h3 id="membership-title">Jump CSRA Membership</h3>
              </div>
              <ul style={{fontSize: "1.2rem", lineHeight: "2"}}>
                <div className="membership-div">
                <li>Exclusive member discounts on all rentals</li>
                <li>Priority booking for popular dates</li>
                <li>Free delivery within service area</li>
                <li>Special member-only events and offers</li>
                <li>Early access to new inflatables</li>
                </div>
              </ul>
              <div className="membership-getstarted" style={{marginTop: "2rem"}}>
                <strong>Ready to join?</strong><br />
                Call <a href="tel:803-221-0466">803-221-0466</a> or email <a href="mailto:JumpCSRA@gmail.com">JumpCSRA@gmail.com</a>
              </div>
            </div>
            <button className="modal-close" onClick={() => setMembershipOpen(false)}>Close</button>
          </div>
        </div>
      )}
      {/* Footer */}
      <footer className="footer">
        <div>
          <strong>Jump CSRA Party Rental</strong><br />
          410 Carolina Springs Rd.<br />
          North Augusta, SC. 29841
        </div>
        <div>
          803-221-0466<br />
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