import { useState, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { addSavedPaymentMethod, addWalletTransaction, getUserPaymentInfo } from '../utils/databaseUtils';
import type { SavedPaymentMethod } from '../utils/databaseUtils';

export interface PayPalVaultToken {
  id: string;
  status: string;
  customer?: {
    id: string;
  };
  payment_source?: {
    card?: {
      last_digits: string;
      brand: string;
      expiry: string;
    };
    paypal?: {
      email_address: string;
      account_id: string;
    };
  };
}

export interface WalletFundingResult {
  success: boolean;
  message: string;
  transactionId?: string;
  amount?: number;
}

export function usePayPalVault() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create PayPal order for wallet funding with vault
  const createWalletFundingOrder = useCallback(async (amount: number, savePaymentMethod: boolean = false) => {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const orderData = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: amount.toFixed(2)
          },
          description: `Wallet funding: $${amount.toFixed(2)}`
        }
      ],
      payment_source: savePaymentMethod ? {
        paypal: {
          attributes: {
            vault: {
              store_in_vault: "ON_SUCCESS",
              usage_pattern: "IMMEDIATE",
              usage_type: "MERCHANT"
            }
          }
        }
      } : undefined
    };

    return orderData;
  }, []);

  // Process wallet funding after PayPal approval
  const processWalletFunding = useCallback(async (
    orderDetails: any,
    amount: number,
    savePaymentMethod: boolean = false
  ): Promise<WalletFundingResult> => {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, message: 'User not authenticated' };
    }

    setLoading(true);
    setError(null);

    try {
      const paymentId = orderDetails.id;
      const paidAmount = parseFloat(orderDetails.purchase_units[0].amount.value);

      // Add transaction to user's wallet
      const walletSuccess = await addWalletTransaction(user.uid, {
        type: 'deposit',
        amount: paidAmount,
        description: `Wallet funded via PayPal`,
        paypalTransactionId: paymentId
      });

      if (!walletSuccess) {
        return { success: false, message: 'Failed to add funds to wallet' };
      }

      // Save payment method to vault if requested and vault token is available
      if (savePaymentMethod && orderDetails.payment_source) {
        await savePaymentMethodFromOrder(orderDetails, user.uid);
      }

      return {
        success: true,
        message: `Successfully added $${paidAmount.toFixed(2)} to your wallet`,
        transactionId: paymentId,
        amount: paidAmount
      };

    } catch (error) {
      console.error('Error processing wallet funding:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  // Save payment method from successful order to vault
  const savePaymentMethodFromOrder = useCallback(async (orderDetails: any, userId: string) => {
    try {
      const paymentSource = orderDetails.payment_source;
      
      if (paymentSource?.paypal) {
        // PayPal payment method
        const paypalData = paymentSource.paypal;
        const paymentMethod: Omit<SavedPaymentMethod, 'id' | 'createdAt'> = {
          paypalVaultId: paypalData.vault_id || orderDetails.id,
          type: 'paypal',
          isDefault: false
        };

        await addSavedPaymentMethod(userId, paymentMethod);
        console.log('PayPal payment method saved to vault');
      } else if (paymentSource?.card) {
        // Card payment method
        const cardData = paymentSource.card;
        const paymentMethod: Omit<SavedPaymentMethod, 'id' | 'createdAt'> = {
          paypalVaultId: cardData.vault_id || orderDetails.id,
          type: 'card',
          lastFour: cardData.last_digits,
          cardType: cardData.brand,
          expiryMonth: cardData.expiry?.split('/')[0],
          expiryYear: cardData.expiry?.split('/')[1],
          isDefault: false
        };

        await addSavedPaymentMethod(userId, paymentMethod);
        console.log('Card payment method saved to vault');
      }
    } catch (error) {
      console.error('Error saving payment method to vault:', error);
      // Don't throw error here - wallet funding should still succeed
    }
  }, []);

  // Create order for using saved payment method
  const createOrderWithSavedPayment = useCallback(async (
    amount: number, 
    vaultId: string
  ) => {
    const orderData = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: amount.toFixed(2)
          },
          description: `Wallet funding: $${amount.toFixed(2)}`
        }
      ],
      payment_source: {
        paypal: {
          vault_id: vaultId
        }
      }
    };

    return orderData;
  }, []);

  // Get user's saved payment methods
  const getSavedPaymentMethods = useCallback(async (userId: string): Promise<SavedPaymentMethod[]> => {
    try {
      const paymentInfo = await getUserPaymentInfo(userId);
      return paymentInfo?.savedPaymentMethods || [];
    } catch (error) {
      console.error('Error getting saved payment methods:', error);
      return [];
    }
  }, []);

  return {
    loading,
    error,
    createWalletFundingOrder,
    processWalletFunding,
    createOrderWithSavedPayment,
    getSavedPaymentMethods,
    clearError: () => setError(null)
  };
}