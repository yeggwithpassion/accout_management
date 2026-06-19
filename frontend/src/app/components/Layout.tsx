import { Outlet, NavLink, useNavigate } from "react-router";
import { 
  Building2, 
  Wallet, 
  LayoutDashboard, 
  Settings,
  LogOut,
  Menu,
  Bell
} from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();

  const handleLogout = () => {
    api.clearToken();
    navigate("/login");
  };

  const navigation = [
    { name: '总览 Dashboard', href: '/', icon: LayoutDashboard, end: true },
    { name: '证券账户业务', href: '/securities', icon: Building2 },
    { name: '资金账户业务', href: '/funds', icon: Wallet },
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
            <Building2 className="text-white" />
            {sidebarOpen && <span>StockSys</span>}
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
          <button className="flex items-center gap-3 px-3 py-2 w-full text-left rounded-md text-red-200 hover:bg-red-800 hover:text-white transition-colors">
            <Settings className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span>系统设置</span>}
          </button>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full text-left rounded-md text-red-200 hover:bg-red-800 hover:text-white transition-colors mt-1"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span>退出登录</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-slate-200">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-500 hover:text-slate-700"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            <NavLink to="/user" className="hidden sm:flex text-sm font-medium text-red-600 bg-red-50 px-4 py-1.5 rounded-full hover:bg-red-100 transition-colors">
              切换至投资者账户端
            </NavLink>
            <button className="text-slate-500 hover:text-slate-700 relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold">
              A
            </div>
            <div className="text-sm font-medium text-slate-700">Admin</div>
          </div>
        </header>
        
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
