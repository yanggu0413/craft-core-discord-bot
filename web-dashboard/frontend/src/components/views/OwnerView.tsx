import React, { useState } from 'react';
import { User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';

interface ChestShop {
  location: string;
  owner: string;
  item: string;
  stock: number;
  buy_price: number;
  sell_price: number;
  custom_name?: string;
}

interface OwnerViewProps {
  shops: ChestShop[];
  token: string | null;
  username: string | null;
  handleWithdrawRevenue: (coords: string) => Promise<void>;
  handleRenameShopSubmit: (coords: string, newName: string) => Promise<void>;
  handleUpgradeSlots: () => Promise<void>;
}

export default function OwnerView({
  shops,
  token,
  username,
  handleWithdrawRevenue,
  handleRenameShopSubmit,
  handleUpgradeSlots
}: OwnerViewProps) {
  const [renameCoords, setRenameCoords] = useState<string | null>(null);
  const [newNameInput, setNewNameInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 未登入狀態
  if (!token) {
    return (
      <Card className="py-12">
        <CardContent className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="bg-muted p-3 rounded-full">
            <User className="w-8 h-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-base font-bold">請先綁定您的帳號</CardTitle>
          <CardDescription className="max-w-md">
            店主遙控中心需要您登入帳號後，才能讀取並遠端遙控您在伺服器中建立的箱子商店。
          </CardDescription>
        </CardContent>
      </Card>
    );
  }

  const myShops = shops.filter(shop => shop.owner.toLowerCase() === username?.toLowerCase());

  const handleOpenRename = (coords: string, currentName: string) => {
    setRenameCoords(coords);
    setNewNameInput(currentName);
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameCoords || !newNameInput.trim()) return;
    setIsSubmitting(true);
    try {
      await handleRenameShopSubmit(renameCoords, newNameInput.trim());
      setRenameCoords(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 遙控中心橫幅 */}
      <Card className="border border-border bg-card">
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold">店主遙控中心</CardTitle>
            <CardDescription className="max-w-xl text-xs">
              您可以在此處直接修改商店告示牌名稱（每次更名收取金幣手續費 $5,000 元），或遠端提領商店累積的交易營收。
            </CardDescription>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={handleUpgradeSlots}
            className="h-8 shrink-0 text-[11px]"
          >
            升級商店數量上限
          </Button>
        </CardHeader>
      </Card>

      {/* 旗下商店列表 */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">您的旗下商店清單</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {myShops.map((shop, i) => {
            const cleanItem = shop.item.replace('minecraft:', '').toUpperCase();
            return (
              <Card key={i} className="flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold bg-muted border border-border px-2 py-0.5 rounded-[2px] font-mono text-foreground">
                      {shop.location}
                    </span>
                    <span className="text-[10px] text-muted-foreground">庫存：{shop.stock} 個</span>
                  </div>
                  <CardTitle className="text-sm font-bold mt-2">
                    {shop.custom_name || `${shop.owner} 的箱子商店`}
                  </CardTitle>
                  <CardDescription className="text-[11px] font-mono mt-1">
                    商品：<span className="text-amber-500 font-bold">{cleanItem}</span>
                  </CardDescription>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    價格設定：買入價 {shop.buy_price} 元 | 回收價 {shop.sell_price > 0 ? `${shop.sell_price} 元` : '不回收'}
                  </div>
                </CardHeader>
                <CardFooter className="flex items-center space-x-2 pt-3 border-t border-border mt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleWithdrawRevenue(shop.location)}
                    className="flex-1 h-8 text-[11px]"
                  >
                    提領營收
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenRename(shop.location, shop.custom_name || '')}
                    className="flex-1 h-8 text-[11px]"
                  >
                    遠端更名
                  </Button>
                </CardFooter>
              </Card>
            );
          })}

          {myShops.length === 0 && (
            <div className="col-span-full py-12 text-center border border-dashed border-border rounded-[4px] bg-muted/20">
              <p className="text-xs text-muted-foreground">您目前在伺服器中沒有註冊任何商店。</p>
            </div>
          )}
        </div>
      </div>

      {/* 遙控更名對話框 */}
      <Dialog open={renameCoords !== null} onOpenChange={(open) => !open && setRenameCoords(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>遠端修改商店告示牌名稱</DialogTitle>
            <DialogDescription>
              商店位置座標：{renameCoords}。此動作將於遊戲內收取手續費 $5,000 元，並即時改寫方塊上的告示牌文字。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit} className="space-y-4 pt-2">
            <Input
              type="text"
              value={newNameInput}
              onChange={(e) => setNewNameInput(e.target.value)}
              placeholder="請輸入新的商店告示牌名稱"
              maxLength={20}
              required
              className="h-9"
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameCoords(null)}
                disabled={isSubmitting}
                className="h-8 text-[11px]"
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-8 text-[11px]"
              >
                {isSubmitting ? '更名中...' : '確認並改名'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
