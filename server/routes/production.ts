import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { ProductionEngine, ProductionStatus } from '../engines/ProductionEngine.js';
import { PrinterService } from '../services/PrinterService.js';
import { AuditService } from '../services/AuditService.js';

const router = Router();

/**
 * GET /jobs: Production Queue
 */
router.get('/jobs', authMiddleware, (req, res) => {
  const { status, search } = req.query;
  const jobs = ProductionEngine.getProductionQueue(status as string, search as string);
  return res.json({ jobs });
});

/**
 * POST /jobs/:id/status: Update Job Status (Admin & Kasir)
 */
router.post('/jobs/:id/status', authMiddleware, (req, res) => {
  const { newStatus, notes } = req.body;
  if (!newStatus) {
    return res.status(400).json({ error: 'Status baru wajib ditentukan' });
  }

  const validStatuses: ProductionStatus[] = ['MENUNGGU', 'DIPROSES', 'SELESAI', 'DIAMBIL', 'DIBATALKAN'];
  if (!validStatuses.includes(newStatus)) {
    return res.status(400).json({ error: `Status '${newStatus}' tidak valid.` });
  }

  try {
    const result = ProductionEngine.updateStatus({
      jobId: req.params.id,
      newStatus,
      userId: req.user!.id,
      notes
    });

    AuditService.log({
      userId: req.user!.id,
      role: req.user!.role,
      action: 'UPDATE_PRODUCTION_STATUS',
      entity: 'PRODUCTION_JOBS',
      entityId: req.params.id,
      beforeValue: { status: result.previousStatus },
      afterValue: { status: result.newStatus, notes }
    });

    return res.json({
      success: true,
      message: `Status produksi berhasil diubah ke ${newStatus}`,
      ...result
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * PUT /jobs/:id/notes: Update operational notes
 */
router.put('/jobs/:id/notes', authMiddleware, (req, res) => {
  const { notes } = req.body;
  try {
    ProductionEngine.updateNotes(req.params.id, notes || '');
    return res.json({ success: true, message: 'Catatan produksi berhasil diperbarui' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * POST /jobs/:id/receipt: Get production receipt for printing
 */
router.post('/jobs/:id/receipt', authMiddleware, (req, res) => {
  try {
    const receipt = PrinterService.generateProductionReceipt(req.params.id);
    PrinterService.logPrint({
      transactionId: req.params.id,
      printType: 'PRODUCTION_RECEIPT',
      printedBy: req.user!.id
    });
    return res.json({ success: true, receipt });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

export default router;
