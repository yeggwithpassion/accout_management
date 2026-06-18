import { useState } from "react";
import { Plus, Search, AlertCircle, RefreshCw, XCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

// Mock Data
const MOCK_ACCOUNTS = [
  { id: "A10023491", type: "individual", name: "张三", idNumber: "110105199001012345", status: "normal", openDate: "2023-05-12" },
  { id: "B99823101", type: "corporate", name: "北京某某科技有限公司", idNumber: "91110000X123456789", status: "normal", openDate: "2022-11-20" },
  { id: "A10099823", type: "individual", name: "李四", idNumber: "310104198502124567", status: "frozen", openDate: "2024-01-15" },
  { id: "C33219088", type: "individual", name: "王五（涉案）", idNumber: "21020419780912334X", status: "blacklisted", openDate: "2021-03-05" },
];

export default function SecuritiesAccounts() {
  const [accounts, setAccounts] = useState(MOCK_ACCOUNTS);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [newAccountId, setNewAccountId] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState("");

  const handleCreateAccount = () => {
    setIsChecking(true);
    setCheckError("");
    setTimeout(() => {
      setIsChecking(false);
      if (newAccountId.endsWith('334X') || newAccountId.includes('涉案')) {
        setCheckError("联网核查失败：该证件号已被列入监管黑名单（异常管控），拒绝开户！");
      } else if (!newAccountId) {
        setCheckError("请输入有效的证件号码进行核查");
      } else {
        setIsAccountModalOpen(false);
        setNewAccountId("");
        setCheckError("");
      }
    }, 1200);
  };

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
            {accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell className="font-medium">{account.id}</TableCell>
                <TableCell>
                  {account.type === 'individual' ? (
                    <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-700/10">个人</span>
                  ) : (
                    <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-700/10">法人</span>
                  )}
                </TableCell>
                <TableCell>{account.name}</TableCell>
                <TableCell className="text-slate-500">{account.idNumber}</TableCell>
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
                <TableCell className="text-slate-500">{account.openDate}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {account.status === 'normal' && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 text-yellow-600 border-yellow-200 hover:bg-yellow-50">
                            <AlertCircle className="mr-1 h-3 w-3" /> 挂失
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>证券账户挂失</DialogTitle>
                            <DialogDescription>
                              办理挂失将冻结账户 {account.id} 下所有的证券，不可进行买卖。您确定要挂失该账户吗？
                            </DialogDescription>
                          </DialogHeader>
                          <div className="py-4 space-y-4">
                            <div className="space-y-2">
                              <Label>审核操作人密码</Label>
                              <Input type="password" placeholder="输入管理员密码确认" />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline">取消</Button>
                            <Button variant="destructive">确认冻结账户</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}

                    {account.status === 'frozen' && (
                      <Button variant="outline" size="sm" className="h-8 text-red-600 border-red-200 hover:bg-red-50">
                        <RefreshCw className="mr-1 h-3 w-3" /> 补办/重新开户
                      </Button>
                    )}

                    {account.status === 'blacklisted' && (
                      <span className="text-xs text-slate-500 flex items-center justify-end h-8">
                        异常管控账户
                      </span>
                    )}

                    {account.status !== 'closed' && account.status !== 'blacklisted' && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 text-red-600 border-red-200 hover:bg-red-50">
                            <XCircle className="mr-1 h-3 w-3" /> 销户
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>证券账户销户</DialogTitle>
                            <DialogDescription>
                              销户前必须确认该账户中的所有证券已全部卖出清空。此操作不可逆！
                            </DialogDescription>
                          </DialogHeader>
                          <div className="py-4 bg-red-50 p-4 rounded-md border border-red-100 mt-4">
                            <p className="text-sm text-red-800 font-medium">系统检查结果：</p>
                            <p className="text-sm text-red-600 mt-1">该账户仍持有 2 只股票（共计 1500 股），请提示用户先卖出所有证券后再办理销户手续。</p>
                          </div>
                          <DialogFooter>
                            <Button variant="outline">关闭</Button>
                            <Button variant="destructive" disabled>强制销户 (不可用)</Button>
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
    </div>
  );
}