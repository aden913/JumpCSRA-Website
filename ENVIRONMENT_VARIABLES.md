# Required Environment Variables

## 🚨 CRITICAL SECURITY ACTION REQUIRED

**The Firebase service account key file (`pppro-b060e-firebase-adminsdk-fbsvc-7639e39990.json`) was previously exposed in this repository and has been deleted.**

**YOU MUST IMMEDIATELY:**
1. Go to Firebase Console → Project Settings → Service Accounts
2. Delete/revoke the exposed service account key
3. Generate a new service account key
4. Store it securely on your server (NOT in git repository)
5. Update Firebase Functions configuration to use the new key

---

## Server Environment Variables (Root `.env`)

Create a `.env` file in the project root with:

```bash
# SendGrid Email Service
SENDGRID_API_KEY=your_sendgrid_api_key_here

# PayPal Configuration
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret

# Email Service Backend
EMAIL_SERVICE_URL=http://170.187.145.7:3001
EMAIL_API_KEY=your_email_api_key_here
```

---

## Client Environment Variables (JumpCSRA/.env)

Create a `.env` file in the `JumpCSRA/` directory with:

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyDs39ycP3-tg21iBpWul8cp6hoqoKhI2cE
VITE_FIREBASE_AUTH_DOMAIN=pppro-b060e.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://pppro-b060e.firebaseio.com
VITE_FIREBASE_PROJECT_ID=pppro-b060e
VITE_FIREBASE_STORAGE_BUCKET=pppro-b060e.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1038742327556
VITE_FIREBASE_APP_ID=1:1038742327556:web:f85d3d48c3d04ebdcb9f85

# Google Maps API
VITE_GOOGLE_MAPS_API_KEY=AIzaSyB4F9liX4qhB8-lAsNSbaNadZ8dsxjE2Ao

# Email Service (client-side)
VITE_EMAIL_SERVICE_URL=http://170.187.145.7:3001
VITE_EMAIL_API_KEY=your_email_api_key_here
```

**Note:** Firebase client API keys (VITE_FIREBASE_*) are public by design and safe to expose. Security is enforced through Firebase Security Rules.

---

## PM2 Deployment

The project is configured for PM2 process management. Use:

```bash
# Install dependencies
cd JumpCSRA
npm install

# Build the application
npm run build

# Start with PM2 (from project root)
cd ..
pm2 start ecosystem.config.js

# Monitor
pm2 logs jumpcsra-server
pm2 status

# Restart after changes
pm2 restart jumpcsra-server
```

---

## Build Requirements

- Node.js 18+ (20+ recommended)
- npm 9+
- Port 3000 available (or set PORT in ecosystem.config.js)

---

## Security Checklist

- ✅ All hardcoded API keys migrated to environment variables
- ✅ Test/scaffold files removed from repository
- ✅ XSS vulnerability in profile.tsx patched
- ✅ `functions/` directory added to .gitignore
- ✅ `.env` files are gitignored
- 🚨 **Firebase service account key must be rotated (see top of document)**
- ✅ Email service API key secured
- ✅ PayPal credentials secured
