import { isMobile } from "react-device-detect";
import React, { useState, useEffect } from "react";
import { Navigate, useSearchParams } from "react-router";
import "./styles/login.css";
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import {
  GoogleAuthProvider,
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  sendEmailVerification,
  fetchSignInMethodsForEmail,
  setPersistence,
  browserLocalPersistence,
  sendPasswordResetEmail,
  updatePassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import { firebaseConfig } from "./components/FirebaseConfig";
import { sendAccountCreationEmail } from "./utils/backendEmailService";

// Add crypto.randomUUID polyfill for browser compatibility
if (typeof window !== 'undefined' && window.crypto && !window.crypto.randomUUID) {
  console.log('🔧 [POLYFILL] Adding crypto.randomUUID polyfill');
  window.crypto.randomUUID = function(): `${string}-${string}-${string}-${string}-${string}` {
    // Generate a UUID v4 using crypto.getRandomValues
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    
    // Set version (4) and variant bits
    array[6] = (array[6] & 0x0f) | 0x40;
    array[8] = (array[8] & 0x3f) | 0x80;
    
    // Convert to hex string with dashes
    const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32)
    ].join('-') as `${string}-${string}-${string}-${string}-${string}`;
  };
}

// Initialize Firebase once
console.log('🔥 [LOGIN DEBUG] Checking Firebase apps...', getApps().length);
console.log('🔥 [LOGIN DEBUG] Firebase config:', firebaseConfig);
console.log('🔥 [LOGIN DEBUG] Environment:', process.env.NODE_ENV);
console.log('🔥 [LOGIN DEBUG] Current URL:', typeof window !== 'undefined' ? window.location.href : 'SSR');

if (!getApps().length) {
  console.log('🔥 [LOGIN DEBUG] Initializing Firebase app...');
  try {
    const app = initializeApp(firebaseConfig);
    console.log('🔥 [LOGIN DEBUG] Firebase app initialized successfully:', app);
  } catch (initError) {
    console.error('🔥 [LOGIN DEBUG] Firebase initialization error:', initError);
  }
} else {
  console.log('🔥 [LOGIN DEBUG] Firebase app already initialized');
}

console.log('🔥 [LOGIN DEBUG] Getting auth instance...');
const auth = getAuth();
console.log('🔥 [LOGIN DEBUG] Auth instance:', auth);
console.log('🔥 [LOGIN DEBUG] Auth app:', auth?.app);
console.log('🔥 [LOGIN DEBUG] Auth currentUser:', auth?.currentUser);

console.log('🔥 [LOGIN DEBUG] Creating Google provider...');
const provider = new GoogleAuthProvider();
console.log('🔥 [LOGIN DEBUG] Google provider:', provider);

// Set auth persistence with error handling
console.log('🔥 [LOGIN DEBUG] Setting auth persistence...');
setPersistence(auth, browserLocalPersistence).then(() => {
  console.log('🔥 [LOGIN DEBUG] Auth persistence set successfully');
}).catch((error) => {
  console.error('🔥 [LOGIN DEBUG] Failed to set auth persistence:', error);
  console.error('🔥 [LOGIN DEBUG] Error details:', {
    code: error.code,
    message: error.message,
    stack: error.stack
  });
  // Continue without persistence if it fails
});

export default function Login() {
  console.log('🚀 [LOGIN DEBUG] Login component initializing...');
  console.log('🚀 [LOGIN DEBUG] Current timestamp:', new Date().toISOString());
  console.log('🚀 [LOGIN DEBUG] User agent:', typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR');
  console.log('🚀 [LOGIN DEBUG] Window object:', typeof window);
  console.log('🚀 [LOGIN DEBUG] Document ready state:', typeof document !== 'undefined' ? document.readyState : 'SSR');
  
  // Check URL parameters
  const [searchParams] = useSearchParams();
  const autoSignUp = searchParams.get('signup') === 'true';
  
  // States
  const [showSignInForm, setShowSignInForm] = useState(autoSignUp);
  const [isSignUp, setIsSignUp] = useState(autoSignUp);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [redirect, setRedirect] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"email" | "details">("email");
  const [showVerifyMsg, setShowVerifyMsg] = useState(false);
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(true);
  const [showConfirmPassword, setShowConfirmPassword] = useState(true);
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [forgotPwEmail, setForgotPwEmail] = useState("");
  const [showForgotPw, setShowForgotPw] = useState(false);
  const [forgotPwMsg, setForgotPwMsg] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check if user is already authenticated
  useEffect(() => {
    console.log('🔐 [AUTH CHECK DEBUG] Starting authentication check...');
    console.log('🔐 [AUTH CHECK DEBUG] Auth object:', auth);
    console.log('🔐 [AUTH CHECK DEBUG] Auth app:', auth?.app);
    
    // Only run on client-side
    if (typeof window === 'undefined') {
      console.log('🔐 [AUTH CHECK DEBUG] Server-side rendering, skipping auth check');
      setIsCheckingAuth(false);
      return;
    }
    
    let authTimeout: NodeJS.Timeout;
    let isAuthResolved = false;
    
    // Check for recent auth check to prevent infinite loops
    const lastAuthCheck = typeof window !== 'undefined' ? localStorage.getItem('lastAuthCheck') : null;
    const now = Date.now();
    console.log('🔐 [AUTH CHECK DEBUG] Last auth check:', lastAuthCheck);
    console.log('🔐 [AUTH CHECK DEBUG] Current time:', now);
    
    // If we just checked auth within the last 5 seconds, skip this check
    if (lastAuthCheck && (now - parseInt(lastAuthCheck)) < 5000) {
      console.log('🔐 [AUTH CHECK DEBUG] Recent auth check detected, skipping...');
      setIsCheckingAuth(false);
      return;
    }
    
    // Store current time as last auth check
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastAuthCheck', now.toString());
    }
    console.log('🔐 [AUTH CHECK DEBUG] Auth check timestamp stored');
    
    // Add timeout to prevent indefinite hanging - increased to 15 seconds for production
    const setAuthTimeout = () => {
      console.log('🔐 [AUTH CHECK DEBUG] Setting 15 second timeout...');
      authTimeout = setTimeout(() => {
        if (!isAuthResolved) {
          console.log('🔐 [AUTH CHECK DEBUG] Auth check timeout reached (15s), forcing resolution');
          if (typeof window !== 'undefined') {
            localStorage.removeItem('lastAuthCheck'); // Clear the check timestamp
          }
          setIsCheckingAuth(false);
          isAuthResolved = true;
        }
      }, 15000);
    };

    setAuthTimeout();

    console.log('🔐 [AUTH CHECK DEBUG] Setting up auth state listener...');
    try {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        console.log('🔐 [AUTH CHECK DEBUG] Auth state changed, user:', user);
        console.log('🔐 [AUTH CHECK DEBUG] User UID:', user?.uid);
        console.log('🔐 [AUTH CHECK DEBUG] User email:', user?.email);
        console.log('🔐 [AUTH CHECK DEBUG] User emailVerified:', user?.emailVerified);
        console.log('🔐 [AUTH CHECK DEBUG] isAuthResolved:', isAuthResolved);
        
        if (isAuthResolved) {
          console.log('🔐 [AUTH CHECK DEBUG] Auth already resolved, ignoring state change');
          return; // Prevent multiple executions
        }
        
        clearTimeout(authTimeout);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('lastAuthCheck'); // Clear the check timestamp
        }
        console.log('🔐 [AUTH CHECK DEBUG] Timeout cleared and timestamp removed');
        
        try {
          if (user) {
            console.log('🔐 [AUTH CHECK DEBUG] User found, checking profile completeness...');
            
            // Check if user has a complete profile in Firestore
            try {
              console.log('🔐 [AUTH CHECK DEBUG] Getting Firestore instance...');
              const db = getFirestore();
              console.log('🔐 [AUTH CHECK DEBUG] Firestore instance:', db);
              
              console.log('🔐 [AUTH CHECK DEBUG] Creating user document reference...');
              const userRef = doc(db, "users", user.uid);
              console.log('🔐 [AUTH CHECK DEBUG] User reference:', userRef);
              
              console.log('🔐 [AUTH CHECK DEBUG] Fetching user document...');
              const userSnap = await getDoc(userRef);
              console.log('🔐 [AUTH CHECK DEBUG] User document snapshot:', userSnap);
              console.log('🔐 [AUTH CHECK DEBUG] Document exists:', userSnap.exists());
              
              if (userSnap.exists()) {
                const userData = userSnap.data();
                console.log('🔐 [AUTH CHECK DEBUG] User data:', userData);
                console.log('🔐 [AUTH CHECK DEBUG] Has phone:', !!userData.phone);
                console.log('🔐 [AUTH CHECK DEBUG] Has password:', !!userData.hasPassword);
              }

              if (!userSnap.exists() || !userSnap.data().phone || !userSnap.data().hasPassword) {
                console.log('🔐 [AUTH CHECK DEBUG] Incomplete profile detected, showing profile form');
                // Incomplete profile - show profile completion form
                setPendingUser(user);
                setNeedsProfile(true);
                setIsCheckingAuth(false);
                isAuthResolved = true;
                return;
              }

              // User is fully authenticated and has complete profile - redirect to home
              console.log('🔐 [AUTH CHECK DEBUG] Complete profile found, redirecting to home');
              setRedirect(true);
              isAuthResolved = true;
            } catch (error: any) {
              console.error('🔐 [AUTH CHECK DEBUG] Error checking user profile:', error);
              console.error('🔐 [AUTH CHECK DEBUG] Error details:', {
                code: error.code,
                message: error.message,
                stack: error.stack
              });
              // If there's an error checking profile, still allow user to proceed
              // They're authenticated, so let them through
              console.log('🔐 [AUTH CHECK DEBUG] Profile check failed, allowing user through anyway');
              setRedirect(true);
              isAuthResolved = true;
            }
          } else {
            // No user signed in, show login page
            console.log('🔐 [AUTH CHECK DEBUG] No user found, showing login page');
            setIsCheckingAuth(false);
            isAuthResolved = true;
          }
        } catch (error: any) {
          console.error('🔐 [AUTH CHECK DEBUG] Error in auth state change handler:', error);
          console.error('🔐 [AUTH CHECK DEBUG] Handler error details:', {
            code: error.code,
            message: error.message,
            stack: error.stack
          });
          setIsCheckingAuth(false);
          isAuthResolved = true;
        }
      });
      
      console.log('🔐 [AUTH CHECK DEBUG] Auth listener set up successfully:', unsubscribe);

      // Cleanup subscription on unmount
      return () => {
        console.log('🔐 [AUTH CHECK DEBUG] Cleaning up auth listener...');
        clearTimeout(authTimeout);
        unsubscribe();
        if (typeof window !== 'undefined') {
          localStorage.removeItem('lastAuthCheck'); // Clean up on unmount
        }
        isAuthResolved = true;
        console.log('🔐 [AUTH CHECK DEBUG] Auth listener cleaned up');
      };
    } catch (error: any) {
      console.error('🔐 [AUTH CHECK DEBUG] Error setting up auth listener:', error);
      console.error('🔐 [AUTH CHECK DEBUG] Setup error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      // Fallback: clear checking state to prevent infinite loading
      console.log('🔐 [AUTH CHECK DEBUG] Fallback: clearing checking state due to setup error');
      setIsCheckingAuth(false);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('lastAuthCheck');
      }
      isAuthResolved = true;
    }
  }, []);

  // SVG icons for password visibility
  const EyeOpen = (
       <img src="/password-revealed.png" alt="Eye Open" className="password-icon" />
  );
  const EyeClosed = (
    <img src="/password-hidden.png" alt="Eye Closed" className="password-icon" />
  );

  // ----- EMAIL LOGIN -----
 const handleSignIn = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);
  try {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    if (!userCred.user.emailVerified) {
      setError("Please verify your email before signing in.");
      return;
    }

    const db = getFirestore();
    const userRef = doc(db, "users", userCred.user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists() || !userSnap.data().phone || !userSnap.data().hasPassword) {
      setPendingUser(userCred.user);
      setNeedsProfile(true);
      return;
    }

    setRedirect(true);
  } catch (err: any) {
    setError(err.message || "Login failed");
  }
};

const handleCompleteProfile = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);
  if (!pendingUser) return;

  // Simple phone normalization: strip non-digits, enforce E.164 later if needed
  const rawPhone = phone.replace(/\D/g, "");
  if (rawPhone.length < 10) {
    setError("Please enter a valid phone number.");
    return;
  }

  if (password.length < 6 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    setError("Password must be at least 6 chars, with a number & uppercase.");
    return;
  }

  if (password !== confirmPassword) {
    setError("Passwords do not match.");
    return;
  }

  try {
    const db = getFirestore();
    await setDoc(doc(db, "users", pendingUser.uid), {
      firstName,
      lastName,
      name: `${firstName} ${lastName}`, // Combined name for compatibility
      phone: rawPhone,
      email: pendingUser.email,
      hasPassword: true,
      usedDiscounts: [], // Initialize empty array for discount tracking
      lastUpdated: new Date().toISOString(),
    }, { merge: true });

    // Debug log removed
    
    // Send welcome email after Google user completes profile
    try {
      await sendAccountCreationEmail({
        email: pendingUser.email || '',
        name: `${firstName} ${lastName}`,
        uid: pendingUser.uid
      });
      // Debug log removed
    } catch (emailError) {
      console.error("❌ Failed to send welcome email to Google user:", emailError);
      // Don't block profile completion if email fails
    }

    await updatePassword(pendingUser, password);

    setNeedsProfile(false);
    setRedirect(true);
  } catch (err: any) {
    setError(err.message || "Failed to complete profile");
  }
};

const handleGoogleLogin = async () => {
  console.log('🔵 [GOOGLE LOGIN DEBUG] Starting Google login...');
  console.log('🔵 [GOOGLE LOGIN DEBUG] isMobile:', isMobile);
  console.log('🔵 [GOOGLE LOGIN DEBUG] Auth object:', auth);
  console.log('🔵 [GOOGLE LOGIN DEBUG] Provider:', provider);
  
  setError(null);
  try {
    let result;
    if (isMobile) {
      console.log('🔵 [GOOGLE LOGIN DEBUG] Using redirect for mobile...');
      await signInWithRedirect(auth, provider);
      console.log('🔵 [GOOGLE LOGIN DEBUG] Redirect initiated');
      return; // Exit here for mobile, redirect result will be handled by useEffect
    } else {
      console.log('🔵 [GOOGLE LOGIN DEBUG] Using popup for desktop...');
      console.log('🔵 [GOOGLE LOGIN DEBUG] Importing signInWithPopup...');
      const { signInWithPopup } = await import("firebase/auth");
      console.log('🔵 [GOOGLE LOGIN DEBUG] signInWithPopup imported:', signInWithPopup);
      console.log('🔵 [GOOGLE LOGIN DEBUG] Calling signInWithPopup...');
      result = await signInWithPopup(auth, provider);
      console.log('🔵 [GOOGLE LOGIN DEBUG] Popup result:', result);
    }

    if (result?.user) {
      console.log('🔵 [GOOGLE LOGIN DEBUG] User received from popup:', result.user);
      
      try {
        console.log('🔵 [GOOGLE LOGIN DEBUG] Getting Firestore instance...');
        const db = getFirestore();
        console.log('🔵 [GOOGLE LOGIN DEBUG] Firestore instance:', db);
        
        const userRef = doc(db, "users", result.user.uid);
        console.log('🔵 [GOOGLE LOGIN DEBUG] User reference created:', userRef);
        
        // Wait a moment for auth to fully complete
        console.log('🔵 [GOOGLE LOGIN DEBUG] Waiting for auth to settle...');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        let userSnap;
        try {
          console.log('🔵 [GOOGLE LOGIN DEBUG] Reading user document...');
          userSnap = await getDoc(userRef);
          console.log('🔵 [GOOGLE LOGIN DEBUG] User document read successfully:', userSnap.exists());
        } catch (readError: any) {
          console.error('🔵 [GOOGLE LOGIN DEBUG] Error reading user document:', readError);
          console.error('🔵 [GOOGLE LOGIN DEBUG] Read error details:', {
            code: readError.code,
            message: readError.message,
            stack: readError.stack
          });
          if (readError.code === 'permission-denied') {
            setError("Database access denied. Please contact support if this persists.");
            return;
          }
          throw readError;
        }

        if (!userSnap.exists() || !userSnap.data().phone || !userSnap.data().hasPassword) {
          console.log('🔵 [GOOGLE LOGIN DEBUG] Incomplete profile, showing completion form');
          // Incomplete profile → show form
          setPendingUser(result.user);
          setNeedsProfile(true);
          return;
        } else {
          console.log('🔵 [GOOGLE LOGIN DEBUG] Complete profile found, redirecting');
          setRedirect(true);
        }
      } catch (dbError: any) {
        console.error('🔵 [GOOGLE LOGIN DEBUG] Database error during Google login:', dbError);
        console.error('🔵 [GOOGLE LOGIN DEBUG] Database error details:', {
          code: dbError.code,
          message: dbError.message,
          stack: dbError.stack
        });
        if (dbError.code === 'permission-denied') {
          setError("Database permissions error. Please contact support.");
        } else if (dbError.code === 'unavailable') {
          setError("Database temporarily unavailable. Please try again in a moment.");
        } else {
          setError(`Database error: ${dbError.message}`);
        }
      }
    } else {
      console.log('🔵 [GOOGLE LOGIN DEBUG] No user in result');
    }
  } catch (err: any) {
    console.error('🔵 [GOOGLE LOGIN DEBUG] Google login error:', err);
    console.error('🔵 [GOOGLE LOGIN DEBUG] Error details:', {
      code: err.code,
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    
    // Provide specific error messages
    if (err.code === 'auth/popup-closed-by-user') {
      setError("Sign-in was cancelled. Please try again.");
    } else if (err.code === 'auth/popup-blocked') {
      setError("Pop-up was blocked. Please allow pop-ups and try again.");
    } else if (err.code === 'auth/cancelled-popup-request') {
      setError("Multiple sign-in requests. Please try again.");
    } else if (err.code === 'permission-denied') {
      setError("Database access denied. Please contact support.");
    } else {
      setError(err.message || "Google login failed");
    }
  }
};

// Helper to handle Google user
const handleGoogleResult = async (user: any) => {
  try {
    // Debug log removed
    // Debug log removed

    // For now, allow Google sign-in to work even without Firestore access
    // The user authentication is successful, database sync can be handled separately
    
    try {
      const db = getFirestore();
      const userRef = doc(db, "users", user.uid);

      // Wait for authentication to fully complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Try to read user document (test database access)
      let userDoc;
      try {
        // Debug log removed
        userDoc = await getDoc(userRef);
        // Debug log removed
      } catch (readError: any) {
        console.error("Database read access denied:", readError.code);
        
        // If database access is denied, still allow the user to proceed
        // but show a warning and store user data locally
        if (readError.code === 'permission-denied') {
          // Debug log removed
          
          // Store user data in localStorage as fallback
          const userData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            emailVerified: user.emailVerified,
            timestamp: new Date().toISOString()
          };
          if (typeof window !== 'undefined') {
            localStorage.setItem('pendingUserData', JSON.stringify(userData));
          }
          
          // Show informative message but allow sign-in to proceed
          console.warn("Database access is restricted. User data stored locally for now.");
          setRedirect(true);
          return;
        }
        throw readError;
      }

      // Try to write/update user document
      try {
        // Extract firstName and lastName from displayName
        const displayName = user.displayName || "";
        const nameParts = displayName.split(' ');
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(' ') || "";

        // Debug log removed
        await setDoc(
          userRef,
          {
            firstName,
            lastName,
            name: displayName, // Keep combined name for compatibility
            phone: user.phoneNumber || "",
            email: user.email || "",
            uid: user.uid,
            usedDiscounts: userDoc.exists() ? userDoc.data()?.usedDiscounts || [] : [],
            createdAt: userDoc.exists() ? userDoc.data()?.createdAt : new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            emailVerified: user.emailVerified || false,
            lastLogin: new Date().toISOString()
          },
          { merge: true }
        );

        // Debug log removed
        
        // Clear any pending local data since database sync worked
        if (typeof window !== 'undefined') {
          localStorage.removeItem('pendingUserData');
        }
        
        setRedirect(true);
      } catch (writeError: any) {
        console.error("Database write access denied:", writeError.code);
        
        if (writeError.code === 'permission-denied') {
          // Debug log removed
          
          // Store user data locally for later sync
          const userData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            emailVerified: user.emailVerified,
            timestamp: new Date().toISOString(),
            needsSync: true
          };
          if (typeof window !== 'undefined') {
            localStorage.setItem('pendingUserData', JSON.stringify(userData));
          }
          
          // Still allow the user to proceed
          setRedirect(true);
          return;
        }
        throw writeError;
      }
      
    } catch (dbError: any) {
      console.error("Unexpected database error:", dbError);
      
      // Even if database fails, allow the authentication to succeed
      // The user is properly authenticated with Firebase Auth
      // Debug log removed
      
      // Store basic user info locally
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        timestamp: new Date().toISOString(),
        dbError: dbError.code || 'unknown'
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem('pendingUserData', JSON.stringify(userData));
      }
      
      setRedirect(true);
    }
    
  } catch (err: any) {
    console.error("Critical error in handleGoogleResult:", err);
    
    // Only show error for actual authentication failures
    if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
      setError("Authentication failed. Please try signing in again.");
    } else {
      // For other errors, show a more helpful message
      setError("Sign-in completed but there may be a database connectivity issue. You should still be able to use the app.");
      
      // Still redirect after a delay to let user see the message
      setTimeout(() => {
        setRedirect(true);
      }, 3000);
    }
  }
};

// Handle redirect results (mobile)
useEffect(() => {
  console.log('🔄 [REDIRECT DEBUG] Setting up redirect result handler...');
  
  getRedirectResult(auth)
    .then((result) => {
      console.log('🔄 [REDIRECT DEBUG] Redirect result received:', result);
      if (result?.user) {
        console.log('🔄 [REDIRECT DEBUG] User from redirect:', result.user);
        handleGoogleResult(result.user);
      } else {
        console.log('🔄 [REDIRECT DEBUG] No user in redirect result');
      }
    })
    .catch((err) => {
      console.error('🔄 [REDIRECT DEBUG] Redirect result error:', err);
      console.error('🔄 [REDIRECT DEBUG] Error details:', {
        code: err.code,
        message: err.message,
        stack: err.stack
      });
      
      if (err.code === 'permission-denied') {
        setError("Database access denied. Please contact support if this persists.");
      } else if (err.code === 'auth/popup-closed-by-user') {
        // Don't show error for user-cancelled actions
        console.log('🔄 [REDIRECT DEBUG] User cancelled, ignoring error');
        return;
      } else {
        setError(`Sign-in error: ${err.message}`);
      }
    });
}, []);

  // ----- SIGN UP -----
  // Combined sign up handler - all fields in one step
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email.");
      return;
    }

    // Validate password
    if (password.length < 6 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password must be at least 6 chars, with a number & uppercase.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    // Validate phone
    if (!/^\+?1?\d{10,15}$/.test(phone)) {
      setError("Invalid phone number.");
      return;
    }

    // Validate names
    if (!firstName.trim()) {
      setError("Please enter your first name.");
      return;
    }
    if (!lastName.trim()) {
      setError("Please enter your last name.");
      return;
    }

    try {
      const db = getFirestore();
      
      // First check Firestore collection to see if user exists
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", email));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setError("An account with this email already exists.");
        setIsSignUp(false);
        return;
      }

      // Ensure user is signed out before creating new account
      await signOut(auth);

      // Check if email already exists in auth
      const methods = await fetchSignInMethodsForEmail(auth, email);
      if (methods.length > 0) {
        setError("An account with this email already exists.");
        setIsSignUp(false);
        return;
      }

      // Create account
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create user document with all required fields including usedDiscounts array
      await setDoc(doc(db, "users", userCred.user.uid), { 
        firstName,
        lastName,
        name: `${firstName} ${lastName}`, // Keep combined name for compatibility
        phone,
        email: userCred.user.email || email,
        uid: userCred.user.uid,
        usedDiscounts: [], // Initialize empty array for discount tracking
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      });

      // Debug log removed
      
      // Send welcome email after successful account creation
      try {
        await sendAccountCreationEmail({
          email: userCred.user.email || email,
          name: `${firstName} ${lastName}`,
          uid: userCred.user.uid
        });
        // Debug log removed
      } catch (emailError) {
        console.error("❌ Failed to send welcome email:", emailError);
        // Don't block account creation if email fails
      }

      await sendEmailVerification(userCred.user);
      setPendingUser(userCred.user);
      setShowVerifyMsg(true);
      setError(null);
    } catch (err: any) {
      console.error("Signup error:", err);
      setError(err.message || "Account creation failed");
    }
  };

  // ----- FORGOT PASSWORD -----
  const handleForgotPw = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPwMsg(null);
    try {
      await sendPasswordResetEmail(auth, forgotPwEmail);
      setForgotPwMsg("Password reset email sent!");
    } catch (err: any) {
      setForgotPwMsg(err.message || "Failed to send reset email.");
    }
  };

  // Handler for guest access
  const handleGuest = () => {
    setRedirect(true);
  };

  if (redirect) return <Navigate to="/home" replace />;

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="login-page">
        <img src="/jump-logo.png" alt="Jump Logo" className="login-logo" />
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <p>Checking authentication...</p>
          <div style={{ 
            fontSize: '12px', 
            color: '#666', 
            marginTop: '1rem',
            maxWidth: '300px',
            margin: '1rem auto'
          }}>
            This usually takes just a moment. If this screen persists, try the buttons below.
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '1rem' }}>
            <button
              onClick={() => {
                // Debug log removed
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('lastAuthCheck'); // Clear any auth check locks
                }
                setIsCheckingAuth(false);
                setShowSignInForm(true);
                setError(null); // Clear any previous errors
              }}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Skip to Sign In
            </button>
            <button
              onClick={() => {
                // Debug log removed
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('lastAuthCheck'); // Clear any auth check locks
                  window.location.reload();
                }
              }}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Refresh Page
            </button>
          </div>
          <div style={{ 
            fontSize: '11px', 
            color: '#999', 
            marginTop: '0.5rem'
          }}>
            Having persistent issues? Try clearing your browser cache.
          </div>
        </div>
      </div>
    );
  }

  // Show initial landing screen
  if (!showSignInForm && !needsProfile) {
    return (
      <div className="login-page">
        <img src="/jump-logo.png" alt="Jump Logo" className="login-logo" />
        
        <div className="initial-buttons">
          <button
            className="guest-btn"
            onClick={handleGuest}
          >
            Continue To Book Events
          </button>
          
          <button
            className="sign-in-btn"
            onClick={() => setShowSignInForm(true)}
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (needsProfile && pendingUser) {
    return (
      <>

      <div className="login-page">
        <img src="/jump-logo.png" alt="Jump Logo" className="login-logo" />
        <h2 className="login-title">Complete Your Profile</h2>
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={handleCompleteProfile}>
     <PhoneInput
    defaultCountry="US"
    value={phone}
    onChange={(value) => setPhone(value ?? "")}
    className="identifier-input"
    required
    placeholder="Enter phone number"
  />
          <input
            className="identifier-input"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            placeholder="Enter your first name"
          />
          <input
            className="identifier-input"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            placeholder="Enter your last name"
          />
          <div style={{ position: "relative" }}>
            <input
              className="identifier-input"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Set a password for future logins"
              style={{ paddingRight: "2rem" }}
            />
            <span
              style={{
                position: "absolute",
                right: "0.5rem",
                top: "50%",
                transform: "translateY(-50%)",
                cursor: "pointer",
              }}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? EyeOpen : EyeClosed}
            </span>
          </div>
          <div style={{ position: "relative" }}>
            <input
              className="identifier-input"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Confirm password"
              style={{ paddingRight: "2rem" }}
            />
            <span
              style={{
                position: "absolute",
                right: "0.5rem",
                top: "50%",
                transform: "translateY(-50%)",
                cursor: "pointer",
              }}
              onClick={() => setShowConfirmPassword((v) => !v)}
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? EyeOpen : EyeClosed}
            </span>
          </div>
          <button className="sign-up-btn" type="submit">
            Save Profile
          </button>
        </form>
      </div></>
    );
  }

  return (
    <div className="login-page">
      <img src="/jump-logo.png" alt="Jump Logo" className="login-logo" />

      {/* <h2 className="login-title">{isSignUp ? "Sign Up" : "Sign In"}</h2> */}

      {/* Forgot Password Modal */}
      {showForgotPw && (
        <div className="forgot-pw-modal">
          <form onSubmit={handleForgotPw} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label className="forgot-pw-label" htmlFor="forgotPwEmail">Enter your email:</label>
            <input
              id="forgotPwEmail"
              type="email"
              value={forgotPwEmail}
              onChange={(e) => setForgotPwEmail(e.target.value)}
              required
              placeholder="Email address"
              style={{ paddingRight: "2rem" }}
            />
            <button className="send-verification-btn" type="submit">Send Reset Email</button>
            <button
              type="button"
              className="cancel-btn"
              onClick={() => {
                setShowForgotPw(false);
                setForgotPwMsg(null);
              }}
            >
              Cancel
            </button>
            {forgotPwMsg && <div className="login-error">{forgotPwMsg}</div>}
          </form>
        </div>
      )}

      {showVerifyMsg && (
        <div className="verify-msg">
          <p>
            Account created! A verification email has been sent to{" "}
            <b>{pendingUser?.email}</b>.
          </p>
          <p>Please check your inbox and verify your email before signing in.</p>
          <button
            className="resend-btn"
            onClick={async () => {
              if (pendingUser) {
                await sendEmailVerification(pendingUser);
                setError("Verification email resent!");
              }
            }}
            style={{ marginTop: "1rem" }}
          >
            Resend Verification Email
          </button>
          <button
            className="back-btn"
            onClick={() => {
              setShowVerifyMsg(false);
              setIsSignUp(false);
              setStep("email");
              setEmail("");
              setPassword("");
              setPhone("");
              setFirstName("");
              setLastName("");
              setPendingUser(null);
            }}
            style={{ marginTop: "1rem" }}
          >
            Back to Sign In
          </button>
          {/* Show verification email resent message here */}
          {error && <div className="login-error">{error}</div>}
        </div>
      )}

      {/* Hide signup form when verify-msg is showing */}
      {!showVerifyMsg && isSignUp && (
        <form
          className="signup-form"
          onSubmit={handleSignUp}
        >
          {error && <div className="login-error">{error}</div>}

          <input
            className="identifier-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Enter your email"
          />

          <div style={{ position: "relative" }}>
            <input
              className="identifier-input"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Create a password"
              style={{ paddingRight: "2rem" }}
            />
            <span
              style={{
                position: "absolute",
                right: "0.5rem",
                top: "50%",
                transform: "translateY(-50%)",
                cursor: "pointer",
              }}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? EyeOpen : EyeClosed}
            </span>
          </div>

          <div style={{ position: "relative" }}>
            <input
              className="identifier-input"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Confirm password"
              style={{ paddingRight: "2rem" }}
            />
            <span
              style={{
                position: "absolute",
                right: "0.5rem",
                top: "50%",
                transform: "translateY(-50%)",
                cursor: "pointer",
              }}
              onClick={() => setShowConfirmPassword((v) => !v)}
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? EyeOpen : EyeClosed}
            </span>
          </div>

          <PhoneInput
            defaultCountry="US"
            value={phone}
            onChange={(value) => setPhone(value ?? "")}
            className="identifier-input"
            required
            placeholder="Enter phone number"
          />

          <input
            className="identifier-input"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            placeholder="Enter your first name"
          />

          <input
            className="identifier-input"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            placeholder="Enter your last name"
          />

          <button className="sign-up-btn" type="submit">
            Create Account
          </button>

          <button
            type="button"
            className="google-signin-btn"
            onClick={handleGoogleLogin}
            style={{
              width: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#fff",
              border: "1px solid #ccc",
              borderRadius: "4px",
              padding: "0.5rem 1rem",
              fontWeight: 500,
              fontSize: "1rem",
              cursor: "pointer",
              marginTop: "1rem",
            }}
          >
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              alt="Google logo"
              style={{ width: 24, height: 24, marginRight: 8 }}
            />
            Sign in with Google
          </button>
        </form>
      )}

      {/* Sign In Form */}
      {!showVerifyMsg && !isSignUp && (
        <form className="signup-form" onSubmit={handleSignIn}>
          {error && <div className="login-error">{error}</div>}
          <input
            className="identifier-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Enter your email"
          />
          <div style={{ position: "relative" }}>
            <input
              className="identifier-input"
              type={showSignInPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter password"
              style={{ paddingRight: "2rem" }}
            />
            <span
              style={{
                position: "absolute",
                right: "0.5rem",
                top: "50%",
                transform: "translateY(-50%)",
                cursor: "pointer",
              }}
              onClick={() => setShowSignInPassword((v) => !v)}
              aria-label={showSignInPassword ? "Hide password" : "Show password"}
            >
              {showSignInPassword ? EyeOpen : EyeClosed}
            </span>
          </div>
          <button className="sign-in-btn" type="submit">
            Sign In
          </button>
          <button
            type="button"
            className="google-signin-btn"
            onClick={handleGoogleLogin}
            style={{
              width: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#fff",
              border: "1px solid #ccc",
              borderRadius: "4px",
              padding: "0.5rem 1rem",
              fontWeight: 500,
              fontSize: "1rem",
              cursor: "pointer",
              marginTop: "1rem",
            }}
          >
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              alt="Google logo"
              style={{ width: 24, height: 24, marginRight: 8 }}
            />
            Sign in with Google
          </button>

              {/* Back button */}
      <button
        className="back-btn"
        onClick={() => {
          setShowSignInForm(false);
          setIsSignUp(false);
          setStep("email");
          setError(null);
          setShowForgotPw(false);
        }}>
        ← Back
      </button>
         
        </form>
      )}

      {/* Toggle and Forgot Password buttons - positioned together outside of conditional forms */}
      {showSignInForm && !showVerifyMsg && !needsProfile && !showForgotPw && (
        <div className="auth-action-buttons">
          <button
            className="toggle-btn"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setStep("email");
              setError(null);
            }}
          >
            {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
          </button>
          
          {/* Forgot password button - only show during sign-in mode */}
          {!isSignUp && (
            <button
              type="button"
              className="forgot-pw-link"
              onClick={() => setShowForgotPw(true)}
            >
              Forgot password?
            </button>
          )}
        </div>
      )}

    </div>
  );
}
