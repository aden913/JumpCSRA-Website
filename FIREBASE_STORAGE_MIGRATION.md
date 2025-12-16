# Firebase Storage Image Migration Guide

## Prerequisites

1. **Install dependencies for the upload script:**
   ```bash
   npm install firebase-admin sharp
   ```

2. **Download Firebase Service Account Key:**
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate new private key"
   - Save the JSON file as `firebase-service-account-key.json` in the project root
   - **IMPORTANT:** Add this file to your `.gitignore` to keep it secure

## Migration Steps

### Step 1: Prepare for Upload
```bash
# Install required dependencies
npm install firebase-admin sharp

# Make sure you have your service account key file
# Should be: firebase-service-account-key.json
```

### Step 2: Run Image Upload with Compression
```bash
node upload-images-to-firebase.js
```

This script will:
- ✅ Compress all images to WebP format with optimized quality settings
- ✅ Upload main images to `inflateables/` folder in Firebase Storage
- ✅ Upload detail images to `inflateables/detail-images/{product}/` folders
- ✅ Automatically update `inflateable-descriptions.json` with Firebase Storage URLs
- ✅ Automatically update `inflateables-detail-images.json` with Firebase Storage URLs
- ✅ Create backups of all modified files
- ✅ Generate progress reports and compression statistics

### Step 3: Test Your Application
1. Build and run your React app
2. Verify images load correctly from Firebase Storage
3. Check that fallback images work properly
4. Monitor Firebase Storage usage in the console

### Step 4: Clean Up (Optional)
Once everything is working:
- Consider removing local image files to save space
- Monitor Firebase Storage costs and usage

## Compression Settings

**Main Images:**
- Max width: 800px
- Quality: 85%
- Format: WebP

**Detail Images:**
- Max width: 1200px
- Quality: 90%
- Format: WebP

## What Gets Updated

**Code Files:**
- `JumpCSRA/app/welcome/index.tsx` - getDetailImages function
- `JumpCSRA/app/routes/checkout.tsx` - default image fallbacks
- Image error handlers updated to use Firebase Storage URLs

**Data Files:**
- `inflateable-descriptions.json` - Main image URLs updated
- `inflateables-detail-images.json` - Detail image URLs updated
- Backups created for all modified files

**Storage Structure:**
```
Firebase Storage: /inflateables/
├── product-1.webp (main images)
├── product-2.webp
├── default.webp (fallback image)
└── detail-images/
    ├── product-1/
    │   ├── product-1-1.webp
    │   ├── product-1-2.webp
    │   └── ...
    └── product-2/
        ├── product-2-1.webp
        └── ...
```

## Firebase Storage Configuration

Make sure your Firebase Storage rules allow public read access:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /inflateables/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## Troubleshooting

**Upload Fails:**
- Verify service account key is correct and in the right location
- Check Firebase Storage bucket name in the script
- Ensure Firebase Storage is enabled in your project

**Images Don't Load:**
- Check browser developer tools for specific error messages
- Verify Firebase Storage rules allow public read access
- Check that the bucket name in URLs matches your actual bucket

**Compression Issues:**
- Ensure Sharp library installed correctly: `npm install sharp`
- On some systems, you may need to rebuild Sharp: `npm rebuild sharp`

## Cost Optimization

**Storage Costs:**
- WebP compression typically saves 30-50% space compared to PNG/JPG
- Monitor usage in Firebase Console
- Consider setting up storage lifecycle rules for cleanup

**Bandwidth Costs:**
- Images are cached by CDN
- Smaller WebP files reduce bandwidth usage
- Set proper cache headers (already handled by the upload script)

## Security Notes

- **Never commit** your service account key to version control
- Add `firebase-service-account-key.json` to `.gitignore`
- Consider using environment variables in production
- Review Firebase Storage security rules regularly