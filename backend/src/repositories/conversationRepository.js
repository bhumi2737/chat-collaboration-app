import { memoryStore } from '../storage/memoryStore.js';
import { userRepository } from './userRepository.js';

export const conversationRepository = {
  async findById(id) {
    const conv = memoryStore.conversations.get(id);
    return conv ? JSON.parse(JSON.stringify(conv)) : null;
  },

  async findDirect(user1Id, user2Id) {
    for (const conv of memoryStore.conversations.values()) {
      if (conv.type === 'direct') {
        const ids = conv.participants.map((p) => p.userId);
        if (ids.includes(user1Id) && ids.includes(user2Id) && ids.length === 2) {
          return JSON.parse(JSON.stringify(conv));
        }
      }
    }
    return null;
  },

  async createDirect(user1Id, user2Id) {
    const existing = await this.findDirect(user1Id, user2Id);
    if (existing) {
      return existing;
    }

    const id = memoryStore.generateId();
    const now = new Date();

    const conv = {
      id,
      type: 'direct',
      name: null,
      description: null,
      createdBy: user1Id,
      participants: [
        { userId: user1Id, role: 'member', joinedAt: now },
        { userId: user2Id, role: 'member', joinedAt: now }
      ],
      lastMessage: null,
      createdAt: now,
      updatedAt: now
    };

    memoryStore.conversations.set(id, conv);
    memoryStore.messagesByConversation.set(id, []);
    memoryStore.unreadCounts.set(`${id}:${user1Id}`, 0);
    memoryStore.unreadCounts.set(`${id}:${user2Id}`, 0);

    return JSON.parse(JSON.stringify(conv));
  },

  async createGroup({ name, description = '', createdById, participantIds = [] }) {
    const id = memoryStore.generateId();
    const now = new Date();

    // Ensure creator is included as admin
    const uniqueIds = Array.from(new Set([createdById, ...participantIds]));

    const participants = uniqueIds.map((userId) => ({
      userId,
      role: userId === createdById ? 'admin' : 'member',
      joinedAt: now
    }));

    const conv = {
      id,
      type: 'group',
      name: name.trim(),
      description: description ? description.trim() : '',
      createdBy: createdById,
      participants,
      lastMessage: null,
      createdAt: now,
      updatedAt: now
    };

    memoryStore.conversations.set(id, conv);
    memoryStore.messagesByConversation.set(id, []);

    for (const userId of uniqueIds) {
      memoryStore.unreadCounts.set(`${id}:${userId}`, 0);
    }

    return JSON.parse(JSON.stringify(conv));
  },

  async findByUserId(userId) {
    const result = [];
    for (const conv of memoryStore.conversations.values()) {
      const isPart = conv.participants.some((p) => p.userId === userId);
      if (isPart) {
        const enriched = await this.enrichConversation(conv, userId);
        result.push(enriched);
      }
    }

    // Sort conversations: most recent message or update first
    result.sort((a, b) => {
      const timeA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt) : new Date(a.updatedAt);
      const timeB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt) : new Date(b.updatedAt);
      return timeB - timeA;
    });

    return result;
  },

  async isMember(conversationId, userId) {
    const conv = memoryStore.conversations.get(conversationId);
    if (!conv) return false;
    return conv.participants.some((p) => p.userId === userId);
  },

  async addMember(conversationId, userId, role = 'member') {
    const conv = memoryStore.conversations.get(conversationId);
    if (!conv || conv.type !== 'group') return null;

    if (!conv.participants.some((p) => p.userId === userId)) {
      conv.participants.push({
        userId,
        role,
        joinedAt: new Date()
      });
      conv.updatedAt = new Date();
      memoryStore.unreadCounts.set(`${conversationId}:${userId}`, 0);
    }

    return JSON.parse(JSON.stringify(conv));
  },

  async removeMember(conversationId, userId) {
    const conv = memoryStore.conversations.get(conversationId);
    if (!conv || conv.type !== 'group') return null;

    conv.participants = conv.participants.filter((p) => p.userId !== userId);
    conv.updatedAt = new Date();
    memoryStore.unreadCounts.delete(`${conversationId}:${userId}`);

    return JSON.parse(JSON.stringify(conv));
  },

  async update(conversationId, data) {
    const conv = memoryStore.conversations.get(conversationId);
    if (!conv) return null;

    if (data.name !== undefined) conv.name = data.name.trim();
    if (data.description !== undefined) conv.description = data.description.trim();
    conv.updatedAt = new Date();

    return JSON.parse(JSON.stringify(conv));
  },

  async setLastMessage(conversationId, messageSummary) {
    const conv = memoryStore.conversations.get(conversationId);
    if (!conv) return;
    conv.lastMessage = messageSummary;
    conv.updatedAt = new Date();
  },

  async getUnreadCount(conversationId, userId) {
    return memoryStore.unreadCounts.get(`${conversationId}:${userId}`) || 0;
  },

  async incrementUnread(conversationId, excludeUserId) {
    const conv = memoryStore.conversations.get(conversationId);
    if (!conv) return;

    for (const p of conv.participants) {
      if (p.userId !== excludeUserId) {
        const key = `${conversationId}:${p.userId}`;
        const current = memoryStore.unreadCounts.get(key) || 0;
        memoryStore.unreadCounts.set(key, current + 1);
      }
    }
  },

  async resetUnread(conversationId, userId) {
    memoryStore.unreadCounts.set(`${conversationId}:${userId}`, 0);
  },

  async enrichConversation(conv, currentUserId) {
    const copy = JSON.parse(JSON.stringify(conv));
    copy.unreadCount = memoryStore.unreadCounts.get(`${conv.id}:${currentUserId}`) || 0;

    // Attach full participant profiles
    const detailedParticipants = [];
    for (const p of copy.participants) {
      const user = await userRepository.findById(p.userId);
      if (user) {
        detailedParticipants.push({
          ...userRepository.sanitizeUser(user),
          role: p.role,
          joinedAt: p.joinedAt
        });
      }
    }
    copy.participants = detailedParticipants;

    // For direct conversations, calculate display name and other participant
    if (copy.type === 'direct') {
      const other = detailedParticipants.find((p) => p.id !== currentUserId) || detailedParticipants[0];
      copy.displayName = other ? other.fullName || other.username : 'Chat';
      copy.otherUser = other || null;
    } else {
      copy.displayName = copy.name;
    }

    return copy;
  }
};
