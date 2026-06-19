import { getDb } from '../models/db.js';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

export const tradingEvents = new EventEmitter();

class TradingEngine {
  constructor() {
    this.isRunning = false;
    this.matchingInterval = null;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.matchingInterval = setInterval(() => this.matchOrders(), 1000);
    console.log('Trading engine started');
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    clearInterval(this.matchingInterval);
    console.log('Trading engine stopped');
  }

  // 撮合订单
  async matchOrders() {
    const db = getDb();
    
    // 获取所有可交易的股票
    const stocks = db.prepare("SELECT code, status, limit_up, limit_down FROM stocks WHERE status = 'trading'").all();
    
    for (const stock of stocks) {
      await this.matchStockOrders(stock.code, stock.limit_up, stock.limit_down);
    }
  }

  // 撮合特定股票的订单
  async matchStockOrders(stockCode, limitUp, limitDown) {
    const db = getDb();
    
    // 获取该股票的买单（价格降序）
    const buyOrders = db.prepare(`
      SELECT * FROM orders 
      WHERE stock_code = ? AND order_type = 'buy' AND status IN ('pending', 'partial_filled')
      ORDER BY price DESC, created_at ASC
    `).all(stockCode);

    // 获取该股票的卖单（价格升序）
    const sellOrders = db.prepare(`
      SELECT * FROM orders 
      WHERE stock_code = ? AND order_type = 'sell' AND status IN ('pending', 'partial_filled')
      ORDER BY price ASC, created_at ASC
    `).all(stockCode);

    if (buyOrders.length === 0 || sellOrders.length === 0) return;

    const trades = [];

    for (const buyOrder of buyOrders) {
      const remainingBuyVolume = buyOrder.volume - buyOrder.filled_volume;
      if (remainingBuyVolume <= 0) continue;

      for (const sellOrder of sellOrders) {
        const remainingSellVolume = sellOrder.volume - sellOrder.filled_volume;
        if (remainingSellVolume <= 0) continue;

        // 检查价格是否匹配
        if (buyOrder.price < sellOrder.price) continue;

        // 计算成交价格（中间价格算法）
        let tradePrice = (buyOrder.price + sellOrder.price) / 2;
        
        // 检查涨跌停限制
        if (tradePrice > limitUp) tradePrice = limitUp;
        if (tradePrice < limitDown) tradePrice = limitDown;

        // 计算成交量
        const tradeVolume = Math.min(remainingBuyVolume, remainingSellVolume);
        
        if (tradeVolume <= 0) continue;

        // 创建成交记录
        const tradeId = uuidv4();
        trades.push({
          tradeId,
          buyOrderId: buyOrder.order_id,
          sellOrderId: sellOrder.order_id,
          stockCode,
          price: tradePrice,
          volume: tradeVolume
        });

        // 更新订单状态
        const newBuyFilled = buyOrder.filled_volume + tradeVolume;
        const newSellFilled = sellOrder.filled_volume + tradeVolume;
        
        const buyStatus = newBuyFilled >= buyOrder.volume ? 'filled' : 'partial_filled';
        const sellStatus = newSellFilled >= sellOrder.volume ? 'filled' : 'partial_filled';

        db.prepare(`
          UPDATE orders SET filled_volume = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE order_id = ?
        `).run(newBuyFilled, buyStatus, buyOrder.order_id);

        db.prepare(`
          UPDATE orders SET filled_volume = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE order_id = ?
        `).run(newSellFilled, sellStatus, sellOrder.order_id);

        // 更新持仓
        await this.updateHoldings(buyOrder, sellOrder, stockCode, tradeVolume, tradePrice);

        // 更新资金
        await this.updateFunds(buyOrder, sellOrder, tradeVolume, tradePrice);

        // 更新股票价格
        await this.updateStockPrice(stockCode, tradePrice);

        // 发送成交事件
        tradingEvents.emit('trade', {
          tradeId,
          stockCode,
          price: tradePrice,
          volume: tradeVolume,
          buyOrderId: buyOrder.order_id,
          sellOrderId: sellOrder.order_id
        });

        // 如果买单已完成，跳出内层循环
        if (buyStatus === 'filled') break;
      }
    }

    return trades;
  }

  // 更新持仓
  async updateHoldings(buyOrder, sellOrder, stockCode, volume, price) {
    const db = getDb();

    // 处理买方持仓
    const buyHolding = db.prepare(`
      SELECT * FROM holdings WHERE fund_account_no = ? AND stock_code = ?
    `).get(buyOrder.fund_account_no, stockCode);

    if (buyHolding) {
      // 更新持仓成本和数量
      const totalCost = buyHolding.cost_price * buyHolding.total_volume + price * volume;
      const newTotalVolume = buyHolding.total_volume + volume;
      const newCostPrice = totalCost / newTotalVolume;

      db.prepare(`
        UPDATE holdings SET 
          total_volume = total_volume + ?,
          available_volume = available_volume + ?,
          cost_price = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(volume, volume, newCostPrice, buyHolding.id);
    } else {
      // 新建持仓
      db.prepare(`
        INSERT INTO holdings (fund_account_no, stock_code, total_volume, available_volume, cost_price)
        VALUES (?, ?, ?, ?, ?)
      `).run(buyOrder.fund_account_no, stockCode, volume, volume, price);
    }

    // 处理卖方持仓
    db.prepare(`
      UPDATE holdings SET 
        total_volume = total_volume - ?,
        available_volume = available_volume - ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE fund_account_no = ? AND stock_code = ?
    `).run(volume, volume, sellOrder.fund_account_no, stockCode);
  }

  // 更新资金
  async updateFunds(buyOrder, sellOrder, volume, price) {
    const db = getDb();
    const totalAmount = price * volume;

    // 买方：冻结资金解冻并扣除实际成交金额
    const buyAccount = db.prepare(`
      SELECT balance, frozen_amount FROM fund_accounts WHERE account_no = ?
    `).get(buyOrder.fund_account_no);

    // 解冻原冻结资金
    const originalFrozen = buyOrder.price * volume;
    const actualCost = price * volume;
    const refund = originalFrozen - actualCost;

    db.prepare(`
      UPDATE fund_accounts SET 
        balance = balance + ?,
        frozen_amount = frozen_amount - ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE account_no = ?
    `).run(refund, originalFrozen, buyOrder.fund_account_no);

    // 记录资金流水
    db.prepare(`
      INSERT INTO fund_transactions (fund_account_no, transaction_type, amount, balance_after, related_order_id, remark)
      VALUES (?, 'buy', ?, (SELECT balance FROM fund_accounts WHERE account_no = ?), ?, ?)
    `).run(buyOrder.fund_account_no, -actualCost, buyOrder.fund_account_no, buyOrder.order_id, `买入${volume}股`);

    // 卖方：增加可用资金
    db.prepare(`
      UPDATE fund_accounts SET 
        balance = balance + ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE account_no = ?
    `).run(totalAmount, sellOrder.fund_account_no);

    db.prepare(`
      INSERT INTO fund_transactions (fund_account_no, transaction_type, amount, balance_after, related_order_id, remark)
      VALUES (?, 'sell', ?, (SELECT balance FROM fund_accounts WHERE account_no = ?), ?, ?)
    `).run(sellOrder.fund_account_no, totalAmount, sellOrder.fund_account_no, sellOrder.order_id, `卖出${volume}股`);
  }

  // 更新股票价格
  async updateStockPrice(stockCode, price) {
    const db = getDb();
    
    const stock = db.prepare('SELECT * FROM stocks WHERE code = ?').get(stockCode);
    
    // 更新当前价格、最高价、最低价
    const dayHigh = Math.max(stock.day_high || price, price);
    const dayLow = Math.min(stock.day_low || price, price);
    const weekHigh = Math.max(stock.week_high || price, price);
    const weekLow = Math.min(stock.week_low || price, price);
    const monthHigh = Math.max(stock.month_high || price, price);
    const monthLow = Math.min(stock.month_low || price, price);

    db.prepare(`
      UPDATE stocks SET 
        current_price = ?,
        day_high = ?,
        day_low = ?,
        week_high = ?,
        week_low = ?,
        month_high = ?,
        month_low = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE code = ?
    `).run(price, dayHigh, dayLow, weekHigh, weekLow, monthHigh, monthLow, stockCode);

    // 发送价格更新事件
    tradingEvents.emit('priceUpdate', {
      stockCode,
      price,
      dayHigh,
      dayLow
    });
  }

  // 提交订单
  async submitOrder(orderData) {
    const db = getDb();
    const { fundAccountNo, stockCode, orderType, price, volume } = orderData;

    // 验证资金账户
    const account = db.prepare('SELECT * FROM fund_accounts WHERE account_no = ? AND status = ?').get(fundAccountNo, 'active');
    if (!account) {
      throw new Error('资金账户不存在或已冻结');
    }

    // 验证股票
    const stock = db.prepare('SELECT * FROM stocks WHERE code = ? AND status = ?').get(stockCode, 'trading');
    if (!stock) {
      throw new Error('股票不存在或已停牌');
    }

    // 验证价格是否在涨跌停范围内
    if (price > stock.limit_up || price < stock.limit_down) {
      throw new Error(`价格必须在涨跌停范围内: ${stock.limit_down.toFixed(2)} - ${stock.limit_up.toFixed(2)}`);
    }

    // 如果是买单，检查资金
    if (orderType === 'buy') {
      const requiredAmount = price * volume;
      if (account.balance < requiredAmount) {
        throw new Error('可用资金不足');
      }

      // 冻结资金
      db.prepare(`
        UPDATE fund_accounts SET 
          balance = balance - ?,
          frozen_amount = frozen_amount + ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE account_no = ?
      `).run(requiredAmount, requiredAmount, fundAccountNo);

      // 记录冻结
      db.prepare(`
        INSERT INTO fund_transactions (fund_account_no, transaction_type, amount, balance_after, remark)
        VALUES (?, 'freeze', ?, (SELECT balance FROM fund_accounts WHERE account_no = ?), ?)
      `).run(fundAccountNo, -requiredAmount, fundAccountNo, `冻结资金:买入${stockCode}`);
    }

    // 如果是卖单，检查持仓
    if (orderType === 'sell') {
      const holding = db.prepare(`
        SELECT * FROM holdings WHERE fund_account_no = ? AND stock_code = ?
      `).get(fundAccountNo, stockCode);

      if (!holding || holding.available_volume < volume) {
        throw new Error('可用持仓不足');
      }

      // 冻结持仓
      db.prepare(`
        UPDATE holdings SET 
          available_volume = available_volume - ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(volume, holding.id);
    }

    // 创建订单
    const orderId = uuidv4();
    db.prepare(`
      INSERT INTO orders (order_id, fund_account_no, stock_code, order_type, price, volume, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(orderId, fundAccountNo, stockCode, orderType, price, volume);

    // 记录日志
    db.prepare(`
      INSERT INTO operation_logs (operator_type, operator_id, operation, target_type, target_id, details)
      VALUES (?, ?, ?, 'order', ?, ?)
    `).run('user', fundAccountNo, 'submit_order', orderId, JSON.stringify({ stockCode, orderType, price, volume }));

    return { orderId, status: 'pending' };
  }

  // 撤单
  async cancelOrder(orderId, fundAccountNo) {
    const db = getDb();

    const order = db.prepare('SELECT * FROM orders WHERE order_id = ? AND fund_account_no = ?').get(orderId, fundAccountNo);
    
    if (!order) {
      throw new Error('订单不存在');
    }

    if (order.status !== 'pending' && order.status !== 'partial_filled') {
      throw new Error('订单状态不允许撤单');
    }

    const remainingVolume = order.volume - order.filled_volume;
    const refundAmount = order.price * remainingVolume;

    // 撤销订单
    db.prepare(`
      UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE order_id = ?
    `).run(orderId);

    // 如果是买单，解冻资金
    if (order.order_type === 'buy') {
      db.prepare(`
        UPDATE fund_accounts SET 
          balance = balance + ?,
          frozen_amount = frozen_amount - ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE account_no = ?
      `).run(refundAmount, refundAmount, fundAccountNo);

      db.prepare(`
        INSERT INTO fund_transactions (fund_account_no, transaction_type, amount, balance_after, related_order_id, remark)
        VALUES (?, 'unfreeze', ?, (SELECT balance FROM fund_accounts WHERE account_no = ?), ?, ?)
      `).run(fundAccountNo, refundAmount, fundAccountNo, orderId, '撤单解冻资金');
    }

    // 如果是卖单，解冻持仓
    if (order.order_type === 'sell') {
      db.prepare(`
        UPDATE holdings SET 
          available_volume = available_volume + ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE fund_account_no = ? AND stock_code = ?
      `).run(remainingVolume, fundAccountNo, order.stock_code);
    }

    return { success: true };
  }
}

export const tradingEngine = new TradingEngine();