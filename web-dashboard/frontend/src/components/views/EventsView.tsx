import { useState, useEffect } from 'react';
import { Sparkles, Gift, Plus, Edit3, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import PageHeader from '../ui/PageHeader';

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
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: formTitle.trim(),
          description: formDesc.trim(),
          start_time: formStart,
          end_time: formEnd,
          reward_info: formReward,
          status: formStatus
        })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(data.message || '活動儲存成功！', 'success');
        setIsModalOpen(false);
        fetchEvents();
      } else {
        triggerToast(data.message || '儲存失敗', 'error');
      }
    } catch (err: any) {
      triggerToast('請求失敗：' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = async (id: number) => {
    if (!confirm('確定要刪除此活動嗎？')) return;
    try {
      const res = await fetch(`${API_URL}/admin/events/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        triggerToast('活動已刪除', 'success');
        fetchEvents();
      } else {
        triggerToast(data.message || '刪除失敗', 'error');
      }
    } catch (err: any) {
      triggerToast('請求失敗：' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-6 text-left">
      <PageHeader
        icon={Sparkles}
        title="伺服器限時活動"
        description="檢視伺服器官方活動、參與狂歡與挑戰解鎖珍貴禮包"
        badgeText={`${events.length} 個活動`}
        badgeVariant="outline"
        actions={
          isAdmin && (
            <Button
              variant="default"
              size="sm"
              onClick={handleOpenCreateModal}
              className="text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>新增伺服器活動</span>
            </Button>
          )
        }
      />

      {events.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {events.map((ev) => (
            <Card key={ev.id} className="flex flex-col justify-between">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-foreground" />
                    <CardTitle className="text-xs font-bold">{ev.title}</CardTitle>
                  </div>
                  <Badge variant={ev.status === 'active' ? "success" : "secondary"}>
                    {ev.status === 'active' ? '活動進行中' : ev.status === 'paused' ? '暫停中' : '已結束'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">{ev.description}</p>
                {ev.reward_info && (
                  <div className="p-2.5 rounded-md bg-muted/40 border border-border flex items-center space-x-2 text-xs">
                    <Gift className="w-4 h-4 text-foreground shrink-0" />
                    <span className="font-semibold text-foreground">獎勵：{ev.reward_info}</span>
                  </div>
                )}
                {isAdmin && (
                  <div className="flex items-center space-x-2 pt-2 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditModal(ev)}
                      className="text-xs flex-1"
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1" /> 編輯
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteEvent(ev.id)}
                      className="text-xs flex-1"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> 刪除
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="py-12">
          <CardContent className="text-center space-y-2">
            <Sparkles className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-bold text-foreground">當前暫無進行中的伺服器活動</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md text-left">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              {editingEvent ? '編輯伺服器活動' : '建立全新伺服器活動'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              填寫活動標題、詳細說明與獎勵資訊，發布後將顯示於首頁與活動頁面。
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitForm} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">活動標題</label>
              <Input
                type="text"
                placeholder="輸入活動標題..."
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">詳細說明</label>
              <Input
                type="text"
                placeholder="輸入活動內容說明..."
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                required
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">活動獎勵 (選填)</label>
              <Input
                type="text"
                placeholder="例: 抽獎鑰匙 x3"
                value={formReward}
                onChange={(e) => setFormReward(e.target.value)}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)} className="text-xs">
                取消
              </Button>
              <Button type="submit" disabled={submitting} size="sm" className="text-xs font-semibold">
                {submitting ? '儲存中...' : '確認儲存'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
