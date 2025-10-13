# Firestore Database Setup Instructions

If you're seeing "Database access denied" errors, it's because the Firestore security rules need to be configured.

## Fix for Firebase Admin

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Select your project**: `pppro-b060e`
3. **Navigate to Firestore Database**
4. **Click on "Rules" tab**
5. **Replace the existing rules with**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow authenticated users to read inflateables (for cart functionality)
    match /inflateables/{document} {
      allow read: if request.auth != null;
    }
    
    // Allow authenticated users to read gift cards (for discount functionality)  
    match /giftCards/{document} {
      allow read: if request.auth != null;
    }
    
    // Allow authenticated users to create bookings
    match /bookings/{document} {
      allow create: if request.auth != null && request.auth.uid == resource.data.userId;
      allow read, update: if request.auth != null && request.auth.uid == resource.data.userId;
    }
  }
}
```

6. **Click "Publish"**

## Current Workaround

The app has been updated to work even with restricted database access:
- Google Sign-in will still work
- User data is temporarily stored locally 
- Once database rules are fixed, data will sync properly

## Test After Rules Update

After updating the rules:
1. Clear browser cache/localStorage
2. Try Google Sign-in again
3. Check browser console for confirmation messages
4. User data should now save to Firestore properly