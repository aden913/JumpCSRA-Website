  const checkExistingMembershipBookings = async () => {
    if (!user) {
      console.log('❌ CHECKING: No user found, skipping membership booking validation');
      return;
    }

    try {
      console.log('🔍 CHECKING: Starting membership booking validation...');
      console.log('👤 User ID:', user.uid);
      
      const { getDatabase, ref, get } = await import('firebase/database');
      const database = getDatabase();
      const membershipBookingsRef = ref(database, 'bookings/membershipBookings');
      
      console.log('📡 CHECKING: Querying Firebase Realtime Database at path: bookings/membershipBookings');
      const snapshot = await get(membershipBookingsRef);

      if (snapshot.exists()) {
        const allBookings = snapshot.val();
        console.log('📊 CHECKING: Total membership bookings in database:', Object.keys(allBookings).length);
        
        const allBookingEntries = Object.entries(allBookings);
        console.log('📋 CHECKING: Sample bookings in database:');
        allBookingEntries.slice(0, 3).forEach(([bookingId, booking]: [string, any], index: number) => {
          console.log(`   ${index + 1}. ID: ${bookingId}, User: ${booking.userId}, Status: ${booking.bookingStatus}`);
        });
        
        const userBookings = allBookingEntries.filter(([_, booking]: [string, any]) => 
          booking.userId === user.uid
        );

        console.log(`🎯 CHECKING: Found ${userBookings.length} membership bookings for current user`);

        if (userBookings.length === 0) {
          console.log('✅ CHECKING: No membership bookings found for this user');
          setExistingMembershipBooking(null);
          setHasConfirmedBookingThisMonth(false);
          return;
        }

        // Log all user bookings for debugging
        console.log('📋 CHECKING: User\'s membership bookings:');
        userBookings.forEach(([bookingId, booking]: [string, any], index: number) => {
          const bookingDate = new Date(booking.actualDeliveryDate || booking.createdAt);
          console.log(`   ${index + 1}. ID: ${bookingId}`);
          console.log(`      Status: ${booking.bookingStatus}`);
          console.log(`      Date: ${bookingDate.toLocaleDateString()}`);
          console.log(`      actualDeliveryDate: ${booking.actualDeliveryDate}`);
          console.log(`      createdAt: ${booking.createdAt}`);
        });

        // Check if user has ANY confirmed booking (regardless of month)
        console.log('🔍 CHECKING: Looking for any confirmed membership booking...');
        const confirmedBooking = userBookings.find(([bookingId, booking]: [string, any]) => {
          console.log(`   🔍 Checking booking ${bookingId}:`);
          
          if (booking.bookingStatus !== 'confirmed') {
            console.log(`      ❌ Status is '${booking.bookingStatus}', not 'confirmed'`);
            return false;
          }
          console.log('      ✅ Status is confirmed - FOUND ACTIVE BOOKING!');
          return true;
        });

        if (confirmedBooking) {
          const [bookingId, bookingData] = confirmedBooking;
          console.log('🚨 FOUND: User has an active confirmed membership booking!');
          console.log('🚨 Booking ID:', bookingId);
          console.log('🚨 Setting validation state to LOCKED');
          setExistingMembershipBooking(bookingData);
          setHasConfirmedBookingThisMonth(true);
        } else {
          console.log('✅ CLEAR: No confirmed bookings found - allowing new booking');
          console.log('✅ CLEAR: Setting validation state to UNLOCKED');
          setExistingMembershipBooking(null);
          setHasConfirmedBookingThisMonth(false);
        }
      } else {
        console.log('📭 NO DATA: No membership bookings found in database at path: bookings/membershipBookings');
        console.log('📭 NO DATA: Setting validation state to UNLOCKED');
        setExistingMembershipBooking(null);
        setHasConfirmedBookingThisMonth(false);
      }
    } catch (error) {
      console.error('❌ ERROR: Failed to check existing membership bookings:', error);
      console.error('❌ ERROR: Setting validation state to UNLOCKED as fallback');
      // Don't block the UI, just log the error
      setExistingMembershipBooking(null);
      setHasConfirmedBookingThisMonth(false);
    }
  };