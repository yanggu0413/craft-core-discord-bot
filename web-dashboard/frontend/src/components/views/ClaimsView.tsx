import { useState } from 'react';
import { Shield, Search, User, MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

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
            <span>領地管理系統 {isAdmin && <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-bold ml-2">🛡️ 管理員檢視模式</span>}</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            檢視並設定保護領地內的權限，包含建造、破壞、容器開啟與方塊互動權限。{isAdmin && '（管理員可檢視與維護全服所有玩家之領地）'}
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
                🌐 全服所有領地 ({claims.length})
              </button>
              <button
                onClick={() => setAdminViewMode('mine')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  adminViewMode === 'mine' 
                    ? 'bg-card text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                👤 我的領地 ({claims.filter(c => c.owner.toLowerCase() === username?.toLowerCase()).length})
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
                                {permType === 'build' && '🏗️ 建造權限'}
                                {permType === 'break' && '⛏️ 破壞權限'}
                                {permType === 'containers' && '📦 容器開關'}
                                {permType === 'interact' && '🔘 方塊互動'}
                              </span>
                              <span className="text-[9px] text-muted-foreground font-mono">{permPlayers.length} 位玩家</span>
                            </div>

                            <div className="flex flex-wrap gap-1.5 min-h-[28px] items-center">
                              {permPlayers.map((player) => (
                                <span key={player} className="bg-muted border border-border text-foreground text-[11px] px-2 py-0.5 rounded flex items-center space-x-1">
                                  <span>{player}</span>
                                  {canManage && (
                                    <button 
                                      onClick={() => handleUpdatePermission(claim.id, permType, player, 'revoke')}
                                      className="hover:text-rose-500 transition-colors font-bold ml-1 text-xs cursor-pointer"
                                      title="收回權限"
                                    >
                                      ×
                                    </button>
                                  )}
                                </span>
                              ))}
                              {permPlayers.length === 0 && (
                                <span className="text-[10px] text-muted-foreground italic">無授權玩家</span>
                              )}
                            </div>

                            {canManage && (
                              <div className="flex space-x-1.5 pt-1">
                                <Input 
                                  type="text" 
                                  placeholder="玩家帳號..."
                                  value={grantInputs[inputKey] || ''}
                                  onChange={(e) => handleInputChange(inputKey, e.target.value)}
                                  className="h-7 text-xs flex-grow"
                                />
                                <Button 
                                  onClick={() => submitGrant(claim.id, permType)}
                                  size="sm"
                                  className="h-7 text-[10px] px-2.5 font-bold shrink-0"
                                >
                                  授權
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
          <Card className="py-12 border-dashed text-center">
            <CardContent className="flex flex-col items-center justify-center space-y-3">
              <Shield className="w-8 h-8 text-muted-foreground/50" />
              <CardTitle className="text-base font-bold">沒有符合條件的領地保護區</CardTitle>
              <CardDescription className="max-w-md text-xs">
                {searchFilter ? `沒有找到與「${searchFilter}」相關的領地。` : '伺服器中目前尚未建立任何保護領地。玩家可在遊戲中持木鋤點擊地面角落並輸入 /claim 來建立領地。'}
              </CardDescription>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
