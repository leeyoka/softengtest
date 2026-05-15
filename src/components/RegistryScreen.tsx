import React, { useState } from 'react';
import { Search, ShieldAlert, ShieldCheck, Globe, Banknote, History, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ThreatLevel, OperationType } from '../types';
import { analyzeRegistrySearch } from '../services/geminiService';
import { sendAlertToFamily } from '../services/fonnteService';
import { db, handleFirestoreError } from '../firebase';
import { collection, query as fsQuery, where, getDocs } from 'firebase/firestore';

export default function RegistryScreen({ user }: { user: any }) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [searchHistory, setSearchHistory] = useState<any[]>([]);

  const triggerAlerts = async (analysis: any, searchValue: string) => {
    if (analysis.threatLevel === ThreatLevel.THREAT) {
      try {
        const familyRef = collection(db, 'family');
        const q = fsQuery(familyRef, where('userId', '==', user.uid), where('alertOnRegistry', '==', true));
        const snap = await getDocs(q);
        
        const alertPromises = snap.docs.map(doc => {
          const member = doc.data();
          return sendAlertToFamily(member.memberPhoneNumber, user.displayName || 'Aegis User', 'REGISTRY', analysis.summary, searchValue);
        });
        
        await Promise.all(alertPromises);
      } catch (e) {
        console.error("Registry Alert failed:", e);
      }
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setResult(null);

    try {
      const analysis = await analyzeRegistrySearch(query);
      setResult(analysis);
      
      const newHistory = [
        { query, threatLevel: analysis.threatLevel, timestamp: new Date().toLocaleTimeString() },
        ...searchHistory.slice(0, 4)
      ];
      setSearchHistory(newHistory);
      
      // Trigger alerts
      triggerAlerts(analysis, query);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Registry</h2>
          <p className="text-slate-500 text-sm">Scan numbers, links, or bank accounts</p>
        </div>
        <div className="bg-aegis-card p-2 rounded-xl border border-aegis-border">
          <Globe className="text-aegis-green w-5 h-5" />
        </div>
      </div>

      <form onSubmit={handleSearch} className="relative">
        <input 
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter Number, Link, or Bank Acc..."
          className="w-full bg-aegis-card border border-aegis-border rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-aegis-green transition-colors"
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
        <button 
          type="submit"
          disabled={isSearching}
          className="absolute right-3 top-1/2 -translate-y-1/2 bg-aegis-green text-aegis-bg p-1.5 rounded-lg font-bold text-xs"
        >
          {isSearching ? '...' : 'SCAN'}
        </button>
      </form>

      <div className="grid grid-cols-3 gap-3">
        <QuickAction icon={<Hash size={16} />} label="Number" onClick={() => setQuery('+62 ')} />
        <QuickAction icon={<Globe size={16} />} label="Link" onClick={() => setQuery('https://')} />
        <QuickAction icon={<Banknote size={16} />} label="Bank" onClick={() => setQuery('BCA ')} />
      </div>

      <AnimatePresence mode="wait">
        {result ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-6 rounded-3xl border ${
              result.threatLevel === ThreatLevel.THREAT 
                ? 'bg-red-500/5 border-red-500/20' 
                : result.threatLevel === ThreatLevel.CAUTION
                ? 'bg-yellow-500/5 border-yellow-500/20'
                : 'bg-aegis-green/5 border-aegis-green/20'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-2xl ${
                result.threatLevel === ThreatLevel.THREAT ? 'bg-red-500' : 
                result.threatLevel === ThreatLevel.CAUTION ? 'bg-yellow-500' : 'bg-aegis-green'
              }`}>
                {result.threatLevel === ThreatLevel.THREAT ? <ShieldAlert className="text-white" /> : <ShieldCheck className="text-white" />}
              </div>
              <div>
                <h3 className={`font-bold uppercase tracking-widest text-sm ${
                  result.threatLevel === ThreatLevel.THREAT ? 'text-red-500' : 
                  result.threatLevel === ThreatLevel.CAUTION ? 'text-yellow-500' : 'text-aegis-green'
                }`}>
                  {result.threatLevel} DETECTED
                </h3>
                <p className="text-[10px] text-slate-500 font-mono">{new Date().toISOString()}</p>
              </div>
            </div>

            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              {result.summary}
            </p>

            {result.threatLevel === ThreatLevel.THREAT && (
              <div className="space-y-2">
                <div className="bg-red-500/10 p-3 rounded-xl border border-red-500/10">
                  <p className="text-red-400 text-[11px] font-bold uppercase tracking-tight mb-1">Red Flags Found:</p>
                  <ul className="text-slate-400 text-[10px] space-y-1">
                    {result.flags?.map((f: string, i: number) => (
                      <li key={i} className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-red-500 rounded-full" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </motion.div>
        ) : isSearching ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-600">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="mb-4"
            >
              <History size={32} />
            </motion.div>
            <p className="text-xs font-bold uppercase tracking-[0.2em]">Querying Global Database...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">Recent Inquiries</h4>
            {searchHistory.length > 0 ? (
              <div className="space-y-2">
                {searchHistory.map((h, i) => (
                  <div key={i} className="bg-aegis-card p-4 rounded-2xl border border-aegis-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        h.threatLevel === ThreatLevel.THREAT ? 'bg-red-500' : 
                        h.threatLevel === ThreatLevel.CAUTION ? 'bg-yellow-500' : 'bg-aegis-green'
                      }`} />
                      <span className="text-sm text-slate-300 font-medium truncate max-w-[150px]">{h.query}</span>
                    </div>
                    <span className="text-[10px] text-slate-600 font-mono">{h.timestamp}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-aegis-card/50 border border-dashed border-aegis-border rounded-2xl p-8 flex flex-col items-center text-slate-600">
                <Search size={24} className="mb-2 opacity-20" />
                <p className="text-[10px] font-medium italic">No recent scans</p>
              </div>
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: any, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="bg-aegis-card border border-aegis-border py-3 rounded-2xl flex flex-col items-center justify-center gap-1 hover:border-aegis-green/50 transition-colors group"
    >
      <div className="text-slate-500 group-hover:text-aegis-green transition-colors">{icon}</div>
      <span className="text-[10px] font-bold text-slate-600 group-hover:text-slate-400 uppercase tracking-wider">{label}</span>
    </button>
  );
}
