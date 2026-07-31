import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AppSidebar } from './components/AppSidebar';
import { Footer } from './components/Footer';
import { LandingPage } from './pages/LandingPage';
import { PendingApproval } from './pages/PendingApproval';
import { UserDashboard } from './pages/UserDashboard';
import { NewInstancePage } from './pages/NewInstancePage';
import { AdminPanel } from './pages/AdminPanel';
import { ProjectLayout } from './layouts/ProjectLayout';
import { ProjectOverview } from './pages/project/ProjectOverview';
import { ProjectLogs } from './pages/project/ProjectLogs';
import { ProjectFiles } from './pages/project/ProjectFiles';
import { ProjectDeployments } from './pages/project/ProjectDeployments';
import { ProjectSettings } from './pages/project/ProjectSettings';
import { AccountSettings } from './pages/AccountSettings';
import { Wiki } from './pages/Wiki';
import { TermsModal } from './components/TermsModal';
import { User, Instance, PortRequest } from './types';
import { Loader2 } from 'lucide-react';

export const AppContent: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [instancesLoaded, setInstancesLoaded] = useState(false);
  const [portRequests, setPortRequests] = useState<PortRequest[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const location = useLocation();

  const refreshUserData = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    let effectiveToken = localStorage.getItem('cc_token');

    if (tokenFromUrl) {
      effectiveToken = tokenFromUrl;
      localStorage.setItem('cc_token', tokenFromUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const headers: Record<string, string> = effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {};

    fetch('/api/auth/me', { credentials: 'include', headers })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.user) {
          setCurrentUser(data.user);
        } else {
          setCurrentUser(null);
        }
        setLoading(false);
      })
      .catch(() => {
        setCurrentUser(null);
        setLoading(false);
      });
  };

  const refreshInstances = () => {
    const storedToken = localStorage.getItem('cc_token');
    const headers: Record<string, string> = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};

    const endpoint = currentUser?.role === 'ADMIN' ? '/api/admin/instances' : '/api/instances';

    fetch(endpoint, { credentials: 'include', headers })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data)) {
          setInstances(data);
        } else if (data && Array.isArray(data.instances)) {
          setInstances(data.instances);
        }
      })
      .catch(() => {})
      .finally(() => {
        setInstancesLoaded(true);
      });
  };

  const refreshAdminData = () => {
    if (currentUser?.role === 'ADMIN') {
      const storedToken = localStorage.getItem('cc_token');
      const headers: Record<string, string> = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};

      fetch('/api/admin/users', { credentials: 'include', headers })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (Array.isArray(data)) setAllUsers(data);
        })
        .catch(() => {});

      fetch('/api/admin/port-requests', { credentials: 'include', headers })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (Array.isArray(data)) setPortRequests(data);
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    refreshUserData();
  }, []);

  useEffect(() => {
    if (currentUser && currentUser.status === 'APPROVED') {
      refreshInstances();
      refreshAdminData();
    }
  }, [currentUser]);

  const handleDiscordLogin = () => {
    window.location.href = '/api/auth/discord/login';
  };

  const handleLogout = () => {
    localStorage.removeItem('cc_token');
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).finally(() => {
      setCurrentUser(null);
    });
  };

  const handleCreateInstance = async (data: any, onProgress?: (pct: number, loadedMB: number, totalMB: number) => void): Promise<string> => {
    const storedToken = localStorage.getItem('cc_token');
    const headers: Record<string, string> = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};

    let chunkedZipKey: string | undefined = undefined;

    // If uploading a ZIP file, use 5MB chunked slice upload for 100% network stability
    if (data.sourceType === 'zip' && data.zipFile) {
      const file: File = data.zipFile;
      const chunkSize = 5 * 1024 * 1024; // 5MB per slice
      const totalChunks = Math.ceil(file.size / chunkSize);
      const uploadId = `up_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const totalMB = parseFloat((file.size / (1024 * 1024)).toFixed(1));

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(file.size, start + chunkSize);
        const blobSlice = file.slice(start, end);

        const chunkFormData = new FormData();
        chunkFormData.append('uploadId', uploadId);
        chunkFormData.append('chunkIndex', String(i));
        chunkFormData.append('totalChunks', String(totalChunks));
        chunkFormData.append('chunk', blobSlice, `chunk_${i}`);

        // Upload chunk with automatic 3x retry on network error
        let success = false;
        let lastErr: any = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const chunkRes = await fetch('/api/upload/chunk', {
              method: 'POST',
              headers,
              body: chunkFormData,
            });
            if (chunkRes.ok) {
              success = true;
              break;
            } else {
              const errData = await chunkRes.json().catch(() => ({}));
              lastErr = new Error(errData.error || `Chunk ${i + 1}/${totalChunks} upload failed`);
            }
          } catch (e) {
            lastErr = e;
            await new Promise((r) => setTimeout(r, 1000));
          }
        }

        if (!success) {
          throw lastErr || new Error(`網絡傳輸中斷，上傳分片 ${i + 1}/${totalChunks} 失敗`);
        }

        if (onProgress) {
          const currentLoadedBytes = end;
          const pct = Math.round((currentLoadedBytes / file.size) * 100);
          const loadedMB = parseFloat((currentLoadedBytes / (1024 * 1024)).toFixed(1));
          onProgress(pct, loadedMB, totalMB);
        }
      }

      // Merge chunks into single ZIP file
      const mergeRes = await fetch('/api/upload/merge', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uploadId, totalChunks }),
      });

      if (!mergeRes.ok) {
        const mergeErr = await mergeRes.json().catch(() => ({}));
        throw new Error(mergeErr.error || '伺服器合併 ZIP 檔案失敗');
      }

      const mergeData = await mergeRes.json();
      chunkedZipKey = mergeData.chunkedZipKey;
    }

    // Submit instance creation request
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('runtime', data.runtime);
    formData.append('sourceType', data.sourceType);
    if (data.gitUrl) formData.append('gitUrl', data.gitUrl);
    if (chunkedZipKey) formData.append('chunkedZipKey', chunkedZipKey);
    if (data.rootDir) formData.append('rootDir', data.rootDir);
    if (data.dockerImage) formData.append('dockerImage', data.dockerImage);
    if (data.dockerRunCmd) formData.append('dockerRunCmd', data.dockerRunCmd);
    if (data.envVars && data.envVars.length > 0) formData.append('envVars', JSON.stringify(data.envVars));
    formData.append('startCommand', data.startCommand);
    formData.append('internalPort', String(data.internalPort));
    formData.append('cpuLimit', String(data.cpuLimit));
    formData.append('memoryLimit', String(data.memoryLimit));
    formData.append('diskLimit', String(data.diskLimit));

    const res = await fetch('/api/instances', {
      method: 'POST',
      headers,
      body: formData,
    });

    if (res.ok) {
      const resData = await res.json();
      refreshInstances();
      refreshAdminData();
      return resData.instanceId;
    } else {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || '建立機器失敗，請確認輸入內容與配額上限');
    }
  };

  const handleStartInstance = async (id: string) => {
    const storedToken = localStorage.getItem('cc_token');
    const headers: Record<string, string> = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};
    await fetch(`/api/instances/${id}/start`, { method: 'POST', headers });
    refreshInstances();
  };

  const handleStopInstance = async (id: string) => {
    const storedToken = localStorage.getItem('cc_token');
    const headers: Record<string, string> = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};
    await fetch(`/api/instances/${id}/stop`, { method: 'POST', headers });
    refreshInstances();
  };

  const handleRestartInstance = async (id: string) => {
    const storedToken = localStorage.getItem('cc_token');
    const headers: Record<string, string> = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};
    await fetch(`/api/instances/${id}/restart`, { method: 'POST', headers });
    refreshInstances();
  };

  const handleApproveUser = async (userId: string) => {
    const storedToken = localStorage.getItem('cc_token');
    const headers: Record<string, string> = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};
    await fetch(`/api/admin/users/${userId}/approve`, { method: 'POST', headers });
    refreshAdminData();
  };

  const handleRejectUser = async (userId: string) => {
    const storedToken = localStorage.getItem('cc_token');
    const headers: Record<string, string> = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};
    await fetch(`/api/admin/users/${userId}/reject`, { method: 'POST', headers });
    refreshAdminData();
  };

  const handleApprovePortRequest = async (requestId: string) => {
    const storedToken = localStorage.getItem('cc_token');
    const headers: Record<string, string> = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};
    await fetch(`/api/admin/port-requests/${requestId}/approve`, { method: 'POST', headers });
    refreshAdminData();
    refreshInstances();
  };

  const handleRejectPortRequest = async (requestId: string) => {
    const storedToken = localStorage.getItem('cc_token');
    const headers: Record<string, string> = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};
    await fetch(`/api/admin/port-requests/${requestId}/reject`, { method: 'POST', headers });
    refreshAdminData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-xs text-muted-foreground font-mono">
        Loading Craft-Core Hosting...
      </div>
    );
  }

  const projectMatch = location.pathname.match(/\/project\/([^\/]+)/);
  const activeProjectId = projectMatch ? projectMatch[1] : null;
  const activeProjectInstance = instances.find((i) => i.id === activeProjectId);

  const pendingUsers = allUsers.filter((u) => u.status === 'PENDING');

  // Filter instances strictly belonging to the currently logged in user
  const myInstances = currentUser
    ? instances.filter((i) => i.userId === currentUser.id)
    : [];

  const usedCpu = myInstances.reduce((acc, curr) => acc + curr.cpuLimit, 0);
  const usedMemory = myInstances.reduce((acc, curr) => acc + curr.memoryLimit, 0);
  const usedDisk = myInstances.reduce((acc, curr) => acc + (curr.diskLimit || 2048), 0);

  const TOTAL_CPU_QUOTA = 100;
  const TOTAL_MEMORY_QUOTA = 1024;
  const TOTAL_DISK_QUOTA = 4096;

  const remainingCpu = Math.max(0, TOTAL_CPU_QUOTA - usedCpu);
  const remainingMemory = Math.max(0, TOTAL_MEMORY_QUOTA - usedMemory);
  const remainingDisk = Math.max(0, TOTAL_DISK_QUOTA - usedDisk);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs font-mono text-muted-foreground">載入控制台 Session 中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {currentUser && currentUser.status === 'APPROVED' && (
        <AppSidebar user={currentUser} onLogout={handleLogout} activeProjectInstance={activeProjectInstance} />
      )}

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Routes>
          {!currentUser ? (
            <Route path="*" element={<LandingPage onDiscordLogin={handleDiscordLogin} />} />
          ) : currentUser.status === 'PENDING' ? (
            <Route path="*" element={<PendingApproval user={currentUser} onLogout={handleLogout} onRefresh={refreshUserData} />} />
          ) : (
            <>
              <Route
                path="/"
                element={
                  <UserDashboard
                    user={currentUser}
                    instances={myInstances}
                    portRequests={portRequests}
                    onCreateInstance={handleCreateInstance}
                    onRefreshData={refreshInstances}
                  />
                }
              />

              <Route
                path="/new"
                element={
                  <NewInstancePage
                    user={currentUser}
                    onSubmit={handleCreateInstance}
                    remainingCpu={remainingCpu}
                    remainingMemory={remainingMemory}
                    remainingDisk={remainingDisk}
                  />
                }
              />

              <Route
                path="/project/:id"
                element={
                  <ProjectLayout
                    instances={instances}
                    instancesLoaded={instancesLoaded}
                    onStart={handleStartInstance}
                    onStop={handleStopInstance}
                    onRestart={handleRestartInstance}
                    onRefreshData={refreshInstances}
                  />
                }
              >
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<ProjectOverview />} />
                <Route path="logs" element={<ProjectLogs />} />
                <Route path="terminal" element={<ProjectLogs />} />
                <Route path="files" element={<ProjectFiles />} />
                <Route path="deployments" element={<ProjectDeployments />} />
                <Route path="settings" element={<ProjectSettings />} />
              </Route>

              <Route path="/settings" element={<AccountSettings user={currentUser} onLogout={handleLogout} />} />

              <Route
                path="/admin"
                element={
                  currentUser.role === 'ADMIN' ? (
                    <AdminPanel
                      pendingUsers={pendingUsers}
                      allUsers={allUsers}
                      allInstances={instances}
                      onApproveUser={handleApproveUser}
                      onRejectUser={handleRejectUser}
                      onRefreshData={() => {
                        refreshAdminData();
                        refreshInstances();
                      }}
                    />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
        <Footer />
      </main>
      <TermsModal isOpen={!termsAccepted} onAccept={() => setTermsAccepted(true)} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ThemeProvider>
  );
};
