import { getDatabase, ref, get } from "firebase/database";
import { initializeApp, getApps } from "firebase/app";
import { firebaseConfig } from "../components/FirebaseConfig";

export async function getUnavailableInflateables(
  startDate: Date, 
  endDate: Date, 
  excludeBookingId?: string
): Promise<Set<string>> {
  // Checking availability for date range
  
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
    // Found bookings to check
    
    Object.entries(bookings).forEach(([bookingId, booking]: [string, any]) => {
      // Skip membershipBookings node (handled separately)
      if (bookingId === 'membershipBookings') return;
      
      // Skip the current booking if we're resuming/editing it
      if (excludeBookingId && bookingId === excludeBookingId) {
        return;
      }
      
      // Only consider bookings that occupy inventory (confirmed, deposited)
      // Pending and deferred bookings don't count until confirmed/deposited
      // Completed bookings don't occupy inventory since the event is finished
      // Cancelled bookings also don't occupy inventory
      if (!['confirmed', 'deposited'].includes(booking.status)) {
        return;
      }
      
      // Checking booking
      
      // Parse the eventDate string (format: "MM/DD/YYYY - MM/DD/YYYY")
      const eventDateString = booking.orderDetails?.eventDate;
      if (!eventDateString) {
        // Booking missing eventDate
        return;
      }
      
      // Extract start and end dates from the string
      const dateRange = eventDateString.split(' - ');
      if (dateRange.length !== 2) {
        // Booking has invalid eventDate format
        return;
      }
      
      const bookingStart = new Date(dateRange[0]);
      const bookingEnd = new Date(dateRange[1]);
      
      // Check if dates are valid
      if (isNaN(bookingStart.getTime()) || isNaN(bookingEnd.getTime())) {
        // Booking has invalid dates
        return;
      }
      
      // Convert booking dates to date-only strings
      const bookingStartDay = bookingStart.toISOString().split('T')[0];
      const bookingEndDay = bookingEnd.toISOString().split('T')[0];
      
      // Check for day overlap (if any day overlaps, consider it unavailable)
      const hasOverlap = (bookingStartDay <= selectedEndDay && bookingEndDay >= selectedStartDay);
      
      // Booking dates overlap check
      
      if (hasOverlap) {
        // Get items from the booking and mark them as unavailable
        const items = booking.orderDetails?.items || [];
        // Booking has items
        
        items.forEach((item: any) => {
          if (item.name && !item.name.toLowerCase().includes('gift card') && !item.name.toLowerCase().includes('membership')) {
            // Marking as unavailable
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
    // Found membership bookings to check
    
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
        
        // Membership booking delivery overlap check
        
        if (hasOverlap) {
          // Add the membership inflatable to unavailable set
          if (booking.inflatableName) {
            // Debug log removed
            unavailable.add(booking.inflatableName);
          }
          if (booking.inflatableType && booking.inflatableType !== booking.inflatableName) {
            // Debug log removed
            unavailable.add(booking.inflatableType);
          }
        }
      }
    });
  }
  
  // Final unavailable items
  return unavailable;
}

// Function to validate and clean cart items based on availability
export async function validateAndCleanCart(
  cartItems: any[], 
  startDate: Date, 
  endDate: Date,
  onItemsRemoved?: (removedItems: any[]) => void,
  excludeBookingId?: string
): Promise<any[]> {
  // Validating cart
  
  const unavailableItems = await getUnavailableInflateables(startDate, endDate, excludeBookingId);
  const validItems: any[] = [];
  const removedItems: any[] = [];
  
  cartItems.forEach(item => {
    if (unavailableItems.has(item.name)) {
      // Removing unavailable item from cart
      removedItems.push(item);
    } else {
      validItems.push(item);
    }
  });
  
  // Notify caller about removed items
  if (removedItems.length > 0 && onItemsRemoved) {
    onItemsRemoved(removedItems);
  }
  
  // Cart validation complete
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
