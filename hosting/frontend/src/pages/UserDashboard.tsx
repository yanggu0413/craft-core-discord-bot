import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Instance, PortRequest, User } from '../types';
import { CreateInstanceModal } from '../components/CreateInstanceModal';
import { Plus, Server, Cpu, HardDrive, Database, AlertCircle, RefreshCw, Code2, Globe, ArrowRight } from 'lucide-react';

interface UserDashboardProps {
  user: User;
  instances: Instance[];
  portRequests: PortRequest[];
  onCreateInstance: (data: any) => void;
  onRefreshData: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  user,
  instances,
  portRequests,
  onCreateInstance,
  onRefreshData,
}) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const navigate = useNavigate();

  // Quotas
  const MAX_INSTANCES = 2;
  const TOTAL_CPU_QUOTA = 100;
  const TOTAL_MEM_QUOTA = 1024;
  const TOTAL_DISK_QUOTA = 4096;

  const usedCpu = instances.reduce((sum, inst) => sum + (inst.cpuLimit || 0), 0);
  const usedMem = instances.reduce((sum, inst) => sum + (inst.memoryLimit || 0), 0);
  const usedDisk = instances.reduce((sum, inst) => sum + (inst.diskLimit || 2048), 0);

  const remainingCpu = Math.max(0, TOTAL_CPU_QUOTA - usedCpu);
  const remainingMem = Math.max(0, TOTAL_MEM_QUOTA - usedMem);
  const remainingDisk = Math.max(0, TOTAL_DISK_QUOTA - usedDisk);

  const canCreate = instances.length < MAX_INSTANCES && remainingCpu >= 10 && remainingMem >= 64 && remainingDisk >= 256;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto w-full">
      {/* Top Welcome & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">歡迎回來，{user.username}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            個人容器託管中心 — 配額：最多 2 台機器 / 100% CPU / 1GB RAM / 4GB 硬碟空間
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button size="icon" variant="outline" className="h-9 w-9" onClick={onRefreshData} title="重新整理">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => navigate('/new')} disabled={!canCreate} className="gap-2 h-9 text-xs font-semibold">
            <Plus className="h-4 w-4" /> 建立新託管機器
          </Button>
        </div>
      </div>

      {/* Resource Quotas Grid (Full Width 4-Card Grid - Zero Overlapping) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex flex-col justify-between space-y-2 border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-primary" /> 機器數量
            </span>
            <Badge variant="outline" className="font-mono text-[10px]">Max {MAX_INSTANCES}</Badge>
          </div>
          <div className="text-lg font-bold font-mono">
            {instances.length} / {MAX_INSTANCES} <span className="text-xs font-normal text-muted-foreground">台</span>
          </div>
        </Card>

        <Card className="p-4 flex flex-col justify-between space-y-2 border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-primary" /> CPU 配額
            </span>
            <span className="font-mono text-xs font-bold text-foreground">{usedCpu}% / 100%</span>
          </div>
          <Progress value={(usedCpu / TOTAL_CPU_QUOTA) * 100} className="h-2" />
        </Card>

        <Card className="p-4 flex flex-col justify-between space-y-2 border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 text-primary" /> RAM 限額
            </span>
            <span className="font-mono text-xs font-bold text-foreground">{usedMem} MB / 1024 MB</span>
          </div>
          <Progress value={(usedMem / TOTAL_MEM_QUOTA) * 100} className="h-2" />
        </Card>

        <Card className="p-4 flex flex-col justify-between space-y-2 border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-primary" /> 硬碟空間
            </span>
            <span className="font-mono text-xs font-bold text-foreground">{(usedDisk / 1024).toFixed(1)} GB / 4.0 GB</span>
          </div>
          <Progress value={(usedDisk / TOTAL_DISK_QUOTA) * 100} className="h-2" />
        </Card>
      </div>

      {/* Limit Alert */}
      {instances.length >= MAX_INSTANCES && (
        <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>您已達到個人機器數量限制上限 (2 / 2 台)。若需新增，請先刪除或停止現有機器。</span>
        </div>
      )}

      {/* Projects Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" /> 託管機器專案 (Projects)
          </h2>
        </div>

        {instances.length === 0 ? (
          <Card className="p-12 text-center border-dashed space-y-2">
            <Server className="h-10 w-10 text-muted-foreground mx-auto" />
            <h3 className="text-base font-bold">目前尚未建立任何機器專案</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              點擊右上角「+ 建立新託管機器」按鈕，即可開始佈署您的 Python 或 Node.js 後端應用。
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {instances.map((inst) => {
              const isRunning = inst.status === 'running';
              return (
                <Card
                  key={inst.id}
                  onClick={() => navigate(`/project/${inst.id}/overview`)}
                  className="cursor-pointer hover:border-primary transition-all duration-200 shadow-sm flex flex-col justify-between"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-lg border ${
                          inst.runtime === 'nodejs'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                            : 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
                        }`}>
                          <Code2 className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-bold flex items-center gap-2 hover:text-primary transition-colors">
                            {inst.name}
                          </CardTitle>
                          <CardDescription className="text-xs font-mono mt-0.5">
                            {inst.sourceType === 'git' ? inst.gitUrl || 'GitHub Repository' : 'ZIP Deployment'}
                          </CardDescription>
                        </div>
                      </div>

                      <Badge variant={isRunning ? 'success' : 'outline'} className="capitalize gap-1.5 font-normal">
                        <span className={`h-1.5 w-1.5 rounded-full ${isRunning ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {inst.status}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="pb-3 text-xs space-y-2">
                    <div className="bg-muted/30 p-2.5 rounded-md border font-mono flex justify-between items-center text-muted-foreground">
                      <span className="truncate">CMD: {inst.startCommand}</span>
                      <Badge variant="outline" className="uppercase text-[9px] font-bold shrink-0 ml-2">
                        {inst.runtime}
                      </Badge>
                    </div>

                    {inst.assignedHostPort && (
                      <div className="flex items-center gap-1.5 text-xs text-primary font-mono pt-1">
                        <Globe className="h-3.5 w-3.5" />
                        <span>app-{inst.assignedHostPort}.hosting.craft-core.xyz</span>
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="pt-3 border-t text-xs text-muted-foreground flex justify-between items-center bg-muted/10">
                    <span className="font-mono text-[11px]">
                      {inst.cpuLimit}% CPU / {inst.memoryLimit}MB RAM / {((inst.diskLimit || 2048) / 1024).toFixed(1)}GB Disk
                    </span>
                    <span className="text-primary font-medium flex items-center gap-1 hover:underline text-xs">
                      管理專案 <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Instance Modal */}
      <CreateInstanceModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={async (data) => {
          await onCreateInstance(data);
          setIsCreateOpen(false);
        }}
        remainingCpu={remainingCpu}
        remainingMemory={remainingMem}
        remainingDisk={remainingDisk}
      />
    </div>
  );
};
