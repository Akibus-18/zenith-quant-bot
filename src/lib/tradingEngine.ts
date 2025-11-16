/**
 * Advanced Trading Engine with AI-powered decision making
 * Supports: Rise/Fall, Even/Odd, Over/Under, Matches/Differs
 */

import { TradingIndicators, IndicatorData } from './tradingIndicators';
import { derivAPI } from './derivWebSocket';

export interface TradeConfig {
  symbol: string;
  stake: number;
  contractType: string;
  duration: number;
  durationUnit: string;
  confidenceThreshold: number;
  takeProfit: number;
  stopLoss: number;
  martingaleMultiplier: number;
}

export interface TradeSignal {
  symbol: string;
  type: string;
  confidence: number;
  indicators: IndicatorData;
  timestamp: number;
}

export interface TradeResult {
  id: string;
  symbol: string;
  type: string;
  stake: number;
  profit: number;
  result: 'WIN' | 'LOSS' | 'PENDING';
  timestamp: number;
}

export class TradingEngine {
  private priceHistory: Map<string, number[]> = new Map();
  private activeContracts: Map<string, any> = new Map();
  private tradeHistory: TradeResult[] = [];
  private isTrading: boolean = false;
  private cooldownActive: boolean = false;
  private lastTrade: number = 0;
  private consecutiveLosses: number = 0;

  constructor() {}

  // Add price data
  addPriceData(symbol: string, price: number) {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }

    const history = this.priceHistory.get(symbol)!;
    history.push(price);

    // Keep last 100 prices
    if (history.length > 100) {
      history.shift();
    }
  }

  // Analyze market and generate signal
  generateSignal(symbol: string, config: TradeConfig): TradeSignal | null {
    const prices = this.priceHistory.get(symbol);

    if (!prices || prices.length < 50) {
      console.log(`⏳ Insufficient data for ${symbol} (${prices?.length || 0}/50)`);
      return null;
    }

    // Analyze indicators
    const indicators = TradingIndicators.analyzeMarket(prices);

    // Determine contract type based on indicators
    let contractType = config.contractType;
    let confidence = 0;

    // For Rise/Fall contracts
    if (contractType === 'CALL' || contractType === 'PUT') {
      const bullishScore = TradingIndicators.calculateConfidence(indicators, 'CALL');
      const bearishScore = TradingIndicators.calculateConfidence(indicators, 'PUT');

      if (bullishScore > bearishScore) {
        contractType = 'CALL';
        confidence = bullishScore;
      } else {
        contractType = 'PUT';
        confidence = bearishScore;
      }
    }

    // For Even/Odd contracts
    else if (contractType === 'DIGITEVEN' || contractType === 'DIGITODD') {
      const currentPrice = prices[prices.length - 1];
      const lastDigit = Math.floor((currentPrice * 100) % 10);
      
      // Pattern analysis for digit prediction
      const recentDigits = prices.slice(-10).map(p => Math.floor((p * 100) % 10));
      const evenCount = recentDigits.filter(d => d % 2 === 0).length;
      
      if (evenCount > 6) {
        contractType = 'DIGITODD'; // Contrarian approach
        confidence = 55 + (evenCount - 6) * 5;
      } else if (evenCount < 4) {
        contractType = 'DIGITEVEN';
        confidence = 55 + (4 - evenCount) * 5;
      } else {
        contractType = lastDigit % 2 === 0 ? 'DIGITODD' : 'DIGITEVEN';
        confidence = 52;
      }
    }

    // For Over/Under contracts
    else if (contractType === 'DIGITOVER' || contractType === 'DIGITUNDER') {
      const recentPrices = prices.slice(-5);
      const avg = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
      const current = prices[prices.length - 1];
      
      if (indicators.trend === 'BULLISH') {
        contractType = 'DIGITOVER';
        confidence = 60;
      } else {
        contractType = 'DIGITUNDER';
        confidence = 60;
      }
    }

    // For Matches/Differs contracts
    else if (contractType === 'DIGITMATCH' || contractType === 'DIGITDIFF') {
      const currentPrice = prices[prices.length - 1];
      const lastDigit = Math.floor((currentPrice * 100) % 10);
      const recentDigits = prices.slice(-20).map(p => Math.floor((p * 100) % 10));
      
      const digitFrequency = recentDigits.filter(d => d === lastDigit).length;
      
      // If digit appears frequently, expect difference
      if (digitFrequency > 5) {
        contractType = 'DIGITDIFF';
        confidence = 55 + digitFrequency;
      } else {
        contractType = 'DIGITMATCH';
        confidence = 50 + (5 - digitFrequency);
      }
    }

    // Check confidence threshold
    if (confidence < config.confidenceThreshold) {
      return null;
    }

    return {
      symbol,
      type: contractType,
      confidence,
      indicators,
      timestamp: Date.now(),
    };
  }

  // Execute trade
  async executeTrade(signal: TradeSignal, config: TradeConfig): Promise<void> {
    if (this.cooldownActive) {
      console.log('⏳ Cooldown active, skipping trade');
      return;
    }

    // Apply martingale if there are consecutive losses
    let stake = config.stake;
    if (this.consecutiveLosses > 0) {
      stake = config.stake * Math.pow(config.martingaleMultiplier, this.consecutiveLosses);
      stake = Math.min(stake, config.stake * 5); // Cap at 5x
    }

    console.log(`⚡ Executing ${signal.type} on ${signal.symbol} | Stake: $${stake.toFixed(2)} | Confidence: ${signal.confidence.toFixed(0)}%`);

    try {
      const params: any = {
        amount: stake,
        basis: 'stake',
        contract_type: signal.type,
        currency: 'USD',
        duration: config.duration,
        duration_unit: config.durationUnit,
        symbol: signal.symbol,
      };

      // Add barriers for digit contracts if needed
      if (signal.type === 'DIGITOVER' || signal.type === 'DIGITUNDER') {
        params.barrier = '5'; // Default barrier for over/under
      }

      const response = await derivAPI.buyContract(params);

      if (response.buy) {
        const contract = response.buy;
        this.activeContracts.set(contract.contract_id, {
          ...contract,
          signal,
          stake,
        });

        console.log(`✅ Contract ${contract.contract_id} opened`);
        this.startCooldown(15000); // 15 second cooldown
      }
    } catch (error: any) {
      console.error('❌ Trade execution failed:', error.message);
    }
  }

  // Handle contract update
  handleContractUpdate(contract: any) {
    const contractId = contract.contract_id;

    if (!this.activeContracts.has(contractId)) {
      return;
    }

    if (contract.is_sold) {
      const storedContract = this.activeContracts.get(contractId);
      const profit = parseFloat(contract.profit);
      const result: TradeResult = {
        id: contractId,
        symbol: contract.underlying,
        type: storedContract.signal.type,
        stake: storedContract.stake,
        profit: profit,
        result: profit > 0 ? 'WIN' : 'LOSS',
        timestamp: Date.now(),
      };

      this.tradeHistory.push(result);
      this.activeContracts.delete(contractId);

      if (profit > 0) {
        this.consecutiveLosses = 0;
        console.log(`✅ WIN: +$${profit.toFixed(2)}`);
      } else {
        this.consecutiveLosses++;
        console.log(`❌ LOSS: $${profit.toFixed(2)}`);
      }
    }
  }

  // Cooldown management
  private startCooldown(duration: number) {
    this.cooldownActive = true;
    this.lastTrade = Date.now();

    setTimeout(() => {
      this.cooldownActive = false;
      console.log('✅ Cooldown ended');
    }, duration);
  }

  // Get trading stats
  getStats() {
    const wins = this.tradeHistory.filter(t => t.result === 'WIN').length;
    const losses = this.tradeHistory.filter(t => t.result === 'LOSS').length;
    const totalProfit = this.tradeHistory.reduce((sum, t) => sum + t.profit, 0);
    const winRate = this.tradeHistory.length > 0 ? (wins / this.tradeHistory.length) * 100 : 0;

    return {
      totalTrades: this.tradeHistory.length,
      wins,
      losses,
      winRate,
      totalProfit,
      consecutiveLosses: this.consecutiveLosses,
    };
  }

  // Get trade history
  getHistory(): TradeResult[] {
    return [...this.tradeHistory].reverse();
  }

  // Clear history
  clearHistory() {
    this.tradeHistory = [];
    this.consecutiveLosses = 0;
  }

  // Reset engine
  reset() {
    this.priceHistory.clear();
    this.activeContracts.clear();
    this.tradeHistory = [];
    this.consecutiveLosses = 0;
    this.cooldownActive = false;
  }
}

export const tradingEngine = new TradingEngine();
