import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../../models/User.model';
import { env } from '../../config/env';
import { AppError } from '../../utils/apiResponse';
import { RegisterInput, LoginInput } from './auth.validation';

export interface AuthResult {
  user: {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
  };
  token: string;
}

export class AuthService {
  private static generateToken(user: IUser): string {
    const payload = {
      userId: user._id.toString(),
      email: user.email,
    };
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
  }

  private static formatUser(user: IUser) {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  public static async register(data: RegisterInput): Promise<AuthResult> {
    const existingUser = await User.findOne({ email: data.email.toLowerCase() });
    if (existingUser) {
      throw new AppError('Email address already in use', 400, 'EMAIL_EXISTS');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(data.password, saltRounds);

    const user = await User.create({
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

  public static async login(data: LoginInput): Promise<AuthResult> {
    const user = await User.findOne({ email: data.email.toLowerCase() });
    if (!user) {
      throw new AppError('Invalid email or password credentials', 401, 'INVALID_CREDENTIALS');
    }

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid email or password credentials', 401, 'INVALID_CREDENTIALS');
    }

    const token = this.generateToken(user);

    return {
      user: this.formatUser(user),
      token,
    };
  }

  public static async getProfile(userId: string) {
    const user = await User.findById(userId).select('-passwordHash');
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    return this.formatUser(user);
  }
}
