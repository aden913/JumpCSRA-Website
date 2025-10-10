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
  const bookingsRef = ref(db, "bookings");
  const snapshot = await get(bookingsRef);
  const unavailable = new Set<string>();
  
  if (snapshot.exists()) {
    const bookings = snapshot.val();
    
    Object.entries(bookings).forEach(([bookingId, booking]: [string, any]) => {
      
      // Only consider pending or confirmed bookings
      if (booking.status === "pending" || booking.status === "confirmed") {
        const bookingStart = new Date(booking.startDate);
        const bookingEnd = new Date(booking.endDate);
        
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
          } else {
          }
        }
      } else {
      }
    });
  } else {
    console.log('No bookings found in database');
  }
  
  return unavailable;
}
