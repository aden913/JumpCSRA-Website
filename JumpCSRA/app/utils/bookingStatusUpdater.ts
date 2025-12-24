/**
 * Booking Status Updater Utility
 * 
 * This utility provides functions to update booking statuses based on business rules:
 * - Mark confirmed bookings as completed when event date has passed
 * - Can be run manually or as part of a scheduled process
 */

import { checkAndMarkCompletedBookings, loadBookingData } from './databaseUtils';
import { getDatabase, ref, get } from 'firebase/database';

// Function to update all eligible bookings to completed status
export const updateCompletedBookings = async (): Promise<{
  success: boolean;
  updatedCount: number;
  error?: string;
}> => {
  try {
    // Debug log removed
    
    const updatedCount = await checkAndMarkCompletedBookings();
    
    // Debug log removed
    
    return {
      success: true,
      updatedCount: updatedCount
    };
  } catch (error) {
    // Debug error removed
    return {
      success: false,
      updatedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Function to check a specific booking's status and update if needed
export const checkSpecificBooking = async (orderID: string): Promise<{
  success: boolean;
  originalStatus?: string;
  newStatus?: string;
  updated: boolean;
  error?: string;
}> => {
  try {
    const booking = await loadBookingData(orderID);
    
    if (!booking) {
      return {
        success: false,
        updated: false,
        error: 'Booking not found'
      };
    }
    
    const originalStatus = booking.status;
    
    // Only update confirmed bookings to completed
    if (booking.status === 'confirmed') {
      const eventDateString = booking.orderDetails.eventDate.split(' - ')[0]; // Get start date
      const eventDate = new Date(eventDateString);
      const today = new Date();
      
      // Set times for comparison
      today.setHours(23, 59, 59, 999);
      eventDate.setHours(23, 59, 59, 999);
      
      if (today > eventDate) {
        // Event date has passed, mark as completed
        const { updateBookingStatus } = await import('./databaseUtils');
        const updated = await updateBookingStatus(orderID, 'completed');
        
        if (updated) {
          return {
            success: true,
            originalStatus: originalStatus,
            newStatus: 'completed',
            updated: true
          };
        } else {
          return {
            success: false,
            originalStatus: originalStatus,
            updated: false,
            error: 'Failed to update booking status'
          };
        }
      }
    }
    
    // No update needed
    return {
      success: true,
      originalStatus: originalStatus,
      newStatus: originalStatus,
      updated: false
    };
    
  } catch (error) {
    // Debug error removed
    return {
      success: false,
      updated: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Function to get booking status summary for admin dashboard
export const getBookingStatusSummary = async (): Promise<{
  success: boolean;
  summary?: {
    deferred: number;
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    total: number;
  };
  error?: string;
}> => {
  try {
    const database = getDatabase();
    const bookingsRef = ref(database, 'bookings');
    const snapshot = await get(bookingsRef);
    
    if (!snapshot.exists()) {
      return {
        success: true,
        summary: {
          deferred: 0,
          pending: 0,
          confirmed: 0,
          completed: 0,
          cancelled: 0,
          total: 0
        }
      };
    }
    
    const bookings = snapshot.val();
    const summary = {
      deferred: 0,
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      total: 0
    };
    
    Object.values(bookings).forEach((booking: any) => {
      if (booking.status && summary.hasOwnProperty(booking.status)) {
        (summary as any)[booking.status]++;
        summary.total++;
      }
    });
    
    return {
      success: true,
      summary: summary
    };
    
  } catch (error) {
    // Debug error removed
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Function to run the booking status update process and log results
export const runBookingStatusUpdate = async (): Promise<void> => {
  // Debug log removed
  
  // Get summary before update
  const beforeSummary = await getBookingStatusSummary();
  if (beforeSummary.success && beforeSummary.summary) {
    // Debug log removed
  }
  
  // Run update process
  const result = await updateCompletedBookings();
  
  if (result.success) {
    // Debug log removed
    
    // Get summary after update
    const afterSummary = await getBookingStatusSummary();
    if (afterSummary.success && afterSummary.summary) {
      // Debug log removed
    }
  } else {
    // Debug error removed
  }
  
  // Debug log removed
};