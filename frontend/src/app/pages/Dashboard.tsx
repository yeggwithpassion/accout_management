import { Users, CreditCard, Building, Activity } from "lucide-react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

export default function Dashboard() {
  const stats = [
    { name: "证券账户总数", value: "1,245", change: "+12.5%", icon: Users, color: "text-red-500", bg: "bg-red-100" },
    { name: "资金账户总数", value: "1,180", change: "+10.2%", icon: CreditCard, color: "text-red-500", bg: "bg-red-100" },
    { name: "今日新开户", value: "24", change: "+4.5%", icon: Building, color: "text-red-500", bg: "bg-red-100" },
    { name: "异常账户提醒", value: "3", change: "-2.0%", icon: Activity, color: "text-red-500", bg: "bg-red-100" },
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
        {stats.map((stat) => (
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
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-slate-500 mt-1">
                较上月 <span className={stat.change.startsWith("+") ? "text-green-600" : "text-red-600"}>{stat.change}</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>近期开户趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full flex items-end gap-2 text-slate-500 text-xs">
               <div className="flex-1 bg-red-100 rounded-t flex items-end"><div className="w-full bg-red-500 rounded-t" style={{height: "60%"}}></div></div>
               <div className="flex-1 bg-red-100 rounded-t flex items-end"><div className="w-full bg-red-500 rounded-t" style={{height: "80%"}}></div></div>
               <div className="flex-1 bg-red-100 rounded-t flex items-end"><div className="w-full bg-red-500 rounded-t" style={{height: "40%"}}></div></div>
               <div className="flex-1 bg-red-100 rounded-t flex items-end"><div className="w-full bg-red-500 rounded-t" style={{height: "90%"}}></div></div>
               <div className="flex-1 bg-red-100 rounded-t flex items-end"><div className="w-full bg-red-500 rounded-t" style={{height: "50%"}}></div></div>
               <div className="flex-1 bg-red-100 rounded-t flex items-end"><div className="w-full bg-red-500 rounded-t" style={{height: "70%"}}></div></div>
               <div className="flex-1 bg-red-100 rounded-t flex items-end"><div className="w-full bg-red-500 rounded-t" style={{height: "100%"}}></div></div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-500">
              <span>周一</span><span>周二</span><span>周三</span><span>周四</span><span>周五</span><span>周六</span><span>周日</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>最新操作记录</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { action: "证券账户开户", user: "张三", id: "010023491", time: "10:23 AM", status: "success" },
                { action: "资金账户开户", user: "李四", id: "F928310", time: "09:45 AM", status: "success" },
                { action: "证券账户挂失", user: "王五", id: "010099823", time: "09:12 AM", status: "warning" },
                { action: "资金取款 50,000", user: "赵六", id: "F112344", time: "08:30 AM", status: "success" },
                { action: "证券账户销户", user: "孙七", id: "010055432", time: "昨日", status: "error" },
              ].map((log, i) => (
                <div key={i} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{log.action} - {log.user}</p>
                    <p className="text-xs text-slate-500">账号: {log.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-slate-500">{log.time}</p>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] mt-1 ${
                      log.status === 'success' ? 'bg-green-100 text-green-700' :
                      log.status === 'warning' ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {log.status === 'success' ? '完成' : log.status === 'warning' ? '处理中' : '拒绝'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
