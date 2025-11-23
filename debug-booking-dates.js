const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');

const firebaseConfig = {
  apiKey: "AIzaSyDs39ycP3-tg21iBpWul8cp6hoqoKhI2cE",
  authDomain: "pppro-b060e.firebaseapp.com",
  databaseURL: "https://pppro-b060e-default-rtdb.firebaseio.com",
  projectId: "pppro-b060e",
  storageBucket: "pppro-b060e.firebasestorage.app",
  messagingSenderId: "819237875595",
  appId: "1:819237875595:web:1ee4ce4c815c1b4d2f498e"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function debugBookingDates() {
  console.log('🔍 DEBUGGING BOOKING DATE FORMATS\n');
  
  try {
    // Check regular bookings
    console.log('📋 REGULAR BOOKINGS:');
    const regularBookingsRef = ref(db, 'bookings');
    const regularSnapshot = await get(regularBookingsRef);
    
    if (regularSnapshot.exists()) {
      const regularBookings = Object.entries(regularSnapshot.val());
      console.log(`Found ${regularBookings.length} regular bookings\n`);
      
      regularBookings.slice(0, 5).forEach(([bookingId, booking]) => {
        console.log(`Booking ID: ${bookingId}`);
        console.log(`  Status: ${booking.status}`);
        console.log(`  Event Date: ${booking.orderDetails?.eventDate} (Type: ${typeof booking.orderDetails?.eventDate})`);
        console.log(`  Created At: ${booking.createdAt} (Type: ${typeof booking.createdAt})`);
        
        if (booking.orderDetails?.eventDate) {
          console.log(`  Raw Event Date String: "${booking.orderDetails.eventDate}"`);
          
          // Try to parse the date range format "MM/DD/YYYY - MM/DD/YYYY"
          const dateStr = booking.orderDetails.eventDate;
          const dateParts = dateStr.split(' - ');
          if (dateParts.length > 0) {
            const startDateStr = dateParts[0].trim();
            console.log(`  Start Date String: "${startDateStr}"`);
            
            try {
              const eventDate = new Date(startDateStr);
              console.log(`  Parsed Event Date: ${eventDate}`);
              console.log(`  Event Date toString(): ${eventDate.toString()}`);
              console.log(`  Event Date toDateString(): ${eventDate.toDateString()}`);
              console.log(`  Event Date toISOString(): ${eventDate.toISOString()}`);
            } catch (error) {
              console.log(`  Error parsing date: ${error.message}`);
            }
          }
        }
        
        console.log(`  Items:`, booking.orderDetails?.items?.map(item => ({
          name: item.name,
          quantity: item.quantity
        })));
        console.log('---');
      });
    }
    
    console.log('\n🎪 MEMBERSHIP BOOKINGS:');
    const membershipBookingsRef = ref(db, 'membershipBookings');
    const membershipSnapshot = await get(membershipBookingsRef);
    
    if (membershipSnapshot.exists()) {
      const membershipBookings = Object.entries(membershipSnapshot.val());
      console.log(`Found ${membershipBookings.length} membership bookings\n`);
      
      membershipBookings.slice(0, 5).forEach(([bookingId, booking]) => {
        console.log(`Membership Booking ID: ${bookingId}`);
        console.log(`  Status: ${booking.bookingStatus}`);
        console.log(`  Selected Weekday: ${booking.selectedWeekday}`);
        console.log(`  Actual Delivery Date: ${booking.actualDeliveryDate} (Type: ${typeof booking.actualDeliveryDate})`);
        console.log(`  Created At: ${booking.createdAt} (Type: ${typeof booking.createdAt})`);
        console.log(`  Inflatable: ${booking.inflatableName || booking.inflatableType}`);
        
        if (booking.actualDeliveryDate) {
          const deliveryDate = new Date(booking.actualDeliveryDate);
          console.log(`  Parsed Delivery Date: ${deliveryDate}`);
          console.log(`  Delivery Date toString(): ${deliveryDate.toString()}`);
          console.log(`  Delivery Date toDateString(): ${deliveryDate.toDateString()}`);
          console.log(`  Delivery Date toISOString(): ${deliveryDate.toISOString()}`);
        }
        console.log('---');
      });
    }
    
    console.log('\n📜 LEGACY BOOKINGS:');
    const legacyBookingsRef = ref(db, 'legacyBookings');
    const legacySnapshot = await get(legacyBookingsRef);
    
    if (legacySnapshot.exists()) {
      const legacyBookings = Object.entries(legacySnapshot.val());
      console.log(`Found ${legacyBookings.length} legacy bookings\n`);
      
      legacyBookings.slice(0, 3).forEach(([bookingId, booking]) => {
        console.log(`Legacy Booking ID: ${bookingId}`);
        console.log(`  Status: ${booking.status}`);
        console.log(`  Event Date: ${booking.orderDetails?.eventDate} (Type: ${typeof booking.orderDetails?.eventDate})`);
        console.log(`  Contract Date: ${booking.contractDate} (Type: ${typeof booking.contractDate})`);
        
        if (booking.orderDetails?.eventDate) {
          const eventDate = new Date(booking.orderDetails.eventDate);
          console.log(`  Parsed Event Date: ${eventDate.toString()}`);
          console.log(`  Event Date toDateString(): ${eventDate.toDateString()}`);
        }
        
        console.log(`  Items:`, booking.orderDetails?.items?.map(item => ({
          name: item.name,
          quantity: item.quantity
        })));
        console.log('---');
      });
    }
    
    // Test date calculations for specific case
    console.log('\n🧮 DATE CALCULATION TESTING:');
    const today = new Date();
    console.log(`Today: ${today.toString()}`);
    console.log(`Today toDateString(): ${today.toDateString()}`);
    
    // Test the calculateFirstWeekdayInMonth logic
    console.log('\nTesting calculateFirstWeekdayInMonth for "tuesday":');
    const weekday = 'tuesday';
    const targetWeekday = ['monday', 'tuesday', 'wednesday', 'thursday'].indexOf(weekday.toLowerCase());
    console.log(`Target weekday index: ${targetWeekday}`);
    
    let currentDate = new Date(today);
    console.log(`Starting from: ${currentDate.toString()}`);
    
    while (currentDate <= new Date(today.getTime() + 120 * 24 * 60 * 60 * 1000)) {
      const dayOfWeek = currentDate.getDay();
      const targetDay = targetWeekday + 1;
      const dayOfMonth = currentDate.getDate();
      
      if (dayOfWeek === targetDay && dayOfMonth <= 7) {
        const diffInDays = Math.ceil((currentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`Found first Tuesday in month: ${currentDate.toString()}`);
        console.log(`Date string: ${currentDate.toDateString()}`);
        console.log(`Days from today: ${diffInDays}`);
        
        if (diffInDays >= 2) {
          console.log(`✅ This date meets the 2-day minimum requirement`);
          break;
        } else {
          console.log(`❌ This date is too soon (< 2 days)`);
        }
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
  } catch (error) {
    console.error('Error debugging booking dates:', error);
  }
}

debugBookingDates();