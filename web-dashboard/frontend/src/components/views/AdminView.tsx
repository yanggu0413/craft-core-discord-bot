import { useState } from 'react';
import { Hammer, LogOut, UserCheck, Megaphone, Search, AlertCircle, Eye, Shield, Sparkles, Send } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import MinecraftItemIcon from '../ui/MinecraftItemIcon';

interface AdminViewProps {
  token: string | null;
  triggerToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  API_URL: string;
}

interface PlayerProfile {
  mc_username: string;
  balance: number;
  online: boolean;
  coords: string;
  tps: number;
  keys_count: number;
  checkin_streak: number;
  total_checkins: number;
  last_checkin: string | null;
  discord_id: string | null;
  discord_tag?: string | null;
  mc_uuid: string | null;
}

interface InventoryItem {
  slot: number;
  itemId: string;
  count: number;
  displayName: string;
  nbt?: string;
}

export default function AdminView({ token, triggerToast, API_URL }: AdminViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'audit' | 'announcement' | 'cobrand'>('audit');

  // Ban & Kick States
  const [banPlayer, setBanPlayer] = useState('');
  const [banReason, setBanReason] = useState('');
  const [kickPlayer, setKickPlayer] = useState('');
  const [kickReason, setKickReason] = useState('');
  const [isBanning, setIsBanning] = useState(false);
  const [isKicking, setIsKicking] = useState(false);

  // Ban/Kick Dialog States
  const [isBanDialogOpen, setIsBanDialogOpen] = useState(false);
  const [isKickDialogOpen, setIsKickDialogOpen] = useState(false);

  // Co-branding State
  const [coBrandTarget, setCoBrandTarget] = useState('');
  const [isRewarding, setIsRewarding] = useState(false);

  // Announcement States
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annScope, setAnnScope] = useState('');
  const [annImpact, setAnnImpact] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  // Player Search & Inventory States
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchedProfile, setSearchedProfile] = useState<PlayerProfile | null>(null);
  const [searchedInventory, setSearchedInventory] = useState<InventoryItem[]>([]);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);

  // Dates
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  // API Form Handlers
  const handleBan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banPlayer.trim() || !banReason.trim() || !token) return;

    setIsBanning(true);
    try {
      const res = await fetch(`${API_URL}/admin/ban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ player: banPlayer.trim(), reason: banReason.trim() })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(`成功封鎖玩家 ${banPlayer}！`, 'success');
        setBanPlayer('');
        setBanReason('');
        setIsBanDialogOpen(false);
      } else {
        triggerToast(data.message || '封鎖失敗', 'error');
      }
    } catch (err: any) {
      triggerToast('連線 API 錯誤：' + err.message, 'error');
    } finally {
      setIsBanning(false);
    }
  };

  const handleKick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kickPlayer.trim() || !kickReason.trim() || !token) return;

    setIsKicking(true);
    try {
      const res = await fetch(`${API_URL}/admin/kick`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ player: kickPlayer.trim(), reason: kickReason.trim() })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(`成功將玩家 ${kickPlayer} 踢出伺服器！`, 'success');
        setKickPlayer('');
        setKickReason('');
        setIsKickDialogOpen(false);
      } else {
        triggerToast(data.message || '踢出失敗', 'error');
      }
    } catch (err: any) {
      triggerToast('連線 API 錯誤：' + err.message, 'error');
    } finally {
      setIsKicking(false);
    }
  };

  const handleCoBrandReward = async (targetName?: string) => {
    const target = targetName || coBrandTarget.trim();
    if (!target || !token) return;

    setIsRewarding(true);
    try {
      const res = await fetch(`${API_URL}/admin/co-branding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ player: target })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(`成功發送聯名禮包（$5,000 + 6 鑰匙）給 ${target}！`, 'success');
        if (!targetName) setCoBrandTarget('');
      } else {
        triggerToast(data.message || '獎勵發送失敗', 'error');
      }
    } catch (err: any) {
      triggerToast('連線 API 錯誤：' + err.message, 'error');
    } finally {
      setIsRewarding(false);
    }
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !token) return;

    setIsPublishing(true);
    try {
      const res = await fetch(`${API_URL}/admin/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: annTitle.trim(),
          content: annContent.trim(),
          scope: annScope.trim(),
          impact: annImpact.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast('公告已成功發布至 Discord！', 'success');
        setAnnTitle('');
        setAnnContent('');
        setAnnScope('');
        setAnnImpact('');
      } else {
        triggerToast(data.message || '公告發布失敗', 'error');
      }
    } catch (err: any) {
      triggerToast('連線 API 錯誤：' + err.message, 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePlayerSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !token) return;

    setIsSearching(true);
    try {
      const res = await fetch(`${API_URL}/admin/player/${searchQuery.trim()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSearchedProfile(data.profile);
        setSearchedInventory(data.inventory || []);
        triggerToast(`成功載入玩家 ${searchQuery.trim()} 的檔案！`, 'success');
      } else {
        triggerToast(data.message || '找不到該玩家或資料載入失敗', 'error');
      }
    } catch (err: any) {
      triggerToast('查詢失敗：' + err.message, 'error');
    } finally {
      setIsSearching(false);
    }
  };

  // Helper to render inventory slots
  const renderSlot = (slotIndex: number, emptyBgUrl?: string) => {
    const item = searchedInventory.find(i => i.slot === slotIndex);
    return (
      <div 
        key={slotIndex}
        className="w-10 h-10 bg-[#8b8b8b] border-2 border-t-[#373737] border-l-[#373737] border-b-[#ffffff] border-r-[#ffffff] flex items-center justify-center relative p-1 cursor-help group"
        title={item ? `${item.displayName} (${item.itemId})\n數量: ${item.count}${item.nbt ? `\nNBT: ${item.nbt}` : ''}` : '空插槽'}
      >
        {item ? (
          <>
            <MinecraftItemIcon itemId={item.itemId} className="w-7 h-7" />
            {item.count > 1 && (
              <span className="absolute bottom-0.5 right-1 text-[10px] text-white font-bold [text-shadow:1px_1px_0px_#3f3f3f]">
                {item.count}
              </span>
            )}
          </>
        ) : (
          emptyBgUrl && (
            <img 
              src={emptyBgUrl} 
              alt="placeholder" 
              className="w-6 h-6 opacity-30 select-none pointer-events-none"
            />
          )
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 text-left">
      {/* 標題與簡介 */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-black tracking-wider uppercase text-foreground flex items-center space-x-2">
            <Shield className="w-5 h-5 text-primary" />
            <span>管理員主控台 (Admin Dashboard)</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            伺服器高階管理與稽核系統：玩家檔案調閱、封鎖/踢出、聯名發放與 Discord 公告推播。
          </p>
        </div>

        {/* 子頁籤導航選單 (Sub-Tabs) */}
        <div className="flex items-center space-x-1 bg-muted p-1 rounded-lg border border-border shrink-0">
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'audit' 
                ? 'bg-card text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            🛡️ 玩家查核與懲處
          </button>
          <button
            onClick={() => setActiveSubTab('announcement')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'announcement' 
                ? 'bg-card text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            📢 公告發布器
          </button>
          <button
            onClick={() => setActiveSubTab('cobrand')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'cobrand' 
                ? 'bg-card text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            🤝 聯名加值禮包
          </button>
        </div>
      </div>

      {/* 1. 子分頁 A: 🛡️ 玩家查核與懲處中心 (Player Moderation & Audit Hub) */}
      {activeSubTab === 'audit' && (
        <div className="space-y-6 animate-fade-in">
          {/* 頂部玩家搜尋列 */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-xs font-bold flex items-center space-x-2">
                <Search className="w-4 h-4 text-primary" />
                <span>搜查玩家檔案 (Search Player Passport)</span>
              </CardTitle>
              <CardDescription className="text-[11px]">
                輸入玩家 Minecraft 帳號，以生成管理員直控卡，並進行遠端懲處或實體背包審查。
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handlePlayerSearch} className="flex gap-3 max-w-xl">
                <Input 
                  placeholder="輸入玩家遊戲名稱 (例如: Yanggu)..." 
                  className="h-10 text-xs font-bold"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  required
                />
                <Button type="submit" size="sm" className="h-10 px-6 font-bold text-xs shrink-0" disabled={isSearching}>
                  {isSearching ? '查詢中...' : '載入玩家檔案'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* 搜尋結果：管理員一體化玩家檔案卡 */}
          {searchedProfile ? (
            <Card className="border-primary/30 shadow-md bg-gradient-to-r from-card to-primary/5">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                  
                  {/* 玩家基本頭像與標籤 */}
                  <div className="flex items-center space-x-4">
                    <img 
                      src={`https://mc-heads.net/avatar/${searchedProfile.mc_username}/64`} 
                      alt={searchedProfile.mc_username}
                      className="w-16 h-16 rounded-xl border-2 border-primary/30 bg-muted shadow-sm"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-xl font-black text-foreground">{searchedProfile.mc_username}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${searchedProfile.online ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-muted text-muted-foreground border-border'}`}>
                          {searchedProfile.online ? '🟢 線上' : '🔴 離線'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Discord 連結：<span className="font-bold text-indigo-400">{searchedProfile.discord_tag ? `@${searchedProfile.discord_tag}` : (searchedProfile.discord_id ? `ID: ${searchedProfile.discord_id}` : '未綁定')}</span>
                      </p>
                    </div>
                  </div>

                  {/* 快捷管理動作按鈕 */}
                  <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                    <Button 
                      onClick={() => setIsInventoryOpen(true)} 
                      size="sm" 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      <span>查看實體背包</span>
                    </Button>
                    <Button 
                      onClick={() => handleCoBrandReward(searchedProfile.mc_username)} 
                      size="sm" 
                      variant="outline"
                      className="border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 font-bold text-xs h-9"
                      disabled={isRewarding}
                    >
                      <UserCheck className="w-4 h-4 mr-1" />
                      <span>發送聯名禮包</span>
                    </Button>
                    <Button 
                      onClick={() => { setKickPlayer(searchedProfile.mc_username); setIsKickDialogOpen(true); }} 
                      size="sm" 
                      variant="outline"
                      className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10 font-bold text-xs h-9"
                    >
                      <LogOut className="w-4 h-4 mr-1" />
                      <span>踢出 (Kick)</span>
                    </Button>
                    <Button 
                      onClick={() => { setBanPlayer(searchedProfile.mc_username); setIsBanDialogOpen(true); }} 
                      size="sm" 
                      variant="destructive"
                      className="font-bold text-xs h-9"
                    >
                      <Hammer className="w-4 h-4 mr-1" />
                      <span>封鎖 (Ban)</span>
                    </Button>
                  </div>

                </div>

                {/* 檔案數據矩陣 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mt-6 border-t border-border pt-4 text-xs">
                  <div className="p-2.5 bg-muted/30 border border-border rounded-md">
                    <p className="text-[9px] uppercase font-bold text-muted-foreground">帳戶金幣餘額</p>
                    <p className="text-sm font-bold text-emerald-500 font-mono mt-0.5">${searchedProfile.balance.toLocaleString()} 元</p>
                  </div>
                  <div className="p-2.5 bg-muted/30 border border-border rounded-md">
                    <p className="text-[9px] uppercase font-bold text-muted-foreground">遊戲內座標</p>
                    <p className="text-sm font-bold font-mono mt-0.5">{searchedProfile.coords}</p>
                  </div>
                  <div className="p-2.5 bg-muted/30 border border-border rounded-md">
                    <p className="text-[9px] uppercase font-bold text-muted-foreground">伺服器 TPS</p>
                    <p className="text-sm font-bold mt-0.5 text-primary">{searchedProfile.tps.toFixed(2)}</p>
                  </div>
                  <div className="p-2.5 bg-muted/30 border border-border rounded-md">
                    <p className="text-[9px] uppercase font-bold text-muted-foreground">抽獎鑰匙</p>
                    <p className="text-sm font-bold text-amber-500 mt-0.5">{searchedProfile.keys_count} 把</p>
                  </div>
                  <div className="p-2.5 bg-muted/30 border border-border rounded-md">
                    <p className="text-[9px] uppercase font-bold text-muted-foreground">連續簽到</p>
                    <p className="text-sm font-bold text-primary mt-0.5">{searchedProfile.checkin_streak} 天</p>
                  </div>
                  <div className="p-2.5 bg-muted/30 border border-border rounded-md">
                    <p className="text-[9px] uppercase font-bold text-muted-foreground">最後簽到</p>
                    <p className="text-xs font-bold text-muted-foreground mt-1 truncate">{searchedProfile.last_checkin || '無紀錄'}</p>
                  </div>
                </div>

              </CardContent>
            </Card>
          ) : (
            <div className="py-16 text-center border-2 border-dashed border-border rounded-xl bg-card/50">
              <AlertCircle className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">請在上方輸入玩家帳號進行檔案調閱與控制。</p>
            </div>
          )}
        </div>
      )}

      {/* 2. 子分頁 B: 📢 伺服器公告發布器 (Discord Announcement Publisher) */}
      {activeSubTab === 'announcement' && (
        <Card className="bg-card border-border shadow-sm animate-fade-in">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-xs font-bold flex items-center space-x-2 text-indigo-500">
              <Megaphone className="w-4 h-4" />
              <span>📢 伺服器全服公告發布器 (Discord Embed Publisher)</span>
            </CardTitle>
            <CardDescription className="text-[11px]">
              填寫維護或改版公告，發布後會自動同步推送至 Discord 官方公告頻道與遊戲內。
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* 左側表單 */}
              <form onSubmit={handlePublishAnnouncement} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">公告標題</label>
                  <Input 
                    placeholder="例如: 伺服器性能重構與安全更新公告" 
                    className="h-9 text-xs font-bold"
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">前言與內文說明</label>
                  <textarea 
                    placeholder="親愛的玩家們，我們今日完成了一系列的效能優化與非同步存檔引擎..." 
                    className="w-full min-h-[120px] p-3 text-xs border border-input bg-background rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={annContent}
                    onChange={(e) => setAnnContent(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">影響範圍 (Scope)</label>
                    <Input 
                      placeholder="例如: 全體伺服器分流" 
                      className="h-9 text-xs"
                      value={annScope}
                      onChange={(e) => setAnnScope(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">重要影響 (Impact)</label>
                    <Input 
                      placeholder="例如: TPS 提升 30%，無卡頓" 
                      className="h-9 text-xs"
                      value={annImpact}
                      onChange={(e) => setAnnImpact(e.target.value)}
                    />
                  </div>
                </div>
                <Button type="submit" size="sm" className="w-full h-10 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white" disabled={isPublishing}>
                  <Send className="w-4 h-4 mr-2" />
                  {isPublishing ? '正在發送至 Discord...' : '正式發布全服公告'}
                </Button>
              </form>

              {/* 右側 1:1 Discord Embed 即時模擬器 */}
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Discord 頻道預覽 (Live Embed Replica)</label>
                <div className="flex-1 bg-[#313338] text-[#dbdee1] p-4 rounded-lg border border-black/40 text-xs font-sans space-y-2 overflow-y-auto max-h-[380px]">
                  <div className="flex items-start space-x-2.5">
                    <img 
                      src="https://raw.githubusercontent.com/Owen1212055/mc-assets/main/item-assets/COMMAND_BLOCK.png" 
                      alt="Bot Avatar" 
                      className="w-8 h-8 rounded-full bg-primary shrink-0"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-white text-[13px]">Craft-Core System</span>
                        <span className="bg-[#5865f2] text-white text-[9px] font-bold px-1 py-0.5 rounded">BOT</span>
                        <span className="text-[10px] text-[#949ba4]">{today.toLocaleTimeString()}</span>
                      </div>
                      <div className="text-[13px] leading-relaxed text-[#dbdee1] whitespace-pre-wrap">
                        <span className="text-[#5865f2] font-bold">@公告通知</span>
                        <br /><br />
                        <h1 className="text-white font-bold text-base mt-1">📢 ｜ 伺服器公告：{annTitle || '（請在左側輸入標題）'}</h1>
                        <br />
                        親愛的玩家們：
                        <br /><br />
                        {annContent || '（請在左側輸入公告內文說明）'}
                        <br /><br />
                        ----------------------------------------
                        <br /><br />
                        <h2 className="text-white font-bold text-sm">📌 ｜ 公告核心內容</h2>
                        <br />
                        * 🗓️ **發布時間**：{year} / {month} / {day}
                        {annScope && <><br />* ⚙️ **涉及範圍**：{annScope}</>}
                        {annImpact && <><br />* ⚠️ **重要影響**：{annImpact}</>}
                        <br /><br />
                        **Craft-Core 管理團隊 敬上**
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. 子分頁 C: 🤝 聯名加值與禮包發放 (Co-Branding Distribution) */}
      {activeSubTab === 'cobrand' && (
        <Card className="bg-card border-border shadow-sm max-w-xl animate-fade-in">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-xs font-bold flex items-center space-x-2 text-emerald-500">
              <UserCheck className="w-4 h-4" />
              <span>🤝 聯名加值禮包手動發放 (Co-branding Reward)</span>
            </CardTitle>
            <CardDescription className="text-[11px]">
              為指定玩家發放合作聯名禮包：包含 6 把大理石抽獎鑰匙與 $5,000 元金幣。
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">目標玩家 (Discord ID 或 Minecraft 帳號)</label>
              <Input 
                placeholder="例如: 1360409328175153242 或 Yanggu" 
                className="h-10 text-xs font-bold"
                value={coBrandTarget}
                onChange={(e) => setCoBrandTarget(e.target.value)}
                required
              />
            </div>
            <Button 
              onClick={() => handleCoBrandReward()} 
              size="sm" 
              className="w-full h-10 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white" 
              disabled={isRewarding || !coBrandTarget.trim()}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {isRewarding ? '正在派發中...' : '確認派發聯名禮包'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 4. Ban 對話框 (Ban Dialog) */}
      <Dialog open={isBanDialogOpen} onOpenChange={setIsBanDialogOpen}>
        <DialogContent className="max-w-md p-6 bg-card border-border rounded-xl shadow-xl">
          <DialogHeader className="pb-2 border-b border-border">
            <DialogTitle className="text-sm font-bold text-red-500 flex items-center space-x-2">
              <Hammer className="w-4 h-4" />
              <span>確認封鎖玩家 {banPlayer}</span>
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBan} className="space-y-4 pt-3">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">封鎖原因</label>
              <Input 
                placeholder="違反伺服器規範 / 使用外掛..." 
                className="h-9 text-xs"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsBanDialogOpen(false)}>取消</Button>
              <Button type="submit" variant="destructive" size="sm" disabled={isBanning}>
                {isBanning ? '執行中...' : '確認執行 Ban 封鎖'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 5. Kick 對話框 (Kick Dialog) */}
      <Dialog open={isKickDialogOpen} onOpenChange={setIsKickDialogOpen}>
        <DialogContent className="max-w-md p-6 bg-card border-border rounded-xl shadow-xl">
          <DialogHeader className="pb-2 border-b border-border">
            <DialogTitle className="text-sm font-bold text-amber-500 flex items-center space-x-2">
              <LogOut className="w-4 h-4" />
              <span>確認踢出玩家 {kickPlayer}</span>
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleKick} className="space-y-4 pt-3">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">踢出原因</label>
              <Input 
                placeholder="干擾他人進行遊戲 / 掛網過久..." 
                className="h-9 text-xs"
                value={kickReason}
                onChange={(e) => setKickReason(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsKickDialogOpen(false)}>取消</Button>
              <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold" size="sm" disabled={isKicking}>
                {isKicking ? '執行中...' : '確認執行 Kick 踢出'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 6. 1:1 實體背包對話框 (Inventory Inspection Dialog) */}
      {searchedProfile && (
        <Dialog open={isInventoryOpen} onOpenChange={setIsInventoryOpen}>
          <DialogContent className="max-w-xl p-6 bg-slate-900 border-slate-800 text-white rounded-xl shadow-2xl">
            <DialogHeader className="text-center pb-2 border-b border-slate-800">
              <DialogTitle className="text-base font-bold flex items-center justify-center space-x-2 text-emerald-400">
                <span>🎒</span>
                <span>{searchedProfile.mc_username} 的背包與裝備即時審查</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                1:1 遊戲 UI 樣式展示盔甲、主角 Skin 3D 渲染圖與 9x3 物品欄插槽。
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 flex justify-center">
              <div className="flex flex-col items-center bg-[#c6c6c6] border-4 border-t-[#ffffff] border-l-[#ffffff] border-b-[#555555] border-r-[#555555] p-5 space-y-4 rounded-[4px] shadow-2xl scale-105">
                {/* Top Section: Armor, Body Render & Offhand */}
                <div className="w-full flex items-center justify-between">
                  {/* Left: Armor Slots */}
                  <div className="flex flex-col space-y-1">
                    {renderSlot(39, 'https://assets.mcasset.cloud/1.21.1/assets/minecraft/textures/item/empty_armor_slot_helmet.png')}
                    {renderSlot(38, 'https://assets.mcasset.cloud/1.21.1/assets/minecraft/textures/item/empty_armor_slot_chestplate.png')}
                    {renderSlot(37, 'https://assets.mcasset.cloud/1.21.1/assets/minecraft/textures/item/empty_armor_slot_leggings.png')}
                    {renderSlot(36, 'https://assets.mcasset.cloud/1.21.1/assets/minecraft/textures/item/empty_armor_slot_boots.png')}
                  </div>

                  {/* Center: Character Body Render */}
                  <div className="flex-1 h-44 flex items-center justify-center relative bg-[#8b8b8b] border-2 border-t-[#555555] border-l-[#555555] border-b-[#ffffff] border-r-[#ffffff] mx-4 rounded-[2px] overflow-hidden p-2">
                    <img 
                      src={`https://mc-heads.net/body/${searchedProfile.mc_username}`} 
                      alt={`${searchedProfile.mc_username} body`}
                      className="h-full object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.4)]"
                    />
                  </div>

                  {/* Right: Offhand Slot */}
                  <div className="flex flex-col justify-end h-full">
                    {renderSlot(40, 'https://assets.mcasset.cloud/1.21.1/assets/minecraft/textures/item/empty_armor_slot_shield.png')}
                  </div>
                </div>

                {/* Divider */}
                <div className="w-full h-1 bg-[#555555] border-b border-[#ffffff]" />

                {/* Middle Section: Main Inventory Grid (9x3, slots 9-35) */}
                <div className="grid grid-cols-9 gap-1">
                  {Array.from({ length: 27 }, (_, idx) => renderSlot(idx + 9))}
                </div>

                {/* Divider */}
                <div className="w-full h-1 bg-[#555555] border-b border-[#ffffff]" />

                {/* Bottom Section: Hotbar (9x1, slots 0-8) */}
                <div className="grid grid-cols-9 gap-1">
                  {Array.from({ length: 9 }, (_, idx) => renderSlot(idx))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
