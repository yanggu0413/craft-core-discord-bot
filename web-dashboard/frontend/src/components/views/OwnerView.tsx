import React, { useState } from 'react';
import { User, Store, MapPin, Edit3, DollarSign, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Input } from '../ui/input';
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
  shops = [],
  token,
  username,
  handleWithdrawRevenue,
  handleRenameShopSubmit,
  handleUpgradeSlots
}: OwnerViewProps) {
  const [renameCoords, setRenameCoords] = useState<string | null>(null);
  const [newNameInput, setNewNameInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!token) {
    return (
      <div className="space-y-6 text-left">
        <PageHeader
          icon={User}
          iconColor="text-blue-500"
          title="店主遙控中心"
          description="請先登入帳號以遠端管理您名下的箱子商店。"
          badgeText="需要登入"
          badgeVariant="outline"
        />
        <Card className="py-12 rounded-none">
          <CardContent className="flex flex-col items-center justify-center text-center space-y-3">
            <div className="p-3 bg-muted text-muted-foreground border border-border">
              <Lock className="w-6 h-6" />
            </div>
            <CardTitle className="text-sm font-bold">尚未驗證帳號</CardTitle>
            <CardDescription className="max-w-md text-xs">
              請點擊右上角「帳號登入」按鈕，同步您的 Minecraft 遊戲身份以解鎖遙控管理功能。
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    );
  }

  const myShops = (shops || []).filter(shop => shop && (shop.owner || '').toLowerCase() === (username || '').toLowerCase());

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
    <div className="space-y-6 text-left">
      <PageHeader
        icon={User}
        iconColor="text-blue-500"
        title="店主遙控中心"
        description="遠端調整旗下箱子商店名稱、查看即時庫存剩餘數量與營收提領"
        badgeText={`${myShops.length} 間商店`}
        badgeVariant="outline"
        actions={
          <Button
            variant="default"
            size="sm"
            onClick={handleUpgradeSlots}
            className="text-xs rounded-md"
          >
            升級商店容量上限
          </Button>
        }
      />

      {myShops.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {myShops.map((shop, idx) => {
            const cleanItem = (shop.item || '').replace('minecraft:', '');
            return (
              <Card key={idx} className="flex flex-col justify-between rounded-none">
                <CardHeader className="pb-3 border-b border-border">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <MinecraftItemIcon itemId={shop.item} className="w-8 h-8 shrink-0" />
                      <div className="space-y-0.5">
                        <CardTitle className="text-sm font-bold">{shop.custom_name || cleanItem}</CardTitle>
                        <CardDescription className="font-mono text-[11px] flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-rose-500" /> {shop.location}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant={shop.stock > 0 ? "secondary" : "destructive"} className="rounded-md">
                      {shop.stock > 0 ? `庫存: ${shop.stock}` : '無庫存'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-2 text-xs font-mono">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">出售價格 (買入):</span>
                    <span className="font-bold text-emerald-500">{shop.buy_price > 0 ? `$${shop.buy_price}` : '不販售'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">回收價格 (賣出):</span>
                    <span className="font-bold text-foreground">{shop.sell_price > 0 ? `$${shop.sell_price}` : '不回收'}</span>
                  </div>
                </CardContent>

                <CardFooter className="pt-3 flex items-center gap-2 border-t border-border mt-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenRename(shop.location, shop.custom_name || '')}
                    className="flex-1 text-xs rounded-md"
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1 text-blue-500" />
                    <span>變更店名</span>
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleWithdrawRevenue(shop.location)}
                    className="flex-1 text-xs rounded-md"
                  >
                    <DollarSign className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                    <span>提領營收</span>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="py-12 rounded-none">
          <CardContent className="text-center space-y-2">
            <Store className="w-8 h-8 text-blue-500 mx-auto" />
            <p className="text-sm font-bold text-foreground">您目前名下沒有任何箱子商店</p>
            <p className="text-xs text-muted-foreground">在伺服器中使用告示牌與箱子擺放商品即可自動建立商店。</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!renameCoords} onOpenChange={(open) => !open && setRenameCoords(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">變更箱子商店名稱</DialogTitle>
            <DialogDescription className="text-xs">
              修改選定商店位置 ({renameCoords}) 的告示牌自訂名稱。每次更名手續費 $5,000 元。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit} className="space-y-4 py-2">
            <Input
              type="text"
              placeholder="輸入新的商店名稱..."
              value={newNameInput}
              onChange={(e) => setNewNameInput(e.target.value)}
              className="text-xs"
              autoFocus
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRenameCoords(null)}
                className="text-xs rounded-md"
              >
                取消
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || !newNameInput.trim()}
                className="text-xs rounded-md"
              >
                {isSubmitting ? '儲存中...' : '確認變更 ($5,000)'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
