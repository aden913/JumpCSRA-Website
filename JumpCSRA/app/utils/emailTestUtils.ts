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
    // Debug log removed
    
    // Test functions that should be available
    const functionsToTest = [
      'createPayPalInvoice',
      'sendOrderConfirmationEmail', // Cloud Function approach
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
        // Debug log removed
        
      } catch (error: any) {
        if (error.code === 'functions/not-found') {
          // Debug error removed
          results.errors.push(`Function '${functionName}' not deployed`);
          results.success = false;
        } else if (error.code === 'functions/invalid-argument' || error.code === 'functions/unauthenticated') {
          // These errors mean the function exists but failed validation or auth
          results.availableFunctions.push(functionName);
          // Debug log removed
        } else {
          // Debug warning removed
          results.errors.push(`Function '${functionName}' test failed: ${error.message}`);
        }
      }
    }
    
  } catch (error: any) {
    // Debug error removed
    results.errors.push(`Firebase Functions initialization failed: ${error.message}`);
    results.success = false;
  }
  
  return results;
};

// Test order confirmation email with sample data
export const testOrderConfirmationEmail = async (testEmail: string): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> => {
  try {
    // Debug log removed
    
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
    
    // Debug log removed
    
    return {
      success: true,
      message: `Test email sent successfully to ${testEmail}. Order ID: ${testEmailData.orderID}`
    };
    
  } catch (error: any) {
    // Debug error removed
    
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
    // Debug log removed
    
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
    
    // Debug log removed
    
    return {
      success: true,
      message: `Test PayPal invoice created successfully for ${testEmail}`,
      invoiceId: (result.data as any).invoiceId
    };
    
  } catch (error: any) {
    // Debug error removed
    
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
  invoiceTest?: Awaited<ReturnType<typeof testPayPalInvoice>>;
}> => {
  // Debug log removed
  
  const results: any = {};
  
  // Test 1: Check Firebase Functions deployment
  // Debug log removed
  results.deploymentCheck = await testFirebaseFunctionsDeployment();
  
  if (testEmail) {
    // Test 2: Try order confirmation email via Cloud Functions
    // Debug log removed
    results.emailTest = await testOrderConfirmationEmail(testEmail);
    
    // Test 3: Try PayPal invoice creation
    // Debug log removed
    results.invoiceTest = await testPayPalInvoice(testEmail);
  }
  
  // Summary
  // Debug log removed
  // Debug log removed
  // Debug log removed
  
  if (testEmail) {
    // Debug log removed
    // Debug log removed
  }
  
  return results;
};

// Helper function to display results in browser console
export const displayDiagnosticsResults = (results: Awaited<ReturnType<typeof runEmailSystemDiagnostics>>) => {
  console.group('📊 EMAIL SYSTEM DIAGNOSTICS RESULTS');
  
  console.group('🔧 Firebase Functions Deployment');
  // Debug log removed
  // Debug log removed
  if (results.deploymentCheck.errors.length > 0) {
    // Debug log removed
  }
  console.groupEnd();
  
  if (results.emailTest) {
    console.group('📧 Order Confirmation Email Test');
    // Debug log removed
    // Debug log removed
    if (results.emailTest.error) {
      // Debug log removed
    }
    console.groupEnd();
  }
  
  if (results.invoiceTest) {
    console.group('💰 PayPal Invoice Test');
    // Debug log removed
    // Debug log removed
    if (results.invoiceTest.invoiceId) {
      // Debug log removed
    }
    if (results.invoiceTest.error) {
      // Debug log removed
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