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
        iconColor="text-indigo-500"
        title="鎖箱管理 (/padlock)"
        description="遠端管理伺服器內已設置 /padlock 的密碼鎖箱，授權隊友成員與查看座標"
        badgeText={`${lockboxes.length} 個鎖箱`}
        badgeVariant="outline"
        kpis={[
          { label: "全服鎖箱", value: `${lockboxes.length} 個`, icon: Lock, iconColor: "text-indigo-500" },
          { label: "我的鎖箱", value: `${myLockboxes.length} 個`, icon: Key, iconColor: "text-amber-500" },
        ]}
      />

      {lockboxes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lockboxes.map((lockbox) => {
            const isOwner = currentUser?.toLowerCase() === lockbox.owner.toLowerCase();
            return (
              <Card key={lockbox.id} className="flex flex-col justify-between rounded-none">
                <div>
                  <CardHeader className="pb-3 border-b border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 border border-border bg-muted/40 text-foreground">
                          <Lock className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div className="space-y-0.5">
                          <CardTitle className="text-xs font-mono font-bold">{lockbox.location}</CardTitle>
                          <CardDescription className="text-[11px]">箱主：{lockbox.owner}</CardDescription>
                        </div>
                      </div>
                      <Badge variant={isOwner ? "default" : "secondary"} className="rounded-md">
                        {isOwner ? "我的鎖箱" : "共享鎖箱"}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-3">
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground mb-2">已授權成員列表</p>
                      <div className="flex flex-wrap gap-1.5">
                        {lockbox.authorized && lockbox.authorized.map((player) => (
                          <Badge key={player} variant="outline" className="text-[10px] rounded-md">
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
                          <span className="text-xs text-muted-foreground italic">僅限箱主開啟</span>
                        )}
                      </div>
                    </div>

                    {isOwner && (
                      <div className="flex items-center space-x-2 pt-2">
                        <Input 
                          type="text" 
                          placeholder="隊友玩家 ID..." 
                          className="h-8 text-xs flex-1" 
                          id={`grant-${lockbox.id}`} 
                        />
                        <Button 
                          size="sm" 
                          variant="secondary"
                          className="h-8 text-xs shrink-0 rounded-md" 
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
        <Card className="py-12 rounded-none">
          <CardContent className="text-center space-y-2">
            <Lock className="w-8 h-8 text-indigo-500 mx-auto" />
            <p className="text-sm font-bold text-foreground">您目前沒有建立任何 /padlock 鎖箱</p>
            <p className="text-xs text-muted-foreground">在遊戲內面向箱子輸入 <code className="bg-muted px-1.5 py-0.5 font-mono text-[11px] rounded-xs text-foreground">/padlock &lt;密碼&gt;</code> 上鎖後，即可在此遠端管理。</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
