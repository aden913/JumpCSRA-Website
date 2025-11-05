/**
 * Email Testing Component
 * Use this component in development to test email scheduling
 */

import React, { useState } from 'react';
import { 
  startCartAbandonmentTest, 
  scheduleAllTestEmails, 
  testSingleEmail, 
  createTestBookingData,
  EMAIL_TEST_TIMING,
  ENABLE_TEST_TIMING 
} from '../utils/emailTestingConfig';

export const EmailTestingComponent: React.FC = () => {
  const [testEmail, setTestEmail] = useState('test@example.com');
  const [testName, setTestName] = useState('Test User');
  const [testResults, setTestResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const handleCartAbandonmentTest = async () => {
    if (!ENABLE_TEST_TIMING) {
      addResult('⚠️ Test timing is disabled. Enable ENABLE_TEST_TIMING in emailTestingConfig.ts');
      return;
    }

    setLoading(true);
    try {
      const result = await startCartAbandonmentTest('test_user_123', testEmail, testName);
      addResult(`✅ Cart abandonment test started: ${result.message}`);
      addResult(`📧 Email will be sent to ${testEmail} in ${EMAIL_TEST_TIMING.CART_ABANDONMENT} minute(s)`);
    } catch (error) {
      addResult(`❌ Cart abandonment test failed: ${error}`);
    }
    setLoading(false);
  };

  const handleAllBookingEmailsTest = async () => {
    if (!ENABLE_TEST_TIMING) {
      addResult('⚠️ Test timing is disabled. Enable ENABLE_TEST_TIMING in emailTestingConfig.ts');
      return;
    }

    setLoading(true);
    try {
      const testBookingData = createTestBookingData(testEmail, testName);
      await scheduleAllTestEmails(testBookingData);
      addResult('✅ All booking emails scheduled with test timing:');
      addResult(`📧 Deposit Reminder: ${EMAIL_TEST_TIMING.DEPOSIT_REMINDER} min`);
      addResult(`📧 Event Confirmation: ${EMAIL_TEST_TIMING.EVENT_CONFIRMATION} min`);
      addResult(`📧 Post-Event Thanks: ${EMAIL_TEST_TIMING.POST_EVENT_THANKS} min`);
      addResult(`📧 Rebooking Reminder: ${EMAIL_TEST_TIMING.REBOOKING_REMINDER} min`);
    } catch (error) {
      addResult(`❌ Booking emails test failed: ${error}`);
    }
    setLoading(false);
  };

  const handleSingleEmailTest = async (emailType: string) => {
    setLoading(true);
    try {
      const testBookingData = createTestBookingData(testEmail, testName);
      const result = await testSingleEmail(emailType, testBookingData);
      addResult(`✅ ${emailType} email sent immediately - Result: ${JSON.stringify(result)}`);
    } catch (error) {
      addResult(`❌ ${emailType} email test failed: ${error}`);
    }
    setLoading(false);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  if (!ENABLE_TEST_TIMING) {
    return (
      <div style={{ 
        position: 'fixed', 
        bottom: '20px', 
        right: '20px', 
        background: '#ffebee', 
        border: '2px solid #f44336',
        padding: '20px', 
        borderRadius: '8px',
        maxWidth: '400px',
        zIndex: 9999 
      }}>
        <h3 style={{ color: '#d32f2f', margin: '0 0 10px 0' }}>
          ⚠️ Email Testing Disabled
        </h3>
        <p style={{ margin: '0', fontSize: '14px' }}>
          Set <code>ENABLE_TEST_TIMING = true</code> in <code>emailTestingConfig.ts</code> to enable email testing.
        </p>
      </div>
    );
  }

  return (
    <div style={{ 
      position: 'fixed', 
      bottom: '20px', 
      right: '20px', 
      background: 'white', 
      border: '2px solid #007bff',
      padding: '20px', 
      borderRadius: '8px',
      maxWidth: '500px',
      maxHeight: '600px',
      overflow: 'auto',
      zIndex: 9999,
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#007bff' }}>
        🧪 Email Testing Panel
      </h3>
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
          Test Email:
        </label>
        <input
          type="email"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          style={{ 
            width: '100%', 
            padding: '8px', 
            border: '1px solid #ddd', 
            borderRadius: '4px',
            fontSize: '14px'
          }}
          placeholder="Enter test email address"
        />
      </div>
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
          Test Name:
        </label>
        <input
          type="text"
          value={testName}
          onChange={(e) => setTestName(e.target.value)}
          style={{ 
            width: '100%', 
            padding: '8px', 
            border: '1px solid #ddd', 
            borderRadius: '4px',
            fontSize: '14px'
          }}
          placeholder="Enter test user name"
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Quick Tests:</h4>
        
        <button
          onClick={handleCartAbandonmentTest}
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '10px', 
            margin: '5px 0',
            backgroundColor: '#ff9800', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px'
          }}
        >
          🛒 Test Cart Abandonment ({EMAIL_TEST_TIMING.CART_ABANDONMENT}min)
        </button>
        
        <button
          onClick={handleAllBookingEmailsTest}
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '10px', 
            margin: '5px 0',
            backgroundColor: '#4caf50', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px'
          }}
        >
          📅 Test All Booking Emails (1-5min)
        </button>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Individual Email Tests:</h4>
        
        {[
          { type: 'deposit-reminder', label: '💰 Deposit Reminder', color: '#2196f3' },
          { type: 'event-confirmation', label: '📅 Event Confirmation', color: '#9c27b0' },
          { type: 'post-event-thanks', label: '🎉 Post-Event Thanks', color: '#4caf50' },
          { type: 'rebooking-reminder', label: '🔄 Rebooking Reminder', color: '#ff5722' }
        ].map(email => (
          <button
            key={email.type}
            onClick={() => handleSingleEmailTest(email.type)}
            disabled={loading}
            style={{ 
              width: '100%', 
              padding: '8px', 
              margin: '2px 0',
              backgroundColor: email.color, 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '12px'
            }}
          >
            {email.label} (Immediate)
          </button>
        ))}
      </div>

      <div style={{ marginBottom: '15px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={clearResults}
            style={{ 
              flex: 1,
              padding: '8px', 
              backgroundColor: '#6c757d', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Clear Results
          </button>
        </div>
      </div>

      {testResults.length > 0 && (
        <div style={{ 
          marginTop: '15px',
          padding: '10px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          maxHeight: '200px',
          overflow: 'auto'
        }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Test Results:</h4>
          {testResults.map((result, index) => (
            <div key={index} style={{ 
              fontSize: '12px', 
              margin: '5px 0',
              padding: '5px',
              backgroundColor: result.includes('✅') ? '#d4edda' : 
                              result.includes('❌') ? '#f8d7da' : 
                              result.includes('⚠️') ? '#fff3cd' : 'white',
              borderRadius: '3px'
            }}>
              {result}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmailTestingComponent;