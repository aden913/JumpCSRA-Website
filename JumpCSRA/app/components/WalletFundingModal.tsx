import React, { useState, useEffect } from 'react';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { validateGiftCard } from '../hooks/useDiscounts';
import { addWalletTransaction } from '../utils/databaseUtils';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { getDatabase, ref, get, set } from 'firebase/database';

interface WalletFundingModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: (amount: number, method: 'gift_card' | 'paypal') => void;
  onError: (message: string) => void;
}

export function WalletFundingModal({ isOpen, onClose, userId, onSuccess, onError }: WalletFundingModalProps) {
  const [activeMethod, setActiveMethod] = useState<'select' | 'gift_card' | 'paypal'>('select');
  const [giftCardCode, setGiftCardCode] = useState('');
  const [giftCardInfo, setGiftCardInfo] = useState<{ balance: number; valid: boolean } | null>(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [paypalAmount, setPaypalAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  // Prevent background scrolling when modal is open
  useModalScrollLock(isOpen);

  if (!isOpen) return null;

  const resetModal = () => {
    setActiveMethod('select');
    setGiftCardCode('');
    setGiftCardInfo(null);
    setTransferAmount('');
    setPaypalAmount('');
    setLoading(false);
    setProcessingPayment(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const validateGiftCardCode = async () => {
    if (!giftCardCode.trim()) return;
    
    setLoading(true);
    try {
      const result = await validateGiftCard(giftCardCode.trim());
      if (result.valid && result.balance) {
        setGiftCardInfo({ balance: result.balance, valid: true });
        setTransferAmount(result.balance.toString()); // Default to full amount
      } else {
        onError(result.message);
        setGiftCardInfo({ balance: 0, valid: false });
      }
    } catch (error) {
      onError('Error validating gift card');
      setGiftCardInfo({ balance: 0, valid: false });
    } finally {
      setLoading(false);
    }
  };

  const processGiftCardTransfer = async () => {
    if (!giftCardInfo || !transferAmount || !giftCardCode.trim()) return;
    const amount = parseFloat(transferAmount);
    if (amount <= 0 || amount > giftCardInfo.balance) {
      onError('Invalid transfer amount');
      return;
    }
    setLoading(true);
    try {
      // Use Realtime Database for gift card
      const db = getDatabase();
      const giftCardRef = ref(db, `giftCards/${giftCardCode.trim()}`);
      const snapshot = await get(giftCardRef);
      if (!snapshot.exists()) {
        onError('Gift card not found');
        return;
      }
      const giftCard = snapshot.val();
      const newBalance = giftCard.currentBalance - amount;
      const isNowEmpty = newBalance <= 0;
      const updatedGiftCard = {
        ...giftCard,
        currentBalance: newBalance,
        status: isNowEmpty ? 'empty' : 'active',
        emptyDate: isNowEmpty ? new Date().toISOString() : giftCard.emptyDate,
        usageHistory: [
          ...(giftCard.usageHistory || []),
          {
            type: 'wallet',
            amount: amount,
            date: new Date().toISOString(),
            walletUserId: userId,
            description: `Transferred $${amount.toFixed(2)} to wallet`
          }
        ],
        lastUpdated: new Date().toISOString()
      };
      await set(giftCardRef, updatedGiftCard);
      // Add to wallet
      const walletSuccess = await addWalletTransaction(userId, {
        type: 'gift_card_redemption',
        amount: amount,
        description: `Gift card transfer: ${giftCardCode.trim()}`,
        giftCardCode: giftCardCode.trim()
      });
      if (walletSuccess) {
        onSuccess(amount, 'gift_card');
        handleClose();
      } else {
        onError('Failed to add funds to wallet');
      }
    } catch (error) {
      console.error('Error processing gift card transfer:', error);
      onError('An error occurred while processing the transfer');
    } finally {
      setLoading(false);
    }
  };

  const createPayPalOrder = async (data: any, actions: any) => {
    const amount = parseFloat(paypalAmount);
    if (!amount || amount < 5 || amount > 500) {
      throw new Error('Amount must be between $5 and $500');
    }

    return actions.order.create({
      intent: "CAPTURE",
      purchase_units: [{
        amount: {
          currency_code: "USD",
          value: amount.toFixed(2)
        },
        description: `Wallet funding: $${amount.toFixed(2)}`
      }]
    });
  };

  const onPayPalApprove = async (data: any, actions: any) => {
    setProcessingPayment(true);
    try {
      const details = await actions.order.capture();
      const amount = parseFloat(paypalAmount);
      
      const success = await addWalletTransaction(userId, {
        type: 'deposit',
        amount: amount,
        description: 'Wallet funded via PayPal',
        paypalTransactionId: details.id
      });

      if (success) {
        onSuccess(amount, 'paypal');
        handleClose();
      } else {
        onError('Failed to add funds to wallet');
      }
    } catch (error) {
      console.error('PayPal payment error:', error);
      onError('Payment failed. Please try again.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const onPayPalError = (err: any) => {
    console.error("PayPal error:", err);
    onError('Payment failed. Please try again.');
    setProcessingPayment(false);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        minWidth: '400px',
        maxWidth: '500px',
        maxHeight: '80vh',
        overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0 }}>Add to Wallet</h3>
          <button
            onClick={handleClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.25rem'
            }}
          >
            ×
          </button>
        </div>

        {activeMethod === 'select' && (
          <div className="method-selection">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button
                onClick={() => setActiveMethod('gift_card')}
                style={{
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  padding: '1rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                🎁 Add via Gift Card
              </button>
              
              <button
                onClick={() => setActiveMethod('paypal')}
                style={{
                  backgroundColor: '#0070ba',
                  color: 'white',
                  border: 'none',
                  padding: '1rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                💳 Add via PayPal
              </button>
            </div>
          </div>
        )}

        {activeMethod === 'gift_card' && (
          <div className="gift-card-method">
            <h4>Add via Gift Card</h4>
            
            <div style={{ marginBottom: '1rem' }}>
              <label>Gift Card Code:</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input
                  type="text"
                  value={giftCardCode}
                  onChange={(e) => {
                    let input = e.target.value.replace(/-/g, '');
                    // Only allow alphanumeric
                    input = input.replace(/[^A-Za-z0-9]/g, '');
                    // Limit to 12 chars
                    input = input.slice(0, 12);
                    // Auto-insert dashes: XXXX-XXXX-XXXX
                    let formatted = input;
                    if (input.length > 4) {
                      formatted = input.slice(0, 4) + '-' + input.slice(4);
                    }
                    if (input.length > 8) {
                      formatted = input.slice(0, 4) + '-' + input.slice(4, 8) + '-' + input.slice(8);
                    }
                    setGiftCardCode(formatted);
                  }}
                  placeholder="Enter gift card code (e.g., Ab3X-Yz9M-Qp2K)"
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    textTransform: 'none',
                    letterSpacing: '0.5px'
                  }}
                />
                <button
                  onClick={validateGiftCardCode}
                  disabled={!giftCardCode.trim() || loading}
                  style={{
                    backgroundColor: '#17a2b8',
                    color: 'white',
                    border: 'none',
                    padding: '0.75rem 1rem',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {loading ? 'Checking...' : 'Check'}
                </button>
              </div>
            </div>

            {giftCardInfo && giftCardInfo.valid && (
              <div style={{ 
                backgroundColor: '#d4edda', 
                border: '1px solid #c3e6cb', 
                borderRadius: '4px', 
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <h5 style={{ margin: '0 0 0.5rem 0', color: '#155724' }}>Gift Card Information</h5>
                <p style={{ margin: '0 0 0.5rem 0' }}>
                  <strong>Available Balance:</strong> ${giftCardInfo.balance.toFixed(2)}
                </p>
                
                <div style={{ marginTop: '1rem' }}>
                  <label>Amount to transfer to wallet:</label>
                  <input
                    type="number"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    min="0"
                    max={giftCardInfo.balance}
                    step="0.01"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      marginTop: '0.5rem'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button
                    onClick={() => setActiveMethod('select')}
                    style={{
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      padding: '0.75rem 1rem',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Back
                  </button>
                  
                  <button
                    onClick={processGiftCardTransfer}
                    disabled={!transferAmount || parseFloat(transferAmount) <= 0 || parseFloat(transferAmount) > giftCardInfo.balance || loading}
                    style={{
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      padding: '0.75rem 1rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      flex: 1
                    }}
                  >
                    {loading ? 'Processing...' : `Transfer $${transferAmount || '0'}`}
                  </button>
                </div>
              </div>
            )}

            {!giftCardInfo && (
              <button
                onClick={() => setActiveMethod('select')}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1rem',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Back
              </button>
            )}
          </div>
        )}

        {activeMethod === 'paypal' && (
          <div className="paypal-method">
            <h4>Add via PayPal</h4>
            
            <div style={{ marginBottom: '1rem' }}>
              <label>Amount ($5 - $500):</label>
              <input
                type="number"
                value={paypalAmount}
                onChange={(e) => setPaypalAmount(e.target.value)}
                placeholder="Enter amount"
                min="5"
                max="500"
                step="0.01"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  marginTop: '0.5rem'
                }}
              />
            </div>

            {processingPayment && (
              <div style={{
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

            {paypalAmount && parseFloat(paypalAmount) >= 5 && parseFloat(paypalAmount) <= 500 && (
              <div style={{ marginBottom: '1rem' }}>
                <PayPalScriptProvider options={{
                  clientId: "AWT5np0jyr8BIdzyJvoWm0X9158l2F0l0rPjE6q925D5VnZVix4uwDRSivBe8Vs4sjCO8Hu-io5mSxM0",
                  currency: "USD",
                  intent: "capture"
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
                    disabled={processingPayment}
                  />
                </PayPalScriptProvider>
              </div>
            )}

            <button
              onClick={() => setActiveMethod('select')}
              style={{
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1rem',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}