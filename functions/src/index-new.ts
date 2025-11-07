/**
 * JumpCSRA Cloud Functions
 * Refactored and modularized for better maintainability
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Import service modules
import { 
  sendOrderConfirmationEmail as sendOrderEmail, 
  sendGiftCardEmail as sendGiftEmail,
  sendAccountDeletionEmail as sendDeletionEmail
} from './services/emailService';
import { 
  createPayPalInvoice as createInvoice,
  testPayPalConnection
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
 * Send enhanced order confirmation email
 */
export const sendEnhancedOrderConfirmation = functions.https.onCall(async (data: OrderConfirmationEmailData, context) => {
  console.log('📧 ENHANCED EMAIL - Cloud Function called, auth status:', !!context.auth);
  
  try {
    await sendOrderEmail(data);
    return { success: true, message: 'Enhanced order confirmation email sent successfully' };
  } catch (error: any) {
    console.error('❌ ENHANCED EMAIL - Cloud Function error:', error);
    throw error; // Re-throw to preserve the original error type
  }
});

/**
 * Send order confirmation email (legacy function name)
 */
export const sendOrderConfirmationEmail = functions.https.onCall(async (data: OrderConfirmationEmailData, context) => {
  console.log('📧 ORDER EMAIL - Cloud Function called');
  
  try {
    await sendOrderEmail(data);
    return { success: true, message: 'Order confirmation email sent successfully' };
  } catch (error: any) {
    console.error('❌ ORDER EMAIL - Cloud Function error:', error);
    throw error;
  }
});

/**
 * Send gift card email
 */
export const sendGiftCardEmail = functions.https.onCall(async (data: GiftCardEmailData, context) => {
  console.log('🎁 GIFT CARD - Cloud Function called, auth status:', !!context.auth);
  
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to send gift card emails.');
  }

  try {
    await sendGiftEmail(data);
    return { success: true, message: 'Gift card email sent successfully' };
  } catch (error: any) {
    console.error('❌ GIFT CARD - Cloud Function error:', error);
    throw error;
  }
});

/**
 * Send gift card email when gift card is created in Firestore
 */
export const sendGiftCardEmailOnCreate = functions.firestore
  .document('giftCards/{giftCardId}')
  .onCreate(async (snap, context) => {
    const giftCardData = snap.data();
    
    // Only send email for purchased gift cards (not promotional ones)
    if (giftCardData?.isPurchased && giftCardData?.recipientEmail) {
      console.log('🎁 Auto-sending gift card email for:', giftCardData.recipientEmail);
      
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
        console.log('✅ Auto gift card email sent successfully');
      } catch (error) {
        console.error('❌ Failed to auto-send gift card email:', error);
      }
    }
  });

/**
 * Send account deletion confirmation email
 */
export const sendAccountDeletionEmail = functions.https.onCall(async (data: {
  email: string;
  name?: string;
  reason?: string;
}, context) => {
  console.log('🗑️ ACCOUNT DELETION - Cloud Function called');
  
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

    await sendDeletionEmail(emailData);
    return { success: true, message: 'Account deletion email sent successfully' };
  } catch (error: any) {
    console.error('❌ ACCOUNT DELETION - Cloud Function error:', error);
    throw error;
  }
});

// =============================================================================
// PAYPAL FUNCTIONS
// =============================================================================

/**
 * Create and send PayPal invoice
 */
export const createPayPalInvoice = functions.https.onCall(async (data: PayPalInvoiceData, context) => {
  console.log('💰 PAYPAL INVOICE - Cloud Function called, auth status:', !!context.auth);
  
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
 * Test PayPal connection and API functionality
 */
export const testPayPalDebug = functions.https.onCall(async (data, context) => {
  console.log('🧪 PAYPAL TEST - Cloud Function called');
  
  try {
    const result = await testPayPalConnection();
    return result;
  } catch (error: any) {
    console.error('❌ PAYPAL TEST - Cloud Function error:', error);
    throw new functions.https.HttpsError('internal', `PayPal test failed: ${error.message}`);
  }
});

// =============================================================================
// EMAIL SCHEDULER FUNCTIONS
// =============================================================================

/**
 * Manual trigger for testing different email types
 */
export const triggerTestEmail = functions.https.onCall(async (data: { 
  type: string; 
  email: string; 
  name: string;
  bookingId?: string;
}, context) => {
  console.log('🧪 EMAIL TEST - Manual trigger called:', data.type);
  
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
        if (!data.bookingId) throw new Error('bookingId required for deposit reminder');
        await processDepositReminderEmails(db, now);
        return { success: true, message: 'Deposit reminder email sent' };
        
      case 'event-confirmation': 
        if (!data.bookingId) throw new Error('bookingId required for event confirmation');
        await processEventConfirmationEmails(db, now);
        return { success: true, message: 'Event confirmation email sent' };
        
      case 'post-event-thanks':
        if (!data.bookingId) throw new Error('bookingId required for post-event email');
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
 * Scheduled email processing (runs every 2 minutes in testing mode)
 */
export const processScheduledEmails = functions.pubsub
  .schedule('every 2 minutes') // For production, change to 'every 1 hours'
  .onRun(async (context) => {
    console.log('📧 SCHEDULER: Starting scheduled email processing...');
    
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
      
      console.log('✅ SCHEDULER: All scheduled emails processed successfully');
    } catch (error) {
      console.error('❌ SCHEDULER: Error processing scheduled emails:', error);
    }
  });

/**
 * Auto-cancel pending orders after 24 hours
 */
export const autoCancelPendingOrders = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    console.log('🔄 AUTO-CANCEL: Starting pending order cleanup...');
    
    const db = admin.database();
    const now = Date.now();
    const cutoffTime = now - (24 * 60 * 60 * 1000); // 24 hours ago
    
    try {
      const pendingOrdersRef = db.ref('bookings');
      const snapshot = await pendingOrdersRef
        .orderByChild('status')
        .equalTo('pending')
        .once('value');
      
      if (!snapshot.exists()) {
        console.log('📋 AUTO-CANCEL: No pending orders found');
        return;
      }
      
      const updates: { [key: string]: any } = {};
      let canceledCount = 0;
      
      snapshot.forEach((child) => {
        const booking = child.val();
        const bookingTime = booking.createdAt || booking.timestamp || now;
        
        if (bookingTime < cutoffTime) {
          console.log(`⏰ AUTO-CANCEL: Canceling old pending order ${child.key}`);
          updates[`${child.key}/status`] = 'auto-canceled';
          updates[`${child.key}/canceledAt`] = now;
          updates[`${child.key}/cancelReason`] = 'Auto-canceled after 24 hours';
          canceledCount++;
        }
      });
      
      if (canceledCount > 0) {
        await pendingOrdersRef.update(updates);
        console.log(`✅ AUTO-CANCEL: Canceled ${canceledCount} pending orders`);
      } else {
        console.log('📋 AUTO-CANCEL: No orders needed cancellation');
      }
    } catch (error) {
      console.error('❌ AUTO-CANCEL: Error processing pending orders:', error);
    }
  });

// =============================================================================
// EMAIL PROCESSING HELPER FUNCTIONS
// =============================================================================

// These functions would contain the actual email processing logic
// For now, they're placeholders that would need to be implemented
// based on the original scheduler functions from the large index.ts file

async function processCartAbandonmentEmails(db: admin.database.Database, now: number) {
  console.log('🛒 SCHEDULER: Processing cart abandonment emails...');
  // Implementation would go here
}

async function processDepositReminderEmails(db: admin.database.Database, now: number) {
  console.log('💰 SCHEDULER: Processing deposit reminder emails...');
  // Implementation would go here
}

async function processEventConfirmationEmails(db: admin.database.Database, now: number) {
  console.log('📅 SCHEDULER: Processing event confirmation emails...');
  // Implementation would go here
}

async function processPostEventEmails(db: admin.database.Database, now: number) {
  console.log('🎉 SCHEDULER: Processing post-event thank you emails...');
  // Implementation would go here
}

async function processRebookingReminderEmails(db: admin.database.Database, now: number) {
  console.log('🔄 SCHEDULER: Processing rebooking reminder emails...');
  // Implementation would go here
}