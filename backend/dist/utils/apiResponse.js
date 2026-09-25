"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendError = exports.sendSuccess = exports.AppError = void 0;
class AppError extends Error {
    statusCode;
    errorCode;
    details;
    constructor(message, statusCode = 500, errorCode = 'INTERNAL_SERVER_ERROR', details) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.details = details;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
exports.AppError = AppError;
const sendSuccess = (res, data, message = 'Success', statusCode = 200, pagination) => {
    const payload = {
        success: true,
        message,
        data,
    };
    if (pagination) {
        payload.pagination = pagination;
    }
    return res.status(statusCode).json(payload);
};
exports.sendSuccess = sendSuccess;
const sendError = (res, message = 'An error occurred', statusCode = 500, errorCode = 'INTERNAL_ERROR', details) => {
    const payload = {
        success: false,
        message,
        error: {
            code: errorCode,
            ...(details ? { details } : {}),
        },
    };
    return res.status(statusCode).json(payload);
};
exports.sendError = sendError;
//# sourceMappingURL=apiResponse.js.map