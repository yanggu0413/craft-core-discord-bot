import React, { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Instance, EnvVariable } from '../../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Save, GitBranch, Copy, Check, ShieldAlert, Bell, Eye, EyeOff, Loader2, FolderTree, Hammer, Play, Network, AlertCircle, RotateCw } from 'lucide-react';

export const ProjectSettings: React.FC = () => {
  const { instance, onRefreshData } = useOutletContext<{ instance: Instance; onRefreshData?: () => void }>();
  const navigate = useNavigate();

  const [rootDir, setRootDir] = useState(instance.rootDir || '/');
  const [buildCommand, setBuildCommand] = useState(instance.buildCommand || '');
  const [startCommand, setStartCommand] = useState(instance.startCommand || 'node index.js');
  const [internalPort, setInternalPort] = useState(instance.internalPort || 3000);
  const [cpuLimit, setCpuLimit] = useState(instance.cpuLimit || 50);
  const [memoryLimit, setMemoryLimit] = useState(instance.memoryLimit || 512);
  const [diskLimit, setDiskLimit] = useState(instance.diskLimit || 2048);
  const [envVars, setEnvVars] = useState<EnvVariable[]>(instance.envVars || []);
  const [showSecrets, setShowSecrets] = useState<Record<number, boolean>>({});
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState(instance.discordWebhookUrl || '');
  const [healthCheckEndpoint, setHealthCheckEndpoint] = useState(instance.healthCheckEndpoint || '/health');
  const [customDomain, setCustomDomain] = useState(instance.customDomain || '');
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [requestingPort, setRequestingPort] = useState(false);
  const [portMsg, setPortMsg] = useState('');

  const handleApplyPort = async () => {
    setRequestingPort(true);
    setPortMsg('');
    try {
      const storedToken = localStorage.getItem('cc_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {}),
      };

      const res = await fetch('/api/port-requests', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          instanceId: instance.id,
          internalPort: internalPort,
        }),
      });

      if (res.ok) {
        setPortMsg('Port 與專屬域名已由系統自動核發成功！');
        onRefreshData?.();
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveError(err.error || 'Port 申請失敗');
      }
    } catch (err) {
      setSaveError('網路錯誤，請稍後再試');
    } finally {
      setRequestingPort(false);
    }
  };

  const handleDeletePort = async () => {
    setRequestingPort(true);
    setPortMsg('');
    try {
      const storedToken = localStorage.getItem('cc_token');
      const headers: Record<string, string> = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};

      const res = await fetch(`/api/instances/${instance.id}/port`, {
        method: 'DELETE',
        headers,
      });

      if (res.ok) {
        setPortMsg('對外 Port 與專屬域名已成功移除。');
        onRefreshData?.();
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveError(err.error || '移除 Port 失敗');
      }
    } catch (err) {
      setSaveError('網路錯誤，請稍後再試');
    } finally {
      setRequestingPort(false);
    }
  };

  const handleReissuePort = async () => {
    setRequestingPort(true);
    setPortMsg('');
    try {
      const storedToken = localStorage.getItem('cc_token');
      const headers: Record<string, string> = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};

      const res = await fetch(`/api/instances/${instance.id}/port/reissue`, {
        method: 'POST',
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        setPortMsg(`已成功重新核發全新 Port: ${data.assignedHostPort} 與 8 位子域名 app-${data.subdomain}`);
        onRefreshData?.();
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveError(err.error || '重新核發 Port 失敗');
      }
    } catch (err) {
      setSaveError('網路錯誤，請稍後再試');
    } finally {
      setRequestingPort(false);
    }
  };

  const handleAddEnv = () => {
    setEnvVars([...envVars, { key: '', value: '', isSecret: false }]);
  };

  const handleRemoveEnv = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const handleEnvChange = (index: number, field: 'key' | 'value' | 'isSecret', val: any) => {
    const next = [...envVars];
    next[index] = { ...next[index], [field]: val };
    setEnvVars(next);
  };

  const toggleShowSecret = (index: number) => {
    setShowSecrets((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const storedToken = localStorage.getItem('cc_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {}),
      };

      const res = await fetch(`/api/instances/${instance.id}/settings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          rootDir,
          buildCommand,
          startCommand,
          internalPort,
          cpuLimit,
          memoryLimit,
          diskLimit,
          envVars,
          discordWebhookUrl,
          healthCheckEndpoint,
          customDomain,
        }),
      });

      if (res.ok) {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveError(err.error || '儲存設定失敗');
      }
    } catch (err) {
      setSaveError('網路連線失敗，請稍後再試');
    }
  };

  const confirmDeleteProject = async () => {
    setIsDeleting(true);
    setDeleteError('');

    try {
      const storedToken = localStorage.getItem('cc_token');
      const headers: Record<string, string> = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};

      const res = await fetch(`/api/instances/${instance.id}`, {
        method: 'DELETE',
        headers,
      });

      if (res.ok) {
        window.location.href = '/';
      } else {
        const err = await res.json().catch(() => ({}));
        setDeleteError(err.error || '刪除專案失敗');
        setIsDeleting(false);
      }
    } catch (err) {
      setDeleteError('刪除專案網路失敗');
      setIsDeleting(false);
    }
  };

  const webhookUrl = instance.webhookSecret
    ? `https://hosting.craft-core.xyz/api/webhooks/github/${instance.id}`
    : `https://hosting.craft-core.xyz/api/webhooks/github/${instance.id}`;

  return (
    <div className="space-y-6 max-w-4xl">
      <form onSubmit={handleSave} className="space-y-6">
        {/* Startup CMD, Build CMD & Root Directory Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold">一般與構建執行設定</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <FolderTree className="h-4 w-4 text-primary" /> 工作與子專案目錄
              </Label>
              <Input
                placeholder="/ or /backend or ./src"
                value={rootDir}
                onChange={(e) => setRootDir(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">容器執行與檔案總管導向之專案根目錄路徑</p>
            </div>

            <div className="grid grid-cols-2 gap-4 items-start">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5 h-5">
                  <Hammer className="h-4 w-4 text-amber-500 shrink-0" /> 構建指令
                </Label>
                <Input
                  placeholder="npm run build or pip install -r requirements.txt"
                  value={buildCommand}
                  onChange={(e) => setBuildCommand(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5 h-5">
                  <Play className="h-4 w-4 text-emerald-500 shrink-0" /> 運行指令
                </Label>
                <Input
                  value={startCommand}
                  onChange={(e) => setStartCommand(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">內部監聽 Port</Label>
              <Input
                type="number"
                value={internalPort}
                onChange={(e) => setInternalPort(Number(e.target.value))}
                className="font-mono text-xs"
              />
            </div>
          </CardContent>
        </Card>

        {/* Public Port Request Banner */}
        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Network className="h-4 w-4 text-emerald-500" /> 對外 Port 與專屬域名核發
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                系統自動即時核發獨立 Port 與 8 位英數隨機專屬域名 (`app-XXXXXXXX.hosting.craft-core.xyz`)
              </p>
            </div>
            {instance.assignedHostPort ? (
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-end gap-1 mr-2">
                  <span className="font-mono text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded font-bold">
                    已映射 Port: {instance.assignedHostPort}
                  </span>
                  {instance.subdomain && (
                    <span className="font-mono text-[11px] text-primary">
                      app-{instance.subdomain}.hosting.craft-core.xyz
                    </span>
                  )}
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleReissuePort}
                  disabled={requestingPort}
                  className="gap-1.5 text-xs font-bold shadow-sm"
                  title="重新生成 8 位隨機域名與全新的對外 Port"
                >
                  {requestingPort ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                  重新核發
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={handleDeletePort}
                  disabled={requestingPort}
                  className="gap-1.5 text-xs font-bold shadow-sm"
                  title="關閉並關聯釋放此 Port 與域名"
                >
                  {requestingPort ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  刪除 Port
                </Button>
              </div>
            ) : (
              <Button type="button" size="sm" onClick={handleApplyPort} disabled={requestingPort} className="gap-1.5 text-xs font-bold shadow-sm">
                {requestingPort ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Network className="h-3.5 w-3.5 text-emerald-400" />}
                {requestingPort ? '核發中...' : '自動開啟對外 Port'}
              </Button>
            )}
          </CardHeader>
          {portMsg && (
            <CardContent className="pt-0">
              <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0" />
                <span>{portMsg}</span>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Discord Notification & Healthcheck */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" /> Discord 動態通知與健康檢查
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Discord Webhook 通知網址 (當啟動/停止/Crash時發送)</Label>
              <Input
                placeholder="https://discord.com/api/webhooks/..."
                value={discordWebhookUrl}
                onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">HTTP 健康檢查 Endpoint</Label>
              <Input
                placeholder="/health or /"
                value={healthCheckEndpoint}
                onChange={(e) => setHealthCheckEndpoint(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">自訂獨立域名</Label>
              <Input
                placeholder="bot.yourdomain.com"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">請將您的域名 CNAME 指向 <code className="font-mono bg-muted px-1 rounded">hosting.craft-core.xyz</code></p>
            </div>
          </CardContent>
        </Card>

        {/* Environment Variables Card with Secrets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-bold">環境變數</CardTitle>
            <Button type="button" size="sm" variant="outline" onClick={handleAddEnv} className="gap-1 text-xs">
              <Plus className="h-3.5 w-3.5" /> 新增變數
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {envVars.length === 0 ? (
              <div className="text-xs text-muted-foreground italic py-2">尚無設定環境變數</div>
            ) : (
              envVars.map((env, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2 rounded-lg border bg-card shadow-sm">
                  <div className="sm:col-span-5">
                    <Input
                      placeholder="KEY (例: DISCORD_TOKEN)"
                      value={env.key}
                      onChange={(e) => handleEnvChange(idx, 'key', e.target.value)}
                      className="font-mono text-xs uppercase"
                    />
                  </div>
                  <div className="sm:col-span-6 relative">
                    <Input
                      type={showSecrets[idx] ? 'text' : 'password'}
                      placeholder="VALUE"
                      value={env.value}
                      onChange={(e) => handleEnvChange(idx, 'value', e.target.value)}
                      className="font-mono text-xs pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowSecret(idx)}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                      title={showSecrets[idx] ? '隱藏密文' : '顯示明文'}
                    >
                      {showSecrets[idx] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <div className="sm:col-span-1 flex items-center justify-end">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => handleRemoveEnv(idx)}
                      title="刪除變數"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Resource Quota Sliders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold">Docker 資源限制</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span>CPU 配額</span>
                <span className="font-mono font-bold text-primary">{cpuLimit}%</span>
              </div>
              <Slider min={10} max={100} step={5} value={[cpuLimit]} onValueChange={(v) => setCpuLimit(v[0])} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span>記憶體限額</span>
                <span className="font-mono font-bold text-primary">{memoryLimit} MB</span>
              </div>
              <Slider min={64} max={1024} step={64} value={[memoryLimit]} onValueChange={(v) => setMemoryLimit(v[0])} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span>硬碟空間限額</span>
                <span className="font-mono font-bold text-primary">{(diskLimit / 1024).toFixed(1)} GB ({diskLimit}MB)</span>
              </div>
              <Slider min={512} max={4096} step={256} value={[diskLimit]} onValueChange={(v) => setDiskLimit(v[0])} />
            </div>
          </CardContent>

          {saveError && (
            <CardContent className="pt-0">
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{saveError}</span>
              </div>
            </CardContent>
          )}

          <CardFooter className="justify-end border-t pt-4">
            <Button type="submit" className="gap-1.5 text-xs font-bold">
              {isSaved ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Save className="h-3.5 w-3.5" />}
              {isSaved ? '已儲存設定' : '儲存變更'}
            </Button>
          </CardFooter>
        </Card>
      </form>

      {/* GitHub Webhook Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" /> GitHub Webhook 自動部署配置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Payload URL</Label>
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} className="font-mono text-xs bg-muted" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                  setCopiedWebhook(true);
                  setTimeout(() => setCopiedWebhook(false), 2000);
                }}
                className="gap-1 text-xs shrink-0"
              >
                {copiedWebhook ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedWebhook ? '已複製' : '複製 URL'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base font-bold text-destructive flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" /> 危險區域
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold">刪除專案</div>
            <div className="text-[11px] text-muted-foreground">永久刪除該 Docker 容器與其專案檔案</div>
          </div>
          <Button variant="destructive" size="sm" onClick={() => setIsDeleteModalOpen(true)} disabled={isDeleting} className="gap-1 text-xs font-bold">
            {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isDeleting ? '刪除中...' : '刪除此專案'}
          </Button>
        </CardContent>
      </Card>

      {/* In-App Delete Project Confirmation Dialog */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" /> 確定要刪除專案 「{instance.name}」 嗎？
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-2">
              刪除此專案後，對應的 Docker 容器將會被永久移除，所有工作區內部的專案檔案與設定也將無法復原！
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}

          <DialogFooter className="gap-2 pt-4">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteModalOpen(false)} disabled={isDeleting}>
              取消
            </Button>
            <Button variant="destructive" size="sm" onClick={confirmDeleteProject} disabled={isDeleting} className="gap-1.5 font-bold">
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isDeleting ? '正在刪除專案...' : '確認永久刪除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
