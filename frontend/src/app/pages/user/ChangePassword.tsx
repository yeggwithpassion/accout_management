import { useState } from "react";
import { Key, Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { api } from "../../lib/api";

export default function ChangePassword() {
  const [passwordType, setPasswordType] = useState<'trade' | 'withdraw'>('trade');
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async () => {
    setError("");
    setSuccess("");

    // 验证
    if (!oldPassword || oldPassword.length !== 6) {
      setError("请输入6位原密码");
      return;
    }
    if (!newPassword || newPassword.length !== 6) {
      setError("新密码必须为6位数字");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }
    if (oldPassword === newPassword) {
      setError("新密码不能与旧密码相同");
      return;
    }

    setLoading(true);
    try {
      const result = await api.changePassword(oldPassword, newPassword, passwordType);
      if (result.code === 0) {
        setSuccess(`${passwordType === 'trade' ? '交易' : '取款'}密码修改成功！`);
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setError(result.message || "密码修改失败");
      }
    } catch (err: any) {
      setError(err.message || "密码修改失败，请检查原密码是否正确");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">修改密码</h2>
        <p className="text-slate-500">修改您的交易密码或取款密码</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-red-600" />
            密码修改
          </CardTitle>
          <CardDescription>
            请选择要修改的密码类型，并输入原密码和新密码
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 密码类型选择 */}
          <div className="space-y-2">
            <Label>密码类型</Label>
            <div className="flex gap-4">
              <button
                onClick={() => setPasswordType('trade')}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                  passwordType === 'trade'
                    ? 'border-red-600 bg-red-50 text-red-700'
                    : 'border-slate-200 hover:border-red-300'
                }`}
              >
                <div className="font-medium">交易密码</div>
                <div className="text-xs text-slate-500 mt-1">用于登录和交易</div>
              </button>
              <button
                onClick={() => setPasswordType('withdraw')}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                  passwordType === 'withdraw'
                    ? 'border-red-600 bg-red-50 text-red-700'
                    : 'border-slate-200 hover:border-red-300'
                }`}
              >
                <div className="font-medium">取款密码</div>
                <div className="text-xs text-slate-500 mt-1">用于资金提取</div>
              </button>
            </div>
          </div>

          {/* 原密码 */}
          <div className="space-y-2">
            <Label htmlFor="oldPassword">
              原{passwordType === 'trade' ? '交易' : '取款'}密码
            </Label>
            <div className="relative">
              <Input
                id="oldPassword"
                type={showOldPassword ? "text" : "password"}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="请输入6位原密码"
                maxLength={6}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowOldPassword(!showOldPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 新密码 */}
          <div className="space-y-2">
            <Label htmlFor="newPassword">
              新{passwordType === 'trade' ? '交易' : '取款'}密码
            </Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="请输入6位新密码"
                maxLength={6}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500">密码必须为6位数字</p>
          </div>

          {/* 确认新密码 */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">确认新密码</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入新密码"
              maxLength={6}
            />
          </div>

          {/* 错误和成功提示 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md text-green-600 text-sm">
              {success}
            </div>
          )}

          {/* 提交按钮 */}
          <Button
            className="w-full bg-red-600 hover:bg-red-700"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "修改中..." : "确认修改"}
          </Button>
        </CardContent>
      </Card>

      {/* 密码安全提示 */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="pt-6">
          <h3 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
            <Key className="w-4 h-4" />
            密码安全提示
          </h3>
          <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
            <li>交易密码用于登录系统和进行证券交易</li>
            <li>取款密码用于从资金账户提取现金</li>
            <li>建议定期更换密码，避免使用简单数字组合</li>
            <li>请勿将密码告知他人</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}