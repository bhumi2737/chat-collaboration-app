import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export const AuthScreen = () => {
  const { login, register, error, setError } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (isRegister) {
        await register({ username, email, password, fullName });
      } else {
        await login(emailOrUsername, password);
      }
    } catch (err) {
      // Error handled by AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async (demoEmail) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await login(demoEmail, 'password123');
    } catch (err) {
      console.error('Demo login error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-badge">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <h1>Chat & Collaboration</h1>
          <p className="auth-subtitle">Real-time messaging, team groups, presence & collaboration</p>
        </div>

        {/* Tab switch */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${!isRegister ? 'active' : ''}`}
            onClick={() => {
              setIsRegister(false);
              setError(null);
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${isRegister ? 'active' : ''}`}
            onClick={() => {
              setIsRegister(true);
              setError(null);
            }}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="auth-error-banner">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister ? (
            <>
              <div className="form-group">
                <label htmlFor="reg-fullname">Full Name</label>
                <input
                  id="reg-fullname"
                  type="text"
                  placeholder="e.g. Alice Johnson"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-username">Username</label>
                <input
                  id="reg-username"
                  type="text"
                  placeholder="e.g. alice"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  minLength={3}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-email">Email Address</label>
                <input
                  id="reg-email"
                  type="email"
                  placeholder="alice@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-password">Password (min 6 characters)</label>
                <input
                  id="reg-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="login-identity">Email or Username</label>
                <input
                  id="login-identity"
                  type="text"
                  placeholder="alice@example.com or alice"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <button type="submit" className="btn-primary auth-submit-btn" disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="spinner-sm"></span>
            ) : isRegister ? (
              'Create Account'
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Quick Demo Logins */}
        <div className="demo-accounts-section">
          <div className="demo-accounts-divider">
            <span>Or test with demo evaluation users</span>
          </div>
          <div className="demo-buttons-grid">
            <button
              type="button"
              className="btn-demo"
              onClick={() => handleDemoLogin('alice@example.com')}
              disabled={isSubmitting}
            >
              <span className="demo-badge alice">A</span>
              <div className="demo-text">
                <strong>Alice</strong>
                <small>Lead Admin</small>
              </div>
            </button>
            <button
              type="button"
              className="btn-demo"
              onClick={() => handleDemoLogin('bob@example.com')}
              disabled={isSubmitting}
            >
              <span className="demo-badge bob">B</span>
              <div className="demo-text">
                <strong>Bob</strong>
                <small>Team Member</small>
              </div>
            </button>
            <button
              type="button"
              className="btn-demo"
              onClick={() => handleDemoLogin('charlie@example.com')}
              disabled={isSubmitting}
            >
              <span className="demo-badge charlie">C</span>
              <div className="demo-text">
                <strong>Charlie</strong>
                <small>Team Member</small>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
