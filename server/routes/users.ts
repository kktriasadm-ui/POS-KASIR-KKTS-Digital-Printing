import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import { AuditService } from '../services/AuditService.js';

const router = Router();

router.use(authMiddleware);
router.use(requireAdmin);

/**
 * GET /: List users
 */
router.get('/', (req, res) => {
  const users = db.query<any>(
    `SELECT u.id, u.name, u.username, u.role_id, r.name AS role_name, u.status,
            u.created_at, u.updated_at, u.disabled_at, u.disabled_by
     FROM users u
     JOIN roles r ON u.role_id = r.id
     ORDER BY u.created_at ASC`
  );

  for (const u of users) {
    const trxCount = db.queryOne<any>(
      'SELECT COUNT(id) AS trx_count FROM transactions WHERE cashier_id = ?',
      [u.id]
    );
    u.transactionCount = trxCount?.trx_count || 0;
  }

  const roles = db.query<any>('SELECT * FROM roles ORDER BY id ASC');

  return res.json({ users, roles });
});

/**
 * POST /: Add user (Kasir / Admin)
 */
router.post('/', (req, res) => {
  const { name, username, password, roleId = 'KASIR' } = req.body;

  if (!name || !username || !password) {
    return res.status(400).json({ error: 'Nama, username, dan password wajib diisi' });
  }

  const existing = db.queryOne<any>('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) {
    return res.status(400).json({ error: `Username '${username}' sudah digunakan` });
  }

  const userId = `USR-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const hash = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO users (id, name, username, password_hash, role_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
    [userId, name, username, hash, roleId, now, now]
  );

  AuditService.log({
    userId: req.user!.id,
    role: req.user!.role,
    action: 'CREATE_USER',
    entity: 'USERS',
    entityId: userId,
    afterValue: { name, username, roleId }
  });

  return res.json({ success: true, message: 'User berhasil dibuat', userId });
});

/**
 * PUT /:id: Edit user details
 */
router.put('/:id', (req, res) => {
  const { name, roleId } = req.body;
  const current = db.queryOne<any>('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!current) {
    return res.status(404).json({ error: 'User tidak ditemukan' });
  }

  const now = new Date().toISOString();
  db.run(
    'UPDATE users SET name = ?, role_id = ?, updated_at = ? WHERE id = ?',
    [name || current.name, roleId || current.role_id, now, req.params.id]
  );

  AuditService.log({
    userId: req.user!.id,
    role: req.user!.role,
    action: 'EDIT_USER',
    entity: 'USERS',
    entityId: req.params.id,
    beforeValue: { name: current.name, role: current.role_id },
    afterValue: { name, roleId }
  });

  return res.json({ success: true, message: 'User berhasil diperbarui' });
});

/**
 * POST /:id/reset-password: Reset Password
 */
router.post('/:id/reset-password', (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 5) {
    return res.status(400).json({ error: 'Password baru minimal 5 karakter' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  const now = new Date().toISOString();

  db.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [hash, now, req.params.id]);

  AuditService.log({
    userId: req.user!.id,
    role: req.user!.role,
    action: 'RESET_USER_PASSWORD',
    entity: 'USERS',
    entityId: req.params.id
  });

  return res.json({ success: true, message: 'Password user berhasil di-reset' });
});

/**
 * POST /:id/toggle-status: Enable / Disable User
 */
router.post('/:id/toggle-status', (req, res) => {
  const user = db.queryOne<any>('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) {
    return res.status(404).json({ error: 'User tidak ditemukan' });
  }

  if (user.id === req.user!.id) {
    return res.status(400).json({ error: 'Tidak dapat menonaktifkan akun sendiri' });
  }

  const now = new Date().toISOString();
  const nextStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
  const disabledBy = nextStatus === 'DISABLED' ? req.user!.id : null;
  const disabledAt = nextStatus === 'DISABLED' ? now : null;

  db.run(
    'UPDATE users SET status = ?, disabled_at = ?, disabled_by = ?, updated_at = ? WHERE id = ?',
    [nextStatus, disabledAt, disabledBy, now, req.params.id]
  );

  AuditService.log({
    userId: req.user!.id,
    role: req.user!.role,
    action: nextStatus === 'DISABLED' ? 'DISABLE_USER' : 'ENABLE_USER',
    entity: 'USERS',
    entityId: req.params.id,
    beforeValue: { status: user.status },
    afterValue: { status: nextStatus }
  });

  return res.json({
    success: true,
    message: `Status user diubah menjadi ${nextStatus}`,
    status: nextStatus
  });
});

export default router;
