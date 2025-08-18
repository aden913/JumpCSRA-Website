
import { ModalCarousel } from "../components/ModalCarousel";
import { OptionsCarousel } from "../components/OptionsCarousel";

import React, { useEffect, useLayoutEffect, useState, useRef } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import { BannerCarousel } from "../components/BannerCarousel";
import { RouterNav } from "../components/RouterNav";
import { Link } from "react-router";

import "./index.css";
import "react-multi-carousel/lib/styles.css";
import "../styles/modal.css";
import "../styles/membership.css";

const promoCards = [
  { title: "Become a member", img: "/assets/cartoon-bouncehouse.png" },
  { title: "10% OFF This Saturday", img: "/assets/cartoon-bouncehouse-slide.png" },
  { title: "Free SnoK", img: "/assets/cartoon-bouncehouse-kids.png" },
  { title: "GOGO Give One Get One Gift Card", img: "/assets/cartoon-bouncehouse-big.png" },
];

// import inflateableDescriptions from "../public/assets/inflateable-descriptions.json";


const options = [
  { name: "Castle Tower", img: "/assets/inflateables/castle-tower.png", category: ["bounce"] },
  { name: "Princess Tower", img: "/assets/inflateables/princess-tower.png", category: ["bounce"] },
  { name: "Nitro Crush", img: "/assets/inflateables/nitro-crush.png", category: ["obstacle"] },
  { name: "Sports Court", img: "/assets/inflateables/sports-court.png", category: ["bounce", "game"] },
  { name: "Adventure Island", img: "/assets/inflateables/adventure-island.png", category: ["bounce"] },
  { name: "Tidal Wave", img: "/assets/inflateables/tidal-wave.png", category: ["obstacle", "water"] },
  { name: "5 Player Wrecking Ball", img: "/assets/inflateables/5-player-wrecking-ball.png", category: ["game"] },
  { name: "Adrenaline Rush Obstacle Course", img: "/assets/inflateables/adrenaline-rush-obstacle-course.png", category: ["obstacle"] },
  { name: "Basketball Double Jump Shot", img: "/assets/inflateables/basketball-double-jump-shot.png", category: ["game"] },
  { name: "Beach Blast", img: "/assets/inflateables/beach-blast.png", category: ["water"] },
  { name: "Beer Pong", img: "/assets/inflateables/beer-pong.png", category: ["game"] },
  { name: "Chairs", img: "/assets/inflateables/chair.png", category: ["none"] },
  { name: "Color Chaos", img: "/assets/inflateables/color-chaos.png", category: ["water"] },
  { name: "Color Splash Castle", img: "/assets/inflateables/color-splash-castle.png", category: ["water"] },
  { name: "Cotton Candy Castle", img: "/assets/inflateables/cotton-candy-castle.png", category: ["bounce"] },
  { name: "Custom Theme", img: "/assets/inflateables/custom-theme.png", category: ["bounce"] },
  { name: "Fire and Ice", img: "/assets/inflateables/fire-and-ice.png", category: ["water"] },
  { name: "Fun in the Sun", img: "/assets/inflateables/fun-in-the-sun.png", category: ["water"] },
  { name: "Gladiator Joust", img: "/assets/inflateables/gladiator-joust.png", category: ["game"] },
  { name: "H2O Slip and Slide", img: "/assets/inflateables/h2o-slip-and-slide.png", category: ["water"] },
  { name: "Hang Time", img: "/assets/inflateables/hang-time.png", category: ["water"] },
  { name: "High Time To Party", img: "/assets/inflateables/high-time-to-party.png", category: ["water"] },
  { name: "High Velocity", img: "/assets/inflateables/high-velocity.png", category: ["obstacle"] },
  { name: "Home Run Challenge", img: "/assets/inflateables/home-run-challenge.png", category: ["game"] },
  { name: "Mega Rush", img: "/assets/inflateables/mega-rush.png", category: ["obstacle"] },
  { name: "Party With the Stars", img: "/assets/inflateables/party-with-the-stars.png", category: ["bounce"] },
  { name: "Princess Palace", img: "/assets/inflateables/princess-palace.png", category: ["bounce"] },
  { name: "SpongeBob", img: "/assets/inflateables/spongebob.png", category: ["bounce"] },
  { name: "Tables", img: "/assets/inflateables/white-table.png", category: ["none"] },
  { name: "Tunnel Tower", img: "/assets/inflateables/tunnel-tower.png", category: ["bounce"] },
  { name: "Turbo Splash", img: "/assets/inflateables/turbo-splash.png", category: ["water"] },
  { name: "Twinkle Palace", img: "/assets/inflateables/twinkle-palace.png", category: ["bounce"] },
  { name: "Wave Rider", img: "/assets/inflateables/wave-rider.png", category: ["water"] },
  { name: "Yard Letters", img: "/assets/inflateables/yard-letters.png", category: ["none"] },
];


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
  const [descriptions, setDescriptions] = useState<any[]>([]);

  useEffect(() => {
    fetch('/assets/inflateable-descriptions.json')
      .then(res => res.json())
      .then(data => setDescriptions(data));
  }, []);

  function handleNavClick(type: string) {
    setModalType(type);
    setModalOpen(true);
  }

  // Filtering logic for modal carousel
  const filteredOptions = options.filter(opt => {
    if (!modalType) return true;
    if (modalType === "Bounce House") return opt.category.includes("bounce");
    if (modalType === "Water Slide") return opt.category.includes("water");
    if (modalType === "Obstacle Course") return opt.category.includes("obstacle");
    if (modalType === "Games") return opt.category.includes("game");
    return true;
  });

  // Get product details from JSON
  const productDetails = selectedProduct
    ? descriptions.find(p => p.name === selectedProduct)
    : null;

  // Get detail images for selected product
  const getDetailImages = (name: string) => {
    // Convert name to folder name (replace spaces, handle casing)
    const folder = name.replace(/ /g, '-').replace(/[^a-zA-Z0-9\-]/g, '').toLowerCase();
    // Example: /assets/inflateables/detail-images/Castle Tower/castle-tower-1.png
    // We'll use the original name for folder lookup, fallback to lower-case
    // For now, try up to 5 images
    const basePath = `/assets/inflateables/detail-images/${name}/`;
    return [1,2,3,4,5].map(i => `${basePath}${folder}-${i}.png`);
  };

  const handleOrderNow = (name: string) => {
    setSelectedProduct(name);
    setProductOpen(true);
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
            <div className="promo-card" key={idx}>
              {card.title.includes("Become a member") ? (
                <button
                  type="button"
                  className="promo-title"
                  style={{ background: "none", border: "none", color: "inherit", width: "100%", display: "block", cursor: "pointer", font: "inherit", padding: 0 }}
                  onClick={() => setMembershipOpen(true)}
                >
                  {card.title}
                </button>
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
            </div>
          ))}
        </div>
      </section>
      {/* Options Section */}
      <section className="options-section">
        <h2>See all the options</h2>
  <OptionsCarousel options={options.map(opt => ({ ...opt, onOrder: handleOrderNow }))} />
      </section>
      {/* Modal for filtered carousel */}
      <ModalCarousel
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        options={filteredOptions}
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
                  <img src={options.find(o => o.name === selectedProduct)?.img} alt={selectedProduct} style={{width: "100%", borderRadius: "16px"}} />
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
                    Price: ${productDetails.price}
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