import { isMobile } from "react-device-detect";
import React, { useState, useEffect } from "react";
import { Navigate } from "react-router";
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
} from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import { firebaseConfig } from "./components/FirebaseConfig";
import { sendAccountCreationEmail } from "./utils/backendEmailService";

// Initialize Firebase once
if (!getApps().length) {
  initializeApp(firebaseConfig);
}

const auth = getAuth();
const provider = new GoogleAuthProvider();
setPersistence(auth, browserLocalPersistence);

export default function Login() {
  // States
  const [showSignInForm, setShowSignInForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [forgotPwEmail, setForgotPwEmail] = useState("");
  const [showForgotPw, setShowForgotPw] = useState(false);
  const [forgotPwMsg, setForgotPwMsg] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check if user is already authenticated
  useEffect(() => {
    // Add timeout to prevent indefinite hanging
    const authTimeout = setTimeout(() => {
      console.log("Authentication check timed out after 10 seconds");
      setIsCheckingAuth(false);
    }, 10000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      clearTimeout(authTimeout); // Clear timeout when auth state changes
      
      if (user) {
        console.log("User already signed in:", user.uid);
        
        // Check if user has a complete profile in Firestore
        try {
          const db = getFirestore();
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);

          if (!userSnap.exists() || !userSnap.data().phone || !userSnap.data().hasPassword) {
            // Incomplete profile - show profile completion form
            setPendingUser(user);
            setNeedsProfile(true);
            setIsCheckingAuth(false);
            return;
          }

          // User is fully authenticated and has complete profile - redirect to home
          console.log("User has complete profile, redirecting to home");
          setRedirect(true);
        } catch (error) {
          console.error("Error checking user profile:", error);
          // If there's an error checking profile, still allow user to proceed
          // They're authenticated, so let them through
          setRedirect(true);
        }
      } else {
        // No user signed in, show login page
        console.log("No user signed in, showing login page");
        setIsCheckingAuth(false);
      }
    });

    // Cleanup subscription on unmount
    return () => {
      clearTimeout(authTimeout);
      unsubscribe();
    };
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

    console.log("Google user profile completed, sending welcome email...");
    
    // Send welcome email after Google user completes profile
    try {
      await sendAccountCreationEmail({
        email: pendingUser.email || '',
        name: `${firstName} ${lastName}`,
        uid: pendingUser.uid
      });
      console.log("✅ Welcome email sent to Google user successfully");
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
  setError(null);
  try {
    console.log("Starting Google sign-in...");
    let result;
    if (isMobile) {
      console.log("Using redirect for mobile...");
      await signInWithRedirect(auth, provider);
      return; // Exit here for mobile, redirect result will be handled by useEffect
    } else {
      console.log("Using popup for desktop...");
      const { signInWithPopup } = await import("firebase/auth");
      result = await signInWithPopup(auth, provider);
    }

    if (result?.user) {
      console.log("Google sign-in successful, checking user profile...");
      
      try {
        const db = getFirestore();
        const userRef = doc(db, "users", result.user.uid);
        
        // Wait a moment for auth to fully complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        let userSnap;
        try {
          userSnap = await getDoc(userRef);
        } catch (readError: any) {
          console.error("Error reading user document in handleGoogleLogin:", readError);
          if (readError.code === 'permission-denied') {
            setError("Database access denied. Please contact support if this persists.");
            return;
          }
          throw readError;
        }

        if (!userSnap.exists() || !userSnap.data().phone || !userSnap.data().hasPassword) {
          console.log("Incomplete profile detected, showing profile completion form...");
          // Incomplete profile → show form
          setPendingUser(result.user);
          setNeedsProfile(true);
          return;
        } else {
          console.log("Complete profile found, redirecting...");
          setRedirect(true);
        }
      } catch (dbError: any) {
        console.error("Database error during Google login:", dbError);
        if (dbError.code === 'permission-denied') {
          setError("Database permissions error. Please contact support.");
        } else if (dbError.code === 'unavailable') {
          setError("Database temporarily unavailable. Please try again in a moment.");
        } else {
          setError(`Database error: ${dbError.message}`);
        }
      }
    }
  } catch (err: any) {
    console.error("Google login error:", err);
    
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
    console.log("Processing Google sign-in result for user:", user.uid);
    console.log("User info:", { 
      email: user.email, 
      displayName: user.displayName, 
      emailVerified: user.emailVerified 
    });

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
        console.log("Attempting to read user document...");
        userDoc = await getDoc(userRef);
        console.log("Successfully read user document, exists:", userDoc.exists());
      } catch (readError: any) {
        console.error("Database read access denied:", readError.code);
        
        // If database access is denied, still allow the user to proceed
        // but show a warning and store user data locally
        if (readError.code === 'permission-denied') {
          console.log("Database access denied, proceeding with local authentication only");
          
          // Store user data in localStorage as fallback
          const userData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            emailVerified: user.emailVerified,
            timestamp: new Date().toISOString()
          };
          localStorage.setItem('pendingUserData', JSON.stringify(userData));
          
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

        console.log("Attempting to write user document...");
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

        console.log("User document successfully saved/updated to Firestore");
        
        // Clear any pending local data since database sync worked
        localStorage.removeItem('pendingUserData');
        
        setRedirect(true);
      } catch (writeError: any) {
        console.error("Database write access denied:", writeError.code);
        
        if (writeError.code === 'permission-denied') {
          console.log("Write access denied, but authentication successful. Proceeding...");
          
          // Store user data locally for later sync
          const userData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            emailVerified: user.emailVerified,
            timestamp: new Date().toISOString(),
            needsSync: true
          };
          localStorage.setItem('pendingUserData', JSON.stringify(userData));
          
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
      console.log("Database error occurred, but authentication is valid. Proceeding...");
      
      // Store basic user info locally
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        timestamp: new Date().toISOString(),
        dbError: dbError.code || 'unknown'
      };
      localStorage.setItem('pendingUserData', JSON.stringify(userData));
      
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
  getRedirectResult(auth)
    .then((result) => {
      if (result?.user) {
        console.log("Processing redirect result for user:", result.user.uid);
        handleGoogleResult(result.user);
      }
    })
    .catch((err) => {
      console.error("Redirect result error:", err);
      if (err.code === 'permission-denied') {
        setError("Database access denied. Please contact support if this persists.");
      } else if (err.code === 'auth/popup-closed-by-user') {
        // Don't show error for user-cancelled actions
        return;
      } else {
        setError(`Sign-in error: ${err.message}`);
      }
    });
}, []);

  // ----- SIGN UP -----
  // Step 1: Email check
  const handleSignUpEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email.");
      return;
    }

    try {
      const methods = await fetchSignInMethodsForEmail(auth, email);
      if (methods.length > 0) {
        setError("An account with this email already exists.");
        setIsSignUp(false);
        return;
      }
      // Email is available → proceed
      setStep("details");
    } catch (err: any) {
      setError(err.message || "Error checking email.");
    }
  };

  // Step 2: Create account
  const handleSignUpDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password must be at least 6 chars, with a number & uppercase.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!/^\+?1?\d{10,15}$/.test(phone)) {
      setError("Invalid phone number.");
      return;
    }
    if (!firstName.trim()) {
      setError("Please enter your first name.");
      return;
    }
    if (!lastName.trim()) {
      setError("Please enter your last name.");
      return;
    }

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const db = getFirestore();
      
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

      console.log("User document saved successfully, sending welcome email...");
      
      // Send welcome email after successful account creation
      try {
        await sendAccountCreationEmail({
          email: userCred.user.email || email,
          name: `${firstName} ${lastName}`,
          uid: userCred.user.uid
        });
        console.log("✅ Welcome email sent successfully");
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
          <button
            onClick={() => {
              console.log("Authentication check bypassed by user - going to sign in");
              setIsCheckingAuth(false);
              setShowSignInForm(true);
            }}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Go to Sign In
          </button>
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
          <input
            className="identifier-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Set a password for future logins"
          />
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
      
    
      
      <h2 className="login-title">{isSignUp ? "Sign Up" : "Sign In"}</h2>
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
          onSubmit={step === "email" ? handleSignUpEmail : handleSignUpDetails}
        >
          {error && <div className="login-error">{error}</div>}

          {step === "email" ? (
            <>
              <input
                className="identifier-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
              />
              <button className="sign-up-btn" type="submit">
                Continue
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
            </>
          ) : (
            <>
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
            </>
          )}
        </form>
      )}

      {/* Sign In Form */}
      {!showVerifyMsg && !isSignUp && (
        <form className="signup-form" onSubmit={handleSignIn}>
          <h2 className="login-title">Login To See Past Events</h2>
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

         
            <button
              type="button"
              className="forgot-pw-link"
              
              onClick={() => setShowForgotPw(true)}
            >
              Forgot password?
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


    </div>
  );
}
