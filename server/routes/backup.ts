import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import { BackupRestoreService } from '../services/BackupRestoreService.js';
import { AuditService } from '../services/AuditService.js';

const router = Router();
router.use(authMiddleware);
router.use(requireAdmin);

/**
 * POST /create: Create backup
 */
router.post('/create', (req, res) => {
  try {
    const backup = BackupRestoreService.createBackup();

    AuditService.log({
      userId: req.user!.id,
      role: req.user!.role,
      action: 'DATABASE_BACKUP',
      entity: 'DATABASE',
      entityId: backup.filename,
      afterValue: { filename: backup.filename, size: backup.size }
    });

    return res.json({ success: true, message: 'Backup database berhasil dibuat', backup });
  } catch (err: any) {
    return res.status(500).json({ error: `Gagal membuat backup: ${err.message}` });
  }
});

/**
 * GET /list: List backups
 */
router.get('/list', (req, res) => {
  try {
    const backups = BackupRestoreService.listBackups();
    return res.json({ backups });
  } catch (err: any) {
    return res.status(500).json({ error: `Gagal mengambil daftar backup: ${err.message}` });
  }
});

/**
 * POST /restore: Restore backup
 */
router.post('/restore', (req, res) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ error: 'Nama file backup wajib ditentukan' });
  }

  try {
    BackupRestoreService.restoreBackup(filename);

    AuditService.log({
      userId: req.user!.id,
      role: req.user!.role,
      action: 'DATABASE_RESTORE',
      entity: 'DATABASE',
      entityId: filename
    });

    return res.json({ success: true, message: 'Database berhasil dipulihkan (restore)' });
  } catch (err: any) {
    return res.status(500).json({ error: `Gagal restore database: ${err.message}` });
  }
});

/**
 * GET /download/:filename: Download backup file
 */
router.get('/download/:filename', (req, res) => {
  const safeName = path.basename(req.params.filename);
  const bDir = path.resolve(process.cwd(), 'backups');
  const target = path.join(bDir, safeName);

  if (!fs.existsSync(target)) {
    return res.status(404).json({ error: 'File backup tidak ditemukan' });
  }

  return res.download(target, safeName);
});

export default router;
