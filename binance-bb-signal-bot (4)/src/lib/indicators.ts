export function calculateBollingerBands(closes: number[], period: number = 20, stdDev: number = 2) {
  if (closes.length < period) return null;
  
  const recentCloses = closes.slice(-period);
  const sma = recentCloses.reduce((acc, val) => acc + val, 0) / period;
  
  const variance = recentCloses.reduce((acc, val) => acc + Math.pow(val - sma, 2), 0) / period;
  const sd = Math.sqrt(variance);
  
  return {
    upper: sma + stdDev * sd,
    lower: sma - stdDev * sd,
    sma: sma
  };
}

export function checkCross(closes: number[], period: number = 20, stdDev: number = 2) {
  if (closes.length < period + 1) return null; // need 21 candles for a cross check
  
  // Previous BB (using candles 0 to 19)
  const prevCloses = closes.slice(0, period);
  const prevBB = calculateBollingerBands(prevCloses, period, stdDev);
  
  // Current BB (using candles 1 to 20)
  const currCloses = closes.slice(1, period + 1);
  const currBB = calculateBollingerBands(currCloses, period, stdDev);
  
  if (!prevBB || !currBB) return null;
  
  const prevPrice = prevCloses[prevCloses.length - 1];
  const currPrice = currCloses[currCloses.length - 1];
  
  let type: 'UPPER_CROSS' | 'LOWER_CROSS' | null = null;
  
  // Crossed Upper: was below/equal prev upper, now above curr upper
  if (prevPrice <= prevBB.upper && currPrice > currBB.upper) {
    type = 'UPPER_CROSS';
  }
  // Crossed Lower: was above/equal prev lower, now below curr lower
  else if (prevPrice >= prevBB.lower && currPrice < currBB.lower) {
    type = 'LOWER_CROSS';
  }
  
  if (type) {
    return {
      type,
      price: currPrice,
      upperBB: currBB.upper,
      lowerBB: currBB.lower
    };
  }
  
  return null;
}
