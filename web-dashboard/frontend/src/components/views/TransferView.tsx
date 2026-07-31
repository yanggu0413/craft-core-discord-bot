import { useState } from 'react';
import { Coins, Send, ArrowRightLeft, ShieldCheck, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import PageHeader from '../ui/PageHeader';
import { apiFetch } from '../../lib/api';

interface TransferViewProps {
  token: string | null;
  userBalance: number;
  triggerToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  fetchData: () => Promise<void>;
}

export default function TransferView({
  token,
  userBalance,
  triggerToast,
  fetchData
}: TransferViewProps) {
  const [moneyReceiver, setMoneyReceiver] = useState('');
  const [moneyAmount, setMoneyAmount] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendMoney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      triggerToast('請先登入帳號！', 'error');
      return;
    }
    if (!moneyReceiver.trim() || !moneyAmount) return;

    const amt = parseFloat(moneyAmount);
    if (isNaN(amt) || amt <= 0) {
      triggerToast('請輸入有效的轉帳金額！', 'error');
      return;
    }

    if (amt > userBalance) {
      triggerToast('您的遊戲幣餘額不足！', 'error');
      return;
    }

    setSending(true);
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
        triggerToast(`🎉 已成功向 ${moneyReceiver.trim()} 電子轉帳 $${amt.toLocaleString()} 元！`, 'success');
        setMoneyReceiver('');
        setMoneyAmount('');
        fetchData();
      } else {
        triggerToast(res.data?.message || '轉帳失敗', 'error');
      }
    } catch (err: any) {
      triggerToast('請求失敗：' + err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const handleQuickAddAmount = (addVal: number) => {
    const current = parseFloat(moneyAmount) || 0;
    const nextVal = Math.min(userBalance, current + addVal);
    setMoneyAmount(nextVal.toString());
  };

  return (
    <div className="space-y-6 text-left">
      <PageHeader
        icon={Coins}
        iconColor="text-emerald-500"
        title="電子金幣轉帳"
        description="跨服遠端即時匯款給其他玩家，交易額度與狀態即時同步"
        badgeText="即時轉帳"
        badgeVariant="outline"
        kpis={[
          { label: "可用金幣餘額", value: `$${Math.floor(userBalance).toLocaleString()}`, icon: DollarSign, iconColor: "text-emerald-500" },
          { label: "轉帳手續費", value: "免手續費", icon: ShieldCheck, iconColor: "text-indigo-500" },
          { label: "轉帳服務狀態", value: "全時段服務中", icon: ArrowRightLeft, iconColor: "text-cyan-500" },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <Card className="rounded-none">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Coins className="w-4 h-4 text-emerald-500" />
                  <CardTitle className="text-sm font-bold">發起電子匯款</CardTitle>
                </div>
                <Badge variant="outline" className="rounded-md">安全加密</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSendMoney} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>收款玩家名稱 (Minecraft ID)</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="輸入對方的玩家 ID..."
                    value={moneyReceiver}
                    onChange={(e) => setMoneyReceiver(e.target.value)}
                    required
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>匯款金額 ($)</span>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      目前可用：<span className="text-emerald-500 font-bold">${Math.floor(userBalance).toLocaleString()}</span>
                    </span>
                  </label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="輸入匯款金額..."
                    value={moneyAmount}
                    onChange={(e) => setMoneyAmount(e.target.value)}
                    required
                    className="text-xs font-mono"
                  />
                  
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickAddAmount(1000)}
                      className="text-[11px] h-7 px-2.5 rounded-md"
                    >
                      +$1,000
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickAddAmount(5000)}
                      className="text-[11px] h-7 px-2.5 rounded-md"
                    >
                      +$5,000
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickAddAmount(10000)}
                      className="text-[11px] h-7 px-2.5 rounded-md"
                    >
                      +$10,000
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setMoneyAmount(Math.floor(userBalance).toString())}
                      className="text-[11px] h-7 px-2.5 rounded-md"
                    >
                      全部轉出
                    </Button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={sending || !moneyReceiver.trim() || !moneyAmount || !token}
                  className="w-full text-xs font-semibold rounded-md h-10"
                >
                  <Send className="w-4 h-4 mr-1.5 text-emerald-400" />
                  <span>{sending ? '匯款處理中...' : '確認發送電子匯款'}</span>
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <Card className="rounded-none">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                <CardTitle className="text-sm font-bold">轉帳安全須知</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs text-muted-foreground leading-relaxed">
              <div className="p-3 border border-border bg-card rounded-none space-y-1">
                <p className="font-semibold text-foreground">即時到帳機制</p>
                <p className="text-[11px]">匯款完成後，對方玩家無論是否在線均會立即收到金幣資產與系統通知。</p>
              </div>
              <div className="p-3 border border-border bg-card rounded-none space-y-1">
                <p className="font-semibold text-foreground">核對 ID 避免轉錯</p>
                <p className="text-[11px]">請再三確認收款人英文大小寫 ID，電子轉帳一旦成功送出無法自動撤回。</p>
              </div>
              <div className="p-3 border border-border bg-card rounded-none space-y-1">
                <p className="font-semibold text-foreground">嚴禁線下違規交易</p>
                <p className="text-[11px]">伺服器嚴禁涉及真實貨幣 (RMT) 之違規轉帳行為，系統均留有完整日誌記錄。</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
