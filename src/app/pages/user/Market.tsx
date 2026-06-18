import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { LineChart, TrendingUp, TrendingDown, Search, RefreshCw } from "lucide-react";
import { api, connectMarketWebSocket } from "../../lib/api";

export default function Market() {
  const navigate = useNavigate();
  const [stocks, setStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    loadStocks();
    
    // Connect WebSocket for real-time price updates
    const ws = connectMarketWebSocket((data) => {
      if (data.type === "allPrices") {
        setStocks(data.data || []);
        setWsConnected(true);
      } else if (data.type === "priceUpdate") {
        setStocks(prev => prev.map(s => 
          s.code === data.data.stockCode 
            ? { ...s, current_price: data.data.price, day_high: data.data.dayHigh, day_low: data.data.dayLow }
            : s
        ));
      }
    });

    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);

    return () => ws.close();
  }, []);

  const loadStocks = async () => {
    try {
      const data = await api.getStocks(keyword || undefined);
      setStocks(data.stocks || []);
    } catch (err) {
      console.error("Failed to load stocks:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setLoading(true);
    loadStocks();
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold">行情中心</h2>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 animate-spin text-red-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">行情中心</h2>
        <p className="text-slate-500">
          实时股票行情
          {wsConnected && <span className="ml-2 text-green-600 text-xs">● 实时连接</span>}
        </p>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            placeholder="搜索股票代码或名称..."
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button variant="outline" onClick={handleSearch}>
          搜索
        </Button>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left p-3">股票名称</th>
                  <th className="text-left p-3">代码</th>
                  <th className="text-right p-3">最新价</th>
                  <th className="text-right p-3">涨跌幅</th>
                  <th className="text-right p-3">最高</th>
                  <th className="text-right p-3">最低</th>
                  <th className="text-right p-3">涨停</th>
                  <th className="text-right p-3">跌停</th>
                  <th className="text-center p-3">状态</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((stock: any) => {
                  const changePercent = stock.previous_close > 0
                    ? ((stock.current_price - stock.previous_close) / stock.previous_close) * 100
                    : 0;
                  const isPositive = changePercent >= 0;

                  return (
                    <tr
                      key={stock.code}
                      className="border-b hover:bg-slate-50 cursor-pointer"
                      onClick={() => navigate(`/user/trade`)}
                    >
                      <td className="p-3 font-medium text-slate-900">{stock.name}</td>
                      <td className="p-3 text-slate-500 font-mono text-xs">{stock.code}</td>
                      <td className={`p-3 text-right font-mono font-semibold ${isPositive ? "text-red-600" : "text-green-600"}`}>
                        {stock.current_price.toFixed(2)}
                      </td>
                      <td className={`p-3 text-right font-mono ${isPositive ? "text-red-600" : "text-green-600"}`}>
                        <span className="flex items-center justify-end gap-1">
                          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {isPositive ? "+" : ""}{changePercent.toFixed(2)}%
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-600">{stock.day_high.toFixed(2)}</td>
                      <td className="p-3 text-right font-mono text-slate-600">{stock.day_low.toFixed(2)}</td>
                      <td className="p-3 text-right font-mono text-red-500">{stock.limit_up.toFixed(2)}</td>
                      <td className="p-3 text-right font-mono text-green-500">{stock.limit_down.toFixed(2)}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          stock.status === "trading" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                          {stock.status === "trading" ? "交易中" : "停牌"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {stocks.length === 0 && (
            <div className="h-32 flex items-center justify-center text-slate-400">
              暂无股票数据
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}