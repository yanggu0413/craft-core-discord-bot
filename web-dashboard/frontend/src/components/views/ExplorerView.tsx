import { useState, useEffect } from 'react';
import { Search, ShoppingBag, Cpu, MapPin, Sparkles } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import PageHeader from '../ui/PageHeader';
import MinecraftItemIcon from '../ui/MinecraftItemIcon';
import { apiFetch } from '../../lib/api';

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
  handleCopyTpCommand?: (location: string) => void;
  API_URL?: string;
}

export default function ExplorerView({
  shops = [],
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy
}: ExplorerViewProps) {
  const [machines, setMachines] = useState<any[]>([]);
  const [treasureHint, setTreasureHint] = useState<string>('');

  useEffect(() => {
    const fetchRetentionData = async () => {
      try {
        const mRes = await apiFetch('/machines');
        if (mRes.ok && mRes.data?.success) {
          setMachines(mRes.data.machines || []);
        }
        const tRes = await apiFetch('/treasure/hints');
        if (tRes.ok && tRes.data?.success) {
          setTreasureHint(tRes.data.hint || '');
        }
      } catch (e) {}
    };
    fetchRetentionData();
  }, []);

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
    <div className="space-y-6 text-left">
      <PageHeader
        icon={ShoppingBag}
        iconColor="text-emerald-500"
        title="商店與地標導航"
        description="實時搜尋全服箱子商店商品價格、地圖標點與公共設施座標"
        badgeText={`${filteredShops.length} 間商店`}
        badgeVariant="outline"
        kpis={[
          { label: "運作中商店", value: `${shops.length} 間`, icon: ShoppingBag, iconColor: "text-emerald-500" },
          { label: "自動化設施", value: `運作中`, icon: Cpu, iconColor: "text-teal-500" },
        ]}
      />

      {treasureHint && (
        <Card className="bg-amber-500/10 border-amber-500/30 text-amber-500 rounded-none p-4 flex items-center space-x-3 text-xs">
          <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
          <span className="font-semibold">{treasureHint}</span>
        </Card>
      )}

      {machines.length > 0 && (
        <Card className="rounded-none">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-bold flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-teal-500" />
              <span>🏭 認證紅石自動化設施 ({machines.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {machines.map((m, idx) => (
              <div key={idx} className="p-3 border border-border bg-muted/20 rounded space-y-1">
                <div className="flex items-center justify-between font-bold">
                  <span>{m.name}</span>
                  <Badge variant="secondary" className="text-[10px]">認證設施</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">{m.desc || '自動化公共設施'}</p>
                <div className="flex justify-between items-center text-[10px] font-mono pt-1 text-muted-foreground">
                  <span>擁有者: {m.owner}</span>
                  <span>📍 {m.coords}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-none">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2 w-full sm:w-auto flex-1">
            <div className="relative w-full max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="搜尋物品名稱、店主或自訂店名..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto shrink-0 justify-end">
            <span className="text-xs text-muted-foreground">排序：</span>
            <Button
              variant={sortBy === 'price_asc' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('price_asc')}
              className="text-xs rounded-md"
            >
              價格由低到高
            </Button>
            <Button
              variant={sortBy === 'stock_desc' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('stock_desc')}
              className="text-xs rounded-md"
            >
              庫存最多
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-none">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-sm font-bold">箱子商店列表</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredShops.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">物品</TableHead>
                  <TableHead>名稱 / 店主</TableHead>
                  <TableHead className="text-right">售價 (買入)</TableHead>
                  <TableHead className="text-right">收購價 (賣出)</TableHead>
                  <TableHead className="text-center">剩餘庫存</TableHead>
                  <TableHead className="text-right">商店座標</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredShops.map((shop, idx) => {
                  const cleanItem = (shop.item || '').replace('minecraft:', '');
                  return (
                    <TableRow key={shop.location || `shop-${idx}`}>
                      <TableCell className="text-center">
                        <MinecraftItemIcon itemId={shop.item} className="w-7 h-7 mx-auto" />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-foreground">{shop.custom_name || cleanItem}</p>
                          <div className="flex items-center space-x-2 text-[11px] text-muted-foreground font-mono">
                            <span>店主: {shop.owner}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {shop.buy_price > 0 ? `$${shop.buy_price}` : '不販售'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {shop.sell_price > 0 ? `$${shop.sell_price}` : '不回收'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={shop.stock > 0 ? "secondary" : "destructive"} className="rounded-md">
                          {shop.stock > 0 ? `${shop.stock} 個` : '售罄'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center space-x-1.5 font-mono text-xs text-foreground bg-muted/30 border border-border px-2.5 py-1 rounded-md">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span>{shop.location}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
              <p className="font-semibold">找不到符合條件的箱子商店</p>
              <p>請嘗試使用別的關鍵字搜尋</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
