import { User, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { Shield, Bell, Eye, Database, LogOut, ChevronRight, Mic, Video, Trash2, Smartphone, Info, Activity } from 'lucide-react';
import { useState, ReactNode } from 'react';
import { motion } from 'motion/react';

export default function SettingsScreen({ user, onOpenLab }: { user: User, onOpenLab?: () => void }) {
  const [settings, setSettings] = useState({
    realtime: true,
    autoAlert: true,
    transcription: true,
    sensitivity: 'Medium' as 'Low' | 'Medium' | 'High',
    zeroData: true,
    voiceShield: true,
    deepfake: true
  });

  const handleLogout = () => {
    signOut(auth);
  };

  const toggle = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Settings</h2>
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Configure protection protocols</p>
      </div>

      {/* Account Info */}
      <div className="bg-aegis-card border border-aegis-border p-5 rounded-3xl flex items-center justify-between">
        <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-aegis-green rounded-2xl flex items-center justify-center text-aegis-bg font-bold text-xl border-4 border-aegis-green/20">
                {user.displayName?.[0] || 'U'}
            </div>
            <div>
                <h4 className="font-bold text-white text-base tracking-tight">{user.displayName || 'Authorized User'}</h4>
                <p className="text-slate-500 text-[11px] font-bold tracking-wider">{user.phoneNumber || user.email}</p>
            </div>
        </div>
        <div className="flex items-center bg-aegis-green/10 text-aegis-green px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest">
            Signed in
        </div>
      </div>

      {/* Protection Toggles */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Protection</h3>
        <div className="bg-aegis-card border border-aegis-border rounded-[32px] overflow-hidden divide-y divide-slate-800/50">
            <SettingRow 
                icon={<Shield className="text-aegis-green" size={18} />} 
                label="Real-time Protection" 
                sub="Monitor calls as they happen" 
                active={settings.realtime}
                onToggle={() => toggle('realtime')}
            />
            <SettingRow 
                icon={<Bell className="text-aegis-red" size={18} />} 
                label="Auto-Alert Family" 
                sub="Automatically notify on threats" 
                active={settings.autoAlert}
                onToggle={() => toggle('autoAlert')}
            />
            <SettingRow 
                icon={<Eye className="text-amber-400" size={18} />} 
                label="Show Transcription" 
                sub="Display live speech text" 
                active={settings.transcription}
                onToggle={() => toggle('transcription')}
            />
        </div>
      </div>

      {/* Sensitivity */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Detection Sensitivity</h3>
        <div className="bg-aegis-card border border-aegis-border p-5 rounded-[32px] space-y-4">
            <div className="grid grid-cols-3 gap-2 bg-black/30 p-1.5 rounded-2xl border border-slate-800/50">
                {['Low', 'Medium', 'High'].map(level => (
                    <button
                        key={level}
                        onClick={() => setSettings(prev => ({ ...prev, sensitivity: level as any }))}
                        className={`py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                            settings.sensitivity === level ? 'bg-aegis-green text-aegis-bg shadow-lg' : 'text-slate-500 hover:text-white'
                        }`}
                    >
                        {level}
                    </button>
                ))}
            </div>
            <p className="text-[9px] text-slate-500 font-medium text-center uppercase tracking-widest leading-relaxed">
                {settings.sensitivity === 'Low' && "Only obvious scams — fewer alerts"}
                {settings.sensitivity === 'Medium' && "Balanced — recommended for most users"}
                {settings.sensitivity === 'High' && "More sensitive — may produce false alerts"}
            </p>
        </div>
      </div>

      {/* Privacy & Data */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Privacy & Data</h3>
        <div className="bg-aegis-card border border-aegis-border rounded-[32px] overflow-hidden divide-y divide-slate-800/50">
            <SettingRow 
                icon={<Database className="text-indigo-400" size={18} />} 
                label="Zero Data Retention" 
                sub="Call content is never stored" 
                active={settings.zeroData}
                onToggle={() => toggle('zeroData')}
            />
            <SettingRow 
                icon={<Mic className="text-aegis-green" size={18} />} 
                label="Voice Clone Shield" 
                sub="Detect AI-cloned voices" 
                active={settings.voiceShield}
                onToggle={() => toggle('voiceShield')}
            />
            <SettingRow 
                icon={<Video className="text-amber-400" size={18} />} 
                label="Deepfake Analysis" 
                sub="Scan inbound video signals" 
                active={settings.deepfake}
                onToggle={() => toggle('deepfake')}
            />
        </div>
      </div>

      {/* Block List */}
      <button className="w-full bg-aegis-card border border-aegis-border p-5 rounded-[32px] flex items-center justify-between group active:scale-[0.98] transition-all">
          <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-aegis-red/10 border border-aegis-red/20 rounded-xl flex items-center justify-center text-aegis-red">
                  <Trash2 size={20} />
              </div>
              <div className="text-left">
                  <h4 className="text-white text-sm font-bold uppercase tracking-tight">Manage blocked numbers</h4>
                  <p className="text-slate-500 text-[9px] uppercase font-bold tracking-wider">0 numbers blocked</p>
              </div>
          </div>
          <ChevronRight className="text-slate-700 group-hover:text-white transition-colors" size={20} />
      </button>

      {/* Device Setup Guide */}
      <div className="bg-slate-900 border border-slate-800 rounded-[32px] p-6 space-y-4">
        <div className="flex items-center space-x-3 text-aegis-green">
           <Smartphone size={18} />
           <span className="text-[10px] font-bold uppercase tracking-widest">Mobile & Desktop Sync</span>
        </div>
        
        <div className="space-y-4">
          <div className="bg-black/40 p-4 rounded-2xl border border-slate-800/50">
            <h4 className="text-white text-xs font-bold mb-2 flex items-center">
              <div className="w-1.5 h-1.5 bg-aegis-green rounded-full mr-2" />
              iPhone Setup (iOS)
            </h4>
            <p className="text-slate-400 text-[10px] leading-relaxed">
              Open in Safari &gt; Share &gt; Add to Home Screen. This enables full-screen protection and faster access.
            </p>
          </div>

          <div className="bg-black/40 p-4 rounded-2xl border border-slate-800/50">
            <h4 className="text-white text-xs font-bold mb-2 flex items-center">
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2" />
              Windows Setup
            </h4>
            <p className="text-slate-400 text-[10px] leading-relaxed">
              Open in Chrome/Edge &gt; Click the 'Install' icon in the URL bar. Launch Aegis from your Start Menu.
            </p>
          </div>

          <div className="flex items-start space-x-3 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
            <Info size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[9px] text-amber-500/80 font-medium uppercase tracking-tight">
              Pro Tip: Aegis uses Neural Clipboard Watch. Copy a suspicious SMS and open the app—it will detect it instantly.
            </p>
          </div>
        </div>
      </div>

      {/* Permission Hub */}
      <div className="bg-slate-900 border border-slate-800 rounded-[32px] p-6 space-y-4">
        <div className="flex items-center space-x-3 text-blue-400">
           <Shield size={18} />
           <span className="text-[10px] font-bold uppercase tracking-widest">Real-Time Permission Hub</span>
        </div>
        
        <div className="space-y-3">
          <PermissionItem 
            label="In-App Notifications" 
            desc="Enable for real-time cloud push simulation"
            active={true}
          />
          <PermissionItem 
            label="Clipboard Access" 
            desc="Automatic SMS detection via copy-paste"
            active={true}
          />
          <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-800">
            <h5 className="text-white text-[10px] font-bold uppercase mb-1">Physical Phone Limitation</h5>
            <p className="text-slate-500 text-[8px] leading-relaxed">
              Standard web apps cannot read private SMS notifications directly from iOS/Android. 
              <span className="text-aegis-green ml-1">Workaround: Use "Neural Clipboard Sync" — Copy message, open Aegis.</span>
            </p>
          </div>
        </div>
      </div>

      {/* Engineering Lab */}
      {onOpenLab && (
        <button 
          onClick={onOpenLab}
          className="w-full bg-slate-900 border border-slate-800 p-5 rounded-[32px] flex items-center justify-between group active:scale-[0.98] transition-all"
        >
          <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-aegis-green/10 border border-aegis-green/20 rounded-xl flex items-center justify-center text-aegis-green">
                  <Activity size={20} />
              </div>
              <div className="text-left">
                  <h4 className="text-white text-sm font-bold uppercase tracking-tight">Engineering Lab</h4>
                  <p className="text-slate-500 text-[9px] uppercase font-bold tracking-wider">Run System Volume Tests</p>
              </div>
          </div>
          <ChevronRight className="text-slate-700 group-hover:text-white transition-colors" size={20} />
        </button>
      )}

      {/* Logout */}
      <button 
        onClick={handleLogout}
        className="w-full bg-aegis-red/10 border border-aegis-red/20 p-5 rounded-[32px] flex items-center justify-between group active:scale-[0.98] transition-all"
      >
        <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-aegis-red rounded-xl flex items-center justify-center text-white shadow-lg shadow-aegis-red/20">
                <LogOut size={20} />
            </div>
            <div className="text-left">
                <h4 className="text-white text-sm font-bold uppercase tracking-tight">Sign out</h4>
                <p className="text-aegis-red/60 text-[9px] uppercase font-bold tracking-wider">Terminate current session</p>
            </div>
        </div>
        <LogOut className="text-aegis-red group-hover:scale-110 transition-transform" size={20} />
      </button>

      <div className="pt-8 pb-4 text-center space-y-2">
        <p className="text-slate-600 text-[10px] font-bold uppercase tracking-[0.4em]">AEGIS v1.0.8</p>
        <p className="text-slate-700 text-[8px] font-medium uppercase tracking-[0.2em]">Built to protect the people we love most.</p>
      </div>
    </div>
  );
}

function SettingRow({ icon, label, sub, active, onToggle }: { icon: ReactNode, label: string, sub: string, active: boolean, onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between p-5 hover:bg-white/5 transition-colors">
      <div className="flex items-center space-x-4">
        <div className="w-10 h-10 bg-slate-800/30 rounded-xl flex items-center justify-center border border-slate-800">
          {icon}
        </div>
        <div>
          <p className="font-bold text-white text-sm uppercase tracking-tight">{label}</p>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{sub}</p>
        </div>
      </div>
      <button 
        onClick={onToggle}
        className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${active ? 'bg-aegis-green' : 'bg-slate-800'}`}
      >
        <motion.div 
          animate={{ x: active ? 26 : 2 }}
          className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-lg"
        />
      </button>
    </div>
  );
}

function PermissionItem({ label, desc, active }: { label: string, desc: string, active: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-slate-800/50">
      <div>
        <h5 className="text-white text-[9px] font-bold uppercase tracking-widest">{label}</h5>
        <p className="text-slate-500 text-[7px] uppercase font-medium mt-0.5">{desc}</p>
      </div>
      <div className={`px-2 py-0.5 rounded text-[7px] font-bold uppercase ${active ? 'bg-aegis-green/20 text-aegis-green' : 'bg-slate-800 text-slate-500'}`}>
        {active ? 'Granted' : 'Pending'}
      </div>
    </div>
  );
}
