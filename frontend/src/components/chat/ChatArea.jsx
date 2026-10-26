import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../../context/ChatContext';
import { useSocket } from '../../context/SocketContext';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { EditMessageModal } from '../modals/EditMessageModal';

export const ChatArea = ({ onOpenGroupDetails, onBackToSidebar, isGroupDetailsOpen }) => {
  const {
    activeConversation,
    activeConversationId,
    activeMessages,
    currentTypingUsers,
    isLoadingMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    startTyping,
    stopTyping
  } = useChat();

  const { isUserOnline } = useSocket();
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const isDirect = activeConversation?.type === 'direct';
  const otherUser = activeConversation?.otherUser;
  const isRecipientOnline = isDirect && otherUser ? isUserOnline(otherUser.id) : false;

  // Auto-scroll to bottom on messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeMessages, currentTypingUsers]);

  // Focus input when conversation changes
  useEffect(() => {
    if (activeConversationId) {
      inputRef.current?.focus();
    }
  }, [activeConversationId]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputText(val);

    if (val.trim()) {
      startTyping(activeConversationId);
    } else {
      stopTyping(activeConversationId);
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const textToSend = inputText.trim();
    setInputText('');
    stopTyping(activeConversationId);

    try {
      setIsSending(true);
      await sendMessage(textToSend);
    } catch (err) {
      console.error('Failed to send message:', err);
      setInputText(textToSend); // Restore text on failure
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleDeleteConfirm = async (msg) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      try {
        await deleteMessage(msg.id);
      } catch (err) {
        alert(err.message || 'Failed to delete message');
      }
    }
  };

  // 1. Tasteful Empty State only when NO conversation is selected
  if (!activeConversationId || !activeConversation) {
    return (
      <main className="chat-area empty-chat-state">
        <div className="empty-chat-card">
          <div className="empty-chat-icon">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <h3 className="empty-chat-title">Select a Conversation</h3>
          <p className="empty-chat-desc">
            Choose an existing direct message or group channel from the sidebar to view conversation history and collaborate in real-time.
          </p>
          <div className="empty-quick-hint">
            <span>Use the <strong>New Direct Chat</strong> or <strong>New Group</strong> buttons in the navigation rail to connect with teammates.</span>
          </div>
        </div>
      </main>
    );
  }

  // 2. Active Conversation View
  return (
    <main className="chat-area">
      {/* Refined Conversation Header */}
      <header className="chat-header">
        <div className="chat-header-info">
          {onBackToSidebar && (
            <button
              type="button"
              className="btn-icon mobile-back-btn"
              onClick={onBackToSidebar}
              title="Back to conversation list"
            >
              ←
            </button>
          )}

          <div className="chat-header-avatar-wrap">
            {isDirect ? (
              <>
                <img
                  src={otherUser?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${activeConversation.displayName}`}
                  alt={activeConversation.displayName}
                  className="chat-header-avatar"
                />
                <span
                  className={`presence-dot ${isRecipientOnline ? 'online' : 'offline'}`}
                  title={isRecipientOnline ? 'Online' : 'Offline'}
                ></span>
              </>
            ) : (
              <div className="group-avatar-stack">
                {activeConversation.participants?.slice(0, 3).map((p, idx) => (
                  <img
                    key={p.id}
                    src={p.avatarUrl}
                    alt={p.fullName || p.username}
                    className="stack-avatar"
                    style={{ zIndex: 3 - idx }}
                    title={`${p.fullName || p.username} (${p.role})`}
                  />
                ))}
                {activeConversation.participants?.length > 3 && (
                  <span className="stack-more">+{activeConversation.participants.length - 3}</span>
                )}
              </div>
            )}
          </div>

          <div className="chat-header-text">
            <div className="header-title-row">
              <h2 className="chat-header-title">{activeConversation.displayName}</h2>
              <span className={isDirect ? 'header-pill-direct' : 'header-pill-group'}>
                {isDirect ? 'Direct' : 'Group'}
              </span>
            </div>
            <div className="chat-header-subtitle">
              {isDirect ? (
                isRecipientOnline ? (
                  <span className="text-online">● Active now on Socket.IO</span>
                ) : (
                  <span className="text-offline">○ Offline • Messages delivered instantly</span>
                )
              ) : (
                <span>
                  {activeConversation.participants?.length || 0} members
                  {activeConversation.description ? ` • ${activeConversation.description}` : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="chat-header-actions">
          {isDirect ? (
            <div className="direct-user-chip" title="Direct conversation recipient">
              <span className="chip-username">@{otherUser?.username || 'member'}</span>
              <span className={`status-dot-sm ${isRecipientOnline ? 'online' : 'offline'}`}></span>
            </div>
          ) : (
            <button
              type="button"
              className={`btn-group-info ${isGroupDetailsOpen ? 'active' : ''}`}
              onClick={onOpenGroupDetails}
              title="View channel members and settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <span>Members ({activeConversation.participants?.length || 0})</span>
            </button>
          )}
        </div>
      </header>

      {/* Message Feed with Centered Stream Container */}
      <div className="messages-feed">
        <div className="messages-stream-container">
          {/* Quiet Intro Header for the conversation */}
          <div className="conversation-intro-banner">
            <div className="intro-avatar-wrap">
              {isDirect ? (
                <img
                  src={otherUser?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${activeConversation.displayName}`}
                  alt={activeConversation.displayName}
                  className="intro-avatar"
                />
              ) : (
                <div className="intro-group-avatar">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                </div>
              )}
            </div>
            <h3 className="intro-name">{activeConversation.displayName}</h3>
            <p className="intro-description">
              {isDirect
                ? `This is the start of your direct messaging history with ${activeConversation.displayName}.`
                : activeConversation.description || `Welcome to the ${activeConversation.displayName} collaboration channel.`}
            </p>
            <div className="conversation-date-divider">
              <span className="divider-label">Today</span>
            </div>
          </div>

          {/* Messages list */}
          {isLoadingMessages && activeMessages.length === 0 ? (
            <div className="messages-loading">
              <span className="spinner-sm"></span>
              <span>Loading message history...</span>
            </div>
          ) : activeMessages.length === 0 ? (
            <div className="messages-empty-notice">
              <p>No messages sent yet in this conversation.</p>
              <span>Type below to send the first message! 👋</span>
            </div>
          ) : (
            activeMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onEdit={(m) => setEditingMessage(m)}
                onDelete={handleDeleteConfirm}
              />
            ))
          )}

          {/* Typing Indicator inside the stream */}
          <TypingIndicator typingUsers={currentTypingUsers} />

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Anchored Message Composer */}
      <div className="composer-wrapper">
        <form onSubmit={handleSendMessage} className="message-composer">
          <textarea
            ref={inputRef}
            rows={1}
            placeholder={`Message ${activeConversation.displayName}... (Enter to send, Shift+Enter for newline)`}
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
          <button
            type="submit"
            className="composer-send-btn"
            disabled={!inputText.trim() || isSending}
            title="Send message (Enter)"
          >
            {isSending ? (
              <span className="spinner-sm"></span>
            ) : (
              <>
                <span className="send-btn-label">Send</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Edit Message Modal */}
      {editingMessage && (
        <EditMessageModal
          message={editingMessage}
          onClose={() => setEditingMessage(null)}
          onSave={editMessage}
        />
      )}
    </main>
  );
};

export default ChatArea;
