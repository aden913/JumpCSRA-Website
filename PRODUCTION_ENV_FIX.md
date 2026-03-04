# Production Environment Variable Fix

## The Problem

You're seeing `Firebase: Error (auth/invalid-api-key)` in production because **Vite bakes environment variables into the build at BUILD TIME**, not runtime.

Your ecosystem.config.cjs sets environment variables when PM2 runs the app, but by then:
- The code is already built
- The variables aren't in the bundled JavaScript
- Firebase receives `undefined` for the API key

## The Solution

You need to have the environment variables available **when you build the app** on the server.

### Option 1: Set Environment Variables Before Building (RECOMMENDED)

On your production server, create a `.env.production` file or export the variables before building:

```bash
# On your production server at /var/www/JumpCSRA-Website/JumpCSRA/

# Create .env.production file
cat > .env.production << 'EOF'
VITE_FIREBASE_API_KEY=AIzaSyDs39ycP3-tg21iBpWul8cp6hoqoKhI2cE
VITE_FIREBASE_AUTH_DOMAIN=pppro-b060e.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://pppro-b060e-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=pppro-b060e
VITE_FIREBASE_STORAGE_BUCKET=pppro-b060e.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=819237875595
VITE_FIREBASE_APP_ID=1:819237875595:web:1ee4ce4c815c1b4d2f498e
VITE_GOOGLE_MAPS_API_KEY=AIzaSyC2sy437445zrOR1YMXuMjiSrH3ZY8D0uo
VITE_EMAIL_SERVICE_URL=http://173.230.132.127:3001
VITE_EMAIL_API_KEY=your_email_api_key_here
EOF
```

Then rebuild:
```bash
cd /var/www/JumpCSRA-Website/JumpCSRA
npm run build
pm2 restart ssr-server
```

### Option 2: Export Variables in Your Build Script

Update your build/deployment script to export variables first:

```bash
#!/bin/bash
cd /var/www/JumpCSRA-Website/JumpCSRA

# Export environment variables
export VITE_FIREBASE_API_KEY=AIzaSyDs39ycP3-tg21iBpWul8cp6hoqoKhI2cE
export VITE_FIREBASE_AUTH_DOMAIN=pppro-b060e.firebaseapp.com
export VITE_FIREBASE_DATABASE_URL=https://pppro-b060e-default-rtdb.firebaseio.com
export VITE_FIREBASE_PROJECT_ID=pppro-b060e
export VITE_FIREBASE_STORAGE_BUCKET=pppro-b060e.firebasestorage.app
export VITE_FIREBASE_MESSAGING_SENDER_ID=819237875595
export VITE_FIREBASE_APP_ID=1:819237875595:web:1ee4ce4c815c1b4d2f498e
export VITE_GOOGLE_MAPS_API_KEY=AIzaSyC2sy437445zrOR1YMXuMjiSrH3ZY8D0uo
export VITE_EMAIL_SERVICE_URL=http://173.230.132.127:3001
export VITE_EMAIL_API_KEY=your_email_api_key_here

# Build with variables available
npm run build

# Restart the server
pm2 restart ssr-server
```

### Option 3: Use the Vite define Plugin (Already Done)

I've updated `vite.config.ts` to use the `define` option which will read from `process.env` during build. This means if you export the variables before building, they'll be included.

## Verifying the Fix

After rebuilding with environment variables available:

1. Open your production site
2. Open browser DevTools Console
3. Look for the Firebase Configuration Debug logs:
   ```
   🔥 Firebase Configuration Debug
   Environment Context: { isServer: false, isClient: true, ... }
   [Client] FIREBASE_API_KEY: AIzaSyDs39ycP... (39 chars)
   ✅ All Firebase config fields present
   ✅ Firebase app initialized successfully
   ```

4. If you see `❌ MISSING` for any field, the environment variables weren't available during build

## Important Notes

- **Build-time vs Runtime**: Vite variables are build-time only
- **VITE_ Prefix**: Client-side variables must start with `VITE_`
- **Rebuild Required**: Any env var change requires a rebuild
- **Security**: These vars are public in the client bundle (that's okay for Firebase config)
- **Server vs Client**: 
  - Server (SSR): Can use runtime env vars from ecosystem.config.cjs
  - Client (browser): Needs build-time env vars

## Debugging

Added comprehensive logging to `FirebaseConfig.tsx`:
- Shows environment context (client/server, dev/prod)
- Lists available environment variables
- Shows which config values are found vs missing
- Logs initialization success/failure
- Provides clear error messages

Check the browser console for detailed debug output!

## Questions?

The key takeaway: **Environment variables must be available when running `npm run build`**, not just when running the app with PM2.
