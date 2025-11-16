import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, TrendingUp, TrendingDown } from 'lucide-react';

interface Trade {
  id: string;
  symbol: string;
  type: string;
  stake: number;
  profit: number;
  result: 'WIN' | 'LOSS' | 'PENDING';
  timestamp: number;
}

interface TradeHistoryProps {
  trades: Trade[];
}

export const TradeHistory = ({ trades }: TradeHistoryProps) => {
  return (
    <Card className="relative overflow-hidden border-card-border bg-card-glass/50 backdrop-blur-xl p-6">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-cyber" />
      
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/20">
          <History className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">TRADE HISTORY</h2>
      </div>

      <ScrollArea className="h-[400px] w-full">
        {trades.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <History className="w-16 h-16 mb-4 opacity-20" />
            <p>No trades yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {trades.map((trade) => (
              <div
                key={trade.id}
                className="flex items-center justify-between p-4 bg-background/50 rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${trade.result === 'WIN' ? 'bg-success/20' : 'bg-destructive/20'}`}>
                    {trade.result === 'WIN' ? (
                      <TrendingUp className="w-5 h-5 text-success" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-destructive" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{trade.symbol}</p>
                    <p className="text-xs text-muted-foreground">{trade.type}</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className={`text-lg font-bold ${trade.result === 'WIN' ? 'text-success' : 'text-destructive'}`}>
                    {trade.result === 'WIN' ? '+' : ''}${trade.profit.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Stake: ${trade.stake.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
};
