import React from "react";
import "../welcome/index.css";
import { RouterNav } from "../components/RouterNav";
import { BannerCarousel } from "../components/BannerCarousel";
export function Membership() {
  return (
    <div className="landing-page">
      <header className="banner">
             <BannerCarousel />
           </header>
      <nav className="nav-bar">
        <ul>
          <li>Bounce House</li>
          <li>Water Slide</li>
          <li>Obstacle Course</li>
          <li>Games</li>
        </ul>
      </nav>

      <section className="membership-main">
       
          <div className="membership-card">
            <span id="membership-title">Become a member</span>
            <span className="right" id="membership-title">Save money Get more fun</span>
          </div>
        <div className="membership-benefits">
          <h2>Why choose a membership?</h2>
          <ul>
            <li><strong>Zero Hassle, Zero Stress</strong> – We deliver, set up, and take down every month — no planning required.</li>
            <li><strong>Automatic Fun Day</strong> – Same day each month, guaranteed — the kids count down, and you don’t lift a finger.</li>
            <li><strong>Fresh & Exciting Every Time</strong> – A new inflatable each month keeps the excitement alive.</li>
            <li><strong>All-Inclusive Pricing</strong> – One flat monthly rate covers delivery, setup, and cleaning.</li>
            <li><strong>Built-In Family Memories</strong> – Create a monthly tradition your kids will remember forever.</li>
            <li><strong>Save even more money</strong> – Get 25% off all other reservations.</li>
          </ul>
          <div className="membership-getstarted">
            Get Started
          </div>
        </div>
      </section>
    </div>
  );
}

export default Membership;