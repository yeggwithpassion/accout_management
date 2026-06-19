import { useState, useEffect } from "react";
import { Plus, Search, AlertCircle, RefreshCw, XCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { api } from "../lib/api";

interface SecurityAccount {
  sec_acc_no: string;
  investor_id: number;
  name: string;
  id_number: string;
  investor_type: string;
  status: string;
  open_date: string;
  linked_fund_acc?: string;
}

export default function SecuritiesAccounts() {
  const [accounts, setAccounts] = useState<SecurityAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [newAccountId, setNewAccountId] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  
  // 挂失/补办/销户相关状态
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'loss' | 'reissue' | 'close' | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<SecurityAccount | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  
  // 获取账户列表
  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await api.listSecurityAccounts();
      if (response.code === 0 && response.data) {
        setAccounts(response.data);
      } else {
        console.error('获取账户列表失败:', response.message);
      }
    } catch (error) {
      console.error('获取账户列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleCreateAccount = async () => {
    setIsChecking(true);
    setCheckError("");
    
    // 获取开户人姓名（根据账户类型从不同字段获取）
    const activeTab = document.querySelector('[data-state="active"]')?.getAttribute('value') || 'individual';
    const isIndividual = activeTab === 'individual';
    const nameInput = isIndividual
      ? document.getElementById('name') as HTMLInputElement
      : document.getElementById('corpName') as HTMLInputElement;
    const userName = nameInput?.value || '';
    
    if (!userName) {
      setCheckError("请输入开户人姓名或公司名称以供黑名单核查");
      setIsChecking(false);
      return;
    }
    
    try {
      // 调用黑名单检查API（六号API）
      const isBlacklisted = await api.checkBlacklist(userName);
      
      if (isBlacklisted) {
        setCheckError("联网核查失败：该用户已被列入交易管理系统黑名单（异常管控），拒绝开户！");
      } else if (!newAccountId) {
        setCheckError("请输入有效的证件号码进行核查");
      } else {
        // 黑名单检查通过，调用开户API
        let accountData: any;
        
        if (isIndividual) {
          // 个人账户
          const gender = (document.getElementById('gender') as HTMLSelectElement)?.value || '男';
          const address = (document.getElementById('address') as HTMLInputElement)?.value || '';
          const occupation = (document.getElementById('occupation') as HTMLInputElement)?.value || '';
          const education = (document.getElementById('education') as HTMLInputElement)?.value || '';
          const workplace = (document.getElementById('workplace') as HTMLInputElement)?.value || '';
          const phone = (document.getElementById('phone') as HTMLInputElement)?.value || '';
          
          accountData = {
            investor_type: '个人',
            name: userName,
            gender: gender,
            id_type: '身份证',
            id_number: newAccountId,
            phone: phone,
            address: address,
            work_unit: workplace,
            occupation: occupation,
            education: education
          };
        } else {
          // 法人账户
          const regNumber = (document.getElementById('regNumber') as HTMLInputElement)?.value || '';
          const license = (document.getElementById('license') as HTMLInputElement)?.value || '';
          const legalRepId = (document.getElementById('legalRepId') as HTMLInputElement)?.value || '';
          const corpPhone = (document.getElementById('corpPhone') as HTMLInputElement)?.value || '';
          const corpAddress = (document.getElementById('corpAddress') as HTMLInputElement)?.value || '';
          const authName = (document.getElementById('authName') as HTMLInputElement)?.value || '';
          const authId = (document.getElementById('authId') as HTMLInputElement)?.value || '';
          const authPhone = (document.getElementById('authPhone') as HTMLInputElement)?.value || '';
          const authAddress = (document.getElementById('authAddress') as HTMLInputElement)?.value || '';
          
          accountData = {
            investor_type: '法人',
            name: userName,
            id_type: '营业执照',
            id_number: regNumber || newAccountId,
            phone: corpPhone,
            address: corpAddress,
            business_license: license,
            authorize_name: authName,
            authorize_phone: authPhone,
            authorize_address: authAddress,
            agent_name: authName,
            agent_id_number: authId
          };
        }
        
        try {
          const result = await api.createSecuritiesAccount(accountData);
          if (result.code === 0) {
            setIsAccountModalOpen(false);
            setNewAccountId("");
            setCheckError("");
            alert(`开户成功！证券账户号: ${result.sec_acc_no || '已生成'}`);
            // 刷新账户列表
            fetchAccounts();
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

  // 打开操作对话框
  const openActionModal = (account: SecurityAccount, type: 'loss' | 'reissue' | 'close') => {
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
        result = await api.reportSecurityLoss(selectedAccount.sec_acc_no, actionReason, selectedAccount.id_number);
      } else if (actionType === 'reissue') {
        result = await api.reissueSecurityAccount(selectedAccount.sec_acc_no, actionReason, selectedAccount.id_number);
      } else if (actionType === 'close') {
        result = await api.closeSecurityAccount(selectedAccount.sec_acc_no, actionReason, selectedAccount.id_number);
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
    account.sec_acc_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.id_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">证券账户业务</h2>
          <p className="text-slate-500">管理投资者的证券账户（开户、挂失、销户）</p>
        </div>
        <Dialog open={isAccountModalOpen} onOpenChange={setIsAccountModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-red-600 hover:bg-red-700">
              <Plus className="mr-2 h-4 w-4" /> 开设证券账户
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>开设证券账户</DialogTitle>
              <DialogDescription>
                填写相关信息为投资者开设新的证券账户，请确保信息真实有效。
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="individual" className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="individual">个人账户 (自然人)</TabsTrigger>
                <TabsTrigger value="corporate">法人账户</TabsTrigger>
              </TabsList>
              
              <TabsContent value="individual" className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">姓名</Label>
                    <Input id="name" placeholder="请输入真实姓名" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">性别</Label>
                    <select id="gender" className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
                      <option>男</option>
                      <option>女</option>
                    </select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="idNumber">身份证号码</Label>
                    <Input id="idNumber" placeholder="请输入18位身份证号 (输入尾号 334X 模拟黑名单拦截)" value={newAccountId} onChange={(e) => { setNewAccountId(e.target.value); setCheckError(""); }} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="address">家庭地址</Label>
                    <Input id="address" placeholder="请输入详细地址" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="occupation">职业</Label>
                    <Input id="occupation" placeholder="例如：软件工程师" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="education">学历</Label>
                    <Input id="education" placeholder="例如：本科" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="workplace">工作单位</Label>
                    <Input id="workplace" placeholder="工作单位名称" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">联系电话</Label>
                    <Input id="phone" placeholder="手机号码" />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="corporate" className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="corpName">法人姓名 / 公司名称</Label>
                    <Input id="corpName" placeholder="请输入公司全称" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regNumber">有效法人注册登记号</Label>
                    <Input id="regNumber" placeholder="统一社会信用代码 (包含涉案模拟拦截)" value={newAccountId} onChange={(e) => { setNewAccountId(e.target.value); setCheckError(""); }} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="license">营业执照号码</Label>
                    <Input id="license" placeholder="营业执照编号" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legalRepId">法定代表人身份证号码</Label>
                    <Input id="legalRepId" placeholder="法定代表人身份证" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="corpPhone">法人联系电话</Label>
                    <Input id="corpPhone" placeholder="公司电话" />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="corpAddress">法人联系地址</Label>
                    <Input id="corpAddress" placeholder="公司注册地址" />
                  </div>
                  
                  <div className="col-span-2 border-t border-slate-200 mt-2 pt-4">
                    <h4 className="text-sm font-medium mb-3 text-slate-700">授权证券交易执行人信息</h4>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="authName">授权人姓名</Label>
                    <Input id="authName" placeholder="执行人姓名" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="authId">授权人有效身份证号码</Label>
                    <Input id="authId" placeholder="执行人身份证" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="authPhone">授权人联系电话</Label>
                    <Input id="authPhone" placeholder="执行人电话" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="authAddress">授权人地址</Label>
                    <Input id="authAddress" placeholder="执行人地址" />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            <DialogFooter className="mt-6 border-t border-slate-100 pt-4 flex-col sm:flex-row sm:justify-between sm:items-center">
              <div className="text-sm font-medium h-6">
                {checkError && <span className="text-red-600 flex items-center"><AlertCircle className="h-4 w-4 mr-1" />{checkError}</span>}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAccountModalOpen(false)}>取消</Button>
                <Button onClick={handleCreateAccount} disabled={isChecking}>
                  {isChecking ? (
                    <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> 联网核查中...</>
                  ) : (
                    '确认开户并分配账号'
                  )}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <Input 
            className="pl-9" 
            placeholder="搜索姓名 / 账号 / 证件号..." 
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
              <TableHead>证券账户号码</TableHead>
              <TableHead>账户类型</TableHead>
              <TableHead>姓名 / 法人</TableHead>
              <TableHead>证件号码 / 注册号</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>登记日期</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                  加载中...
                </TableCell>
              </TableRow>
            ) : filteredAccounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              filteredAccounts.map((account) => (
                <TableRow key={account.sec_acc_no}>
                  <TableCell className="font-medium">{account.sec_acc_no}</TableCell>
                  <TableCell>
                    {account.investor_type === '个人' ? (
                      <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-700/10">个人</span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-700/10">法人</span>
                    )}
                  </TableCell>
                  <TableCell>{account.name}</TableCell>
                  <TableCell className="text-slate-500">{account.id_number}</TableCell>
                  <TableCell>
                    {account.status === 'normal' ? (
                      <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">正常</span>
                    ) : account.status === 'frozen' ? (
                      <span className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">挂失/冻结</span>
                    ) : account.status === 'blacklisted' ? (
                      <span className="inline-flex items-center rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-slate-100 ring-1 ring-inset ring-slate-600">黑名单</span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">已销户</span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-500">{account.open_date}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {account.status === 'normal' && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-yellow-600 border-yellow-200 hover:bg-yellow-50"
                          onClick={() => openActionModal(account, 'loss')}
                        >
                          <AlertCircle className="mr-1 h-3 w-3" /> 挂失
                        </Button>
                      )}

                      {account.status === 'frozen' && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => openActionModal(account, 'reissue')}
                        >
                          <RefreshCw className="mr-1 h-3 w-3" /> 补办
                        </Button>
                      )}

                      {account.status !== 'closed' && account.status !== 'blacklisted' && account.status !== 'frozen' && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => openActionModal(account, 'close')}
                        >
                          <XCircle className="mr-1 h-3 w-3" /> 销户
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

      {/* 操作对话框（挂失/补办/销户） */}
      <Dialog open={actionModalOpen} onOpenChange={setActionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'loss' ? '证券账户挂失' : actionType === 'reissue' ? '证券账户补办' : '证券账户销户'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'loss' 
                ? `办理挂失将冻结账户 ${selectedAccount?.sec_acc_no} 下所有的证券，不可进行买卖。` 
                : actionType === 'reissue' 
                  ? `为账户 ${selectedAccount?.sec_acc_no} 办理补办，将生成新的账户号码。`
                  : `销户前必须确认该账户中的所有证券已全部卖出清空。此操作不可逆！`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
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
              disabled={actionLoading}
            >
              {actionLoading ? '处理中...' : actionType === 'loss' ? '确认挂失' : actionType === 'reissue' ? '确认补办' : '确认销户'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
