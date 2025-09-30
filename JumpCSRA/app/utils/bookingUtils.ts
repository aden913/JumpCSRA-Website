import { getDatabase, ref, get } from "firebase/database";
import { initializeApp, getApps } from "firebase/app";
import { firebaseConfig } from "../components/FirebaseConfig";

export async function getUnavailableInflateables(startDate: Date, endDate: Date): Promise<Set<string>> {
  console.log('=== BOOKING AVAILABILITY CHECK ===');
  console.log('Original selected dates:', startDate.toISOString(), 'to', endDate.toISOString());
  
  // Convert to date-only strings to avoid timezone issues
  const selectedStartDay = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const selectedEndDay = endDate.toISOString().split('T')[0]; // YYYY-MM-DD
  console.log('Checking availability for days:', selectedStartDay, 'to', selectedEndDay);
  
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
  const db = getDatabase();
  const bookingsRef = ref(db, "bookings");
  const snapshot = await get(bookingsRef);
  const unavailable = new Set<string>();
  
  if (snapshot.exists()) {
    const bookings = snapshot.val();
    console.log('Found bookings in database:', bookings);
    
    Object.entries(bookings).forEach(([bookingId, booking]: [string, any]) => {
      console.log(`Processing booking ${bookingId}:`, booking);
      
      // Only consider pending or confirmed bookings
      if (booking.status === "pending" || booking.status === "confirmed") {
        const bookingStart = new Date(booking.startDate);
        const bookingEnd = new Date(booking.endDate);
        
        // Convert booking dates to date-only strings
        const bookingStartDay = bookingStart.toISOString().split('T')[0];
        const bookingEndDay = bookingEnd.toISOString().split('T')[0];
        
        console.log(`Booking ${bookingId} days:`, bookingStartDay, 'to', bookingEndDay);
        
        // Check for day overlap (if any day overlaps, consider it unavailable)
        const hasOverlap = (bookingStartDay <= selectedEndDay && bookingEndDay >= selectedStartDay);
        console.log(`Booking ${bookingId} overlaps with selected days:`, hasOverlap);
        
        if (hasOverlap) {
          if (Array.isArray(booking.inflateableIDs)) {
            console.log(`Adding unavailable inflateables from booking ${bookingId}:`, booking.inflateableIDs);
            booking.inflateableIDs.forEach((id: string) => {
              console.log(`Marking as unavailable: "${id}"`);
              unavailable.add(id);
            });
          } else {
            console.log(`Booking ${bookingId} has invalid inflateableIDs:`, booking.inflateableIDs);
          }
        }
      } else {
        console.log(`Skipping booking ${bookingId} with status:`, booking.status);
      }
    });
  } else {
    console.log('No bookings found in database');
  }
  
  console.log('Final unavailable inflateables set:', Array.from(unavailable));
  console.log('=== END BOOKING AVAILABILITY CHECK ===');
  return unavailable;
}
