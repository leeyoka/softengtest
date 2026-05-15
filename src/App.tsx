import { useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Shield, Clock, Users, Settings as SettingsIcon, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ShieldScreen from './components/ShieldScreen';
import HistoryScreen from './components/HistoryScreen';
import FamilyScreen from './components/FamilyScreen';
import SettingsScreen from './components/SettingsScreen';
import MessageScreen from './components/MessageScreen';
import RegistryScreen from './components/RegistryScreen';
import LoginScreen from './components/LoginScreen';
import { StressTest } from './components/StressTest';
import { UserProfile } from './types';
import { Mail, Activity } from 'lucide-react';

type Tab = 'shield' | 'messages' | 'registry' | 'history' | 'family' | 'settings' | 'lab';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('shield');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setUser(user);
        if (user) {
          const docRef = doc(db, 'users', user.uid);
          let docSnap;
          try {
            docSnap = await getDoc(docRef);
          } catch (e) {
            handleFirestoreError(e, OperationType.GET, `users/${user.uid}`);
          }
          
          if (docSnap && docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            // New user
            const newProfile: any = {
              uid: user.uid,
              name: user.displayName || 'User',
              phoneNumber: user.phoneNumber || '',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            try {
              await setDoc(docRef, newProfile);
            } catch (e) {
              handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`);
            }
            setProfile(newProfile as UserProfile);
          }
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error("Auth callback error:", error);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-aegis-bg">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotateY: [0, 180, 360]
          }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          className="w-24 h-24 bg-aegis-green rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.3)] mb-8 border-4 border-aegis-green/20"
        >
          <Shield className="text-aegis-bg w-12 h-12" fill="currentColor" />
        </motion.div>
        <span className="text-white font-bold tracking-[0.2em] text-3xl uppercase font-sans">Aegis</span>
        <span className="text-aegis-green/60 text-[10px] font-bold tracking-[0.4em] uppercase mt-4">Initializing Security...</span>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const renderScreen = () => {
    switch (activeTab) {
      case 'shield': return <ShieldScreen user={user} />;
      case 'messages': return <MessageScreen user={user} />;
      case 'registry': return <RegistryScreen user={user} />;
      case 'history': return <HistoryScreen user={user} />;
      case 'family': return <FamilyScreen user={user} profile={profile!} />;
      case 'settings': return <SettingsScreen user={user} onOpenLab={() => setActiveTab('lab')} />;
      case 'lab': return <StressTest />;
      default: return <ShieldScreen user={user} />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-aegis-bg text-slate-100 font-sans max-w-md mx-auto shadow-2xl relative">
      <main className="flex-1 overflow-y-auto pb-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="p-5"
          >
            {renderScreen()}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 w-full max-w-md bg-aegis-bg/80 backdrop-blur-xl border-t border-aegis-border px-1 py-4 flex justify-around items-center z-50">
        <NavButton active={activeTab === 'shield'} onClick={() => setActiveTab('shield')} icon={<Shield size={18} />} label="Shield" />
        <NavButton active={activeTab === 'messages'} onClick={() => setActiveTab('messages')} icon={<Mail size={18} />} label="Msgs" />
        <NavButton active={activeTab === 'registry'} onClick={() => setActiveTab('registry')} icon={<Search size={18} />} label="Search" />
        <NavButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<Clock size={18} />} label="History" />
        <NavButton active={activeTab === 'family'} onClick={() => setActiveTab('family')} icon={<Users size={18} />} label="Family" />
        <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<SettingsIcon size={18} />} label="Cfg" />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center px-4 py-2 transition-all duration-300 ${
        active 
          ? 'text-aegis-green' 
          : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      <div className="mb-1 transform transition-transform duration-300 scale-100 active:scale-90">
        {icon}
      </div>
      <span className={`text-[9px] font-bold tracking-wider uppercase transition-all ${active ? 'opacity-100' : 'opacity-40'}`}>{label}</span>
      {active && (
        <motion.div 
          layoutId="activeTab"
          className="absolute -top-4 w-12 h-1 bg-aegis-green rounded-full"
        />
      )}
    </button>
  );
}
