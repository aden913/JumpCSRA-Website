import React from "react";
import { Link } from "react-router";
import "../welcome/index.css";

export function RouterNav() {
  return (
    <nav className="nav-bar">
      <ul>
          <Link to="/" style={{ display: "inline-block" }}>
            <img src="/favicon.ico" alt="JumpCSRA Logo" className="nav-logo" />
          </Link>
        <li><Link to="/">Bounce House</Link></li>
        <li><Link to="/water-slide">Water Slide</Link></li>
        <li><Link to="/obstacle-course">Obstacle Course</Link></li>
        <li><Link to="/games">Games</Link></li>
      </ul>
    </nav>
  );
}
