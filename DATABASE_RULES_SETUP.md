# Firebase Database Rules Setup

## ❌ Current Issue
The email testing component is getting **PERMISSION_DENIED** errors because Firebase Database rules are blocking writes.

## 🔧 Fix Database Rules

### 1. Go to Firebase Console
1. Navigate to: https://console.firebase.google.com/project/pppro-b060e/database
2. Click on **"Realtime Database"** (not Firestore)
3. Click on **"Rules"** tab

### 2. Update Database Rules
Replace the existing rules with:

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null",
    
    "carts": {
      "$userId": {
        ".read": "auth != null && auth.uid == $userId",
        ".write": "auth != null && auth.uid == $userId"
      }
    },
    
    "bookings": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    
    "userWallets": {
      "$userId": {
        ".read": "auth != null && auth.uid == $userId", 
        ".write": "auth != null && auth.uid == $userId"
      }
    },
    
    "userPaymentInfo": {
      "$userId": {
        ".read": "auth != null && auth.uid == $userId",
        ".write": "auth != null && auth.uid == $userId" 
      }
    },
    
    "emailsSent": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    
    "inflateables": {
      ".read": "auth != null"
    },
    
    "giftCards": {
      ".read": "auth != null"  
    }
  }
}
```

### 3. Click "Publish"

## ✅ Alternative: Use Manual Email Triggers

If you can't update database rules right now, you can still test emails using the **Manual Email Triggers** in the testing panel:

1. **🚀 Process All Scheduled Emails Now** - Checks existing data and sends emails immediately
2. **⚡ Check All Email Types** - Runs the scheduler function manually

These don't require database writes and work with existing data.

## 🧪 Testing Options

### Option A: With Database Rules Fixed
- Create test carts and bookings through the UI
- Wait for scheduler to run (every 2 minutes in testing mode)
- Emails will be sent based on timing

### Option B: Manual Triggers (Works Now)
- Use "Process All Scheduled Emails Now" button
- This triggers the scheduler immediately
- Works with any existing cart/booking data

### Option C: Direct Cloud Function Testing
```bash
# In Firebase Functions shell:
firebase functions:shell
> triggerTestEmail({ emailType: 'process-all-scheduled' })
```

## 📊 Monitor Results
```bash
# Watch Cloud Functions logs:
firebase functions:log --only processScheduledEmails
```

## 🎯 Quick Test Without Database Writes

1. **Sign in** to your website
2. **Add items to cart** (but don't checkout)
3. **Use testing panel**: Click "🚀 Process All Scheduled Emails Now"
4. **Check your email** - should receive cart abandonment email if cart is old enough

The scheduler will check your actual cart data and send emails based on the timing rules!