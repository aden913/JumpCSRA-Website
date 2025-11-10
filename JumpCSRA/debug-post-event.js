// Debug script to check post-event thanks email eligibility
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

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

async function checkPostEventEligibility() {
  const bookingId = '1762747087363coj674izr';
  
  try {
    console.log(`🎉 Checking POST-EVENT THANKS eligibility for: ${bookingId}`);
    
    const bookingRef = ref(database, `bookings/${bookingId}`);
    const snapshot = await get(bookingRef);
    
    if (!snapshot.exists()) {
      console.log('❌ Booking does not exist!');
      return;
    }
    
    const bookingData = snapshot.val();
    
    // Parse event date correctly
    const eventDateString = bookingData.orderDetails?.eventDate;
    const firstDate = eventDateString ? eventDateString.split(' - ')[0] : null;
    
    // Calculate timing
    const now = Date.now();
    const eventDate = firstDate ? new Date(firstDate).getTime() : NaN;
    const timeSinceEvent = now - eventDate;
    const hoursSinceEvent = timeSinceEvent / (1000 * 60 * 60);
    const daysSinceEvent = hoursSinceEvent / 24;
    
    console.log(`\n📊 Current Booking Status:`);
    console.log(`✓ Email: ${bookingData.customerInfo?.email}`);
    console.log(`✓ Event Date: ${eventDateString} → ${firstDate}`);
    console.log(`✓ emails.thanks: ${bookingData.emails?.thanks}`);
    console.log(`✓ Current time: ${new Date(now).toLocaleString()}`);
    console.log(`✓ Event time: ${new Date(eventDate).toLocaleString()}`);
    console.log(`✓ Hours since event: ${hoursSinceEvent.toFixed(2)}`);
    console.log(`✓ Days since event: ${daysSinceEvent.toFixed(2)}`);
    
    // Check eligibility
    console.log(`\n🎯 POST-EVENT THANKS Requirements:`);
    
    const hasEmail = !!bookingData.customerInfo?.email;
    const thanksNotSent = bookingData.emails?.thanks !== true;
    const eventInPast = timeSinceEvent > 0;
    const oneDayAfterEvent = timeSinceEvent >= (24 * 60 * 60 * 1000); // 1 day in milliseconds
    
    console.log(`✓ Has email: ${hasEmail ? '✅' : '❌'} (${bookingData.customerInfo?.email || 'none'})`);
    console.log(`✓ Thanks not sent: ${thanksNotSent ? '✅' : '❌'} (${bookingData.emails?.thanks})`);
    console.log(`✓ Event is in past: ${eventInPast ? '✅' : '❌'} (${daysSinceEvent.toFixed(2)} days ago)`);
    console.log(`✓ 1+ days after event: ${oneDayAfterEvent ? '✅' : '❌'} (needs 24+ hours)`);
    
    const eligible = hasEmail && thanksNotSent && oneDayAfterEvent;
    
    console.log(`\n🎯 POST-EVENT THANKS Eligibility: ${eligible ? '✅ YES' : '❌ NO'}`);
    
    if (!eligible) {
      console.log(`\n📋 To make eligible for Post-Event Thanks:`);
      if (!hasEmail) console.log(`   - Add customer email`);
      if (!thanksNotSent) console.log(`   - Reset emails.thanks: true → false`);
      if (!oneDayAfterEvent) {
        console.log(`   - Change event date to be at least 1 day in the past`);
        console.log(`   - Current: "${eventDateString}"`);
        console.log(`   - Suggested: "11/09/2025 - 11/09/2025" (yesterday)`);
      }
    }
    
    console.log(`\n🔧 Email Server Requirements Check:`);
    console.log(`Cloud Function should send:`);
    console.log(`{`);
    console.log(`  customerEmail: "${bookingData.customerInfo?.email}",`);
    console.log(`  customerName: "${bookingData.customerInfo?.name}",`);
    console.log(`  bookingId: "${bookingId}",`);
    console.log(`  eventDate: "${firstDate}",`);
    console.log(`  bookingDetails: { ... }`);
    console.log(`}`);
    
  } catch (error) {
    console.error('❌ Error checking booking:', error);
  }
}

checkPostEventEligibility();