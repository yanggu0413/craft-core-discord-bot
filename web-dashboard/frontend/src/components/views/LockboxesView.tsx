import { Lock, Key } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import PageHeader from '../ui/PageHeader';

interface Lockbox {
  id: string;
  location: string;
  owner: string;
  authorized: string[];
}

interface LockboxesViewProps {
  lockboxes: Lockbox[];
  onUpdateLockbox: (lockboxId: string, action: string, targetPlayer?: string, newPassword?: string) => Promise<void>;
  currentUser: string | null;
}

export default function LockboxesView({ lockboxes = [], onUpdateLockbox, currentUser }: LockboxesViewProps) {
  const myLockboxes = (lockboxes || []).filter(l => l && (l.owner || '').toLowerCase() === (currentUser || '').toLowerCase());

  return (
    <div className="space-y-6 text-left">
      <PageHeader
        icon={Lock}
        title="密碼鎖保險箱管理"
        description="管理已安裝保護鎖的實體寶箱，授權好朋友存取權限與更換密碼"
        badgeText={`${lockboxes.length} 個保險箱`}
        badgeVariant="outline"
        kpis={[
          { label: "全服保險箱", value: `${lockboxes.length} 個`, icon: Lock },
          { label: "我的保險箱", value: `${myLockboxes.length} 個`, icon: Key },
        ]}
      />

      {lockboxes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lockboxes.map((lockbox) => {
            const isOwner = currentUser?.toLowerCase() === lockbox.owner.toLowerCase();
            return (
              <Card key={lockbox.id} className="flex flex-col justify-between">
                <div>
                  <CardHeader className="pb-3 border-b border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-md bg-muted text-foreground">
                          <Lock className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5">
                          <CardTitle className="text-xs font-mono font-bold">{lockbox.location}</CardTitle>
                          <CardDescription className="text-[11px]">擁有者：{lockbox.owner}</CardDescription>
                        </div>
                      </div>
                      <Badge variant={isOwner ? "default" : "secondary"}>
                        {isOwner ? "我的保險箱" : "共享保險箱"}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-3">
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground mb-2">已授權存取成員</p>
                      <div className="flex flex-wrap gap-1.5">
                        {lockbox.authorized && lockbox.authorized.map((player) => (
                          <Badge key={player} variant="outline" className="text-[10px]">
                            {player}
                            {isOwner && (
                              <button 
                                onClick={() => onUpdateLockbox(lockbox.id, 'revoke', player)} 
                                className="ml-1 text-muted-foreground hover:text-destructive cursor-pointer"
                              >
                                ×
                              </button>
                            )}
                          </Badge>
                        ))}
                        {(!lockbox.authorized || lockbox.authorized.length === 0) && (
                          <span className="text-xs text-muted-foreground italic">僅限擁有者開啟</span>
                        )}
                      </div>
                    </div>

                    {isOwner && (
                      <div className="flex items-center space-x-2 pt-2">
                        <Input 
                          type="text" 
                          placeholder="授權玩家名稱..." 
                          className="h-8 text-xs flex-1" 
                          id={`grant-${lockbox.id}`} 
                        />
                        <Button 
                          size="sm" 
                          variant="secondary"
                          className="h-8 text-xs shrink-0" 
                          onClick={() => {
                            const val = (document.getElementById(`grant-${lockbox.id}`) as HTMLInputElement)?.value;
                            if (val?.trim()) {
                              onUpdateLockbox(lockbox.id, 'grant', val.trim());
                              (document.getElementById(`grant-${lockbox.id}`) as HTMLInputElement).value = "";
                            }
                          }}
                        >
                          新增授權
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="py-12">
          <CardContent className="text-center space-y-2">
            <Lock className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-bold text-foreground">目前無任何安裝密碼鎖的保險箱</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
