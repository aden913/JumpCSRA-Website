// Email Scheduler Testing Component - Development Only
import React, { useState } from 'react';
import { auth } from './FirebaseConfig';
import { getDatabase, ref, set } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface TestBookingData {
  customerEmail: string;
  customerName: string;
  eventDate: string;
  bookingStatus: 'pending' | 'confirmed' | 'completed';
  remainingBalance: number;
  deliveryAddress: string;
  deliveryTime: string;
  cartItems: { name: string; price: number }[];
  cartValue: number;
}

const EmailSchedulerTesting: React.FC = () => {
  const [testEmail, setTestEmail] = useState('test@example.com');
  const [testName, setTestName] = useState('Test Customer');
  const [eventDate, setEventDate] = useState('');
  const [bookingStatus, setBookingStatus] = useState<'pending' | 'confirmed' | 'completed'>('confirmed');
  const [remainingBalance, setRemainingBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const addResult = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setResults(prev => [`[${timestamp}] ${message}`, ...prev]);
  };

  // Create test cart data
  const createTestCart = async () => {
    if (!testEmail) {
      addResult('❌ Please enter test email');
      return;
    }

    setIsLoading(true);
    try {
      const database = getDatabase();
      const userId = 'test_user_' + Date.now();
      const cartData = {
        cartItems: [
          { name: 'Princess Castle Bounce House', price: 150 },
          { name: 'Tables and Chairs', price: 25 }
        ],
        cartValue: 175,
        customerEmail: testEmail,
        customerName: testName,
        lastUpdated: Date.now() - (2 * 60 * 1000), // 2 minutes ago to trigger abandonment
        createdAt: Date.now() - (2 * 60 * 1000)
      };

      await set(ref(database, `carts/${userId}`), cartData);
      addResult('✅ Test cart created successfully');
      addResult(`📧 Cart abandonment email should trigger in ~1 minute`);
      
    } catch (error) {
      addResult(`❌ Error creating test cart: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Create test booking
  const createTestBooking = async () => {
    if (!testEmail || !eventDate) {
      addResult('❌ Please enter test email and event date');
      return;
    }

    setIsLoading(true);
    try {
      const database = getDatabase();
      const bookingId = 'test_booking_' + Date.now();
      const bookingData: TestBookingData = {
        customerEmail: testEmail,
        customerName: testName,
        eventDate: eventDate,
        bookingStatus: bookingStatus,
        remainingBalance: remainingBalance,
        deliveryAddress: '123 Test Street, Test City, SC 12345',
        deliveryTime: '10:00 AM',
        cartItems: [
          { name: 'Princess Castle Bounce House', price: 150 },
          { name: 'Tables and Chairs', price: 25 }
        ],
        cartValue: 175
      };

      await set(ref(database, `bookings/${bookingId}`), {
        orderID: bookingId,
        customerID: 'test_user_' + Date.now(),
        status: bookingStatus,
        customerInfo: {
          name: testName,
          email: testEmail
        },
        orderDetails: {
          eventDate: eventDate,
          deliveryAddress: bookingData.deliveryAddress,
          deliveryTime: bookingData.deliveryTime,
          items: bookingData.cartItems,
          totalAmount: bookingData.cartValue
        },
        remainingBalance: remainingBalance,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      addResult(`✅ Test booking created: ${bookingId}`);
      addResult(`📧 Status: ${bookingStatus}, Remaining: $${remainingBalance}`);
      
      // Estimate when emails will be sent based on event date
      const eventDateTime = new Date(eventDate).getTime();
      const now = Date.now();
      
      if (bookingStatus === 'confirmed' && remainingBalance > 0) {
        addResult(`📧 Deposit reminder: When event is 2 minutes away`);
      }
      if (bookingStatus === 'confirmed') {
        addResult(`📧 Event confirmation: When event is 3 minutes away`);
      }
      if (bookingStatus === 'completed' || eventDateTime < now) {
        addResult(`📧 Post-event thanks: When event was 4 minutes ago`);
        addResult(`📧 Rebooking reminder: When event was 5 minutes ago`);
      }
      
    } catch (error) {
      addResult(`❌ Error creating test booking: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Manually trigger email function
  const triggerTestEmail = async (emailType: string, bookingId?: string, userId?: string) => {
    setIsLoading(true);
    try {
      const functions = getFunctions();
      const triggerEmail = httpsCallable(functions, 'triggerTestEmail');
      
      const data: any = { emailType };
      if (bookingId) data.bookingId = bookingId;
      if (userId) data.userId = userId;
      
      const result = await triggerEmail(data);
      const response = result.data as any;
      addResult(`✅ ${emailType} triggered: ${response.message || 'Success'}`);
      
    } catch (error) {
      addResult(`❌ Error triggering ${emailType}: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Process all scheduled emails immediately
  const processAllScheduled = async () => {
    setIsLoading(true);
    try {
      const functions = getFunctions();
      const triggerEmail = httpsCallable(functions, 'triggerTestEmail');
      
      const result = await triggerEmail({ emailType: 'process-all-scheduled' });
      const response = result.data as any;
      addResult(`✅ All scheduled emails processed: ${response.message || 'Success'}`);
      
    } catch (error) {
      addResult(`❌ Error processing scheduled emails: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick test scenarios
  const runQuickTest = async (scenario: string) => {
    addResult(`🚀 Running ${scenario} test...`);
    
    switch (scenario) {
      case 'cart-abandonment':
        await createTestCart();
        break;
        
      case 'deposit-reminder':
        setEventDate(new Date(Date.now() + 3 * 60 * 1000).toISOString().split('T')[0]); // 3 minutes from now
        setBookingStatus('confirmed');
        setRemainingBalance(75);
        setTimeout(() => createTestBooking(), 100);
        break;
        
      case 'event-confirmation':
        setEventDate(new Date(Date.now() + 4 * 60 * 1000).toISOString().split('T')[0]); // 4 minutes from now
        setBookingStatus('confirmed');
        setRemainingBalance(0);
        setTimeout(() => createTestBooking(), 100);
        break;
        
      case 'post-event':
        setEventDate(new Date(Date.now() - 5 * 60 * 1000).toISOString().split('T')[0]); // 5 minutes ago
        setBookingStatus('completed');
        setRemainingBalance(0);
        setTimeout(() => createTestBooking(), 100);
        break;
        
      case 'rebooking':
        setEventDate(new Date(Date.now() - 6 * 60 * 1000).toISOString().split('T')[0]); // 6 minutes ago
        setBookingStatus('completed');
        setRemainingBalance(0);
        setTimeout(() => createTestBooking(), 100);
        break;
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: 'white', 
      border: '2px solid #007bff', 
      borderRadius: '8px', 
      padding: '20px', 
      maxWidth: '400px',
      maxHeight: '80vh',
      overflow: 'auto',
      zIndex: 9999,
      boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
    }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#007bff' }}>
        🧪 Email Scheduler Testing
      </h3>
      
      {/* Test Configuration */}
      <div style={{ marginBottom: '15px' }}>
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
        
        <div style={{ marginBottom: '8px' }}>
          <label>Event Date:</label>
          <input 
            type="date" 
            value={eventDate} 
            onChange={(e) => setEventDate(e.target.value)}
            style={{ width: '100%', padding: '4px', marginTop: '2px' }}
          />
        </div>
        
        <div style={{ marginBottom: '8px' }}>
          <label>Booking Status:</label>
          <select 
            value={bookingStatus} 
            onChange={(e) => setBookingStatus(e.target.value as any)}
            style={{ width: '100%', padding: '4px', marginTop: '2px' }}
          >
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        
        <div style={{ marginBottom: '8px' }}>
          <label>Remaining Balance ($):</label>
          <input 
            type="number" 
            value={remainingBalance} 
            onChange={(e) => setRemainingBalance(Number(e.target.value))}
            style={{ width: '100%', padding: '4px', marginTop: '2px' }}
          />
        </div>
      </div>

      {/* Quick Test Buttons */}
      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Quick Tests:</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
          <button onClick={() => runQuickTest('cart-abandonment')} disabled={isLoading} style={{ padding: '6px', fontSize: '11px' }}>
            🛒 Cart
          </button>
          <button onClick={() => runQuickTest('deposit-reminder')} disabled={isLoading} style={{ padding: '6px', fontSize: '11px' }}>
            💰 Deposit
          </button>
          <button onClick={() => runQuickTest('event-confirmation')} disabled={isLoading} style={{ padding: '6px', fontSize: '11px' }}>
            🎉 Event
          </button>
          <button onClick={() => runQuickTest('post-event')} disabled={isLoading} style={{ padding: '6px', fontSize: '11px' }}>
            🙏 Thanks
          </button>
          <button onClick={() => runQuickTest('rebooking')} disabled={isLoading} style={{ padding: '6px', fontSize: '11px' }}>
            🔄 Rebook
          </button>
          <button onClick={processAllScheduled} disabled={isLoading} style={{ padding: '6px', fontSize: '11px' }}>
            ⚡ Process All
          </button>
        </div>
      </div>

      {/* Manual Creation */}
      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Manual Creation:</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
          <button onClick={createTestCart} disabled={isLoading} style={{ padding: '6px', fontSize: '11px' }}>
            Create Cart
          </button>
          <button onClick={createTestBooking} disabled={isLoading} style={{ padding: '6px', fontSize: '11px' }}>
            Create Booking
          </button>
        </div>
      </div>

      {/* Results */}
      <div style={{ marginTop: '15px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Results:</h4>
        <div style={{ 
          maxHeight: '200px', 
          overflow: 'auto', 
          background: '#f8f9fa', 
          padding: '8px', 
          borderRadius: '4px',
          fontSize: '11px',
          fontFamily: 'monospace'
        }}>
          {results.length === 0 ? (
            <div style={{ color: '#666' }}>No results yet...</div>
          ) : (
            results.map((result, index) => (
              <div key={index} style={{ marginBottom: '4px' }}>
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
};

export default EmailSchedulerTesting;