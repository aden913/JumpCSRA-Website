/**
 * PayPal-related type definitions for JumpCSRA Cloud Functions
 */

export interface PayPalInvoiceData {
  recipientEmail: string;
  recipientName: string;
  orderID: string;
  orderDate: string;
  eventDate?: string;
  deliveryAddress?: string;
  deliveryTime?: string;
  duration?: string;
  surface?: string;
  
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
  
  subtotal: number;
  surfaceAdjustment: number;
  timeAdjustment: number;
  deliveryCost: number;
  totalAmount: number;
  paymentType: 'full' | 'deposit';
  amountPaid: number;
  remainingBalance: number;
  paymentMethod: string;
  
  giftCards: Array<{
    code: string;
    balance: number;
    expirationDate: string;
    isPromotional?: boolean;
    promotionalMessage?: string;
    recipientEmail?: string;
  }>;
  
  bookingStatus: string;
  requiresPhoneCall?: boolean;
  paypalOrderId?: string;
  paypalTransactionId?: string;
}

export interface PayPalAccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface PayPalInvoiceItem {
  name: string;
  description?: string;
  quantity: string;
  unit_amount: {
    currency_code: string;
    value: string;
  };
  tax?: {
    name: string;
    percent: string;
  };
}

export interface PayPalInvoicePayload {
  detail: {
    invoice_number: string;
    reference?: string;
    invoice_date: string;
    currency_code: string;
    note?: string;
    term?: string;
    memo?: string;
    payment_term?: {
      term_type: string;
      due_date?: string;
    };
  };
  
  invoicer: {
    name: {
      given_name: string;
      surname: string;
    };
    address?: {
      address_line_1: string;
      address_line_2?: string;
      admin_area_2: string;
      admin_area_1: string;
      postal_code: string;
      country_code: string;
    };
    email_address: string;
    phones?: Array<{
      country_code: string;
      national_number: string;
      phone_type: string;
    }>;
    website?: string;
    tax_id?: string;
    logo_url?: string;
  };
  
  primary_recipients: Array<{
    billing_info: {
      name: {
        given_name: string;
        surname: string;
      };
      address?: {
        address_line_1: string;
        address_line_2?: string;
        admin_area_2: string;
        admin_area_1: string;
        postal_code: string;
        country_code: string;
      };
      email_address: string;
      phones?: Array<{
        country_code: string;
        national_number: string;
        phone_type: string;
      }>;
      additional_info?: string;
    };
    shipping_info?: {
      name: {
        given_name: string;
        surname: string;
      };
      address: {
        address_line_1: string;
        address_line_2?: string;
        admin_area_2: string;
        admin_area_1: string;
        postal_code: string;
        country_code: string;
      };
    };
  }>;
  
  items: PayPalInvoiceItem[];
  
  configuration?: {
    partial_payment?: {
      allow_partial_payment: boolean;
      minimum_amount_due?: {
        currency_code: string;
        value: string;
      };
    };
    allow_tip?: boolean;
    tax_calculated_after_discount?: boolean;
    tax_inclusive?: boolean;
    template_id?: string;
  };
  
  amount?: {
    breakdown?: {
      custom?: {
        label: string;
        amount: {
          currency_code: string;
          value: string;
        };
      };
      shipping?: {
        amount: {
          currency_code: string;
          value: string;
        };
        tax?: {
          name: string;
          amount: {
            currency_code: string;
            value: string;
          };
        };
      };
      discount?: {
        invoice_discount?: {
          percent: string;
        };
      };
    };
  };
}

export interface PayPalInvoiceResponse {
  id: string;
  status: string;
  detail: {
    invoice_number: string;
    reference?: string;
    invoice_date: string;
    currency_code: string;
    note?: string;
    terms?: string;
    memo?: string;
    payment_term?: {
      term_type: string;
      due_date?: string;
    };
    metadata?: {
      create_time: string;
      created_by: string;
      last_update_time: string;
      last_updated_by: string;
      cancel_time?: string;
      cancelled_by?: string;
    };
  };
  links?: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

export interface PayPalErrorResponse {
  name: string;
  message: string;
  debug_id: string;
  details?: Array<{
    field: string;
    value: string;
    location: string;
    issue: string;
    description: string;
  }>;
  links?: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}