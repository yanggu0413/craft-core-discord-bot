import { useState } from 'react';
import { Hammer, LogOut, UserCheck, Megaphone, Search, AlertCircle, Eye } from 'lucide-react';
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
  // Ban & Kick States
  const [banPlayer, setBanPlayer] = useState('');
  const [banReason, setBanReason] = useState('');
  const [kickPlayer, setKickPlayer] = useState('');
  const [kickReason, setKickReason] = useState('');
  const [isBanning, setIsBanning] = useState(false);
  const [isKicking, setIsKicking] = useState(false);

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

  // Helpers to get today's date parts
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
      } else {
        triggerToast(data.message || '踢出失敗', 'error');
      }
    } catch (err: any) {
      triggerToast('連線 API 錯誤：' + err.message, 'error');
    } finally {
      setIsKicking(false);
    }
  };

  const handleCoBrandReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coBrandTarget.trim() || !token) return;

    setIsRewarding(true);
    try {
      const res = await fetch(`${API_URL}/admin/co-branding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ player: coBrandTarget.trim() })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(`成功發送聯名獎勵給 ${coBrandTarget}！`, 'success');
        setCoBrandTarget('');
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
        triggerToast(`成功載入玩家 ${searchQuery.trim()} 的資料！`, 'success');
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
    <div className="space-y-6">
      <div className="space-y-1 text-left">
        <h2 className="text-base font-bold tracking-wider uppercase text-foreground">管理員主控面板</h2>
        <p className="text-xs text-muted-foreground">
          提供伺服器高級管理工具，包括玩家懲處、聯名活動發放、即時背包審查以及 Discord 系統公告發布。
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Side: Administration Forms */}
        <div className="xl:col-span-2 space-y-6">
          {/* Ban & Kick Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Ban Player */}
            <Card>
              <CardHeader className="pb-3 border-b border-border text-left">
                <CardTitle className="text-xs font-bold flex items-center space-x-2 text-red-500">
                  <Hammer className="w-4 h-4" />
                  <span>🚫 封鎖玩家 (Ban)</span>
                </CardTitle>
                <CardDescription className="text-[10px]">
                  將特定玩家封鎖以禁止其登入遊戲伺服器。
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <form onSubmit={handleBan} className="space-y-3 text-left">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">玩家帳號</label>
                    <Input 
                      placeholder="Minecraft 帳號..." 
                      className="h-8 text-xs"
                      value={banPlayer}
                      onChange={(e) => setBanPlayer(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">封鎖原因</label>
                    <Input 
                      placeholder="違反伺服器規範..." 
                      className="h-8 text-xs"
                      value={banReason}
                      onChange={(e) => setBanReason(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" variant="destructive" size="sm" className="w-full h-8 text-[11px] font-bold" disabled={isBanning}>
                    {isBanning ? '執行中...' : '確認封鎖玩家'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Kick Player */}
            <Card>
              <CardHeader className="pb-3 border-b border-border text-left">
                <CardTitle className="text-xs font-bold flex items-center space-x-2 text-amber-500">
                  <LogOut className="w-4 h-4" />
                  <span>🥾 踢出玩家 (Kick)</span>
                </CardTitle>
                <CardDescription className="text-[10px]">
                  將特定玩家強制斷線，移除出目前遊戲對局。
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <form onSubmit={handleKick} className="space-y-3 text-left">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">玩家帳號</label>
                    <Input 
                      placeholder="Minecraft 帳號..." 
                      className="h-8 text-xs"
                      value={kickPlayer}
                      onChange={(e) => setKickPlayer(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">踢出原因</label>
                    <Input 
                      placeholder="干擾他人進行遊戲..." 
                      className="h-8 text-xs"
                      value={kickReason}
                      onChange={(e) => setKickReason(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" variant="outline" size="sm" className="w-full h-8 text-[11px] font-bold text-amber-500 hover:text-amber-600 border-amber-500/30 hover:bg-amber-500/10" disabled={isKicking}>
                    {isKicking ? '執行中...' : '確認踢出玩家'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Co-branding Reward Action */}
          <Card>
            <CardHeader className="pb-3 border-b border-border text-left">
              <CardTitle className="text-xs font-bold flex items-center space-x-2 text-emerald-500">
                <UserCheck className="w-4 h-4" />
                <span>🤝 聯名福利加值發送 (Co-branding Reward)</span>
              </CardTitle>
              <CardDescription className="text-[10px]">
                發送聯名合作活動獎勵：加值 6 把大理石抽獎鑰匙與 $5,000 元遊戲幣。
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleCoBrandReward} className="space-y-4 text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">發送目標 (Discord ID 或 Minecraft 帳號)</label>
                    <Input 
                      placeholder="例如: 1360409328175153242 或 Yanggu" 
                      className="h-8 text-xs"
                      value={coBrandTarget}
                      onChange={(e) => setCoBrandTarget(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" size="sm" className="w-full h-8 text-[11px] font-bold" disabled={isRewarding}>
                      {isRewarding ? '正在派發...' : '派發聯名禮包'}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Announcement Publisher */}
          <Card>
            <CardHeader className="pb-3 border-b border-border text-left">
              <CardTitle className="text-xs font-bold flex items-center space-x-2 text-indigo-500">
                <Megaphone className="w-4 h-4" />
                <span>📢 伺服器公告發布器 (Discord Embed Publisher)</span>
              </CardTitle>
              <CardDescription className="text-[10px]">
                編輯伺服器維護或活動公告，發送後會同步推送至 Discord 官方公告頻道。
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Form */}
                <form onSubmit={handlePublishAnnouncement} className="space-y-3 text-left">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">公告標題</label>
                    <Input 
                      placeholder="例如: 伺服器臨時維護公告" 
                      className="h-8 text-xs font-bold"
                      value={annTitle}
                      onChange={(e) => setAnnTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">前言 / 內容說明</label>
                    <textarea 
                      placeholder="親愛的玩家們，我們將於今日進行安全加固更新..." 
                      className="w-full min-h-[90px] p-2 text-xs border border-input bg-background rounded-[4px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={annContent}
                      onChange={(e) => setAnnContent(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">影響範圍 (Scope)</label>
                    <Input 
                      placeholder="例如: 全體伺服器分流" 
                      className="h-8 text-xs"
                      value={annScope}
                      onChange={(e) => setAnnScope(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">重要影響 (Impact)</label>
                    <Input 
                      placeholder="例如: 預計維護 30 分鐘，期間無法登入" 
                      className="h-8 text-xs"
                      value={annImpact}
                      onChange={(e) => setAnnImpact(e.target.value)}
                    />
                  </div>
                  <Button type="submit" size="sm" className="w-full h-8 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white" disabled={isPublishing}>
                    {isPublishing ? '發送中...' : '正式發布公告'}
                  </Button>
                </form>

                {/* Discord Embed Preview */}
                <div className="flex flex-col text-left">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Discord 頻道預覽 (Live Embed Replica)</label>
                  <div className="flex-1 bg-[#313338] text-[#dbdee1] p-4 rounded-[4px] border border-black/40 text-xs font-sans space-y-2 overflow-y-auto max-h-[340px]">
                    <div className="flex items-start space-x-2.5">
                      <img 
                        src="https://raw.githubusercontent.com/Owen1212055/mc-assets/main/item-assets/COMMAND_BLOCK.png" 
                        alt="Bot Avatar" 
                        className="w-8 h-8 rounded-full bg-primary shrink-0"
                      />
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-white text-[13px] hover:underline cursor-pointer">Craft-Core System</span>
                          <span className="bg-[#5865f2] text-white text-[9px] font-bold px-1 py-0.5 rounded-[2px] scale-90">BOT</span>
                          <span className="text-[10px] text-[#949ba4]">{today.toLocaleTimeString()}</span>
                        </div>
                        <div className="text-[13px] leading-relaxed text-[#dbdee1] whitespace-pre-wrap">
                          <span className="text-[#5865f2] hover:underline cursor-pointer font-bold">@公告通知</span>
                          <br /><br />
                          <h1 className="text-white font-bold text-base mt-1">📢 ｜ 伺服器公告：{annTitle || '（請輸入標題）'}</h1>
                          <br />
                          親愛的玩家們：
                          <br /><br />
                          {annContent || '（請輸入前言 / 公告內容）'}
                          <br /><br />
                          ----------------------------------------
                          <br /><br />
                          <h2 className="text-white font-bold text-sm">📌 ｜ 公告核心內容</h2>
                          <br />
                          * 🗓️ **發布時間**：{year} / {month} / {day}
                          {annScope && <><br />* ⚙️ **涉及範圍**：{annScope}</>}
                          {annImpact && <><br />* ⚠️ **重要影響**：{annImpact}</>}
                          <br /><br />
                          ----------------------------------------
                          <br /><br />
                          <h2 className="text-white font-bold text-sm">💡 ｜ 相關頻道與回報</h2>
                          <br />
                          如果你對本次公告有任何疑問，或在遊戲內遇到問題，請多加利用以下頻道：
                          <br />
                          * 💬 想要參與討論、發表心得 ➡️ <span className="text-[#5865f2] bg-[#5865f2]/10 hover:bg-[#5865f2]/20 px-1 py-0.5 rounded-[2px] font-bold">#general-chat</span>
                          <br />
                          * 🎫 發現任何 BUG 或有緊急申訴 ➡️ <span className="text-[#5865f2] bg-[#5865f2]/10 hover:bg-[#5865f2]/20 px-1 py-0.5 rounded-[2px] font-bold">#open-ticket</span>（利用開單系統私密處理）
                          <br /><br />
                          感謝大家對 **Craft-Core** 的支持與配合，我們會持續優化，帶給大家更穩定的遊戲體驗！
                          <br /><br />
                          **Craft-Core 管理團隊 敬上**
                          <br />
                          *${year}.${month}.${day}*
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Player Search & Live Inventory */}
        <div className="space-y-6">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3 border-b border-border text-left">
              <CardTitle className="text-xs font-bold flex items-center space-x-2">
                <Search className="w-4 h-4" />
                <span>🔍 玩家檔案與背包即時審查</span>
              </CardTitle>
              <CardDescription className="text-[10px]">
                輸入玩家 Minecraft 帳號，以 1:1 遊戲 UI 樣式即時檢視其背包裝備。
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 flex-1 flex flex-col justify-between">
              <form onSubmit={handlePlayerSearch} className="flex gap-2 mb-4">
                <Input 
                  placeholder="輸入玩家遊戲名稱..." 
                  className="h-8 text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  required
                />
                <Button type="submit" size="sm" className="h-8 px-4 font-bold text-xs" disabled={isSearching}>
                  {isSearching ? '查詢中' : '查詢'}
                </Button>
              </form>

              {searchedProfile ? (
                <div className="space-y-4 flex-1 flex flex-col justify-between">
                  {/* Profile Info */}
                  <div className="grid grid-cols-2 gap-2 text-left bg-muted/40 p-3 border border-border rounded-[4px]">
                    <div className="col-span-2 border-b border-border pb-1 mb-1 flex items-center justify-between">
                      <span className="font-bold text-xs text-primary">{searchedProfile.mc_username}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-[2px] ${searchedProfile.online ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-muted border border-border text-muted-foreground'}`}>
                        {searchedProfile.online ? '🟢 線上' : '🔴 離線'}
                      </span>
                    </div>
                    <div className="col-span-2 text-[10px] bg-indigo-500/10 border border-indigo-500/20 p-1.5 rounded-[3px] text-indigo-400 font-bold mb-1">
                      <span>Discord 綁定：</span>
                      <span>{searchedProfile.discord_tag ? `@${searchedProfile.discord_tag}` : (searchedProfile.discord_id ? `ID: ${searchedProfile.discord_id}` : '未綁定')}</span>
                    </div>
                    <div className="text-[10px]"><span className="text-muted-foreground">帳戶餘額：</span><span className="font-bold text-foreground">${searchedProfile.balance.toLocaleString()} 元</span></div>
                    <div className="text-[10px]"><span className="text-muted-foreground">當前座標：</span><span className="font-bold text-foreground">{searchedProfile.coords}</span></div>
                    <div className="text-[10px]"><span className="text-muted-foreground">抽獎鑰匙：</span><span className="font-bold text-foreground">{searchedProfile.keys_count} 把</span></div>
                    <div className="text-[10px]"><span className="text-muted-foreground">簽到天數：</span><span className="font-bold text-foreground">{searchedProfile.total_checkins} 天</span></div>
                    <div className="text-[10px]"><span className="text-muted-foreground">連簽天數：</span><span className="font-bold text-foreground">{searchedProfile.checkin_streak} 天</span></div>
                    <div className="text-[10px]"><span className="text-muted-foreground">最後簽到：</span><span className="font-bold text-foreground">{searchedProfile.last_checkin || '無紀錄'}</span></div>
                  </div>

                  {/* Pop-up Inventory Trigger Button */}
                  <Button 
                    onClick={() => setIsInventoryOpen(true)} 
                    variant="default" 
                    size="sm" 
                    className="w-full font-bold h-10 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center justify-center space-x-2"
                  >
                    <Eye className="w-4 h-4" />
                    <span>查看玩家背包與裝備 (1:1 彈出視窗)</span>
                  </Button>

                  {/* Pop-up Inventory Dialog */}
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
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-[4px]">
                  <AlertCircle className="w-8 h-8 text-muted-foreground/60 mb-2" />
                  <p className="text-xs text-muted-foreground">尚未載入任何玩家資料，請先在上方搜尋。</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
