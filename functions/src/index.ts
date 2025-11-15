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
  processPayPalRefund,
  chargeVaultedPayment
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

// PayPal configuration constants
const PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com"; // Use https://api-m.paypal.com for production
const PAYPAL_CLIENT_ID = "AWT5np0jyr8BIdzyJvoWm0X9158l2F0l0rPjE6q925D5VnZVix4uwDRSivBe8Vs4sjCO8Hu-io5mSxM0"; // Working sandbox client ID
const PAYPAL_CLIENT_SECRET = functions.config().paypal?.client_secret || "YOUR_PAYPAL_CLIENT_SECRET";

/**
 * Get PayPal access token
 */
async function getPayPalAccessToken(): Promise<string> {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  
  const response = await axios.post(`${PAYPAL_BASE_URL}/v1/oauth2/token`, 'grant_type=client_credentials', {
    headers: {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
      'Accept-Language': 'en_US',
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  
  return response.data.access_token;
}

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

/**
 * Daily Membership Billing Processor (Cloud Scheduler)
 * 
 * Purpose: Process recurring membership billing every 30 days
 * Features:
 * - Checks all users with active memberships
 * - Bills users whose 30-day period has elapsed
 * - Handles payment failures with email notifications
 * - Processes membership cancellations
 * - Creates billing history records
 * 
 * Schedule: Runs daily at 9:00 AM UTC
 */
export const processMembershipBilling = functions.pubsub
  .schedule('0 9 * * *') // Daily at 9 AM UTC
  .onRun(async (context) => {
    console.log('Starting daily subscription status sync...');
    
    const db = admin.firestore();
    let processedCount = 0;
    let errorCount = 0;
    
    try {
      // Get PayPal access token once for all requests
      const accessToken = await getPayPalAccessToken();
      
      // Get all user subscriptions from our database
      const subscriptionsSnapshot = await db.collection('userSubscriptions').get();
      
      for (const subDoc of subscriptionsSnapshot.docs) {
        const userId = subDoc.id;
        const localSubscription = subDoc.data();
        
        // Skip if no PayPal subscription ID
        if (!localSubscription.subscriptionId) {
          console.log(`No subscription ID for user ${userId}, skipping...`);
          continue;
        }
        
        try {
          // Get current status from PayPal
          const paypalResponse = await axios.get(
            `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${localSubscription.subscriptionId}`, 
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
              }
            }
          );
          
          const paypalStatus = paypalResponse.data.status;
          const localStatus = localSubscription.status;
          
          // Check if status has changed
          if (paypalStatus !== localStatus) {
            console.log(`Status mismatch for user ${userId}: Local=${localStatus}, PayPal=${paypalStatus}`);
            
            // Update our database to match PayPal
            await subDoc.ref.update({
              status: paypalStatus,
              lastSyncedAt: new Date(),
              lastPayPalSync: paypalResponse.data,
              syncReason: 'daily-status-check'
            });
            
            // Update user membership status based on PayPal status
            const membershipUpdate: any = {
              updatedAt: new Date().toISOString(),
              lastSyncedAt: new Date().toISOString()
            };
            
            if (paypalStatus === 'ACTIVE') {
              membershipUpdate.jumpClub = true;
              membershipUpdate.cancelled = false;
            } else if (['CANCELLED', 'SUSPENDED', 'EXPIRED'].includes(paypalStatus)) {
              membershipUpdate.jumpClub = false;
              membershipUpdate.cancelled = true;
              if (paypalStatus === 'CANCELLED') {
                membershipUpdate.dateCancelled = new Date().toISOString();
              }
            }
            
            // Update user membership status
            await db.collection('users')
              .doc(userId)
              .collection('membership')
              .doc('status')
              .update(membershipUpdate);
              
            console.log(`Updated user ${userId} membership status to match PayPal: ${paypalStatus}`);
          }
          
          processedCount++;
          
        } catch (error: any) {
          console.error(`Error syncing subscription for user ${userId}:`, error.response?.data || error.message);
          errorCount++;
          
          // If subscription not found in PayPal, mark as cancelled locally
          if (error.response?.status === 404) {
            await subDoc.ref.update({
              status: 'CANCELLED',
              lastSyncedAt: new Date(),
              syncReason: 'not-found-in-paypal'
            });
            
            await db.collection('users')
              .doc(userId)
              .collection('membership')
              .doc('status')
              .update({
                jumpClub: false,
                cancelled: true,
                dateCancelled: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
              
            console.log(`Marked user ${userId} subscription as cancelled (not found in PayPal)`);
          }
        }
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`Daily sync completed: ${processedCount} processed, ${errorCount} errors`);
      
    } catch (error: any) {
      console.error('Error in daily subscription sync:', error);
    }
  });

// STATIC PAYPAL
                } catch (emailError) {
                  console.error(`Failed to send payment failure email to ${userData.email}:`, emailError);
                }
              }
              
              // Cancel membership
              await firestore
                .collection('users')
                .doc(userId)
                .collection('membership')
                .doc('status')
                .update({
                  jumpClub: false,
                  dateStarted: admin.firestore.FieldValue.delete(),
                  updatedAt: now.toISOString()
                });
              
              continue;
            }
            
            const paymentData = paymentDoc.data()!; // We know it exists from the check above
            
            // Create payment record
            const paymentId = `mb-${userId}-${Date.now()}`;
            const nextBillingDate = new Date(now);
            nextBillingDate.setDate(nextBillingDate.getDate() + 30);
            
            try {
              // Attempt to charge the payment method
              const chargeResult = await chargeVaultedPayment({
                customerId: paymentData.paypalVaultId!,
                paymentTokenId: paymentData.savedPaymentMethods[0]?.paypalVaultId || '',
                amount: amount,
                currency: 'USD',
                description: `${membershipType.charAt(0).toUpperCase() + membershipType.slice(1)} Membership - Monthly Billing`,
                reference_id: paymentId
              });
              
              // Save successful payment record
              await firestore.collection('membershipPayments').doc(paymentId).set({
                id: paymentId,
                userId: userId,
                membershipType: membershipType,
                amount: amount,
                paymentDate: now.toISOString(),
                nextBillingDate: nextBillingDate.toISOString(),
                paymentMethodId: paymentData.savedPaymentMethods[0]?.id,
                paypalTransactionId: chargeResult.id,
                status: 'completed',
                createdAt: now.toISOString()
              });
              
              // Send successful billing email
              const userData = userDoc.data();
              if (userData?.email) {
                try {
                  await sendOrderEmail({
                    recipientEmail: userData.email,
                    recipientName: userData.name || 'Valued Customer',
                    orderID: paymentId,
                    orderDate: now.toISOString(),
                    eventDate: now.toISOString(),
                    deliveryAddress: 'Digital Service',
                    rentalItems: [{
                      name: `${membershipType.charAt(0).toUpperCase() + membershipType.slice(1)} Membership - Monthly Billing`,
                      price: amount,
                      quantity: 1
                    }],
                    lastMinuteAdditions: [],
                    subtotal: amount,
                    surfaceAdjustment: 0,
                    timeAdjustment: 0,
                    deliveryCost: 0,
                    totalAmount: amount,
                    paymentType: 'Membership Billing',
                    amountPaid: amount,
                    remainingBalance: 0
                  });
                } catch (emailError) {
                  console.error(`Failed to send billing success email to ${userData.email}:`, emailError);
                }
              }
              
            } catch (chargeError: any) {
              // Payment failed - save failed record and send email
              await firestore.collection('membershipPayments').doc(paymentId).set({
                id: paymentId,
                userId: userId,
                membershipType: membershipType,
                amount: amount,
                paymentDate: now.toISOString(),
                nextBillingDate: nextBillingDate.toISOString(),
                paymentMethodId: paymentData?.savedPaymentMethods[0]?.id,
                status: 'failed',
                failureReason: chargeError?.message || 'Unknown payment error',
                createdAt: now.toISOString()
              });
              
              // Send payment failure email and cancel membership
              const userData = userDoc.data();
              if (userData?.email) {
                try {
                  await sendOrderEmail({
                    recipientEmail: userData.email,
                    recipientName: userData.name || 'Valued Customer',
                    orderID: paymentId,
                    orderDate: now.toISOString(),
                    eventDate: now.toISOString(),
                    deliveryAddress: 'Payment Failed - Membership Cancelled',
                    rentalItems: [{
                      name: `${membershipType.charAt(0).toUpperCase() + membershipType.slice(1)} Membership - Payment Failed`,
                      price: amount,
                      quantity: 1
                    }],
                    lastMinuteAdditions: [],
                    subtotal: amount,
                    surfaceAdjustment: 0,
                    timeAdjustment: 0,
                    deliveryCost: 0,
                    totalAmount: amount,
                    paymentType: 'Membership Billing',
                    amountPaid: 0,
                    remainingBalance: amount
                  });
                } catch (emailError) {
                  console.error(`Failed to send payment failure email to ${userData.email}:`, emailError);
                }
              }
              
              // Cancel membership after payment failure
              await firestore
                .collection('users')
                .doc(userId)
                .collection('membership')
                .doc('status')
                .update({
                  jumpClub: false,
                  dateStarted: admin.firestore.FieldValue.delete(),
                  updatedAt: now.toISOString()
                });
            }
          }
        } catch (userError) {
          console.error(`Error processing membership billing for user ${userId}:`, userError);
        }
      }
      
    } catch (error) {
      console.error('❌ MEMBERSHIP BILLING: Error processing membership billing:', error);
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

// Membership-specific API endpoints

/**
 * Create PayPal subscription for membership
 */
// STATIC PAYPAL PRODUCT AND PLAN IDs - Created once and reused
const JUMP_CLUB_PRODUCT_ID = "PROD_JUMP_CLUB_MEMBERSHIP_2024"; // Set this after running setupPayPalPlans
const JUMP_CLUB_PLAN_ID = "P-JUMP_CLUB_MONTHLY_2024"; // Set this after running setupPayPalPlans

// One-time setup function to create PayPal product and billing plan
// Run this function once via Firebase console or admin script
export const setupPayPalPlans = functions.https.onRequest(async (req, res) => {
  // This should only be run by administrators
  // Add authentication/security as needed
  
  try {
    console.log('Setting up PayPal product and billing plans...');
    
    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Create PayPal product (one-time)
    const productData = {
      id: JUMP_CLUB_PRODUCT_ID, // Use consistent ID
      name: "Jump Club Membership",
      description: "Monthly subscription to Jump Club with premium inflatable delivery and exclusive member benefits",
      type: "SERVICE",
      category: "ENTERTAINMENT"
    };

    console.log('Creating PayPal product...');
    const productResponse = await axios.post(`${PAYPAL_BASE_URL}/v1/catalogs/products`, productData, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `product-setup-${Date.now()}`
      }
    });

    console.log('Product created:', productResponse.data.id);

    // Create billing plan (one-time)
    const planData = {
      product_id: JUMP_CLUB_PRODUCT_ID,
      name: "Jump Club Monthly Membership",
      description: "Monthly subscription to Jump Club with premium inflatable delivery and benefits",
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: {
            interval_unit: "MONTH",
            interval_count: 1
          },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0, // 0 means unlimited
          pricing_scheme: {
            fixed_price: {
              value: "149.00",
              currency_code: "USD"
            }
          }
        }
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: {
          value: "0",
          currency_code: "USD"
        },
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 3
      }
    };

    console.log('Creating billing plan...');
    const planResponse = await axios.post(`${PAYPAL_BASE_URL}/v1/billing/plans`, planData, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `plan-setup-${Date.now()}`
      }
    });

    console.log('Plan created:', planResponse.data.id);

    // Store the IDs in Firestore for reference
    const db = admin.firestore();
    await db.collection('paypalConfig').doc('membershipPlans').set({
      productId: productResponse.data.id,
      planId: planResponse.data.id,
      createdAt: new Date(),
      status: 'ACTIVE'
    });

    res.json({
      success: true,
      productId: productResponse.data.id,
      planId: planResponse.data.id,
      message: 'PayPal product and billing plan created successfully. Update the constants in your code with these IDs.'
    });

  } catch (error: any) {
    console.error('Error setting up PayPal plans:', error);
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

export const createMembershipSubscription = functions.https.onCall(async (data, context) => {
  try {
    console.log('Received createMembershipSubscription request with data:', JSON.stringify(data));
    console.log('Context auth:', context.auth?.uid || 'No auth context');
    
    const { userId, planAmount = 149, currency = 'USD', userEmail, userName } = data;

    // More detailed validation
    if (!data) {
      throw new functions.https.HttpsError(
        'invalid-argument', 
        'No data provided'
      );
    }

    if (!userId) {
      throw new functions.https.HttpsError(
        'invalid-argument', 
        `Missing userId. Received data keys: ${Object.keys(data).join(', ')}`
      );
    }

    if (!userEmail) {
      throw new functions.https.HttpsError(
        'invalid-argument', 
        `Missing userEmail. Received data keys: ${Object.keys(data).join(', ')}`
      );
    }

    // Validate amount is a number
    if (typeof planAmount !== 'number' || isNaN(planAmount) || planAmount <= 0) {
      throw new functions.https.HttpsError(
        'invalid-argument', 
        `Invalid planAmount: ${planAmount}. Must be a positive number.`
      );
    }

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Get the stored plan ID from Firestore (created once via setupPayPalPlans)
    const db = admin.firestore();
    const configDoc = await db.collection('paypalConfig').doc('membershipPlans').get();
    
    if (!configDoc.exists) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'PayPal billing plan not configured. Run setupPayPalPlans first.'
      );
    }
    
    const config = configDoc.data();
    const planId = config?.planId || JUMP_CLUB_PLAN_ID; // Fallback to constant
    
    if (!planId) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'No billing plan ID available. Run setupPayPalPlans first.'
      );
    }

    console.log('Using existing plan ID:', planId);

    // Create subscription using the existing plan (no product/plan creation needed)
    const subscriptionData = {
      plan_id: planId,
      start_time: new Date(Date.now() + 60000).toISOString(), // Start in 1 minute
      subscriber: {
        name: {
          given_name: userName?.split(' ')[0] || 'Jump',
          surname: userName?.split(' ').slice(1).join(' ') || 'Club Member'
        },
        email_address: userEmail
      },
      application_context: {
        brand_name: "Jump CSRA Party Rental",
        locale: "en-US",
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        payment_method: {
          payer_selected: "PAYPAL",
          payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED"
        },
        return_url: `https://jumpcsra.com/checkout?membership=jump-club&success=true`,
        cancel_url: `https://jumpcsra.com/checkout?membership=jump-club&cancelled=true`
      },
      custom_id: userId // Store user ID for reference
    };

    const subscriptionResponse = await axios.post(`${PAYPAL_BASE_URL}/v1/billing/subscriptions`, subscriptionData, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `sub-${userId}-${Date.now()}`
      }
    });

    console.log('Membership subscription created:', subscriptionResponse.data.id);

    return {
      success: true,
      subscriptionId: subscriptionResponse.data.id,
      planId: planId,
      approvalUrl: subscriptionResponse.data.links?.find((link: any) => link.rel === 'approve')?.href
    };

  } catch (error: any) {
    console.error('Error creating membership subscription:', error.response?.data || error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError(
      'internal',
      error.response?.data?.message || 'Failed to create membership subscription'
    );
  }
});

/**
 * Activate membership subscription after PayPal approval
 */
export const activateMembershipSubscription = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { subscriptionId, userId } = req.body;

    if (!subscriptionId || !userId) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: subscriptionId, userId' 
      });
      return;
    }

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Get subscription details to verify it's active
    const subscriptionResponse = await axios.get(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    const subscription = subscriptionResponse.data;

    if (subscription.status !== 'ACTIVE') {
      res.status(400).json({
        success: false,
        error: `Subscription status is ${subscription.status}, not ACTIVE`
      });
      return;
    }

    // Store subscription information in Firestore
    const db = admin.firestore();
    await db.collection('userSubscriptions').doc(userId).set({
      subscriptionId: subscriptionId,
      planId: subscription.plan_id,
      status: subscription.status,
      createdAt: new Date(),
      nextBillingDate: subscription.billing_info?.next_billing_time || null,
      lastPaymentAmount: subscription.billing_info?.last_payment?.amount?.value || null,
      subscriber: subscription.subscriber
    });

    console.log('Membership subscription activated for user:', userId);

    res.status(200).json({
      success: true,
      subscriptionId: subscriptionId,
      status: subscription.status,
      nextBilling: subscription.billing_info?.next_billing_time
    });

  } catch (error: any) {
    console.error('Error activating membership subscription:', error.response?.data || error);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.message || 'Failed to activate membership subscription' 
    });
  }
});

/**
 * Cancel membership subscription
 */
export const cancelMembershipSubscription = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { subscriptionId, userId, reason = "User requested cancellation" } = req.body;

    if (!subscriptionId || !userId) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: subscriptionId, userId' 
      });
      return;
    }

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Cancel the subscription
    const cancelData = {
      reason: reason
    };

    await axios.post(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}/cancel`, cancelData, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    // Update subscription status in Firestore
    const db = admin.firestore();
    await db.collection('userSubscriptions').doc(userId).update({
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancellationReason: reason
    });

    console.log('Membership subscription cancelled for user:', userId);

    res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully'
    });

  } catch (error: any) {
    console.error('Error cancelling membership subscription:', error.response?.data || error);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.message || 'Failed to cancel membership subscription' 
    });
  }
});

/**
 * Create membership order with PayPal
 */
export const createMembershipOrder = functions.https.onCall(async (data, context) => {
  try {
    console.log('Received createMembershipOrder request with data:', JSON.stringify(data));
    console.log('Context auth:', context.auth?.uid || 'No auth context');
    
    const { userId, amount, currency = 'USD' } = data;

    // More detailed validation
    if (!data) {
      throw new functions.https.HttpsError(
        'invalid-argument', 
        'No data provided'
      );
    }

    if (!userId) {
      throw new functions.https.HttpsError(
        'invalid-argument', 
        `Missing userId. Received data keys: ${Object.keys(data).join(', ')}`
      );
    }

    if (!amount) {
      throw new functions.https.HttpsError(
        'invalid-argument', 
        `Missing amount. Received data keys: ${Object.keys(data).join(', ')}`
      );
    }

    // Validate amount is a number
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      throw new functions.https.HttpsError(
        'invalid-argument', 
        `Invalid amount: ${amount}. Must be a positive number.`
      );
    }

    // Create PayPal order for membership with vault setup
    const orderResponse = await createVaultedPayPalOrder({
      amount: amount.toString(),
      currency,
      userId,
      description: 'Jump Club Membership - Monthly Subscription'
    });

    console.log('Membership order created:', orderResponse);

    return {
      success: true,
      orderID: orderResponse.id
    };

  } catch (error) {
    console.error('Error creating membership order:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError(
      'internal',
      'Failed to create membership order'
    );
  }
});

/**
 * Capture membership payment and set up vault
 */
export const captureMembershipPayment = functions.https.onCall(async (data, context) => {
  try {
    const { orderID, userId } = data;

    if (!orderID || !userId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required fields: orderID, userId'
      );
    }

    // Capture the PayPal payment
    const captureResponse = await captureVaultedPayment(orderID);
    
    if (!captureResponse.success) {
      throw new functions.https.HttpsError(
        'internal',
        'Payment capture failed'
      );
    }

    // Check if we got vault information
    if (!captureResponse.vaultId) {
      console.error('Payment captured but no vault ID received for user:', userId);
      throw new functions.https.HttpsError(
        'internal',
        'Payment processed but recurring billing setup incomplete. Please contact support.'
      );
    }

    // Store payment info in user's record
    const firestore = admin.firestore();
    await firestore.collection('users').doc(userId).set({
      paymentInfo: {
        paypalVaultId: captureResponse.vaultId,
        lastPaymentDate: admin.firestore.Timestamp.now(),
        paymentMethod: 'paypal',
        status: 'active'
      }
    }, { merge: true });

    // Record membership payment
    const paymentRecord = {
      id: `membership-${Date.now()}`,
      userId,
      membershipType: 'jump-club',
      amount: 149,
      paymentDate: admin.firestore.Timestamp.now(),
      nextBillingDate: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      ),
      paymentMethodId: captureResponse.vaultId,
      paypalTransactionId: captureResponse.transactionId,
      status: 'completed'
    };

    await firestore.collection('membershipPayments').doc(paymentRecord.id).set(paymentRecord);

    console.log('Membership payment completed successfully for user:', userId);

    return {
      success: true,
      transactionId: captureResponse.transactionId,
      vaultId: captureResponse.vaultId
    };

  } catch (error) {
    console.error('Error capturing membership payment:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError(
      'internal',
      'Failed to process membership payment'
    );
  }
});

// Helper function to create PayPal order with vault setup
async function createVaultedPayPalOrder(orderData: any) {
  const { amount, currency, userId, description } = orderData;
  
  const paypalOrder = {
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: currency,
        value: amount
      },
      description: description,
      custom_id: `membership-${userId}-${Date.now()}`
    }],
    payment_source: {
      paypal: {
        attributes: {
          vault: {
            store_in_vault: 'ON_SUCCESS',
            usage_type: 'MERCHANT',
            customer_type: 'CONSUMER'
          }
        }
      }
    }
  };

  const response = await axios.post(
    `${PAYPAL_BASE_URL}/v2/checkout/orders`,
    paypalOrder,
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getPayPalAccessToken()}`,
      },
    }
  );

  return response.data;
}

// Helper function to capture vaulted payment
async function captureVaultedPayment(orderId: string) {
  try {
    const response = await axios.post(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getPayPalAccessToken()}`,
        },
      }
    );

    const captureData = response.data;
    
    // Extract vault information
    const paymentSource = captureData.payment_source?.paypal;
    const vaultId = paymentSource?.attributes?.vault?.id;
    const transactionId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id;

    return {
      success: true,
      vaultId,
      transactionId,
      captureData
    };
  } catch (error: any) {
    console.error('Error capturing vaulted payment:', error);
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

/**
 * Get subscription details for a user
 */
export const getMembershipSubscription = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { userId } = req.query;

    if (!userId) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing required field: userId' 
      });
      return;
    }

    const db = admin.firestore();
    const subscriptionDoc = await db.collection('userSubscriptions').doc(userId as string).get();

    if (!subscriptionDoc.exists) {
      res.status(404).json({
        success: false,
        error: 'No subscription found for user'
      });
      return;
    }

    const subscriptionData = subscriptionDoc.data();
    
    // Get latest PayPal subscription details
    if (subscriptionData?.subscriptionId) {
      try {
        const accessToken = await getPayPalAccessToken();
        const subscriptionResponse = await axios.get(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionData.subscriptionId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        });

        const paypalSubscription = subscriptionResponse.data;
        
        res.status(200).json({
          success: true,
          subscription: {
            ...subscriptionData,
            currentStatus: paypalSubscription.status,
            nextBillingDate: paypalSubscription.billing_info?.next_billing_time,
            lastPayment: paypalSubscription.billing_info?.last_payment,
            failedPaymentsCount: paypalSubscription.billing_info?.failed_payments_count || 0
          }
        });
      } catch (paypalError) {
        console.error('Error fetching PayPal subscription details:', paypalError);
        // Return local data if PayPal call fails
        res.status(200).json({
          success: true,
          subscription: subscriptionData,
          warning: 'Could not fetch latest PayPal details'
        });
      }
    } else {
      res.status(200).json({
        success: true,
        subscription: subscriptionData
      });
    }

  } catch (error: any) {
    console.error('Error getting membership subscription:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get membership subscription details' 
    });
  }
});

/**
 * PayPal Subscription Webhook Handler
 * Handles subscription events like payments, cancellations, failures
 */
export const paypalSubscriptionWebhook = functions.https.onRequest(async (req, res) => {
  try {
    const event = req.body;
    console.log('PayPal Webhook Event:', event.event_type);

    // Verify webhook signature (recommended for production)
    // You would implement webhook signature verification here

    const db = admin.firestore();

    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        {
          const subscription = event.resource;
          const userId = subscription.custom_id;
          
          if (userId) {
            await db.collection('userSubscriptions').doc(userId).update({
              status: 'ACTIVE',
              activatedAt: new Date(),
              lastWebhookEvent: event.event_type
            });
            console.log('Subscription activated via webhook for user:', userId);
          }
        }
        break;

      case 'BILLING.SUBSCRIPTION.CANCELLED':
        {
          const subscription = event.resource;
          const userId = subscription.custom_id;
          
          if (userId) {
            await db.collection('userSubscriptions').doc(userId).update({
              status: 'CANCELLED',
              cancelledAt: new Date(),
              lastWebhookEvent: event.event_type
            });
            
            // Also update user membership status
            await db.collection('users').doc(userId).update({
              'membership.jumpClub': false,
              'membership.cancelled': true,
              'membership.cancelledDate': new Date()
            });
            
            console.log('Subscription cancelled via webhook for user:', userId);
          }
        }
        break;

      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        {
          const subscription = event.resource;
          const userId = subscription.custom_id;
          
          if (userId) {
            await db.collection('userSubscriptions').doc(userId).update({
              status: 'SUSPENDED',
              suspendedAt: new Date(),
              lastWebhookEvent: event.event_type
            });
            
            // Suspend user membership
            await db.collection('users').doc(userId).update({
              'membership.jumpClub': false,
              'membership.suspended': true,
              'membership.suspendedDate': new Date()
            });
            
            console.log('Subscription suspended via webhook for user:', userId);
          }
        }
        break;

      case 'PAYMENT.SALE.COMPLETED':
        {
          const payment = event.resource;
          const billingAgreementId = payment.billing_agreement_id;
          
          if (billingAgreementId) {
            // Find subscription by billing agreement ID
            const subscriptions = await db.collection('userSubscriptions')
              .where('subscriptionId', '==', billingAgreementId)
              .get();
            
            if (!subscriptions.empty) {
              const subscriptionDoc = subscriptions.docs[0];
              const userId = subscriptionDoc.id;
              
              // Record the payment
              await db.collection('subscriptionPayments').add({
                userId: userId,
                subscriptionId: billingAgreementId,
                paymentId: payment.id,
                amount: payment.amount.total,
                currency: payment.amount.currency,
                status: payment.state,
                paidAt: new Date(payment.create_time),
                recordedAt: new Date()
              });
              
              console.log('Payment recorded for subscription:', billingAgreementId);
            }
          }
        }
        break;

      case 'PAYMENT.SALE.DENIED':
      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        {
          const resource = event.resource;
          const subscriptionId = resource.billing_agreement_id || resource.id;
          
          if (subscriptionId) {
            // Find user by subscription ID
            const subscriptions = await db.collection('userSubscriptions')
              .where('subscriptionId', '==', subscriptionId)
              .get();
            
            if (!subscriptions.empty) {
              const subscriptionDoc = subscriptions.docs[0];
              const userId = subscriptionDoc.id;
              
              // Record failed payment
              await db.collection('subscriptionPayments').add({
                userId: userId,
                subscriptionId: subscriptionId,
                paymentId: resource.id,
                status: 'FAILED',
                failureReason: resource.reason_code || 'Payment failed',
                attemptedAt: new Date(),
                recordedAt: new Date()
              });
              
              console.log('Failed payment recorded for subscription:', subscriptionId);
              
              // You might want to send email notification or take other action
            }
          }
        }
        break;

      default:
        console.log('Unhandled webhook event type:', event.event_type);
    }

    res.status(200).send('Webhook processed successfully');
  } catch (error) {
    console.error('Error processing PayPal webhook:', error);
    res.status(500).send('Webhook processing failed');
  }
});
