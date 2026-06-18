import { useState } from "react";
import { Plus, Search, DollarSign, RefreshCw, XCircle, Link as LinkIcon, ShieldAlert } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";

// Mock Data
const MOCK_FUNDS = [
  { id: "F88192301", linkedSecuritiesId: "A10023491", name: "张三", balance: 500000.00, status: "normal", openDate: "2023-05-12" },
  { id: "F92831011", linkedSecuritiesId: "B99823101", name: "北京某某科技有限公司", balance: 12500000.50, status: "normal", openDate: "2022-11-20" },
  { id: "F11234400", linkedSecuritiesId: "A10099823", name: "李四", balance: 0.00, status: "frozen", openDate: "2024-01-15" },
  { id: "F55891102", linkedSecuritiesId: "C33219088", name: "王五（涉案）", balance: 34500.00, status: "blacklisted", openDate: "2021-03-05" },
];

export default function FundAccounts() {
  const [accounts, setAccounts] = useState(MOCK_FUNDS);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<typeof MOCK_FUNDS[0] | null>(null);

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [newAccountId, setNewAccountId] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState("");

  const handleCreateFundAccount = () => {
    setIsChecking(true);
    setCheckError("");
    setTimeout(() => {
      setIsChecking(false);
      if (newAccountId.endsWith('334X') || newAccountId.includes('涉案')) {
        setCheckError("联网核查拦截：该证件号或证券账户隶属监管黑名单，禁止开立资金账户！");
      } else if (!newAccountId) {
        setCheckError("请输入有效的开户人证件信息以供核查");
      } else {
        setIsAccountModalOpen(false);
        setNewAccountId("");
        setCheckError("");
      }
    }, 1200);
  };

  const handleAction = (account: typeof MOCK_FUNDS[0], action: 'deposit' | 'withdraw') => {
    setSelectedAccount(account);
    if (action === 'deposit') setIsDepositModalOpen(true);
    if (action === 'withdraw') setIsWithdrawModalOpen(true);
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
                  <Label htmlFor="secId">关联证券账户号码</Label>
                  <div className="relative">
                    <LinkIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                    <Input id="secId" className="pl-9" placeholder="扫描或输入证券账户卡号" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="idNum">开户人身份证号 / 注册号</Label>
                  <Input id="idNum" placeholder="输入证件号 (尾号 334X 模拟拦截)" value={newAccountId} onChange={(e) => { setNewAccountId(e.target.value); setCheckError(""); }} />
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
                  <Input id="tradePwd" type="password" placeholder="6位数字" />
                  <p className="text-xs text-slate-500">用于交易客户端发出买卖指令时验证</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fundPwd">设置取款密码</Label>
                  <Input id="fundPwd" type="password" placeholder="6位数字" />
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
      </div>

      <div className="rounded-md border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>资金账号</TableHead>
              <TableHead>关联证券账号</TableHead>
              <TableHead>开户人姓名</TableHead>
              <TableHead className="text-right">账户余额 (元)</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>开户日期</TableHead>
              <TableHead className="text-right">出入金操作</TableHead>
              <TableHead className="text-right">账户管理</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell className="font-medium">{account.id}</TableCell>
                <TableCell className="text-slate-500 flex items-center gap-1">
                  <LinkIcon className="h-3 w-3" />
                  {account.linkedSecuritiesId}
                </TableCell>
                <TableCell>{account.name}</TableCell>
                <TableCell className="text-right font-mono font-medium text-slate-900">
                  {account.balance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell>
                  {account.status === 'normal' ? (
                    <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">正常</span>
                  ) : account.status === 'frozen' ? (
                    <span className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">挂失/冻结</span>
                  ) : (
                    <span className="inline-flex items-center rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-slate-100 ring-1 ring-inset ring-slate-600">黑名单</span>
                  )}
                </TableCell>
                <TableCell className="text-slate-500">{account.openDate}</TableCell>
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
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-yellow-600">
                            <ShieldAlert className="h-4 w-4" />
                            <span className="sr-only">挂失</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>资金账户挂失及冻结</DialogTitle>
                            <DialogDescription>
                              办理资金账户卡挂失将冻结该账户内所有资金，并同步冻结关联的证券账户（{account.linkedSecuritiesId}）下的所有证券。
                            </DialogDescription>
                          </DialogHeader>
                          <div className="py-4 space-y-4">
                            <div className="rounded-md bg-red-50 p-4 border border-red-100">
                              <p className="text-sm text-red-800 font-medium">警告：连带冻结影响</p>
                              <p className="text-xs text-red-600 mt-1">此操作将同时阻止用户进行任何股票买卖与资金提取操作。</p>
                            </div>
                            <div className="space-y-2">
                              <Label>审核操作人密码</Label>
                              <Input type="password" placeholder="输入管理员密码确认" />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline">取消</Button>
                            <Button variant="destructive">确认全部冻结并挂失</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                    
                    {account.status === 'frozen' && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700">
                        <RefreshCw className="h-4 w-4" />
                        <span className="sr-only">补办/重新开户</span>
                      </Button>
                    )}

                    {account.status === 'blacklisted' && (
                      <span className="text-xs text-slate-500 flex items-center justify-end h-8">
                        受限防转移管控
                      </span>
                    )}

                    {account.status !== 'blacklisted' && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600">
                            <XCircle className="h-4 w-4" />
                            <span className="sr-only">销户</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                        <DialogHeader>
                          <DialogTitle>资金账户销户</DialogTitle>
                          <DialogDescription>
                            销户需先取出账户内所有资金。销户后将取消与证券账号（{account.linkedSecuritiesId}）的关联，证券账户将被冻结。
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                           {account.balance > 0 ? (
                             <div className="rounded-md bg-yellow-50 p-4 border border-yellow-100 mb-4">
                                <p className="text-sm text-yellow-800 font-medium">账户内仍有资金</p>
                                <p className="text-sm text-yellow-700 mt-1">当前余额：{account.balance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })} 元。请先通知用户通过“取款”功能提取所有资金。</p>
                             </div>
                           ) : (
                             <div className="rounded-md bg-green-50 p-4 border border-green-100 mb-4">
                                <p className="text-sm text-green-800 font-medium">账户资金已清空，可办理销户</p>
                             </div>
                           )}
                           <div className="space-y-2 mt-4">
                             <Label>销户原因</Label>
                             <Input placeholder="请注明更换券商或其他原因" />
                           </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline">取消</Button>
                          <Button variant="destructive" disabled={account.balance > 0}>
                            解除关联并销户
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Deposit Modal */}
      <Dialog open={isDepositModalOpen} onOpenChange={setIsDepositModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>资金账户存款</DialogTitle>
            <DialogDescription>向资金账号 {selectedAccount?.id}（户名：{selectedAccount?.name}��中存入资金。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>当前余额</Label>
              <div className="text-lg font-mono">¥{selectedAccount?.balance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="space-y-2">
              <Label>存款金额 (元)</Label>
              <Input type="number" placeholder="请输入存款金额" />
            </div>
            <div className="space-y-2">
              <Label>存款方式</Label>
              <select className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
                <option>银行转账</option>
                <option>柜台现金</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDepositModalOpen(false)}>取消</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => setIsDepositModalOpen(false)}>确认存款</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw Modal */}
      <Dialog open={isWithdrawModalOpen} onOpenChange={setIsWithdrawModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>资金账户取款</DialogTitle>
            <DialogDescription>从资金账号 {selectedAccount?.id} 中提取可用现金。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>最大可取可用资金</Label>
              <div className="text-lg font-mono text-green-600">¥{selectedAccount?.balance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="space-y-2">
              <Label>取款金额 (元)</Label>
              <Input type="number" placeholder="请输入取款金额" max={selectedAccount?.balance} />
            </div>
            <div className="space-y-2">
              <Label>验证取款密码</Label>
              <Input type="password" placeholder="请输入用户6位取款密码" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWithdrawModalOpen(false)}>取消</Button>
            <Button className="bg-orange-600 hover:bg-orange-700" onClick={() => setIsWithdrawModalOpen(false)}>确认取款</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}