import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticateJwt } from '../../middleware/auth.middleware';

const router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.get('/me', authenticateJwt, AuthController.me);
router.post('/logout', AuthController.logout);

export const authRoutes = router;
