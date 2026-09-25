import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { registerSchema, loginSchema } from './auth.validation';
import { sendSuccess } from '../../utils/apiResponse';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export class AuthController {
  public static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = registerSchema.parse(req.body);
      const result = await AuthService.register(validatedData);
      sendSuccess(res, result, 'User registered successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = loginSchema.parse(req.body);
      const result = await AuthService.login(validatedData);
      sendSuccess(res, result, 'Login successful', 200);
    } catch (error) {
      next(error);
    }
  }

  public static async me(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id.toString();
      const userProfile = await AuthService.getProfile(userId);
      sendSuccess(res, { user: userProfile }, 'User profile retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  public static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // With stateless JWT tokens, client removes token from local storage / cookies.
      sendSuccess(
        res,
        {
          loggedOut: true,
          instruction: 'Please remove the JWT token from client storage or Authorization header.',
        },
        'Logged out successfully',
        200
      );
    } catch (error) {
      next(error);
    }
  }
}
