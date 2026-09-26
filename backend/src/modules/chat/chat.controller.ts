import { Request, Response, NextFunction } from 'express';
import { ChatService } from './chat.service';
import { sendSuccess, sendError } from '../../utils/apiResponse';

export class ChatController {
  /**
   * POST /api/chat/message
   * Send a user message and receive grounded AI response with RAG and Live stock data
   */
  public static async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId, message } = req.body;
      const userId = (req as any).user?.id;

      if (!message || typeof message !== 'string' || !message.trim()) {
        sendError(res, 'Message text is required', 400);
        return;
      }

      const result = await ChatService.processUserMessage({
        sessionId,
        message: message.trim(),
        userId,
      });

      sendSuccess(res, result, 'Message processed successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/chat/sessions
   * List all chat sessions
   */
  public static async getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const sessions = await ChatService.listSessions(userId);
      sendSuccess(res, sessions, 'Chat sessions retrieved', 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/chat/sessions/:id/messages
   * Get all messages for a session
   */
  public static async getSessionMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
      const messages = await ChatService.getSessionMessages(sessionId);
      sendSuccess(res, messages, 'Session messages retrieved', 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/chat/sessions/:id
   * Delete a chat session
   */
  public static async deleteSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
      const deleted = await ChatService.deleteSession(sessionId);
      if (!deleted) {
        sendError(res, 'Session not found or invalid ID', 404);
        return;
      }
      sendSuccess(res, { success: true }, 'Session deleted successfully', 200);
    } catch (err) {
      next(err);
    }
  }
}
