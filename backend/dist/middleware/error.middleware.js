"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.errorHandler = void 0;
const zod_1 = require("zod");
const apiResponse_1 = require("../utils/apiResponse");
const env_1 = require("../config/env");
const errorHandler = (err, req, res, next) => {
    // Log unexpected errors
    if (env_1.env.NODE_ENV !== 'test') {
        console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);
    }
    // Zod Validation Error
    if (err instanceof zod_1.ZodError) {
        const issues = err.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
        }));
        (0, apiResponse_1.sendError)(res, 'Validation failed for request data', 400, 'VALIDATION_ERROR', issues);
        return;
    }
    // Custom AppError
    if (err instanceof apiResponse_1.AppError) {
        (0, apiResponse_1.sendError)(res, err.message, err.statusCode, err.errorCode, err.details);
        return;
    }
    // Mongoose duplicate key error (E11000)
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'field';
        (0, apiResponse_1.sendError)(res, `A record with this ${field} already exists`, 409, 'DUPLICATE_KEY_ERROR', {
            duplicateField: field,
            duplicateValue: err.keyValue?.[field],
        });
        return;
    }
    // Mongoose CastError (invalid ObjectId, etc.)
    if (err.name === 'CastError') {
        (0, apiResponse_1.sendError)(res, `Invalid format for resource parameter: ${err.path}`, 400, 'INVALID_RESOURCE_ID');
        return;
    }
    // Default Internal Error
    (0, apiResponse_1.sendError)(res, env_1.env.NODE_ENV === 'production' ? 'Internal server error' : err.message || 'Internal server error', 500, 'INTERNAL_SERVER_ERROR');
};
exports.errorHandler = errorHandler;
const notFoundHandler = (req, res) => {
    (0, apiResponse_1.sendError)(res, `Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND');
};
exports.notFoundHandler = notFoundHandler;
//# sourceMappingURL=error.middleware.js.map