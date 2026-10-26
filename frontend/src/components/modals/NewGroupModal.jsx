import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useChat } from '../../context/ChatContext';
import { useSocket } from '../../context/SocketContext';

export const NewGroupModal = ({ onClose }) => {
  const { createGroupChat } = useChat();
  const { isUserOnline } = useSocket();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
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

  const toggleUser = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (u.fullName && u.fullName.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q))
    );
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Group name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await createGroupChat({
        name: name.trim(),
        description: description.trim(),
        participantIds: selectedUserIds
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create group');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create Collaboration Group</h3>
          <button type="button" className="btn-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="modal-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="group-name">Group Name *</label>
            <input
              id="group-name"
              type="text"
              placeholder="e.g. Design Team or College Project Squad"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="group-desc">Description (Optional)</label>
            <input
              id="group-desc"
              type="text"
              placeholder="What is this channel about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Select Initial Members ({selectedUserIds.length} selected)</label>
            <input
              type="text"
              placeholder="Filter members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="member-filter-input"
            />

            <div className="member-selection-list">
              {isLoading ? (
                <div className="modal-loading">
                  <span className="spinner-sm"></span>
                  <span>Loading teammates...</span>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="modal-empty-list">No teammates found</div>
              ) : (
                filteredUsers.map((u) => {
                  const isChecked = selectedUserIds.includes(u.id);
                  const online = isUserOnline(u.id);

                  return (
                    <label key={u.id} className={`member-check-item ${isChecked ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleUser(u.id)}
                      />
                      <div className="user-picker-avatar-wrap">
                        <img src={u.avatarUrl} alt={u.fullName} className="user-picker-avatar" />
                        <span className={`presence-dot ${online ? 'online' : 'offline'}`}></span>
                      </div>
                      <div className="member-check-info">
                        <span className="member-check-name">{u.fullName || u.username}</span>
                        <span className="member-check-handle">@{u.username}</span>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
