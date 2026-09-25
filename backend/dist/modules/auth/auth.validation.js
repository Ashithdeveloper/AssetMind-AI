"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
exports.registerSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(2, 'Name must be at least 2 characters long')
        .max(100, 'Name must be less than 100 characters')
        .trim(),
    email: zod_1.z
        .string()
        .email('Invalid email address format')
        .toLowerCase()
        .trim(),
    password: zod_1.z
        .string()
        .min(6, 'Password must be at least 6 characters long')
        .max(128, 'Password must be less than 128 characters'),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z
        .string()
        .email('Invalid email address format')
        .toLowerCase()
        .trim(),
    password: zod_1.z
        .string()
        .min(1, 'Password is required'),
});
//# sourceMappingURL=auth.validation.js.map