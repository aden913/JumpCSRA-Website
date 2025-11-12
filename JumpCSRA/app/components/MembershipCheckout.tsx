import React, { useState, useEffect } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
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

  const paypalOptions = {
    clientId: "AcxW1Ok9Z8KpBUU9_JD-kQ3hFKvJ2HCCXDEHCsD0S4u7-Y4PcW3nwqLzYcq5aHUVKOhAZ2tJ9MXJixCO", // Sandbox client ID
    currency: "USD",
    intent: "capture" as const,
    vault: true,
    components: "buttons",
  };

  const createOrder = async () => {
    if (!user) {
      throw new Error('User must be logged in');
    }

    try {
      const response = await fetch('/api/create-membership-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          amount: 149.00,
          currency: 'USD'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create order');
      }

      const data = await response.json();
      return data.orderId;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  };

  const handleApprove = async (data: any) => {
    setIsProcessing(true);
    
    try {
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Capture the payment and set up vault
      const response = await fetch('/api/capture-membership-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: data.orderID,
          userId: user.uid,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process payment');
      }

      const result = await response.json();
      
      if (result.success) {
        // Update membership status
        await updateUserMembership(user.uid, 'jump-club', true);
        await updateMembershipDateStarted(user.uid, 'jump-club');
        
        setOrderId(data.orderID);
        setCurrentStep('success');
        
        notifications.show({
          title: 'Welcome to Jump Club!',
          message: 'Your membership has been activated and payment method saved for recurring billing.',
          color: 'green',
          autoClose: 6000,
        });
      } else {
        throw new Error(result.error || 'Payment processing failed');
      }
    } catch (error) {
      console.error('Payment error:', error);
      notifications.show({
        title: 'Payment Failed',
        message: 'There was an issue processing your payment. Please try again.',
        color: 'red',
        autoClose: 8000,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleError = (error: any) => {
    console.error('PayPal error:', error);
    notifications.show({
      title: 'Payment Error',
      message: 'There was an issue with the payment process. Please try again.',
      color: 'red',
      autoClose: 8000,
    });
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
                  <div className="benefit-icon">🎯</div>
                  <div className="benefit-content">
                    <h4>Priority Booking</h4>
                    <p>Get first access to popular inflatables and preferred scheduling for events.</p>
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
              <h3>💳 Payment Method Storage</h3>
              <p>We securely store your payment information with PayPal for automatic monthly billing. Your payment details are never stored on our servers.</p>
            </div>

            <div className="terms-section">
              <h3>❌ Cancellation Policy</h3>
              <p>You can cancel your membership at any time from your profile page. Cancellation takes effect at the end of your current billing cycle.</p>
            </div>

            <div className="terms-section">
              <h3>⚠️ Failed Payments</h3>
              <p>If a monthly payment fails, we'll retry up to 3 times. After 3 failed attempts, your membership will be automatically cancelled.</p>
            </div>

            <div className="terms-section">
              <h3>📦 Monthly Delivery</h3>
              <p>Your monthly inflatable will be delivered within the first week of each billing cycle. Scheduling is subject to availability and weather conditions.</p>
            </div>

            <div className="agreement-checkbox">
              <label>
                <input type="checkbox" required />
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
            <h3>💳 Payment & Recurring Billing Setup</h3>
            <p>This payment method will be securely saved for your monthly membership charges. You can update or change it anytime in your profile.</p>
          </div>

          <div className="paypal-container">
            <PayPalScriptProvider options={paypalOptions}>
              <PayPalButtons
                createOrder={createOrder}
                onApprove={handleApprove}
                onError={handleError}
                disabled={isProcessing}
                style={{
                  layout: 'vertical',
                  color: 'blue',
                  shape: 'rect',
                  label: 'paypal',
                }}
              />
            </PayPalScriptProvider>
          </div>

          {isProcessing && (
            <div className="processing-overlay">
              <div className="processing-content">
                <div className="loading-spinner"></div>
                <h3>Processing Your Membership...</h3>
                <p>Setting up your payment method and activating your Jump Club benefits.</p>
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
            <h3>Order Confirmation</h3>
            <div className="detail-item">
              <span>Order ID:</span>
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