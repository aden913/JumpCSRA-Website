/**
 * Email service for JumpCSRA Cloud Functions
 * Handles all email sending operations by calling the external email server
 */

import * as functions from 'firebase-functions';
import axios from 'axios';
import { 
  OrderConfirmationEmailData, 
  GiftCardEmailData, 
  AccountDeletionEmailData 
} from '../types/email';

// External email server configuration
const EMAIL_SERVER_BASE_URL = 'http://173.230.132.127:3001';
const EMAIL_SERVER_API_KEY = 'jumpcsra_secure_api_key_2024';

type ScheduledTemplateEmailData = {
  customerEmail: string;
  customerName?: string;
  customerId?: string;
  bookingId?: string;
  remainingAmount?: number;
  dueDate?: string;
  eventDate?: string;
  bookingDetails?: any;
  lastBookingDate?: string;
  lastBookingId?: string;
  asm?: any;
};

const postToEmailServer = async (endpoint: string, data: any): Promise<any> => {
  const response = await axios.post(`${EMAIL_SERVER_BASE_URL}/api/email/${endpoint}`, data, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': EMAIL_SERVER_API_KEY,
      'Accept': 'application/json'
    },
    timeout: 30000
  });

  if (response.status !== 200) {
    console.error(`Email server error for ${endpoint}:`, response.status, response.data);
    throw new Error(`Email server error: ${response.status} - ${response.statusText}`);
  }

  return response.data;
};

/**
 * Send order confirmation email via external email server
 */
export const sendOrderConfirmationEmail = async (data: OrderConfirmationEmailData): Promise<any> => {
  console.log('📧 ENHANCED EMAIL - Sending order confirmation via email server...');
  
  // Validate required fields
  if (!data.recipientEmail || !data.recipientName || !data.orderID) {
    console.error('❌ ENHANCED EMAIL - Missing required fields:', {
      hasEmail: !!data.recipientEmail,
      hasName: !!data.recipientName,
      hasOrderID: !!data.orderID
    });
    throw new functions.https.HttpsError('invalid-argument', 'Missing required email fields.');
  }

  console.log('📧 ENHANCED EMAIL - Calling email server at:', EMAIL_SERVER_BASE_URL);
  console.log('📧 ENHANCED EMAIL - Recipient:', data.recipientEmail);

  try {
    // Transform data to match what your email server expects
    const transformedData = {
      customerEmail: data.recipientEmail,
      customerName: data.recipientName,
      bookingId: data.orderID,
      paymentAmount: data.amountPaid || data.totalAmount,
      bookingDetails: {
        eventDate: data.eventDate,
        items: (data.rentalItems || []).map(item => ({
          name: item.name,
          quantity: item.quantity || 1,
          price: item.price
        })),
        total: data.totalAmount,
        amountPaid: data.amountPaid || data.totalAmount,
        remainingBalance: data.remainingBalance || 0,
        address: data.deliveryAddress,
        setupTime: data.deliveryTime
      }
    };

    console.log('📧 ENHANCED EMAIL - Sending data to email server:', JSON.stringify(transformedData, null, 2));
    console.log('📧 ENHANCED EMAIL - Original rentalItems:', JSON.stringify(data.rentalItems, null, 2));

    const response = await axios.post(`${EMAIL_SERVER_BASE_URL}/api/email/payment-confirmation`, transformedData, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': EMAIL_SERVER_API_KEY,
        'Accept': 'application/json'
      },
      timeout: 30000  // 30 second timeout
    });

    if (response.status !== 200) {
      console.error('❌ ENHANCED EMAIL - Email server error:', response.status, response.data);
      throw new Error(`Email server error: ${response.status} - ${response.statusText}`);
    }

    const result = response.data;
    console.log('✅ ENHANCED EMAIL - Email server response:', result);
    console.log('✅ ENHANCED EMAIL - Order confirmation email sent successfully via email server');
    
    // Return the actual response from the email server
    return result;
  } catch (error: any) {
    console.error('❌ ENHANCED EMAIL - Error calling email server:', error);
    throw new functions.https.HttpsError('internal', `Failed to send order confirmation email: ${error.message}`);
  }
};

/**
 * Send gift card email via external email server
 */
export const sendGiftCardEmail = async (data: GiftCardEmailData): Promise<any> => {
  console.log('🎁 Sending gift card email via email server to:', data.recipientEmail);

  // Validate input data
  if (!data.recipientEmail || !data.giftCardCode || !data.giftCardBalance) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required gift card email data.');
  }

  try {
    // Match the emailRoutes.js format
    const transformedData = {
      customerEmail: data.recipientEmail,
      customerName: data.recipientName || 'Valued Customer',
      senderName: data.senderName,
      personalMessage: data.personalMessage,
      giftCardData: {
        code: data.giftCardCode,
        balance: data.giftCardBalance,
        expirationDate: data.expirationDate
      }
    };

    const response = await axios.post(`${EMAIL_SERVER_BASE_URL}/api/email/gift-card`, transformedData, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': EMAIL_SERVER_API_KEY,
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    if (response.status !== 200) {
      console.error('❌ Gift card email server error:', response.status, response.data);
      throw new Error(`Email server error: ${response.status} - ${response.statusText}`);
    }

    const result = response.data;
    console.log('✅ Gift card email server response:', result);
    console.log('✅ Gift card email sent successfully via email server');
    
    // Return the actual response from the email server
    return result;
  } catch (error: any) {
    console.error('❌ Error sending gift card email via email server:', error);
    throw new functions.https.HttpsError('internal', `Failed to send gift card email: ${error.message}`);
  }
};

/**
 * Send account deletion confirmation email via external email server
 */
export const sendAccountDeletionEmail = async (data: AccountDeletionEmailData): Promise<any> => {
  console.log('🗑️ Sending account deletion email via email server to:', data.email);

  if (!data.email || !data.deletionDate) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required account deletion email data.');
  }

  try {
    // Match the emailRoutes.js format
    const transformedData = {
      customerEmail: data.email,
      customerName: data.name || 'User',
      deletionData: {
        deletionDate: data.deletionDate,
        reason: data.reason || 'user-request'
      }
    };

    const response = await axios.post(`${EMAIL_SERVER_BASE_URL}/api/email/account-deletion`, transformedData, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': EMAIL_SERVER_API_KEY,
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    if (response.status !== 200) {
      console.error('❌ Account deletion email server error:', response.status, response.data);
      throw new Error(`Email server error: ${response.status} - ${response.statusText}`);
    }

    const result = response.data;
    console.log('✅ Account deletion email server response:', result);
    console.log('✅ Account deletion email sent successfully via email server');
    
    // Return the actual response from the email server
    return result;
  } catch (error: any) {
    console.error('❌ Error sending account deletion email via email server:', error);
    throw new functions.https.HttpsError('internal', `Failed to send account deletion email: ${error.message}`);
  }
};

export const sendDepositReminderEmail = async (data: ScheduledTemplateEmailData): Promise<any> => {
  if (!data.customerEmail || !data.bookingId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required deposit reminder email data.');
  }

  try {
    return await postToEmailServer('deposit-reminder', data);
  } catch (error: any) {
    console.error('Error sending deposit reminder email via email server:', error);
    throw new functions.https.HttpsError('internal', `Failed to send deposit reminder email: ${error.message}`);
  }
};

export const sendPostEventThanksEmail = async (data: ScheduledTemplateEmailData): Promise<any> => {
  if (!data.customerEmail || !data.bookingId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required post-event email data.');
  }

  try {
    return await postToEmailServer('post-event-thanks', data);
  } catch (error: any) {
    console.error('Error sending post-event thank you email via email server:', error);
    throw new functions.https.HttpsError('internal', `Failed to send post-event thank you email: ${error.message}`);
  }
};

export const sendFollowUpRebookingEmail = async (data: ScheduledTemplateEmailData): Promise<any> => {
  if (!data.customerEmail) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required follow-up email data.');
  }

  try {
    return await postToEmailServer('follow-up', data);
  } catch (error: any) {
    console.error('Error sending follow-up rebooking email via email server:', error);
    throw new functions.https.HttpsError('internal', `Failed to send follow-up rebooking email: ${error.message}`);
  }
};
