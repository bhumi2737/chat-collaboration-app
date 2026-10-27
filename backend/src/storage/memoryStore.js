import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_FILE = path.join(__dirname, 'users.json');
const CONVERSATIONS_FILE = path.join(__dirname, 'conversations.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

/**
 * In-Memory Database Store with file-backed persistence for users, conversations, and messages.
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

    this.loadUsers();
    this.loadConversations();
    this.loadMessages();
  }

  loadUsers() {
    try {
      if (fs.existsSync(USERS_FILE)) {
        const raw = fs.readFileSync(USERS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const u of parsed) {
            if (['alice', 'bob', 'charlie'].includes(u.username.toLowerCase())) {
              continue;
            }
            this.users.set(u.id, u);
            this.usersByEmail.set(u.email.toLowerCase(), u.id);
            this.usersByUsername.set(u.username.toLowerCase(), u.id);
          }
          console.log(`Loaded ${this.users.size} persisted user accounts from users.json`);
        }
      }
    } catch (err) {
      console.error('Failed to load users.json:', err);
    }
  }

  saveUsers() {
    try {
      const userList = Array.from(this.users.values()).filter(
        (u) => !['alice', 'bob', 'charlie'].includes(u.username.toLowerCase())
      );
      fs.writeFileSync(USERS_FILE, JSON.stringify(userList, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save users.json:', err);
    }
  }

  loadConversations() {
    try {
      if (fs.existsSync(CONVERSATIONS_FILE)) {
        const raw = fs.readFileSync(CONVERSATIONS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const c of parsed) {
            this.conversations.set(c.id, c);
            if (!this.messagesByConversation.has(c.id)) {
              this.messagesByConversation.set(c.id, []);
            }
          }
          console.log(`Loaded ${this.conversations.size} persisted conversations from conversations.json`);
        }
      }
    } catch (err) {
      console.error('Failed to load conversations.json:', err);
    }
  }

  saveConversations() {
    try {
      const convList = Array.from(this.conversations.values());
      fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(convList, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save conversations.json:', err);
    }
  }

  loadMessages() {
    try {
      if (fs.existsSync(MESSAGES_FILE)) {
        const raw = fs.readFileSync(MESSAGES_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const m of parsed) {
            this.messages.set(m.id, m);
            let list = this.messagesByConversation.get(m.conversationId);
            if (!list) {
              list = [];
              this.messagesByConversation.set(m.conversationId, list);
            }
            if (!list.includes(m.id)) {
              list.push(m.id);
            }
          }
          console.log(`Loaded ${this.messages.size} persisted messages from messages.json`);
        }
      }
    } catch (err) {
      console.error('Failed to load messages.json:', err);
    }
  }

  saveMessages() {
    try {
      const msgList = Array.from(this.messages.values());
      fs.writeFileSync(MESSAGES_FILE, JSON.stringify(msgList, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save messages.json:', err);
    }
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

