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
  timeframe: string;
  confidenceThreshold: number;
  takeProfit: number;
  stopLoss: number;
  martingaleMultiplier: number;
  currency: string;
  barrier?: string;
  contractsPerTrade: number; // Number of contracts to execute per signal
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

    // Calculate timeframe window size (ticks per timeframe)
    const timeframeWindows: Record<string, number> = {
      '1m': 20,   // ~20 ticks = 1 minute
      '3m': 60,   // ~60 ticks = 3 minutes
      '5m': 100,  // ~100 ticks = 5 minutes
      '10m': 200  // ~200 ticks = 10 minutes
    };
    
    const windowSize = timeframeWindows[config.timeframe] || 60;
    const analysisData = prices.slice(-Math.min(windowSize, prices.length));
    
    // Analyze indicators with timeframe-adjusted data
    const indicators = TradingIndicators.analyzeMarket(analysisData);
    
    // Enhanced pattern detection
    const { support, resistance } = this.detectSupportResistance(analysisData);
    const volatility = this.calculateVolatility(analysisData);
    const { pattern, strength: patternStrength } = this.detectPattern(analysisData);
    
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

    // For Over/Under contracts - Enhanced digit distribution strategy
    else if (contractType === 'DIGITOVER' || contractType === 'DIGITUNDER') {
      const digits = this.digitHistory.get(symbol) || [];
      if (digits.length < 40) return null;
      
      const recentDigits = digits.slice(-60);
      const barrier = config.barrier ? parseInt(config.barrier) : 5;
      
      const digitAnalysis = this.analyzeDigitFrequency(recentDigits);
      
      // Advanced Over/Under Strategy:
      // 1. Track distribution of digits above/below barrier
      // 2. Detect imbalances and predict reversal
      // 3. Use streak detection
      // 4. Combine with hot/cold digit analysis
      
      const veryRecent = recentDigits.slice(-10);
      const recent = recentDigits.slice(-20);
      
      const veryRecentHigh = veryRecent.filter(d => d > barrier).length;
      const veryRecentLow = veryRecent.filter(d => d <= barrier).length;
      const recentHigh = recent.filter(d => d > barrier).length;
      const recentLow = recent.filter(d => d <= barrier).length;
      const overallHigh = recentDigits.filter(d => d > barrier).length;
      const overallLow = recentDigits.filter(d => d <= barrier).length;
      
      // Detect streaks
      let streakCount = 1;
      const lastIsHigh = recentDigits[recentDigits.length - 1] > barrier;
      for (let i = recentDigits.length - 2; i >= 0; i--) {
        if ((recentDigits[i] > barrier) === lastIsHigh) streakCount++;
        else break;
      }
      
      const volatilityFactor = volatility > 0.01 ? 1.05 : 0.98;
      
      if (contractType === 'DIGITOVER' || !config.contractType.includes('UNDER')) {
        contractType = 'DIGITOVER';
        // Layer 1: Strong low bias - predict reversal to OVER
        if (recentLow > recentHigh * 2 && veryRecentLow >= 7) {
          confidence = 75 + Math.min(20, (recentLow - recentHigh) * 3);
          confidence *= volatilityFactor;
        }
        // Layer 2: Long streak reversal
        else if (streakCount >= 7 && !lastIsHigh) {
          confidence = 72 + streakCount * 3;
        }
        // Layer 3: Overall + recent alignment
        else if (overallLow > overallHigh * 1.5 && recentLow > recentHigh) {
          confidence = 70 + Math.min(20, (overallLow - overallHigh) * 2);
        }
        // Layer 4: AI prediction boost
        else if (digitAnalysis.prediction && digitAnalysis.prediction.digit > barrier) {
          confidence = digitAnalysis.prediction.confidence + 5;
        }
        // Layer 5: Cold digits over barrier (likely to appear)
        else if (digitAnalysis.coldDigits.some(d => d > barrier) && veryRecentLow >= 6) {
          confidence = 68 + digitAnalysis.coldDigits.filter(d => d > barrier).length * 5;
        } else {
          return null;
        }
      } else {
        contractType = 'DIGITUNDER';
        // Layer 1: Strong high bias - predict reversal to UNDER
        if (recentHigh > recentLow * 2 && veryRecentHigh >= 7) {
          confidence = 75 + Math.min(20, (recentHigh - recentLow) * 3);
          confidence *= volatilityFactor;
        }
        // Layer 2: Long streak reversal
        else if (streakCount >= 7 && lastIsHigh) {
          confidence = 72 + streakCount * 3;
        }
        // Layer 3: Overall + recent alignment
        else if (overallHigh > overallLow * 1.5 && recentHigh > recentLow) {
          confidence = 70 + Math.min(20, (overallHigh - overallLow) * 2);
        }
        // Layer 4: AI prediction boost
        else if (digitAnalysis.prediction && digitAnalysis.prediction.digit <= barrier) {
          confidence = digitAnalysis.prediction.confidence + 5;
        }
        // Layer 5: Cold digits under barrier
        else if (digitAnalysis.coldDigits.some(d => d <= barrier) && veryRecentHigh >= 6) {
          confidence = 68 + digitAnalysis.coldDigits.filter(d => d <= barrier).length * 5;
        } else {
          return null;
        }
      }
    }

    // For Matches/Differs contracts - FIXED STRATEGY
    else if (contractType === 'DIGITMATCH' || contractType === 'DIGITDIFF') {
      const digits = this.digitHistory.get(symbol) || [];
      if (digits.length < 40) return null;
      
      const recentDigits = digits.slice(-60);
      const targetDigit = parseInt(config.barrier || '5');
      
      const digitAnalysis = this.analyzeDigitFrequency(recentDigits);
      const targetFrequency = digitAnalysis.frequency[targetDigit];
      const avgFrequency = recentDigits.length / 10;
      
      // Track appearances in different time windows
      const veryRecentAppearances = recentDigits.slice(-5).filter(d => d === targetDigit).length;
      const recentAppearances = recentDigits.slice(-15).filter(d => d === targetDigit).length;
      const mediumAppearances = recentDigits.slice(-30).filter(d => d === targetDigit).length;
      
      // Check if digit is hot (appearing frequently)
      const isVeryHot = targetFrequency > avgFrequency * 1.8;
      const isHot = targetFrequency > avgFrequency * 1.4;
      const isCold = targetFrequency < avgFrequency * 0.6;
      const isVeryCold = targetFrequency < avgFrequency * 0.3;
      
      // Detect streaks
      const lastDigitsMatch = recentDigits.slice(-3).filter(d => d === targetDigit).length;
      
      // CRITICAL FIX: Correct strategy for Matches vs Differs
      if (contractType === 'DIGITMATCH') {
        // DIGITMATCH: Predict target digit WILL appear
        // Only trade when digit is HOT or on a hot streak
        
        if (isVeryHot && veryRecentAppearances >= 2) {
          // Very hot digit appearing recently - momentum continues
          confidence = 78 + Math.min(15, targetFrequency * 2);
        } else if (isHot && recentAppearances >= 4) {
          // Hot digit with strong recent presence
          confidence = 75 + Math.min(15, recentAppearances * 2);
        } else if (lastDigitsMatch >= 2) {
          // Digit on a streak - likely to continue
          confidence = 76 + lastDigitsMatch * 6;
        } else if (digitAnalysis.hotDigits[0] === targetDigit) {
          // Target is the hottest digit overall
          confidence = 74 + Math.min(18, targetFrequency * 2.5);
        } else if (isVeryCold && mediumAppearances === 0) {
          // Overdue digit (hasn't appeared in long time)
          confidence = 72 + Math.min(15, (avgFrequency - targetFrequency) * 5);
        } else {
          return null; // Not confident enough for MATCH
        }
      } else {
        // DIGITDIFF: Predict target digit will NOT appear (90% natural win rate)
        // Trade MORE OFTEN since differs has natural advantage
        
        if (veryRecentAppearances >= 3) {
          // Just appeared multiple times - mean reversion suggests differ
          confidence = 85 + veryRecentAppearances * 3;
        } else if (recentAppearances >= 5) {
          // Appeared too much recently - due for differ
          confidence = 82 + Math.min(15, recentAppearances * 2);
        } else if (isVeryHot && veryRecentAppearances >= 1) {
          // Hot digit just appeared - less likely to repeat immediately
          confidence = 80 + Math.min(15, targetFrequency * 3);
        } else if (lastDigitsMatch >= 2) {
          // On a streak - streak likely to break
          confidence = 83 + lastDigitsMatch * 4;
        } else if (!isCold && !isHot) {
          // Normal frequency - standard 90% differ probability
          confidence = 75;
        } else if (isCold) {
          // Cold digit - very likely to differ
          confidence = 78 + Math.min(15, (avgFrequency - targetFrequency) * 4);
        } else {
          // Default case - still favor differ due to natural 90% odds
          confidence = 73;
        }
      }
    }

    confidence = Math.min(95, confidence);

    return {
      symbol,
      type: contractType,
      confidence,
      indicators,
      timestamp: Date.now(),
    };
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


  // Check take profit / stop loss
  checkTakeProfitStopLoss(config: TradeConfig): boolean {
    const { takeProfit, stopLoss } = config;
    const net = this.sessionProfit + this.sessionLoss;
    
    if (takeProfit > 0 && net >= takeProfit) {
      console.log(`🎯 Take Profit reached: $${net.toFixed(2)}`);
      return true;
    }
    
    if (stopLoss > 0 && net <= -stopLoss) {
      console.log(`🛑 Stop Loss hit: $${net.toFixed(2)}`);
      return true;
    }
    
    return false;
  }

  // Execute multiple contracts per signal with staggered timing
  async executeTrade(signal: TradeSignal, config: TradeConfig): Promise<void> {
    if (this.cooldownActive) {
      console.log('⏳ Cooldown active, skipping trade');
      return;
    }

    // Set cooldown immediately to prevent duplicate signals
    this.cooldownActive = true;

    // Use EXACT user-configured multiplier after ANY loss (not exponential)
    let adjustedStake = config.stake;
    if (this.consecutiveLosses > 0) {
      adjustedStake = config.stake * config.martingaleMultiplier;
    }
    
    // Round stake to 2 decimals to prevent API errors
    adjustedStake = Number(adjustedStake.toFixed(2));

    const contractsCount = config.contractsPerTrade || 1;
    console.log(`📊 Batch Trade: ${signal.type} @ ${signal.confidence.toFixed(0)}% | Stake: $${adjustedStake.toFixed(2)} x ${contractsCount} contracts`);

    const shouldUseBarrier = ['DIGITOVER', 'DIGITUNDER', 'DIGITMATCH', 'DIGITDIFF'].includes(signal.type);
    
    // Execute contracts sequentially with small delays to avoid API rate limits
    let successCount = 0;
    for (let i = 0; i < contractsCount; i++) {
      const success = await this.executeSingleContract(signal, config, adjustedStake, shouldUseBarrier, i + 1);
      if (success) successCount++;
      
      // Small delay between contracts to avoid rate limiting (except last one)
      if (i < contractsCount - 1) {
        await this.delay(150);
      }
    }
    
    console.log(`📦 Batch complete: ${successCount}/${contractsCount} contracts executed`);
    
    // Start cooldown after batch completes
    this.startCooldown(8000);
  }

  // Helper delay function
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Helper to execute a single contract
  private async executeSingleContract(
    signal: TradeSignal, 
    config: TradeConfig, 
    stake: number, 
    shouldUseBarrier: boolean,
    contractIndex: number
  ): Promise<boolean> {
    try {
      const response = await derivAPI.buyContract({
        contract_type: signal.type,
        symbol: signal.symbol,
        duration: config.duration,
        duration_unit: config.durationUnit,
        amount: stake,
        basis: 'stake',
        currency: config.currency || 'USD',
        barrier: shouldUseBarrier ? config.barrier : undefined,
      });

      if (response.buy) {
        this.activeContracts.set(response.buy.contract_id, {
          signal,
          stake: stake,
          purchaseTime: Date.now(),
        });

        console.log(`✅ Contract ${contractIndex}/${config.contractsPerTrade} executed: ${response.buy.contract_id}`);
        return true;
      }
      return false;
    } catch (error: any) {
      console.error(`❌ Contract ${contractIndex} failed:`, error.message);
      return false;
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
