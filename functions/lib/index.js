"use strict";
/**
 * JumpCSRA Cloud Functions
 * Refactored and modularized for better maintainability
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoCancelPendingOrders = exports.processScheduledEmails = exports.triggerTestEmail = exports.testPayPalDebug = exports.createPayPalInvoice = exports.sendAccountDeletionEmail = exports.sendGiftCardEmailOnCreate = exports.sendGiftCardEmail = exports.sendOrderConfirmationEmail = exports.testFunction = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios_1 = require("axios");
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
exports.sendOrderConfirmationEmail = functions.https.onCall(async (data, context) => {
    console.log('📧 ORDER CONFIRMATION - Cloud Function called, auth status:', !!context.auth);
    try {
        const result = await (0, emailService_1.sendOrderConfirmationEmail)(data);
        return result; // Return the actual email server response
    }
    catch (error) {
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
exports.sendGiftCardEmail = functions.https.onCall(async (data, context) => {
    console.log('🎁 GIFT CARD - Cloud Function called, auth status:', !!context.auth);
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to send gift card emails.');
    }
    try {
        const result = await (0, emailService_1.sendGiftCardEmail)(data);
        return result; // Return the actual email server response
    }
    catch (error) {
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
exports.sendGiftCardEmailOnCreate = functions.firestore
    .document('giftCards/{giftCardId}')
    .onCreate(async (snap, context) => {
    const giftCardData = snap.data();
    // Only send email for purchased gift cards (not promotional ones)
    if ((giftCardData === null || giftCardData === void 0 ? void 0 : giftCardData.isPurchased) && (giftCardData === null || giftCardData === void 0 ? void 0 : giftCardData.recipientEmail)) {
        console.log('🎁 Auto-sending gift card email for:', giftCardData.recipientEmail);
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
            console.log('✅ Auto gift card email sent successfully');
        }
        catch (error) {
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
exports.sendAccountDeletionEmail = functions.https.onCall(async (data, context) => {
    console.log('🗑️ ACCOUNT DELETION - Cloud Function called');
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
        const result = await (0, emailService_1.sendAccountDeletionEmail)(emailData);
        return result; // Return the actual email server response
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
exports.createPayPalInvoice = functions.https.onCall(async (data, context) => {
    console.log('💰 PAYPAL INVOICE - Cloud Function called, auth status:', !!context.auth);
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
exports.testPayPalDebug = functions.https.onCall(async (data, context) => {
    console.log('🧪 PAYPAL TEST - Cloud Function called');
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
exports.triggerTestEmail = functions.https.onCall(async (data, context) => {
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
                if (!data.bookingId)
                    throw new Error('bookingId required for deposit reminder');
                await processDepositReminderEmails(db, now, data.bookingId);
                return { success: true, message: 'Deposit reminder email sent' };
            case 'event-confirmation':
                if (!data.bookingId)
                    throw new Error('bookingId required for event confirmation');
                await processEventConfirmationEmails(db, now, data.bookingId);
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
    }
    catch (error) {
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
 * - Current: Every 2 minutes (testing/development mode)
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
exports.processScheduledEmails = functions.pubsub
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
    }
    catch (error) {
        console.error('❌ SCHEDULER: Error processing scheduled emails:', error);
    }
});
/**
 * Automatic Pending Order Cleanup Function (Cloud Scheduler)
 *
 * Purpose: Automatically cancels pending orders that remain unpaid after 24 hours
 *
 * Functionality:
 * - Maintains database hygiene by cleaning up stale pending orders
 * - Prevents indefinite reservation of inventory/time slots
 * - Provides clear order lifecycle management
 * - Reduces administrative overhead for manual order cleanup
 * - Supports business rules for payment deadlines
 *
 * Schedule: Runs every hour to ensure timely cleanup
 *
 * Processing Logic:
 * - Queries database for orders with 'pending' status
 * - Identifies orders older than 24 hours (configurable threshold)
 * - Updates order status to 'auto-canceled' with timestamp
 * - Records cancellation reason for audit purposes
 * - Batch processes multiple orders for efficiency
 *
 * Business Rules:
 * - 24-hour grace period for payment completion
 * - Preserves order data for record keeping
 * - Marks cancellation reason as automatic system action
 * - Maintains audit trail with timestamps
 *
 * Database Operations:
 * - Efficient querying using Firebase Database indexing
 * - Batch updates to minimize database writes
 * - Atomic operations to prevent data inconsistency
 * - Comprehensive logging for monitoring
 *
 * Benefits:
 * - Automatic inventory/slot release for rebooking
 * - Reduced manual administration
 * - Clear customer expectations for payment deadlines
 * - Improved system performance through data cleanup
 *
 * Configuration: 24-hour threshold can be adjusted based on business requirements
 */
exports.autoCancelPendingOrders = functions.pubsub
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
        const updates = {};
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
        }
        else {
            console.log('📋 AUTO-CANCEL: No orders needed cancellation');
        }
    }
    catch (error) {
        console.error('❌ AUTO-CANCEL: Error processing pending orders:', error);
    }
});
// =============================================================================
// EMAIL PROCESSING HELPER FUNCTIONS
// =============================================================================
// Email timing constants for scheduled functions
const isTestingMode = process.env.NODE_ENV !== 'production';
const EMAIL_TIMING = {
    CART_ABANDONMENT: isTestingMode ? 1 * 60 * 1000 : 24 * 60 * 60 * 1000, // 1 min vs 24 hours
    DEPOSIT_REMINDER: isTestingMode ? 2 * 60 * 1000 : 2 * 24 * 60 * 60 * 1000, // 2 min vs 2 days
    EVENT_CONFIRMATION: isTestingMode ? 3 * 60 * 1000 : 3 * 24 * 60 * 60 * 1000, // 3 min vs 3 days
    POST_EVENT_THANKS: isTestingMode ? 4 * 60 * 1000 : 1 * 24 * 60 * 60 * 1000, // 4 min vs 1 day
    REBOOKING_REMINDER: isTestingMode ? 5 * 60 * 1000 : 9 * 30 * 24 * 60 * 60 * 1000 // 5 min vs 9 months
};
// Email server configuration for scheduled emails
const EMAIL_SERVER_BASE_URL = 'http://170.187.145.7:3001';
const EMAIL_SERVER_API_KEY = 'jumpcsra_secure_api_key_2024';
console.log('📧 EMAIL TIMING CONFIG:', {
    testingMode: isTestingMode,
    cartAbandonment: isTestingMode ? '1 minute' : '24 hours',
    depositReminder: isTestingMode ? '2 minutes' : '7 days',
    eventConfirmation: isTestingMode ? '3 minutes' : '3 days',
    postEventThanks: isTestingMode ? '4 minutes' : '1 day',
    rebookingReminder: isTestingMode ? '5 minutes' : '9 months'
});
async function processCartAbandonmentEmails(db, now) {
    var _a;
    try {
        console.log('🛒 SCHEDULER: Checking cart abandonment emails...');
        const cartsRef = db.ref('carts');
        const snapshot = await cartsRef.once('value');
        if (!snapshot.exists()) {
            console.log('🛒 SCHEDULER: No carts found');
            return;
        }
        const carts = snapshot.val();
        let emailsSent = 0;
        for (const [cartId, cartData] of Object.entries(carts)) {
            const cart = cartData;
            // Skip if no email address
            if (!cart.email)
                continue;
            const lastUpdated = cart.lastUpdated || cart.createdAt;
            if (!lastUpdated)
                continue;
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
                            customerName: ((_a = cart.customerInfo) === null || _a === void 0 ? void 0 : _a.name) || 'Customer',
                            cartData: {
                                items: cart.items || [],
                                cartId: cartId,
                                lastUpdated: lastUpdated
                            }
                        };
                        await axios_1.default.post(`${EMAIL_SERVER_BASE_URL}/api/email/cart-abandonment`, emailData, {
                            headers: {
                                'Content-Type': 'application/json',
                                'X-API-Key': EMAIL_SERVER_API_KEY,
                                'Accept': 'application/json'
                            },
                            timeout: 30000
                        });
                        await emailRef.set({ sentAt: now, type: 'cart-abandonment' });
                        emailsSent++;
                        console.log(`✅ SCHEDULER: Sent cart abandonment email to ${cart.email}`);
                    }
                    catch (emailError) {
                        console.error(`❌ SCHEDULER: Failed to send cart abandonment email to ${cart.email}:`, emailError);
                    }
                }
            }
        }
        console.log(`🛒 SCHEDULER: Sent ${emailsSent} cart abandonment emails`);
    }
    catch (error) {
        console.error('❌ SCHEDULER: Error processing cart abandonment emails:', error);
    }
}
async function processDepositReminderEmails(db, now, specificBookingId) {
    var _a, _b, _c, _d;
    try {
        console.log('💰 SCHEDULER: Checking deposit reminder emails...');
        const bookingsRef = db.ref('bookings');
        const snapshot = await bookingsRef.once('value');
        if (!snapshot.exists()) {
            console.log('💰 SCHEDULER: No bookings found');
            return;
        }
        const bookings = snapshot.val();
        let emailsSent = 0;
        for (const [bookingId, bookingData] of Object.entries(bookings)) {
            const booking = bookingData;
            // If testing specific booking, only process that one
            if (specificBookingId && bookingId !== specificBookingId)
                continue;
            // Only process pending bookings with remaining balance (deposit payments)
            const remainingBalance = ((_a = booking.paymentDetails) === null || _a === void 0 ? void 0 : _a.remainingBalance) || 0;
            if (!remainingBalance || remainingBalance <= 0)
                continue;
            if (booking.status !== 'pending')
                continue;
            if (!((_b = booking.customerInfo) === null || _b === void 0 ? void 0 : _b.email))
                continue;
            if (((_c = booking.emails) === null || _c === void 0 ? void 0 : _c.depositReminder) === true)
                continue; // Already sent
            // Parse event date from the date range string (e.g., "11/10/2025 - 11/10/2025")
            const eventDateString = (_d = booking.orderDetails) === null || _d === void 0 ? void 0 : _d.eventDate;
            if (!eventDateString)
                continue;
            // Extract the first date from the range
            const firstDate = eventDateString.split(' - ')[0];
            const eventDate = new Date(firstDate).getTime();
            if (isNaN(eventDate)) {
                console.log(`💰 SCHEDULER: Invalid event date for booking ${bookingId}: ${eventDateString}`);
                continue;
            }
            const timeUntilEvent = eventDate - now;
            console.log(`💰 SCHEDULER: Booking ${bookingId} - Event in ${Math.round(timeUntilEvent / (1000 * 60 * 60))} hours`);
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
                    console.log(`💰 SCHEDULER: Sending deposit reminder to ${booking.customerInfo.email} for booking ${bookingId}`);
                    await axios_1.default.post(`${EMAIL_SERVER_BASE_URL}/api/email/deposit-reminder`, emailData, {
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
                    console.log(`✅ SCHEDULER: Sent deposit reminder email to ${booking.customerInfo.email} for booking ${bookingId}`);
                }
                catch (emailError) {
                    console.error(`❌ SCHEDULER: Failed to send deposit reminder email to ${booking.customerInfo.email}:`, emailError);
                }
            }
            else {
                console.log(`💰 SCHEDULER: Booking ${bookingId} doesn't meet timing criteria (${Math.round(timeUntilEvent / (1000 * 60 * 60))} hours until event)`);
            }
        }
        console.log(`💰 SCHEDULER: Sent ${emailsSent} deposit reminder emails`);
    }
    catch (error) {
        console.error('❌ SCHEDULER: Error processing deposit reminder emails:', error);
    }
}
async function processEventConfirmationEmails(db, now, specificBookingId) {
    var _a, _b;
    try {
        console.log('📅 SCHEDULER: Checking event confirmation emails...');
        const bookingsRef = db.ref('bookings');
        const snapshot = await bookingsRef.once('value');
        if (!snapshot.exists()) {
            console.log('📅 SCHEDULER: No bookings found');
            return;
        }
        const bookings = snapshot.val();
        let emailsSent = 0;
        for (const [bookingId, bookingData] of Object.entries(bookings)) {
            const booking = bookingData;
            // If testing specific booking, only process that one
            if (specificBookingId && bookingId !== specificBookingId)
                continue;
            // Only process confirmed bookings with no remaining balance
            if (booking.status !== 'confirmed')
                continue;
            if (booking.remainingBalance > 0)
                continue; // Still has deposit due
            if (!((_a = booking.customerInfo) === null || _a === void 0 ? void 0 : _a.email))
                continue;
            if (((_b = booking.emails) === null || _b === void 0 ? void 0 : _b.eventConfirmation) === true)
                continue; // Already sent
            const eventDate = new Date(booking.eventDate).getTime();
            const timeUntilEvent = eventDate - now;
            console.log(`📅 SCHEDULER: Booking ${bookingId} - Event in ${Math.round(timeUntilEvent / (1000 * 60 * 60))} hours`);
            // Send confirmation based on timing (3 days before event or testing interval)
            // Skip timing check if testing specific booking
            if (specificBookingId || (timeUntilEvent <= EMAIL_TIMING.EVENT_CONFIRMATION && timeUntilEvent > 0)) {
                try {
                    const emailData = {
                        customerEmail: booking.customerInfo.email,
                        customerName: booking.customerInfo.name || 'Customer',
                        bookingData: {
                            bookingId: bookingId,
                            eventDate: booking.eventDate,
                            eventDetails: booking.eventDetails || {},
                            deliveryAddress: booking.deliveryAddress,
                            setupTime: booking.setupTime
                        }
                    };
                    await axios_1.default.post(`${EMAIL_SERVER_BASE_URL}/api/email/event-confirmation`, emailData, {
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
                    console.log(`✅ SCHEDULER: Sent event confirmation email to ${booking.customerInfo.email}`);
                }
                catch (emailError) {
                    console.error(`❌ SCHEDULER: Failed to send event confirmation email to ${booking.customerInfo.email}:`, emailError);
                }
            }
        }
        console.log(`📅 SCHEDULER: Sent ${emailsSent} event confirmation emails`);
    }
    catch (error) {
        console.error('❌ SCHEDULER: Error processing event confirmation emails:', error);
    }
}
async function processPostEventEmails(db, now) {
    var _a, _b;
    try {
        console.log('🎉 SCHEDULER: Checking post-event thank you emails...');
        const bookingsRef = db.ref('bookings');
        const snapshot = await bookingsRef.once('value');
        if (!snapshot.exists()) {
            console.log('🎉 SCHEDULER: No bookings found');
            return;
        }
        const bookings = snapshot.val();
        let emailsSent = 0;
        for (const [bookingId, bookingData] of Object.entries(bookings)) {
            const booking = bookingData;
            // Only process events that have passed
            if (!((_a = booking.customerInfo) === null || _a === void 0 ? void 0 : _a.email))
                continue;
            if (((_b = booking.emails) === null || _b === void 0 ? void 0 : _b.thanks) === true)
                continue; // Already sent
            const eventDate = new Date(booking.eventDate).getTime();
            const timeSinceEvent = now - eventDate;
            // Send thank you email after event (1 day after or testing interval)
            if (timeSinceEvent >= EMAIL_TIMING.POST_EVENT_THANKS) {
                try {
                    const emailData = {
                        customerEmail: booking.customerInfo.email,
                        customerName: booking.customerInfo.name || 'Customer',
                        bookingData: {
                            bookingId: bookingId,
                            eventDate: booking.eventDate,
                            eventDetails: booking.eventDetails || {}
                        }
                    };
                    await axios_1.default.post(`${EMAIL_SERVER_BASE_URL}/api/email/post-event-thanks`, emailData, {
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
                    console.log(`✅ SCHEDULER: Sent post-event thank you email to ${booking.customerInfo.email}`);
                }
                catch (emailError) {
                    console.error(`❌ SCHEDULER: Failed to send post-event thank you email to ${booking.customerInfo.email}:`, emailError);
                }
            }
        }
        console.log(`🎉 SCHEDULER: Sent ${emailsSent} post-event thank you emails`);
    }
    catch (error) {
        console.error('❌ SCHEDULER: Error processing post-event thank you emails:', error);
    }
}
async function processRebookingReminderEmails(db, now) {
    var _a, _b;
    try {
        console.log('🔄 SCHEDULER: Checking rebooking reminder emails...');
        const bookingsRef = db.ref('bookings');
        const snapshot = await bookingsRef.once('value');
        if (!snapshot.exists()) {
            console.log('🔄 SCHEDULER: No bookings found');
            return;
        }
        const bookings = snapshot.val();
        let emailsSent = 0;
        for (const [bookingId, bookingData] of Object.entries(bookings)) {
            const booking = bookingData;
            // Only process events that have passed significantly
            if (!((_a = booking.customerInfo) === null || _a === void 0 ? void 0 : _a.email))
                continue;
            if (((_b = booking.emails) === null || _b === void 0 ? void 0 : _b.rebooking) === true)
                continue; // Already sent
            const eventDate = new Date(booking.eventDate).getTime();
            const timeSinceEvent = now - eventDate;
            // Send rebooking reminder after significant time (9 months or testing interval)
            if (timeSinceEvent >= EMAIL_TIMING.REBOOKING_REMINDER) {
                try {
                    const emailData = {
                        customerEmail: booking.customerInfo.email,
                        customerName: booking.customerInfo.name || 'Customer',
                        bookingData: {
                            bookingId: bookingId,
                            eventDate: booking.eventDate,
                            eventDetails: booking.eventDetails || {},
                            pastExperience: {
                                satisfactionLevel: 'excellent', // Could be tracked from feedback
                                favoriteItems: booking.rentalItems || []
                            }
                        }
                    };
                    await axios_1.default.post(`${EMAIL_SERVER_BASE_URL}/api/email/rebooking-reminder`, emailData, {
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
                    console.log(`✅ SCHEDULER: Sent rebooking reminder email to ${booking.customerInfo.email}`);
                }
                catch (emailError) {
                    console.error(`❌ SCHEDULER: Failed to send rebooking reminder email to ${booking.customerInfo.email}:`, emailError);
                }
            }
        }
        console.log(`🔄 SCHEDULER: Sent ${emailsSent} rebooking reminder emails`);
    }
    catch (error) {
        console.error('❌ SCHEDULER: Error processing rebooking reminder emails:', error);
    }
}
//# sourceMappingURL=index.js.map