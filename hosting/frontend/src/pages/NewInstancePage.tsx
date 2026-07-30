import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { RuntimeType, User } from '../types';
import { Server, Code2, GitBranch, Upload, AlertCircle, FileArchive, CheckCircle2, Loader2, FolderTree, Hammer, Play, ArrowLeft, Rocket, ExternalLink } from 'lucide-react';

interface NewInstancePageProps {
  user: User;
  onSubmit: (data: {
    name: string;
    runtime: RuntimeType;
    sourceType: 'git' | 'zip';
    gitUrl?: string;
    zipFile?: File;
    startCommand: string;
    buildCommand?: string;
    rootDir?: string;
    internalPort: number;
    cpuLimit: number;
    memoryLimit: number;
    diskLimit: number;
  }) => Promise<string | void>;
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
  
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');

  const handleRuntimeChange = (rt: RuntimeType) => {
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
      setError('請輸入專案名稱');
      return;
    }
    if (sourceType === 'git' && !gitUrl.trim()) {
      setError('請輸入 GitHub 儲存庫 URL');
      return;
    }
    if (sourceType === 'zip' && !zipFile) {
      setError('請選擇 ZIP 部署包檔案');
      return;
    }

    setError('');
    setLoading(true);
    setStatusMessage('[1/4] 正在驗證配額上限與初始化工作區資源...');

    try {
      const payload = {
        name,
        runtime,
        sourceType,
        gitUrl: sourceType === 'git' ? gitUrl.trim() : undefined,
        zipFile: sourceType === 'zip' && zipFile ? zipFile : undefined,
        rootDir: rootDir.trim() || '/',
        buildCommand: buildCommand.trim() || undefined,
        startCommand,
        internalPort,
        cpuLimit,
        memoryLimit,
        diskLimit,
      };

      if (sourceType === 'git') {
        setStatusMessage(`[2/4] 正在複製 GitHub 儲存庫: ${gitUrl.trim()} ...`);
      } else {
        setStatusMessage(`[2/4] 正在上傳並解包 ZIP 檔案: ${zipFile?.name || ''} ...`);
      }

      const instanceId = await onSubmit(payload);

      setStatusMessage(`[3/4] 正在配置 Docker ${runtime === 'nodejs' ? 'Node.js 22 (LTS)' : 'Python 3.11'} 隔離環境與 8 位專屬子域名...`);

      setTimeout(() => {
        setStatusMessage(`[4/4] 專案 ${name} 建立成功！正在前往動態觀測控制台...`);
        setTimeout(() => {
          if (instanceId) {
            navigate(`/project/${instanceId}`);
          } else {
            navigate('/');
          }
        }, 800);
      }, 600);
    } catch (err: any) {
      setError(err.message || '建立機器失敗，請確認輸入內容與網路連線');
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
              <Rocket className="h-6 w-6 text-primary" /> 建立新託管專案
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              選擇 Git 儲存庫或上傳 ZIP 部署包，數秒內完成 Docker 獨立容器配置
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

        {/* Section 1: Project Source */}
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" /> 1. 選擇專案來源
            </CardTitle>
            <CardDescription className="text-xs">
              提供 GitHub 儲存庫網址，或直接上傳包含源碼的 ZIP 檔案
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
                <p className="text-[11px] text-muted-foreground">例如: <code className="font-mono bg-muted px-1.5 py-0.5 rounded">https://github.com/expressjs/express</code></p>
              </div>
            ) : (
              <div className="pt-2">
                <label className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${zipFile ? 'border-emerald-500 bg-emerald-500/5' : 'border-muted-foreground/30 hover:border-primary hover:bg-muted/30'}`}>
                  {zipFile ? (
                    <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                      <CheckCircle2 className="h-6 w-6" />
                      <span>已選擇 ZIP: {zipFile.name} ({(zipFile.size / 1024).toFixed(1)} KB)</span>
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

        {/* Section 2: Framework & Build Settings */}
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Code2 className="h-4 w-4 text-emerald-500" /> 2. 專案名稱與執行環境
            </CardTitle>
            <CardDescription className="text-xs">
              配置基礎運行環境、工作目錄與自動化構建指令
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Project Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">專案名稱</Label>
              <Input
                placeholder="my-awesome-app"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                className="font-mono text-xs h-10"
              />
            </div>

            {/* Runtime Choice */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">執行環境</Label>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  type="button"
                  variant={runtime === 'nodejs' ? 'default' : 'outline'}
                  className="h-20 justify-start gap-4 px-4 text-left border-2"
                  onClick={() => handleRuntimeChange('nodejs')}
                  disabled={loading}
                >
                  <Code2 className={`h-8 w-8 shrink-0 ${runtime === 'nodejs' ? 'text-primary-foreground' : 'text-emerald-500'}`} />
                  <div>
                    <div className="font-bold text-sm">Node.js 環境</div>
                    <div className="text-xs opacity-80 mt-0.5">Node 20 LTS (npm install & start)</div>
                  </div>
                </Button>

                <Button
                  type="button"
                  variant={runtime === 'python' ? 'default' : 'outline'}
                  className="h-20 justify-start gap-4 px-4 text-left border-2"
                  onClick={() => handleRuntimeChange('python')}
                  disabled={loading}
                >
                  <Code2 className={`h-8 w-8 shrink-0 ${runtime === 'python' ? 'text-primary-foreground' : 'text-blue-500'}`} />
                  <div>
                    <div className="font-bold text-sm">Python 環境</div>
                    <div className="text-xs opacity-80 mt-0.5">Python 3.11 (pip install & start)</div>
                  </div>
                </Button>
              </div>
            </div>

            {/* Root Directory */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <FolderTree className="h-4 w-4 text-primary" /> 工作與子專案目錄
              </Label>
              <Input
                placeholder="/ (預設根目錄, 或子目錄如 /backend 或 ./src)"
                value={rootDir}
                onChange={(e) => setRootDir(e.target.value)}
                disabled={loading}
                className="font-mono text-xs h-10"
              />
              <p className="text-[11px] text-muted-foreground">如果您的 GitHub 儲存庫為 Monorepo，可在次處指定子專案資料夾路徑</p>
            </div>

            {/* Build & Start Command */}
            <div className="grid grid-cols-2 gap-4 items-start">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5 h-5">
                  <Hammer className="h-4 w-4 text-amber-500 shrink-0" /> 構建指令
                </Label>
                <Input
                  placeholder="npm run build or pip install -r requirements.txt"
                  value={buildCommand}
                  onChange={(e) => setBuildCommand(e.target.value)}
                  disabled={loading}
                  className="font-mono text-xs h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5 h-5">
                  <Play className="h-4 w-4 text-emerald-500 shrink-0" /> 運行指令
                </Label>
                <Input
                  value={startCommand}
                  onChange={(e) => setStartCommand(e.target.value)}
                  disabled={loading}
                  className="font-mono text-xs h-10"
                />
              </div>
            </div>

            {/* Internal Port */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">內部監聽 Port</Label>
              <Input
                type="number"
                value={internalPort}
                onChange={(e) => setInternalPort(Number(e.target.value))}
                disabled={loading}
                className="font-mono text-xs h-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Hardware Quota */}
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Server className="h-4 w-4 text-blue-500" /> 3. 算力與硬體資源限額
            </CardTitle>
            <CardDescription className="text-xs">
              調整 Docker 容器所分配的獨立 CPU 算力、記憶體與 SSD 儲存配額
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span>CPU 配額</span>
                <span className="font-mono text-primary font-bold text-sm">{cpuLimit}% (帳號剩餘額度: {remainingCpu}%)</span>
              </div>
              <Slider
                min={10}
                max={Math.max(10, remainingCpu)}
                step={5}
                value={[cpuLimit]}
                disabled={loading}
                onValueChange={(val) => setCpuLimit(val[0])}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span>記憶體限額</span>
                <span className="font-mono text-primary font-bold text-sm">{memoryLimit} MB (帳號剩餘額度: {remainingMemory}MB)</span>
              </div>
              <Slider
                min={64}
                max={Math.max(64, remainingMemory)}
                step={64}
                value={[memoryLimit]}
                disabled={loading}
                onValueChange={(val) => setMemoryLimit(val[0])}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span>SSD 硬碟空間</span>
                <span className="font-mono text-primary font-bold text-sm">{(diskLimit / 1024).toFixed(1)} GB ({diskLimit}MB) (帳號剩餘額度: {(remainingDisk / 1024).toFixed(1)}GB)</span>
              </div>
              <Slider
                min={512}
                max={Math.max(512, remainingDisk)}
                step={256}
                value={[diskLimit]}
                disabled={loading}
                onValueChange={(val) => setDiskLimit(val[0])}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t pt-5 bg-muted/10">
            <Button type="button" variant="outline" onClick={() => navigate('/')} disabled={loading}>
              取消並返回
            </Button>
            <Button type="submit" size="lg" disabled={loading} className="gap-2 font-bold px-8 shadow-md">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Rocket className="h-5 w-5" />}
              {loading ? '部署建立中...' : '立即部署並創建專案'}
            </Button>
          </CardFooter>
        </Card>
      </form>

      {/* Floating Action Toast Notification (Bottom Right) - Theme Adaptive */}
      {statusMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-none bg-card border border-border text-foreground shadow-2xl text-xs font-semibold backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300">
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
          <span className="font-mono">{statusMessage}</span>
        </div>
      )}
    </div>
  );
};
