import React, { useState, useEffect } from 'react';
import { Cpu, Swords, Hand, Power, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
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
      setMsg({ type: 'error', text: '網路請求失敗' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      <PageHeader
        icon={Cpu}
        title="假人控制與掛機面板"
        description="遠端遙控遊戲內個人 Carpet Bot 假人行為動作，支援自動連點與下線"
        badgeText={`${fakeplayers.length} / 3 隻假人`}
        badgeVariant="outline"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchFakePlayers}
            disabled={loading}
            className="text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            <span>重新整理</span>
          </Button>
        }
      />

      {msg && (
        <div className={`p-3 rounded-md text-xs font-semibold ${msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
          {msg.text}
        </div>
      )}

      {fakeplayers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {fakeplayers.map((bot) => (
            <Card key={bot.name} className="flex flex-col justify-between">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <img
                      src={`https://mc-heads.net/avatar/${bot.name}/24`}
                      alt={bot.name}
                      className="w-6 h-6 rounded border border-border"
                    />
                    <CardTitle className="text-xs font-bold font-mono">{bot.name}</CardTitle>
                  </div>
                  <Badge variant={bot.online ? "success" : "secondary"}>
                    {bot.online ? '在線掛機' : '離線'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={submitting}
                    onClick={() => handleAction(bot.name, 'attack_interval')}
                    className="text-xs"
                  >
                    <Swords className="w-3.5 h-3.5 mr-1" /> 自動攻擊
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={submitting}
                    onClick={() => handleAction(bot.name, 'use_interval')}
                    className="text-xs"
                  >
                    <Hand className="w-3.5 h-3.5 mr-1" /> 自動右鍵
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={submitting}
                    onClick={() => handleAction(bot.name, 'stop')}
                    className="text-xs"
                  >
                    停止動作
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={submitting}
                    onClick={() => handleAction(bot.name, 'kill')}
                    className="text-xs"
                  >
                    <Power className="w-3.5 h-3.5 mr-1" /> 下線召回
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="py-12">
          <CardContent className="text-center space-y-2">
            <Cpu className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-bold text-foreground">您目前沒有啟動任何假人 (Carpet Bot)</p>
            <p className="text-xs text-muted-foreground">在遊戲中站在目的地輸入 `/fp &lt;名稱&gt;` 即可召喚假人。</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
