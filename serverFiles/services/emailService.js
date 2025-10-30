const { sendEmail } = require('../config/sendgrid');
const { getFirestore } = require('../config/firebase');
const emailTemplates = require('../templates/emailTemplates');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class EmailService {
  constructor() {
    this.db = null;
  }

  async initialize() {
    if (!this.db) {
      this.db = getFirestore();
    }
  }

  // Send account creation welcome email
  async sendAccountCreationEmail({ email, name, userID }) {
    await this.initialize();
    
    const emailData = {
      to: email,
      subject: 'Welcome to JumpCSRA Party Rentals!',
      html: emailTemplates.accountCreation({ name }),
      text: `Welcome to JumpCSRA Party Rentals, ${name}! We're excited to help make your events memorable.`
    };

    const result = await sendEmail(emailData);
    
    // Log the email
    await this.logEmail({
      type: 'account_creation',
      recipientEmail: email,
      recipientName: name,
      userID,
      result
    });

    return result;
  }

  // Send order confirmation email after payment
  async sendOrderConfirmationEmail(orderData) {
    await this.initialize();
    
    const emailData = {
      to: orderData.customerEmail,
      subject: `Order Confirmation - ${orderData.orderID}`,
      html: emailTemplates.orderConfirmation(orderData),
      text: `Thank you for your order ${orderData.orderID}. Total: $${orderData.totalAmount}`
    };

    const result = await sendEmail(emailData);
    
    // Log the email
    await this.logEmail({
      type: 'order_confirmation',
      recipientEmail: orderData.customerEmail,
      recipientName: orderData.customerName,
      orderID: orderData.orderID,
      result
    });

    return result;
  }

  // Schedule cart abandonment reminder
  async scheduleCartReminderEmail({ userID, cartItems, cartValue, customerEmail, customerName, delayHours = 24 }) {
    await this.initialize();
    
    const scheduledTime = new Date(Date.now() + (delayHours * 60 * 60 * 1000));
    const emailID = uuidv4();

    const scheduledEmail = {
      emailID,
      type: 'cart_reminder',
      recipientEmail: customerEmail,
      recipientName: customerName,
      userID,
      scheduledTime: scheduledTime.toISOString(),
      status: 'pending',
      data: {
        cartItems,
        cartValue,
        customerEmail,
        customerName
      },
      createdAt: new Date().toISOString()
    };

    await this.db.collection('scheduledEmails').doc(emailID).set(scheduledEmail);
    
    logger.info(`Cart reminder scheduled for ${customerEmail} at ${scheduledTime}`);
    
    return {
      success: true,
      emailID,
      scheduledTime: scheduledTime.toISOString(),
      message: 'Cart reminder scheduled successfully'
    };
  }

  // Schedule deposit reminder email
  async scheduleDepositReminderEmail({ bookingID, customerEmail, customerName, eventDate, remainingAmount }) {
    await this.initialize();
    
    const reminderDays = parseInt(process.env.DEPOSIT_REMINDER_DELAY_DAYS) || 7;
    const scheduledTime = new Date(Date.now() + (reminderDays * 24 * 60 * 60 * 1000));
    const emailID = uuidv4();

    const scheduledEmail = {
      emailID,
      type: 'deposit_reminder',
      recipientEmail: customerEmail,
      recipientName: customerName,
      bookingID,
      scheduledTime: scheduledTime.toISOString(),
      status: 'pending',
      data: {
        bookingID,
        customerEmail,
        customerName,
        eventDate,
        remainingAmount
      },
      createdAt: new Date().toISOString()
    };

    await this.db.collection('scheduledEmails').doc(emailID).set(scheduledEmail);
    
    logger.info(`Deposit reminder scheduled for ${customerEmail} at ${scheduledTime}`);
    
    return {
      success: true,
      emailID,
      scheduledTime: scheduledTime.toISOString(),
      message: 'Deposit reminder scheduled successfully'
    };
  }

  // Schedule event confirmation (2 days before)
  async scheduleEventConfirmationEmail({ bookingID, customerEmail, customerName, eventDate, bookingDetails }) {
    await this.initialize();
    
    const confirmationDays = parseInt(process.env.EVENT_CONFIRMATION_DAYS_BEFORE) || 2;
    const eventDateTime = new Date(eventDate);
    const scheduledTime = new Date(eventDateTime.getTime() - (confirmationDays * 24 * 60 * 60 * 1000));
    const emailID = uuidv4();

    const scheduledEmail = {
      emailID,
      type: 'event_confirmation',
      recipientEmail: customerEmail,
      recipientName: customerName,
      bookingID,
      scheduledTime: scheduledTime.toISOString(),
      status: 'pending',
      data: {
        bookingID,
        customerEmail,
        customerName,
        eventDate,
        bookingDetails
      },
      createdAt: new Date().toISOString()
    };

    await this.db.collection('scheduledEmails').doc(emailID).set(scheduledEmail);
    
    logger.info(`Event confirmation scheduled for ${customerEmail} at ${scheduledTime}`);
    
    return {
      success: true,
      emailID,
      scheduledTime: scheduledTime.toISOString(),
      message: 'Event confirmation scheduled successfully'
    };
  }

  // Schedule post-event thank you
  async schedulePostEventThanksEmail({ bookingID, customerEmail, customerName, eventDate, bookingDetails }) {
    await this.initialize();
    
    const thanksDays = parseInt(process.env.POST_EVENT_THANKS_DAYS_AFTER) || 1;
    const eventDateTime = new Date(eventDate);
    const scheduledTime = new Date(eventDateTime.getTime() + (thanksDays * 24 * 60 * 60 * 1000));
    const emailID = uuidv4();

    const scheduledEmail = {
      emailID,
      type: 'post_event_thanks',
      recipientEmail: customerEmail,
      recipientName: customerName,
      bookingID,
      scheduledTime: scheduledTime.toISOString(),
      status: 'pending',
      data: {
        bookingID,
        customerEmail,
        customerName,
        eventDate,
        bookingDetails
      },
      createdAt: new Date().toISOString()
    };

    await this.db.collection('scheduledEmails').doc(emailID).set(scheduledEmail);
    
    logger.info(`Post-event thanks scheduled for ${customerEmail} at ${scheduledTime}`);
    
    return {
      success: true,
      emailID,
      scheduledTime: scheduledTime.toISOString(),
      message: 'Post-event thanks scheduled successfully'
    };
  }

  // Schedule rebooking reminder (9 months later)
  async scheduleRebookingReminderEmail({ bookingID, customerEmail, customerName, eventDate, bookingDetails }) {
    await this.initialize();
    
    const reminderMonths = parseInt(process.env.REBOOKING_REMINDER_MONTHS_AFTER) || 9;
    const eventDateTime = new Date(eventDate);
    const scheduledTime = new Date(eventDateTime.getTime() + (reminderMonths * 30 * 24 * 60 * 60 * 1000)); // Approximate months
    const emailID = uuidv4();

    const scheduledEmail = {
      emailID,
      type: 'rebooking_reminder',
      recipientEmail: customerEmail,
      recipientName: customerName,
      bookingID,
      scheduledTime: scheduledTime.toISOString(),
      status: 'pending',
      data: {
        bookingID,
        customerEmail,
        customerName,
        eventDate,
        bookingDetails
      },
      createdAt: new Date().toISOString()
    };

    await this.db.collection('scheduledEmails').doc(emailID).set(scheduledEmail);
    
    logger.info(`Rebooking reminder scheduled for ${customerEmail} at ${scheduledTime}`);
    
    return {
      success: true,
      emailID,
      scheduledTime: scheduledTime.toISOString(),
      message: 'Rebooking reminder scheduled successfully'
    };
  }

  // Cancel scheduled email
  async cancelScheduledEmail(emailID) {
    await this.initialize();
    
    const doc = await this.db.collection('scheduledEmails').doc(emailID).get();
    
    if (!doc.exists) {
      return {
        success: false,
        message: 'Scheduled email not found'
      };
    }

    await this.db.collection('scheduledEmails').doc(emailID).update({
      status: 'cancelled',
      cancelledAt: new Date().toISOString()
    });

    return {
      success: true,
      message: 'Scheduled email cancelled successfully'
    };
  }

  // Get scheduled emails for a user
  async getScheduledEmails(userID) {
    await this.initialize();
    
    const snapshot = await this.db.collection('scheduledEmails')
      .where('userID', '==', userID)
      .where('status', '==', 'pending')
      .orderBy('scheduledTime', 'asc')
      .get();

    const emails = [];
    snapshot.forEach(doc => {
      emails.push({ id: doc.id, ...doc.data() });
    });

    return {
      success: true,
      emails,
      count: emails.length
    };
  }

  // Log email for tracking
  async logEmail(emailLog) {
    await this.initialize();
    
    const logEntry = {
      ...emailLog,
      timestamp: new Date().toISOString(),
      id: uuidv4()
    };

    await this.db.collection('emailLogs').add(logEntry);
  }

  // Send test email (development only)
  async sendTestEmail(type, email) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test emails not available in production');
    }

    const testData = {
      customerName: 'Test Customer',
      customerEmail: email,
      orderID: 'TEST-' + Date.now(),
      totalAmount: 199.99,
      eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()
    };

    switch (type) {
      case 'account_creation':
        return await this.sendAccountCreationEmail({
          email,
          name: 'Test Customer',
          userID: 'test-user-id'
        });
      
      case 'order_confirmation':
        return await this.sendOrderConfirmationEmail(testData);
      
      default:
        throw new Error('Invalid test email type');
    }
  }
}

module.exports = new EmailService();