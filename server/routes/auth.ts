import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/database.js';
import { JWT_SECRET, authMiddleware } from '../middleware/auth.js';
import { AuditService } from '../services/AuditService.js';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  }

  const user = db.queryOne<any>(
    `SELECT u.*, r.name AS role_name
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.username = ?`,
    [username]
  );

  if (!user) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }

  if (user.status !== 'ACTIVE') {
    return res.status(403).json({ error: 'Akun Anda telah dinonaktifkan. Hubungi Administrator.' });
  }

  const match = bcrypt.compareSync(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }

  // Generate JWT
  const token = jwt.sign(
    {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role_id
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  return res.json({
    message: 'Login berhasil',
    token,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role_id,
      roleName: user.role_name
    }
  });
});

router.get('/me', authMiddleware, (req, res) => {
  const user = db.queryOne<any>(
    `SELECT u.id, u.name, u.username, u.role_id, r.name AS role_name, u.status
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.id = ?`,
    [req.user!.id]
  );

  if (!user) {
    return res.status(404).json({ error: 'User tidak ditemukan' });
  }

  // Get permissions
  const permissions = db.query<any>(
    'SELECT permission_id FROM role_permissions WHERE role_id = ?',
    [user.role_id]
  ).map(p => p.permission_id);

  return res.json({
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role_id,
      roleName: user.role_name,
      permissions
    }
  });
});

router.post('/change-password', authMiddleware, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Password lama dan baru wajib diisi' });
  }

  const user = db.queryOne<any>('SELECT password_hash FROM users WHERE id = ?', [req.user!.id]);
  if (!user || !bcrypt.compareSync(oldPassword, user.password_hash)) {
    return res.status(400).json({ error: 'Password lama salah' });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  const now = new Date().toISOString();
  db.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [newHash, now, req.user!.id]);

  AuditService.log({
    userId: req.user!.id,
    role: req.user!.role,
    action: 'CHANGE_PASSWORD',
    entity: 'USERS',
    entityId: req.user!.id
  });

  return res.json({ message: 'Password berhasil diubah' });
});

export default router;
