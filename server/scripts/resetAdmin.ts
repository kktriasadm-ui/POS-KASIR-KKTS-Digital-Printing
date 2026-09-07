import bcrypt from 'bcryptjs';
import { db } from '../db/database.js';

async function main() {
  console.log('====================================================');
  console.log('  KKTS DIGITAL PRINTING - RESET AKUN ADMIN / OWNER  ');
  console.log('====================================================\n');

  // 1. Tampilkan daftar semua pengguna saat ini
  const users = db.query<any>('SELECT id, name, username, role_id, status FROM users');
  console.log('Daftar pengguna yang ada di database saat ini:');
  console.table(users);

  // Ambil parameter dari command line jika ada (misal: tsx resetAdmin.ts admin admin123)
  const args = process.argv.slice(2);
  const targetUsername = args[0] || 'admin';
  const newPassword = args[1] || 'admin123';

  console.log(`\nMemproses reset akun Admin ke:`);
  console.log(`-> Username : ${targetUsername}`);
  console.log(`-> Password : ${newPassword}\n`);

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  const now = new Date().toISOString();

  // Cari apakah user admin sudah ada
  const existingAdmin = db.queryOne<any>('SELECT id FROM users WHERE username = ? OR role_id = ?', [targetUsername, 'ADMIN']);

  if (existingAdmin) {
    db.run(
      'UPDATE users SET username = ?, password_hash = ?, status = ?, updated_at = ? WHERE id = ?',
      [targetUsername, passwordHash, 'ACTIVE', now, existingAdmin.id]
    );
    console.log(`✅ BERHASIL: Password dan username admin (ID: ${existingAdmin.id}) telah direset!`);
  } else {
    // Jika belum ada akun admin sama sekali, buat baru
    db.run(
      'INSERT INTO users (name, username, password_hash, role_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['Administrator', targetUsername, passwordHash, 'ADMIN', 'ACTIVE', now, now]
    );
    console.log(`✅ BERHASIL: Akun Admin baru telah dibuat!`);
  }

  console.log('\n====================================================');
  console.log('  SILAKAN LOGIN KE SISTEM POS DENGAN:');
  console.log(`  Username : ${targetUsername}`);
  console.log(`  Password : ${newPassword}`);
  console.log('====================================================\n');
}

main().catch(err => {
  console.error('Error saat mereset admin:', err);
  process.exit(1);
});
