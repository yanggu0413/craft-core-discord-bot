import React, { useState, useEffect } from 'react';
import { Cpu, Swords, Hand, Power, RefreshCw, Lock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import PageHeader from './ui/PageHeader';
import { apiFetch } from '../lib/api';

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
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchFakePlayers = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiFetch('/user/fakeplayers');
      if (res.ok && res.data?.success) {
        setFakeplayers(res.data.fakeplayers || []);
      }
    } catch (err: any) {
      console.error('Failed to fetch fakeplayers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFakePlayers();
  }, [token]);

  if (!token) {
    return (
      <div className="space-y-6 text-left">
        <PageHeader
          icon={Cpu}
          iconColor="text-violet-500"
          title="假人控制中心"
          description="請先登入帳號以連線遠端控制您在伺服器中生成的挂機假人。"
          badgeText="需要登入"
          badgeVariant="outline"
        />
        <Card className="py-12 rounded-none">
          <CardContent className="flex flex-col items-center justify-center text-center space-y-3">
            <div className="p-3 bg-muted text-muted-foreground border border-border">
              <Lock className="w-6 h-6" />
            </div>
            <CardTitle className="text-sm font-bold">尚未登入帳號</CardTitle>
            <CardDescription className="max-w-md text-xs">
              請點擊右上角「帳號登入」按鈕，同步您的身份解鎖假人召喚、攻擊與掛機遙控功能。
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleAction = async (botName: string, action: string) => {
    if (!token) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await apiFetch('/user/fakeplayers/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botName, action })
      });
      if (res.ok && res.data?.success) {
        setMsg({ type: 'success', text: res.data.message || '指令已成功發送' });
        setTimeout(() => fetchFakePlayers(), 1000);
      } else {
        setMsg({ type: 'error', text: res.data?.message || '操作失敗' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || '連線錯誤' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      <PageHeader
        icon={Cpu}
        iconColor="text-violet-500"
        title="假人控制中心"
        description="遠端控制伺服器內的個人掛機假人（Bot），支援自動連點與持續攻擊"
        badgeText={`${fakeplayers.length} 個假人`}
        badgeVariant="outline"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchFakePlayers}
            disabled={loading}
            className="text-xs flex items-center space-x-1.5 rounded-md"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>重新整理</span>
          </Button>
        }
      />

      {msg && (
        <div className={`p-3 rounded-none text-xs ${msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
          {msg.text}
        </div>
      )}

      {fakeplayers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fakeplayers.map((bot) => (
            <Card key={bot.name} className="rounded-none">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img 
                      src={`https://mc-heads.net/avatar/${bot.name}/24`} 
                      alt={bot.name}
                      className="w-6 h-6 rounded-md border border-border shrink-0"
                    />
                    <CardTitle className="text-sm font-bold">{bot.name}</CardTitle>
                  </div>
                  <Badge variant={bot.online ? "success" : "secondary"} className="rounded-md">
                    {bot.online ? "在線掛機" : "離線"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => handleAction(bot.name, 'use')}
                  className="text-xs rounded-md"
                >
                  <Hand className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                  <span>右鍵使用 (Use)</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => handleAction(bot.name, 'attack')}
                  className="text-xs rounded-md"
                >
                  <Swords className="w-3.5 h-3.5 mr-1 text-rose-500" />
                  <span>持續攻擊 (Attack)</span>
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={submitting}
                  onClick={() => handleAction(bot.name, 'stop')}
                  className="text-xs rounded-md ml-auto"
                >
                  <Power className="w-3.5 h-3.5 mr-1" />
                  <span>召回/下線 (Stop)</span>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="py-12 rounded-none">
          <CardContent className="text-center space-y-2">
            <Cpu className="w-8 h-8 text-violet-500 mx-auto" />
            <p className="text-sm font-bold text-foreground">您目前沒有名下的假人</p>
            <p className="text-xs text-muted-foreground">在遊戲內使用 <code className="bg-muted px-1 py-0.5 font-mono text-[11px] rounded-xs">/player spawn &lt;名字&gt;</code> 即可生成專屬假人。</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
