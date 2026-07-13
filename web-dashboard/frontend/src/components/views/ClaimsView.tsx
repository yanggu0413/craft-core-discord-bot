import { useState } from 'react';
import { Shield } from 'lucide-react';
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
  handleUpdatePermission: (claimId: string, permissionType: string, player: string, action: 'grant' | 'revoke') => Promise<void>;
}

export default function ClaimsView({
  claims,
  username,
  handleUpdatePermission
}: ClaimsViewProps) {
  const [grantInputs, setGrantInputs] = useState<Record<string, string>>({});

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

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-left">
        <h2 className="text-base font-bold tracking-wider uppercase text-foreground">領地管理系統</h2>
        <p className="text-xs text-muted-foreground">
          檢視並設定您與其他玩家在保護領地內的權限，包含建造、破壞、容器開啟與方塊互動權限。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {claims.map((claim) => {
          const isOwner = claim.owner.toLowerCase() === username?.toLowerCase();
          return (
            <Card key={claim.id}>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
                <div className="text-left space-y-1">
                  <CardTitle className="text-sm font-bold text-foreground">{claim.name}</CardTitle>
                  <CardDescription className="text-[11px]">
                    編號：{claim.id} | 擁有者：{claim.owner} | 世界分區：{claim.dimension}
                  </CardDescription>
                </div>
                <span className="text-[10px] font-bold bg-muted border border-border px-2.5 py-1 rounded-[2px] text-foreground">
                  領地面積：{claim.chunks} 個區塊
                </span>
              </CardHeader>
              <CardContent className="pt-4 text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 角落座標 */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">角落邊界座標</h4>
                    <div className="bg-muted/30 border border-border p-3 rounded-[4px] space-y-1 font-mono text-[11px] text-foreground">
                      <p>對角 A：{claim.corners[0]}</p>
                      <p>對角 B：{claim.corners[1]}</p>
                    </div>
                  </div>

                  {/* 權限設定 */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      權限設定（僅限領地擁有者修改）
                    </h4>
                    
                    {(['build', 'break', 'containers', 'interact'] as const).map((permType) => {
                      const permPlayers = claim.permissions?.[permType] || [];
                      const inputKey = `${claim.id}-${permType}`;
                      
                      return (
                        <div key={permType} className="bg-muted/20 border border-border p-3 rounded-[4px] space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-foreground">
                              {permType === 'build' && '建造權限'}
                              {permType === 'break' && '破壞權限'}
                              {permType === 'containers' && '容器權限'}
                              {permType === 'interact' && '互動權限'}
                            </span>
                            <span className="text-[9px] text-muted-foreground font-mono">{permPlayers.length} 位玩家</span>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {permPlayers.map((player) => (
                              <span key={player} className="bg-muted border border-border text-foreground text-[11px] px-2 py-0.5 rounded-[2px] flex items-center space-x-1">
                                <span>{player}</span>
                                {isOwner && (
                                  <button 
                                    onClick={() => handleUpdatePermission(claim.id, permType, player, 'revoke')}
                                    className="hover:text-red-500 transition-colors font-bold ml-1 text-xs cursor-pointer"
                                  >
                                    ×
                                  </button>
                                )}
                              </span>
                            ))}
                            {permPlayers.length === 0 && (
                              <span className="text-[11px] text-muted-foreground italic">目前無授權玩家（僅限領地擁有者可用）</span>
                            )}
                          </div>

                          {isOwner && (
                            <div className="flex space-x-2 pt-1">
                              <Input 
                                type="text" 
                                placeholder="輸入玩家名稱"
                                value={grantInputs[inputKey] || ''}
                                onChange={(e) => handleInputChange(inputKey, e.target.value)}
                                className="h-8 text-xs flex-grow"
                              />
                              <Button 
                                onClick={() => submitGrant(claim.id, permType)}
                                className="h-8 text-[11px] px-3 shrink-0"
                              >
                                新增授權
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {claims.length === 0 && (
          <Card className="py-12 border-dashed">
            <CardContent className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="bg-muted p-3 rounded-full">
                <Shield className="w-8 h-8 text-muted-foreground" />
              </div>
              <CardTitle className="text-base font-bold">目前沒有任何已建立的領地保護區</CardTitle>
              <CardDescription className="max-w-md">
                請在遊戲中手持「木鋤頭」分別滑鼠左鍵與右鍵點擊地面方塊以設定對角兩點，接著輸入指令「/claim」來建立領地保護區。建立完成後，領地資訊將會即時同步至此處。
              </CardDescription>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
