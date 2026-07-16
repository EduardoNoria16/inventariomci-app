/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import confetti from 'canvas-confetti';
import { auth, db } from './firebase';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  User
} from 'firebase/auth';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc,
  orderBy
} from 'firebase/firestore';
import { LogOut, Plus, Trash2, CheckCircle2, AlertTriangle, XCircle, Package, Layers, ShieldAlert, Download, Search, Sparkles, X, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

interface Material {
  id: string;
  name: string;
  status: 'Hay' | 'Por agotarse' | 'Agotado';
  category?: string;
  createdAt?: number;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Inventory State
  const [materials, setMaterials] = useState<Material[]>([]);
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialCategory, setNewMaterialCategory] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Material['status'] | 'Todos'>('Todos');
  const [categoryFilter, setCategoryFilter] = useState<string>('Todos');
  
  // AI Assistant State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);

  // Tour State
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  const previousStatusRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (user && !isAdmin) {
      const hasSeenTour = localStorage.getItem('mci_tour_seen');
      if (!hasSeenTour) {
        setShowTour(true);
      }
    }
  }, [user, isAdmin]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      // Determine if user is admin based on email
      const adminStatus = currentUser?.email?.toLowerCase().includes('admin') || false;
      setIsAdmin(adminStatus);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setMaterials([]);
      setIsDataLoading(false);
      return;
    }

    setIsDataLoading(true);
    const q = query(collection(db, 'materials'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mats: Material[] = [];
      const newStatusMap: Record<string, string> = {};

      snapshot.forEach((document) => {
        const data = { id: document.id, ...document.data() } as Material;
        mats.push(data);
        newStatusMap[data.id] = data.status;
      });

      snapshot.docChanges().forEach((change) => {
        if (change.type === "modified") {
          const data = change.doc.data() as Material;
          const prevStatus = previousStatusRef.current[change.doc.id];
          
          if (data.status === 'Agotado' && prevStatus !== 'Agotado') {
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Atención: Material Agotado", {
                body: `El material "${data.name}" se ha marcado como Agotado.`,
                icon: "/logo.png"
              });
            }
          }
        }
      });

      previousStatusRef.current = newStatusMap;
      setMaterials(mats);
      setIsDataLoading(false);
    }, (error) => {
      console.error("Error loading materials:", error);
      setIsDataLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const isUserAdmin = email.toLowerCase().includes('admin');
      const persistenceType = isUserAdmin ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistenceType);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      setLoginError('Error al iniciar sesión. Verifica tus datos.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMaterialName.trim()) return;
    
    setIsAdding(true);
    try {
      await addDoc(collection(db, 'materials'), {
        name: newMaterialName.trim(),
        status: 'Hay',
        category: newMaterialCategory.trim() || 'General',
        createdAt: Date.now()
      });
      setNewMaterialName('');
      setNewMaterialCategory('');
    } catch (error) {
      console.error("Error adding material:", error);
      alert("Error al agregar material. Solo administradores pueden hacer esto.");
    } finally {
      setIsAdding(false);
    }
  };

  const updateStatus = async (id: string, status: Material['status']) => {
    setIsMutating(true);
    try {
      await updateDoc(doc(db, 'materials', id), { status });
      
      // Haptic feedback
      if ("vibrate" in navigator) {
        navigator.vibrate(50);
      }

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.9 },
        colors: ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b']
      });
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Error al actualizar estado.");
    } finally {
      setIsMutating(false);
    }
  };

  const deleteMaterial = async (id: string) => {
    if (!window.confirm(`¿Seguro que deseas eliminar este material?`)) return;
    setIsMutating(true);
    try {
      await deleteDoc(doc(db, 'materials', id));
    } catch (error) {
      console.error("Error deleting material:", error);
      alert("Error al eliminar material. Solo administradores pueden hacer esto.");
    } finally {
      setIsMutating(false);
    }
  };

  const exportToCSV = () => {
    if (materials.length === 0) {
      alert("No hay datos para exportar");
      return;
    }
    
    // Create CSV header
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // Added BOM for UTF-8 Excel compatibility
    csvContent += "ID,Nombre del Material,Estado,Fecha de Registro\n";

    // Add rows
    materials.forEach((mat) => {
      const date = mat.createdAt ? new Date(mat.createdAt).toLocaleDateString('es-MX') : 'N/A';
      // Escape quotes and wrap in quotes for safety with commas in names
      const safeName = `"${mat.name.replace(/"/g, '""')}"`;
      const safeCategory = `"${(mat.category || 'General').replace(/"/g, '""')}"`;
      csvContent += `${mat.id},${safeName},${mat.status},${safeCategory},${date}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Inventario_MCI_${new Date().toLocaleDateString('es-MX').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link); // Required for FF
    link.click();
    document.body.removeChild(link);
  };

  const fetchAiSummary = async () => {
    setShowAiModal(true);
    setIsAiLoading(true);
    setAiSummary('');
    try {
      const res = await fetch('/api/inventory-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materials })
      });
      
      if (!res.ok) {
        // Try to read as text first to avoid JSON parse errors on HTML error pages
        const text = await res.text();
        let errorMessage = `Error del servidor (${res.status}).`;
        try {
          const json = JSON.parse(text);
          if (json.error) errorMessage = json.error;
        } catch (e) {
          // It was HTML or non-JSON
        }
        setAiSummary(errorMessage);
        return;
      }

      const data = await res.json();
      if (data.summary) {
        setAiSummary(data.summary);
      } else {
        setAiSummary('Ocurrió un error al analizar el inventario. Intenta de nuevo.');
      }
    } catch (e: any) {
      console.error(e);
      setAiSummary(`Error de red: ${e.message || 'No se pudo contactar al servidor'}.`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'Todos' || m.status === statusFilter;
      const matchesCategory = categoryFilter === 'Todos' || (m.category || 'General') === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [materials, searchTerm, statusFilter, categoryFilter]);

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = new Set(materials.map(m => m.category || 'General'));
    return Array.from(cats).sort();
  }, [materials]);

  // Derived user greeting name (first name only)
  const rawName = user?.email?.split('@')[0].split(/[\.\-_]/)[0] || 'Usuario';
  const displayGreeting = rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();

  // Stats
  const stats = useMemo(() => {
    return {
      hay: materials.filter(m => m.status === 'Hay').length,
      porAgotarse: materials.filter(m => m.status === 'Por agotarse').length,
      agotado: materials.filter(m => m.status === 'Agotado').length,
    };
  }, [materials]);

  const urgentMaterials = useMemo(() => {
    return materials.filter(m => m.status === 'Agotado' || m.status === 'Por agotarse');
  }, [materials]);

  const chartData = useMemo(() => {
    return [
      { name: 'Hay', value: stats.hay, color: '#34d399' },
      { name: 'Por agotarse', value: stats.porAgotarse, color: '#fbbf24' },
      { name: 'Agotado', value: stats.agotado, color: '#fb7185' },
    ].filter(d => d.value > 0);
  }, [stats]);

  const finishTour = () => {
    localStorage.setItem('mci_tour_seen', 'true');
    setShowTour(false);
  };

  const nextTourStep = () => {
    if (tourStep < 2) {
      setTourStep(prev => prev + 1);
    } else {
      finishTour();
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="rounded-full h-12 w-12 border-b-2 border-indigo-600"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-fuchsia-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-fuchsia-500/10 rounded-full blur-[100px] pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10"
        >
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="mx-auto bg-white/50 backdrop-blur-md border border-indigo-200 rounded-3xl h-28 w-28 flex items-center justify-center mb-6 shadow-xl overflow-hidden p-2"
          >
            <img 
              src="/logo.png" 
              alt="MCI Logo" 
              className="w-full h-full object-contain drop-shadow-md"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <Layers className="h-12 w-12 text-indigo-500 hidden" />
          </motion.div>
          <h2 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 to-fuchsia-600 uppercase">
            MCI
          </h2>
          <p className="mt-2 text-sm text-indigo-900/60 uppercase tracking-widest font-bold">
            Control de Inventario
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-10 sm:mx-auto sm:w-full sm:max-w-[400px] z-10"
        >
          <div className="bg-white/70 backdrop-blur-xl px-6 py-10 shadow-2xl sm:rounded-3xl sm:px-12 mx-4 border border-indigo-100">
            <form className="space-y-6" onSubmit={handleLogin}>
              <div>
                <label className="block text-sm font-semibold leading-6 text-indigo-950">
                  Correo electrónico
                </label>
                <div className="mt-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-xl border border-indigo-100 bg-white/60 py-3.5 px-4 text-slate-900 shadow-sm placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 text-[16px] outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold leading-6 text-indigo-950">
                  Contraseña
                </label>
                <div className="mt-2">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-xl border border-indigo-100 bg-white/60 py-3.5 px-4 text-slate-900 shadow-sm placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 text-[16px] outline-none transition-all"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="flex w-full justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-3 py-4 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-indigo-500/30 hover:from-indigo-500 hover:to-fuchsia-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-70 transition-all active:scale-[0.98]"
                >
                  {isLoggingIn ? 'Iniciando...' : 'Acceder al Sistema'}
                </button>
              </div>
              
              <AnimatePresence>
                {loginError && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-lg bg-rose-50 p-3 mt-4 border border-rose-200 shadow-sm">
                      <p className="text-rose-600 text-sm text-center font-bold">
                        {loginError}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto shadow-2xl flex flex-col font-sans relative overflow-hidden">
      
      {/* Global Progress Bar */}
      <AnimatePresence>
        {(isDataLoading || isAiLoading || isMutating || isAdding) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-0 left-0 right-0 h-1 z-50 overflow-hidden bg-indigo-100"
          >
            <motion.div 
              className="h-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-rose-500 w-[50%]"
              animate={{
                x: ['-100%', '200%']
              }}
              transition={{
                repeat: Infinity,
                duration: 1.5,
                ease: "linear"
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-20%] w-96 h-96 bg-indigo-400/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-20%] w-96 h-96 bg-fuchsia-400/20 rounded-full blur-[120px]"></div>
      </div>

      <header className="bg-white/80 backdrop-blur-xl text-slate-900 px-5 pt-8 pb-6 flex flex-col sticky top-0 z-20 border-b border-indigo-100 shadow-sm">
        <div className="flex justify-between items-start mb-8 relative z-10">
          <div className="flex items-center gap-3">
            <motion.div 
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.3 }}
              className="relative w-12 h-12 rounded-2xl shadow-lg shadow-blue-500/20 bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden"
            >
              <img 
                src="/logo.png" 
                alt="Logo" 
                className="w-full h-full object-contain p-1 drop-shadow-md"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <Layers className="h-6 w-6 text-blue-400 hidden" />
            </motion.div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-indigo-950">MCI</h1>
              <p className="text-[10px] text-indigo-900/60 uppercase tracking-widest font-bold mt-0.5 flex items-center gap-1.5">
                {isAdmin ? <><ShieldAlert className="w-3.5 h-3.5 text-rose-500" /> Admin</> : 'Trabajador'} 
              </p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2.5 rounded-xl bg-white/80 backdrop-blur-sm border border-indigo-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all active:scale-95 text-slate-500 shadow-sm group"
          >
            <LogOut className="h-5 w-5 group-hover:scale-110 transition-transform" />
          </button>
        </div>

        <div className="relative z-10 flex justify-between items-end">
          <div>
            <p className="text-indigo-900/60 text-sm font-bold mb-1">Bienvenido,</p>
            <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 to-fuchsia-600">{displayGreeting}</h2>
          </div>
          {isAdmin && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors border border-indigo-200 shadow-sm"
            >
              <Download className="w-4 h-4" />
              CSV
            </motion.button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto relative pb-28 z-10">
        
        {/* Stats Section */}
        <div className="grid grid-cols-3 gap-3 p-5 border-b border-indigo-100 bg-white/40 backdrop-blur-sm">
          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-indigo-50 flex flex-col items-center justify-center text-center shadow-lg shadow-indigo-100/50">
            <span className="text-2xl font-black text-emerald-500 mb-1">{stats.hay}</span>
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Hay</span>
          </div>
          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-indigo-50 flex flex-col items-center justify-center text-center shadow-lg shadow-indigo-100/50">
            <span className="text-2xl font-black text-amber-500 mb-1">{stats.porAgotarse}</span>
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 leading-tight">Por<br/>Agotarse</span>
          </div>
          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-indigo-50 flex flex-col items-center justify-center text-center shadow-lg shadow-indigo-100/50">
            <span className="text-2xl font-black text-rose-500 mb-1">{stats.agotado}</span>
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Agotado</span>
          </div>
        </div>

        {/* Charts & Urgent Section */}
        <div className="p-5 pb-0 space-y-6">
          {chartData.length > 0 && (
            <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-indigo-50 p-5">
              <h3 className="text-xs font-bold text-indigo-900/60 mb-4 uppercase tracking-widest text-center">Distribución de Inventario</h3>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e0e7ff', borderRadius: '12px', color: '#0f172a', fontWeight: 'bold' }}
                      itemStyle={{ color: '#0f172a' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {urgentMaterials.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-amber-50 to-rose-50 rounded-3xl shadow-lg border border-rose-100 p-5 relative overflow-hidden"
            >
              <div className="flex items-start gap-3">
                <div className="bg-white p-2 rounded-xl mt-1 shadow-sm border border-rose-100">
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                </div>
                <div>
                  <h3 className="font-black text-rose-900 mb-1">Atención Requerida</h3>
                  <p className="text-sm text-rose-800/80 font-semibold">Hay {urgentMaterials.length} material{urgentMaterials.length > 1 ? 'es' : ''} que requiere{urgentMaterials.length > 1 ? 'n' : ''} reabastecimiento.</p>
                </div>
              </div>
            </motion.div>
          )}

          {isAdmin && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-indigo-100 p-5 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-fuchsia-50/50 pointer-events-none"></div>
              <h3 className="text-xs font-black text-indigo-900/60 mb-4 uppercase tracking-widest flex items-center gap-2 relative z-10">
                <Plus className="w-4 h-4 text-indigo-500" /> Nuevo Material
              </h3>
              <form onSubmit={handleAddMaterial} className="flex flex-col gap-3 relative z-10">
                <input
                  type="text"
                  required
                  placeholder="Nombre. Ej: Resina Epóxica..."
                  value={newMaterialName}
                  onChange={(e) => setNewMaterialName(e.target.value)}
                  disabled={isAdding}
                  className="w-full rounded-2xl bg-white border border-indigo-100 py-3.5 px-4 text-slate-900 shadow-sm placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm text-[16px] outline-none transition-all font-semibold"
                />
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Categoría. Ej: Químicos"
                    value={newMaterialCategory}
                    onChange={(e) => setNewMaterialCategory(e.target.value)}
                    disabled={isAdding}
                    className="flex-1 rounded-2xl bg-white border border-indigo-100 py-3.5 px-4 text-slate-900 shadow-sm placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm text-[16px] outline-none transition-all font-semibold"
                  />
                  <button
                    type="submit"
                    disabled={isAdding}
                    className="rounded-2xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-500 hover:to-fuchsia-500 flex items-center justify-center disabled:opacity-70 active:scale-95 transition-all"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-indigo-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar en el catálogo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-11 pr-4 py-4 border border-indigo-100 rounded-2xl leading-5 bg-white/70 backdrop-blur-xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm text-[16px] font-medium outline-none transition-all shadow-lg shadow-indigo-100/50"
              />
            </div>
          </div>

          <div className="space-y-4">
            {/* Filter Chips - Status */}
            <div>
              <p className="text-[10px] font-bold text-indigo-900/60 uppercase tracking-widest mb-2 pl-1">Estado</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setStatusFilter('Todos')}
                  className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all border shadow-sm ${
                    statusFilter === 'Todos'
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-500/30'
                      : 'bg-white text-slate-500 border-indigo-100 hover:bg-indigo-50 hover:text-indigo-600'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setStatusFilter('Hay')}
                  className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all border shadow-sm ${
                    statusFilter === 'Hay'
                      ? 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/30'
                      : 'bg-white text-slate-500 border-indigo-100 hover:bg-emerald-50 hover:text-emerald-600'
                  }`}
                >
                  Hay
                </button>
                <button
                  onClick={() => setStatusFilter('Por agotarse')}
                  className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all border shadow-sm ${
                    statusFilter === 'Por agotarse'
                      ? 'bg-amber-500 text-white border-amber-400 shadow-amber-500/30'
                      : 'bg-white text-slate-500 border-indigo-100 hover:bg-amber-50 hover:text-amber-600'
                  }`}
                >
                  Por agotarse
                </button>
                <button
                  onClick={() => setStatusFilter('Agotado')}
                  className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all border shadow-sm ${
                    statusFilter === 'Agotado'
                      ? 'bg-rose-500 text-white border-rose-400 shadow-rose-500/30'
                      : 'bg-white text-slate-500 border-indigo-100 hover:bg-rose-50 hover:text-rose-600'
                  }`}
                >
                  Agotado
                </button>
              </div>
            </div>

            {/* Filter Chips - Category */}
            {categories.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-indigo-900/60 uppercase tracking-widest mb-2 pl-1 mt-1">Categoría</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setCategoryFilter('Todos')}
                    className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all border shadow-sm ${
                      categoryFilter === 'Todos'
                        ? 'bg-fuchsia-600 text-white border-fuchsia-500 shadow-fuchsia-500/30'
                        : 'bg-white text-slate-500 border-indigo-100 hover:bg-fuchsia-50 hover:text-fuchsia-600'
                    }`}
                  >
                    Todas
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all border shadow-sm ${
                        categoryFilter === cat
                          ? 'bg-fuchsia-600 text-white border-fuchsia-500 shadow-fuchsia-500/30'
                          : 'bg-white text-slate-500 border-indigo-100 hover:bg-fuchsia-50 hover:text-fuchsia-600'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between px-1 mt-6">
              <h2 className="text-xs font-black text-indigo-900/60 uppercase tracking-widest">Inventario</h2>
              <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full border border-indigo-200">{filteredMaterials.length}</span>
            </div>

            {materials.length === 0 ? (
              <div className="text-center py-16 px-6 bg-white/40 rounded-3xl border border-indigo-200 border-dashed backdrop-blur-sm">
                <Package className="w-12 h-12 text-indigo-300 mx-auto mb-4" />
                <h3 className="text-indigo-900 font-bold mb-2">Inventario Vacío</h3>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">
                  {isAdmin ? 'Registra tu primer material arriba.' : 'El administrador aún no ha registrado materiales.'}
                </p>
              </div>
            ) : filteredMaterials.length === 0 ? (
              <div className="text-center py-10 px-6 bg-white/40 rounded-3xl border border-indigo-200 border-dashed backdrop-blur-sm">
                <Search className="w-8 h-8 text-indigo-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500 font-medium">No se encontraron resultados para "{searchTerm}"</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredMaterials.map((mat) => {
                  const isHay = mat.status === 'Hay';
                  const isPorAgotarse = mat.status === 'Por agotarse';
                  const isAgotado = mat.status === 'Agotado';

                  return (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      key={mat.id} 
                      className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-indigo-100/50 border border-indigo-50 overflow-hidden group"
                    >
                      <div className="p-5 flex justify-between items-start border-b border-indigo-50 bg-white">
                        <div>
                          <h3 className="font-extrabold text-lg text-indigo-950 tracking-tight leading-tight pr-4">
                            {mat.name}
                          </h3>
                          <span className="inline-block mt-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-indigo-100">
                            {mat.category || 'General'}
                          </span>
                        </div>
                        {isAdmin && (
                          <motion.button 
                            whileTap={{ scale: 0.9 }}
                            onClick={() => deleteMaterial(mat.id)}
                            className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2.5 rounded-xl transition-colors flex-shrink-0 border border-transparent hover:border-rose-100"
                          >
                            <Trash2 className="h-5 w-5" />
                          </motion.button>
                        )}
                      </div>
                      
                      <div className="p-4 bg-slate-50/50">
                        <div className="grid grid-cols-3 gap-3">
                          <motion.button 
                            whileTap={{ scale: 0.95 }}
                            onClick={() => updateStatus(mat.id, 'Hay')}
                            className={`flex flex-col items-center justify-center py-4 px-2 rounded-2xl transition-all shadow-sm ${
                              isHay 
                                ? 'bg-emerald-50 text-emerald-600 shadow-emerald-500/10 border border-emerald-200' 
                                : 'bg-white text-slate-400 hover:bg-slate-50 hover:text-emerald-500 border border-slate-100'
                            }`}
                          >
                            <CheckCircle2 className={`h-6 w-6 mb-2 ${isHay ? 'text-emerald-500' : 'text-slate-300'}`} />
                            <span className="text-[10px] font-bold tracking-wider uppercase">HAY</span>
                          </motion.button>
                          
                          <motion.button 
                            whileTap={{ scale: 0.95 }}
                            onClick={() => updateStatus(mat.id, 'Por agotarse')}
                            className={`flex flex-col items-center justify-center py-4 px-2 rounded-2xl transition-all shadow-sm ${
                              isPorAgotarse 
                                ? 'bg-amber-50 text-amber-600 shadow-amber-500/10 border border-amber-200' 
                                : 'bg-white text-slate-400 hover:bg-slate-50 hover:text-amber-500 border border-slate-100'
                            }`}
                          >
                            <AlertTriangle className={`h-6 w-6 mb-2 ${isPorAgotarse ? 'text-amber-500' : 'text-slate-300'}`} />
                            <span className="text-[10px] font-bold tracking-wider text-center leading-tight uppercase">
                              POR<br/>AGOTARSE
                            </span>
                          </motion.button>
                          
                          <motion.button 
                            whileTap={{ scale: 0.95 }}
                            onClick={() => updateStatus(mat.id, 'Agotado')}
                            className={`flex flex-col items-center justify-center py-4 px-2 rounded-2xl transition-all shadow-sm ${
                              isAgotado 
                                ? 'bg-rose-50 text-rose-600 shadow-rose-500/10 border border-rose-200' 
                                : 'bg-white text-slate-400 hover:bg-slate-50 hover:text-rose-500 border border-slate-100'
                            }`}
                          >
                            <XCircle className={`h-6 w-6 mb-2 ${isAgotado ? 'text-rose-500' : 'text-slate-300'}`} />
                            <span className="text-[10px] font-bold tracking-wider uppercase">AGOTADO</span>
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* AI Assistant FAB */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={fetchAiSummary}
          className="fixed bottom-6 right-4 sm:right-[calc(50%-200px+16px)] bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white p-4 rounded-full shadow-2xl shadow-indigo-600/40 z-30 flex items-center gap-2 group border border-indigo-400/30"
        >
          <Sparkles className="h-6 w-6 group-hover:animate-spin" />
        </motion.button>

        {/* AI Modal */}
        <AnimatePresence>
          {showAiModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                onClick={() => setShowAiModal(false)}
                className="absolute inset-0 bg-indigo-950/60 backdrop-blur-md"
              />
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-indigo-100"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-fuchsia-500"></div>
                <div className="p-5 flex justify-between items-center border-b border-indigo-50 bg-indigo-50/30">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded-xl border border-indigo-200">
                      <Bot className="h-5 w-5 text-indigo-600" />
                    </div>
                    <h3 className="font-bold text-lg text-indigo-950">Asistente IA</h3>
                  </div>
                  <button onClick={() => setShowAiModal(false)} className="p-2 hover:bg-indigo-100 rounded-full transition-colors text-slate-500 hover:text-indigo-900">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="p-6 min-h-[250px] max-h-[60vh] overflow-y-auto custom-scrollbar bg-white">
                  {isAiLoading ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-6 py-12">
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        className="relative"
                      >
                        <div className="absolute inset-0 bg-indigo-200 blur-xl opacity-50 rounded-full"></div>
                        <Sparkles className="h-10 w-10 text-indigo-500 relative z-10" />
                      </motion.div>
                      <p className="font-semibold animate-pulse text-sm tracking-wide">Analizando inventario MCI...</p>
                    </div>
                  ) : (
                    <div className="text-slate-700 leading-relaxed space-y-4 font-medium text-[15px] [&>p]:mb-4 [&>p>strong]:text-indigo-950 [&>p>strong]:font-black [&>ul]:list-disc [&>ul]:ml-5 [&>ul]:mb-4">
                      <Markdown>{aiSummary}</Markdown>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Tour Modal */}
        <AnimatePresence>
          {showTour && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                onClick={finishTour}
                className="absolute inset-0 bg-indigo-950/80 backdrop-blur-sm"
              />
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-indigo-100 p-6 flex flex-col items-center text-center"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-fuchsia-500"></div>
                
                {tourStep === 0 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <div className="bg-indigo-100 p-4 rounded-full inline-flex mb-4">
                      <Sparkles className="h-8 w-8 text-indigo-600" />
                    </div>
                    <h3 className="font-black text-2xl text-indigo-950 mb-2">¡Bienvenido al Inventario MCI!</h3>
                    <p className="text-slate-600 font-medium">Te guiaremos rápidamente para que conozcas cómo usar la aplicación.</p>
                  </motion.div>
                )}

                {tourStep === 1 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <div className="bg-fuchsia-100 p-4 rounded-full inline-flex mb-4">
                      <Search className="h-8 w-8 text-fuchsia-600" />
                    </div>
                    <h3 className="font-black text-xl text-indigo-950 mb-2">Filtros y Búsqueda</h3>
                    <p className="text-slate-600 font-medium text-sm">Utiliza la barra de búsqueda y los botones de colores en la parte superior para encontrar materiales por nombre, estado o categoría al instante.</p>
                  </motion.div>
                )}

                {tourStep === 2 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <div className="bg-emerald-100 p-4 rounded-full inline-flex mb-4">
                      <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                    </div>
                    <h3 className="font-black text-xl text-indigo-950 mb-2">Actualizar Estado</h3>
                    <p className="text-slate-600 font-medium text-sm">Debajo de cada material encontrarás tres botones. Toca el que corresponda para actualizar su estado y mantener a todos informados.</p>
                  </motion.div>
                )}

                <div className="flex items-center justify-between w-full mt-8">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map(step => (
                      <div key={step} className={`h-2 rounded-full transition-all ${step === tourStep ? 'w-6 bg-indigo-600' : 'w-2 bg-indigo-200'}`} />
                    ))}
                  </div>
                  <button 
                    onClick={nextTourStep}
                    className="bg-indigo-600 text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/30"
                  >
                    {tourStep === 2 ? '¡Entendido!' : 'Siguiente'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}



