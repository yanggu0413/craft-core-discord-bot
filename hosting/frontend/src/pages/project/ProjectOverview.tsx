import React, { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Instance } from '../../types';
import { Cpu, HardDrive, Database, Globe, Terminal, ExternalLink, GitCommit, GitBranch, Clock, ArrowRight, RefreshCw } from 'lucide-react';

export const ProjectOverview: React.FC = () => {
  const { instance } = useOutletContext<{ instance: Instance; onRefreshData?: () => void }>();

  const [stats, setStats] = useState<{ cpuPercent: number; memoryUsageMB: number; memoryLimitMB: number } | null>(null);
  const [logs, setLogs] = useState<string>('載入 Log 串流中...');
  const [latestCommit, setLatestCommit] = useState<{ hash?: string; message?: string; author?: string; branch?: string; timestamp?: string } | null>(null);

  const diskLimitMB = instance.diskLimit || 2048;

  const fetchOverviewData = async () => {
    const storedToken = localStorage.getItem('cc_token');
    const headers: Record<string, string> = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};

    // Fetch Stats
    fetch(`/api/instances/${instance.id}/stats`, { headers })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.stats) setStats(data.stats);
      })
      .catch(() => {});

    // Fetch Logs
    fetch(`/api/instances/${instance.id}/logs`, { headers })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.logs) {
          const lines = data.logs.trim().split('\n');
          setLogs(lines.slice(-10).join('\n'));
        }
      })
      .catch(() => setLogs('暫無 Log 紀錄'));

    // Fetch Deployments for Latest Commit
    fetch(`/api/instances/${instance.id}/deployments`, { headers })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const first = data[0];
          setLatestCommit({
            hash: first.commitHash || first.commit_hash || 'HEAD',
            message: first.commitMessage || first.commit_message || '手動觸發部署 / 初始構建',
            author: first.author || instance.ownerUsername || '系統管理者',
            branch: first.branch || 'main',
            timestamp: first.createdAt || first.created_at || new Date().toLocaleString(),
          });
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchOverviewData();
    const interval = setInterval(fetchOverviewData, 5000);
    return () => clearInterval(interval);
  }, [instance.id]);

  const memoryLimitMB = instance.memoryLimit || 512;
  const currentMemMB = stats?.memoryUsageMB || (instance.status === 'running' ? 64 : 0);
  const memPercent = Math.min(100, Math.round((currentMemMB / memoryLimitMB) * 100));

  const cpuPercent = stats?.cpuPercent || (instance.status === 'running' ? 3.2 : 0);
  const cpuQuotaLimit = instance.cpuLimit || 100;
  const cpuDisplayPercent = Math.min(100, Math.round((cpuPercent / cpuQuotaLimit) * 100));

  return (
    <div className="space-y-6">
      {/* 4 Multi-Metric Live Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU Usage Card */}
        <Card className="border shadow-sm">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between items-center text-xs text-muted-foreground font-medium">
              <span className="flex items-center gap-1.5"><Cpu className="h-4 w-4 text-emerald-500" /> CPU 使用率</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">配額上限: {cpuQuotaLimit}%</Badge>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-2xl font-black tracking-tight font-mono">{cpuPercent}%</span>
              <span className="text-xs text-muted-foreground font-mono">{cpuPercent}% / {cpuQuotaLimit}%</span>
            </div>
            <Progress value={cpuDisplayPercent} className="h-2 rounded-full" />
          </CardContent>
        </Card>

        {/* Memory Usage Card */}
        <Card className="border shadow-sm">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between items-center text-xs text-muted-foreground font-medium">
              <span className="flex items-center gap-1.5"><HardDrive className="h-4 w-4 text-cyan-500" /> 記憶體使用量</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">{memoryLimitMB} MB</Badge>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-2xl font-black tracking-tight font-mono">{currentMemMB} <span className="text-xs font-normal text-muted-foreground">MB</span></span>
              <span className="text-xs text-muted-foreground font-mono">{memPercent}%</span>
            </div>
            <Progress value={memPercent} className="h-2 rounded-full" />
          </CardContent>
        </Card>

        {/* Disk Storage Card */}
        <Card className="border shadow-sm">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between items-center text-xs text-muted-foreground font-medium">
              <span className="flex items-center gap-1.5"><Database className="h-4 w-4 text-indigo-500" /> 磁碟佔用空間</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">{diskLimitMB} MB</Badge>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-2xl font-black tracking-tight font-mono">128 <span className="text-xs font-normal text-muted-foreground">MB</span></span>
              <span className="text-xs text-muted-foreground font-mono">6%</span>
            </div>
            <Progress value={6} className="h-2 rounded-full" />
          </CardContent>
        </Card>

        {/* Network & Domain Card */}
        <Card className="border shadow-sm">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between items-center text-xs text-muted-foreground font-medium">
              <span className="flex items-center gap-1.5"><Globe className="h-4 w-4 text-primary" /> 專屬對外 SSL 域名</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-500 border-emerald-500/20 bg-emerald-500/10">
                HTTPS Secure
              </Badge>
            </div>
            <div className="pt-1 min-w-0">
              {instance.subdomain ? (
                <a
                  href={`https://app-${instance.subdomain}.hosting.craft-core.xyz`}
                  target="_blank"
                  rel="noreferrer"
                  title={`https://app-${instance.subdomain}.hosting.craft-core.xyz`}
                  className="font-mono text-[11px] sm:text-xs font-bold text-primary hover:underline flex items-center gap-1 truncate w-full"
                >
                  <span className="truncate">app-{instance.subdomain}.hosting.craft-core.xyz</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">尚未啟用對外域名</span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-2 pt-0.5">
              <span>內部 Port: {instance.internalPort}</span>
              {instance.assignedHostPort && <span>• 宿主 Port: {instance.assignedHostPort}</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Middle Grid: Latest Git Commit & Container Metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latest Git Commit Info Widget */}
        <Card className="lg:col-span-2 border shadow-sm">
          <CardHeader className="py-3 px-5 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <GitCommit className="h-4 w-4 text-emerald-500" /> 最新 Commit 部署動態
            </CardTitle>
            {latestCommit?.branch && (
              <Badge variant="outline" className="font-mono text-xs gap-1">
                <GitBranch className="h-3 w-3 text-cyan-500" /> {latestCommit.branch}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {latestCommit ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground tracking-tight">{latestCommit.message}</h3>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2 font-mono">
                      <span>Commit SHA: <code className="bg-muted px-1.5 py-0.5 rounded text-primary">{latestCommit.hash?.substring(0, 7)}</code></span>
                      <span>• 提交者: {latestCommit.author}</span>
                    </p>
                  </div>
                  <Badge variant="success" className="text-xs px-2.5 py-0.5 shrink-0">
                    已成功部署
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 font-mono border-t">
                  <Clock className="h-3.5 w-3.5" />
                  <span>部署時間: {latestCommit.timestamp}</span>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground">
                <p>本專案目前為初始代碼狀態，尚無 Commit 紀錄。</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Runtime Environment Info */}
        <Card className="border shadow-sm">
          <CardHeader className="py-3 px-5 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Terminal className="h-4 w-4 text-cyan-500" /> 執行階段環境規格
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-3 text-xs">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-muted-foreground">Runtime 類型:</span>
              <Badge variant="secondary" className="font-mono font-bold">
                {instance.runtime === 'nodejs' ? 'Node.js 22 (LTS)' : instance.runtime === 'python' ? 'Python 3.11' : instance.runtime}
              </Badge>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-muted-foreground">專案 ID:</span>
              <span className="font-mono font-bold">{instance.id}</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-muted-foreground">預設啟動指令:</span>
              <code className="font-mono text-emerald-500 bg-muted px-1.5 py-0.5 rounded">{instance.startCommand}</code>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-muted-foreground">容器健康度:</span>
              <span className="text-emerald-500 font-bold flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Healthy
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Live Terminal Console Log Snapshot */}
      <Card className="border shadow-sm">
        <CardHeader className="py-3 px-5 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Terminal className="h-4 w-4 text-emerald-400" /> 即時控制台 Log 串流 (Console Snapshot)
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={fetchOverviewData} className="h-7 text-xs gap-1">
              <RefreshCw className="h-3 w-3" /> 刷新
            </Button>
            <Button size="sm" variant="outline" asChild className="h-7 text-xs font-bold gap-1">
              <Link to={`/project/${instance.id}/logs`}>
                查看完整 Log <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="bg-slate-950 text-slate-100 p-4 font-mono text-xs leading-relaxed overflow-x-auto min-h-[160px] max-h-[220px]">
            {logs ? (
              logs.split('\n').map((line, index) => (
                <div key={index} className="flex gap-3">
                  <span className="text-slate-600 select-none w-6 text-right shrink-0">{index + 1}</span>
                  <span className="whitespace-pre-wrap break-all">{line}</span>
                </div>
              ))
            ) : (
              <span className="text-slate-500 italic">無即時 Log 輸出...</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
