import { Lock, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

interface Lockbox {
  id: string;
  location: string;
  owner: string;
  authorized: string[];
}

interface LockboxesViewProps {
  lockboxes: Lockbox[];
}

export default function LockboxesView({ lockboxes }: LockboxesViewProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1 text-left">
        <h2 className="text-base font-bold tracking-wider uppercase text-foreground">箱子密碼鎖系統</h2>
        <p className="text-xs text-muted-foreground">
          檢視伺服器中您已加鎖的安全密碼箱資訊，以及經授權可開啟該箱子的玩家名單。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lockboxes.map((lockbox) => (
          <Card key={lockbox.id}>
            <CardHeader className="pb-3 flex flex-row items-center space-x-3 space-y-0 border-b border-border">
              <div className="bg-muted p-2 rounded-[2px] border border-border">
                <Lock className="w-4 h-4 text-foreground" />
              </div>
              <div className="text-left space-y-0.5">
                <CardTitle className="text-xs font-bold font-mono text-primary">位置：{lockbox.location}</CardTitle>
                <CardDescription className="text-[10px]">擁有者：{lockbox.owner}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-4 text-left space-y-2">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                已授權可開啟玩家
              </p>
              <div className="flex flex-wrap gap-1.5">
                {lockbox.authorized && lockbox.authorized.map((player) => (
                  <span key={player} className="bg-muted border border-border text-foreground text-[10px] px-2 py-0.5 rounded-[2px] font-bold">
                    {player}
                  </span>
                ))}
                {(!lockbox.authorized || lockbox.authorized.length === 0) && (
                  <span className="text-[11px] text-muted-foreground italic">僅限擁有者開啟</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {lockboxes.length === 0 && (
          <Card className="col-span-full py-12 border-dashed">
            <CardContent className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="bg-muted p-3 rounded-full">
                <ShieldAlert className="w-8 h-8 text-muted-foreground" />
              </div>
              <CardTitle className="text-base font-bold">目前沒有偵測到已加鎖的安全密碼箱</CardTitle>
              <CardDescription className="max-w-md">
                請在遊戲中面對箱子輸入指令「/padlock 密碼」來為箱子設定安全密碼鎖。設定後，密碼箱的授權狀態將即時同步於此處。
              </CardDescription>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
