import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { userRepository } from '../repositories/userRepository.js';

export const authController = {
  async register(req, res) {
    try {
      const { username, email, password, fullName } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ message: 'Username, email, and password are required.' });
      }

      if (username.length < 3) {
        return res.status(400).json({ message: 'Username must be at least 3 characters.' });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters.' });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Please provide a valid email address.' });
      }

      const existingEmail = await userRepository.findByEmail(email);
      if (existingEmail) {
        return res.status(409).json({ message: 'A user with this email already exists.' });
      }

      const existingUsername = await userRepository.findByUsername(username);
      if (existingUsername) {
        return res.status(409).json({ message: 'This username is already taken.' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const user = await userRepository.create({
        username,
        email,
        password: hashedPassword,
        fullName
      });

      const token = jwt.sign({ id: user.id }, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn
      });

      return res.status(201).json({
        message: 'Registration successful',
        token,
        user
      });
    } catch (error) {
      console.error('Registration error:', error);
      return res.status(500).json({ message: 'Internal server error during registration.' });
    }
  },

  async login(req, res) {
    try {
      const { emailOrUsername, password } = req.body;

      if (!emailOrUsername || !password) {
        return res.status(400).json({ message: 'Email/username and password are required.' });
      }

      let user = await userRepository.findByEmail(emailOrUsername);
      if (!user) {
        user = await userRepository.findByUsername(emailOrUsername);
      }

      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }

      const token = jwt.sign({ id: user.id }, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn
      });

      return res.status(200).json({
        message: 'Login successful',
        token,
        user: userRepository.sanitizeUser(user)
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ message: 'Internal server error during login.' });
    }
  },

  async me(req, res) {
    try {
      return res.status(200).json({
        user: req.user
      });
    } catch (error) {
      return res.status(500).json({ message: 'Error retrieving user profile.' });
    }
  }
};
