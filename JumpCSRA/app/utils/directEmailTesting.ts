/**
 * Direct Email Server Testing
 * Test email endpoints directly with manual timing control
 */

import { 
  sendAccountCreationEmail,
  scheduleCartReminderEmail,
  scheduleDepositReminderEmail,
  scheduleEventConfirmationEmail,
  schedulePostEventThanksEmail,
  scheduleRebookingReminderEmail,
  healthCheck
} from './backendEmailService';

export interface EmailTestConfig {
  testMode: boolean;
  delayInSeconds: number;
  testEmail: string;
  testName: string;
}

export const defaultTestConfig: EmailTestConfig = {
  testMode: true,
  delayInSeconds: 30, // 30 seconds for testing
  testEmail: 'your-email@example.com',
  testName: 'Test User'
};

/**
 * Direct Email Endpoint Tester
 * Calls server endpoints directly to test email functionality
 */
export class DirectEmailTester {
  private config: EmailTestConfig;

  constructor(config: EmailTestConfig = defaultTestConfig) {
    this.config = config;
  }

  /**
   * Test Account Creation Email (immediate)
   */
  async testAccountCreationEmail() {
    console.log('🧪 Testing Account Creation Email...');
    
    try {
      const result = await sendAccountCreationEmail({
        email: this.config.testEmail,
        name: this.config.testName,
        userID: `test_${Date.now()}`
      });
      
      console.log('✅ Account creation email sent:', result);
      return { success: true, result };
    } catch (error: any) {
      console.error('❌ Account creation email failed:', error);
      return { success: false, error: error?.message || String(error) };
    }
  }

  /**
   * Test Cart Abandonment Email with custom delay
   */
  async testCartAbandonmentEmail(delaySeconds: number = this.config.delayInSeconds) {
    console.log(`🛒 Testing Cart Abandonment Email (${delaySeconds}s delay)...`);
    
    const cartData = {
      userID: `test_${Date.now()}`,
      customerEmail: this.config.testEmail,
      customerName: this.config.testName,
      cartItems: [
        { name: 'Test Bounce House', price: 199.99, quantity: 1 },
        { name: 'Test Water Slide', price: 299.99, quantity: 1 }
      ],
      cartValue: 499.98
    };

    // Schedule with custom delay
    setTimeout(async () => {
      try {
        console.log(`⏰ ${delaySeconds}s elapsed - sending cart abandonment email...`);
        const result = await scheduleCartReminderEmail(cartData);
        console.log('✅ Cart abandonment email sent:', result);
      } catch (error: any) {
        console.error('❌ Cart abandonment email failed:', error);
      }
    }, delaySeconds * 1000);

    return {
      message: `Cart abandonment email scheduled for ${delaySeconds} seconds`,
      scheduledFor: new Date(Date.now() + delaySeconds * 1000).toISOString(),
      testData: cartData
    };
  }

  /**
   * Test Deposit Reminder Email with custom delay
   */
  async testDepositReminderEmail(delaySeconds: number = this.config.delayInSeconds) {
    console.log(`💰 Testing Deposit Reminder Email (${delaySeconds}s delay)...`);
    
    const bookingData = {
      bookingID: `test_booking_${Date.now()}`,
      customerEmail: this.config.testEmail,
      customerName: this.config.testName,
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
    };

    setTimeout(async () => {
      try {
        console.log(`⏰ ${delaySeconds}s elapsed - sending deposit reminder email...`);
        const result = await scheduleDepositReminderEmail(bookingData);
        console.log('✅ Deposit reminder email sent:', result);
      } catch (error: any) {
        console.error('❌ Deposit reminder email failed:', error);
      }
    }, delaySeconds * 1000);

    return {
      message: `Deposit reminder email scheduled for ${delaySeconds} seconds`,
      scheduledFor: new Date(Date.now() + delaySeconds * 1000).toISOString(),
      testData: bookingData
    };
  }

  /**
   * Test Event Confirmation Email with custom delay
   */
  async testEventConfirmationEmail(delaySeconds: number = this.config.delayInSeconds) {
    console.log(`📅 Testing Event Confirmation Email (${delaySeconds}s delay)...`);
    
    const bookingData = {
      bookingID: `test_booking_${Date.now()}`,
      customerEmail: this.config.testEmail,
      customerName: this.config.testName,
      eventDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
      bookingDetails: {
        items: [
          { name: 'Test Bounce House', price: 199.99 },
          { name: 'Test Water Slide', price: 299.99 }
        ],
        setupTime: '10:00 AM',
        pickupTime: '6:00 PM',
        address: '123 Test Street, Test City, TC 12345'
      }
    };

    setTimeout(async () => {
      try {
        console.log(`⏰ ${delaySeconds}s elapsed - sending event confirmation email...`);
        const result = await scheduleEventConfirmationEmail(bookingData);
        console.log('✅ Event confirmation email sent:', result);
      } catch (error: any) {
        console.error('❌ Event confirmation email failed:', error);
      }
    }, delaySeconds * 1000);

    return {
      message: `Event confirmation email scheduled for ${delaySeconds} seconds`,
      scheduledFor: new Date(Date.now() + delaySeconds * 1000).toISOString(),
      testData: bookingData
    };
  }

  /**
   * Test Post-Event Thank You Email with custom delay
   */
  async testPostEventThanksEmail(delaySeconds: number = this.config.delayInSeconds) {
    console.log(`🎉 Testing Post-Event Thanks Email (${delaySeconds}s delay)...`);
    
    const bookingData = {
      bookingID: `test_booking_${Date.now()}`,
      customerEmail: this.config.testEmail,
      customerName: this.config.testName,
      eventDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago (past event)
      bookingDetails: {
        items: [
          { name: 'Test Bounce House', price: 199.99 },
          { name: 'Test Water Slide', price: 299.99 }
        ]
      }
    };

    setTimeout(async () => {
      try {
        console.log(`⏰ ${delaySeconds}s elapsed - sending post-event thanks email...`);
        const result = await schedulePostEventThanksEmail(bookingData);
        console.log('✅ Post-event thanks email sent:', result);
      } catch (error: any) {
        console.error('❌ Post-event thanks email failed:', error);
      }
    }, delaySeconds * 1000);

    return {
      message: `Post-event thanks email scheduled for ${delaySeconds} seconds`,
      scheduledFor: new Date(Date.now() + delaySeconds * 1000).toISOString(),
      testData: bookingData
    };
  }

  /**
   * Test Rebooking Reminder Email with custom delay
   */
  async testRebookingReminderEmail(delaySeconds: number = this.config.delayInSeconds) {
    console.log(`🔄 Testing Rebooking Reminder Email (${delaySeconds}s delay)...`);
    
    const bookingData = {
      bookingID: `test_booking_${Date.now()}`,
      customerEmail: this.config.testEmail,
      customerName: this.config.testName,
      eventDate: new Date(Date.now() - 9 * 30 * 24 * 60 * 60 * 1000).toISOString(), // 9 months ago
      bookingDetails: {
        items: [
          { name: 'Test Bounce House', price: 199.99 },
          { name: 'Test Water Slide', price: 299.99 }
        ]
      }
    };

    setTimeout(async () => {
      try {
        console.log(`⏰ ${delaySeconds}s elapsed - sending rebooking reminder email...`);
        const result = await scheduleRebookingReminderEmail(bookingData);
        console.log('✅ Rebooking reminder email sent:', result);
      } catch (error: any) {
        console.error('❌ Rebooking reminder email failed:', error);
      }
    }, delaySeconds * 1000);

    return {
      message: `Rebooking reminder email scheduled for ${delaySeconds} seconds`,
      scheduledFor: new Date(Date.now() + delaySeconds * 1000).toISOString(),
      testData: bookingData
    };
  }

  /**
   * Test All Scheduled Emails with staggered timing
   */
  async testAllScheduledEmails(baseDelaySeconds: number = 30) {
    console.log('🚀 Testing ALL scheduled emails with staggered timing...');
    
    const results = [];
    
    // Stagger the emails every 30 seconds
    results.push(await this.testCartAbandonmentEmail(baseDelaySeconds));
    results.push(await this.testDepositReminderEmail(baseDelaySeconds + 30));
    results.push(await this.testEventConfirmationEmail(baseDelaySeconds + 60));
    results.push(await this.testPostEventThanksEmail(baseDelaySeconds + 90));
    results.push(await this.testRebookingReminderEmail(baseDelaySeconds + 120));
    
    console.log(`📅 All emails scheduled with 30-second intervals starting in ${baseDelaySeconds} seconds`);
    
    return {
      message: 'All scheduled emails queued',
      results,
      timeline: {
        cartAbandonment: new Date(Date.now() + baseDelaySeconds * 1000).toLocaleTimeString(),
        depositReminder: new Date(Date.now() + (baseDelaySeconds + 30) * 1000).toLocaleTimeString(),
        eventConfirmation: new Date(Date.now() + (baseDelaySeconds + 60) * 1000).toLocaleTimeString(),
        postEventThanks: new Date(Date.now() + (baseDelaySeconds + 90) * 1000).toLocaleTimeString(),
        rebookingReminder: new Date(Date.now() + (baseDelaySeconds + 120) * 1000).toLocaleTimeString()
      }
    };
  }

  /**
   * Test Email Server Health
   */
  async testEmailServerHealth() {
    console.log('🏥 Testing Email Server Health...');
    
    try {
      const isHealthy = await healthCheck();
      console.log(`✅ Email server health: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
      return { healthy: isHealthy };
    } catch (error: any) {
      console.error('❌ Email server health check failed:', error);
      return { healthy: false, error: error?.message || String(error) };
    }
  }

  /**
   * Update test configuration
   */
  updateConfig(newConfig: Partial<EmailTestConfig>) {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 Updated test configuration:', this.config);
  }
}

// Create global tester instance
export const directEmailTester = new DirectEmailTester();

// Browser console convenience functions
if (typeof window !== 'undefined') {
  (window as any).emailTester = {
    // Quick test functions
    testAccount: () => directEmailTester.testAccountCreationEmail(),
    testCart: (delay = 30) => directEmailTester.testCartAbandonmentEmail(delay),
    testDeposit: (delay = 30) => directEmailTester.testDepositReminderEmail(delay),
    testConfirmation: (delay = 30) => directEmailTester.testEventConfirmationEmail(delay),
    testThanks: (delay = 30) => directEmailTester.testPostEventThanksEmail(delay),
    testRebooking: (delay = 30) => directEmailTester.testRebookingReminderEmail(delay),
    testAll: (delay = 30) => directEmailTester.testAllScheduledEmails(delay),
    testHealth: () => directEmailTester.testEmailServerHealth(),
    
    // Configuration
    setEmail: (email: string) => directEmailTester.updateConfig({ testEmail: email }),
    setName: (name: string) => directEmailTester.updateConfig({ testName: name }),
    setDelay: (seconds: number) => directEmailTester.updateConfig({ delayInSeconds: seconds }),
    
    // Show current config
    config: () => console.log(directEmailTester['config'])
  };
  
  console.log(`
🧪 EMAIL TESTING LOADED - Use these browser console commands:

// Setup (replace with your email)
emailTester.setEmail('your-email@example.com');
emailTester.setName('Your Name');

// Test individual emails with custom delay (seconds)
emailTester.testAccount();           // Account creation (immediate)
emailTester.testCart(30);           // Cart abandonment (30s delay)
emailTester.testDeposit(60);        // Deposit reminder (60s delay)
emailTester.testConfirmation(90);   // Event confirmation (90s delay)
emailTester.testThanks(120);        // Post-event thanks (120s delay)
emailTester.testRebooking(150);     // Rebooking reminder (150s delay)

// Test all emails with staggered timing (starting delay)
emailTester.testAll(30);            // All emails, 30s intervals starting in 30s

// Check server health
emailTester.testHealth();

// View current configuration
emailTester.config();
`);
}

export default DirectEmailTester;