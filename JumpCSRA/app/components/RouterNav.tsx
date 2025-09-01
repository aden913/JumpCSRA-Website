import { Link } from "react-router";
import "../styles/navbar.css";


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
              <span className="cart-count" style={{
                position: "absolute",
                top: "-8px",
                right: "-8px",
                background: "#d7be82",
                color: "#515a47",
                borderRadius: "50%",
                padding: "2px 8px",
                fontSize: "1rem",
                fontWeight: "bold"
              }}>{cartCount}</span>
            )}
          </button>
        </li>
      </ul>
    </nav>
  );
}
