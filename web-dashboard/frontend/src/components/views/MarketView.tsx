import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import PageHeader from '../ui/PageHeader';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, CartesianGrid 
} from 'recharts';

interface MarketViewProps {
  analytics: Record<string, any[]>;
  selectedMineral: string;
  setSelectedMineral: (id: string) => void;
  isDarkMode: boolean;
}

export default function MarketView({
  analytics = {},
  selectedMineral,
  setSelectedMineral
}: MarketViewProps) {
  const getMineralStats = (id: string, name: string) => {
    const data = analytics[id] || [];
    if (data.length === 0) {
      return { id, name, avgPrice: '無交易', trend: '—' };
    }
    const latest = data[data.length - 1];
    const prev = data.length > 1 ? data[data.length - 2] : null;
    
    const latestPrice = latest.price;
    const avgPriceText = `$${latestPrice.toLocaleString()}`;
    
    let trendText = '—';
    if (prev && prev.price > 0) {
      const diff = latestPrice - prev.price;
      const pct = (diff / prev.price) * 100;
      const sign = pct > 0 ? '+' : '';
      trendText = `${sign}${pct.toFixed(1)}%`;
    }
    
    return { id, name, avgPrice: avgPriceText, trend: trendText };
  };

  const mineralCards = [
    getMineralStats('minecraft:diamond', '鑽石 (Diamond)'),
    getMineralStats('minecraft:netherite_ingot', '獄髓合金 (Netherite)'),
    getMineralStats('minecraft:iron_ingot', '鐵錠 (Iron Ingot)')
  ];

  const currentChartData = analytics[selectedMineral] || [
    { date: '第 1 天', price: 100 },
    { date: '第 2 天', price: 105 },
    { date: '第 3 天', price: 98 },
    { date: '第 4 天', price: 110 },
    { date: '第 5 天', price: 115 },
    { date: '第 6 天', price: 112 },
    { date: '第 7 天', price: 120 }
  ];

  return (
    <div className="space-y-6 text-left">
      <PageHeader
        icon={TrendingUp}
        iconColor="text-teal-500"
        title="市場行情與物價分析"
        description="全服熱門大宗物資價格與交易量波動趨勢，幫助店主與買家精準掌控市場"
        badgeText="市場數據"
        badgeVariant="outline"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {mineralCards.map((item) => {
          const isSelected = selectedMineral === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setSelectedMineral(item.id)}
              className={`flex justify-between items-center p-5 border rounded-none text-left transition-all cursor-pointer ${
                isSelected 
                  ? 'border-teal-500 bg-teal-500/10 text-foreground shadow-xs font-semibold' 
                  : 'border-border bg-card text-card-foreground hover:border-teal-500/40'
              }`}
            >
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{item.name}</p>
                <p className="text-xl font-bold font-mono text-teal-500">{item.avgPrice}</p>
              </div>
              <Badge variant={item.trend.startsWith('-') ? "destructive" : item.trend === '—' ? "secondary" : "success"} className="rounded-md">
                {item.trend}
              </Badge>
            </button>
          );
        })}
      </div>

      <Card className="rounded-none">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold">歷史價格波動圖表 (7 天走勢)</CardTitle>
              <CardDescription className="text-xs">
                當前檢視：{mineralCards.find(m => m.id === selectedMineral)?.name || selectedMineral}
              </CardDescription>
            </div>
            <Badge variant="outline" className="rounded-md">趨勢分析</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={currentChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="marketPriceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--card)', 
                    borderColor: 'var(--border)', 
                    borderRadius: '4px', 
                    fontSize: '12px',
                    color: 'var(--foreground)'
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="price" 
                  stroke="#14b8a6" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#marketPriceGrad)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
