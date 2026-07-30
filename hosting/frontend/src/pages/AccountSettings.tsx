import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { User } from '../types';
import { useTheme } from '../context/ThemeContext';
import { User as UserIcon, Key, Copy, Check, Sun, Moon, LogOut, RefreshCw, BookOpen, Terminal, Eye, EyeOff, ExternalLink } from 'lucide-react';

interface AccountSettingsProps {
  user: User;
  onLogout: () => void;
}

export const AccountSettings: React.FC<AccountSettingsProps> = ({ user, onLogout }) => {
  const { theme, toggleTheme } = useTheme();
  const [apiToken, setApiToken] = useState(user.apiToken || `cch_pat_${user.id.slice(2)}`);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleOpenDocs = () => {
    window.open('https://wiki.hosting.craft-core.xyz', '_blank');
  };

  const handleGenerateToken = async () => {
    setIsGenerating(true);
    try {
      const storedToken = localStorage.getItem('cc_token');
      const headers: Record<string, string> = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};

      const res = await fetch('/api/user/pat/generate', {
        method: 'POST',
        headers,
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setApiToken(data.apiToken);
        setShowToken(true);
      }
    } catch (err) {
      console.error('Failed to generate PAT:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(apiToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sampleCurl = `curl -X GET https://hosting.craft-core.xyz/api/instances \\\n  -H "Authorization: Bearer ${showToken ? apiToken : 'cch_pat_****************'}"`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">個人帳號設定</h1>
        <p className="text-xs text-muted-foreground mt-1">管理您的 Discord 驗證身份與 API 個人存取權杖</p>
      </div>

      {/* Profile Card - Spacious & Elegant Layout */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-primary" /> Discord 帳號資料
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <div className="flex items-center gap-5">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.username}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = 'https://cdn.discordapp.com/embed/avatars/0.png';
                }}
                className="h-16 w-16 min-w-16 min-h-16 max-h-16 max-w-16 rounded-full border object-cover shrink-0 shadow-sm"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl shrink-0 border">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
            )}

            <div className="space-y-2 py-1">
              <div className="text-lg font-bold flex items-center gap-2.5 leading-none">
                <span>{user.username}</span>
                {user.role === 'ADMIN' && <Badge variant="warning" className="px-2 py-0.5 text-[11px] font-bold">Admin</Badge>}
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                Discord ID: <span className="text-foreground font-semibold">{user.discordId}</span>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2 pt-0.5">
                <span>審核狀態:</span>
                <Badge variant="success" className="px-2.5 py-0.5 font-semibold text-xs">已核准存取</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Access Token Card */}
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-bold">API 個人存取權杖</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenDocs}
              className="text-xs gap-1.5 font-semibold text-primary"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>API 使用文檔</span>
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
          <CardDescription className="text-xs mt-1">
            用於 CLI 工具、Bash 自動化腳本或 GitHub Actions 呼叫 Craft-Core Hosting REST API（無需 Discord 網頁登入）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showToken ? 'text' : 'password'}
                readOnly
                value={apiToken}
                className="font-mono text-xs bg-muted pr-10"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                title={showToken ? '隱藏 Token' : '顯示 Token'}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1 text-xs shrink-0 font-bold">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? '已複製' : '複製 Token'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleGenerateToken} disabled={isGenerating} className="gap-1 text-xs shrink-0 font-bold">
              <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} /> 重新生成
            </Button>
          </div>

          {/* Explanation & cURL snippet */}
          <div className="p-4 rounded-xl bg-muted/30 border space-y-2.5 text-xs">
            <div className="font-semibold flex items-center gap-1.5 text-foreground">
              <Terminal className="h-4 w-4 text-primary" /> HTTP API 請求調用範例：
            </div>
            <div className="relative bg-slate-950 text-slate-100 p-3 rounded font-mono text-[11px]">
              <pre>{sampleCurl}</pre>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(sampleCurl);
                  setCopiedCurl(true);
                  setTimeout(() => setCopiedCurl(false), 2000);
                }}
                className="absolute top-2 right-2 h-7 text-[10px] text-slate-300 hover:text-white"
              >
                {copiedCurl ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copiedCurl ? '已複製' : '複製 cURL'}
              </Button>
            </div>
            <div className="text-[11px] text-muted-foreground">
              請求標頭須帶上 <code className="font-mono bg-background px-1 py-0.5 rounded text-foreground">Authorization: Bearer YOUR_TOKEN</code>。完整 API 列表請參閱 <button onClick={handleOpenDocs} className="text-primary underline font-medium">開發者指南</button>。
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferences & Action Card */}
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold">偏好設定與操作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold">主題模式</div>
              <div className="text-[11px] text-muted-foreground">目前選擇: {theme === 'light' ? '淺色模式' : '深色模式'}</div>
            </div>
            <Button variant="outline" size="sm" onClick={toggleTheme} className="gap-1 text-xs">
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              切換主題
            </Button>
          </div>

          <div className="pt-3 border-t flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold">登出帳號</div>
              <div className="text-[11px] text-muted-foreground">登出目前控制台 Session</div>
            </div>
            <Button variant="destructive" size="sm" onClick={onLogout} className="gap-1 text-xs font-bold">
              <LogOut className="h-4 w-4" /> 登出
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
