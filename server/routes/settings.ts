import { Router } from 'express';
import { db } from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import { AuditService } from '../services/AuditService.js';

const router = Router();
router.use(authMiddleware);

/**
 * GET /: Retrieve all settings
 */
router.get('/', (req, res) => {
  const rows = db.query<any>('SELECT key, value FROM settings');
  const settings: Record<string, string> = {};
  for (const r of rows) {
    settings[r.key] = r.value;
  }
  return res.json({ settings });
});

/**
 * PUT /: Update settings (Admin Only)
 */
router.put('/', requireAdmin, (req, res) => {
  const newSettings = req.body;
  if (!newSettings || typeof newSettings !== 'object') {
    return res.status(400).json({ error: 'Data pengaturan tidak valid' });
  }

  db.transaction(() => {
    for (const [key, value] of Object.entries(newSettings)) {
      db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
    }

    AuditService.log({
      userId: req.user!.id,
      role: req.user!.role,
      action: 'UPDATE_SETTINGS',
      entity: 'SETTINGS',
      entityId: 'ALL',
      afterValue: newSettings
    });
  });

  return res.json({ success: true, message: 'Pengaturan berhasil disimpan' });
});

export default router;
