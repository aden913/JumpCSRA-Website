import { Link, useNavigate, useLocation } from "react-router";
import React, { useState, useEffect } from "react";
import "../styles/navbar.css";
import "../styles/cart.css";

type RouterNavProps = {
  onNavClick?: (type: string) => void;
  cartCount?: number;
  selectedDates?: [Date | null, Date | null];
  categories?: string[];
  onCategoryChange?: (category: string) => void;
  hideIcons?: boolean; // Hide both cart and profile icons
  hideCartIcon?: boolean; // Hide only the cart icon
  searchBarComponent?: React.ReactNode; // Custom component to render in place of dropdown
  hideNavbarDropdown?: boolean; // Hide the navbar category dropdown
  walletBalance?: number; // User's wallet balance to display
};

export function RouterNav({ onNavClick, cartCount, selectedDates, categories = [], onCategoryChange, hideIcons = false, hideCartIcon = false, searchBarComponent, hideNavbarDropdown = false, walletBalance }: RouterNavProps) {
  const formatDate = (date: Date | null) => date ? date.toLocaleDateString() : "--";
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarSearchTerm, setSidebarSearchTerm] = useState("");

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle mobile sidebar toggle
  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  // Close sidebar when clicking overlay
  const closeMobileSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  // Handle sidebar search
  const handleSidebarSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSidebarSearchTerm(e.target.value);
    // You can implement search functionality here
  };

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
    <>
      <nav className="nav-bar">
        <ul>
          {/* Mobile Menu Toggle Button */}
          {isMobile && (
            <li>
              <button 
                className="mobile-menu-toggle" 
                onClick={toggleMobileSidebar}
                aria-label="Toggle menu"
              >
                ☰
              </button>
            </li>
          )}

          {/* Logo */}
          <li>
            <Link to="/home" style={{ display: "inline-block" }}>
              <img src="/logov2.png" alt="JumpCSRA Logo" className="nav-logo" />
            </Link>
          </li>
          
          {/* Mobile Cart & Profile Links */}
          {isMobile && (
            <div className="mobile-nav-actions">
              {!hideIcons && !hideCartIcon && (
                <button 
                  type="button" 
                  className="mobile-cart-link" 
                  onClick={() => onNavClick && onNavClick("Cart")}
                >
                  Cart{cartCount && cartCount > 0 && ` (${cartCount})`}
                </button>
              )}
              {!hideIcons && (
                <Link to="/profile" className="mobile-profile-link">
                  Profile
                </Link>
              )}
            </div>
          )}
          
          {/* Category Dropdown or Custom Component - Hidden on Mobile */}
          {!isMobile && (
            <>
              {searchBarComponent ? (
                <div className="navbar-search-container">
                  {searchBarComponent}
                </div>
              ) : categories.length > 0 && !hideNavbarDropdown && (
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
            </>
          )}

          {/* Right side icons container */}
          <div className="navbar-right-icons">
            {/* Calendar Icon - Hidden on Mobile */}
            {!isMobile && (
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
            )}
            
            {/* Cart Icon/Text */}
            {!hideIcons && !hideCartIcon && (
              <div className="icon-container">
                <li style={{ position: "relative" }} className="right-icon">
                  <button type="button" className="nav-btn" onClick={() => {
                    console.log("Cart icon clicked");
                    onNavClick && onNavClick("Cart");
                  }}>
                    {isMobile ? (
                      <span className="cart-text">Cart</span>
                    ) : (
                      <img src="/white-cart.png" alt="Cart" className="cart-icon" />
                    )}
                    {cartCount && cartCount > 0 && (
                      <span className="cart-count" style={{}}>{cartCount}</span>
                    )}
                  </button>
                </li>
              </div>
            )}
            
            {/* Wallet Balance - Hidden on Mobile */}
            {!isMobile && !hideIcons && walletBalance !== undefined && walletBalance > 0 && (
              <div className="icon-container">
                <li className="right-icon">
                  <div className="wallet-balance-display" style={{
                    background: "linear-gradient(135deg, #4CAF50, #45a049)",
                    color: "white",
                    padding: "6px 12px",
                    borderRadius: "20px",
                    fontSize: "0.9rem",
                    fontWeight: "600",
                    boxShadow: "0 2px 8px rgba(76, 175, 80, 0.3)",
                    border: "2px solid rgba(255,255,255,0.2)",
                    whiteSpace: "nowrap"
                  }}>
                    💰 ${walletBalance.toFixed(2)}
                  </div>
                </li>
              </div>
            )}

            {/* Profile Icon/Text */}
            {!hideIcons && (
              <div className="icon-container">
                <li style={{ position: "relative" }} className="right-icon">
                  <Link to="/profile" style={{ display: "inline-block" }}>
                    {isMobile ? (
                      <span className="profile-text">Profile</span>
                    ) : (
                      <img src="/profile-icon-white.png" alt="Profile" className="profile-icon" style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid #eee" }} />
                    )}
                  </Link>
                </li>
              </div>
            )}
          </div>
        </ul>
      </nav>

      {/* Mobile Sidebar */}
      {isMobile && (
        <>
          <div className={`mobile-sidebar ${isMobileSidebarOpen ? 'open' : ''}`}>
            {/* Profile and Cart Buttons */}
            <div className="sidebar-action-buttons">
              {!hideIcons && (
                <Link 
                  to="/profile" 
                  className="sidebar-action-btn sidebar-profile-btn"
                  onClick={closeMobileSidebar}
                >
                  👤 Profile
                </Link>
              )}
              {!hideIcons && !hideCartIcon && (
                <button 
                  type="button" 
                  className="sidebar-action-btn sidebar-cart-btn"
                  onClick={() => {
                    onNavClick && onNavClick("Cart");
                    closeMobileSidebar();
                  }}
                >
                  🛒 Cart{cartCount && cartCount > 0 && ` (${cartCount})`}
                </button>
              )}
            </div>

            {/* Search Bar in Sidebar */}
            <div className="sidebar-search-container">
              <h3>Search</h3>
              {searchBarComponent ? (
                <div style={{ width: '100%' }}>
                  {searchBarComponent}
                </div>
              ) : (
                <input
                  type="text"
                  className="search-bar"
                  placeholder="Search categories..."
                  value={sidebarSearchTerm}
                  onChange={handleSidebarSearch}
                />
              )}
            </div>

            {/* Calendar Section in Sidebar */}
            {selectedDates && selectedDates[0] && selectedDates[1] && (
              <div className="sidebar-section">
                <h3>Selected Dates</h3>
                <button
                  className="sidebar-dates-display"
                  onClick={() => {
                    onNavClick && onNavClick("Calendar");
                    closeMobileSidebar();
                  }}
                  style={{
                    width: '100%',
                    background: "#f5f5f5",
                    border: '2px solid #ddd',
                    padding: "12px",
                    borderRadius: "8px",
                    textAlign: "center",
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    color: 'var(--darkBlue)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  📅 {formatDate(selectedDates[0])} - {formatDate(selectedDates[1])}
                  <div style={{ fontSize: '0.8rem', marginTop: '4px', opacity: 0.7 }}>
                    Tap to change dates
                  </div>
                </button>
              </div>
            )}

            {/* Wallet Balance in Sidebar */}
            {walletBalance !== undefined && walletBalance > 0 && (
              <div className="sidebar-section">
                <h3>Wallet Balance</h3>
                <div className="wallet-balance-display" style={{
                  background: "linear-gradient(135deg, #4CAF50, #45a049)",
                  color: "white",
                  padding: "12px",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  fontWeight: "600",
                  textAlign: "center",
                  boxShadow: "0 2px 8px rgba(76, 175, 80, 0.3)"
                }}>
                  💰 ${walletBalance.toFixed(2)}
                </div>
              </div>
            )}

            {/* Categories Dropdown in Sidebar */}
            {categories.length > 0 && (
              <div className="sidebar-section">
                <h3>Categories</h3>
                <select
                  className="sidebar-category-dropdown"
                  onChange={(e) => {
                    if (e.target.value) {
                      handleCategoryChange(e.target.value);
                      closeMobileSidebar();
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select a category...
                  </option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Sidebar Overlay */}
          <div 
            className={`mobile-sidebar-overlay ${isMobileSidebarOpen ? 'open' : ''}`}
            onClick={closeMobileSidebar}
          />
        </>
      )}
    </>
  );
}
