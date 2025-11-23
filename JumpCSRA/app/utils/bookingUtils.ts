import { getDatabase, ref, get } from "firebase/database";
import { initializeApp, getApps } from "firebase/app";
import { firebaseConfig } from "../components/FirebaseConfig";

export async function getUnavailableInflateables(startDate: Date, endDate: Date): Promise<Set<string>> {
  
  // Convert to date-only strings to avoid timezone issues
  const selectedStartDay = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const selectedEndDay = endDate.toISOString().split('T')[0]; // YYYY-MM-DD
  
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
  const db = getDatabase();
  const unavailable = new Set<string>();
  
  // Check regular bookings
  const bookingsRef = ref(db, "bookings");
  const snapshot = await get(bookingsRef);
  
  if (snapshot.exists()) {
    const bookings = snapshot.val();
    
    Object.entries(bookings).forEach(([bookingId, booking]: [string, any]) => {
      // Skip membershipBookings node (handled separately)
      if (bookingId === 'membershipBookings') return;
      
      // Only consider bookings that occupy inventory (deferred, pending, confirmed)
      // Completed bookings don't occupy inventory since the event is finished
      if (booking.status === "deferred" || booking.status === "pending" || booking.status === "confirmed") {
        // Validate dates before processing
        if (!booking.startDate || !booking.endDate) {
          return; // Skip this booking
        }
        
        const bookingStart = new Date(booking.startDate);
        const bookingEnd = new Date(booking.endDate);
        
        // Check if dates are valid
        if (isNaN(bookingStart.getTime()) || isNaN(bookingEnd.getTime())) {
          return; // Skip this booking
        }
        
        // Convert booking dates to date-only strings
        const bookingStartDay = bookingStart.toISOString().split('T')[0];
        const bookingEndDay = bookingEnd.toISOString().split('T')[0];
        
        // Check for day overlap (if any day overlaps, consider it unavailable)
        const hasOverlap = (bookingStartDay <= selectedEndDay && bookingEndDay >= selectedStartDay);
        
        if (hasOverlap) {
          if (Array.isArray(booking.inflateableIDs)) {
            booking.inflateableIDs.forEach((id: string) => {
              unavailable.add(id);
            });
          }
        }
      }
    });
  }
  
  // Check membership bookings
  const membershipBookingsRef = ref(db, "bookings/membershipBookings");
  const membershipSnapshot = await get(membershipBookingsRef);
  
  if (membershipSnapshot.exists()) {
    const membershipBookings = membershipSnapshot.val();
    
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
        
        if (hasOverlap) {
          // Add the membership inflatable to unavailable set
          if (booking.inflatableName) {
            unavailable.add(booking.inflatableName);
          }
          if (booking.inflatableType && booking.inflatableType !== booking.inflatableName) {
            unavailable.add(booking.inflatableType);
          }
        }
      }
    });
  }
  
  return unavailable;
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
