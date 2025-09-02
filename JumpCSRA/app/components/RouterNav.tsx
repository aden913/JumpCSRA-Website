import { Link } from "react-router";
import "../styles/navbar.css";
import "../styles/cart.css";

type RouterNavProps = {
  onNavClick?: (type: string) => void;
  cartCount?: number;
};

export function RouterNav({ onNavClick, cartCount }: RouterNavProps) {
  return (
    <nav className="nav-bar">
      <ul>
        <Link to="/" style={{ display: "inline-block" }}>
          <img src="/assets/logo.avif" alt="JumpCSRA Logo" className="nav-logo" />
        </Link>
        <li>
          <button type="button" className="nav-btn" onClick={() => {
            console.log("Calendar icon clicked");
            onNavClick && onNavClick("Calendar");
          }}> <img src="/calendar.png" alt="calendar" className="cart-icon" /></button>
        </li>
        <li style={{ position: "relative" }}>
          <button type="button" className="nav-btn" onClick={() => {
            console.log("Cart icon clicked");
            onNavClick && onNavClick("Cart");
          }}> <img src="/cart.png" alt="Cart" className="cart-icon" />
            {cartCount && cartCount > 0 && (
              <span className="cart-count" style={{}}>{cartCount}</span>
            )}
          </button>
        </li>
      </ul>
    </nav>
  );
}
