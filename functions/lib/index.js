"use strict";
/**
 * JumpCSRA Cloud Functions
 * Refactored and modularized for better maintainability
 */
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureMembershipPayment = exports.createMembershipOrder = exports.processMembershipBilling = exports.autoCompleteBookings = exports.processScheduledEmails = exports.triggerTestEmail = exports.processPayPalBookingRefund = exports.testPayPalDebug = exports.createPayPalInvoice = exports.sendAccountDeletionEmail = exports.sendGiftCardEmailOnCreate = exports.sendGiftCardEmail = exports.sendOrderConfirmationEmail = exports.testFunction = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios_1 = require("axios");
// Import service modules
const emailService_1 = require("./services/emailService");
const paypalService_1 = require("./services/paypalService");
// Import existing test function
var test_1 = require("./test");
Object.defineProperty(exports, "testFunction", { enumerable: true, get: function () { return test_1.testFunction; } });
// PayPal configuration constants
const PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com"; // Use https://api-m.paypal.com for production
const PAYPAL_CLIENT_ID = "AcxW1Ok9Z8KpBUU9_JD-kQ3hFKvJ2HCCXDEHCsD0S4u7-Y4PcW3nwqLzYcq5aHUVKOhAZ2tJ9MXJixCO"; // Sandbox client ID
const PAYPAL_CLIENT_SECRET = ((_a = functions.config().paypal) === null || _a === void 0 ? void 0 : _a.client_secret) || "YOUR_PAYPAL_CLIENT_SECRET";
/**
 * Get PayPal access token
 */
async function getPayPalAccessToken() {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    const response = await axios_1.default.post(`${PAYPAL_BASE_URL}/v1/oauth2/token`, 'grant_type=client_credentials', {
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
exports.sendOrderConfirmationEmail = functions.https.onCall(async (data, context) => {
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
    try {
        const result = await (0, paypalService_1.testPayPalConnection)();
        return result;
    }
    catch (error) {
        console.error('❌ PAYPAL TEST - Cloud Function error:', error);
        throw new functions.https.HttpsError('internal', `PayPal test failed: ${error.message}`);
    }
});
exports.processPayPalBookingRefund = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    try {
        const { captureId, amount, reason = 'Booking cancellation' } = data;
        if (!captureId || !amount || amount <= 0) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid refund parameters');
        }
        const result = await (0, paypalService_1.processPayPalRefund)(captureId, amount, reason);
        return result;
    }
    catch (error) {
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
exports.autoCompleteBookings = functions.pubsub
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
        const updates = {};
        let completedCount = 0;
        snapshot.forEach((child) => {
            var _a;
            const booking = child.val();
            const bookingStatus = booking.status || 'pending';
            // Only process confirmed or paid bookings
            if (bookingStatus === 'confirmed' || bookingStatus === 'paid') {
                // Access event date from the correct location in the data structure
                const eventDate = ((_a = booking.orderDetails) === null || _a === void 0 ? void 0 : _a.eventDate) || booking.eventDate;
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
                }
                else {
                }
            }
        });
        if (completedCount > 0) {
            await bookingsRef.update(updates);
        }
        else {
        }
    }
    catch (error) {
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
exports.processMembershipBilling = functions.pubsub
    .schedule('0 9 * * *') // Daily at 9 AM UTC
    .onRun(async (context) => {
    var _a, _b, _c, _d;
    const firestore = admin.firestore();
    const now = new Date();
    try {
        // Get all users with membership data
        const usersSnapshot = await firestore.collection('users').get();
        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            try {
                // Get membership subcollection
                const membershipDoc = await firestore
                    .collection('users')
                    .doc(userId)
                    .collection('membership')
                    .doc('status')
                    .get();
                if (!membershipDoc.exists)
                    continue;
                const membership = membershipDoc.data();
                if (!(membership === null || membership === void 0 ? void 0 : membership.dateStarted))
                    continue;
                const dateStarted = new Date(membership.dateStarted);
                const daysSinceStart = Math.floor((now.getTime() - dateStarted.getTime()) / (1000 * 60 * 60 * 24));
                // Check if 30 days have passed since last billing
                if (daysSinceStart >= 30 && daysSinceStart % 30 === 0) {
                    // Determine membership type and cost - simplified for Jump Club
                    const membershipType = 'jump-club';
                    const amount = 149; // Fixed Jump Club price
                    // Check if membership is cancelled
                    if (membership.cancelled) {
                        // Cancel the membership instead of billing
                        await firestore
                            .collection('users')
                            .doc(userId)
                            .collection('membership')
                            .doc('status')
                            .update({
                            jumpClub: false,
                            dateStarted: admin.firestore.FieldValue.delete(),
                            cancelled: false,
                            updatedAt: now.toISOString()
                        });
                        // Send cancellation confirmation email
                        const userData = userDoc.data();
                        if (userData === null || userData === void 0 ? void 0 : userData.email) {
                            try {
                                await (0, emailService_1.sendOrderConfirmationEmail)({
                                    recipientEmail: userData.email,
                                    recipientName: userData.name || 'Valued Customer',
                                    orderID: `CANCEL-${userId}-${Date.now()}`,
                                    orderDate: now.toISOString(),
                                    eventDate: now.toISOString(),
                                    deliveryAddress: 'N/A',
                                    rentalItems: [{
                                            name: `${membershipType.charAt(0).toUpperCase() + membershipType.slice(1)} Membership - Cancelled`,
                                            price: 0,
                                            quantity: 1
                                        }],
                                    lastMinuteAdditions: [],
                                    subtotal: 0,
                                    surfaceAdjustment: 0,
                                    timeAdjustment: 0,
                                    deliveryCost: 0,
                                    totalAmount: 0,
                                    paymentType: 'Membership Cancellation',
                                    amountPaid: 0,
                                    remainingBalance: 0
                                });
                            }
                            catch (emailError) {
                                console.error(`Failed to send cancellation email to ${userData.email}:`, emailError);
                            }
                        }
                        continue;
                    }
                    // Get payment info
                    const paymentDoc = await firestore
                        .collection('users')
                        .doc(userId)
                        .collection('paymentInfo')
                        .doc('data')
                        .get();
                    if (!paymentDoc.exists || !((_a = paymentDoc.data()) === null || _a === void 0 ? void 0 : _a.paypalVaultId)) {
                        // No payment method, send email and cancel membership
                        const userData = userDoc.data();
                        if (userData === null || userData === void 0 ? void 0 : userData.email) {
                            try {
                                await (0, emailService_1.sendOrderConfirmationEmail)({
                                    recipientEmail: userData.email,
                                    recipientName: userData.name || 'Valued Customer',
                                    orderID: `FAIL-${userId}-${Date.now()}`,
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
                            }
                            catch (emailError) {
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
                    const paymentData = paymentDoc.data(); // We know it exists from the check above
                    // Create payment record
                    const paymentId = `mb-${userId}-${Date.now()}`;
                    const nextBillingDate = new Date(now);
                    nextBillingDate.setDate(nextBillingDate.getDate() + 30);
                    try {
                        // Attempt to charge the payment method
                        const chargeResult = await (0, paypalService_1.chargeVaultedPayment)({
                            customerId: paymentData.paypalVaultId,
                            paymentTokenId: ((_b = paymentData.savedPaymentMethods[0]) === null || _b === void 0 ? void 0 : _b.paypalVaultId) || '',
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
                            paymentMethodId: (_c = paymentData.savedPaymentMethods[0]) === null || _c === void 0 ? void 0 : _c.id,
                            paypalTransactionId: chargeResult.id,
                            status: 'completed',
                            createdAt: now.toISOString()
                        });
                        // Send successful billing email
                        const userData = userDoc.data();
                        if (userData === null || userData === void 0 ? void 0 : userData.email) {
                            try {
                                await (0, emailService_1.sendOrderConfirmationEmail)({
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
                            }
                            catch (emailError) {
                                console.error(`Failed to send billing success email to ${userData.email}:`, emailError);
                            }
                        }
                    }
                    catch (chargeError) {
                        // Payment failed - save failed record and send email
                        await firestore.collection('membershipPayments').doc(paymentId).set({
                            id: paymentId,
                            userId: userId,
                            membershipType: membershipType,
                            amount: amount,
                            paymentDate: now.toISOString(),
                            nextBillingDate: nextBillingDate.toISOString(),
                            paymentMethodId: (_d = paymentData === null || paymentData === void 0 ? void 0 : paymentData.savedPaymentMethods[0]) === null || _d === void 0 ? void 0 : _d.id,
                            status: 'failed',
                            failureReason: (chargeError === null || chargeError === void 0 ? void 0 : chargeError.message) || 'Unknown payment error',
                            createdAt: now.toISOString()
                        });
                        // Send payment failure email and cancel membership
                        const userData = userDoc.data();
                        if (userData === null || userData === void 0 ? void 0 : userData.email) {
                            try {
                                await (0, emailService_1.sendOrderConfirmationEmail)({
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
                            }
                            catch (emailError) {
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
            }
            catch (userError) {
                console.error(`Error processing membership billing for user ${userId}:`, userError);
            }
        }
    }
    catch (error) {
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
async function processCartAbandonmentEmails(db, now) {
    var _a;
    try {
        const cartsRef = db.ref('carts');
        const snapshot = await cartsRef.once('value');
        if (!snapshot.exists()) {
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
                    }
                    catch (emailError) {
                        console.error(`❌ SCHEDULER: Failed to send cart abandonment email to ${cart.email}:`, emailError);
                    }
                }
            }
        }
    }
    catch (error) {
        console.error('❌ SCHEDULER: Error processing cart abandonment emails:', error);
    }
}
async function processDepositReminderEmails(db, now) {
    var _a, _b, _c, _d;
    try {
        const bookingsRef = db.ref('bookings');
        const snapshot = await bookingsRef.once('value');
        if (!snapshot.exists()) {
            return;
        }
        const bookings = snapshot.val();
        let emailsSent = 0;
        for (const [bookingId, bookingData] of Object.entries(bookings)) {
            const booking = bookingData;
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
                }
                catch (emailError) {
                    console.error(`❌ SCHEDULER: Failed to send deposit reminder email to ${booking.customerInfo.email}:`, emailError);
                }
            }
            else {
            }
        }
    }
    catch (error) {
        console.error('❌ SCHEDULER: Error processing deposit reminder emails:', error);
    }
}
async function processEventConfirmationEmails(db, now) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    try {
        const bookingsRef = db.ref('bookings');
        const snapshot = await bookingsRef.once('value');
        if (!snapshot.exists()) {
            return;
        }
        const bookings = snapshot.val();
        let emailsSent = 0;
        for (const [bookingId, bookingData] of Object.entries(bookings)) {
            const booking = bookingData;
            // Only process confirmed bookings with no remaining balance  
            const remainingBalance = ((_a = booking.paymentDetails) === null || _a === void 0 ? void 0 : _a.remainingBalance) || 0;
            if (booking.status !== 'confirmed')
                continue;
            if (remainingBalance > 0)
                continue; // Still has deposit due
            if (!((_b = booking.customerInfo) === null || _b === void 0 ? void 0 : _b.email))
                continue;
            if (((_c = booking.emails) === null || _c === void 0 ? void 0 : _c.eventConfirmation) === true)
                continue; // Already sent
            // Parse event date from the date range string (e.g., "11/11/2025 - 11/11/2025")
            const eventDateString = (_d = booking.orderDetails) === null || _d === void 0 ? void 0 : _d.eventDate;
            if (!eventDateString)
                continue;
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
                            deliveryAddress: ((_e = booking.orderDetails) === null || _e === void 0 ? void 0 : _e.deliveryAddress) || '',
                            deliveryTime: ((_f = booking.orderDetails) === null || _f === void 0 ? void 0 : _f.deliveryTime) || '',
                            duration: ((_g = booking.orderDetails) === null || _g === void 0 ? void 0 : _g.duration) || '',
                            surface: ((_h = booking.orderDetails) === null || _h === void 0 ? void 0 : _h.surface) || '',
                            items: ((_j = booking.orderDetails) === null || _j === void 0 ? void 0 : _j.items) || []
                        }
                    };
                    await axios_1.default.post(`${EMAIL_SERVER_BASE_URL}/api/email/booking-confirmation`, emailData, {
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
                }
                catch (emailError) {
                    console.error(`❌ SCHEDULER: Failed to send event confirmation email to ${booking.customerInfo.email}:`, emailError);
                }
            }
        }
    }
    catch (error) {
        console.error('❌ SCHEDULER: Error processing event confirmation emails:', error);
    }
}
async function processPostEventEmails(db, now) {
    var _a, _b, _c, _d, _e;
    try {
        const bookingsRef = db.ref('bookings');
        const snapshot = await bookingsRef.once('value');
        if (!snapshot.exists()) {
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
            // Parse event date from the date range string (e.g., "11/09/2025 - 11/09/2025")
            const eventDateString = (_c = booking.orderDetails) === null || _c === void 0 ? void 0 : _c.eventDate;
            if (!eventDateString)
                continue;
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
                            totalAmount: (_d = booking.paymentDetails) === null || _d === void 0 ? void 0 : _d.totalAmount,
                            items: ((_e = booking.orderDetails) === null || _e === void 0 ? void 0 : _e.items) || []
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
                }
                catch (emailError) {
                    console.error(`❌ SCHEDULER: Failed to send post-event thank you email to ${booking.customerInfo.email}:`, emailError);
                }
            }
        }
    }
    catch (error) {
        console.error('❌ SCHEDULER: Error processing post-event thank you emails:', error);
    }
}
async function processRebookingReminderEmails(db, now) {
    var _a, _b, _c;
    try {
        const bookingsRef = db.ref('bookings');
        const snapshot = await bookingsRef.once('value');
        if (!snapshot.exists()) {
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
            // Parse event date from the date range string (e.g., "11/09/2025 - 11/09/2025")
            const eventDateString = (_c = booking.orderDetails) === null || _c === void 0 ? void 0 : _c.eventDate;
            if (!eventDateString)
                continue;
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
                    await axios_1.default.post(`${EMAIL_SERVER_BASE_URL}/api/email/follow-up`, emailData, {
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
                }
                catch (emailError) {
                    console.error(`❌ SCHEDULER: Failed to send rebooking reminder email to ${booking.customerInfo.email}:`, emailError);
                }
            }
        }
    }
    catch (error) {
        console.error('❌ SCHEDULER: Error processing rebooking reminder emails:', error);
    }
}
// Membership-specific API endpoints
/**
 * Create membership order with PayPal
 */
exports.createMembershipOrder = functions.https.onRequest(async (req, res) => {
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    try {
        const { userId, amount, currency = 'USD' } = req.body;
        if (!userId || !amount) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: userId, amount'
            });
            return;
        }
        // Create PayPal order for membership with vault setup
        const orderResponse = await createVaultedPayPalOrder({
            amount: amount.toString(),
            currency,
            userId,
            description: 'Jump Club Membership - Monthly Subscription'
        });
        console.log('Membership order created:', orderResponse);
        res.status(200).json({
            success: true,
            orderId: orderResponse.id
        });
    }
    catch (error) {
        console.error('Error creating membership order:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create membership order'
        });
    }
});
/**
 * Capture membership payment and set up vault
 */
exports.captureMembershipPayment = functions.https.onRequest(async (req, res) => {
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    try {
        const { orderId, userId } = req.body;
        if (!orderId || !userId) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: orderId, userId'
            });
            return;
        }
        // Capture the PayPal payment
        const captureResponse = await captureVaultedPayment(orderId);
        if (!captureResponse.success) {
            res.status(400).json({
                success: false,
                error: 'Payment capture failed'
            });
            return;
        }
        // Check if we got vault information
        if (!captureResponse.vaultId) {
            console.error('Payment captured but no vault ID received for user:', userId);
            res.status(500).json({
                success: false,
                error: 'Payment processed but recurring billing setup incomplete. Please contact support.'
            });
            return;
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
            nextBillingDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
            ),
            paymentMethodId: captureResponse.vaultId,
            paypalTransactionId: captureResponse.transactionId,
            status: 'completed'
        };
        await firestore.collection('membershipPayments').doc(paymentRecord.id).set(paymentRecord);
        console.log('Membership payment completed successfully for user:', userId);
        res.status(200).json({
            success: true,
            transactionId: captureResponse.transactionId,
            vaultId: captureResponse.vaultId
        });
    }
    catch (error) {
        console.error('Error capturing membership payment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process membership payment'
        });
    }
});
// Helper function to create PayPal order with vault setup
async function createVaultedPayPalOrder(orderData) {
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
    const response = await axios_1.default.post(`${PAYPAL_BASE_URL}/v2/checkout/orders`, paypalOrder, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await getPayPalAccessToken()}`,
        },
    });
    return response.data;
}
// Helper function to capture vaulted payment
async function captureVaultedPayment(orderId) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    try {
        const response = await axios_1.default.post(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {}, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await getPayPalAccessToken()}`,
            },
        });
        const captureData = response.data;
        // Extract vault information
        const paymentSource = (_a = captureData.payment_source) === null || _a === void 0 ? void 0 : _a.paypal;
        const vaultId = (_c = (_b = paymentSource === null || paymentSource === void 0 ? void 0 : paymentSource.attributes) === null || _b === void 0 ? void 0 : _b.vault) === null || _c === void 0 ? void 0 : _c.id;
        const transactionId = (_h = (_g = (_f = (_e = (_d = captureData.purchase_units) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.payments) === null || _f === void 0 ? void 0 : _f.captures) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.id;
        return {
            success: true,
            vaultId,
            transactionId,
            captureData
        };
    }
    catch (error) {
        console.error('Error capturing vaulted payment:', error);
        return {
            success: false,
            error: ((_j = error.response) === null || _j === void 0 ? void 0 : _j.data) || error.message
        };
    }
}
//# sourceMappingURL=index.js.map