// Debug script to check the specific booking data
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCS6hZgp1XWbGxF7sIk1CHdJNj7Vc5x-mc",
  authDomain: "pppro-b060e.firebaseapp.com",
  databaseURL: "https://pppro-b060e-default-rtdb.firebaseio.com",
  projectId: "pppro-b060e",
  storageBucket: "pppro-b060e.appspot.com",
  messagingSenderId: "339867349944",
  appId: "1:339867349944:web:36ac2077b8d9092c7e2a11",
  measurementId: "G-S4JQEXWBXM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

async function checkBookingData() {
  const bookingId = '1762747087363coj674izr';
  
  try {
    console.log(`🔍 Checking booking: ${bookingId}`);
    
    const bookingRef = ref(database, `bookings/${bookingId}`);
    const snapshot = await get(bookingRef);
    
    if (!snapshot.exists()) {
      console.log('❌ Booking does not exist!');
      return;
    }
    
    const bookingData = snapshot.val();
    console.log('\n📊 Booking Data Structure:');
    console.log(JSON.stringify(bookingData, null, 2));
    
    // Check specific fields needed for deposit reminder
    console.log('\n🔍 Deposit Reminder Criteria Check:');
    console.log(`✓ remainingBalance: ${bookingData.paymentDetails?.remainingBalance}`);
    console.log(`✓ status: ${bookingData.status}`);
    console.log(`✓ customerInfo.email: ${bookingData.customerInfo?.email}`);
    console.log(`✓ eventDate (raw): ${bookingData.orderDetails?.eventDate}`);
    console.log(`✓ emails.depositReminder: ${bookingData.emails?.depositReminder}`);
    
    // Parse event date correctly
    const eventDateString = bookingData.orderDetails?.eventDate;
    const firstDate = eventDateString ? eventDateString.split(' - ')[0] : null;
    
    // Calculate timing
    const now = Date.now();
    const eventDate = firstDate ? new Date(firstDate).getTime() : NaN;
    const timeUntilEvent = eventDate - now;
    const hoursUntilEvent = timeUntilEvent / (1000 * 60 * 60);
    const daysUntilEvent = hoursUntilEvent / 24;
    
    console.log(`\n⏰ Timing Analysis:`);
    console.log(`Current time: ${new Date(now).toLocaleString()}`);
    console.log(`Parsed event date: ${firstDate}`);
    console.log(`Event time: ${new Date(eventDate).toLocaleString()}`);
    console.log(`Hours until event: ${hoursUntilEvent.toFixed(2)}`);
    console.log(`Days until event: ${daysUntilEvent.toFixed(2)}`);
    
    // Check if it meets timing criteria (2 days = 48 hours)
    const withinTwoDays = timeUntilEvent <= (2 * 24 * 60 * 60 * 1000) && timeUntilEvent > 0;
    console.log(`Within 2 days? ${withinTwoDays}`);
    
    // Overall eligibility
    const remainingBalance = bookingData.paymentDetails?.remainingBalance || 0;
    const eligible = remainingBalance > 0 && 
                    bookingData.status === 'pending' && 
                    bookingData.customerInfo?.email && 
                    bookingData.emails?.depositReminder !== true &&
                    withinTwoDays;
    
    console.log(`\n🎯 Overall Eligibility for Deposit Reminder: ${eligible ? '✅ YES' : '❌ NO'}`);
    
  } catch (error) {
    console.error('❌ Error checking booking:', error);
  }
}

checkBookingData();