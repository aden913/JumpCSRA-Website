/**
 * Quick Test Script to Debug Subscription Database Issues
 * 
 * This script helps you manually test the debugSubscriptionDatabase function
 * to see what's actually in your Firestore database.
 */

// To use this script:
// 1. Copy this code to your browser console on your app
// 2. Make sure you're logged in
// 3. Replace 'YOUR_USER_ID_HERE' with an actual user ID that has subscription issues
// 4. Run the script

console.log('🔍 DEBUG SUBSCRIPTION DATABASE SCRIPT');
console.log('====================================');

// Check if Firebase is available
if (typeof firebase === 'undefined') {
    console.error('❌ Firebase not available. Run this in your app console while logged in.');
} else {
    console.log('✅ Firebase available, proceeding...');
    
    // Get the current user
    const user = firebase.auth().currentUser;
    if (!user) {
        console.error('❌ No user logged in. Please log in first.');
    } else {
        console.log('✅ User found:', user.uid);
        console.log('📧 User email:', user.email);
        
        // Test the debug function
        const testDebugFunction = async () => {
            try {
                console.log('🚀 Calling debugSubscriptionDatabase function...');
                
                const functions = firebase.functions();
                const debugSubscriptionDb = functions.httpsCallable('debugSubscriptionDatabase');
                
                const result = await debugSubscriptionDb({ 
                    userId: user.uid  // Debug current user's subscriptions
                });
                
                console.log('✅ Debug function completed successfully!');
                console.log('📊 Results:', result.data);
                
                if (result.data.success) {
                    console.log('👤 User ID:', result.data.userId);
                    console.log('📝 Total subscriptions found:', result.data.totalSubscriptions);
                    console.log('📋 User document exists:', result.data.userDocumentExists);
                    
                    if (result.data.subscriptions && result.data.subscriptions.length > 0) {
                        console.log('📄 Subscription documents:');
                        result.data.subscriptions.forEach((sub, index) => {
                            console.log(`  ${index + 1}. Document ID: ${sub.documentId}`);
                            console.log(`     Status: ${sub.data?.status || 'No status'}`);
                            console.log(`     Subscription ID: ${sub.data?.subscriptionId || 'No subscription ID'}`);
                            console.log(`     Created: ${sub.data?.createdAt || 'No creation date'}`);
                        });
                    } else {
                        console.log('📄 No subscription documents found');
                    }
                    
                    if (result.data.userDocumentData) {
                        console.log('👤 User document data:');
                        console.log('   Name:', result.data.userDocumentData.name || result.data.userDocumentData.displayName);
                        console.log('   Email:', result.data.userDocumentData.email);
                        console.log('   Created:', result.data.userDocumentData.createdAt);
                    }
                } else {
                    console.error('❌ Debug function returned error:', result.data);
                }
                
            } catch (error) {
                console.error('❌ Error calling debug function:', error);
                console.error('   Error code:', error.code);
                console.error('   Error message:', error.message);
            }
        };
        
        // Run the test
        testDebugFunction();
    }
}

console.log('');
console.log('💡 MANUAL DEBUGGING TIPS:');
console.log('1. Check Firebase Console > Firestore > users collection');
console.log('2. Look for your user document, then subscriptions subcollection');
console.log('3. Check if there\'s a root "userSubscriptions" collection (should NOT exist)');
console.log('4. Look at Firebase Functions logs for detailed debugging output');
console.log('5. If you see a root "userSubscriptions" collection, it may be from old/cached code');