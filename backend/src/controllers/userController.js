import { userRepository } from '../repositories/userRepository.js';

export const userController = {
  async getUsers(req, res) {
    try {
      const { q } = req.query;
      const users = await userRepository.findAll({
        excludeUserId: req.user.id,
        query: q || ''
      });
      return res.status(200).json({ users });
    } catch (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ message: 'Failed to fetch users.' });
    }
  },

  async getUserById(req, res) {
    try {
      const user = await userRepository.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }
      return res.status(200).json({ user: userRepository.sanitizeUser(user) });
    } catch (error) {
      return res.status(500).json({ message: 'Error retrieving user.' });
    }
  },

  async updateProfile(req, res) {
    try {
      const { statusMessage, fullName } = req.body;
      const updateData = {};
      if (typeof statusMessage === 'string') {
        updateData.statusMessage = statusMessage.trim() || 'Available to collaborate';
      }
      if (typeof fullName === 'string' && fullName.trim()) {
        updateData.fullName = fullName.trim();
      }

      const updated = await userRepository.update(req.user.id, updateData);
      const io = req.app.get('io');
      if (io) {
        io.emit('user:profile_updated', { user: updated });
      }

      return res.status(200).json({ user: updated });
    } catch (error) {
      console.error('Error updating user profile:', error);
      return res.status(500).json({ message: 'Failed to update profile.' });
    }
  }
};
