const API_BASE = '/api';

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('stock_trading_token', token);
  }

  getToken(): string | null {
    if (this.token) return this.token;
    this.token = localStorage.getItem('stock_trading_token');
    return this.token;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('stock_trading_token');
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...(options.headers as Record<string, string> || {}),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP Error: ${response.status}`);
    }

    return data;
  }

  // ==================== Auth ====================
  
  async userLogin(accountNo: string, tradePassword: string) {
    return this.request('/auth/user/login', {
      method: 'POST',
      body: JSON.stringify({ accountNo, tradePassword }),
    });
  }

  async userFirstLogin(accountNo: string, tradePassword: string, idNumber: string) {
    return this.request('/auth/user/first-login', {
      method: 'POST',
      body: JSON.stringify({ accountNo, tradePassword, idNumber }),
    });
  }

  async adminLogin(username: string, password: string) {
    return this.request('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  // ==================== Stocks & Market ====================

  async getStocks(keyword?: string, page = 1, limit = 20) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (keyword) params.set('keyword', keyword);
    return this.request(`/trading/stocks?${params}`);
  }

  async getStockDetail(code: string) {
    return this.request(`/trading/stocks/${code}`);
  }

  // ==================== User Trading ====================

  async getHoldings() {
    return this.request('/trading/holdings');
  }

  async getOrders(status?: string, page = 1, limit = 20) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.set('status', status);
    return this.request(`/trading/orders?${params}`);
  }

  async submitOrder(stockCode: string, orderType: 'buy' | 'sell', price: number, volume: number) {
    return this.request('/trading/orders', {
      method: 'POST',
      body: JSON.stringify({ stockCode, orderType, price, volume }),
    });
  }

  async cancelOrder(orderId: string) {
    return this.request(`/trading/orders/${orderId}/cancel`, {
      method: 'POST',
    });
  }

  async getTransactions(page = 1, limit = 50) {
    return this.request(`/trading/transactions?page=${page}&limit=${limit}`);
  }

  async getTrades(page = 1, limit = 20) {
    return this.request(`/trading/trades?page=${page}&limit=${limit}`);
  }

  async getMyAccount() {
    return this.request('/accounts/funds/my-account');
  }

  async changePassword(oldPassword: string, newPassword: string, passwordType: 'trade' | 'withdraw') {
    return this.request('/accounts/funds/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword, passwordType }),
    });
  }

  async bankTransfer(direction: 'bank_to_securities' | 'securities_to_bank', amount: number, withdrawPassword: string) {
    return this.request('/trading/transfer', {
      method: 'POST',
      body: JSON.stringify({ direction, amount, withdrawPassword }),
    });
  }

  // ==================== Admin ====================

  async getAdminStats() {
    return this.request('/admin/stats');
  }

  async getAllOrders(stockCode?: string, orderType?: string, status?: string, page = 1, limit = 50) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (stockCode) params.set('stockCode', stockCode);
    if (orderType) params.set('orderType', orderType);
    if (status) params.set('status', status);
    return this.request(`/admin/orders?${params}`);
  }

  async getStockOrders(code: string) {
    return this.request(`/admin/orders/stock/${code}`);
  }

  async getAllTrades(stockCode?: string, page = 1, limit = 50) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (stockCode) params.set('stockCode', stockCode);
    return this.request(`/admin/trades?${params}`);
  }

  async getSecuritiesAccounts(status?: string, page = 1, limit = 20) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.set('status', status);
    return this.request(`/accounts/securities?${params}`);
  }

  async createSecuritiesAccount(data: any) {
    return this.request('/accounts/securities', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSecuritiesAccountDetail(accountNo: string) {
    return this.request(`/accounts/securities/${accountNo}`);
  }

  async lossSecuritiesAccount(accountNo: string) {
    return this.request(`/accounts/securities/${accountNo}/loss`, { method: 'POST' });
  }

  async reissueSecuritiesAccount(accountNo: string) {
    return this.request(`/accounts/securities/${accountNo}/reissue`, { method: 'POST' });
  }

  async closeSecuritiesAccount(accountNo: string) {
    return this.request(`/accounts/securities/${accountNo}/close`, { method: 'POST' });
  }

  async getFundAccounts(status?: string, page = 1, limit = 20) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.set('status', status);
    return this.request(`/accounts/funds?${params}`);
  }

  async createFundAccount(data: any) {
    return this.request('/accounts/funds', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async depositOrWithdraw(accountNo: string, amount: number, type: 'deposit' | 'withdraw') {
    return this.request('/accounts/funds/deposit', {
      method: 'POST',
      body: JSON.stringify({ accountNo, amount, type }),
    });
  }

  async setStockLimit(code: string, limitPercent: number, isSt: boolean) {
    return this.request(`/admin/stocks/${code}/limit`, {
      method: 'PUT',
      body: JSON.stringify({ limitPercent, isSt }),
    });
  }

  async toggleStockTrading(code: string) {
    return this.request(`/admin/stocks/${code}/toggle-trading`, { method: 'POST' });
  }

  async changeAdminPassword(oldPassword: string, newPassword: string) {
    return this.request('/admin/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    });
  }

  async getOperationLogs(page = 1, limit = 50) {
    return this.request(`/admin/logs?page=${page}&limit=${limit}`);
  }
}

// Singleton instance
export const api = new ApiClient();

// WebSocket connection management
export function connectMarketWebSocket(onMessage: (data: any) => void): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const wsUrl = `${protocol}//${host}/ws`;
  const ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (e) {
      console.error('WebSocket parse error:', e);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  return ws;
}