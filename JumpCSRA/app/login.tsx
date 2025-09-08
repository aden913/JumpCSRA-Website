import { isMobile } from 'react-device-detect';

import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import "./styles/login.css";

import { GoogleAuthProvider } from "firebase/auth";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithRedirect, getRedirectResult, signOut  } from "firebase/auth";
import { initializeApp, getApps } from "firebase/app";
import { firebaseConfig } from "./components/FirebaseConfig";

// Initialize Firebase app if not already initialized
if (!getApps().length) {
  initializeApp(firebaseConfig);
}

const provider = new GoogleAuthProvider();
const auth = getAuth();


export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [redirect, setRedirect] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const auth = getAuth();

  // Handle email/password login
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, identifier, password);
      setRedirect(true);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  // Handle Google login
  const handleGoogleLogin = async () => {
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      if (isMobile) {
        await signInWithRedirect(auth, provider);
      } else {
        await import('firebase/auth').then(({ signInWithPopup }) => signInWithPopup(auth, provider));
      }
      // Redirect or popup will handle login
    } catch (err: any) {
      setError(err.message || 'Google login failed');
    }
  };

  // Handle redirect result (Google login)
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          setRedirect(true);
        }
      })
      .catch((err) => {
        // Ignore if no redirect result
      });
  }, [auth]);

  if (redirect) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="login-page">
      <form onSubmit={handleSubmit} className='login-form'>
        <h2 className='login-title'>Sign In</h2>
        {error && <div className="login-error">{error}</div>}
        <label className='identifier-label'>
          Email
          
          <input
            type="email"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            required
            className='identifier-input'
            placeholder="Enter your email"
          />
        </label>
        <label className='password-label'>
          Password
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className='password-input'
            placeholder="Enter password"
          />
        </label>
        <button type="submit" className="sign-in-btn" >
          Sign In
        </button>
        <button type="button" className="google-signin-btn" onClick={handleGoogleLogin} style={{
         width:'auto', display: 'flex', alignItems: 'center',color:'grey', justifyContent: 'center', background: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '0.5rem 1rem', fontWeight: 500, fontSize: '1rem', cursor: 'pointer', marginTop: '1rem'
        }}>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" style={{ width: 24, height: 24, marginRight: 8 }} />
          Sign in with Google
        </button>
        <div className='guest-link-container'>
          <a href="/home" className="guest-link">Continue as guest</a>
        </div>
      </form>
    </div>
  );
}


