import React, { useState, useEffect } from 'react';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { usePayPalVault } from '../hooks/usePayPalVault';
import type { SavedPaymentMethod } from '../utils/databaseUtils';

interface WalletFundingProps {
  userId: string;
  onFundingSuccess: (amount: number) => void;
  onFundingError: (error: string) => void;
}

export function WalletFunding({ userId, onFundingSuccess, onFundingError }: WalletFundingProps) {
  const [amount, setAmount] = useState<string>('');
  const [savePaymentMethod, setSavePaymentMethod] = useState(false);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [useNewPayment, setUseNewPayment] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);

  const {
    loading,
    error,
    createWalletFundingOrder,
    processWalletFunding,
    createOrderWithSavedPayment,
    getSavedPaymentMethods,
    clearError
  } = usePayPalVault();

  // Load saved payment methods on component mount
  useEffect(() => {
    const loadSavedPaymentMethods = async () => {
      try {
        const methods = await getSavedPaymentMethods(userId);
        setSavedPaymentMethods(methods);
      } catch (error) {
        console.error('Error loading saved payment methods:', error);
      }
    };

    loadSavedPaymentMethods();
  }, [userId, getSavedPaymentMethods]);

  // Create PayPal order
  const createPayPalOrder = async (data: any, actions: any) => {
    const fundingAmount = parseFloat(amount);
    
    if (!fundingAmount || fundingAmount < 5 || fundingAmount > 500) {
      throw new Error('Amount must be between $5 and $500');
    }

    let orderData;
    if (useNewPayment) {
      orderData = await createWalletFundingOrder(fundingAmount, savePaymentMethod);
    } else if (selectedPaymentMethod) {
      orderData = await createOrderWithSavedPayment(fundingAmount, selectedPaymentMethod);
    } else {
      throw new Error('Please select a payment method');
    }

    return actions.order.create(orderData);
  };

  // Handle PayPal payment approval
  const onPayPalApprove = async (data: any, actions: any) => {
    setProcessingPayment(true);
    
    try {
      const details = await actions.order.capture();
      const fundingAmount = parseFloat(amount);
      
      const result = await processWalletFunding(
        details,
        fundingAmount,
        useNewPayment && savePaymentMethod
      );

      if (result.success) {
        onFundingSuccess(result.amount || fundingAmount);
        setAmount('');
        setSavePaymentMethod(false);
        
        // Reload saved payment methods if a new one was added
        if (useNewPayment && savePaymentMethod) {
          const updatedMethods = await getSavedPaymentMethods(userId);
          setSavedPaymentMethods(updatedMethods);
        }
      } else {
        onFundingError(result.message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment failed';
      onFundingError(errorMessage);
    } finally {
      setProcessingPayment(false);
    }
  };

  // Handle PayPal payment error
  const onPayPalError = (err: any) => {
    console.error("PayPal error:", err);
    onFundingError('Payment failed. Please try again.');
    setProcessingPayment(false);
  };

  const isValidAmount = amount && parseFloat(amount) >= 5 && parseFloat(amount) <= 500;

  return (
    <div className="wallet-funding-component">
      <div className="funding-options">
        <h6>Add Funds to Wallet</h6>
        
        {/* Amount Input */}
        <div className="amount-input-section">
          <label htmlFor="funding-amount">Amount ($5 - $500):</label>
          <input
            id="funding-amount"
            type="number"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              clearError();
            }}
            placeholder="Enter amount"
            min="5"
            max="500"
            step="0.01"
            style={{
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              width: '200px',
              marginBottom: '1rem'
            }}
          />
        </div>

        {/* Payment Method Selection */}
        {savedPaymentMethods.length > 0 && (
          <div className="payment-method-selection">
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <input
                  type="radio"
                  checked={useNewPayment}
                  onChange={() => setUseNewPayment(true)}
                  style={{ marginRight: '0.5rem' }}
                />
                Use new payment method
              </label>
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <input
                  type="radio"
                  checked={!useNewPayment}
                  onChange={() => setUseNewPayment(false)}
                  style={{ marginRight: '0.5rem' }}
                />
                Use saved payment method
              </label>
            </div>

            {!useNewPayment && (
              <select
                value={selectedPaymentMethod}
                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  width: '100%',
                  marginBottom: '1rem'
                }}
              >
                <option value="">Select a saved payment method</option>
                {savedPaymentMethods.map((method) => (
                  <option key={method.id} value={method.paypalVaultId}>
                    {method.type === 'card' 
                      ? `${method.cardType} ****${method.lastFour}` 
                      : 'PayPal Account'
                    }
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Save Payment Method Option */}
        {useNewPayment && (
          <div className="save-payment-option">
            <label>
              <input
                type="checkbox"
                checked={savePaymentMethod}
                onChange={(e) => setSavePaymentMethod(e.target.checked)}
                style={{ marginRight: '0.5rem' }}
              />
              Save this payment method for future use
            </label>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="error-message" style={{
            color: '#dc3545',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            padding: '0.75rem',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        {/* Processing Indicator */}
        {processingPayment && (
          <div className="processing-indicator" style={{
            backgroundColor: '#e3f2fd',
            border: '1px solid #bbdefb',
            borderRadius: '4px',
            padding: '0.75rem',
            marginBottom: '1rem',
            textAlign: 'center'
          }}>
            Processing payment...
          </div>
        )}

        {/* PayPal Buttons */}
        {isValidAmount && (
          <div className="paypal-funding-buttons">
            <PayPalScriptProvider options={{
              clientId: "AWT5np0jyr8BIdzyJvoWm0X9158l2F0l0rPjE6q925D5VnZVix4uwDRSivBe8Vs4sjCO8Hu-io5mSxM0",
              currency: "USD",
              intent: "capture",
              vault: true // Enable vault for saving payment methods
            }}>
              <PayPalButtons
                style={{
                  layout: "vertical",
                  color: "blue",
                  shape: "rect",
                  label: "pay"
                }}
                createOrder={createPayPalOrder}
                onApprove={onPayPalApprove}
                onError={onPayPalError}
                disabled={processingPayment || loading || (!useNewPayment && !selectedPaymentMethod)}
              />
            </PayPalScriptProvider>
          </div>
        )}

        {/* Quick Amount Buttons */}
        <div className="quick-amounts" style={{ marginTop: '1rem' }}>
          <p style={{ marginBottom: '0.5rem', color: '#666' }}>Quick amounts:</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[10, 25, 50, 100].map((quickAmount) => (
              <button
                key={quickAmount}
                onClick={() => setAmount(quickAmount.toString())}
                style={{
                  backgroundColor: amount === quickAmount.toString() ? '#0070ba' : '#f8f9fa',
                  color: amount === quickAmount.toString() ? 'white' : '#333',
                  border: '1px solid #ddd',
                  padding: '0.5rem 1rem',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                ${quickAmount}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}