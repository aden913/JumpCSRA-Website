import * as functions from 'firebase-functions';

// Simple test function
export const testFunction = functions.https.onCall(async (data, context) => {
  console.log('Test function called successfully');
  return { 
    success: true, 
    message: 'Test function is working!',
    timestamp: new Date().toISOString()
  };
});