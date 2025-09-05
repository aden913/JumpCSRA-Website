import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import "./styles/login.css";

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [redirect, setRedirect] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRedirect(true);
  };

  if (redirect) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="login-page" >
      <form onSubmit={handleSubmit} className='login-form'>
        <h2 className='login-title'>Sign In</h2>
        <label className='identifier-label'>
          Phone or Email
          <input
            type="text"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            required
            className='identifier-input'
            placeholder="Enter phone or email"
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
          <div className='guest-link-container'>
            <a href="/home" className="guest-link">Continue as guest</a>
          </div>
      </form>
    </div>
  );
}
