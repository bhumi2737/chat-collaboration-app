import { socketAuthMiddleware } from '../middleware/socketAuthMiddleware.js';
import { memoryStore } from '../storage/memoryStore.js';
import { conversationRepository } from '../repositories/conversationRepository.js';
import { messageRepository } from '../repositories/messageRepository.js';
import { userRepository } from '../repositories/userRepository.js';

export const registerSocketHandlers = (io) => {
  io.use(socketAuthMiddleware);

  io.on('connection', async (socket) => {
    const user = socket.user;
    const userId = user.id;

    // 1. Join personal room for private notifications
    socket.join(`user:${userId}`);

    // 2. Track presence
    if (!memoryStore.onlineUserSockets.has(userId)) {
      memoryStore.onlineUserSockets.set(userId, new Set());
    }
    const userSockets = memoryStore.onlineUserSockets.get(userId);
    const wasOffline = userSockets.size === 0;
    userSockets.add(socket.id);

    // If newly online, broadcast to all clients
    if (wasOffline) {
      io.emit('presence:update', {
        userId,
        isOnline: true
      });
    }

    // Send current list of online users to this socket
    const onlineUserIds = Array.from(memoryStore.onlineUserSockets.entries())
      .filter(([_, sockets]) => sockets && sockets.size > 0)
      .map(([uid]) => uid);

    socket.emit('presence:initial', { onlineUserIds });

    // 3. Auto-join all conversation rooms this user belongs to
    try {
      const userConversations = await conversationRepository.findByUserId(userId);
      for (const conv of userConversations) {
        socket.join(`conversation:${conv.id}`);
      }
    } catch (err) {
      console.error(`Error joining initial rooms for user ${userId}:`, err);
    }

    // 4. Room Management
    socket.on('conversation:join', async ({ conversationId }, callback) => {
      try {
        const isMember = await conversationRepository.isMember(conversationId, userId);
        if (isMember) {
          socket.join(`conversation:${conversationId}`);
          if (typeof callback === 'function') callback({ success: true });
        } else {
          if (typeof callback === 'function') callback({ success: false, error: 'Not a member' });
        }
      } catch (err) {
        if (typeof callback === 'function') callback({ success: false, error: err.message });
      }
    });

    socket.on('conversation:leave', ({ conversationId }) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // 5. Typing Indicators
    socket.on('typing:start', async ({ conversationId }) => {
      if (!conversationId) return;
      const isMember = await conversationRepository.isMember(conversationId, userId);
      if (isMember) {
        socket.to(`conversation:${conversationId}`).emit('typing:start', {
          conversationId,
          user: {
            id: user.id,
            username: user.username,
            fullName: user.fullName
          }
        });
      }
    });

    socket.on('typing:stop', async ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`conversation:${conversationId}`).emit('typing:stop', {
        conversationId,
        userId: user.id
      });
    });

    // 6. Real-Time Messages
    socket.on('message:send', async ({ conversationId, text }, callback) => {
      try {
        if (!conversationId || !text || !text.trim()) {
          if (typeof callback === 'function') callback({ error: 'Conversation and text are required' });
          return;
        }

        const isMember = await conversationRepository.isMember(conversationId, userId);
        if (!isMember) {
          if (typeof callback === 'function') callback({ error: 'You are not a member of this conversation' });
          return;
        }

        const message = await messageRepository.create({
          conversationId,
          senderId: userId,
          text: text.trim()
        });

        // Set last message on conversation
        await conversationRepository.setLastMessage(conversationId, {
          id: message.id,
          text: message.text,
          senderId: userId,
          senderName: user.fullName || user.username,
          createdAt: message.createdAt
        });

        // Increment unread count for other members
        await conversationRepository.incrementUnread(conversationId, userId);

        // Broadcast to conversation room (including sender)
        io.to(`conversation:${conversationId}`).emit('message:new', { message });

        // Push conversation updates to all members
        const conv = await conversationRepository.findById(conversationId);
        if (conv) {
          for (const p of conv.participants) {
            const enriched = await conversationRepository.enrichConversation(conv, p.userId);
            io.to(`user:${p.userId}`).emit('conversation:updated', { conversation: enriched });
          }
        }

        if (typeof callback === 'function') callback({ success: true, message });
      } catch (err) {
        console.error('Socket message:send error:', err);
        if (typeof callback === 'function') callback({ error: 'Failed to send message' });
      }
    });

    // 7. Edit message
    socket.on('message:edit', async ({ messageId, text }, callback) => {
      try {
        if (!messageId || !text || !text.trim()) {
          if (typeof callback === 'function') callback({ error: 'Invalid message edit payload' });
          return;
        }

        const existing = await messageRepository.findById(messageId);
        if (!existing) {
          if (typeof callback === 'function') callback({ error: 'Message not found' });
          return;
        }

        // Only author can edit
        if (existing.senderId !== userId) {
          if (typeof callback === 'function') callback({ error: 'You can only edit your own messages' });
          return;
        }

        if (existing.isDeleted) {
          if (typeof callback === 'function') callback({ error: 'Cannot edit deleted message' });
          return;
        }

        const updated = await messageRepository.update(messageId, { text });
        io.to(`conversation:${existing.conversationId}`).emit('message:updated', { message: updated });

        if (typeof callback === 'function') callback({ success: true, message: updated });
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    // 8. Delete message
    socket.on('message:delete', async ({ messageId }, callback) => {
      try {
        if (!messageId) {
          if (typeof callback === 'function') callback({ error: 'Message ID is required' });
          return;
        }

        const existing = await messageRepository.findById(messageId);
        if (!existing) {
          if (typeof callback === 'function') callback({ error: 'Message not found' });
          return;
        }

        // Only author can delete
        if (existing.senderId !== userId) {
          if (typeof callback === 'function') callback({ error: 'You can only delete your own messages' });
          return;
        }

        const deleted = await messageRepository.delete(messageId);
        io.to(`conversation:${existing.conversationId}`).emit('message:deleted', { message: deleted });

        if (typeof callback === 'function') callback({ success: true, message: deleted });
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    // 9. Mark conversation read with read receipts
    socket.on('conversation:mark_read', async ({ conversationId }) => {
      try {
        if (!conversationId) return;
        const isMember = await conversationRepository.isMember(conversationId, userId);
        if (isMember) {
          await conversationRepository.resetUnread(conversationId, userId);
          const updatedMessageIds = await messageRepository.markConversationMessagesRead(conversationId, userId);

          socket.emit('conversation:read', { conversationId, unreadCount: 0 });
          io.to(`conversation:${conversationId}`).emit('messages:read', {
            conversationId,
            readerId: userId,
            readAt: new Date(),
            updatedMessageIds
          });
        }
      } catch (err) {
        console.error('Socket mark_read error:', err);
      }
    });

    // 10. Message Reactions
    socket.on('message:react', async ({ messageId, emoji }, callback) => {
      try {
        if (!messageId || !emoji) return;
        const existing = await messageRepository.findById(messageId);
        if (!existing) return;

        const isMember = await conversationRepository.isMember(existing.conversationId, userId);
        if (!isMember) return;

        const updated = await messageRepository.toggleReaction(messageId, {
          userId,
          username: user.fullName || user.username,
          emoji
        });

        io.to(`conversation:${existing.conversationId}`).emit('message:reaction', {
          messageId,
          conversationId: existing.conversationId,
          reactions: updated.reactions
        });

        if (typeof callback === 'function') callback({ success: true, reactions: updated.reactions });
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    // 11. User Status Message Update
    socket.on('user:status_update', async ({ statusMessage }, callback) => {
      try {
        const updated = await userRepository.update(userId, {
          statusMessage: statusMessage?.trim() || 'Available to collaborate'
        });
        io.emit('user:profile_updated', { user: updated });
        if (typeof callback === 'function') callback({ success: true, user: updated });
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    // 10. Disconnect and Presence Cleanup
    socket.on('disconnect', () => {
      const currentSockets = memoryStore.onlineUserSockets.get(userId);
      if (currentSockets) {
        currentSockets.delete(socket.id);
        if (currentSockets.size === 0) {
          memoryStore.onlineUserSockets.delete(userId);
          const lastSeen = new Date();
          memoryStore.lastSeen.set(userId, lastSeen);

          io.emit('presence:update', {
            userId,
            isOnline: false,
            lastSeen
          });
        }
      }
    });
  });
};
