"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRoutes = void 0;
const express_1 = require("express");
const chat_controller_1 = require("./chat.controller");
const router = (0, express_1.Router)();
// Chat message execution
router.post('/message', chat_controller_1.ChatController.sendMessage);
// Session management
router.get('/sessions', chat_controller_1.ChatController.getSessions);
router.get('/sessions/:id/messages', chat_controller_1.ChatController.getSessionMessages);
router.delete('/sessions/:id', chat_controller_1.ChatController.deleteSession);
exports.chatRoutes = router;
//# sourceMappingURL=chat.routes.js.map