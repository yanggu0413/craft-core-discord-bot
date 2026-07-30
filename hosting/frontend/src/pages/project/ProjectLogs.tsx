import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Instance } from '../../types';
import { Terminal, Trash2, Pause, Play, Copy, Check } from 'lucide-react';

export const ProjectLogs: React.FC = () => {
  const { instance } = useOutletContext<{ instance: Instance }>();
  const [logs, setLogs] = useState<string[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const fetchLogs = () => {
    const storedToken = localStorage.getItem('cc_token');
    const headers: Record<string, string> = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};

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
    if (!isPaused) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isPaused]);

  const handleCopy = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearLogs = async () => {
    setLogs([]);
    try {
      const storedToken = localStorage.getItem('cc_token');
      const headers: Record<string, string> = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};

      await fetch(`/api/instances/${instance.id}/logs`, {
        method: 'DELETE',
        headers,
      });
    } catch (err) {
      console.error('Failed to clear logs:', err);
    }
  };

  return (
    <Card className="flex flex-col h-[70vh] border shadow-sm">
      <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Terminal className="h-4 w-4 text-emerald-500" />
          <span>即時日誌流 (Real-time Container Terminal Logs)</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setIsPaused(!isPaused)}>
            {isPaused ? <Play className="h-3.5 w-3.5 text-amber-500" /> : <Pause className="h-3.5 w-3.5 text-emerald-500" />}
            {isPaused ? 'Paused' : 'Live'}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={handleCopy}>
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            Copy
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:bg-destructive/10" onClick={handleClearLogs}>
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 bg-slate-950 text-slate-100 p-4 font-mono text-xs overflow-y-auto space-y-1 select-text">
        {logs.length === 0 ? (
          <div className="text-slate-600 italic py-8 text-center">No logs emitted yet...</div>
        ) : (
          logs.map((log, idx) => (
            <div key={idx} className="leading-relaxed whitespace-pre-wrap break-all hover:bg-slate-900/50 rounded px-1">
              {log.includes('ERROR') || log.includes('Exception') ? (
                <span className="text-rose-400">{log}</span>
              ) : log.includes('SUCCESS') || log.includes('listening') ? (
                <span className="text-emerald-400">{log}</span>
              ) : (
                <span className="text-slate-300">{log}</span>
              )}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </CardContent>
    </Card>
  );
};
