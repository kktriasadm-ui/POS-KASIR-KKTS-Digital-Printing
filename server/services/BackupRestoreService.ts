import fs from 'node:fs';
import path from 'node:path';
import { db, DB_PATH } from '../db/database.js';

export class BackupRestoreService {
  private static getBackupDir(): string {
    const bDir = path.resolve(process.cwd(), 'backups');
    if (!fs.existsSync(bDir)) {
      fs.mkdirSync(bDir, { recursive: true });
    }
    return bDir;
  }

  /**
   * Create database backup file
   */
  public static createBackup(): { filename: string; filePath: string; size: number } {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const hh = String(today.getHours()).padStart(2, '0');
    const min = String(today.getMinutes()).padStart(2, '0');

    const filename = `KKTS-Digital-Printing-Backup-${yyyy}-${mm}-${dd}_${hh}${min}.db`;
    const targetPath = path.join(this.getBackupDir(), filename);

    // SQLite backup via copy or checkpoint
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    fs.copyFileSync(DB_PATH, targetPath);

    const stats = fs.statSync(targetPath);
    return {
      filename,
      filePath: targetPath,
      size: stats.size
    };
  }

  /**
   * List existing backups
   */
  public static listBackups(): Array<{ filename: string; size: number; createdAt: string }> {
    const bDir = this.getBackupDir();
    const files = fs.readdirSync(bDir).filter(f => f.endsWith('.db') || f.endsWith('.json'));

    return files.map(filename => {
      const p = path.join(bDir, filename);
      const stat = fs.statSync(p);
      return {
        filename,
        size: stat.size,
        createdAt: stat.birthtime.toISOString()
      };
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Restore database from backup
   */
  public static restoreBackup(backupFilename: string): void {
    const bDir = this.getBackupDir();
    const sourcePath = path.join(bDir, backupFilename);

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Backup file ${backupFilename} tidak ditemukan`);
    }

    // Safety backup of current state
    const preRestoreBackup = path.join(bDir, `pre_restore_${Date.now()}.db`);
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, preRestoreBackup);
    }

    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      fs.copyFileSync(sourcePath, DB_PATH);
    } catch (err: any) {
      if (fs.existsSync(preRestoreBackup)) {
        fs.copyFileSync(preRestoreBackup, DB_PATH);
      }
      throw new Error(`Gagal restore database: ${err.message}`);
    }
  }
}
