import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { seedDatabase } from './db/seed.js';

import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import posRoutes from './routes/pos.js';
import transactionsRoutes from './routes/transactions.js';
import productionRoutes from './routes/production.js';
import productsRoutes from './routes/products.js';
import materialsRoutes from './routes/materials.js';
import customersRoutes from './routes/customers.js';
import usersRoutes from './routes/users.js';
import reportsRoutes from './routes/reports.js';
import printerRoutes from './routes/printer.js';
import backupRoutes from './routes/backup.js';
import settingsRoutes from './routes/settings.js';
import auditRoutes from './routes/audit.js';

// Initialize and seed database if necessary
seedDatabase();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'KKTS DIGITAL PRINTING POS', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/printer', printerRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/audit', auditRoutes);

// Static files for client build
const clientDist = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 KKTS DIGITAL PRINTING - POS & Management System`);
  console.log(`📡 Backend Server listening on http://localhost:${PORT}`);
  console.log(`====================================================`);
});

export default app;
