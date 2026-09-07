import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import { AuditService } from '../services/AuditService.js';

const router = Router();
router.use(authMiddleware);
router.use(requireAdmin);

/**
 * GET /: Retrieve audit trail logs
 */
router.get('/', (req, res) => {
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;
  const logs = AuditService.getLogs(limit);
  return res.json({ logs });
});

export default router;
