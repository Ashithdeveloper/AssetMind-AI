"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("./auth.service");
const auth_validation_1 = require("./auth.validation");
const apiResponse_1 = require("../../utils/apiResponse");
class AuthController {
    static async register(req, res, next) {
        try {
            const validatedData = auth_validation_1.registerSchema.parse(req.body);
            const result = await auth_service_1.AuthService.register(validatedData);
            (0, apiResponse_1.sendSuccess)(res, result, 'User registered successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    static async login(req, res, next) {
        try {
            const validatedData = auth_validation_1.loginSchema.parse(req.body);
            const result = await auth_service_1.AuthService.login(validatedData);
            (0, apiResponse_1.sendSuccess)(res, result, 'Login successful', 200);
        }
        catch (error) {
            next(error);
        }
    }
    static async me(req, res, next) {
        try {
            const userId = req.user._id.toString();
            const userProfile = await auth_service_1.AuthService.getProfile(userId);
            (0, apiResponse_1.sendSuccess)(res, { user: userProfile }, 'User profile retrieved successfully', 200);
        }
        catch (error) {
            next(error);
        }
    }
    static async logout(req, res, next) {
        try {
            // With stateless JWT tokens, client removes token from local storage / cookies.
            (0, apiResponse_1.sendSuccess)(res, {
                loggedOut: true,
                instruction: 'Please remove the JWT token from client storage or Authorization header.',
            }, 'Logged out successfully', 200);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=auth.controller.js.map