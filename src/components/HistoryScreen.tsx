import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { CallRecord, ThreatLevel } from '../types';
import { ShieldCheck, ShieldAlert, AlertCircle, Phone, Search } from 'lucide-react';
import { motion } from 'motion/react';

export default function HistoryScreen({ user }: { user: User }) {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [filter, setFilter] = useState<'All' | ThreatLevel>('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'calls'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const callData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CallRecord[];
      setCalls(callData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'calls');
    });

    return unsubscribe;
  }, [user.uid]);

  const filteredCalls = filter === 'All' ? calls : calls.filter(c => c.threatLevel === filter);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Call History</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Review activity record</p>
        </div>
        <div className="w-10 h-10 bg-aegis-card border border-aegis-border rounded-xl flex items-center justify-center text-slate-400">
          <Search size={18} />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex bg-aegis-card border border-aegis-border p-1 rounded-2xl overflow-x-auto no-scrollbar">
        {['All', ThreatLevel.THREAT, ThreatLevel.CAUTION, ThreatLevel.SAFE].map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t as any)}
            className={`flex-1 min-w-[70px] py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${
              filter === t 
                ? 'bg-white text-aegis-bg shadow-lg' 
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t === ThreatLevel.THREAT ? 'Threat' : t === ThreatLevel.CAUTION ? 'Caution' : t === ThreatLevel.SAFE ? 'Safe' : 'All'}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
             <div className="w-8 h-8 border-2 border-aegis-green/20 border-t-aegis-green rounded-full animate-spin" />
             <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">Synchronizing logs...</p>
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="text-center py-24 bg-aegis-card border border-aegis-border rounded-3xl">
             <div className="mx-auto w-12 h-12 bg-slate-800/30 rounded-2xl flex items-center justify-center mb-4 text-slate-600">
               <Phone size={24} />
             </div>
             <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">No activity logged</p>
          </div>
        ) : (
          filteredCalls.map((call, idx) => (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={call.id} 
              className="bg-aegis-card p-4 rounded-2xl border border-aegis-border flex items-start space-x-4 hover:border-slate-700 transition-colors"
            >
              <div className={`w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center relative ${
                call.threatLevel === ThreatLevel.THREAT ? 'bg-aegis-red/10 text-aegis-red' : 
                call.threatLevel === ThreatLevel.CAUTION ? 'bg-amber-400/10 text-amber-400' : 
                'bg-aegis-green/10 text-aegis-green'
              }`}>
                {call.threatLevel === ThreatLevel.THREAT ? <ShieldAlert size={22} /> : 
                 call.threatLevel === ThreatLevel.CAUTION ? <AlertCircle size={22} /> : 
                 <ShieldCheck size={22} />}
                
                {call.threatLevel === ThreatLevel.THREAT && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-aegis-red rounded-full border-2 border-aegis-card pulsing-red" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-base text-white truncate pr-2 tracking-tight">{call.phoneNumber}</h4>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                        {call.callerName || 'Unknown caller'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest border ${
                        call.threatLevel === ThreatLevel.THREAT ? 'bg-aegis-red/10 border-aegis-red/20 text-aegis-red' : 
                        call.threatLevel === ThreatLevel.CAUTION ? 'bg-amber-400/10 border-amber-400/20 text-amber-400' : 
                        'bg-aegis-green/10 border-aegis-green/20 text-aegis-green'
                    }`}>
                        {call.threatLevel === ThreatLevel.THREAT ? '● Scam' : 
                         call.threatLevel === ThreatLevel.CAUTION ? '● Suspicious' : '● Verified'}
                    </span>
                    <span className="text-slate-600 text-[9px] font-bold tabular-nums">
                        {(() => {
                          const d = (call.timestamp as any)?.toDate?.() || new Date(call.timestamp);
                          return isNaN(d.getTime()) ? 'Recently' : `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
                        })()}
                    </span>
                  </div>
                </div>
                
                {call.scamIndicators && (
                  <div className="mt-3 text-[9px] bg-black/40 p-3 rounded-xl text-slate-400 border border-slate-800/50 leading-relaxed font-medium uppercase tracking-tight">
                    <span className={`font-bold mr-1 ${
                        call.threatLevel === ThreatLevel.THREAT ? 'text-aegis-red' : 'text-aegis-green'
                    }`}>REPORT:</span>
                    {call.scamIndicators}
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
