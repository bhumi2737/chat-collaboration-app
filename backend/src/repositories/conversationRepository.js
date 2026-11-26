
import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import UnreadCount from '../models/UnreadCount.js';
import { userRepository } from './userRepository.js';

const validId = (id) => mongoose.isValidObjectId(id);

export const conversationRepository = {
  async findById(id) {
    if (!validId(id)) return null;

    const conv = await Conversation.findById(id).lean();
    if (!conv) return null;

    return this._normalize(conv);
  },

  async findDirect(user1Id, user2Id) {
    if (!validId(user1Id) || !validId(user2Id)) return null;

    const conv = await Conversation.findOne({
      type: 'direct',
      'participants.userId': { $all: [user1Id, user2Id] },
      participants: { $size: 2 }
    }).lean();

    if (!conv) return null;
    return this._normalize(conv);
  },

  async createDirect(user1Id, user2Id) {
    const existing = await this.findDirect(user1Id, user2Id);
    if (existing) return existing;

    const now = new Date();

    try {
      const conv = await Conversation.create({
        type: 'direct',
        name: null,
        description: null,
        createdBy: user1Id,
        participants: [
          { userId: user1Id, role: 'member', joinedAt: now },
          { userId: user2Id, role: 'member', joinedAt: now }
        ],
        lastMessage: null
      });

    return this._normalize(conv.toObject({ transform: false }));
  },

  async createGroup({ name, description = '', createdById, participantIds = [] }) {
    const now = new Date();
    const uniqueIds = Array.from(new Set([createdById, ...participantIds]));

    const participants = uniqueIds.map((userId) => ({
      userId,
      role: userId === createdById ? 'admin' : 'member',
      joinedAt: now
    }));

    const conv = await Conversation.create({
      type: 'group',
      name: name.trim(),
      description: description ? description.trim() : '',
      createdBy: createdById,
      participants,
      lastMessage: null
    });

    await UnreadCount.insertMany(
      uniqueIds.map((userId) => ({
        conversationId: conv._id,
        userId,
        count: 0
      }))
    );

    return this._normalize(conv.toObject({ transform: false }));
  },

  async findByUserId(userId) {
    const conversations = await Conversation.find({
      'participants.userId': userId
    }).lean();

    const enrichedList = [];

    for (const conv of conversations) {
      const normalized = this._normalize(conv);
      const enriched = await this.enrichConversation(normalized, userId);
      enrichedList.push(enriched);
    }

    enrichedList.sort((a, b) => {
      const timeA = a.lastMessage?.createdAt
        ? new Date(a.lastMessage.createdAt)
        : new Date(a.updatedAt);

      const timeB = b.lastMessage?.createdAt
        ? new Date(b.lastMessage.createdAt)
        : new Date(b.updatedAt);

      return timeB - timeA;
    });

    return enrichedList;
  },

  async isMember(conversationId, userId) {
    if (!validId(conversationId)) return false;

    const conv = await Conversation.findOne({
      _id: conversationId,
      'participants.userId': userId
    }).lean();

    return !!conv;
  },

  async addMember(conversationId, userId, role = 'member') {
    if (!validId(conversationId) || !validId(userId)) return null;

    const conv = await Conversation.findById(conversationId);
    if (!conv || conv.type !== 'group') return null;

    const alreadyMember = conv.participants.some(
      (p) => p.userId.toString() === userId.toString()
    );

    if (!alreadyMember) {
      conv.participants.push({
        userId,
        role,
        joinedAt: new Date()
      });

      conv.updatedAt = new Date();
      await conv.save();

      await UnreadCount.findOneAndUpdate(
        { conversationId, userId },
        { $setOnInsert: { count: 0 } },
        { upsert: true }
      );
    }

    return this._normalize(conv.toObject());
  },

  async removeMember(conversationId, userId) {
    if (!validId(conversationId) || !validId(userId)) return null;

    const conv = await Conversation.findById(conversationId);
    if (!conv || conv.type !== 'group') return null;

    conv.participants = conv.participants.filter(
      (p) => p.userId.toString() !== userId.toString()
    );

    conv.updatedAt = new Date();
    await conv.save();

    await UnreadCount.deleteOne({ conversationId, userId });

    return this._normalize(conv.toObject());
  },

  async update(conversationId, data) {
    if (!validId(conversationId)) return null;

    const updateFields = {};

    if (data.name !== undefined) {
      updateFields.name = data.name.trim();
    }

    if (data.description !== undefined) {
      updateFields.description = data.description.trim();
    }

    updateFields.updatedAt = new Date();

    const conv = await Conversation.findByIdAndUpdate(
      conversationId,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).lean();

    if (!conv) return null;

    return this._normalize(conv);
  },

  async setLastMessage(conversationId, messageSummary) {
    if (!validId(conversationId)) return;

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: {
        messageId: messageSummary.id,
        text: messageSummary.text,
        senderId: messageSummary.senderId,
        senderName: messageSummary.senderName,
        createdAt: messageSummary.createdAt
      },
      updatedAt: new Date()
    });
  },

  async getUnreadCount(conversationId, userId) {
    if (!validId(conversationId) || !validId(userId)) return 0;

    const doc = await UnreadCount.findOne({
      conversationId,
      userId
    }).lean();

    return doc ? doc.count : 0;
  },

  async incrementUnread(conversationId, excludeUserId) {
    if (!validId(conversationId)) return;

    const conv = await Conversation.findById(conversationId).lean();
    if (!conv) return;

    const otherUserIds = conv.participants
      .filter((p) => p.userId.toString() !== excludeUserId.toString())
      .map((p) => p.userId);

    if (otherUserIds.length > 0) {
      await UnreadCount.updateMany(
        { conversationId, userId: { $in: otherUserIds } },
        { $inc: { count: 1 } }
      );
    }
  },

  async resetUnread(conversationId, userId) {
    if (!validId(conversationId) || !validId(userId)) return;

    await UnreadCount.findOneAndUpdate(
      { conversationId, userId },
      { count: 0 },
      { upsert: true }
    );
  },

  async enrichConversation(conv, currentUserId) {
    if (!conv) return null;

    const copy = JSON.parse(JSON.stringify(conv));

    copy.unreadCount = await this.getUnreadCount(
      conv.id,
      currentUserId
    );

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

    if (copy.type === 'direct') {
      const other =
        detailedParticipants.find(
          (p) => p.id !== currentUserId.toString()
        ) || detailedParticipants[0];

      copy.displayName = other
        ? other.fullName || other.username
        : 'Chat';

      copy.otherUser = other || null;
    } else {
      copy.displayName = copy.name;
    }

    return copy;
  },

  async delete(conversationId) {
    if (!validId(conversationId)) return false;

    const conv = await Conversation.findById(conversationId).lean();
    if (!conv) return false;

    const { default: Message } = await import('../models/Message.js');

    await Message.deleteMany({ conversationId });
    await UnreadCount.deleteMany({ conversationId });
    await Conversation.findByIdAndDelete(conversationId);

    return true;
  },

  _normalize(doc) {
    const obj = { ...doc };

    obj.id = obj._id.toString();

    delete obj._id;
    delete obj.__v;

    if (obj.createdBy?.toString) {
      obj.createdBy = obj.createdBy.toString();
    }

    if (obj.participants) {
      obj.participants = obj.participants.map((p) => ({
        ...p,
        userId: p.userId?.toString
          ? p.userId.toString()
          : p.userId
      }));
    }

    if (obj.lastMessage) {
      if (obj.lastMessage.messageId?.toString) {
        obj.lastMessage.id = obj.lastMessage.messageId.toString();
        delete obj.lastMessage.messageId;
      }

      if (obj.lastMessage.senderId?.toString) {
        obj.lastMessage.senderId = obj.lastMessage.senderId.toString();
      }
    }

    return obj;
  }
};
