// Backend Email Service for JumpCSRA
// Replaces Firebase Functions with backend API calls
import { get, ref } from 'firebase/database';
import { database } from '../components/FirebaseConfig';

interface UserData {
  email: string;
  name?: string;
  displayName?: string;
  userID?: string;
  uid?: string;
}

interface AccountDeletionEmailData {
  email: string;
  name?: string;
  deletedWalletBalance?: number;
  deletionDate: string;
}

interface GiftCardEmailData {
  recipientEmail: string;
  recipientName?: string;
  senderName?: string;
  personalMessage?: string;
  giftCardCode: string;
  giftCardBalance: number;
  expirationDate?: string;
  isPromotional?: boolean;
  giftedTo?: string;
}

interface OrderData {
  orderID: string;
  recipientEmail?: string;
  customerEmail?: string;
  recipientName?: string;
  customerName?: string;
  totalAmount: number;
  eventDate: string;
  rentalItems?: any[];
  items?: any[];
  deliveryAddress?: string;
  deliveryTime?: string;
  pickupTime?: string;
  eventEnd?: string;
  paymentType?: string;
  amountPaid?: number;
  remainingBalance?: number;
  paymentMethod?: string;
  giftCards?: any[];
  bookingStatus?: string;
}

interface CartData {
  userID: string;
  cartItems: any[];
  cartValue: number;
  customerEmail: string;
  customerName: string;
}

interface BookingData {
  bookingID: string;
  customerEmail: string;
  customerName: string;
  eventDate: string;
  remainingAmount?: number;
  bookingDetails?: any;
}

const EMAIL_TEMPLATE_SETTING_KEYS: Record<string, string[]> = {
  'account-created': ['accountCreation', 'account-created'],
  'account-deletion': ['accountDeletion', 'account-deletion'],
  'booking-confirmation': ['bookingConfirmation', 'booking-confirmation'],
  'cart-reminder': ['cartReminder', 'cart-reminder'],
  'deferred-booking-payment': ['deferredBookingPayment', 'deferred-booking-payment'],
  'deposit-reminder': ['depositReminder', 'deposit-reminder'],
  'follow-up': ['followUpRebooking', 'follow-up'],
  'gift-card': ['giftCard', 'gift-card'],
  'membership-cancellation': ['membershipCancellation', 'membership-cancellation'],
  'membership-confirmation': ['membershipConfirmation', 'membership-confirmation'],
  'membership-event-confirmation': ['membershipEventConfirmation', 'membership-event-confirmation'],
  'membership-post-event-thanks': ['membershipPostEventThankYou', 'membership-post-event-thanks'],
  'payment-confirmation': ['paymentConfirmation', 'payment-confirmation'],
  'post-event-thanks': ['postEventThanks', 'post-event-thanks']
};

const MARKETING_TEMPLATE_ENDPOINTS = new Set([
  'cart-reminder',
  'follow-up',
  'membership-post-event-thanks',
  'post-event-thanks'
]);

class BackendEmailService {
  private baseURL: string;
  private apiKey: string;

  constructor() {
    // Determine base URL based on environment
    this.baseURL = this.getBaseURL();
    this.apiKey = this.getApiKey();
  }

  private getBaseURL(): string {
    const normalizeBaseUrl = (url: string) => url
      .replace(/\/api\/email\/?\*?$/i, '')
      .replace(/\/+$/, '');

    // Use environment variable or fallback to production
    if (typeof window !== 'undefined' && (window as any).ENV?.EMAIL_SERVICE_URL) {
      return normalizeBaseUrl((window as any).ENV.EMAIL_SERVICE_URL);
    }
    return normalizeBaseUrl(import.meta.env.VITE_EMAIL_SERVICE_URL || 'http://173.230.132.127:3001');
  }

  private getApiKey(): string {
    // Get API key from environment variable
    if (typeof window !== 'undefined' && (window as any).ENV?.EMAIL_API_KEY) {
      return (window as any).ENV.EMAIL_API_KEY;
    }
    return import.meta.env.VITE_EMAIL_API_KEY || 'jumpcsra_secure_api_key_2024';
  }

  private async getTemplateConfig(endpoint: string): Promise<{ templateId: string; templateName?: string } | null> {
    const settingKeys = EMAIL_TEMPLATE_SETTING_KEYS[endpoint];
    if (!settingKeys) {
      return null;
    }

    try {
      const templatePath = MARKETING_TEMPLATE_ENDPOINTS.has(endpoint)
        ? 'dashboardInformation/emails/marketingTemplates'
        : 'dashboardInformation/emails/transactionalTemplates';
      const snapshot = await get(ref(database, templatePath));
      if (!snapshot.exists()) {
        return null;
      }

      const templates = snapshot.val() || {};
      const matchedKey = settingKeys.find((key) => templates[key]);
      if (!matchedKey) {
        console.warn(`No dashboard template setting found for ${endpoint}.`, {
          expectedKeys: settingKeys,
          availableKeys: Object.keys(templates),
          templatePath
        });
        return null;
      }

      const value = templates[matchedKey];
      if (typeof value === 'string') {
        return { templateId: value };
      }

      if (value?.templateId) {
        return {
          templateId: String(value.templateId),
          templateName: value.templateName ? String(value.templateName) : undefined
        };
      }
    } catch (error) {
      console.warn(`Could not load email template setting for ${endpoint}:`, error);
    }

    return null;
  }

  private async makeRequest(endpoint: string, data: any = null, method: string = 'POST'): Promise<any> {
    try {
      let requestData = data;
      if (data && method !== 'GET' && !data.templateId) {
        const templateConfig = await this.getTemplateConfig(endpoint);
        if (templateConfig?.templateId) {
          requestData = {
            ...data,
            ...templateConfig
          };
        }
      }

      const config: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        }
      };

      if (requestData && method !== 'GET') {
        config.body = JSON.stringify(requestData);
      }

      const requestUrl = `${this.baseURL}/api/email/${endpoint}`;
      const response = await fetch(requestUrl, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Backend Email Service Error (${endpoint}):`, error);
      this.logBrowserRequestDiagnostics(endpoint, error);
      throw error;
    }
  }

  private logBrowserRequestDiagnostics(endpoint: string, error: unknown) {
    if (typeof window === 'undefined') {
      return;
    }

    const requestUrl = `${this.baseURL}/api/email/${endpoint}`;
    const pageProtocol = window.location.protocol;
    const requestProtocol = (() => {
      try {
        return new URL(requestUrl).protocol;
      } catch {
        return 'unknown:';
      }
    })();
    const failedBeforeResponse =
      error instanceof TypeError ||
      String((error as any)?.message || error).toLowerCase().includes('failed to fetch');

    if (!failedBeforeResponse) {
      return;
    }

    console.group(`Email request blocked or unreachable: ${endpoint}`);
    console.error('The browser did not receive a response from the email server.', error);
    console.info('Request URL:', requestUrl);
    console.info('Page origin:', window.location.origin);
    console.info('Page protocol:', pageProtocol);
    console.info('Email server protocol:', requestProtocol);

    if (pageProtocol === 'https:' && requestProtocol === 'http:') {
      console.warn('Likely cause: mixed content. An HTTPS page cannot safely call an HTTP email server URL directly.');
    } else {
      console.warn('Likely causes include CORS/preflight rejection, server unreachable, incorrect port, blocked network request, or browser extension blocking.');
    }

    console.info('Check the Network tab for the matching request/preflight. If no request reaches the backend logs, the browser blocked it before the server handled it.');
    console.groupEnd();
  }

  // Account creation email
  async sendAccountCreationEmail(userData: UserData) {
    return this.makeRequest('account-created', {
      customerEmail: userData.email,
      customerName: userData.name || userData.displayName,
      customerId: userData.userID || userData.uid
    });
  }

  // Account deletion email
  async sendAccountDeletionEmail(data: AccountDeletionEmailData) {
    return this.makeRequest('account-deletion', {
      customerEmail: data.email,
      customerName: data.name || 'Customer',
      deletionData: {
        deletionDate: data.deletionDate,
        deletedWalletBalance: data.deletedWalletBalance || 0,
        reason: 'user-request'
      }
    });
  }

  // Order confirmation email (replaces enhanced SendGrid function)
  async sendOrderConfirmationEmail(orderData: OrderData) {
    // Transform data to match backend expectations
    const transformedData = {
      customerEmail: orderData.recipientEmail || orderData.customerEmail,
      customerName: orderData.recipientName || orderData.customerName,
      bookingId: orderData.orderID,
      paymentAmount: orderData.amountPaid || orderData.totalAmount,
      bookingDetails: {
        eventDate: orderData.eventDate,
        items: orderData.rentalItems || orderData.items || [],
        total: orderData.totalAmount,
        amountPaid: orderData.amountPaid || orderData.totalAmount,
        remainingBalance: orderData.remainingBalance || 0,
        address: orderData.deliveryAddress,
        setupTime: orderData.deliveryTime,
        pickupTime: orderData.pickupTime || orderData.eventEnd
      }
    };

    return this.makeRequest('payment-confirmation', transformedData);
  }

  async sendBookingConfirmationEmail(orderData: OrderData) {
    return this.makeRequest('booking-confirmation', {
      customerEmail: orderData.recipientEmail || orderData.customerEmail,
      customerName: orderData.recipientName || orderData.customerName,
      bookingId: orderData.orderID,
      eventDate: orderData.eventDate,
      bookingDetails: {
        items: orderData.rentalItems || orderData.items || [],
        total: orderData.totalAmount,
        amountPaid: orderData.amountPaid || orderData.totalAmount,
        remainingBalance: orderData.remainingBalance || 0,
        address: orderData.deliveryAddress,
        setupTime: orderData.deliveryTime,
        pickupTime: orderData.pickupTime || orderData.eventEnd || 'TBD',
        paymentType: orderData.paymentType,
        paymentMethod: orderData.paymentMethod,
        giftCards: orderData.giftCards || [],
        bookingStatus: orderData.bookingStatus
      }
    });
  }

  async sendGiftCardEmail(data: GiftCardEmailData) {
    return this.makeRequest('gift-card', {
      customerEmail: data.recipientEmail,
      customerName: data.recipientName || 'Valued Customer',
      senderName: data.senderName,
      personalMessage: data.personalMessage,
      giftCardData: {
        code: data.giftCardCode,
        balance: data.giftCardBalance,
        expirationDate: data.expirationDate,
        isPromotional: data.isPromotional,
        giftedTo: data.giftedTo
      }
    });
  }

  // Schedule cart abandonment reminder
  async scheduleCartReminderEmail(cartData: CartData) {
    return this.makeRequest('cart-reminder', {
      customerEmail: cartData.customerEmail,
      customerName: cartData.customerName,
      customerId: cartData.userID,
      cartItems: cartData.cartItems,
      cartTotal: cartData.cartValue,
      cartId: `cart_${cartData.userID}_${Date.now()}`
    });
  }

  // Schedule deposit reminder
  async scheduleDepositReminderEmail(bookingData: BookingData) {
    return this.makeRequest('deposit-reminder', {
      customerEmail: bookingData.customerEmail,
      customerName: bookingData.customerName,
      customerId: bookingData.bookingID.split('_')[0], // Extract user ID from booking ID
      bookingId: bookingData.bookingID,
      remainingAmount: bookingData.remainingAmount,
      dueDate: bookingData.eventDate, // Could be calculated based on business rules
      bookingDetails: {
        eventDate: bookingData.eventDate,
        items: bookingData.bookingDetails?.items || []
      }
    });
  }

  // Schedule event confirmation (2 days before)
  async scheduleEventConfirmationEmail(bookingData: BookingData) {
    return this.makeRequest('booking-confirmation', {
      customerEmail: bookingData.customerEmail,
      customerName: bookingData.customerName,
      customerId: bookingData.bookingID.split('_')[0], // Extract user ID from booking ID
      bookingId: bookingData.bookingID,
      eventDate: bookingData.eventDate,
      bookingDetails: {
        items: bookingData.bookingDetails?.items || [],
        setupTime: bookingData.bookingDetails?.setupTime || 'TBD',
        pickupTime: bookingData.bookingDetails?.pickupTime || 'TBD',
        address: bookingData.bookingDetails?.address || 'TBD'
      }
    });
  }

  // Schedule post-event thank you
  async schedulePostEventThanksEmail(bookingData: BookingData) {
    return this.makeRequest('post-event-thanks', {
      customerEmail: bookingData.customerEmail,
      customerName: bookingData.customerName,
      customerId: bookingData.bookingID.split('_')[0], // Extract user ID from booking ID
      bookingId: bookingData.bookingID,
      eventDate: bookingData.eventDate,
      bookingDetails: {
        items: bookingData.bookingDetails?.items || []
      }
    });
  }

  // Schedule rebooking reminder (9 months later)
  async scheduleRebookingReminderEmail(bookingData: BookingData) {
    return this.makeRequest('follow-up', {
      customerEmail: bookingData.customerEmail,
      customerName: bookingData.customerName,
      customerId: bookingData.bookingID.split('_')[0], // Extract user ID from booking ID
      lastBookingDate: bookingData.eventDate,
      lastBookingId: bookingData.bookingID
    });
  }

  // Cancel scheduled email
  async cancelScheduledEmail(emailID: string) {
    return this.makeRequest(`scheduled/${emailID}`, null, 'DELETE');
  }

  // Get scheduled emails for user
  async getScheduledEmails(userID: string) {
    return this.makeRequest(`scheduled/${userID}`, null, 'GET');
  }

  // Test email (development only)
  async sendTestEmail(type: string, email: string) {
    return this.makeRequest('test', { 
      customerEmail: email,
      customerName: 'Test User',
      testType: type
    });
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

// Create singleton instance
const backendEmailService = new BackendEmailService();

export default backendEmailService;

// Named exports for specific functions (backward compatibility)
export const sendAccountCreationEmail = (userData: UserData) => 
  backendEmailService.sendAccountCreationEmail(userData);

export const sendAccountDeletionEmail = (data: AccountDeletionEmailData) =>
  backendEmailService.sendAccountDeletionEmail(data);

export const sendOrderConfirmationEmail = (orderData: OrderData) => 
  backendEmailService.sendOrderConfirmationEmail(orderData);

export const sendBookingConfirmationEmail = (orderData: OrderData) =>
  backendEmailService.sendBookingConfirmationEmail(orderData);

export const sendGiftCardEmail = (data: GiftCardEmailData) =>
  backendEmailService.sendGiftCardEmail(data);

export const scheduleCartReminderEmail = (cartData: CartData) => 
  backendEmailService.scheduleCartReminderEmail(cartData);

export const scheduleDepositReminderEmail = (bookingData: BookingData) => 
  backendEmailService.scheduleDepositReminderEmail(bookingData);

export const scheduleEventConfirmationEmail = (bookingData: BookingData) => 
  backendEmailService.scheduleEventConfirmationEmail(bookingData);

export const schedulePostEventThanksEmail = (bookingData: BookingData) => 
  backendEmailService.schedulePostEventThanksEmail(bookingData);

export const scheduleRebookingReminderEmail = (bookingData: BookingData) => 
  backendEmailService.scheduleRebookingReminderEmail(bookingData);

export const cancelScheduledEmail = (emailID: string) => 
  backendEmailService.cancelScheduledEmail(emailID);

export const getScheduledEmails = (userID: string) => 
  backendEmailService.getScheduledEmails(userID);

export const sendTestEmail = (type: string, email: string) => 
  backendEmailService.sendTestEmail(type, email);

export const healthCheck = () => 
  backendEmailService.healthCheck();
