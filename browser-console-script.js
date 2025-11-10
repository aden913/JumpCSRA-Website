/**
 * Browser Console Script for Modifying Firebase Bookings
 * 
 * Instructions:
 * 1. Open your React app in the browser
 * 2. Open Developer Tools (F12)
 * 3. Go to Console tab
 * 4. Paste this code and run it
 */

// Function to modify existing bookings for testing
async function modifyBookingsForTesting() {
  try {
    // Import Firebase functions (assuming they're available in your app)
    const { getDatabase, ref, child, get, update } = await import('firebase/database');
    const { initializeApp, getApps } = await import('firebase/app');
    
    // Use existing Firebase app or initialize
    let app;
    if (getApps().length === 0) {
      // You'll need to paste your Firebase config here
      const firebaseConfig = {
        // Your Firebase config object
        databaseURL: "https://pppro-b060e-default-rtdb.firebaseio.com"
      };
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    
    const database = getDatabase(app);
    const bookingsRef = ref(database, 'bookings');
    
    // Get existing bookings
    console.log('📋 Fetching existing bookings...');
    const snapshot = await get(bookingsRef);
    
    if (!snapshot.exists()) {
      console.log('❌ No bookings found in database');
      return;
    }
    
    const bookings = snapshot.val();
    const bookingKeys = Object.keys(bookings);
    
    if (bookingKeys.length < 3) {
      console.log('❌ Need at least 3 bookings to modify');
      return;
    }
    
    const now = Date.now();
    const updates = {};
    
    // Modify first booking for deposit reminder (event in 2 days)
    const depositBookingKey = bookingKeys[0];
    updates[`${depositBookingKey}/status`] = 'pending';
    updates[`${depositBookingKey}/eventDate`] = new Date(now + (2 * 24 * 60 * 60 * 1000)).toISOString();
    updates[`${depositBookingKey}/totalAmount`] = 300;
    updates[`${depositBookingKey}/amountPaid`] = 0;
    updates[`${depositBookingKey}/remainingBalance`] = 300;
    updates[`${depositBookingKey}/lastDepositReminder`] = 0;
    updates[`${depositBookingKey}/customerEmail`] = 'coxaden@gmail.com';
    updates[`${depositBookingKey}/customerName`] = 'Test Customer - Deposit';
    
    // Modify second booking for event confirmation (event in 2 days)
    const confirmationBookingKey = bookingKeys[1];
    updates[`${confirmationBookingKey}/status`] = 'confirmed';
    updates[`${confirmationBookingKey}/eventDate`] = new Date(now + (2 * 24 * 60 * 60 * 1000)).toISOString();
    updates[`${confirmationBookingKey}/totalAmount`] = 250;
    updates[`${confirmationBookingKey}/amountPaid`] = 250;
    updates[`${confirmationBookingKey}/remainingBalance`] = 0;
    updates[`${confirmationBookingKey}/lastEventConfirmation`] = 0;
    updates[`${confirmationBookingKey}/customerEmail`] = 'coxaden@gmail.com';
    updates[`${confirmationBookingKey}/customerName`] = 'Test Customer - Confirmation';
    
    // Modify third booking for post-event thanks (event 1 day ago)
    const thanksBookingKey = bookingKeys[2];
    updates[`${thanksBookingKey}/status`] = 'completed';
    updates[`${thanksBookingKey}/eventDate`] = new Date(now - (1 * 24 * 60 * 60 * 1000)).toISOString();
    updates[`${thanksBookingKey}/totalAmount`] = 200;
    updates[`${thanksBookingKey}/amountPaid`] = 200;
    updates[`${thanksBookingKey}/remainingBalance`] = 0;
    updates[`${thanksBookingKey}/lastPostEventThanks`] = 0;
    updates[`${thanksBookingKey}/customerEmail`] = 'coxaden@gmail.com';
    updates[`${thanksBookingKey}/customerName`] = 'Test Customer - Thanks';
    
    // Apply updates
    console.log('📝 Updating bookings...');
    await update(bookingsRef, updates);
    
    console.log('✅ Bookings modified successfully!');
    console.log('📋 Modified bookings:');
    console.log(`  🔔 Deposit Reminder: ${depositBookingKey}`);
    console.log(`  📅 Event Confirmation: ${confirmationBookingKey}`);
    console.log(`  🎉 Post-Event Thanks: ${thanksBookingKey}`);
    console.log('🚀 Run your scheduled email tests now!');
    
  } catch (error) {
    console.error('❌ Error modifying bookings:', error);
  }
}

// Run the function
modifyBookingsForTesting();