import crypto from 'crypto';

/**
 * In-Memory Database Store for Evaluation 1.
 * Cleanly decoupled so Evaluation 2 can swap repository implementations with MongoDB / Mongoose.
 */
class MemoryStore {
  constructor() {
    this.users = new Map(); // id -> user
    this.usersByEmail = new Map(); // email.toLowerCase() -> id
    this.usersByUsername = new Map(); // username.toLowerCase() -> id

    this.conversations = new Map(); // id -> conversation
    this.messages = new Map(); // id -> message
    this.messagesByConversation = new Map(); // conversationId -> array of messageIds

    // Real-time tracking
    this.onlineUserSockets = new Map(); // userId -> Set of socketIds
    this.lastSeen = new Map(); // userId -> Date

    // Unread count map: `${conversationId}:${userId}` -> count
    this.unreadCounts = new Map();
  }

  generateId() {
    return crypto.randomUUID();
  }

  // --- Reset/Clear (useful for tests) ---
  clear() {
    this.users.clear();
    this.usersByEmail.clear();
    this.usersByUsername.clear();
    this.conversations.clear();
    this.messages.clear();
    this.messagesByConversation.clear();
    this.onlineUserSockets.clear();
    this.lastSeen.clear();
    this.unreadCounts.clear();
  }
}

export const memoryStore = new MemoryStore();
