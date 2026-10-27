import { memoryStore } from '../storage/memoryStore.js';

export const userRepository = {
  async create({ username, email, password, fullName, statusMessage }) {
    const id = memoryStore.generateId();
    const now = new Date();
    const user = {
      id,
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password,
      fullName: fullName ? fullName.trim() : username.trim(),
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName || username)}`,
      statusMessage: statusMessage ? statusMessage.trim() : 'Available to collaborate',
      createdAt: now,
      updatedAt: now
    };

    memoryStore.users.set(id, user);
    memoryStore.usersByEmail.set(user.email, id);
    memoryStore.usersByUsername.set(user.username.toLowerCase(), id);
    memoryStore.saveUsers();

    return this.sanitizeUser(user);
  },

  async findById(id) {
    const user = memoryStore.users.get(id);
    return user ? { ...user } : null;
  },

  async findByEmail(email) {
    if (!email) return null;
    const id = memoryStore.usersByEmail.get(email.trim().toLowerCase());
    if (!id) return null;
    const user = memoryStore.users.get(id);
    return user ? { ...user } : null;
  },

  async findByUsername(username) {
    if (!username) return null;
    const id = memoryStore.usersByUsername.get(username.trim().toLowerCase());
    if (!id) return null;
    const user = memoryStore.users.get(id);
    return user ? { ...user } : null;
  },

  async findAll({ excludeUserId = null, query = '' } = {}) {
    const results = [];
    const q = query.trim().toLowerCase();

    for (const user of memoryStore.users.values()) {
      if (excludeUserId && user.id === excludeUserId) {
        continue;
      }
      if (
        !q ||
        user.username.toLowerCase().includes(q) ||
        user.fullName.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q)
      ) {
        results.push(this.sanitizeUser(user));
      }
    }

    return results.sort((a, b) => a.fullName.localeCompare(b.fullName));
  },

  async update(id, updateData) {
    const user = memoryStore.users.get(id);
    if (!user) return null;

    const updated = {
      ...user,
      ...updateData,
      updatedAt: new Date()
    };
    memoryStore.users.set(id, updated);
    memoryStore.saveUsers();
    return this.sanitizeUser(updated);
  },

  sanitizeUser(user) {
    if (!user) return null;
    const { password, ...safeUser } = user;
    return safeUser;
  }
};
