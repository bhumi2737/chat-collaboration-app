import React, { useState } from 'react';

export const EditMessageModal = ({ message, onClose, onSave }) => {
  const [text, setText] = useState(message?.text || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!message) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) {
      setError('Message text cannot be empty');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSave(message.id, text.trim());
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update message');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Message</h3>
          <button type="button" className="btn-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="modal-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="edit-message-text">Message Content</label>
            <textarea
              id="edit-message-text"
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Edit your message..."
              autoFocus
              required
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting || !text.trim()}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
