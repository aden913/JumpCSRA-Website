import { getDatabase, ref, get } from "firebase/database";
import type { BookingData } from "./databaseUtils";

export interface ItemAvailability {
  itemName: string;
  totalQuantity: number;
  availableQuantity: number;
  bookedQuantity: number;
  conflictingBookings?: Array<{
    type: 'regular' | 'membership';
    bookingId: string;
    date: string;
    userId?: string;
  }>;
}

export interface MembershipBooking {
  bookingId: string;
  userId: string;
  selectedWeekday: string;
  inflatableType: string;
  inflatableName: string;
  actualDeliveryDate: string;
  bookingStatus: string;
  createdAt: number;
}

/**
 * Check item availability for specific date range including membership bookings
 * @param itemName - Name of the item to check
 * @param totalQuantity - Total inventory for this item
 * @param startDate - Start date of desired booking
 * @param endDate - End date of desired booking
 * @param excludeBookingId - Optional booking ID to exclude from conflict checking
 * @returns Available quantity for the date range
 */
export async function checkItemAvailability(
  itemName: string,
  totalQuantity: number,
  startDate: Date,
  endDate: Date,
  excludeBookingId?: string
): Promise<ItemAvailability> {
  
  const database = getDatabase();
  
  try {
    // Load all booking types
    const [regularBookings, membershipBookings, legacyBookings] = await Promise.all([
      loadRegularBookings(),
      loadMembershipBookings(),
      loadLegacyBookings()
    ]);
    
    console.log(`📋 [AVAILABILITY] Loaded ${regularBookings.length} regular bookings, ${membershipBookings.length} membership bookings, ${legacyBookings.length} legacy bookings`);
    
    let bookedQuantity = 0;
    const conflictingBookings: ItemAvailability['conflictingBookings'] = [];
    
    console.log(`🔍 [AVAILABILITY] Checking ${itemName} for ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // Check regular bookings (only count confirmed and deposited bookings)
    regularBookings.forEach(booking => {
      if (!['confirmed', 'deposited'].includes(booking.status) || booking.bookingId === excludeBookingId) {
        // Excluding regular booking (not confirmed/deposited or is excluded)
        return;
      }
      
      // Use eventStart/eventEnd if available (new format), otherwise calculate from eventDate and duration
      let bookingStart: Date;
      let bookingEnd: Date;
      
      if (booking.orderDetails?.eventStart && booking.orderDetails?.eventEnd) {
        // New format with explicit start and end times
        bookingStart = new Date(booking.orderDetails.eventStart);
        bookingEnd = new Date(booking.orderDetails.eventEnd);
        
        // Validate dates
        if (isNaN(bookingStart.getTime()) || isNaN(bookingEnd.getTime())) {
          console.warn(`  ⚠️ Invalid eventStart/eventEnd for booking ${booking.bookingId}, falling back to eventDate`);
          bookingStart = new Date(booking.orderDetails?.eventDate || booking.createdAt);
          bookingEnd = new Date(bookingStart);
          const duration = parseDuration(booking.orderDetails?.duration);
          bookingEnd.setDate(bookingEnd.getDate() + duration);
        } else {
          console.log(`  📅 Booking ${booking.bookingId}: Using eventStart/eventEnd: ${bookingStart.toISOString()} to ${bookingEnd.toISOString()}`);
        }
      } else {
        // Legacy format - calculate from eventDate and duration
        bookingStart = new Date(booking.orderDetails?.eventDate || booking.createdAt);
        bookingEnd = new Date(bookingStart);
        const duration = parseDuration(booking.orderDetails?.duration);
        bookingEnd.setDate(bookingEnd.getDate() + duration);
        
        // Validate dates
        if (isNaN(bookingStart.getTime()) || isNaN(bookingEnd.getTime())) {
          console.warn(`  ⚠️ Invalid dates calculated from eventDate for booking ${booking.bookingId}, skipping`);
          return;
        }
        
        console.log(`  📅 Booking ${booking.bookingId}: Calculated from duration: ${bookingStart.toISOString()} to ${bookingEnd.toISOString()}`);
      }
      
      // Check for date overlap
      if (datesOverlap(startDate, endDate, bookingStart, bookingEnd)) {
        const itemQuantity = getBookedItemQuantity(booking.orderDetails?.items || [], itemName);
        if (itemQuantity > 0) {
          console.log(`  ⚠️ CONFLICT: Booking ${booking.bookingId} has ${itemQuantity} of ${itemName}`);
          bookedQuantity += itemQuantity;
          conflictingBookings?.push({
            type: 'regular',
            bookingId: booking.bookingId || 'unknown',
            date: bookingStart.toISOString().split('T')[0],
            userId: booking.userId
          });
        }
      }
    });
    
    // Check membership bookings
    membershipBookings.forEach(booking => {
      if (booking.bookingStatus === 'cancelled' || booking.bookingId === excludeBookingId) return;
      
      // Parse the actual delivery date or calculate based on weekday
      const deliveryDate = booking.actualDeliveryDate 
        ? new Date(booking.actualDeliveryDate)
        : calculateNextWeekdayDate(booking.selectedWeekday);
      
      const bookingStart = deliveryDate;
      const bookingEnd = new Date(deliveryDate);
      bookingEnd.setDate(bookingEnd.getDate() + 1); // Membership bookings are typically 1 day
      
      // Validate dates
      if (isNaN(bookingStart.getTime()) || isNaN(bookingEnd.getTime())) {
        console.warn(`  ⚠️ Invalid dates for membership booking ${booking.bookingId}, skipping`);
        return;
      }
      
      // Check for date overlap
      if (datesOverlap(startDate, endDate, bookingStart, bookingEnd)) {
        // Check if this membership booking uses the requested item
        if (booking.inflatableName === itemName || booking.inflatableType === itemName) {
          bookedQuantity += 1; // Membership bookings typically book 1 quantity
          conflictingBookings?.push({
            type: 'membership',
            bookingId: booking.bookingId,
            date: bookingStart.toISOString().split('T')[0],
            userId: booking.userId
          });
        }
      }
    });
    
    // Check legacy structure bookings
    legacyBookings.forEach(booking => {
      if (booking.status === 'cancelled' || booking.bookingId === excludeBookingId) return;
      
      // Use eventStart/eventEnd if available (new format), otherwise calculate from eventDate and duration
      let bookingStart: Date;
      let bookingEnd: Date;
      
      if (booking.orderDetails?.eventStart && booking.orderDetails?.eventEnd) {
        // New format with explicit start and end times
        bookingStart = new Date(booking.orderDetails.eventStart);
        bookingEnd = new Date(booking.orderDetails.eventEnd);
        
        // Validate dates
        if (isNaN(bookingStart.getTime()) || isNaN(bookingEnd.getTime())) {
          console.warn(`  ⚠️ Invalid eventStart/eventEnd for legacy booking ${booking.bookingId}, falling back to eventDate`);
          bookingStart = new Date(booking.orderDetails?.eventDate || booking.eventDate || booking.createdAt);
          bookingEnd = new Date(bookingStart);
          const duration = parseDuration(booking.orderDetails?.duration || booking.duration);
          bookingEnd.setDate(bookingEnd.getDate() + duration);
          
          if (isNaN(bookingStart.getTime()) || isNaN(bookingEnd.getTime())) {
            console.warn(`  ⚠️ Still invalid dates for legacy booking ${booking.bookingId}, skipping`);
            return;
          }
        }
      } else {
        // Legacy format - calculate from eventDate and duration
        bookingStart = new Date(booking.orderDetails?.eventDate || booking.contractDate);
        bookingEnd = new Date(bookingStart);
        const duration = parseDuration(booking.orderDetails?.duration);
        bookingEnd.setDate(bookingEnd.getDate() + duration);
        
        // Validate dates
        if (isNaN(bookingStart.getTime()) || isNaN(bookingEnd.getTime())) {
          console.warn(`  ⚠️ Invalid dates calculated from legacy eventDate for booking ${booking.bookingId}, skipping`);
          return;
        }
      }
      
      // Check for date overlap
      if (datesOverlap(startDate, endDate, bookingStart, bookingEnd)) {
        const itemQuantity = getBookedItemQuantity(booking.orderDetails?.items || [], itemName);
        if (itemQuantity > 0) {
          bookedQuantity += itemQuantity;
          conflictingBookings?.push({
            type: 'regular',
            bookingId: booking.bookingId || 'legacy',
            date: bookingStart.toISOString().split('T')[0],
            userId: booking.userId
          });
        }
      }
    });
    
    console.log(`✅ [AVAILABILITY] ${itemName}: Total=${totalQuantity}, Booked=${bookedQuantity}, Available=${totalQuantity - bookedQuantity}`);
    
    const availableQuantity = Math.max(0, totalQuantity - bookedQuantity);
    
    return {
      itemName,
      totalQuantity,
      availableQuantity,
      bookedQuantity,
      conflictingBookings
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
 * Check membership inflatable availability for a specific month
 * This checks if membership inflatables are available for delivery on weekdays in the month
 */
export async function checkMembershipAvailability(
  month: number, 
  year: number,
  excludeUserId?: string
): Promise<{[inflatableName: string]: {
  available: boolean;
  conflictingDates: string[];
  totalDeliveryDays: number;
  bookedDeliveryDays: number;
}}> {
  
  try {
    const membershipBookings = await loadMembershipBookings();
    const membershipInflateables = await loadMembershipInflateables();
    
    // Get all weekdays (Mon-Thu) in the specified month
    const weekdaysInMonth = getWeekdaysInMonth(month, year);
    
    const availability: any = {};
    
    membershipInflateables.forEach(inflatable => {
      const conflictingDates: string[] = [];
      
      // Check each weekday in the month for conflicts
      weekdaysInMonth.forEach(date => {
        const conflictingBookings = membershipBookings.filter(booking => {
          if (booking.bookingStatus === 'cancelled' || booking.userId === excludeUserId) return false;
          
          const deliveryDate = booking.actualDeliveryDate 
            ? new Date(booking.actualDeliveryDate).toDateString()
            : calculateNextWeekdayDate(booking.selectedWeekday).toDateString();
          
          const checkDate = date.toDateString();
          
          return deliveryDate === checkDate && 
                 (booking.inflatableName === inflatable.name || booking.inflatableType === inflatable.name);
        });
        
        if (conflictingBookings.length > 0) {
          conflictingDates.push(date.toISOString().split('T')[0]);
        }
      });
      
      availability[inflatable.name] = {
        available: conflictingDates.length === 0,
        conflictingDates,
        totalDeliveryDays: weekdaysInMonth.length,
        bookedDeliveryDays: conflictingDates.length
      };
    });
    
    return availability;
    
  } catch (error) {
    console.error('Error checking membership availability:', error);
    return {};
  }
}

/**
 * Check availability for multiple items at once (used in checkout)
 */
export async function checkMultipleItemsAvailability(
  items: Array<{name: string, quantity: number}>,
  startDate: Date,
  endDate: Date,
  excludeBookingId?: string
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
        endDate,
        excludeBookingId
      );
      availabilityMap.set(item.name, availability);
    }
  });
  
  await Promise.all(promises);
  return availabilityMap;
}

/**
 * Get available membership inflatables for a specific weekday in the current month
 * This function checks BOTH membership bookings AND regular bookings for conflicts
 */
export async function getAvailableMembershipInflateables(
  weekday: string,
  userId?: string
): Promise<any[]> {
  
  try {
    const membershipInflateables = await loadMembershipInflateables();
    const [membershipBookings, regularBookings, legacyBookings] = await Promise.all([
      loadMembershipBookings(),
      loadRegularBookings(), 
      loadLegacyBookings()
    ]);
    
    // Use the same logic as calculateActualEventDate to find first occurrence of weekday in month
    const nextDeliveryDate = calculateFirstWeekdayInMonth(weekday);
    const deliveryDateString = nextDeliveryDate.toDateString();
    
    // Membership availability debug removed
    
    // Regular bookings debug removed
    
    const availableInflateables = membershipInflateables.filter(inflatable => {
      // Checking availability for inflatable
      
      // Check conflicts with OTHER membership bookings
      const membershipConflict = membershipBookings.find(booking => {
        // Only exclude cancelled bookings - all confirmed bookings use shared inventory
        if (booking.bookingStatus === 'cancelled') return false;
        
        const bookingDeliveryDate = booking.actualDeliveryDate 
          ? new Date(booking.actualDeliveryDate)
          : calculateFirstWeekdayInMonth(booking.selectedWeekday);
        
        const isSameDate = bookingDeliveryDate.toDateString() === deliveryDateString;
        const isSameInflatable = booking.inflatableName === inflatable.name || booking.inflatableType === inflatable.name;
        
        const conflict = isSameDate && isSameInflatable;
        if (conflict) {
          // Membership conflict found
        }
        
        return conflict;
      });
      
      // Check conflicts with REGULAR bookings
      const regularConflict = regularBookings.find(booking => {
        // Only exclude cancelled bookings - don't exclude user's own regular bookings 
        // because membership bookings should conflict with user's own regular bookings
        if (booking.status === 'cancelled') return false;
        
        // Checking regular booking
        
        // Use eventStart/eventEnd if available (new format), otherwise calculate from eventDate and duration
        let bookingStart: Date;
        let bookingEnd: Date;
        
        if (booking.orderDetails?.eventStart && booking.orderDetails?.eventEnd) {
          // New format with explicit start and end times
          bookingStart = new Date(booking.orderDetails.eventStart);
          bookingEnd = new Date(booking.orderDetails.eventEnd);
        } else {
          // Legacy format - parse event date (handle date range format "MM/DD/YYYY - MM/DD/YYYY")
          let eventDateStr = booking.orderDetails?.eventDate || booking.createdAt;
          if (eventDateStr && typeof eventDateStr === 'string' && eventDateStr.includes(' - ')) {
            // Extract start date from range format
            eventDateStr = eventDateStr.split(' - ')[0].trim();
          }
          
          bookingStart = new Date(eventDateStr);
          bookingEnd = new Date(bookingStart);
          
          // Add duration if specified (default to 1 day)
          const duration = parseDuration(booking.orderDetails?.duration);
          bookingEnd.setDate(bookingEnd.getDate() + duration);
        }
        
        // Failed to parse regular booking date
        if (isNaN(bookingStart.getTime())) {
          return false; // Skip invalid dates
        }
        
        // Check if delivery date falls within the regular booking period
        const deliveryFallsInBooking = nextDeliveryDate >= bookingStart && nextDeliveryDate <= bookingEnd;
        
        // Debug log removed
        
        if (deliveryFallsInBooking) {
          // Check if this regular booking contains our inflatable
          const itemQuantity = getBookedItemQuantity(booking.orderDetails?.items || [], inflatable.name);
          const conflict = itemQuantity > 0;
          // Regular booking conflict found
          return conflict;
        }
        
        return false;
      });
      
      // Check conflicts with LEGACY bookings
      const legacyConflict = legacyBookings.find((booking: any) => {
        // Only exclude cancelled bookings - all confirmed bookings use shared inventory
        if (booking.status === 'cancelled') return false;
        
        // Use eventStart/eventEnd if available (new format), otherwise calculate from eventDate and duration
        let bookingStart: Date;
        let bookingEnd: Date;
        
        if (booking.orderDetails?.eventStart && booking.orderDetails?.eventEnd) {
          // New format with explicit start and end times
          bookingStart = new Date(booking.orderDetails.eventStart);
          bookingEnd = new Date(booking.orderDetails.eventEnd);
        } else {
          // Legacy format - parse event date (handle date range format "MM/DD/YYYY - MM/DD/YYYY")
          let eventDateStr = booking.orderDetails?.eventDate || booking.contractDate;
          if (eventDateStr && typeof eventDateStr === 'string' && eventDateStr.includes(' - ')) {
            // Extract start date from range format
            eventDateStr = eventDateStr.split(' - ')[0].trim();
          }
          
          bookingStart = new Date(eventDateStr);
          bookingEnd = new Date(bookingStart);
          
          // Add duration if specified (default to 1 day)
          const duration = parseDuration(booking.orderDetails?.duration);
          bookingEnd.setDate(bookingEnd.getDate() + duration);
        }
        
        // Failed to parse legacy booking date
        if (isNaN(bookingStart.getTime())) {
          return false; // Skip invalid dates
        }
        
        // Check if delivery date falls within the legacy booking period
        const deliveryFallsInBooking = nextDeliveryDate >= bookingStart && nextDeliveryDate <= bookingEnd;
        
        if (deliveryFallsInBooking) {
          // Check if this legacy booking contains our inflatable
          const itemQuantity = getBookedItemQuantity(booking.orderDetails?.items || [], inflatable.name);
          const conflict = itemQuantity > 0;
          // Legacy booking conflict found
          return conflict;
        }
        
        return false;
      });
      
      // Available only if NO conflicts found with any booking type
      const isAvailable = !membershipConflict && !regularConflict && !legacyConflict;
      
      return isAvailable;
    });
    
    // Final results debug removed
    
    return availableInflateables;
    
  } catch (error) {
    console.error('Error getting available membership inflatables:', error);
    // On error, return empty array to prevent booking conflicts
    return [];
  }
}

// Helper functions
async function loadRegularBookings(): Promise<BookingData[]> {
  const database = getDatabase();
  const bookingsRef = ref(database, 'bookings');
  const snapshot = await get(bookingsRef);
  
  if (!snapshot.exists()) return [];
  
  const bookingsData = snapshot.val();
  
  // Filter out membershipBookings node and return only regular bookings
  const regularBookings: BookingData[] = [];
  Object.entries(bookingsData).forEach(([key, value]) => {
    if (key !== 'membershipBookings' && value && typeof value === 'object') {
      regularBookings.push(value as BookingData);
    }
  });
  
  return regularBookings;
}

async function loadMembershipBookings(): Promise<MembershipBooking[]> {
  const database = getDatabase();
  const membershipBookingsRef = ref(database, 'bookings/membershipBookings');
  const snapshot = await get(membershipBookingsRef);
  
  if (!snapshot.exists()) return [];
  
  const bookingsData = snapshot.val();
  return Object.values(bookingsData) as MembershipBooking[];
}

async function loadNewBookings(): Promise<BookingData[]> {
  // This is now handled by loadRegularBookings
  return await loadRegularBookings();
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
    // Load from Firebase Realtime Database instead of JSON file
    const database = getDatabase();
    const inflateablesRef = ref(database, 'inflateables');
    const snapshot = await get(inflateablesRef);
    
    if (!snapshot.exists()) {
      return [];
    }
    
    const inflateablesData = snapshot.val();
    
    // Handle both array and object formats
    let result;
    if (Array.isArray(inflateablesData)) {
      result = inflateablesData;
    } else if (inflateablesData && typeof inflateablesData === 'object') {
      result = Object.values(inflateablesData);
    } else {
      result = [];
    }
    
    // Filter items with quantity > 1
    const itemsWithQuantity = result.filter((item: any) => item.quantity && item.quantity > 1);
    
    return result;
  } catch (error) {
    return [];
  }
}

async function loadMembershipInflateables(): Promise<any[]> {
  try {
    const inflateables = await loadInflateablesData();
    // Filter only items marked as membership: true
    return inflateables.filter((item: any) => item.membership === true);
  } catch (error) {
    console.error('Error loading membership inflatables:', error);
    return [];
  }
}

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

// Function to calculate the first occurrence of weekday in the month (matching calculateActualEventDate logic)
function calculateFirstWeekdayInMonth(weekday: string): Date {
  // calculateFirstWeekdayInMonth debug removed
  
  const today = new Date();
  const targetWeekday = ['monday', 'tuesday', 'wednesday', 'thursday'].indexOf(weekday.toLowerCase());
  
  // Target weekday debug removed
  
  if (targetWeekday === -1) {
    // Invalid weekday, returning today
    return today;
  }
  
  // Start from today and find the next first occurrence of weekday in a month
  let currentDate = new Date(today);
  
  // Look ahead up to 4 months
  while (currentDate <= new Date(today.getTime() + 120 * 24 * 60 * 60 * 1000)) {
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const targetDay = targetWeekday + 1; // Convert to Date.getDay() format
    const dayOfMonth = currentDate.getDate();
    
    // Check if this is the first occurrence of this weekday in the month (within first 7 days)
    if (dayOfWeek === targetDay && dayOfMonth <= 7) {
      // Check if it's at least 2 days in the future for delivery logistics
      const diffInDays = Math.ceil((currentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      // Found first weekday in month
      
      if (diffInDays >= 2) {
        // Date meets 2-day requirement
        return new Date(currentDate);
      } else {
        // Date too soon, continuing search
      }
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return today; // Fallback if no suitable date found
}

function getWeekdaysInMonth(month: number, year: number): Date[] {
  const weekdays: Date[] = [];
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  
  for (let date = new Date(firstDay); date <= lastDay; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay();
    // Monday = 1, Tuesday = 2, Wednesday = 3, Thursday = 4
    if (dayOfWeek >= 1 && dayOfWeek <= 4) {
      weekdays.push(new Date(date));
    }
  }
  
  return weekdays;
}

function parseDuration(duration?: string): number {
  if (!duration) return 1;
  
  // Extract number and unit from duration string
  const match = duration.match(/(\d+)\s*(hours?|hrs?|days?|d)?/i);
  if (!match) return 1;
  
  const value = parseInt(match[1]);
  const unit = match[2]?.toLowerCase() || 'days';
  
  // Convert to days
  if (unit.startsWith('hour') || unit.startsWith('hr')) {
    return Math.max(1, Math.ceil(value / 24)); // Convert hours to days, minimum 1 day
  } else {
    return value; // Already in days
  }
}

function datesOverlap(
  start1: Date, 
  end1: Date, 
  start2: Date, 
  end2: Date
): boolean {
  // Normalize dates to start of day for proper date-only comparison
  const s1 = new Date(start1.getFullYear(), start1.getMonth(), start1.getDate());
  const e1 = new Date(end1.getFullYear(), end1.getMonth(), end1.getDate());
  const s2 = new Date(start2.getFullYear(), start2.getMonth(), start2.getDate());
  const e2 = new Date(end2.getFullYear(), end2.getMonth(), end2.getDate());
  
  const overlaps = s1 <= e2 && s2 <= e1;
  
  console.log(`    🔍 Overlap check: [${s1.toDateString()} to ${e1.toDateString()}] vs [${s2.toDateString()} to ${e2.toDateString()}] = ${overlaps}`);
  
  return overlaps;
}

function getBookedItemQuantity(items: any[], itemName: string): number {
  const item = items.find((item: any) => item.name === itemName);
  return item ? (item.quantity || 1) : 0;
}