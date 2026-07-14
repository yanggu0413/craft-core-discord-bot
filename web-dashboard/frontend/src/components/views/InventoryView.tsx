import { useState, useEffect } from 'react';
import { Package, Send, DollarSign, ShieldAlert, Info, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import MinecraftItemIcon from '../ui/MinecraftItemIcon';

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
  const [loading, setLoading] = useState(false);
  const [sendingMail, setSendingMail] = useState(false);

  // Send Money State
  const [moneyReceiver, setMoneyReceiver] = useState('');
  const [moneyAmount, setMoneyAmount] = useState('');

  // Send Item State
  const [selectedSlot, setSelectedSlot] = useState<InventoryItem | null>(null);
  const [itemReceiver, setItemReceiver] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');

  const fetchInventory = async () => {
    if (!token || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch('/api/user/inventory', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
      } else {
        triggerToast(data.message || '無法取得背包物品', 'error');
      }
    } catch (err: any) {
      triggerToast('連線 API 錯誤：' + err.message, 'error');
    } finally {
      setLoading(false);
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
      const res = await fetch('/api/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          receiver: moneyReceiver.trim(),
          type: 'money',
          amount: amt
        })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast('金幣電子匯款成功送出！', 'success');
        setMoneyReceiver('');
        setMoneyAmount('');
        fetchData(); // Refresh balance
      } else {
        triggerToast(data.message || '匯款失敗', 'error');
      }
    } catch (err: any) {
      triggerToast('傳送失敗：' + err.message, 'error');
    } finally {
      setSendingMail(false);
    }
  };

  const handleSendItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !itemReceiver.trim() || !itemQuantity) return;

    const qty = parseInt(itemQuantity);
    if (isNaN(qty) || qty <= 0 || qty > selectedSlot.count) {
      triggerToast('請輸入有效的數量！', 'error');
      return;
    }

    setSendingMail(true);
    try {
      const res = await fetch('/api/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          receiver: itemReceiver.trim(),
          type: 'item',
          slot: selectedSlot.slot,
          itemId: selectedSlot.itemId,
          quantity: qty,
          nbt: selectedSlot.nbt
        })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast('物品快遞包裹成功送出！', 'success');
        setItemReceiver('');
        setSelectedSlot(null);
        fetchInventory(); // Reload inventory
      } else {
        triggerToast(data.message || '寄送物品失敗', 'error');
      }
    } catch (err: any) {
      triggerToast('傳送失敗：' + err.message, 'error');
    } finally {
      setSendingMail(false);
    }
  };

  // Organize items into a 36-slot array (0-35)
  const gridSlots = Array.from({ length: 36 }, (_, index) => {
    return items.find((item) => item.slot === index) || null;
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-left flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold tracking-wider uppercase text-foreground">郵局與個人背包</h2>
          <p className="text-xs text-muted-foreground">
            線上實時檢視您的遊戲背包內容，並能直接將物品或金幣匯款寄送快遞給其他玩家。
          </p>
        </div>
        {isOnline && (
          <Button variant="outline" size="sm" onClick={fetchInventory} disabled={loading} className="h-7 text-xs">
            <RefreshCw className={`w-3 h-3 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            重整背包
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左側：個人背包（需要玩家在線） */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <div className="flex items-center space-x-2">
              <Package className="w-4 h-4 text-primary" />
              <CardTitle>個人遊戲背包 (36 格)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {!isOnline ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 border border-dashed border-border rounded-[4px]">
                <div className="bg-amber-500/10 p-3 rounded-full">
                  <ShieldAlert className="w-8 h-8 text-amber-500" />
                </div>
                <CardTitle className="text-sm font-bold">目前處於遊戲離線狀態</CardTitle>
                <CardDescription className="max-w-xs text-xs">
                  您必須登入遊戲並處於線上狀態，網頁端才能實時讀取並同步您的個人背包數據。
                </CardDescription>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 36格背包網格 9x4 */}
                <div className="grid grid-cols-9 gap-1.5 p-3 bg-muted/20 border border-border rounded-[4px] max-w-full overflow-x-auto">
                  {gridSlots.map((item, index) => {
                    const isSelected = selectedSlot?.slot === index;
                    return (
                      <div
                        key={index}
                        onClick={() => item && setSelectedSlot(item)}
                        className={`aspect-square border flex flex-col items-center justify-center relative group cursor-pointer transition-all rounded-[2px] ${
                          isSelected 
                            ? 'border-emerald-500 bg-emerald-500/10' 
                            : item 
                              ? 'border-border bg-muted/40 hover:border-primary hover:bg-muted/70' 
                              : 'border-border bg-muted/10 cursor-not-allowed'
                        }`}
                        title={item ? `${item.displayName}\n(ID: ${item.itemId})` : `第 ${index + 1} 格 (空)`}
                      >
                        {item ? (
                          <>
                            {/* Minecraft Item/Block Icon */}
                            <MinecraftItemIcon itemId={item.itemId} className="w-10 h-10 object-contain" />
                            {/* Stack Count (Vanilla Minecraft Style: only show if count > 1) */}
                            {item.count > 1 && (
                              <span className="absolute bottom-1 right-1.5 font-mono text-xs font-black text-white drop-shadow-[1px_1px_0px_rgba(0,0,0,0.9)] select-none">
                                {item.count}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[9px] text-muted-foreground/30 font-mono">{index}</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-start space-x-2 text-[10px] text-muted-foreground bg-muted/30 p-2 rounded-[2px] text-left">
                  <Info className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                  <p>
                    點擊背包中有物品的格子即可將其選中，並在下方填寫收件人與數量進行「快遞包裹寄送」。
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 右側：匯款與快遞面板 */}
        <div className="space-y-6">
          {/* 金幣匯款 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                <CardTitle className="text-sm font-bold">金幣電子匯款</CardTitle>
              </div>
              <CardDescription className="text-[10px]">直接在網頁端扣除您的餘額郵寄金幣給指定玩家（離線可用）</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendMoney} className="space-y-3">
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">收件人玩家名稱</label>
                  <Input
                    type="text"
                    required
                    placeholder="例如：Yanggu"
                    value={moneyReceiver}
                    onChange={(e) => setMoneyReceiver(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase flex justify-between">
                    <span>匯款金額 (元)</span>
                    <span className="text-emerald-500">可用：${userBalance.toLocaleString()}</span>
                  </label>
                  <Input
                    type="number"
                    required
                    min="1"
                    placeholder="輸入轉帳金額..."
                    value={moneyAmount}
                    onChange={(e) => setMoneyAmount(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <Button type="submit" disabled={sendingMail} className="w-full h-8 text-xs font-bold">
                  <Send className="w-3 h-3 mr-1.5" />
                  確認電子匯款
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* 物品快遞（僅線上可用） */}
          {selectedSlot && (
            <Card className="border-emerald-500/30">
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-2">
                  <Package className="w-4 h-4 text-emerald-500" />
                  <CardTitle className="text-sm font-bold">寄送物品快遞</CardTitle>
                </div>
                <div className="text-[10px] text-muted-foreground flex items-center space-x-2 mt-1.5 bg-muted/30 p-2 rounded-[2px]">
                  <MinecraftItemIcon itemId={selectedSlot.itemId} className="w-8 h-8" />
                  <div>
                    將選中的物品 <span className="font-bold text-foreground">{selectedSlot.displayName}</span> 寄送給指定玩家。
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSendItem} className="space-y-3">
                  <div className="space-y-1 text-left">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">收件人玩家名稱</label>
                    <Input
                      type="text"
                      required
                      placeholder="例如：Yanggu"
                      value={itemReceiver}
                      onChange={(e) => setItemReceiver(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1 text-left">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase flex justify-between">
                      <span>快遞寄送數量</span>
                      <span className="text-emerald-500">最大數量：{selectedSlot.count}</span>
                    </label>
                    <Input
                      type="number"
                      required
                      min="1"
                      max={selectedSlot.count.toString()}
                      placeholder="輸入寄件數量..."
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={sendingMail} className="flex-1 h-8 text-xs font-bold">
                      <Send className="w-3 h-3 mr-1.5" />
                      確認快遞寄送
                    </Button>
                    <Button variant="outline" type="button" onClick={() => setSelectedSlot(null)} className="h-8 text-xs px-2.5">
                      取消
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
