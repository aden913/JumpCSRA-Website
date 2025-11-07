/**
 * Email-related type definitions for JumpCSRA Cloud Functions
 */

export interface GiftCardInfo {
  code: string;
  balance: number;
  expirationDate: string;
  isPromotional?: boolean;
  promotionalMessage?: string;
  recipientEmail?: string;
}

export interface OrderConfirmationEmailData {
  recipientEmail: string;
  recipientName: string;
  orderID: string;
  orderDate: string;
  
  // Order details
  eventDate?: string;
  deliveryAddress?: string;
  deliveryTime?: string;
  duration?: string;
  surface?: string;
  
  // Items
  rentalItems: Array<{
    name: string;
    quantity: number;
    price: number;
    duration?: string;
    wetDry?: string;
  }>;
  
  lastMinuteAdditions: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  
  // Pricing breakdown
  subtotal: number;
  surfaceAdjustment: number;
  timeAdjustment: number;
  deliveryCost: number;
  totalAmount: number;
  
  // Payment info
  paymentType: string;
  amountPaid: number;
  remainingBalance: number;
  paymentMethod?: string;
  
  // Gift cards
  giftCards?: GiftCardInfo[];
  
  // Invoice details
  salesTax?: number;
  notes?: string;
  
  // Booking status
  bookingStatus?: string;
  requiresPhoneCall?: boolean;
}

export interface GiftCardEmailData {
  recipientEmail: string;
  recipientName?: string;
  senderName?: string;
  personalMessage?: string;
  giftCardCode: string;
  giftCardBalance: number;
  expirationDate: string;
  purchaseDate: string;
  orderID?: string;
}

export interface CartAbandonmentEmailData {
  customerEmail: string;
  customerName: string;
  customerId: string;
  cartItems: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  cartTotal: number;
  cartId: string;
  abandonedAt: string;
}

export interface DepositReminderEmailData {
  customerEmail: string;
  customerName: string;
  customerId: string;
  bookingId: string;
  remainingAmount: number;
  dueDate: string;
  eventDate: string;
  bookingDetails: {
    items: Array<{
      name: string;
      quantity?: number;
      price?: number;
    }>;
    setupTime?: string;
    pickupTime?: string;
    address?: string;
  };
}

export interface EventConfirmationEmailData {
  customerEmail: string;
  customerName: string;
  customerId: string;
  bookingId: string;
  eventDate: string;
  bookingDetails: {
    items: Array<{
      name: string;
      quantity?: number;
      price?: number;
    }>;
    setupTime: string;
    pickupTime: string;
    address: string;
  };
}

export interface PostEventThanksEmailData {
  customerEmail: string;
  customerName: string;
  customerId: string;
  bookingId: string;
  eventDate: string;
  bookingDetails: {
    items: Array<{
      name: string;
      quantity?: number;
      price?: number;
    }>;
  };
}

export interface RebookingReminderEmailData {
  customerEmail: string;
  customerName: string;
  customerId: string;
  lastBookingDate: string;
  lastBookingId: string;
  lastBookingItems?: Array<{
    name: string;
    quantity?: number;
    price?: number;
  }>;
}

export interface AccountDeletionEmailData {
  email: string;
  name?: string;
  deletionDate: string;
  reason?: string;
}

export interface EmailSchedulerData {
  type: 'cart-abandonment' | 'deposit-reminder' | 'event-confirmation' | 'post-event-thanks' | 'rebooking-reminder';
  scheduledFor: number; // timestamp
  data: CartAbandonmentEmailData | DepositReminderEmailData | EventConfirmationEmailData | PostEventThanksEmailData | RebookingReminderEmailData;
  customerId: string;
  bookingId?: string;
  cartId?: string;
  sent: boolean;
  createdAt: number;
}