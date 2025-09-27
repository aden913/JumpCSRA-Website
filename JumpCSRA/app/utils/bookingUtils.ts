import { getDatabase, ref, get } from "firebase/database";
import { initializeApp, getApps } from "firebase/app";
import { firebaseConfig } from "../components/FirebaseConfig";

export async function getUnavailableInflateables(startDate: Date, endDate: Date): Promise<Set<string>> {
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
  const db = getDatabase();
  const bookingsRef = ref(db, "bookings");
  const snapshot = await get(bookingsRef);
  const unavailable = new Set<string>();
  if (snapshot.exists()) {
    const bookings = snapshot.val();
    Object.values(bookings).forEach((booking: any) => {
      // Only consider pending or confirmed bookings
      if (booking.status === "pending" || booking.status === "confirmed") {
        const bookingStart = new Date(booking.startDate);
        const bookingEnd = new Date(booking.endDate);
        // Check for overlap
        if (
          (bookingStart <= endDate && bookingEnd >= startDate)
        ) {
          if (Array.isArray(booking.inflateableIDs)) {
            booking.inflateableIDs.forEach((id: string) => unavailable.add(id));
          }
        }
      }
    });
  }
  return unavailable;
}
