/**
 * Cart Abandonment Tracking System
 * Tracks when users abandon carts and schedules reminder emails
 */

import { scheduleCartReminderEmail } from './backendEmailService';

interface CartAbandonmentData {
  userId: string;
  userEmail: string;
  userName: string;
  cartItems: any[];
  cartTotal: number;
  abandonedAt: string;
  reminderScheduledAt?: string;
  reminderSentAt?: string;
}

class CartAbandonmentTracker {
  private storageKey = 'cart_abandonment_data';

  /**
   * Track cart abandonment when user leaves with items in cart
   */
  trackCartAbandonment(userId: string, userEmail: string, userName: string, cartItems: any[], cartTotal: number) {
    if (!userId || !userEmail || cartItems.length === 0) {
      return; // Don't track empty carts or guest users
    }

    const abandonmentData: CartAbandonmentData = {
      userId,
      userEmail,
      userName,
      cartItems: cartItems.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1
      })),
      cartTotal,
      abandonedAt: new Date().toISOString()
    };

    // Store in localStorage for persistence
    localStorage.setItem(`${this.storageKey}_${userId}`, JSON.stringify(abandonmentData));
    
    console.log('🛒 Cart abandonment tracked for user:', userId);
    
    // Schedule reminder email for 24 hours from now
    this.scheduleReminderEmail(abandonmentData);
  }

  /**
   * Clear abandonment tracking when user completes checkout
   */
  clearCartAbandonment(userId: string) {
    localStorage.removeItem(`${this.storageKey}_${userId}`);
    console.log('✅ Cart abandonment cleared for user:', userId);
  }

  /**
   * Update cart abandonment data when cart changes (reset timer)
   */
  updateCartAbandonment(userId: string, userEmail: string, userName: string, cartItems: any[], cartTotal: number) {
    if (!userId || cartItems.length === 0) {
      // Cart is empty, clear tracking
      this.clearCartAbandonment(userId);
      return;
    }

    // Update with new cart data and reset timer
    this.trackCartAbandonment(userId, userEmail, userName, cartItems, cartTotal);
  }

  /**
   * Schedule reminder email for cart abandonment
   */
  private async scheduleReminderEmail(abandonmentData: CartAbandonmentData) {
    try {
      // Check if we should send reminder (24 hours after abandonment)
      const abandonedAt = new Date(abandonmentData.abandonedAt);
      const now = new Date();
      const hoursSinceAbandonment = (now.getTime() - abandonedAt.getTime()) / (1000 * 60 * 60);

      if (hoursSinceAbandonment >= 24) {
        // It's been 24+ hours, send immediately
        await this.sendCartReminderEmail(abandonmentData);
      } else {
        // Schedule for later (in a real app, this would be handled by a backend scheduler)
        const reminderTime = new Date(abandonedAt.getTime() + (24 * 60 * 60 * 1000));
        
        // Store reminder schedule info
        abandonmentData.reminderScheduledAt = reminderTime.toISOString();
        localStorage.setItem(`${this.storageKey}_${abandonmentData.userId}`, JSON.stringify(abandonmentData));
        
        console.log(`📅 Cart reminder scheduled for ${reminderTime.toLocaleString()}`);
        
        // Set timeout for 24 hours (note: this won't persist across page refreshes)
        // In production, you'd want a backend scheduler for this
        setTimeout(() => {
          this.checkAndSendReminder(abandonmentData.userId);
        }, 24 * 60 * 60 * 1000);
      }
    } catch (error) {
      console.error('❌ Failed to schedule cart reminder:', error);
    }
  }

  /**
   * Check if reminder should be sent and send it
   */
  private async checkAndSendReminder(userId: string) {
    const storedData = localStorage.getItem(`${this.storageKey}_${userId}`);
    if (!storedData) return;

    try {
      const abandonmentData: CartAbandonmentData = JSON.parse(storedData);
      
      // Check if reminder was already sent
      if (abandonmentData.reminderSentAt) {
        console.log('📧 Cart reminder already sent for user:', userId);
        return;
      }

      // Check if cart is still abandoned (user hasn't completed checkout)
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      if (cart.length === 0) {
        console.log('🛒 Cart is now empty, skipping reminder for user:', userId);
        this.clearCartAbandonment(userId);
        return;
      }

      // Send reminder email
      await this.sendCartReminderEmail(abandonmentData);
      
    } catch (error) {
      console.error('❌ Error checking cart reminder:', error);
    }
  }

  /**
   * Send cart reminder email
   */
  private async sendCartReminderEmail(abandonmentData: CartAbandonmentData) {
    try {
      await scheduleCartReminderEmail({
        userID: abandonmentData.userId,
        customerEmail: abandonmentData.userEmail,
        customerName: abandonmentData.userName,
        cartItems: abandonmentData.cartItems,
        cartValue: abandonmentData.cartTotal
      });

      // Mark reminder as sent
      abandonmentData.reminderSentAt = new Date().toISOString();
      localStorage.setItem(`${this.storageKey}_${abandonmentData.userId}`, JSON.stringify(abandonmentData));
      
      console.log('✅ Cart reminder email sent successfully to:', abandonmentData.userEmail);
      
    } catch (error) {
      console.error('❌ Failed to send cart reminder email:', error);
    }
  }

  /**
   * Check for pending reminders on app startup
   */
  checkPendingReminders() {
    // Check all stored abandonment data for reminders that need to be sent
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.storageKey)) {
        try {
          const storedData = localStorage.getItem(key);
          if (storedData) {
            const abandonmentData: CartAbandonmentData = JSON.parse(storedData);
            const userId = key.replace(`${this.storageKey}_`, '');
            
            // Check if 24 hours have passed and reminder hasn't been sent
            const abandonedAt = new Date(abandonmentData.abandonedAt);
            const now = new Date();
            const hoursSinceAbandonment = (now.getTime() - abandonedAt.getTime()) / (1000 * 60 * 60);
            
            if (hoursSinceAbandonment >= 24 && !abandonmentData.reminderSentAt) {
              console.log('⏰ Found pending cart reminder for user:', userId);
              this.checkAndSendReminder(userId);
            }
          }
        } catch (error) {
          console.error('❌ Error checking pending reminder:', error);
        }
      }
    }
  }

  /**
   * Get cart abandonment status for a user
   */
  getAbandonmentStatus(userId: string): CartAbandonmentData | null {
    const storedData = localStorage.getItem(`${this.storageKey}_${userId}`);
    if (!storedData) return null;
    
    try {
      return JSON.parse(storedData);
    } catch (error) {
      console.error('❌ Error parsing abandonment data:', error);
      return null;
    }
  }
}

// Create singleton instance
const cartAbandonmentTracker = new CartAbandonmentTracker();

export default cartAbandonmentTracker;

// Named exports for convenience
export const trackCartAbandonment = (userId: string, userEmail: string, userName: string, cartItems: any[], cartTotal: number) =>
  cartAbandonmentTracker.trackCartAbandonment(userId, userEmail, userName, cartItems, cartTotal);

export const clearCartAbandonment = (userId: string) =>
  cartAbandonmentTracker.clearCartAbandonment(userId);

export const updateCartAbandonment = (userId: string, userEmail: string, userName: string, cartItems: any[], cartTotal: number) =>
  cartAbandonmentTracker.updateCartAbandonment(userId, userEmail, userName, cartItems, cartTotal);

export const checkPendingReminders = () =>
  cartAbandonmentTracker.checkPendingReminders();

export const getAbandonmentStatus = (userId: string) =>
  cartAbandonmentTracker.getAbandonmentStatus(userId);