import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { RouterNav } from '../components/RouterNav';
import { auth, firestore } from '../components/FirebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { User as FirebaseUser } from 'firebase/auth';

export default function SubscriptionSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [activationStatus, setActivationStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [activationMessage, setActivationMessage] = useState('');

  // Get URL parameters
  const urlParams = new URLSearchParams(location.search);
  const success = urlParams.get('success');
  const cancelled = urlParams.get('cancelled');
  const subscriptionId = urlParams.get('subscription_id');
  const baToken = urlParams.get('ba_token');

  // Debug logging for URL parameters
  console.log('🌐 SUCCESS PAGE: URL Parameters:', {
    fullURL: location.search,
    success,
    cancelled,
    subscriptionId,
    baToken,
    pathname: location.pathname
  });

  useEffect(() => {
    console.log('🔍 SUCCESS PAGE: useEffect triggered', { success, baToken, subscriptionId });
    
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      console.log('👤 SUCCESS PAGE: Auth state changed', { user: u?.uid, success });
      setUser(u);
      
      if (u && success === 'true') {
        console.log('✅ SUCCESS PAGE: User authenticated and success=true, loading subscription data...');
        
        try {
          // First load current subscription data from activeSubscriptions subcollection
          console.log('📊 SUCCESS PAGE: Querying Firestore for user activeSubscriptions...');
          const activeSubscriptionsRef = collection(firestore, 'users', u.uid, 'activeSubscriptions');
          
          // Query for active or pending subscriptions
          let subscriptionsQuery = query(
            activeSubscriptionsRef, 
            where('status', 'in', ['Active', 'ACTIVE', 'PENDING_APPROVAL', 'approval-pending']),
            limit(10)
          );
          
          let subscriptionsSnapshot = await getDocs(subscriptionsQuery);
          
          // If no active subscriptions found, try getting any subscription from activeSubscriptions
          if (subscriptionsSnapshot.empty) {
            console.log('📊 SUCCESS PAGE: No active subscriptions found, querying all activeSubscriptions...');
            subscriptionsQuery = query(activeSubscriptionsRef, limit(10));
            subscriptionsSnapshot = await getDocs(subscriptionsQuery);
          }
          
          if (!subscriptionsSnapshot.empty) {
            const subscriptionDoc = subscriptionsSnapshot.docs[0];
            const currentData = subscriptionDoc.data();
            console.log('📋 SUCCESS PAGE: Current subscription data:', JSON.stringify(currentData, null, 2));
            setSubscriptionData(currentData);
            
            // If subscription is still pending, try to activate it
            if ((currentData.status === 'approval-pending' || currentData.status === 'PENDING_APPROVAL') && currentData.subscriptionId) {
              console.log('🎯 SUCCESS PAGE: Subscription is pending approval, attempting activation...');
              console.log('🔑 SUCCESS PAGE: Using subscriptionId:', currentData.subscriptionId);
              console.log('🎫 SUCCESS PAGE: Using baToken:', baToken);
              
              setActivationStatus('pending');
              setActivationMessage('Contacting PayPal to activate your subscription...');
              
              try {
                const functions = getFunctions();
                const activateSubscription = httpsCallable(functions, 'activateSubscription');
                
                console.log('🚀 SUCCESS PAGE: Calling activateSubscription function...');
                const result = await activateSubscription({
                  subscriptionId: currentData.subscriptionId,
                  baToken: baToken
                });
                
                console.log('📨 SUCCESS PAGE: Function response:', JSON.stringify(result, null, 2));
                console.log('📊 SUCCESS PAGE: Function data:', JSON.stringify(result.data, null, 2));
                
                if (result.data && (result.data as any).success) {
                  console.log('✅ SUCCESS PAGE: Activation successful!');
                  setActivationStatus('success');
                  setActivationMessage((result.data as any).message || 'Subscription activated successfully!');
                  
                  // Reload subscription data to get updated status
                  console.log('🔄 SUCCESS PAGE: Reloading subscription data after activation...');
                  const updatedQuery = query(activeSubscriptionsRef, limit(10));
                  const updatedSnapshot = await getDocs(updatedQuery);
                  
                  if (!updatedSnapshot.empty) {
                    const updatedDoc = updatedSnapshot.docs[0];
                    const updatedData = updatedDoc.data();
                    console.log('📊 SUCCESS PAGE: Updated subscription data:', JSON.stringify(updatedData, null, 2));
                    setSubscriptionData(updatedData);
                  } else {
                    console.error('❌ SUCCESS PAGE: Updated subscription document not found after activation');
                  }
                } else {
                  console.error('❌ SUCCESS PAGE: Activation failed:', result.data);
                  setActivationStatus('error');
                  setActivationMessage((result.data as any).message || 'Failed to activate subscription');
                }
              } catch (functionError) {
                console.error('❌ SUCCESS PAGE: Error calling activation function:', functionError);
                setActivationStatus('error');
                setActivationMessage(`Function error: ${functionError instanceof Error ? functionError.message : 'Unknown error'}`);
              }
            } else if (currentData.status === 'Active') {
              console.log('✅ SUCCESS PAGE: Subscription is already active!');
              setActivationStatus('success');
              setActivationMessage('Subscription is already active!');
            } else {
              console.log('ℹ️ SUCCESS PAGE: Subscription status is not pending approval:', currentData.status);
              console.log('🔍 SUCCESS PAGE: Subscription ID present:', !!currentData.subscriptionId);
              setActivationStatus('error');
              setActivationMessage(`Unexpected subscription status: ${currentData.status}`);
            }
          } else {
            console.log('ℹ️ SUCCESS PAGE: No subscription documents found, but we have PayPal data - attempting activation...');
            // No subscription document found, but we have subscription data from PayPal
            // This might be a new subscription that needs to be created/activated
            if (subscriptionId && baToken) {
              console.log('🎯 SUCCESS PAGE: Using PayPal subscription data for activation...');
              console.log('🔑 SUCCESS PAGE: Using subscriptionId:', subscriptionId);
              console.log('🎫 SUCCESS PAGE: Using baToken:', baToken);
              
              setActivationStatus('pending');
              setActivationMessage('Contacting PayPal to activate your subscription...');
              
              try {
                const functions = getFunctions();
                const activateSubscription = httpsCallable(functions, 'activateSubscription');
                
                console.log('🚀 SUCCESS PAGE: Calling activateSubscription function...');
                const result = await activateSubscription({
                  subscriptionId: subscriptionId,
                  baToken: baToken
                });
                
                console.log('📨 SUCCESS PAGE: Function response:', JSON.stringify(result, null, 2));
                console.log('📊 SUCCESS PAGE: Function data:', JSON.stringify(result.data, null, 2));
                
                if (result.data && (result.data as any).success) {
                  console.log('✅ SUCCESS PAGE: Activation successful!');
                  setActivationStatus('success');
                  setActivationMessage((result.data as any).message || 'Subscription activated successfully!');
                  
                  // Reload subscription data to get updated status
                  console.log('🔄 SUCCESS PAGE: Reloading subscription data after activation...');
                  const updatedQuery = query(activeSubscriptionsRef, limit(10));
                  const updatedSnapshot = await getDocs(updatedQuery);
                  
                  if (!updatedSnapshot.empty) {
                    const updatedDoc = updatedSnapshot.docs[0];
                    const updatedData = updatedDoc.data();
                    console.log('📊 SUCCESS PAGE: Updated subscription data:', JSON.stringify(updatedData, null, 2));
                    setSubscriptionData(updatedData);
                  } else {
                    console.error('❌ SUCCESS PAGE: Updated subscription document not found after activation');
                  }
                } else {
                  console.error('❌ SUCCESS PAGE: Activation failed:', result.data);
                  setActivationStatus('error');
                  setActivationMessage((result.data as any).message || 'Failed to activate subscription');
                }
              } catch (functionError) {
                console.error('❌ SUCCESS PAGE: Error calling activation function:', functionError);
                setActivationStatus('error');
                setActivationMessage(`Function error: ${functionError instanceof Error ? functionError.message : 'Unknown error'}`);
              }
            } else {
              console.error('❌ SUCCESS PAGE: No subscription found and missing PayPal data');
              setActivationStatus('error');
              setActivationMessage('No subscription found and missing PayPal data');
            }
          }
        } catch (error) {
          console.error('❌ SUCCESS PAGE: Error in subscription loading/activation process:', error);
          console.error('❌ SUCCESS PAGE: Error stack:', error instanceof Error ? error.stack : 'No stack');
          setActivationStatus('error');
          setActivationMessage(`Database error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else {
        console.log('ℹ️ SUCCESS PAGE: Skipping activation - user not authenticated or success not true');
        console.log('📊 SUCCESS PAGE: Auth state:', !!u, 'Success param:', success);
      }
      
      setLoading(false);
      console.log('✅ SUCCESS PAGE: useEffect processing complete');
    });

    return () => unsubscribe();
  }, [success, baToken]);

  if (loading) {
    return (
      <>
        <RouterNav hideIcons={true} />
        <div style={{ 
          minHeight: '60vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div>Loading...</div>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <RouterNav hideIcons={true} />
        <div style={{ 
          minHeight: '60vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '2rem',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <h2>Please Sign In</h2>
          <p>You need to be signed in to view your subscription status.</p>
          <button 
            onClick={() => navigate('/')}
            style={{
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              padding: '1rem 2rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1.1rem',
              fontWeight: 'bold'
            }}
          >
            Go to Sign In
          </button>
        </div>
      </>
    );
  }

  if (cancelled === 'true') {
    return (
      <>
        <RouterNav hideIcons={true} />
        <div style={{ 
          minHeight: '60vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '2rem',
          padding: '2rem',
          textAlign: 'center',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          <div style={{ fontSize: '4rem' }}>❌</div>
          <h2 style={{ color: '#f44336', marginBottom: '1rem' }}>Subscription Cancelled</h2>
          <p style={{ fontSize: '1.1rem', color: '#666', lineHeight: '1.6' }}>
            You cancelled your membership subscription. No worries! You can always come back and join our Jump Club later.
          </p>
          
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button 
              onClick={() => navigate('/checkout?membership=jump-club')}
              style={{
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                padding: '1rem 2rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 'bold'
              }}
            >
              Try Again
            </button>
            
            <button 
              onClick={() => navigate('/home')}
              style={{
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                padding: '1rem 2rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 'bold'
              }}
            >
              Browse Rentals
            </button>
          </div>
        </div>
      </>
    );
  }

  if (success === 'true') {
    return (
      <>
        <RouterNav hideIcons={true} />
        <div style={{ 
          minHeight: '60vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '2rem',
          padding: '2rem',
          textAlign: 'center',
          maxWidth: '700px',
          margin: '0 auto'
        }}>
          <div style={{ fontSize: '4rem' }}>🎉</div>
          <h1 style={{ color: '#4CAF50', marginBottom: '1rem' }}>Welcome to Jump Club!</h1>
          
          {/* Activation Status */}
          {activationStatus === 'pending' && (
            <div style={{ 
              backgroundColor: '#fff3cd', 
              border: '2px solid #ffc107', 
              borderRadius: '12px', 
              padding: '1.5rem',
              marginBottom: '1rem',
              width: '100%'
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#856404' }}>⏳ Activating Your Membership...</h3>
              <p style={{ fontSize: '1rem', color: '#856404', margin: 0 }}>
                Please wait while we confirm your subscription with PayPal.
              </p>
            </div>
          )}
          
          {activationStatus === 'success' && (
            <div style={{ 
              backgroundColor: '#e8f5e8', 
              border: '2px solid #4CAF50', 
              borderRadius: '12px', 
              padding: '2rem',
              marginBottom: '1rem'
            }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#2e7d32' }}>🎪 Your Membership is Active!</h3>
              <p style={{ fontSize: '1.1rem', color: '#2e7d32', lineHeight: '1.6', margin: 0 }}>
                {activationMessage || 'Your monthly Jump Club membership has been successfully activated for just $149/month. You\'ll now enjoy 25% off all rentals plus monthly inflatable deliveries!'}
              </p>
            </div>
          )}
          
          {activationStatus === 'error' && (
            <div style={{ 
              backgroundColor: '#f8d7da', 
              border: '2px solid #dc3545', 
              borderRadius: '12px', 
              padding: '1.5rem',
              marginBottom: '1rem',
              width: '100%'
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#721c24' }}>❌ Activation Issue</h3>
              <p style={{ fontSize: '1rem', color: '#721c24', margin: 0 }}>
                {activationMessage || 'There was an issue activating your subscription. Please contact support.'}
              </p>
            </div>
          )}

          <div style={{ 
            backgroundColor: '#f8f9fa', 
            border: '1px solid #e0e0e0', 
            borderRadius: '12px', 
            padding: '1.5rem',
            textAlign: 'left',
            width: '100%'
          }}>
            <h4 style={{ margin: '0 0 1rem 0', color: '#333' }}>🎯 Your Member Benefits:</h4>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', lineHeight: '1.8' }}>
              <li>📦 Monthly inflatable delivery to your home</li>
              <li>💰 25% off all other rental reservations</li>
              <li>🔧 No setup or takedown hassle</li>
              <li>⭐ Priority booking for special events</li>
              <li>🆕 Fresh new inflatable each month</li>
              <li>📞 Dedicated member support</li>
            </ul>
          </div>

          {subscriptionData && (
            <div style={{ 
              backgroundColor: '#f0f7ff', 
              border: '2px solid #2196f3', 
              borderRadius: '8px', 
              padding: '1rem',
              fontSize: '0.9rem',
              color: '#1976d2',
              width: '100%'
            }}>
              <strong>Subscription ID:</strong> {subscriptionData.subscriptionId}<br/>
              <strong>Status:</strong> {subscriptionData.status}<br/>
              <strong>Started:</strong> {subscriptionData.createdAt ? new Date(subscriptionData.createdAt.seconds ? subscriptionData.createdAt.seconds * 1000 : subscriptionData.createdAt).toLocaleDateString() : 'Just now'}
            </div>
          )}

          {/* Debug Information */}
          <div style={{ 
            backgroundColor: '#f8f9fa', 
            border: '1px solid #dee2e6', 
            borderRadius: '8px', 
            padding: '1rem',
            fontSize: '0.85rem',
            color: '#495057',
            width: '100%',
            textAlign: 'left'
          }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#6c757d' }}>🔍 Debug Information</h4>
            <strong>URL Parameters:</strong><br/>
            • success: {success || 'null'}<br/>
            • cancelled: {cancelled || 'null'}<br/>
            • subscription_id: {subscriptionId || 'null'}<br/>
            • ba_token: {baToken || 'null'}<br/>
            <br/>
            <strong>Activation Status:</strong> {activationStatus}<br/>
            <strong>Activation Message:</strong> {activationMessage || 'None'}<br/>
            <br/>
            <strong>Subscription Data Available:</strong> {subscriptionData ? 'Yes' : 'No'}<br/>
            {subscriptionData && (
              <>
                <strong>Database Status:</strong> {subscriptionData.status || 'undefined'}<br/>
                <strong>Database Subscription ID:</strong> {subscriptionData.subscriptionId || 'undefined'}<br/>
                <strong>PayPal Status:</strong> {subscriptionData.paypalStatus || 'undefined'}<br/>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button 
              onClick={() => navigate('/profile')}
              style={{
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                padding: '1rem 2rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 'bold'
              }}
            >
              View My Membership
            </button>
            
            <button 
              onClick={() => navigate('/home')}
              style={{
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                padding: '1rem 2rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 'bold'
              }}
            >
              Start Browsing Rentals
            </button>
          </div>
        </div>
      </>
    );
  }

  // Default fallback
  return (
    <>
      <RouterNav hideIcons={true} />
      <div style={{ 
        minHeight: '60vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '2rem',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <h2>Subscription Status Unknown</h2>
        <p>We couldn't determine your subscription status. Please check your profile or contact support.</p>
        
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button 
            onClick={() => navigate('/profile')}
            style={{
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              padding: '1rem 2rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            Check Profile
          </button>
          
          <button 
            onClick={() => navigate('/home')}
            style={{
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              padding: '1rem 2rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            Go Home
          </button>
        </div>
      </div>
    </>
  );
}
