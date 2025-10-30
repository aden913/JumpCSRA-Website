# JumpCSRA Email Server

A secure backend email automation server for JumpCSRA Party Rentals, handling all automated email scenarios including cart reminders, booking confirmations, and customer retention campaigns.

## 🚀 Features

- **Automated Email Scenarios**:
  - Account creation welcome emails
  - Shopping cart abandonment reminders (24 hours)
  - Order confirmation emails (after payment)
  - Deposit reminder emails (7 days after partial payment)
  - Event confirmation emails (2 days before event)
  - Post-event thank you emails (1 day after event)
  - Rebooking reminder emails (9 months after event)

- **Security Features**:
  - API key authentication
  - Rate limiting
  - Input validation
  - CORS protection
  - Helmet security headers

- **Email Management**:
  - Email scheduling and automation
  - Professional HTML templates
  - SendGrid integration
  - Email logging and tracking
  - Cleanup of old logs

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- SendGrid account and API key
- Firebase project with Firestore enabled
- Firebase service account credentials

## 🛠️ Installation Instructions

### 1. Install Dependencies

```bash
cd serverFiles
npm install
```

### 2. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit the `.env` file with your actual values:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# SendGrid Configuration (REQUIRED)
SENDGRID_API_KEY=your_actual_sendgrid_api_key
SENDGRID_FROM_EMAIL=jumpcsra@gmail.com
SENDGRID_FROM_NAME=JumpCSRA Party Rentals

# Firebase Configuration (REQUIRED)
FIREBASE_PROJECT_ID=pppro-b060e
FIREBASE_CLIENT_EMAIL=your_firebase_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"

# Security (REQUIRED)
JWT_SECRET=your_super_secure_jwt_secret_at_least_32_characters_long
API_KEY=your_secure_api_key_for_frontend_authentication

# Email Timing (Optional - defaults provided)
CART_REMINDER_DELAY_HOURS=24
DEPOSIT_REMINDER_DELAY_DAYS=7
EVENT_CONFIRMATION_DAYS_BEFORE=2
POST_EVENT_THANKS_DAYS_AFTER=1
REBOOKING_REMINDER_MONTHS_AFTER=9
```

### 3. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (pppro-b060e)
3. Go to Project Settings > Service Accounts
4. Click "Generate new private key"
5. Save the JSON file and extract the required values for your `.env` file

### 4. SendGrid Setup

1. Create a [SendGrid account](https://sendgrid.com/)
2. Generate an API key with full access
3. Verify your sender email (jumpcsra@gmail.com)
4. Add the API key to your `.env` file

### 5. Start the Server

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## 🔧 Frontend Integration

### API Endpoints

All endpoints require an API key in the header: `X-API-Key: your_api_key`

#### Account Creation
```javascript
POST /api/email/account-creation
{
  "email": "customer@example.com",
  "name": "Customer Name",
  "userID": "user123"
}
```

#### Order Confirmation
```javascript
POST /api/email/order-confirmation
{
  "orderID": "ORDER123",
  "customerEmail": "customer@example.com",
  "customerName": "Customer Name",
  "totalAmount": 199.99,
  "eventDate": "2024-06-15",
  "items": [...]
}
```

#### Cart Abandonment Reminder
```javascript
POST /api/email/cart-reminder
{
  "userID": "user123",
  "cartItems": [...],
  "cartValue": 150.00,
  "customerEmail": "customer@example.com",
  "customerName": "Customer Name"
}
```

#### Schedule Deposit Reminder
```javascript
POST /api/email/deposit-reminder
{
  "bookingID": "BOOKING123",
  "customerEmail": "customer@example.com",
  "customerName": "Customer Name",
  "eventDate": "2024-06-15T10:00:00Z",
  "remainingAmount": 100.00
}
```

#### Schedule Event Confirmation
```javascript
POST /api/email/event-confirmation
{
  "bookingID": "BOOKING123",
  "customerEmail": "customer@example.com",
  "customerName": "Customer Name",
  "eventDate": "2024-06-15T10:00:00Z",
  "bookingDetails": {...}
}
```

#### Schedule Post-Event Thanks
```javascript
POST /api/email/post-event-thanks
{
  "bookingID": "BOOKING123",
  "customerEmail": "customer@example.com",
  "customerName": "Customer Name",
  "eventDate": "2024-06-15T10:00:00Z",
  "bookingDetails": {...}
}
```

#### Schedule Rebooking Reminder
```javascript
POST /api/email/rebooking-reminder
{
  "bookingID": "BOOKING123",
  "customerEmail": "customer@example.com",
  "customerName": "Customer Name",
  "eventDate": "2024-06-15T10:00:00Z",
  "bookingDetails": {...}
}
```

### Frontend Implementation Example

```javascript
// Email service utility for frontend
class EmailService {
  constructor(apiKey, baseURL) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  async sendEmail(endpoint, data) {
    const response = await fetch(\`\${this.baseURL}/api/email/\${endpoint}\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(\`Email service error: \${response.statusText}\`);
    }

    return response.json();
  }

  // Account creation
  async sendAccountCreation(email, name, userID) {
    return this.sendEmail('account-creation', { email, name, userID });
  }

  // Order confirmation
  async sendOrderConfirmation(orderData) {
    return this.sendEmail('order-confirmation', orderData);
  }

  // Cart reminder
  async scheduleCartReminder(cartData) {
    return this.sendEmail('cart-reminder', cartData);
  }

  // Other email types...
}

// Usage in your checkout process
const emailService = new EmailService('your-api-key', 'http://localhost:3001');

// After successful payment
await emailService.sendOrderConfirmation({
  orderID: 'ORDER123',
  customerEmail: user.email,
  customerName: user.name,
  totalAmount: 199.99,
  eventDate: '2024-06-15',
  items: cart.items
});
```

## 🔍 Monitoring and Logs

The server creates detailed logs in the `logs/` directory:
- `combined.log` - All log entries
- `error.log` - Error messages only

Email activities are tracked in Firestore:
- `emailLogs` collection - All sent emails
- `scheduledEmails` collection - Pending/sent scheduled emails

## 🛡️ Security Considerations

1. **API Key Protection**: Store API key securely, never expose in client-side code
2. **CORS Configuration**: Update CORS origins for production domains
3. **Rate Limiting**: Configured to prevent abuse
4. **Input Validation**: All inputs are validated and sanitized
5. **Firebase Security**: Use service account with minimal required permissions

## 📊 Database Schema

### Email Logs Collection
```javascript
{
  "id": "unique-id",
  "type": "order_confirmation",
  "recipientEmail": "customer@example.com",
  "recipientName": "Customer Name",
  "orderID": "ORDER123",
  "result": {...},
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Scheduled Emails Collection
```javascript
{
  "emailID": "unique-id",
  "type": "cart_reminder",
  "recipientEmail": "customer@example.com",
  "recipientName": "Customer Name",
  "userID": "user123",
  "scheduledTime": "2024-01-16T10:30:00Z",
  "status": "pending",
  "data": {...},
  "createdAt": "2024-01-15T10:30:00Z"
}
```

## 🚀 Deployment

### Option 1: VPS/Dedicated Server
1. Install Node.js and npm
2. Clone the serverFiles directory
3. Install dependencies: `npm install`
4. Configure environment variables
5. Use PM2 for process management: `pm2 start server.js`
6. Set up reverse proxy with Nginx

### Option 2: Cloud Platforms
- **Heroku**: Add buildpack for Node.js
- **AWS EC2**: Use Amazon Linux with Node.js
- **Google Cloud Platform**: Use Compute Engine or Cloud Run
- **DigitalOcean**: App Platform or Droplet

## 🔧 Customization

### Adding New Email Types
1. Add template in `templates/emailTemplates.js`
2. Add route in `routes/emailRoutes.js`
3. Add service method in `services/emailService.js`
4. Update scheduler if needed in `services/schedulerService.js`

### Modifying Email Templates
Edit the HTML templates in `templates/emailTemplates.js`. Each template includes responsive design and consistent branding.

## 📞 Support

For issues or questions:
1. Check the logs in the `logs/` directory
2. Verify environment variables are set correctly
3. Ensure Firebase and SendGrid credentials are valid
4. Check network connectivity and firewall settings