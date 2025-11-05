# Email Scheduler System Guide

## Overview
The Cloud Functions now include a comprehensive email scheduler system that checks the database every 6 hours for emails that need to be sent. This replaces the unreliable frontend setTimeout approach.

## How It Works

### 1. Scheduled Function
- **Function:** `processScheduledEmails`
- **Schedule:** Every 6 hours (`0 */6 * * *`)
- **Timezone:** America/New_York (EST/EDT)
- **Purpose:** Checks database for pending emails and sends them automatically

### 2. Email Types Processed
1. **Cart Abandonment** - 24 hours after cart creation
2. **Deposit Reminders** - 7 days before event
3. **Event Confirmations** - 3 days before event
4. **Post-Event Thanks** - 1 day after event
5. **Rebooking Reminders** - 9 months after event

### 3. Email Tracking
- Emails are tracked in `emailsSent/{emailType}_{bookingId}` to prevent duplicates
- Each sent email records `sentAt` timestamp and email `type`
- System checks if email was already sent before sending again

## Testing Mode

### Enable Testing Mode
Set environment variable in Firebase Functions:
```bash
firebase functions:config:set email.testing_mode="true"
```

### Testing Mode Effects
- Cart Abandonment: 24 hours → 1 minute
- Deposit Reminder: 7 days → 2 minutes  
- Event Confirmation: 3 days → 3 minutes
- Post-Event Thanks: 1 day → 4 minutes
- Rebooking Reminder: 9 months → 5 minutes

### Deploy with Testing Mode
```bash
firebase deploy --only functions
```

### Check Current Config
```bash
firebase functions:config:get
```

## Manual Testing

### 1. Create Test Data
```javascript
// Add to Firebase Realtime Database under 'carts'
{
  "user123": {
    "cartItems": [{"name": "Princess Castle", "price": 150}],
    "cartValue": 150,
    "customerEmail": "test@example.com",
    "customerName": "Test Customer",
    "lastUpdated": 1640995200000 // Old timestamp
  }
}
```

### 2. Create Test Booking
```javascript
// Add to Firebase Realtime Database under 'bookings'
{
  "booking_user123_1640995200": {
    "customerEmail": "test@example.com", 
    "customerName": "Test Customer",
    "eventDate": "2024-12-31",
    "remainingBalance": 75,
    "status": "confirmed",
    "deliveryAddress": "123 Test St",
    "deliveryTime": "10:00 AM"
  }
}
```

### 3. Trigger Manually (for immediate testing)
```bash
# Call the function directly
firebase functions:shell
> processScheduledEmails()
```

## Production Usage

### Disable Testing Mode
```bash
firebase functions:config:unset email.testing_mode
firebase deploy --only functions
```

### Monitor Email Sending
Check Cloud Functions logs:
```bash
firebase functions:log --only processScheduledEmails
```

### Email Categories in SendGrid
- `cart-abandonment`, `marketing`
- `deposit-reminder`, `transactional`
- `event-confirmation`, `transactional`
- `post-event`, `marketing`
- `rebooking-reminder`, `marketing`

## Database Schema

### Email Tracking Structure
```
emailsSent/
  ├── cartAbandonment_user123_1640995200000/
  │   ├── sentAt: 1641081600000
  │   └── type: "cart-abandonment"
  ├── depositReminder_booking123/
  │   ├── sentAt: 1641168000000
  │   └── type: "deposit-reminder"
  └── eventConfirmation_booking123/
      ├── sentAt: 1641254400000
      └── type: "event-confirmation"
```

### Required Booking Data
```javascript
{
  "bookingId": {
    "customerEmail": "required",
    "customerName": "required", 
    "eventDate": "required (YYYY-MM-DD)",
    "status": "pending|confirmed|completed",
    "remainingBalance": 0, // for deposit reminders
    "deliveryAddress": "optional",
    "deliveryTime": "optional"
  }
}
```

### Required Cart Data
```javascript
{
  "userId": {
    "cartItems": [], // required
    "cartValue": 0, // required
    "customerEmail": "required",
    "customerName": "required",
    "lastUpdated": 1641081600000 // timestamp
  }
}
```

## Implementation Status

✅ **Completed:**
- Scheduled Cloud Function (`processScheduledEmails`)
- Email tracking system (prevents duplicates)
- HTML email templates for all types
- Testing mode environment variable
- Comprehensive logging

🔄 **In Progress:**
- Testing mode configuration setup

⏳ **Pending:**
- Replace frontend setTimeout with database queue
- Update checkout.tsx to use new system
- Production deployment and testing

## Next Steps

1. **Configure Testing Mode:** Set environment variable
2. **Deploy Functions:** `firebase deploy --only functions`
3. **Test Email Flow:** Create test data and verify emails
4. **Update Frontend:** Remove setTimeout, use database queue
5. **Production Deploy:** Disable testing mode and deploy

## Troubleshooting

### Common Issues
1. **Emails not sending:** Check SendGrid API key and Firebase config
2. **Duplicate emails:** Verify email tracking in `emailsSent` collection
3. **Wrong timing:** Check testing mode environment variable
4. **Missing data:** Verify booking/cart structure matches requirements

### Debug Commands
```bash
# Check function logs
firebase functions:log --only processScheduledEmails

# Test specific email type
firebase functions:shell
> processCartAbandonmentEmails()

# Check email tracking
# Look at Firebase Database under 'emailsSent'
```