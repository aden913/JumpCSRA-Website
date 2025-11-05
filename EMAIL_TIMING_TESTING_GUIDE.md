# How Email Timing Actually Works & Testing Guide

## 🤔 Current Email System Analysis

### ❌ **Current Problem: Frontend-Only Timing**
The current email system has a **major flaw**:

```typescript
// This is unreliable for production!
setTimeout(() => {
  sendEmail(); // This won't survive page refreshes or browser closures
}, 24 * 60 * 60 * 1000); // 24 hours
```

**Problems**:
- ⚠️ **Doesn't persist**: If user refreshes page or closes browser, timer is lost
- ⚠️ **Browser dependent**: Only works while browser tab is open
- ⚠️ **Unreliable**: Not suitable for production email scheduling

### ✅ **What You Actually Need: Server-Side Scheduling**
For reliable email scheduling, you need:
1. **Database storage** of pending emails
2. **Server cron job** or scheduled task runner
3. **Queue system** that runs independently of user browser

## 🧪 **Testing Current System (Frontend Timing)**

Since we need to test what exists now, here's how to test the **frontend-based timing**:

### Method 1: Browser Console Testing (Recommended)

1. **Open your development site**: `npm run dev`
2. **Open browser console** (F12)
3. **Set your email**:
   ```javascript
   emailTester.setEmail('your-email@example.com');
   emailTester.setName('Your Name');
   ```

4. **Test individual emails with custom timing**:
   ```javascript
   // Test with 30-second delays
   emailTester.testCart(30);           // Cart abandonment (30s)
   emailTester.testDeposit(60);        // Deposit reminder (60s)
   emailTester.testConfirmation(90);   // Event confirmation (90s)
   emailTester.testThanks(120);        // Post-event thanks (120s)
   emailTester.testRebooking(150);     // Rebooking reminder (150s)
   ```

5. **Test all emails with staggered timing**:
   ```javascript
   emailTester.testAll(30); // Starts in 30s, then 30s intervals
   ```

### Method 2: Modify Timing in Code

Edit `cartAbandonmentTracker.ts` to change the 24-hour delay:

```typescript
// Find this line (around line 82):
setTimeout(() => {
  this.checkAndSendReminder(abandonmentData.userId);
}, 24 * 60 * 60 * 1000); // 24 hours

// Change to 30 seconds for testing:
}, 30 * 1000); // 30 seconds
```

### Method 3: Use the Visual Testing Component

The testing component in the bottom-right corner lets you:
- Set test email and name
- Click buttons to trigger emails with custom delays
- See real-time results

## 📅 **Testing Timeline Examples**

### Quick Test (30-second intervals):
```javascript
emailTester.testAll(30);
```
**Timeline**:
- **T+30s**: Cart abandonment email
- **T+60s**: Deposit reminder email  
- **T+90s**: Event confirmation email
- **T+120s**: Post-event thanks email
- **T+150s**: Rebooking reminder email

### Very Quick Test (10-second intervals):
```javascript
emailTester.testCart(10);
emailTester.testDeposit(20);
emailTester.testConfirmation(30);
emailTester.testThanks(40);
emailTester.testRebooking(50);
```

## 🔧 **Manual Timing Modification Steps**

### 1. Cart Abandonment (24 hours → 30 seconds)
**File**: `app/utils/cartAbandonmentTracker.ts`
**Line**: ~82
**Change**:
```typescript
// FROM:
}, 24 * 60 * 60 * 1000); // 24 hours

// TO:
}, 30 * 1000); // 30 seconds
```

### 2. Booking-Related Emails
**File**: `app/utils/emailTestingConfig.ts`
**Modify**:
```typescript
export const EMAIL_TEST_TIMING = {
  CART_ABANDONMENT: 0.5,      // 30 seconds (0.5 minutes)
  DEPOSIT_REMINDER: 1,        // 1 minute
  EVENT_CONFIRMATION: 1.5,    // 1.5 minutes
  POST_EVENT_THANKS: 2,       // 2 minutes
  REBOOKING_REMINDER: 2.5     // 2.5 minutes
};
```

## 🎯 **Step-by-Step Testing Process**

### **Step 1: Setup**
```bash
npm run dev
# Open browser to localhost:5173
# Open Developer Tools (F12)
```

### **Step 2: Configure Testing**
```javascript
// In browser console:
emailTester.setEmail('your-actual-email@gmail.com');
emailTester.setName('Your Name');
emailTester.config(); // Verify settings
```

### **Step 3: Test Server Health**
```javascript
emailTester.testHealth();
// Should show: "Email server health: HEALTHY"
```

### **Step 4: Test Account Creation (Immediate)**
```javascript
emailTester.testAccount();
// Should send immediately
```

### **Step 5: Test Scheduled Emails**
```javascript
// Option A: Test all at once (staggered)
emailTester.testAll(30); // Starts in 30s, 30s intervals

// Option B: Test individually with custom timing
emailTester.testCart(30);        // 30 seconds
emailTester.testDeposit(60);     // 1 minute
emailTester.testConfirmation(90); // 1.5 minutes
```

### **Step 6: Monitor Results**
- Watch browser console for timing updates
- Check your email inbox (including spam folder)
- Each email will show "✅ sent" or "❌ failed" in console

## ⚠️ **Important Testing Notes**

### **Browser Requirements**:
- ✅ **Keep browser tab open** during testing
- ✅ **Don't refresh page** or timers will reset
- ✅ **Watch console** for timing updates

### **Email Delivery**:
- 📧 **Check spam folder** - automated emails often go to spam
- 📧 **Use real email** addresses you can access
- 📧 **Wait for delays** - console will show when emails are sent

### **Server Dependencies**:
- 🌐 **Email server must be running** on `170.187.145.7:3001`
- 🌐 **CORS must allow** your development domain
- 🌐 **Network connectivity** required

## 🚀 **Advanced Testing Scenarios**

### **Test Cart Abandonment Flow**:
1. Add items to cart (in the app)
2. Wait for configured abandonment time
3. Email should be sent automatically

### **Test Booking Email Flow**:
1. Create a test booking
2. Trigger scheduled emails programmatically
3. Monitor timing and delivery

### **Test Error Handling**:
```javascript
// Test with invalid email server
emailTester.testHealth(); // Should show connection errors
```

## 🔧 **Recommended Production Solution**

For production, you should implement:

1. **Database Queue**: Store scheduled emails in database
2. **Server Cron Job**: Background process to check and send emails
3. **Retry Logic**: Handle failed email attempts
4. **Status Tracking**: Monitor email delivery status

**Example Architecture**:
```
Database Table: scheduled_emails
- id, user_id, email_type, scheduled_for, data, status

Cron Job (every minute):
- Check for emails where scheduled_for <= NOW()
- Send emails and update status
- Handle retries for failures
```

This would be much more reliable than frontend JavaScript timers.