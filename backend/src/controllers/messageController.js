import { messageRepository } from '../repositories/messageRepository.js';
import { conversationRepository } from '../repositories/conversationRepository.js';

export const messageController = {
  async getMessages(req, res) {
    try {
      const { conversationId } = req.params;

      const isMember = await conversationRepository.isMember(conversationId, req.user.id);
      if (!isMember) {
        return res.status(403).json({ message: 'Access denied: You are not a member of this conversation.' });
      }

      const messages = await messageRepository.findByConversationId(conversationId);
      return res.status(200).json({ messages });
    } catch (error) {
      console.error('Error fetching messages:', error);
      return res.status(500).json({ message: 'Failed to retrieve messages.' });
    }
  },

  async sendMessage(req, res) {
    try {
      const { conversationId } = req.params;
      const { text } = req.body;

      if (!text || !text.trim()) {
        return res.status(400).json({ message: 'Message text cannot be empty.' });
      }

      const isMember = await conversationRepository.isMember(conversationId, req.user.id);
      if (!isMember) {
        return res.status(403).json({ message: 'Access denied: You are not a member of this conversation.' });
      }

      const message = await messageRepository.create({
        conversationId,
        senderId: req.user.id,
        text: text.trim()
      });

      // Update conversation's last message summary
      const summary = {
        id: message.id,
        text: message.text,
        senderId: message.senderId,
        senderName: req.user.fullName || req.user.username,
        createdAt: message.createdAt
      };
      await conversationRepository.setLastMessage(conversationId, summary);

      // Increment unread counts for all other members
      await conversationRepository.incrementUnread(conversationId, req.user.id);

      const io = req.app.get('io');
      if (io) {
        // Broadcast message to room
        io.to(`conversation:${conversationId}`).emit('message:new', { message });

        // Notify each participant about conversation update (last message + unread count)
        const conv = await conversationRepository.findById(conversationId);
        if (conv) {
          for (const p of conv.participants) {
            const enriched = await conversationRepository.enrichConversation(conv, p.userId);
            io.to(`user:${p.userId}`).emit('conversation:updated', { conversation: enriched });
          }
        }
      }

      return res.status(201).json({ message });
    } catch (error) {
      console.error('Error sending message:', error);
      return res.status(500).json({ message: 'Failed to send message.' });
    }
  },

  async editMessage(req, res) {
    try {
      const { id } = req.params;
      const { text } = req.body;

      if (!text || !text.trim()) {
        return res.status(400).json({ message: 'Message text cannot be empty.' });
      }

      const existing = await messageRepository.findById(id);
      if (!existing) {
        return res.status(404).json({ message: 'Message not found.' });
      }

      // Security check: Only author can edit own message
      if (existing.senderId !== req.user.id) {
        return res.status(403).json({ message: 'Permission denied: You can only edit your own messages.' });
      }

      if (existing.isDeleted) {
        return res.status(400).json({ message: 'Cannot edit a deleted message.' });
      }

      const updated = await messageRepository.update(id, { text });

      const io = req.app.get('io');
      if (io) {
        io.to(`conversation:${existing.conversationId}`).emit('message:updated', { message: updated });
      }

      return res.status(200).json({ message: updated });
    } catch (error) {
      console.error('Error editing message:', error);
      return res.status(500).json({ message: 'Failed to edit message.' });
    }
  },

  async deleteMessage(req, res) {
    try {
      const { id } = req.params;

      const existing = await messageRepository.findById(id);
      if (!existing) {
        return res.status(404).json({ message: 'Message not found.' });
      }

      // Security check: Only author can delete own message
      if (existing.senderId !== req.user.id) {
        return res.status(403).json({ message: 'Permission denied: You can only delete your own messages.' });
      }

      const deleted = await messageRepository.delete(id);

      const io = req.app.get('io');
      if (io) {
        io.to(`conversation:${existing.conversationId}`).emit('message:deleted', { message: deleted });
      }

      return res.status(200).json({ message: deleted });
    } catch (error) {
      console.error('Error deleting message:', error);
      return res.status(500).json({ message: 'Failed to delete message.' });
    }
  },

  async toggleReaction(req, res) {
    try {
      const { id } = req.params;
      const { emoji } = req.body;

      if (!emoji) {
        return res.status(400).json({ message: 'Emoji is required.' });
      }

      const existing = await messageRepository.findById(id);
      if (!existing) {
        return res.status(404).json({ message: 'Message not found.' });
      }

      const isMember = await conversationRepository.isMember(existing.conversationId, req.user.id);
      if (!isMember) {
        return res.status(403).json({ message: 'Not a member of this conversation.' });
      }

      const updated = await messageRepository.toggleReaction(id, {
        userId: req.user.id,
        username: req.user.fullName || req.user.username,
        emoji
      });

      const io = req.app.get('io');
      if (io) {
        io.to(`conversation:${existing.conversationId}`).emit('message:reaction', {
          messageId: id,
          conversationId: existing.conversationId,
          reactions: updated.reactions
        });
      }

      return res.status(200).json({ message: updated });
    } catch (error) {
      console.error('Error toggling reaction:', error);
      return res.status(500).json({ message: 'Failed to toggle reaction.' });
    }
  }
};
