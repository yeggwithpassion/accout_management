import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { ArrowRightLeft, XCircle, RefreshCw } from "lucide-react";
import { api } from "../../lib/api";

export default function Trade() {
  const [stocks, setStocks] = useState<any[]>([]);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Order form
  const [selectedStock, setSelectedStock] = useState("");
  const [orderType, setOrderType] = useState<"buy" | "sell">("buy");
  const [price, setPrice] = useState("");
  const [volume, setVolume] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [stocksData, holdingsData, ordersData] = await Promise.all([
        api.getStocks(),
        api.getHoldings(),
        api.getOrders(),
      ]);
      setStocks(stocksData.stocks || []);
      setHoldings(holdingsData || []);
      setOrders(ordersData.orders || []);
    } catch (err: any) {
      showMessage(err.message || "加载失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (msg: string, type: "success" | "error") => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(""), 5000);
  };

  const handleSubmitOrder = async () => {
    if (!selectedStock || !price || !volume) {
      showMessage("请填写完整的订单信息", "error");
      return;
    }

    try {
      const result = await api.submitOrder(
        selectedStock,
        orderType,
        Number(price),
        Number(volume)
      );
      showMessage(`订单提交成功！订单号: ${result.orderId.substring(0, 8)}...`, "success");
      setSelectedStock("");
      setPrice("");
      setVolume("");
      loadData();
    } catch (err: any) {
      showMessage(err.message || "下单失败", "error");
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      await api.cancelOrder(orderId);
      showMessage("撤单成功", "success");
      loadData();
    } catch (err: any) {
      showMessage(err.message || "撤单失败", "error");
    }
  };

  const handleStockSelect = (code: string) => {
    setSelectedStock(code);
    const stock = stocks.find((s) => s.code === code);
    if (stock) {
      setPrice(stock.current_price.toFixed(2));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold">交易大厅</h2>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 animate-spin text-red-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">交易大厅</h2>
        <p className="text-slate-500">股票买入、卖出及撤单操作</p>
      </div>

      {message && (
        <div className={`p-4 rounded-md ${messageType === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-600"}`}>
          {message}
        </div>
      )}

      {/* Order Form */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-red-600" />
            <span>{orderType === "buy" ? "买入" : "卖出"}委托</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <Button
              className={`flex-1 ${orderType === "buy" ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600"}`}
              onClick={() => { setOrderType("buy"); setSelectedStock(""); setPrice(""); setVolume(""); }}
            >
              买入
            </Button>
            <Button
              className={`flex-1 ${orderType === "sell" ? "bg-green-600 text-white" : "bg-slate-100 text-slate-600"}`}
              onClick={() => { setOrderType("sell"); setSelectedStock(""); setPrice(""); setVolume(""); }}
            >
              卖出
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">股票代码</label>
              <select
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                value={selectedStock}
                onChange={(e) => handleStockSelect(e.target.value)}
              >
                <option value="">请选择股票</option>
                {orderType === "sell" && holdings.map(h => (
                  <option key={h.stock_code} value={h.stock_code}>{h.name} ({h.stock_code})</option>
                ))}
                {orderType !== "sell" && stocks.map(s => (
                  <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">委托价格</label>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="请输入委托价格"
              />
              {selectedStock && (() => {
                const stock = stocks.find(s => s.code === selectedStock);
                if (stock) return <p className="text-xs text-slate-400 mt-1">现价: {stock.current_price.toFixed(2)}</p>;
                return null;
              })()}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">委托数量（股）</label>
              <input
                type="number"
                step="100"
                min="100"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="100的整数倍"
              />
            </div>

            <div className="flex items-end">
              <Button className="w-full bg-red-600 hover:bg-red-700 text-white" onClick={handleSubmitOrder}>
                {orderType === "buy" ? "买入" : "卖出"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">我的委托</CardTitle>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-1" />
            刷新
          </Button>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-slate-400 text-center py-8">暂无委托记录</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left p-2">股票</th>
                    <th className="text-left p-2">方向</th>
                    <th className="text-right p-2">价格</th>
                    <th className="text-right p-2">数量</th>
                    <th className="text-right p-2">已成交</th>
                    <th className="text-center p-2">状态</th>
                    <th className="text-center p-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o: any) => (
                    <tr key={o.order_id} className="border-b hover:bg-slate-50">
                      <td className="p-2">
                        <span className="font-medium">{o.stock_name || o.stock_code}</span>
                        <span className="text-xs text-slate-400 ml-1">{o.stock_code}</span>
                      </td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${o.order_type === "buy" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
                          {o.order_type === "buy" ? "买入" : "卖出"}
                        </span>
                      </td>
                      <td className="text-right p-2 font-mono">{o.price.toFixed(2)}</td>
                      <td className="text-right p-2 font-mono">{o.volume}</td>
                      <td className="text-right p-2 font-mono">{o.filled_volume}</td>
                      <td className="text-center p-2">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="text-center p-2">
                        {(o.status === "pending" || o.status === "partial_filled") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleCancelOrder(o.order_id)}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "待成交", className: "bg-yellow-100 text-yellow-700" },
    partial_filled: { label: "部分成交", className: "bg-blue-100 text-blue-700" },
    filled: { label: "已成交", className: "bg-green-100 text-green-700" },
    cancelled: { label: "已撤销", className: "bg-slate-100 text-slate-500" },
    expired: { label: "已过期", className: "bg-slate-100 text-slate-500" },
  };
  const item = map[status] || { label: status, className: "bg-slate-100 text-slate-500" };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.className}`}>{item.label}</span>;
}