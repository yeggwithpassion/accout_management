import { useState, useEffect } from "react";
import { ArrowUpCircle, ArrowDownCircle, ArrowRightLeft, History, PieChart, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { api } from "../../lib/api";
import { useNavigate } from "react-router";

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
    try {
      const accountData = await api.getFundSnapshot();
      // Java后端返回的数据格式: available_balance, frozen_balance, total_balance, status, fund_acc_no 等
      setAccount({
        accountNo: accountData.fund_acc_no || localStorage.getItem('fund_acc_no'),
        balance: accountData.available_balance || 0,
        frozenAmount: accountData.frozen_balance || 0,
        totalBalance: accountData.total_balance || 0,
        status: accountData.status,
        name: accountData.name || '用户',
      });
      
      // 从证券账户快照获取持仓信息
      try {
        const securityData = await api.getSecuritySnapshot();
        if (securityData.holdings && Array.isArray(securityData.holdings)) {
          setHoldings(securityData.holdings.map((h: any) => ({
            stock_code: h.stock_code,
            name: h.stock_name || h.stock_code,
            total_volume: h.total_qty || 0,
            available_volume: h.available_qty || 0,
            cost_price: h.avg_cost || 0,
            current_price: h.current_price || 0,
          })));
        } else {
          setHoldings([]);
        }
      } catch (e) {
        setHoldings([]);
      }
    } catch (err: any) {
      setError(err.message || "加载数据失败");
      if (err.message?.includes("认证") || err.message?.includes("鉴权") || err.message?.includes("token")) {
        navigate("/login");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">我的账户</h2>
          <p className="text-slate-500">正在加载数据...</p>
        </div>
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">我的账户</h2>
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-600">{error}</div>
        <Button onClick={loadData} className="bg-red-600 hover:bg-red-700">重试</Button>
      </div>
    );
  }

  let totalMarketValue = 0;
  let totalCost = 0;

  holdings.forEach((h: any) => {
    totalMarketValue += (h.current_price || 0) * h.total_volume;
    totalCost += (h.cost_price || 0) * h.total_volume;
  });

  const availableFunds = account?.balance || 0;
  const frozenAmount = account?.frozenAmount || 0;
  const totalAssets = totalMarketValue + availableFunds;
  const totalPnl = totalMarketValue - totalCost;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">我的账户</h2>
        <p className="text-slate-500">查看您的资产总览、持仓明细及快捷交易操作</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="col-span-2 bg-gradient-to-br from-red-600 to-red-800 text-white shadow-lg shadow-red-900/20 border-0">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-red-100 font-medium">总资产 (元)</p>
                <h3 className="text-4xl font-bold tracking-tight font-mono">
                  {totalAssets.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="p-2 bg-white/20 rounded-lg">
                <PieChart className="w-6 h-6 text-white" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-white/20">
              <div>
                <p className="text-red-100 text-sm mb-1">可用资金</p>
                <p className="text-lg font-semibold font-mono">
                  {availableFunds.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-red-100 text-sm mb-1">冻结资金</p>
                <p className="text-lg font-semibold font-mono">
                  {frozenAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-red-100 text-sm mb-1">总浮动盈亏</p>
                <p className={`text-lg font-semibold font-mono flex items-center ${totalPnl >= 0 ? "text-white" : "text-green-300"}`}>
                  {totalPnl >= 0 ? "+" : ""}{totalPnl.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                  <TrendingUp className="w-4 h-4 ml-1 opacity-80" />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">快捷交易</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Button
                className="h-16 flex flex-col gap-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 shadow-none"
                onClick={() => navigate("/user/trade")}
              >
                <ArrowUpCircle className="w-5 h-5" />
                <span className="font-semibold">买入</span>
              </Button>
              <Button
                className="h-16 flex flex-col gap-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 shadow-none"
                onClick={() => navigate("/user/trade")}
              >
                <ArrowDownCircle className="w-5 h-5" />
                <span className="font-semibold">卖出</span>
              </Button>
              <Button
                className="h-16 flex flex-col gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 shadow-none"
                onClick={() => navigate("/user/transfer")}
              >
                <ArrowRightLeft className="w-5 h-5" />
                <span className="font-semibold">银证转账</span>
              </Button>
              <Button
                className="h-16 flex flex-col gap-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-none"
                onClick={() => window.location.reload()}
              >
                <History className="w-5 h-5" />
                <span className="font-semibold">刷新</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">持仓明细</CardTitle>
          <span className="text-sm text-slate-500">
            账户: {account?.accountNo} | 姓名: {account?.name}
          </span>
        </CardHeader>
        <CardContent>
          {holdings.length === 0 ? (
            <div className="h-32 flex items-center justify-center bg-slate-50 rounded-md border border-dashed border-slate-300">
              <p className="text-slate-500">暂无持仓</p>
            </div>
          ) : (
            <div className="rounded-md border border-slate-100 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>股票名称</TableHead>
                    <TableHead>代码</TableHead>
                    <TableHead className="text-right">现价</TableHead>
                    <TableHead className="text-right">成本价</TableHead>
                    <TableHead className="text-right">持仓/可用</TableHead>
                    <TableHead className="text-right">浮动盈亏</TableHead>
                    <TableHead className="text-right">盈亏比例</TableHead>
                    <TableHead className="text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((h: any) => {
                    const pnl = ((h.current_price || 0) - (h.cost_price || 0)) * h.total_volume;
                    const pnlPercent = h.cost_price > 0 ? ((h.current_price || 0) - h.cost_price) / h.cost_price * 100 : 0;
                    const isPositive = pnl >= 0;

                    return (
                      <TableRow key={h.stock_code}>
                        <TableCell className="font-bold text-slate-900">{h.name}</TableCell>
                        <TableCell className="text-slate-500 font-mono text-xs">{h.stock_code}</TableCell>
                        <TableCell className={`text-right font-mono ${isPositive ? "text-red-600" : "text-green-600"}`}>
                          {(h.current_price || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-slate-600">{(h.cost_price || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">
                          <span className="text-slate-900">{h.total_volume}</span>
                          <span className="text-slate-400 mx-1">/</span>
                          <span className="text-slate-600">{h.available_volume}</span>
                        </TableCell>
                        <TableCell className={`text-right font-mono ${isPositive ? "text-red-600" : "text-green-600"}`}>
                          {isPositive ? "+" : ""}{pnl.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className={`text-right font-mono ${isPositive ? "text-red-600" : "text-green-600"}`}>
                          {isPositive ? "+" : ""}{pnlPercent.toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            <Button size="sm" className="h-7 px-3 text-xs bg-red-600 hover:bg-red-700 text-white"
                              onClick={() => navigate("/user/trade")}>
                              买入
                            </Button>
                            <Button size="sm" className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => navigate("/user/trade")}>
                              卖出
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}