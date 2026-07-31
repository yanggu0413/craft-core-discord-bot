import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Instance, DeploymentCommit } from '../../types';
import { GitCommit, RotateCcw, CheckCircle2, RefreshCw, GitBranch } from 'lucide-react';

export const ProjectDeployments: React.FC = () => {
  const { instance } = useOutletContext<{ instance: Instance }>();
  const [commits, setCommits] = useState<DeploymentCommit[]>([]);
  const [loading, setLoading] = useState(true);
  const [rollingBackHash, setRollingBackHash] = useState<string | null>(null);

  const fetchDeployments = () => {
    setLoading(true);
    const storedToken = localStorage.getItem('cc_token');
    const headers: Record<string, string> = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};

    fetch(`/api/instances/${instance.id}/deployments`, { credentials: 'include', headers })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.deployments)) {
          setCommits(data.deployments);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchDeployments();
  }, [instance.id]);

  const handleRollback = async (commitHash: string) => {
    setRollingBackHash(commitHash);
    try {
      const storedToken = localStorage.getItem('cc_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {}),
      };

      const res = await fetch(`/api/instances/${instance.id}/rollback`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ commitHash }),
      });
      if (res.ok) {
        fetchDeployments();
      }
    } catch (err) {
      console.error('Rollback error:', err);
    } finally {
      setRollingBackHash(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-bold">過往部署紀錄</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={fetchDeployments} title="Refresh">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Badge variant="outline" className="font-mono text-xs">
                Branch: main
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-xs text-muted-foreground font-mono">載入中...</div>
          ) : commits.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">尚無過往 Git 部署紀錄</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Commit</TableHead>
                  <TableHead>提交訊息 (Message)</TableHead>
                  <TableHead>作者 (Author)</TableHead>
                  <TableHead>部署時間</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead className="text-right">還原操作 (Rollback)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commits.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs font-bold text-primary flex items-center gap-1.5">
                      <GitCommit className="h-3.5 w-3.5" />
                      {c.commitHash}
                    </TableCell>
                    <TableCell className="text-xs font-semibold">{c.commitMessage}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.author}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{c.timestamp}</TableCell>
                    <TableCell>
                      {c.isCurrent ? (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> 目前運行
                        </Badge>
                      ) : (
                        <Badge variant="outline">SUCCESS</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.isCurrent ? (
                        <span className="text-xs text-muted-foreground italic">目前版本</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={rollingBackHash === c.commitHash}
                          onClick={() => handleRollback(c.commitHash)}
                          className="gap-1 text-xs"
                        >
                          {rollingBackHash === c.commitHash ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5 text-amber-500" />
                          )}
                          {rollingBackHash === c.commitHash ? '還原中...' : '還原至此 Commit'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
