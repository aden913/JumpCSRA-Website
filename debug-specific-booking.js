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

// Replicate the exact logic from availability checking
function calculateFirstWeekdayInMonth(weekday) {
  const today = new Date();
  const targetWeekday = ['monday', 'tuesday', 'wednesday', 'thursday'].indexOf(weekday.toLowerCase());
  
  if (targetWeekday === -1) return today;
  
  let currentDate = new Date(today);
  
  while (currentDate <= new Date(today.getTime() + 120 * 24 * 60 * 60 * 1000)) {
    const dayOfWeek = currentDate.getDay();
    const targetDay = targetWeekday + 1;
    const dayOfMonth = currentDate.getDate();
    
    if (dayOfWeek === targetDay && dayOfMonth <= 7) {
      const diffInDays = Math.ceil((currentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffInDays >= 2) {
        return new Date(currentDate);
      }
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return today;
}

function parseDuration(duration) {
  if (!duration) return 1;
  
  // Extract number and unit from duration string
  const match = duration.match(/(\d+)\s*(hours?|hrs?|days?|d)?/i);
  if (!match) return 1;
  
  const value = parseInt(match[1]);
  const unit = match[2]?.toLowerCase() || 'days';
  
  console.log(`  Duration parsing: "${duration}" → value: ${value}, unit: "${unit}"`);
  
  // Convert to days
  if (unit.startsWith('hour') || unit.startsWith('hr')) {
    const days = Math.max(1, Math.ceil(value / 24));
    console.log(`  Converting ${value} hours to ${days} days`);
    return days;
  } else {
    console.log(`  Using ${value} days directly`);
    return value;
  }
}

function getBookedItemQuantity(items, targetName) {
  if (!items || !Array.isArray(items)) return 0;
  
  const item = items.find(item => item.name === targetName);
  return item ? (item.quantity || 1) : 0;
}

async function debugSpecificBooking() {
  console.log('🔍 DEBUGGING SPECIFIC BOOKING: 1763919745929n907w5hvp\n');
  
  try {
    // Get the specific booking
    const bookingRef = ref(db, 'bookings/1763919745929n907w5hvp');
    const snapshot = await get(bookingRef);
    
    if (!snapshot.exists()) {
      console.log('❌ Booking not found in database!');
      return;
    }
    
    const booking = snapshot.val();
    console.log('📋 BOOKING DATA:');
    console.log('  Booking ID:', '1763919745929n907w5hvp');
    console.log('  Status:', booking.status);
    console.log('  Customer ID:', booking.customerID || booking.userId);
    console.log('  Created At:', booking.createdAt);
    console.log('  Event Date (raw):', booking.orderDetails?.eventDate);
    console.log('  Duration:', booking.orderDetails?.duration);
    console.log('  Items:', booking.orderDetails?.items);
    
    // Test the date parsing logic
    console.log('\n🗓️ DATE PARSING TEST:');
    let eventDateStr = booking.orderDetails?.eventDate || booking.createdAt;
    console.log('  Original eventDateStr:', eventDateStr);
    
    if (eventDateStr && typeof eventDateStr === 'string' && eventDateStr.includes(' - ')) {
      eventDateStr = eventDateStr.split(' - ')[0].trim();
      console.log('  After range parsing:', eventDateStr);
    }
    
    const bookingStart = new Date(eventDateStr);
    const bookingEnd = new Date(bookingStart);
    
    console.log('  Parsed booking start:', bookingStart.toString());
    console.log('  Is valid date?', !isNaN(bookingStart.getTime()));
    
    if (isNaN(bookingStart.getTime())) {
      console.log('❌ DATE PARSING FAILED - This booking will be skipped in conflict detection!');
      return;
    }
    
    // Add duration
    const duration = parseDuration(booking.orderDetails?.duration);
    bookingEnd.setDate(bookingEnd.getDate() + duration);
    
    console.log('  Duration added:', duration, 'days');
    console.log('  Booking end date:', bookingEnd.toString());
    console.log('  Booking period:', bookingStart.toDateString(), 'to', bookingEnd.toDateString());
    
    // Test membership delivery date calculation
    console.log('\n🎪 MEMBERSHIP DATE CALCULATION:');
    const membershipDate = calculateFirstWeekdayInMonth('tuesday');
    console.log('  Membership delivery date:', membershipDate.toDateString());
    
    // Test conflict detection logic
    console.log('\n⚔️ CONFLICT DETECTION TEST:');
    const deliveryFallsInBooking = membershipDate >= bookingStart && membershipDate <= bookingEnd;
    console.log('  Does membership delivery fall in booking period?', deliveryFallsInBooking);
    console.log('    Membership date >= booking start?', membershipDate >= bookingStart, `(${membershipDate.toDateString()} >= ${bookingStart.toDateString()})`);
    console.log('    Membership date <= booking end?', membershipDate <= bookingEnd, `(${membershipDate.toDateString()} <= ${bookingEnd.toDateString()})`);
    
    if (deliveryFallsInBooking) {
      // Test inflatable conflict
      console.log('\n🎈 INFLATABLE CONFLICT TEST:');
      const items = booking.orderDetails?.items || [];
      console.log('  Items in booking:', items.map(i => `${i.name} (qty: ${i.quantity || 1})`));
      
      const colorBlastQuantity = getBookedItemQuantity(items, 'Color Blast Castle');
      console.log('  Color Blast Castle quantity in this booking:', colorBlastQuantity);
      
      if (colorBlastQuantity > 0) {
        console.log('  ❌ CONFLICT DETECTED: This booking should block Color Blast Castle!');
      } else {
        console.log('  ✅ No conflict: This booking doesn\'t contain Color Blast Castle');
      }
    } else {
      console.log('  ✅ No date conflict: Membership delivery doesn\'t overlap with this booking period');
    }
    
    // Test status filtering
    console.log('\n🔒 STATUS FILTERING TEST:');
    const statusExcluded = booking.status === 'cancelled';
    console.log('  Is booking cancelled (excluded)?', statusExcluded);
    
    if (statusExcluded) {
      console.log('  ⚠️ This booking is cancelled and will be excluded from conflict detection');
    } else {
      console.log('  ✅ This booking status allows it to be included in conflict detection');
    }
    
  } catch (error) {
    console.error('Error debugging booking:', error);
  }
}

debugSpecificBooking();