import { isMobile } from "react-device-detect";
import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import "./styles/login.css";

import {
  GoogleAuthProvider,
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  signInWithPhoneNumber,
  signInWithCredential,
  PhoneAuthProvider,
  sendEmailVerification,
  fetchSignInMethodsForEmail,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
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
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [redirect, setRedirect] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"email" | "details">("email");
  const [phoneSignIn, setPhoneSignIn] = useState(false);
  const [phoneSignInNumber, setPhoneSignInNumber] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<any>(null);
  const [showVerifyMsg, setShowVerifyMsg] = useState(false);
  const [pendingUser, setPendingUser] = useState<any>(null);

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
      setRedirect(true);
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };

  // ----- GOOGLE LOGIN -----
  const handleGoogleLogin = async () => {
    setError(null);
    try {
      if (isMobile) {
        await signInWithRedirect(auth, provider);
      } else {
        const { signInWithPopup } = await import("firebase/auth");
        await signInWithPopup(auth, provider);
      }
    } catch (err: any) {
      setError(err.message || "Google login failed");
    }
  };

  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) setRedirect(true);
      })
      .catch(() => {});
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

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password must be 8+ chars, include a number & uppercase.");
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
      await setDoc(doc(db, "users", userCred.user.uid), { name, phone });

      await sendEmailVerification(userCred.user);
      console.log("Verification email sent to:", userCred.user.email);

      setPendingUser(userCred.user);
      setShowVerifyMsg(true);
      setError(null);
    } catch (err: any) {
      console.error("Signup error:", err);
      setError(err.message || "Account creation failed");
    }
  };

  // ----- PHONE LOGIN -----
  const handlePhoneSignInRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      let verifier = recaptchaVerifier;
      if (!verifier) {
        verifier = new (window as any).firebase.auth.RecaptchaVerifier(
          "recaptcha-container",
          { size: "invisible" },
          auth
        );
        setRecaptchaVerifier(verifier);
      }
      const confirmation = await signInWithPhoneNumber(auth, phoneSignInNumber, verifier);
      setVerificationId(confirmation.verificationId);
      setError("SMS code sent!");
    } catch (err: any) {
      setError(err.message || "Failed to send SMS code.");
    }
  };

  const handlePhoneSignInVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
      await signInWithCredential(auth, credential);
      setRedirect(true);
    } catch (err: any) {
      setError(err.message || "Failed to verify code.");
    }
  };

  if (redirect) return <Navigate to="/home" replace />;

  return (
    <div className="login-page">
      <img src="/jumpLogo.jpeg" alt="Jump Logo" className="login-logo" />
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
                console.log("Resent verification email to:", pendingUser.email);
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
          {error && <div className="login-error">{error}</div>}
        </div>
      )}

      {isSignUp ? (
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
              <input
                className="identifier-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Create a password"
              />
              <input
                className="identifier-input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
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
      ) : (
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
          <input
            className="identifier-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Enter password"
          />
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
            className="phone-signin-btn"
            type="button"
            onClick={() => setPhoneSignIn(true)}
          >
            Sign in with Phone
          </button>
        </form>
      )}

      {phoneSignIn && (
        <>
          <form onSubmit={handlePhoneSignInRequest}>
            <input
              className="identifier-input"
              type="tel"
              value={phoneSignInNumber}
              onChange={(e) => setPhoneSignInNumber(e.target.value)}
              required
              placeholder="Enter phone number"
            />
            <div id="recaptcha-container"></div>
            <button type="submit">Send Verification Code</button>
          </form>
          {verificationId && (
            <form onSubmit={handlePhoneSignInVerify}>
              <input
                className="identifier-input"
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                required
                placeholder="Enter verification code"
              />
              <button type="submit">Verify & Sign In</button>
            </form>
          )}
          <button onClick={() => setPhoneSignIn(false)}>Back</button>
        </>
      )}
    </div>
  );
}
