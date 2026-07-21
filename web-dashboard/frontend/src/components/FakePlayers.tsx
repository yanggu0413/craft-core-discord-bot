import React, { useState, useEffect } from 'react';
import { Bot, Swords, Hand, ArrowDown, UserMinus, RefreshCw, Power, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';

interface FakePlayer {
  name: string;
  owner: string;
  online: boolean;
}

interface FakePlayersProps {
  token: string | null;
}

export const FakePlayers: React.FC<FakePlayersProps> = ({ token }) => {
  const [fakeplayers, setFakeplayers] = useState<FakePlayer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchFakePlayers = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/user/fakeplayers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setFakeplayers(data.fakeplayers || []);
        setError(null);
      } else {
        setError(data.message || '無法讀取假人列表');
      }
    } catch (err: any) {
      setError('連線至伺服器失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFakePlayers();
  }, [token]);

  const handleAction = async (botName: string, action: string) => {
    if (!token) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch('/api/user/fakeplayers/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ botName, action })
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: 'success', text: data.message || '指令已成功發送' });
        setTimeout(() => fetchFakePlayers(), 1000);
      } else {
        setMsg({ type: 'error', text: data.message || '操作失敗' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: '網路請求失敗' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 頁面標頭與說明卡片 */}
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-bold uppercase tracking-wider">假人控制與掛機面板 (Carpet Bot)</CardTitle>
            </div>
            <CardDescription className="mt-1">
              假人須先於遊戲內站在指定位置輸入 <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-xs font-mono">/fp &lt;名稱&gt;</code> 進行召喚。您可在本頁面遠端控制其掛機動作或強制下線（每位玩家上限為 3 隻）。
            </CardDescription>
          </div>

          <Button variant="outline" size="sm" onClick={fetchFakePlayers} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            重新整理
          </Button>
        </CardHeader>
      </Card>

      {/* 提示訊息 */}
      {msg && (
        <div className={`p-3 rounded-[4px] text-xs font-semibold flex items-center gap-2 ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
          {msg.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* 假人清單 */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>正在讀取假人狀態...</span>
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center text-xs text-destructive flex items-center justify-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </CardContent>
        </Card>
      ) : fakeplayers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-xs text-muted-foreground">
            您目前沒有在伺服器中召喚任何假人。請先至遊戲內站在您欲放置假人的位置輸入 <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-xs font-mono">/fp &lt;名稱&gt;</code> 召喚。
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {fakeplayers.map((bot) => (
            <Card key={bot.name} className="flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <CardTitle className="normal-case text-base font-bold">{bot.name}</CardTitle>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${bot.online ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                    {bot.online ? '● 在線中' : '○ 離線'}
                  </span>
                </div>
                <CardDescription className="text-[11px] mt-1">
                  創建者: <span className="font-semibold text-foreground">{bot.owner}</span>
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(bot.name, 'attack continuous')}
                    disabled={submitting || !bot.online}
                    className="justify-start text-[11px]"
                  >
                    <Swords className="h-3.5 w-3.5 mr-1 text-red-500" />
                    持續攻擊
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(bot.name, 'use continuous')}
                    disabled={submitting || !bot.online}
                    className="justify-start text-[11px]"
                  >
                    <Hand className="h-3.5 w-3.5 mr-1 text-blue-500" />
                    持續使用
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(bot.name, 'mount')}
                    disabled={submitting || !bot.online}
                    className="justify-start text-[11px]"
                  >
                    <UserMinus className="h-3.5 w-3.5 mr-1 text-amber-500" />
                    騎乘實體
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(bot.name, 'dismount')}
                    disabled={submitting || !bot.online}
                    className="justify-start text-[11px]"
                  >
                    <UserMinus className="h-3.5 w-3.5 mr-1 text-slate-500" />
                    解除騎乘
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(bot.name, 'drop')}
                    disabled={submitting || !bot.online}
                    className="justify-start text-[11px]"
                  >
                    <ArrowDown className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                    丟棄物品
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(bot.name, 'stop')}
                    disabled={submitting || !bot.online}
                    className="justify-start text-[11px]"
                  >
                    <Power className="h-3.5 w-3.5 mr-1 text-slate-500" />
                    停止動作
                  </Button>
                </div>

                <div className="pt-2 border-t border-border flex justify-end">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleAction(bot.name, 'kill')}
                    disabled={submitting}
                    className="w-full text-[11px]"
                  >
                    <Power className="h-3.5 w-3.5 mr-1" /> 清除 / 強制下線假人
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
