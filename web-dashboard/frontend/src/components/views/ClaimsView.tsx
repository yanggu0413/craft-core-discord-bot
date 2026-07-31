import { useState } from 'react';
import { Shield, Search, User, MapPin, Settings, UserX, Package, MousePointer, DoorOpen } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { apiFetch } from '../../lib/api';

interface Claim {
  id: string;
  name: string;
  owner: string;
  dimension: string;
  chunks: number;
  corners: string[];
  permissions: {
    build: string[];
    break: string[];
    containers: string[];
    interact: string[];
  };
  public_containers?: boolean;
  public_interact?: boolean;
  public_entry?: boolean;
  banned_players?: string[];
}

interface ClaimsViewProps {
  claims: Claim[];
  username: string | null;
  isAdmin?: boolean;
  handleUpdatePermission: (claimId: string, permissionType: string, player: string, action: 'grant' | 'revoke') => Promise<void>;
}

export default function ClaimsView({
  claims,
  username,
  isAdmin = false,
  handleUpdatePermission
}: ClaimsViewProps) {
  const [grantInputs, setGrantInputs] = useState<Record<string, string>>({});
  const [searchFilter, setSearchFilter] = useState('');
  const [adminViewMode, setAdminViewMode] = useState<'all' | 'mine'>('all');

  // Flags Modal State
  const [flagsModal, setFlagsModal] = useState<{
    show: boolean;
    claimId: string;
    claimName: string;
    publicContainers: boolean;
    publicInteract: boolean;
    publicEntry: boolean;
    bannedPlayersText: string;
  }>({
    show: false,
    claimId: '',
    claimName: '',
    publicContainers: false,
    publicInteract: false,
    publicEntry: true,
    bannedPlayersText: ''
  });
  const [savingFlags, setSavingFlags] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleInputChange = (key: string, val: string) => {
    setGrantInputs(prev => ({ ...prev, [key]: val }));
  };

  const submitGrant = async (claimId: string, permType: string) => {
    const inputKey = `${claimId}-${permType}`;
    const targetPlayer = grantInputs[inputKey];
    if (!targetPlayer || !targetPlayer.trim()) return;

    await handleUpdatePermission(claimId, permType, targetPlayer.trim(), 'grant');
    setGrantInputs(prev => ({ ...prev, [inputKey]: '' }));
  };

  const openFlagsModal = (claim: Claim) => {
    setFlagsModal({
      show: true,
      claimId: claim.id,
      claimName: claim.name,
      publicContainers: Boolean(claim.public_containers),
      publicInteract: Boolean(claim.public_interact),
      publicEntry: claim.public_entry !== undefined ? Boolean(claim.public_entry) : true,
      bannedPlayersText: Array.isArray(claim.banned_players) ? claim.banned_players.join(', ') : ''
    });
    setMsg(null);
  };

  const handleSaveFlags = async () => {
    setSavingFlags(true);
    setMsg(null);
    try {
      const bannedArray = flagsModal.bannedPlayersText
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const res = await apiFetch('/claims/flags', {
        method: 'POST',
        body: JSON.stringify({
          claim_id: flagsModal.claimId,
          public_containers: flagsModal.publicContainers,
          public_interact: flagsModal.publicInteract,
          public_entry: flagsModal.publicEntry,
          banned_players: bannedArray
        })
      });

      if (res.ok && res.data?.success) {
        setMsg({ type: 'success', text: res.data.message || '領地權限標籤已更新成功！' });
        setTimeout(() => {
          setFlagsModal(prev => ({ ...prev, show: false }));
        }, 1200);
      } else {
        setMsg({ type: 'error', text: res.data?.message || '更新失敗' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: '網路連線失敗' });
    } finally {
      setSavingFlags(false);
    }
  };

  // Filter claims based on admin mode and search input
  const filteredClaims = claims.filter(claim => {
    const matchesSearch = 
      claim.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      claim.owner.toLowerCase().includes(searchFilter.toLowerCase()) ||
      claim.id.toLowerCase().includes(searchFilter.toLowerCase());

    if (!isAdmin) return matchesSearch && claim.owner.toLowerCase() === username?.toLowerCase();
    if (adminViewMode === 'mine') return matchesSearch && claim.owner.toLowerCase() === username?.toLowerCase();
    return matchesSearch;
  });

  return (
    <div className="space-y-6 text-left">
      {/* 頁面標題與管理員切換 */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold tracking-wider uppercase text-foreground flex items-center space-x-2">
            <Shield className="w-5 h-5 text-primary" />
            <span>領地管理系統 {isAdmin && <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-bold ml-2">管理員檢視模式</span>}</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            檢視並設定保護領地內的權限，包含建造、破壞、容器開啟、方塊互動與全域權限標籤。{isAdmin && '（管理員可檢視與維護全服所有玩家之領地）'}
          </p>
        </div>

        {/* 管理員開關與搜尋過濾 */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {isAdmin && (
            <div className="flex items-center space-x-1 bg-muted p-1 rounded-lg border border-border shrink-0">
              <button
                onClick={() => setAdminViewMode('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  adminViewMode === 'all' 
                    ? 'bg-card text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                全服所有領地 ({claims.length})
              </button>
              <button
                onClick={() => setAdminViewMode('mine')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  adminViewMode === 'mine' 
                    ? 'bg-card text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                我的領地 ({claims.filter(c => c.owner.toLowerCase() === username?.toLowerCase()).length})
              </button>
            </div>
          )}

          <div className="relative flex-1 md:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              placeholder="過濾玩家名稱或領地名稱..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="h-8 text-xs pl-9"
            />
          </div>
        </div>
      </div>

      {/* 領地列表 */}
      <div className="grid grid-cols-1 gap-4">
        {filteredClaims.map((claim) => {
          const isOwner = claim.owner.toLowerCase() === username?.toLowerCase();
          const canManage = isOwner || isAdmin;

          return (
            <Card key={claim.id} className={`transition-colors ${isOwner ? 'border-primary/40 bg-card' : 'border-border bg-card/80'}`}>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
                <div className="text-left space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <CardTitle className="text-sm font-bold text-foreground">{claim.name}</CardTitle>
                    {isOwner ? (
                      <span className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded">
                        您的個人領地
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-muted border border-border text-muted-foreground px-2 py-0.5 rounded flex items-center space-x-1">
                        <User className="w-3 h-3 mr-1" />
                        <span>擁有者：{claim.owner}</span>
                      </span>
                    )}
                  </div>
                  <CardDescription className="text-[11px] flex flex-wrap items-center gap-2">
                    <span>編號：<span className="font-mono">{claim.id}</span></span>
                    <span>•</span>
                    <span className="flex items-center">
                      <img 
                        src={`https://mc-heads.net/avatar/${claim.owner}/16`} 
                        alt={claim.owner}
                        className="w-4 h-4 rounded-[2px] border border-border mr-1 inline"
                      />
                      擁有者：<span className="font-bold text-foreground">{claim.owner}</span>
                    </span>
                    <span>•</span>
                    <span>分區：<span className="font-mono">{claim.dimension}</span></span>
                  </CardDescription>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <span className="text-[10px] font-bold bg-muted border border-border px-2.5 py-1 rounded text-foreground">
                    領地面積：{claim.chunks} 個區塊
                  </span>
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openFlagsModal(claim)}
                      className="h-8 text-xs font-bold gap-1.5 border-primary/30 hover:border-primary"
                    >
                      <Settings className="w-3.5 h-3.5 text-primary" />
                      全域標籤與黑名單
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4 text-left">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* 角落座標 */}
                  <div className="md:col-span-4 space-y-2">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>角落邊界座標</span>
                    </h4>
                    <div className="bg-muted/30 border border-border p-3 rounded-lg space-y-1.5 font-mono text-[11px] text-foreground">
                      <p className="text-muted-foreground">對角 A：<span className="text-foreground font-bold">{claim.corners[0] || 'N/A'}</span></p>
                      <p className="text-muted-foreground">對角 B：<span className="text-foreground font-bold">{claim.corners[1] || 'N/A'}</span></p>
                    </div>
                  </div>

                  {/* 權限設定 */}
                  <div className="md:col-span-8 space-y-4">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                      <span>權限授權清單 {canManage && !isOwner && <span className="text-amber-500 font-bold">（管理員特權管理）</span>}</span>
                      {!canManage && <span className="text-[10px] text-muted-foreground italic">（僅限擁有者或 OP 修改）</span>}
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(['build', 'break', 'containers', 'interact'] as const).map((permType) => {
                        const permPlayers = claim.permissions?.[permType] || [];
                        const inputKey = `${claim.id}-${permType}`;
                        
                        return (
                          <div key={permType} className="bg-muted/20 border border-border p-3 rounded-lg space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className="text-foreground">
                                {permType === 'build' && '建造權限'}
                                {permType === 'break' && '破壞權限'}
                                {permType === 'containers' && '容器開關'}
                                {permType === 'interact' && '方塊互動'}
                              </span>
                              <span className="text-[9px] text-muted-foreground font-mono">{permPlayers.length} 位玩家</span>
                            </div>

                            <div className="flex flex-wrap gap-1.5 min-h-[28px] items-center">
                              {permPlayers.map((player) => (
                                <span key={player} className="inline-flex items-center space-x-1 bg-background border border-border px-2 py-0.5 rounded text-[10px] font-bold text-foreground">
                                  <span>{player}</span>
                                  {canManage && (
                                    <button
                                      onClick={() => handleUpdatePermission(claim.id, permType, player, 'revoke')}
                                      className="text-muted-foreground hover:text-destructive ml-1"
                                      title="移除權限"
                                    >
                                      ×
                                    </button>
                                  )}
                                </span>
                              ))}
                              {permPlayers.length === 0 && (
                                <span className="text-[10px] text-muted-foreground italic">尚無個人特許玩家</span>
                              )}
                            </div>

                            {canManage && (
                              <div className="flex items-center space-x-1 pt-1">
                                <Input
                                  placeholder="玩家名稱..."
                                  value={grantInputs[inputKey] || ''}
                                  onChange={(e) => handleInputChange(inputKey, e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && submitGrant(claim.id, permType)}
                                  className="h-7 text-[10px]"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => submitGrant(claim.id, permType)}
                                  className="h-7 px-2 text-[10px] font-bold shrink-0"
                                >
                                  新增
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredClaims.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-xs text-muted-foreground">
              找不到符合搜尋條件的保護領地
            </CardContent>
          </Card>
        )}
      </div>

      {/* 全域權限與黑名單 Modal */}
      <Dialog open={flagsModal.show} onOpenChange={(open) => !open && setFlagsModal(prev => ({ ...prev, show: false }))}>
        <DialogContent className="max-w-md p-6 bg-background border border-border text-foreground rounded-xl shadow-2xl">
          <DialogHeader className="text-left pb-2 border-b border-border">
            <DialogTitle className="text-sm font-bold flex items-center space-x-2 text-primary">
              <Settings className="w-4 h-4 text-primary" />
              <span>設定領地全域權限與黑名單 (領地: {flagsModal.claimName})</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              修改此領地的全域開放設定或禁止特定違規玩家進入。
            </DialogDescription>
          </DialogHeader>

          {msg && (
            <div className={`p-2.5 rounded text-xs font-bold ${
              msg.type === 'success' ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' : 'bg-red-500/15 text-red-500 border border-red-500/30'
            }`}>
              {msg.text}
            </div>
          )}

          <div className="space-y-4 pt-2">
            <div className="space-y-3 bg-muted/20 border border-border p-3.5 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Package className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-foreground">公開容器箱子 (Public Containers)</span>
                </div>
                <input
                  type="checkbox"
                  checked={flagsModal.publicContainers}
                  onChange={(e) => setFlagsModal(prev => ({ ...prev, publicContainers: e.target.checked }))}
                  className="rounded border-border text-primary"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MousePointer className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-bold text-foreground">公開方塊互動 (Public Interact)</span>
                </div>
                <input
                  type="checkbox"
                  checked={flagsModal.publicInteract}
                  onChange={(e) => setFlagsModal(prev => ({ ...prev, publicInteract: e.target.checked }))}
                  className="rounded border-border text-primary"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <DoorOpen className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-bold text-foreground">公開自由進出 (Public Entry)</span>
                </div>
                <input
                  type="checkbox"
                  checked={flagsModal.publicEntry}
                  onChange={(e) => setFlagsModal(prev => ({ ...prev, publicEntry: e.target.checked }))}
                  className="rounded border-border text-primary"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground flex items-center space-x-1.5">
                <UserX className="w-4 h-4 text-red-500" />
                <span>領地黑名單玩家 (Banned Players)</span>
              </label>
              <Input
                type="text"
                placeholder="輸入禁止進入的玩家 ID (多位玩家以逗號分隔，例: Steve, Alex)"
                value={flagsModal.bannedPlayersText}
                onChange={(e) => setFlagsModal(prev => ({ ...prev, bannedPlayersText: e.target.value }))}
                className="text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">列於黑名單的玩家踏入此領地將會被自動彈出推開。</p>
            </div>

            <DialogFooter className="pt-3 border-t border-border">
              <Button type="button" variant="ghost" size="sm" onClick={() => setFlagsModal(prev => ({ ...prev, show: false }))}>
                取消
              </Button>
              <Button type="button" disabled={savingFlags} onClick={handleSaveFlags} size="sm" className="font-bold">
                {savingFlags ? '儲存中...' : '儲存變更'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
