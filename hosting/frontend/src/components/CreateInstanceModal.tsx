import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RuntimeType } from '../types';
import { Server, Code2, GitBranch, Upload, AlertCircle, FileArchive, CheckCircle2, Loader2, FolderTree, Hammer, Play } from 'lucide-react';

interface CreateInstanceModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  }) => Promise<void> | void;
  remainingCpu: number;
  remainingMemory: number;
  remainingDisk: number;
}

export const CreateInstanceModal: React.FC<CreateInstanceModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  remainingCpu,
  remainingMemory,
  remainingDisk,
}) => {
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
  const [error, setError] = useState('');

  if (!isOpen) return null;

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
      setError('請選擇或拖拽 ZIP 壓縮包檔案');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const payload = {
        name,
        runtime,
        sourceType,
        gitUrl: sourceType === 'git' ? gitUrl : undefined,
        zipFile: sourceType === 'zip' && zipFile ? zipFile : undefined,
        rootDir: rootDir.trim() || '/',
        buildCommand: buildCommand.trim() || undefined,
        startCommand,
        internalPort,
        cpuLimit,
        memoryLimit,
        diskLimit,
      };

      onClose();
      await onSubmit(payload);
    } catch (err: any) {
      setError(err.message || '建立機器失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            <DialogTitle className="text-lg font-bold">建立新託管機器 (Create Instance)</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            自訂 GitHub 儲存庫 URL 或上傳 ZIP 部署包建立專案機器
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Name */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">專案名稱 (Project Name)</Label>
            <Input
              placeholder="e.g. my-backend-service"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-xs font-mono"
            />
          </div>

          {/* Runtime Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">執行環境 (Runtime)</Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={runtime === 'nodejs' ? 'default' : 'outline'}
                className="h-16 justify-start gap-3 text-left"
                onClick={() => handleRuntimeChange('nodejs')}
              >
                <Code2 className="h-6 w-6 text-emerald-500 shrink-0" />
                <div>
                  <div className="font-bold text-xs">Node.js</div>
                  <div className="text-[10px] opacity-80">npm install & run</div>
                </div>
              </Button>

              <Button
                type="button"
                variant={runtime === 'python' ? 'default' : 'outline'}
                className="h-16 justify-start gap-3 text-left"
                onClick={() => handleRuntimeChange('python')}
              >
                <Code2 className="h-6 w-6 text-blue-500 shrink-0" />
                <div>
                  <div className="font-bold text-xs">Python</div>
                  <div className="text-[10px] opacity-80">pip install & run</div>
                </div>
              </Button>
            </div>
          </div>

          {/* Source Type Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">部署程式碼來源 (Deployment Source)</Label>
            <Tabs value={sourceType} onValueChange={(val) => setSourceType(val as 'git' | 'zip')}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="git" className="text-xs gap-1.5">
                  <GitBranch className="h-3.5 w-3.5" /> GitHub Repo URL
                </TabsTrigger>
                <TabsTrigger value="zip" className="text-xs gap-1.5">
                  <Upload className="h-3.5 w-3.5" /> ZIP 檔案部署包
                </TabsTrigger>
              </TabsList>

              <TabsContent value="git" className="space-y-2 pt-2">
                <Input
                  placeholder="https://github.com/user/repository"
                  value={gitUrl}
                  onChange={(e) => setGitUrl(e.target.value)}
                  className="font-mono text-xs"
                />
              </TabsContent>

              <TabsContent value="zip" className="pt-2">
                <label className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-accent/40 transition-all">
                  {zipFile ? (
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                      <CheckCircle2 className="h-5 w-5" />
                      <span>已選擇 ZIP: {zipFile.name} ({(zipFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  ) : (
                    <>
                      <FileArchive className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-xs font-semibold text-foreground">點擊或將 .zip 壓縮包拖拽至此處</span>
                      <span className="text-[10px] text-muted-foreground mt-1">支援包含 package.json 或 requirements.txt 之專案包</span>
                    </>
                  )}
                  <input type="file" accept=".zip" onChange={handleFileDrop} className="hidden" />
                </label>
              </TabsContent>
            </Tabs>
          </div>

          {/* Root Directory / Subfolder Field */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold flex items-center gap-1">
              <FolderTree className="h-3.5 w-3.5 text-primary" /> 工作/子專案目錄 (Root Directory / Subdirectory)
            </Label>
            <Input
              placeholder="/ or /backend or ./src (預設根目錄 /)"
              value={rootDir}
              onChange={(e) => setRootDir(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">若儲存庫包含多個子專案，可填寫該子專案資料夾路徑</p>
          </div>

          {/* Build Command & Start Command */}
          <div className="grid grid-cols-2 gap-3 items-start">
            <div className="space-y-1">
              <Label className="text-xs font-semibold flex items-center gap-1.5 h-5">
                <Hammer className="h-3.5 w-3.5 text-amber-500 shrink-0" /> 構建指令 (Build CMD)
              </Label>
              <Input
                placeholder="npm run build"
                value={buildCommand}
                onChange={(e) => setBuildCommand(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold flex items-center gap-1.5 h-5">
                <Play className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> 運行指令 (Start CMD)
              </Label>
              <Input
                value={startCommand}
                onChange={(e) => setStartCommand(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>

          {/* Internal Port */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">內部 Port (Internal Port)</Label>
            <Input
              type="number"
              value={internalPort}
              onChange={(e) => setInternalPort(Number(e.target.value))}
              className="font-mono text-xs"
            />
          </div>

          {/* Quota Sliders */}
          <div className="space-y-3 p-3 rounded-lg border bg-muted/20">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span>CPU 配額</span>
                <span className="font-mono text-primary font-bold">{cpuLimit}% (可用剩餘: {remainingCpu}%)</span>
              </div>
              <Slider
                min={10}
                max={Math.max(10, remainingCpu)}
                step={5}
                value={[cpuLimit]}
                onValueChange={(val) => setCpuLimit(val[0])}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span>RAM 限額</span>
                <span className="font-mono text-primary font-bold">{memoryLimit} MB (可用剩餘: {remainingMemory}MB)</span>
              </div>
              <Slider
                min={64}
                max={Math.max(64, remainingMemory)}
                step={64}
                value={[memoryLimit]}
                onValueChange={(val) => setMemoryLimit(val[0])}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span>硬碟空間限額 (Disk Limit)</span>
                <span className="font-mono text-primary font-bold">{(diskLimit / 1024).toFixed(1)} GB ({diskLimit}MB) (可用剩餘: {(remainingDisk / 1024).toFixed(1)}GB)</span>
              </div>
              <Slider
                min={512}
                max={Math.max(512, remainingDisk)}
                step={256}
                value={[diskLimit]}
                onValueChange={(val) => setDiskLimit(val[0])}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              取消
            </Button>
            <Button type="submit" disabled={loading} className="gap-2 font-bold">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? '部署建立中...' : '部署建立機器'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
