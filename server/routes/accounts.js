import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../models/db.js';
import { authenticateUser, authenticateAdmin } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'stock_trading_secret_key_2026';

// ==================== 证券账户管理 ====================

// 开设证券账户
router.post('/securities', authenticateAdmin, (req, res) => {
  try {
    const db = getDb();
    const { 
      type, name, gender, idNumber, address, occupation, education, workplace, phone,
      legalPersonId, businessLicenseNo, authorizedPersonName, authorizedPersonId
    } = req.body;

    // 生成账号
    const count = db.prepare("SELECT COUNT(*) as cnt FROM securities_accounts").get();
    const accountNo = '01' + String(count.cnt + 1).padStart(7, '0');

    // 检查身份证是否已开户
    const exist = db.prepare("SELECT * FROM securities_accounts WHERE id_number = ?").get(idNumber);
    if (exist) {
      return res.status(400).json({ error: '该身份证已开立证券账户' });
    }

    if (type === 'individual') {
      db.prepare(`
        INSERT INTO securities_accounts (account_no, type, name, gender, id_number, address, occupation, education, workplace, phone)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(accountNo, type, name, gender, idNumber, address, occupation, education, workplace, phone);
    } else if (type === 'corporate') {
      db.prepare(`
        INSERT INTO securities_accounts (account_no, type, name, id_number, address, phone, legal_person_id, business_license_no, authorized_person_name, authorized_person_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(accountNo, type, name, idNumber, address, phone, legalPersonId, businessLicenseNo, authorizedPersonName, authorizedPersonId);
    }

    res.json({ success: true, accountNo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取证券账户列表
router.get('/securities', authenticateAdmin, (req, res) => {
  try {
    const db = getDb();
    const { status, page = 1, limit = 20 } = req.query;
    
    let where = '1=1';
    const params = [];
    if (status) {
      where = 'status = ?';
      params.push(status);
    }

    const offset = (page - 1) * limit;
    const accounts = db.prepare(`SELECT * FROM securities_accounts WHERE ${where} LIMIT ? OFFSET ?`).all(...params, limit, offset);
    const total = db.prepare(`SELECT COUNT(*) as cnt FROM securities_accounts WHERE ${where}`).get(...params);

    res.json({ accounts, total: total.cnt, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个证券账户详情
router.get('/securities/:accountNo', authenticateAdmin, (req, res) => {
  try {
    const db = getDb();
    const account = db.prepare("SELECT * FROM securities_accounts WHERE account_no = ?").get(req.params.accountNo);
    if (!account) {
      return res.status(404).json({ error: '账户不存在' });
    }
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 挂失证券账户
router.post('/securities/:accountNo/loss', authenticateAdmin, (req, res) => {
  try {
    const db = getDb();
    
    const account = db.prepare("SELECT * FROM securities_accounts WHERE account_no = ?").get(req.params.accountNo);
    if (!account) {
      return res.status(404).json({ error: '账户不存在' });
    }

    // 冻结账户
    db.prepare("UPDATE securities_accounts SET status = 'frozen', updated_at = CURRENT_TIMESTAMP WHERE account_no = ?").run(req.params.accountNo);

    // 记录日志
    db.prepare(`
      INSERT INTO operation_logs (operator_type, operator_id, operation, target_type, target_id, details)
      VALUES ('admin', ?, 'loss_report', 'securities_account', ?, '挂失证券账户')
    `).run(req.admin?.username || 'system', req.params.accountNo);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 重新开户（补办）
router.post('/securities/:accountNo/reissue', authenticateAdmin, (req, res) => {
  try {
    const db = getDb();
    
    const account = db.prepare("SELECT * FROM securities_accounts WHERE account_no = ?").get(req.params.accountNo);
    if (!account) {
      return res.status(404).json({ error: '账户不存在' });
    }

    // 生成新账号，将旧账号数据迁移
    const count = db.prepare("SELECT COUNT(*) as cnt FROM securities_accounts").get();
    const newAccountNo = '01' + String(count.cnt + 1).padStart(7, '0');

    db.prepare(`
      INSERT INTO securities_accounts (account_no, type, name, gender, id_number, address, occupation, education, workplace, phone, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(newAccountNo, account.type, account.name, account.gender, account.id_number, account.address, account.occupation, account.education, account.workplace, account.phone);

    // 关闭旧账号
    db.prepare("UPDATE securities_accounts SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE account_no = ?").run(req.params.accountNo);

    res.json({ success: true, newAccountNo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 销户证券账户
router.post('/securities/:accountNo/close', authenticateAdmin, (req, res) => {
  try {
    const db = getDb();
    
    const account = db.prepare("SELECT * FROM securities_accounts WHERE account_no = ?").get(req.params.accountNo);
    if (!account) {
      return res.status(404).json({ error: '账户不存在' });
    }

    // 检查是否持有股票
    const fundAccounts = db.prepare("SELECT account_no FROM fund_accounts WHERE securities_account_no = ?").all(req.params.accountNo);
    for (const fa of fundAccounts) {
      const holdings = db.prepare("SELECT * FROM holdings WHERE fund_account_no = ? AND total_volume > 0").all(fa.account_no);
      if (holdings.length > 0) {
        return res.status(400).json({ error: '证券账户中仍有股票持仓，请先卖出所有股票' });
      }
    }

    // 销户
    db.prepare("UPDATE securities_accounts SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE account_no = ?").run(req.params.accountNo);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 资金账户管理 ====================

// 开设资金账户
router.post('/funds', authenticateAdmin, (req, res) => {
  try {
    const db = getDb();
    const { securitiesAccountNo, initialDeposit, tradePassword, withdrawPassword } = req.body;

    // 验证证券账户
    const secAccount = db.prepare("SELECT * FROM securities_accounts WHERE account_no = ? AND status = 'active'").get(securitiesAccountNo);
    if (!secAccount) {
      return res.status(400).json({ error: '证券账户不存在或未激活' });
    }

    // 生成资金账号
    const count = db.prepare("SELECT COUNT(*) as cnt FROM fund_accounts").get();
    const accountNo = 'F' + String(count.cnt + 1).padStart(8, '0');

    const hashedTradePwd = bcrypt.hashSync(tradePassword, 10);
    const hashedWithdrawPwd = bcrypt.hashSync(withdrawPassword, 10);

    db.prepare(`
      INSERT INTO fund_accounts (account_no, securities_account_no, balance, trade_password, withdraw_password)
      VALUES (?, ?, ?, ?, ?)
    `).run(accountNo, securitiesAccountNo, initialDeposit || 0, hashedTradePwd, hashedWithdrawPwd);

    // 记录初始存款
    if (initialDeposit > 0) {
      db.prepare(`
        INSERT INTO fund_transactions (fund_account_no, transaction_type, amount, balance_after, remark)
        VALUES (?, 'deposit', ?, ?, '初始存入')
      `).run(accountNo, initialDeposit, initialDeposit);
    }

    res.json({ success: true, accountNo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取资金账户列表
router.get('/funds', authenticateAdmin, (req, res) => {
  try {
    const db = getDb();
    const { status, page = 1, limit = 20 } = req.query;
    
    let where = '1=1';
    const params = [];
    if (status) {
      where = 'fa.status = ?';
      params.push(status);
    }

    const offset = (page - 1) * limit;
    const accounts = db.prepare(`
      SELECT fa.*, sa.name as holder_name
      FROM fund_accounts fa
      LEFT JOIN securities_accounts sa ON fa.securities_account_no = sa.account_no
      WHERE ${where}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    
    const total = db.prepare(`SELECT COUNT(*) as cnt FROM fund_accounts fa WHERE ${where}`).get(...params);

    res.json({ accounts, total: total.cnt, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取资金账户详情（用户端）
router.get('/funds/my-account', authenticateUser, (req, res) => {
  try {
    const db = getDb();
    const account = db.prepare(`
      SELECT fa.*, sa.name, sa.id_number
      FROM fund_accounts fa
      LEFT JOIN securities_accounts sa ON fa.securities_account_no = sa.account_no
      WHERE fa.account_no = ?
    `).get(req.user.accountNo);

    if (!account) {
      return res.status(404).json({ error: '账户不存在' });
    }

    res.json({
      accountNo: account.account_no,
      securitiesAccountNo: account.securities_account_no,
      name: account.name,
      balance: account.balance,
      frozenAmount: account.frozen_amount,
      status: account.status
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 存款
router.post('/funds/deposit', authenticateAdmin, (req, res) => {
  try {
    const db = getDb();
    const { accountNo, amount, type = 'deposit' } = req.body;

    if (amount <= 0) {
      return res.status(400).json({ error: '金额必须大于0' });
    }

    const account = db.prepare("SELECT * FROM fund_accounts WHERE account_no = ? AND status = 'active'").get(accountNo);
    if (!account) {
      return res.status(404).json({ error: '资金账户不存在或已冻结' });
    }

    if (type === 'withdraw' && account.balance < amount) {
      return res.status(400).json({ error: '可用余额不足' });
    }

    const newBalance = type === 'deposit' ? account.balance + amount : account.balance - amount;
    
    db.prepare("UPDATE fund_accounts SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE account_no = ?").run(newBalance, accountNo);

    db.prepare(`
      INSERT INTO fund_transactions (fund_account_no, transaction_type, amount, balance_after, remark)
      VALUES (?, ?, ?, ?, ?)
    `).run(accountNo, type, type === 'deposit' ? amount : -amount, newBalance, type === 'deposit' ? '存款' : '取款');

    res.json({ success: true, newBalance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 修改资金账户密码
router.post('/funds/change-password', authenticateUser, (req, res) => {
  try {
    const db = getDb();
    const { oldPassword, newPassword, passwordType } = req.body;

    const account = db.prepare("SELECT * FROM fund_accounts WHERE account_no = ?").get(req.user.accountNo);
    
    const currentPwd = passwordType === 'trade' ? account.trade_password : account.withdraw_password;
    const valid = bcrypt.compareSync(oldPassword, currentPwd);
    
    if (!valid) {
      return res.status(400).json({ error: '原密码错误' });
    }

    const hashedPwd = bcrypt.hashSync(newPassword, 10);
    
    if (passwordType === 'trade') {
      db.prepare("UPDATE fund_accounts SET trade_password = ?, updated_at = CURRENT_TIMESTAMP WHERE account_no = ?").run(hashedPwd, req.user.accountNo);
    } else {
      db.prepare("UPDATE fund_accounts SET withdraw_password = ?, updated_at = CURRENT_TIMESTAMP WHERE account_no = ?").run(hashedPwd, req.user.accountNo);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 挂失资金账户
router.post('/funds/:accountNo/loss', authenticateAdmin, (req, res) => {
  try {
    const db = getDb();
    
    const account = db.prepare("SELECT * FROM fund_accounts WHERE account_no = ?").get(req.params.accountNo);
    if (!account) {
      return res.status(404).json({ error: '账户不存在' });
    }

    // 冻结资金账户和相关证券账户
    db.prepare("UPDATE fund_accounts SET status = 'frozen', updated_at = CURRENT_TIMESTAMP WHERE account_no = ?").run(req.params.accountNo);
    db.prepare("UPDATE securities_accounts SET status = 'frozen', updated_at = CURRENT_TIMESTAMP WHERE account_no = ?").run(account.securities_account_no);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 销户资金账户
router.post('/funds/:accountNo/close', authenticateAdmin, (req, res) => {
  try {
    const db = getDb();
    
    const account = db.prepare("SELECT * FROM fund_accounts WHERE account_no = ?").get(req.params.accountNo);
    if (!account) {
      return res.status(404).json({ error: '账户不存在' });
    }

    // 检查余额
    if (account.balance > 0) {
      return res.status(400).json({ error: '请先取出账户内所有资金' });
    }

    if (account.frozen_amount > 0) {
      return res.status(400).json({ error: '存在冻结资金，请先处理待成交订单' });
    }

    // 销户
    db.prepare("UPDATE fund_accounts SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE account_no = ?").run(req.params.accountNo);
    
    // 冻结关联证券账户
    db.prepare("UPDATE securities_accounts SET status = 'frozen', updated_at = CURRENT_TIMESTAMP WHERE account_no = ?").run(account.securities_account_no);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;