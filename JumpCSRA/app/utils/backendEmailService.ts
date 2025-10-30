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
    // Check if we're in development or production
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3000'; // Development
      } else {
        // Production - use same domain
        return `${window.location.protocol}//${hostname}`;
      }
    }
    
    // Fallback for server-side rendering
    return process.env.NODE_ENV === 'production' 
      ? 'http://170.187.145.7' // Your Linode server IP
      : 'http://localhost:3000';
  }

  private getApiKey(): string {
    // In production, this should come from a secure source
    // For now, using a consistent key that matches your server
    return 'jumpcsra_secure_api_key_2024';
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
    return this.makeRequest('account-creation', {
      email: userData.email,
      name: userData.name || userData.displayName,
      userID: userData.userID || userData.uid
    });
  }

  // Order confirmation email (replaces enhanced SendGrid function)
  async sendOrderConfirmationEmail(orderData: OrderData) {
    // Transform data to match backend expectations
    const transformedData = {
      orderID: orderData.orderID,
      customerEmail: orderData.recipientEmail || orderData.customerEmail,
      customerName: orderData.recipientName || orderData.customerName,
      totalAmount: orderData.totalAmount,
      eventDate: orderData.eventDate,
      items: orderData.rentalItems || orderData.items || [],
      deliveryAddress: orderData.deliveryAddress,
      deliveryTime: orderData.deliveryTime,
      paymentType: orderData.paymentType,
      amountPaid: orderData.amountPaid,
      remainingBalance: orderData.remainingBalance,
      paymentMethod: orderData.paymentMethod,
      giftCards: orderData.giftCards || [],
      bookingStatus: orderData.bookingStatus
    };

    return this.makeRequest('order-confirmation', transformedData);
  }

  // Schedule cart abandonment reminder
  async scheduleCartReminderEmail(cartData: CartData) {
    return this.makeRequest('cart-reminder', {
      userID: cartData.userID,
      cartItems: cartData.cartItems,
      cartValue: cartData.cartValue,
      customerEmail: cartData.customerEmail,
      customerName: cartData.customerName
    });
  }

  // Schedule deposit reminder
  async scheduleDepositReminderEmail(bookingData: BookingData) {
    return this.makeRequest('deposit-reminder', {
      bookingID: bookingData.bookingID,
      customerEmail: bookingData.customerEmail,
      customerName: bookingData.customerName,
      eventDate: bookingData.eventDate,
      remainingAmount: bookingData.remainingAmount
    });
  }

  // Schedule event confirmation (2 days before)
  async scheduleEventConfirmationEmail(bookingData: BookingData) {
    return this.makeRequest('event-confirmation', {
      bookingID: bookingData.bookingID,
      customerEmail: bookingData.customerEmail,
      customerName: bookingData.customerName,
      eventDate: bookingData.eventDate,
      bookingDetails: bookingData.bookingDetails
    });
  }

  // Schedule post-event thank you
  async schedulePostEventThanksEmail(bookingData: BookingData) {
    return this.makeRequest('post-event-thanks', {
      bookingID: bookingData.bookingID,
      customerEmail: bookingData.customerEmail,
      customerName: bookingData.customerName,
      eventDate: bookingData.eventDate,
      bookingDetails: bookingData.bookingDetails
    });
  }

  // Schedule rebooking reminder (9 months later)
  async scheduleRebookingReminderEmail(bookingData: BookingData) {
    return this.makeRequest('rebooking-reminder', {
      bookingID: bookingData.bookingID,
      customerEmail: bookingData.customerEmail,
      customerName: bookingData.customerName,
      eventDate: bookingData.eventDate,
      bookingDetails: bookingData.bookingDetails
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
    return this.makeRequest('test', { type, email });
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

export const sendEnhancedOrderConfirmation = (orderData: OrderData) => 
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