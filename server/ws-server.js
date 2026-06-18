import { WebSocketServer } from 'ws';
import { tradingEvents } from './engine/tradingEngine.js';
import { getDb } from './models/db.js';

let wss = null;

// 定时推送股票价格更新
let priceUpdateInterval = null;

export function setupWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });
  
  // 模拟行情变化
  startPriceSimulation();

  wss.on('connection', (ws, req) => {
    console.log('WebSocket client connected');

    // 发送当前所有股票行情
    sendAllStockPrices(ws);

    // 监听成交事件
    const tradeListener = (trade) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'trade',
          data: trade
        }));
      }
    };

    // 监听价格更新事件
    const priceListener = (update) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'priceUpdate',
          data: update
        }));
      }
    };

    tradingEvents.on('trade', tradeListener);
    tradingEvents.on('priceUpdate', priceListener);

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        
        if (data.type === 'subscribeStock') {
          // 订阅特定股票
          const stock = getDb().prepare('SELECT * FROM stocks WHERE code = ?').get(data.stockCode);
          if (stock) {
            ws.send(JSON.stringify({
              type: 'stockDetail',
              data: stock
            }));
          }
        } else if (data.type === 'getAllPrices') {
          sendAllStockPrices(ws);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      tradingEvents.removeListener('trade', tradeListener);
      tradingEvents.removeListener('priceUpdate', priceListener);
      console.log('WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  console.log('WebSocket server initialized');
}

function sendAllStockPrices(ws) {
  try {
    const db = getDb();
    const stocks = db.prepare('SELECT * FROM stocks WHERE 1=1').all();
    ws.send(JSON.stringify({
      type: 'allPrices',
      data: stocks
    }));
  } catch (error) {
    console.error('Failed to send stock prices:', error);
  }
}

// 模拟行情变化
function startPriceSimulation() {
  if (priceUpdateInterval) {
    clearInterval(priceUpdateInterval);
  }

  priceUpdateInterval = setInterval(() => {
    try {
      const db = getDb();
      const stocks = db.prepare("SELECT * FROM stocks WHERE status = 'trading'").all();

      for (const stock of stocks) {
        // 随机波动 ±2%
        const changePercent = (Math.random() - 0.5) * 0.04;
        let newPrice = stock.current_price * (1 + changePercent);

        // 检查涨跌停限制
        if (newPrice > stock.limit_up) newPrice = stock.limit_up;
        if (newPrice < stock.limit_down) newPrice = stock.limit_down;

        // 更新价格（不触发撮合，只更新行情）
        const dayHigh = Math.max(stock.day_high || newPrice, newPrice);
        const dayLow = Math.min(stock.day_low || newPrice, newPrice);

        db.prepare(`
          UPDATE stocks SET 
            current_price = ?,
            day_high = ?,
            day_low = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE code = ?
        `).run(newPrice, dayHigh, dayLow, stock.code);

        // 广播价格更新
        tradingEvents.emit('priceUpdate', {
          stockCode: stock.code,
          price: newPrice,
          dayHigh,
          dayLow,
          changePercent: changePercent * 100
        });
      }
    } catch (error) {
      console.error('Price simulation error:', error);
    }
  }, 5000); // 每5秒更新一次行情
}

export function stopPriceSimulation() {
  if (priceUpdateInterval) {
    clearInterval(priceUpdateInterval);
    priceUpdateInterval = null;
  }
}