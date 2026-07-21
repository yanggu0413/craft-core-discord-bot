import React, { useState, useEffect } from 'react';
import { Compass, Home, Flag, MapPin, Trash2, RefreshCw, AlertCircle, CheckCircle2, Plus, Check, X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';

interface HomeItem {
  name: string;
  coords: string;
  dimension: string;
}

interface WarpItem {
  name: string;
  coords: string;
  dimension: string;
}

interface WarpSubmission {
  id: number;
  applicant_username: string;
  facility_name: string;
  function_desc: string;
  coords: string;
  dimension: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface TeleportManagerProps {
  token: string | null;
  isAdmin: boolean;
}

export const TeleportManager: React.FC<TeleportManagerProps> = ({ token, isAdmin }) => {
  const [homes, setHomes] = useState<HomeItem[]>([]);
  const [warps, setWarps] = useState<WarpItem[]>([]);
  const [submissions, setSubmissions] = useState<WarpSubmission[]>([]);
  const [activeTab, setActiveTab] = useState<'homes' | 'warps' | 'submissions'>('homes');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Submission Modal state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [facilityName, setFacilityName] = useState('');
  const [functionDesc, setFunctionDesc] = useState('');
  const [coordsInput, setCoordsInput] = useState('');
  const [dimInput, setDimInput] = useState('minecraft:overworld');
  const [submitting, setSubmitting] = useState(false);

  // Modal confirm states
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    type: 'home' | 'warp';
    name: string;
  }>({ show: false, type: 'home', name: '' });

  const [deleting, setDeleting] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTeleportData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'homes') {
        if (!token) return;
        const res = await fetch('/api/user/homes', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setHomes(data.homes || []);
          setError(null);
        } else {
          setError(data.message || '讀取家園列表失敗');
        }
      } else if (activeTab === 'warps') {
        const res = await fetch('/api/warps');
        const data = await res.json();
        if (data.success) {
          setWarps(data.warps || []);
          setError(null);
        } else {
          setError(data.message || '讀取公共地標失敗');
        }
      } else {
        const res = await fetch('/api/warp-submissions');
        const data = await res.json();
        if (data.success) {
          setSubmissions(data.submissions || []);
          setError(null);
        }
      }
    } catch (err) {
      setError('連線至伺服器失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeleportData();
  }, [token, activeTab]);

  const handleSubmitAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!facilityName.trim() || !functionDesc.trim() || !coordsInput.trim()) {
      setMsg({ type: 'error', text: '請填寫完整的設施名稱、功能說明與座標！' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/warp-submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          facility_name: facilityName.trim(),
          function_desc: functionDesc.trim(),
          coords: coordsInput.trim(),
          dimension: dimInput
        })
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: 'success', text: data.message || '設施審核已成功提交！' });
        setIsSubmitModalOpen(false);
        setFacilityName('');
        setFunctionDesc('');
        setCoordsInput('');
        fetchTeleportData();
      } else {
        setMsg({ type: 'error', text: data.message || '提交失敗' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: '網路連線失敗' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveSubmission = async (id: number) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/warp-submissions/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: 'success', text: data.message });
        fetchTeleportData();
      } else {
        setMsg({ type: 'error', text: data.message || '審核失敗' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: '網路連線失敗' });
    }
  };

  const handleRejectSubmission = async (id: number) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/warp-submissions/${id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: 'success', text: data.message });
        fetchTeleportData();
      } else {
        setMsg({ type: 'error', text: data.message || '操作失敗' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: '網路連線失敗' });
    }
  };

  const initiateDelete = (type: 'home' | 'warp', name: string) => {
    setConfirmModal({ show: true, type, name });
    setMsg(null);
  };

  const handleConfirmDelete = async () => {
    if (!token) return;
    setDeleting(true);
    try {
      const url = confirmModal.type === 'home' 
        ? `/api/user/homes/${encodeURIComponent(confirmModal.name)}`
        : `/api/warps/${encodeURIComponent(confirmModal.name)}`;

      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: 'success', text: `成功刪除${confirmModal.type === 'home' ? '家園' : '地標'}：「${confirmModal.name}」` });
        fetchTeleportData();
      } else {
        setMsg({ type: 'error', text: data.message || '刪除失敗' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: '網路請求失敗' });
    } finally {
      setDeleting(false);
      setConfirmModal({ show: false, type: 'home', name: '' });
    }
  };

  const formatDimension = (dim: string) => {
    if (!dim) return '主世界';
    if (dim.includes('the_nether') || dim.includes('nether')) return '地獄 (Nether)';
    if (dim.includes('the_end') || dim.includes('end')) return '終界 (End)';
    return '主世界 (Overworld)';
  };

  return (
    <div className="space-y-6 text-left">
      {/* 標頭與頁籤切換卡片 */}
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-bold uppercase tracking-wider">傳送地標與設施審核</CardTitle>
            </div>
            <CardDescription className="mt-1">
              在此檢視全服公共地標，或提交您建造的公共設施申請建立 /warp 傳送點！
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={activeTab === 'homes' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('homes')}
            >
              <Home className="h-4 w-4 mr-1.5" />
              我的家園 (Homes)
            </Button>
            <Button
              variant={activeTab === 'warps' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('warps')}
            >
              <Flag className="h-4 w-4 mr-1.5" />
              公共地標 (Warps)
            </Button>
            <Button
              variant={activeTab === 'submissions' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('submissions')}
            >
              <Plus className="h-4 w-4 mr-1.5 text-amber-500" />
              設施審核 ({submissions.filter(s => s.status === 'pending').length})
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* 提示訊息 */}
      {msg && (
        <div className={`p-3 rounded-[4px] text-xs font-semibold flex items-center gap-2 ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
          {msg.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* 列表內容 */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>讀取中...</span>
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center text-xs text-destructive flex items-center justify-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </CardContent>
        </Card>
      ) : activeTab === 'homes' ? (
        homes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-xs text-muted-foreground">
              您目前沒有在遊戲中設定任何家園儲存點。請使用 /sethome 指令來建立。
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {homes.map((home) => (
              <Card key={home.name} className="flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Home className="h-5 w-5 text-primary" />
                      <CardTitle className="normal-case text-base font-bold">{home.name}</CardTitle>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {formatDimension(home.dimension)}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-slate-50 p-2.5 rounded border border-slate-200 font-mono">
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <span>座標: {home.coords}</span>
                  </div>

                  <div className="pt-2 border-t border-border flex justify-end">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => initiateDelete('home', home.name)}
                      className="w-full text-[11px]"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> 刪除此家園
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : activeTab === 'warps' ? (
        <div className="space-y-6">
          <div className="flex justify-end">
            <Button
              onClick={() => setIsSubmitModalOpen(true)}
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>📝 申請設立公共設施 Warp</span>
            </Button>
          </div>

          {warps.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-xs text-muted-foreground">
                目前伺服器尚未設定任何公共地標。歡迎點擊右上角按鈕申請設立！
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {warps.map((warp) => (
                <Card key={warp.name} className="flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Flag className="h-5 w-5 text-indigo-600" />
                        <CardTitle className="normal-case text-base font-bold">{warp.name}</CardTitle>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {formatDimension(warp.dimension)}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-slate-50 p-2.5 rounded border border-slate-200 font-mono">
                      <MapPin className="h-4 w-4 text-indigo-600 shrink-0" />
                      <span>座標: {warp.coords}</span>
                    </div>

                    {isAdmin && (
                      <div className="pt-2 border-t border-border flex justify-end">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => initiateDelete('warp', warp.name)}
                          className="w-full text-[11px]"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> 刪除地標 (管理員權限)
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Submissions Tab */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">公共設施審核紀錄與申請列表</h3>
            <Button
              onClick={() => setIsSubmitModalOpen(true)}
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>提交設施審核</span>
            </Button>
          </div>

          {submissions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-xs text-muted-foreground">
                目前沒有任何公共設施審核申請紀錄。
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {submissions.map((sub) => (
                <Card key={sub.id} className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{sub.facility_name}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          sub.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                          sub.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {sub.status === 'approved' ? '🟢 已核准' : sub.status === 'rejected' ? '🔴 已駁回' : '🟡 審核中'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{sub.function_desc}</p>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-3 font-mono">
                        <span>申請人: {sub.applicant_username}</span>
                        <span>座標: {sub.coords} ({sub.dimension})</span>
                      </div>
                    </div>

                    {isAdmin && sub.status === 'pending' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleApproveSubmission(sub.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8"
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          同意通過
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRejectSubmission(sub.id)}
                          className="font-bold text-xs h-8"
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          駁回
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 提交設施審核 Modal */}
      <Dialog open={isSubmitModalOpen} onOpenChange={setIsSubmitModalOpen}>
        <DialogContent className="max-w-md p-6 bg-background border border-border text-foreground rounded-xl shadow-2xl">
          <DialogHeader className="text-left pb-2 border-b border-border">
            <DialogTitle className="text-sm font-bold flex items-center space-x-2 text-primary">
              <Plus className="w-4 h-4 text-amber-500" />
              <span>申請設立公共設施 / Warp 傳送點</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              請填寫您建造的設施名稱、詳細功能說明與遊戲座標，審核通過後將會為您設立公共 /warp 點！
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitAudit} className="space-y-4 pt-2 text-left">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">1. 設施名稱</label>
              <Input 
                placeholder="例如: 刷鐵機 / 公共小麥農場" 
                className="h-8 text-xs font-bold"
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">2. 設施功能說明</label>
              <textarea 
                placeholder="說明設施為玩家提供的服務（如：免費鐵錠、公共附魔台...）" 
                className="w-full min-h-[80px] p-2 text-xs border border-input bg-background rounded-[4px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={functionDesc}
                onChange={(e) => setFunctionDesc(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">3. 設施座標 X Y Z</label>
              <Input 
                placeholder="例如: 150 64 -200" 
                className="h-8 text-xs font-mono"
                value={coordsInput}
                onChange={(e) => setCoordsInput(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">4. 所在世界</label>
              <select
                className="w-full h-8 px-2 text-xs border border-input bg-background rounded-[4px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={dimInput}
                onChange={(e) => setDimInput(e.target.value)}
              >
                <option value="minecraft:overworld">主世界 (Overworld)</option>
                <option value="minecraft:the_nether">地獄 (Nether)</option>
                <option value="minecraft:the_end">終界 (End)</option>
              </select>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsSubmitModalOpen(false)}>
                取消
              </Button>
              <Button type="submit" size="sm" className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold" disabled={submitting}>
                {submitting ? '提交中...' : '正式提交審核'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 刪除確認 Modal */}
      <Dialog open={confirmModal.show} onOpenChange={(open) => !open && setConfirmModal({ show: false, type: 'home', name: '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除{confirmModal.type === 'home' ? '家園' : '地標'}</DialogTitle>
            <DialogDescription>
              您確定要刪除{confirmModal.type === 'home' ? '家園' : '公共地標'} 「<span className="font-bold text-foreground">{confirmModal.name}</span>」嗎？此操作將無法撤銷。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmModal({ show: false, type: 'home', name: '' })}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting ? '刪除中...' : '確認刪除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
