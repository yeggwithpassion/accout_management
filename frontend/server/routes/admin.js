import express from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../models/db.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = express.Router();

// ==================== 统计信息 ====================

// 仪表盘统计
router.get('/stats', authenticateAdmin, (req, res) => {
  try {
    const db = getDb();
    
    const securitiesCount = db.prepare("SELECT COUNT(*) as cnt FROM securities_accounts WHERE status = 'active'").get();
    const fundCount = db.prepare("SELECT COUNT(*) as cnt FROM fund_accounts WHERE status = 'active'").get();
    const todayNewSecurities = db.prepare("SELECT COUNT(*) as cnt FROM securities_accounts WHERE date(created_at) = date('now')").get();
    const pendingOrders = db.prepare("SELECT COUNT(*) as cnt FROM orders WHERE status IN ('pending', 'partial_filled')").get();
    const todayTrades = db.prepare("SELECT COUNT(*) as cnt FROM trades WHERE date(trade_time) = date('now')").get();
    const todayVolume = db.prepare("SELECT COALESCE(SUM(volume), 0) as total FROM trades WHERE date(trade_time) = date('now')").get();
    const todayAmount = db.prepare("SELECT COALESCE(SUM(price * volume), 0) as total FROM trades WHERE date(trade_time) = date('now')").get();

    res.json({
      securitiesCount: securitiesCount.cnt,
      fundCount: fundCount.cnt,
      todayNewSecurities: todayNewSecurities.cnt,
      pendingOrders: pendingOrders.cnt,
      todayTrades: todayTrades.cnt,
      todayVolume: todayVolume.total,
      todayAmount: todayAmount.total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 订单监控 ====================

// 获取所有订单（管理员）
router.get('/orders', authenticateAdmin, (req, res) => {
  try {
    const db = getDb();
    const { stockCode, orderType, status, page = 1, limit = 50 } = req.query;
    
    let query = `
      SELECT o.*, s.name as stock_name
      FROM orders o
      LEFT JOIN stocks s ON o.stock_code = s.code
      WHERE 1=1
    `;
    const params = [];

    if (stockCode) {
      query += ' AND o.stock_code = ?';
      params.push(stockCode);
    }

    if (orderType) {
      query += ' AND o.order_type = ?';
      params.push(orderType);
    }

    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }

    const offset = (page - 1) * limit;
    const countQuery = query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) as cnt FROM');
    
    const orders = db.prepare(`${query} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    const total = db.prepare(countQuery).get(...params);

    res.json({ orders, total: total.cnt, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取某只股票的所有挂单（管理端查看）
router.get('/orders/stock/:code', authenticateAdmin, (req, res) => {
  try {
    const db = getDb();
    
    const buyOrders = db.prepare(`
      SELECT order_id, fund_account_no, price, volume, filled_volume, status, created_at
      FROM orders 
      WHERE stock_code = ? AND order_type = 'buy' AND status IN ('pending', 'partial_filled')
      ORDER BY price DESC, created_at ASC
    `).all(req.params.code);

    const sellOrders = db.prepare(`
      SELECT order_id, fund_account_no, price, volume, filled_volume, status, created_at
      FROM orders 
      WHERE stock_code = ? AND order_type = 'sell' AND status IN ('pending', 'partial_filled')
      ORDER BY price ASC, created_at ASC
    `).all(req.params.code);

    res.json({ buyOrders, sellOrders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取成交记录（管理员）
router.get('/trades', authenticateAdmin, (req, res) => {
  try {
    const db = getDb();
    const { stockCode, page = 1, limit = 50 } = req.query;
    
    let query = `
      SELECT t.*, s.name as stock_name
      FROM trades t
      LEFT JOIN stocks s ON t.stock_code = s.code
      WHERE 1=1
    `;
    const params = [];

    if (stockCode) {
      query += ' AND t.stock_code = ?';
      params.push(stockCode);
    }

    const offset = (page - 1) * limit;
    const countQuery = query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) as cnt FROM');
    
    const trades = db.prepare(`${query} ORDER BY t.trade_time DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    const total = db.prepare(countQuery).get(...params);

    res.json({ trades, total: total.cnt, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 股票管理 ====================

// 设置涨跌停限制
router.put('/stocks/:code/limit', authenticateAdmin, (req, res) => {
  try {
    const db = getDb();
    const { limitPercent, isSt } = req.body;

    const stock = db.prepare('SELECT * FROM stocks WHERE code = ?').get(req.params.code);
    if (!stock) {
      return res.status(404).json({ error: '股票不存在' });
    }

    const percent = limitPercent || (isSt ? 0.05 : 0.10);
    const stFlag = isSt !== undefined ? (isSt ? 1 : 0) : stock.is_st;

    db.prepare(`
      UPDATE stocks SET 
        limit_percent = ?,
        is_st = ?,
        limit_up = current_price * (1 + ?),
        limit_down = current_price * (1 - ?),
        updated_at = CURRENT_TIMESTAMP
      WHERE code = ?
    `).run(percent, stFlag, percent, percent, req.params.code);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 暂停/重启股票交易
router.post('/stocks/:code/toggle-trading', authenticateAdmin, (req, res) => {
  try {
    const db = getDb();
    
    const stock = db.prepare('SELECT * FROM stocks WHERE code = ?').get(req.params.code);
    if (!stock) {
      return res.status(404).json({ error: '股票不存在' });
    }

    const newStatus = stock.status === 'trading' ? 'halted' : 'trading';
    db.prepare("UPDATE stocks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE code = ?").run(newStatus, req.params.code);

    res.json({ success: true, newStatus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更改管理员密码
router.post('/change-password', authenticateAdmin, (req, res) => {
  try {
    const db = getDb();
    const { oldPassword, newPassword } = req.body;

    const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.adminId);
    const valid = bcrypt.compareSync(oldPassword, admin.password);
    
    if (!valid) {
      return res.status(400).json({ error: '原密码错误' });
    }

    const hashedPwd = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE admins SET password = ? WHERE id = ?').run(hashedPwd, req.admin.adminId);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取操作日志
router.get('/logs', authenticateAdmin, (req, res) => {
  try {
    const db = getDb();
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    const logs = db.prepare('SELECT * FROM operation_logs ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
    const total = db.prepare('SELECT COUNT(*) as cnt FROM operation_logs').get();

    res.json({ logs, total: total.cnt, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;