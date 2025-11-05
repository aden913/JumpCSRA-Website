/**
 * Email Testing Configuration
 * Modify timing for scheduled emails to test them quickly
 */

import { scheduleCartReminderEmail, scheduleDepositReminderEmail, scheduleEventConfirmationEmail, schedulePostEventThanksEmail, scheduleRebookingReminderEmail } from './backendEmailService';

// Test timing configuration (in minutes)
export const EMAIL_TEST_TIMING = {
  CART_ABANDONMENT: 1,      // 1 minute instead of 24 hours
  DEPOSIT_REMINDER: 2,      // 2 minutes instead of 7 days before event
  EVENT_CONFIRMATION: 3,    // 3 minutes instead of 2 days before event
  POST_EVENT_THANKS: 4,     // 4 minutes instead of 1 day after event
  REBOOKING_REMINDER: 5     // 5 minutes instead of 9 months after event
};

// Production timing (actual business logic)
export const EMAIL_PRODUCTION_TIMING = {
  CART_ABANDONMENT: 24 * 60,           // 24 hours
  DEPOSIT_REMINDER: 7 * 24 * 60,       // 7 days before event
  EVENT_CONFIRMATION: 2 * 24 * 60,     // 2 days before event
  POST_EVENT_THANKS: 1 * 24 * 60,      // 1 day after event
  REBOOKING_REMINDER: 9 * 30 * 24 * 60 // 9 months after event
};

// Flag to enable test timing (set this to true when testing)
export const ENABLE_TEST_TIMING = true; // ⚠️ SET TO FALSE IN PRODUCTION

export const getCurrentTiming = () => ENABLE_TEST_TIMING ? EMAIL_TEST_TIMING : EMAIL_PRODUCTION_TIMING;

/**
 * Modified Cart Abandonment Tracker for Testing
 */
export class TestCartAbandonmentTracker {
  private storageKey = 'test_cart_abandonment_data';

  /**
   * Track cart abandonment with test timing
   */
  trackCartAbandonment(userId: string, userEmail: string, userName: string, cartItems: any[], cartTotal: number) {
    if (!userId || !userEmail || cartItems.length === 0) {
      return;
    }

    const abandonmentData = {
      userId,
      userEmail,
      userName,
      cartItems: cartItems.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1
      })),
      cartTotal,
      abandonedAt: new Date().toISOString()
    };

    localStorage.setItem(`${this.storageKey}_${userId}`, JSON.stringify(abandonmentData));
    
    const timing = getCurrentTiming();
    console.log(`🛒 TEST: Cart abandonment tracked. Email will send in ${timing.CART_ABANDONMENT} minutes`);
    
    // Schedule reminder with test timing
    setTimeout(async () => {
      await this.sendTestCartReminder(abandonmentData);
    }, timing.CART_ABANDONMENT * 60 * 1000); // Convert minutes to milliseconds
  }

  private async sendTestCartReminder(abandonmentData: any) {
    try {
      console.log('🧪 TEST: Sending cart abandonment reminder email...');
      
      await scheduleCartReminderEmail({
        userID: abandonmentData.userId,
        customerEmail: abandonmentData.userEmail,
        customerName: abandonmentData.userName,
        cartItems: abandonmentData.cartItems,
        cartValue: abandonmentData.cartTotal
      });

      console.log('✅ TEST: Cart reminder email sent successfully!');
    } catch (error) {
      console.error('❌ TEST: Failed to send cart reminder:', error);
    }
  }

  clearCartAbandonment(userId: string) {
    localStorage.removeItem(`${this.storageKey}_${userId}`);
    console.log('✅ TEST: Cart abandonment cleared for user:', userId);
  }
}

/**
 * Test Email Scheduler
 */
export class TestEmailScheduler {
  /**
   * Schedule all booking-related emails with test timing
   */
  async scheduleAllBookingEmails(bookingData: any) {
    const timing = getCurrentTiming();
    console.log('🧪 TEST: Scheduling all booking emails with test timing...');

    // 1. Deposit Reminder Email
    setTimeout(async () => {
      console.log('🧪 TEST: Sending deposit reminder email...');
      try {
        await scheduleDepositReminderEmail(bookingData);
        console.log('✅ TEST: Deposit reminder email sent!');
      } catch (error) {
        console.error('❌ TEST: Deposit reminder failed:', error);
      }
    }, timing.DEPOSIT_REMINDER * 60 * 1000);

    // 2. Event Confirmation Email (2 days before)
    setTimeout(async () => {
      console.log('🧪 TEST: Sending event confirmation email...');
      try {
        await scheduleEventConfirmationEmail(bookingData);
        console.log('✅ TEST: Event confirmation email sent!');
      } catch (error) {
        console.error('❌ TEST: Event confirmation failed:', error);
      }
    }, timing.EVENT_CONFIRMATION * 60 * 1000);

    // 3. Post-Event Thank You Email
    setTimeout(async () => {
      console.log('🧪 TEST: Sending post-event thank you email...');
      try {
        await schedulePostEventThanksEmail(bookingData);
        console.log('✅ TEST: Post-event thank you email sent!');
      } catch (error) {
        console.error('❌ TEST: Post-event thank you failed:', error);
      }
    }, timing.POST_EVENT_THANKS * 60 * 1000);

    // 4. Rebooking Reminder Email (9 months later)
    setTimeout(async () => {
      console.log('🧪 TEST: Sending rebooking reminder email...');
      try {
        await scheduleRebookingReminderEmail(bookingData);
        console.log('✅ TEST: Rebooking reminder email sent!');
      } catch (error) {
        console.error('❌ TEST: Rebooking reminder failed:', error);
      }
    }, timing.REBOOKING_REMINDER * 60 * 1000);

    console.log(`🧪 TEST: All emails scheduled with the following timing:
    📧 Deposit Reminder: ${timing.DEPOSIT_REMINDER} minutes
    📧 Event Confirmation: ${timing.EVENT_CONFIRMATION} minutes  
    📧 Post-Event Thanks: ${timing.POST_EVENT_THANKS} minutes
    📧 Rebooking Reminder: ${timing.REBOOKING_REMINDER} minutes`);
  }

  /**
   * Test cart abandonment flow
   */
  async testCartAbandonmentFlow(userId: string, userEmail: string, userName: string) {
    const timing = getCurrentTiming();
    
    console.log(`🧪 TEST: Starting cart abandonment test for ${userEmail}`);
    console.log(`📅 Cart reminder will be sent in ${timing.CART_ABANDONMENT} minutes`);

    const testCartItems = [
      { name: 'Test Bounce House', price: 199.99, quantity: 1 },
      { name: 'Test Water Slide', price: 299.99, quantity: 1 }
    ];

    const testTracker = new TestCartAbandonmentTracker();
    testTracker.trackCartAbandonment(userId, userEmail, userName, testCartItems, 499.98);

    return {
      message: `Cart abandonment test started. Email will be sent in ${timing.CART_ABANDONMENT} minutes.`,
      testData: {
        userId,
        userEmail,
        cartItems: testCartItems,
        scheduledFor: new Date(Date.now() + timing.CART_ABANDONMENT * 60 * 1000).toISOString()
      }
    };
  }

  /**
   * Test individual email types
   */
  async testIndividualEmail(emailType: string, bookingData: any) {
    console.log(`🧪 TEST: Testing ${emailType} email...`);

    switch (emailType) {
      case 'deposit-reminder':
        return await scheduleDepositReminderEmail(bookingData);
      case 'event-confirmation':
        return await scheduleEventConfirmationEmail(bookingData);
      case 'post-event-thanks':
        return await schedulePostEventThanksEmail(bookingData);
      case 'rebooking-reminder':
        return await scheduleRebookingReminderEmail(bookingData);
      default:
        throw new Error(`Unknown email type: ${emailType}`);
    }
  }
}

// Create singleton instances
export const testCartTracker = new TestCartAbandonmentTracker();
export const testEmailScheduler = new TestEmailScheduler();

// Convenience functions
export const startCartAbandonmentTest = (userId: string, userEmail: string, userName: string) =>
  testEmailScheduler.testCartAbandonmentFlow(userId, userEmail, userName);

export const scheduleAllTestEmails = (bookingData: any) =>
  testEmailScheduler.scheduleAllBookingEmails(bookingData);

export const testSingleEmail = (emailType: string, bookingData: any) =>
  testEmailScheduler.testIndividualEmail(emailType, bookingData);

/**
 * Helper to create test booking data
 */
export const createTestBookingData = (userEmail: string, userName: string) => ({
  bookingID: `test_${Date.now()}`,
  customerEmail: userEmail,
  customerName: userName,
  eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
  remainingAmount: 150.00,
  bookingDetails: {
    items: [
      { name: 'Test Bounce House', price: 199.99 },
      { name: 'Test Water Slide', price: 299.99 }
    ],
    setupTime: '10:00 AM',
    pickupTime: '6:00 PM',
    address: '123 Test Street, Test City, TC 12345'
  }
});

console.log(`🧪 EMAIL TESTING SYSTEM LOADED
🔧 Test timing enabled: ${ENABLE_TEST_TIMING}
⏰ Current timing configuration:`, getCurrentTiming());