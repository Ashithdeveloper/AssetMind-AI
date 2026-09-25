"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.post('/register', auth_controller_1.AuthController.register);
router.post('/login', auth_controller_1.AuthController.login);
router.get('/me', auth_middleware_1.authenticateJwt, auth_controller_1.AuthController.me);
router.post('/logout', auth_controller_1.AuthController.logout);
exports.authRoutes = router;
//# sourceMappingURL=auth.routes.js.map