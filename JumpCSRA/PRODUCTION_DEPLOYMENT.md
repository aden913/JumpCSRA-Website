# Production Server Setup Guide

## Problem Fixed
The SSR server was trying to route static assets (JS, CSS, images) through React Router instead of serving them as static files, causing 404 errors.

## Solution
Created a custom Express server ([server.ts](server.ts)) that properly serves static assets before routing requests to React Router.

## Deployment Steps for Production Server (170.187.145.7)

### Your Server Structure
```
/var/www/jumpcsra/JumpCSRA/     # Source code (where you develop)
/var/www/jumpcsra-ssr/          # Production SSR server (where it runs)
  ├── build/                    # Built files
  ├── node_modules/
  ├── package.json
  └── ssr-server.js             # Current server (replace with server.ts)
```

### 1. Copy New Server File
```bash
# Copy the new server.ts from your local machine to the server
# OR manually copy the contents of server.ts to /var/www/jumpcsra-ssr/server.ts
scp server.ts aden@170.187.145.7:/var/www/jumpcsra-ssr/server.ts
```

### 2. Update package.json in SSR Directory
Update `/var/www/jumpcsra-ssr/package.json` to include these dependencies and scripts:

```json
{
  "type": "module",
  "scripts": {
    "start": "node --loader tsx server.ts"
  },
  "dependencies": {
    "@react-router/express": "^7.7.1",
    "@react-router/node": "^7.7.1",
    "@react-router/serve": "^7.7.1",
    "express": "^4.21.2",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-router": "^7.7.1"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "tsx": "^4.19.2"
  }
}
```

### 3. Install Dependencies
```bash
cd /var/www/jumpcsra-ssr
npm install
```

This will install:
- `express` - Web server framework
- `@react-router/express` - Express adapter for React Router
- `@types/express` - TypeScript types for Express
- `tsx` - TypeScript execution engine

### 4. Rebuild Application from Source
```bash
cd /var/www/jumpcsra/JumpCSRA
npm run build

# Copy the build to SSR directory
rm -rf /var/www/jumpcsra-ssr/build
cp -r build /var/www/jumpcsra-ssr/
```

### 5. Update PM2 Configuration
The start command has changed from:
```bash
# OLD (using react-router-serve)
react-router-serve ./build/server/index.js

# NEW (using custom Express server)
node --loader tsx server.ts
```

Update your PM2 ecosystem file or restart command:

```bash
# Stop existing process
pm2 stop ssr-server

# Delete old process
pm2 delete ssr-server

# Start with new configuration
pm2 start server.ts --name ssr-server --node-args="--loader tsx" --env production

# Save PM2 configuration
pm2 save
```

### 4. Alternative: Update existing PM2 process
If you have an ecosystem.config.js file, update it:

```javascript
module.exports = {
  apps: [{
    name: 'ssr-server',
    script: 'server.ts',
    node_args: '--loader tsx',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

Then reload:
```bash
pm2 reload ecosystem.config.js --env production
pm2 save
```

## What Changed

### Before (react-router-serve):
- Used built-in React Router CLI server
- Didn't properly handle static file serving in production
- All requests went through React Router, including assets

### After (Custom Express Server):
- Express handles static files first:
  - `/assets/*` → served from `build/client/assets/` (1 year cache)
  - Other files → served from `build/client/` (1 hour cache)
  - Public files → served from `public/` (dev mode only)
- Only non-static requests go to React Router
- Proper proxy trust for nginx reverse proxy

## Verification

After deployment, check:
1. No "No route matches URL" errors for `/assets/*`
2. No ERR_CONNECTION_RESET or ERR_ABORTED errors
3. Static files load with proper status codes (200 OK)
4. Check server logs: `pm2 logs ssr-server`

## Files Modified
- [server.ts](server.ts) - New custom Express server
- [package.json](package.json) - Updated dependencies and start script
- [root.tsx](app/root.tsx) - Added action handler and apple touch icons

## Nginx Configuration (verify this is set)
Your nginx should proxy to the Express server:

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```
