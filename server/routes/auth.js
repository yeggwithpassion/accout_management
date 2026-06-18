import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../models/db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'stock_trading_secret_key_2026';

// 用户登录（通过资金账号和交易密码）
router.post('/user/login', (req, res) => {
  try {
    const { accountNo, tradePassword } = req.body;
    
    const db = getDb();
    const account = db.prepare(`
      SELECT fa.*, sa.name, sa.id_number, sa.status as sec_status
      FROM fund_accounts fa
      LEFT JOIN securities_accounts sa ON fa.securities_account_no = sa.account_no
      WHERE fa.account_no = ? AND fa.status != 'closed'
    `).get(accountNo);

    if (!account) {
      return res.status(401).json({ error: '账户不存在' });
    }

    if (account.status === 'frozen') {
      return res.status(403).json({ error: '账户已冻结，请联系工作人员' });
    }

    const validPassword = bcrypt.compareSync(tradePassword, account.trade_password);
    if (!validPassword) {
      return res.status(401).json({ error: '密码错误' });
    }

    const token = jwt.sign(
      { 
        accountNo: account.account_no,
        securitiesAccountNo: account.securities_account_no,
        name: account.name,
        type: 'user'
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // 更新最后登录
    db.prepare('UPDATE fund_accounts SET updated_at = CURRENT_TIMESTAMP WHERE account_no = ?').run(account.account_no);

    res.json({
      token,
      user: {
        accountNo: account.account_no,
        securitiesAccountNo: account.securities_account_no,
        name: account.name,
        balance: account.balance,
        frozenAmount: account.frozen_amount
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 管理员登录
router.post('/admin/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    const db = getDb();
    const admin = db.prepare('SELECT * FROM admins WHERE username = ? AND status = ?').get(username, 'active');

    if (!admin) {
      return res.status(401).json({ error: '管理员不存在' });
    }

    const validPassword = bcrypt.compareSync(password, admin.password);
    if (!validPassword) {
      return res.status(401).json({ error: '密码错误' });
    }

    const token = jwt.sign(
      { 
        adminId: admin.id,
        username: admin.username,
        role: admin.role,
        permissions: JSON.parse(admin.permissions || '[]'),
        type: 'admin'
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // 更新最后登录
    db.prepare('UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(admin.id);

    res.json({
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
        permissions: JSON.parse(admin.permissions || '[]')
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 首次登录 - 安全证书认证
router.post('/user/first-login', (req, res) => {
  try {
    const { accountNo, tradePassword, idNumber } = req.body;
    
    const db = getDb();
    const account = db.prepare(`
      SELECT fa.*, sa.name, sa.id_number
      FROM fund_accounts fa
      LEFT JOIN securities_accounts sa ON fa.securities_account_no = sa.account_no
      WHERE fa.account_no = ?
    `).get(accountNo);

    if (!account) {
      return res.status(401).json({ error: '账户不存在' });
    }

    // 首次登录验证身份证号
    if (account.id_number !== idNumber) {
      return res.status(401).json({ error: '身份证号验证失败' });
    }

    const validPassword = bcrypt.compareSync(tradePassword, account.trade_password);
    if (!validPassword) {
      return res.status(401).json({ error: '密码错误' });
    }

    const token = jwt.sign(
      { 
        accountNo: account.account_no,
        securitiesAccountNo: account.securities_account_no,
        name: account.name,
        type: 'user'
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        accountNo: account.account_no,
        securitiesAccountNo: account.securities_account_no,
        name: account.name,
        balance: account.balance,
        frozenAmount: account.frozen_amount
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;