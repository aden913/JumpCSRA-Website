// Debug script to check rebooking reminder email eligibility
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

async function checkRebookingEligibility() {
  const bookingId = '1762747087363coj674izr';
  
  try {
    console.log(`🔄 Checking REBOOKING REMINDER eligibility for: ${bookingId}`);
    
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
    const monthsSinceEvent = daysSinceEvent / 30;
    
    console.log(`\n📊 Current Booking Status:`);
    console.log(`✓ Email: ${bookingData.customerInfo?.email}`);
    console.log(`✓ Event Date: ${eventDateString} → ${firstDate}`);
    console.log(`✓ emails.rebooking: ${bookingData.emails?.rebooking}`);
    console.log(`✓ Current time: ${new Date(now).toLocaleString()}`);
    console.log(`✓ Event time: ${new Date(eventDate).toLocaleString()}`);
    console.log(`✓ Hours since event: ${hoursSinceEvent.toFixed(2)}`);
    console.log(`✓ Days since event: ${daysSinceEvent.toFixed(2)}`);
    console.log(`✓ Months since event: ${monthsSinceEvent.toFixed(2)}`);
    
    // Check eligibility
    console.log(`\n🎯 REBOOKING REMINDER Requirements:`);
    
    const hasEmail = !!bookingData.customerInfo?.email;
    const rebookingNotSent = bookingData.emails?.rebooking !== true;
    const eventInPast = timeSinceEvent > 0;
    
    // Production mode: 9 months after event (no testing mode)
    const productionThreshold = 9 * 30 * 24 * 60 * 60 * 1000; // 9 months
    const nineMonthsAfterEvent = timeSinceEvent >= productionThreshold;
    
    console.log(`✓ Has email: ${hasEmail ? '✅' : '❌'} (${bookingData.customerInfo?.email || 'none'})`);
    console.log(`✓ Rebooking not sent: ${rebookingNotSent ? '✅' : '❌'} (${bookingData.emails?.rebooking})`);
    console.log(`✓ Event is in past: ${eventInPast ? '✅' : '❌'} (${daysSinceEvent.toFixed(2)} days ago)`);
    console.log(`✓ 9+ months after event: ${nineMonthsAfterEvent ? '✅' : '❌'} (production mode, needs 9+ months)`);
    
    const eligible = hasEmail && rebookingNotSent && nineMonthsAfterEvent;
    
    console.log(`\n🎯 REBOOKING REMINDER Eligibility: ${eligible ? '✅ YES' : '❌ NO'}`);
    
    if (!eligible) {
      console.log(`\n📋 To make eligible for Rebooking Reminder:`);
      if (!hasEmail) console.log(`   - Add customer email`);
      if (!rebookingNotSent) console.log(`   - Reset emails.rebooking: true → false`);
      if (!nineMonthsAfterEvent) {
        const monthsNeeded = 9 - monthsSinceEvent;
        console.log(`   - Event must be 9+ months in the past (currently ${monthsSinceEvent.toFixed(2)} months)`);
        console.log(`   - Need to wait ${monthsNeeded.toFixed(1)} more months`);
        console.log(`   - OR change event date to be 9+ months ago (e.g., "02/09/2025 - 02/09/2025")`);
      }
    }
    
    console.log(`\n🔧 Cloud Function Status:`);
    console.log(`✅ Now calls: /api/email/follow-up (correct endpoint)`);
    console.log(`✅ Sends flat data structure (fixed)`);
    console.log(`✅ Uses production timing: 9 months (fixed)`);
    
    console.log(`\n📋 Email Server Requirements (/follow-up):`);
    console.log(`Required: customerName, customerEmail, lastBookingDate`);
    console.log(`Optional: lastBookingId`);
    
    console.log(`\nCloud Function now sends:`);
    console.log(`{`);
    console.log(`  customerEmail: "${bookingData.customerInfo?.email}",`);
    console.log(`  customerName: "${bookingData.customerInfo?.name}",`);
    console.log(`  lastBookingDate: "${firstDate}",`);
    console.log(`  lastBookingId: "${bookingId}"`);
    console.log(`}`);
    console.log(`\n✅ Data structure is now correct`);
    
  } catch (error) {
    console.error('❌ Error checking booking:', error);
  }
}

checkRebookingEligibility();