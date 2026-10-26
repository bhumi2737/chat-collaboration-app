import { Router } from 'express';
import { userController } from '../controllers/userController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);
router.get('/', userController.getUsers);
router.put('/profile', userController.updateProfile);
router.get('/:id', userController.getUserById);

export default router;
