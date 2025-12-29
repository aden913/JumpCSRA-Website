import React from 'react';
import { useNavigate } from 'react-router';
import '../styles/profile-menu-sidebar.css';

type ProfileMenuSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

const PROFILE_SECTIONS = [
  "Profile Information",
  "Bookings",
  "Membership",
  "Payment Information"
];

export function ProfileMenuSidebar({ isOpen, onClose }: ProfileMenuSidebarProps) {
  const navigate = useNavigate();

  const handleSectionClick = (section: string) => {
    // Navigate to profile page with the selected tab
    const tabIndex = PROFILE_SECTIONS.indexOf(section);
    
    // Store the selected tab in localStorage so profile page can read it
    localStorage.setItem('profile_activeTab', tabIndex.toString());
    
    // Navigate to profile
    navigate('/profile');
    
    // Close the sidebar
    onClose();
  };

  return (
    <>
      {/* Sidebar */}
      <div className={`profile-menu-sidebar ${isOpen ? 'open' : ''}`}>
        {/* Close button at top left */}
        <button 
          className="profile-menu-close-btn"
          onClick={onClose}
          aria-label="Close menu"
        >
          ✕
        </button>
        
        {/* Section buttons */}
        <div className="profile-menu-sections">
          {PROFILE_SECTIONS.map((section) => (
            <button
              key={section}
              className="profile-menu-section-btn"
              onClick={() => handleSectionClick(section)}
            >
              {section}
            </button>
          ))}
        </div>
      </div>
      
      {/* Overlay */}
      <div 
        className={`profile-menu-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />
    </>
  );
}
