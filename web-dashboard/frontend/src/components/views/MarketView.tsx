import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
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
  analytics,
  selectedMineral,
  setSelectedMineral,
  isDarkMode
}: MarketViewProps) {
  const getMineralStats = (id: string, name: string, icon: string) => {
    const data = analytics[id] || [];
    if (data.length === 0) {
      return {
        id,
        name: `${icon} ${name}`,
        avgPrice: '無交易',
        trend: '—'
      };
    }
    const latest = data[data.length - 1];
    const prev = data.length > 1 ? data[data.length - 2] : null;
    
    const latestPrice = latest.price;
    const avgPriceText = `$${latestPrice.toLocaleString()} 元`;
    
    let trendText = '—';
    if (prev && prev.price > 0) {
      const diff = latestPrice - prev.price;
      const pct = (diff / prev.price) * 100;
      const sign = pct > 0 ? '+' : '';
      trendText = `${sign}${pct.toFixed(1)}%`;
    }
    
    return {
      id,
      name: `${icon} ${name}`,
      avgPrice: avgPriceText,
      trend: trendText
    };
  };

  const mineralCards = [
    getMineralStats('minecraft:diamond', '鑽石', '💎'),
    getMineralStats('minecraft:netherite_ingot', '獄髓合金', '🔥'),
    getMineralStats('minecraft:iron_ingot', '鐵錠', '⚙️')
  ];

  return (
    <div className="space-y-6">
      {/* 礦物選卡網格 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {mineralCards.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelectedMineral(item.id)}
            className={`flex justify-between items-center p-4 border rounded-[4px] text-left transition-colors duration-150 cursor-pointer ${
              selectedMineral === item.id 
                ? 'border-foreground bg-secondary text-foreground' 
                : 'border-border bg-card text-card-foreground hover:bg-muted/50'
            }`}
          >
            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{item.name}</h4>
              <p className="text-xl font-black mt-1">{item.avgPrice}</p>
            </div>
            <span className={`text-[10px] border font-bold px-2 py-0.5 rounded-[2px] ${
              item.trend === '—' 
                ? 'bg-muted text-muted-foreground border-border'
                : item.trend.startsWith('-')
                  ? 'bg-red-500/10 text-red-500 border-red-500/20'
                  : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
            }`}>
              {item.trend}
            </span>
          </button>
        ))}
      </div>

      {/* 價格走勢圖表卡片 */}
      <Card>
        <CardHeader className="py-4 border-b border-border">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <CardTitle>礦物價格與交易量波動趨勢（七天走勢圖）</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="w-full h-80">
            {analytics[selectedMineral] ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={analytics[selectedMineral]}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#27272a' : '#e4e4e7'} opacity={0.5} />
                  <XAxis 
                    dataKey="date" 
                    stroke={isDarkMode ? '#a1a1aa' : '#71717a'} 
                    fontSize={10} 
                    fontFamily="monospace"
                  />
                  <YAxis 
                    yAxisId="left" 
                    stroke="#10b981" 
                    fontSize={10} 
                    fontFamily="monospace"
                    tickFormatter={(v) => `$${v}`}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    stroke="#f59e0b" 
                    fontSize={10} 
                    fontFamily="monospace"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isDarkMode ? '#18181b' : '#ffffff', 
                      borderColor: isDarkMode ? '#27272a' : '#e4e4e7',
                      color: isDarkMode ? '#ffffff' : '#09090b',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      boxShadow: 'none'
                    }} 
                  />
                  <Area 
                    yAxisId="left" 
                    type="monotone" 
                    dataKey="price" 
                    name="平均價格" 
                    stroke="#10b981" 
                    fill="#10b981"
                    fillOpacity={0.03} 
                    strokeWidth={1.5} 
                  />
                  <Area 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="volume" 
                    name="交易數量" 
                    stroke="#f59e0b" 
                    fill="#f59e0b"
                    fillOpacity={0.03} 
                    strokeWidth={1.5} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                目前暫無此項礦物的交易走勢數據
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
