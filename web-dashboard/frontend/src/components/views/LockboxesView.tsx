import { Lock, ShieldAlert, Key } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

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

export default function LockboxesView({ lockboxes, onUpdateLockbox, currentUser }: LockboxesViewProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1 text-left">
        <h2 className="text-base font-bold tracking-wider uppercase text-foreground">箱子密碼鎖管理</h2>
        <p className="text-xs text-muted-foreground">
          檢視與配置您已安裝密碼鎖的安全密碼箱。您可以授權其他玩家開啟、變更鎖頭密碼，或完全註銷防護。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lockboxes.map((lockbox) => {
          const isOwner = currentUser?.toLowerCase() === lockbox.owner.toLowerCase();
          return (
            <Card key={lockbox.id} className="flex flex-col justify-between">
              <div>
                <CardHeader className="pb-3 flex flex-row items-center space-x-3 space-y-0 border-b border-border">
                  <div className="bg-muted p-2 rounded-[2px] border border-border">
                    <Lock className="w-4 h-4 text-foreground" />
                  </div>
                  <div className="text-left space-y-0.5">
                    <CardTitle className="text-xs font-bold font-mono text-primary">位置：{lockbox.location}</CardTitle>
                    <CardDescription className="text-[10px]">擁有者：{lockbox.owner}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 text-left space-y-3">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      已授權開啟玩家
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {lockbox.authorized && lockbox.authorized.map((player) => (
                        <span key={player} className="bg-muted border border-border text-foreground text-[10px] pl-2 pr-1.5 py-0.5 rounded-[2px] font-bold flex items-center">
                          {player}
                          {isOwner && (
                            <button 
                              onClick={() => onUpdateLockbox(lockbox.id, 'revoke', player)} 
                              className="hover:text-red-500 font-bold ml-1.5 text-xs focus:outline-none"
                              title="取消授權"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                      {(!lockbox.authorized || lockbox.authorized.length === 0) && (
                        <span className="text-[11px] text-muted-foreground italic">僅限擁有者開啟</span>
                      )}
                    </div>
                  </div>

                  {isOwner && (
                    <div className="flex gap-2 pt-1.5">
                      <Input 
                        type="text" 
                        placeholder="輸入欲授權的玩家名稱..." 
                        className="h-7 text-xs flex-1" 
                        id={`grant-${lockbox.id}`} 
                      />
                      <Button 
                        size="sm" 
                        className="h-7 text-[10px] px-3 font-bold" 
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

              {isOwner && (
                <div className="p-3 border-t border-border mt-3 flex items-center justify-between">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 text-[10px] font-bold" 
                    onClick={() => {
                      const pwd = window.prompt("請輸入密碼箱的新密碼：");
                      if (pwd && pwd.trim()) {
                        onUpdateLockbox(lockbox.id, 'change_password', undefined, pwd.trim());
                      }
                    }}
                  >
                    <Key className="w-3 h-3 mr-1" />
                    修改密碼
                  </Button>

                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="h-7 text-[10px] bg-red-500 hover:bg-red-600 text-white font-bold" 
                    onClick={() => {
                      if (window.confirm("確定要註銷此安全箱的密碼鎖嗎？遊戲內的密碼鎖箱子將會被完全解除。")) {
                        onUpdateLockbox(lockbox.id, 'delete');
                      }
                    }}
                  >
                    註銷密碼鎖
                  </Button>
                </div>
              )}
            </Card>
          );
        })}

        {lockboxes.length === 0 && (
          <Card className="col-span-full py-12 border-dashed">
            <CardContent className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="bg-muted p-3 rounded-full">
                <ShieldAlert className="w-8 h-8 text-muted-foreground" />
              </div>
              <CardTitle className="text-base font-bold">目前沒有偵測到您已加鎖的安全密碼箱</CardTitle>
              <CardDescription className="max-w-md">
                請在遊戲中面對箱子輸入指令「/padlock {"<密碼>"}」來為箱子設定安全密碼鎖。設定後，密碼箱的授權狀態將即時同步並可在此進行遠端管理。
              </CardDescription>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
