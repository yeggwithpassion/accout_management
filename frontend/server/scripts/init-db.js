import initSqlJs from 'sql.js';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

async function main() {
  const SQL = await initSqlJs();
  
  const dbDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  const dbPath = path.join(dbDir, 'stock_trading.db');
  const db = new SQL.Database();

  console.log('Creating tables...');

  // Run all CREATE TABLE statements
  const createTables = `
CREATE TABLE IF NOT EXISTS securities_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_no TEXT UNIQUE NOT NULL,
  type TEXT CHECK(type IN ('individual', 'corporate')) NOT NULL,
  name TEXT NOT NULL,
  gender TEXT,
  id_number TEXT UNIQUE NOT NULL,
  address TEXT,
  occupation TEXT,
  education TEXT,
  workplace TEXT,
  phone TEXT,
  status TEXT CHECK(status IN ('active', 'frozen', 'closed')) DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  legal_person_id TEXT,
  business_license_no TEXT,
  authorized_person_name TEXT,
  authorized_person_id TEXT
);

CREATE TABLE IF NOT EXISTS fund_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_no TEXT UNIQUE NOT NULL,
  securities_account_no TEXT NOT NULL,
  balance REAL DEFAULT 0,
  frozen_amount REAL DEFAULT 0,
  trade_password TEXT NOT NULL,
  withdraw_password TEXT NOT NULL,
  status TEXT CHECK(status IN ('active', 'frozen', 'closed')) DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (securities_account_no) REFERENCES securities_accounts(account_no)
);

CREATE TABLE IF NOT EXISTS stocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  current_price REAL DEFAULT 0,
  previous_close REAL DEFAULT 0,
  day_high REAL DEFAULT 0,
  day_low REAL DEFAULT 0,
  week_high REAL DEFAULT 0,
  week_low REAL DEFAULT 0,
  month_high REAL DEFAULT 0,
  month_low REAL DEFAULT 0,
  limit_up REAL DEFAULT 0,
  limit_down REAL DEFAULT 0,
  limit_percent REAL DEFAULT 0.10,
  is_st INTEGER DEFAULT 0,
  status TEXT CHECK(status IN ('trading', 'halted')) DEFAULT 'trading',
  announcement TEXT,
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS holdings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fund_account_no TEXT NOT NULL,
  stock_code TEXT NOT NULL,
  total_volume INTEGER DEFAULT 0,
  available_volume INTEGER DEFAULT 0,
  cost_price REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (fund_account_no) REFERENCES fund_accounts(account_no),
  FOREIGN KEY (stock_code) REFERENCES stocks(code),
  UNIQUE(fund_account_no, stock_code)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT UNIQUE NOT NULL,
  fund_account_no TEXT NOT NULL,
  stock_code TEXT NOT NULL,
  order_type TEXT CHECK(order_type IN ('buy', 'sell')) NOT NULL,
  price REAL NOT NULL,
  volume INTEGER NOT NULL,
  filled_volume INTEGER DEFAULT 0,
  status TEXT CHECK(status IN ('pending', 'partial_filled', 'filled', 'cancelled', 'expired')) DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (fund_account_no) REFERENCES fund_accounts(account_no),
  FOREIGN KEY (stock_code) REFERENCES stocks(code)
);

CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trade_id TEXT UNIQUE NOT NULL,
  buy_order_id TEXT NOT NULL,
  sell_order_id TEXT NOT NULL,
  stock_code TEXT NOT NULL,
  price REAL NOT NULL,
  volume INTEGER NOT NULL,
  trade_time TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (buy_order_id) REFERENCES orders(order_id),
  FOREIGN KEY (sell_order_id) REFERENCES orders(order_id),
  FOREIGN KEY (stock_code) REFERENCES stocks(code)
);

CREATE TABLE IF NOT EXISTS fund_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fund_account_no TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  amount REAL NOT NULL,
  balance_after REAL NOT NULL,
  related_order_id TEXT,
  remark TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (fund_account_no) REFERENCES fund_accounts(account_no)
);

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT CHECK(role IN ('super', 'manager', 'operator')) DEFAULT 'operator',
  permissions TEXT,
  status TEXT CHECK(status IN ('active', 'disabled')) DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  last_login TEXT
);

CREATE TABLE IF NOT EXISTS operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operator_type TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);
`;

  db.run(createTables);

  // Insert initial stocks
  console.log('Inserting initial stock data...');
  
  const stocks = [
    { code: '600519', name: '贵州茅台', price: 1520.50, limit_percent: 0.10 },
    { code: '300750', name: '宁德时代', price: 198.20, limit_percent: 0.10 },
    { code: '002594', name: '比亚迪', price: 215.80, limit_percent: 0.10 },
    { code: '300059', name: '东方财富', price: 15.60, limit_percent: 0.10 },
    { code: '600036', name: '招商银行', price: 32.50, limit_percent: 0.10 },
    { code: '000001', name: '平安银行', price: 10.80, limit_percent: 0.10 },
    { code: '600276', name: '恒瑞医药', price: 45.20, limit_percent: 0.10 },
    { code: '000858', name: '五粮液', price: 128.50, limit_percent: 0.10 },
  ];

  for (const stock of stocks) {
    const limitUp = stock.price * (1 + stock.limit_percent);
    const limitDown = stock.price * (1 - stock.limit_percent);
    
    // Check if exists first
    const exists = db.exec(`SELECT id FROM stocks WHERE code = '${stock.code}'`);
    if (exists.length > 0 && exists[0].values.length > 0) continue;

    db.run(
      `INSERT INTO stocks (code, name, current_price, previous_close, day_high, day_low, week_high, week_low, month_high, month_low, limit_up, limit_down, limit_percent) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [stock.code, stock.name, stock.price, stock.price, stock.price, stock.price, 
       stock.price * 1.05, stock.price * 0.95, stock.price * 1.10, stock.price * 0.90,
       limitUp, limitDown, stock.limit_percent]
    );
  }

  // Create admin
  console.log('Creating admin account...');
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  const adminExists = db.exec("SELECT id FROM admins WHERE username = 'admin'");
  if (adminExists.length === 0 || adminExists[0].values.length === 0) {
    db.run(
      "INSERT INTO admins (username, password, role, permissions) VALUES (?, ?, ?, ?)",
      ['admin', hashedPassword, 'super', JSON.stringify(['all'])]
    );
  }

  // Create test securities account
  console.log('Creating test accounts...');
  const testSecuritiesAccount = '010023491';
  const testFundAccount = 'F10023491';

  const secExists = db.exec(`SELECT id FROM securities_accounts WHERE account_no = '${testSecuritiesAccount}'`);
  if (secExists.length === 0 || secExists[0].values.length === 0) {
    db.run(
      `INSERT INTO securities_accounts (account_no, type, name, gender, id_number, address, phone, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [testSecuritiesAccount, 'individual', '张三', 'male', '310101199001011234', '上海市浦东新区xxx路xxx号', '13800138000', 'active']
    );
  }

  const fundExists = db.exec(`SELECT id FROM fund_accounts WHERE account_no = '${testFundAccount}'`);
  if (fundExists.length === 0 || fundExists[0].values.length === 0) {
    const hashedTradePwd = bcrypt.hashSync('123456', 10);
    const hashedWithdrawPwd = bcrypt.hashSync('654321', 10);
    db.run(
      `INSERT INTO fund_accounts (account_no, securities_account_no, balance, trade_password, withdraw_password, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [testFundAccount, testSecuritiesAccount, 125600.50, hashedTradePwd, hashedWithdrawPwd, 'active']
    );
  }

  // Create holdings
  console.log('Creating test holdings...');
  const holdings = [
    { code: '600519', volume: 100, cost: 1480.00 },
    { code: '300750', volume: 500, cost: 210.50 },
    { code: '002594', volume: 300, cost: 205.10 },
    { code: '300059', volume: 2000, cost: 15.10 },
  ];

  for (const h of holdings) {
    const exists = db.exec(`SELECT id FROM holdings WHERE fund_account_no = '${testFundAccount}' AND stock_code = '${h.code}'`);
    if (exists.length > 0 && exists[0].values.length > 0) continue;
    db.run(
      `INSERT INTO holdings (fund_account_no, stock_code, total_volume, available_volume, cost_price)
       VALUES (?, ?, ?, ?, ?)`,
      [testFundAccount, h.code, h.volume, h.volume, h.cost]
    );
  }

  // Save to file
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
  
  console.log(`Database initialized successfully at: ${dbPath}`);
  console.log('Admin: admin / admin123');
  console.log('User: F10023491 / 123456');
  
  db.close();
}

main().catch(console.error);