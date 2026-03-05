# Production Environment Variable Fix

## The Problem

You're seeing `Firebase: Error (auth/invalid-api-key)` in production because **Vite bakes environment variables into the build at BUILD TIME**, not runtime.

## Two Scenarios:

### Scenario A: Building on Production Server (Your Setup with PM2)

**Good news:** Your ecosystem.config.cjs already has all the env vars! You just need to build **on the server** where those variables exist.

```bash
# On your production server at /var/www/JumpCSRA-Website/JumpCSRA/
cd /var/www/JumpCSRA-Website/JumpCSRA

# Since PM2's ecosystem.config.cjs defines the VITE_* variables,
# they're already in your server environment. Just build:
npm run build

# Restart PM2
pm2 restart ssr-server
```

**Why this works:**
- Your ecosystem.config.cjs sets `VITE_FIREBASE_API_KEY`, etc.
- These are available server-wide (not just to PM2)
- When you run `npm run build`, Vite reads them from `process.env`
- The client bundle is built with correct Firebase config

### Scenario B: Building Locally and Uploading

If you build on your local machine and upload the build folder, you need a local `.env.production` file:

```bash
# On your LOCAL machine at JumpCSRA/
cat > .env.production << 'EOF'
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain_here
# ... (all other vars)
EOF

# Build locally
npm run build

# Upload the build folder to server
# Then restart PM2
```

## The Root Cause Explained

## The Root Cause Explained

**Build Time vs Runtime:**
- **Build time** = when you run `npm run build` (Vite compiles your code)
- **Runtime** = when PM2 runs your SSR server

**The issue:**
- Client-side JavaScript needs Firebase config **baked into the bundle** at build time
- PM2's ecosystem.config.cjs provides env vars at runtime (too late for client code)
- BUT: Those env vars are available server-wide, not just to PM2 process

**The solution:**
- Build on your production server (where ecosystem.config.cjs env vars exist)
- Vite reads them from the environment during build
- Client bundle gets correct Firebase config
- PM2 then serves the correctly-built app

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

- **Build-time vs Runtime**: Client-side code needs variables at BUILD time, not runtime
- **PM2 ecosystem.config.cjs**: Sets variables for the entire server environment (not just PM2)
- **Where to build**: Always build on the server where your ecosystem.config.cjs exists
- **Rebuild Required**: Any env var change requires rebuilding the client bundle
- **Security**: Firebase client config is meant to be public in the client bundle (that's okay)
- **Server vs Client**: 
  - Server (SSR): Can use runtime env vars from PM2
  - Client (browser): Needs build-time env vars baked into JavaScript

## Questions?

**Q: Why not just use ecosystem.config.cjs env vars?**  
A: You ARE! But you need to build where they exist. PM2's env vars are available server-wide.

**Q: Do I need .env.production if I have ecosystem.config.cjs?**  
A: No! Just build on the server. The ecosystem env vars are already there.

**Q: Why does this work in development?**  
A: Dev mode uses Vite dev server which reads env vars in real-time. Production bundles them at build time.

The key takeaway: **Build on your production server where ecosystem.config.cjs env vars exist.**
