import { useState } from 'react';
import { 
  BarChart3, ShoppingBag, TrendingUp, User, Shield, 
  Settings, LogOut, Sun, Moon, Menu, X, Compass, Mail, ShieldAlert, Gift,
  Cpu, MapPin, Sparkles
} from 'lucide-react';
import { Button } from './ui/button';

interface DashboardLayoutProps {
  activeTab: 'home' | 'explorer' | 'market' | 'owner' | 'claims' | 'lockboxes' | 'inventory' | 'admin' | 'welfare' | 'fakeplayers' | 'teleports' | 'events';
  setActiveTab: (tab: 'home' | 'explorer' | 'market' | 'owner' | 'claims' | 'lockboxes' | 'inventory' | 'admin' | 'welfare' | 'fakeplayers' | 'teleports' | 'events') => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  token: string | null;
  username: string | null;
  userBalance: number;
  handleLogout: () => void;
  handleLoginTrigger: () => void;
  children: React.ReactNode;
  isAdmin?: boolean;
}

export default function DashboardLayout({
  activeTab,
  setActiveTab,
  isDarkMode,
  toggleTheme,
  token,
  username,
  userBalance,
  handleLogout,
  handleLoginTrigger,
  children,
  isAdmin = false
}: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigationItems = [
    { id: 'home', label: '數據總覽', icon: BarChart3 },
    { id: 'events', label: '伺服器活動', icon: Sparkles },
    { id: 'explorer', label: '商店導航', icon: ShoppingBag },
    { id: 'market', label: '市場行情', icon: TrendingUp },
    { id: 'owner', label: '店主遙控', icon: User },
    { id: 'claims', label: '領地管理', icon: Shield },
    { id: 'lockboxes', label: '密碼安全鎖', icon: Settings },
    { id: 'welfare', label: '簽到與抽獎', icon: Gift },
    { id: 'inventory', label: '郵局與背包', icon: Mail },
    ...(token ? [
      { id: 'fakeplayers', label: '假人控制', icon: Cpu },
      { id: 'teleports', label: '傳送點管理', icon: MapPin }
    ] : []),
    ...(isAdmin ? [{ id: 'admin', label: '管理主控台', icon: ShieldAlert }] : [])
  ];

  const currentTabLabel = navigationItems.find(item => item.id === activeTab)?.label || '';

  const handleTabClick = (tabId: typeof activeTab) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground transition-colors duration-200">
      
      {/* 1. 電腦版固定側邊欄 */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card shrink-0">
        {/* 標誌區域 */}
        <div className="h-16 flex items-center px-6 border-b border-border">
          <div className="flex items-center space-x-3 text-left">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-[4px]">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-wider leading-none text-foreground">
                CRAFT-CORE
              </h1>
              <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">
                官方伺服器儀表板
              </span>
            </div>
          </div>
        </div>

        {/* 導航選單 */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {navigationItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id as any)}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-[4px] text-xs font-bold transition-colors cursor-pointer ${
                  isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* 側邊欄底部 (切換主題) */}
        <div className="p-4 border-t border-border flex items-center justify-between">
          <span className="text-[10px] font-bold text-muted-foreground">切換顯示主題</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </aside>

      {/* 2. 右側主要內容區域 */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* 頂部導航欄 */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 md:px-8 shrink-0 z-30">
          
          {/* 行動版選單開關 & 頁面標題 */}
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden h-9 w-9 text-foreground"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
              {currentTabLabel}
            </h2>
          </div>

          {/* 右側登入狀態與主選單 */}
          <div className="flex items-center space-x-3">
            {token && username ? (
              <div className="flex items-center space-x-3 bg-muted/50 border border-border py-1 pl-3 pr-2 rounded-[4px]">
                <img 
                  src={`https://mc-heads.net/avatar/${username}/24`} 
                  alt={username}
                  className="w-6 h-6 rounded-[2px] border border-border"
                />
                <div className="text-left hidden sm:block">
                  <p className="text-[10px] font-bold leading-none text-foreground">{username}</p>
                  <p className="text-[9px] text-emerald-500 font-bold leading-none mt-1">餘額 ${userBalance.toLocaleString()} 元</p>
                </div>
                <Button 
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="登出系統"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <Button 
                onClick={handleLoginTrigger}
                variant="default"
                className="h-9 px-4 text-xs font-bold"
              >
                Discord 帳號登入
              </Button>
            )}
          </div>
        </header>

        {/* 頁面主要內容 */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* 3. 行動版抽屜式導航欄 */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-64 bg-card border-r border-border h-full flex flex-col justify-between py-6 px-4 animate-in slide-in-from-left duration-200">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-primary text-primary-foreground p-1.5 rounded-[4px]">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <h1 className="text-sm font-black tracking-wider leading-none text-foreground">
                      CRAFT-CORE
                    </h1>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileMenuOpen(false)}
                  className="h-8 w-8 text-foreground"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <nav className="space-y-1">
                {navigationItems.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTabClick(item.id as any)}
                      className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-[4px] text-xs font-bold transition-colors cursor-pointer ${
                        isActive 
                          ? 'bg-primary text-primary-foreground' 
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="border-t border-border pt-4 flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground">主題切換</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
