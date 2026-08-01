import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import PageHeader from './ui/PageHeader';
import { 
  Home, MapPin, Flag, Plus, Cpu, Trash2 
} from 'lucide-react';

interface HomeLocation {
  name: string;
  coords: string;
  dimension: string;
}

interface WarpLocation {
  name: string;
  coords: string;
  dimension: string;
  owner?: string;
  type?: string;
  desc?: string;
}

interface WarpSubmission {
  id: number;
  applicant_username: string;
  applicant_discord_id: string;
  facility_name: string;
  function_desc: string;
  coords: string;
  dimension: string;
  status: 'pending' | 'approved' | 'rejected';
  warp_name?: string;
  reject_reason?: string;
  created_at: string;
}

interface TeleportManagerProps {
  token: string | null;
  isAdmin?: boolean;
}

export function TeleportManager({ token, isAdmin = false }: TeleportManagerProps) {
  const [activeTab, setActiveTab] = useState<'homes' | 'warps' | 'submissions'>('homes');
  const [homes, setHomes] = useState<HomeLocation[]>([]);
  const [warps, setWarps] = useState<WarpLocation[]>([]);
  const [submissions, setSubmissions] = useState<WarpSubmission[]>([]);

  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [facilityName, setFacilityName] = useState('');
  const [functionDesc, setFunctionDesc] = useState('');
  const [coordsInput, setCoordsInput] = useState('');
  const [dimensionInput, setDimensionInput] = useState('minecraft:overworld');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTeleportData = async () => {
    try {
      if (token) {
        const homesRes = await apiFetch('/user/homes');
        if (homesRes.ok && homesRes.data?.success) {
          setHomes(homesRes.data.homes || []);
        }
      }

      const warpsRes = await apiFetch('/public/warps');
      if (warpsRes.ok && warpsRes.data?.success) {
        setWarps(warpsRes.data.warps || []);
      }

      if (isAdmin && token) {
        const subsRes = await apiFetch('/admin/warp-submissions');
        if (subsRes.ok && subsRes.data?.success) {
          setSubmissions(subsRes.data.submissions || []);
        }
      }
    } catch (e) {
      console.error('Error fetching teleport data:', e);
    }
  };

  useEffect(() => {
    fetchTeleportData();
  }, [token, isAdmin]);

  const handleSubmitFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facilityName.trim() || !coordsInput.trim()) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await apiFetch('/user/submit-warp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facilityName: facilityName.trim(),
          functionDesc: functionDesc.trim(),
          coords: coordsInput.trim(),
          dimension: dimensionInput
        })
      });
      if (res.ok && res.data?.success) {
        setMsg({ type: 'success', text: '設施申請提交成功，等待管理員審核！' });
        setIsSubmitModalOpen(false);
        setFacilityName('');
        setFunctionDesc('');
        setCoordsInput('');
      } else {
        setMsg({ type: 'error', text: res.data?.message || '提交失敗' });
      }
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || '連線失敗' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      <PageHeader
        icon={MapPin}
        title="傳送點與公共地標"
        description="管理個人設定之 Home 家點座標與全服公共 Warp 傳送點"
        badgeText={`${warps.length} 個公共地標`}
        badgeVariant="outline"
        actions={
          token && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsSubmitModalOpen(true)}
              className="text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>申請公共設施</span>
            </Button>
          )
        }
      />

      {msg && (
        <div className={`p-3 rounded-md text-xs font-semibold ${msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
          {msg.text}
        </div>
      )}

      <div className="flex items-center space-x-2 border-b border-border pb-3">
        <Button
          variant={activeTab === 'homes' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('homes')}
          className="text-xs font-semibold"
        >
          <Home className="w-3.5 h-3.5 mr-1" />
          <span>個人家點 ({homes.length})</span>
        </Button>
        <Button
          variant={activeTab === 'warps' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('warps')}
          className="text-xs font-semibold"
        >
          <Flag className="w-3.5 h-3.5 mr-1" />
          <span>公共地標 ({warps.length})</span>
        </Button>
        {isAdmin && (
          <Button
            variant={activeTab === 'submissions' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('submissions')}
            className="text-xs font-semibold"
          >
            <Cpu className="w-3.5 h-3.5 mr-1" />
            <span>設施審核 ({submissions.filter(s => s.status === 'pending').length})</span>
          </Button>
        )}
      </div>

      {activeTab === 'homes' && (
        <div className="space-y-4">
          {!token ? (
            <Card className="py-8 text-center text-xs text-muted-foreground">
              請先登入帳號以檢視您的個人家點。
            </Card>
          ) : homes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {homes.map((home) => (
                <Card key={home.name} className="flex flex-col justify-between">
                  <CardHeader className="pb-3 border-b border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Home className="w-4 h-4 text-foreground" />
                        <CardTitle className="text-xs font-bold">{home.name}</CardTitle>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {home.dimension || 'overworld'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 flex items-center justify-between font-mono text-xs text-muted-foreground">
                    <span>📍 {home.coords}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 font-sans font-bold"
                      onClick={async () => {
                        if (!confirm(`確定要刪除個人家點 "${home.name}" 嗎？`)) return;
                        try {
                          const res = await apiFetch(`/user/homes/${encodeURIComponent(home.name)}`, { method: 'DELETE' });
                          if (res.ok && res.data?.success) {
                            setMsg({ type: 'success', text: `家點 ${home.name} 已成功刪除！` });
                            fetchTeleportData();
                          } else {
                            setMsg({ type: 'error', text: res.data?.message || '刪除家點失敗' });
                          }
                        } catch (e: any) {
                          setMsg({ type: 'error', text: '請求失敗：' + e.message });
                        }
                      }}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      刪除
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="py-8 text-center text-xs text-muted-foreground">
              您目前沒有設定任何個人家點 (Home)。可在遊戲中使用 `/sethome` 設定。
            </Card>
          )}
        </div>
      )}

      {activeTab === 'warps' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {warps.map((warp) => {
            const rawDim = (warp.dimension || '').toLowerCase();
            let dimBadge = '主世界';
            let dimClass = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30';
            if (rawDim.includes('nether')) {
              dimBadge = '地獄';
              dimClass = 'bg-red-500/10 text-red-500 border-red-500/30';
            } else if (rawDim.includes('end')) {
              dimBadge = '終界';
              dimClass = 'bg-purple-500/10 text-purple-500 border-purple-500/30';
            }

            return (
              <Card key={warp.name} className="flex flex-col justify-between shadow-sm">
                <CardHeader className="pb-3 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Flag className="w-4 h-4 text-emerald-500" />
                      <CardTitle className="text-xs font-bold">{warp.name}</CardTitle>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Badge className={`text-[10px] font-bold border ${dimClass}`}>
                        {dimBadge}
                      </Badge>
                      {warp.type === 'machine' && (
                        <Badge variant="secondary" className="text-[10px]">認證設施</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-2 text-xs font-mono">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-sans text-[11px]">座標:</span>
                    <span className="font-bold text-foreground bg-muted/40 px-2 py-0.5 rounded border border-border">
                      📍 {warp.coords || '無座標'}
                    </span>
                  </div>
                  {warp.owner && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground font-sans text-[11px]">建立者:</span>
                      <span className="font-semibold text-foreground">{warp.owner}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {activeTab === 'submissions' && (
        <div className="space-y-4">
          {submissions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {submissions.map((sub) => (
                <Card key={sub.id} className="flex flex-col justify-between shadow-sm">
                  <CardHeader className="pb-3 border-b border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Cpu className="w-4 h-4 text-teal-500" />
                        <CardTitle className="text-xs font-bold">{sub.facility_name}</CardTitle>
                      </div>
                      <Badge 
                        variant={sub.status === 'approved' ? 'success' : sub.status === 'rejected' ? 'destructive' : 'secondary'} 
                        className="text-[10px]"
                      >
                        {sub.status === 'approved' ? '已核准發布' : sub.status === 'rejected' ? '已駁回' : '待審核'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-2 text-xs font-mono">
                    <p className="font-sans text-muted-foreground text-[11px]">{sub.function_desc || '無描述'}</p>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-muted-foreground font-sans">申請者: {sub.applicant_username}</span>
                      <span className="font-bold text-foreground bg-muted/40 px-2 py-0.5 rounded border border-border">{sub.coords}</span>
                    </div>

                    {isAdmin && sub.status === 'pending' && (
                      <div className="flex items-center space-x-2 pt-2 border-t border-border">
                        <Button 
                          size="sm" 
                          className="h-7 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
                          onClick={async () => {
                            const res = await apiFetch(`/admin/warp-submissions/${sub.id}/approve`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ is_machine: true })
                            });
                            if (res.ok) fetchTeleportData();
                          }}
                        >
                          ✓ 核准並發布
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          className="h-7 text-xs font-bold flex-1"
                          onClick={async () => {
                            const reason = prompt('請輸入駁回原因：') || '未符合規範';
                            const res = await apiFetch(`/admin/warp-submissions/${sub.id}/reject`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ reason })
                            });
                            if (res.ok) fetchTeleportData();
                          }}
                        >
                          ✕ 駁回申請
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="py-8 text-center text-xs text-muted-foreground">
              目前沒有任何設施地標申請紀錄。
            </Card>
          )}
        </div>
      )}

      <Dialog open={isSubmitModalOpen} onOpenChange={setIsSubmitModalOpen}>
        <DialogContent className="sm:max-w-md text-left">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">申請認證機器設施 / Warp 地標</DialogTitle>
            <DialogDescription className="text-xs">
              填寫您建造的紅石機器設施名稱、功能說明與座標，經審核後將自動發布為公共地標。
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitFacility} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">設施名稱</label>
              <Input
                type="text"
                placeholder="例: 大白熊自動刷鐵機"
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">功能說明</label>
              <Input
                type="text"
                placeholder="例: 自動刷鐵、全服共享"
                value={functionDesc}
                onChange={(e) => setFunctionDesc(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">座標 (X Y Z)</label>
                <Input
                  type="text"
                  placeholder="例: 100 64 -200"
                  value={coordsInput}
                  onChange={(e) => setCoordsInput(e.target.value)}
                  required
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">維度</label>
                <select
                  value={dimensionInput}
                  onChange={(e) => setDimensionInput(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-card px-3 text-xs text-foreground"
                >
                  <option value="minecraft:overworld">主世界</option>
                  <option value="minecraft:the_nether">地獄</option>
                  <option value="minecraft:the_end">終界</option>
                </select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsSubmitModalOpen(false)} className="text-xs">
                取消
              </Button>
              <Button type="submit" disabled={submitting} size="sm" className="text-xs font-semibold">
                {submitting ? '提交中...' : '確認提交'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
