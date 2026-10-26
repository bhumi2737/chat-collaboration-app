import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export const MessageBubble = ({ message, onEdit, onDelete }) => {
  const { user } = useAuth();
  const { toggleReaction } = useChat();
  const isMine = message.senderId === user?.id;
  const isDeleted = message.isDeleted;
  const [showMenu, setShowMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [isReacting, setIsReacting] = useState(false);

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Group reactions: { emoji -> { count, users, iMine } }
  const groupedReactions = React.useMemo(() => {
    if (!message.reactions || message.reactions.length === 0) return [];
    const map = new Map();
    for (const r of message.reactions) {
      if (!map.has(r.emoji)) {
        map.set(r.emoji, { emoji: r.emoji, count: 0, users: [], iMine: false });
      }
      const entry = map.get(r.emoji);
      entry.count++;
      entry.users.push(r.username || r.userId);
      if (r.userId === user?.id) entry.iMine = true;
    }
    return Array.from(map.values());
  }, [message.reactions, user?.id]);

  const handleReaction = async (emoji) => {
    if (isReacting || isDeleted) return;
    setIsReacting(true);
    setShowReactionPicker(false);
    setShowMenu(false);
    try {
      await toggleReaction(message.id, emoji);
    } catch (err) {
      console.error('Reaction failed:', err);
    } finally {
      setIsReacting(false);
    }
  };

  const readByOthers = isMine && message.readBy && message.readBy.length > 0;

  const closeAll = () => {
    setShowMenu(false);
    setShowReactionPicker(false);
  };

  return (
    <div
      className={`message-row ${isMine ? 'mine' : 'theirs'} ${isDeleted ? 'deleted' : ''}`}
    >
      {!isMine && (
        <img
          src={message.sender?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${message.sender?.fullName || 'User'}`}
          alt={message.sender?.fullName || 'User'}
          className="message-avatar"
        />
      )}

      <div className="message-content-wrapper">
        {!isMine && (
          <span className="message-sender-name">
            {message.sender?.fullName || message.sender?.username || 'User'}
          </span>
        )}

        {/* Action buttons sit BESIDE the bubble, inside the same flex row */}
        <div className={`bubble-and-actions ${isMine ? 'mine' : 'theirs'}`}>

          {/* Left-side actions (for "mine" messages) */}
          {isMine && !isDeleted && (
            <div className="message-side-actions left">
              {/* Emoji reaction button */}
              <div className="reaction-btn-wrap">
                <button
                  type="button"
                  className="side-action-btn"
                  onClick={() => { setShowReactionPicker(!showReactionPicker); setShowMenu(false); }}
                  title="Add reaction"
                >
                  <span className="side-action-emoji">😊</span>
                </button>
                {showReactionPicker && (
                  <div className="emoji-picker-popover picker-left">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="emoji-option"
                        onClick={() => handleReaction(emoji)}
                        disabled={isReacting}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Edit/Delete menu */}
              <div className="reaction-btn-wrap">
                <button
                  type="button"
                  className="side-action-btn"
                  onClick={() => { setShowMenu(!showMenu); setShowReactionPicker(false); }}
                  title="Message options"
                >
                  <span className="side-action-dots">⋮</span>
                </button>
                {showMenu && (
                  <div className="message-context-menu menu-left">
                    <button
                      type="button"
                      className="menu-item"
                      onClick={() => { closeAll(); onEdit(message); }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="menu-item delete"
                      onClick={() => { closeAll(); onDelete(message); }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* The actual bubble */}
          <div className="message-bubble-body">
            <p className="message-text">
              {isDeleted ? <em>This message was deleted</em> : message.text}
            </p>
            <div className="message-meta">
              {message.isEdited && !isDeleted && <span className="edited-tag">(edited)</span>}
              <span className="message-timestamp">{formatTime(message.createdAt)}</span>
              {isMine && !isDeleted && (
                <span className={`read-tick ${readByOthers ? 'read' : 'sent'}`} title={readByOthers ? 'Read' : 'Sent'}>
                  {readByOthers ? '✓✓' : '✓'}
                </span>
              )}
            </div>
          </div>

          {/* Right-side reaction button (for "theirs" messages) */}
          {!isMine && !isDeleted && (
            <div className="message-side-actions right">
              <div className="reaction-btn-wrap">
                <button
                  type="button"
                  className="side-action-btn"
                  onClick={() => { setShowReactionPicker(!showReactionPicker); }}
                  title="Add reaction"
                >
                  <span className="side-action-emoji">😊</span>
                </button>
                {showReactionPicker && (
                  <div className="emoji-picker-popover picker-right">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="emoji-option"
                        onClick={() => handleReaction(emoji)}
                        disabled={isReacting}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Reaction chips below the bubble */}
        {groupedReactions.length > 0 && (
          <div className="reaction-chips">
            {groupedReactions.map(({ emoji, count, users, iMine: myReaction }) => (
              <button
                key={emoji}
                type="button"
                className={`reaction-chip ${myReaction ? 'my-reaction' : ''}`}
                onClick={() => handleReaction(emoji)}
                disabled={isReacting || isDeleted}
                title={users.join(', ')}
              >
                <span className="reaction-emoji">{emoji}</span>
                <span className="reaction-count">{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Click-away overlay to close pickers */}
      {(showReactionPicker || showMenu) && (
        <div className="picker-overlay" onClick={closeAll} />
      )}
    </div>
  );
};

export default MessageBubble;
