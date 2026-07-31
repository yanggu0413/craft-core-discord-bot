import { useState, useEffect } from 'react';
import { Copy, Search, Star, Cpu, Sparkles, RefreshCw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import MinecraftItemIcon from '../ui/MinecraftItemIcon';

interface ChestShop {
  location: string;
  owner: string;
  item: string;
  stock: number;
  buy_price: number;
  sell_price: number;
  custom_name?: string;
  rating?: number;
  rating_count?: number;
}

interface ExplorerViewProps {
  shops: ChestShop[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortBy: 'price_asc' | 'price_desc' | 'stock_desc';
  setSortBy: (sort: 'price_asc' | 'price_desc' | 'stock_desc') => void;
  handleCopyTpCommand: (location: string) => void;
  API_URL?: string;
}

export default function ExplorerView({
  shops,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  handleCopyTpCommand,
  API_URL = ''
}: ExplorerViewProps) {
  const [activeTab, setActiveTab] = useState<'shops' | 'machines' | 'treasure'>('shops');
  const [machines, setMachines] = useState<any[]>([]);
  const [treasureHints, setTreasureHints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!API_URL) return;
    const fetchExtraData = async () => {
      setLoading(true);
      try {
        if (activeTab === 'machines') {
          const res = await fetch(`${API_URL}/machines`);
          const data = await res.json();
          if (data.success) {
            setMachines(Object.values(data.machines || {}));
          }
        } else if (activeTab === 'treasure') {
          const res = await fetch(`${API_URL}/treasure/hints`);
          const data = await res.json();
          if (data.success) {
            setTreasureHints(data.hints || []);
          }
        }
      } catch (e) {
        console.error('Error fetching explorer tab data:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchExtraData();
  }, [activeTab, API_URL]);

  // 過濾與排序邏輯
  const filteredShops = (shops || [])
    .filter(shop => {
      if (!shop) return false;
      const cleanItem = (shop.item || '').replace('minecraft:', '').toLowerCase();
      const customName = (shop.custom_name || '').toLowerCase();
      const owner = (shop.owner || '').toLowerCase();
      const query = (searchQuery || '').toLowerCase();
      return cleanItem.includes(query) || customName.includes(query) || owner.includes(query);
    })
    .sort((a, b) => {
      if (sortBy === 'price_asc') return a.buy_price - b.buy_price;
      if (sortBy === 'price_desc') return b.buy_price - a.buy_price;
      if (sortBy === 'stock_desc') return b.stock - a.stock;
      return 0;
    });

  return (
    <div className="space-y-6">
      {/* 分頁切換選單 */}
      <div className="flex items-center space-x-2 border-b border-border pb-3">
        <Button
          variant={activeTab === 'shops' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('shops')}
          className="font-bold text-xs gap-1.5"
        >
          <Search className="w-3.5 h-3.5" />
          商店導航
        </Button>
        <Button
          variant={activeTab === 'machines' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('machines')}
          className="font-bold text-xs gap-1.5"
        >
          <Cpu className="w-3.5 h-3.5 text-amber-500" />
          認證機器設施
        </Button>
        <Button
          variant={activeTab === 'treasure' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('treasure')}
          className="font-bold text-xs gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-500" />
          野外藏寶線索
        </Button>
      </div>

      {activeTab === 'shops' && (
        <div className="space-y-4">
          {/* 搜尋與過濾工具欄 */}
          <Card>
            <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* 搜尋框 */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="text" 
                  placeholder="輸入物品名稱、店主名稱、自訂店名搜尋..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              {/* 排序按鈕組 */}
              <div className="flex items-center space-x-2 shrink-0">
                <Button
                  variant={sortBy === 'price_asc' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('price_asc')}
                  className="h-8 text-[11px]"
                >
                  價格低至高
                </Button>
                <Button
                  variant={sortBy === 'price_desc' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('price_desc')}
                  className="h-8 text-[11px]"
                >
                  價格高至低
                </Button>
                <Button
                  variant={sortBy === 'stock_desc' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('stock_desc')}
                  className="h-8 text-[11px]"
                >
                  庫存多至少
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 商店列表表格 */}
          <Card>
            <CardHeader className="py-4 border-b border-border">
              <CardTitle className="text-sm font-bold">商店清單導航</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">位置座標</TableHead>
                    <TableHead>自訂店名 / 店主</TableHead>
                    <TableHead>評價</TableHead>
                    <TableHead>販售商品</TableHead>
                    <TableHead className="text-right">買入價格</TableHead>
                    <TableHead className="text-right">回收價格</TableHead>
                    <TableHead className="text-right">剩餘庫存</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShops.map((shop, i) => {
                    const cleanItemName = (shop.item || '').replace('minecraft:', '').replace(/_/g, ' ').toUpperCase() || 'UNKNOWN';
                    const ratingVal = shop.rating || 5.0;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs pl-4 font-bold text-primary">
                          {shop.location}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="font-bold text-xs">{shop.custom_name || `${shop.owner} 的商店`}</p>
                            <div className="flex items-center space-x-1.5">
                              <img 
                                src={`https://mc-heads.net/avatar/${shop.owner}/16`} 
                                alt={shop.owner}
                                className="w-4 h-4 rounded-[2px]"
                              />
                              <span className="text-[10px] text-muted-foreground">{shop.owner}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1 text-amber-500 text-xs font-bold">
                            <Star className="w-3.5 h-3.5 fill-amber-500" />
                            <span>{ratingVal.toFixed(1)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <MinecraftItemIcon itemId={shop.item} className="w-5 h-5" />
                            <span className="font-mono font-bold text-amber-500 text-xs">{cleanItemName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-500 font-mono text-xs">
                          ${shop.buy_price} 元
                        </TableCell>
                        <TableCell className="text-right font-bold text-amber-500 font-mono text-xs">
                          {shop.sell_price > 0 ? `$${shop.sell_price} 元` : '不回收'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-xs">
                          {shop.stock} 個
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopyTpCommand(shop.location)}
                            title="複製傳送指令"
                            className="h-7 w-7"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredShops.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-xs">
                        找不到符合搜尋條件的商店
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 認證機器設施標籤頁 */}
      {activeTab === 'machines' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Cpu className="w-5 h-5 text-amber-500" />
              🏭 認證紅石自動化機械列表
            </CardTitle>
            <CardDescription className="text-xs">
              已通過管理員審核報備的自動化農場與紅石機械設施（免收領地過期清潔費）。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground flex items-center justify-center gap-2 text-xs font-bold">
                <RefreshCw className="w-4 h-4 animate-spin" />
                載入認證機器中...
              </div>
            ) : machines.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs font-bold">
                目前暫無已認證的紅石自動化機器設施
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {machines.map((m, idx) => (
                  <div key={idx} className="p-4 border border-border rounded-lg bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-foreground">{m.name || `機器 #${idx + 1}`}</span>
                      <span className="text-[10px] bg-amber-500/15 text-amber-500 px-2 py-0.5 rounded-full font-bold">
                        認證設施
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{m.desc || '無詳細說明'}</p>
                    <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs font-mono">
                      <span className="text-primary font-bold">{m.coords || '未知座標'}</span>
                      <span className="text-muted-foreground">{m.owner || '系統'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 野外藏寶線索標籤頁 */}
      {activeTab === 'treasure' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              🗺️ 野外藏寶箱線索與刷新提示
            </CardTitle>
            <CardDescription className="text-xs">
              野外隨機刷新的神秘藏寶箱，尋獲即可獲得高額遊戲幣與幸運大抽獎鑰匙！
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground flex items-center justify-center gap-2 text-xs font-bold">
                <RefreshCw className="w-4 h-4 animate-spin" />
                載入藏寶線索中...
              </div>
            ) : treasureHints.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs font-bold">
                目前野外暫無生效中的藏寶箱線索
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {treasureHints.map((t, idx) => (
                  <div key={idx} className="p-4 border border-purple-500/20 rounded-lg bg-purple-500/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-foreground">{t.title || '神秘野外寶箱'}</span>
                      <span className="text-[10px] bg-purple-500/15 text-purple-500 px-2 py-0.5 rounded-full font-bold">
                        {t.status || '尚未挖掘'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t.hint || t.location_desc || '隱藏於主世界深處的古老遺跡'}</p>
                    <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs font-mono">
                      <span className="text-primary font-bold">{t.coords || '範圍: X ~ Z'}</span>
                      <span className="text-emerald-500 font-bold">💰 {t.reward || '$1,500 元'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
