import { useState, useEffect } from 'react';

export function LocalStorageDebugger() {
  const [localStorageData, setLocalStorageData] = useState<Record<string, string>>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  useEffect(() => {
    function updateLocalStorageData() {
      const data: Record<string, string> = {};
      
      // Get all cart-related localStorage keys
      const cartKeys = [
        'cart',
        'cart_duration',
        'cart_surface', 
        'cart_deliveryTime',
        'cart_location',
        'cart_wetDrySelections',
        'cart_giftCardValues',
        'calendarDateRange',
        'orderMessage'
      ];

      cartKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value !== null) {
          data[key] = value;
        }
      });

      setLocalStorageData(data);
      setLastUpdate(new Date().toLocaleTimeString());
    }

    // Update on mount
    updateLocalStorageData();

    // Listen for localStorage changes
    const handleStorageChange = (e: StorageEvent) => {
      console.log('🔍 LocalStorage changed:', e.key, e.newValue);
      updateLocalStorageData();
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also poll for changes since storage event doesn't fire for same-tab changes
    const interval = setInterval(updateLocalStorageData, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Only show in development
  if (process.env.NODE_ENV === 'production') return null;

  const formatValue = (value: string) => {
    try {
      // Try to parse JSON for pretty printing
      const parsed = JSON.parse(value);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // If not JSON, return as-is
      return value;
    }
  };

  const truncateValue = (value: string, maxLength: number = 50) => {
    if (value.length <= maxLength) return value;
    return value.substring(0, maxLength) + '...';
  };

  const clearCartData = () => {
    const cartKeys = ['cart', 'cart_duration', 'cart_surface', 'cart_deliveryTime', 'cart_location', 'cart_wetDrySelections', 'cart_giftCardValues'];
    cartKeys.forEach(key => localStorage.removeItem(key));
    console.log('🧹 Cleared all cart localStorage data');
  };

  const hasData = Object.keys(localStorageData).length > 0;

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          position: 'fixed',
          top: '90px',
          right: '10px',
          background: isExpanded ? '#FF9800' : (hasData ? '#4CAF50' : '#F44336'),
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
        {isExpanded ? 'Hide Storage' : `📦 Storage (${Object.keys(localStorageData).length})`}
      </button>

      {/* Expanded Panel */}
      {isExpanded && (
        <div style={{
          position: 'fixed',
          top: '130px',
          right: '10px',
          background: 'rgba(0, 0, 0, 0.95)',
          color: 'white',
          padding: '12px',
          borderRadius: '8px',
          fontFamily: 'monospace',
          fontSize: '11px',
          zIndex: 9998,
          maxWidth: '450px',
          maxHeight: '600px',
          overflow: 'auto',
          border: hasData ? '2px solid #4CAF50' : '2px solid #F44336',
          boxShadow: '0 4px 8px rgba(0,0,0,0.5)'
        }}>
          <div style={{ 
            fontSize: '14px', 
            fontWeight: 'bold', 
            marginBottom: '8px',
            borderBottom: '1px solid #555',
            paddingBottom: '4px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>localStorage Debug ({Object.keys(localStorageData).length} items)</span>
            <span style={{ fontSize: '10px', color: '#888' }}>
              {lastUpdate}
            </span>
          </div>
          
          {!hasData ? (
            <div style={{ 
              color: '#FF6B6B', 
              fontStyle: 'italic',
              padding: '8px',
              backgroundColor: 'rgba(255, 107, 107, 0.1)',
              borderRadius: '4px',
              border: '1px solid #FF6B6B'
            }}>
              ⚠️ No cart data in localStorage!<br/>
              <small>Data may have been cleared by browser or dev tools</small>
            </div>
          ) : (
            Object.entries(localStorageData).map(([key, value]) => (
              <div key={key} style={{ marginBottom: '8px' }}>
                <div style={{ 
                  color: '#4CAF50', 
                  fontWeight: 'bold',
                  fontSize: '12px'
                }}>
                  {key}:
                </div>
                <div style={{ 
                  color: '#E0E0E0',
                  marginLeft: '8px',
                  wordBreak: 'break-all',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  padding: '4px',
                  borderRadius: '3px',
                  fontSize: '10px'
                }}>
                  {isExpanded ? formatValue(value) : truncateValue(value)}
                </div>
              </div>
            ))
          )}
          
          {/* Debug Actions */}
          <div style={{ 
            marginTop: '12px',
            paddingTop: '8px',
            borderTop: '1px solid #555'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>
              🔧 Debug Actions:
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                onClick={clearCartData}
                style={{
                  backgroundColor: '#F44336',
                  color: 'white',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  cursor: 'pointer',
                }}
              >
                Clear Cart Data
              </button>
              <button
                onClick={() => {
                  console.log('📊 Current localStorage data:', localStorageData);
                  console.log('📊 Raw localStorage length:', localStorage.length);
                }}
                style={{
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  cursor: 'pointer',
                }}
              >
                Log to Console
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  backgroundColor: '#FF9800',
                  color: 'white',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  cursor: 'pointer',
                }}
              >
                Refresh Page
              </button>
            </div>
          </div>
          
          <div style={{ 
            marginTop: '8px',
            fontSize: '10px',
            color: '#888'
          }}>
            Updates every second • Dev mode only
          </div>
        </div>
      )}
    </>
  );
}