import { isMobile } from 'react-device-detect';

import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import "./styles/login.css";

import { GoogleAuthProvider } from "firebase/auth";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithRedirect, getRedirectResult, signOut, updatePassword } from "firebase/auth";
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
        await signInWithEmailAndPassword(auth, email, password);
        setRedirect(true);
      } catch (err: any) {
        setError(err.message || 'Login failed');
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
      try {
        const user = auth.currentUser;
        if (user) {
          await updatePassword(user, password);
          // Store phone number in Firestore
          const db = getFirestore();
          await setDoc(doc(db, "users", user.uid), { phone });
          setIsSignUp(false);
          setStep('email');
          setEmail('');
          setPassword('');
          setPhone('');
          setError(null);
        }
      } catch (err: any) {
        setError(err.message || 'Account creation failed');
      }
    };

    if (redirect) {
      return <Navigate to="/home" replace />;
    }

    return (
      <div className="login-page">
        <h2 className='login-title'>{isSignUp ? 'Sign Up' : 'Sign In'}</h2>
        <button className="toggle-btn" onClick={() => { setIsSignUp(!isSignUp); setStep('email'); setError(null); }} style={{ marginBottom: '1rem' }}>
          {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
        </button>
        {isSignUp ? (
          <form onSubmit={step === 'email' ? handleSignUpEmail : handleSignUpDetails} className='signup-form'>
            {error && <div className="login-error">{error}</div>}
            {step === 'email' ? (
              <>
                <label>Email
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className='identifier-input'
                    placeholder="Enter your email"
                  />
                </label>
                <button type="submit" className="sign-up-btn">Continue</button>
              </>
            ) : (
              <>
                <label>Password
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className='password-input'
                    placeholder="Create a password"
                  />
                </label>
                <label>Phone Number
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
            <label>Email
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className='identifier-input'
                placeholder="Enter your email"
              />
            </label>
            <label>Password
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className='password-input'
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


