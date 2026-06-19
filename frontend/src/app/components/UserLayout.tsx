import { Outlet, NavLink, useNavigate } from "react-router";
import { 
  Wallet,
  LayoutDashboard, 
  Settings,
  LogOut,
  Menu,
  Bell,
  Briefcase,
  Key
} from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "../lib/api";

export function UserLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userInfo, setUserInfo] = useState({ fundAccNo: '', secAccNo: '', name: '用户' });
  const navigate = useNavigate();

  useEffect(() => {
    // 从localStorage获取用户信息
    const fundAccNo = localStorage.getItem('fund_acc_no') || '';
    const secAccNo = localStorage.getItem('sec_acc_no') || '';
    // 尝试从资金账号提取姓名（实际应该从登录响应中获取）
    setUserInfo({ fundAccNo, secAccNo, name: '用户' });
  }, []);

  const handleLogout = () => {
    api.clearToken();
    navigate("/login");
  };

  const navigation = [
    { name: '我的账户', href: '/user', icon: LayoutDashboard, end: true },
    { name: '银证转账', href: '/user/transfer', icon: Wallet },
    { name: '修改密码', href: '/user/password', icon: Key },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <div 
        className={`bg-red-900 text-red-100 flex-shrink-0 transition-all duration-300 flex flex-col ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        <div className="h-16 flex items-center justify-center border-b border-red-800">
          <div className="flex items-center gap-2 font-bold text-white text-xl">
            <Briefcase className="text-white" />
            {sidebarOpen && <span>账户管理端</span>}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {navigation.map((item) => (
              <li key={item.name}>
                <NavLink
                  to={item.href}
                  end={item.end}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors
                    ${isActive 
                      ? 'bg-white/20 text-white font-medium' 
                      : 'hover:bg-red-800 hover:text-white'
                    }
                  `}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {sidebarOpen && <span>{item.name}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-red-800">
          <NavLink to="/" className="flex items-center gap-3 px-3 py-2 w-full text-left rounded-md hover:bg-red-800 hover:text-white transition-colors">
            <LayoutDashboard className="w-5 h-5 flex-shrink-0 text-red-200" />
            {sidebarOpen && <span>返回管理端</span>}
          </NavLink>
          <button className="flex items-center gap-3 px-3 py-2 w-full text-left rounded-md text-red-200 hover:bg-red-800 hover:text-white transition-colors mt-1">
            <Settings className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span>系统设置</span>}
          </button>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full text-left rounded-md text-red-200 hover:bg-red-800 hover:text-white transition-colors mt-1"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span>安全退出</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-slate-200">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-500 hover:text-red-600 transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
              账户服务
            </div>
            <button className="text-slate-500 hover:text-red-600 relative transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <NavLink to="/user/password" className="flex items-center gap-2 text-slate-500 hover:text-red-600 transition-colors">
              <Key className="w-5 h-5" />
            </NavLink>
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold">
              {userInfo.name.charAt(0)}
            </div>
            <div className="text-sm font-medium text-slate-700 hidden sm:block">
              {userInfo.fundAccNo ? `${userInfo.name} (${userInfo.fundAccNo})` : userInfo.name}
            </div>
          </div>
        </header>
        
        <main className="flex-1 overflow-auto bg-slate-50 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
