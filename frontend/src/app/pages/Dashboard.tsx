import { useState, useEffect } from "react";
import { Users, CreditCard, Building, Activity } from "lucide-react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { api } from "../lib/api";

interface Stats {
  security_account_count: number;
  fund_account_count: number;
  today_new_accounts: number;
  abnormal_account_count: number;
}

interface LogEntry {
  log_id: number;
  staff_id: number;
  operation_type: string;
  target_type: string;
  target_id: string;
  detail: string;
  operation_time: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, logsRes] = await Promise.all([
        api.getDashboardStats(),
        api.getRecentLogs(10)
      ]);
      
      if (statsRes.code === 0 && statsRes.data) {
        setStats(statsRes.data);
      }
      if (logsRes.code === 0 && logsRes.data) {
        setLogs(logsRes.data);
      }
    } catch (error) {
      console.error('获取Dashboard数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const formatNumber = (num: number) => {
    return num.toLocaleString('zh-CN');
  };

  const getActionDisplayName = (operationType: string) => {
    const actionMap: Record<string, string> = {
      '证券开户': '证券账户开户',
      '资金开户': '资金账户开户',
      '挂失': '账户挂失',
      '补办': '账户补办',
      '销户': '账户销户',
      '存款': '资金存款',
      '取款': '资金取款',
      '查询资金账户': '账户信息查询',
      '更新投资者信息': '投资者信息更新',
      '绑定证券账户': '账户关联绑定',
      '解绑证券账户': '账户关联解绑'
    };
    return actionMap[operationType] || operationType;
  };

  const getLogStatus = (operationType: string) => {
    if (operationType.includes('销户') || operationType.includes('挂失')) return 'warning';
    if (operationType.includes('失败') || operationType.includes('拒绝')) return 'error';
    return 'success';
  };

  const formatTime = (timeStr: string) => {
    const date = new Date(timeStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return '刚刚';
    if (hours < 24) return `${hours}小时前`;
    return date.toLocaleDateString('zh-CN');
  };

  const statItems = [
    { 
      name: "证券账户总数", 
      value: stats ? formatNumber(stats.security_account_count) : '-', 
      change: "+0%", 
      icon: Users, 
      color: "text-red-500", 
      bg: "bg-red-100" 
    },
    { 
      name: "资金账户总数", 
      value: stats ? formatNumber(stats.fund_account_count) : '-', 
      change: "+0%", 
      icon: CreditCard, 
      color: "text-red-500", 
      bg: "bg-red-100" 
    },
    { 
      name: "今日新开户", 
      value: stats ? formatNumber(stats.today_new_accounts) : '-', 
      change: "+0%", 
      icon: Building, 
      color: "text-red-500", 
      bg: "bg-red-100" 
    },
    { 
      name: "异常账户提醒", 
      value: stats ? formatNumber(stats.abnormal_account_count) : '-', 
      change: "0%", 
      icon: Activity, 
      color: stats && stats.abnormal_account_count > 0 ? "text-orange-500" : "text-green-500", 
      bg: stats && stats.abnormal_account_count > 0 ? "bg-orange-100" : "bg-green-100" 
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">账户业务总览</h2>
          <p className="text-slate-500">查看证券及资金账户概况与近期活动</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/securities"
            className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-red-700"
          >
            证券开户
          </Link>
          <Link
            to="/funds"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            资金开户
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statItems.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                {stat.name}
              </CardTitle>
              <div className={`${stat.bg} ${stat.color} p-2 rounded-full`}>
                <stat.icon className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '...' : stat.value}</div>
              <p className="text-xs text-slate-500 mt-1">
                较昨日 <span className={stat.change.startsWith("+") ? "text-green-600" : "text-slate-600"}>{stat.change}</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>最新操作记录</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                <div className="text-center text-slate-500 py-4">加载中...</div>
              ) : logs.length === 0 ? (
                <div className="text-center text-slate-500 py-4">暂无操作记录</div>
              ) : (
                logs.map((log) => {
                  const status = getLogStatus(log.operation_type);
                  return (
                    <div key={log.log_id} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{getActionDisplayName(log.operation_type)}</p>
                        <p className="text-xs text-slate-500">{log.detail || `账号: ${log.target_id}`}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-slate-500">{formatTime(log.operation_time)}</p>
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] mt-1 ${
                          status === 'success' ? 'bg-green-100 text-green-700' :
                          status === 'warning' ? 'bg-orange-100 text-orange-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {status === 'success' ? '完成' : status === 'warning' ? '注意' : '异常'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}