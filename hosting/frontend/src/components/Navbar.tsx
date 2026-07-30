import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { User } from '../types';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Server, LogOut, ShieldAlert } from 'lucide-react';

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="border-b bg-card sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="h-9 w-9 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold shadow-inner">
            <Server className="h-5 w-5" />
          </div>
          <span className="font-bold text-lg text-foreground tracking-tight">
            Craft-Core Hosting
          </span>
        </div>

        {/* Navigation Links */ }
        <div className="flex items-center gap-2">
          {user && user.status === 'APPROVED' && (
            <div className="flex items-center bg-muted p-1 rounded-md border text-xs">
              <Button
                variant={isActive('/') ? 'default' : 'ghost'}
                size="sm"
                onClick={() => navigate('/')}
                className="text-xs h-8"
              >
                專案列表
              </Button>

              {user.role === 'ADMIN' && (
                <Button
                  variant={isActive('/admin') ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => navigate('/admin')}
                  className="text-xs h-8 gap-1.5"
                >
                  <ShieldAlert className={`h-3.5 w-3.5 ${isActive('/admin') ? 'text-primary-foreground' : 'text-foreground'}`} />
                  管理後台
                </Button>
              )}
            </div>
          )}

          {/* Theme Switcher */}
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={toggleTheme} title={`Toggle Theme (${theme})`}>
            {theme === 'light' ? <Moon className="h-4 w-4 text-slate-700" /> : <Sun className="h-4 w-4 text-amber-400" />}
          </Button>

          {/* User Profile & Account Settings */}
          {user ? (
            <div className="flex items-center gap-2 pl-2 border-l">
              <Button
                variant={isActive('/settings') ? 'default' : 'ghost'}
                size="sm"
                onClick={() => navigate('/settings')}
                className="flex items-center gap-2 h-9 px-2.5 overflow-hidden"
              >
                {user.avatar ? (
                  <img src={user.avatar} alt={user.username} className="h-6 w-6 min-w-6 min-h-6 max-h-6 max-w-6 rounded-full border object-cover shrink-0" />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                    {user.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-semibold hidden md:inline truncate">{user.username}</span>
              </Button>

              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onLogout} title="Logout">
                <LogOut className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
};
