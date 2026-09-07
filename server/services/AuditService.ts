import { db } from '../db/database.js';

export class AuditService {
  public static log(params: {
    userId: string;
    role: string;
    action: string;
    entity: string;
    entityId: string;
    beforeValue?: any;
    afterValue?: any;
  }): void {
    const logId = `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO audit_logs (id, user_id, role, action, entity, entity_id, before_value, after_value, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        logId,
        params.userId,
        params.role,
        params.action,
        params.entity,
        params.entityId,
        params.beforeValue ? JSON.stringify(params.beforeValue) : null,
        params.afterValue ? JSON.stringify(params.afterValue) : null,
        now
      ]
    );
  }

  public static getLogs(limit: number = 100): any[] {
    return db.query<any>(
      `SELECT a.*, u.name as user_name, u.username
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC
       LIMIT ?`,
      [limit]
    );
  }
}
