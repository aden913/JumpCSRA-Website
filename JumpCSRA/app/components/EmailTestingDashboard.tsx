import React, { useState } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { useEffect } from 'react';

interface TestEmailData {
  type: string;
  endpoint: string;
  payload: any;
}

interface ServerConfig {
  name: string;
  url: string;
  apiKey: string;
}

export default function EmailTestingDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [testEmail, setTestEmail] = useState('');
  const [testName, setTestName] = useState('Test Customer');
  const [selectedServer, setSelectedServer] = useState(0);

  // Available email servers to test
  const emailServers: ServerConfig[] = [
    {
      name: 'Production Server',
      url: 'http://170.187.145.7:3001',
      apiKey: 'jumpcsra_secure_api_key_2024'
    },
    {
      name: 'Local Development',
      url: 'http://localhost:3001',
      apiKey: 'jumpcsra_secure_api_key_2024'
    },
    {
      name: 'Alternative Port',
      url: 'http://170.187.145.7:3000',
      apiKey: 'jumpcsra_secure_api_key_2024'
    }
  ];

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user && !testEmail) {
        setTestEmail(user.email || 'test@example.com');
        setTestName(user.displayName || 'Test Customer');
      }
    });
    return () => unsubscribe();
  }, [testEmail]);

  const addResult = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setResults(prev => [`[${timestamp}] ${message}`, ...prev]);
  };

  // Test email server health
  const testEmailServerHealth = async () => {
    setLoading(true);
    const server = emailServers[selectedServer];
    try {
      addResult(`🔍 Testing ${server.name} connectivity...`);
      addResult(`📡 URL: ${server.url}/health`);
      
      // Test basic connectivity first
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`${server.url}/health`, {
        method: 'GET',
        signal: controller.signal,
        mode: 'cors', // Explicitly handle CORS
        headers: {
          'Accept': 'application/json',
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        addResult(`✅ ${server.name} is reachable and healthy`);
        addResult(`📊 Server response: ${JSON.stringify(data)}`);
      } else {
        addResult(`❌ ${server.name} responded with status: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        addResult(`📄 Error details: ${errorText}`);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        addResult(`❌ ${server.name} request timed out (10 seconds)`);
      } else if (error.message.includes('CORS')) {
        addResult(`❌ CORS error with ${server.name}`);
        addResult('💡 Try: Check if email server allows CORS from your domain');
      } else if (error.message.includes('Failed to fetch')) {
        addResult(`❌ ${server.name} unreachable - network/firewall issue`);
        addResult('💡 Check: Is the server running? Is the IP/port correct?');
      } else {
        addResult(`❌ ${server.name} error: ${error.message}`);
      }
      addResult(`🔧 Error type: ${error.name}`);
    } finally {
      setLoading(false);
    }
  };

  // Test CORS configuration specifically
  const testCorsConfiguration = async () => {
    setLoading(true);
    const server = emailServers[selectedServer];
    
    try {
      addResult(`🌐 Testing CORS configuration on ${server.name}...`);
      
      // Test preflight request (OPTIONS)
      try {
        const preflightResponse = await fetch(`${server.url}/api/email/payment-confirmation`, {
          method: 'OPTIONS',
          mode: 'cors',
          headers: {
            'Origin': window.location.origin,
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Content-Type, X-API-Key'
          }
        });
        
        addResult(`✅ CORS Preflight Response: ${preflightResponse.status}`);
        
        // Check CORS headers
        const corsHeaders = [
          'Access-Control-Allow-Origin',
          'Access-Control-Allow-Methods', 
          'Access-Control-Allow-Headers',
          'Access-Control-Allow-Credentials'
        ];
        
        corsHeaders.forEach(header => {
          const value = preflightResponse.headers.get(header);
          addResult(`   ${header}: ${value || 'NOT SET'}`);
        });
        
      } catch (preflightError: any) {
        addResult(`❌ CORS Preflight failed: ${preflightError.message}`);
      }
      
      // Test simple request with different modes
      const modes = ['cors', 'no-cors', 'same-origin'] as RequestMode[];
      
      for (const mode of modes) {
        try {
          addResult(`🧪 Testing mode: ${mode}...`);
          
          const response = await fetch(`${server.url}/api/email/payment-confirmation`, {
            method: 'POST',
            mode: mode,
            headers: mode === 'no-cors' ? {} : {
              'Content-Type': 'application/json',
              'X-API-Key': server.apiKey
            },
            body: JSON.stringify({
              customerEmail: testEmail,
              customerName: testName,
              bookingId: `CORS_TEST_${Date.now()}`
            })
          });
          
          addResult(`✅ Mode ${mode}: ${response.status} ${response.statusText}`);
          
          if (mode !== 'no-cors') {
            try {
              const data = await response.json();
              addResult(`   Response: ${JSON.stringify(data)}`);
            } catch {
              const text = await response.text();
              addResult(`   Response: ${text.substring(0, 100)}`);
            }
          }
          
        } catch (error: any) {
          addResult(`❌ Mode ${mode} failed: ${error.message}`);
        }
      }
      
    } catch (error: any) {
      addResult(`❌ CORS test error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  const getServerInfo = async () => {
    setLoading(true);
    const server = emailServers[selectedServer];
    
    try {
      addResult(`📋 Getting server information from ${server.name}...`);
      
      const response = await fetch(`${server.url}/`, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        addResult(`✅ Server Info Retrieved:`);
        addResult(`📊 Full Response: ${JSON.stringify(data, null, 2)}`);
        
        // If there's an endpoints object, list them specifically
        if (data.endpoints) {
          addResult(`🔗 Available Endpoints:`);
          Object.keys(data.endpoints).forEach(endpoint => {
            addResult(`   • ${endpoint}: ${data.endpoints[endpoint]}`);
          });
        }
      } else {
        addResult(`❌ Failed to get server info: ${response.status} ${response.statusText}`);
      }
    } catch (error: any) {
      addResult(`❌ Error getting server info: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  const testServerEndpoints = async () => {
    setLoading(true);
    const server = emailServers[selectedServer];
    
    // Common root endpoints to test
    const endpoints = [
      '/',
      '/api',
      '/api/email',
      '/email',
      '/status',
      '/health',
      '/endpoints',
      '/docs',
      '/api/docs'
    ];

    addResult(`🌐 Testing available endpoints on ${server.name}...`);
    
    for (const endpoint of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${server.url}${endpoint}`, {
          method: 'GET',
          signal: controller.signal,
          mode: 'cors',
          headers: {
            'Accept': 'application/json, text/plain, */*',
          }
        });

        clearTimeout(timeoutId);
        
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          let responseText = '';
          
          if (contentType?.includes('application/json')) {
            const data = await response.json();
            responseText = JSON.stringify(data);
          } else {
            responseText = await response.text();
          }
          
          addResult(`✅ ${endpoint} - ${response.status} - ${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}`);
        } else {
          addResult(`❌ ${endpoint} - ${response.status} ${response.statusText}`);
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          addResult(`⏱️ ${endpoint} - Timeout`);
        } else {
          addResult(`❌ ${endpoint} - ${error.message}`);
        }
      }
    }
    
    setLoading(false);
  };

  // Test alternative endpoint structures
  const testEndpointDiscovery = async () => {
    setLoading(true);
    const server = emailServers[selectedServer];
    
    // Common endpoint patterns to test
    const patterns = [
      '/api/payment-confirmation',
      '/payment-confirmation', 
      '/api/email/payment-confirmation',
      '/email/payment-confirmation',
      '/send-email/payment-confirmation',
      '/api/send/payment-confirmation'
    ];

    addResult(`🔍 Testing endpoint patterns on ${server.name}...`);
    
    for (const pattern of patterns) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const testData = {
          customerEmail: testEmail,
          customerName: testName,
          bookingId: `TEST_${Date.now()}`,
          paymentAmount: 100.00
        };
        
        const response = await fetch(`${server.url}${pattern}`, {
          method: 'POST',
          signal: controller.signal,
          mode: 'cors',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': server.apiKey,
            'Accept': 'application/json',
          },
          body: JSON.stringify(testData)
        });

        clearTimeout(timeoutId);
        
        if (response.ok) {
          addResult(`✅ FOUND: ${pattern} - Status: ${response.status}`);
          const result = await response.json();
          addResult(`📊 Response: ${JSON.stringify(result)}`);
        } else if (response.status === 404) {
          addResult(`❌ ${pattern} - 404 Not Found`);
        } else {
          addResult(`❌ ${pattern} - ${response.status} ${response.statusText}`);
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          addResult(`⏱️ ${pattern} - Timeout`);
        } else {
          addResult(`❌ ${pattern} - ${error.message}`);
        }
      }
    }
    
    setLoading(false);
  };
  const testEmailEndpoint = async (emailData: TestEmailData) => {
    setLoading(true);
    const server = emailServers[selectedServer];
    try {
      addResult(`🚀 Testing ${emailData.type} on ${server.name}...`);
      addResult(`📡 URL: ${server.url}/api/email/${emailData.endpoint}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(`${server.url}/api/email/${emailData.endpoint}`, {
        method: 'POST',
        signal: controller.signal,
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': server.apiKey,
          'Accept': 'application/json',
        },
        body: JSON.stringify(emailData.payload)
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        addResult(`✅ ${emailData.type} email sent successfully`);
        addResult(`📊 Response: ${JSON.stringify(result)}`);
      } else {
        const errorText = await response.text();
        addResult(`❌ ${emailData.type} email failed: ${response.status} ${response.statusText}`);
        addResult(`📄 Error details: ${errorText}`);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        addResult(`❌ ${emailData.type} email timed out (15 seconds)`);
      } else if (error.message.includes('CORS')) {
        addResult(`❌ ${emailData.type} CORS error`);
        addResult('💡 Email server may not allow requests from this domain');
      } else if (error.message.includes('Failed to fetch')) {
        addResult(`❌ ${emailData.type} network error - server unreachable`);
        addResult('💡 Check: Server running? Correct IP/port? Firewall?');
      } else {
        addResult(`❌ ${emailData.type} error: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Test data for different email types
  const emailTests: TestEmailData[] = [
    {
      type: 'Order Confirmation',
      endpoint: 'payment-confirmation',
      payload: {
        customerEmail: testEmail,
        customerName: testName,
        bookingId: `TEST_ORDER_${Date.now()}`,
        paymentAmount: 250.00,
        bookingDetails: {
          eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
          items: [
            { name: 'Princess Palace Bounce House', quantity: 1, price: 200 },
            { name: 'Tables and Chairs', quantity: 2, price: 25 }
          ],
          total: 250.00,
          amountPaid: 125.00,
          remainingBalance: 125.00,
          address: '123 Test Street, Test City, GA 30000',
          setupTime: '10:00 AM'
        }
      }
    },
    {
      type: 'Cart Abandonment',
      endpoint: 'cart-reminder',
      payload: {
        customerEmail: testEmail,
        customerName: testName,
        customerId: user?.uid || 'test_user_123',
        cartItems: [
          { name: 'Adventure Island', quantity: 1, price: 200 },
          { name: 'Chair Metal Black', quantity: 10, price: 30 }
        ],
        cartTotal: 230.00,
        cartId: `cart_${user?.uid || 'test'}_${Date.now()}`
      }
    },
    {
      type: 'Deposit Reminder',
      endpoint: 'deposit-reminder',
      payload: {
        customerEmail: testEmail,
        customerName: testName,
        customerId: user?.uid || 'test_user_123',
        bookingId: `BOOKING_${Date.now()}`,
        remainingAmount: 125.00,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
        bookingDetails: {
          eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          items: [
            { name: 'Princess Palace', quantity: 1, price: 250 }
          ]
        }
      }
    },
    {
      type: 'Event Confirmation',
      endpoint: 'booking-confirmation',
      payload: {
        customerEmail: testEmail,
        customerName: testName,
        customerId: user?.uid || 'test_user_123',
        bookingId: `BOOKING_${Date.now()}`,
        eventDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
        bookingDetails: {
          items: [
            { name: 'Color Chaos Slide', quantity: 1, price: 350 }
          ],
          setupTime: '9:00 AM',
          pickupTime: '6:00 PM',
          address: '456 Party Lane, Fun City, GA 30001'
        }
      }
    },
    {
      type: 'Post-Event Thanks',
      endpoint: 'post-event-thanks',
      payload: {
        customerEmail: testEmail,
        customerName: testName,
        customerId: user?.uid || 'test_user_123',
        bookingId: `BOOKING_${Date.now()}`,
        eventDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        bookingDetails: {
          items: [
            { name: 'Fire and Ice Slide', quantity: 1, price: 500 }
          ]
        }
      }
    },
    {
      type: 'Rebooking Reminder',
      endpoint: 'follow-up',
      payload: {
        customerEmail: testEmail,
        customerName: testName,
        customerId: user?.uid || 'test_user_123',
        lastBookingDate: new Date(Date.now() - 270 * 24 * 60 * 60 * 1000).toISOString(), // 9 months ago
        lastBookingId: `BOOKING_${Date.now() - 270 * 24 * 60 * 60 * 1000}`
      }
    }
  ];

  // Test Cloud Functions endpoints directly
  const testCloudFunction = async (functionName: string) => {
    setLoading(true);
    try {
      addResult(`🔥 Testing Cloud Function: ${functionName}...`);
      
      // Test with appropriate test data based on function
      let testData = {};
      
      if (functionName === 'triggerTestEmail') {
        testData = { emailType: 'cart-abandonment' };
      } else if (functionName === 'sendOrderConfirmationEmail') {
        testData = {
          recipientEmail: testEmail,
          customerName: testName,
          orderID: `TEST_${Date.now()}`,
          totalAmount: 250.00,
          eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          rentalItems: [{ name: 'Test Item', price: 250, quantity: 1 }],
          deliveryAddress: '123 Test Street'
        };
      }

      // Use Firebase Functions SDK to call the function
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions();
      const cloudFunction = httpsCallable(functions, functionName);
      
      const result = await cloudFunction(testData);
      addResult(`✅ Cloud Function ${functionName} succeeded: ${JSON.stringify(result.data)}`);
      
    } catch (error) {
      addResult(`❌ Cloud Function ${functionName} failed: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      left: '10px', 
      background: 'white', 
      border: '2px solid #28a745', 
      borderRadius: '8px', 
      padding: '20px', 
      maxWidth: '500px',
      maxHeight: '90vh',
      overflow: 'auto',
      zIndex: 9999,
      boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
    }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#28a745' }}>
        📧 Email System Testing Dashboard
      </h3>

      {/* Test Configuration */}
      <div style={{ marginBottom: '15px', padding: '10px', background: '#f8f9fa', borderRadius: '4px' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Test Configuration:</h4>
        
        <div style={{ marginBottom: '8px' }}>
          <label>Email Server:</label>
          <select 
            value={selectedServer} 
            onChange={(e) => setSelectedServer(Number(e.target.value))}
            style={{ width: '100%', padding: '4px', marginTop: '2px' }}
          >
            {emailServers.map((server, index) => (
              <option key={index} value={index}>
                {server.name} ({server.url})
              </option>
            ))}
          </select>
        </div>
        
        <div style={{ marginBottom: '8px' }}>
          <label>Test Email:</label>
          <input 
            type="email" 
            value={testEmail} 
            onChange={(e) => setTestEmail(e.target.value)}
            style={{ width: '100%', padding: '4px', marginTop: '2px' }}
          />
        </div>
        <div style={{ marginBottom: '8px' }}>
          <label>Test Name:</label>
          <input 
            type="text" 
            value={testName} 
            onChange={(e) => setTestName(e.target.value)}
            style={{ width: '100%', padding: '4px', marginTop: '2px' }}
          />
        </div>
      </div>

      {/* Email Server Health Check */}
      <div style={{ marginBottom: '15px' }}>
        <button 
          onClick={testEmailServerHealth} 
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '10px', 
            backgroundColor: '#17a2b8', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            fontWeight: 'bold',
            marginBottom: '5px'
          }}
        >
          🏥 Test Server Health ({emailServers[selectedServer].name})
        </button>
        
        <button 
          onClick={getServerInfo} 
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '8px', 
            backgroundColor: '#28a745', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            fontWeight: 'bold',
            fontSize: '12px',
            marginBottom: '5px'
          }}
        >
          📋 Get Server Info & Endpoints
        </button>
        
        <button 
          onClick={testCorsConfiguration} 
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '8px', 
            backgroundColor: '#dc3545', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            fontWeight: 'bold',
            fontSize: '12px',
            marginBottom: '5px'
          }}
        >
          🌐 Test CORS Configuration
        </button>
        
        <button 
          onClick={testEndpointDiscovery} 
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '8px', 
            backgroundColor: '#ffc107', 
            color: 'black', 
            border: 'none', 
            borderRadius: '4px',
            fontWeight: 'bold',
            fontSize: '12px',
            marginBottom: '5px'
          }}
        >
          🔍 Discover Email Endpoints
        </button>
        
        <button 
          onClick={testServerEndpoints} 
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '8px', 
            backgroundColor: '#6c757d', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            fontWeight: 'bold',
            fontSize: '12px'
          }}
        >
          🌐 List Server Endpoints
        </button>
      </div>

      {/* Direct Email Endpoint Tests */}
      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>📧 Direct Email Server Tests:</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
          {emailTests.map((test, index) => (
            <button
              key={index}
              onClick={() => testEmailEndpoint(test)}
              disabled={loading || !testEmail}
              style={{
                padding: '8px',
                fontSize: '11px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {test.type}
            </button>
          ))}
        </div>
      </div>

      {/* Cloud Functions Tests */}
      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>🔥 Cloud Functions Tests:</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '5px' }}>
          <button
            onClick={() => testCloudFunction('triggerTestEmail')}
            disabled={loading}
            style={{
              padding: '8px',
              fontSize: '11px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px'
            }}
          >
            Test Trigger Email Function
          </button>
          <button
            onClick={() => testCloudFunction('sendOrderConfirmationEmail')}
            disabled={loading}
            style={{
              padding: '8px',
              fontSize: '11px',
              backgroundColor: '#ffc107',
              color: 'black',
              border: 'none',
              borderRadius: '4px'
            }}
          >
            Test Order Confirmation Function
          </button>
        </div>
      </div>

      {/* Results */}
      <div style={{ marginTop: '15px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>📋 Test Results:</h4>
        <div style={{ 
          maxHeight: '300px', 
          overflow: 'auto', 
          background: '#f8f9fa', 
          padding: '8px', 
          borderRadius: '4px',
          fontSize: '11px',
          fontFamily: 'monospace'
        }}>
          {results.length === 0 ? (
            <div style={{ color: '#666' }}>No tests run yet...</div>
          ) : (
            results.map((result, index) => (
              <div key={index} style={{ 
                marginBottom: '4px',
                color: result.includes('✅') ? '#28a745' : result.includes('❌') ? '#dc3545' : '#333'
              }}>
                {result}
              </div>
            ))
          )}
        </div>
        
        {results.length > 0 && (
          <button 
            onClick={() => setResults([])} 
            style={{ 
              marginTop: '8px', 
              padding: '4px 8px', 
              fontSize: '11px',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '3px'
            }}
          >
            Clear Results
          </button>
        )}
      </div>
    </div>
  );
}