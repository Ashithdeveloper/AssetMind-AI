import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User, IUser } from '../models/User.model';
import { sendError } from '../utils/apiResponse';

export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export const authenticateJwt = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendError(res, 'Authentication token missing or invalid format', 401, 'UNAUTHORIZED');
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      sendError(res, 'Authentication token missing', 401, 'UNAUTHORIZED');
      return;
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    const user = await User.findById(decoded.userId).select('-passwordHash');
    if (!user) {
      sendError(res, 'User associated with token no longer exists', 401, 'USER_NOT_FOUND');
      return;
    }

    req.user = user;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      sendError(res, 'Authentication token has expired', 401, 'TOKEN_EXPIRED');
      return;
    }
    if (error.name === 'JsonWebTokenError') {
      sendError(res, 'Invalid authentication token', 401, 'INVALID_TOKEN');
      return;
    }
    sendError(res, 'Authentication failure', 401, 'AUTH_FAILED');
  }
};

export const optionalAuthenticateJwt = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
        const user = await User.findById(decoded.userId).select('-passwordHash');
        if (user) {
          req.user = user;
        }
      }
    }
  } catch {
    // Silently continue without user attachment for optional auth
  }
  next();
};
