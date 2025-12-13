// Test script to verify the availability checking system is working correctly
// Run this with: node test-availability-system.js

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');

// Firebase config (use your actual config)
const firebaseConfig = {
  // Your config here - you can copy from FirebaseConfig.js
  // For testing, you'll need to replace this with your actual config
  apiKey: "your-api-key",
  authDomain: "your-auth-domain",
  databaseURL: "your-database-url",
  projectId: "your-project-id",
  storageBucket: "your-storage-bucket",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id"
};

// Test the availability function (converted from TypeScript to JavaScript)
async function testGetUnavailableInflateables(startDate, endDate) {
  console.log('🔍 Testing availability for date range:', startDate.toLocaleDateString(), '-', endDate.toLocaleDateString());
  
  // Convert to date-only strings to avoid timezone issues
  const selectedStartDay = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const selectedEndDay = endDate.toISOString().split('T')[0]; // YYYY-MM-DD
  
  const app = initializeApp(firebaseConfig);
  const db = getDatabase(app);
  const unavailable = new Set();
  
  // Check regular bookings
  const bookingsRef = ref(db, "bookings");
  const snapshot = await get(bookingsRef);
  
  if (snapshot.exists()) {
    const bookings = snapshot.val();
    console.log('📊 Found', Object.keys(bookings).length, 'total bookings to check');
    
    Object.entries(bookings).forEach(([bookingId, booking]) => {
      // Skip membershipBookings node (handled separately)
      if (bookingId === 'membershipBookings') return;
      
      // Only consider bookings that occupy inventory (deferred, pending, confirmed)
      if (!['deferred', 'pending', 'confirmed'].includes(booking.status)) {
        return;
      }
      
      console.log('🔍 Checking booking', bookingId, 'with status:', booking.status);
      
      // Parse the eventDate string (format: "MM/DD/YYYY - MM/DD/YYYY")
      const eventDateString = booking.orderDetails?.eventDate;
      if (!eventDateString) {
        console.log('⚠️ Booking', bookingId, 'missing eventDate');
        return;
      }
      
      // Extract start and end dates from the string
      const dateRange = eventDateString.split(' - ');
      if (dateRange.length !== 2) {
        console.log('⚠️ Booking', bookingId, 'has invalid eventDate format:', eventDateString);
        return;
      }
      
      const bookingStart = new Date(dateRange[0]);
      const bookingEnd = new Date(dateRange[1]);
      
      // Check if dates are valid
      if (isNaN(bookingStart.getTime()) || isNaN(bookingEnd.getTime())) {
        console.log('⚠️ Booking', bookingId, 'has invalid dates:', dateRange);
        return;
      }
      
      // Convert booking dates to date-only strings
      const bookingStartDay = bookingStart.toISOString().split('T')[0];
      const bookingEndDay = bookingEnd.toISOString().split('T')[0];
      
      // Check for day overlap (if any day overlaps, consider it unavailable)
      const hasOverlap = (bookingStartDay <= selectedEndDay && bookingEndDay >= selectedStartDay);
      
      console.log('📅 Booking', bookingId, 'dates:', bookingStartDay, '-', bookingEndDay, 'vs selected:', selectedStartDay, '-', selectedEndDay, 'overlap:', hasOverlap);
      
      if (hasOverlap) {
        // Get items from the booking and mark them as unavailable
        const items = booking.orderDetails?.items || [];
        console.log('📦 Booking', bookingId, 'has', items.length, 'items');
        
        items.forEach((item) => {
          if (item.name && !item.name.toLowerCase().includes('gift card') && !item.name.toLowerCase().includes('membership')) {
            console.log('🚫 Marking as unavailable:', item.name, '(quantity:', item.quantity, ')');
            unavailable.add(item.name);
          }
        });
      }
    });
  }
  
  console.log('🚫 Final unavailable items:', Array.from(unavailable));
  return unavailable;
}

// Test the cart validation function
async function testValidateAndCleanCart(cartItems, startDate, endDate) {
  console.log('🛒 Testing cart validation with', cartItems.length, 'items for dates:', startDate.toLocaleDateString(), '-', endDate.toLocaleDateString());
  
  const unavailableItems = await testGetUnavailableInflateables(startDate, endDate);
  const validItems = [];
  const removedItems = [];
  
  cartItems.forEach(item => {
    if (unavailableItems.has(item.name)) {
      console.log('❌ Removing unavailable item from cart:', item.name);
      removedItems.push(item);
    } else {
      validItems.push(item);
    }
  });
  
  console.log('✅ Cart validation complete:', validItems.length, 'items remaining,', removedItems.length, 'items removed');
  return { validItems, removedItems };
}

// Run test
async function runTests() {
  try {
    console.log('🧪 Starting availability system tests...\n');
    
    // Test dates (tomorrow to day after tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    
    console.log('📅 Testing with dates:', tomorrow.toLocaleDateString(), 'to', dayAfter.toLocaleDateString(), '\n');
    
    // Test 1: Get unavailable items
    console.log('=== TEST 1: Get Unavailable Items ===');
    const unavailableItems = await testGetUnavailableInflateables(tomorrow, dayAfter);
    console.log('Result:', Array.from(unavailableItems), '\n');
    
    // Test 2: Cart validation
    console.log('=== TEST 2: Cart Validation ===');
    const testCart = [
      { name: 'Castle Bounce House', quantity: 1 },
      { name: 'Slide Combo', quantity: 1 },
      { name: 'Water Slide', quantity: 1 }
    ];
    
    const { validItems, removedItems } = await testValidateAndCleanCart(testCart, tomorrow, dayAfter);
    console.log('Valid items:', validItems.map(i => i.name));
    console.log('Removed items:', removedItems.map(i => i.name), '\n');
    
    console.log('🎉 Tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    process.exit(0);
  }
}

// Only run if firebase config is properly set
if (firebaseConfig.apiKey === 'your-api-key') {
  console.log('⚠️  Please update the firebaseConfig in this test file with your actual Firebase configuration before running tests.');
  console.log('You can find the config in: JumpCSRA/app/components/FirebaseConfig.js');
} else {
  runTests();
}