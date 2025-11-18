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
  barrier?: string;
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

  // Enhanced pattern recognition
  private detectSupportResistance(prices: number[]): { support: number; resistance: number } {
    const recentPrices = prices.slice(-50);
    const sorted = [...recentPrices].sort((a, b) => a - b);
    
    // Support: price levels where price bounces up
    const support = sorted[Math.floor(sorted.length * 0.2)];
    
    // Resistance: price levels where price bounces down
    const resistance = sorted[Math.floor(sorted.length * 0.8)];
    
    return { support, resistance };
  }

  private calculateVolatility(prices: number[]): number {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  private detectPattern(prices: number[]): { pattern: string; strength: number } {
    const recent = prices.slice(-20);
    
    // Detect higher highs and higher lows (uptrend)
    let higherHighs = 0;
    let higherLows = 0;
    
    for (let i = 4; i < recent.length; i += 4) {
      const prevHigh = Math.max(...recent.slice(i - 4, i));
      const currHigh = Math.max(...recent.slice(i, Math.min(i + 4, recent.length)));
      
      const prevLow = Math.min(...recent.slice(i - 4, i));
      const currLow = Math.min(...recent.slice(i, Math.min(i + 4, recent.length)));
      
      if (currHigh > prevHigh) higherHighs++;
      if (currLow > prevLow) higherLows++;
    }
    
    if (higherHighs >= 3 && higherLows >= 2) {
      return { pattern: 'STRONG_UPTREND', strength: 85 };
    }
    
    // Detect lower highs and lower lows (downtrend)
    let lowerHighs = 0;
    let lowerLows = 0;
    
    for (let i = 4; i < recent.length; i += 4) {
      const prevHigh = Math.max(...recent.slice(i - 4, i));
      const currHigh = Math.max(...recent.slice(i, Math.min(i + 4, recent.length)));
      
      const prevLow = Math.min(...recent.slice(i - 4, i));
      const currLow = Math.min(...recent.slice(i, Math.min(i + 4, recent.length)));
      
      if (currHigh < prevHigh) lowerHighs++;
      if (currLow < prevLow) lowerLows++;
    }
    
    if (lowerHighs >= 3 && lowerLows >= 2) {
      return { pattern: 'STRONG_DOWNTREND', strength: 85 };
    }
    
    return { pattern: 'RANGING', strength: 50 };
  }

  // Analyze market and generate signal with enhanced AI
  generateSignal(symbol: string, config: TradeConfig): TradeSignal | null {
    const prices = this.priceHistory.get(symbol);

    if (!prices || prices.length < 50) {
      console.log(`⏳ Insufficient data for ${symbol} (${prices?.length || 0}/50)`);
      return null;
    }

    // Analyze indicators
    const indicators = TradingIndicators.analyzeMarket(prices);
    
    // Enhanced pattern detection
    const { support, resistance } = this.detectSupportResistance(prices);
    const volatility = this.calculateVolatility(prices);
    const { pattern, strength: patternStrength } = this.detectPattern(prices);
    
    const currentPrice = prices[prices.length - 1];

    // Determine contract type based on indicators
    let contractType = config.contractType;
    let confidence = 0;

    // For Rise/Fall contracts - Enhanced with pattern recognition
    if (contractType === 'CALL' || contractType === 'PUT') {
      const bullishScore = TradingIndicators.calculateConfidence(indicators, 'CALL');
      const bearishScore = TradingIndicators.calculateConfidence(indicators, 'PUT');
      
      // Enhance with pattern analysis
      let patternBonus = 0;
      if (pattern === 'STRONG_UPTREND') {
        patternBonus = patternStrength * 0.15; // Up to +12.75% for bullish
      } else if (pattern === 'STRONG_DOWNTREND') {
        patternBonus = -patternStrength * 0.15; // Up to -12.75% for bearish
      }
      
      // Support/Resistance bonus
      const distanceToSupport = (currentPrice - support) / support;
      const distanceToResistance = (resistance - currentPrice) / currentPrice;
      
      let srBonus = 0;
      if (distanceToSupport < 0.005) { // Near support, likely to bounce up
        srBonus = 8;
      } else if (distanceToResistance < 0.005) { // Near resistance, likely to bounce down
        srBonus = -8;
      }

      const adjustedBullish = bullishScore + patternBonus + srBonus;
      const adjustedBearish = bearishScore - patternBonus - srBonus;

      if (adjustedBullish > adjustedBearish && adjustedBullish >= 60) {
        contractType = 'CALL';
        confidence = Math.min(95, adjustedBullish);
      } else if (adjustedBearish >= 60) {
        contractType = 'PUT';
        confidence = Math.min(95, adjustedBearish);
      } else {
        return null; // Not confident enough
      }
    }

    // For Even/Odd contracts - Enhanced pattern analysis
    else if (contractType === 'DIGITEVEN' || contractType === 'DIGITODD') {
      const recentDigits = prices.slice(-30).map(p => Math.floor((p * 100) % 10));
      const evenCount = recentDigits.filter(d => d % 2 === 0).length;
      
      // Pattern detection: streaks
      let currentStreak = 1;
      for (let i = recentDigits.length - 1; i > 0; i--) {
        if ((recentDigits[i] % 2) === (recentDigits[i - 1] % 2)) {
          currentStreak++;
        } else {
          break;
        }
      }
      
      // Mean reversion after long streaks
      if (evenCount > 20) {
        contractType = 'DIGITODD';
        confidence = 60 + Math.min(25, (evenCount - 20) * 3);
      } else if (evenCount < 10) {
        contractType = 'DIGITEVEN';
        confidence = 60 + Math.min(25, (10 - evenCount) * 3);
      } else if (currentStreak >= 5) {
        // Reverse after long streak
        const lastDigit = recentDigits[recentDigits.length - 1];
        contractType = lastDigit % 2 === 0 ? 'DIGITODD' : 'DIGITEVEN';
        confidence = 55 + currentStreak * 3;
      } else {
        return null; // No clear pattern
      }
    }

    // For Over/Under contracts - Advanced digit prediction with volatility
    else if (contractType === 'DIGITOVER' || contractType === 'DIGITUNDER') {
      const recentDigits = prices.slice(-40).map(p => {
        const priceStr = p.toFixed(5);
        return parseInt(priceStr[priceStr.length - 1]);
      });
      
      const barrier = config.barrier ? parseInt(config.barrier) : 5;
      
      // Frequency analysis
      const digitFrequency = new Array(10).fill(0);
      recentDigits.forEach(d => digitFrequency[d]++);
      
      // Recent trend
      const recentHigh = recentDigits.slice(-10).filter(d => d > barrier).length;
      const recentLow = recentDigits.slice(-10).filter(d => d <= barrier).length;
      
      // Overall distribution
      const overallHigh = recentDigits.filter(d => d > barrier).length;
      const overallLow = recentDigits.filter(d => d <= barrier).length;
      
      // Volatility factor
      const volatilityFactor = volatility > 0.01 ? 1.1 : 0.9;
      
      if (contractType === 'DIGITOVER') {
        // Mean reversion: if many low digits, expect high
        if (recentLow > recentHigh * 1.8) {
          confidence = 65 + Math.min(20, (recentLow - recentHigh) * 3);
          confidence *= volatilityFactor;
        } 
        // Momentum: if trending high with bullish indicators
        else if (recentHigh > recentLow && indicators.trend === 'BULLISH' && indicators.rsi > 55) {
          confidence = 68 + (indicators.rsi - 55) * 0.5;
        }
        // Pattern analysis
        else if (overallLow > overallHigh * 1.5) {
          confidence = 62 + Math.min(15, (overallLow - overallHigh) * 2);
        }
        else {
          return null;
        }
      } else { // DIGITUNDER
        if (recentHigh > recentLow * 1.8) {
          confidence = 65 + Math.min(20, (recentHigh - recentLow) * 3);
          confidence *= volatilityFactor;
        }
        else if (recentLow > recentHigh && indicators.trend === 'BEARISH' && indicators.rsi < 45) {
          confidence = 68 + (45 - indicators.rsi) * 0.5;
        }
        else if (overallHigh > overallLow * 1.5) {
          confidence = 62 + Math.min(15, (overallHigh - overallLow) * 2);
        }
        else {
          return null;
        }
      }
      
      confidence = Math.min(95, confidence);
    }

    // For Matches/Differs contracts
    else if (contractType === 'DIGITMATCH' || contractType === 'DIGITDIFF') {
      const recentDigits = prices.slice(-30).map(p => Math.floor((p * 100) % 10));
      const targetDigit = parseInt(config.barrier || '5');
      
      const digitAppearances = recentDigits.filter(d => d === targetDigit).length;
      const recentAppearances = recentDigits.slice(-10).filter(d => d === targetDigit).length;
      
      // Mean reversion
      if (recentAppearances >= 4) {
        contractType = 'DIGITDIFF';
        confidence = 62 + recentAppearances * 4;
      } else if (digitAppearances > 8) {
        contractType = 'DIGITDIFF';
        confidence = 58 + digitAppearances * 2;
      } else if (recentAppearances === 0 && digitAppearances < 2) {
        contractType = 'DIGITMATCH';
        confidence = 60 + (2 - digitAppearances) * 5;
      } else {
        return null;
      }
      
      confidence = Math.min(95, confidence);
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
    
    // CRITICAL: Round to 2 decimal places to avoid API rejection
    stake = Math.round(stake * 100) / 100;

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

      // Add barrier for digit contracts
      if (signal.type === 'DIGITOVER' || signal.type === 'DIGITUNDER' || 
          signal.type === 'DIGITMATCH' || signal.type === 'DIGITDIFF') {
        params.barrier = config.barrier || '5';
        console.log(`🎯 Using barrier: ${params.barrier} for ${signal.type}`);
      }

      const response = await derivAPI.buyContract(params);

      if (response.buy) {
        const contract = response.buy;
        this.activeContracts.set(contract.contract_id, {
          ...contract,
          signal,
          stake,
        });

        console.log(`✅ Contract ${contract.contract_id} opened | Payout: $${contract.payout}`);
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
