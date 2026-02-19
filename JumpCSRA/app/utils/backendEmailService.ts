// Backend Email Service for JumpCSRA
// Replaces Firebase Functions with backend API calls

interface UserData {
  email: string;
  name?: string;
  displayName?: string;
  userID?: string;
  uid?: string;
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

class BackendEmailService {
  private baseURL: string;
  private apiKey: string;

  constructor() {
    // Determine base URL based on environment
    this.baseURL = this.getBaseURL();
    this.apiKey = this.getApiKey();
  }

  private getBaseURL(): string {
    // Use environment variable or fallback to production
    if (typeof window !== 'undefined' && (window as any).ENV?.EMAIL_SERVICE_URL) {
      return (window as any).ENV.EMAIL_SERVICE_URL;
    }
    return import.meta.env.VITE_EMAIL_SERVICE_URL || 'http://170.187.145.7:3001';
  }

  private getApiKey(): string {
    // Get API key from environment variable
    if (typeof window !== 'undefined' && (window as any).ENV?.EMAIL_API_KEY) {
      return (window as any).ENV.EMAIL_API_KEY;
    }
    return import.meta.env.VITE_EMAIL_API_KEY || 'jumpcsra_secure_api_key_2024';
  }

  private async makeRequest(endpoint: string, data: any = null, method: string = 'POST'): Promise<any> {
    try {
      const config: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        }
      };

      if (data && method !== 'GET') {
        config.body = JSON.stringify(data);
      }

      const response = await fetch(`${this.baseURL}/api/email/${endpoint}`, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Backend Email Service Error (${endpoint}):`, error);
      throw error;
    }
  }

  // Account creation email
  async sendAccountCreationEmail(userData: UserData) {
    return this.makeRequest('account-created', {
      customerEmail: userData.email,
      customerName: userData.name || userData.displayName,
      customerId: userData.userID || userData.uid
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
        setupTime: orderData.deliveryTime
      }
    };

    return this.makeRequest('payment-confirmation', transformedData);
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

export const sendOrderConfirmationEmail = (orderData: OrderData) => 
  backendEmailService.sendOrderConfirmationEmail(orderData);

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