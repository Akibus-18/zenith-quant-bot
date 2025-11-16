import { Card } from '@/components/ui/card';
import { Activity, TrendingUp, TrendingDown, Target } from 'lucide-react';

interface StatsPanelProps {
  stats: {
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    totalProfit: number;
  };
  balance: number;
}

export const StatsPanel = ({ stats, balance }: StatsPanelProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="relative overflow-hidden border-card-border bg-card-glass/50 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-cyber opacity-10" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/20">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">BALANCE</p>
          </div>
          <p className="text-3xl font-bold text-primary animate-pulse-glow">
            ${balance.toFixed(2)}
          </p>
        </div>
      </Card>

      <Card className="relative overflow-hidden border-card-border bg-card-glass/50 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-glow opacity-10" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-success/20">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">WIN RATE</p>
          </div>
          <p className="text-3xl font-bold text-success">
            {stats.winRate.toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.wins}W / {stats.losses}L
          </p>
        </div>
      </Card>

      <Card className="relative overflow-hidden border-card-border bg-card-glass/50 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-glow opacity-10" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg ${stats.totalProfit >= 0 ? 'bg-success/20' : 'bg-destructive/20'}`}>
              {stats.totalProfit >= 0 ? (
                <TrendingUp className="w-5 h-5 text-success" />
              ) : (
                <TrendingDown className="w-5 h-5 text-destructive" />
              )}
            </div>
            <p className="text-sm text-muted-foreground font-medium">PROFIT/LOSS</p>
          </div>
          <p className={`text-3xl font-bold ${stats.totalProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
            {stats.totalProfit >= 0 ? '+' : ''}${stats.totalProfit.toFixed(2)}
          </p>
        </div>
      </Card>

      <Card className="relative overflow-hidden border-card-border bg-card-glass/50 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-glow opacity-10" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-secondary/20">
              <Target className="w-5 h-5 text-secondary" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">TRADES</p>
          </div>
          <p className="text-3xl font-bold text-secondary">
            {stats.totalTrades}
          </p>
        </div>
      </Card>
    </div>
  );
};
