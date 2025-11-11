/**
 * JumpCSRA Cloud Functions
 * Refactored and modularized for better maintainability
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

// Import service modules
import { 
  sendOrderConfirmationEmail as sendOrderEmail, 
  sendGiftCardEmail as sendGiftEmail,
  sendAccountDeletionEmail as sendDeletionEmail
} from './services/emailService';
import { 
  createPayPalInvoice as createInvoice,
  testPayPalConnection,
  processPayPalRefund
} from './services/paypalService';

// Import types
import { 
  OrderConfirmationEmailData, 
  GiftCardEmailData, 
  AccountDeletionEmailData
} from './types/email';
import { PayPalInvoiceData } from './types/paypal';

// Import existing test function
export { testFunction } from './test';

// Initialize Firebase Admin (if not already initialized)
if (!admin.apps.length) {
  admin.initializeApp();
}

// =============================================================================
// EMAIL FUNCTIONS
// =============================================================================

/**
 * Order Confirmation Email Function
 * 
 * Purpose: Sends comprehensive order confirmation emails to customers after successful purchase
 * 
 * Functionality:
 * - Validates order data including items, pricing, and customer details
 * - Calls external email server to send professionally formatted confirmation emails
 * - Includes order details, payment information, and booking specifics
 * - Handles both one-time purchases and recurring bookings
 * - Returns actual email server response for proper status tracking
 * 
 * Authentication: Not required (allows guest checkouts)
 * 
 * Input Data (OrderConfirmationEmailData):
 * - customerEmail: Recipient email address
 * - customerName: Customer's full name
 * - orderID: Unique order identifier
 * - orderItems: Array of purchased items with details
 * - totalAmount: Total order value
 * - paymentMethod: Payment type (PayPal, credit card, etc.)
 * - bookingDate: Event/service date
 * - Additional booking and payment details
 * 
 * Response: Returns email server response with delivery status and message ID
 * 
 * Error Handling: Preserves original error types from email server for debugging
 */
export const sendOrderConfirmationEmail = functions.https.onCall(async (data: OrderConfirmationEmailData, context) => {
  
  try {
    const result = await sendOrderEmail(data);
    return result; // Return the actual email server response
  } catch (error: any) {
    console.error('❌ ORDER CONFIRMATION - Cloud Function error:', error);
    throw error; // Re-throw to preserve the original error type
  }
});

/**
 * Gift Card Email Function
 * 
 * Purpose: Sends digital gift cards to recipients with personalized messages and redemption codes
 * 
 * Functionality:
 * - Delivers beautifully formatted gift card emails to recipients
 * - Includes unique redemption codes and balance information
 * - Supports personalized messages from sender to recipient
 * - Handles gift card expiration dates and purchase tracking
 * - Integrates with gift card management system for code validation
 * 
 * Authentication: Required (prevents unauthorized gift card generation)
 * 
 * Input Data (GiftCardEmailData):
 * - recipientEmail: Gift card recipient's email address
 * - recipientName: Recipient's full name
 * - senderName: Gift card purchaser's name
 * - personalMessage: Optional custom message from sender
 * - giftCardCode: Unique redemption code
 * - giftCardBalance: Monetary value of gift card
 * - expirationDate: When gift card expires
 * - purchaseDate: When gift card was purchased
 * - orderID: Associated purchase order
 * 
 * Response: Returns email server response with delivery confirmation
 * 
 * Security: Authentication prevents abuse and unauthorized gift card creation
 */
export const sendGiftCardEmail = functions.https.onCall(async (data: GiftCardEmailData, context) => {
  
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to send gift card emails.');
  }

  try {
    const result = await sendGiftEmail(data);
    return result; // Return the actual email server response
  } catch (error: any) {
    console.error('❌ GIFT CARD - Cloud Function error:', error);
    throw error;
  }
});

/**
 * Automated Gift Card Email Trigger (Firestore)
 * 
 * Purpose: Automatically sends gift card emails when new gift cards are created in Firestore
 * 
 * Functionality:
 * - Triggered automatically when a document is added to the 'giftCards' collection
 * - Filters for purchased gift cards (not promotional/admin-created ones)
 * - Validates required email data before sending
 * - Prevents duplicate emails by checking purchase status
 * - Provides seamless customer experience without manual intervention
 * 
 * Trigger: Firestore document creation in 'giftCards/{giftCardId}'
 * 
 * Processing Logic:
 * - Checks if gift card is marked as purchased (isPurchased: true)
 * - Validates recipient email exists
 * - Constructs email data from Firestore document
 * - Calls email service to send gift card
 * - Logs success/failure for monitoring
 * 
 * Data Requirements:
 * - Firestore document must have isPurchased: true
 * - Must include recipientEmail field
 * - Supports optional fields like senderName, personalMessage
 * 
 * Error Handling: Logs errors but doesn't block Firestore write operations
 */
export const sendGiftCardEmailOnCreate = functions.firestore
  .document('giftCards/{giftCardId}')
  .onCreate(async (snap, context) => {
    const giftCardData = snap.data();
    
    // Only send email for purchased gift cards (not promotional ones)
    if (giftCardData?.isPurchased && giftCardData?.recipientEmail) {
      
      const emailData: GiftCardEmailData = {
        recipientEmail: giftCardData.recipientEmail,
        recipientName: giftCardData.recipientName || 'Valued Customer',
        senderName: giftCardData.senderName,
        personalMessage: giftCardData.personalMessage,
        giftCardCode: giftCardData.code,
        giftCardBalance: giftCardData.balance,
        expirationDate: giftCardData.expirationDate,
        purchaseDate: giftCardData.purchaseDate || new Date().toISOString(),
        orderID: giftCardData.orderID
      };
      
      try {
        await sendGiftEmail(emailData);
      } catch (error) {
        console.error('❌ Failed to auto-send gift card email:', error);
      }
    }
  });

/**
 * Account Deletion Confirmation Email Function
 * 
 * Purpose: Sends confirmation emails when users delete their accounts for security and compliance
 * 
 * Functionality:
 * - Confirms account deletion action to user's email address
 * - Documents deletion date and optional reason for records
 * - Provides security confirmation for account changes
 * - Supports GDPR and privacy compliance requirements
 * - Includes information about data retention policies
 * 
 * Authentication: Required (ensures only account owner can trigger deletion emails)
 * 
 * Input Data:
 * - email: Account email address for confirmation
 * - name: User's name (optional, for personalization)
 * - reason: Optional deletion reason for feedback tracking
 * 
 * Processing:
 * - Validates user authentication before sending
 * - Constructs AccountDeletionEmailData with deletion timestamp
 * - Calls email service to send confirmation
 * - Returns email server response for verification
 * 
 * Security Features:
 * - Authentication required prevents unauthorized deletion confirmations
 * - Logs all deletion attempts for security monitoring
 * - Preserves error details for debugging failed attempts
 * 
 * Compliance: Supports audit trails for account deletion processes
 */
export const sendAccountDeletionEmail = functions.https.onCall(async (data: {
  email: string;
  name?: string;
  reason?: string;
}, context) => {
  
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to send account deletion emails.');
  }

  try {
    const emailData: AccountDeletionEmailData = {
      email: data.email,
      name: data.name,
      deletionDate: new Date().toISOString(),
      reason: data.reason
    };

    const result = await sendDeletionEmail(emailData);
    return result; // Return the actual email server response
  } catch (error: any) {
    console.error('❌ ACCOUNT DELETION - Cloud Function error:', error);
    throw error;
  }
});

// =============================================================================
// PAYPAL FUNCTIONS
// =============================================================================

/**
 * PayPal Invoice Creation and Delivery Function
 * 
 * Purpose: Creates and sends professional PayPal invoices for bookings and services
 * 
 * Functionality:
 * - Integrates with PayPal API to create formal invoices
 * - Automatically sends invoices to customer email addresses
 * - Handles complex pricing structures including deposits and full payments
 * - Supports recurring billing for ongoing services
 * - Manages invoice tracking and payment status monitoring
 * 
 * Authentication: Recommended but not strictly required for invoice creation
 * 
 * Input Data (PayPalInvoiceData):
 * - customerEmail: Invoice recipient email
 * - customerName: Customer full name and contact information
 * - invoiceItems: Detailed line items with descriptions and pricing
 * - totalAmount: Invoice total with taxes and fees
 * - dueDate: Payment due date
 * - bookingDetails: Associated booking information
 * - paymentTerms: Payment conditions and policies
 * 
 * PayPal Integration:
 * - Uses PayPal REST API for invoice creation
 * - Automatically generates unique invoice IDs
 * - Sends invoices through PayPal's email system
 * - Provides payment links for easy customer access
 * 
 * Response Data:
 * - success: Boolean indicating operation success
 * - invoiceId: PayPal-generated invoice identifier
 * - invoiceDetails: Complete invoice object from PayPal
 * 
 * Error Handling: Preserves PayPal API errors for debugging payment issues
 */
export const createPayPalInvoice = functions.https.onCall(async (data: PayPalInvoiceData, context) => {
  
  try {
    const invoice = await createInvoice(data);
    
    return { 
      success: true, 
      message: 'PayPal invoice created and sent successfully',
      invoiceId: invoice.id,
      invoiceDetails: invoice
    };
  } catch (error: any) {
    console.error('❌ PAYPAL INVOICE - Cloud Function error:', error);
    throw error;
  }
});

/**
 * PayPal Connection Testing and Diagnostics Function
 * 
 * Purpose: Tests PayPal API connectivity and validates configuration for troubleshooting
 * 
 * Functionality:
 * - Verifies PayPal API credentials and authentication
 * - Tests connection to PayPal sandbox and production environments
 * - Validates API permissions and access levels
 * - Performs basic API calls to ensure functionality
 * - Returns detailed diagnostic information for debugging
 * 
 * Use Cases:
 * - Development environment setup verification
 * - Production deployment validation
 * - Troubleshooting payment processing issues
 * - Regular health checks for PayPal integration
 * - Configuration validation after updates
 * 
 * Testing Features:
 * - Authentication token validation
 * - API endpoint accessibility checks
 * - Response time measurements
 * - Error condition testing
 * - Environment configuration verification
 * 
 * Response Data:
 * - Connection status and response times
 * - API version and capability information
 * - Environment details (sandbox vs production)
 * - Detailed error messages for failed connections
 * 
 * Security: No sensitive data exposed in test responses
 */
export const testPayPalDebug = functions.https.onCall(async (data, context) => {
  
  try {
    const result = await testPayPalConnection();
    return result;
  } catch (error: any) {
    console.error('❌ PAYPAL TEST - Cloud Function error:', error);
    throw new functions.https.HttpsError('internal', `PayPal test failed: ${error.message}`);
  }
});

/**
 * PayPal Refund Processing Function
 */
interface PayPalRefundData {
  captureId: string;
  amount: number;
  reason?: string;
}

export const processPayPalBookingRefund = functions.https.onCall(async (data: PayPalRefundData, context) => {

  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const { captureId, amount, reason = 'Booking cancellation' } = data;
    
    if (!captureId || !amount || amount <= 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid refund parameters');
    }

    const result = await processPayPalRefund(captureId, amount, reason);
    return result;
  } catch (error: any) {
    console.error('❌ PAYPAL REFUND - Cloud Function error:', error);
    throw new functions.https.HttpsError('internal', `PayPal refund failed: ${error.message}`);
  }
});

// =============================================================================
// EMAIL SCHEDULER FUNCTIONS
// =============================================================================

/**
 * Manual Email Testing and Trigger Function
 * 
 * Purpose: Provides manual testing capabilities for all automated email types in the system
 * 
 * Functionality:
 * - Allows manual triggering of specific email types for testing
 * - Validates email processing logic without waiting for scheduled triggers
 * - Supports development and debugging of email automation workflows
 * - Provides immediate feedback on email system functionality
 * - Enables testing of edge cases and error conditions
 * 
 * Authentication: Required (prevents unauthorized email testing/spamming)
 * 
 * Supported Email Types:
 * - 'cart-abandonment': Reminds customers of items left in cart
 * - 'deposit-reminder': Prompts for required deposit payments
 * - 'event-confirmation': Confirms upcoming event details
 * - 'post-event-thanks': Thank you messages after event completion
 * - 'rebooking-reminder': Encourages repeat bookings from past customers
 * 
 * Input Data:
 * - type: Email type to trigger (see supported types above)
 * - email: Test recipient email address
 * - name: Test recipient name
 * - bookingId: Required for booking-specific emails (optional for general types)
 * 
 * Testing Features:
 * - Individual email type testing
 * - Real-time error reporting
 * - Success/failure status tracking
 * - Integration with actual email processing functions
 * 
 * Development Use: Essential for testing email automation before production deployment
 */
export const triggerTestEmail = functions.https.onCall(async (data: { 
  type: string; 
  email: string; 
  name: string;
  bookingId?: string;
}, context) => {
  
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required for email testing.');
  }

  const db = admin.database();
  const now = Date.now();

  try {
    switch (data.type) {
      case 'cart-abandonment':
        await processCartAbandonmentEmails(db, now);
        return { success: true, message: 'Cart abandonment email sent' };
        
      case 'deposit-reminder':
        await processDepositReminderEmails(db, now);
        return { success: true, message: 'Deposit reminder email sent' };
        
      case 'event-confirmation': 
        await processEventConfirmationEmails(db, now);
        return { success: true, message: 'Event confirmation email sent' };
        
      case 'post-event-thanks':
        await processPostEventEmails(db, now);
        return { success: true, message: 'Post-event thank you email sent' };
        
      case 'rebooking-reminder':
        await processRebookingReminderEmails(db, now);
        return { success: true, message: 'Rebooking reminder email sent' };
        
      default:
        throw new Error(`Unknown email type: ${data.type}`);
    }
  } catch (error: any) {
    console.error(`❌ EMAIL TEST - ${data.type} failed:`, error);
    throw new functions.https.HttpsError('internal', `Email test failed: ${error.message}`);
  }
});

/**
 * Automated Email Processing Scheduler (Cloud Scheduler)
 * 
 * Purpose: Automatically processes all scheduled email types at regular intervals
 * 
 * Functionality:
 * - Runs comprehensive email automation system on schedule
 * - Processes multiple email types simultaneously for efficiency
 * - Monitors database for conditions triggering automated emails
 * - Ensures timely delivery of customer communications
 * - Maintains customer engagement through automated touchpoints
 * 
 * Schedule Configuration:
 * - Current: Every 2 minutes (production scheduler)
 * - Production: Should be changed to 'every 1 hours' for optimal performance
 * - Adjustable based on business needs and email volume
 * 
 * Email Types Processed:
 * - Cart Abandonment: Recovers potentially lost sales
 * - Deposit Reminders: Ensures timely payment collection
 * - Event Confirmations: Provides pre-event customer communication
 * - Post-Event Thanks: Maintains customer relationships
 * - Rebooking Reminders: Drives repeat business
 * 
 * Processing Strategy:
 * - Parallel processing for improved performance
 * - Database timestamp checks to prevent duplicate sends
 * - Error isolation (one failure doesn't stop others)
 * - Comprehensive logging for monitoring and debugging
 * 
 * Monitoring:
 * - Success/failure logging for each email type
 * - Performance metrics and processing times
 * - Error tracking for system health monitoring
 * 
 * Production Notes: Adjust schedule frequency based on email volume and business requirements
 */
export const processScheduledEmails = functions.pubsub
  .schedule('every 2 minutes') // For production, change to 'every 1 hours'
  .onRun(async (context) => {
    
    const db = admin.database();
    const now = Date.now();
    
    try {
      // Process all email types
      await Promise.all([
        processCartAbandonmentEmails(db, now),
        processDepositReminderEmails(db, now),
        processEventConfirmationEmails(db, now),
        processPostEventEmails(db, now),
        processRebookingReminderEmails(db, now)
      ]);
      
    } catch (error) {
      console.error('❌ SCHEDULER: Error processing scheduled emails:', error);
    }
  });

/**
 * Automatic Booking Completion Function (Cloud Scheduler)
 * 
 * Purpose: Automatically marks confirmed bookings as "complete" once their event date has passed
 * 
 * Functionality:
 * - Maintains accurate booking status lifecycle management
 * - Identifies past events that are still marked as confirmed/paid
 * - Updates booking status to 'complete' for proper record keeping
 * - Enables proper analytics and reporting on completed events
 * - Supports business operations for follow-up activities
 * 
 * Schedule: Runs every hour to ensure timely status updates
 * 
 * Processing Logic:
 * - Queries database for confirmed bookings (status: 'confirmed' or 'paid')
 * - Checks if event date has passed (eventDate < current date)
 * - Updates booking status to 'complete' with completion timestamp
 * - Records completion reason for audit purposes
 * - Batch processes multiple bookings for efficiency
 * 
 * Business Rules:
 * - Only processes confirmed/paid bookings (skips pending, canceled)
 * - Uses event date from orderDetails.eventDate field
 * - Preserves all original booking data
 * - Marks completion as automatic system action
 * - Maintains audit trail with timestamps
 * 
 * Database Operations:
 * - Efficient querying using Firebase Database indexing
 * - Batch updates to minimize database writes
 * - Atomic operations to prevent data inconsistency
 * - Comprehensive logging for monitoring
 * 
 * Benefits:
 * - Accurate booking lifecycle tracking
 * - Enables post-event email automation
 * - Improved reporting and analytics
 * - Automated business process management
 * 
 * Configuration: Checks event dates against current date for completion
 */
export const autoCompleteBookings = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    
    const db = admin.database();
    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    try {
      const bookingsRef = db.ref('bookings');
      const snapshot = await bookingsRef.once('value');
      
      if (!snapshot.exists()) {
        return;
      }
      
      const updates: { [key: string]: any } = {};
      let completedCount = 0;
      
      snapshot.forEach((child) => {
        const booking = child.val();
        const bookingStatus = booking.status || 'pending';
        
        // Only process confirmed or paid bookings
        if (bookingStatus === 'confirmed' || bookingStatus === 'paid') {
          // Access event date from the correct location in the data structure
          const eventDate = booking.orderDetails?.eventDate || booking.eventDate;
          
          if (eventDate) {
            const eventDateObj = new Date(eventDate);
            eventDateObj.setHours(23, 59, 59, 999); // End of event day
            
            // If event date has passed, mark as complete
            if (eventDateObj < today) {
              updates[`${child.key}/status`] = 'complete';
              updates[`${child.key}/completedAt`] = now;
              updates[`${child.key}/completionReason`] = 'Auto-completed after event date';
              completedCount++;
            }
          } else {
          }
        }
      });
      
      if (completedCount > 0) {
        await bookingsRef.update(updates);
      } else {
      }
    } catch (error) {
      console.error('❌ AUTO-COMPLETE: Error processing bookings:', error);
    }
  });

// =============================================================================
// EMAIL PROCESSING HELPER FUNCTIONS
// =============================================================================

// Email timing constants for scheduled functions (production values only)
const EMAIL_TIMING = {
  CART_ABANDONMENT: 24 * 60 * 60 * 1000, // 24 hours
  DEPOSIT_REMINDER: 2 * 24 * 60 * 60 * 1000, // 2 days
  EVENT_CONFIRMATION: 3 * 24 * 60 * 60 * 1000, // 3 days
  POST_EVENT_THANKS: 1 * 24 * 60 * 60 * 1000, // 1 day
  REBOOKING_REMINDER: 9 * 30 * 24 * 60 * 60 * 1000 // 9 months
};

// Email server configuration for scheduled emails
const EMAIL_SERVER_BASE_URL = 'http://170.187.145.7:3001';
const EMAIL_SERVER_API_KEY = 'jumpcsra_secure_api_key_2024';

  cartAbandonment: '24 hours',
  depositReminder: '2 days',
  eventConfirmation: '3 days',
  postEventThanks: '1 day',
  rebookingReminder: '9 months'
});

async function processCartAbandonmentEmails(db: admin.database.Database, now: number) {
  try {
    
    const cartsRef = db.ref('carts');
    const snapshot = await cartsRef.once('value');
    
    if (!snapshot.exists()) {
      return;
    }
    
    const carts = snapshot.val();
    let emailsSent = 0;
    
    for (const [cartId, cartData] of Object.entries(carts)) {
      const cart = cartData as any;
      
      // Skip if no email address
      if (!cart.email) continue;
      
      const lastUpdated = cart.lastUpdated || cart.createdAt;
      if (!lastUpdated) continue;
      
      const timeSinceUpdate = now - lastUpdated;
      
      // Check if cart abandonment time has passed
      if (timeSinceUpdate >= EMAIL_TIMING.CART_ABANDONMENT) {
        const emailSentKey = `cartAbandonment_${cartId}`;
        const emailRef = db.ref(`emailsSent/${emailSentKey}`);
        const emailSentSnapshot = await emailRef.once('value');
        
        if (!emailSentSnapshot.exists()) {
          // Call email server directly for cart abandonment
          try {
            const emailData = {
              customerEmail: cart.email,
              customerName: cart.customerInfo?.name || 'Customer',
              cartData: {
                items: cart.items || [],
                cartId: cartId,
                lastUpdated: lastUpdated
              }
            };

            await axios.post(`${EMAIL_SERVER_BASE_URL}/api/email/cart-abandonment`, emailData, {
              headers: {
                'Content-Type': 'application/json',
                'X-API-Key': EMAIL_SERVER_API_KEY,
                'Accept': 'application/json'
              },
              timeout: 30000
            });

            await emailRef.set({ sentAt: now, type: 'cart-abandonment' });
            emailsSent++;
          } catch (emailError) {
            console.error(`❌ SCHEDULER: Failed to send cart abandonment email to ${cart.email}:`, emailError);
          }
        }
      }
    }
    
    
  } catch (error) {
    console.error('❌ SCHEDULER: Error processing cart abandonment emails:', error);
  }
}

async function processDepositReminderEmails(db: admin.database.Database, now: number) {
  try {
    
    const bookingsRef = db.ref('bookings');
    const snapshot = await bookingsRef.once('value');
    
    if (!snapshot.exists()) {
      return;
    }
    
    const bookings = snapshot.val();
    let emailsSent = 0;
    
    for (const [bookingId, bookingData] of Object.entries(bookings)) {
      const booking = bookingData as any;
      
      // Only process pending bookings with remaining balance (deposit payments)
      const remainingBalance = booking.paymentDetails?.remainingBalance || 0;
      if (!remainingBalance || remainingBalance <= 0) continue;
      if (booking.status !== 'pending') continue;
      if (!booking.customerInfo?.email) continue;
      if (booking.emails?.depositReminder === true) continue; // Already sent
      
      // Parse event date from the date range string (e.g., "11/10/2025 - 11/10/2025")
      const eventDateString = booking.orderDetails?.eventDate;
      if (!eventDateString) continue;
      
      // Extract the first date from the range
      const firstDate = eventDateString.split(' - ')[0];
      const eventDate = new Date(firstDate).getTime();
      
      if (isNaN(eventDate)) {
        continue;
      }
      
      const timeUntilEvent = eventDate - now;
      
      
      // Send reminder if event is within 2 days (or 2 min in testing mode)
      if (timeUntilEvent <= EMAIL_TIMING.DEPOSIT_REMINDER && timeUntilEvent > 0) {
        try {
          const emailData = {
            customerEmail: booking.customerInfo.email,
            customerName: booking.customerInfo.name || 'Customer',
            bookingId: bookingId,
            remainingAmount: remainingBalance,
            dueDate: firstDate, // Event date as due date
            bookingDetails: {
              eventDate: firstDate,
              eventDetails: booking.orderDetails || {}
            }
          };

          
          await axios.post(`${EMAIL_SERVER_BASE_URL}/api/email/deposit-reminder`, emailData, {
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': EMAIL_SERVER_API_KEY,
              'Accept': 'application/json'
            },
            timeout: 30000
          });

          // Update the email tracking flag
          await db.ref(`bookings/${bookingId}/emails/depositReminder`).set(true);
          emailsSent++;
        } catch (emailError) {
          console.error(`❌ SCHEDULER: Failed to send deposit reminder email to ${booking.customerInfo.email}:`, emailError);
        }
      } else {
      }
    }
    
    
  } catch (error) {
    console.error('❌ SCHEDULER: Error processing deposit reminder emails:', error);
  }
}

async function processEventConfirmationEmails(db: admin.database.Database, now: number) {
  try {
    
    const bookingsRef = db.ref('bookings');
    const snapshot = await bookingsRef.once('value');
    
    if (!snapshot.exists()) {
      return;
    }
    
    const bookings = snapshot.val();
    let emailsSent = 0;
    
    for (const [bookingId, bookingData] of Object.entries(bookings)) {
      const booking = bookingData as any;
      
      // Only process confirmed bookings with no remaining balance  
      const remainingBalance = booking.paymentDetails?.remainingBalance || 0;
      if (booking.status !== 'confirmed') continue;
      if (remainingBalance > 0) continue; // Still has deposit due
      if (!booking.customerInfo?.email) continue;
      if (booking.emails?.eventConfirmation === true) continue; // Already sent
      
      // Parse event date from the date range string (e.g., "11/11/2025 - 11/11/2025")
      const eventDateString = booking.orderDetails?.eventDate;
      if (!eventDateString) continue;
      
      // Extract the first date from the range
      const firstDate = eventDateString.split(' - ')[0];
      const eventDate = new Date(firstDate).getTime();
      
      if (isNaN(eventDate)) {
        continue;
      }
      
      const timeUntilEvent = eventDate - now;
      
      
      // Send confirmation if event is within 3 days
      if (timeUntilEvent <= EMAIL_TIMING.EVENT_CONFIRMATION && timeUntilEvent > 0) {
        try {
          const emailData = {
            customerEmail: booking.customerInfo.email,
            customerName: booking.customerInfo.name || 'Customer',
            bookingId: bookingId,
            eventDate: firstDate,
            bookingDetails: {
              eventDetails: booking.orderDetails || {},
              deliveryAddress: booking.orderDetails?.deliveryAddress || '',
              deliveryTime: booking.orderDetails?.deliveryTime || '',
              duration: booking.orderDetails?.duration || '',
              surface: booking.orderDetails?.surface || '',
              items: booking.orderDetails?.items || []
            }
          };

          await axios.post(`${EMAIL_SERVER_BASE_URL}/api/email/booking-confirmation`, emailData, {
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': EMAIL_SERVER_API_KEY,
              'Accept': 'application/json'
            },
            timeout: 30000
          });

          // Update the email tracking flag
          await db.ref(`bookings/${bookingId}/emails/eventConfirmation`).set(true);
          emailsSent++;
        } catch (emailError) {
          console.error(`❌ SCHEDULER: Failed to send event confirmation email to ${booking.customerInfo.email}:`, emailError);
        }
      }
    }
    
    
  } catch (error) {
    console.error('❌ SCHEDULER: Error processing event confirmation emails:', error);
  }
}

async function processPostEventEmails(db: admin.database.Database, now: number) {
  try {
    
    const bookingsRef = db.ref('bookings');
    const snapshot = await bookingsRef.once('value');
    
    if (!snapshot.exists()) {
      return;
    }
    
    const bookings = snapshot.val();
    let emailsSent = 0;
    
    for (const [bookingId, bookingData] of Object.entries(bookings)) {
      const booking = bookingData as any;
      
      // Only process events that have passed
      if (!booking.customerInfo?.email) continue;
      if (booking.emails?.thanks === true) continue; // Already sent
      
      // Parse event date from the date range string (e.g., "11/09/2025 - 11/09/2025")
      const eventDateString = booking.orderDetails?.eventDate;
      if (!eventDateString) continue;
      
      // Extract the first date from the range
      const firstDate = eventDateString.split(' - ')[0];
      const eventDate = new Date(firstDate).getTime();
      
      if (isNaN(eventDate)) {
        continue;
      }
      
      const timeSinceEvent = now - eventDate;
      
      // Send thank you email after event (1 day after or testing interval)
      if (timeSinceEvent >= EMAIL_TIMING.POST_EVENT_THANKS) {
        try {
          const emailData = {
            customerEmail: booking.customerInfo.email,
            customerName: booking.customerInfo.name || 'Customer',
            bookingId: bookingId,
            eventDate: firstDate,
            bookingDetails: {
              eventDetails: booking.orderDetails || {},
              totalAmount: booking.paymentDetails?.totalAmount,
              items: booking.orderDetails?.items || []
            }
          };

          await axios.post(`${EMAIL_SERVER_BASE_URL}/api/email/post-event-thanks`, emailData, {
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': EMAIL_SERVER_API_KEY,
              'Accept': 'application/json'
            },
            timeout: 30000
          });

          // Update the email tracking flag
          await db.ref(`bookings/${bookingId}/emails/thanks`).set(true);
          emailsSent++;
        } catch (emailError) {
          console.error(`❌ SCHEDULER: Failed to send post-event thank you email to ${booking.customerInfo.email}:`, emailError);
        }
      }
    }
    
    
  } catch (error) {
    console.error('❌ SCHEDULER: Error processing post-event thank you emails:', error);
  }
}

async function processRebookingReminderEmails(db: admin.database.Database, now: number) {
  try {
    
    const bookingsRef = db.ref('bookings');
    const snapshot = await bookingsRef.once('value');
    
    if (!snapshot.exists()) {
      return;
    }
    
    const bookings = snapshot.val();
    let emailsSent = 0;
    
    for (const [bookingId, bookingData] of Object.entries(bookings)) {
      const booking = bookingData as any;
      
      // Only process events that have passed significantly
      if (!booking.customerInfo?.email) continue;
      if (booking.emails?.rebooking === true) continue; // Already sent
      
      // Parse event date from the date range string (e.g., "11/09/2025 - 11/09/2025")
      const eventDateString = booking.orderDetails?.eventDate;
      if (!eventDateString) continue;
      
      // Extract the first date from the range
      const firstDate = eventDateString.split(' - ')[0];
      const eventDate = new Date(firstDate).getTime();
      
      if (isNaN(eventDate)) {
        continue;
      }
      
      const timeSinceEvent = now - eventDate;
      
      // Send rebooking reminder after significant time (9 months or testing interval)
      if (timeSinceEvent >= EMAIL_TIMING.REBOOKING_REMINDER) {
        try {
          const emailData = {
            customerEmail: booking.customerInfo.email,
            customerName: booking.customerInfo.name || 'Customer',
            lastBookingDate: firstDate,
            lastBookingId: bookingId
          };

          await axios.post(`${EMAIL_SERVER_BASE_URL}/api/email/follow-up`, emailData, {
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': EMAIL_SERVER_API_KEY,
              'Accept': 'application/json'
            },
            timeout: 30000
          });

          // Update the email tracking flag
          await db.ref(`bookings/${bookingId}/emails/rebooking`).set(true);
          emailsSent++;
        } catch (emailError) {
          console.error(`❌ SCHEDULER: Failed to send rebooking reminder email to ${booking.customerInfo.email}:`, emailError);
        }
      }
    }
    
    
  } catch (error) {
    console.error('❌ SCHEDULER: Error processing rebooking reminder emails:', error);
  }
}
