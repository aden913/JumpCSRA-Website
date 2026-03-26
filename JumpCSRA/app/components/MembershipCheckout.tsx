import React, { useState, useEffect } from 'react';
import { notifications } from '@mantine/notifications';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './FirebaseConfig';
import { getUserMembership, updateUserMembership, updateMembershipDateStarted } from '../utils/databaseUtils';
import { UserMembership } from '../utils/databaseUtils';
import '../styles/MembershipCheckout.css';

interface MembershipCheckoutProps {
  onSuccess: () => void;
}

type CheckoutStep = 'benefits' | 'terms' | 'payment' | 'success';

const MembershipCheckout: React.FC<MembershipCheckoutProps> = ({ onSuccess }) => {
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('benefits');
  const [user, setUser] = useState<User | null>(null);
  const [userMembership, setUserMembership] = useState<UserMembership | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderId, setOrderId] = useState<string>('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          const membership = await getUserMembership(currentUser.uid);
          setUserMembership(membership);
        } catch (error) {
          console.error('Error loading user membership:', error);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const isAlreadyMember = userMembership?.jumpClub && !userMembership?.cancelled;

  const createSubscription = async () => {
    console.log('🎯 FRONTEND DEBUG: =================================');
    console.log('🎯 FRONTEND DEBUG: SUBSCRIPTION CREATION START');
    console.log('🎯 FRONTEND DEBUG: =================================');
    console.log('🎯 FRONTEND DEBUG: User state:', user);
    console.log('🎯 FRONTEND DEBUG: User authenticated:', !!user);
    console.log('🎯 FRONTEND DEBUG: User UID:', user?.uid);
    console.log('🎯 FRONTEND DEBUG: User email:', user?.email);
    console.log('🎯 FRONTEND DEBUG: User display name:', user?.displayName);

    if (!user) {
      console.error('❌ FRONTEND ERROR: No user found');
      throw new Error('User must be logged in');
    }

    if (!user.uid) {
      console.error('❌ FRONTEND ERROR: User has no uid:', user);
      throw new Error('User ID is missing');
    }

    console.log('✅ FRONTEND DEBUG: Creating subscription for user:', user.uid);
    console.log('✅ FRONTEND DEBUG: Subscription amount: $149.00');
    setIsProcessing(true);

    try {
      console.log('📦 FRONTEND DEBUG: Importing Firebase functions...');
      // Use Firebase callable function pattern
      const { getFunctions, httpsCallable, connectFunctionsEmulator } = await import('firebase/functions');
      const { app } = await import('./FirebaseConfig');
      
      console.log('📦 FRONTEND DEBUG: Getting functions instance with region...');
      const functions = getFunctions(app, 'us-central1'); // Specify region explicitly
      const createMembershipSubscriptionCallable = httpsCallable(functions, 'createMembershipSubscription');

      const subscriptionData = {
        userId: user.uid,
        planAmount: 149.00,
        currency: 'USD',
        userEmail: user.email,
        userName: user.displayName || 'Jump Club Member'
      };

      console.log('📡 FRONTEND DEBUG: Sending subscription data to backend:', JSON.stringify(subscriptionData, null, 2));
      console.log('📡 FRONTEND DEBUG: Calling createMembershipSubscription function...');

      const result = await createMembershipSubscriptionCallable(subscriptionData);
      console.log('📡 FRONTEND DEBUG: Backend response received:', result);
      
      const data = result.data as any;
      console.log('📡 FRONTEND DEBUG: Response data:', JSON.stringify(data, null, 2));

      if (!data.success) {
        console.error('❌ FRONTEND ERROR: Backend returned failure:', data.error);
        throw new Error(data.error || 'Failed to create subscription');
      }

      console.log('✅ FRONTEND SUCCESS: Subscription created successfully');
      console.log('✅ FRONTEND DEBUG: Subscription ID:', data.subscriptionId);
      console.log('✅ FRONTEND DEBUG: Approval URL:', data.approvalUrl);

      // Redirect to PayPal for subscription approval
      if (data.approvalUrl) {
        console.log('🌐 FRONTEND DEBUG: Redirecting to PayPal approval...');
        console.log('🌐 FRONTEND DEBUG: Approval URL:', data.approvalUrl);
        console.log('🎯 FRONTEND DEBUG: =================================');
        console.log('🎯 FRONTEND DEBUG: REDIRECTING TO PAYPAL');
        console.log('🎯 FRONTEND DEBUG: =================================');
        window.location.href = data.approvalUrl;
      } else {
        console.error('❌ FRONTEND ERROR: No approval URL in response');
        throw new Error('No approval URL received from PayPal');
      }

    } catch (error) {
      console.error('🚨 FRONTEND ERROR: Subscription creation failed:', error);
      console.log('🎯 FRONTEND DEBUG: =================================');
      console.log('🎯 FRONTEND DEBUG: SUBSCRIPTION CREATION FAILED');
      console.log('🎯 FRONTEND DEBUG: =================================');
      setIsProcessing(false);
      notifications.show({
        title: 'Subscription Error',
        message: 'There was an error setting up your subscription. Please try again.',
        color: 'red'
      });
    }
  };

  if (loading) {
    return (
      <div className="membership-checkout-loading">
        <div className="loading-spinner"></div>
        <p>Loading membership information...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="membership-checkout-error">
        <h2>Authentication Required</h2>
        <p>Please log in to purchase a Jump Club membership.</p>
        <button onClick={() => window.location.href = '/login'} className="cta-button">
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="membership-checkout">
      <div className="checkout-progress">
        <div className={`progress-step ${currentStep === 'benefits' ? 'active' : currentStep === 'terms' || currentStep === 'payment' || currentStep === 'success' ? 'completed' : ''}`}>
          <span>1</span>
          <label>Benefits</label>
        </div>
        <div className={`progress-step ${currentStep === 'terms' ? 'active' : currentStep === 'payment' || currentStep === 'success' ? 'completed' : ''}`}>
          <span>2</span>
          <label>Terms</label>
        </div>
        <div className={`progress-step ${currentStep === 'payment' ? 'active' : currentStep === 'success' ? 'completed' : ''}`}>
          <span>3</span>
          <label>Payment</label>
        </div>
        <div className={`progress-step ${currentStep === 'success' ? 'active completed' : ''}`}>
          <span>4</span>
          <label>Complete</label>
        </div>
      </div>

      {currentStep === 'benefits' && (
        <div className="benefits-step">
          <div className="step-header">
            <h2>Join the Jump Club</h2>
            <div className="membership-price">
              <span className="price">$149</span>
              <span className="period">/month</span>
            </div>
          </div>

          {isAlreadyMember ? (
            <div className="already-member">
              <div className="member-status">
                <h3>🎉 You're Already a Jump Club Member!</h3>
                <p>You have an active Jump Club membership with all the amazing benefits below.</p>
                <button 
                  onClick={() => window.location.href = '/profile'} 
                  className="cta-button"
                >
                  Manage Membership
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="benefits-list">
                <h3>What You Get</h3>
                <div className="benefit-item">
                  <div className="benefit-icon">🎪</div>
                  <div className="benefit-content">
                    <h4>Monthly Inflatable Delivery</h4>
                    <p>Get a premium inflatable delivered to your home every month. Perfect for parties, family fun, or just because!</p>
                  </div>
                </div>
                <div className="benefit-item">
                  <div className="benefit-icon">💰</div>
                  <div className="benefit-content">
                    <h4>25% Off All Rentals</h4>
                    <p>Save big on all other inflatable rentals and party essentials year-round.</p>
                  </div>
                </div>
                <div className="benefit-item">
                  <div className="benefit-icon">🚚</div>
                  <div className="benefit-content">
                    <h4>Free Delivery & Setup</h4>
                    <p>No delivery fees, no setup hassles. We handle everything so you can focus on fun.</p>
                  </div>
                </div>
                <div className="benefit-item">
                  <div className="benefit-icon">📅</div>
                  <div className="benefit-content">
                    <h4>Flexible Scheduling</h4>
                    <p>Cancel or reschedule your monthly delivery with ease. No penalties, just flexibility.</p>
                  </div>
                </div>
              </div>

              <div className="step-actions">
                <button 
                  onClick={() => setCurrentStep('terms')}
                  className="cta-button"
                >
                  Continue to Terms
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {currentStep === 'terms' && (
        <div className="terms-step">
          <div className="step-header">
            <h2>Terms & Conditions</h2>
          </div>

          <div className="terms-content">
            <div className="terms-section">
              <h3>🔄 Recurring Billing</h3>
              <p>Your Jump Club membership will automatically renew monthly at $149/month. Your payment method will be charged on the same date each month.</p>
            </div>

            <div className="terms-section">
              <h3>❌ Cancellation Policy</h3>
              <p>You can cancel your membership at any time from your profile page. Cancellation takes effect at the end of your current billing cycle.</p>
            </div>

            <div className="terms-section">
              <h3>⚠️ Failed Payments</h3>
              <p>If a monthly payment fails, we'll retry up to 3 times. After 3 failed attempts, your membership will be automatically cancelled.</p>
            </div>

            <div className="agreement-checkbox">
              <label>
                <input 
                  type="checkbox" 
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  required 
                />
                I agree to the Terms & Conditions and understand that this is a recurring monthly subscription
              </label>
            </div>
          </div>

          <div className="step-actions">
            <button 
              onClick={() => setCurrentStep('benefits')}
              className="secondary-button"
            >
              Back to Benefits
            </button>
            <button 
              onClick={() => setCurrentStep('payment')}
              className="cta-button"
              disabled={!agreedToTerms}
              style={{
                opacity: agreedToTerms ? 1 : 0.5,
                cursor: agreedToTerms ? 'pointer' : 'not-allowed'
              }}
            >
              Proceed to Payment
            </button>
          </div>
        </div>
      )}

      {currentStep === 'payment' && (
        <div className="payment-step">
          <div className="step-header">
            <h2>Complete Your Membership</h2>
            <div className="payment-summary">
              <div className="summary-item">
                <span>Jump Club Membership</span>
                <span>$149.00/month</span>
              </div>
              <div className="summary-total">
                <span>Total Today</span>
                <span>$149.00</span>
              </div>
            </div>
          </div>

          <div className="payment-info">
            <h3>💳 Subscription Setup</h3>
            <p>By subscribing, you agree to pay $149.00 monthly. PayPal will automatically charge your selected payment method each month. You can cancel anytime from your profile.</p>
          </div>

          <div className="subscription-container">
            <button 
              className="subscription-button"
              onClick={createSubscription}
              disabled={isProcessing}
            >
              {isProcessing ? 'Creating Subscription...' : 'Subscribe '}
            </button>
          </div>

          {isProcessing && (
            <div className="processing-overlay">
              <div className="processing-content">
                <div className="loading-spinner"></div>
                <h3>Setting Up Your Subscription...</h3>
                <p>Activating your Jump Club membership and setting up recurring billing.</p>
              </div>
            </div>
          )}

          <div className="step-actions">
            <button 
              onClick={() => setCurrentStep('terms')}
              className="secondary-button"
              disabled={isProcessing}
            >
              Back to Terms
            </button>
          </div>
        </div>
      )}

      {currentStep === 'success' && (
        <div className="success-step">
          <div className="success-header">
            <div className="success-icon">🎉</div>
            <h2>Welcome to Jump Club!</h2>
            <p>Your membership has been successfully activated</p>
          </div>

          <div className="order-details">
            <h3>Subscription Confirmation</h3>
            <div className="detail-item">
              <span>Subscription ID:</span>
              <span>{orderId}</span>
            </div>
            <div className="detail-item">
              <span>Membership:</span>
              <span>Jump Club</span>
            </div>
            <div className="detail-item">
              <span>Monthly Fee:</span>
              <span>$149.00</span>
            </div>
            <div className="detail-item">
              <span>Next Billing:</span>
              <span>{new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</span>
            </div>
            <div className="detail-item">
              <span>Status:</span>
              <span>Active</span>
            </div>
          </div>

          <div className="next-steps">
            <h3>What Happens Next?</h3>
            <div className="step-item">
              <span>1.</span>
              <p>We'll contact you within 24 hours to schedule your first monthly delivery</p>
            </div>
            <div className="step-item">
              <span>2.</span>
              <p>Your 25% member discount is now active on all other rentals</p>
            </div>
            <div className="step-item">
              <span>3.</span>
              <p>Manage your membership anytime from your profile page</p>
            </div>
          </div>

          <div className="success-actions">
            <button 
              onClick={() => window.location.href = '/profile'}
              className="cta-button"
            >
              View Membership
            </button>
            <button 
              onClick={() => window.location.href = '/'}
              className="secondary-button"
            >
              Back to Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembershipCheckout;