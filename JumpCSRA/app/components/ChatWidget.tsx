import React, { useState, useEffect } from 'react';
import { auth, firestore } from './FirebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { User as FirebaseUser } from 'firebase/auth';

interface UserData {
  email?: string;
  phone?: string;
  name?: string;
}

const ChatWidget: React.FC = () => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [userData, setUserData] = useState<UserData>({});
  const [showContactForm, setShowContactForm] = useState(false);
  const [tempEmail, setTempEmail] = useState('');
  const [tempPhone, setTempPhone] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Get user data from Firestore
        try {
          const userDoc = await getDoc(doc(firestore, 'users', u.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserData({
              email: data.email || u.email,
              phone: data.phone,
              name: data.name || u.displayName
            });
          } else {
            setUserData({
              email: u.email || '',
              name: u.displayName || ''
            });
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUserData({
            email: u.email || '',
            name: u.displayName || ''
          });
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const validateAndSend = async () => {
    if (!message.trim()) {
      alert('Please enter a message');
      return;
    }

    // Check if we have email or phone
    const hasEmail = userData.email || tempEmail;
    const hasPhone = userData.phone || tempPhone;

    if (!hasEmail && !hasPhone) {
      setShowContactForm(true);
      return;
    }

    await sendMessage();
  };

  const sendMessage = async () => {
    setIsSending(true);
    setSendStatus('idle');

    try {
      const functions = getFunctions();
      const sendChatMessage = httpsCallable(functions, 'sendChatMessage');

      const result = await sendChatMessage({
        message: message.trim(),
        userEmail: userData.email || tempEmail,
        userPhone: userData.phone || tempPhone,
        userName: userData.name || 'Customer'
      });

      if (result.data && (result.data as any).success) {
        setSendStatus('success');
        setMessage('');
        setTempEmail('');
        setTempPhone('');
        setShowContactForm(false);
        
        // Auto close after 3 seconds
        setTimeout(() => {
          setSendStatus('idle');
          setIsOpen(false);
        }, 3000);
      } else {
        setSendStatus('error');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setSendStatus('error');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      validateAndSend();
    }
  };

  // Don't render if user is not logged in
  if (!user) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen ? (
        <div className="bg-white rounded-lg shadow-2xl border border-gray-200 w-80 max-h-96">
          {/* Header */}
          <div className="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center">
            <h3 className="font-semibold">Need Help?</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-gray-200 text-xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {sendStatus === 'success' ? (
              <div className="text-center py-6">
                <div className="text-green-600 text-4xl mb-2">✓</div>
                <p className="text-green-600 font-semibold">Message sent successfully!</p>
                <p className="text-gray-600 text-sm mt-1">We'll get back to you soon.</p>
              </div>
            ) : sendStatus === 'error' ? (
              <div className="text-center py-6">
                <div className="text-red-600 text-4xl mb-2">✗</div>
                <p className="text-red-600 font-semibold">Failed to send message</p>
                <p className="text-gray-600 text-sm mt-1">Please try again or call us directly.</p>
                <button
                  onClick={() => setSendStatus('idle')}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Try Again
                </button>
              </div>
            ) : showContactForm ? (
              <div>
                <p className="text-sm text-gray-600 mb-3">
                  We need your contact info to respond to your message:
                </p>
                <input
                  type="email"
                  placeholder="Your email"
                  value={tempEmail}
                  onChange={(e) => setTempEmail(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded mb-2"
                />
                <input
                  type="tel"
                  placeholder="Your phone number (optional)"
                  value={tempPhone}
                  onChange={(e) => setTempPhone(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded mb-3"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowContactForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={sendMessage}
                    disabled={isSending || !tempEmail}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {isSending ? 'Sending...' : 'Send Message'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600 mb-3">
                  Send us a message and we'll get back to you soon!
                </p>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message here..."
                  className="w-full p-3 border border-gray-300 rounded-lg resize-none h-24"
                  disabled={isSending}
                />
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={validateAndSend}
                    disabled={isSending || !message.trim()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                  >
                    {isSending ? 'Sending...' : 'Send Message'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 text-white px-4 py-3 rounded-full shadow-lg hover:bg-blue-700 transition-all transform hover:scale-105"
        >
          💬 Need Help?
        </button>
      )}
    </div>
  );
};

export default ChatWidget;