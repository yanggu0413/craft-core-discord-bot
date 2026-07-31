import { useState } from 'react';
import { Shield, Search, User, Settings, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import PageHeader from '../ui/PageHeader';
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
  claims = [],
  username,
  handleUpdatePermission
}: ClaimsViewProps) {
  const [grantInputs, setGrantInputs] = useState<Record<string, string>>({});
  const [searchFilter, setSearchFilter] = useState('');
  const [adminViewMode, setAdminViewMode] = useState<'all' | 'mine'>('all');

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

      const res = await apiFetch(`/claims/${flagsModal.claimId}/flags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_containers: flagsModal.publicContainers,
          public_interact: flagsModal.publicInteract,
          public_entry: flagsModal.publicEntry,
          banned_players: bannedArray
        })
      });
      if (res.ok && res.data?.success) {
        setMsg({ type: 'success', text: '旗幟與權限設定儲存成功！' });
        setTimeout(() => setFlagsModal(prev => ({ ...prev, show: false })), 1000);
      } else {
        setMsg({ type: 'error', text: res.data?.message || '儲存失敗' });
      }
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || '連線失敗' });
    } finally {
      setSavingFlags(false);
    }
  };

  const myClaims = (claims || []).filter(c => c && (c.owner || '').toLowerCase() === (username || '').toLowerCase());
  const displayClaims = (claims || []).filter(c => {
    if (!c) return false;
    if (adminViewMode === 'mine' && username) {
      if ((c.owner || '').toLowerCase() !== username.toLowerCase()) return false;
    }
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const matchName = (c.name || '').toLowerCase().includes(q);
      const matchOwner = (c.owner || '').toLowerCase().includes(q);
      const matchId = (c.id || '').toLowerCase().includes(q);
      return matchName || matchOwner || matchId;
    }
    return true;
  });

  return (
    <div className="space-y-6 text-left">
      <PageHeader
        icon={Shield}
        title="領地安全管理"
        description="查看與設定個人劃分領地邊界、信任夥伴白名單與防護旗幟"
        badgeText={`${claims.length} 塊劃分領地`}
        badgeVariant="outline"
        kpis={[
          { label: "全服領地數", value: `${claims.length} 區`, icon: Shield },
          { label: "我的領地", value: `${myClaims.length} 區`, icon: User },
        ]}
      />

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-auto flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="搜尋領地名稱、領主或 ID..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <Button
              variant={adminViewMode === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAdminViewMode('all')}
              className="text-xs"
            >
              全部領地
            </Button>
            {username && (
              <Button
                variant={adminViewMode === 'mine' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAdminViewMode('mine')}
                className="text-xs"
              >
                我的領地 ({myClaims.length})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {displayClaims.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayClaims.map((claim) => {
            const isOwner = username && (claim.owner || '').toLowerCase() === username.toLowerCase();
            return (
              <Card key={claim.id} className="flex flex-col justify-between">
                <CardHeader className="pb-3 border-b border-border">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <CardTitle className="text-sm font-bold">{claim.name || claim.id}</CardTitle>
                        <Badge variant={isOwner ? "default" : "secondary"}>
                          {isOwner ? "擁有者" : claim.owner}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs font-mono">
                        區塊大小: {claim.chunks} 區塊 ({claim.dimension === 'minecraft:the_nether' ? '地獄' : claim.dimension === 'minecraft:the_end' ? '終界' : '主世界'})
                      </CardDescription>
                    </div>
                    {isOwner && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openFlagsModal(claim)}
                        className="text-xs"
                      >
                        <Settings className="w-3.5 h-3.5 mr-1" />
                        <span>權限旗幟</span>
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-3 text-xs">
                  <div className="space-y-1.5">
                    <p className="font-semibold text-foreground flex items-center justify-between">
                      <span>信任建造權限</span>
                      <span className="font-mono text-muted-foreground text-[11px]">({claim.permissions?.build?.length || 0} 人)</span>
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(claim.permissions?.build || []).map(p => (
                        <Badge key={p} variant="outline" className="text-[10px]">
                          {p}
                          {isOwner && (
                            <button
                              onClick={() => handleUpdatePermission(claim.id, 'build', p, 'revoke')}
                              className="ml-1 text-muted-foreground hover:text-destructive cursor-pointer"
                            >
                              ×
                            </button>
                          )}
                        </Badge>
                      ))}
                    </div>
                    {isOwner && (
                      <div className="flex items-center space-x-2 pt-1">
                        <Input
                          type="text"
                          placeholder="新增玩家名稱..."
                          value={grantInputs[`${claim.id}-build`] || ''}
                          onChange={(e) => handleInputChange(`${claim.id}-build`, e.target.value)}
                          className="text-xs h-7"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => submitGrant(claim.id, 'build')}
                          className="h-7 text-xs px-2 shrink-0"
                        >
                          <Plus className="w-3 h-3 mr-0.5" /> 新增
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="py-12">
          <CardContent className="text-center space-y-2">
            <Shield className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-bold text-foreground">找不到符合條件的劃分領地</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={flagsModal.show} onOpenChange={(open) => !open && setFlagsModal(prev => ({ ...prev, show: false }))}>
        <DialogContent className="sm:max-w-md text-left">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">領地防護旗幟與門禁控制</DialogTitle>
            <DialogDescription className="text-xs">
              調整領地【{flagsModal.claimName}】的公共互動開關與黑名單。
            </DialogDescription>
          </DialogHeader>

          {msg && (
            <div className={`p-2.5 rounded text-xs ${msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
              {msg.text}
            </div>
          )}

          <div className="space-y-3 py-2 text-xs">
            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={flagsModal.publicContainers}
                onChange={(e) => setFlagsModal(prev => ({ ...prev, publicContainers: e.target.checked }))}
                className="rounded border-border"
              />
              <span>開放公共箱子存取</span>
            </label>
            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={flagsModal.publicInteract}
                onChange={(e) => setFlagsModal(prev => ({ ...prev, publicInteract: e.target.checked }))}
                className="rounded border-border"
              />
              <span>開放公共開關與門互動</span>
            </label>

            <div className="space-y-1 pt-2">
              <label className="font-semibold text-foreground">黑名單玩家 (逗號分隔):</label>
              <Input
                type="text"
                value={flagsModal.bannedPlayersText}
                onChange={(e) => setFlagsModal(prev => ({ ...prev, bannedPlayersText: e.target.value }))}
                placeholder="輸入黑名單玩家名稱..."
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFlagsModal(prev => ({ ...prev, show: false }))}
              className="text-xs"
            >
              取消
            </Button>
            <Button
              size="sm"
              onClick={handleSaveFlags}
              disabled={savingFlags}
              className="text-xs"
            >
              {savingFlags ? '儲存中...' : '儲存設定'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
