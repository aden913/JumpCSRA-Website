/**
 * Script to create test booking data for scheduled email testing
 * Run this script to populate Firebase with test data that will trigger scheduled emails
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin with project configuration
if (!admin.apps.length) {
  admin.initializeApp({
    databaseURL: 'https://pppro-b060e-default-rtdb.firebaseio.com'
  });
}

const db = admin.database();

async function createTestBookings() {
  console.log('🔧 Creating test booking data for scheduled email testing...');
  
  const now = Date.now();
  const testUserId = 'test_user_scheduler_123';
  const testEmail = 'coxaden@gmail.com'; // Use your test email
  
  // Test data for different scenarios
  const testBookings = {
    // Deposit reminder test - booking needs deposit in 24 hours
    [`test_deposit_reminder_${now}`]: {
      userID: testUserId,
      customerEmail: testEmail,
      customerName: 'Test Customer - Deposit',
      status: 'deposit_due',
      eventDate: new Date(now + (2 * 24 * 60 * 60 * 1000)).toISOString(), // 2 days from now
      createdAt: now - (22 * 60 * 60 * 1000), // Created 22 hours ago (close to 24hr reminder)
      totalAmount: 300,
      amountPaid: 0,
      remainingBalance: 300,
      lastDepositReminder: 0, // Never sent
      items: [{ name: 'Test Bounce House', price: 300 }]
    },
    
    // Event confirmation test - event in 2 days
    [`test_event_confirmation_${now}`]: {
      userID: testUserId,
      customerEmail: testEmail,
      customerName: 'Test Customer - Event',
      status: 'confirmed',
      eventDate: new Date(now + (2 * 24 * 60 * 60 * 1000)).toISOString(), // 2 days from now
      createdAt: now - (5 * 24 * 60 * 60 * 1000), // Created 5 days ago
      totalAmount: 250,
      amountPaid: 250,
      remainingBalance: 0,
      lastEventConfirmation: 0, // Never sent
      deliveryAddress: '123 Test Street, Test City, SC 12345',
      items: [{ name: 'Test Water Slide', price: 250 }]
    },
    
    // Post-event thanks test - event was yesterday
    [`test_post_event_${now}`]: {
      userID: testUserId,
      customerEmail: testEmail,
      customerName: 'Test Customer - Post Event',
      status: 'completed',
      eventDate: new Date(now - (1 * 24 * 60 * 60 * 1000)).toISOString(), // Yesterday
      createdAt: now - (7 * 24 * 60 * 60 * 1000), // Created 7 days ago
      totalAmount: 200,
      amountPaid: 200,
      remainingBalance: 0,
      lastPostEventThanks: 0, // Never sent
      items: [{ name: 'Test Obstacle Course', price: 200 }]
    }
  };
  
  // Test cart abandonment data
  const testCarts = {
    [`test_cart_${testUserId}_${now}`]: {
      userID: testUserId,
      customerEmail: testEmail,
      customerName: 'Test Customer - Cart',
      cartItems: [
        { name: 'Abandoned Bounce House', price: 150, quantity: 1 }
      ],
      cartValue: 150,
      lastUpdated: now - (25 * 60 * 60 * 1000), // 25 hours ago (triggers 24hr reminder)
      lastAbandonmentEmail: 0 // Never sent
    }
  };
  
  // Test rebooking reminder data - customer had event 9 months ago
  const testRebookingUsers = {
    [testUserId]: {
      customerEmail: testEmail,
      customerName: 'Test Customer - Rebooking',
      lastBookingDate: new Date(now - (9 * 30 * 24 * 60 * 60 * 1000)).toISOString(), // 9 months ago
      lastRebookingReminder: 0, // Never sent
      totalBookings: 1
    }
  };
  
  try {
    // Write test data to Firebase
    console.log('📝 Writing test bookings...');
    await db.ref('bookings').update(testBookings);
    
    console.log('📝 Writing test cart data...');
    await db.ref('abandonedCarts').update(testCarts);
    
    console.log('📝 Writing test rebooking data...');
    await db.ref('rebookingCandidates').update(testRebookingUsers);
    
    console.log('✅ Test data created successfully!');
    console.log('\n📋 Created test scenarios:');
    console.log('  🔔 Deposit Reminder: Booking needs deposit reminder');
    console.log('  📅 Event Confirmation: Event in 2 days needs confirmation');
    console.log('  🎉 Post-Event Thanks: Event yesterday needs thank you');
    console.log('  🛒 Cart Abandonment: Cart abandoned 25 hours ago');
    console.log('  🔄 Rebooking Reminder: Customer had event 9 months ago');
    console.log(`\n📧 All emails will go to: ${testEmail}`);
    console.log('\n🚀 Run your scheduled email tests now!');
    
  } catch (error) {
    console.error('❌ Error creating test data:', error);
  }
  
  process.exit(0);
}

// Run the script
createTestBookings();