import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, RefreshCw, Activity, TrendingUp, TrendingDown, AlertCircle, Clock } from 'lucide-react';
import { getUSDTPairs, getKlines } from './lib/binance';
import { checkCross } from './lib/indicators';

interface Signal {
  id: string;
  symbol: string;
  timeframe: string;
  type: 'UPPER_CROSS' | 'LOWER_CROSS';
  price: number;
  upperBB: number;
  lowerBB: number;
  timestamp: number;
}

const AVAILABLE_TIMEFRAMES = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '1d', value: '1d' },
];

export default function App() {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scannedCount, setScannedCount] = useState(0);
  const [totalPairs, setTotalPairs] = useState(0);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [statusMsg, setStatusMsg] = useState('Ready to scan');
  const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>(['1h', '15m']);
  
  const scanningRef = useRef(false);

  const toggleTimeframe = (tf: string) => {
    if (scanning) return;
    setSelectedTimeframes(prev => 
      prev.includes(tf) ? prev.filter(t => t !== tf) : [...prev, tf]
    );
  };

  const addSignal = (signal: Omit<Signal, 'id'>) => {
    setSignals(prev => {
      // Prevent duplicates in the same scan run
      const exists = prev.find(s => s.symbol === signal.symbol && s.timeframe === signal.timeframe && s.type === signal.type);
      if (exists) return prev;
      return [{ ...signal, id: Math.random().toString(36).substring(7) }, ...prev];
    });
  };

  const startScan = async () => {
    if (scanning) return;
    if (selectedTimeframes.length === 0) {
      setStatusMsg('Please select at least one timeframe.');
      return;
    }
    
    setScanning(true);
    scanningRef.current = true;
    setProgress(0);
    setScannedCount(0);
    setSignals([]);
    setStatusMsg('Fetching USDT pairs from Binance...');

    try {
      const pairs = await getUSDTPairs();
      if (pairs.length === 0) {
        setStatusMsg('Failed to fetch pairs. Check network.');
        setScanning(false);
        scanningRef.current = false;
        return;
      }

      setTotalPairs(pairs.length);
      setStatusMsg(`Scanning ${pairs.length} USDT pairs across ${selectedTimeframes.join(', ')}...`);
      
      let current = 0;
      const batchSize = 5; // Increased batch size

      for (let i = 0; i < pairs.length; i += batchSize) {
        if (!scanningRef.current) {
          setStatusMsg('Scan stopped by user.');
          break;
        }
        
        const batch = pairs.slice(i, i + batchSize);
        const promises = batch.map(async (symbol) => {
          try {
            for (const tf of selectedTimeframes) {
              if (!scanningRef.current) break;
              
              const closes = await getKlines(symbol, tf, 21);
              if (closes.length === 21) {
                const signal = checkCross(closes);
                if (signal) {
                  addSignal({
                    symbol,
                    timeframe: tf.toUpperCase(),
                    type: signal.type,
                    price: signal.price,
                    upperBB: signal.upperBB,
                    lowerBB: signal.lowerBB,
                    timestamp: Date.now()
                  });
                }
              }
            }
          } catch (err) {
            console.error(`Error processing ${symbol}:`, err);
          }
        });
        
        await Promise.all(promises);
        current += batch.length;
        setScannedCount(current);
        setProgress(Math.round((current / pairs.length) * 100));
        
        // Delay to respect rate limits
        if (i + batchSize < pairs.length && scanningRef.current) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Reduced delay
        }
      }
      
      if (scanningRef.current) {
        setStatusMsg('Scan complete.');
      }
    } catch (err) {
      console.error(err);
      setStatusMsg('An error occurred during scanning.');
    } finally {
      setScanning(false);
      scanningRef.current = false;
    }
  };

  const stopScan = () => {
    scanningRef.current = false;
    setScanning(false);
    setStatusMsg('Stopping scan...');
  };

  const formatPrice = (price: number) => {
    if (price < 0.001) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    if (price < 10) return price.toFixed(3);
    return price.toFixed(2);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
              Binance Market Scanner
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-sm text-zinc-400 hidden sm:block">
              {statusMsg}
            </div>
            {scanning ? (
              <button
                onClick={stopScan}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 transition-colors text-sm font-medium"
              >
                <Square className="w-4 h-4" />
                Stop Scan
              </button>
            ) : (
              <button
                onClick={startScan}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 rounded-lg transition-colors text-sm font-medium shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              >
                <Play className="w-4 h-4" />
                Start Scan
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Timeframe Selection */}
        <div className="mb-8 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Select Timeframes</h3>
              {scanning && <span className="text-xs text-amber-400 italic">Cannot change while scanning</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TIMEFRAMES.map((tf) => (
                <button
                  key={tf.value}
                  onClick={() => toggleTimeframe(tf.value)}
                  disabled={scanning}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                    selectedTimeframes.includes(tf.value)
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                  } ${scanning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats & Progress */}
        <div className="mb-4 text-xs text-zinc-500 uppercase tracking-widest font-medium">
          Scanning all USDT pairs on Binance Spot
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="text-zinc-400 text-sm font-medium mb-1">Total Signals Found</div>
            <div className="text-3xl font-semibold text-zinc-100">{signals.length}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="text-zinc-400 text-sm font-medium mb-1">Pairs Scanned</div>
            <div className="text-3xl font-semibold text-zinc-100">
              {scannedCount} <span className="text-lg text-zinc-500 font-normal">/ {totalPairs || '-'}</span>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col justify-center">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-400 font-medium">Scan Progress</span>
              <span className="text-emerald-400 font-medium">{progress}%</span>
            </div>
            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Signals Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-lg font-medium text-zinc-100 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-zinc-400" />
              Active Signals
            </h2>
            <div className="text-xs text-zinc-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Auto-updates during scan
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-900/50 text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-3 font-medium">Pair</th>
                  <th className="px-6 py-3 font-medium">Timeframe</th>
                  <th className="px-6 py-3 font-medium">Signal</th>
                  <th className="px-6 py-3 font-medium text-right">Current Price</th>
                  <th className="px-6 py-3 font-medium text-right">Upper BB</th>
                  <th className="px-6 py-3 font-medium text-right">Lower BB</th>
                  <th className="px-6 py-3 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {signals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                      {scanning ? (
                        <div className="flex flex-col items-center justify-center gap-3">
                          <RefreshCw className="w-6 h-6 animate-spin text-zinc-600" />
                          <p>Scanning markets for signals...</p>
                        </div>
                      ) : (
                        <p>No signals found. Click "Start Scan" to begin.</p>
                      )}
                    </td>
                  </tr>
                ) : (
                  signals.map((signal) => (
                    <tr key={signal.id} className="hover:bg-zinc-800/30 transition-colors group">
                      <td className="px-6 py-4 font-medium text-zinc-100">
                        {signal.symbol}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-700">
                          {signal.timeframe}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {signal.type === 'UPPER_CROSS' ? (
                          <span className="inline-flex items-center gap-1.5 text-red-400 font-medium">
                            <TrendingDown className="w-4 h-4" />
                            Crossed Upper (Sell)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                            <TrendingUp className="w-4 h-4" />
                            Crossed Lower (Buy)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-zinc-100">
                        {formatPrice(signal.price)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-zinc-500 group-hover:text-zinc-400 transition-colors">
                        {formatPrice(signal.upperBB)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-zinc-500 group-hover:text-zinc-400 transition-colors">
                        {formatPrice(signal.lowerBB)}
                      </td>
                      <td className="px-6 py-4 text-right text-zinc-500">
                        {formatTime(signal.timestamp)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
