import React, { useState, useEffect } from 'react';
import { Compass, Home, Flag, MapPin, Trash2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
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

interface TeleportManagerProps {
  token: string | null;
  isAdmin: boolean;
}

export const TeleportManager: React.FC<TeleportManagerProps> = ({ token, isAdmin }) => {
  const [homes, setHomes] = useState<HomeItem[]>([]);
  const [warps, setWarps] = useState<WarpItem[]>([]);
  const [activeTab, setActiveTab] = useState<'homes' | 'warps'>('homes');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal confirm states
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    type: 'home' | 'warp';
    name: string;
  }>({ show: false, type: 'home', name: '' });

  const [deleting, setDeleting] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTeleportData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      if (activeTab === 'homes') {
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
      } else {
        const res = await fetch('/api/warps');
        const data = await res.json();
        if (data.success) {
          setWarps(data.warps || []);
          setError(null);
        } else {
          setError(data.message || '讀取公共地標失敗');
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
    <div className="space-y-6">
      {/* 標頭與頁籤切換卡片 */}
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-bold uppercase tracking-wider">傳送地標與家園管理</CardTitle>
            </div>
            <CardDescription className="mt-1">
              在此檢視全服公共地標，或遠端管理您設定的個人家園儲存點
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
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
      ) : warps.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-xs text-muted-foreground">
            目前伺服器尚未設定任何公共地標。管理員可以使用 /setwarp 指令新增。
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
