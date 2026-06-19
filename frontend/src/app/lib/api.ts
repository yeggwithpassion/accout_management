const API_BASE = '/api';
const TRADE_MANAGEMENT_API_BASE = 'http://localhost:8081/api/trade-management';

class ApiClient {
  private token: string | null = null;
  private authToken: string | null = null; // Java后端使用的auth_token

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('stock_trading_token', token);
  }

  getToken(): string | null {
    if (this.token) return this.token;
    this.token = localStorage.getItem('stock_trading_token');
    return this.token;
  }

  setAuthToken(authToken: string) {
    this.authToken = authToken;
    localStorage.setItem('stock_trading_auth_token', authToken);
  }

  getAuthToken(): string | null {
    if (this.authToken) return this.authToken;
    this.authToken = localStorage.getItem('stock_trading_auth_token');
    return this.authToken;
  }

  clearToken() {
    this.token = null;
    this.authToken = null;
    localStorage.removeItem('stock_trading_token');
    localStorage.removeItem('stock_trading_auth_token');
  }

  private getHeaders(isStaff: boolean = false): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (isStaff) {
      // 管理员使用 X-Staff-Auth-Token
      const token = this.getToken();
      if (token) {
        headers['X-Staff-Auth-Token'] = token;
      }
    } else {
      //
    }
    
    return headers;
  }

  async request<T = any>(endpoint: string, options: RequestInit = {}, isStaff: boolean = false): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(isStaff),
        ...(options.headers as Record<string, string> || {}),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP Error: ${response.status}`);
    }

    // Java后端返回格式: {code, message, ...data}
    if (data.code !== 0 && data.code !== undefined) {
      throw new Error(data.message || '请求失败');
    }

    return data;
  }

  // ==================== Auth ====================
  
  // 用户登录 - Java后端: POST /api/external/fund/login
  async userLogin(fundAccNo: string, tradePassword: string) {
    const data = await this.request('/external/fund/login', {
      method: 'POST',
      body: JSON.stringify({ fund_acc_no: fundAccNo, trade_password: tradePassword }),
    });
    
    // 保存auth_token
    if (data.auth_token) {
      this.setAuthToken(data.auth_token);
    }
    if (data.fund_acc_no) {
      localStorage.setItem('fund_acc_no', data.fund_acc_no);
    }
    if (data.sec_acc_no) {
      localStorage.setItem('sec_acc_no', data.sec_acc_no);
    }
    
    return data;
  }

  // 管理员登录 - Java后端: POST /api/internal/staff/login
  async adminLogin(username: string, password: string) {
    const data = await this.request('/internal/staff/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    
    // 保存staff_auth_token (后端返回的是 auth_token)
    if (data.auth_token) {
      this.setToken(data.auth_token);
    }
    
    return data;
  }

  // ==================== User Fund Account (External API) ====================
  
  // 获取资金账户快照 - GET /api/external/fund/snapshot
  async getFundSnapshot() {
    const fundAccNo = localStorage.getItem('fund_acc_no') || '';
    const authToken = this.getAuthToken() || '';
    return this.request(`/external/fund/snapshot?fund_acc_no=${fundAccNo}&auth_token=${authToken}`);
  }

  // 修改资金账户密码 - PUT /api/external/fund/password
  async changePassword(oldPassword: string, newPassword: string, passwordType: 'trade' | 'withdraw') {
    const fundAccNo = localStorage.getItem('fund_acc_no') || '';
    return this.request('/external/fund/password', {
      method: 'PUT',
      body: JSON.stringify({ 
        fund_acc_no: fundAccNo, 
        old_password: oldPassword, 
        new_password: newPassword,
        password_type: passwordType 
      }),
    });
  }

  // ==================== User Security Account (External API) ====================
  
  // 获取证券账户快照 - GET /api/external/security/snapshot
  async getSecuritySnapshot(stockCode?: string) {
    const secAccNo = localStorage.getItem('sec_acc_no') || '';
    const authToken = this.getAuthToken() || '';
    let url = `/external/security/snapshot?sec_acc_no=${secAccNo}&auth_token=${authToken}`;
    if (stockCode) {
      url += `&stock_code=${stockCode}`;
    }
    return this.request(url);
  }

  async getMyAccount() {
    return this.getFundSnapshot();
  }

  // ==================== Admin - Fund Account (Internal API) ====================

  // 获取资金账户列表 - GET /api/internal/fund/accounts/list
  async listFundAccounts() {
    return this.request('/internal/fund/accounts/list', {}, true);
  }

  // 查询资金账户信息 - GET /api/internal/fund/accounts
  async queryFundInfo(fundAccNo: string, idNumber: string, includeLogs: boolean = false) {
    return this.request(`/internal/fund/accounts?fund_acc_no=${fundAccNo}&id_number=${idNumber}&include_logs=${includeLogs}`, {}, true);
  }

  // 开设资金账户 - POST /api/internal/fund/accounts
  async createFundAccount(data: {
    sec_acc_no: string;
    id_number: string;
    currency: string;
    trade_password: string;
    withdraw_password: string;
  }) {
    return this.request('/internal/fund/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    }, true);
  }

  // 存款 - POST /api/internal/fund/deposit
  async deposit(fundAccNo: string, amount: number, idNumber: string) {
    return this.request('/internal/fund/deposit', {
      method: 'POST',
      body: JSON.stringify({ fund_acc_no: fundAccNo, amount, id_number: idNumber }),
    }, true);
  }

  // 取款 - POST /api/internal/fund/withdraw
  async withdraw(fundAccNo: string, amount: number, idNumber: string, withdrawPassword: string) {
    return this.request('/internal/fund/withdraw', {
      method: 'POST',
      body: JSON.stringify({ 
        fund_acc_no: fundAccNo, 
        amount, 
        id_number: idNumber,
        withdraw_password: withdrawPassword 
      }),
    }, true);
  }

  // 修改资金账户密码（管理员）- PUT /api/internal/fund/password
  async adminChangeFundPassword(fundAccNo: string, newPassword: string, passwordType: 'trade' | 'withdraw', idNumber: string) {
    return this.request('/internal/fund/password', {
      method: 'PUT',
      body: JSON.stringify({ 
        fund_acc_no: fundAccNo, 
        new_password: newPassword,
        password_type: passwordType,
        id_number: idNumber
      }),
    }, true);
  }

  // 挂失资金账户 - POST /api/internal/fund/accounts/loss
  async reportFundLoss(fundAccNo: string, reason: string, idNumber: string) {
    return this.request('/internal/fund/accounts/loss', {
      method: 'POST',
      body: JSON.stringify({ fund_acc_no: fundAccNo, reason, id_number: idNumber }),
    }, true);
  }

  // 补办资金账户 - POST /api/internal/fund/accounts/reissue
  async reissueFundAccount(oldFundAccNo: string, reason: string, idNumber: string, newTradePassword: string, newWithdrawPassword: string) {
    return this.request('/internal/fund/accounts/reissue', {
      method: 'POST',
      body: JSON.stringify({ 
        old_fund_acc_no: oldFundAccNo, 
        reason, 
        id_number: idNumber,
        new_trade_password: newTradePassword,
        new_withdraw_password: newWithdrawPassword
      }),
    }, true);
  }

  // 销户资金账户 - POST /api/internal/fund/accounts/close
  async closeFundAccount(fundAccNo: string, reason: string, idNumber: string) {
    return this.request('/internal/fund/accounts/close', {
      method: 'POST',
      body: JSON.stringify({ fund_acc_no: fundAccNo, reason, id_number: idNumber }),
    }, true);
  }

  // 绑定证券账户 - POST /api/internal/fund/accounts/bind
  async bindSecurityAccount(fundAccNo: string, secAccNo: string) {
    return this.request('/internal/fund/accounts/bind', {
      method: 'POST',
      body: JSON.stringify({ fund_acc_no: fundAccNo, sec_acc_no: secAccNo }),
    }, true);
  }

  // 解绑证券账户 - POST /api/internal/fund/accounts/unbind
  async unbindSecurityAccount(fundAccNo: string, secAccNo: string) {
    return this.request('/internal/fund/accounts/unbind', {
      method: 'POST',
      body: JSON.stringify({ fund_acc_no: fundAccNo, sec_acc_no: secAccNo }),
    }, true);
  }

  // ==================== Admin - Security Account (Internal API) ====================

  // 获取证券账户列表 - GET /api/internal/security/accounts
  async listSecurityAccounts() {
    return this.request('/internal/security/accounts', {}, true);
  }

  // 开设证券账户 - POST /api/internal/security/accounts
  async createSecuritiesAccount(data: {
    id_number: string;
    name: string;
    type: 'individual' | 'corporate';
    gender?: string;
    address?: string;
    phone?: string;
    // 企业账户字段
    legal_person_id?: string;
    business_license_no?: string;
    authorized_person_name?: string;
    authorized_person_id?: string;
  }) {
    return this.request('/internal/security/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    }, true);
  }

  // 挂失证券账户 - POST /api/internal/security/accounts/loss
  async reportSecurityLoss(secAccNo: string, reason: string, idNumber: string) {
    return this.request('/internal/security/accounts/loss', {
      method: 'POST',
      body: JSON.stringify({ sec_acc_no: secAccNo, reason, id_number: idNumber }),
    }, true);
  }

  // 补办证券账户 - POST /api/internal/security/accounts/reissue
  async reissueSecurityAccount(oldSecAccNo: string, reason: string, idNumber: string) {
    return this.request('/internal/security/accounts/reissue', {
      method: 'POST',
      body: JSON.stringify({ old_sec_acc_no: oldSecAccNo, reason, id_number: idNumber }),
    }, true);
  }

  // 销户证券账户 - POST /api/internal/security/accounts/close
  async closeSecurityAccount(secAccNo: string, reason: string, idNumber: string) {
    return this.request('/internal/security/accounts/close', {
      method: 'POST',
      body: JSON.stringify({ sec_acc_no: secAccNo, reason, id_number: idNumber }),
    }, true);
  }

  // 修改投资者信息 - PUT /api/internal/security/investors
  async updateInvestorInfo(investorId: number, data: any) {
    return this.request('/internal/security/investors', {
      method: 'PUT',
      body: JSON.stringify({ investor_id: investorId, ...data }),
    }, true);
  }

  // ==================== Admin - Staff (Internal API) ====================

  // 停用员工 - POST /api/internal/staff/deactivate
  async deactivateStaff(targetStaffId: number, reason: string) {
    return this.request('/internal/staff/deactivate', {
      method: 'POST',
      body: JSON.stringify({ target_staff_id: targetStaffId, reason }),
    }, true);
  }

  // ==================== Admin - Audit (Internal API) ====================

  // 查询操作日志 - GET /api/internal/audit/logs
  async getOperationLogs(page = 1, limit = 50) {
    return this.request(`/internal/audit/logs?page=${page}&limit=${limit}`, {}, true);
  }

  // ==================== Dashboard (Internal API) ====================

  // 获取Dashboard统计数据 - GET /api/internal/dashboard/stats
  async getDashboardStats() {
    return this.request('/internal/dashboard/stats', {}, true);
  }

  // 获取最近操作日志 - GET /api/internal/dashboard/recent-logs
  async getRecentLogs(limit = 10) {
    return this.request(`/internal/dashboard/recent-logs?limit=${limit}`, {}, true);
  }

  // ==================== Blacklist API (External - Trade Management System) ====================

  // 黑名单查询 - GET /api/trade-management/blacklist/check
  async checkBlacklist(userName: string): Promise<boolean> {
    try {
      const response = await fetch(`${TRADE_MANAGEMENT_API_BASE}/blacklist/check?userName=${encodeURIComponent(userName)}`);
      const data = await response.json();
      if (data.success && data.data === true) {
        return true; // 在黑名单中
      }
      return false; // 不在黑名单中
    } catch (error) {
      console.error('Blacklist check failed:', error);
      return false; // 查询失败默认不在黑名单
    }
  }

  async bankTransfer(direction: 'bank_to_securities' | 'securities_to_bank', amount: number, withdrawPassword: string) {
    // Java 后端暂未提供银证转账接口，保留页面等待后续联调。
    return { success: true, newBalance: 0 };
  }

}

// Singleton instance
export const api = new ApiClient();
