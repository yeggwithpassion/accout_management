import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, getDb } from './models/db.js';
import { tradingEngine } from './engine/tradingEngine.js';
import { setupWebSocket } from './ws-server.js';

// Route imports
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import tradingRoutes from './routes/trading.js';
import adminRoutes from './routes/admin.js';

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  try {
    const db = getDb();
    const stocksCount = db.prepare('SELECT COUNT(*) as cnt FROM stocks').get();
    const ordersCount = db.prepare('SELECT COUNT(*) as cnt FROM orders WHERE status IN (?, ?)').get('pending', 'partial_filled');
    
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      database: 'connected',
      stats: {
        stocks: stocksCount.cnt,
        pendingOrders: ordersCount.cnt,
        engineRunning: tradingEngine.isRunning
      }
    });
  } catch (e) {
    res.json({ status: 'ok', time: new Date().toISOString(), database: 'connected' });
  }
});

// API documentation
app.get('/api', (req, res) => {
  res.json({
    name: 'Stock Trading System API',
    version: '1.0.0',
    endpoints: {
      auth: { base: '/api/auth', routes: ['POST /user/login', 'POST /user/first-login', 'POST /admin/login'] },
      accounts: { base: '/api/accounts', routes: ['GET/POST /securities', 'GET/POST /funds', 'POST /funds/deposit', 'POST /funds/change-password'] },
      trading: { base: '/api/trading', routes: ['GET /stocks', 'GET /stocks/:code', 'GET /holdings', 'GET/POST /orders', 'POST /orders/:orderId/cancel', 'GET /transactions', 'GET /trades', 'POST /transfer'] },
      admin: { base: '/api/admin', routes: ['GET /stats', 'GET /orders', 'GET /orders/stock/:code', 'GET /trades', 'PUT /stocks/:code/limit', 'POST /stocks/:code/toggle-trading'] }
    },
    websocket: { url: 'ws://localhost:3001/ws', description: 'Real-time market data and trade notifications' }
  });
});

// 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Start server
async function startServer() {
  // Initialize database
  await initDatabase();
  console.log('Database initialized');

  // Create HTTP server
  const server = http.createServer(app);

  // Setup WebSocket
  setupWebSocket(server);

  // Start trading engine
  tradingEngine.start();

  server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║     Stock Trading System Server Started      ║
║                                              ║
║  HTTP:  http://localhost:${PORT}                  ║
║  WS:    ws://localhost:${PORT}/ws                 ║
║  API:   http://localhost:${PORT}/api              ║
║  Health: http://localhost:${PORT}/api/health       ║
║                                              ║
║  Admin:  admin / admin123                    ║
║  User:   F10023491 / 123456                  ║
║                                              ║
║  Matching Engine: Running (every 1s)          ║
║  Price Sim:       Running (every 5s)          ║
╚══════════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    tradingEngine.stop();
    server.close(() => {
      console.log('Server stopped');
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    tradingEngine.stop();
    server.close(() => process.exit(0));
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});