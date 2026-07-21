import React, { useState, useEffect } from 'react';

interface Home {
  name: string;
  coords: string;
  dimension: string;
}

interface Warp {
  name: string;
  coords: string;
  dimension: string;
}

interface TeleportManagerProps {
  token: string | null;
  isAdmin: boolean;
}

export const TeleportManager: React.FC<TeleportManagerProps> = ({ token, isAdmin }) => {
  const [homes, setHomes] = useState<Home[]>([]);
  const [warps, setWarps] = useState<Warp[]>([]);
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
    const clean = dim.replace('minecraft:', '');
    if (clean === 'overworld') return '主世界 (Overworld)';
    if (clean === 'the_nether') return '地獄 (Nether)';
    if (clean === 'the_end') return '終界 (End)';
    return clean;
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/60 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-xl">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>🧭</span> 傳送地標與家園管理
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          在此檢視全服公共地標，或遠端管理您設定的個人家園儲存點
        </p>

        {/* Tabs */}
        <div className="flex border-b border-slate-700/60 mt-6 gap-6">
          <button
            onClick={() => setActiveTab('homes')}
            className={`pb-3 font-semibold text-sm transition-all border-b-2 ${activeTab === 'homes' ? 'text-indigo-400 border-indigo-400' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
          >
            🏠 我的家園 (Homes)
          </button>
          <button
            onClick={() => setActiveTab('warps')}
            className={`pb-3 font-semibold text-sm transition-all border-b-2 ${activeTab === 'warps' ? 'text-indigo-400 border-indigo-400' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
          >
            🏁 公共地標 (Warps)
          </button>
        </div>
      </div>

      {msg && (
        <div className={`p-4 rounded-xl text-sm font-medium ${msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400">讀取中...</div>
      ) : error ? (
        <div className="text-center py-12 text-rose-400">{error}</div>
      ) : activeTab === 'homes' ? (
        homes.length === 0 ? (
          <div className="text-center py-12 bg-slate-800/30 rounded-2xl border border-slate-700/30 text-slate-400">
            您目前沒有在遊戲中設定任何家園儲存點。請使用 /sethome 指令來建立。
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {homes.map((home) => (
              <div key={home.name} className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 flex flex-col justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>🏠</span> {home.name}
                  </h3>
                  <div className="mt-2 space-y-1 text-sm text-slate-300">
                    <p className="flex justify-between">
                      <span className="text-slate-500">座標:</span>
                      <span className="font-mono">{home.coords}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-slate-500">維度:</span>
                      <span>{formatDimension(home.dimension)}</span>
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-700/30 pt-3 flex justify-end">
                  <button
                    onClick={() => initiateDelete('home', home.name)}
                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg text-xs font-semibold border border-rose-500/20 transition-all"
                  >
                    刪除家園
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        warps.length === 0 ? (
          <div className="text-center py-12 bg-slate-800/30 rounded-2xl border border-slate-700/30 text-slate-400">
            目前全服沒有設定任何公共地標。
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {warps.map((warp) => (
              <div key={warp.name} className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 flex flex-col justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>🏁</span> {warp.name}
                  </h3>
                  <div className="mt-2 space-y-1 text-sm text-slate-300">
                    <p className="flex justify-between">
                      <span className="text-slate-500">座標:</span>
                      <span className="font-mono">{warp.coords}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-slate-500">維度:</span>
                      <span>{formatDimension(warp.dimension)}</span>
                    </p>
                  </div>
                </div>

                {isAdmin && (
                  <div className="border-t border-slate-700/30 pt-3 flex justify-end">
                    <button
                      onClick={() => initiateDelete('warp', warp.name)}
                      className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg text-xs font-semibold border border-rose-500/20 transition-all"
                    >
                      刪除地標
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 max-w-sm w-full space-y-4">
            <h3 className="text-xl font-bold text-white">⚠️ 確定要刪除嗎？</h3>
            <p className="text-slate-300 text-sm">
              您正在嘗試刪除{confirmModal.type === 'home' ? '個人家園' : '公共地標'}：「<span className="font-bold text-indigo-400">{confirmModal.name}</span>」。
              此動作將永久移除該儲存點，且無法還原！
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setConfirmModal({ show: false, type: 'home', name: '' })}
                disabled={deleting}
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all"
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              >
                {deleting ? '刪除中...' : '確定刪除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
