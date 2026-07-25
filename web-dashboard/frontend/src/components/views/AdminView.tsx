import { useState } from 'react';
import { Hammer, LogOut, UserCheck, Megaphone, Search, AlertCircle, Eye, Shield, Sparkles, Send, FileText, DollarSign, Key, Coins, LifeBuoy, MessageSquare, HardDrive, RefreshCw } from 'lucide-react';
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

const COLOR_MAP: Record<string, string> = {
  '§c': 'text-red-500',
  '§6': 'text-orange-500',
  '§e': 'text-yellow-500',
  '§a': 'text-emerald-500',
  '§b': 'text-cyan-500',
  '§d': 'text-purple-400',
  '§f': 'text-slate-100',
};

export default function AdminView({ token, triggerToast, API_URL }: AdminViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'audit' | 'announcement' | 'cobrand' | 'transactions' | 'tickets' | 'backup'>('audit');

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

  // Title Management States
  const [titleText, setTitleText] = useState('');
  const [titleColor, setTitleColor] = useState('§c');
  const [titleBold, setTitleBold] = useState(true);
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  // Direct Top-up States
  const [giveAmount, setGiveAmount] = useState('');
  const [giveKeys, setGiveKeys] = useState('');
  const [isGivingMoney, setIsGivingMoney] = useState(false);
  const [isGivingKeys, setIsGivingKeys] = useState(false);

  // Backup Management States
  const [backupStats, setBackupStats] = useState<{
    total_bytes: number;
    max_bytes: number;
    count: number;
    is_backing_up: boolean;
    files: Array<{ name: string; size_bytes: number; last_modified: number }>;
  } | null>(null);
  const [isLoadingBackup, setIsLoadingBackup] = useState(false);
  const [isTriggeringBackup, setIsTriggeringBackup] = useState(false);

  const fetchBackupStatus = async () => {
    if (!token) return;
    setIsLoadingBackup(true);
    try {
      const res = await fetch(`${API_URL}/admin/backup/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setBackupStats(data.stats);
      }
    } catch (e) {
      console.error('Failed to fetch backup status:', e);
    } finally {
      setIsLoadingBackup(false);
    }
  };

  const handleTriggerBackup = async () => {
    if (!token) return;
    setIsTriggeringBackup(true);
    try {
      const res = await fetch(`${API_URL}/admin/backup/trigger`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        triggerToast('地圖備份程序已成功發起！', 'success');
        setTimeout(() => fetchBackupStatus(), 3000);
      } else {
        triggerToast(data.message || '備份觸發失敗', 'error');
      }
    } catch (e: any) {
      triggerToast('請求失敗：' + e.message, 'error');
    } finally {
      setIsTriggeringBackup(false);
    }
  };

  const handleGiveMoney = async () => {
    if (!searchedProfile || !giveAmount || !token) return;
    const amount = parseFloat(giveAmount);
    if (isNaN(amount) || amount <= 0) {
      triggerToast('請輸入有效的金幣金額！', 'error');
      return;
    }
    setIsGivingMoney(true);
    try {
      const res = await fetch(`${API_URL}/admin/give-money`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username: searchedProfile.mc_username, amount })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(data.message || `已成功發送 $${amount} 金幣！`, 'success');
        setSearchedProfile(prev => prev ? { ...prev, balance: prev.balance + amount } : null);
        setGiveAmount('');
      } else {
        triggerToast(data.message || '金幣發放失敗', 'error');
      }
    } catch (err: any) {
      triggerToast('請求失敗：' + err.message, 'error');
    } finally {
      setIsGivingMoney(false);
    }
  };

  const handleGiveKeys = async () => {
    if (!searchedProfile || !giveKeys || !token) return;
    const amount = parseInt(giveKeys, 10);
    if (isNaN(amount) || amount <= 0) {
      triggerToast('請輸入有效的鑰匙數量！', 'error');
      return;
    }
    setIsGivingKeys(true);
    try {
      const res = await fetch(`${API_URL}/admin/give-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username: searchedProfile.mc_username, amount })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(data.message || `已成功發送 ${amount} 把抽獎鑰匙！`, 'success');
        setSearchedProfile(prev => prev ? { ...prev, keys_count: prev.keys_count + amount } : null);
        setGiveKeys('');
      } else {
        triggerToast(data.message || '鑰匙發放失敗', 'error');
      }
    } catch (err: any) {
      triggerToast('請求失敗：' + err.message, 'error');
    } finally {
      setIsGivingKeys(false);
    }
  };

  // Transaction Log Inspector States
  const [txSearch, setTxSearch] = useState('');
  const [txList, setTxList] = useState<any[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [isLoadingTx, setIsLoadingTx] = useState(false);

  const fetchAdminTransactions = async (page = 1, search = '') => {
    if (!token) return;
    setIsLoadingTx(true);
    try {
      const res = await fetch(`${API_URL}/admin/transactions?page=${page}&limit=50&search=${encodeURIComponent(search)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setTxList(data.transactions || []);
        setTxTotal(data.total || 0);
        setTxPage(data.page || 1);
      }
    } catch (e: any) {
      triggerToast('載入交易日誌失敗：' + e.message, 'error');
    } finally {
      setIsLoadingTx(false);
    }
  };

  // Ticket Backup Archive States
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketList, setTicketList] = useState<any[]>([]);
  const [ticketTotal, setTicketTotal] = useState(0);
  const [ticketPage, setTicketPage] = useState(1);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);

  const fetchAdminTickets = async (page = 1, search = '') => {
    if (!token) return;
    setIsLoadingTickets(true);
    try {
      const res = await fetch(`${API_URL}/admin/tickets?page=${page}&limit=50&search=${encodeURIComponent(search)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setTicketList(data.tickets || []);
        setTicketTotal(data.total || 0);
        setTicketPage(data.page || 1);
      }
    } catch (e: any) {
      triggerToast('載入客服單歷史紀錄失敗：' + e.message, 'error');
    } finally {
      setIsLoadingTickets(false);
    }
  };

  const fetchTicketDetails = async (ticketId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/admin/tickets/${encodeURIComponent(ticketId)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.ticket) {
        setSelectedTicket(data.ticket);
        setIsTicketModalOpen(true);
      } else {
        triggerToast(data.message || '無法讀取該客服單詳情', 'error');
      }
    } catch (e: any) {
      triggerToast('讀取客服單對話失敗：' + e.message, 'error');
    }
  };

  const fetchPlayerTitle = async (username: string) => {
    try {
      const res = await fetch(`${API_URL}/titles`);
      const data = await res.json();
      if (data.success && data.titles && data.titles[username.toLowerCase()]) {
        const t = data.titles[username.toLowerCase()];
        setTitleText(t.title_text || '');
        setTitleColor(t.color_code || '§c');
        setTitleBold(t.is_bold ?? true);
      } else {
        setTitleText('');
        setTitleColor('§c');
        setTitleBold(true);
      }
    } catch (e) {}
  };

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
        fetchPlayerTitle(searchQuery.trim());
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

  const handleSaveTitle = async () => {
    if (!searchedProfile || !token) return;
    setIsSavingTitle(true);
    try {
      const res = await fetch(`${API_URL}/admin/titles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: searchedProfile.mc_username,
          title_text: titleText.trim(),
          color_code: titleColor,
          is_bold: titleBold
        })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(data.message || '稱號設定成功！', 'success');
      } else {
        triggerToast(data.message || '稱號設定失敗', 'error');
      }
    } catch (err: any) {
      triggerToast('請求失敗：' + err.message, 'error');
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleClearTitle = async () => {
    if (!searchedProfile || !token) return;
    setIsSavingTitle(true);
    try {
      const res = await fetch(`${API_URL}/admin/titles/${searchedProfile.mc_username}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setTitleText('');
        triggerToast(data.message || '稱號已清除！', 'success');
      } else {
        triggerToast(data.message || '清除失敗', 'error');
      }
    } catch (err: any) {
      triggerToast('請求失敗：' + err.message, 'error');
    } finally {
      setIsSavingTitle(false);
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
          <button
            onClick={() => {
              setActiveSubTab('transactions');
              fetchAdminTransactions(1, '');
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'transactions' 
                ? 'bg-card text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            📜 玩家交易日誌
          </button>
          <button
            onClick={() => {
              setActiveSubTab('tickets');
              fetchAdminTickets(1, '');
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'tickets' 
                ? 'bg-card text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            🎫 客服單歷史備份
          </button>
          <button
            onClick={() => {
              setActiveSubTab('backup');
              fetchBackupStatus();
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'backup' 
                ? 'bg-card text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            💾 地圖自動備份
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

                {/* 💵 管理員直充發放金幣與鑰匙專區 */}
                <div className="mt-6 border-t border-border pt-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    <h4 className="text-xs font-bold text-foreground">💵 管理員發送金幣與抽獎鑰匙 (Direct Top-up: Money & Keys)</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/20 border border-border p-4 rounded-lg">
                    {/* 發送金幣 */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-muted-foreground block">給予金幣金額 ($)</label>
                      <div className="flex items-center space-x-2">
                        <Input 
                          type="number"
                          value={giveAmount}
                          onChange={(e) => setGiveAmount(e.target.value)}
                          placeholder="輸入金額 (例如: 10000)"
                          className="h-9 text-xs font-bold font-mono"
                        />
                        <Button 
                          onClick={handleGiveMoney}
                          disabled={isGivingMoney || !giveAmount || parseFloat(giveAmount) <= 0}
                          size="sm"
                          className="h-9 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                        >
                          <Coins className="w-3.5 h-3.5 mr-1" />
                          {isGivingMoney ? '發送中...' : '💰 給予金幣'}
                        </Button>
                      </div>
                    </div>

                    {/* 發送鑰匙 */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-muted-foreground block">給予抽獎鑰匙數量 (把)</label>
                      <div className="flex items-center space-x-2">
                        <Input 
                          type="number"
                          value={giveKeys}
                          onChange={(e) => setGiveKeys(e.target.value)}
                          placeholder="輸入數量 (例如: 5)"
                          className="h-9 text-xs font-bold font-mono"
                        />
                        <Button 
                          onClick={handleGiveKeys}
                          disabled={isGivingKeys || !giveKeys || parseInt(giveKeys, 10) <= 0}
                          size="sm"
                          className="h-9 px-4 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shrink-0"
                        >
                          <Key className="w-3.5 h-3.5 mr-1" />
                          {isGivingKeys ? '發送中...' : '🔑 給予鑰匙'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 👑 專屬頭銜與顏色管理專區 */}
                <div className="mt-6 border-t border-border pt-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <h4 className="text-xs font-bold text-foreground">👑 專屬頭銜與色彩管理 (Title & Color Customizer)</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/20 border border-border p-4 rounded-lg">
                    {/* 輸入與色彩盤 */}
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground block mb-1">稱號內容 (如 [服主]、[VIP]、[戰神])</label>
                        <Input 
                          value={titleText}
                          onChange={(e) => setTitleText(e.target.value)}
                          placeholder="例如: [服主]"
                          className="h-9 text-xs font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground block mb-1 font-sans">選擇顯示色彩 (Color Code)</label>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { code: '§c', label: '鮮紅', bg: 'bg-red-500' },
                            { code: '§6', label: '橙金', bg: 'bg-orange-500' },
                            { code: '§e', label: '亮黃', bg: 'bg-yellow-500' },
                            { code: '§a', label: '翡翠綠', bg: 'bg-emerald-500' },
                            { code: '§b', label: '青藍', bg: 'bg-cyan-500' },
                            { code: '§d', label: '炫彩紫', bg: 'bg-purple-500' },
                            { code: '§f', label: '純白', bg: 'bg-slate-200' },
                          ].map(c => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => setTitleColor(c.code)}
                              className={`px-2 py-1 text-[10px] font-bold rounded-[3px] border transition-all flex items-center space-x-1 ${
                                titleColor === c.code 
                                  ? 'border-primary ring-2 ring-primary/40 shadow-sm bg-primary/10' 
                                  : 'border-border opacity-70 hover:opacity-100 bg-card'
                              }`}
                            >
                              <span className={`w-2.5 h-2.5 rounded-full ${c.bg}`}></span>
                              <span>{c.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 pt-1">
                        <input 
                          type="checkbox"
                          id="titleBoldCheck"
                          checked={titleBold}
                          onChange={(e) => setTitleBold(e.target.checked)}
                          className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                        />
                        <label htmlFor="titleBoldCheck" className="text-xs font-bold cursor-pointer select-none text-foreground">
                          開啟加粗效果 (§l Bold)
                        </label>
                      </div>
                    </div>

                    {/* 即時視覺預覽與按鈕 */}
                    <div className="flex flex-col justify-between space-y-3 border-t md:border-t-0 md:border-l border-border pt-3 md:pt-0 md:pl-4">
                      <div>
                        <span className="text-[10px] font-bold text-muted-foreground block mb-1">🎮 遊戲內與網頁即時渲染預覽</span>
                        <div className="p-3 bg-slate-950 border border-slate-800 rounded-md font-mono text-sm flex items-center space-x-2">
                          <span className={`${COLOR_MAP[titleColor] || 'text-red-500'} ${titleBold ? 'font-bold' : 'font-normal'}`}>
                            {titleText ? (titleText.startsWith('[') ? titleText : `[${titleText}]`) : '[頭銜]'}
                          </span>
                          <span className="text-slate-100">{searchedProfile.mc_username}</span>
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-1.5">
                          儲存後即時生效於玩家頭頂 DisplayName、聊天頻道、Tab 清單及個人面板。
                        </p>
                      </div>

                      <div className="flex items-center space-x-2 pt-2">
                        <Button
                          onClick={handleSaveTitle}
                          disabled={isSavingTitle}
                          size="sm"
                          className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-9"
                        >
                          {isSavingTitle ? '儲存中...' : '💾 儲存並發送稱號'}
                        </Button>
                        <Button
                          onClick={handleClearTitle}
                          disabled={isSavingTitle}
                          size="sm"
                          variant="outline"
                          className="border-red-500/30 text-red-500 hover:bg-red-500/10 font-bold text-xs h-9"
                        >
                          🗑️ 清除稱號
                        </Button>
                      </div>
                    </div>
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

      {/* 4. 子分頁 D: 📜 玩家交易日誌查詢器 (Transaction Log Inspector) */}
      {activeSubTab === 'transactions' && (
        <Card className="bg-card border-border shadow-sm animate-fade-in">
          <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xs font-bold flex items-center space-x-2 text-emerald-500">
                <FileText className="w-4 h-4" />
                <span>📜 玩家交易日誌與商業流水查詢器 (Transaction Inspector)</span>
              </CardTitle>
              <CardDescription className="text-[11px]">
                即時調閱全服 ChestShop 商店交易、玩家間轉帳與市場購買日誌。
              </CardDescription>
            </div>
            <span className="px-2.5 py-1 text-[11px] font-bold rounded border text-emerald-500 border-emerald-500/30 bg-emerald-500/10 font-mono">
              共計 {txTotal} 筆交易紀錄
            </span>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* 搜尋過濾 Bar */}
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                <Input
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchAdminTransactions(1, txSearch)}
                  placeholder="搜尋買家、賣家帳號、物品名稱或座標 (按 Enter 搜尋)..."
                  className="pl-9 h-9 text-xs font-medium"
                />
              </div>
              <Button 
                onClick={() => fetchAdminTransactions(1, txSearch)}
                disabled={isLoadingTx}
                size="sm"
                className="h-9 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isLoadingTx ? '搜尋中...' : '🔍 查詢交易'}
              </Button>
            </div>

            {/* 交易列表 Table */}
            <div className="border border-border rounded-lg overflow-hidden bg-background/50">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b border-border text-[10px] uppercase font-bold text-muted-foreground">
                    <tr>
                      <th className="p-3">ID</th>
                      <th className="p-3">時間 (Timestamp)</th>
                      <th className="p-3">買家 (Buyer)</th>
                      <th className="p-3">賣家 (Seller)</th>
                      <th className="p-3">交易物品 (Item)</th>
                      <th className="p-3 text-right">數量</th>
                      <th className="p-3 text-right">單價</th>
                      <th className="p-3 text-right">稅金扣除</th>
                      <th className="p-3 text-right">賣家淨收</th>
                      <th className="p-3 text-center">商店座標</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {isLoadingTx ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-muted-foreground text-xs font-medium">
                          資料載入中...
                        </td>
                      </tr>
                    ) : txList.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-muted-foreground text-xs font-medium">
                          尚無符合條件的交易紀錄。
                        </td>
                      </tr>
                    ) : (
                      txList.map((tx: any) => (
                        <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-mono text-[11px] text-muted-foreground">#{tx.id}</td>
                          <td className="p-3 text-[11px] font-mono whitespace-nowrap">{tx.timestamp}</td>
                          <td className="p-3 font-bold text-emerald-500">{tx.buyer || '系統/匿名'}</td>
                          <td className="p-3 font-bold text-cyan-500">{tx.seller || '系統/收購商'}</td>
                          <td className="p-3 font-bold">
                            <span className="bg-muted px-2 py-0.5 rounded text-[11px] font-mono">
                              {tx.item}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold">x{tx.quantity}</td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-500">${tx.unit_price}</td>
                          <td className="p-3 text-right font-mono text-xs text-amber-500">${tx.tax_deducted || 0}</td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-400">${tx.net_profit || (tx.quantity * tx.unit_price)}</td>
                          <td className="p-3 text-center font-mono text-[11px] text-muted-foreground">{tx.shop_coords || 'N/A'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 分頁按鈕 Bar */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-muted-foreground font-mono">
                顯示第 {(txPage - 1) * 50 + 1} ~ {Math.min(txPage * 50, txTotal)} 筆，共 {txTotal} 筆
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => fetchAdminTransactions(txPage - 1, txSearch)}
                  disabled={txPage <= 1 || isLoadingTx}
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-bold"
                >
                  ◀ 上一頁
                </Button>
                <span className="text-xs font-bold px-2">第 {txPage} 頁</span>
                <Button
                  onClick={() => fetchAdminTransactions(txPage + 1, txSearch)}
                  disabled={txPage * 50 >= txTotal || isLoadingTx}
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-bold"
                >
                  下一頁 ▶
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. 子分頁 E: 🎫 客服單歷史備份 (Ticket Archives) */}
      {activeSubTab === 'tickets' && (
        <Card className="bg-card border-border shadow-sm animate-fade-in">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xs font-bold flex items-center space-x-2">
                  <LifeBuoy className="w-4 h-4 text-indigo-400" />
                  <span>客服單歷史備份與對話稽核 (Ticket Transcript Archives)</span>
                </CardTitle>
                <CardDescription className="text-[11px] mt-1">
                  僅提供管理員查核已關閉 (Closed) 之客服單歷史紀錄，點選客服單即可開窗閱讀完整對話內容。
                </CardDescription>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); fetchAdminTickets(1, ticketSearch); }} className="flex gap-2">
                <Input 
                  placeholder="搜尋單號 / 玩家 / 結單管理員..." 
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  className="h-9 text-xs w-64 font-bold"
                />
                <Button type="submit" size="sm" className="h-9 px-4 text-xs font-bold shrink-0">
                  <Search className="w-3.5 h-3.5 mr-1" />
                  搜尋
                </Button>
              </form>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border text-[11px] font-bold text-muted-foreground uppercase">
                      <th className="p-3">客服單號</th>
                      <th className="p-3">頻道名稱</th>
                      <th className="p-3">開單玩家</th>
                      <th className="p-3">結單管理員</th>
                      <th className="p-3">關閉時間</th>
                      <th className="p-3 text-center font-sans">對話檔案動作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs font-sans">
                    {isLoadingTickets ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground text-xs">
                          載入客服單紀錄中...
                        </td>
                      </tr>
                    ) : ticketList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground text-xs">
                          尚無已關閉的客服單紀錄。
                        </td>
                      </tr>
                    ) : (
                      ticketList.map((tk: any) => (
                        <tr key={tk.ticket_id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-mono font-bold text-indigo-400">#{tk.ticket_id}</td>
                          <td className="p-3 font-mono text-[11px] text-muted-foreground">{tk.channel_name || tk.channel_id}</td>
                          <td className="p-3 font-bold text-foreground">{tk.creator_username || tk.creator_id}</td>
                          <td className="p-3 font-bold text-emerald-400">{tk.closed_by || '系統關閉'}</td>
                          <td className="p-3 font-mono text-[11px] text-muted-foreground">{tk.closed_at || tk.created_at}</td>
                          <td className="p-3 text-center">
                            <Button
                              onClick={() => fetchTicketDetails(tk.ticket_id)}
                              size="sm"
                              variant="outline"
                              className="h-7 px-3 text-xs font-bold border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
                            >
                              <MessageSquare className="w-3.5 h-3.5 mr-1" />
                              查看對話內容
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 分頁列 */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-muted-foreground font-mono">
                顯示第 {(ticketPage - 1) * 50 + 1} ~ {Math.min(ticketPage * 50, ticketTotal)} 筆，共 {ticketTotal} 筆
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => fetchAdminTickets(ticketPage - 1, ticketSearch)}
                  disabled={ticketPage <= 1 || isLoadingTickets}
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-bold"
                >
                  ◀ 上一頁
                </Button>
                <span className="text-xs font-bold px-2">第 {ticketPage} 頁</span>
                <Button
                  onClick={() => fetchAdminTickets(ticketPage + 1, ticketSearch)}
                  disabled={ticketPage * 50 >= ticketTotal || isLoadingTickets}
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-bold"
                >
                  下一頁 ▶
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 6. 子分頁 F: 💾 地圖自動備份與 100GB 容量防護 */}
      {activeSubTab === 'backup' && (
        <div className="space-y-6 animate-fade-in">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-sm font-bold flex items-center space-x-2">
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                  <span>伺服器地圖 7z 高壓縮自動備份系統</span>
                </CardTitle>
                <CardDescription className="text-[11px] mt-0.5">
                  系統每 3 小時自動以 7z 高壓縮打包 world/ 地圖，寫入伺服器根目錄 backups/，並實施 100GB 容量上限自動維護。
                </CardDescription>
              </div>

              <div className="flex items-center space-x-2">
                <Button 
                  onClick={fetchBackupStatus} 
                  variant="outline" 
                  size="sm" 
                  disabled={isLoadingBackup}
                  className="h-8 text-xs font-bold"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoadingBackup ? 'animate-spin' : ''}`} />
                  重新整理
                </Button>
                <Button 
                  onClick={handleTriggerBackup} 
                  disabled={isTriggeringBackup || backupStats?.is_backing_up}
                  className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <HardDrive className="w-3.5 h-3.5 mr-1" />
                  {backupStats?.is_backing_up ? '備份執行中...' : isTriggeringBackup ? '觸發中...' : '⚡ 立即手動備份'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* 容量狀態條 */}
              {backupStats && (
                <div className="bg-muted/30 border border-border p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center text-foreground">
                      <span>儲存空間使用率 (容量上限 100 GB)</span>
                    </span>
                    <span className="font-mono text-emerald-400">
                      {(backupStats.total_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB / 100.00 GB 
                      ({((backupStats.total_bytes / (100 * 1024 * 1024 * 1024)) * 100).toFixed(1)}%)
                    </span>
                  </div>

                  <div className="w-full h-3 bg-muted rounded-full overflow-hidden border border-border">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        (backupStats.total_bytes / (100 * 1024 * 1024 * 1024)) > 0.85 
                          ? 'bg-rose-500' 
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, (backupStats.total_bytes / (100 * 1024 * 1024 * 1024)) * 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <span>📦 已歸檔備份檔總數：<strong className="text-foreground font-mono">{backupStats.count}</strong> 個檔案</span>
                    <span>⏳ 定期循環：每 3 小時 (180 分鐘)</span>
                  </div>
                </div>
              )}

              {/* 備份檔案列表 */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  已歸檔地圖備份清單 ({backupStats?.files?.length || 0})
                </h4>

                {backupStats?.files && backupStats.files.length > 0 ? (
                  <div className="border border-border rounded-lg overflow-hidden divide-y divide-border bg-card">
                    {backupStats.files.map((file, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between hover:bg-muted/40 transition-colors">
                        <div className="flex items-center space-x-3">
                          <HardDrive className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div>
                            <p className="text-xs font-bold font-mono text-foreground">{file.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              時間：{new Date(file.last_modified).toLocaleString('zh-TW')}
                            </p>
                          </div>
                        </div>

                        <div className="text-right font-mono text-xs font-bold text-foreground">
                          {(file.size_bytes / (1024 * 1024)).toFixed(1)} MB
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 border border-dashed border-border rounded-lg text-muted-foreground text-xs">
                    目前尚未產生備份檔案（備份檔將於觸發後儲存至 backups/ 目錄）
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 客服單對話歷史美化對話框 (Ticket Transcript Modal) */}
      <Dialog open={isTicketModalOpen} onOpenChange={setIsTicketModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col bg-card border-border text-foreground p-0 overflow-hidden shadow-2xl rounded-xl">
          <DialogHeader className="p-4 border-b border-border bg-muted/40 text-left">
            <DialogTitle className="text-sm font-black flex items-center justify-between">
              <div className="flex items-center space-x-2 text-indigo-400">
                <MessageSquare className="w-4 h-4" />
                <span>客服單對話紀錄 #{selectedTicket?.ticket_id}</span>
              </div>
              <span className="text-xs font-normal text-muted-foreground font-mono">
                頻道: {selectedTicket?.channel_name || selectedTicket?.channel_id}
              </span>
            </DialogTitle>
            <DialogDescription className="text-[11px] text-muted-foreground flex flex-wrap gap-4 mt-2 font-sans">
              <span>開單玩家: <strong className="text-indigo-400">{selectedTicket?.creator_username || selectedTicket?.creator_id}</strong></span>
              <span>結單管理員: <strong className="text-emerald-400">{selectedTicket?.closed_by || '系統關閉'}</strong></span>
              <span>關閉時間: <strong className="font-mono">{selectedTicket?.closed_at}</strong></span>
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 overflow-y-auto space-y-3 max-h-[60vh] bg-muted/10 font-sans text-left">
            {selectedTicket?.transcript_json && selectedTicket.transcript_json.length > 0 ? (
              selectedTicket.transcript_json.map((msg: any, idx: number) => (
                <div key={msg.id || idx} className="flex items-start space-x-3 p-3 rounded-lg bg-card border border-border/60 shadow-sm">
                  <img 
                    src={msg.author_avatar || `https://mc-heads.net/avatar/${msg.author_name}/40`} 
                    alt={msg.author_name} 
                    className="w-8 h-8 rounded-full border border-border shrink-0 bg-muted"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-foreground">{msg.author_name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(msg.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/90 whitespace-pre-wrap mt-1 leading-relaxed">
                      {msg.content}
                    </p>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {msg.attachments.map((att: any, aIdx: number) => (
                          <a key={aIdx} href={att.url} target="_blank" rel="noreferrer" className="block group">
                            {att.contentType?.startsWith('image/') ? (
                              <img src={att.url} alt={att.name} className="max-w-xs max-h-48 rounded border border-border hover:opacity-90 transition-all shadow-sm" />
                            ) : (
                              <span className="inline-flex items-center text-xs text-indigo-400 underline font-bold bg-indigo-500/10 px-2 py-1 rounded">
                                📎 {att.name || '檢視附件'}
                              </span>
                            )}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/40 rounded border border-border">
                {selectedTicket?.transcript_text || '無對話記錄內容'}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
