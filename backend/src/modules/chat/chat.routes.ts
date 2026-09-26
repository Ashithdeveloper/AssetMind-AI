import { Router } from 'express';
import { ChatController } from './chat.controller';

const router = Router();

// Chat message execution
router.post('/message', ChatController.sendMessage);

// Session management
router.get('/sessions', ChatController.getSessions);
router.get('/sessions/:id/messages', ChatController.getSessionMessages);
router.delete('/sessions/:id', ChatController.deleteSession);

export const chatRoutes = router;
