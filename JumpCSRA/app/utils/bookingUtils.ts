import { getDatabase, ref, get } from "firebase/database";
import { initializeApp, getApps } from "firebase/app";
import { firebaseConfig } from "../components/FirebaseConfig";

export async function getUnavailableInflateables(startDate: Date, endDate: Date): Promise<Set<string>> {
  console.log('🔍 Checking availability for date range:', startDate.toLocaleDateString(), '-', endDate.toLocaleDateString());
  
  // Convert to date-only strings to avoid timezone issues
  const selectedStartDay = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const selectedEndDay = endDate.toISOString().split('T')[0]; // YYYY-MM-DD
  
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
  const db = getDatabase();
  const unavailable = new Set<string>();
  
  // Check regular bookings in the new database structure
  const bookingsRef = ref(db, "bookings");
  const snapshot = await get(bookingsRef);
  
  if (snapshot.exists()) {
    const bookings = snapshot.val();
    console.log('📊 Found', Object.keys(bookings).length, 'total bookings to check');
    
    Object.entries(bookings).forEach(([bookingId, booking]: [string, any]) => {
      // Skip membershipBookings node (handled separately)
      if (bookingId === 'membershipBookings') return;
      
      // Only consider bookings that occupy inventory (deferred, pending, confirmed)
      // Completed bookings don't occupy inventory since the event is finished
      // Cancelled bookings also don't occupy inventory
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
        
        items.forEach((item: any) => {
          if (item.name && !item.name.toLowerCase().includes('gift card') && !item.name.toLowerCase().includes('membership')) {
            console.log('🚫 Marking as unavailable:', item.name, '(quantity:', item.quantity, ')');
            unavailable.add(item.name);
          }
        });
      }
    });
  }
  
  // Check membership bookings (keeping existing logic for this part)
  const membershipBookingsRef = ref(db, "bookings/membershipBookings");
  const membershipSnapshot = await get(membershipBookingsRef);
  
  if (membershipSnapshot.exists()) {
    const membershipBookings = membershipSnapshot.val();
    console.log('🏆 Found', Object.keys(membershipBookings).length, 'membership bookings to check');
    
    Object.entries(membershipBookings).forEach(([bookingId, booking]: [string, any]) => {
      // Only consider confirmed membership bookings
      if (booking.bookingStatus === "confirmed") {
        
        // Calculate delivery date
        let deliveryDate: Date;
        if (booking.actualDeliveryDate) {
          deliveryDate = new Date(booking.actualDeliveryDate);
        } else {
          // Calculate next occurrence of the weekday
          deliveryDate = calculateNextWeekdayDate(booking.selectedWeekday);
        }
        
        // Check if delivery date is valid
        if (isNaN(deliveryDate.getTime())) {
          return; // Skip this booking
        }
        
        // Convert delivery date to date-only string
        const deliveryDay = deliveryDate.toISOString().split('T')[0];
        
        // Check if the delivery date overlaps with the selected date range
        // Membership deliveries are typically 1 day events
        const hasOverlap = (deliveryDay >= selectedStartDay && deliveryDay <= selectedEndDay);
        
        console.log('🏆 Membership booking', bookingId, 'delivery:', deliveryDay, 'vs selected:', selectedStartDay, '-', selectedEndDay, 'overlap:', hasOverlap);
        
        if (hasOverlap) {
          // Add the membership inflatable to unavailable set
          if (booking.inflatableName) {
            console.log('🚫 Membership marking as unavailable:', booking.inflatableName);
            unavailable.add(booking.inflatableName);
          }
          if (booking.inflatableType && booking.inflatableType !== booking.inflatableName) {
            console.log('🚫 Membership marking as unavailable:', booking.inflatableType);
            unavailable.add(booking.inflatableType);
          }
        }
      }
    });
  }
  
  console.log('🚫 Final unavailable items:', Array.from(unavailable));
  return unavailable;
}

// Function to validate and clean cart items based on availability
export async function validateAndCleanCart(
  cartItems: any[], 
  startDate: Date, 
  endDate: Date,
  onItemsRemoved?: (removedItems: any[]) => void
): Promise<any[]> {
  console.log('🛒 Validating cart with', cartItems.length, 'items for dates:', startDate.toLocaleDateString(), '-', endDate.toLocaleDateString());
  
  const unavailableItems = await getUnavailableInflateables(startDate, endDate);
  const validItems: any[] = [];
  const removedItems: any[] = [];
  
  cartItems.forEach(item => {
    if (unavailableItems.has(item.name)) {
      console.log('❌ Removing unavailable item from cart:', item.name);
      removedItems.push(item);
    } else {
      validItems.push(item);
    }
  });
  
  // Notify caller about removed items
  if (removedItems.length > 0 && onItemsRemoved) {
    onItemsRemoved(removedItems);
  }
  
  console.log('✅ Cart validation complete:', validItems.length, 'items remaining,', removedItems.length, 'items removed');
  return validItems;
}

// Helper function to calculate next weekday date
function calculateNextWeekdayDate(weekday: string): Date {
  const today = new Date();
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDay = weekdays.indexOf(weekday);
  
  if (targetDay === -1) {
    // Invalid weekday, return today
    return today;
  }
  
  const currentDay = today.getDay();
  let daysUntilTarget = (targetDay - currentDay + 7) % 7;
  
  // If today is the target day, get next week's occurrence
  if (daysUntilTarget === 0) {
    daysUntilTarget = 7;
  }
  
  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntilTarget);
  
  return nextDate;
}
