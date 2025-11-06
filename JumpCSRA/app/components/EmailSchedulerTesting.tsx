// Email Scheduler Testing Component - Development Only
import React, { useState, useEffect } from 'react';
import { auth } from './FirebaseConfig';
import { getDatabase, ref, set } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { onAuthStateChanged, User } from 'firebase/auth';

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
  const [user, setUser] = useState<User | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testName, setTestName] = useState('Test Customer');
  const [eventDate, setEventDate] = useState('');
  const [bookingStatus, setBookingStatus] = useState<'pending' | 'confirmed' | 'completed'>('confirmed');
  const [remainingBalance, setRemainingBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  // Monitor authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && !testEmail) {
        setTestEmail(currentUser.email || 'test@example.com');
        setTestName(currentUser.displayName || 'Test Customer');
      }
    });
    return () => unsubscribe();
  }, [testEmail]);

  const addResult = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setResults(prev => [`[${timestamp}] ${message}`, ...prev]);
  };

  // Create comprehensive test data for all email scenarios
  const createTestBookingsAndCarts = async () => {
    if (!user) {
      addResult('❌ Please sign in first');
      return;
    }

    setIsLoading(true);
    addResult('🚀 Creating comprehensive test data for all email scenarios...');

    try {
      const database = getDatabase();
      const now = new Date();

      // 1. Cart abandonment - create abandoned cart
      const cartData = {
        userId: user.uid,
        customerEmail: user.email,
        customerName: testName,
        cartItems: [ // Using cartItems (not items) to match scheduler expectations
          { name: 'Princess Palace', category: 'bounce-house', price: 250, quantity: 1 },
          { name: 'Table Black', category: 'party-essentials', price: 12, quantity: 2 }
        ],
        cartValue: 274,
        total: 274,
        createdAt: new Date(now.getTime() - 25 * 60 * 60 * 1000).getTime(), // 25 hours ago (timestamp)
        lastUpdated: new Date(now.getTime() - 24 * 60 * 60 * 1000).getTime(), // 24 hours ago (timestamp)
        status: 'abandoned'
      };
      await set(ref(database, `carts/${user.uid}_abandoned`), cartData);
      addResult('✅ Created abandoned cart (24+ hours ago)');

      // 2. Deposit reminder - booking with deposit due soon
      const depositBookingData = {
        orderId: `deposit-test-${Date.now()}`,
        customerID: user.uid,
        customerEmail: user.email,
        customerName: testName,
        inflateableIDs: ['Adventure Island', 'Castle Tower'],
        eventDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days from now - MAIN FIELD
        startDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days from now
        endDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000).toISOString(),
        requestedTime: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
        status: 'confirmed',
        total: 500,
        remainingBalance: 250, // This triggers deposit reminder
        depositDue: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
        depositAmount: 250,
        address: '123 Test Street, Test City, GA 30000',
        phone: '(555) 123-4567'
      };
      await set(ref(database, `bookings/deposit_${Date.now()}`), depositBookingData);
      addResult('✅ Created booking needing deposit reminder');

      // 3. Event confirmation - booking happening tomorrow
      const confirmationBookingData = {
        orderId: `confirmation-test-${Date.now()}`,
        customerID: user.uid,
        customerEmail: user.email,
        customerName: testName,
        inflateableIDs: ['Princess Palace'],
        eventDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(), // tomorrow - MAIN FIELD
        startDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(), // tomorrow
        endDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000).toISOString(),
        requestedTime: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
        status: 'confirmed',
        total: 250,
        remainingBalance: 0, // No remaining balance
        address: '456 Party Lane, Fun City, GA 30001',
        phone: '(555) 987-6543'
      };
      await set(ref(database, `bookings/confirmation_${Date.now()}`), confirmationBookingData);
      addResult('✅ Created booking for event confirmation (tomorrow)');

      // 4. Post-event thanks - booking that happened yesterday
      const postEventBookingData = {
        orderId: `postevent-test-${Date.now()}`,
        customerID: user.uid,
        customerEmail: user.email,
        customerName: testName,
        inflateableIDs: ['Color Chaos', 'Fire and Ice'],
        eventDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(), // yesterday - MAIN FIELD
        startDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(), // yesterday
        endDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000).toISOString(),
        requestedTime: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
        status: 'completed',
        total: 700,
        remainingBalance: 0,
        address: '789 Celebration Blvd, Party Town, GA 30002',
        phone: '(555) 456-7890'
      };
      await set(ref(database, `bookings/postevent_${Date.now()}`), postEventBookingData);
      addResult('✅ Created completed booking for post-event thanks');

      // 5. Rebooking reminder - booking from 3 months ago
      const rebookingBookingData = {
        orderId: `rebooking-test-${Date.now()}`,
        customerID: user.uid,
        customerEmail: user.email,
        customerName: testName,
        inflateableIDs: ['Tidal Wave'],
        eventDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 3 months ago - MAIN FIELD
        startDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 3 months ago
        endDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000).toISOString(),
        requestedTime: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(now.getTime() - 95 * 24 * 60 * 60 * 1000).toISOString(), // 95 days ago
        status: 'completed',
        total: 800,
        remainingBalance: 0,
        address: '321 Memory Lane, Happy Town, GA 30003',
        phone: '(555) 321-0987'
      };
      await set(ref(database, `bookings/rebooking_${Date.now()}`), rebookingBookingData);
      addResult('✅ Created old booking for rebooking reminder');

      addResult('🎉 ALL TEST DATA CREATED SUCCESSFULLY!');
      addResult('📧 Now click "🚀 Process All Scheduled Emails Now" to trigger all emails');
      addResult('💡 Check your email inbox for 5 different automated emails');

    } catch (error: any) {
      addResult(`❌ Error creating test data: ${error.code || error.message}`);
      if (error.code === 'PERMISSION_DENIED') {
        addResult('💡 Database permission denied - check Firebase rules');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Create test cart data (legacy function)
  const createTestCart = async () => {
    if (!user) {
      addResult('❌ Please sign in first');
      return;
    }
    
    if (!testEmail) {
      addResult('❌ Please enter test email');
      return;
    }

    setIsLoading(true);
    try {
      const database = getDatabase();
      const userId = user.uid; // Use actual user ID
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
      
    } catch (error: any) {
      addResult(`❌ Error creating test cart: ${error.code || error.message}`);
      if (error.code === 'PERMISSION_DENIED') {
        addResult('💡 Try: firebase deploy --only database to update database rules');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Create test booking
  const createTestBooking = async () => {
    if (!user) {
      addResult('❌ Please sign in first');
      return;
    }
    
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
        customerID: user.uid, // Use actual user ID
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
      
    } catch (error: any) {
      addResult(`❌ Error creating test booking: ${error.code || error.message}`);
      if (error.code === 'PERMISSION_DENIED') {
        addResult('💡 Try: firebase deploy --only database to update database rules');
      }
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
      
      {/* Authentication Status */}
      <div style={{ 
        marginBottom: '15px', 
        padding: '10px', 
        background: user ? '#d4edda' : '#f8d7da', 
        border: `1px solid ${user ? '#c3e6cb' : '#f5c6cb'}`,
        borderRadius: '4px',
        fontSize: '12px'
      }}>
        {user ? (
          <>
            ✅ <strong>Signed in:</strong> {user.email}
          </>
        ) : (
          <>
            ❌ <strong>Not signed in</strong> - Please sign in to test database writes
          </>
        )}
      </div>

      {/* Manual Email Triggers (No Database Write Required) */}
      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>🚀 Complete Email Testing Workflow:</h4>
        <p style={{ fontSize: '11px', color: '#666', margin: '0 0 8px 0' }}>
          Creates test data for ALL email types, then processes them
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '5px', marginBottom: '15px' }}>
          <button 
            onClick={createTestBookingsAndCarts} 
            disabled={isLoading || !user} 
            style={{ 
              padding: '10px', 
              fontSize: '13px', 
              background: '#ff6b35', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              fontWeight: 'bold'
            }}
          >
            📝 Step 1: Create ALL Test Data (Carts + Bookings)
          </button>
          <button 
            onClick={processAllScheduled} 
            disabled={isLoading} 
            style={{ 
              padding: '10px', 
              fontSize: '13px', 
              background: '#28a745', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              fontWeight: 'bold'
            }}
          >
            🚀 Step 2: Process All Scheduled Emails Now
          </button>
        </div>
      </div>

      {/* Manual Email Triggers (No Database Write Required) */}
      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>⚡ Individual Email Triggers:</h4>
        <p style={{ fontSize: '11px', color: '#666', margin: '0 0 8px 0' }}>
          These trigger emails immediately without database writes
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '5px' }}>
          <button onClick={() => triggerTestEmail('cart-abandonment', undefined, user?.uid)} disabled={isLoading || !user} style={{ padding: '6px', fontSize: '11px' }}>
            🛒 Trigger Cart Abandonment
          </button>
          <button onClick={() => triggerTestEmail('process-all-scheduled')} disabled={isLoading} style={{ padding: '6px', fontSize: '11px' }}>
            ⚡ Check All Email Types
          </button>
        </div>
      </div>
      
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
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>🎯 Database Test Creation:</h4>
        <p style={{ fontSize: '11px', color: '#666', margin: '0 0 8px 0' }}>
          Creates test data (requires sign-in and database permissions)
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
          <button onClick={() => runQuickTest('cart-abandonment')} disabled={isLoading || !user} style={{ padding: '6px', fontSize: '11px' }}>
            🛒 Cart
          </button>
          <button onClick={() => runQuickTest('deposit-reminder')} disabled={isLoading || !user} style={{ padding: '6px', fontSize: '11px' }}>
            💰 Deposit
          </button>
          <button onClick={() => runQuickTest('event-confirmation')} disabled={isLoading || !user} style={{ padding: '6px', fontSize: '11px' }}>
            🎉 Event
          </button>
          <button onClick={() => runQuickTest('post-event')} disabled={isLoading || !user} style={{ padding: '6px', fontSize: '11px' }}>
            🙏 Thanks
          </button>
          <button onClick={() => runQuickTest('rebooking')} disabled={isLoading || !user} style={{ padding: '6px', fontSize: '11px' }}>
            🔄 Rebook
          </button>
        </div>
      </div>

      {/* Manual Creation */}
      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>✍️ Manual Creation:</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
          <button onClick={createTestCart} disabled={isLoading || !user} style={{ padding: '6px', fontSize: '11px' }}>
            Create Cart
          </button>
          <button onClick={createTestBooking} disabled={isLoading || !user} style={{ padding: '6px', fontSize: '11px' }}>
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