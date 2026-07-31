import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { 
  Home, MapPin, Flag, Plus, Trash2, Check, X, Compass, ShieldAlert, Cpu, Edit2, Tag 
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
  type?: string; // 'machine' | 'normal'
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
  const [loading, setLoading] = useState(true);

  // 申請設施 Modal 狀態
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [facilityName, setFacilityName] = useState('');
  const [functionDesc, setFunctionDesc] = useState('');
  const [coordsInput, setCoordsInput] = useState('');
  const [dimensionInput, setDimensionInput] = useState('minecraft:overworld');
  const [submitting, setSubmitting] = useState(false);

  // 刪除確認 Modal 狀態
  const [confirmModal, setConfirmModal] = useState<{ show: boolean; type: 'home' | 'warp'; name: string }>({
    show: false,
    type: 'home',
    name: ''
  });
  const [deleting, setDeleting] = useState(false);

  // 核准機器/地標 Modal 狀態
  const [approvalModal, setApprovalModal] = useState<{ show: boolean; id: number; facilityName: string; isMachine: boolean }>({
    show: false,
    id: 0,
    facilityName: '',
    isMachine: true
  });

  // 改名 Modal 狀態
  const [renameModal, setRenameModal] = useState<{ show: boolean; oldName: string; newName: string }>({
    show: false,
    oldName: '',
    newName: ''
  });

  // 訊息提示
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTeleportData = async () => {
    setLoading(true);
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

      const subRes = await apiFetch('/warp-submissions');
      if (subRes.ok && subRes.data?.success) {
        setSubmissions(subRes.data.submissions || []);
      }
    } catch (err) {
      console.error('Failed to fetch teleport data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeleportData();
  }, [token]);

  const handleSubmitFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!facilityName.trim() || !coordsInput.trim()) {
      setMsg({ type: 'error', text: '請輸入設施名稱與座標' });
      return;
    }

    setSubmitting(true);
    setMsg(null);
    try {
      const res = await apiFetch('/warp-submissions', {
        method: 'POST',
        body: JSON.stringify({
          facility_name: facilityName.trim(),
          function_desc: functionDesc.trim(),
          coords: coordsInput.trim(),
          dimension: dimensionInput
        })
      });
      if (res.ok && res.data?.success) {
        setMsg({ type: 'success', text: res.data.message || '設施審核已成功提交！' });
        setIsSubmitModalOpen(false);
        setFacilityName('');
        setFunctionDesc('');
        setCoordsInput('');
        fetchTeleportData();
      } else {
        setMsg({ type: 'error', text: res.data?.message || '提交失敗' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: '網路連線失敗' });
    } finally {
      setSubmitting(false);
    }
  };

  const executeApprove = async () => {
    if (!token || !approvalModal.id) return;
    try {
      const res = await apiFetch(`/admin/machine-submissions/${approvalModal.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          warp_name: approvalModal.facilityName,
          is_machine: approvalModal.isMachine
        })
      });
      if (res.ok && res.data?.success) {
        setMsg({ type: 'success', text: res.data.message });
        setApprovalModal({ show: false, id: 0, facilityName: '', isMachine: true });
        fetchTeleportData();
      } else {
        setMsg({ type: 'error', text: res.data?.message || '審核失敗' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: '網路連線失敗' });
    }
  };

  const handleRejectSubmission = async (id: number) => {
    if (!token) return;
    const reason = prompt('請輸入駁回原因：', '未符合設施規範') || '未符合設施規範';
    try {
      const res = await apiFetch(`/admin/machine-submissions/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      if (res.ok && res.data?.success) {
        setMsg({ type: 'success', text: res.data.message });
        fetchTeleportData();
      } else {
        setMsg({ type: 'error', text: res.data?.message || '操作失敗' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: '網路連線失敗' });
    }
  };

  const handleRenameWarp = async () => {
    if (!token || !renameModal.oldName || !renameModal.newName) return;
    try {
      const res = await apiFetch('/admin/warps/rename', {
        method: 'POST',
        body: JSON.stringify({
          old_name: renameModal.oldName,
          new_name: renameModal.newName.trim()
        })
      });
      if (res.ok && res.data?.success) {
        setMsg({ type: 'success', text: res.data.message });
        setRenameModal({ show: false, oldName: '', newName: '' });
        fetchTeleportData();
      } else {
        setMsg({ type: 'error', text: res.data?.message || '更名失敗' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: '網路連線失敗' });
    }
  };

  const handleSetWarpType = async (warpName: string, currentType?: string) => {
    if (!token) return;
    const newType = currentType === 'machine' ? 'normal' : 'machine';
    try {
      const res = await apiFetch('/admin/warps/type', {
        method: 'POST',
        body: JSON.stringify({ name: warpName, type: newType })
      });
      if (res.ok && res.data?.success) {
        setMsg({ type: 'success', text: res.data.message });
        fetchTeleportData();
      } else {
        setMsg({ type: 'error', text: res.data?.message || '類型切換失敗' });
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
        ? `/user/homes/${encodeURIComponent(confirmModal.name)}`
        : `/warps/${encodeURIComponent(confirmModal.name)}`;

      const res = await apiFetch(url, {
        method: 'DELETE'
      });
      if (res.ok && res.data?.success) {
        setMsg({ type: 'success', text: `成功刪除${confirmModal.type === 'home' ? '家園' : '地標'}：「${confirmModal.name}」` });
        fetchTeleportData();
      } else {
        setMsg({ type: 'error', text: res.data?.message || '刪除失敗' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: '網路請求失敗' });
    } finally {
      setDeleting(false);
      setConfirmModal({ show: false, type: 'home', name: '' });
    }
  };

  const formatDimension = (dim: string) => {
    if (dim.includes('nether')) return '🔥 地獄';
    if (dim.includes('end')) return '🌌 終界';
    return '🌿 主世界';
  };

  return (
    <div className="space-y-6">
      {/* 頂部說明區 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <Compass className="h-6 w-6 text-primary" />
            遊戲傳送點與機器設施審核
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            檢視個人家園地標、公共設施與機器審核發布進度。
          </p>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-xs font-bold ${
          msg.type === 'success' ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' : 'bg-red-500/15 text-red-500 border border-red-500/30'
        }`}>
          {msg.text}
        </div>
      )}

      {/* 分頁切換 Tab */}
      <div className="flex items-center space-x-2 border-b border-border pb-2">
        <Button
          variant={activeTab === 'homes' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => { setActiveTab('homes'); setMsg(null); }}
          className="text-xs font-bold gap-1.5"
        >
          <Home className="h-3.5 w-3.5" />
          個人家園 ({homes.length})
        </Button>
        <Button
          variant={activeTab === 'warps' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => { setActiveTab('warps'); setMsg(null); }}
          className="text-xs font-bold gap-1.5"
        >
          <Flag className="h-3.5 w-3.5 text-indigo-500" />
          公共地標 ({warps.length})
        </Button>
        <Button
          variant={activeTab === 'submissions' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => { setActiveTab('submissions'); setMsg(null); }}
          className="text-xs font-bold gap-1.5"
        >
          <Cpu className="h-3.5 w-3.5 text-amber-500" />
          🏭 機器與設施審核 ({submissions.length})
        </Button>
      </div>

      {/* 分頁內容 */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-xs font-bold">載入資料中...</div>
      ) : activeTab === 'homes' ? (
        homes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-xs text-muted-foreground">
              您目前尚未在遊戲內設定任何個人家點。可在遊戲內使用 <code className="bg-muted px-1.5 py-0.5 rounded font-mono">/sethome [名稱]</code> 設定家園！
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
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                      {formatDimension(home.dimension)}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded border border-border font-mono">
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <span>座標: {home.coords}</span>
                  </div>

                  <div className="pt-2 border-t border-border flex justify-end">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => initiateDelete('home', home.name)}
                      className="w-full text-[11px] font-bold"
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
          {warps.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-xs text-muted-foreground">
                目前伺服器尚未設定任何公共地標。您可前往「機器審核」分頁申請設立設施地標！
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {warps.map((warp) => (
                <Card key={warp.name} className="flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {warp.type === 'machine' ? (
                          <Cpu className="h-5 w-5 text-amber-500" />
                        ) : (
                          <Flag className="h-5 w-5 text-indigo-500" />
                        )}
                        <CardTitle className="normal-case text-base font-bold">{warp.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          warp.type === 'machine' ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30' : 'bg-indigo-500/15 text-indigo-500 border border-indigo-500/30'
                        }`}>
                          {warp.type === 'machine' ? '🏭 認證機器' : '📍 公共地標'}
                        </span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded border border-border font-mono">
                      <MapPin className="h-4 w-4 text-indigo-500 shrink-0" />
                      <span>座標: {warp.coords}</span>
                    </div>

                    {isAdmin && (
                      <div className="pt-2 border-t border-border flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRenameModal({ show: true, oldName: warp.name, newName: warp.name })}
                            className="flex-1 text-[11px] font-bold gap-1"
                          >
                            <Edit2 className="h-3.5 w-3.5 text-primary" /> 地標改名
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetWarpType(warp.name, warp.type)}
                            className="flex-1 text-[11px] font-bold gap-1"
                          >
                            <Tag className="h-3.5 w-3.5 text-amber-500" /> 
                            {warp.type === 'machine' ? '切為一般' : '設為機器'}
                          </Button>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => initiateDelete('warp', warp.name)}
                          className="w-full text-[11px] font-bold"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> 刪除地標
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
            <h3 className="text-sm font-bold text-foreground">🏭 認證機器設施審核紀錄與申請列表</h3>
            <Button
              onClick={() => setIsSubmitModalOpen(true)}
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>提交機器設施審核</span>
            </Button>
          </div>

          {submissions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-xs text-muted-foreground">
                目前沒有任何機器設施審核申請紀錄。
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
                          sub.status === 'approved' ? 'bg-emerald-500/15 text-emerald-500' :
                          sub.status === 'rejected' ? 'bg-red-500/15 text-red-500' :
                          'bg-amber-500/15 text-amber-500'
                        }`}>
                          {sub.status === 'approved' ? '🟢 已核准 (地標: ' + (sub.warp_name || sub.facility_name) + ')' : sub.status === 'rejected' ? '🔴 已駁回' : '🟡 審核中'}
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
                          onClick={() => setApprovalModal({ show: true, id: sub.id, facilityName: sub.facility_name, isMachine: true })}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8"
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          核准發布地標
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
              <span>申請報備認證機器設施 / Warp 傳送點</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              請填寫您建造的紅石機器設施名稱、功能說明與座標，審核通過後將自動發布為公共 Warp 地標！
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitFacility} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground font-mono">設施/機器名稱</label>
              <Input
                type="text"
                placeholder="例: 大白熊自動刷鐵機"
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground font-mono">功能說明與用途</label>
              <Input
                type="text"
                placeholder="例: 自動刷鐵、全服共享"
                value={functionDesc}
                onChange={(e) => setFunctionDesc(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground font-mono">遊戲座標 (X Y Z)</label>
                <Input
                  type="text"
                  placeholder="例: 100 64 -200"
                  value={coordsInput}
                  onChange={(e) => setCoordsInput(e.target.value)}
                  required
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground font-mono">維度</label>
                <select
                  value={dimensionInput}
                  onChange={(e) => setDimensionInput(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="minecraft:overworld">主世界</option>
                  <option value="minecraft:the_nether">地獄</option>
                  <option value="minecraft:the_end">終界</option>
                </select>
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-border">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsSubmitModalOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={submitting} size="sm" className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold">
                {submitting ? '提交中...' : '確認提交審核'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 核准發布 Modal */}
      <Dialog open={approvalModal.show} onOpenChange={(open) => !open && setApprovalModal({ show: false, id: 0, facilityName: '', isMachine: true })}>
        <DialogContent className="max-w-md p-6 bg-background border border-border text-foreground rounded-xl shadow-2xl">
          <DialogHeader className="text-left pb-2 border-b border-border">
            <DialogTitle className="text-sm font-bold flex items-center space-x-2 text-emerald-500">
              <Check className="w-4 h-4" />
              <span>核准設施申請並發布地標</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground font-mono">最終地標名稱 (Warp Name)</label>
              <Input
                type="text"
                value={approvalModal.facilityName}
                onChange={(e) => setApprovalModal(prev => ({ ...prev, facilityName: e.target.value }))}
                className="text-xs"
              />
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="isMachineCheck"
                checked={approvalModal.isMachine}
                onChange={(e) => setApprovalModal(prev => ({ ...prev, isMachine: e.target.checked }))}
                className="rounded border-border text-primary"
              />
              <label htmlFor="isMachineCheck" className="text-xs font-bold text-foreground cursor-pointer">
                🏭 標註為認證機器設施 (免領地過期清潔費)
              </label>
            </div>

            <DialogFooter className="pt-3 border-t border-border">
              <Button type="button" variant="ghost" size="sm" onClick={() => setApprovalModal({ show: false, id: 0, facilityName: '', isMachine: true })}>
                取消
              </Button>
              <Button type="button" onClick={executeApprove} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                確認核准並發布地標
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* 改名 Modal */}
      <Dialog open={renameModal.show} onOpenChange={(open) => !open && setRenameModal({ show: false, oldName: '', newName: '' })}>
        <DialogContent className="max-w-md p-6 bg-background border border-border text-foreground rounded-xl shadow-2xl">
          <DialogHeader className="text-left pb-2 border-b border-border">
            <DialogTitle className="text-sm font-bold flex items-center space-x-2 text-primary">
              <Edit2 className="w-4 h-4" />
              <span>地標重新命名</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground font-mono">新地標名稱</label>
              <Input
                type="text"
                value={renameModal.newName}
                onChange={(e) => setRenameModal(prev => ({ ...prev, newName: e.target.value }))}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-3 border-t border-border">
              <Button type="button" variant="ghost" size="sm" onClick={() => setRenameModal({ show: false, oldName: '', newName: '' })}>
                取消
              </Button>
              <Button type="button" onClick={handleRenameWarp} size="sm" className="font-bold">
                確認更名
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* 刪除確認 Modal */}
      <Dialog open={confirmModal.show} onOpenChange={(open) => !open && setConfirmModal({ show: false, type: 'home', name: '' })}>
        <DialogContent className="max-w-sm p-6 bg-background border border-border text-foreground rounded-xl shadow-2xl">
          <DialogHeader className="text-left pb-2 border-b border-border">
            <DialogTitle className="text-sm font-bold flex items-center space-x-2 text-destructive">
              <ShieldAlert className="w-4 h-4" />
              <span>刪除確認</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              您確定要刪除{confirmModal.type === 'home' ? '家園' : '公共地標'}「<strong className="text-foreground">{confirmModal.name}</strong>」嗎？此操作無法撤銷！
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3 border-t border-border">
            <Button variant="ghost" size="sm" onClick={() => setConfirmModal({ show: false, type: 'home', name: '' })}>
              取消
            </Button>
            <Button variant="destructive" disabled={deleting} size="sm" onClick={handleConfirmDelete} className="font-bold">
              {deleting ? '刪除中...' : '確認刪除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
