import React, { useState } from 'react';
import { useParams, Outlet, Navigate } from 'react-router-dom';
import { Instance } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Square, RotateCw, Globe, Loader2, ArrowUpCircle, Check } from 'lucide-react';

interface ProjectLayoutProps {
  instances: Instance[];
  instancesLoaded?: boolean;
  onStart: (id: string) => Promise<void> | void;
  onStop: (id: string) => Promise<void> | void;
  onRestart: (id: string) => Promise<void> | void;
  onRefreshData?: () => void;
}

export const ProjectLayout: React.FC<ProjectLayoutProps> = ({
  instances,
  instancesLoaded = false,
  onStart,
  onStop,
  onRestart,
  onRefreshData,
}) => {
  const { id } = useParams<{ id: string }>();
  const instance = instances.find((i) => i.id === id);

  const [actionLoading, setActionLoading] = useState<'start' | 'stop' | 'restart' | 'upgrade' | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  if (!instance) {
    if (!instancesLoaded) {
      return (
        <div className="flex-1 flex items-center justify-center bg-background min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground font-mono">載入專案鏡像資料中...</span>
          </div>
        </div>
      );
    }
    return <Navigate to="/" replace />;
  }

  const isRunning = instance.status === 'running';
  const isDockerContainer = !!instance.dockerImage || ['mongodb', 'postgres', 'mysql', 'redis', 'docker'].includes(instance.runtime);

  const handleAction = async (type: 'start' | 'stop' | 'restart' | 'upgrade') => {
    if (actionLoading) return;
    setActionLoading(type);

    if (type === 'start') setStatusMsg('正在啟動 Docker 容器，請稍候...');
    if (type === 'stop') setStatusMsg('正在關閉與停止 Docker 容器，請稍候...');
    if (type === 'restart') setStatusMsg('正在重啟 Docker 容器，請稍候...');
    if (type === 'upgrade') setStatusMsg('正在拉取最新 Docker 鏡像並升級容器，請稍候...');

    try {
      if (type === 'start') await onStart(instance.id);
      if (type === 'stop') await onStop(instance.id);
      if (type === 'restart') await onRestart(instance.id);
      if (type === 'upgrade') {
        const targetImage = instance.dockerImage || instance.runtime;
        const pollInterval = setInterval(() => {
          fetch(`/api/system/docker-pull-status?image=${encodeURIComponent(targetImage)}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (d && d.pulling && d.status) {
                setStatusMsg(d.status);
              }
            })
            .catch(() => {});
        }, 800);

        const storedToken = localStorage.getItem('cc_token');
        const headers: Record<string, string> = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};
        const res = await fetch(`/api/instances/${instance.id}/upgrade`, {
          method: 'POST',
          headers,
        });

        clearInterval(pollInterval);

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || '升級失敗');
        }
        await onRefreshData?.();
      }

      if (type === 'start') setStatusMsg('容器啟動完成！');
      if (type === 'stop') setStatusMsg('容器已成功停止。');
      if (type === 'restart') setStatusMsg('容器重啟完成！');
      if (type === 'upgrade') setStatusMsg('容器鏡像已成功升級至最新版本並完成重啟！');

      setTimeout(() => setStatusMsg(''), 3000);
    } catch (err: any) {
      setStatusMsg(err.message || '操作執行失敗，請稍後再試');
      setTimeout(() => setStatusMsg(''), 3500);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background relative">
      {/* Top Project Control Action Header */}
      <header className="px-6 py-4 border-b border-border bg-card/50 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-10 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight truncate">{instance.name}</h1>
              <Badge variant={isRunning ? 'success' : 'outline'} className="capitalize gap-1.5 font-normal">
                <span className={`h-1.5 w-1.5 rounded-full ${isRunning ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {actionLoading ? '處理中...' : instance.status}
              </Badge>
            </div>
            {instance.assignedHostPort ? (
              <a
                href={`https://app-${instance.subdomain || instance.assignedHostPort}.hosting.craft-core.xyz`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary font-mono hover:underline flex items-center gap-1 mt-0.5 font-bold"
              >
                <Globe className="h-3 w-3 text-emerald-500" />
                app-{instance.subdomain || instance.assignedHostPort}.hosting.craft-core.xyz
              </a>
            ) : (
              <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                尚未開啟對外連線
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isDockerContainer && (
            <Button
              size="sm"
              variant="outline"
              disabled={actionLoading !== null}
              onClick={() => handleAction('upgrade')}
              className="h-8 gap-1.5 text-xs font-semibold border-amber-500/30 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400"
              title="拉取最新 Docker 鏡像層並無縫平滑升級與重啟"
            >
              {actionLoading === 'upgrade' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpCircle className="h-3.5 w-3.5" />}
              {actionLoading === 'upgrade' ? '升級中...' : '一鍵升級'}
            </Button>
          )}

          {isRunning ? (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={actionLoading !== null}
                onClick={() => handleAction('restart')}
                className="h-8 gap-1.5 text-xs font-semibold"
              >
                {actionLoading === 'restart' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                {actionLoading === 'restart' ? '重啟中...' : '重啟'}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={actionLoading !== null}
                onClick={() => handleAction('stop')}
                className="h-8 gap-1.5 text-xs font-semibold"
              >
                {actionLoading === 'stop' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                {actionLoading === 'stop' ? '停止中...' : '停止容器'}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              disabled={actionLoading !== null}
              onClick={() => handleAction('start')}
              className="h-8 gap-1.5 text-xs font-bold"
            >
              {actionLoading === 'start' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
              {actionLoading === 'start' ? '啟動中...' : '啟動機器'}
            </Button>
          )}
        </div>
      </header>

      {/* Floating Action Toast Notification (Bottom Right) - Sharp Square / Rectangular */}
      {statusMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-none bg-card border border-border shadow-2xl text-xs font-semibold text-foreground backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300">
          {actionLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
          ) : (
            <Check className="h-4 w-4 text-emerald-500 shrink-0" />
          )}
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Main Outlet Container */}
      <main className="flex-1 p-6 overflow-y-auto">
        <Outlet context={{ instance, onRefreshData }} />
      </main>
    </div>
  );
};
