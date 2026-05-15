import { auth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { Shield, Smartphone, Globe, ShieldCheck, Mail, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      // Note: signInWithPopup may be blocked by some browsers in an iframe.
      // If it fails, the user might need to click again or use a different browser.
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Login failed", err);
      setError(err.message || "Authentication failed. Please try again or check if your browser blocks popups.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-aegis-bg p-8 max-w-md mx-auto shadow-2xl relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-aegis-green/5 blur-[120px] rounded-full" />
      
      <div className="flex-1 flex flex-col items-center justify-center relative z-10">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-28 h-28 bg-aegis-green rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(16,185,129,0.2)] mb-12 border-4 border-aegis-green/10"
        >
          <Shield className="text-aegis-bg w-14 h-14" fill="currentColor" />
        </motion.div>
        
        <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center"
        >
            <h1 className="text-5xl font-bold text-white tracking-[0.2em] mb-2 uppercase">AEGIS</h1>
            <p className="text-slate-500 font-bold tracking-[0.3em] uppercase text-[11px]">Your Digital Shield</p>
        </motion.div>

        {/* Stats Grid */}
        <motion.div 
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-3 gap-8 w-full mt-16 mb-20"
        >
            <LoginStat value="1M+" label="Scams Blocked" />
            <LoginStat value="Real-time" label="AI Detection" />
            <LoginStat value="24/7" label="Protection" />
        </motion.div>

        <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-center space-y-4"
        >
            <h2 className="text-2xl font-bold text-white px-8 leading-tight">
                Protect yourself from AI voice scams & deepfakes
            </h2>
            <p className="text-slate-500 text-xs font-semibold px-4 italic opacity-60">
                Secure your digital identity with Aegis
            </p>
        </motion.div>
      </div>

      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="space-y-4 relative z-10"
      >
        {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-start space-x-3 text-red-500 text-[10px] mb-4">
                <AlertCircle size={16} className="shrink-0" />
                <p className="font-medium leading-normal">{error}</p>
            </div>
        )}

        <button 
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-white hover:bg-white/90 text-aegis-bg font-bold py-5 rounded-[24px] shadow-xl transition-all active:scale-95 flex items-center justify-center space-x-3 uppercase tracking-widest text-[10px]"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-aegis-bg border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Mail size={18} />
              <span>Continue with Google</span>
            </>
          )}
        </button>
        
        <p className="text-center text-slate-500 text-[10px] uppercase font-bold tracking-widest">
            More login options coming soon
        </p>
      </motion.div>
      
      <div className="mt-8 mb-4 flex items-center justify-center space-x-2 text-slate-700">
        <ShieldCheck size={14} />
        <p className="text-[9px] font-bold uppercase tracking-[0.2em]">Verified Secure Protocol</p>
      </div>
    </div>
  );
}

function LoginStat({ value, label }: { value: string, label: string }) {
    return (
        <div className="text-center space-y-1">
            <div className="text-white font-bold text-base">{value}</div>
            <div className="text-slate-500 text-[8px] font-bold uppercase tracking-wider">{label}</div>
        </div>
    )
}
