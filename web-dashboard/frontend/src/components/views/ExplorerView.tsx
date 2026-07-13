import { Copy, Search } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface ChestShop {
  location: string;
  owner: string;
  item: string;
  stock: number;
  buy_price: number;
  sell_price: number;
  custom_name?: string;
}

interface ExplorerViewProps {
  shops: ChestShop[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortBy: 'price_asc' | 'price_desc' | 'stock_desc';
  setSortBy: (sort: 'price_asc' | 'price_desc' | 'stock_desc') => void;
  handleCopyTpCommand: (location: string) => void;
}

export default function ExplorerView({
  shops,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  handleCopyTpCommand
}: ExplorerViewProps) {
  // 過濾與排序邏輯
  const filteredShops = shops
    .filter(shop => {
      const cleanItem = shop.item.replace('minecraft:', '').toLowerCase();
      const customName = (shop.custom_name || '').toLowerCase();
      const owner = shop.owner.toLowerCase();
      const query = searchQuery.toLowerCase();
      return cleanItem.includes(query) || customName.includes(query) || owner.includes(query);
    })
    .sort((a, b) => {
      if (sortBy === 'price_asc') return a.buy_price - b.buy_price;
      if (sortBy === 'price_desc') return b.buy_price - a.buy_price;
      if (sortBy === 'stock_desc') return b.stock - a.stock;
      return 0;
    });

  return (
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
              className="pl-9 h-9"
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
                <TableHead>販售商品</TableHead>
                <TableHead className="text-right">買入價格</TableHead>
                <TableHead className="text-right">回收價格</TableHead>
                <TableHead className="text-right">剩餘庫存</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredShops.map((shop, i) => {
                const cleanItemName = shop.item.replace('minecraft:', '').replace(/_/g, ' ').toUpperCase();
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
                      <span className="font-mono font-bold text-amber-500 text-xs">{cleanItemName}</span>
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-500 font-mono">
                      ${shop.buy_price} 元
                    </TableCell>
                    <TableCell className="text-right font-bold text-amber-500 font-mono">
                      {shop.sell_price > 0 ? `$${shop.sell_price} 元` : '不回收'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
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
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    找不到符合搜尋條件的商店
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
