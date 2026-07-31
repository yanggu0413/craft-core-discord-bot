import { Copy, Search, ShoppingBag, Cpu, MapPin } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import PageHeader from '../ui/PageHeader';
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
  shops = [],
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  handleCopyTpCommand
}: ExplorerViewProps) {

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
        title="商店與地標導航"
        description="實時搜尋全服箱子商店商品價格、地圖標點與公共設施座標"
        badgeText={`${filteredShops.length} 間商店`}
        badgeVariant="outline"
        kpis={[
          { label: "運作中商店", value: `${shops.length} 間`, icon: ShoppingBag },
          { label: "自動化設施", value: `運作中`, icon: Cpu },
        ]}
      />

      <Card>
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
              className="text-xs"
            >
              價格由低到高
            </Button>
            <Button
              variant={sortBy === 'stock_desc' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('stock_desc')}
              className="text-xs"
            >
              庫存最多
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
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
                  <TableHead className="text-right">座標與傳送</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredShops.map((shop, idx) => {
                  const cleanItem = (shop.item || '').replace('minecraft:', '');
                  return (
                    <TableRow key={idx}>
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
                      <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                        {shop.buy_price > 0 ? `$${shop.buy_price}` : '不販售'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {shop.sell_price > 0 ? `$${shop.sell_price}` : '不回收'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={shop.stock > 0 ? "secondary" : "destructive"}>
                          {shop.stock > 0 ? `${shop.stock} 個` : '售罄'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyTpCommand(shop.location)}
                          className="text-xs font-mono"
                        >
                          <MapPin className="w-3 h-3 mr-1" />
                          <span>傳送至 {shop.location}</span>
                          <Copy className="w-3 h-3 ml-1.5 opacity-60" />
                        </Button>
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
