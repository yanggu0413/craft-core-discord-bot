import { useState, useEffect } from 'react';
import { CheckSquare, Trophy, Award, RefreshCw, CheckCircle2, Gift, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import PageHeader from '../ui/PageHeader';

interface TasksViewProps {
  API_URL: string;
  token: string | null;
  username: string | null;
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function TasksView({ API_URL, token, triggerToast }: TasksViewProps) {
  const [dailyTasks, setDailyTasks] = useState<any[]>([]);
  const [globalGoal, setGlobalGoal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exchanging, setExchanging] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (token) {
        const tasksRes = await fetch(`${API_URL}/user/daily-tasks`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const tasksData = await tasksRes.json();
        if (tasksData.success) {
          setDailyTasks(tasksData.tasks || []);
        }
      }

      const goalRes = await fetch(`${API_URL}/bounty/global`);
      const goalData = await goalRes.json();
      if (goalData.success) {
        setGlobalGoal(goalData.goal || null);
      }
    } catch (err) {
      console.error('Error fetching tasks data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleClaimTask = async (taskId: string) => {
    if (!token) {
      triggerToast('請先登入帳號！', 'error');
      return;
    }
    setClaimingId(taskId);
    try {
      const res = await fetch(`${API_URL}/user/claim-daily-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ taskId })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(data.message || '任務獎勵領取成功！', 'success');
        fetchData();
      } else {
        triggerToast(data.message || '領取失敗！', 'error');
      }
    } catch (err: any) {
      triggerToast('請求失敗：' + err.message, 'error');
    } finally {
      setClaimingId(null);
    }
  };

  const handlePlaytimeExchange = async (mode: 'single' | 'all' = 'single') => {
    if (!token) {
      triggerToast('請先登入帳號！', 'error');
      return;
    }
    setExchanging(true);
    try {
      const res = await fetch(`${API_URL}/user/exchange-playtime`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ mode })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(data.message || '時數兌換成功！', 'success');
        fetchData();
      } else {
        triggerToast(data.message || '兌換失敗！', 'error');
      }
    } catch (err: any) {
      triggerToast('請求失敗：' + err.message, 'error');
    } finally {
      setExchanging(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      <PageHeader
        icon={CheckSquare}
        title="任務與狂歡"
        description="每日完成伺服器任務解鎖抽獎鑰匙，與全服玩家一同參與狂歡突破里程碑！"
        badgeText="每日與全服"
        badgeVariant="outline"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="text-xs flex items-center space-x-1.5 rounded-none"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>重新整理</span>
          </Button>
        }
      />

      <Card className="rounded-none">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Award className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-bold">個人每日任務</CardTitle>
            </div>
            <Badge variant="outline" className="rounded-none">每日 00:00 重置</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {!token ? (
            <div className="p-8 text-center border border-dashed border-border rounded-none space-y-2">
              <Clock className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-semibold text-foreground">尚未登入帳號</p>
              <p className="text-xs text-muted-foreground">請登入帳號以檢視與領取您的每日任務進度。</p>
            </div>
          ) : dailyTasks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dailyTasks.map((task) => {
                const progressPct = Math.min(100, Math.max(0, ((task.progress || 0) / (task.count || 1)) * 100));
                const isCompleted = (task.progress || 0) >= task.count;
                const isClaimed = task.claimed;

                return (
                  <div key={task.id} className="p-4 border border-border bg-card rounded-none flex flex-col justify-between space-y-4 hover:border-primary/40 transition-all">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-[10px] rounded-none">
                          {task.type === 1 ? '殺怪/冒險' : '挖掘/收集'}
                        </Badge>
                        <Badge variant={isClaimed ? "outline" : isCompleted ? "success" : "secondary"} className="rounded-none">
                          {isClaimed ? '已領取' : isCompleted ? '可領取' : '進行中'}
                        </Badge>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-foreground">{task.title}</h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{task.desc}</p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-muted-foreground">達成進度</span>
                        <span className="font-semibold text-primary">{task.progress || 0} / {task.count}</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-none overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-300 rounded-none" 
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant={isClaimed ? "outline" : isCompleted ? "default" : "secondary"}
                      disabled={!isCompleted || isClaimed || claimingId === task.id}
                      onClick={() => handleClaimTask(task.id)}
                      className="w-full text-xs font-semibold rounded-none"
                    >
                      {isClaimed ? (
                        <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 已領取</span>
                      ) : isCompleted ? (
                        <span className="flex items-center gap-1"><Gift className="w-3.5 h-3.5 text-amber-400" /> 領取獎勵 (+{task.rewardKeys || 1} 鑰匙)</span>
                      ) : (
                        `進行中 (${Math.floor(progressPct)}%)`
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-6">今日暫無可用任務</p>
          )}
        </CardContent>
      </Card>

      {globalGoal && (
        <Card className="rounded-none">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <CardTitle className="text-sm font-bold">全服狂歡里程碑 — {globalGoal.title || '全民合作社'}</CardTitle>
              </div>
              <Badge variant="outline" className="rounded-none">全服連動</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <p className="text-xs text-muted-foreground">{globalGoal.description || '全服玩家共同努力解鎖里程碑獎勵！'}</p>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-muted-foreground">累積突破進度</span>
                <span className="font-bold text-amber-500">
                  {globalGoal.currentProgress || 0} / {globalGoal.targetProgress || 100}
                </span>
              </div>
              <div className="h-3 w-full bg-muted rounded-none overflow-hidden">
                <div 
                  className="h-full bg-amber-500 transition-all duration-300 rounded-none" 
                  style={{ width: `${Math.min(100, ((globalGoal.currentProgress || 0) / (globalGoal.targetProgress || 100)) * 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {token && (
        <Card className="rounded-none">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-bold">遊戲時數兌換鑰匙</CardTitle>
              </div>
              <Badge variant="secondary" className="rounded-none">5 小時 = 1 鑰匙</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              在 Minecraft 伺服器遊玩滿 5 小時，即可手動兌換 1 把抽獎鑰匙。
            </p>
            <div className="flex items-center space-x-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePlaytimeExchange('single')}
                disabled={exchanging}
                className="text-xs rounded-none"
              >
                兌換 1 把
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => handlePlaytimeExchange('all')}
                disabled={exchanging}
                className="text-xs rounded-none"
              >
                一次全領
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
