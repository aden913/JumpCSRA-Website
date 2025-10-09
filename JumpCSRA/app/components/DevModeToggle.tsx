import { useState } from 'react';

export function DevModeToggle() {
  const [is4KMode, setIs4KMode] = useState(false);

  // Only show in development
  if (process.env.NODE_ENV === 'production') return null;

  const toggle4KMode = () => {
    setIs4KMode(!is4KMode);
    const landingPage = document.querySelector('.landing-page');
    if (landingPage) {
      if (!is4KMode) {
        landingPage.classList.add('dev-mode');
      } else {
        landingPage.classList.remove('dev-mode');
      }
    }
  };

  return (
    <button
      onClick={toggle4KMode}
      style={{
        position: 'fixed',
        top: '50px',
        right: '10px',
        background: is4KMode ? '#4CAF50' : '#2196F3',
        color: 'white',
        border: 'none',
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '12px',
        zIndex: 9999,
        cursor: 'pointer',
        fontFamily: 'monospace'
      }}
    >
      {is4KMode ? '4K View ON' : 'Enable 4K View'}
    </button>
  );
}