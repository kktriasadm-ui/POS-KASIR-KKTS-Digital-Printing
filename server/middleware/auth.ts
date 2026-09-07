import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/database.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'kkts-digital-printing-super-secret-key-2026';

export interface AuthenticatedUser {
  id: string;
  name: string;
  username: string;
  role: 'ADMIN' | 'KASIR';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token autentikasi tidak ditemukan. Silakan login kembali.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    // Verify user is still active in database
    const user = db.queryOne<any>('SELECT id, name, username, role_id, status FROM users WHERE id = ?', [decoded.id]);
    if (!user) {
      return res.status(401).json({ error: 'User tidak ditemukan' });
    }
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Akun telah dinonaktifkan oleh Administrator.' });
    }

    req.user = {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role_id as 'ADMIN' | 'KASIR'
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesi telah kadaluarsa. Silakan login kembali.' });
  }
}
