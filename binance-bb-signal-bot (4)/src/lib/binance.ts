export interface Ticker {
  symbol: string;
  price: number;
}

export async function getUSDTPairs(): Promise<string[]> {
  try {
    const res = await fetch('https://api.binance.com/api/v3/exchangeInfo');
    if (!res.ok) throw new Error('Failed to fetch exchange info');
    const data = await res.json();
    return data.symbols
      .filter((s: any) => s.quoteAsset === 'USDT' && s.status === 'TRADING')
      .map((s: any) => s.symbol);
  } catch (error) {
    console.error('Error fetching pairs:', error);
    return [];
  }
}

export async function getKlines(symbol: string, interval: string, limit: number = 21): Promise<number[]> {
  try {
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    if (!res.ok) throw new Error(`Failed to fetch klines for ${symbol}`);
    const data = await res.json();
    // data[i][4] is the close price
    return data.map((d: any) => parseFloat(d[4]));
  } catch (error) {
    console.error(`Error fetching klines for ${symbol}:`, error);
    return [];
  }
}
