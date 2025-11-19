import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { StatsPanel } from '@/components/StatsPanel';
import { TradingControls } from '@/components/TradingControls';
import { SignalDisplay } from '@/components/SignalDisplay';
import { DecisionPanel } from '@/components/DecisionPanel';
import { TradeHistory } from '@/components/TradeHistory';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { derivAPI } from '@/lib/derivWebSocket';
import { tradingEngine } from '@/lib/tradingEngine';
import { Cpu, Zap, Lock } from 'lucide-react';

const Index = () => {
  const { toast } = useToast();
  
  // Connection state
  const [apiToken, setApiToken] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [accountId, setAccountId] = useState('Not connected');
  const [balance, setBalance] = useState(0);
  
  // Trading state
  const [isTrading, setIsTrading] = useState(false);
  const isTradingRef = useRef(false);
  const [currentSignal, setCurrentSignal] = useState<any>(null);
  const [signalStatus, setSignalStatus] = useState('IDLE');
  const [config, setConfig] = useState({
    symbol: 'R_50',
    stake: 1.0,
    contractType: 'CALL',
    duration: 5,
    durationUnit: 't',
    confidenceThreshold: 65,
    takeProfit: 20,
    stopLoss: 20,
    martingaleMultiplier: 1.5,
    barrier: '5',
  });
  
  // Use ref to always have latest config in trading loop
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const [stats, setStats] = useState({
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalProfit: 0,
  });

  const [tradeHistory, setTradeHistory] = useState<any[]>([]);

  // Connect to Deriv API
  const handleConnect = async () => {
    if (!apiToken.trim()) {
      toast({
        title: '❌ Error',
        description: 'Please enter your API token',
        variant: 'destructive',
      });
      return;
    }

    try {
      toast({
        title: '🔌 Connecting...',
        description: 'Establishing connection to Deriv API',
      });

      const auth = await derivAPI.connect(apiToken);
      
      if (auth.authorize) {
        setIsConnected(true);
        setAccountId(auth.authorize.loginid);
        setBalance(auth.authorize.balance);

        toast({
          title: '✅ Connected',
          description: `Welcome ${auth.authorize.loginid}`,
        });

        // Subscribe to balance updates
        derivAPI.subscribe('balance', (data) => {
          if (data.balance) {
            setBalance(data.balance.balance);
          }
        });

        // Subscribe to proposal updates
        derivAPI.subscribe('proposal_open_contract', (data) => {
          if (data.proposal_open_contract) {
            tradingEngine.handleContractUpdate(data.proposal_open_contract);
            updateStats();
          }
        });

        // Start receiving ticks
        startTickStream();
      }
    } catch (error: any) {
      toast({
        title: '❌ Connection Failed',
        description: error.message || 'Failed to connect to Deriv API',
        variant: 'destructive',
      });
      console.error('Connection error:', error);
    }
  };

  // Start tick stream
  const startTickStream = async () => {
    try {
      await derivAPI.getTicks(config.symbol);
      
      derivAPI.subscribe('tick', (data) => {
        if (data.tick && data.tick.symbol === configRef.current.symbol) {
          tradingEngine.addPriceData(configRef.current.symbol, data.tick.quote);
          
          // Check for trading signals - use ref to get current config
          if (isTradingRef.current) {
            analyzeAndTrade();
          }
        }
      });
    } catch (error) {
      console.error('Failed to start tick stream:', error);
    }
  };

  // Analyze market and execute trades
  const analyzeAndTrade = useCallback(() => {
    const currentConfig = configRef.current;
    
    // Check take profit / stop loss
    if (tradingEngine.checkTakeProfitStopLoss(currentConfig)) {
      setIsTrading(false);
      isTradingRef.current = false;
      setSignalStatus('IDLE');
      
      const sessionPL = tradingEngine.getSessionProfitLoss();
      toast({
        title: sessionPL.net > 0 ? '🎯 Take Profit Reached' : '🛑 Stop Loss Reached',
        description: `Session P/L: $${sessionPL.net.toFixed(2)} | Trading stopped automatically`,
        variant: sessionPL.net > 0 ? 'default' : 'destructive',
      });
      return;
    }

    const signal = tradingEngine.generateSignal(currentConfig.symbol, currentConfig);
    
    if (signal) {
      setCurrentSignal(signal);
      setSignalStatus(`${signal.type} @ ${signal.confidence.toFixed(0)}%`);
      
      // Execute trade immediately
      tradingEngine.executeTrade(signal, currentConfig).then(() => {
        updateStats();
        updateHistory();
      });
    } else {
      setSignalStatus('SCANNING');
    }
  }, [toast]);

  // Update stats
  const updateStats = () => {
    const engineStats = tradingEngine.getStats();
    setStats(engineStats);
  };

  // Update trade history
  const updateHistory = () => {
    const history = tradingEngine.getHistory();
    setTradeHistory(history);
  };

  // Start trading
  const handleStartTrading = async () => {
    if (!isConnected) {
      toast({
        title: '❌ Not Connected',
        description: 'Please connect to Deriv API first',
        variant: 'destructive',
      });
      return;
    }

    setIsTrading(true);
    isTradingRef.current = true;
    setSignalStatus('INITIALIZING');
    
    toast({
      title: '⚡ Trading Started',
      description: `Bot is now analyzing ${config.symbol}`,
    });

    // Reset engine
    tradingEngine.reset();
    setStats({
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalProfit: 0,
    });
    setTradeHistory([]);

    // Start tick stream for selected symbol
    await startTickStream();
  };

  // Stop trading
  const handleStopTrading = () => {
    setIsTrading(false);
    isTradingRef.current = false;
    setSignalStatus('STOPPED');
    setCurrentSignal(null);
    
    toast({
      title: '⏹️ Trading Stopped',
      description: 'Bot has been stopped',
    });
  };

  // Handle symbol change
  useEffect(() => {
    if (isConnected && !isTrading) {
      startTickStream();
    }
  }, [config.symbol]);

  return (
    <div className="min-h-screen relative">
      <AnimatedBackground />
      
      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-primary blur-2xl opacity-50 animate-pulse-glow" />
              <Cpu className="w-16 h-16 text-primary relative z-10" />
            </div>
            <div>
              <h1 className="text-5xl font-bold bg-gradient-cyber bg-clip-text text-transparent">
                QUANTUM SCALPER <span className="text-secondary">PRO</span>
              </h1>
              <p className="text-muted-foreground flex items-center gap-2 mt-2">
                <Zap className="w-4 h-4" />
                AI-Powered Multi-Strategy Trading Bot
              </p>
            </div>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 ${isConnected ? 'bg-success/20 text-success' : 'bg-muted/20 text-muted-foreground'}`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
              {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
            </div>
            {isConnected && (
              <>
                <div className="px-4 py-2 rounded-lg bg-card-glass/50 backdrop-blur-xl border border-border">
                  <span className="text-muted-foreground text-sm">ACCOUNT: </span>
                  <span className="font-bold text-primary">{accountId}</span>
                </div>
                <div className="px-4 py-2 rounded-lg bg-card-glass/50 backdrop-blur-xl border border-border">
                  <span className="text-muted-foreground text-sm">BALANCE: </span>
                  <span className="font-bold text-primary">${balance.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Connection Panel */}
        {!isConnected && (
          <Card className="relative overflow-hidden border-card-border bg-card-glass/50 backdrop-blur-xl p-8 mb-8">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-cyber animate-pulse-glow" />
            
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-lg bg-primary/20">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-foreground">API CONNECTION</h2>
                <p className="text-sm text-muted-foreground">Connect your Deriv account to start trading</p>
              </div>
            </div>

            <div className="flex gap-4">
              <Input
                type="password"
                placeholder="Enter your Deriv API Token"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                className="flex-1 bg-input border-border text-lg py-6"
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
              />
              <Button
                onClick={handleConnect}
                className="bg-gradient-cyber hover:opacity-90 text-primary-foreground font-bold px-8 text-lg shadow-glow"
              >
                CONNECT
              </Button>
            </div>

            <div className="mt-4 p-4 bg-background/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                💡 Get your API token from{' '}
                <a
                  href="https://app.deriv.com/account/api-token"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  Deriv API Token Settings
                </a>
              </p>
            </div>
          </Card>
        )}

        {/* Main Dashboard */}
        {isConnected && (
          <div className="space-y-6">
            {/* Stats */}
            <StatsPanel stats={stats} balance={balance} />

            {/* Controls and Signals */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <TradingControls
                  isTrading={isTrading}
                  config={config}
                  onConfigChange={setConfig}
                  onStart={handleStartTrading}
                  onStop={handleStopTrading}
                />
              </div>
              
              <div className="space-y-6">
                <SignalDisplay signal={currentSignal} status={signalStatus} />
                <DecisionPanel 
                  isTrading={isTrading} 
                  signalStatus={signalStatus} 
                  hasSignal={currentSignal !== null} 
                />
              </div>
            </div>

            {/* Trade History */}
            <TradeHistory trades={tradeHistory} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
