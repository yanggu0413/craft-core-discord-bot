import { useState } from 'react';
import { 
  BarChart3, ShoppingBag, TrendingUp, User, Shield, 
  Settings, LogOut, Sun, Moon, Menu, X, Compass, Mail, Gift,
  Cpu, MapPin, Sparkles, BookOpen, CheckSquare, Coins, Key, FileText, Megaphone, HardDrive, MessageSquare, Search
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export type TabType = 
  | 'home' | 'tasks' | 'events' 
  | 'explorer' | 'market' | 'owner' 
  | 'claims' | 'lockboxes' 
  | 'welfare' | 'inventory' 
  | 'teleports' | 'fakeplayers' 
  | 'admin_audit' | 'admin_transactions' | 'admin_announcements' | 'admin_backups' | 'admin_tickets';

interface DashboardLayoutProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  token: string | null;
  username: string | null;
  userBalance: number;
  keysCount?: number;
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
  keysCount = 0,
  handleLogout,
  handleLoginTrigger,
  children,
  isAdmin = false
}: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigationCategories = [
    {
      title: '核心與動態',
      items: [
        { id: 'home' as TabType, label: '數據總覽', icon: BarChart3 },
        { id: 'tasks' as TabType, label: '每日任務', icon: CheckSquare },
        { id: 'events' as TabType, label: '限時活動', icon: Sparkles }
      ]
    },
    {
      title: '經濟與市場',
      items: [
        { id: 'explorer' as TabType, label: '商店導航', icon: ShoppingBag },
        { id: 'market' as TabType, label: '市場行情', icon: TrendingUp },
        { id: 'owner' as TabType, label: '店主遙控', icon: User }
      ]
    },
    {
      title: '領地與安全',
      items: [
        { id: 'claims' as TabType, label: '領地劃分', icon: Shield },
        { id: 'lockboxes' as TabType, label: '密碼保險箱', icon: Settings }
      ]
    },
    {
      title: '福利與郵件',
      items: [
        { id: 'welfare' as TabType, label: '簽到與抽獎', icon: Gift },
        { id: 'inventory' as TabType, label: '郵局與背包', icon: Mail }
      ]
    },
    ...(token ? [{
      title: '遊戲快捷',
      items: [
        { id: 'teleports' as TabType, label: '傳送與地標', icon: MapPin },
        { id: 'fakeplayers' as TabType, label: '假人控制', icon: Cpu }
      ]
    }] : []),
    ...(isAdmin ? [{
      title: '系統管理專區',
      items: [
        { id: 'admin_audit' as TabType, label: '玩家查帳與處分', icon: Search },
        { id: 'admin_transactions' as TabType, label: '交易日誌稽核', icon: FileText },
        { id: 'admin_announcements' as TabType, label: '全服公告發送', icon: Megaphone },
        { id: 'admin_backups' as TabType, label: '地圖備份管理', icon: HardDrive },
        { id: 'admin_tickets' as TabType, label: '工單對話歸檔', icon: MessageSquare }
      ]
    }] : [])
  ];

  const allItems = navigationCategories.flatMap(cat => cat.items);
  const currentItem = allItems.find(item => item.id === activeTab);
  const currentTabLabel = currentItem?.label || '儀表板';

  const handleTabClick = (item: any) => {
    setActiveTab(item.id);
    setMobileMenuOpen(false);
  };

  const renderNavSection = () => (
    <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
      {navigationCategories.map((cat) => (
        <div key={cat.title} className="space-y-1">
          <p className="text-[10px] font-bold uppercase text-muted-foreground/80 tracking-wider px-3 py-1 text-left">
            {cat.title}
          </p>
          {cat.items.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  isActive 
                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold' 
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen flex bg-background text-foreground transition-colors duration-200">
      
      {/* 1. 電腦版固定側邊欄 */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <div className="flex items-center space-x-3 text-left">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-md">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wider leading-none text-foreground">
                CRAFT-CORE
              </h1>
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-tight">
                伺服器管理網頁
              </span>
            </div>
          </div>
        </div>

        {renderNavSection()}

        <div className="p-4 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">顯示主題</span>
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
        
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 md:px-8 shrink-0 z-30">
          
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden h-9 w-9 text-foreground"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold tracking-tight text-foreground">
                {currentTabLabel}
              </h2>
              {isAdmin && activeTab.startsWith('admin_') && (
                <Badge variant="outline" className="text-[10px]">管理員主控</Badge>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {token && username ? (
              <div className="flex items-center space-x-3 bg-muted/40 border border-border py-1 px-3 rounded-lg">
                <img 
                  src={`https://mc-heads.net/avatar/${username}/24`} 
                  alt={username}
                  className="w-6 h-6 rounded-md border border-border shrink-0"
                />
                <div className="text-left hidden sm:flex items-center space-x-3 text-xs font-mono">
                  <span className="font-bold text-foreground">{username}</span>
                  <span className="text-border">|</span>
                  <span className="flex items-center text-foreground font-semibold">
                    <Coins className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                    ${Math.floor(userBalance).toLocaleString()}
                  </span>
                  <span className="flex items-center text-foreground font-semibold">
                    <Key className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                    {keysCount}
                  </span>
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
                size="sm"
                className="text-xs font-semibold"
              >
                帳號登入
              </Button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col justify-between">
          <div className="flex-1 max-w-7xl w-full mx-auto">
            {children}
          </div>
          <footer className="mt-12 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground max-w-7xl w-full mx-auto">
            <p>© 2026 Craft-Core Minecraft 伺服器生態系統 版權所有</p>
            <div className="flex items-center space-x-4">
              <a 
                href="/docs/" 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center space-x-1.5 hover:text-foreground transition-colors font-medium"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>官方說明文檔</span>
              </a>
            </div>
          </footer>
        </main>
      </div>

      {/* 3. 行動版選單 Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-black/60 backdrop-blur-xs">
          <div className="w-64 bg-card border-r border-border h-full flex flex-col justify-between py-6 px-2">
            <div className="space-y-4 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between px-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-primary text-primary-foreground p-1.5 rounded-md">
                    <Compass className="w-4 h-4" />
                  </div>
                  <h1 className="text-sm font-bold tracking-wider text-foreground">
                    CRAFT-CORE
                  </h1>
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

              {renderNavSection()}
            </div>

            <div className="border-t border-border pt-4 px-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">主題切換</span>
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
