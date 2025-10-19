import { Link, useNavigate, useLocation } from "react-router";
import "../styles/navbar.css";
import "../styles/cart.css";

type RouterNavProps = {
  onNavClick?: (type: string) => void;
  cartCount?: number;
  selectedDates?: [Date | null, Date | null];
  categories?: string[];
  onCategoryChange?: (category: string) => void;
  hideIcons?: boolean; // New prop to hide cart and profile icons
};

export function RouterNav({ onNavClick, cartCount, selectedDates, categories = [], onCategoryChange, hideIcons = false }: RouterNavProps) {
  const formatDate = (date: Date | null) => date ? date.toLocaleDateString() : "--";
  const navigate = useNavigate();
  const location = useLocation();

  const handleCategoryChange = (category: string) => {
    // If not on home page, navigate to home first
    if (location.pathname !== '/home') {
      navigate('/home');
      // Use a timeout to allow navigation to complete before filtering
      setTimeout(() => {
        onCategoryChange?.(category);
        scrollToOptionsCarousel();
      }, 100);
    } else {
      // Already on home page, just filter and scroll
      onCategoryChange?.(category);
      scrollToOptionsCarousel();
    }
  };

  const scrollToOptionsCarousel = () => {
    // Scroll to options carousel
    setTimeout(() => {
      const optionsSection = document.querySelector('.options-section');
      if (optionsSection) {
        optionsSection.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
    }, 200);
  };

  return (
    <nav className="nav-bar">
      <ul>
        <Link to="/home" style={{ display: "inline-block" }}>
          <img src="/logov2.png" alt="JumpCSRA Logo" className="nav-logo" />
        </Link>
        
        {/* Category Dropdown */}
        {categories.length > 0 && (
          <div className="navbar-category-dropdown-container">
            <select
              className="navbar-category-dropdown"
              onChange={(e) => handleCategoryChange(e.target.value)}
              defaultValue=""
            >
              <option value="" disabled>
                Browse Categories
              </option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="icon-container">
          <li style={{ position: "relative" }}>
            <button type="button" className="nav-btn calendar-btn" onClick={() => {
              console.log("Calendar icon clicked");
              onNavClick && onNavClick("Calendar");
            }} style={{ position: "relative", padding: 0, background: "none", border: "none" }}>
              {selectedDates && selectedDates[0] && selectedDates[1] && (
                <span
                  className="calendar-dates-overlay"
                  style={{
                    transform: "translate(-50%, -50%)",
                    background: "rgba(255,255,255,0.85)",
                    color: "#333",
                    fontSize: "0.8rem",
                    padding: "2px 6px",
                    borderRadius: "6px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    whiteSpace: "nowrap",
                    maxWidth: "80px",
                    pointerEvents: "none"
                  }}
                >
                  {formatDate(selectedDates[0])} - {formatDate(selectedDates[1])}
                </span>
              )}
            </button>
          </li>
        </div>
        {!hideIcons && (
          <>
            <div className="icon-container">
              <li style={{ position: "relative" }} className="right-icon">
                <button type="button" className="nav-btn" onClick={() => {
                  console.log("Cart icon clicked");
                  onNavClick && onNavClick("Cart");
                }}> <img src="/white-cart.png" alt="Cart" className="cart-icon" />
                  {cartCount && cartCount > 0 && (
                    <span className="cart-count" style={{}}>{cartCount}</span>
                  )}
                </button>
              </li>
            </div>
            {/* Profile Icon */}
            <div className="icon-container">
              <li style={{ position: "relative" }} className="right-icon">
                <Link to="/profile" style={{ display: "inline-block" }}>
                  <img src="/profile-icon.png" alt="Profile" className="profile-icon" style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid #eee" }} />
                </Link>
              </li>
            </div>
          </>
        )}
      </ul>
    </nav>
  );
}
