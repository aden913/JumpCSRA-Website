import { isMobile } from 'react-device-detect';

import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import "./styles/login.css";

import { GoogleAuthProvider } from "firebase/auth";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithRedirect, getRedirectResult, signOut, updatePassword } from "firebase/auth";
import { sendEmailVerification } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import { firebaseConfig } from "./components/FirebaseConfig";

// Initialize Firebase app if not already initialized
if (!getApps().length) {
  initializeApp(firebaseConfig);
}

const provider = new GoogleAuthProvider();
const auth = getAuth();


// ...existing code...

  export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [redirect, setRedirect] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'email' | 'details'>('email');
  const [isClient, setIsClient] = React.useState(false);
  const auth = getAuth();

    React.useEffect(() => {
      setIsClient(true);
    }, []);

    // Sign in logic
    const handleSignIn = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      try {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        if (!userCred.user.emailVerified) {
          setError('Please verify your email before signing in.');
          return;
        }
        setRedirect(true);
      } catch (err: any) {
        // Firebase error handling
        if (err.code === 'auth/wrong-password') {
          setError('Incorrect password.');
        } else if (err.code === 'auth/user-not-found') {
          setError('No account found with this email.');
        } else if (err.code === 'auth/too-many-requests') {
          setError('Too many login attempts. Please try again later.');
        } else {
          setError(err.message || 'Login failed');
        }
      }
    };

    // Google login
    const handleGoogleLogin = async () => {
      setError(null);
      const provider = new GoogleAuthProvider();
      try {
        if (isMobile) {
          await signInWithRedirect(auth, provider);
        } else {
          await import('firebase/auth').then(({ signInWithPopup }) => signInWithPopup(auth, provider));
        }
      } catch (err: any) {
        setError(err.message || 'Google login failed');
      }
    };

    // Google redirect result
    useEffect(() => {
      getRedirectResult(auth)
        .then((result) => {
          if (result?.user) {
            setRedirect(true);
          }
        })
        .catch(() => {});
    }, [auth]);

    // Sign up logic
    const handleSignUpEmail = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError('Please enter a valid email address.');
        return;
      }
      try {
        await createUserWithEmailAndPassword(auth, email, 'temp-password');
        setStep('details');
      } catch (err: any) {
        setError(err.message || 'Sign up failed');
      }
    };

    const handleSignUpDetails = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      // Password validation
      if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
        setError('Password must be at least 8 characters, include a number and an uppercase letter.');
        return;
      }
      // Phone validation (simple US format)
      const phoneRegex = /^\+?1?\d{10,15}$/;
      if (!phoneRegex.test(phone)) {
        setError('Please enter a valid phone number.');
        return;
      }
      // Name validation
      if (!name.trim()) {
        setError('Please enter your name.');
        return;
      }
      try {
        const user = auth.currentUser;
        if (user) {
          await updatePassword(user, password);
          // Store name and phone number in Firestore
          const db = getFirestore();
          await setDoc(doc(db, "users", user.uid), { name, phone });
          // Send email verification
          await sendEmailVerification(user);
          setIsSignUp(false);
          setStep('email');
          setEmail('');
          setPassword('');
          setPhone('');
          setName('');
          setError('Account created! Please verify your email before signing in.');
        }
      } catch (err: any) {
        // Firebase error handling
        if (err.code === 'auth/weak-password') {
          setError('Password is too weak.');
        } else if (err.code === 'auth/email-already-in-use') {
          setError('Email is already in use.');
        } else if (err.code === 'auth/invalid-phone-number') {
          setError('Invalid phone number.');
        } else {
          setError(err.message || 'Account creation failed');
        }
      }
    };

    if (redirect) {
      return <Navigate to="/home" replace />;
    }

    return (
      <div className="login-page">
        <img src="../public/jumpLogo.jpeg" alt="Jump Logo" className="login-logo" />
        <h2 className='login-title'>{isSignUp ? 'Sign Up' : 'Sign In'}</h2>
        <button className="toggle-btn" onClick={() => { setIsSignUp(!isSignUp); setStep('email'); setError(null); }} style={{ marginBottom: '1rem' }}>
          {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
        </button>
        {isSignUp ? (
          <form onSubmit={step === 'email' ? handleSignUpEmail : handleSignUpDetails} className='signup-form'>
            {error && <div className="login-error">{error}</div>}
            {step === 'email' ? (
              <>
                <label className='identifier-label' >Email
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    id='identifier-input'
                    placeholder="Enter your email"
                  />
                </label>
                <label className='identifier-label' >Name
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    id='name-input'
                    placeholder="Enter your name"
                  />
                </label>
                <button type="submit" className="sign-up-btn">Continue</button>
              </>
            ) : (
              <>
                <label className='identifier-label' >Password
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className='password-input'
                    placeholder="Create a password"
                  />
                </label>
                <label className='identifier-label' >Phone Number
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                    className='phone-input'
                    placeholder="Enter your phone number"
                  />
                </label>
                <button type="submit" className="sign-up-btn">Create Account</button>
              </>
            )}
          </form>
        ) : (
          <form onSubmit={handleSignIn} className='login-form'>
            {error && <div className="login-error">{error}</div>}
            <label className='identifier-label' htmlFor="identifier-input">Email
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                id='identifier-input'
                placeholder="Enter your email"
              />
            </label>
            <label className='identifier-label' htmlFor="password-input">Password
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                id='password-input'
                placeholder="Enter password"
              />
            </label>
            <button type="submit" className="sign-in-btn">Sign In</button>
            <button type="button" className="google-signin-btn" onClick={handleGoogleLogin} style={{
              width:'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '0.5rem 1rem', fontWeight: 500, fontSize: '1rem', cursor: 'pointer', marginTop: '1rem'
            }}>
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" style={{ width: 24, height: 24, marginRight: 8 }} />
              Sign in with Google
            </button>
          </form>
        )}
        <div className='guest-link-container'>
          <a href="/home" className="guest-link">Continue as guest</a>
        </div>
      </div>
    );
  }


