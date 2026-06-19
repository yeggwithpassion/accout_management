import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DB_PATH || './data/stock_trading.db';

let sqlInstance = null;
let db = null;

// sql.js 数据库异步初始化
export async function initDatabase() {
  const SQL = await initSqlJs();
  sqlInstance = SQL;

  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('数据库已从文件加载');
  } else {
    db = new SQL.Database();
    console.log('数据库已初始化（内存）');
  }
  
  return db;
}

export function getDb() {
  if (!db) {
    throw new Error('数据库未初始化，请先调用 initDatabase()');
  }
  return new DbWrapper(db);
}

class DbWrapper {
  constructor(innerDb) {
    this.innerDb = innerDb;
  }

  exec(sql) {
    this.innerDb.run(sql);
    return this;
  }

  prepare(sql) {
    return new StatementWrapper(this.innerDb, sql);
  }

  saveToFile() {
    const buffer = this.innerDb.export();
    const bufferNode = Buffer.from(buffer);
    fs.writeFileSync(DB_PATH, bufferNode);
  }
}

class StatementWrapper {
  constructor(innerDb, sql) {
    this.innerDb = innerDb;
    this.sql = sql;
  }

  run(...params) {
    try {
      const flatParams = flattenParams(params);
      if (flatParams.length === 0) {
        this.innerDb.run(this.sql);
      } else {
        this.innerDb.run(this.sql, flatParams);
      }
      this.saveDb();
      return { changes: this.innerDb.getRowsModified() };
    } catch (e) {
      console.error('SQL Error (run):', this.sql, e.message);
      throw e;
    }
  }

  get(...params) {
    try {
      const flatParams = flattenParams(params);
      let stmt = this.innerDb.prepare(this.sql);
      if (flatParams.length > 0) {
        stmt.bind(flatParams);
      }
      let result = null;
      if (stmt.step()) {
        result = stmt.getAsObject();
      }
      stmt.free();
      return result;
    } catch (e) {
      console.error('SQL Error (get):', this.sql, e.message);
      throw e;
    }
  }

  all(...params) {
    try {
      const flatParams = flattenParams(params);
      let stmt = this.innerDb.prepare(this.sql);
      if (flatParams.length > 0) {
        stmt.bind(flatParams);
      }
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    } catch (e) {
      console.error('SQL Error (all):', this.sql, e.message);
      throw e;
    }
  }

  saveDb() {
    try {
      const buffer = this.innerDb.export();
      const bufferNode = Buffer.from(buffer);
      const dbDir = path.dirname(DB_PATH);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      fs.writeFileSync(DB_PATH, bufferNode);
    } catch (e) {
      console.error('保存数据库失败:', e.message);
    }
  }
}

function flattenParams(params) {
  if (params.length === 0) return [];
  if (params.length === 1 && params[0] === undefined) return [];
  // 如果第一个元素是数组，展开它
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0];
  }
  return params;
}