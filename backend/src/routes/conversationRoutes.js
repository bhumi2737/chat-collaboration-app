import { Router } from 'express';
import { conversationController } from '../controllers/conversationController.js';
import { messageController } from '../controllers/messageController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', conversationController.listConversations);
router.post('/direct', conversationController.createDirect);
router.post('/group', conversationController.createGroup);
router.get('/:id', conversationController.getConversation);
router.put('/:id', conversationController.updateGroup);
router.delete('/:id', conversationController.deleteConversation);
router.post('/:id/members', conversationController.addMember);
router.delete('/:id/members/:userId', conversationController.removeMember);
router.post('/:id/read', conversationController.markAsRead);

// Messages nested under conversation
router.get('/:conversationId/messages', messageController.getMessages);
router.post('/:conversationId/messages', messageController.sendMessage);

export default router;
