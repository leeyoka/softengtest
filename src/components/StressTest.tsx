import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { 
  Activity, 
  Play, 
  BarChart3, 
  AlertCircle, 
  Clock, 
  Database,
  ArrowRight
} from 'lucide-react';
import { analyzeDeepfakeImage } from '../services/geminiService';
import { ThreatLevel } from '../types';

interface TestResult {
  id: number;
  latency: number;
  status: 'success' | 'fail';
  concurrency: number;
}

export const StressTest: React.FC = () => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [concurrency, setConcurrency] = useState(5);
  const [totalRequests, setTotalRequests] = useState(50);
  const [progress, setProgress] = useState(0);

  const runVolumeTest = async () => {
    setIsRunning(true);
    setResults([]);
    setProgress(0);

    const newResults: TestResult[] = [];
    const batchSize = concurrency;
    const iterations = Math.ceil(totalRequests / batchSize);

    // Mock image for testing (transparent tiny pixel)
    const mockImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

    for (let i = 0; i < iterations; i++) {
      if (!isRunning && i > 0) break; // Allow stop

      const batch = Array.from({ length: Math.min(batchSize, totalRequests - i * batchSize) }).map(async (_, idx) => {
        const startTime = performance.now();
        const requestId = i * batchSize + idx + 1;
        
        try {
          // Actual call to Gemini service
          await analyzeDeepfakeImage(mockImage);
          const endTime = performance.now();
          return {
            id: requestId,
            latency: Number(((endTime - startTime) / 1000).toFixed(2)),
            status: 'success' as const,
            concurrency: batchSize
          };
        } catch (error) {
          const endTime = performance.now();
          return {
            id: requestId,
            latency: Number(((endTime - startTime) / 1000).toFixed(2)),
            status: 'fail' as const,
            concurrency: batchSize
          };
        }
      });

      const batchResults = await Promise.all(batch);
      newResults.push(...batchResults);
      setResults(prev => [...prev, ...batchResults]);
      setProgress(Math.round(((i + 1) / iterations) * 100));
    }

    setIsRunning(false);
  };

  const avgLatency = results.length 
    ? (results.reduce((acc, r) => acc + r.latency, 0) / results.length).toFixed(2) 
    : 0;

  const maxLatency = results.length 
    ? Math.max(...results.map(r => r.latency)).toFixed(2) 
    : 0;

  const successRate = results.length 
    ? ((results.filter(r => r.status === 'success').length / results.length) * 100).toFixed(0) 
    : 0;

  return (
    <div className="p-6 space-y-6 pb-24 overflow-y-auto h-full max-w-4xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="text-aegis-green" />
            Volume Testing Lab
          </h2>
          <p className="text-slate-400 text-sm mt-1">Simulated load-ramping strategy for AI Forensic APIs</p>
        </div>
      </header>

      {/* Control Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Concurrency Level</label>
          <select 
            value={concurrency}
            onChange={(e) => setConcurrency(Number(e.target.value))}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white outline-none focus:border-aegis-green/50"
            disabled={isRunning}
          >
            <option value={5}>5 Concurrent Threads (Optimal)</option>
            <option value={10}>10 Concurrent Threads (Target)</option>
            <option value={20}>20 Concurrent Threads (High Load)</option>
            <option value={40}>40 Concurrent Threads (Stress)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Requests</label>
          <input 
             type="number"
             value={totalRequests}
             onChange={(e) => setTotalRequests(Number(e.target.value))}
             className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white outline-none focus:border-aegis-green/50"
             disabled={isRunning}
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={runVolumeTest}
            disabled={isRunning}
            className={`w-full py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
              isRunning ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-aegis-green text-black hover:bg-aegis-green/80'
            }`}
          >
            {isRunning ? 'TESTING...' : <><Play size={18} /> START VOLUME TEST</>}
          </button>
        </div>
      </div>

      {/* Real-time Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsTile label="Avg Latency" value={`${avgLatency}s`} icon={<Clock size={16} />} />
        <StatsTile label="P99 Max" value={`${maxLatency}s`} icon={<AlertCircle size={16} />} color="text-amber-400" />
        <StatsTile label="Success Rate" value={`${successRate}%`} icon={<BarChart3 size={16} />} color="text-aegis-green" />
        <StatsTile label="Handled" value={`${results.length}/${totalRequests}`} icon={<Database size={16} />} />
      </div>

      {/* Progress Bar */}
      {isRunning && (
        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-aegis-green shadow-[0_0_10px_rgba(34,197,94,0.5)]"
          />
        </div>
      )}

      {/* Main Graph (The Mentor View) */}
      <div className="bg-slate-900 border border-slate-800 rounded-[32px] p-8 h-[400px]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-white font-bold uppercase tracking-widest text-sm flex items-center gap-2">
            <span className="w-2 h-2 bg-aegis-green rounded-full animate-pulse" />
            Response Time - Concurrency {concurrency}
          </h3>
          <div className="text-slate-500 text-[10px] uppercase font-bold">Metric: Seconds / Request Number</div>
        </div>
        
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={results}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis 
              dataKey="id" 
              stroke="#64748b" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              label={{ value: 'Request Number', position: 'insideBottom', offset: -10, fill: '#475569', fontSize: 10 }}
            />
            <YAxis 
              stroke="#64748b" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              label={{ value: 'Latency (s)', angle: -90, position: 'insideLeft', fill: '#475569', fontSize: 10 }}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px' }}
              itemStyle={{ color: '#22c55e' }}
            />
            <Line 
              type="monotone" 
              dataKey="latency" 
              stroke="#22c55e" 
              strokeWidth={2}
              dot={{ r: 2, fill: '#22c55e', strokeWidth: 0 }}
              activeDot={{ r: 4, strokeWidth: 0 }}
              animationDuration={300}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Analysis Comment (The Mentor Style) */}
      <div className="bg-slate-950/50 border border-slate-900 rounded-2xl p-6 text-sm text-slate-400 space-y-4">
        <h4 className="text-white font-bold flex items-center gap-2">
          <AlertCircle size={16} className="text-amber-400" />
          Technical Analysis Report
        </h4>
        <div className="space-y-3 leading-relaxed">
          <p>
            The volume test reveals the **Stability Matrix** of the Aegis Neural Bridge. 
            Isolated latency spikes (as seen in the graph) are likely due to "Cold Starts" 
            or background garbage collection in the Gemini inference engine.
          </p>
          <p>
            <span className="text-white font-medium italic underline decoration-aegis-green/30">Conclusion:</span> 
            {results.length > 0 ? (
              Number(avgLatency) < 2 
                ? " The system maintains a sub-2-second response threshold, which is optimal for real-time forensic auditing."
                : " High frequency of spikes suggests the backend is reaching saturation. Recommended scale-out for higher concurrency levels."
            ) : " Start the test to generate a performance conclusion."}
          </p>
        </div>
      </div>
    </div>
  );
};

const StatsTile: React.FC<{ label: string, value: string, icon: React.ReactNode, color?: string }> = ({ label, value, icon, color = "text-white" }) => (
  <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
    <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">
      {icon}
      {label}
    </div>
    <div className={`text-xl font-mono font-bold ${color}`}>
      {value}
    </div>
  </div>
);
