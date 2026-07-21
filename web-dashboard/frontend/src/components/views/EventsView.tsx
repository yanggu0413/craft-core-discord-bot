import { useState, useEffect } from 'react';
import { Sparkles, Calendar, Gift, Plus, Edit3, Trash2, PauseCircle, PlayCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';

export interface ServerEvent {
  id: number;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  reward_info: string;
  status: 'active' | 'paused' | 'completed';
  creator_name: string;
  created_at: string;
}

interface EventsViewProps {
  token: string | null;
  isAdmin: boolean;
  triggerToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  API_URL: string;
}

export default function EventsView({ token, isAdmin, triggerToast, API_URL }: EventsViewProps) {
  const [events, setEvents] = useState<ServerEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'upcoming' | 'completed'>('all');

  // Admin Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ServerEvent | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formReward, setFormReward] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'paused' | 'completed'>('active');
  const [submitting, setSubmitting] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/events`);
      const data = await res.json();
      if (data.success) {
        setEvents(data.events || []);
      } else {
        triggerToast(data.message || '無法載入活動列表', 'error');
      }
    } catch (err: any) {
      triggerToast('載入失敗：' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingEvent(null);
    setFormTitle('');
    setFormDesc('');
    setFormStart('');
    setFormEnd('');
    setFormReward('');
    setFormStatus('active');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (ev: ServerEvent) => {
    setEditingEvent(ev);
    setFormTitle(ev.title);
    setFormDesc(ev.description);
    setFormStart(ev.start_time || '');
    setFormEnd(ev.end_time || '');
    setFormReward(ev.reward_info || '');
    setFormStatus(ev.status);
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDesc.trim()) {
      triggerToast('請填寫活動標題與詳細說明！', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const url = editingEvent ? `${API_URL}/admin/events/${editingEvent.id}` : `${API_URL}/admin/events`;
      const method = editingEvent ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: formTitle.trim(),
          description: formDesc.trim(),
          start_time: formStart.trim(),
          end_time: formEnd.trim(),
          reward_info: formReward.trim(),
          status: formStatus
        })
      });

      const data = await res.json();
      if (data.success) {
        triggerToast(data.message || '操作成功！', 'success');
        setIsModalOpen(false);
        fetchEvents();
      } else {
        triggerToast(data.message || '操作失敗', 'error');
      }
    } catch (err: any) {
      triggerToast('請求失敗：' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number, title: string) => {
    if (!window.confirm(`確定要刪除活動「${title}」嗎？`)) return;

    try {
      const res = await fetch(`${API_URL}/admin/events/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        triggerToast('活動已刪除！', 'success');
        fetchEvents();
      } else {
        triggerToast(data.message || '刪除失敗', 'error');
      }
    } catch (err: any) {
      triggerToast('刪除錯誤：' + err.message, 'error');
    }
  };

  const handleToggleStatus = async (ev: ServerEvent) => {
    const nextStatus = ev.status === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch(`${API_URL}/admin/events/${ev.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...ev,
          status: nextStatus
        })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(`活動狀態已切換為：${nextStatus === 'active' ? '進行中' : '已暫停'}`, 'success');
        fetchEvents();
      }
    } catch (err: any) {
      triggerToast('更新狀態失敗：' + err.message, 'error');
    }
  };

  const filteredEvents = events.filter(ev => {
    if (filter === 'active') return ev.status === 'active';
    if (filter === 'completed') return ev.status === 'completed' || ev.status === 'paused';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4 text-left">
        <div>
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold tracking-wider uppercase text-foreground">🎪 伺服器熱門活動 (Server Events)</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            發掘 Craft-Core 最新的限時節慶、雙倍經驗、採礦競賽與福利抽獎活動！
          </p>
        </div>

        {isAdmin && (
          <Button 
            onClick={handleOpenCreateModal} 
            size="sm" 
            className="font-bold text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center space-x-1.5 shrink-0 shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>發布新伺服器活動</span>
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 text-xs font-bold">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-[4px] border transition-colors ${filter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground'}`}
        >
          全部活動 ({events.length})
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`px-3 py-1.5 rounded-[4px] border transition-colors ${filter === 'active' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground'}`}
        >
          🟢 限時進行中 ({events.filter(e => e.status === 'active').length})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-3 py-1.5 rounded-[4px] border transition-colors ${filter === 'completed' ? 'bg-slate-700 text-white border-slate-700' : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground'}`}
        >
          ⚪ 暫停/已結束 ({events.filter(e => e.status !== 'active').length})
        </button>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="py-20 text-center text-xs text-muted-foreground">
          載入活動中...
        </div>
      ) : filteredEvents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          {filteredEvents.map(ev => {
            const isActive = ev.status === 'active';
            const isPaused = ev.status === 'paused';
            return (
              <Card key={ev.id} className="relative flex flex-col justify-between overflow-hidden border-border hover:border-primary/40 transition-all shadow-sm">
                <CardHeader className="pb-3 border-b border-border bg-muted/20">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-bold text-foreground flex items-center space-x-2">
                      <span>{ev.title}</span>
                    </CardTitle>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-[3px] border shrink-0 ${
                      isActive ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' :
                      isPaused ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' :
                      'bg-muted text-muted-foreground border-border'
                    }`}>
                      {isActive ? '🟢 限時進行中' : isPaused ? '⏸️ 暫停中' : '⚪ 已結束'}
                    </span>
                  </div>
                  <CardDescription className="text-[10px] text-muted-foreground flex items-center space-x-3 mt-1">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <span>{ev.start_time || '即刻開始'} ~ {ev.end_time || '永久常駐'}</span>
                    </span>
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-4 space-y-4 flex-1 flex flex-col justify-between">
                  {/* Event Details */}
                  <div className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {ev.description}
                  </div>

                  {/* Reward Highlights */}
                  {ev.reward_info && (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-[4px] flex items-start space-x-2 text-xs">
                      <Gift className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-amber-500 block text-[11px]">🎁 活動豐厚獎勵：</span>
                        <span className="text-foreground/90 text-[11px]">{ev.reward_info}</span>
                      </div>
                    </div>
                  )}

                  {/* Admin Footer Actions */}
                  {isAdmin && (
                    <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                      <span className="text-[9px] text-muted-foreground">發布者：{ev.creator_name || '管理員'}</span>
                      <div className="flex items-center space-x-1.5">
                        <Button 
                          onClick={() => handleToggleStatus(ev)} 
                          variant="outline" 
                          size="sm" 
                          className="h-7 px-2 text-[10px] font-bold"
                        >
                          {isActive ? <PauseCircle className="w-3 h-3 text-amber-500 mr-1" /> : <PlayCircle className="w-3 h-3 text-emerald-500 mr-1" />}
                          <span>{isActive ? '暫停' : '啟用'}</span>
                        </Button>

                        <Button 
                          onClick={() => handleOpenEditModal(ev)} 
                          variant="outline" 
                          size="sm" 
                          className="h-7 px-2 text-[10px] font-bold"
                        >
                          <Edit3 className="w-3 h-3 mr-1 text-primary" />
                          <span>編輯</span>
                        </Button>

                        <Button 
                          onClick={() => handleDelete(ev.id, ev.title)} 
                          variant="destructive" 
                          size="sm" 
                          className="h-7 px-2 text-[10px] font-bold"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="py-20 border border-dashed border-border rounded-[4px] text-center space-y-2">
          <AlertCircle className="w-8 h-8 text-muted-foreground/60 mx-auto" />
          <p className="text-xs text-muted-foreground">目前沒有任何符合條件的活動。</p>
        </div>
      )}

      {/* Create / Edit Event Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md p-6 bg-background border border-border text-foreground rounded-xl shadow-2xl">
          <DialogHeader className="text-left pb-2 border-b border-border">
            <DialogTitle className="text-sm font-bold flex items-center space-x-2 text-primary">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>{editingEvent ? '編輯伺服器活動' : '發布全新伺服器活動'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              填寫活動標題、詳細說明與獎勵資訊，發布後玩家將於網頁與遊戲內收到通知。
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitForm} className="space-y-4 pt-2 text-left">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">活動標題</label>
              <Input 
                placeholder="例如: 週末採礦雙倍獎勵競賽" 
                className="h-8 text-xs font-bold"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">活動詳細內容與規則</label>
              <textarea 
                placeholder="說明活動內容、規則與參加方式..." 
                className="w-full min-h-[100px] p-2 text-xs border border-input bg-background rounded-[4px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">開始時間 (選填)</label>
                <Input 
                  placeholder="如: 2026/07/25 12:00" 
                  className="h-8 text-xs"
                  value={formStart}
                  onChange={(e) => setFormStart(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">結束時間 (選填)</label>
                <Input 
                  placeholder="如: 2026/07/27 23:59" 
                  className="h-8 text-xs"
                  value={formEnd}
                  onChange={(e) => setFormEnd(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">豐厚活動獎勵說明</label>
              <Input 
                placeholder="例如: 第一名 $50,000 遊戲幣 + 5 把抽獎鑰匙" 
                className="h-8 text-xs"
                value={formReward}
                onChange={(e) => setFormReward(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">活動狀態</label>
              <select
                className="w-full h-8 px-2 text-xs border border-input bg-background rounded-[4px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as any)}
              >
                <option value="active">🟢 進行中 (Active)</option>
                <option value="paused">⏸️ 暫停 (Paused)</option>
                <option value="completed">⚪ 已結束 (Completed)</option>
              </select>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                取消
              </Button>
              <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-bold" disabled={submitting}>
                {submitting ? '儲存中...' : (editingEvent ? '儲存變更' : '正式發布活動')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
