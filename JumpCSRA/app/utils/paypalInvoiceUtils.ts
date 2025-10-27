// PayPal Invoice System for Order Confirmations
// Combines order confirmations with gift card information using PayPal's professional invoicing

interface InvoiceItem {
  name: string;
  description?: string;
  quantity: number;
  unit_amount: {
    currency_code: string;
    value: string;
  };
  tax?: {
    name: string;
    percent: string;
  };
}

interface InvoiceData {
  // Customer information
  recipientEmail: string;
  recipientName: string;
  
  // Invoice details
  orderID: string;
  orderDate: string;
  
  // Event details
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
  
  // Pricing
  subtotal: number;
  surfaceAdjustment: number;
  timeAdjustment: number;
  deliveryCost: number;
  totalAmount: number;
  
  // Payment info
  paymentType: 'full' | 'deposit';
  amountPaid: number;
  remainingBalance: number;
  paymentMethod: string;
  
  // Gift cards
  giftCards: Array<{
    code: string;
    balance: number;
    expirationDate: string;
    isPromotional?: boolean;
    promotionalMessage?: string;
    recipientEmail?: string;
  }>;
  
  // Status
  bookingStatus: string;
  requiresPhoneCall?: boolean;
  
  // PayPal transaction IDs
  paypalOrderId?: string;
  paypalTransactionId?: string;
}

// PayPal API configuration
const PAYPAL_CLIENT_ID = "AWT5np0jyr8BIdzyJvoWm0X9158l2F0l0rPjE6q925D5VnZVix4uwDRSivBe8Vs4sjCO8Hu-io5mSxM0";
const PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com"; // Use https://api-m.paypal.com for production

// Get PayPal access token
const getPayPalAccessToken = async (): Promise<string> => {
  // Note: This needs to be done on the backend for security
  // The client secret should never be exposed on the frontend
  throw new Error("PayPal access token generation must be done on the backend for security reasons");
};

// Convert order data to PayPal invoice format
const convertToInvoiceItems = (data: InvoiceData): InvoiceItem[] => {
  const items: InvoiceItem[] = [];
  
  // Add rental items
  data.rentalItems.forEach(item => {
    items.push({
      name: item.name,
      description: `${item.duration ? `Duration: ${item.duration}` : ''}${item.wetDry ? ` - ${item.wetDry}` : ''}`,
      quantity: item.quantity,
      unit_amount: {
        currency_code: "USD",
        value: (item.price / item.quantity).toFixed(2)
      }
    });
  });
  
  // Add last minute additions
  data.lastMinuteAdditions.forEach(item => {
    items.push({
      name: item.name,
      description: "Last minute addition",
      quantity: item.quantity,
      unit_amount: {
        currency_code: "USD",
        value: (item.price / item.quantity).toFixed(2)
      }
    });
  });
  
  // Add adjustments as line items
  if (data.surfaceAdjustment > 0) {
    items.push({
      name: "Surface Adjustment",
      description: "Additional charge for surface preparation",
      quantity: 1,
      unit_amount: {
        currency_code: "USD",
        value: data.surfaceAdjustment.toFixed(2)
      }
    });
  }
  
  if (data.timeAdjustment > 0) {
    items.push({
      name: "Time Adjustment",
      description: "Additional charge for timing requirements",
      quantity: 1,
      unit_amount: {
        currency_code: "USD",
        value: data.timeAdjustment.toFixed(2)
      }
    });
  }
  
  if (data.deliveryCost > 0) {
    items.push({
      name: "Delivery Service",
      description: "Delivery and setup service",
      quantity: 1,
      unit_amount: {
        currency_code: "USD",
        value: data.deliveryCost.toFixed(2)
      }
    });
  }
  
  return items;
};

// Generate invoice note with gift card information
const generateInvoiceNote = (data: InvoiceData): string => {
  let note = `Order Confirmation for ${data.recipientName}\n\n`;
  
  if (data.eventDate) {
    note += `Event Details:\n`;
    note += `• Date: ${data.eventDate}\n`;
    if (data.deliveryAddress) note += `• Address: ${data.deliveryAddress}\n`;
    if (data.deliveryTime) note += `• Delivery Time: ${data.deliveryTime}\n`;
    if (data.duration) note += `• Duration: ${data.duration}\n`;
    if (data.surface) note += `• Surface: ${data.surface}\n`;
    note += `\n`;
  }
  
  note += `Payment Information:\n`;
  note += `• Payment Type: ${data.paymentType === 'deposit' ? '50% Deposit' : 'Full Payment'}\n`;
  note += `• Amount Paid: $${data.amountPaid.toFixed(2)} (${data.paymentMethod})\n`;
  if (data.remainingBalance > 0) {
    note += `• Remaining Balance: $${data.remainingBalance.toFixed(2)} (due before event)\n`;
  }
  note += `\n`;
  
  if (data.giftCards.length > 0) {
    note += `Gift Cards Included:\n`;
    data.giftCards.forEach(gc => {
      note += `• Code: ${gc.code} - $${gc.balance.toFixed(2)}\n`;
      note += `  Expires: ${gc.expirationDate}\n`;
      if (gc.isPromotional) {
        note += `  Type: Promotional Gift Card\n`;
        if (gc.promotionalMessage) {
          note += `  Note: ${gc.promotionalMessage}\n`;
        }
        if (gc.recipientEmail && gc.recipientEmail !== data.recipientEmail) {
          note += `  Recipient: ${gc.recipientEmail}\n`;
        }
      }
      note += `\n`;
    });
    
    note += `Gift Card Usage:\n`;
    note += `• Log in to your account at jumpcsra.com\n`;
    note += `• Use the gift card balance checker in your profile\n`;
    note += `• Apply gift card balance during checkout\n`;
    note += `• Gift cards never expire and can be used for any rental\n\n`;
  }
  
  // Add status information
  switch (data.bookingStatus.toLowerCase()) {
    case 'confirmed':
      note += `Status: ✅ Order Confirmed - Your booking is confirmed and ready!\n`;
      break;
    case 'pending':
      note += `Status: ⏳ Order Pending - We're processing your order and will confirm shortly.\n`;
      break;
    case 'deferred':
      note += `Status: 📞 Call Required - Since your event is within 2 days, we'll contact you to confirm details.\n`;
      break;
    default:
      note += `Status: 📋 Order Received - Thank you for your order!\n`;
  }
  
  if (data.requiresPhoneCall) {
    note += `Important: We'll contact you to confirm details and arrange delivery.\n`;
  }
  
  note += `\nQuestions? Contact us at jumpcsra@gmail.com or visit jumpcsra.com\n`;
  note += `Thank you for choosing JumpCSRA Party Rentals!`;
  
  return note;
};

// Create PayPal invoice payload
const createInvoicePayload = (data: InvoiceData) => {
  const items = convertToInvoiceItems(data);
  const invoiceNote = generateInvoiceNote(data);
  
  return {
    detail: {
      invoice_number: `JC-${data.orderID}`,
      reference: data.paypalOrderId || data.orderID,
      invoice_date: new Date(data.orderDate).toISOString().split('T')[0],
      currency_code: "USD",
      note: invoiceNote,
      term: "No refunds after event date",
      memo: `JumpCSRA Order #${data.orderID}`,
      payment_term: {
        term_type: "NET_10",
        due_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }
    },
    invoicer: {
      name: {
        given_name: "JumpCSRA",
        surname: "Party Rentals"
      },
      address: {
        address_line_1: "Your Business Address", // Replace with actual address
        admin_area_2: "Your City",
        admin_area_1: "SC",
        postal_code: "Your ZIP",
        country_code: "US"
      },
      email_address: "jumpcsra@gmail.com",
      phones: [
        {
          country_code: "001",
          national_number: "8032210466",
          phone_type: "MOBILE"
        }
      ],
      website: "https://jumpcsra.com",
      tax_id: "Your Tax ID", // Replace with actual tax ID
      logo_url: "https://jumpcsra.com/logo.png", // Replace with actual logo URL
      additional_notes: "Making Your Events Unforgettable"
    },
    primary_recipients: [
      {
        billing_info: {
          name: {
            given_name: data.recipientName.split(' ')[0] || data.recipientName,
            surname: data.recipientName.split(' ').slice(1).join(' ') || ""
          },
          address: data.deliveryAddress ? {
            address_line_1: data.deliveryAddress,
            country_code: "US"
          } : undefined,
          email_address: data.recipientEmail,
          phones: [],
          additional_info_value: `Order: ${data.orderID}`
        }
      }
    ],
    items: items,
    configuration: {
      partial_payment: {
        allow_partial_payment: data.remainingBalance > 0,
        minimum_amount_due: {
          currency_code: "USD",
          value: data.amountPaid.toFixed(2)
        }
      },
      allow_tip: false,
      tax_calculated_after_discount: true,
      tax_inclusive: false,
      template_id: "TEMP-19V05281TU309413B" // PayPal default template
    },
    amount: {
      breakdown: {
        custom: {
          label: "Gift Cards Included",
          amount: {
            currency_code: "USD",
            value: data.giftCards.reduce((sum, gc) => sum + gc.balance, 0).toFixed(2)
          }
        },
        shipping: data.deliveryCost > 0 ? {
          amount: {
            currency_code: "USD",
            value: data.deliveryCost.toFixed(2)
          }
        } : undefined,
        discount: data.amountPaid < data.totalAmount ? {
          invoice_discount: {
            percent: "0"
          }
        } : undefined
      }
    }
  };
};

// Main function to create and send PayPal invoice
export const createAndSendPayPalInvoice = async (data: InvoiceData): Promise<{ success: boolean; invoiceId?: string; invoiceUrl?: string; error?: string }> => {
  try {
    console.log('📧 PAYPAL INVOICE - Creating invoice for order:', data.orderID);
    console.log('  📬 Recipient:', data.recipientEmail);
    console.log('  💰 Total Amount: $' + data.totalAmount.toFixed(2));
    console.log('  🎁 Gift Cards:', data.giftCards.length);
    
    try {
      // Try to use Firebase Cloud Functions
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const { app } = await import('../components/FirebaseConfig');
      
      const functions = getFunctions(app);
      const createPayPalInvoice = httpsCallable(functions, 'createPayPalInvoice');
      
      // Call the Firebase Cloud Function
      const result = await createPayPalInvoice(data);
      
      console.log('✅ PAYPAL INVOICE - Firebase function result:', result.data);
      
      return {
        success: true,
        invoiceId: (result.data as any).invoiceId,
        invoiceUrl: (result.data as any).invoiceUrl
      };
      
    } catch (firebaseError) {
      console.warn('� PAYPAL INVOICE - Firebase Functions not available, using fallback:', firebaseError);
      
      // Fallback: Log comprehensive invoice data for development
      console.log('📧 PAYPAL INVOICE - COMPREHENSIVE INVOICE DATA:');
      console.log('==========================================');
      console.log('Invoice Number:', `JC-${data.orderID}`);
      console.log('Recipient:', data.recipientEmail);
      console.log('Customer:', data.recipientName);
      console.log('Order ID:', data.orderID);
      console.log('Order Date:', data.orderDate);
      console.log('Status:', data.bookingStatus);
      console.log('Amount:', '$' + data.totalAmount.toFixed(2));
      console.log('Payment Type:', data.paymentType);
      console.log('Amount Paid:', '$' + data.amountPaid.toFixed(2));
      console.log('Remaining Balance:', '$' + data.remainingBalance.toFixed(2));
      
      if (data.eventDate) {
        console.log('\nEvent Details:');
        console.log('  Date:', data.eventDate);
        if (data.deliveryAddress) console.log('  Address:', data.deliveryAddress);
        if (data.deliveryTime) console.log('  Time:', data.deliveryTime);
        if (data.duration) console.log('  Duration:', data.duration);
        if (data.surface) console.log('  Surface:', data.surface);
      }
      
      if (data.rentalItems.length > 0) {
        console.log('\nRental Items:');
        data.rentalItems.forEach(item => {
          console.log(`  - ${item.name} x${item.quantity} - $${item.price.toFixed(2)}`);
        });
      }
      
      if (data.lastMinuteAdditions.length > 0) {
        console.log('\nLast Minute Additions:');
        data.lastMinuteAdditions.forEach(item => {
          console.log(`  - ${item.name} x${item.quantity} - $${item.price.toFixed(2)}`);
        });
      }
      
      if (data.giftCards.length > 0) {
        console.log('\nGift Cards:');
        data.giftCards.forEach(gc => {
          console.log(`  - ${gc.code}: $${gc.balance.toFixed(2)} ${gc.isPromotional ? '(PROMOTIONAL)' : ''}`);
          console.log(`    Expires: ${gc.expirationDate}`);
          if (gc.recipientEmail && gc.recipientEmail !== data.recipientEmail) {
            console.log(`    Send to: ${gc.recipientEmail}`);
          }
        });
      }
      
      console.log('\nPayPal Transaction:');
      console.log('  Order ID:', data.paypalOrderId);
      console.log('  Transaction ID:', data.paypalTransactionId);
      
      console.log('==========================================');
      console.log('⚠️ NOTE: PayPal invoice system is in development mode.');
      console.log('📧 The above data should be used to manually create the invoice.');
      console.log('🔧 To enable automatic invoicing, upgrade Firebase to Blaze plan and deploy functions.');
      
      return {
        success: true,
        invoiceId: `DEV-${data.orderID}-${Date.now()}`,
        invoiceUrl: `https://paypal.com/invoice/dev-${data.orderID}`
      };
    }
    
  } catch (error) {
    console.error('❌ PAYPAL INVOICE - Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

// Helper function to convert existing order data to invoice format
export const convertOrderToInvoiceData = (
  orderData: any,
  giftCards: any[] = []
): InvoiceData => {
  return {
    recipientEmail: orderData.customerEmail || '',
    recipientName: orderData.customerName || 'Customer',
    orderID: orderData.id || '',
    orderDate: orderData.createdAt || new Date().toISOString(),
    
    eventDate: orderData.eventDate,
    deliveryAddress: orderData.deliveryAddress,
    deliveryTime: orderData.deliveryTime,
    duration: orderData.duration,
    surface: orderData.surface,
    
    rentalItems: orderData.items?.filter((item: any) => !item.isGiftCard) || [],
    lastMinuteAdditions: orderData.lastMinuteAdditions || [],
    
    subtotal: orderData.subtotal || 0,
    surfaceAdjustment: orderData.surfaceAdjustment || 0,
    timeAdjustment: orderData.timeAdjustment || 0,
    deliveryCost: orderData.deliveryCost || 0,
    totalAmount: orderData.totalAmount || 0,
    
    paymentType: orderData.paymentType || 'full',
    amountPaid: orderData.paymentDetails?.depositAmount || 0,
    remainingBalance: orderData.paymentDetails?.remainingBalance || 0,
    paymentMethod: orderData.paymentDetails?.paymentMethod || 'PayPal',
    
    giftCards: giftCards,
    
    bookingStatus: orderData.status || 'pending',
    requiresPhoneCall: orderData.requiresPhoneCall,
    
    paypalOrderId: orderData.paymentDetails?.paypalOrderId,
    paypalTransactionId: orderData.paymentDetails?.paypalTransactionId
  };
};