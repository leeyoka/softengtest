import { useState, useEffect, ReactNode, useRef } from 'react';
import { User } from 'firebase/auth';
import { ShieldCheck, ShieldAlert, PhoneIncoming, Bell, AlertTriangle, Mic, Video, Share2, Database, Zap, MicOff, Camera, Upload, RefreshCw, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { ThreatLevel, CallStatus } from '../types';
import { analyzeCallContent, analyzeDeepfakeImage } from '../services/geminiService';
import { sendAlertToFamily } from '../services/fonnteService';

// Add type for Speech Recognition
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

export default function ShieldScreen({ user }: { user: User }) {
  const [stats, setStats] = useState({ blocked: 0, total: 0, family: 0 });
  const [incomingCall, setIncomingCall] = useState<null | { number: string, transcript?: string, isLive?: boolean }>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<null | { threatLevel: ThreatLevel, summary: string }>(null);
  
  // Speech Recognition state
  const [isListening, setIsListening] = useState(false);
  const [scanLanguage, setScanLanguage] = useState<'en-US' | 'id-ID'>('id-ID'); 
  const recognitionRef = useRef<any>(null);
  const analysisTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Deepfake Scan state
  const [deepfakeScan, setDeepfakeScan] = useState<null | { image: string, result?: { threatLevel: ThreatLevel, summary: string }, loading: boolean }>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const callsRef = collection(db, 'calls');
        const qBlocked = query(callsRef, where('userId', '==', user.uid), where('status', '==', 'blocked'));
        const qTotal = query(callsRef, where('userId', '==', user.uid));
        
        const [snapBlocked, snapTotal] = await Promise.all([
          getDocs(qBlocked),
          getDocs(qTotal)
        ]);
        
        const familyRef = collection(db, 'family');
        const qFamily = query(familyRef, where('userId', '==', user.uid));
        const snapFamily = await getDocs(qFamily);

        setStats({
          blocked: snapBlocked.size,
          total: snapTotal.size,
          family: snapFamily.size
        });
      } catch (err) {
        console.error("Fetch stats error:", err);
      }
    };
    fetchStats();

    // Initialize Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
      
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = scanLanguage; 

      recognition.onstart = () => {
        console.log("Neural stream established");
        setIncomingCall(prev => prev ? { 
          ...prev, 
          transcript: prev.transcript === "Establishing neural handshake..." ? "Neural stream active. Listening..." : prev.transcript 
        } : null);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        
        if (currentTranscript.trim()) {
          setIncomingCall(prev => prev ? { ...prev, transcript: currentTranscript } : null);

          if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
          analysisTimeoutRef.current = setTimeout(() => {
            if (currentTranscript.trim().length > 10) {
              handleAutoAnalyze(currentTranscript);
            }
          }, 3000);
        }
      };

      recognition.onerror = (event: any) => {
        // Ignore 'aborted' as it often happens when we manually stop or when the session times out
        // Ignore 'no-speech' as it just means the mic didn't hear anything
        if (event.error === 'aborted' || event.error === 'no-speech') {
          console.log(`Speech recognition ${event.error}. Context: isListening=${isListening}`);
          return;
        }

        console.error("Neural Voice Error:", event.error);
        if (event.error === 'not-allowed') {
          setIncomingCall(prev => prev ? { ...prev, transcript: "Error: Microphone permission denied." } : null);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        console.log("Speech recognition ended. isListening:", isListening);
        if (isListening) {
          // Add a small delay then restart to keep the "live" feel
          setTimeout(() => { 
            if (isListening && recognitionRef.current) {
              try { 
                recognitionRef.current.start(); 
                console.log("Speech recognition restarted");
              } catch(e) {
                console.warn("Retrying speech recognition start failed:", e);
              }
            } 
          }, 1000);
        }
      };

      recognitionRef.current = recognition;

      // Automatically start if isListening is true when the effect runs
      if (isListening) {
        try {
          recognition.start();
        } catch (e) {
          console.warn("Speech recognition already active on start:", e);
        }
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null; // Prevent restart loops on unmount
          recognitionRef.current.stop();
        } catch(e) {}
      }
      if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
    };
  }, [user.uid, isListening, scanLanguage]);

  const handleAutoAnalyze = async (text: string) => {
    if (isAnalyzing) return;
    
    // Once a threat is detected, we keep the alert active for the duration of the scan
    if (analysisResult?.threatLevel === ThreatLevel.THREAT) return;

    setIsAnalyzing(true);
    const result = await analyzeCallContent(text);
    
    // Only update if the new result is more severe or if we haven't found a threat yet
    if (!analysisResult || result.threatLevel !== ThreatLevel.SAFE) {
      setAnalysisResult(result);
    }
    
    setIsAnalyzing(false);

    if (result.threatLevel === ThreatLevel.THREAT) {
      const familyRef = collection(db, 'family');
      const q = query(familyRef, where('userId', '==', user.uid), where('alertOnCalls', '==', true));
      const snap = await getDocs(q);
      snap.docs.forEach(doc => {
        sendAlertToFamily(doc.data().memberPhoneNumber, user.displayName || 'Aegis User', 'CALL', result.summary, text.slice(0, 50) + "...");
      });
    }
  };

  const startLiveScan = async () => {
    // Request mic permission explicitly for iOS
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.warn("Mic permission deferred or denied", err);
    }

    setIncomingCall({ number: "LIVE VOICE STREAM", transcript: "Establishing neural handshake...", isLive: true });
    setAnalysisResult(null);
    setIsAnalyzing(false);
    setIsListening(true); // This will trigger the useEffect to start the recognition
  };

  const stopLiveScan = () => {
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null; // Prevent restart
        recognitionRef.current.stop(); 
      } catch(e) {}
    }
  };

  const triggerTestCall = () => {
    setIncomingCall({ 
      number: "+62 878 8813 1118", 
      transcript: "This is the police department. Your family member is in custody and needs bail money immediately via bank transfer." 
    });
    setAnalysisResult(null);
    setIsListening(false);
  };

  const handleDeepfakeUpload = (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setDeepfakeScan({ image: reader.result as string, loading: false });
      };
      reader.readAsDataURL(file);
    }
  };

  const runDeepfakeAnalysis = async () => {
    if (!deepfakeScan?.image) return;
    setDeepfakeScan(prev => prev ? { ...prev, loading: true } : null);
    
    const result = await analyzeDeepfakeImage(deepfakeScan.image);
    setDeepfakeScan(prev => prev ? { ...prev, loading: false, result } : null);

    // If it's a threat, we might want to log it or alert family
    if (result.threatLevel === ThreatLevel.THREAT) {
        try {
            await addDoc(collection(db, 'calls'), {
                userId: user.uid,
                phoneNumber: "DEEPFAKE ANALYZER",
                callerName: "Visual Forensic Scan",
                timestamp: serverTimestamp(),
                status: CallStatus.BLOCKED,
                threatLevel: result.threatLevel,
                scamIndicators: result.summary,
                duration: 0
            });
        } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, 'calls');
        }
    }
  };

  const handleAnalyze = async () => {
    if (!incomingCall?.transcript) return;
    if (isListening) stopLiveScan();
    
    setIsAnalyzing(true);
    const result = await analyzeCallContent(incomingCall.transcript);
    setAnalysisResult(result);
    setIsAnalyzing(false);

    try {
      await addDoc(collection(db, 'calls'), {
        userId: user.uid,
        phoneNumber: incomingCall.number,
        callerName: "Aegis Live Scan",
        timestamp: serverTimestamp(),
        status: result.threatLevel === ThreatLevel.THREAT ? CallStatus.BLOCKED : CallStatus.ANSWERED,
        threatLevel: result.threatLevel,
        scamIndicators: result.summary,
        duration: 0
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'calls');
    }

    if (result.threatLevel === ThreatLevel.THREAT) {
      const familyRef = collection(db, 'family');
      const q = query(familyRef, where('userId', '==', user.uid), where('alertOnCalls', '==', true));
      const snap = await getDocs(q);
      
      const alertPromises = snap.docs.map(doc => {
        const member = doc.data();
        return sendAlertToFamily(member.memberPhoneNumber, user.displayName || 'Aegis User', 'CALL', result.summary, incomingCall.number);
      });
      
      await Promise.all(alertPromises);
    }
  };

  const alertAllFamily = async () => {
    try {
      setIsAnalyzing(true);
      const familyRef = collection(db, 'family');
      const q = query(familyRef, where('userId', '==', user.uid));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        alert("No family members added yet!");
        setIsAnalyzing(false);
        return;
      }

      const alertPromises = snap.docs.map(doc => {
        const member = doc.data();
        return sendAlertToFamily(member.memberPhoneNumber, user.displayName || 'Aegis User', 'MANUAL', 'MANUAL EMERGENCY');
      });
      
      await Promise.all(alertPromises);
      setIsAnalyzing(false);
      alert("Emergency broadcast successfully sent!");
    } catch (e) {
      setIsAnalyzing(false);
      handleFirestoreError(e, OperationType.LIST, 'family');
    }
  };

  const toggleLanguage = () => {
    setScanLanguage(prev => prev === 'en-US' ? 'id-ID' : 'en-US');
    if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
        setTimeout(() => {
            recognitionRef.current.lang = scanLanguage === 'en-US' ? 'id-ID' : 'en-US';
            recognitionRef.current.start();
        }, 100);
    }
  };

  const simulateIncomingThreat = () => {
    setIncomingCall({
      number: "+62 812-3344-XXXX",
      transcript: scanLanguage === 'id-ID' 
        ? "Selamat siang Bapak, ini dari verifikasi Bank ABC. Akun Anda terdeteksi ada transaksi mencurigakan sebesar 5 juta rupiah. Mohon berikan kode OTP yang kami kirimkan untuk membatalkan..."
        : "Hello, this is Bank security department. Your account has a suspicious charge of $500. Please verify your identity by providing the code we just sent to your phone...",
      isLive: true
    });
    setAnalysisResult(null);
    setIsListening(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col items-center justify-center space-y-1">
        <h1 className="text-white font-bold tracking-[0.2em] text-xl uppercase">AEGIS</h1>
        <div className="flex items-center space-x-2">
            <div className="w-1.5 h-1.5 bg-aegis-green rounded-full shadow-[0_0_8px_#10B981]" />
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Your Digital Shield</p>
        </div>
      </div>

      {/* Pulsing Radar */}
      <div className="relative flex flex-col items-center justify-center py-4">
        <div className="relative w-64 h-64 flex items-center justify-center">
            {/* Radar Lines */}
            <div className="absolute inset-0 border border-slate-800 rounded-full" />
            <div className="absolute inset-8 border border-slate-800 rounded-full" />
            <div className="absolute inset-16 border border-slate-800 rounded-full" />
            <div className="absolute inset-24 border border-slate-800 rounded-full" />
            
            {/* Spinning Radar Line */}
            <motion.div 
               animate={{ rotate: 360 }}
               transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
               className="absolute inset-0 rounded-full border-t border-t-aegis-green/20"
            />

            {/* Central Icon */}
            <motion.div 
              animate={{ 
                scale: analysisResult?.threatLevel === ThreatLevel.THREAT ? [1, 1.1, 1] : 1,
              }}
              className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center border-4 ${
                analysisResult?.threatLevel === ThreatLevel.THREAT 
                ? 'bg-aegis-red border-aegis-red/20 shadow-[0_0_40px_rgba(239,68,68,0.4)]' 
                : 'bg-aegis-green border-aegis-green/20 shadow-[0_0_40px_rgba(16,185,129,0.2)]'
              }`}
            >
              {analysisResult?.threatLevel === ThreatLevel.THREAT ? (
                <ShieldAlert className="text-white w-10 h-10" />
              ) : (
                <ShieldCheck className="text-white w-10 h-10" fill="currentColor" />
              )}
            </motion.div>
        </div>

        <div className="text-center mt-6 space-y-1">
            <h2 className={`text-2xl font-bold tracking-tight uppercase ${analysisResult?.threatLevel === ThreatLevel.THREAT ? 'text-aegis-red' : 'text-white'}`}>
                {analysisResult?.threatLevel === ThreatLevel.THREAT ? 'Threat detected' : 'All Systems GO'}
            </h2>
            <div className="inline-flex items-center bg-aegis-red/10 border border-aegis-red/20 px-3 py-1 rounded-full text-aegis-red text-[10px] font-bold uppercase tracking-widest">
               <ShieldAlert size={12} className="mr-1.5" /> Protection Active
            </div>
            <div className="pt-2">
              <button 
                onClick={simulateIncomingThreat}
                className="text-[8px] font-bold text-slate-500 hover:text-aegis-red uppercase tracking-[0.2em] transition-colors"
              >
                [ Run Cloud Simulation ]
              </button>
            </div>
        </div>
      </div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Scams Blocked" value={stats.blocked} icon={<ShieldAlert size={14} />} color="text-aegis-red" />
        <StatCard label="Verified Safe" value={stats.total - stats.blocked} icon={<ShieldCheck size={14} />} color="text-aegis-green" />
        <StatCard label="Neural Load" value="Optimal" icon={<Zap size={14} />} color="text-amber-400" />
      </div>

      {/* Forensic Tools Grid */}
      <div className="grid grid-cols-2 gap-3">
        <ForensicTool 
          icon={<Mail size={18} />} 
          title="Message ID" 
          desc="SMS Fraud Detector"
          onClick={() => {
            const navBtn = document.querySelector('nav button:nth-child(2)') as HTMLButtonElement;
            navBtn?.click();
          }}
        />
        <ForensicTool 
          icon={<Video size={18} />} 
          title="Deepfake Scan" 
          desc="Neural Face Audit"
          onClick={() => fileInputRef.current?.click()}
        />
        <ForensicTool 
          icon={<AlertTriangle size={18} />} 
          title="SOS Broadcast" 
          desc="Alert All Family"
          onClick={alertAllFamily}
          warning
        />
        <ForensicTool 
          icon={<Mic size={18} />} 
          title="Call Scanner" 
          desc="Launch Neural Scan"
          onClick={startLiveScan}
        />
      </div>

      {/* Activity Log Preview */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-4 space-y-3">
        <div className="flex justify-between items-center px-1">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Guardians</h4>
          <span className="flex items-center text-[10px] font-mono text-aegis-green">
            <div className="w-1.5 h-1.5 bg-aegis-green rounded-full mr-2 animate-pulse" />
            LIVE MONITORING
          </span>
        </div>
        <div className="space-y-2">
            <LogItem label="Voice Recognition" status="Mic Active" />
            <LogItem label="Clipboard Watch" status="Watching" />
            <LogItem label="Family Sync" status="Connected" />
        </div>
        
        <div className="pt-2 border-t border-slate-800/50 mt-2 flex flex-col space-y-2">
          <button 
            onClick={simulateIncomingThreat}
            className="w-full py-3 px-4 rounded-xl bg-aegis-red/20 hover:bg-aegis-red/30 text-aegis-red text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center space-x-2 border border-aegis-red/30"
          >
            <Zap size={14} className="animate-pulse" />
            <span>Simulate Cloud Push (Call)</span>
          </button>
          
          <button 
            onClick={toggleLanguage}
            className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-bold uppercase tracking-[0.2em] transition-colors flex items-center justify-center space-x-2"
          >
            <RefreshCw size={12} className="text-aegis-green" />
            <span>Language: {scanLanguage === 'id-ID' ? 'Indonesian' : 'English'}</span>
          </button>
        </div>
      </div>

      <input 
        type="file" 
        accept="image/*" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleDeepfakeUpload}
      />

      <AnimatePresence>
        {deepfakeScan && (
           <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[70] flex items-center justify-center p-4"
           >
             <motion.div 
               initial={{ scale: 0.9, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               className="bg-aegis-card border border-slate-800 w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl"
             >
                <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                    <div>
                        <h4 className="text-white font-bold tracking-tight">Visual Forensic Scan</h4>
                        <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mt-0.5">Multimodal Analysis</p>
                    </div>
                    <button onClick={() => setDeepfakeScan(null)} className="text-slate-500 hover:text-white transition-colors">
                        <RefreshCw size={20} className={deepfakeScan.loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-inner group">
                        <img src={deepfakeScan.image} className="w-full h-full object-cover" alt="Deepfake Scan" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                            <span className="text-[10px] text-white/60 font-bold uppercase tracking-widest">Image Signal: 1080p RGB</span>
                        </div>
                        {deepfakeScan.loading && (
                            <div className="absolute inset-0 bg-aegis-bg/60 backdrop-blur-sm flex flex-col items-center justify-center space-y-4">
                                <div className="relative w-16 h-16">
                                    <div className="absolute inset-0 border-4 border-aegis-green/20 rounded-full" />
                                    <div className="absolute inset-0 border-4 border-aegis-green border-t-transparent rounded-full animate-spin" />
                                </div>
                                <p className="text-aegis-green text-[10px] font-bold uppercase tracking-[0.3em] animate-pulse">Running Neural Scan...</p>
                            </div>
                        )}
                    </div>

                    {deepfakeScan.result ? (
                        <motion.div 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`p-4 rounded-2xl flex items-start space-x-4 ${
                                deepfakeScan.result.threatLevel === ThreatLevel.THREAT ? 'bg-aegis-red/10 border border-aegis-red/20 text-aegis-red' : 
                                deepfakeScan.result.threatLevel === ThreatLevel.CAUTION ? 'bg-amber-400/10 border border-amber-400/20 text-amber-400' :
                                'bg-aegis-green/10 border border-aegis-green/20 text-aegis-green'
                            }`}
                        >
                            {deepfakeScan.result.threatLevel === ThreatLevel.THREAT ? <ShieldAlert size={32} /> : <ShieldCheck size={32} />}
                            <div>
                                <h5 className="font-bold text-sm uppercase tracking-wider">{deepfakeScan.result.threatLevel} DETECTED</h5>
                                <p className="text-[10px] mt-1 font-medium leading-normal uppercase opacity-80">{deepfakeScan.result.summary}</p>
                            </div>
                        </motion.div>
                    ) : !deepfakeScan.loading && (
                        <button 
                            onClick={runDeepfakeAnalysis}
                            className="w-full bg-aegis-green text-aegis-bg font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center space-x-3"
                        >
                            <Camera size={18} />
                            <span>Analyze Frame</span>
                        </button>
                    )}

                    <button 
                        onClick={() => setDeepfakeScan(null)}
                        className="w-full text-slate-500 text-[10px] font-bold uppercase tracking-widest py-2 active:text-slate-300"
                    >
                        Close Forensic Vault
                    </button>
                </div>
             </motion.div>
           </motion.div>
        )}
      </AnimatePresence>

      {/* Test Button */}
      <button 
        onClick={triggerTestCall}
        className="w-full bg-slate-800/50 hover:bg-slate-800 border border-slate-700 p-4 rounded-2xl flex items-center justify-between group transition-all"
      >
        <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 border border-amber-500/20">
                <Zap size={20} />
            </div>
            <div className="text-left">
                <h4 className="text-white text-sm font-bold uppercase tracking-tight group-hover:text-amber-400 transition-colors">Simulate a scam call</h4>
                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Test the full alert flow now</p>
            </div>
        </div>
        <Zap className="text-slate-600 group-hover:text-amber-500 transition-colors" size={20} />
      </button>

      <AnimatePresence>
        {incomingCall && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 backdrop-blur-md z-[80] flex flex-col items-center justify-center p-6"
          >
            {/* Holographic Scanner Frame */}
            <div className="relative w-full max-w-sm aspect-[3/4] flex flex-col items-center justify-between p-8 bg-slate-900 border border-slate-800 rounded-[40px] shadow-2xl overflow-hidden">
               {/* Scanning Line */}
               {isListening && (
                 <motion.div 
                   animate={{ top: ['0%', '100%', '0%'] }}
                   transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                   className="absolute left-0 right-0 h-0.5 bg-aegis-green/40 shadow-[0_0_20px_#10B981] z-20 pointer-events-none"
                 />
               )}

               <div className="w-full flex justify-between items-start z-10">
                  <div className="space-y-1">
                    <h4 className="text-white font-bold text-xl tracking-tight">{incomingCall.number}</h4>
                    <div className="flex items-center space-x-2">
                       <span className="flex h-2 w-2 rounded-full bg-aegis-green animate-pulse" />
                       <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Neural Stream Active</span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <div className="bg-black/40 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center space-x-2">
                       <span className="text-aegis-green text-[10px] font-mono tracking-tighter">BITRATE</span>
                       <span className="text-white text-[10px] font-mono">128 KBPS</span>
                    </div>
                  </div>
               </div>

               {/* Central Scanning Ring */}
               <div className="relative flex items-center justify-center w-full grow">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div 
                      animate={{ 
                        scale: analysisResult?.threatLevel === ThreatLevel.THREAT ? [1, 1.2, 1] : [1, 1.1, 1], 
                        opacity: analysisResult?.threatLevel === ThreatLevel.THREAT ? [0.2, 0.4, 0.2] : [0.1, 0.2, 0.1] 
                      }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className={`w-48 h-48 border rounded-full ${
                        analysisResult?.threatLevel === ThreatLevel.THREAT ? 'border-aegis-red' : 
                        analysisResult?.threatLevel === ThreatLevel.SAFE ? 'border-aegis-green' : 
                        'border-aegis-green/50'
                      }`}
                    />
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
                      className="w-40 h-40 border-2 border-dashed border-slate-800 rounded-full"
                    />
                  </div>
                  
                  <div className="relative z-10 flex flex-col items-center">
                    <AnimatePresence mode="wait">
                      {analysisResult ? (
                        <motion.div
                          key={analysisResult.threatLevel}
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl ${
                            analysisResult.threatLevel === ThreatLevel.THREAT ? 'bg-aegis-red' : 
                            analysisResult.threatLevel === ThreatLevel.SAFE ? 'bg-aegis-green' : 
                            'bg-amber-500'
                          }`}
                        >
                          {analysisResult.threatLevel === ThreatLevel.THREAT ? <ShieldAlert size={40} className="text-white" /> : 
                           analysisResult.threatLevel === ThreatLevel.SAFE ? <ShieldCheck size={40} className="text-white" /> :
                           <AlertTriangle size={40} className="text-white" />}
                        </motion.div>
                      ) : (
                        <div className="relative">
                          <Mic className={`text-aegis-green w-12 h-12 ${isListening ? 'animate-pulse' : ''}`} />
                          {isAnalyzing && (
                             <motion.div 
                               animate={{ rotate: 360 }}
                               transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                               className="absolute -inset-4 border-2 border-t-aegis-green border-transparent rounded-full"
                             />
                          )}
                        </div>
                      )}
                    </AnimatePresence>
                    
                    <div className="text-center mt-6">
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-2">
                        {analysisResult ? 
                           (analysisResult.threatLevel === ThreatLevel.SAFE ? 'Identity Verified' : 'Neural Anomaly') : 
                           'Spectral Fidelity'}
                      </p>
                      <h4 className={`text-sm font-bold uppercase tracking-widest ${
                        analysisResult?.threatLevel === ThreatLevel.THREAT ? 'text-aegis-red' : 
                        analysisResult?.threatLevel === ThreatLevel.SAFE ? 'text-aegis-green' : 
                        'text-white'
                      }`}>
                         {isAnalyzing ? 'Analyzing...' : 
                          analysisResult?.threatLevel === ThreatLevel.THREAT ? 'AI Voice Detected' : 
                          analysisResult?.threatLevel === ThreatLevel.SAFE ? 'Human Detected' : 
                          'Listening...'}
                      </h4>
                    </div>
                  </div>
               </div>

               {/* Live Transcript / Findings */}
               <div className="w-full space-y-4 z-10">
                  <div className="bg-black/60 rounded-2xl p-4 border border-slate-800 h-24 overflow-y-auto">
                    <p className="text-slate-400 font-mono text-[11px] leading-relaxed italic">
                      {incomingCall.transcript || "Establishing neural handshake..."}
                    </p>
                  </div>

                  {analysisResult ? (
                    <motion.div 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className={`p-4 rounded-2xl flex items-center space-x-4 ${
                        analysisResult.threatLevel === ThreatLevel.THREAT 
                        ? 'bg-aegis-red/20 border border-aegis-red/30 text-aegis-red' 
                        : 'bg-aegis-green/20 border border-aegis-green/30 text-aegis-green'
                      }`}
                    >
                      {analysisResult.threatLevel === ThreatLevel.THREAT ? <ShieldAlert size={28} /> : <ShieldCheck size={28} />}
                      <div>
                        <h5 className="font-bold text-xs uppercase tracking-wider">{analysisResult.threatLevel} DETECTED</h5>
                        <p className="text-[9px] font-bold uppercase opacity-80 mt-0.5">{analysisResult.summary}</p>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={stopLiveScan}
                          disabled={!isListening}
                          className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-2xl text-[10px] uppercase tracking-widest transition-all disabled:opacity-50"
                        >
                          <MicOff size={14} />
                          <span>Mute Stream</span>
                        </button>
                        <button 
                          onClick={handleAnalyze}
                          disabled={isAnalyzing || (incomingCall.isLive && incomingCall.transcript === "")}
                          className="flex items-center justify-center space-x-2 bg-aegis-green text-aegis-bg font-bold py-3 rounded-2xl text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 shadow-[0_10px_20px_rgba(16,185,129,0.3)]"
                        >
                          {isAnalyzing ? <RefreshCw className="animate-spin" size={14} /> : <Zap size={14} />}
                          <span>{isAnalyzing ? 'Processing' : 'Analyze'}</span>
                        </button>
                    </div>
                  )}

                  <button 
                    onClick={() => { stopLiveScan(); setIncomingCall(null); }}
                    className="w-full text-slate-500 hover:text-slate-300 transition-colors text-[10px] font-bold uppercase tracking-[0.2em] py-2"
                  >
                    Terminate Session
                  </button>
               </div>

               {/* Aesthetic Technical Overlays */}
               <div className="absolute top-0 right-0 w-32 h-32 bg-aegis-green/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
               <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full -translate-x-1/2 translate-y-1/2" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LogItem({ label, status }: { label: string, status: string }) {
  return (
    <div className="flex justify-between items-center px-4 py-3 bg-black/40 rounded-xl border border-slate-800/50">
      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{label}</span>
      <span className="text-[10px] text-aegis-green font-mono">{status}</span>
    </div>
  );
}

function ForensicTool({ icon, title, desc, onClick, warning }: { icon: ReactNode, title: string, desc: string, onClick: () => void, warning?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`p-4 rounded-2xl border text-left flex flex-col space-y-2 transition-all active:scale-[0.98] ${
        warning 
        ? 'bg-aegis-red/5 border-aegis-red/20 hover:bg-aegis-red/10 group' 
        : 'bg-aegis-card border-aegis-border hover:border-aegis-green/50 hover:bg-slate-800'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${warning ? 'bg-aegis-red/10 text-aegis-red' : 'bg-slate-800 text-slate-400 group-hover:text-aegis-green'}`}>
        {icon}
      </div>
      <div>
        <h4 className={`text-[11px] font-bold uppercase tracking-tight ${warning ? 'text-aegis-red' : 'text-white'}`}>{title}</h4>
        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">{desc}</p>
      </div>
    </button>
  );
}

function StatCard({ label, value, icon, color }: { label: string, value: string | number, icon: ReactNode, color: string }) {
  return (
    <div className="bg-aegis-card border border-aegis-border p-3 rounded-2xl flex flex-col space-y-2 shadow-sm">
      <div className={`w-7 h-7 rounded-lg bg-black/40 flex items-center justify-center ${color} border border-white/5`}>
        {icon}
      </div>
      <div>
        <div className={`text-xl font-bold tracking-tight ${color}`}>{value}</div>
        <div className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter whitespace-nowrap">{label}</div>
      </div>
    </div>
  );
}

function FeatureRow({ icon, title, description, active, onClick }: { icon: ReactNode, title: string, description: string, active: boolean, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center justify-between border p-4 rounded-2xl transition-all ${
        onClick ? 'bg-aegis-card hover:border-aegis-green/50 cursor-pointer active:scale-[0.98]' : 'bg-aegis-card/40 border-aegis-border'
      } ${onClick ? 'border-aegis-border' : 'border-aegis-border'}`}
    >
        <div className="flex items-center space-x-4">
            <div className="text-slate-400">
                {icon}
            </div>
            <div>
                <h4 className="text-white text-xs font-bold uppercase tracking-tight">{title}</h4>
                <p className="text-slate-500 text-[9px] uppercase font-bold tracking-wider">{description}</p>
            </div>
        </div>
        <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-aegis-green pulsing-green shadow-[0_0_8px_#10B981]' : 'bg-slate-700'}`} />
    </div>
  );
}
