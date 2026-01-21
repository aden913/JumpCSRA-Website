# Quick Deployment Checklist

## Files to Copy to Production Server

### Option A: Manual Copy (Simplest)
1. Copy [server.ts](server.ts) → `/var/www/jumpcsra-ssr/server.ts`
2. Copy [package-ssr.json](package-ssr.json) → `/var/www/jumpcsra-ssr/package.json`

### Option B: Use SCP
```bash
scp server.ts aden@170.187.145.7:/var/www/jumpcsra-ssr/
scp package-ssr.json aden@170.187.145.7:/var/www/jumpcsra-ssr/package.json
scp deploy-ssr.sh aden@170.187.145.7:/var/www/jumpcsra-ssr/
```

## On Production Server: Manual Steps

```bash
# 1. Navigate to SSR directory
cd /var/www/jumpcsra-ssr

# 2. Install new dependencies
npm install

# 3. Build from source
cd /var/www/jumpcsra/JumpCSRA
npm run build

# 4. Copy build files
rm -rf /var/www/jumpcsra-ssr/build
cp -r build /var/www/jumpcsra-ssr/

# 5. Restart PM2
cd /var/www/jumpcsra-ssr
pm2 stop ssr-server
pm2 delete ssr-server
pm2 start server.ts --name ssr-server --node-args="--loader tsx" --env production
pm2 save

# 6. Check it's working
pm2 logs ssr-server --lines 50
```

## OR: Automated Deployment

```bash
# After copying files to server, run the deployment script:
cd /var/www/jumpcsra-ssr
bash deploy-ssr.sh
```

## Verification

After deployment, check your browser at http://170.187.145.7

**Expected results:**
- ✅ No "No route matches URL" errors in server logs
- ✅ Assets load correctly (status 200, not 404 or ERR_ABORTED)
- ✅ No apple-touch-icon errors
- ✅ Website loads and functions normally

**Check logs:**
```bash
pm2 logs ssr-server --lines 100
```

## Rollback (if needed)

```bash
cd /var/www/jumpcsra-ssr
pm2 stop ssr-server
pm2 delete ssr-server
pm2 start ssr-server.js --name ssr-server --env production
pm2 save
```
