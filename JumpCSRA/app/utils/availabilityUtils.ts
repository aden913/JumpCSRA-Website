import { getDatabase, ref, get } from "firebase/database";
import type { BookingData } from "./databaseUtils";

export interface ItemAvailability {
  itemName: string;
  totalQuantity: number;
  availableQuantity: number;
  bookedQuantity: number;
}

/**
 * Check item availability for specific date range
 * @param itemName - Name of the item to check
 * @param totalQuantity - Total inventory for this item
 * @param startDate - Start date of desired booking
 * @param endDate - End date of desired booking
 * @returns Available quantity for the date range
 */
export async function checkItemAvailability(
  itemName: string,
  totalQuantity: number,
  startDate: Date,
  endDate: Date
): Promise<ItemAvailability> {
  const database = getDatabase();
  
  try {
    // Load all bookings from both new and legacy structures
    const [newBookings, legacyBookings] = await Promise.all([
      loadNewBookings(),
      loadLegacyBookings()
    ]);
    
    let bookedQuantity = 0;
    
    // Check new structure bookings
    newBookings.forEach(booking => {
      if (booking.status === 'cancelled') return; // Skip cancelled bookings
      
      const bookingStart = new Date(booking.orderDetails?.eventDate || booking.createdAt);
      const bookingEnd = new Date(bookingStart);
      
      // Add duration if specified (default to 1 day)
      const duration = parseDuration(booking.orderDetails?.duration);
      bookingEnd.setDate(bookingEnd.getDate() + duration);
      
      // Check for date overlap
      if (datesOverlap(startDate, endDate, bookingStart, bookingEnd)) {
        // Check if this booking contains our item
        const itemQuantity = getBookedItemQuantity(booking.orderDetails?.items || [], itemName);
        bookedQuantity += itemQuantity;
      }
    });
    
    // Check legacy structure bookings
    legacyBookings.forEach(booking => {
      if (booking.status === 'cancelled') return; // Skip cancelled bookings
      
      const bookingStart = new Date(booking.orderDetails?.eventDate || booking.contractDate);
      const bookingEnd = new Date(bookingStart);
      
      // Add duration if specified (default to 1 day)
      const duration = parseDuration(booking.orderDetails?.duration);
      bookingEnd.setDate(bookingEnd.getDate() + duration);
      
      // Check for date overlap
      if (datesOverlap(startDate, endDate, bookingStart, bookingEnd)) {
        // Check if this booking contains our item
        const itemQuantity = getBookedItemQuantity(booking.orderDetails?.items || [], itemName);
        bookedQuantity += itemQuantity;
      }
    });
    
    const availableQuantity = Math.max(0, totalQuantity - bookedQuantity);
    
    return {
      itemName,
      totalQuantity,
      availableQuantity,
      bookedQuantity
    };
    
  } catch (error) {
    console.error('Error checking item availability:', error);
    // Return full availability on error to avoid blocking bookings
    return {
      itemName,
      totalQuantity,
      availableQuantity: totalQuantity,
      bookedQuantity: 0
    };
  }
}

/**
 * Check availability for multiple items at once
 */
export async function checkMultipleItemsAvailability(
  items: Array<{name: string, quantity: number}>,
  startDate: Date,
  endDate: Date
): Promise<Map<string, ItemAvailability>> {
  // Load inflateables data to get total quantities
  const inflateables = await loadInflateablesData();
  const availabilityMap = new Map<string, ItemAvailability>();
  
  // Check each unique item
  const promises = items.map(async item => {
    const inflateable = inflateables.find(inf => inf.name === item.name);
    if (inflateable) {
      const availability = await checkItemAvailability(
        item.name,
        inflateable.quantity || 1,
        startDate,
        endDate
      );
      availabilityMap.set(item.name, availability);
    }
  });
  
  await Promise.all(promises);
  return availabilityMap;
}

// Helper functions
async function loadNewBookings(): Promise<BookingData[]> {
  const database = getDatabase();
  const bookingsRef = ref(database, 'bookings');
  const snapshot = await get(bookingsRef);
  
  if (!snapshot.exists()) return [];
  
  const bookingsData = snapshot.val();
  return Object.values(bookingsData) as BookingData[];
}

async function loadLegacyBookings(): Promise<any[]> {
  const database = getDatabase();
  const contractsRef = ref(database, 'contracts');
  const snapshot = await get(contractsRef);
  
  if (!snapshot.exists()) return [];
  
  const contractsData = snapshot.val();
  return Object.values(contractsData);
}

async function loadInflateablesData(): Promise<any[]> {
  try {
    const response = await fetch('/inflateables-firebase.json');
    const data = await response.json();
    return data.inflateables || [];
  } catch (error) {
    console.error('Error loading inflateables data:', error);
    return [];
  }
}

function parseDuration(duration?: string): number {
  if (!duration) return 1;
  
  const match = duration.match(/(\d+)/);
  return match ? parseInt(match[1]) : 1;
}

function datesOverlap(
  start1: Date, 
  end1: Date, 
  start2: Date, 
  end2: Date
): boolean {
  return start1 <= end2 && start2 <= end1;
}

function getBookedItemQuantity(items: any[], itemName: string): number {
  const item = items.find(item => item.name === itemName);
  return item ? (item.quantity || 1) : 0;
}