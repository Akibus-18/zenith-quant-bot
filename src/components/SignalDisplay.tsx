import { Card } from '@/components/ui/card';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { IndicatorData } from '@/lib/tradingIndicators';

interface SignalDisplayProps {
  signal: {
    type: string;
    confidence: number;
    indicators: IndicatorData;
  } | null;
  status: string;
}

export const SignalDisplay = ({ signal, status }: SignalDisplayProps) => {
  const getSignalColor = () => {
    if (!signal) return 'text-muted-foreground';
    if (signal.type.includes('CALL') || signal.type.includes('RISE') || signal.type.includes('OVER')) {
      return 'text-success';
    }
    if (signal.type.includes('PUT') || signal.type.includes('FALL') || signal.type.includes('UNDER')) {
      return 'text-destructive';
    }
    return 'text-primary';
  };

  const getSignalIcon = () => {
    if (!signal) return <Activity className="w-8 h-8" />;
    if (signal.type.includes('CALL') || signal.type.includes('RISE') || signal.type.includes('OVER')) {
      return <TrendingUp className="w-8 h-8" />;
    }
    if (signal.type.includes('PUT') || signal.type.includes('FALL') || signal.type.includes('UNDER')) {
      return <TrendingDown className="w-8 h-8" />;
    }
    return <Minus className="w-8 h-8" />;
  };

  return (
    <Card className="relative overflow-hidden border-card-border bg-card-glass/50 backdrop-blur-xl p-6">
      <div className={`absolute top-0 left-0 w-full h-1 ${signal ? 'bg-gradient-cyber animate-pulse-glow' : 'bg-muted'}`} />
      
      <div className="text-center mb-6">
        <p className="text-sm text-muted-foreground mb-2">SIGNAL STATUS</p>
        <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-lg ${getSignalColor()} bg-current/10`}>
          {getSignalIcon()}
          <p className="text-2xl font-bold">{status}</p>
        </div>
      </div>

      {signal && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-background/50 p-4 rounded-lg text-center">
              <p className="text-xs text-muted-foreground mb-1">CONFIDENCE</p>
              <p className={`text-2xl font-bold ${getSignalColor()}`}>
                {signal.confidence.toFixed(0)}%
              </p>
            </div>
            <div className="bg-background/50 p-4 rounded-lg text-center">
              <p className="text-xs text-muted-foreground mb-1">TREND</p>
              <p className={`text-2xl font-bold ${signal.indicators.trend === 'BULLISH' ? 'text-success' : signal.indicators.trend === 'BEARISH' ? 'text-destructive' : 'text-muted-foreground'}`}>
                {signal.indicators.trend}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center bg-background/30 p-3 rounded">
              <span className="text-sm text-muted-foreground">RSI</span>
              <span className="text-sm font-bold text-primary">{signal.indicators.rsi.toFixed(1)}</span>
            </div>
            <div className="flex justify-between items-center bg-background/30 p-3 rounded">
              <span className="text-sm text-muted-foreground">MACD</span>
              <span className={`text-sm font-bold ${signal.indicators.macd.histogram > 0 ? 'text-success' : 'text-destructive'}`}>
                {signal.indicators.macd.histogram.toFixed(4)}
              </span>
            </div>
            <div className="flex justify-between items-center bg-background/30 p-3 rounded">
              <span className="text-sm text-muted-foreground">EMA 20/50</span>
              <span className="text-sm font-bold text-primary">
                {signal.indicators.ema.ema20.toFixed(2)} / {signal.indicators.ema.ema50.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center bg-background/30 p-3 rounded">
              <span className="text-sm text-muted-foreground">STOCHASTIC</span>
              <span className="text-sm font-bold text-secondary">
                K: {signal.indicators.stochastic.k.toFixed(1)} / D: {signal.indicators.stochastic.d.toFixed(1)}
              </span>
            </div>
          </div>
        </>
      )}
    </Card>
  );
};
