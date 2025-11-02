/**
 * Frontend Email Integration Test
 * Tests all email automations from the frontend perspective
 */

import { sendAccountCreationEmail, sendOrderConfirmationEmail, scheduleCartReminderEmail, scheduleDepositReminderEmail, scheduleEventConfirmationEmail, schedulePostEventThanksEmail, scheduleRebookingReminderEmail } from './app/utils/backendEmailService';

async function testEmailIntegrations() {
  console.log('🔬 Testing Frontend Email Integrations...');
  
  const testUser = {
    email: 'coxaden@gmail.com',
    name: 'Test User',
    uid: 'test_user_123'
  };

  const testBookingData = {
    bookingID: 'test_booking_456',
    customerEmail: testUser.email,
    customerName: testUser.name,
    eventDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
    remainingAmount: 150,
    bookingDetails: {
      items: [
        { name: 'Bounce House', quantity: 1, price: 200 },
        { name: 'Water Slide', quantity: 1, price: 150 }
      ],
      setupTime: '10:00 AM',
      pickupTime: '6:00 PM',
      address: '123 Test Street, Test City, TC 12345'
    }
  };

  try {
    // Test 1: Account Creation Email
    console.log('\n1️⃣ Testing Account Creation Email...');
    const accountResult = await sendAccountCreationEmail(testUser);
    console.log('✅ Account creation email result:', accountResult);

    // Test 2: Payment Confirmation Email
    console.log('\n2️⃣ Testing Payment Confirmation Email...');
    const paymentResult = await sendOrderConfirmationEmail({
      orderID: testBookingData.bookingID,
      customerEmail: testUser.email,
      customerName: testUser.name,
      totalAmount: 350,
      eventDate: testBookingData.eventDate,
      items: testBookingData.bookingDetails.items,
      deliveryAddress: testBookingData.bookingDetails.address,
      deliveryTime: testBookingData.bookingDetails.setupTime,
      paymentType: 'full',
      amountPaid: 350,
      remainingBalance: 0,
      paymentMethod: 'PayPal'
    });
    console.log('✅ Payment confirmation email result:', paymentResult);

    // Test 3: Cart Reminder Email
    console.log('\n3️⃣ Testing Cart Reminder Email...');
    const cartResult = await scheduleCartReminderEmail({
      userID: testUser.uid,
      customerEmail: testUser.email,
      customerName: testUser.name,
      cartItems: testBookingData.bookingDetails.items,
      cartValue: 350
    });
    console.log('✅ Cart reminder email result:', cartResult);

    // Test 4: Deposit Reminder Email
    console.log('\n4️⃣ Testing Deposit Reminder Email...');
    const depositResult = await scheduleDepositReminderEmail(testBookingData);
    console.log('✅ Deposit reminder email result:', depositResult);

    // Test 5: Booking Confirmation Email (2 days before)
    console.log('\n5️⃣ Testing Booking Confirmation Email...');
    const bookingResult = await scheduleEventConfirmationEmail(testBookingData);
    console.log('✅ Booking confirmation email result:', bookingResult);

    // Test 6: Post-Event Thanks Email
    console.log('\n6️⃣ Testing Post-Event Thanks Email...');
    const thanksResult = await schedulePostEventThanksEmail(testBookingData);
    console.log('✅ Post-event thanks email result:', thanksResult);

    // Test 7: Follow-up Email (9 months later)
    console.log('\n7️⃣ Testing Follow-up Email...');
    const followupResult = await scheduleRebookingReminderEmail(testBookingData);
    console.log('✅ Follow-up email result:', followupResult);

    console.log('\n🎉 All email integration tests completed!');
    
  } catch (error) {
    console.error('❌ Email integration test failed:', error);
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).testEmailIntegrations = testEmailIntegrations;
}

export default testEmailIntegrations;