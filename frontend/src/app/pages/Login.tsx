import { useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Briefcase } from "lucide-react";
import { api } from "../lib/api";

export default function Login() {
  const navigate = useNavigate();
  const [accountNo, setAccountNo] = useState("F10023491");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"user" | "admin">("user");

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      if (mode === "user") {
        const result = await api.userLogin(accountNo, password);
        // Java后端返回: auth_token, fund_acc_no, sec_acc_no, status
        if (result.auth_token) {
          navigate("/user");
        } else {
          throw new Error("登录失败，未获取到认证令牌");
        }
      } else {
        const result = await api.adminLogin(accountNo, password);
        // Java后端返回: auth_token
        if (result.auth_token) {
          navigate("/");
        } else {
          throw new Error("登录失败，未获取到认证令牌");
        }
      }
    } catch (err: any) {
      setError(err.message || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-lg border-slate-200">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-3">
            <div className="p-3 bg-red-600 rounded-full">
              <Briefcase className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">账户管理系统</CardTitle>
          <p className="text-slate-500 text-sm mt-1">
            {mode === "user" ? "投资者账户登录" : "管理后台登录"}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex mb-6 bg-slate-100 rounded-lg p-1">
            <button
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === "user" ? "bg-white shadow text-red-600" : "text-slate-500"
              }`}
              onClick={() => setMode("user")}
            >
              投资者端
            </button>
            <button
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === "admin" ? "bg-white shadow text-red-600" : "text-slate-500"
              }`}
              onClick={() => setMode("admin")}
            >
              管理端
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {mode === "user" ? "资金账号" : "管理员账号"}
              </label>
              <input
                type="text"
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder={mode === "user" ? "请输入资金账号" : "请输入管理员账号"}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="请输入密码"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
                {error}
              </div>
            )}

            <Button
              className="w-full bg-red-600 hover:bg-red-700 text-white"
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? "登录中..." : "登 录"}
            </Button>

            <p className="text-xs text-slate-400 text-center mt-4">
              {mode === "user"
                ? "测试账户: F10023491 / 123456"
                : "测试管理员: admin / admin123"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
