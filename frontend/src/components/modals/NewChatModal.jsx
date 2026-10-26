import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useChat } from '../../context/ChatContext';
import { useSocket } from '../../context/SocketContext';

export const NewChatModal = ({ onClose }) => {
  const { createDirectChat } = useChat();
  const { isUserOnline } = useSocket();

  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await api.get('/api/users');
        setUsers(data.users || []);
      } catch (err) {
        setError('Failed to load users');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (u.fullName && u.fullName.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
  });

  const handleSelectUser = async (userId) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await createDirectChat(userId);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to start conversation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Start Direct Conversation</h3>
          <button type="button" className="btn-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="modal-error">{error}</div>}

          <div className="form-group">
            <input
              type="text"
              placeholder="Search users by name, @username, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          <div className="user-picker-list">
            {isLoading ? (
              <div className="modal-loading">
                <span className="spinner-sm"></span>
                <span>Loading available teammates...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="modal-empty-list">No teammates found</div>
            ) : (
              filteredUsers.map((u) => {
                const online = isUserOnline(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    className="user-picker-item"
                    onClick={() => handleSelectUser(u.id)}
                    disabled={isSubmitting}
                  >
                    <div className="user-picker-avatar-wrap">
                      <img src={u.avatarUrl} alt={u.fullName} className="user-picker-avatar" />
                      <span className={`presence-dot ${online ? 'online' : 'offline'}`}></span>
                    </div>

                    <div className="user-picker-info">
                      <span className="user-picker-name">{u.fullName || u.username}</span>
                      <span className="user-picker-handle">@{u.username} • {online ? 'Online' : 'Offline'}</span>
                    </div>

                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
