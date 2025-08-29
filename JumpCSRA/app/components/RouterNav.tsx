import { Link } from "react-router";
import "../styles/navbar.css";


type RouterNavProps = {
  onNavClick?: (type: string) => void;
};

export function RouterNav({ onNavClick }: RouterNavProps) {
  return (
    <nav className="nav-bar">
      <ul>
        <Link to="/" style={{ display: "inline-block" }}>
          <img src="/assets/logo.avif" alt="JumpCSRA Logo" className="nav-logo" />
        </Link>
       <li>
          <button type="button" className="nav-btn" onClick={() => onNavClick && onNavClick("Calendar")}><img src="/calendar.png" alt="calendar" className="cart-icon" /></button>
        </li>
        <li>
          <button type="button" className="nav-btn" onClick={() => onNavClick && onNavClick("Cart")}><img src="/cart.png" alt="Cart" className="cart-icon" /></button>
        </li>
      </ul>
    </nav>
  );
}
