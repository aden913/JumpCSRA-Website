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
} from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import { firebaseConfig } from "./components/FirebaseConfig";

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
  const [name, setName] = useState("");
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
      name,
      phone: rawPhone,
      email: pendingUser.email,
      hasPassword: true,
      usedDiscounts: [], // Initialize empty array for discount tracking
      lastUpdated: new Date().toISOString(),
    }, { merge: true });

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
    let result;
    if (isMobile) {
      await signInWithRedirect(auth, provider);
    } else {
      const { signInWithPopup } = await import("firebase/auth");
      result = await signInWithPopup(auth, provider);
    }

    if (result?.user) {
      const db = getFirestore();
      const userRef = doc(db, "users", result.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists() || !userSnap.data().phone || !userSnap.data().hasPassword) {
        // Incomplete profile → show form
        setPendingUser(result.user);
        setNeedsProfile(true);
        return;
      } else {
        setRedirect(true);
      }
    }
  } catch (err: any) {
    setError(err.message || "Google login failed");
  }
};

// Helper to handle Google user
const handleGoogleResult = async (user: any) => {
  try {
    const db = getFirestore();
    const userRef = doc(db, "users", user.uid);

    // Only create doc if it doesn't exist
    await setDoc(
      userRef,
      {
        name: user.displayName || "",
        phone: user.phoneNumber || "",
        email: user.email || "",
        uid: user.uid,
        usedDiscounts: [], // Initialize empty array for discount tracking
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      },
      { merge: true } // don't overwrite existing data
    );

    setRedirect(true);
  } catch (err: any) {
    console.error("Error saving Google user:", err);
    setError("Failed to save user info");
  }
};

// Handle redirect results (mobile)
useEffect(() => {
  getRedirectResult(auth)
    .then((result) => {
      if (result?.user) {
        handleGoogleResult(result.user);
      }
    })
    .catch((err) => console.error("Redirect result error:", err));
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
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const db = getFirestore();
      
      // Create user document with all required fields including usedDiscounts array
      await setDoc(doc(db, "users", userCred.user.uid), { 
        name, 
        phone,
        email: userCred.user.email || email,
        uid: userCred.user.uid,
        usedDiscounts: [], // Initialize empty array for discount tracking
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      });

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
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Enter your name"
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
              setName("");
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
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Enter your name"
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
