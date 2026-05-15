import { useState, useEffect, ReactNode, FormEvent } from 'react';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { FamilyMember, UserProfile } from '../types';
import { UserPlus, Shield, X, Phone, Trash2, Bell, CheckCircle2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { sendAlertToFamily } from '../services/fonnteService';

export default function FamilyScreen({ user, profile }: { user: User, profile: UserProfile }) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', phone: '', relation: 'Parent' });
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'family'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FamilyMember[];
      setMembers(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'family');
    });

    return unsubscribe;
  }, [user.uid]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMember.name || !newMember.phone) return;

    try {
      const fullPhone = newMember.phone.startsWith('62') ? newMember.phone : `62${newMember.phone.replace(/^0/, '')}`;
      await addDoc(collection(db, 'family'), {
        userId: user.uid,
        memberName: `${newMember.name} (${newMember.relation})`,
        memberPhoneNumber: fullPhone,
        alertOnCalls: true,
        alertOnMessages: true,
        alertOnRegistry: true,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'family');
    }

    setNewMember({ name: '', phone: '', relation: 'Parent' });
    setShowAddForm(false);
  };

  const toggleAlert = async (id: string, field: 'alertOnCalls' | 'alertOnMessages' | 'alertOnRegistry', current: boolean) => {
    try {
      await updateDoc(doc(db, 'family', id), {
        [field]: !current
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `family/${id}`);
    }
  };

  const removeMember = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'family', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `family/${id}`);
    }
  };

  const alertAllFamily = async () => {
    if (members.length === 0) return;
    setIsSending(true);
    try {
      const alertPromises = members.map(member => 
        sendAlertToFamily(member.memberPhoneNumber, user.displayName || 'Aegis User', 'MANUAL', 'MANUAL EMERGENCY')
      );
      const results = await Promise.all(alertPromises);
      setIsSending(false);

      const failedCount = results.filter(r => r.status === false).length;
      if (failedCount > 0) {
        const failure = results.find(r => r.status === false);
        const reason = failure?.reason || failure?.detail || "Fonnte API error";
        
        if (failedCount === members.length) {
          alert(`Failed to send alerts.\n\nReason: ${reason}\n\nNote: Please ensure your Fonnte Device is "CONNECTED" and your Token is correctly set in Secrets.`);
        } else {
          alert(`Alert sent to ${members.length - failedCount} members, but ${failedCount} failed.\n\nReason: ${reason}`);
        }
      } else {
        alert("Emergency broadcast successfully sent to all linked family members!");
      }
    } catch (e) {
      setIsSending(false);
      console.error("Broadcast error:", e);
      alert("An unexpected error occurred while sending alerts.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Family Network</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">{members.length} Trusted Contacts</p>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="w-10 h-10 bg-aegis-green text-aegis-bg rounded-xl flex items-center justify-center shadow-lg shadow-aegis-green/20 active:scale-90 transition-all"
        >
          <UserPlus size={20} />
        </button>
      </div>

      {/* Hero Alert Banner */}
      <motion.button 
        whileTap={{ scale: 0.98 }}
        onClick={alertAllFamily}
        disabled={isSending || members.length === 0}
        className={`w-full overflow-hidden relative group p-5 rounded-3xl flex items-center justify-between transition-all ${
            members.length === 0 ? 'bg-slate-800/50 opacity-50' : 'bg-aegis-red/10 border border-aegis-red/20 active:bg-aegis-red/20'
        }`}
      >
        <div className="flex items-center space-x-4 relative z-10">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl ${
                isSending ? 'bg-aegis-green' : 'bg-aegis-red shadow-aegis-red/20'
            }`}>
               {isSending ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Bell className="w-6 h-6" />}
            </div>
            <div className="text-left">
                <h3 className="text-white text-lg font-bold tracking-tight">Alert all family now</h3>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${isSending ? 'text-aegis-green' : 'text-aegis-red/70'}`}>
                    {isSending ? 'Broadcasting signals...' : 'Sends a real WhatsApp warning'}
                </p>
            </div>
        </div>
        <div className="text-slate-500 group-active:text-white transition-colors relative z-10">
            {isSending ? null : <ChevronDown className="-rotate-90" size={24} />}
        </div>
        {/* Background elements */}
        <Bell className="absolute -right-4 -bottom-4 text-aegis-red/5 w-24 h-24 rotate-12" />
      </motion.button>

      {/* Member List */}
      <div className="space-y-4">
        {members.length === 0 ? (
          <div className="text-center py-20 bg-aegis-card border border-aegis-border border-dashed rounded-3xl">
             <div className="mx-auto w-12 h-12 bg-slate-800/30 rounded-2xl flex items-center justify-center mb-4 text-slate-600">
               <Shield size={24} />
             </div>
             <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Circle empty</p>
             <button onClick={() => setShowAddForm(true)} className="text-aegis-green text-[10px] font-bold uppercase tracking-[0.2em] mt-4">Establish first link</button>
          </div>
        ) : (
          members.map(member => (
            <div key={member.id} className="bg-aegis-card border border-aegis-border rounded-3xl p-5 space-y-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-slate-800/50 rounded-2xl flex items-center justify-center text-aegis-green font-bold text-lg border border-slate-700/50">
                    {member.memberName.split(' ')[0][0]}{member.memberName.split(' ')[1]?.[1] || member.memberName.split(' ')[0][1]}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base tracking-tight">{member.memberName}</h4>
                    <p className="text-slate-500 text-[11px] font-bold tracking-wider">{member.memberPhoneNumber}</p>
                  </div>
                </div>
                <button onClick={() => removeMember(member.id)} className="p-2 text-slate-700 hover:text-aegis-red transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="pt-4 border-t border-slate-800/50 flex flex-col space-y-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Alert on Threats in:</p>
                <div className="grid grid-cols-3 gap-2">
                  <ToggleButton 
                    label="Calls" 
                    active={member.alertOnCalls} 
                    onClick={() => toggleAlert(member.id, 'alertOnCalls', member.alertOnCalls)} 
                    color="bg-aegis-green" 
                  />
                  <ToggleButton 
                    label="Msgs" 
                    active={member.alertOnMessages} 
                    onClick={() => toggleAlert(member.id, 'alertOnMessages', member.alertOnMessages)} 
                    color="bg-blue-500" 
                  />
                  <ToggleButton 
                    label="Search" 
                    active={member.alertOnRegistry} 
                    onClick={() => toggleAlert(member.id, 'alertOnRegistry', member.alertOnRegistry)} 
                    color="bg-amber-400" 
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[70] flex items-end sm:items-center justify-center p-4"
          >
            <motion.form 
              initial={{ y: 100, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 100, scale: 0.95 }}
              onSubmit={handleAdd}
              className="bg-aegis-card w-full max-w-sm rounded-[32px] p-8 shadow-2xl relative border border-slate-800"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-white tracking-tight">Add family member</h3>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Establish a new safety link</p>
                </div>
                <button type="button" onClick={() => setShowAddForm(false)} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400"><X size={18} /></button>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Name</label>
                  <input 
                    autoFocus
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 text-white placeholder:text-slate-700 focus:outline-none focus:border-aegis-green transition-colors"
                    placeholder="e.g. Mom"
                    value={newMember.name}
                    onChange={e => setNewMember({...newMember, name: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                  <div className="relative">
                    <input 
                      required
                      type="tel"
                      className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 text-white placeholder:text-slate-700 focus:outline-none focus:border-aegis-green transition-colors pl-14"
                      placeholder="812 3456 7890"
                      value={newMember.phone}
                      onChange={e => setNewMember({...newMember, phone: e.target.value})}
                    />
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold border-r border-slate-700 pr-3">
                        +62
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Relationship</label>
                   <div className="grid grid-cols-3 gap-2">
                      {['Parent', 'Sibling', 'Child', 'Spouse', 'Friend', 'Other'].map(rel => (
                        <button
                           key={rel}
                           type="button"
                           onClick={() => setNewMember({...newMember, relation: rel})}
                           className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${
                             newMember.relation === rel ? 'bg-aegis-green text-aegis-bg border-aegis-green' : 'bg-slate-900 text-slate-500 border-slate-700'
                           }`}
                        >
                            {rel}
                        </button>
                      ))}
                   </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-aegis-green text-aegis-bg font-bold py-5 rounded-[24px] shadow-lg shadow-aegis-green/20 mt-4 active:scale-95 transition-all text-xs uppercase tracking-widest"
                >
                  Establish safety link
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ToggleButton({ label, active, onClick, color }: { label: string, active: boolean, onClick: () => void, color: string }) {
  return (
    <button 
      onClick={onClick}
      type="button"
      className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${
        active ? `${color}/10 border-${color.replace('bg-', '')}/30 text-white` : 'bg-black/20 border-slate-800 text-slate-500'
      }`}
    >
      <span className={`text-[9px] font-bold uppercase tracking-widest mb-2 ${active ? color.replace('bg-', 'text-') : 'text-slate-600'}`}>{label}</span>
      <div className={`w-8 h-4 rounded-full relative transition-colors ${active ? color : 'bg-slate-800'}`}>
        <motion.div 
          animate={{ x: active ? 16 : 0 }}
          className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full"
        />
      </div>
    </button>
  );
}
