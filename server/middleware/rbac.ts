import { Request, Response, NextFunction } from 'express';
import { db } from '../db/database.js';

export function requireRole(allowedRoles: Array<'ADMIN' | 'KASIR'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Tidak terotentikasi' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Akses ditolak: Menu atau tindakan ini hanya dapat diakses oleh ${allowedRoles.join(' / ')}.`
      });
    }

    next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole(['ADMIN'])(req, res, next);
}

export function checkPermission(permissionName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Tidak terotentikasi' });
    }

    if (req.user.role === 'ADMIN') {
      return next(); // Admin has all permissions
    }

    const hasPerm = db.queryOne<any>(
      `SELECT 1 FROM role_permissions
       WHERE role_id = ? AND permission_id = ?`,
      [req.user.role, permissionName]
    );

    if (!hasPerm) {
      return res.status(403).json({
        error: `Akses ditolak: Anda tidak memiliki hak akses '${permissionName}'.`
      });
    }

    next();
  };
}
