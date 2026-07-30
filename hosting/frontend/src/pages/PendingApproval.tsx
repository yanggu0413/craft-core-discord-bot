import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User } from '../types';
import { Clock, RefreshCw, LogOut } from 'lucide-react';

interface PendingApprovalProps {
  user: User;
  onLogout: () => void;
  onRefresh: () => void;
}

export const PendingApproval: React.FC<PendingApprovalProps> = ({ user, onLogout, onRefresh }) => {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-xl p-6 text-center space-y-6">
        <div className="h-14 w-14 mx-auto rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
          <Clock className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold">帳號等待審核中 (Pending Approval)</h2>
          <p className="text-xs text-muted-foreground">
            哈囉 <strong className="text-foreground">{user.username}</strong>！您的 Discord 帳號已成功登入，但新註冊用戶必須由管理員人工審核開通權限。
          </p>
        </div>

        <div className="p-4 rounded-lg bg-muted/40 border text-left text-xs space-y-2 font-mono">
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Discord ID:</span>
            <span>{user.discordId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">狀態:</span>
            <Badge variant="warning">待 Admin 審核</Badge>
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={onRefresh} className="flex-1 gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> 重新檢查狀態
          </Button>
          <Button variant="outline" onClick={onLogout} className="text-xs">
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </Card>
    </div>
  );
};
