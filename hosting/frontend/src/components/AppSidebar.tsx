import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { User } from '../types';
import { useTheme } from '../context/ThemeContext';
import {
  Server,
  LayoutDashboard,
  ShieldCheck,
  Settings,
  LogOut,
  Sun,
  Moon,
  Terminal,
  Folder,
  GitBranch,
  ArrowLeft,
  Key,
  Rocket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AppSidebarProps {
  user: User | null;
  onLogout: () => void;
  activeProjectInstance?: any;
}

const UserAvatar: React.FC<{ user: User }> = ({ user }) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="h-7 w-7 rounded-full shrink-0 border bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase overflow-hidden">
      {user.avatar && !imgError ? (
        <img
          src={user.avatar}
          alt={user.username}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{user.username.charAt(0)}</span>
      )}
    </div>
  );
};

export const AppSidebar: React.FC<AppSidebarProps> = ({ user, onLogout, activeProjectInstance }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const isProjectPage = location.pathname.startsWith('/project/');
  const projectId = activeProjectInstance?.id;

  return (
    <aside className="w-60 bg-card border-r border-border flex flex-col justify-between shrink-0 select-none h-screen sticky top-0">
      {/* Top Header Logo */}
      <div>
        <div className="p-4 border-b border-border flex items-center gap-2.5">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-sm">
              <Server className="h-4 w-4" />
            </div>
            <div>
              <div className="font-bold text-sm leading-none tracking-tight">Craft-Core</div>
              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">Hosting Platform</div>
            </div>
          </Link>
        </div>

        {/* Dynamic Navigation Content */}
        <div className="p-3 space-y-6 overflow-y-auto max-h-[calc(100vh-130px)]">
          {/* Project Specific Sidebar Navigation */}
          {isProjectPage && activeProjectInstance ? (
            <div className="space-y-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="w-full justify-start text-xs text-muted-foreground hover:text-foreground gap-2"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> 返回機器總覽
              </Button>

              <div className="px-3 py-2 rounded-lg bg-muted/40 border flex items-center justify-between">
                <div className="text-xs font-bold truncate">{activeProjectInstance.name}</div>
                {user?.role === 'ADMIN' && (
                  <span className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-mono font-bold">
                    ADMIN
                  </span>
                )}
              </div>

              <div className="space-y-1 pt-1">
                <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">專案選單</div>

                <Link
                  to={`/project/${projectId}/overview`}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    location.pathname.endsWith('/overview') ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>總覽</span>
                </Link>

                <Link
                  to={`/project/${projectId}/logs`}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    location.pathname.endsWith('/logs') ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <Terminal className="h-4 w-4" />
                  <span>即時日誌</span>
                </Link>

                <Link
                  to={`/project/${projectId}/files`}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    location.pathname.endsWith('/files') ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <Folder className="h-4 w-4" />
                  <span>工作區檔案</span>
                </Link>

                <Link
                  to={`/project/${projectId}/deployments`}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    location.pathname.endsWith('/deployments') ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <GitBranch className="h-4 w-4" />
                  <span>GitHub 部署</span>
                </Link>

                <Link
                  to={`/project/${projectId}/settings`}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    location.pathname.endsWith('/settings') ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <Settings className="h-4 w-4" />
                  <span>專案設定</span>
                </Link>
              </div>
            </div>
          ) : (
            /* Main Dashboard Navigation */
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">託管管理</div>
                <Link
                  to="/"
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    location.pathname === '/' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <Server className="h-4 w-4" />
                  <span>託管機器總覽</span>
                </Link>



                <Link
                  to="/settings"
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    location.pathname === '/settings' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <Key className="h-4 w-4" />
                  <span>個人帳戶 & API Token</span>
                </Link>
              </div>

              {/* Admin Section */}
              {user?.role === 'ADMIN' && (
                <div className="space-y-1 pt-2 border-t border-border">
                  <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-amber-500">管理員主控台</div>
                  <Link
                    to="/admin"
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                      location.pathname === '/admin' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    <ShieldCheck className="h-4 w-4 text-amber-500" />
                    <span>全服遙控與安全審計</span>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom User Footer */}
      <div className="p-3 border-t border-border space-y-2 bg-muted/20">
        {user ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <UserAvatar user={user} />
              <div className="min-w-0">
                <div className="text-xs font-bold truncate leading-tight">{user.username}</div>
                <div className="text-[10px] text-muted-foreground truncate uppercase">{user.role}</div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={toggleTheme} title="Toggle theme">
                {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onLogout} title="Logout">
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground text-center">未登入</div>
        )}
      </div>
    </aside>
  );
};
