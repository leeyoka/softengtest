import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, limit, getDocs } from 'firebase/firestore';
import { MessageRecord, MessageStatus, ThreatLevel } from '../types';
import { Mail, ShieldCheck, ShieldAlert, Zap, Search, MessageSquare, AlertTriangle, Clock, ChevronRight, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeMessageContent } from '../services/geminiService';
import { sendAlertToFamily } from '../services/fonnteService';

export default function MessageScreen({ user }: { user: User }) {
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [inputContent, setInputContent] = useState('');
  const [inputSender, setInputSender] = useState('');
  const [activeAnalysis, setActiveAnalysis] = useState<null | any>(null);
  const [isSimulatingIncoming, setIsSimulatingIncoming] = useState(false);

  const triggerAlerts = async (result: any, sender: string) => {
    if (result.threatLevel === ThreatLevel.THREAT) {
      try {
        const familyRef = collection(db, 'family');
        const q = query(familyRef, where('userId', '==', user.uid), where('alertOnMessages', '==', true));
        const snap = await getDocs(q);
        
        const alertPromises = snap.docs.map(doc => {
          const member = doc.data();
          return sendAlertToFamily(member.memberPhoneNumber, user.displayName || 'Aegis User', 'SMS', result.summary, sender);
        });
        
        await Promise.all(alertPromises);
      } catch (e) {
        console.error("SMS Alert failed:", e);
      }
    }
  };

  useEffect(() => {
    // Simulate real-time detection
    const timer = setTimeout(() => {
       if (messages.length > 0) return; // Only trigger for new users
       setIsSimulatingIncoming(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [messages.length]);

  const triggerSimulatedMessage = async () => {
    setIsSimulatingIncoming(false);
    const mockContent = "Pelanggan Yth, Akun ShopeePay anda telah dibatasi. Silahkan verifikasi ulang data anda di: https://bit.ly/shopee-verif-2024 agar saldo anda tidak hangus.";
    const mockSender = "ShopeeCare";
    
    setIsScanning(true);
    const result = await analyzeMessageContent(mockContent, mockSender);
    
    const newMsg: any = {
      userId: user.uid,
      sender: mockSender,
      content: mockContent,
      timestamp: serverTimestamp(),
      status: result.status,
      threatLevel: result.threatLevel,
      category: result.category,
      summary: result.summary
    };

    await addDoc(collection(db, 'messages'), newMsg);
    setActiveAnalysis(result);
    setIsScanning(false);
    
    // Trigger alerts
    triggerAlerts(result, mockSender);
    
    alert("Real-time Message Neural Scan Triggered!");
  };

  useEffect(() => {
    // Neural Clipboard Watch: Check for common scam patterns when window gains focus
    const handleFocus = async () => {
      try {
        const text = await navigator.clipboard.readText();
        const scamPatterns = ['otp', 'shopee', 'bank', 'verifikasi', 'menang', 'hadiah', 'bit.ly'];
        if (text && text.length > 20 && scamPatterns.some(p => text.toLowerCase().includes(p))) {
           if (text !== inputContent) {
             setInputContent(text);
             setInputSender("Clipboard Source");
             alert("Neural Sync: Suspicious message detected in clipboard. Ready to scan.");
           }
        }
      } catch (e) {
        // Clipboard perm denied or not available, ignore
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [inputContent]);

  useEffect(() => {
    const q = query(
      collection(db, 'messages'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MessageRecord[];
      setMessages(msgs);
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'messages'));

    return () => unsubscribe();
  }, [user.uid]);

  const handleScan = async () => {
    if (!inputContent || isScanning) return;
    setIsScanning(true);
    setActiveAnalysis(null);

    const result = await analyzeMessageContent(inputContent, inputSender || 'Unknown');
    
    const newMsg: any = {
      userId: user.uid,
      sender: inputSender || 'Unknown',
      content: inputContent,
      timestamp: serverTimestamp(),
      status: result.status,
      threatLevel: result.threatLevel,
      category: result.category,
      summary: result.summary
    };

    try {
      await addDoc(collection(db, 'messages'), newMsg);
      setActiveAnalysis(result);
      
      // Trigger alerts
      triggerAlerts(result, inputSender || 'Unknown');
      
      setInputContent('');
      setInputSender('');
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'messages');
    } finally {
      setIsScanning(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OTP':
      case 'Transaction':
        return 'text-blue-400 border-blue-400/30 bg-blue-400/10';
      case 'Verified':
        return 'text-aegis-green border-aegis-green/30 bg-aegis-green/10';
      case 'Suspicious':
      case 'Fraud':
        return 'text-aegis-red border-aegis-red/30 bg-aegis-red/10';
      default:
        return 'text-slate-400 border-slate-800 bg-slate-800/50';
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Message ID</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">AI-Powered SMS Shield</p>
        </div>
        <div className="bg-aegis-green/10 p-2 rounded-xl">
           <Mail className="text-aegis-green" size={24} />
        </div>
      </div>

      {/* Manual Input Scanner */}
      <div className="bg-slate-900 border border-slate-800 rounded-[32px] p-6 space-y-4">
        <AnimatePresence>
          {isSimulatingIncoming && (
            <motion.div 
               initial={{ opacity: 0, y: -50 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="bg-slate-900 border-2 border-aegis-red/50 p-5 rounded-[24px] shadow-[0_20px_50px_rgba(239,68,68,0.3)] mb-6 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-aegis-red animate-pulse" />
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-3">
                  <div className="bg-aegis-red p-2 rounded-lg">
                    <Mail size={16} className="text-white" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-aegis-red uppercase tracking-widest block">Neural Cloud Push</span>
                    <span className="text-white font-bold text-xs">ShopeeCare</span>
                  </div>
                </div>
                <span className="text-slate-500 text-[8px] font-mono">JUST NOW</span>
              </div>
              <p className="text-slate-300 text-[10px] leading-relaxed mb-4 italic">"Pelanggan Yth, Akun ShopeePay anda telah dibatasi. Silahkan verifikasi ulang..."</p>
              <div className="flex space-x-2">
                <button 
                  onClick={triggerSimulatedMessage}
                  className="flex-1 bg-aegis-red text-white text-[9px] font-bold uppercase py-2.5 rounded-xl active:scale-95 shadow-lg shadow-aegis-red/20"
                >
                  Neural Scan
                </button>
                <button 
                  onClick={() => setIsSimulatingIncoming(false)}
                  className="px-4 bg-slate-800 text-slate-500 text-[9px] font-bold uppercase py-2.5 rounded-xl"
                >
                  Ignore
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center space-x-3 text-aegis-green">
           <Zap size={18} />
           <span className="text-[10px] font-bold uppercase tracking-widest">Instant Neural Scan</span>
        </div>
        
        <div className="space-y-3">
          <input 
            type="text" 
            placeholder="Sender Name/Number (Optional)" 
            value={inputSender}
            onChange={(e) => setInputSender(e.target.value)}
            className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:border-aegis-green outline-none transition-all"
          />
          <textarea 
            placeholder="Paste message content here..." 
            value={inputContent}
            onChange={(e) => setInputContent(e.target.value)}
            rows={3}
            className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:border-aegis-green outline-none transition-all resize-none"
          />
          <button 
            onClick={handleScan}
            disabled={!inputContent || isScanning}
            className="w-full bg-aegis-green text-aegis-bg font-bold py-4 rounded-2xl flex items-center justify-center space-x-2 shadow-lg disabled:opacity-50 transition-all active:scale-95"
          >
            {isScanning ? (
              <div className="w-5 h-5 border-2 border-aegis-bg border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Search size={18} />
                <span className="uppercase tracking-widest text-xs">Verify Message</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Analysis Result Highlight */}
      <AnimatePresence>
        {activeAnalysis && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className={`p-5 rounded-3xl border ${
              activeAnalysis.threatLevel === ThreatLevel.THREAT ? 'bg-aegis-red/10 border-aegis-red/30 text-aegis-red' :
              activeAnalysis.threatLevel === ThreatLevel.CAUTION ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' :
              'bg-aegis-green/10 border-aegis-green/30 text-aegis-green'
            } space-y-3`}>
              <div className="flex items-center space-x-3">
                {activeAnalysis.threatLevel === ThreatLevel.THREAT ? <ShieldAlert size={24} /> : <ShieldCheck size={24} />}
                <h4 className="font-bold uppercase tracking-wider text-sm">{activeAnalysis.status} DETECTED</h4>
              </div>
              <p className="text-[10px] font-bold uppercase leading-relaxed opacity-80">{activeAnalysis.summary}</p>
              {activeAnalysis.threatLevel === ThreatLevel.THREAT && (
                <div className="bg-aegis-red/20 py-2 px-3 rounded-lg flex items-center space-x-2">
                   <Lock size={12} />
                   <span className="text-[8px] font-bold uppercase tracking-widest">Links disabled for safety</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Categories Bento */}
      <div className="grid grid-cols-2 gap-3">
        <CategoryCard 
          icon={<ShieldCheck className="text-aegis-green" />} 
          label="Verified" 
          count={messages.filter(m => m.status === MessageStatus.VERIFIED).length} 
        />
        <CategoryCard 
          icon={<AlertTriangle className="text-aegis-red" />} 
          label="Fraud/Spam" 
          count={messages.filter(m => m.threatLevel === ThreatLevel.THREAT).length} 
        />
      </div>

      {/* Feed */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Recent Message Activity</h3>
          <button 
            onClick={() => setIsSimulatingIncoming(true)}
            className="text-[8px] font-bold text-aegis-red uppercase tracking-widest bg-aegis-red/10 px-2 py-1 rounded border border-aegis-red/20 active:scale-95"
          >
            Simulate Cloud Push
          </button>
        </div>
        <div className="space-y-3">
          {messages.length > 0 ? (
            messages.map((msg) => (
              <motion.div 
                key={msg.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-aegis-card border border-aegis-border p-4 rounded-2xl flex items-start space-x-4 group"
              >
                <div className={`p-3 rounded-xl ${
                  msg.threatLevel === ThreatLevel.THREAT ? 'bg-aegis-red/20 text-aegis-red' :
                  msg.status === 'OTP' || msg.status === 'Transaction' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-slate-800 text-slate-400'
                }`}>
                  <MessageSquare size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-white font-bold text-sm truncate">{msg.sender}</span>
                    <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded border ${getStatusColor(msg.status)}`}>
                       {msg.status}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[10px] line-clamp-2 leading-relaxed italic mb-2">"{msg.content}"</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-slate-600 text-[8px] font-bold uppercase">
                      <Clock size={10} className="mr-1" />
                      {msg.timestamp ? (msg.timestamp.toDate?.() || new Date(msg.timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                    </div>
                    <ChevronRight size={14} className="text-slate-700 group-hover:text-slate-400 transition-colors" />
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-12 space-y-3">
              <Mail className="mx-auto text-slate-800" size={48} />
              <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">No messages scanned yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryCard({ icon, label, count }: { icon: any, label: string, count: number }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl flex items-center space-x-3">
      <div className="bg-black/40 p-2 rounded-lg">{icon}</div>
      <div>
        <div className="text-lg font-bold text-white leading-tight">{count}</div>
        <div className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">{label}</div>
      </div>
    </div>
  );
}
