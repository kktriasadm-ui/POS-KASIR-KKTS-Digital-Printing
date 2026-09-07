import { db } from '../db/database.js';

export type ProductionStatus = 'MENUNGGU' | 'DIPROSES' | 'SELESAI' | 'DIAMBIL' | 'DIBATALKAN';

export class ProductionEngine {
  /**
   * Generates next sequential JOB-YYYYMMDD-XXXX number
   */
  public static generateJobNumber(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const prefix = `JOB-${yyyy}${mm}${dd}-`;

    const row = db.queryOne<{ max_num: string }>(
      'SELECT job_number AS max_num FROM production_jobs WHERE job_number LIKE ? ORDER BY job_number DESC LIMIT 1',
      [`${prefix}%`]
    );

    let nextSeq = 1;
    if (row && row.max_num) {
      const parts = row.max_num.split('-');
      if (parts.length === 3) {
        const currentSeq = parseInt(parts[2], 10);
        if (!isNaN(currentSeq)) {
          nextSeq = currentSeq + 1;
        }
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  /**
   * Creates a production job for a newly committed transaction
   */
  public static createJob(params: {
    transactionId: string;
    customerId?: string;
    notes?: string;
    userId: string;
  }): { jobId: string; jobNumber: string } {
    const now = new Date().toISOString();
    const jobNumber = this.generateJobNumber();
    const jobId = `JOB-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    db.run(
      `INSERT INTO production_jobs (id, job_number, transaction_id, customer_id, status, notes, created_at)
       VALUES (?, ?, ?, ?, 'MENUNGGU', ?, ?)`,
      [jobId, jobNumber, params.transactionId, params.customerId || null, params.notes || null, now]
    );

    // Initial status log
    const logId = `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    db.run(
      `INSERT INTO production_status_logs (id, production_job_id, previous_status, new_status, changed_by, created_at, notes)
       VALUES (?, ?, NULL, 'MENUNGGU', ?, ?, ?)`,
      [logId, jobId, params.userId, now, 'Job Dibuat']
    );

    return { jobId, jobNumber };
  }

  /**
   * Updates status of a production job and logs the change
   */
  public static updateStatus(params: {
    jobId: string;
    newStatus: ProductionStatus;
    userId: string;
    notes?: string;
  }): { previousStatus: string; newStatus: string } {
    const job = db.queryOne<any>('SELECT * FROM production_jobs WHERE id = ?', [params.jobId]);
    if (!job) throw new Error('Production Job tidak ditemukan');

    const previousStatus = job.status;
    const now = new Date().toISOString();

    let completedAt = job.completed_at;
    let pickedUpAt = job.picked_up_at;

    if (params.newStatus === 'SELESAI' && !completedAt) {
      completedAt = now;
    }
    if (params.newStatus === 'DIAMBIL' && !pickedUpAt) {
      pickedUpAt = now;
    }

    db.run(
      `UPDATE production_jobs
       SET status = ?, completed_at = ?, picked_up_at = ?
       WHERE id = ?`,
      [params.newStatus, completedAt, pickedUpAt, params.jobId]
    );

    // Also update production_status in the parent transaction
    db.run('UPDATE transactions SET production_status = ? WHERE id = ?', [params.newStatus, job.transaction_id]);

    // Insert log
    const logId = `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    db.run(
      `INSERT INTO production_status_logs (id, production_job_id, previous_status, new_status, changed_by, created_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [logId, params.jobId, previousStatus, params.newStatus, params.userId, now, params.notes || null]
    );

    return { previousStatus, newStatus: params.newStatus };
  }

  /**
   * Update operational notes for a production job
   */
  public static updateNotes(jobId: string, notes: string): void {
    db.run('UPDATE production_jobs SET notes = ? WHERE id = ?', [notes, jobId]);
  }

  /**
   * Get production queue with detailed item and customer information
   */
  public static getProductionQueue(filterStatus?: string, search?: string): any[] {
    let sql = `
      SELECT pj.*,
             c.name AS customer_name, c.phone AS customer_phone,
             t.transaction_number, t.created_at AS transaction_time,
             u.name AS cashier_name
      FROM production_jobs pj
      JOIN transactions t ON pj.transaction_id = t.id
      LEFT JOIN customers c ON pj.customer_id = c.id
      JOIN users u ON t.cashier_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filterStatus && filterStatus !== 'ALL') {
      sql += ' AND pj.status = ?';
      params.push(filterStatus);
    }

    if (search && search.trim() !== '') {
      sql += ' AND (pj.job_number LIKE ? OR t.transaction_number LIKE ? OR c.name LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY pj.created_at DESC';

    const jobs = db.query<any>(sql, params);

    // Attach items and logs to each job
    for (const job of jobs) {
      job.items = db.query<any>(
        'SELECT * FROM transaction_items WHERE transaction_id = ?',
        [job.transaction_id]
      );
      job.status_logs = db.query<any>(
        `SELECT psl.*, u.name AS user_name
         FROM production_status_logs psl
         JOIN users u ON psl.changed_by = u.id
         WHERE psl.production_job_id = ?
         ORDER BY psl.created_at ASC`,
        [job.id]
      );
    }

    return jobs;
  }
}
