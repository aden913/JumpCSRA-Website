
import { ModalCarousel } from "../components/ModalCarousel";
import { OptionsCarousel } from "../components/OptionsCarousel";

import React, { useEffect, useLayoutEffect, useState, useRef } from "react";
import { BannerCarousel } from "../components/BannerCarousel";
import { RouterNav } from "../components/RouterNav";
import { Link } from "react-router";

import "./index.css";
import "react-multi-carousel/lib/styles.css";


const promoCards = [
  { title: "Become a member", img: "/assets/cartoon-bouncehouse.png" },
  { title: "10% OFF This Saturday", img: "/assets/cartoon-bouncehouse-slide.png" },
  { title: "Free SnoK", img: "/assets/cartoon-bouncehouse-kids.png" },
  { title: "GOGO Give One Get One Gift Card", img: "/assets/cartoon-bouncehouse-big.png" },
];

const options = [
  { name: "Castle Tower", img: "/assets/inflateables/castle-tower.png" },
  { name: "Princess Tower", img: "/assets/inflateables/princess-tower.png" },
  { name: "Nitro Crush", img: "/assets/inflateables/nitro-crush.png" },
  { name: "Sports Court", img: "/assets/inflateables/sports-court.png" },
  { name: "Adventure Island", img: "/assets/inflateables/adventure-island.png" },
  { name: "Tidal Wave", img: "/assets/inflateables/tidal-wave.png" },
  { name: "5 Player Wrecking Ball", img: "/assets/inflateables/5-player-wrecking-ball.png" },
  { name: "Adrenaline Rush Obstacle Course", img: "/assets/inflateables/adrenaline-rush-obstacle-course.png" },
  { name: "Basketball Double Jump Shot", img: "/assets/inflateables/basketball-double-jump-shot.png" },
  { name: "Beach Blast", img: "/assets/inflateables/beach-blast.png" },
  { name: "Beer Pong", img: "/assets/inflateables/beer-pong.png" },
  { name: "Chairs", img: "/assets/inflateables/chair.png" },
  { name: "Color Chaos", img: "/assets/inflateables/color-chaos.png" },
  { name: "Color Splash Castle", img: "/assets/inflateables/color-splash-castle.png" },
  { name: "Cotton Candy Castle", img: "/assets/inflateables/cotton-candy-castle.png" },
  { name: "Custom Theme", img: "/assets/inflateables/custom-theme.png" },
  { name: "Fire and Ice", img: "/assets/inflateables/fire-and-ice.png" },
  { name: "Fun in the Sun", img: "/assets/inflateables/fun-in-the-sun.png" },
  { name: "Gladiator Joust", img: "/assets/inflateables/gladiator-joust.png" },
  { name: "H2O Slip and Slide", img: "/assets/inflateables/h2o-slip-and-slide.png" },
  { name: "Hang Time", img: "/assets/inflateables/hang-time.png" },
  { name: "High Time To Party", img: "/assets/inflateables/high-time-to-party.png" },
  { name: "High Velocity", img: "/assets/inflateables/high-velocity.png" },
  { name: "Home Run Challenge", img: "/assets/inflateables/home-run-challenge.png" },
  { name: "Mega Rush", img: "/assets/inflateables/mega-rush.png" },
  { name: "Party With the Stars", img: "/assets/inflateables/party-with-the-stars.png" },
  { name: "Princess Palace", img: "/assets/inflateables/princess-palace.png" },
  { name: "SpongeBob", img: "/assets/inflateables/spongebob.png" },
  { name: "Tables", img: "/assets/inflateables/white-table.png" },
  { name: "Tunnel Tower", img: "/assets/inflateables/tunnel-tower.png" },
  { name: "Turbo Splash", img: "/assets/inflateables/turbo-splash.png" },
  { name: "Twinkle Palace", img: "/assets/inflateables/twinkle-palace.png" },
  { name: "Wave Rider", img: "/assets/inflateables/wave-rider.png" },
  { name: "Yard Letters", img: "/assets/inflateables/yard-letters.png" },

];

type OptionCardProps = {
  name: string;
  img: string;
};

function OptionCard({ name, img }: OptionCardProps) {
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
  // Use requestAnimationFrame for more reliable measurement
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
      <button className="order-btn">ORDER NOW</button>
    </div>
  );
}

export function Welcome() {
  // const [modalOpen, setModalOpen] = useState(false);
  // const [modalType, setModalType] = useState<string | null>(null);

  // function handleNavClick(type: string) {
  //   setModalType(type);
  //   setModalOpen(true);
  // }

  // // Example filtering logic by type
  // const filteredOptions = options.filter(opt => {
  //   if (modalType === "Bounce House") return opt.name.toLowerCase().includes("bounce");
  //   if (modalType === "Water Slide") return opt.name.toLowerCase().includes("slide");
  //   if (modalType === "Obstacle Course") return opt.name.toLowerCase().includes("obstacle");
  //   if (modalType === "Games") return opt.name.toLowerCase().includes("game");
  //   return true;
  // });

  return (
    <div className="landing-page">
      {/* Header - Carousel */}
      <header className="banner">
        <BannerCarousel />
      </header>
      {/* Navigation - RouterNav */}
  <RouterNav />
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
                <Link to="/membership" style={{ textDecoration: "none", color: "inherit", width: "100%", display: "block" }}>
                  <div className="promo-title">{card.title}</div>
                </Link>
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
        <OptionsCarousel options={options} />
      </section>
      {/*
      <ModalCarousel
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        options={filteredOptions}
        title={modalType || ""}
      />
      */}
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