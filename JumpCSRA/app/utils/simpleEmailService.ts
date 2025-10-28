// Simplified Email Service - Client-side email handling
// This provides fallback email functionality when Firebase Functions are unavailable

interface SimpleEmailData {
  recipientEmail: string;
  orderID: string;
  totalAmount: number;
  items: string[];
  message: string;
}

// Create a simple email body for mailto links
const createEmailBody = (data: SimpleEmailData): string => {
  let body = `Dear Customer,\n\n`;
  body += `Thank you for your order with JumpCSRA Party Rentals!\n\n`;
  body += `Order Details:\n`;
  body += `Order ID: ${data.orderID}\n`;
  body += `Total Amount: $${data.totalAmount.toFixed(2)}\n\n`;
  
  if (data.items.length > 0) {
    body += `Items Ordered:\n`;
    data.items.forEach((item, index) => {
      body += `${index + 1}. ${item}\n`;
    });
    body += `\n`;
  }
  
  body += `${data.message}\n\n`;
  body += `If you have any questions, please contact us at:\n`;
  body += `Email: jumpcsra@gmail.com\n`;
  body += `Phone: (803) 221-0466\n\n`;
  body += `Thank you for choosing JumpCSRA Party Rentals!\n`;
  body += `Making Your Events Unforgettable\n\n`;
  body += `This is an automated message. Please save this email for your records.`;
  
  return encodeURIComponent(body);
};

// Create order confirmation email without Firebase Functions
export const createOrderConfirmationEmail = async (data: {
  recipientEmail: string;
  recipientName: string;
  orderID: string;
  orderDate: string;
  totalAmount: number;
  rentalItems: Array<{name: string; quantity: number; price: number}>;
  giftCards: Array<{code: string; balance: number}>;
  bookingStatus: string;
}): Promise<{success: boolean; message: string; emailUrl?: string}> => {
  
  try {
    // Create a simplified item list
    const items = [
      ...data.rentalItems.map(item => `${item.name} x${item.quantity} - $${item.price.toFixed(2)}`),
      ...data.giftCards.map(gc => `Gift Card ${gc.code} - $${gc.balance.toFixed(2)}`)
    ];
    
    let message = `Your order has been received and confirmed!\n\n`;
    message += `Order Status: ${data.bookingStatus}\n`;
    message += `Order Date: ${data.orderDate}\n\n`;
    
    if (data.giftCards.length > 0) {
      message += `Gift Cards Included:\n`;
      data.giftCards.forEach(gc => {
        message += `Code: ${gc.code} - Balance: $${gc.balance.toFixed(2)}\n`;
      });
      message += `\nGift cards can be used for future orders by entering the code during checkout.\n\n`;
    }
    
    message += `We will contact you soon to confirm your event details and delivery arrangements.\n`;
    
    const emailBody = createEmailBody({
      recipientEmail: data.recipientEmail,
      orderID: data.orderID,
      totalAmount: data.totalAmount,
      items: items,
      message: message
    });
    
    const subject = encodeURIComponent(`Order Confirmation #${data.orderID} - JumpCSRA Party Rentals`);
    const emailUrl = `mailto:${data.recipientEmail}?subject=${subject}&body=${emailBody}`;
    
    // Log the email details for manual sending if needed
    console.log('📧 SIMPLIFIED EMAIL - Order confirmation created');
    console.log('📧 Recipient:', data.recipientEmail);
    console.log('📧 Order ID:', data.orderID);
    console.log('📧 Total Amount:', data.totalAmount);
    console.log('📧 Gift Cards:', data.giftCards.length);
    console.log('📧 Email URL:', emailUrl);
    
    return {
      success: true,
      message: 'Order confirmation email prepared successfully (manual sending required)',
      emailUrl: emailUrl
    };
    
  } catch (error) {
    console.error('❌ SIMPLIFIED EMAIL - Error creating email:', error);
    return {
      success: false,
      message: 'Failed to create order confirmation email'
    };
  }
};

// Show email sending instructions to user
export const showEmailInstructions = (recipientEmail: string, emailUrl: string) => {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;
  
  const content = document.createElement('div');
  content.style.cssText = `
    background: white;
    padding: 2rem;
    border-radius: 8px;
    max-width: 500px;
    text-align: center;
  `;
  
  content.innerHTML = `
    <h3>📧 Email Confirmation</h3>
    <p>Your order has been processed successfully!</p>
    <p>Due to a temporary technical issue, please click the button below to send yourself an order confirmation email:</p>
    <div style="margin: 1rem 0;">
      <a href="${emailUrl}" 
         style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
        📧 Send Order Confirmation Email
      </a>
    </div>
    <p style="font-size: 0.9rem; color: #666;">
      This will open your default email client with a pre-filled email to ${recipientEmail}
    </p>
    <button onclick="this.parentElement.parentElement.remove()" 
            style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 1rem;">
      Close
    </button>
  `;
  
  modal.appendChild(content);
  document.body.appendChild(modal);
  
  // Auto-remove after 30 seconds
  setTimeout(() => {
    if (modal.parentElement) {
      modal.remove();
    }
  }, 30000);
};

// Test if Firebase Functions are available
export const testFirebaseFunctionsAvailability = async (): Promise<boolean> => {
  try {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const { app } = await import('../components/FirebaseConfig');
    
    const functions = getFunctions(app);
    const testFunction = httpsCallable(functions, 'testFunction');
    
    await testFunction({});
    console.log('✅ Firebase Functions are available');
    return true;
    
  } catch (error) {
    console.log('❌ Firebase Functions are not available:', error);
    return false;
  }
};