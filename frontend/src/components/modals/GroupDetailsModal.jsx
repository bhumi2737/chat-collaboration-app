import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useSocket } from '../../context/SocketContext';

export const GroupDetailsModal = ({ onClose }) => {
  const { user: currentUser } = useAuth();
  const {
    activeConversation,
    updateGroupInfo,
    addGroupMember,
    removeGroupMember,
    deleteConversation
  } = useChat();
  const { isUserOnline } = useSocket();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(activeConversation?.name || '');
  const [description, setDescription] = useState(activeConversation?.description || '');
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await api.get('/api/users');
        setAllUsers(data.users || []);
      } catch (err) {
        console.warn('Could not load users for adding to group');
      }
    };
    fetchUsers();
  }, []);

  if (!activeConversation || activeConversation.type !== 'group') return null;

  const currentMembership = activeConversation.participants?.find((p) => p.id === currentUser?.id);
  const isAdmin = currentMembership?.role === 'admin' || activeConversation.createdBy === currentUser?.id;

  // Filter users not currently in group
  const existingMemberIds = new Set(activeConversation.participants?.map((p) => p.id) || []);
  const availableUsersToAdd = allUsers.filter((u) => !existingMemberIds.has(u.id));

  const handleSaveInfo = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Group name cannot be empty');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await updateGroupInfo(activeConversation.id, {
        name: name.trim(),
        description: description.trim()
      });
      setIsEditing(false);
    } catch (err) {
      setError(err.message || 'Failed to update group information');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserToAdd) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await addGroupMember(activeConversation.id, selectedUserToAdd);
      setSelectedUserToAdd('');
    } catch (err) {
      setError(err.message || 'Failed to add member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    const isSelf = memberId === currentUser?.id;
    const msg = isSelf
      ? 'Are you sure you want to leave this group?'
      : `Are you sure you want to remove ${memberName} from this group?`;

    if (window.confirm(msg)) {
      setIsSubmitting(true);
      setError(null);
      try {
        await removeGroupMember(activeConversation.id, memberId);
        if (isSelf) {
          onClose();
        }
      } catch (err) {
        setError(err.message || 'Failed to remove member');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleDeleteGroup = async () => {
    if (
      window.confirm(
        `Are you sure you want to delete the group "${activeConversation.name}"? This will permanently delete the group and all its messages for all members.`
      )
    ) {
      setIsSubmitting(true);
      setError(null);
      try {
        await deleteConversation(activeConversation.id);
        onClose();
      } catch (err) {
        setError(err.message || 'Failed to delete group');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-with-badge">
            <h3>Group Information</h3>
            <span className="badge-group-type">Team Channel</span>
          </div>
          <button type="button" className="btn-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body group-details-body">
          {error && <div className="modal-error">{error}</div>}

          {/* Group Info Section */}
          <div className="group-info-card">
            {isEditing ? (
              <form onSubmit={handleSaveInfo} className="group-edit-form">
                <div className="form-group">
                  <label htmlFor="edit-group-name">Group Name</label>
                  <input
                    id="edit-group-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-group-desc">Description</label>
                  <input
                    id="edit-group-desc"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="form-row-actions">
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary btn-sm" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="group-info-display">
                <div className="group-title-row">
                  <h4>{activeConversation.name}</h4>
                  {isAdmin && (
                    <button
                      type="button"
                      className="btn-link edit-info-btn"
                      onClick={() => setIsEditing(true)}
                    >
                      Edit Info
                    </button>
                  )}
                </div>
                {activeConversation.description && (
                  <p className="group-description-text">{activeConversation.description}</p>
                )}
                <span className="group-meta-date">
                  Created {new Date(activeConversation.createdAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* Add New Member Section */}
          <div className="add-member-section">
            <label className="section-title">Add Teammate to Group</label>
            <div className="add-member-input-row">
              <select
                value={selectedUserToAdd}
                onChange={(e) => setSelectedUserToAdd(e.target.value)}
                disabled={isSubmitting || availableUsersToAdd.length === 0}
              >
                <option value="">
                  {availableUsersToAdd.length === 0
                    ? 'All available teammates are already members'
                    : '-- Select a teammate to add --'}
                </option>
                {availableUsersToAdd.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName || u.username} (@{u.username})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-primary"
                onClick={handleAddMember}
                disabled={!selectedUserToAdd || isSubmitting}
              >
                Add
              </button>
            </div>
          </div>

          {/* Members List */}
          <div className="group-members-section">
            <div className="members-header-row">
              <label className="section-title">
                Members ({activeConversation.participants?.length || 0})
              </label>
            </div>

            <div className="group-members-list">
              {activeConversation.participants?.map((member) => {
                const online = isUserOnline(member.id);
                const isMemberAdmin = member.role === 'admin' || member.id === activeConversation.createdBy;
                const isSelf = member.id === currentUser?.id;

                return (
                  <div key={member.id} className="group-member-item">
                    <div className="member-avatar-wrap">
                      <img src={member.avatarUrl} alt={member.fullName} className="member-avatar" />
                      <span className={`presence-dot ${online ? 'online' : 'offline'}`}></span>
                    </div>

                    <div className="member-text-info">
                      <div className="member-name-row">
                        <span className="member-full-name">
                          {member.fullName || member.username} {isSelf && '(You)'}
                        </span>
                        <span className={`role-badge ${isMemberAdmin ? 'admin' : 'member'}`}>
                          {isMemberAdmin ? 'Admin' : 'Member'}
                        </span>
                      </div>
                      <span className="member-handle">
                        @{member.username} • {online ? 'Online' : 'Offline'}
                      </span>
                    </div>

                    <div className="member-actions">
                      {isSelf ? (
                        <button
                          type="button"
                          className="btn-danger-outline btn-sm"
                          onClick={() => handleRemoveMember(member.id, member.fullName)}
                          disabled={isSubmitting}
                        >
                          Leave Group
                        </button>
                      ) : (
                        isAdmin && (
                          <button
                            type="button"
                            className="btn-danger-outline btn-sm"
                            onClick={() => handleRemoveMember(member.id, member.fullName)}
                            disabled={isSubmitting}
                            title="Remove from group"
                          >
                            Remove
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="modal-actions modal-actions-split">
          {isAdmin ? (
            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleDeleteGroup}
              disabled={isSubmitting}
            >
              Delete Group For Everyone
            </button>
          ) : (
            <div />
          )}
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
