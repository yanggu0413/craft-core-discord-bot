import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Instance } from '../../types';
import { Terminal, Trash2, Pause, Play, Copy, Check, Send, RefreshCw, Wrench, Code2 } from 'lucide-react';

export const ProjectLogs: React.FC = () => {
  const { instance } = useOutletContext<{ instance: Instance }>();
  const [logs, setLogs] = useState<string[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Command Execution State
  const [command, setCommand] = useState('');
  const [executing, setExecuting] = useState(false);
  const [execOutputs, setExecOutputs] = useState<
    { id: string; cmd: string; output: string; exitCode: number; time: string }[]
  >([]);

  const storedToken = localStorage.getItem('cc_token');
  const headers: Record<string, string> = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};

  const fetchLogs = () => {
    fetch(`/api/instances/${instance.id}/logs`, { credentials: 'include', headers })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.logs === 'string') {
          const lines = data.logs.split('\n').filter(Boolean);
          setLogs(lines);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(() => {
      if (!isPaused) {
        fetchLogs();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [instance.id, isPaused]);

  useEffect(() => {
    if (!isPaused && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isPaused]);

  const handleCopy = () => {
    const allText = logs.join('\n');
    navigator.clipboard.writeText(allText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearLogs = async () => {
    setLogs([]);
    setExecOutputs([]);
    try {
      await fetch(`/api/instances/${instance.id}/logs`, {
        method: 'DELETE',
        headers,
      });
    } catch (err) {
      console.error('Failed to clear logs:', err);
    }
  };

  const handleExec = async (cmdToRun?: string) => {
    const targetCmd = cmdToRun || command;
    if (!targetCmd || !targetCmd.trim() || executing) return;

    setExecuting(true);
    const cmdStr = targetCmd.trim();

    try {
      const res = await fetch(`/api/instances/${instance.id}/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({ command: cmdStr }),
      });

      const data = await res.json();

      const newResult = {
        id: Math.random().toString(36).substring(2),
        cmd: cmdStr,
        output: data.output || (data.error ? `[ERROR] ${data.error}` : '(無輸出內容)'),
        exitCode: data.exitCode ?? (res.ok ? 0 : 1),
        time: new Date().toLocaleTimeString(),
      };

      setExecOutputs((prev) => [...prev, newResult]);
      if (!cmdToRun) setCommand('');
    } catch (err: any) {
      setExecOutputs((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2),
          cmd: cmdStr,
          output: `[網絡錯誤] ${err.message}`,
          exitCode: 1,
          time: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setExecuting(false);
    }
  };

  const quickCommands = [
    { label: '測試啟動 node bot.js', cmd: 'node bot.js' },
    { label: '安裝套件 npm install', cmd: 'npm install --force' },
    { label: '安裝系統套件 apt', cmd: 'apt update && apt install -y python3 make g++' },
    { label: '環境檢測', cmd: 'node -v && python3 --version' },
    { label: '列出檔案 ls', cmd: 'ls -la /app' },
    { label: '進程狀態 ps', cmd: 'ps aux' },
  ];

  return (
    <div className="space-y-4">
      {/* Upper Interactive Command Execution Card */}
      <Card className="shadow-sm border border-border bg-card text-card-foreground">
        <CardHeader className="py-3 px-4 border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Code2 className="h-4 w-4 text-primary" /> 互動控制台命令
            </CardTitle>
            <span className="text-[11px] text-muted-foreground font-mono">
              狀態: <span className={instance.status === 'running' ? 'text-emerald-500 font-bold' : 'text-muted-foreground'}>{instance.status}</span>
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleExec();
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <span className="absolute left-3 top-2.5 text-xs font-mono text-muted-foreground select-none">
                craft-core:app$
              </span>
              <Input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="輸入 Linux 指令，如: node bot.js 或 npm install"
                disabled={executing}
                className="pl-32 font-mono text-xs bg-background text-foreground border-input"
              />
            </div>
            <Button type="submit" disabled={executing || !command.trim()} className="gap-2 shrink-0 h-9">
              {executing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {executing ? '執行中...' : '送出指令'}
            </Button>
          </form>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1 shrink-0">
              <Wrench className="h-3 w-3" /> 常用修復:
            </span>
            {quickCommands.map((item, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                disabled={executing}
                onClick={() => handleExec(item.cmd)}
                className="text-[11px] font-mono py-0.5 px-2 h-7 bg-muted/40 hover:bg-primary/10 hover:text-primary transition-colors border"
              >
                {item.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Unified Real-time Logs & Exec Terminal Output Stream */}
      <Card className="flex flex-col h-[60vh] border border-border shadow-sm overflow-hidden bg-card text-card-foreground">
        <CardHeader className="py-2.5 px-4 bg-muted/40 border-b border-border flex flex-row items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Terminal className="h-4 w-4 text-primary" />
            <span>即時日誌與控制台串流</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setIsPaused(!isPaused)}>
              {isPaused ? <Play className="h-3.5 w-3.5 text-amber-500" /> : <Pause className="h-3.5 w-3.5 text-emerald-500" />}
              {isPaused ? '已暫停' : '即時連線'}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              複製
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:bg-destructive/10" onClick={handleClearLogs}>
              <Trash2 className="h-3.5 w-3.5" /> 清空
            </Button>
          </div>
        </CardHeader>

        <CardContent ref={logContainerRef} className="flex-1 bg-muted/20 dark:bg-slate-950 text-foreground dark:text-slate-100 p-4 font-mono text-xs overflow-y-auto space-y-2 select-text border-t border-border/40">
          {/* Interactive Exec Command Outputs */}
          {execOutputs.map((item) => (
            <div key={item.id} className="border-b border-border/60 pb-2 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">$ {item.cmd}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{item.time}</span>
                  <Badge
                    variant="outline"
                    className={`text-[9px] font-mono ${
                      item.exitCode === 0
                        ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                        : 'border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10'
                    }`}
                  >
                    Exit Code: {item.exitCode}
                  </Badge>
                </div>
              </div>
              <pre className="p-2.5 rounded bg-muted/60 dark:bg-slate-900/80 text-foreground dark:text-slate-200 text-[11px] leading-relaxed whitespace-pre-wrap word-break-all border border-border/40">
                {item.output}
              </pre>
            </div>
          ))}

          {/* Container Stdout/Stderr Log Stream */}
          {logs.length === 0 && execOutputs.length === 0 ? (
            <div className="text-muted-foreground italic py-12 text-center text-xs">
              等待容器日誌流或命令執行結果...
            </div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="leading-relaxed whitespace-pre-wrap break-all hover:bg-muted/40 rounded px-1">
                {log.includes('ERROR') || log.includes('Exception') || log.includes('npm error') ? (
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">{log}</span>
                ) : log.includes('SUCCESS') || log.includes('listening') || log.includes('npm warn') ? (
                  <span className="text-amber-600 dark:text-amber-300">{log}</span>
                ) : (
                  <span className="text-foreground dark:text-slate-300">{log}</span>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};
