import { memoryStore } from '../storage/memoryStore.js';
import { userRepository } from './userRepository.js';

export const messageRepository = {
  async create({ conversationId, senderId, text }) {
    const id = memoryStore.generateId();
    const now = new Date();
    const sender = await userRepository.findById(senderId);

    const message = {
      id,
      conversationId,
      senderId,
      sender: sender ? userRepository.sanitizeUser(sender) : { id: senderId },
      text: text.trim(),
      isEdited: false,
      editedAt: null,
      isDeleted: false,
      deletedAt: null,
      readBy: [{ userId: senderId, readAt: now }],
      reactions: [],
      createdAt: now,
      updatedAt: now
    };

    memoryStore.messages.set(id, message);

    let list = memoryStore.messagesByConversation.get(conversationId);
    if (!list) {
      list = [];
      memoryStore.messagesByConversation.set(conversationId, list);
    }
    list.push(id);

    return JSON.parse(JSON.stringify(message));
  },

  async findById(id) {
    const msg = memoryStore.messages.get(id);
    return msg ? JSON.parse(JSON.stringify(msg)) : null;
  },

  async findByConversationId(conversationId) {
    const messageIds = memoryStore.messagesByConversation.get(conversationId) || [];
    const messages = [];

    for (const mid of messageIds) {
      const msg = memoryStore.messages.get(mid);
      if (msg) {
        messages.push(JSON.parse(JSON.stringify(msg)));
      }
    }

    return messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  },

  async update(id, { text }) {
    const msg = memoryStore.messages.get(id);
    if (!msg) return null;

    msg.text = text.trim();
    msg.isEdited = true;
    msg.editedAt = new Date();
    msg.updatedAt = new Date();

    return JSON.parse(JSON.stringify(msg));
  },

  async delete(id) {
    const msg = memoryStore.messages.get(id);
    if (!msg) return null;

    msg.isDeleted = true;
    msg.text = 'This message was deleted';
    msg.deletedAt = new Date();
    msg.updatedAt = new Date();

    return JSON.parse(JSON.stringify(msg));
  },

  async markConversationMessagesRead(conversationId, readerId) {
    const messageIds = memoryStore.messagesByConversation.get(conversationId) || [];
    const updatedIds = [];
    const now = new Date();

    for (const mid of messageIds) {
      const msg = memoryStore.messages.get(mid);
      if (msg && msg.senderId !== readerId) {
        if (!msg.readBy) msg.readBy = [];
        const alreadyRead = msg.readBy.some((r) => r.userId === readerId);
        if (!alreadyRead) {
          msg.readBy.push({ userId: readerId, readAt: now });
          updatedIds.push(mid);
        }
      }
    }

    return updatedIds;
  },

  async toggleReaction(id, { userId, username, emoji }) {
    const msg = memoryStore.messages.get(id);
    if (!msg || msg.isDeleted) return null;

    if (!msg.reactions) msg.reactions = [];

    const existingIdx = msg.reactions.findIndex((r) => r.userId === userId && r.emoji === emoji);

    if (existingIdx !== -1) {
      // Remove reaction if already present
      msg.reactions.splice(existingIdx, 1);
    } else {
      // Add reaction
      msg.reactions.push({
        emoji,
        userId,
        username,
        createdAt: new Date()
      });
    }

    msg.updatedAt = new Date();
    return JSON.parse(JSON.stringify(msg));
  }
};
