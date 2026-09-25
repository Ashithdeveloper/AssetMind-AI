"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuthenticateJwt = exports.authenticateJwt = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const User_model_1 = require("../models/User.model");
const apiResponse_1 = require("../utils/apiResponse");
const authenticateJwt = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            (0, apiResponse_1.sendError)(res, 'Authentication token missing or invalid format', 401, 'UNAUTHORIZED');
            return;
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
            (0, apiResponse_1.sendError)(res, 'Authentication token missing', 401, 'UNAUTHORIZED');
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        const user = await User_model_1.User.findById(decoded.userId).select('-passwordHash');
        if (!user) {
            (0, apiResponse_1.sendError)(res, 'User associated with token no longer exists', 401, 'USER_NOT_FOUND');
            return;
        }
        req.user = user;
        next();
    }
    catch (error) {
        if (error.name === 'TokenExpiredError') {
            (0, apiResponse_1.sendError)(res, 'Authentication token has expired', 401, 'TOKEN_EXPIRED');
            return;
        }
        if (error.name === 'JsonWebTokenError') {
            (0, apiResponse_1.sendError)(res, 'Invalid authentication token', 401, 'INVALID_TOKEN');
            return;
        }
        (0, apiResponse_1.sendError)(res, 'Authentication failure', 401, 'AUTH_FAILED');
    }
};
exports.authenticateJwt = authenticateJwt;
const optionalAuthenticateJwt = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            if (token) {
                const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
                const user = await User_model_1.User.findById(decoded.userId).select('-passwordHash');
                if (user) {
                    req.user = user;
                }
            }
        }
    }
    catch {
        // Silently continue without user attachment for optional auth
    }
    next();
};
exports.optionalAuthenticateJwt = optionalAuthenticateJwt;
//# sourceMappingURL=auth.middleware.js.map