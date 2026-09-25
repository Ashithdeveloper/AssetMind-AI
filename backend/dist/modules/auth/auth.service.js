"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_model_1 = require("../../models/User.model");
const env_1 = require("../../config/env");
const apiResponse_1 = require("../../utils/apiResponse");
class AuthService {
    static generateToken(user) {
        const payload = {
            userId: user._id.toString(),
            email: user.email,
        };
        return jsonwebtoken_1.default.sign(payload, env_1.env.JWT_SECRET, {
            expiresIn: env_1.env.JWT_EXPIRES_IN,
        });
    }
    static formatUser(user) {
        return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }
    static async register(data) {
        const existingUser = await User_model_1.User.findOne({ email: data.email.toLowerCase() });
        if (existingUser) {
            throw new apiResponse_1.AppError('Email address already in use', 400, 'EMAIL_EXISTS');
        }
        const saltRounds = 10;
        const passwordHash = await bcryptjs_1.default.hash(data.password, saltRounds);
        const user = await User_model_1.User.create({
            name: data.name,
            email: data.email.toLowerCase(),
            passwordHash,
        });
        const token = this.generateToken(user);
        return {
            user: this.formatUser(user),
            token,
        };
    }
    static async login(data) {
        const user = await User_model_1.User.findOne({ email: data.email.toLowerCase() });
        if (!user) {
            throw new apiResponse_1.AppError('Invalid email or password credentials', 401, 'INVALID_CREDENTIALS');
        }
        const isMatch = await bcryptjs_1.default.compare(data.password, user.passwordHash);
        if (!isMatch) {
            throw new apiResponse_1.AppError('Invalid email or password credentials', 401, 'INVALID_CREDENTIALS');
        }
        const token = this.generateToken(user);
        return {
            user: this.formatUser(user),
            token,
        };
    }
    static async getProfile(userId) {
        const user = await User_model_1.User.findById(userId).select('-passwordHash');
        if (!user) {
            throw new apiResponse_1.AppError('User not found', 404, 'USER_NOT_FOUND');
        }
        return this.formatUser(user);
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map