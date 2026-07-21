import React, { useState, useEffect } from 'react';

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
  const [error, setError] = useState<string | null>(null);
  const [newBotName, setNewBotName] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchFakePlayers = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/user/fakeplayers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setFakeplayers(data.fakeplayers || []);
        setError(null);
      } else {
        setError(data.message || '無法讀取假人列表');
      }
    } catch (err: any) {
      setError('連線至伺服器失敗');
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
      const res = await fetch('/api/user/fakeplayers/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ botName, action })
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: 'success', text: data.message || '指令已成功發送' });
        setTimeout(() => fetchFakePlayers(), 1000);
      } else {
        setMsg({ type: 'error', text: data.message || '操作失敗' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: '網路請求失敗' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSpawnNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBotName.trim()) return;
    handleAction(newBotName.trim(), 'spawn');
    setNewBotName('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800/60 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-xl">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>🤖</span> 假人控制與掛機面板 (Carpet Bot)
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            您可以召喚與控制專屬於您的假人在遊戲內掛機（每位玩家上限為 3 隻）
          </p>
        </div>

        <form onSubmit={handleSpawnNew} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="輸入假人名稱 (如 mybot)"
            value={newBotName}
            onChange={(e) => setNewBotName(e.target.value)}
            disabled={submitting}
            className="bg-slate-900/80 text-white px-4 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500 text-sm"
          />
          <button
            type="submit"
            disabled={submitting || !newBotName.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-xl text-sm transition-all disabled:opacity-50"
          >
            {submitting ? '處理中...' : '召喚假人'}
          </button>
        </form>
      </div>

      {msg && (
        <div className={`p-4 rounded-xl text-sm font-medium ${msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400">正在讀取假人狀態...</div>
      ) : error ? (
        <div className="text-center py-12 text-rose-400">{error}</div>
      ) : fakeplayers.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/30 rounded-2xl border border-slate-700/30 text-slate-400">
          目前尚未召喚任何假人，請於上方輸入名稱並點擊「召喚假人」。
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {fakeplayers.map((bot) => (
            <div key={bot.name} className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/40 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>👤</span> {bot.name}
                  </h3>
                  <p className="text-xs text-slate-400">擁有者：{bot.owner}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${bot.online ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700 text-slate-400'}`}>
                  {bot.online ? '在線中 (Online)' : '離線 (Offline)'}
                </span>
              </div>

              {bot.online ? (
                <div className="space-y-3">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">基礎動作</span>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <button onClick={() => handleAction(bot.name, 'attack continuous')} disabled={submitting} className="bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg text-xs transition-all">連續攻擊 (Attack)</button>
                      <button onClick={() => handleAction(bot.name, 'use continuous')} disabled={submitting} className="bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg text-xs transition-all">連續使用 (Use)</button>
                      <button onClick={() => handleAction(bot.name, 'stop')} disabled={submitting} className="bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-lg text-xs transition-all">停止所有動作 (Stop)</button>
                      <button onClick={() => handleAction(bot.name, 'kill')} disabled={submitting} className="bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/30 px-3 py-1.5 rounded-lg text-xs transition-all">下線/清理 (Kill)</button>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">移動與狀態</span>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <button onClick={() => handleAction(bot.name, 'jump')} disabled={submitting} className="bg-slate-700/50 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs transition-all">跳躍 (Jump)</button>
                      <button onClick={() => handleAction(bot.name, 'sneak')} disabled={submitting} className="bg-slate-700/50 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs transition-all">蹲下 (Sneak)</button>
                      <button onClick={() => handleAction(bot.name, 'unsneak')} disabled={submitting} className="bg-slate-700/50 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs transition-all">取消蹲下 (Unsneak)</button>
                      <button onClick={() => handleAction(bot.name, 'sprint')} disabled={submitting} className="bg-slate-700/50 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs transition-all">疾跑 (Sprint)</button>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">物品與裝備</span>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <button onClick={() => handleAction(bot.name, 'drop')} disabled={submitting} className="bg-slate-700/50 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs transition-all">丟棄單個 (Drop)</button>
                      <button onClick={() => handleAction(bot.name, 'dropStack')} disabled={submitting} className="bg-slate-700/50 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs transition-all">丟棄整疊 (DropStack)</button>
                      <button onClick={() => handleAction(bot.name, 'swapHands')} disabled={submitting} className="bg-slate-700/50 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs transition-all">副手交換 (SwapHands)</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-slate-400">若要在遊戲中喚醒，請點擊右側按鈕：</span>
                  <button
                    onClick={() => handleAction(bot.name, 'spawn')}
                    disabled={submitting}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-xl text-xs font-medium transition-all"
                  >
                    召喚上線 (Spawn)
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
