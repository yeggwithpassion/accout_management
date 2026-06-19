import { useState, useEffect } from "react";
import { Plus, Search, DollarSign, RefreshCw, XCircle, Link as LinkIcon, ShieldAlert, Key } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { api } from "../lib/api";

interface FundAccount {
  fund_acc_no: string;
  sec_acc_no: string;
  name: string;
  id_number: string;
  available_balance: number;
  frozen_balance: number;
  currency: string;
  status: string;
  open_date: string;
}

export default function FundAccounts() {
  const [accounts, setAccounts] = useState<FundAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<FundAccount | null>(null);
  
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPassword, setWithdrawPassword] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [newAccountId, setNewAccountId] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  
  // 挂失/补办/销户相关状态
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'loss' | 'reissue' | 'close' | null>(null);
  const [actionReason, setActionReason] = useState("");
  
  // 修改密码相关状态
  const [isChangePwdModalOpen, setIsChangePwdModalOpen] = useState(false);
  const [pwdType, setPwdType] = useState<'trade' | 'withdraw'>('trade');
  const [newPassword, setNewPassword] = useState("");

  // 获取账户列表
  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await api.listFundAccounts();
      if (response.code === 0 && response.data) {
        setAccounts(response.data);
      } else {
        console.error('获取资金账户列表失败:', response.message);
      }
    } catch (error) {
      console.error('获取资金账户列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleCreateFundAccount = async () => {
    setIsChecking(true);
    setCheckError("");
    
    // 获取表单数据
    const nameInput = document.getElementById('name') as HTMLInputElement;
    const secIdInput = document.getElementById('secId') as HTMLInputElement;
    const idNumInput = document.getElementById('idNum') as HTMLInputElement;
    const currencyInput = document.getElementById('currency') as HTMLSelectElement;
    const tradePwdInput = document.getElementById('tradePwd') as HTMLInputElement;
    const fundPwdInput = document.getElementById('fundPwd') as HTMLInputElement;
    
    const userName = nameInput?.value || '';
    const secAccNo = secIdInput?.value || '';
    const idNumber = idNumInput?.value || '';
    const currency = currencyInput?.value || 'CNY';
    const tradePassword = tradePwdInput?.value || '';
    const withdrawPassword = fundPwdInput?.value || '';
    
    if (!userName) {
      setCheckError("请输入开户人姓名以供黑名单核查");
      setIsChecking(false);
      return;
    }
    
    if (!secAccNo) {
      setCheckError("请输入关联证券账户号码");
      setIsChecking(false);
      return;
    }
    
    if (!idNumber) {
      setCheckError("请输入证件号码");
      setIsChecking(false);
      return;
    }
    
    if (!tradePassword || tradePassword.length !== 6) {
      setCheckError("交易密码必须为6位数字");
      setIsChecking(false);
      return;
    }
    
    if (!withdrawPassword || withdrawPassword.length !== 6) {
      setCheckError("取款密码必须为6位数字");
      setIsChecking(false);
      return;
    }
    
    try {
      // 调用黑名单检查API
      const isBlacklisted = await api.checkBlacklist(userName);
      
      if (isBlacklisted) {
        setCheckError("联网核查拦截：该用户已被列入交易管理系统黑名单，禁止开立资金账户！");
      } else {
        // 黑名单检查通过，调用开户API
        try {
          const result = await api.createFundAccount({
            sec_acc_no: secAccNo,
            id_number: idNumber,
            currency: currency,
            trade_password: tradePassword,
            withdraw_password: withdrawPassword
          });
          
          if (result.code === 0) {
            setIsAccountModalOpen(false);
            setNewAccountId("");
            setCheckError("");
            alert(`资金账户开户成功！资金账户号: ${result.fund_acc_no || '已生成'}`);
            fetchAccounts(); // 刷新列表
          } else {
            setCheckError(result.message || "开户失败");
          }
        } catch (error: any) {
          setCheckError(error.message || "开户失败，请检查网络连接");
        }
      }
    } catch (error) {
      setCheckError("黑名单查询服务暂时不可用，请稍后重试");
    } finally {
      setIsChecking(false);
    }
  };

  const handleAction = (account: FundAccount, action: 'deposit' | 'withdraw') => {
    setSelectedAccount(account);
    setDepositAmount("");
    setWithdrawAmount("");
    setWithdrawPassword("");
    setActionError("");
    if (action === 'deposit') setIsDepositModalOpen(true);
    if (action === 'withdraw') setIsWithdrawModalOpen(true);
  };
  
  // 执行存款
  const handleDeposit = async () => {
    if (!selectedAccount || !depositAmount) return;
    
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      setActionError("请输入有效的存款金额");
      return;
    }
    
    setActionLoading(true);
    setActionError("");
    
    try {
      const result = await api.deposit(selectedAccount.fund_acc_no, amount, selectedAccount.id_number);
      if (result.code === 0) {
        setIsDepositModalOpen(false);
        alert('存款成功！');
        fetchAccounts(); // 刷新列表
      } else {
        setActionError(result.message || "存款失败");
      }
    } catch (error: any) {
      setActionError(error.message || "存款失败，请检查网络连接");
    } finally {
      setActionLoading(false);
    }
  };
  
  // 执行取款
  const handleWithdraw = async () => {
    if (!selectedAccount || !withdrawAmount || !withdrawPassword) return;
    
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setActionError("请输入有效的取款金额");
      return;
    }
    
    if (amount > selectedAccount.available_balance) {
      setActionError("取款金额不能超过可用余额");
      return;
    }
    
    setActionLoading(true);
    setActionError("");
    
    try {
      const result = await api.withdraw(
        selectedAccount.fund_acc_no, 
        amount, 
        selectedAccount.id_number,
        withdrawPassword
      );
      if (result.code === 0) {
        setIsWithdrawModalOpen(false);
        alert('取款成功！');
        fetchAccounts(); // 刷新列表
      } else {
        setActionError(result.message || "取款失败");
      }
    } catch (error: any) {
      setActionError(error.message || "取款失败，请检查网络连接或密码");
    } finally {
      setActionLoading(false);
    }
  };

  // 打开操作对话框
  const openActionModal = (account: FundAccount, type: 'loss' | 'reissue' | 'close') => {
    setSelectedAccount(account);
    setActionType(type);
    setActionReason("");
    setActionError("");
    setActionModalOpen(true);
  };

  // 执行账户操作（挂失/补办/销户）
  const handleAccountAction = async () => {
    if (!selectedAccount || !actionType) return;
    
    setActionLoading(true);
    setActionError("");
    
    try {
      let result;
      if (actionType === 'loss') {
        result = await api.reportFundLoss(selectedAccount.fund_acc_no, actionReason, selectedAccount.id_number);
      } else if (actionType === 'reissue') {
        // 补办需要新密码
        const newTradePwd = prompt('请输入新交易密码（6位数字）:');
        const newWithdrawPwd = prompt('请输入新取款密码（6位数字）:');
        if (!newTradePwd || !newWithdrawPwd || newTradePwd.length !== 6 || newWithdrawPwd.length !== 6) {
          setActionError("密码必须为6位数字");
          setActionLoading(false);
          return;
        }
        result = await api.reissueFundAccount(
          selectedAccount.fund_acc_no, 
          actionReason, 
          selectedAccount.id_number,
          newTradePwd,
          newWithdrawPwd
        );
      } else if (actionType === 'close') {
        result = await api.closeFundAccount(selectedAccount.fund_acc_no, actionReason, selectedAccount.id_number);
      }
      
      if (result && result.code === 0) {
        setActionModalOpen(false);
        alert(actionType === 'loss' ? '挂失成功' : actionType === 'reissue' ? '补办成功' : '销户成功');
        fetchAccounts(); // 刷新列表
      } else {
        setActionError(result?.message || "操作失败");
      }
    } catch (error: any) {
      setActionError(error.message || "操作失败，请检查网络连接");
    } finally {
      setActionLoading(false);
    }
  };

  // 过滤账户列表
  const filteredAccounts = accounts.filter(account => 
    account.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.fund_acc_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.sec_acc_no?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalBalance = accounts.reduce((sum, acc) => sum + (acc.available_balance || 0), 0);

  // 打开修改密码对话框
  const openChangePwdModal = (account: FundAccount) => {
    setSelectedAccount(account);
    setPwdType('trade');
    setNewPassword("");
    setActionError("");
    setIsChangePwdModalOpen(true);
  };

  // 执行修改密码
  const handleChangePassword = async () => {
    if (!selectedAccount || !newPassword) return;
    
    if (newPassword.length !== 6) {
      setActionError("密码必须为6位数字");
      return;
    }
    
    setActionLoading(true);
    setActionError("");
    
    try {
      const result = await api.adminChangeFundPassword(
        selectedAccount.fund_acc_no,
        newPassword,
        pwdType,
        selectedAccount.id_number
      );
      if (result.code === 0) {
        setIsChangePwdModalOpen(false);
        alert(`${pwdType === 'trade' ? '交易' : '取款'}密码修改成功！`);
      } else {
        setActionError(result.message || "密码修改失败");
      }
    } catch (error: any) {
      setActionError(error.message || "密码修改失败，请检查网络连接");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">资金账户业务</h2>
          <p className="text-slate-500">管理投资者的交易结算资金账户及出入金操作</p>
        </div>
        <Dialog open={isAccountModalOpen} onOpenChange={setIsAccountModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-red-600 hover:bg-red-700">
              <Plus className="mr-2 h-4 w-4" /> 开设资金账户
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>设立资金账户及关联</DialogTitle>
              <DialogDescription>
                提交身份证及证券账户卡，为投资者开立资金账户并关联，以便进行资金清算。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">开户人姓名</Label>
                  <Input id="name" placeholder="请输入真实姓名（用于黑名单核查）" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secId">关联证券账户号码</Label>
                  <div className="relative">
                    <LinkIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                    <Input id="secId" className="pl-9" placeholder="扫描或输入证券账户卡号" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="idNum">开户人身份证号 / 注册号</Label>
                  <Input id="idNum" placeholder="输入证件号" value={newAccountId} onChange={(e) => { setNewAccountId(e.target.value); setCheckError(""); }} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">币种</Label>
                  <select id="currency" className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
                    <option value="CNY">人民币 (CNY)</option>
                    <option value="USD">美元 (USD)</option>
                    <option value="HKD">港币 (HKD)</option>
                  </select>
                </div>
              </div>

              <div className={`rounded-md border p-4 ${checkError ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className={`text-sm font-medium ${checkError ? 'text-red-900' : 'text-slate-900'}`}>系统自动验证结果</p>
                    <p className={`text-xs ${checkError ? 'text-red-600' : 'text-slate-500'}`}>
                      {checkError ? checkError : '正在监听开户信息输入状态...'}
                    </p>
                  </div>
                  {!checkError && newAccountId && !isChecking && (
                     <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">格式就绪</span>
                  )}
                  {checkError && (
                     <span className="inline-flex items-center rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-800 ring-1 ring-inset ring-red-600/20"><ShieldAlert className="w-3 h-3 mr-1" />拦截</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div className="space-y-2">
                  <Label htmlFor="tradePwd">设置交易密码</Label>
                  <Input id="tradePwd" type="password" placeholder="6位数字" maxLength={6} />
                  <p className="text-xs text-slate-500">用于交易客户端发出买卖指令时验证</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fundPwd">设置取款密码</Label>
                  <Input id="fundPwd" type="password" placeholder="6位数字" maxLength={6} />
                  <p className="text-xs text-slate-500">用于从资金账户提取现金时验证</p>
                </div>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row sm:justify-end sm:items-center gap-2">
              <Button variant="outline" onClick={() => setIsAccountModalOpen(false)}>取消</Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={handleCreateFundAccount} disabled={isChecking}>
                {isChecking ? (
                  <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> 联网核查并开户...</>
                ) : (
                  '校验发放资金账户卡'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <Input 
            className="pl-9" 
            placeholder="搜索资金账号 / 姓名 / 证券账号..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" onClick={fetchAccounts} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="rounded-md border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>资金账号</TableHead>
              <TableHead>关联证券账号</TableHead>
              <TableHead>开户人姓名</TableHead>
              <TableHead className="text-right">可用余额 (元)</TableHead>
              <TableHead className="text-right">冻结金额 (元)</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>开户日期</TableHead>
              <TableHead className="text-right">出入金操作</TableHead>
              <TableHead className="text-right">账户管理</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                  加载中...
                </TableCell>
              </TableRow>
            ) : filteredAccounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              filteredAccounts.map((account) => (
                <TableRow key={account.fund_acc_no}>
                  <TableCell className="font-medium">{account.fund_acc_no}</TableCell>
                  <TableCell className="text-slate-500 flex items-center gap-1">
                    <LinkIcon className="h-3 w-3" />
                    {account.sec_acc_no || '未绑定'}
                  </TableCell>
                  <TableCell>{account.name || '未知'}</TableCell>
                  <TableCell className="text-right font-mono font-medium text-slate-900">
                    {(account.available_balance || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-mono text-slate-500">
                    {(account.frozen_balance || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    {account.status === 'normal' ? (
                      <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">正常</span>
                    ) : account.status === 'frozen' ? (
                      <span className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">挂失/冻结</span>
                    ) : account.status === 'closed' ? (
                      <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">已销户</span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-slate-100 ring-1 ring-inset ring-slate-600">黑名单</span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-500">{account.open_date}</TableCell>
                  <TableCell className="text-right">
                    {account.status === 'normal' ? (
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="h-8 text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleAction(account, 'deposit')}>
                          <Plus className="mr-1 h-3 w-3" /> 存款
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-orange-600 border-orange-200 hover:bg-orange-50" onClick={() => handleAction(account, 'withdraw')}>
                          <DollarSign className="mr-1 h-3 w-3" /> 取款
                        </Button>
                      </div>
                    ) : account.status === 'frozen' ? (
                       <span className="text-xs text-slate-400">已冻结，禁止出入金</span>
                    ) : (
                       <span className="text-xs text-red-500 font-medium">禁止任何资金操作</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {account.status === 'normal' && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-500 hover:text-yellow-600"
                          onClick={() => openActionModal(account, 'loss')}
                        >
                          <ShieldAlert className="h-4 w-4" />
                          <span className="sr-only">挂失</span>
                        </Button>
                      )}
                      
                      {account.status === 'frozen' && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-500 hover:text-red-700"
                          onClick={() => openActionModal(account, 'reissue')}
                        >
                          <RefreshCw className="h-4 w-4" />
                          <span className="sr-only">补办</span>
                        </Button>
                      )}

                      {account.status !== 'blacklisted' && account.status !== 'closed' && account.status !== 'frozen' && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-500 hover:text-red-600"
                          onClick={() => openActionModal(account, 'close')}
                        >
                          <XCircle className="h-4 w-4" />
                          <span className="sr-only">销户</span>
                        </Button>
                      )}
                      {account.status !== 'closed' && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-500 hover:text-blue-600"
                          onClick={() => openChangePwdModal(account)}
                        >
                          <Key className="h-4 w-4" />
                          <span className="sr-only">改密</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Deposit Modal */}
      <Dialog open={isDepositModalOpen} onOpenChange={setIsDepositModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>资金账户存款</DialogTitle>
            <DialogDescription>向资金账号 {selectedAccount?.fund_acc_no}（户名：{selectedAccount?.name}）中存入资金。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>当前余额</Label>
              <div className="text-lg font-mono">¥{(selectedAccount?.available_balance || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="space-y-2">
              <Label>存款金额 (元)</Label>
              <Input 
                type="number" 
                placeholder="请输入存款金额" 
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
            </div>
            {actionError && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {actionError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDepositModalOpen(false)}>取消</Button>
            <Button 
              className="bg-green-600 hover:bg-green-700" 
              onClick={handleDeposit}
              disabled={actionLoading}
            >
              {actionLoading ? '处理中...' : '确认存款'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw Modal */}
      <Dialog open={isWithdrawModalOpen} onOpenChange={setIsWithdrawModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>资金账户取款</DialogTitle>
            <DialogDescription>从资金账号 {selectedAccount?.fund_acc_no} 中提取可用现金。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>最大可取可用资金</Label>
              <div className="text-lg font-mono text-green-600">¥{(selectedAccount?.available_balance || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="space-y-2">
              <Label>取款金额 (元)</Label>
              <Input 
                type="number" 
                placeholder="请输入取款金额" 
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>验证取款密码</Label>
              <Input 
                type="password" 
                placeholder="请输入用户6位取款密码" 
                value={withdrawPassword}
                onChange={(e) => setWithdrawPassword(e.target.value)}
                maxLength={6}
              />
            </div>
            {actionError && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {actionError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWithdrawModalOpen(false)}>取消</Button>
            <Button 
              className="bg-orange-600 hover:bg-orange-700" 
              onClick={handleWithdraw}
              disabled={actionLoading}
            >
              {actionLoading ? '处理中...' : '确认取款'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 修改密码对话框 */}
      <Dialog open={isChangePwdModalOpen} onOpenChange={setIsChangePwdModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改资金账户密码</DialogTitle>
            <DialogDescription>
              为账户 {selectedAccount?.fund_acc_no}（户名：{selectedAccount?.name}）修改密码。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>密码类型</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={pwdType === 'trade' ? 'default' : 'outline'}
                  onClick={() => setPwdType('trade')}
                  className={pwdType === 'trade' ? 'bg-red-600' : ''}
                >
                  交易密码
                </Button>
                <Button
                  type="button"
                  variant={pwdType === 'withdraw' ? 'default' : 'outline'}
                  onClick={() => setPwdType('withdraw')}
                  className={pwdType === 'withdraw' ? 'bg-red-600' : ''}
                >
                  取款密码
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>新密码（6位数字）</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="请输入6位新密码"
                maxLength={6}
              />
            </div>
            {actionError && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {actionError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChangePwdModalOpen(false)}>取消</Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleChangePassword}
              disabled={actionLoading}
            >
              {actionLoading ? '处理中...' : '确认修改'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 操作对话框（挂失/补办/销户） */}
      <Dialog open={actionModalOpen} onOpenChange={setActionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'loss' ? '资金账户挂失' : actionType === 'reissue' ? '资金账户补办' : '资金账户销户'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'loss' 
                ? `办理挂失将冻结账户 ${selectedAccount?.fund_acc_no} 内所有资金，并同步冻结关联的证券账户。` 
                : actionType === 'reissue' 
                  ? `为账户 ${selectedAccount?.fund_acc_no} 办理补办，将生成新的账户号码。`
                  : `销户前必须确认该账户内资金已全部取出。此操作不可逆！`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {(actionType === 'close' && (selectedAccount?.available_balance || 0) > 0) && (
              <div className="rounded-md bg-yellow-50 p-4 border border-yellow-100">
                <p className="text-sm text-yellow-800 font-medium">账户内仍有资金</p>
                <p className="text-sm text-yellow-700 mt-1">
                  当前余额：{(selectedAccount?.available_balance || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })} 元。
                  请先通知用户提取所有资金后再办理销户。
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>{actionType === 'close' ? '销户原因' : '操作原因'}</Label>
              <Input 
                value={actionReason} 
                onChange={(e) => setActionReason(e.target.value)} 
                placeholder={actionType === 'close' ? '请输入销户原因' : '请输入原因（可选）'} 
              />
            </div>
            {actionError && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {actionError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionModalOpen(false)}>取消</Button>
            <Button 
              variant="destructive" 
              onClick={handleAccountAction}
              disabled={actionLoading || (actionType === 'close' && (selectedAccount?.available_balance || 0) > 0)}
            >
              {actionLoading ? '处理中...' : actionType === 'loss' ? '确认挂失' : actionType === 'reissue' ? '确认补办' : '确认销户'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}