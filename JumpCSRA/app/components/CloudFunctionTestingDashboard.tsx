import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface CloudFunctionTest {
  name: string;
  functionName: string;
  description: string;
  testData: any;
}

export default function CloudFunctionTestingDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [testEmail, setTestEmail] = useState('');
  const [testName, setTestName] = useState('Test Customer');

  // Initialize Firebase Functions
  const functions = getFunctions();

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
    setResults(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // Cloud Functions available for testing
  const cloudFunctionTests: CloudFunctionTest[] = [
    {
      name: 'Order Confirmation',
      functionName: 'sendOrderConfirmationEmail',
      description: 'Test enhanced order confirmation email',
      testData: {
        recipientEmail: testEmail,
        recipientName: testName,
        orderID: `TEST_ORDER_${Date.now()}`,
        orderDate: new Date().toISOString(),
        eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        deliveryAddress: '123 Test Street, Test City, GA 30000',
        deliveryTime: '10:00 AM',
        duration: '6 hours',
        surface: 'Grass',
        rentalItems: [
          { name: 'Princess Palace Bounce House', quantity: 1, price: 200, duration: '6 hours', wetDry: 'Dry' },
          { name: 'Tables and Chairs', quantity: 2, price: 25 }
        ],
        lastMinuteAdditions: [],
        subtotal: 225.00,
        surfaceAdjustment: 0,
        timeAdjustment: 0,
        deliveryCost: 25.00,
        totalAmount: 250.00,
        paymentType: 'deposit',
        amountPaid: 125.00,
        remainingBalance: 125.00,
        paymentMethod: 'Credit Card',
        bookingStatus: 'confirmed',
        requiresPhoneCall: false
      }
    },
    {
      name: 'Gift Card Email',
      functionName: 'sendGiftCardEmail',
      description: 'Test gift card email delivery',
      testData: {
        recipientEmail: testEmail,
        recipientName: testName,
        senderName: 'Test Sender',
        personalMessage: 'Happy Birthday! Enjoy your special day!',
        giftCardCode: `GC${Date.now()}`,
        giftCardBalance: 100.00,
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
        purchaseDate: new Date().toISOString(),
        orderID: `GIFT_${Date.now()}`
      }
    },
    {
      name: 'Account Deletion',
      functionName: 'sendAccountDeletionEmail',
      description: 'Test account deletion confirmation email',
      testData: {
        email: testEmail,
        name: testName,
        reason: 'User requested account deletion for testing purposes'
      }
    }
  ];

  // Test individual Cloud Function
  const testCloudFunction = async (test: CloudFunctionTest) => {
    if (!user) {
      addResult(`❌ ${test.name}: User must be authenticated to test Cloud Functions`);
      return;
    }

    setLoading(true);
    try {
      addResult(`🚀 Testing Cloud Function: ${test.functionName}...`);
      addResult(`📧 Target Email: ${testEmail}`);
      
      // Get the callable function
      const callableFunction = httpsCallable(functions, test.functionName);
      
      // Update test data with current email/name
      const updatedTestData = {
        ...test.testData,
        recipientEmail: testEmail,
        recipientName: testName,
        email: testEmail, // for account deletion
        name: testName    // for account deletion
      };
      
      console.log(`🔍 Calling ${test.functionName} with data:`, updatedTestData);
      
      // Call the Cloud Function
      const result = await callableFunction(updatedTestData);
      
      addResult(`✅ ${test.name}: Success!`);
      addResult(`📊 Response: ${JSON.stringify(result.data, null, 2)}`);
      
      console.log(`✅ ${test.functionName} result:`, result.data);
      
    } catch (error: any) {
      console.error(`❌ ${test.functionName} error:`, error);
      
      let errorMessage = '';
      if (error.code) {
        errorMessage = `Cloud Function Error [${error.code}]: ${error.message}`;
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      } else {
        errorMessage = `Unknown error: ${String(error)}`;
      }
      
      addResult(`❌ ${test.name}: ${errorMessage}`);
      
      // Additional error details if available
      if (error.details) {
        addResult(`📄 Error Details: ${JSON.stringify(error.details, null, 2)}`);
      }
    } finally {
      setLoading(false);
    }
  };



  // Test Email Scheduler
  const testEmailScheduler = async (emailType: string) => {
    if (!user) {
      addResult(`❌ ${emailType}: User must be authenticated`);
      return;
    }

    setLoading(true);
    try {
      addResult(`📧 Testing Email Scheduler: ${emailType}...`);
      
      const triggerEmail = httpsCallable(functions, 'triggerTestEmail');
      const result = await triggerEmail({
        type: emailType,
        email: testEmail,
        name: testName,
        bookingId: emailType.includes('booking') ? `TEST_BOOKING_${Date.now()}` : undefined
      });
      
      addResult(`✅ ${emailType}: Email scheduled successfully!`);
      addResult(`📊 Scheduler Response: ${JSON.stringify(result.data, null, 2)}`);
      
    } catch (error: any) {
      console.error(`❌ ${emailType} scheduler error:`, error);
      addResult(`❌ ${emailType}: ${error.message || String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // Clear results
  const clearResults = () => {
    setResults([]);
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: '50px', 
      right: '20px', 
      width: '420px', 
      maxHeight: '85vh',
      backgroundColor: 'white', 
      border: '2px solid #007bff', 
      borderRadius: '8px', 
      padding: '15px',
      boxShadow: '0 4px 12px rgba(0,123,255,0.15)',
      zIndex: 1000,
      overflow: 'auto',
      fontSize: '12px'
    }}>
      <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#007bff' }}>
        🔥 Cloud Functions Testing Dashboard
      </h3>

      {/* Authentication Status */}
      <div style={{ 
        marginBottom: '15px', 
        padding: '8px', 
        backgroundColor: user ? '#d4edda' : '#f8d7da',
        borderRadius: '4px',
        fontSize: '11px'
      }}>
        <strong>Auth Status:</strong> {user ? `✅ ${user.email}` : '❌ Not authenticated'}
      </div>

      {/* Test Configuration */}
      <div style={{ marginBottom: '15px', padding: '10px', background: '#f8f9fa', borderRadius: '4px' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Test Configuration:</h4>
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

      {/* Cloud Function Tests */}
      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>🔥 Cloud Function Tests:</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
          {cloudFunctionTests.map((test, index) => (
            <button
              key={index}
              onClick={() => testCloudFunction(test)}
              disabled={loading || !user || !testEmail}
              style={{
                padding: '10px',
                fontSize: '11px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading || !user ? 'not-allowed' : 'pointer',
                opacity: loading || !user ? 0.6 : 1
              }}
              title={test.description}
            >
              📧 {test.name}
            </button>
          ))}
        </div>
      </div>

      {/* Email Scheduler Tests */}
      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>⏰ Email Scheduler Tests:</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
          {['cart-abandonment', 'deposit-reminder', 'event-confirmation', 'post-event-thanks', 'rebooking-reminder'].map((emailType) => (
            <button
              key={emailType}
              onClick={() => testEmailScheduler(emailType)}
              disabled={loading || !user}
              style={{
                padding: '6px',
                fontSize: '10px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: loading || !user ? 'not-allowed' : 'pointer',
                opacity: loading || !user ? 0.6 : 1
              }}
            >
              {emailType.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div style={{ marginBottom: '15px' }}>
        <button 
          onClick={clearResults}
          style={{ 
            width: '100%', 
            padding: '8px', 
            backgroundColor: '#6c757d', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            fontSize: '12px'
          }}
        >
          🗑️ Clear Results
        </button>
      </div>

      {/* Results */}
      <div style={{ marginBottom: '10px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>📋 Test Results:</h4>
        <div style={{ 
          maxHeight: '300px', 
          overflow: 'auto', 
          backgroundColor: '#f8f9fa', 
          padding: '8px', 
          borderRadius: '4px',
          border: '1px solid #dee2e6'
        }}>
          {results.length === 0 ? (
            <p style={{ margin: 0, color: '#6c757d', fontStyle: 'italic' }}>
              No test results yet. Click a test button above to start testing.
            </p>
          ) : (
            results.map((result, index) => (
              <div key={index} style={{ 
                marginBottom: '4px', 
                fontSize: '10px',
                fontFamily: 'monospace',
                wordBreak: 'break-word'
              }}>
                {result}
              </div>
            ))
          )}
        </div>
      </div>

      {loading && (
        <div style={{ 
          textAlign: 'center', 
          padding: '10px',
          backgroundColor: '#e7f3ff',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          ⏳ Testing in progress...
        </div>
      )}
    </div>
  );
}