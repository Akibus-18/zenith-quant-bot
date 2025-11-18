import { Card } from '@/components/ui/card';
import { Brain, Search, Clock, Zap, Pause } from 'lucide-react';
import { useEffect, useState } from 'react';

interface DecisionPanelProps {
  isTrading: boolean;
  signalStatus: string;
  hasSignal: boolean;
}

export const DecisionPanel = ({ isTrading, signalStatus, hasSignal }: DecisionPanelProps) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!isTrading) {
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isTrading]);

  const getDecisionState = () => {
    if (!isTrading) return { text: 'IDLE', icon: Pause, color: 'text-muted-foreground' };
    if (signalStatus === 'INITIALIZING') return { text: 'INITIALIZING', icon: Clock, color: 'text-primary' };
    if (signalStatus === 'ANALYZING') return { text: 'SCANNING MARKET', icon: Search, color: 'text-secondary animate-pulse' };
    if (hasSignal && signalStatus !== 'ANALYZING') return { text: 'SIGNAL FOUND - EXECUTING', icon: Zap, color: 'text-success animate-pulse' };
    return { text: 'WAITING FOR SIGNAL', icon: Brain, color: 'text-primary' };
  };

  const state = getDecisionState();
  const Icon = state.icon;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="relative overflow-hidden border-card-border bg-card-glass/50 backdrop-blur-xl p-6">
      <div className={`absolute top-0 left-0 w-full h-1 ${isTrading ? 'bg-gradient-cyber animate-pulse-glow' : 'bg-muted'}`} />
      
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-4">AI DECISION ENGINE</p>
        
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className={`p-4 rounded-lg ${isTrading ? 'bg-primary/20' : 'bg-muted/20'}`}>
            <Icon className={`w-10 h-10 ${state.color}`} />
          </div>
          <div className="text-left">
            <p className={`text-2xl font-bold ${state.color}`}>{state.text}</p>
            {isTrading && (
              <p className="text-sm text-muted-foreground mt-1">
                Running for {formatTime(elapsedTime)}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-background/50 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">PATTERN</p>
            <p className="text-sm font-bold text-primary">ANALYZING</p>
          </div>
          <div className="bg-background/50 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">TREND</p>
            <p className="text-sm font-bold text-secondary">DETECTING</p>
          </div>
          <div className="bg-background/50 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">CONFIDENCE</p>
            <p className="text-sm font-bold text-accent">CALCULATING</p>
          </div>
        </div>

        {isTrading && (
          <div className="mt-4 p-3 bg-background/30 rounded-lg">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>Market Analysis Progress</span>
              <span>{hasSignal ? '100%' : '...'}</span>
            </div>
            <div className="w-full bg-background/50 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${hasSignal ? 'bg-gradient-cyber w-full' : 'bg-primary/50 w-1/2 animate-pulse'}`}
              />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
