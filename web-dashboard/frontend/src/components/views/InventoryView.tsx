import { useState, useEffect } from 'react';
import { Package, Mail, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import PageHeader from '../ui/PageHeader';
import MinecraftItemIcon from '../ui/MinecraftItemIcon';
import { apiFetch } from '../../lib/api';

interface InventoryItem {
  slot: number;
  itemId: string;
  count: number;
  displayName: string;
  nbt?: string;
}

interface InventoryViewProps {
  token: string | null;
  isOnline: boolean;
  userBalance: number;
  triggerToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  fetchData: () => Promise<void>;
}

export default function InventoryView({
  token,
  isOnline,
  triggerToast,
}: InventoryViewProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [sendingMail, setSendingMail] = useState(false);

  const [selectedSlot, setSelectedSlot] = useState<InventoryItem | null>(null);
  const [itemReceiver, setItemReceiver] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');

  const fetchInventory = async () => {
    if (!token || !isOnline) return;
    try {
      const res = await apiFetch('/user/inventory');
      if (res.ok && res.data?.success) {
        setItems(res.data.items || []);
      } else {
        triggerToast(res.data?.message || '無法取得背包物品', 'error');
      }
    } catch (err: any) {
      triggerToast('連線 API 錯誤：' + err.message, 'error');
    }
  };

  useEffect(() => {
    if (isOnline) {
      fetchInventory();
    }
  }, [isOnline]);

  const handleSendItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !itemReceiver.trim()) return;

    const qty = parseInt(itemQuantity, 10);
    if (isNaN(qty) || qty <= 0 || qty > selectedSlot.count) {
      triggerToast('請輸入有效的數量！', 'error');
      return;
    }

    setSendingMail(true);
    try {
      const res = await apiFetch('/mail/send-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver: itemReceiver.trim(),
          slot: selectedSlot.slot,
          count: qty
        })
      });
      if (res.ok && res.data?.success) {
        triggerToast('🎉 背包物品快遞包裹成功寄出！', 'success');
        setSelectedSlot(null);
        setItemReceiver('');
        setItemQuantity('1');
        fetchInventory();
      } else {
        triggerToast(res.data?.message || '包裹寄送失敗', 'error');
      }
    } catch (err: any) {
      triggerToast('請求失敗：' + err.message, 'error');
    } finally {
      setSendingMail(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      <PageHeader
        icon={Package}
        iconColor="text-emerald-500"
        title="背包物品快遞"
        description="實時讀取您遊戲內在線背包的物品欄，將選定道具遠端包裹郵寄給其他玩家"
        badgeText={isOnline ? "背包連線中" : "需要遊戲上線"}
        badgeVariant={isOnline ? "success" : "outline"}
        kpis={[
          { label: "在線狀態", value: isOnline ? "遊戲在線" : "離線", icon: Mail, iconColor: isOnline ? "text-emerald-500" : "text-muted-foreground" },
          { label: "背包物品數", value: `${items.length} 格`, icon: Package, iconColor: "text-emerald-500" },
        ]}
      />

      <Card className="rounded-none">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Package className="w-4 h-4 text-emerald-500" />
              <CardTitle className="text-sm font-bold">背包物品清單與快遞寄送</CardTitle>
            </div>
            <Badge variant={isOnline ? "success" : "secondary"} className="rounded-md">
              {isOnline ? "即時背包同步" : "需在線才能寄送"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {!isOnline ? (
            <div className="p-8 border border-dashed border-border rounded-none text-center space-y-2">
              <Package className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-semibold text-foreground">請在 Minecraft 伺服器中保持上線</p>
              <p className="text-xs text-muted-foreground">物品快遞需要即時讀取您遊戲內的背包欄位。</p>
            </div>
          ) : (
            <form onSubmit={handleSendItem} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">點擊選擇背包物品欄位</label>
                {items.length > 0 ? (
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-9 gap-2 p-3 border border-border bg-muted/20 rounded-none max-h-64 overflow-y-auto">
                    {items.map((item) => {
                      const isSelected = selectedSlot?.slot === item.slot;
                      return (
                        <button
                          type="button"
                          key={item.slot}
                          onClick={() => setSelectedSlot(item)}
                          className={`p-2 border rounded-md flex flex-col items-center justify-center cursor-pointer transition-all ${
                            isSelected ? 'border-emerald-500 bg-emerald-500/10 shadow-xs' : 'border-border bg-card hover:border-emerald-500/40'
                          }`}
                        >
                          <MinecraftItemIcon itemId={item.itemId} className="w-7 h-7" />
                          <span className="text-[10px] font-mono font-bold mt-1 text-foreground truncate max-w-full">
                            x{item.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-4 text-center">您的背包內目前沒有可寄送的非空物品</p>
                )}
              </div>

              {selectedSlot && (
                <div className="p-4 border border-border bg-card rounded-none space-y-4">
                  <div className="flex items-center space-x-3 pb-3 border-b border-border">
                    <MinecraftItemIcon itemId={selectedSlot.itemId} className="w-8 h-8" />
                    <div>
                      <p className="text-xs font-bold text-foreground">已選擇：{selectedSlot.displayName}</p>
                      <p className="text-[11px] font-mono text-muted-foreground">可用數量：{selectedSlot.count} 個</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-foreground">收件玩家名稱 (Minecraft ID)</label>
                      <Input
                        type="text"
                        placeholder="輸入收件人 ID..."
                        value={itemReceiver}
                        onChange={(e) => setItemReceiver(e.target.value)}
                        required
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-foreground">寄送數量 (最多 {selectedSlot.count})</label>
                      <Input
                        type="number"
                        min="1"
                        max={selectedSlot.count}
                        value={itemQuantity}
                        onChange={(e) => setItemQuantity(e.target.value)}
                        required
                        className="text-xs font-mono"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={sendingMail || !itemReceiver.trim()}
                    className="w-full text-xs font-semibold rounded-md h-9"
                  >
                    <Send className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                    <span>{sendingMail ? '包裹寄送中...' : '確認郵寄包裹給玩家'}</span>
                  </Button>
                </div>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
