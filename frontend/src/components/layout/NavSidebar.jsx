import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useChat } from '../../context/ChatContext';
import { ProfileModal } from '../modals/ProfileModal';

export const NavSidebar = ({ onOpenNewChat, onOpenNewGroup }) => {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();
  const { conversations } = useChat();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const directCount = conversations.filter((c) => c.type === 'direct').length;
  const groupCount = conversations.filter((c) => c.type === 'group').length;

  return (
    <>
      {/* Mobile Top Bar (visible only on small screens) */}
      <header className="mobile-header">
        <div className="mobile-brand">
          <div className="brand-monogram">CC</div>
          <span className="mobile-brand-title">CollabChat</span>
        </div>
        <div className="mobile-header-actions">
          <button
            type="button"
            className="mobile-action-btn"
            onClick={onOpenNewChat}
            title="Start direct conversation"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <line x1="20" y1="8" x2="20" y2="14"></line>
              <line x1="23" y1="11" x2="17" y2="11"></line>
            </svg>
          </button>
          <button
            type="button"
            className="mobile-action-btn primary"
            onClick={onOpenNewGroup}
            title="Create group"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </button>
          <button
            type="button"
            className="mobile-action-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            title="Account Menu"
          >
            <img src={user?.avatarUrl} alt={user?.fullName} className="mobile-avatar" />
          </button>
        </div>
      </header>

      {/* Desktop Column 1: Navigation Sidebar (Midnight Navy #1D2B43) */}
      <nav className={`nav-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="nav-sidebar-top">
          {/* Brand Header */}
          <div className="nav-brand-container">
            <div className="brand-monogram">CC</div>
            <div className="brand-copy">
              <h1 className="brand-name">CollabChat</h1>
              <span className="brand-tagline">Real-Time Team App</span>
            </div>
          </div>

          {/* Connection Status Indicator */}
          <div className="nav-status-chip">
            <span className={`status-indicator-dot ${isConnected ? 'active' : 'idle'}`}></span>
            <span className="status-label">
              {isConnected ? 'Real-Time Active' : 'Connecting...'}
            </span>
          </div>

          {/* Primary Action Buttons */}
          <div className="nav-actions">
            <button
              type="button"
              className="nav-btn nav-btn-primary"
              onClick={() => {
                onOpenNewGroup();
                setMobileMenuOpen(false);
              }}
              title="Create a new team collaboration group"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <span>New Group</span>
            </button>

            <button
              type="button"
              className="nav-btn nav-btn-secondary"
              onClick={() => {
                onOpenNewChat();
                setMobileMenuOpen(false);
              }}
              title="Start a 1-to-1 direct message"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <line x1="20" y1="8" x2="20" y2="14"></line>
                <line x1="23" y1="11" x2="17" y2="11"></line>
              </svg>
              <span>New Direct Chat</span>
            </button>
          </div>

          {/* Quick Metrics / Category Summary */}
          <div className="nav-summary-card">
            <div className="summary-title">Workspace Channels</div>
            <div className="summary-row">
              <span className="summary-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                Direct Messages
              </span>
              <span className="summary-count">{directCount}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                Team Groups
              </span>
              <span className="summary-count">{groupCount}</span>
            </div>
          </div>
        </div>

        {/* User Profile & Sign Out (Bottom) */}
        <div className="nav-sidebar-bottom">
          <div className="nav-user-card">
            <button
              type="button"
              className="nav-user-avatar-btn"
              onClick={() => setShowProfileModal(true)}
              title="Edit your profile"
            >
              <img src={user?.avatarUrl} alt={user?.fullName} className="nav-user-avatar" />
              <span className="presence-dot online" title="Online"></span>
            </button>
            <div className="user-text-info">
              <div className="nav-user-fullname">{user?.fullName || user?.username}</div>
              {user?.statusMessage ? (
                <div className="nav-user-status" title={user.statusMessage}>
                  {user.statusMessage}
                </div>
              ) : (
                <div className="nav-user-handle">@{user?.username}</div>
              )}
            </div>
            <div className="nav-user-actions">
              <button
                type="button"
                className="nav-edit-profile-btn"
                onClick={() => setShowProfileModal(true)}
                title="Edit profile"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button
                type="button"
                className="nav-logout-btn"
                onClick={logout}
                title="Sign out of CollabChat"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Backdrop for mobile drawer */}
      {mobileMenuOpen && (
        <div className="mobile-nav-backdrop" onClick={() => setMobileMenuOpen(false)}></div>
      )}

      {/* Profile Edit Modal */}
      {showProfileModal && (
        <ProfileModal onClose={() => setShowProfileModal(false)} />
      )}
    </>
  );
};

export default NavSidebar;
