import { useState, useEffect } from 'react';
import { Package, DollarSign, Mail } from 'lucide-react';
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
  userBalance,
  triggerToast,
  fetchData
}: InventoryViewProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [sendingMail, setSendingMail] = useState(false);

  const [moneyReceiver, setMoneyReceiver] = useState('');
  const [moneyAmount, setMoneyAmount] = useState('');

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

  const handleSendMoney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moneyReceiver.trim() || !moneyAmount) return;

    const amt = parseFloat(moneyAmount);
    if (isNaN(amt) || amt <= 0) {
      triggerToast('請輸入有效的金額！', 'error');
      return;
    }

    if (amt > userBalance) {
      triggerToast('您的餘額不足！', 'error');
      return;
    }

    setSendingMail(true);
    try {
      const res = await apiFetch('/mail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver: moneyReceiver.trim(),
          type: 'money',
          amount: amt
        })
      });
      if (res.ok && res.data?.success) {
        triggerToast('金幣電子匯款成功送出！', 'success');
        setMoneyReceiver('');
        setMoneyAmount('');
        fetchData();
      } else {
        triggerToast(res.data?.message || '匯款失敗', 'error');
      }
    } catch (err: any) {
      triggerToast('請求失敗：' + err.message, 'error');
    } finally {
      setSendingMail(false);
    }
  };

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
        triggerToast('包裹寄送成功！', 'success');
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
        icon={Mail}
        title="郵局與背包快遞"
        description="遠端匯款轉帳給其他玩家，或將在線背包中的物品郵寄送出"
        badgeText={isOnline ? "背包連線" : "需要上線"}
        badgeVariant={isOnline ? "success" : "outline"}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-foreground" />
                  <CardTitle className="text-sm font-bold">跨服電子轉帳</CardTitle>
                </div>
                <Badge variant="outline">轉帳服務</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSendMoney} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">收款玩家 ID</label>
                  <Input
                    type="text"
                    placeholder="輸入對方的 Minecraft 玩家名稱..."
                    value={moneyReceiver}
                    onChange={(e) => setMoneyReceiver(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">轉帳金額 ($)</label>
                  <Input
                    type="number"
                    placeholder="輸入轉帳金額..."
                    value={moneyAmount}
                    onChange={(e) => setMoneyAmount(e.target.value)}
                    className="text-xs font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">可轉帳金額：${Math.floor(userBalance).toLocaleString()}</p>
                </div>
                <Button
                  type="submit"
                  disabled={sendingMail || !moneyReceiver.trim() || !moneyAmount}
                  className="w-full text-xs font-semibold"
                >
                  {sendingMail ? '傳送中...' : '確認匯款'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-6 space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Package className="w-4 h-4 text-foreground" />
                  <CardTitle className="text-sm font-bold">背包物品快遞寄送</CardTitle>
                </div>
                <Badge variant={isOnline ? "success" : "secondary"}>
                  {isOnline ? "背包同步中" : "需在線才能寄送"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {!isOnline ? (
                <div className="p-6 border border-dashed border-border rounded-lg text-center space-y-2">
                  <p className="text-xs font-semibold text-foreground">請在 Minecraft 伺服器中保持上線</p>
                  <p className="text-[11px] text-muted-foreground">物品快遞需要即時讀取您的遊戲內背包物品欄。</p>
                </div>
              ) : (
                <form onSubmit={handleSendItem} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">選擇背包物品</label>
                    <div className="grid grid-cols-6 gap-2 p-2 border border-border bg-muted/20 rounded-lg max-h-48 overflow-y-auto">
                      {items.map((item) => {
                        const isSelected = selectedSlot?.slot === item.slot;
                        return (
                          <button
                            type="button"
                            key={item.slot}
                            onClick={() => setSelectedSlot(item)}
                            className={`p-1.5 border rounded-md flex flex-col items-center justify-center cursor-pointer transition-all ${
                              isSelected ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-border/80'
                            }`}
                          >
                            <MinecraftItemIcon itemId={item.itemId} className="w-6 h-6" />
                            <span className="text-[9px] font-mono font-bold mt-1">x{item.count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedSlot && (
                    <div className="p-3 border border-border bg-card rounded-md space-y-3">
                      <p className="text-xs font-bold text-foreground">已選擇：{selectedSlot.displayName}</p>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-foreground">收件玩家 ID</label>
                        <Input
                          type="text"
                          placeholder="輸入收件人 ID..."
                          value={itemReceiver}
                          onChange={(e) => setItemReceiver(e.target.value)}
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
                          className="text-xs font-mono"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={sendingMail || !itemReceiver.trim()}
                        className="w-full text-xs font-semibold"
                      >
                        {sendingMail ? '寄送中...' : '確認寄送包裹'}
                      </Button>
                    </div>
                  )}
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
