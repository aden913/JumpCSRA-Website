// Email templates for automated emails

const baseStyle = `
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8f9fa; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #6c757d; }
    .btn { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; }
    .alert { padding: 15px; margin: 20px 0; border-radius: 6px; }
    .alert-info { background-color: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; }
    .alert-warning { background-color: #fff3cd; border: 1px solid #ffeaa7; color: #856404; }
    .cart-item { border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; margin: 10px 0; }
    h1 { margin: 0; font-size: 28px; }
    h2 { color: #333; font-size: 24px; }
    h3 { color: #666; font-size: 18px; }
  </style>
`;

const emailTemplates = {
  // Account creation welcome email
  accountCreation: ({ name }) => `
    ${baseStyle}
    <div class="container">
      <div class="header">
        <h1>🎉 Welcome to JumpCSRA!</h1>
      </div>
      <div class="content">
        <h2>Hi ${name}!</h2>
        <p>Welcome to JumpCSRA Party Rentals! We're thrilled to have you join our family of happy customers.</p>
        
        <div class="alert alert-info">
          <strong>🎈 What's Next?</strong><br>
          Browse our amazing selection of bounce houses, slides, and party rentals to make your next event unforgettable!
        </div>
        
        <h3>Why Choose JumpCSRA?</h3>
        <ul>
          <li>✅ Premium quality equipment</li>
          <li>✅ Professional setup and delivery</li>
          <li>✅ Competitive pricing</li>
          <li>✅ Excellent customer service</li>
          <li>✅ Fully insured and licensed</li>
        </ul>
        
        <p style="text-align: center; margin: 30px 0;">
          <a href="#" class="btn">Start Planning Your Party</a>
        </p>
        
        <p>If you have any questions, feel free to reach out to us anytime!</p>
        
        <p>Best regards,<br>The JumpCSRA Team</p>
      </div>
      <div class="footer">
        <p>JumpCSRA Party Rentals | Making memories one bounce at a time</p>
        <p>📧 jumpcsra@gmail.com | 📞 (Your Phone Number)</p>
      </div>
    </div>
  `,

  // Order confirmation after payment
  orderConfirmation: (orderData) => `
    ${baseStyle}
    <div class="container">
      <div class="header">
        <h1>✅ Order Confirmed!</h1>
      </div>
      <div class="content">
        <h2>Thank you, ${orderData.customerName}!</h2>
        <p>Your order has been confirmed and payment processed successfully.</p>
        
        <div class="alert alert-info">
          <strong>Order #${orderData.orderID}</strong><br>
          Total Amount: <strong>$${orderData.totalAmount}</strong><br>
          Event Date: <strong>${orderData.eventDate}</strong>
        </div>
        
        <h3>📋 Order Summary</h3>
        ${orderData.items ? orderData.items.map(item => `
          <div class="cart-item">
            <strong>${item.name}</strong><br>
            Quantity: ${item.quantity} | Price: $${item.price}
          </div>
        `).join('') : ''}
        
        <h3>📅 Next Steps</h3>
        <ul>
          <li>We'll contact you 2 days before your event to confirm details</li>
          <li>Our team will arrive during your scheduled delivery window</li>
          <li>All equipment will be professionally set up and inspected</li>
        </ul>
        
        <p style="text-align: center; margin: 30px 0;">
          <a href="#" class="btn">View Order Details</a>
        </p>
        
        <p>We're excited to help make your event amazing!</p>
        
        <p>Best regards,<br>The JumpCSRA Team</p>
      </div>
      <div class="footer">
        <p>JumpCSRA Party Rentals | Making memories one bounce at a time</p>
        <p>📧 jumpcsra@gmail.com | 📞 (Your Phone Number)</p>
      </div>
    </div>
  `,

  // Cart abandonment reminder
  cartReminder: ({ cartItems, cartValue, customerName }) => `
    ${baseStyle}
    <div class="container">
      <div class="header">
        <h1>🛒 Don't Forget Your Cart!</h1>
      </div>
      <div class="content">
        <h2>Hi ${customerName || 'there'}!</h2>
        <p>You left some amazing party rentals in your cart. Don't miss out on making your event unforgettable!</p>
        
        <div class="alert alert-warning">
          <strong>🎯 Your Cart Total: $${cartValue}</strong><br>
          Complete your booking before these popular items are reserved by someone else!
        </div>
        
        <h3>🎈 Items Waiting for You</h3>
        ${cartItems.map(item => `
          <div class="cart-item">
            <strong>${item.name}</strong><br>
            ${item.quantity > 1 ? `Quantity: ${item.quantity} | ` : ''}Price: $${item.price}
          </div>
        `).join('')}
        
        <p style="text-align: center; margin: 30px 0;">
          <a href="#" class="btn">Complete Your Booking</a>
        </p>
        
        <div class="alert alert-info">
          <strong>🚀 Book Now and Get:</strong><br>
          ✅ Guaranteed availability for your event date<br>
          ✅ Professional setup and delivery<br>
          ✅ Full insurance coverage
        </div>
        
        <p>Questions? Just reply to this email or give us a call!</p>
        
        <p>Best regards,<br>The JumpCSRA Team</p>
      </div>
      <div class="footer">
        <p>JumpCSRA Party Rentals | Making memories one bounce at a time</p>
        <p>📧 jumpcsra@gmail.com | 📞 (Your Phone Number)</p>
      </div>
    </div>
  `,

  // Deposit reminder
  depositReminder: ({ customerName, bookingID, remainingAmount, eventDate }) => `
    ${baseStyle}
    <div class="container">
      <div class="header">
        <h1>💰 Deposit Reminder</h1>
      </div>
      <div class="content">
        <h2>Hi ${customerName}!</h2>
        <p>This is a friendly reminder about the remaining balance for your upcoming event.</p>
        
        <div class="alert alert-warning">
          <strong>Booking #${bookingID}</strong><br>
          Event Date: <strong>${eventDate}</strong><br>
          Remaining Balance: <strong>$${remainingAmount}</strong>
        </div>
        
        <h3>💳 Complete Your Payment</h3>
        <p>To ensure everything is ready for your event, please complete your payment at your earliest convenience.</p>
        
        <p style="text-align: center; margin: 30px 0;">
          <a href="#" class="btn">Pay Remaining Balance</a>
        </p>
        
        <div class="alert alert-info">
          <strong>📅 Important:</strong><br>
          Full payment is required at least 48 hours before your event to guarantee delivery and setup.
        </div>
        
        <p>If you have any questions or need to discuss payment options, please don't hesitate to contact us!</p>
        
        <p>Best regards,<br>The JumpCSRA Team</p>
      </div>
      <div class="footer">
        <p>JumpCSRA Party Rentals | Making memories one bounce at a time</p>
        <p>📧 jumpcsra@gmail.com | 📞 (Your Phone Number)</p>
      </div>
    </div>
  `,

  // Event confirmation (2 days before)
  eventConfirmation: ({ customerName, bookingID, eventDate, bookingDetails }) => `
    ${baseStyle}
    <div class="container">
      <div class="header">
        <h1>🎉 Event Confirmation</h1>
      </div>
      <div class="content">
        <h2>Hi ${customerName}!</h2>
        <p>Your party is almost here! We're excited to help make your event amazing.</p>
        
        <div class="alert alert-info">
          <strong>📅 Event Details</strong><br>
          Booking #${bookingID}<br>
          Date: <strong>${eventDate}</strong><br>
          ${bookingDetails?.deliveryTime ? `Delivery Time: ${bookingDetails.deliveryTime}<br>` : ''}
          ${bookingDetails?.address ? `Address: ${bookingDetails.address}` : ''}
        </div>
        
        <h3>🚛 What to Expect</h3>
        <ul>
          <li>✅ Our team will arrive during your scheduled delivery window</li>
          <li>✅ We'll handle all setup and safety inspections</li>
          <li>✅ Equipment will be picked up after your event</li>
          <li>✅ Our staff will ensure everything is safe and ready to use</li>
        </ul>
        
        <div class="alert alert-warning">
          <strong>📋 Please Prepare:</strong><br>
          ✅ Clear access path to setup area<br>
          ✅ Remove any obstacles or decorations<br>
          ✅ Ensure someone is available during delivery window<br>
          ✅ Have a water source nearby if renting water slides
        </div>
        
        <p style="text-align: center; margin: 30px 0;">
          <a href="#" class="btn">Contact Us</a>
        </p>
        
        <p>If you need to make any last-minute changes or have questions, please call us immediately!</p>
        
        <p>Best regards,<br>The JumpCSRA Team</p>
      </div>
      <div class="footer">
        <p>JumpCSRA Party Rentals | Making memories one bounce at a time</p>
        <p>📧 jumpcsra@gmail.com | 📞 (Your Phone Number)</p>
      </div>
    </div>
  `,

  // Post-event thank you
  postEventThanks: ({ customerName, bookingID, eventDate }) => `
    ${baseStyle}
    <div class="container">
      <div class="header">
        <h1>🙏 Thank You!</h1>
      </div>
      <div class="content">
        <h2>Hi ${customerName}!</h2>
        <p>We hope your event yesterday was absolutely amazing! It was our pleasure to be part of your special day.</p>
        
        <div class="alert alert-info">
          <strong>📅 Your Event</strong><br>
          Booking #${bookingID}<br>
          Event Date: ${eventDate}
        </div>
        
        <h3>⭐ We'd Love Your Feedback!</h3>
        <p>Your experience matters to us. Would you mind sharing how everything went?</p>
        
        <p style="text-align: center; margin: 30px 0;">
          <a href="#" class="btn">Leave a Review</a>
        </p>
        
        <h3>📸 Share Your Photos!</h3>
        <p>We love seeing the smiles and fun from your events! Tag us on social media or send us your favorite photos.</p>
        
        <div class="alert alert-warning">
          <strong>🎯 Planning Another Event?</strong><br>
          As a valued customer, you'll receive exclusive offers and early access to new equipment!
        </div>
        
        <p>Thank you for choosing JumpCSRA Party Rentals. We look forward to helping with your next celebration!</p>
        
        <p>Best regards,<br>The JumpCSRA Team</p>
      </div>
      <div class="footer">
        <p>JumpCSRA Party Rentals | Making memories one bounce at a time</p>
        <p>📧 jumpcsra@gmail.com | 📞 (Your Phone Number)</p>
        <p>Follow us: Facebook | Instagram | Twitter</p>
      </div>
    </div>
  `,

  // Rebooking reminder (9 months later)
  rebookingReminder: ({ customerName, eventDate }) => `
    ${baseStyle}
    <div class="container">
      <div class="header">
        <h1>🎈 Ready to Party Again?</h1>
      </div>
      <div class="content">
        <h2>Hi ${customerName}!</h2>
        <p>It's been a while since your last amazing party with us (${eventDate}), and we miss you! Are you ready to create more unforgettable memories?</p>
        
        <div class="alert alert-warning">
          <strong>🎯 SPECIAL WELCOME BACK OFFER</strong><br>
          Get <strong>15% OFF</strong> your next booking as our returning customer!<br>
          Use code: <strong>WELCOME-BACK</strong>
        </div>
        
        <h3>🆕 What's New Since Your Last Visit</h3>
        <ul>
          <li>🎢 New inflatable slides and obstacle courses</li>
          <li>🎪 Additional party packages and themes</li>
          <li>🏆 Enhanced safety protocols and equipment</li>
          <li>💫 Even better customer service</li>
        </ul>
        
        <p style="text-align: center; margin: 30px 0;">
          <a href="#" class="btn">Book Your Next Party</a>
        </p>
        
        <h3>🗓️ Popular Upcoming Seasons</h3>
        <div class="alert alert-info">
          <strong>📅 Book Early and Save!</strong><br>
          Spring and summer dates fill up fast. Reserve your preferred date now and lock in the best pricing!
        </div>
        
        <p>We can't wait to help make your next event even more spectacular than the last!</p>
        
        <p>Best regards,<br>The JumpCSRA Team</p>
      </div>
      <div class="footer">
        <p>JumpCSRA Party Rentals | Making memories one bounce at a time</p>
        <p>📧 jumpcsra@gmail.com | 📞 (Your Phone Number)</p>
        <p>Offer expires in 30 days. Cannot be combined with other offers.</p>
      </div>
    </div>
  `
};

module.exports = emailTemplates;