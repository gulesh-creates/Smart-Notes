import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export const JWT_SECRET = process.env.JWT_SECRET || 'smartnotes-super-secret-production-key-2026';

export interface AuthUserPayload {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
  file?: any;
}

export function generateToken(user: AuthUserPayload): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '30d' });
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUserPayload;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}
