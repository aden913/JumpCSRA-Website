// Email Testing Utilities for JumpCSRA
// This file provides functions to test Firebase Cloud Functions and email delivery

// InvoiceData interface (copy from paypalInvoiceUtils.ts since it's not exported)
interface InvoiceData {
  // Customer information
  recipientEmail: string;
  recipientName: string;
  
  // Invoice details
  orderID: string;
  orderDate: string;
  
  // Event details
  eventDate?: string;
  deliveryAddress?: string;
  deliveryTime?: string;
  duration?: string;
  surface?: string;
  
  // Items
  rentalItems: Array<{
    name: string;
    quantity: number;
    price: number;
    duration?: string;
    wetDry?: string;
  }>;
  
  lastMinuteAdditions: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  
  // Pricing
  subtotal: number;
  surfaceAdjustment: number;
  timeAdjustment: number;
  deliveryCost: number;
  totalAmount: number;
  
  // Payment info
  paymentType: 'full' | 'deposit';
  amountPaid: number;
  remainingBalance: number;
  paymentMethod: string;
  
  // Gift cards
  giftCards: Array<{
    code: string;
    balance: number;
    expirationDate: string;
    isPromotional?: boolean;
    promotionalMessage?: string;
    recipientEmail?: string;
  }>;
  
  // Status
  bookingStatus: string;
  requiresPhoneCall?: boolean;
  
  // PayPal transaction IDs
  paypalOrderId?: string;
  paypalTransactionId?: string;
}

// Test Firebase Functions deployment status
export const testFirebaseFunctionsDeployment = async (): Promise<{
  success: boolean;
  availableFunctions: string[];
  errors: string[];
}> => {
  const results = {
    success: true,
    availableFunctions: [] as string[],
    errors: [] as string[]
  };

  try {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const { app } = await import('../components/FirebaseConfig');
    
    const functions = getFunctions(app);
    console.log('🔧 EMAIL TEST - Firebase Functions initialized for project:', functions.app.options.projectId);
    
    // Test functions that should be available
    const functionsToTest = [
      'createPayPalInvoice',
      'sendOrderConfirmationEmail',
      'sendEnhancedOrderConfirmation', // New SendGrid-based enhanced email system
      'sendGiftCardEmail'
    ];
    
    for (const functionName of functionsToTest) {
      try {
        const testFunction = httpsCallable(functions, functionName);
        
        // Try to call with minimal data to test if function exists
        // (this should fail with validation error, but that means function exists)
        await testFunction({});
        
        // If it doesn't throw, the function exists
        results.availableFunctions.push(functionName);
        console.log(`✅ EMAIL TEST - Function '${functionName}' is available`);
        
      } catch (error: any) {
        if (error.code === 'functions/not-found') {
          console.error(`❌ EMAIL TEST - Function '${functionName}' not found`);
          results.errors.push(`Function '${functionName}' not deployed`);
          results.success = false;
        } else if (error.code === 'functions/invalid-argument' || error.code === 'functions/unauthenticated') {
          // These errors mean the function exists but failed validation or auth
          results.availableFunctions.push(functionName);
          console.log(`✅ EMAIL TEST - Function '${functionName}' is available (${error.code})`);
        } else {
          console.warn(`⚠️ EMAIL TEST - Function '${functionName}' test inconclusive:`, error.message);
          results.errors.push(`Function '${functionName}' test failed: ${error.message}`);
        }
      }
    }
    
  } catch (error: any) {
    console.error('❌ EMAIL TEST - Firebase Functions initialization failed:', error);
    results.errors.push(`Firebase Functions initialization failed: ${error.message}`);
    results.success = false;
  }
  
  return results;
};

// Test enhanced order confirmation email with SendGrid (new system)
export const testEnhancedOrderConfirmationEmail = async (testEmail: string): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> => {
  try {
    console.log('📧 EMAIL TEST - Testing enhanced SendGrid order confirmation email to:', testEmail);
    
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const { app } = await import('../components/FirebaseConfig');
    
    const functions = getFunctions(app);
    const sendEnhancedOrderConfirmation = httpsCallable(functions, 'sendEnhancedOrderConfirmation');
    
    // Sample test data for enhanced email system
    const testEmailData = {
      recipientEmail: testEmail,
      recipientName: 'Test Customer',
      orderID: 'TEST-ENHANCED-' + Date.now(),
      orderDate: new Date().toISOString(),
      eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(), // 7 days from now
      deliveryAddress: '123 Test Street, Test City, SC 12345',
      deliveryTime: '10:00 AM - 2:00 PM',
      duration: '6 hours',
      surface: 'Grass',
      rentalItems: [
        {
          name: 'Test Enhanced Bounce House',
          quantity: 1,
          price: 200.00,
          wetDry: 'Wet/Dry'
        }
      ],
      lastMinuteAdditions: [
        {
          name: 'Test Add-on Item',
          quantity: 2,
          price: 15.00
        }
      ],
      subtotal: 200.00,
      surfaceAdjustment: 10.00,
      timeAdjustment: 0,
      deliveryCost: 30.00,
      totalAmount: 270.00,
      paymentType: 'deposit' as const,
      amountPaid: 135.00,
      remainingBalance: 135.00,
      paymentMethod: 'PayPal + Wallet',
      giftCards: [
        {
          code: 'TEST-ENHANCED-GC-' + Date.now(),
          balance: 50.00,
          expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString(), // 1 year from now
          isPromotional: true,
          promotionalMessage: 'Thank you for testing our enhanced email system!',
          recipientEmail: testEmail
        }
      ],
      bookingStatus: 'deposit_paid',
      requiresPhoneCall: false,
      paypalOrderId: 'TEST-PAYPAL-' + Date.now(),
      paypalTransactionId: 'TEST-TXN-' + Date.now()
    };
    
    const result = await sendEnhancedOrderConfirmation(testEmailData);
    
    console.log('✅ EMAIL TEST - Enhanced order confirmation email test result:', result.data);
    
    return {
      success: true,
      message: `Enhanced test email sent successfully to ${testEmail}. Order ID: ${testEmailData.orderID}`
    };
    
  } catch (error: any) {
    console.error('❌ EMAIL TEST - Enhanced order confirmation email test failed:', error);
    
    return {
      success: false,
      message: 'Enhanced test email failed',
      error: error.message || 'Unknown error'
    };
  }
};

// Test order confirmation email with sample data
export const testOrderConfirmationEmail = async (testEmail: string): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> => {
  try {
    console.log('📧 EMAIL TEST - Testing order confirmation email to:', testEmail);
    
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const { app } = await import('../components/FirebaseConfig');
    
    const functions = getFunctions(app);
    const sendOrderConfirmationEmail = httpsCallable(functions, 'sendOrderConfirmationEmail');
    
    // Sample test data
    const testEmailData = {
      recipientEmail: testEmail,
      recipientName: 'Test Customer',
      orderID: 'TEST-' + Date.now(),
      orderDate: new Date().toISOString(),
      eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(), // 7 days from now
      deliveryAddress: '123 Test Street, Test City, SC 12345',
      deliveryTime: '10:00 AM - 2:00 PM',
      duration: '4 hours',
      surface: 'Grass',
      rentalItems: [
        {
          name: 'Test Bounce House',
          quantity: 1,
          price: 150.00,
          duration: '4 hours',
          wetDry: 'Dry'
        }
      ],
      lastMinuteAdditions: [],
      subtotal: 150.00,
      surfaceAdjustment: 0,
      timeAdjustment: 0,
      deliveryCost: 25.00,
      totalAmount: 175.00,
      paymentType: 'deposit' as const,
      amountPaid: 87.50,
      remainingBalance: 87.50,
      paymentMethod: 'PayPal',
      giftCards: [
        {
          code: 'TEST-GC-' + Date.now(),
          balance: 25.00,
          expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString(), // 1 year from now
          isPromotional: true,
          promotionalMessage: 'Thank you for your test order!',
          recipientEmail: testEmail
        }
      ],
      bookingStatus: 'confirmed',
      requiresPhoneCall: false
    };
    
    const result = await sendOrderConfirmationEmail(testEmailData);
    
    console.log('✅ EMAIL TEST - Order confirmation email test result:', result.data);
    
    return {
      success: true,
      message: `Test email sent successfully to ${testEmail}. Order ID: ${testEmailData.orderID}`
    };
    
  } catch (error: any) {
    console.error('❌ EMAIL TEST - Order confirmation email test failed:', error);
    
    return {
      success: false,
      message: 'Test email failed',
      error: error.message || 'Unknown error'
    };
  }
};

// Test PayPal invoice creation with sample data
export const testPayPalInvoice = async (testEmail: string): Promise<{
  success: boolean;
  message: string;
  invoiceId?: string;
  error?: string;
}> => {
  try {
    console.log('💰 EMAIL TEST - Testing PayPal invoice creation for:', testEmail);
    
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const { app } = await import('../components/FirebaseConfig');
    
    const functions = getFunctions(app);
    const createPayPalInvoice = httpsCallable(functions, 'createPayPalInvoice');
    
    // Sample test data
    const testInvoiceData: InvoiceData = {
      recipientEmail: testEmail,
      recipientName: 'Test Customer',
      orderID: 'TEST-INVOICE-' + Date.now(),
      orderDate: new Date().toISOString(),
      eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      deliveryAddress: '123 Test Street, Test City, SC 12345',
      deliveryTime: '10:00 AM - 2:00 PM',
      duration: '4 hours',
      surface: 'Grass',
      rentalItems: [
        {
          name: 'Test Bounce House',
          quantity: 1,
          price: 150.00,
          duration: '4 hours',
          wetDry: 'Dry'
        }
      ],
      lastMinuteAdditions: [],
      subtotal: 150.00,
      surfaceAdjustment: 0,
      timeAdjustment: 0,
      deliveryCost: 25.00,
      totalAmount: 175.00,
      paymentType: 'deposit',
      amountPaid: 87.50,
      remainingBalance: 87.50,
      paymentMethod: 'PayPal',
      giftCards: [
        {
          code: 'TEST-GC-' + Date.now(),
          balance: 25.00,
          expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          isPromotional: true,
          promotionalMessage: 'Thank you for your test order!'
        }
      ],
      bookingStatus: 'confirmed',
      requiresPhoneCall: false,
      paypalOrderId: 'TEST-PAYPAL-' + Date.now()
    };
    
    const result = await createPayPalInvoice(testInvoiceData);
    
    console.log('✅ EMAIL TEST - PayPal invoice test result:', result.data);
    
    return {
      success: true,
      message: `Test PayPal invoice created successfully for ${testEmail}`,
      invoiceId: (result.data as any).invoiceId
    };
    
  } catch (error: any) {
    console.error('❌ EMAIL TEST - PayPal invoice test failed:', error);
    
    return {
      success: false,
      message: 'PayPal invoice test failed',
      error: error.message || 'Unknown error'
    };
  }
};

// Run comprehensive email system diagnostics
export const runEmailSystemDiagnostics = async (testEmail?: string): Promise<{
  deploymentCheck: Awaited<ReturnType<typeof testFirebaseFunctionsDeployment>>;
  emailTest?: Awaited<ReturnType<typeof testOrderConfirmationEmail>>;
  enhancedEmailTest?: Awaited<ReturnType<typeof testEnhancedOrderConfirmationEmail>>;
  invoiceTest?: Awaited<ReturnType<typeof testPayPalInvoice>>;
}> => {
  console.log('🔍 EMAIL TEST - Running comprehensive email system diagnostics...');
  
  const results: any = {};
  
  // Test 1: Check Firebase Functions deployment
  console.log('🔧 EMAIL TEST - Step 1: Checking Firebase Functions deployment...');
  results.deploymentCheck = await testFirebaseFunctionsDeployment();
  
  if (testEmail) {
    // Test 2: Try order confirmation email (legacy)
    console.log('📧 EMAIL TEST - Step 2: Testing legacy order confirmation email...');
    results.emailTest = await testOrderConfirmationEmail(testEmail);
    
    // Test 3: Try enhanced SendGrid order confirmation email (new system)
    console.log('✨ EMAIL TEST - Step 3: Testing enhanced SendGrid order confirmation email...');
    results.enhancedEmailTest = await testEnhancedOrderConfirmationEmail(testEmail);
    
    // Test 4: Try PayPal invoice creation
    console.log('💰 EMAIL TEST - Step 4: Testing PayPal invoice creation...');
    results.invoiceTest = await testPayPalInvoice(testEmail);
  }
  
  // Summary
  console.log('📊 EMAIL TEST - Diagnostics Summary:');
  console.log('  🔧 Functions Available:', results.deploymentCheck.availableFunctions.length);
  console.log('  ❌ Errors Found:', results.deploymentCheck.errors.length);
  
  if (testEmail) {
    console.log('  📧 Legacy Email Test:', results.emailTest?.success ? '✅ Passed' : '❌ Failed');
    console.log('  ✨ Enhanced Email Test:', results.enhancedEmailTest?.success ? '✅ Passed' : '❌ Failed');
    console.log('  💰 Invoice Test:', results.invoiceTest?.success ? '✅ Passed' : '❌ Failed');
  }
  
  return results;
};

// Helper function to display results in browser console
export const displayDiagnosticsResults = (results: Awaited<ReturnType<typeof runEmailSystemDiagnostics>>) => {
  console.group('📊 EMAIL SYSTEM DIAGNOSTICS RESULTS');
  
  console.group('🔧 Firebase Functions Deployment');
  console.log('Status:', results.deploymentCheck.success ? '✅ Good' : '❌ Issues Found');
  console.log('Available Functions:', results.deploymentCheck.availableFunctions);
  if (results.deploymentCheck.errors.length > 0) {
    console.log('Errors:', results.deploymentCheck.errors);
  }
  console.groupEnd();
  
  if (results.emailTest) {
    console.group('📧 Legacy Order Confirmation Email Test');
    console.log('Status:', results.emailTest.success ? '✅ Success' : '❌ Failed');
    console.log('Message:', results.emailTest.message);
    if (results.emailTest.error) {
      console.log('Error:', results.emailTest.error);
    }
    console.groupEnd();
  }
  
  if (results.enhancedEmailTest) {
    console.group('✨ Enhanced SendGrid Order Confirmation Email Test');
    console.log('Status:', results.enhancedEmailTest.success ? '✅ Success' : '❌ Failed');
    console.log('Message:', results.enhancedEmailTest.message);
    if (results.enhancedEmailTest.error) {
      console.log('Error:', results.enhancedEmailTest.error);
    }
    console.groupEnd();
  }
  
  if (results.invoiceTest) {
    console.group('💰 PayPal Invoice Test');
    console.log('Status:', results.invoiceTest.success ? '✅ Success' : '❌ Failed');
    console.log('Message:', results.invoiceTest.message);
    if (results.invoiceTest.invoiceId) {
      console.log('Invoice ID:', results.invoiceTest.invoiceId);
    }
    if (results.invoiceTest.error) {
      console.log('Error:', results.invoiceTest.error);
    }
    console.groupEnd();
  }
  
  console.groupEnd();
};

// Quick test function for browser console
export const quickEmailTest = async (testEmail: string) => {
  const results = await runEmailSystemDiagnostics(testEmail);
  displayDiagnosticsResults(results);
  return results;
};