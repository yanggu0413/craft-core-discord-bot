import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PortRequest, Instance, User } from '../types';
import { ShieldCheck, Server, UserCheck, RefreshCw, Check, X, ArrowUpRight, FileText, Globe, Clock } from 'lucide-react';

interface AdminPanelProps {
  pendingUsers: User[];
  allUsers: User[];
  portRequests: PortRequest[];
  allInstances: Instance[];
  onApproveUser: (userId: string) => Promise<void>;
  onRejectUser: (userId: string) => Promise<void>;
  onApprovePortRequest: (requestId: string, hostPort: number) => Promise<void>;
  onRejectPortRequest: (requestId: string) => Promise<void>;
  onRefreshData: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  pendingUsers,
  allUsers,
  portRequests,
  allInstances,
  onApproveUser,
  onRejectUser,
  onApprovePortRequest,
  onRejectPortRequest,
  onRefreshData,
}) => {
  const navigate = useNavigate();
  const [allocatedPorts, setAllocatedPorts] = useState<Record<string, number>>({});
  const [globalInstances, setGlobalInstances] = useState<Instance[]>(allInstances);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGlobalData = () => {
    setLoading(true);
    const storedToken = localStorage.getItem('cc_token');
    const headers: Record<string, string> = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};

    fetch('/api/admin/instances', { credentials: 'include', headers })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.instances)) setGlobalInstances(data.instances);
      })
      .catch(() => {});

    fetch('/api/admin/audit-logs', { credentials: 'include', headers })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.logs)) setAuditLogs(data.logs);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchGlobalData();
  }, []);

  const handleAdminStopInstance = async (id: string) => {
    const storedToken = localStorage.getItem('cc_token');
    const headers: Record<string, string> = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};
    await fetch(`/api/admin/instances/${id}/stop`, { method: 'POST', credentials: 'include', headers });
    fetchGlobalData();
    onRefreshData();
  };

  const pendingPortRequests = portRequests.filter((pr) => pr.status === 'PENDING');

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-6 w-full">
      {/* Top Header Card */}
      <Card className="p-6 border shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">管理員主控台</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                全服機器鏡像操控、檔案與日誌巡檢、Port 派發審核與安全審計
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onRefreshData();
              fetchGlobalData();
            }}
            className="gap-1.5 text-xs h-9 font-bold"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> 重新整理數據
          </Button>
        </div>
      </Card>

      {/* Modern High-End Tabs */}
      <Tabs defaultValue="machines" className="space-y-6">
        <TabsList className="flex items-center justify-start gap-2 bg-card border border-border p-1.5 rounded-xl h-auto w-full md:w-auto overflow-x-auto shadow-sm">
          <TabsTrigger
            value="machines"
            className="px-4 py-2.5 text-xs font-bold gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
          >
            <Server className="h-4 w-4" />
            <span>全服機器</span>
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-muted-foreground/20">
              {globalInstances.length || allInstances.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="ports"
            className="px-4 py-2.5 text-xs font-bold gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Port 審核</span>
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
              {pendingPortRequests.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="px-4 py-2.5 text-xs font-bold gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
          >
            <UserCheck className="h-4 w-4" />
            <span>開權審核</span>
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">
              {pendingUsers.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="audit"
            className="px-4 py-2.5 text-xs font-bold gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
          >
            <FileText className="h-4 w-4" />
            <span>安全日誌</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Global Machines */}
        <TabsContent value="machines">
          <Card className="border shadow-sm">
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary" /> 全服所有使用者機器清單
                </div>
                <span className="text-xs font-normal text-muted-foreground">點擊可直接進入該機器之檔案、日誌與部署管理介面</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y">
              {(globalInstances.length > 0 ? globalInstances : allInstances).length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">全服目前尚無任何運作中機器</div>
              ) : (
                (globalInstances.length > 0 ? globalInstances : allInstances).map((inst) => (
                  <div key={inst.id} className="p-4 flex items-center justify-between hover:bg-muted/20 transition-colors">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm truncate">{inst.name}</span>
                        <Badge variant={inst.status === 'running' ? 'success' : 'outline'} className="capitalize text-[10px]">
                          {inst.status}
                        </Badge>
                        <span className="text-[11px] font-mono text-muted-foreground">({inst.runtime})</span>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 font-mono">
                        <span>ID: {inst.id}</span>
                        <span>擁有者: {inst.ownerUsername || 'User'}</span>
                        <span> Port: {inst.assignedHostPort || '無 (僅內部)'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {inst.assignedHostPort && (
                        <Button variant="ghost" size="sm" asChild className="h-8 text-xs gap-1 font-mono">
                          <a href={`https://app-${inst.assignedHostPort}.hosting.craft-core.xyz`} target="_blank" rel="noreferrer">
                            <Globe className="h-3.5 w-3.5" /> 開啟網頁
                          </a>
                        </Button>
                      )}
                      {inst.status === 'running' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleAdminStopInstance(inst.id)}
                          className="h-8 text-xs font-bold"
                        >
                          強制停止
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => navigate(`/project/${inst.id}/overview`)}
                        className="h-8 text-xs gap-1 font-bold shadow-sm"
                      >
                        進入鏡像管理 <ArrowUpRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Port Requests */}
        <TabsContent value="ports">
          <Card className="border shadow-sm">
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-emerald-500" /> 待審核對外 Port 申請項目
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y">
              {pendingPortRequests.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">尚無未處理的 Port 申請</div>
              ) : (
                pendingPortRequests.map((pr) => (
                  <div key={pr.id} className="p-4 flex items-center justify-between hover:bg-muted/20 transition-colors">
                    <div className="space-y-1">
                      <div className="font-bold text-sm flex items-center gap-2">
                        專案 ID: <code className="font-mono text-primary">{pr.instanceId}</code>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono flex items-center gap-3">
                        <span>申請人: {pr.username}</span>
                        <span>內部Port: {pr.internalPort}</span>
                        <span>申請時間: {new Date(pr.createdAt).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="分配 Host Port (例如 3001)"
                        value={allocatedPorts[pr.id] || ''}
                        onChange={(e) => setAllocatedPorts({ ...allocatedPorts, [pr.id]: Number(e.target.value) })}
                        className="h-9 px-3 w-48 rounded-md border text-xs font-mono bg-background"
                      />
                      <Button
                        size="sm"
                        disabled={!allocatedPorts[pr.id]}
                        onClick={() => onApprovePortRequest(pr.id, allocatedPorts[pr.id])}
                        className="h-9 gap-1 text-xs font-bold"
                      >
                        <Check className="h-4 w-4" /> 核准並派發
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRejectPortRequest(pr.id)}
                        className="h-9 text-xs text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-4 w-4" /> 駁回
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Pending Users */}
        <TabsContent value="users">
          <Card className="border shadow-sm">
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-amber-500" /> 待審核開權使用者清單
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y">
              {pendingUsers.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">尚無待開權的使用者</div>
              ) : (
                pendingUsers.map((u) => (
                  <div key={u.id} className="p-4 flex items-center justify-between hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3">
                      {u.avatar ? (
                        <img src={u.avatar} alt="avatar" className="h-9 w-9 rounded-full border object-cover" />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                          {u.username.slice(0, 2)}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-sm">{u.username}</div>
                        <div className="text-xs text-muted-foreground font-mono">Discord ID: {u.discordId}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => onApproveUser(u.id)} className="h-8 gap-1 text-xs font-bold">
                        <Check className="h-3.5 w-3.5" /> 開放權限
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onRejectUser(u.id)} className="h-8 text-xs text-destructive">
                        <X className="h-3.5 w-3.5" /> 拒絕
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Audit Logs */}
        <TabsContent value="audit">
          <Card className="border shadow-sm">
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> 全服安全日誌與審計紀錄
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y max-h-[500px] overflow-y-auto font-mono text-xs">
              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground font-sans">尚無安全日誌紀錄</div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-3 flex items-start justify-between gap-4 hover:bg-muted/10 transition-colors">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase font-bold">
                          {log.action}
                        </Badge>
                        <span className="font-bold text-foreground">{log.username}</span>
                        <span className="text-muted-foreground font-sans">{log.details}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-3">
                        <span>IP: {log.ip_address}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
