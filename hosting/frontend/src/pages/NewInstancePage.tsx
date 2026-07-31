import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { RuntimeType, User } from '../types';
import {
  Server,
  Code2,
  GitBranch,
  Upload,
  AlertCircle,
  FileArchive,
  CheckCircle2,
  Loader2,
  FolderTree,
  Hammer,
  Play,
  ArrowLeft,
  Rocket,
  ExternalLink,
  Database,
  Layers,
  Sparkles,
  Container,
  Box,
  Terminal,
  Activity,
  Workflow,
  FileCode,
  Globe,
  Bot,
  Cpu,
  Wrench,
  FileText,
} from 'lucide-react';

interface NewInstancePageProps {
  user: User;
  onSubmit: (
    data: any,
    onProgress?: (pct: number, loadedMB: number, totalMB: number) => void
  ) => Promise<any>;
  remainingCpu: number;
  remainingMemory: number;
  remainingDisk: number;
}

export const NewInstancePage: React.FC<NewInstancePageProps> = ({
  user,
  onSubmit,
  remainingCpu,
  remainingMemory,
  remainingDisk,
}) => {
  const navigate = useNavigate();

  const [category, setCategory] = useState<'app' | 'db' | 'docker'>('app');
  const [name, setName] = useState('');
  const [runtime, setRuntime] = useState<RuntimeType>('nodejs');
  const [sourceType, setSourceType] = useState<'git' | 'zip'>('git');
  const [gitUrl, setGitUrl] = useState('');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [rootDir, setRootDir] = useState('/');
  const [buildCommand, setBuildCommand] = useState('');
  const [startCommand, setStartCommand] = useState('node index.js');
  const [internalPort, setInternalPort] = useState(3000);
  const [cpuLimit, setCpuLimit] = useState(Math.min(50, remainingCpu));
  const [memoryLimit, setMemoryLimit] = useState(Math.min(512, remainingMemory));
  const [diskLimit, setDiskLimit] = useState(Math.min(2048, remainingDisk));

  // Docker Mode fields
  const [dockerImage, setDockerImage] = useState('');
  const [dockerRunCmd, setDockerRunCmd] = useState('');
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([]);

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');

  const handleCategoryChange = (cat: 'app' | 'db' | 'docker') => {
    setCategory(cat);
    if (cat === 'db') {
      setRuntime('mongodb');
      setInternalPort(27017);
      setStartCommand('mongod');
      setBuildCommand('');
    } else if (cat === 'docker') {
      setRuntime('docker');
      setDockerImage('louislam/uptime-kuma:1');
      setInternalPort(3001);
      setStartCommand('none');
      setBuildCommand('');
    } else {
      setRuntime('nodejs');
      setInternalPort(3000);
      setStartCommand('node index.js');
      setBuildCommand('npm install');
    }
  };

  const applyDockerPreset = (appName: string, image: string, port: number) => {
    setCategory('docker');
    setName(appName);
    setDockerImage(image);
    setInternalPort(port);
    setDockerRunCmd(`docker run -d -p ${port}:${port} ${image}`);
    if (image.includes('ghost')) {
      setEnvVars([
        { key: 'url', value: `http://localhost:${port}` },
        { key: 'NODE_ENV', value: 'development' },
      ]);
    } else {
      setEnvVars([]);
    }
  };

  const handleDbChange = (rt: RuntimeType) => {
    setRuntime(rt);
    if (rt === 'mongodb') {
      setInternalPort(27017);
      setStartCommand('mongod');
    } else if (rt === 'postgres') {
      setInternalPort(5432);
      setStartCommand('postgres');
    } else if (rt === 'mysql') {
      setInternalPort(3306);
      setStartCommand('mysqld');
    } else if (rt === 'redis') {
      setInternalPort(6379);
      setStartCommand('redis-server');
    }
  };

  const handleAppRuntimeChange = (rt: RuntimeType) => {
    setRuntime(rt);
    setStartCommand(rt === 'nodejs' ? 'node index.js' : 'python main.py');
    setBuildCommand(rt === 'nodejs' ? 'npm install' : 'pip install -r requirements.txt');
  };

  const handleFileDrop = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      if (!selected.name.endsWith('.zip')) {
        setError('請上傳 .zip 格式壓縮包');
        return;
      }
      setError('');
      setZipFile(selected);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('請輸入服務名稱');
      return;
    }
    if (category === 'app' && sourceType === 'git' && !gitUrl.trim()) {
      setError('請輸入 GitHub 儲存庫 URL');
      return;
    }
    if (category === 'app' && sourceType === 'zip' && !zipFile) {
      setError('請選擇 ZIP 部署包檔案');
      return;
    }
    if (category === 'docker' && !dockerImage.trim() && !dockerRunCmd.trim()) {
      setError('請輸入 Docker 鏡像名稱或 Docker Run / Compose 命令');
      return;
    }

    setError('');
    setLoading(true);
    setStatusMessage('[1/4] 正在驗證配額上限與初始化工作區資源...');

    try {
      const payload = {
        name: name.trim(),
        runtime: category === 'docker' ? 'docker' : runtime,
        sourceType: category === 'app' ? sourceType : (category === 'docker' ? 'docker' : 'git'),
        gitUrl: category === 'app' && sourceType === 'git' ? gitUrl.trim() : undefined,
        zipFile: category === 'app' && sourceType === 'zip' && zipFile ? zipFile : undefined,
        dockerImage: category === 'docker' ? dockerImage.trim() : undefined,
        dockerRunCmd: category === 'docker' ? dockerRunCmd.trim() : undefined,
        envVars,
        rootDir: rootDir.trim() || '/',
        buildCommand: buildCommand.trim() || undefined,
        startCommand: category === 'docker' ? 'none' : startCommand,
        internalPort,
        cpuLimit,
        memoryLimit,
        diskLimit,
      };

      let instanceId: string | null = null;

      let pollInterval: any = null;
      if (category === 'docker') {
        pollInterval = setInterval(() => {
          fetch(`/api/system/docker-pull-status?image=${encodeURIComponent(dockerImage.trim())}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (d && d.pulling && d.status) {
                setStatusMessage(`[2/4] ${d.status}`);
              }
            })
            .catch(() => {});
        }, 800);
      }

      if (category === 'app' && sourceType === 'zip' && zipFile) {
        setStatusMessage('[2/4] 正在切片傳輸 5MB 數據分片至雲端伺服器 (零斷線防護)...');
        instanceId = await onSubmit(payload, (pct, loadedMB, totalMB) => {
          setStatusMessage(`[2/4] 正在傳輸分片數據包: ${loadedMB} MB / ${totalMB} MB (${pct}%)`);
        });
      } else {
        setStatusMessage('[2/4] 正在配給 Docker 容器實體與拉取鏡像...');
        instanceId = await onSubmit(payload);
      }

      if (pollInterval) clearInterval(pollInterval);

      setStatusMessage('[3/4] 容器配置完成，正在發動系統服務...');

      setTimeout(() => {
        setStatusMessage(`[4/4] 服務 ${name} 建立成功！正在前往控制台...`);
        setTimeout(() => {
          if (instanceId) {
            navigate(`/project/${instanceId}`);
          } else {
            navigate('/');
          }
        }, 800);
      }, 600);
    } catch (err: any) {
      setError(err.message || '建立機器失敗，請確認輸入內容與網絡連線');
      setStatusMessage('');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      {/* Header Navigation */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Rocket className="h-6 w-6 text-primary" /> 建立新託管服務
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              部署 Node.js/Python 專案、一鍵開通託管資料庫，或自訂 Docker Hub / Compose 容器
            </p>
          </div>
        </div>

        <Button variant="outline" size="sm" asChild className="text-xs gap-1.5 font-semibold">
          <a href="https://wiki.hosting.craft-core.xyz" target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5 text-primary" /> 開發者文檔
          </a>
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2.5 shadow-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {loading && (
          <Card className="border-primary/50 bg-primary/5 p-6 text-center space-y-3 shadow-md animate-pulse">
            <div className="flex items-center justify-center gap-3 text-primary font-bold text-sm">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>{statusMessage}</span>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              請稍候，系統正在分配獨立 CPU 與記憶體配額並配置 Docker 容器環境...
            </p>
          </Card>
        )}

        {/* Section 0: Category Choice */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" /> 1. 選擇服務種類
            </CardTitle>
            <CardDescription className="text-xs">
              選擇部署 Node.js/Python 程式碼、一鍵資料庫，或自訂 Docker / Docker Compose 容器
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button
                type="button"
                variant={category === 'app' ? 'default' : 'outline'}
                className="h-16 justify-start gap-3 px-4 border-2 text-left"
                onClick={() => handleCategoryChange('app')}
                disabled={loading}
              >
                <Code2 className={`h-5 w-5 shrink-0 ${category === 'app' ? 'text-primary-foreground' : 'text-primary'}`} />
                <div>
                  <div className="font-bold text-xs">應用程式容器</div>
                  <div className="text-[10px] opacity-80 font-normal">Node.js / Python</div>
                </div>
              </Button>

              <Button
                type="button"
                variant={category === 'db' ? 'default' : 'outline'}
                className="h-16 justify-start gap-3 px-4 border-2 text-left"
                onClick={() => handleCategoryChange('db')}
                disabled={loading}
              >
                <Database className={`h-5 w-5 shrink-0 ${category === 'db' ? 'text-primary-foreground' : 'text-emerald-500'}`} />
                <div>
                  <div className="font-bold text-xs">一鍵託管資料庫</div>
                  <div className="text-[10px] opacity-80 font-normal">Mongo/PG/MySQL/Redis</div>
                </div>
              </Button>

              <Button
                type="button"
                variant={category === 'docker' ? 'default' : 'outline'}
                className="h-16 justify-start gap-3 px-4 border-2 text-left"
                onClick={() => handleCategoryChange('docker')}
                disabled={loading}
              >
                <Box className={`h-5 w-5 shrink-0 ${category === 'docker' ? 'text-primary-foreground' : 'text-cyan-500'}`} />
                <div>
                  <div className="font-bold text-xs">萬用 Docker / Compose</div>
                  <div className="text-[10px] opacity-80 font-normal">Uptime Kuma / n8n 等</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Section 1: Source (App mode only) */}
        {category === 'app' && (
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-primary" /> 2. 選擇專案來源
              </CardTitle>
              <CardDescription className="text-xs">
                提供 GitHub 儲存庫網址，或上傳包含源碼的 ZIP 檔案
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button
                  type="button"
                  variant={sourceType === 'git' ? 'default' : 'outline'}
                  className="h-14 justify-start gap-3 px-5 border-2 font-bold text-xs"
                  onClick={() => setSourceType('git')}
                  disabled={loading}
                >
                  <GitBranch className={`h-5 w-5 shrink-0 ${sourceType === 'git' ? 'text-primary-foreground' : 'text-primary'}`} />
                  <span>GitHub 儲存庫網址</span>
                </Button>

                <Button
                  type="button"
                  variant={sourceType === 'zip' ? 'default' : 'outline'}
                  className="h-14 justify-start gap-3 px-5 border-2 font-bold text-xs"
                  onClick={() => setSourceType('zip')}
                  disabled={loading}
                >
                  <Upload className={`h-5 w-5 shrink-0 ${sourceType === 'zip' ? 'text-primary-foreground' : 'text-emerald-500'}`} />
                  <span>ZIP 本地檔案部署包</span>
                </Button>
              </div>

              {sourceType === 'git' ? (
                <div className="pt-2 space-y-2">
                  <Label className="text-xs font-semibold">GitHub 儲存庫網址</Label>
                  <Input
                    placeholder="https://github.com/username/repository"
                    value={gitUrl}
                    onChange={(e) => setGitUrl(e.target.value)}
                    disabled={loading}
                    className="font-mono text-xs h-10"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    例如: <code className="font-mono bg-muted px-1.5 py-0.5 rounded">https://github.com/expressjs/express</code>
                  </p>
                </div>
              ) : (
                <div className="pt-2">
                  <label className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${zipFile ? 'border-emerald-500 bg-emerald-500/5' : 'border-muted-foreground/30 hover:border-primary hover:bg-muted/30'}`}>
                    {zipFile ? (
                      <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                        <CheckCircle2 className="h-6 w-6" />
                        <span>已選擇 ZIP: {zipFile.name} ({(zipFile.size / (1024 * 1024)).toFixed(1)} MB)</span>
                      </div>
                    ) : (
                      <>
                        <FileArchive className="h-10 w-10 text-muted-foreground mb-3" />
                        <span className="text-sm font-bold text-foreground">點擊或將 .zip 專案檔拖拽至此區域</span>
                        <span className="text-xs text-muted-foreground mt-1">系統將在伺服器自動解包並部署環境</span>
                      </>
                    )}
                    <input type="file" accept=".zip" onChange={handleFileDrop} disabled={loading} className="hidden" />
                  </label>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Docker Mode Configuration */}
        {category === 'docker' && (
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Box className="h-4 w-4 text-cyan-500" /> 2. Docker 鏡像與指令配置
              </CardTitle>
              <CardDescription className="text-xs">
                可選擇熱門自架應用預設、直接輸入 Docker Hub 鏡像名稱，或貼上 <code className="bg-muted px-1 rounded">docker run</code> 指令 / <code className="bg-muted px-1 rounded">docker-compose.yml</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Presets */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" /> 熱門自架應用一鍵預設:
                </Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyDockerPreset('uptime-kuma', 'louislam/uptime-kuma:1', 3001)}
                    className="text-xs font-mono gap-1.5 h-8 bg-muted/30 hover:bg-primary/10 hover:text-primary border"
                  >
                    <Activity className="h-3.5 w-3.5 text-emerald-500" /> Uptime Kuma 監控
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyDockerPreset('n8n-automation', 'n8nio/n8n:latest', 5678)}
                    className="text-xs font-mono gap-1.5 h-8 bg-muted/30 hover:bg-primary/10 hover:text-primary border"
                  >
                    <Workflow className="h-3.5 w-3.5 text-rose-500" /> n8n 自動化
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyDockerPreset('pocketbase-backend', 'ghcr.io/muchobien/pocketbase:latest', 8090)}
                    className="text-xs font-mono gap-1.5 h-8 bg-muted/30 hover:bg-primary/10 hover:text-primary border"
                  >
                    <Database className="h-3.5 w-3.5 text-cyan-500" /> PocketBase
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyDockerPreset('ghost-blog', 'ghost:latest', 2368)}
                    className="text-xs font-mono gap-1.5 h-8 bg-muted/30 hover:bg-primary/10 hover:text-primary border"
                  >
                    <FileCode className="h-3.5 w-3.5 text-amber-500" /> Ghost 部落格
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyDockerPreset('alist-storage', 'xhofe/alist:latest', 5244)}
                    className="text-xs font-mono gap-1.5 h-8 bg-muted/30 hover:bg-primary/10 hover:text-primary border"
                  >
                    <FolderTree className="h-3.5 w-3.5 text-blue-500" /> Alist 網盤檔案
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyDockerPreset('stirling-pdf', 'frooodle/s-pdf:latest', 8080)}
                    className="text-xs font-mono gap-1.5 h-8 bg-muted/30 hover:bg-primary/10 hover:text-primary border"
                  >
                    <FileText className="h-3.5 w-3.5 text-rose-500" /> Stirling-PDF
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyDockerPreset('it-tools', 'corentinth/it-tools:latest', 80)}
                    className="text-xs font-mono gap-1.5 h-8 bg-muted/30 hover:bg-primary/10 hover:text-primary border"
                  >
                    <Wrench className="h-3.5 w-3.5 text-indigo-500" /> IT-Tools 工具箱
                  </Button>





                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyDockerPreset('vscode-web', 'codercom/code-server:latest', 8080)}
                    className="text-xs font-mono gap-1.5 h-8 bg-muted/30 hover:bg-primary/10 hover:text-primary border"
                  >
                    <Code2 className="h-3.5 w-3.5 text-blue-400" /> VS Code 網頁版
                  </Button>
                </div>
              </div>

              {/* Service Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">服務名稱</Label>
                <Input
                  placeholder="uptime-kuma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  className="font-mono text-xs h-10"
                />
              </div>

              {/* Docker Image Input */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Docker Hub 鏡像名稱</Label>
                <Input
                  placeholder="louislam/uptime-kuma:1 或 n8nio/n8n:latest"
                  value={dockerImage}
                  onChange={(e) => setDockerImage(e.target.value)}
                  disabled={loading}
                  className="font-mono text-xs h-10"
                />
                <p className="text-[11px] text-muted-foreground">例如: <code className="bg-muted px-1 rounded font-mono">louislam/uptime-kuma:1</code>、<code className="bg-muted px-1 rounded font-mono">n8nio/n8n:latest</code></p>
              </div>

              {/* Docker Run / Compose YAML Parser Input */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>或貼上 Docker 啟動命令 / Docker Compose YAML (選填，自動解析)</span>
                  <span className="text-[10px] text-muted-foreground">Auto-Parser</span>
                </Label>
                <Textarea
                  placeholder={`例如: docker run -d --name uptime-kuma -p 3001:3001 louislam/uptime-kuma:1\n或貼上 docker-compose.yml 文字區塊`}
                  value={dockerRunCmd}
                  onChange={(e) => setDockerRunCmd(e.target.value)}
                  disabled={loading}
                  className="font-mono text-xs min-h-[100px] leading-relaxed"
                />
                <p className="text-[11px] text-muted-foreground">
                  系統將自動從指令或 YAML 中為您提取 <code className="bg-muted px-1 rounded font-mono">Image</code>、<code className="bg-muted px-1 rounded font-mono">Port</code> 與 <code className="bg-muted px-1 rounded font-mono">Environment</code> 設定！
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">容器服務內部通道</Label>
                <Input
                  type="number"
                  value={internalPort}
                  onChange={(e) => setInternalPort(parseInt(e.target.value, 10) || 3000)}
                  disabled={loading}
                  className="font-mono text-xs h-10"
                />
                <p className="text-[11px] text-muted-foreground">容器內部程式監聽的通訊通道（例如 Uptime Kuma 3001、n8n 5678）</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 2: Framework & Runtime (App / DB mode) */}
        {category !== 'docker' && (
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Code2 className="h-4 w-4 text-emerald-500" /> {category === 'app' ? '3. 專案名稱與執行環境' : '2. 資料庫名稱與引擎選擇'}
              </CardTitle>
              <CardDescription className="text-xs">
                {category === 'app' ? '配置基礎運行環境、工作目錄與構建指令' : '選擇資料庫引擎（系統會自動產生帳戶、密碼與獨立資料庫存取權）'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Service Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{category === 'app' ? '專案名稱' : '資料庫服務名稱'}</Label>
                <Input
                  placeholder={category === 'app' ? 'my-awesome-app' : 'my-mongodb-db'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  className="font-mono text-xs h-10"
                />
              </div>

              {/* Runtime / Engine Choice */}
              {category === 'app' ? (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">執行環境</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      type="button"
                      variant={runtime === 'nodejs' ? 'default' : 'outline'}
                      className="h-20 justify-start gap-4 px-4 text-left border-2"
                      onClick={() => handleAppRuntimeChange('nodejs')}
                      disabled={loading}
                    >
                      <Code2 className={`h-8 w-8 shrink-0 ${runtime === 'nodejs' ? 'text-primary-foreground' : 'text-emerald-500'}`} />
                      <div>
                        <div className="font-bold text-sm">Node.js 環境</div>
                        <div className="text-xs opacity-80 mt-0.5">Node 22 LTS (npm & C++ 編譯引擎)</div>
                      </div>
                    </Button>

                    <Button
                      type="button"
                      variant={runtime === 'python' ? 'default' : 'outline'}
                      className="h-20 justify-start gap-4 px-4 text-left border-2"
                      onClick={() => handleAppRuntimeChange('python')}
                      disabled={loading}
                    >
                      <Terminal className={`h-8 w-8 shrink-0 ${runtime === 'python' ? 'text-primary-foreground' : 'text-blue-500'}`} />
                      <div>
                        <div className="font-bold text-sm">Python 環境</div>
                        <div className="text-xs opacity-80 mt-0.5">Python 3.11 Slim (pip & uv 執行引擎)</div>
                      </div>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">資料庫引擎</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Button
                      type="button"
                      variant={runtime === 'mongodb' ? 'default' : 'outline'}
                      className="h-20 flex-col items-start justify-center p-3 text-left border-2"
                      onClick={() => handleDbChange('mongodb')}
                      disabled={loading}
                    >
                      <Database className={`h-5 w-5 mb-1 ${runtime === 'mongodb' ? 'text-primary-foreground' : 'text-emerald-500'}`} />
                      <div className="font-bold text-xs">MongoDB</div>
                      <div className="text-[10px] opacity-80 font-normal">NoSQL (通道 27017)</div>
                    </Button>

                    <Button
                      type="button"
                      variant={runtime === 'postgres' ? 'default' : 'outline'}
                      className="h-20 flex-col items-start justify-center p-3 text-left border-2"
                      onClick={() => handleDbChange('postgres')}
                      disabled={loading}
                    >
                      <Database className={`h-5 w-5 mb-1 ${runtime === 'postgres' ? 'text-primary-foreground' : 'text-blue-500'}`} />
                      <div className="font-bold text-xs">PostgreSQL</div>
                      <div className="text-[10px] opacity-80 font-normal">SQL (通道 5432)</div>
                    </Button>

                    <Button
                      type="button"
                      variant={runtime === 'mysql' ? 'default' : 'outline'}
                      className="h-20 flex-col items-start justify-center p-3 text-left border-2"
                      onClick={() => handleDbChange('mysql')}
                      disabled={loading}
                    >
                      <Database className={`h-5 w-5 mb-1 ${runtime === 'mysql' ? 'text-primary-foreground' : 'text-amber-500'}`} />
                      <div className="font-bold text-xs">MySQL 8.0</div>
                      <div className="text-[10px] opacity-80 font-normal">SQL (通道 3306)</div>
                    </Button>

                    <Button
                      type="button"
                      variant={runtime === 'redis' ? 'default' : 'outline'}
                      className="h-20 flex-col items-start justify-center p-3 text-left border-2"
                      onClick={() => handleDbChange('redis')}
                      disabled={loading}
                    >
                      <Database className={`h-5 w-5 mb-1 ${runtime === 'redis' ? 'text-primary-foreground' : 'text-rose-500'}`} />
                      <div className="font-bold text-xs">Redis 7.2</div>
                      <div className="text-[10px] opacity-80 font-normal">Cache (通道 6379)</div>
                    </Button>
                  </div>
                </div>
              )}

              {category === 'app' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <FolderTree className="h-3.5 w-3.5 text-muted-foreground" /> 工作目錄
                    </Label>
                    <Input
                      value={rootDir}
                      onChange={(e) => setRootDir(e.target.value)}
                      disabled={loading}
                      className="font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Server className="h-3.5 w-3.5 text-muted-foreground" /> 容器服務 Port
                    </Label>
                    <Input
                      type="number"
                      value={internalPort}
                      onChange={(e) => setInternalPort(parseInt(e.target.value, 10) || 3000)}
                      disabled={loading}
                      className="font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Hammer className="h-3.5 w-3.5 text-muted-foreground" /> 構建指令
                    </Label>
                    <Input
                      value={buildCommand}
                      onChange={(e) => setBuildCommand(e.target.value)}
                      disabled={loading}
                      className="font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Play className="h-3.5 w-3.5 text-muted-foreground" /> 啟動指令
                    </Label>
                    <Input
                      value={startCommand}
                      onChange={(e) => setStartCommand(e.target.value)}
                      disabled={loading}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Section 3: Resource Allocation */}
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Server className="h-4 w-4 text-cyan-500" /> 3. 資源配額與限制
            </CardTitle>
            <CardDescription className="text-xs">
              調整專屬 CPU、記憶體與硬碟上限容量
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span>CPU 配額</span>
                <span className="font-mono text-primary">{cpuLimit}% / 剩餘可用 {remainingCpu}%</span>
              </div>
              <Slider
                value={[cpuLimit]}
                min={10}
                max={Math.max(10, remainingCpu)}
                step={5}
                onValueChange={(val) => setCpuLimit(val[0])}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span>記憶體上限</span>
                <span className="font-mono text-cyan-500">{memoryLimit} MB / 剩餘可用 {remainingMemory} MB</span>
              </div>
              <Slider
                value={[memoryLimit]}
                min={64}
                max={Math.max(64, remainingMemory)}
                step={64}
                onValueChange={(val) => setMemoryLimit(val[0])}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span>儲存空間上限</span>
                <span className="font-mono text-amber-500">{diskLimit} MB / 剩餘可用 {remainingDisk} MB</span>
              </div>
              <Slider
                value={[diskLimit]}
                min={256}
                max={Math.max(256, remainingDisk)}
                step={256}
                onValueChange={(val) => setDiskLimit(val[0])}
                disabled={loading}
              />
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => navigate('/')} disabled={loading} className="px-6">
            取消
          </Button>
          <Button type="submit" disabled={loading} className="px-8 font-bold gap-2 text-sm shadow-md">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {category === 'app' ? '立即部署容器' : category === 'db' ? '一鍵開通資料庫' : '一鍵部署 Docker 容器'}
          </Button>
        </div>
      </form>
    </div>
  );
};
