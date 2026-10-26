import bcrypt from 'bcryptjs';
import { userRepository } from '../repositories/userRepository.js';
import { conversationRepository } from '../repositories/conversationRepository.js';
import { messageRepository } from '../repositories/messageRepository.js';

export const seedInitialData = async () => {
  try {
    const existingUsers = await userRepository.findAll();
    if (existingUsers.length > 0) return;

    const defaultPassword = await bcrypt.hash('password123', 10);

    const alice = await userRepository.create({
      username: 'alice',
      email: 'alice@example.com',
      password: defaultPassword,
      fullName: 'Alice Johnson',
      statusMessage: 'Leading Project Alpha Team 🚀'
    });

    const bob = await userRepository.create({
      username: 'bob',
      email: 'bob@example.com',
      password: defaultPassword,
      fullName: 'Bob Smith',
      statusMessage: 'Working on React frontend ✨'
    });

    const charlie = await userRepository.create({
      username: 'charlie',
      email: 'charlie@example.com',
      password: defaultPassword,
      fullName: 'Charlie Davis',
      statusMessage: 'Reviewing API documentation 📚'
    });

    // Create a demo Team Project group
    const projectGroup = await conversationRepository.createGroup({
      name: 'Project Alpha Team',
      description: 'Main collaboration channel for college project milestones',
      createdById: alice.id,
      participantIds: [bob.id, charlie.id]
    });

    // Post an initial welcome message in the group
    const welcomeMsg = await messageRepository.create({
      conversationId: projectGroup.id,
      senderId: alice.id,
      text: 'Welcome team to the Real-Time Chat & Team Collaboration App!'
    });

    await conversationRepository.setLastMessage(projectGroup.id, {
      id: welcomeMsg.id,
      text: welcomeMsg.text,
      senderId: alice.id,
      senderName: alice.fullName,
      createdAt: welcomeMsg.createdAt
    });

    // Create a 1-to-1 conversation between Alice and Bob
    const directConv = await conversationRepository.createDirect(alice.id, bob.id);
    const directMsg = await messageRepository.create({
      conversationId: directConv.id,
      senderId: bob.id,
      text: 'Hey Alice! Socket.IO and REST APIs are working smoothly.'
    });

    await conversationRepository.setLastMessage(directConv.id, {
      id: directMsg.id,
      text: directMsg.text,
      senderId: bob.id,
      senderName: bob.fullName,
      createdAt: directMsg.createdAt
    });

    console.log('✅ Demo seed data initialized:');
    console.log('   - alice@example.com / password123');
    console.log('   - bob@example.com / password123');
    console.log('   - charlie@example.com / password123');
  } catch (err) {
    console.error('Error seeding demo data:', err);
  }
};
