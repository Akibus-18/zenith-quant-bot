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
  private digitHistory: Map<string, number[]> = new Map(); // Track last digits
  private activeContracts: Map<string, any> = new Map();
  private tradeHistory: TradeResult[] = [];
  private isTrading: boolean = false;
  private cooldownActive: boolean = false;
  private lastTrade: number = 0;
  private consecutiveLosses: number = 0;
  private sessionProfit: number = 0;
  private sessionLoss: number = 0;

  constructor() {}

  // Add price data and track digits
  addPriceData(symbol: string, price: number) {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
      this.digitHistory.set(symbol, []);
    }

    const history = this.priceHistory.get(symbol)!;
    const digits = this.digitHistory.get(symbol)!;
    
    history.push(price);
    
    // Extract last digit for digit analysis
    const priceStr = price.toFixed(5);
    const lastDigit = parseInt(priceStr[priceStr.length - 1]);
    digits.push(lastDigit);

    // Keep last 100 prices and digits
    if (history.length > 100) {
      history.shift();
      digits.shift();
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

  // Advanced digit frequency analysis (from digitsanalyzer.com)
  private analyzeDigitFrequency(digits: number[]): {
    frequency: number[];
    hotDigits: number[];
    coldDigits: number[];
    evenOddRatio: number;
    prediction: { digit: number; confidence: number; reason: string } | null;
  } {
    const frequency = new Array(10).fill(0);
    digits.forEach(d => frequency[d]++);
    
    const avgFrequency = digits.length / 10;
    const hotDigits = frequency
      .map((count, digit) => ({ digit, count }))
      .filter(d => d.count > avgFrequency * 1.3)
      .map(d => d.digit);
      
    const coldDigits = frequency
      .map((count, digit) => ({ digit, count }))
      .filter(d => d.count < avgFrequency * 0.7)
      .map(d => d.digit);
    
    const evenCount = digits.filter(d => d % 2 === 0).length;
    const evenOddRatio = evenCount / digits.length;
    
    // Mean reversion strategy: predict cold digits are "due"
    let prediction = null;
    if (coldDigits.length > 0) {
      const coldestDigit = frequency
        .map((count, digit) => ({ digit, count }))
        .sort((a, b) => a.count - b.count)[0];
      
      const hottestDigit = frequency
        .map((count, digit) => ({ digit, count }))
        .sort((a, b) => b.count - a.count)[0];
      
      const imbalance = hottestDigit.count - coldestDigit.count;
      if (imbalance >= 3) {
        const confidence = Math.min(85, 55 + imbalance * 5);
        prediction = {
          digit: coldestDigit.digit,
          confidence,
          reason: `Digit ${coldestDigit.digit} is due (${coldestDigit.count} vs ${hottestDigit.count} for digit ${hottestDigit.digit})`
        };
      }
    }
    
    return { frequency, hotDigits, coldDigits, evenOddRatio, prediction };
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

    // For Rise/Fall contracts - Ultra-enhanced with multiple layers
    if (contractType === 'CALL' || contractType === 'PUT') {
      const bullishScore = TradingIndicators.calculateConfidence(indicators, 'CALL');
      const bearishScore = TradingIndicators.calculateConfidence(indicators, 'PUT');
      
      // Layer 1: Pattern analysis with stronger weight
      let patternBonus = 0;
      if (pattern === 'STRONG_UPTREND') {
        patternBonus = patternStrength * 0.2; // Increased from 0.15 to 0.2
      } else if (pattern === 'STRONG_DOWNTREND') {
        patternBonus = -patternStrength * 0.2;
      }
      
      // Layer 2: Support/Resistance with momentum
      const distanceToSupport = (currentPrice - support) / support;
      const distanceToResistance = (resistance - currentPrice) / currentPrice;
      
      let srBonus = 0;
      const momentum = prices[prices.length - 1] - prices[prices.length - 5];
      
      if (distanceToSupport < 0.005 && momentum < 0) { // Near support + downward momentum
        srBonus = 12;  // Increased from 8
      } else if (distanceToResistance < 0.005 && momentum > 0) { // Near resistance + upward momentum
        srBonus = -12;  // Increased from -8
      }
      
      // Layer 3: Volatility adjustment
      const volatilityBonus = volatility > 0.015 ? -5 : 3; // Penalize high volatility
      
      // Layer 4: Multi-timeframe confirmation
      const shortTerm = prices.slice(-5);
      const mediumTerm = prices.slice(-15);
      const shortTrend = shortTerm[shortTerm.length - 1] > shortTerm[0] ? 1 : -1;
      const mediumTrend = mediumTerm[mediumTerm.length - 1] > mediumTerm[0] ? 1 : -1;
      const trendAlignment = shortTrend === mediumTrend ? 8 : -3;

      const adjustedBullish = bullishScore + patternBonus + srBonus + volatilityBonus + (trendAlignment * (shortTrend === 1 ? 1 : 0));
      const adjustedBearish = bearishScore - patternBonus - srBonus + volatilityBonus + (trendAlignment * (shortTrend === -1 ? 1 : 0));

      if (adjustedBullish > adjustedBearish && adjustedBullish >= 70) {  // Increased threshold from 60 to 70
        contractType = 'CALL';
        confidence = Math.min(95, adjustedBullish);
      } else if (adjustedBearish >= 70) {  // Increased threshold from 60 to 70
        contractType = 'PUT';
        confidence = Math.min(95, adjustedBearish);
      } else {
        return null; // Not confident enough
      }
    }

    // For Even/Odd contracts - Ultra-enhanced with multi-layer analysis
    else if (contractType === 'DIGITEVEN' || contractType === 'DIGITODD') {
      const digits = this.digitHistory.get(symbol) || [];
      if (digits.length < 30) return null;
      
      const recentDigits = digits.slice(-50);  // Increased sample
      const digitAnalysis = this.analyzeDigitFrequency(recentDigits);
      
      const evenCount = recentDigits.filter(d => d % 2 === 0).length;
      const recentEvenCount = recentDigits.slice(-10).filter(d => d % 2 === 0).length;
      const veryRecentEvenCount = recentDigits.slice(-5).filter(d => d % 2 === 0).length;
      
      // Detect current streak
      let currentStreak = 1;
      const lastParity = recentDigits[recentDigits.length - 1] % 2;
      for (let i = recentDigits.length - 2; i >= 0; i--) {
        if ((recentDigits[i] % 2) === lastParity) {
          currentStreak++;
        } else {
          break;
        }
      }
      
      // Enhanced mean reversion with multiple signals
      if (evenCount > 28) { // >56% even - stronger threshold
        contractType = 'DIGITODD';
        confidence = 70 + Math.min(25, (evenCount - 28) * 5);
        if (recentEvenCount >= 7) confidence += 8;  // Recent bias confirmation
      } else if (evenCount < 12) { // <24% even - stronger threshold
        contractType = 'DIGITEVEN';
        confidence = 70 + Math.min(25, (12 - evenCount) * 5);
        if (recentEvenCount <= 3) confidence += 8;  // Recent bias confirmation
      } else if (currentStreak >= 5) {  // Reduced from 6 for faster reaction
        contractType = lastParity === 0 ? 'DIGITODD' : 'DIGITEVEN';
        confidence = 68 + currentStreak * 5;  // Increased multiplier
      } else if (recentEvenCount >= 8 && veryRecentEvenCount >= 4) {
        contractType = 'DIGITODD';
        confidence = 72 + (recentEvenCount - 8) * 4;
      } else if (recentEvenCount <= 2 && veryRecentEvenCount <= 1) {
        contractType = 'DIGITEVEN';
        confidence = 72 + (2 - recentEvenCount) * 4;
      } else if (digitAnalysis.evenOddRatio > 0.68) {  // Strong even bias
        contractType = 'DIGITODD';
        confidence = 68 + (digitAnalysis.evenOddRatio - 0.68) * 100;
      } else if (digitAnalysis.evenOddRatio < 0.32) {  // Strong odd bias
        contractType = 'DIGITEVEN';
        confidence = 68 + (0.32 - digitAnalysis.evenOddRatio) * 100;
      } else {
        return null; // No clear pattern
      }
    }

    // For Over/Under contracts - Ultra-enhanced with advanced prediction
    else if (contractType === 'DIGITOVER' || contractType === 'DIGITUNDER') {
      const digits = this.digitHistory.get(symbol) || [];
      if (digits.length < 40) return null;
      
      const recentDigits = digits.slice(-60);  // Increased sample size
      const barrier = config.barrier ? parseInt(config.barrier) : 5;
      
      // Advanced digit frequency analysis
      const digitAnalysis = this.analyzeDigitFrequency(recentDigits);
      
      // Multi-timeframe distribution
      const veryRecentHigh = recentDigits.slice(-8).filter(d => d > barrier).length;
      const veryRecentLow = recentDigits.slice(-8).filter(d => d <= barrier).length;
      const recentHigh = recentDigits.slice(-20).filter(d => d > barrier).length;
      const recentLow = recentDigits.slice(-20).filter(d => d <= barrier).length;
      const overallHigh = recentDigits.filter(d => d > barrier).length;
      const overallLow = recentDigits.filter(d => d <= barrier).length;
      
      // Detect streaks with weighted recent data
      let streakCount = 1;
      const lastIsHigh = recentDigits[recentDigits.length - 1] > barrier;
      for (let i = recentDigits.length - 2; i >= 0; i--) {
        if ((recentDigits[i] > barrier) === lastIsHigh) {
          streakCount++;
        } else {
          break;
        }
      }
      
      // Volatility and momentum factors
      const volatilityFactor = volatility > 0.01 ? 1.1 : 0.98;
      const trendAlignment = indicators.trend === 'BULLISH' ? 1 : -1;
      
      if (contractType === 'DIGITOVER') {
        // Layer 1: Very strong mean reversion (recent low bias)
        if (recentLow > recentHigh * 2.2 && veryRecentLow >= 6) {
          confidence = 75 + Math.min(20, (recentLow - recentHigh) * 4);
          confidence *= volatilityFactor;
        }
        // Layer 2: Streak reversal (more aggressive)
        else if (streakCount >= 6 && !lastIsHigh) {
          confidence = 72 + streakCount * 4;
        }
        // Layer 3: Overall + recent alignment
        else if (overallLow > overallHigh * 1.7 && recentLow > recentHigh) {
          confidence = 70 + Math.min(22, (overallLow - overallHigh) * 3);
        }
        // Layer 4: Momentum + technical alignment
        else if (recentHigh >= recentLow && indicators.rsi > 55 && trendAlignment > 0) {
          confidence = 72 + (indicators.rsi - 55) * 0.8;
        }
        // Layer 5: AI digit prediction
        else if (digitAnalysis.prediction && digitAnalysis.prediction.digit > barrier) {
          confidence = digitAnalysis.prediction.confidence + 5;  // Boost AI prediction
        }
        // Layer 6: Cold hot digits over barrier
        else if (digitAnalysis.coldDigits.some(d => d > barrier) && veryRecentLow >= 5) {
          confidence = 68 + digitAnalysis.coldDigits.filter(d => d > barrier).length * 4;
        }
        else {
          return null;
        }
      } else { // DIGITUNDER
        if (recentHigh > recentLow * 2.2 && veryRecentHigh >= 6) {
          confidence = 75 + Math.min(20, (recentHigh - recentLow) * 4);
          confidence *= volatilityFactor;
        }
        else if (streakCount >= 6 && lastIsHigh) {
          confidence = 72 + streakCount * 4;
        }
        else if (overallHigh > overallLow * 1.7 && recentHigh > recentLow) {
          confidence = 70 + Math.min(22, (overallHigh - overallLow) * 3);
        }
        else if (recentLow >= recentHigh && indicators.rsi < 45 && trendAlignment < 0) {
          confidence = 72 + (45 - indicators.rsi) * 0.8;
        }
        else if (digitAnalysis.prediction && digitAnalysis.prediction.digit <= barrier) {
          confidence = digitAnalysis.prediction.confidence + 5;  // Boost AI prediction
        }
        else if (digitAnalysis.coldDigits.some(d => d <= barrier) && veryRecentHigh >= 5) {
          confidence = 68 + digitAnalysis.coldDigits.filter(d => d <= barrier).length * 4;
        }
        else {
          return null;
        }
      }
      
      confidence = Math.min(95, confidence);
    }

    // For Matches/Differs contracts - Ultra-enhanced with smart prediction
    else if (contractType === 'DIGITMATCH' || contractType === 'DIGITDIFF') {
      const digits = this.digitHistory.get(symbol) || [];
      if (digits.length < 30) return null;
      
      const recentDigits = digits.slice(-50);  // Increased sample
      const targetDigit = parseInt(config.barrier || '5');
      
      const digitAnalysis = this.analyzeDigitFrequency(recentDigits);
      const targetFrequency = digitAnalysis.frequency[targetDigit];
      const avgFrequency = recentDigits.length / 10;
      
      const veryRecentAppearances = recentDigits.slice(-8).filter(d => d === targetDigit).length;
      const recentAppearances = recentDigits.slice(-15).filter(d => d === targetDigit).length;
      const overallAppearances = targetFrequency;
      
      // Enhanced mean reversion with multi-layer logic
      const isVeryHot = targetFrequency > avgFrequency * 1.6;
      const isHot = targetFrequency > avgFrequency * 1.3;
      const isVeryCold = targetFrequency < avgFrequency * 0.4;
      const isCold = targetFrequency < avgFrequency * 0.7;
      
      if (veryRecentAppearances >= 4) {
        // Target appeared way too much very recently
        contractType = 'DIGITDIFF';
        confidence = 75 + veryRecentAppearances * 5;
      } else if (recentAppearances >= 6) {
        // Target appeared too much recently
        contractType = 'DIGITDIFF';
        confidence = 72 + recentAppearances * 4;
      } else if (isVeryHot && recentAppearances >= 4) {
        // Very hot digit with many recent appearances
        contractType = 'DIGITDIFF';
        confidence = 70 + (targetFrequency - avgFrequency) * 10;
      } else if (isHot && veryRecentAppearances >= 2) {
        // Hot digit with recent spike
        contractType = 'DIGITDIFF';
        confidence = 68 + (targetFrequency - avgFrequency) * 9;
      } else if (isVeryCold && recentAppearances === 0) {
        // Very cold digit is overdue
        contractType = 'DIGITMATCH';
        confidence = 72 + (avgFrequency - targetFrequency) * 12;
      } else if (isCold && veryRecentAppearances === 0) {
        // Cold digit hasn't appeared very recently
        contractType = 'DIGITMATCH';
        confidence = 70 + (avgFrequency - targetFrequency) * 10;
      } else if (recentAppearances === 0 && overallAppearances <= 3) {
        // Hasn't appeared recently and overall rare - due to appear
        contractType = 'DIGITMATCH';
        confidence = 68 + (3 - overallAppearances) * 8;
      } else if (digitAnalysis.prediction && digitAnalysis.prediction.digit === targetDigit) {
        // AI strongly predicts this digit
        contractType = 'DIGITMATCH';
        confidence = digitAnalysis.prediction.confidence + 8;  // Boost AI
      } else if (veryRecentAppearances === 0 && recentAppearances <= 1) {
        // Long absence suggests appearance is due
        contractType = 'DIGITMATCH';
        confidence = 66 + (1 - recentAppearances) * 6;
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

  // Check take profit and stop loss
  checkTakeProfitStopLoss(config: TradeConfig): boolean {
    if (config.takeProfit > 0 && this.sessionProfit >= config.takeProfit) {
      console.log(`🎯 Take Profit reached: $${this.sessionProfit.toFixed(2)}`);
      return true;
    }
    
    if (config.stopLoss > 0 && Math.abs(this.sessionLoss) >= config.stopLoss) {
      console.log(`🛑 Stop Loss reached: $${this.sessionLoss.toFixed(2)}`);
      return true;
    }
    
    return false;
  }

  // Execute trade
  async executeTrade(signal: TradeSignal, config: TradeConfig): Promise<void> {
    // Check take profit / stop loss first
    if (this.checkTakeProfitStopLoss(config)) {
      console.log('⏸️ Trading paused due to take profit or stop loss');
      return;
    }

    if (this.cooldownActive) {
      console.log('⏳ Cooldown active, skipping trade');
      return;
    }

    // Advanced adaptive martingale recovery
    let stake = config.stake;
    if (this.consecutiveLosses > 0) {
      // Progressive recovery based on loss streak
      const recoveryMultiplier = this.consecutiveLosses >= 3 
        ? config.martingaleMultiplier * 1.2  // Aggressive recovery after 3+ losses
        : config.martingaleMultiplier;
      
      stake = config.stake * Math.pow(recoveryMultiplier, this.consecutiveLosses);
      
      // Dynamic cap based on balance and confidence
      const maxStake = signal.confidence >= 85 
        ? config.stake * 8  // Higher cap for high confidence
        : config.stake * 5;  // Standard cap
      
      stake = Math.min(stake, maxStake);
    }
    
    // CRITICAL: Round to 2 decimal places to avoid API rejection
    stake = Math.round(stake * 100) / 100;

    console.log(`⚡ Executing ${signal.type} on ${signal.symbol} | Stake: $${stake.toFixed(2)} | Confidence: ${signal.confidence.toFixed(0)}% | Losses: ${this.consecutiveLosses}`);

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
        this.startCooldown(8000); // 8 second cooldown for faster execution
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
        this.sessionProfit += profit;
        console.log(`✅ WIN: +$${profit.toFixed(2)} | Session P/L: $${(this.sessionProfit + this.sessionLoss).toFixed(2)}`);
      } else {
        this.consecutiveLosses++;
        this.sessionLoss += profit;
        console.log(`❌ LOSS: $${profit.toFixed(2)} | Session P/L: $${(this.sessionProfit + this.sessionLoss).toFixed(2)}`);
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
    this.sessionProfit = 0;
    this.sessionLoss = 0;
  }

  // Reset engine
  reset() {
    this.priceHistory.clear();
    this.digitHistory.clear();
    this.activeContracts.clear();
    this.tradeHistory = [];
    this.consecutiveLosses = 0;
    this.sessionProfit = 0;
    this.sessionLoss = 0;
    this.cooldownActive = false;
  }
  
  // Get session P/L
  getSessionProfitLoss(): { profit: number; loss: number; net: number } {
    return {
      profit: this.sessionProfit,
      loss: this.sessionLoss,
      net: this.sessionProfit + this.sessionLoss
    };
  }
}

export const tradingEngine = new TradingEngine();
