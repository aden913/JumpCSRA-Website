import React, { useEffect, useState } from "react";
import { BannerCarousel } from "../components/BannerCarousel";
import { RouterNav } from "../components/RouterNav";
import { Link } from "react-router";
import "./index.css";

const promoCards = [
  { title: "Become a member", img: "/assets/cartoon-bouncehouse.png" },
  { title: "10% OFF This Saturday", img: "/assets/cartoon-bouncehouse-slide.png" },
  { title: "Free SnoK", img: "/assets/cartoon-bouncehouse-kids.png" },
  { title: "GOGO\nGive One Get One\nGift Card", img: "/assets/cartoon-bouncehouse-big.png" },
];

const options = [
  { name: "Castle Tower", img: "/assets/castle-tower.png" },
  { name: "Princess Tower", img: "/assets/princess-tower.png" },
  { name: "Nitro Crush", img: "/assets/nitro-crush.png" },
  { name: "Sports Court", img: "/assets/sports-court.png" },
  { name: "Adventure Island", img: "/assets/adventure-island.png" },
  { name: "Tidal Wave", img: "/assets/tidal-wave.png" },
];

export function Welcome() {
 

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
        <div className="options-cards">
          {options.map(opt => (
            <div className="option-card" key={opt.name}>
              <div className="option-title">{opt.name}</div>
                <img src={opt.img} alt={opt.name} className="option-img" />
              <button className="order-btn">ORDER NOW</button>
            </div>
          ))}
        </div>
      </section>
    
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
      </footer>
    </div>
  );
}
