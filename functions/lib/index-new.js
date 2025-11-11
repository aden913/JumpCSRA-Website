"use strict";
/**
 * JumpCSRA Cloud Functions
 * Refactored and modularized for better maintainability
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoCancelPendingOrders = exports.processScheduledEmails = exports.triggerTestEmail = exports.testPayPalDebug = exports.createPayPalInvoice = exports.sendAccountDeletionEmail = exports.sendGiftCardEmailOnCreate = exports.sendGiftCardEmail = exports.sendOrderConfirmationEmail = exports.sendEnhancedOrderConfirmation = exports.testFunction = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
// Import service modules
const emailService_1 = require("./services/emailService");
const paypalService_1 = require("./services/paypalService");
// Import existing test function
var test_1 = require("./test");
Object.defineProperty(exports, "testFunction", { enumerable: true, get: function () { return test_1.testFunction; } });
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
exports.sendEnhancedOrderConfirmation = functions.https.onCall(async (data, context) => {
    try {
        await (0, emailService_1.sendOrderConfirmationEmail)(data);
        return { success: true, message: 'Enhanced order confirmation email sent successfully' };
    }
    catch (error) {
        console.error('❌ ENHANCED EMAIL - Cloud Function error:', error);
        throw error; // Re-throw to preserve the original error type
    }
});
/**
 * Send order confirmation email (legacy function name)
 */
exports.sendOrderConfirmationEmail = functions.https.onCall(async (data, context) => {
    try {
        await (0, emailService_1.sendOrderConfirmationEmail)(data);
        return { success: true, message: 'Order confirmation email sent successfully' };
    }
    catch (error) {
        console.error('❌ ORDER EMAIL - Cloud Function error:', error);
        throw error;
    }
});
/**
 * Send gift card email
 */
exports.sendGiftCardEmail = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to send gift card emails.');
    }
    try {
        await (0, emailService_1.sendGiftCardEmail)(data);
        return { success: true, message: 'Gift card email sent successfully' };
    }
    catch (error) {
        console.error('❌ GIFT CARD - Cloud Function error:', error);
        throw error;
    }
});
/**
 * Send gift card email when gift card is created in Firestore
 */
exports.sendGiftCardEmailOnCreate = functions.firestore
    .document('giftCards/{giftCardId}')
    .onCreate(async (snap, context) => {
    const giftCardData = snap.data();
    // Only send email for purchased gift cards (not promotional ones)
    if ((giftCardData === null || giftCardData === void 0 ? void 0 : giftCardData.isPurchased) && (giftCardData === null || giftCardData === void 0 ? void 0 : giftCardData.recipientEmail)) {
        const emailData = {
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
            await (0, emailService_1.sendGiftCardEmail)(emailData);
        }
        catch (error) {
            console.error('❌ Failed to auto-send gift card email:', error);
        }
    }
});
/**
 * Send account deletion confirmation email
 */
exports.sendAccountDeletionEmail = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to send account deletion emails.');
    }
    try {
        const emailData = {
            email: data.email,
            name: data.name,
            deletionDate: new Date().toISOString(),
            reason: data.reason
        };
        await (0, emailService_1.sendAccountDeletionEmail)(emailData);
        return { success: true, message: 'Account deletion email sent successfully' };
    }
    catch (error) {
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
exports.createPayPalInvoice = functions.https.onCall(async (data, context) => {
    try {
        const invoice = await (0, paypalService_1.createPayPalInvoice)(data);
        return {
            success: true,
            message: 'PayPal invoice created and sent successfully',
            invoiceId: invoice.id,
            invoiceDetails: invoice
        };
    }
    catch (error) {
        console.error('❌ PAYPAL INVOICE - Cloud Function error:', error);
        throw error;
    }
});
/**
 * Test PayPal connection and API functionality
 */
exports.testPayPalDebug = functions.https.onCall(async (data, context) => {
    try {
        const result = await (0, paypalService_1.testPayPalConnection)();
        return result;
    }
    catch (error) {
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
exports.triggerTestEmail = functions.https.onCall(async (data, context) => {
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
                if (!data.bookingId)
                    throw new Error('bookingId required for deposit reminder');
                await processDepositReminderEmails(db, now);
                return { success: true, message: 'Deposit reminder email sent' };
            case 'event-confirmation':
                if (!data.bookingId)
                    throw new Error('bookingId required for event confirmation');
                await processEventConfirmationEmails(db, now);
                return { success: true, message: 'Event confirmation email sent' };
            case 'post-event-thanks':
                if (!data.bookingId)
                    throw new Error('bookingId required for post-event email');
                await processPostEventEmails(db, now);
                return { success: true, message: 'Post-event thank you email sent' };
            case 'rebooking-reminder':
                await processRebookingReminderEmails(db, now);
                return { success: true, message: 'Rebooking reminder email sent' };
            default:
                throw new Error(`Unknown email type: ${data.type}`);
        }
    }
    catch (error) {
        console.error(`❌ EMAIL TEST - ${data.type} failed:`, error);
        throw new functions.https.HttpsError('internal', `Email test failed: ${error.message}`);
    }
});
/**
 * Scheduled email processing (runs every 2 minutes in testing mode)
 */
exports.processScheduledEmails = functions.pubsub
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
    }
    catch (error) {
        console.error('❌ SCHEDULER: Error processing scheduled emails:', error);
    }
});
/**
 * Auto-cancel pending orders after 24 hours
 */
exports.autoCancelPendingOrders = functions.pubsub
    .schedule('every 1 hours')
    .onRun(async (context) => {
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
            return;
        }
        const updates = {};
        let canceledCount = 0;
        snapshot.forEach((child) => {
            const booking = child.val();
            const bookingTime = booking.createdAt || booking.timestamp || now;
            if (bookingTime < cutoffTime) {
                updates[`${child.key}/status`] = 'auto-canceled';
                updates[`${child.key}/canceledAt`] = now;
                updates[`${child.key}/cancelReason`] = 'Auto-canceled after 24 hours';
                canceledCount++;
            }
        });
        if (canceledCount > 0) {
            await pendingOrdersRef.update(updates);
        }
        else {
        }
    }
    catch (error) {
        console.error('❌ AUTO-CANCEL: Error processing pending orders:', error);
    }
});
// =============================================================================
// EMAIL PROCESSING HELPER FUNCTIONS
// =============================================================================
// These functions would contain the actual email processing logic
// For now, they're placeholders that would need to be implemented
// based on the original scheduler functions from the large index.ts file
async function processCartAbandonmentEmails(db, now) {
    // Implementation would go here
}
async function processDepositReminderEmails(db, now) {
    // Implementation would go here
}
async function processEventConfirmationEmails(db, now) {
    // Implementation would go here
}
async function processPostEventEmails(db, now) {
    // Implementation would go here
}
async function processRebookingReminderEmails(db, now) {
    // Implementation would go here
}
//# sourceMappingURL=index-new.js.map
