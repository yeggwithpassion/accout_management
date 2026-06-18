import express from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../models/db.js';
import { authenticateUser } from '../middleware/auth.js';
import { tradingEngine } from '../engine/tradingEngine.js';

const router = express.Router();

// ==================== 行情查询 ====================

// 获取股票列表和行情
router.get('/stocks', (req, res) => {
  try {
    const db = getDb();
    const { keyword, page = 1, limit = 20 } = req.query;
    
    let query = 'SELECT * FROM stocks WHERE 1=1';
    const params = [];
    
    if (keyword) {
      query += ' AND (code LIKE ? OR name LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    
    const offset = (page - 1) * limit;
    const stocks = db.prepare(`${query} LIMIT ? OFFSET ?`).all(...params, limit, offset);
    const total = db.prepare(`SELECT COUNT(*) as cnt FROM (${query})`).get(...params);

    res.json({ stocks, total: total.cnt, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单只股票详情
router.get('/stocks/:code', (req, res) => {
  try {
    const db = getDb();
    const stock = db.prepare('SELECT * FROM stocks WHERE code = ?').get(req.params.code);
    
    if (!stock) {
      return res.status(404).json({ error: '股票不存在' });
    }

    // 获取最新成交记录
    const recentTrades = db.prepare(`
      SELECT * FROM trades WHERE stock_code = ? ORDER BY trade_time DESC LIMIT 20
    `).all(req.params.code);

    // 获取当前买单（价格降序）
    const buyOrders = db.prepare(`
      SELECT price, SUM(volume - filled_volume) as total_volume
      FROM orders 
      WHERE stock_code = ? AND order_type = 'buy' AND status IN ('pending', 'partial_filled')
      GROUP BY price
      ORDER BY price DESC
      LIMIT 5
    `).all(req.params.code);

    // 获取当前卖单（价格升序）
    const sellOrders = db.prepare(`
      SELECT price, SUM(volume - filled_volume) as total_volume
      FROM orders 
      WHERE stock_code = ? AND order_type = 'sell' AND status IN ('pending', 'partial_filled')
      GROUP BY price
      ORDER BY price ASC
      LIMIT 5
    `).all(req.params.code);

    res.json({
      ...stock,
      recentTrades,
      buyOrders,
      sellOrders
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 交易操作 ====================

// 获取用户持仓
router.get('/holdings', authenticateUser, (req, res) => {
  try {
    const db = getDb();
    
    const holdings = db.prepare(`
      SELECT h.*, s.name, s.current_price
      FROM holdings h
      LEFT JOIN stocks s ON h.stock_code = s.code
      WHERE h.fund_account_no = ? AND h.total_volume > 0
    `).all(req.user.accountNo);

    res.json(holdings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取用户订单列表
router.get('/orders', authenticateUser, (req, res) => {
  try {
    const db = getDb();
    const { status, page = 1, limit = 20 } = req.query;
    
    let query = `
      SELECT o.*, s.name as stock_name
      FROM orders o
      LEFT JOIN stocks s ON o.stock_code = s.code
      WHERE o.fund_account_no = ?
    `;
    const params = [req.user.accountNo];
    
    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }
    
    const offset = (page - 1) * limit;
    const orders = db.prepare(`${query} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    const total = db.prepare(`SELECT COUNT(*) as cnt FROM (${query})`).get(...params);

    res.json({ orders, total: total.cnt, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 提交交易指令（买/卖）
router.post('/orders', authenticateUser, async (req, res) => {
  try {
    const { stockCode, orderType, price, volume } = req.body;

    if (!stockCode || !orderType || !price || !volume) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    if (!['buy', 'sell'].includes(orderType)) {
      return res.status(400).json({ error: '订单类型必须是 buy 或 sell' });
    }

    if (price <= 0 || volume <= 0) {
      return res.status(400).json({ error: '价格和数量必须大于0' });
    }

    const result = await tradingEngine.submitOrder({
      fundAccountNo: req.user.accountNo,
      stockCode,
      orderType,
      price: Number(price),
      volume: Number(volume)
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 撤销订单
router.post('/orders/:orderId/cancel', authenticateUser, async (req, res) => {
  try {
    const result = await tradingEngine.cancelOrder(req.params.orderId, req.user.accountNo);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 获取资金流水
router.get('/transactions', authenticateUser, (req, res) => {
  try {
    const db = getDb();
    const { page = 1, limit = 50 } = req.query;
    
    const offset = (page - 1) * limit;
    const transactions = db.prepare(`
      SELECT * FROM fund_transactions 
      WHERE fund_account_no = ? 
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(req.user.accountNo, limit, offset);
    
    const total = db.prepare(`
      SELECT COUNT(*) as cnt FROM fund_transactions WHERE fund_account_no = ?
    `).get(req.user.accountNo);

    res.json({ transactions, total: total.cnt, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取成交记录
router.get('/trades', authenticateUser, (req, res) => {
  try {
    const db = getDb();
    const { page = 1, limit = 20 } = req.query;
    
    const offset = (page - 1) * limit;
    const trades = db.prepare(`
      SELECT t.*, s.name as stock_name
      FROM trades t
      LEFT JOIN stocks s ON t.stock_code = s.code
      LEFT JOIN orders bo ON t.buy_order_id = bo.order_id
      LEFT JOIN orders so ON t.sell_order_id = so.order_id
      WHERE bo.fund_account_no = ? OR so.fund_account_no = ?
      ORDER BY t.trade_time DESC
      LIMIT ? OFFSET ?
    `).all(req.user.accountNo, req.user.accountNo, limit, offset);

    const total = db.prepare(`
      SELECT COUNT(*) as cnt FROM trades t
      LEFT JOIN orders bo ON t.buy_order_id = bo.order_id
      LEFT JOIN orders so ON t.sell_order_id = so.order_id
      WHERE bo.fund_account_no = ? OR so.fund_account_no = ?
    `).get(req.user.accountNo, req.user.accountNo);

    res.json({ trades, total: total.cnt, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 银证转账 ====================

// 银证转账（从银行转入/转出到银行）
router.post('/transfer', authenticateUser, (req, res) => {
  try {
    const db = getDb();
    const { direction, amount, withdrawPassword } = req.body;

    if (!direction || !amount || amount <= 0) {
      return res.status(400).json({ error: '参数不合法' });
    }

    if (!['bank_to_securities', 'securities_to_bank'].includes(direction)) {
      return res.status(400).json({ error: '转账方向不合法' });
    }

    const account = db.prepare("SELECT * FROM fund_accounts WHERE account_no = ?").get(req.user.accountNo);

    // 验证取款密码
    const validPwd = bcrypt.compareSync(withdrawPassword, account.withdraw_password);
    if (!validPwd) {
      return res.status(400).json({ error: '取款密码错误' });
    }

    if (direction === 'securities_to_bank' && account.balance < amount) {
      return res.status(400).json({ error: '可用资金不足' });
    }

    const newBalance = direction === 'bank_to_securities' 
      ? account.balance + amount 
      : account.balance - amount;

    db.prepare("UPDATE fund_accounts SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE account_no = ?").run(newBalance, req.user.accountNo);

    const transactionType = direction === 'bank_to_securities' ? 'deposit' : 'withdraw';
    db.prepare(`
      INSERT INTO fund_transactions (fund_account_no, transaction_type, amount, balance_after, remark)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.accountNo, transactionType, 
      direction === 'bank_to_securities' ? amount : -amount, 
      newBalance, 
      direction === 'bank_to_securities' ? '银转证(转入)' : '证转银(转出)'
    );

    res.json({ success: true, newBalance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;