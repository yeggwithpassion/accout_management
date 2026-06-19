import { useEffect, useState } from "react";
import { ArrowRightLeft, Wallet } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { api } from "../../lib/api";

export default function UserDashboard() {
  const navigate = useNavigate();
  const [holdings, setHoldings] = useState<any[]>([]);
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      // 检查是否已登录
      const fundAccNo = localStorage.getItem("fund_acc_no");
      const authToken = localStorage.getItem("stock_trading_auth_token");
      
      if (!fundAccNo || !authToken) {
        // 未登录，跳转到登录页
        navigate("/login");
        return;
      }
      
      const accountData = await api.getFundSnapshot();
      setAccount({
        accountNo: accountData.fund_acc_no || fundAccNo,
        availableBalance: accountData.available_balance || 0,
        frozenBalance: accountData.frozen_balance || 0,
        totalBalance: accountData.total_balance || 0,
        status: accountData.status,
        name: accountData.name || "用户",
      });

      try {
        const securityData = await api.getSecuritySnapshot();
        setHoldings(Array.isArray(securityData.holdings) ? securityData.holdings : []);
      } catch {
        setHoldings([]);
      }
    } catch (err: any) {
      setError(err.message || "加载数据失败");
      if (err.message?.includes("认证") || err.message?.includes("鉴权") || err.message?.includes("token") || err.message?.includes("不能为空")) {
        navigate("/login");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold">我的账户</h2>
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-600">{error}</div>
        <Button onClick={loadData}>重试</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">我的账户</h2>
          <p className="text-slate-500">查看资金账户和证券账户信息</p>
        </div>
        <Button onClick={() => navigate("/user/transfer")}>
          <ArrowRightLeft className="w-4 h-4 mr-2" />银证转账
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">可用资金</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold font-mono">
            {account.availableBalance.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">冻结资金</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold font-mono">
            {account.frozenBalance.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">账户状态</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2 text-xl font-bold">
            <Wallet className="w-5 h-5 text-red-600" />{account.status || "未知"}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">证券持仓账户记录</CardTitle>
          <p className="text-sm text-slate-500">资金账号：{account.accountNo}　持有人：{account.name}</p>
        </CardHeader>
        <CardContent>
          {holdings.length === 0 ? (
            <div className="h-32 flex items-center justify-center bg-slate-50 rounded-md border border-dashed">
              <p className="text-slate-500">暂无持仓记录</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>证券名称</TableHead>
                  <TableHead>证券代码</TableHead>
                  <TableHead className="text-right">持仓数量</TableHead>
                  <TableHead className="text-right">冻结数量</TableHead>
                  <TableHead className="text-right">可用数量</TableHead>
                  <TableHead className="text-right">平均成本</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holdings.map((holding: any) => (
                  <TableRow key={holding.stock_code}>
                    <TableCell>{holding.stock_name || holding.stock_code}</TableCell>
                    <TableCell className="font-mono">{holding.stock_code}</TableCell>
                    <TableCell className="text-right">{holding.quantity || 0}</TableCell>
                    <TableCell className="text-right">{holding.frozen_quantity || 0}</TableCell>
                    <TableCell className="text-right">{holding.available_quantity || 0}</TableCell>
                    <TableCell className="text-right font-mono">{Number(holding.avg_cost || 0).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
