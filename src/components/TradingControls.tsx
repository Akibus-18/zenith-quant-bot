import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Square, Settings } from 'lucide-react';

interface TradingControlsProps {
  isTrading: boolean;
  config: {
    symbol: string;
    stake: number;
    contractType: string;
    duration: number;
    confidenceThreshold: number;
    takeProfit: number;
    stopLoss: number;
    martingaleMultiplier: number;
    barrier?: string;
  };
  onConfigChange: (config: any) => void;
  onStart: () => void;
  onStop: () => void;
}

export const TradingControls = ({
  isTrading,
  config,
  onConfigChange,
  onStart,
  onStop,
}: TradingControlsProps) => {
  return (
    <Card className="relative overflow-hidden border-card-border bg-card-glass/50 backdrop-blur-xl p-6">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-cyber" />
      
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/20">
          <Settings className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">TRADING CONTROLS</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">SYMBOL</Label>
          <Select value={config.symbol} onValueChange={(value) => onConfigChange({ ...config, symbol: value })}>
            <SelectTrigger className="bg-input border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="R_10">Volatility 10 Index</SelectItem>
              <SelectItem value="R_25">Volatility 25 Index</SelectItem>
              <SelectItem value="R_50">Volatility 50 Index</SelectItem>
              <SelectItem value="R_75">Volatility 75 Index</SelectItem>
              <SelectItem value="R_100">Volatility 100 Index</SelectItem>
              <SelectItem value="1HZ10V">Volatility 10 (1s) Index</SelectItem>
              <SelectItem value="1HZ25V">Volatility 25 (1s) Index</SelectItem>
              <SelectItem value="1HZ50V">Volatility 50 (1s) Index</SelectItem>
              <SelectItem value="1HZ75V">Volatility 75 (1s) Index</SelectItem>
              <SelectItem value="1HZ100V">Volatility 100 (1s) Index</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">CONTRACT TYPE</Label>
          <Select value={config.contractType} onValueChange={(value) => onConfigChange({ ...config, contractType: value })}>
            <SelectTrigger className="bg-input border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CALL">Rise/Fall</SelectItem>
              <SelectItem value="DIGITEVEN">Even/Odd</SelectItem>
              <SelectItem value="DIGITOVER">Over/Under</SelectItem>
              <SelectItem value="DIGITMATCH">Matches/Differs</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(config.contractType === 'DIGITOVER' || config.contractType === 'DIGITUNDER') && (
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">
              {config.contractType === 'DIGITOVER' ? 'DIGIT OVER' : 'DIGIT UNDER'}
            </Label>
            <Select 
              value={config.barrier || '5'} 
              onValueChange={(value) => onConfigChange({ ...config, barrier: value })}
            >
              <SelectTrigger className="bg-input border-border">
                <SelectValue placeholder="Select digit" />
              </SelectTrigger>
              <SelectContent>
                {config.contractType === 'DIGITOVER' ? (
                  <>
                    <SelectItem value="0">Over 0</SelectItem>
                    <SelectItem value="1">Over 1</SelectItem>
                    <SelectItem value="2">Over 2</SelectItem>
                    <SelectItem value="3">Over 3</SelectItem>
                    <SelectItem value="4">Over 4</SelectItem>
                    <SelectItem value="5">Over 5</SelectItem>
                    <SelectItem value="6">Over 6</SelectItem>
                    <SelectItem value="7">Over 7</SelectItem>
                    <SelectItem value="8">Over 8</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="1">Under 1</SelectItem>
                    <SelectItem value="2">Under 2</SelectItem>
                    <SelectItem value="3">Under 3</SelectItem>
                    <SelectItem value="4">Under 4</SelectItem>
                    <SelectItem value="5">Under 5</SelectItem>
                    <SelectItem value="6">Under 6</SelectItem>
                    <SelectItem value="7">Under 7</SelectItem>
                    <SelectItem value="8">Under 8</SelectItem>
                    <SelectItem value="9">Under 9</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">STAKE (USD)</Label>
          <Input
            type="number"
            step="0.01"
            min="0.35"
            value={config.stake}
            onChange={(e) => onConfigChange({ ...config, stake: parseFloat(e.target.value) })}
            className="bg-input border-border"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">DURATION (TICKS)</Label>
          <Input
            type="number"
            min="1"
            max="10"
            value={config.duration}
            onChange={(e) => onConfigChange({ ...config, duration: parseInt(e.target.value) })}
            className="bg-input border-border"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">CONFIDENCE THRESHOLD (%)</Label>
          <Input
            type="number"
            min="50"
            max="100"
            value={config.confidenceThreshold}
            onChange={(e) => onConfigChange({ ...config, confidenceThreshold: parseInt(e.target.value) })}
            className="bg-input border-border"
            disabled={isTrading}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">TAKE PROFIT ($)</Label>
          <Input
            type="number"
            step="1"
            min="0"
            value={config.takeProfit}
            onChange={(e) => onConfigChange({ ...config, takeProfit: parseFloat(e.target.value) || 0 })}
            className="bg-input border-border"
            placeholder="e.g., 20"
            disabled={isTrading}
          />
          <p className="text-xs text-muted-foreground">Bot stops when profit reaches this amount</p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">STOP LOSS ($)</Label>
          <Input
            type="number"
            step="1"
            min="0"
            value={config.stopLoss}
            onChange={(e) => onConfigChange({ ...config, stopLoss: parseFloat(e.target.value) || 0 })}
            className="bg-input border-border"
            placeholder="e.g., 20"
            disabled={isTrading}
          />
          <p className="text-xs text-muted-foreground">Bot stops when loss reaches this amount</p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">MARTINGALE MULTIPLIER</Label>
          <Input
            type="number"
            step="0.1"
            min="1"
            max="3"
            value={config.martingaleMultiplier}
            onChange={(e) => onConfigChange({ ...config, martingaleMultiplier: parseFloat(e.target.value) })}
            className="bg-input border-border"
            disabled={isTrading}
          />
        </div>
      </div>

      <div className="mt-6 flex gap-4">
        {!isTrading ? (
          <Button
            onClick={onStart}
            className="flex-1 bg-gradient-cyber hover:opacity-90 text-primary-foreground font-bold py-6 text-lg shadow-glow"
          >
            <Play className="w-5 h-5 mr-2" />
            START TRADING
          </Button>
        ) : (
          <Button
            onClick={onStop}
            variant="destructive"
            className="flex-1 font-bold py-6 text-lg shadow-glow"
          >
            <Square className="w-5 h-5 mr-2" />
            STOP TRADING
          </Button>
        )}
      </div>
    </Card>
  );
};
