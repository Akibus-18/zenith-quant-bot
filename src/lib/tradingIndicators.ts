/**
 * Advanced Technical Indicators for Trading Analysis
 * Implements RSI, MACD, EMA, Bollinger Bands, Stochastic, ATR
 */

export interface IndicatorData {
  rsi: number;
  macd: { value: number; signal: number; histogram: number };
  ema: { ema20: number; ema50: number };
  bb: { upper: number; middle: number; lower: number };
  stochastic: { k: number; d: number };
  atr: number;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export class TradingIndicators {
  // RSI Calculation
  static calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);

    return rsi;
  }

  // EMA Calculation
  static calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];

    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  // MACD Calculation
  static calculateMACD(prices: number[]): { value: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macdLine = ema12 - ema26;

    // Signal line is 9-period EMA of MACD
    const macdHistory = [macdLine]; // Simplified
    const signalLine = macdLine; // In real implementation, would calculate EMA of MACD history

    return {
      value: macdLine,
      signal: signalLine,
      histogram: macdLine - signalLine,
    };
  }

  // Bollinger Bands
  static calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2) {
    if (prices.length < period) {
      const current = prices[prices.length - 1];
      return { upper: current, middle: current, lower: current };
    }

    const slice = prices.slice(-period);
    const middle = slice.reduce((a, b) => a + b, 0) / period;

    const variance = slice.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / period;
    const sd = Math.sqrt(variance);

    return {
      upper: middle + stdDev * sd,
      middle: middle,
      lower: middle - stdDev * sd,
    };
  }

  // Stochastic Oscillator
  static calculateStochastic(prices: number[], period: number = 14): { k: number; d: number } {
    if (prices.length < period) return { k: 50, d: 50 };

    const slice = prices.slice(-period);
    const current = prices[prices.length - 1];
    const highest = Math.max(...slice);
    const lowest = Math.min(...slice);

    const k = ((current - lowest) / (highest - lowest)) * 100;
    const d = k; // Simplified; in real implementation, would be 3-period SMA of %K

    return { k: isNaN(k) ? 50 : k, d: isNaN(d) ? 50 : d };
  }

  // ATR (Average True Range)
  static calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): number {
    if (closes.length < period + 1) return 0;

    const trueRanges: number[] = [];

    for (let i = 1; i < closes.length; i++) {
      const high = highs[i];
      const low = lows[i];
      const prevClose = closes[i - 1];

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );

      trueRanges.push(tr);
    }

    const atr = trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
    return atr;
  }

  // Comprehensive Analysis
  static analyzeMarket(prices: number[]): IndicatorData {
    const rsi = this.calculateRSI(prices);
    const macd = this.calculateMACD(prices);
    const ema20 = this.calculateEMA(prices, 20);
    const ema50 = this.calculateEMA(prices, 50);
    const bb = this.calculateBollingerBands(prices);
    const stochastic = this.calculateStochastic(prices);
    
    // Simplified ATR (using price ranges)
    const atr = prices.length > 1 
      ? Math.abs(prices[prices.length - 1] - prices[prices.length - 2]) 
      : 0;

    // Determine trend
    let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    const bullishSignals = [
      ema20 > ema50,
      macd.histogram > 0,
      rsi > 50 && rsi < 70,
      prices[prices.length - 1] > bb.middle,
      stochastic.k > stochastic.d,
    ].filter(Boolean).length;

    if (bullishSignals >= 3) trend = 'BULLISH';
    else if (bullishSignals <= 2) trend = 'BEARISH';

    return {
      rsi,
      macd,
      ema: { ema20, ema50 },
      bb,
      stochastic,
      atr,
      trend,
    };
  }

  // Calculate confidence score (0-100)
  static calculateConfidence(indicators: IndicatorData, contractType: string): number {
    let score = 0;
    const weights = {
      rsi: 20,
      macd: 20,
      ema: 20,
      bb: 15,
      stochastic: 15,
      trend: 10,
    };

    // RSI signals
    if (contractType === 'CALL' || contractType === 'RISE') {
      if (indicators.rsi < 70 && indicators.rsi > 40) score += weights.rsi;
    } else {
      if (indicators.rsi > 30 && indicators.rsi < 60) score += weights.rsi;
    }

    // MACD signals
    if (contractType === 'CALL' || contractType === 'RISE') {
      if (indicators.macd.histogram > 0) score += weights.macd;
    } else {
      if (indicators.macd.histogram < 0) score += weights.macd;
    }

    // EMA signals
    if (contractType === 'CALL' || contractType === 'RISE') {
      if (indicators.ema.ema20 > indicators.ema.ema50) score += weights.ema;
    } else {
      if (indicators.ema.ema20 < indicators.ema.ema50) score += weights.ema;
    }

    // Bollinger Bands
    if (contractType === 'CALL' || contractType === 'RISE') {
      if (indicators.bb.middle < indicators.bb.upper) score += weights.bb;
    } else {
      if (indicators.bb.middle > indicators.bb.lower) score += weights.bb;
    }

    // Stochastic
    if (contractType === 'CALL' || contractType === 'RISE') {
      if (indicators.stochastic.k > indicators.stochastic.d && indicators.stochastic.k < 80) {
        score += weights.stochastic;
      }
    } else {
      if (indicators.stochastic.k < indicators.stochastic.d && indicators.stochastic.k > 20) {
        score += weights.stochastic;
      }
    }

    // Trend alignment
    if (contractType === 'CALL' || contractType === 'RISE') {
      if (indicators.trend === 'BULLISH') score += weights.trend;
    } else {
      if (indicators.trend === 'BEARISH') score += weights.trend;
    }

    return Math.min(100, score);
  }
}
