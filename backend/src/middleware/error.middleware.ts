import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, sendError } from '../utils/apiResponse';
import { env } from '../config/env';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log unexpected errors
  if (env.NODE_ENV !== 'test') {
    console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);
  }

  // Zod Validation Error
  if (err instanceof ZodError) {
    const issues = err.issues.map((i: any) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    sendError(res, 'Validation failed for request data', 400, 'VALIDATION_ERROR', issues);
    return;
  }

  // Custom AppError
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode, err.errorCode, err.details);
    return;
  }

  // Mongoose duplicate key error (E11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    sendError(res, `A record with this ${field} already exists`, 409, 'DUPLICATE_KEY_ERROR', {
      duplicateField: field,
      duplicateValue: err.keyValue?.[field],
    });
    return;
  }

  // Mongoose CastError (invalid ObjectId, etc.)
  if (err.name === 'CastError') {
    sendError(res, `Invalid format for resource parameter: ${err.path}`, 400, 'INVALID_RESOURCE_ID');
    return;
  }

  // Default Internal Error
  sendError(
    res,
    env.NODE_ENV === 'production' ? 'Internal server error' : err.message || 'Internal server error',
    500,
    'INTERNAL_SERVER_ERROR'
  );
};

export const notFoundHandler = (req: Request, res: Response): void => {
  sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND');
};
