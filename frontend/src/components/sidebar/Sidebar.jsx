import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';

export const Sidebar = ({ onOpenNewChat, onOpenNewGroup }) => {
  const { conversations, activeConversationId, selectConversation, isLoadingConversations } = useChat();
  const { isUserOnline } = useSocket();
  const { user: currentUser } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'direct' | 'group'

  const filteredConversations = conversations.filter((conv) => {
    // Type filter
    if (filterType !== 'all' && conv.type !== filterType) {
      return false;
    }

    // Search query filter
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();

    if (conv.displayName && conv.displayName.toLowerCase().includes(q)) return true;
    if (conv.lastMessage?.text && conv.lastMessage.text.toLowerCase().includes(q)) return true;

    return false;
  });

  const formatTimestamp = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <aside className="chat-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearchQuery('')}
            >
              ×
            </button>
          )}
        </div>

        <div className="filter-chips">
          <button
            type="button"
            className={`filter-chip ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            All
          </button>
          <button
            type="button"
            className={`filter-chip ${filterType === 'direct' ? 'active' : ''}`}
            onClick={() => setFilterType('direct')}
          >
            Direct
          </button>
          <button
            type="button"
            className={`filter-chip ${filterType === 'group' ? 'active' : ''}`}
            onClick={() => setFilterType('group')}
          >
            Groups
          </button>
        </div>
      </div>

      <div className="conversations-list">
        {isLoadingConversations && conversations.length === 0 ? (
          <div className="conversations-loading">
            <span className="spinner-sm"></span>
            <span>Loading conversations...</span>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="conversations-empty">
            <p>No conversations found</p>
            <div className="empty-actions">
              <button type="button" className="btn-link" onClick={onOpenNewChat}>
                Start a 1-to-1 chat
              </button>
              <span>or</span>
              <button type="button" className="btn-link" onClick={onOpenNewGroup}>
                Create a group
              </button>
            </div>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isSelected = conv.id === activeConversationId;
            const isDirect = conv.type === 'direct';
            const otherUser = conv.otherUser;
            const isRecipientOnline = isDirect && otherUser ? isUserOnline(otherUser.id) : false;
            const unreadCount = conv.unreadCount || 0;

            return (
              <div
                key={conv.id}
                className={`conversation-item ${isSelected ? 'active' : ''} ${unreadCount > 0 ? 'has-unread' : ''}`}
                onClick={() => selectConversation(conv.id)}
              >
                <div className="item-avatar-wrap">
                  {isDirect ? (
                    <>
                      <img
                        src={otherUser?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${conv.displayName}`}
                        alt={conv.displayName}
                        className="item-avatar"
                      />
                      <span
                        className={`presence-dot ${isRecipientOnline ? 'online' : 'offline'}`}
                        title={isRecipientOnline ? 'Online' : 'Offline'}
                      ></span>
                    </>
                  ) : (
                    <div className="group-avatar-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                    </div>
                  )}
                </div>

                <div className="item-content">
                  <div className="item-top-row">
                    <span className="item-title">{conv.displayName}</span>
                    <span className="item-time">
                      {formatTimestamp(conv.lastMessage?.createdAt || conv.updatedAt)}
                    </span>
                  </div>

                  <div className="item-bottom-row">
                    <span className="item-snippet">
                      {conv.lastMessage ? (
                        <>
                          <span className="snippet-sender">
                            {conv.lastMessage.senderId === currentUser?.id ? 'You: ' : `${conv.lastMessage.senderName || 'Member'}: `}
                          </span>
                          {conv.lastMessage.text}
                        </>
                      ) : (
                        <span className="snippet-empty">No messages yet</span>
                      )}
                    </span>

                    {unreadCount > 0 && (
                      <span className="unread-badge" title={`${unreadCount} unread messages`}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
