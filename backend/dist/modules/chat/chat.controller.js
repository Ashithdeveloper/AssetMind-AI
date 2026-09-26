"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatController = void 0;
const chat_service_1 = require("./chat.service");
const apiResponse_1 = require("../../utils/apiResponse");
class ChatController {
    /**
     * POST /api/chat/message
     * Send a user message and receive grounded AI response with RAG and Live stock data
     */
    static async sendMessage(req, res, next) {
        try {
            const { sessionId, message } = req.body;
            const userId = req.user?.id;
            if (!message || typeof message !== 'string' || !message.trim()) {
                (0, apiResponse_1.sendError)(res, 'Message text is required', 400);
                return;
            }
            const result = await chat_service_1.ChatService.processUserMessage({
                sessionId,
                message: message.trim(),
                userId,
            });
            (0, apiResponse_1.sendSuccess)(res, result, 'Message processed successfully', 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/chat/sessions
     * List all chat sessions
     */
    static async getSessions(req, res, next) {
        try {
            const userId = req.user?.id;
            const sessions = await chat_service_1.ChatService.listSessions(userId);
            (0, apiResponse_1.sendSuccess)(res, sessions, 'Chat sessions retrieved', 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/chat/sessions/:id/messages
     * Get all messages for a session
     */
    static async getSessionMessages(req, res, next) {
        try {
            const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const messages = await chat_service_1.ChatService.getSessionMessages(sessionId);
            (0, apiResponse_1.sendSuccess)(res, messages, 'Session messages retrieved', 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * DELETE /api/chat/sessions/:id
     * Delete a chat session
     */
    static async deleteSession(req, res, next) {
        try {
            const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const deleted = await chat_service_1.ChatService.deleteSession(sessionId);
            if (!deleted) {
                (0, apiResponse_1.sendError)(res, 'Session not found or invalid ID', 404);
                return;
            }
            (0, apiResponse_1.sendSuccess)(res, { success: true }, 'Session deleted successfully', 200);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.ChatController = ChatController;
//# sourceMappingURL=chat.controller.js.map