import { useState, useEffect } from 'react';

export function ViewportDebugger() {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    function updateDimensions() {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    }

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const getBreakpoint = (width: number) => {
    if (width <= 320) return 'Small Mobile';
    if (width <= 480) return 'Mobile';
    if (width <= 768) return 'Tablet';
    if (width <= 1024) return 'Laptop';
    if (width <= 1440) return 'Desktop';
    if (width <= 1920) return 'Large Desktop';
    return '4K+';
  };

  // Only show in development
  if (process.env.NODE_ENV === 'production') return null;

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '8px 12px',
      borderRadius: '4px',
      fontFamily: 'monospace',
      fontSize: '12px',
      zIndex: 9999,
      pointerEvents: 'none'
    }}>
      {getBreakpoint(dimensions.width)}: {dimensions.width}×{dimensions.height}
    </div>
  );
}