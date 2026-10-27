import { conversationRepository } from '../repositories/conversationRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { messageRepository } from '../repositories/messageRepository.js';

export const conversationController = {
  async listConversations(req, res) {
    try {
      const conversations = await conversationRepository.findByUserId(req.user.id);
      return res.status(200).json({ conversations });
    } catch (error) {
      console.error('Error listing conversations:', error);
      return res.status(500).json({ message: 'Failed to list conversations.' });
    }
  },

  async getConversation(req, res) {
    try {
      const { id } = req.params;
      const isMember = await conversationRepository.isMember(id, req.user.id);
      if (!isMember) {
        return res.status(403).json({ message: 'Access denied: You are not a member of this conversation.' });
      }

      const conv = await conversationRepository.findById(id);
      if (!conv) {
        return res.status(404).json({ message: 'Conversation not found.' });
      }

      const enriched = await conversationRepository.enrichConversation(conv, req.user.id);
      return res.status(200).json({ conversation: enriched });
    } catch (error) {
      console.error('Error fetching conversation:', error);
      return res.status(500).json({ message: 'Failed to get conversation.' });
    }
  },

  async createDirect(req, res) {
    try {
      const { recipientId } = req.body;
      if (!recipientId) {
        return res.status(400).json({ message: 'recipientId is required.' });
      }

      if (recipientId === req.user.id) {
        return res.status(400).json({ message: 'Cannot create a direct conversation with yourself.' });
      }

      const recipient = await userRepository.findById(recipientId);
      if (!recipient) {
        return res.status(404).json({ message: 'Recipient user does not exist.' });
      }

      const conv = await conversationRepository.createDirect(req.user.id, recipientId);
      const enriched = await conversationRepository.enrichConversation(conv, req.user.id);

      // Notify recipient via socket if connected
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${recipientId}`).emit('conversation:created', {
          conversation: await conversationRepository.enrichConversation(conv, recipientId)
        });
      }

      return res.status(201).json({ conversation: enriched });
    } catch (error) {
      console.error('Error creating direct conversation:', error);
      return res.status(500).json({ message: 'Failed to create direct conversation.' });
    }
  },

  async createGroup(req, res) {
    try {
      const { name, description, participantIds = [] } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Group name is required.' });
      }

      const conv = await conversationRepository.createGroup({
        name: name.trim(),
        description: description ? description.trim() : '',
        createdById: req.user.id,
        participantIds
      });

      const enriched = await conversationRepository.enrichConversation(conv, req.user.id);

      const io = req.app.get('io');
      if (io) {
        for (const p of conv.participants) {
          if (p.userId !== req.user.id) {
            const recipientConv = await conversationRepository.enrichConversation(conv, p.userId);
            io.to(`user:${p.userId}`).emit('conversation:created', { conversation: recipientConv });
          }
        }
      }

      return res.status(201).json({ conversation: enriched });
    } catch (error) {
      console.error('Error creating group:', error);
      return res.status(500).json({ message: 'Failed to create group.' });
    }
  },

  async updateGroup(req, res) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      const isMember = await conversationRepository.isMember(id, req.user.id);
      if (!isMember) {
        return res.status(403).json({ message: 'Access denied: You are not a member of this conversation.' });
      }

      const conv = await conversationRepository.findById(id);
      if (!conv || conv.type !== 'group') {
        return res.status(400).json({ message: 'Can only update group conversations.' });
      }

      const updated = await conversationRepository.update(id, { name, description });
      const enriched = await conversationRepository.enrichConversation(updated, req.user.id);

      const io = req.app.get('io');
      if (io) {
        io.to(`conversation:${id}`).emit('conversation:updated', { conversation: enriched });
      }

      return res.status(200).json({ conversation: enriched });
    } catch (error) {
      console.error('Error updating group:', error);
      return res.status(500).json({ message: 'Failed to update group.' });
    }
  },

  async addMember(req, res) {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: 'userId is required.' });
      }

      const conv = await conversationRepository.findById(id);
      if (!conv || conv.type !== 'group') {
        return res.status(400).json({ message: 'Target conversation is not a valid group.' });
      }

      const isMember = await conversationRepository.isMember(id, req.user.id);
      if (!isMember) {
        return res.status(403).json({ message: 'Only current members can add people to the group.' });
      }

      const userToAdd = await userRepository.findById(userId);
      if (!userToAdd) {
        return res.status(404).json({ message: 'User not found.' });
      }

      const updated = await conversationRepository.addMember(id, userId);
      const enriched = await conversationRepository.enrichConversation(updated, req.user.id);

      const io = req.app.get('io');
      if (io) {
        const addedUserConv = await conversationRepository.enrichConversation(updated, userId);
        io.to(`user:${userId}`).emit('conversation:created', { conversation: addedUserConv });
        io.to(`conversation:${id}`).emit('conversation:updated', { conversation: enriched });
        io.to(`conversation:${id}`).emit('member:added', {
          conversationId: id,
          user: userRepository.sanitizeUser(userToAdd)
        });
      }

      return res.status(200).json({ conversation: enriched });
    } catch (error) {
      console.error('Error adding member:', error);
      return res.status(500).json({ message: 'Failed to add member.' });
    }
  },

  async removeMember(req, res) {
    try {
      const { id, userId } = req.params;

      const conv = await conversationRepository.findById(id);
      if (!conv || conv.type !== 'group') {
        return res.status(400).json({ message: 'Target conversation is not a valid group.' });
      }

      const currentMembership = conv.participants.find((p) => p.userId === req.user.id);
      if (!currentMembership) {
        return res.status(403).json({ message: 'You are not a member of this group.' });
      }

      const isSelfLeave = req.user.id === userId;
      const isAdmin = currentMembership.role === 'admin' || conv.createdBy === req.user.id;

      if (!isSelfLeave && !isAdmin) {
        return res.status(403).json({ message: 'Only group admins can remove other members.' });
      }

      const updated = await conversationRepository.removeMember(id, userId);
      const enriched = await conversationRepository.enrichConversation(updated, req.user.id);

      const io = req.app.get('io');
      if (io) {
        io.to(`user:${userId}`).emit('conversation:removed', { conversationId: id });
        io.to(`conversation:${id}`).emit('conversation:updated', { conversation: enriched });
        io.to(`conversation:${id}`).emit('member:removed', { conversationId: id, userId });
      }

      return res.status(200).json({ conversation: enriched, message: 'Member removed successfully.' });
    } catch (error) {
      console.error('Error removing member:', error);
      return res.status(500).json({ message: 'Failed to remove member.' });
    }
  },

  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const isMember = await conversationRepository.isMember(id, req.user.id);
      if (!isMember) {
        return res.status(403).json({ message: 'Not a member of this conversation.' });
      }

      await conversationRepository.resetUnread(id, req.user.id);
      const updatedMessageIds = await messageRepository.markConversationMessagesRead(id, req.user.id);

      const io = req.app.get('io');
      if (io) {
        io.to(`conversation:${id}`).emit('messages:read', {
          conversationId: id,
          readerId: req.user.id,
          readAt: new Date(),
          updatedMessageIds
        });
      }

      return res.status(200).json({ success: true, conversationId: id, unreadCount: 0, updatedMessageIds });
    } catch (error) {
      console.error('Error marking as read:', error);
      return res.status(500).json({ message: 'Failed to mark conversation as read.' });
    }
  },

  async deleteConversation(req, res) {
    try {
      const { id } = req.params;
      const conv = await conversationRepository.findById(id);
      if (!conv) {
        return res.status(404).json({ message: 'Conversation not found.' });
      }

      const isMember = conv.participants.some((p) => p.userId === req.user.id);
      if (!isMember) {
        return res.status(403).json({ message: 'Access denied: You are not a member of this conversation.' });
      }

      // If group conversation, only group admin or creator can delete the entire group
      if (conv.type === 'group') {
        const membership = conv.participants.find((p) => p.userId === req.user.id);
        const isAdmin = membership?.role === 'admin' || conv.createdBy === req.user.id;
        if (!isAdmin) {
          return res.status(403).json({ message: 'Only group admins can delete the entire group chat.' });
        }
      }

      const participantIds = conv.participants.map((p) => p.userId);

      await conversationRepository.delete(id);

      const io = req.app.get('io');
      if (io) {
        // Emit to room and to individual participant rooms
        io.to(`conversation:${id}`).emit('conversation:removed', { conversationId: id });
        io.to(`conversation:${id}`).emit('conversation:deleted', { conversationId: id });

        for (const userId of participantIds) {
          io.to(`user:${userId}`).emit('conversation:removed', { conversationId: id });
          io.to(`user:${userId}`).emit('conversation:deleted', { conversationId: id });
        }
      }

      return res.status(200).json({ success: true, conversationId: id, message: 'Conversation deleted successfully.' });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      return res.status(500).json({ message: 'Failed to delete conversation.' });
    }
  }
};
