import React from 'react';
import { Link, useNavigate } from 'react-router';
import { User } from 'firebase/auth';
import '../styles/mobile-bottom-menu.css';

type MobileBottomMenuProps = {
  user: User | null;
  selectedDates?: [Date | null, Date | null];
  onCalendarClick?: () => void;
  cartCount?: number;
  onCartClick: () => void; // Made required since we always want 4 buttons
};

export function MobileBottomMenu({ 
  user, 
  selectedDates, 
  onCalendarClick, 
  cartCount, 
  onCartClick 
}: MobileBottomMenuProps) {
  const navigate = useNavigate();
  
  const formatDate = (date: Date | null) => date ? date.toLocaleDateString() : "Select Date";

  const handleProfileClick = () => {
    navigate('/profile');
  };

  const handleNameClick = () => {
    if (!user) {
      navigate('/?signin=true');
    }
    // If user is logged in, do nothing (non-clickable as requested)
  };

  return (
    <div className="mobile-bottom-menu">
      {/* Profile Icon Button */}
      <div className="bottom-menu-item clickable" onClick={handleProfileClick}>
        <div className="bottom-menu-icon">
          <img src="/profile-icon-white.png" alt="Profile" className="menu-icon-img" />
        </div>
      </div>

      {/* Date Button */}
      <div className="bottom-menu-item clickable" onClick={onCalendarClick}>
        <div className="bottom-menu-text date-button-text">
          {selectedDates && selectedDates[0] ? 
            formatDate(selectedDates[0]) : 
            "Select Date"
          }
        </div>
      </div>

      {/* Cart Button */}
      <div className="bottom-menu-item clickable" onClick={onCartClick}>
        <div className="bottom-menu-icon cart-icon-container">
          <img src="/white-cart.png" alt="Cart" className="menu-icon-img cart-icon" />
          {(cartCount && Number(cartCount) > 0) && (
            <div className="cart-count-badge">{cartCount}</div>
          )}
        </div>
      </div>

      {/* User Name Button */}
      <div 
        className={`bottom-menu-item ${!user ? 'clickable' : 'user-name-button'}`}
        onClick={handleNameClick}
      >
        <div className="bottom-menu-text name-button-text">
          {user ? (
            <span className="user-name">
              {user.displayName || user.email?.split('@')[0] || 'User'}
            </span>
          ) : (
            <span className="signin-text">Sign In</span>
          )}
        </div>
      </div>
    </div>
  );
}