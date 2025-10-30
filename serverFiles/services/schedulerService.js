const cron = require('node-cron');
const { getFirestore } = require('../config/firebase');
const { sendEmail } = require('../config/sendgrid');
const emailTemplates = require('../templates/emailTemplates');
const logger = require('../utils/logger');

class SchedulerService {
  constructor() {
    this.db = null;
    this.isRunning = false;
  }

  async initialize() {
    if (!this.db) {
      this.db = getFirestore();
    }
  }

  startScheduler() {
    if (this.isRunning) {
      logger.warn('Scheduler already running');
      return;
    }

    // Run every 5 minutes to check for scheduled emails
    cron.schedule('*/5 * * * *', async () => {
      await this.processScheduledEmails();
    });

    // Run daily cleanup at 2 AM
    cron.schedule('0 2 * * *', async () => {
      await this.cleanupOldLogs();
    });

    this.isRunning = true;
    logger.info('Email scheduler started - checking every 5 minutes');
  }

  async processScheduledEmails() {
    try {
      await this.initialize();
      
      const now = new Date();
      const snapshot = await this.db.collection('scheduledEmails')
        .where('status', '==', 'pending')
        .where('scheduledTime', '<=', now.toISOString())
        .limit(50) // Process in batches
        .get();

      if (snapshot.empty) {
        return;
      }

      logger.info(`Processing ${snapshot.size} scheduled emails`);

      for (const doc of snapshot.docs) {
        const emailData = doc.data();
        await this.sendScheduledEmail(doc.id, emailData);
      }
    } catch (error) {
      logger.error('Error processing scheduled emails:', error);
    }
  }

  async sendScheduledEmail(emailID, emailData) {
    try {
      let emailContent;
      let subject;

      switch (emailData.type) {
        case 'cart_reminder':
          emailContent = emailTemplates.cartReminder(emailData.data);
          subject = 'Don\'t forget your items at JumpCSRA!';
          break;

        case 'deposit_reminder':
          emailContent = emailTemplates.depositReminder(emailData.data);
          subject = 'Deposit Reminder - Complete Your Booking';
          break;

        case 'event_confirmation':
          emailContent = emailTemplates.eventConfirmation(emailData.data);
          subject = 'Event Confirmation - Your Party is Almost Here!';
          break;

        case 'post_event_thanks':
          emailContent = emailTemplates.postEventThanks(emailData.data);
          subject = 'Thank You for Choosing JumpCSRA!';
          break;

        case 'rebooking_reminder':
          emailContent = emailTemplates.rebookingReminder(emailData.data);
          subject = 'Ready to Party Again? Special Offer Inside!';
          break;

        default:
          throw new Error(`Unknown email type: ${emailData.type}`);
      }

      const result = await sendEmail({
        to: emailData.recipientEmail,
        subject,
        html: emailContent,
        text: this.stripHtml(emailContent)
      });

      // Update status to sent
      await this.db.collection('scheduledEmails').doc(emailID).update({
        status: 'sent',
        sentAt: new Date().toISOString(),
        result: result
      });

      // Log the email
      await this.db.collection('emailLogs').add({
        type: emailData.type,
        recipientEmail: emailData.recipientEmail,
        recipientName: emailData.recipientName,
        scheduledEmailID: emailID,
        result,
        timestamp: new Date().toISOString()
      });

      logger.info(`Scheduled email sent: ${emailData.type} to ${emailData.recipientEmail}`);

    } catch (error) {
      logger.error(`Error sending scheduled email ${emailID}:`, error);

      // Mark as failed
      await this.db.collection('scheduledEmails').doc(emailID).update({
        status: 'failed',
        failedAt: new Date().toISOString(),
        error: error.message
      });
    }
  }

  async cleanupOldLogs() {
    try {
      await this.initialize();
      
      // Delete email logs older than 90 days
      const ninetyDaysAgo = new Date(Date.now() - (90 * 24 * 60 * 60 * 1000));
      
      const oldLogs = await this.db.collection('emailLogs')
        .where('timestamp', '<', ninetyDaysAgo.toISOString())
        .limit(1000)
        .get();

      if (!oldLogs.empty) {
        const batch = this.db.batch();
        oldLogs.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        
        logger.info(`Cleaned up ${oldLogs.size} old email logs`);
      }

      // Delete old scheduled emails (sent/failed/cancelled older than 30 days)
      const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
      
      const oldScheduled = await this.db.collection('scheduledEmails')
        .where('status', 'in', ['sent', 'failed', 'cancelled'])
        .where('createdAt', '<', thirtyDaysAgo.toISOString())
        .limit(1000)
        .get();

      if (!oldScheduled.empty) {
        const batch = this.db.batch();
        oldScheduled.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        
        logger.info(`Cleaned up ${oldScheduled.size} old scheduled emails`);
      }

    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }

  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
}

module.exports = new SchedulerService();