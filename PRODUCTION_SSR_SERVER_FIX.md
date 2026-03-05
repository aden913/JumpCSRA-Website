# Production SSR Server - Manifest 400 Error Fix

## The Issue

You're seeing this error in production:
```
GET https://destinations-julia-loan-banners.trycloudflare.com/__manifest?p=%2Fhome&version=5e6f019a 400 (Bad Request)
No routes matched location "/home"
```

This happens because:
1. React Router v7 uses a `__manifest` endpoint for client-side navigation
2. Your SSR server (`/var/www/jumpcsra-ssr/ssr-server.js`) doesn't handle this endpoint
3. The Cloudflare tunnel forwards the request, but gets a 400 error
4. Without the manifest, client-side routing fails

## The Solution - Update SSR Server

Your SSR server needs to be updated to handle React Router v7's manifest endpoint. Here's the corrected server code:

### Option A: Complete SSR Server (Recommended)

Create or update `/var/www/jumpcsra-ssr/ssr-server.js`:

```javascript
import { createRequestHandler } from "@react-router/express";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const BUILD_DIR = process.env.BUILD_DIR || path.join(__dirname, "../JumpCSRA-Website/JumpCSRA/build");

console.log(`🚀 Starting SSR Server`);
console.log(`📁 Build directory: ${BUILD_DIR}`);
console.log(`🌐 Port: ${PORT}`);

// Serve static files from the build/client directory
app.use(express.static(path.join(BUILD_DIR, "client"), {
  maxAge: "1y",
  immutable: true,
}));

// IMPORTANT: Handle the __manifest endpoint for React Router v7
// This endpoint is required for client-side navigation to work properly
app.get("/__manifest", async (req, res) => {
  try {
    const manifestPath = path.join(BUILD_DIR, "client", ".react-router", "manifest.json");
    res.sendFile(manifestPath);
  } catch (error) {
    console.error("Error serving manifest:", error);
    res.status(404).json({ error: "Manifest not found" });
  }
});

// Handle SSR requests using React Router's request handler
app.all(
  "*",
  createRequestHandler({
    build: await import(path.join(BUILD_DIR, "server", "index.js")),
    mode: process.env.NODE_ENV || "production",
  })
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ SSR Server running on http://0.0.0.0:${PORT}`);
  console.log(`🔗 Build directory: ${BUILD_DIR}`);
});
```

### Option B: Minimal Server (If you have a custom setup)

If you already have a custom SSR server, just add this before your main request handler:

```javascript
// Add this BEFORE your main request handler
app.get("/__manifest", async (req, res) => {
  try {
    const manifestPath = path.join(BUILD_DIR, "client", ".react-router", "manifest.json");
    res.sendFile(manifestPath);
  } catch (error) {
    console.error("Error serving manifest:", error);
    res.status(404).json({ error: "Manifest not found" });
  }
});
```

## Deployment Steps

### 1. Check Current SSR Server

SSH into your production server:

```bash
ssh your-server

# Check if the SSR server file exists
ls -la /var/www/jumpcsra-ssr/ssr-server.js

# Check the current content
cat /var/www/jumpcsra-ssr/ssr-server.js
```

### 2. Update the SSR Server

```bash
# Backup existing server
cp /var/www/jumpcsra-ssr/ssr-server.js /var/www/jumpcsra-ssr/ssr-server.js.backup

# Edit the server file
nano /var/www/jumpcsra-ssr/ssr-server.js
```

Paste the complete SSR server code from Option A above.

### 3. Ensure package.json has dependencies

Check `/var/www/jumpcsra-ssr/package.json`:

```json
{
  "name": "jumpcsra-ssr",
  "type": "module",
  "version": "1.0.0",
  "dependencies": {
    "@react-router/express": "^7.0.0",
    "express": "^4.18.2"
  }
}
```

Install dependencies:

```bash
cd /var/www/jumpcsra-ssr
npm install
```

### 4. Rebuild the Application

**Important:** Build on your production server so the environment variables from ecosystem.config.cjs are available during the build.

```bash
cd /var/www/JumpCSRA-Website/JumpCSRA

# Since you're using PM2 with ecosystem.config.cjs, 
# the environment variables are already available on the server.
# Just build directly - no need to manually export:
npm run build

# Verify manifest exists
ls -la build/client/.react-router/manifest.json

# The env vars from ecosystem.config.cjs will be picked up during build
# because you're building in the same environment where PM2 runs
```

**Why this works:**
- Your ecosystem.config.cjs defines all the `VITE_*` variables
- When you build on the server, those variables exist in the environment
- Vite's `define` in vite.config.ts reads them at build time
- The client bundle is created with the correct Firebase config baked in

### 5. Restart PM2

```bash
pm2 restart ssr-server

# Check logs
pm2 logs ssr-server --lines 50

# Check status
pm2 status
```

### 6. Test the Manifest Endpoint

```bash
# From your server
curl http://localhost:3000/__manifest

# From outside (through Cloudflare tunnel)
curl https://destinations-julia-loan-banners.trycloudflare.com/__manifest
```

You should see JSON output with route information.

## Verification

After deployment, open your production site and check the browser console:

1. The `__manifest` request should succeed (200 status)
2. No "No routes matched location" errors
3. Client-side navigation works properly

## Cloudflare Tunnel Configuration

Your Cloudflare tunnel should already be configured correctly based on ecosystem.config.cjs. If you need to verify:

```bash
# Check tunnel status
cloudflared tunnel list

# Check tunnel configuration
cat ~/.cloudflared/config.yml
```

Should look like:

```yaml
tunnel: your-tunnel-id
credentials-file: /path/to/credentials.json

ingress:
  - hostname: destinations-julia-loan-banners.trycloudflare.com
    service: http://localhost:3000
  - service: http_status:404
```

## Troubleshooting

### Manifest still returns 400

1. Check manifest file exists:
   ```bash
   ls -la /var/www/JumpCSRA-Website/JumpCSRA/build/client/.react-router/manifest.json
   ```

2. Check SSR server logs:
   ```bash
   pm2 logs ssr-server --lines 100
   ```

3. Check file permissions:
   ```bash
   chmod -R 755 /var/www/JumpCSRA-Website/JumpCSRA/build
   ```

### Routes still not matching

1. Clear browser cache completely
2. Check that the build completed successfully:
   ```bash
   ls -la /var/www/JumpCSRA-Website/JumpCSRA/build/server/index.js
   ```

3. Verify all routes are in the manifest:
   ```bash
   cat /var/www/JumpCSRA-Website/JumpCSRA/build/client/.react-router/manifest.json | grep -i "home"
   ```

### PM2 restart fails

1. Check PM2 logs:
   ```bash
   pm2 logs ssr-server --err --lines 50
   ```

2. Test server directly:
   ```bash
   cd /var/www/jumpcsra-ssr
   node ssr-server.js
   ```

3. Check port availability:
   ```bash
   netstat -tlnp | grep 3000
   ```

## Additional Notes

- The manifest endpoint is crucial for React Router v7 SSR
- It must be served before the main `*` handler
- Make sure the manifest.json file is included in your build
- Cloudflare tunnel works fine - the issue was just the missing endpoint

## Summary

The fix requires:
1. ✅ Updated [vite.config.ts](JumpCSRA/vite.config.ts) - Added server config
2. ✅ Updated [react-router.config.ts](JumpCSRA/react-router.config.ts) - Added SSR config
3. ⏳ Update `/var/www/jumpcsra-ssr/ssr-server.js` - Add manifest endpoint
4. ⏳ Rebuild with env vars
5. ⏳ Restart PM2

The client-side code is fine - the issue is purely server-side SSR configuration.
