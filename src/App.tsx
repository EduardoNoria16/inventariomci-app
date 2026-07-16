/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
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
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // AI Assistant State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);

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
      return;
    }

    const q = query(collection(db, 'materials'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mats: Material[] = [];
      snapshot.forEach((document) => {
        mats.push({ id: document.id, ...document.data() } as Material);
      });
      setMaterials(mats);
    }, (error) => {
      console.error("Error loading materials:", error);
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
        createdAt: Date.now()
      });
      setNewMaterialName('');
    } catch (error) {
      console.error("Error adding material:", error);
      alert("Error al agregar material. Solo administradores pueden hacer esto.");
    } finally {
      setIsAdding(false);
    }
  };

  const updateStatus = async (id: string, status: Material['status']) => {
    try {
      await updateDoc(doc(db, 'materials', id), { status });
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Error al actualizar estado.");
    }
  };

  const deleteMaterial = async (id: string) => {
    if (!window.confirm(`¿Seguro que deseas eliminar este material?`)) return;
    try {
      await deleteDoc(doc(db, 'materials', id));
    } catch (error) {
      console.error("Error deleting material:", error);
      alert("Error al eliminar material. Solo administradores pueden hacer esto.");
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
      csvContent += `${mat.id},${safeName},${mat.status},${date}\n`;
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
      const res = await fetch('/api/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materials })
      });
      const data = await res.json();
      if (data.summary) {
        setAiSummary(data.summary);
      } else {
        setAiSummary('Ocurrió un error al analizar el inventario. Intenta de nuevo.');
      }
    } catch (e) {
      console.error(e);
      setAiSummary('Error de red. No se pudo contactar a la inteligencia artificial.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const filteredMaterials = useMemo(() => {
    return materials.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [materials, searchTerm]);

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

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="rounded-full h-12 w-12 border-b-2 border-white"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10"
        >
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="mx-auto bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-3xl h-28 w-28 flex items-center justify-center mb-6 text-white shadow-2xl overflow-hidden p-2"
          >
            <img 
              src="/logo.png" 
              alt="MCI Logo" 
              className="w-full h-full object-contain drop-shadow-lg"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <Layers className="h-12 w-12 text-blue-400 hidden" />
          </motion.div>
          <h2 className="text-4xl font-extrabold tracking-tight text-white uppercase bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300">
            MCI
          </h2>
          <p className="mt-2 text-sm text-slate-400 uppercase tracking-widest font-semibold">
            Control de Inventario
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-10 sm:mx-auto sm:w-full sm:max-w-[400px] z-10"
        >
          <div className="bg-slate-800/80 backdrop-blur-xl px-6 py-10 shadow-2xl sm:rounded-3xl sm:px-12 mx-4 border border-slate-700/50">
            <form className="space-y-6" onSubmit={handleLogin}>
              <div>
                <label className="block text-sm font-semibold leading-6 text-slate-300">
                  Correo electrónico
                </label>
                <div className="mt-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-xl border-0 bg-slate-900/50 py-3.5 px-4 text-white shadow-inner ring-1 ring-inset ring-slate-700 placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6 text-[16px] outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold leading-6 text-slate-300">
                  Contraseña
                </label>
                <div className="mt-2">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-xl border-0 bg-slate-900/50 py-3.5 px-4 text-white shadow-inner ring-1 ring-inset ring-slate-700 placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6 text-[16px] outline-none transition-all"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="flex w-full justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-4 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-blue-900/50 hover:from-blue-500 hover:to-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-70 transition-all active:scale-[0.98]"
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
                    <div className="rounded-lg bg-red-900/30 p-3 mt-4 border border-red-500/30">
                      <p className="text-red-400 text-sm text-center font-medium">
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
    <div className="min-h-screen bg-slate-950 max-w-md mx-auto shadow-2xl flex flex-col font-sans relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-20%] w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-20%] w-96 h-96 bg-purple-600/10 rounded-full blur-[120px]"></div>
      </div>

      <header className="bg-slate-900/50 backdrop-blur-xl text-white px-5 pt-8 pb-6 flex flex-col sticky top-0 z-20 border-b border-slate-800 shadow-2xl">
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
              <h1 className="text-2xl font-black tracking-tight text-white">MCI</h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-0.5 flex items-center gap-1.5">
                {isAdmin ? <><ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> Admin</> : 'Trabajador'} 
              </p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2.5 rounded-xl bg-slate-800/80 backdrop-blur-sm border border-slate-700 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 transition-all active:scale-95 text-slate-300 group"
          >
            <LogOut className="h-5 w-5 group-hover:scale-110 transition-transform" />
          </button>
        </div>

        <div className="relative z-10 flex justify-between items-end">
          <div>
            <p className="text-slate-400 text-sm font-medium mb-1">Bienvenido,</p>
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-100 to-white">{displayGreeting}</h2>
          </div>
          {isAdmin && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors border border-slate-700 shadow-lg"
            >
              <Download className="w-4 h-4" />
              CSV
            </motion.button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto relative pb-28 z-10">
        
        {/* Stats Section */}
        <div className="grid grid-cols-3 gap-3 p-5 border-b border-slate-800/50 bg-slate-900/30 backdrop-blur-sm">
          <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center shadow-lg">
            <span className="text-2xl font-black text-emerald-400 mb-1">{stats.hay}</span>
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Hay</span>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center shadow-lg">
            <span className="text-2xl font-black text-amber-400 mb-1">{stats.porAgotarse}</span>
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 leading-tight">Por<br/>Agotarse</span>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center shadow-lg">
            <span className="text-2xl font-black text-rose-400 mb-1">{stats.agotado}</span>
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Agotado</span>
          </div>
        </div>

        {/* Charts & Urgent Section */}
        <div className="p-5 pb-0 space-y-6">
          {chartData.length > 0 && (
            <div className="bg-slate-900/60 backdrop-blur-xl rounded-3xl shadow-xl border border-slate-800 p-5">
              <h3 className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-widest text-center">Distribución de Inventario</h3>
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
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc', fontWeight: 'bold' }}
                      itemStyle={{ color: '#f8fafc' }}
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
              className="bg-gradient-to-r from-amber-500/20 to-rose-500/20 rounded-3xl shadow-xl border border-rose-500/30 p-5 relative overflow-hidden"
            >
              <div className="flex items-start gap-3">
                <div className="bg-rose-500/20 p-2 rounded-xl mt-1">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">Atención Requerida</h3>
                  <p className="text-sm text-slate-300 font-medium">Hay {urgentMaterials.length} material{urgentMaterials.length > 1 ? 'es' : ''} que requiere{urgentMaterials.length > 1 ? 'n' : ''} reabastecimiento.</p>
                </div>
              </div>
            </motion.div>
          )}

          {isAdmin && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/60 backdrop-blur-xl rounded-3xl shadow-xl border border-slate-800 p-5 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none"></div>
              <h3 className="text-xs font-bold text-slate-300 mb-4 uppercase tracking-widest flex items-center gap-2 relative z-10">
                <Plus className="w-4 h-4 text-blue-400" /> Nuevo Material
              </h3>
              <form onSubmit={handleAddMaterial} className="flex gap-3 relative z-10">
                <input
                  type="text"
                  required
                  placeholder="Ej. Resina Epóxica..."
                  value={newMaterialName}
                  onChange={(e) => setNewMaterialName(e.target.value)}
                  disabled={isAdding}
                  className="flex-1 rounded-2xl bg-slate-950 border border-slate-800 py-3.5 px-4 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm text-[16px] outline-none transition-all font-medium"
                />
                <button
                  type="submit"
                  disabled={isAdding}
                  className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 flex items-center justify-center disabled:opacity-70 active:scale-95 transition-all"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </form>
            </motion.div>
          )}

          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="text"
                placeholder="Buscar en el catálogo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-11 pr-4 py-4 border border-slate-800 rounded-2xl leading-5 bg-slate-900/60 backdrop-blur-xl text-white placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm text-[16px] font-medium outline-none transition-all shadow-lg"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Inventario</h2>
              <span className="text-xs font-bold bg-slate-800 text-slate-300 px-3 py-1 rounded-full border border-slate-700">{filteredMaterials.length}</span>
            </div>

            {materials.length === 0 ? (
              <div className="text-center py-16 px-6 bg-slate-900/40 rounded-3xl border border-slate-800 border-dashed backdrop-blur-sm">
                <Package className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-white font-bold mb-2">Inventario Vacío</h3>
                <p className="text-sm text-slate-400 leading-relaxed font-medium">
                  {isAdmin ? 'Registra tu primer material arriba.' : 'El administrador aún no ha registrado materiales.'}
                </p>
              </div>
            ) : filteredMaterials.length === 0 ? (
              <div className="text-center py-10 px-6 bg-slate-900/40 rounded-3xl border border-slate-800 border-dashed backdrop-blur-sm">
                <Search className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400 font-medium">No se encontraron resultados para "{searchTerm}"</p>
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
                      className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-xl border border-slate-800 overflow-hidden group"
                    >
                      <div className="p-5 flex justify-between items-center border-b border-slate-800/50 bg-slate-800/20">
                        <h3 className="font-extrabold text-lg text-white tracking-tight leading-tight pr-4">
                          {mat.name}
                        </h3>
                        {isAdmin && (
                          <motion.button 
                            whileTap={{ scale: 0.9 }}
                            onClick={() => deleteMaterial(mat.id)}
                            className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 p-2.5 rounded-full transition-colors flex-shrink-0"
                          >
                            <Trash2 className="h-5 w-5" />
                          </motion.button>
                        )}
                      </div>
                      
                      <div className="p-4 bg-slate-950/50">
                        <div className="grid grid-cols-3 gap-3">
                          <motion.button 
                            whileTap={{ scale: 0.95 }}
                            onClick={() => updateStatus(mat.id, 'Hay')}
                            className={`flex flex-col items-center justify-center py-4 px-2 rounded-2xl transition-all ${
                              isHay 
                                ? 'bg-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/10 border border-emerald-500/50' 
                                : 'bg-slate-900 text-slate-500 hover:bg-slate-800 hover:text-slate-400 border border-slate-800 shadow-sm'
                            }`}
                          >
                            <CheckCircle2 className={`h-6 w-6 mb-2 ${isHay ? 'text-emerald-400' : 'text-slate-600'}`} />
                            <span className="text-[10px] font-bold tracking-wider uppercase">HAY</span>
                          </motion.button>
                          
                          <motion.button 
                            whileTap={{ scale: 0.95 }}
                            onClick={() => updateStatus(mat.id, 'Por agotarse')}
                            className={`flex flex-col items-center justify-center py-4 px-2 rounded-2xl transition-all ${
                              isPorAgotarse 
                                ? 'bg-amber-500/20 text-amber-400 shadow-lg shadow-amber-500/10 border border-amber-500/50' 
                                : 'bg-slate-900 text-slate-500 hover:bg-slate-800 hover:text-slate-400 border border-slate-800 shadow-sm'
                            }`}
                          >
                            <AlertTriangle className={`h-6 w-6 mb-2 ${isPorAgotarse ? 'text-amber-400' : 'text-slate-600'}`} />
                            <span className="text-[10px] font-bold tracking-wider text-center leading-tight uppercase">
                              POR<br/>AGOTARSE
                            </span>
                          </motion.button>
                          
                          <motion.button 
                            whileTap={{ scale: 0.95 }}
                            onClick={() => updateStatus(mat.id, 'Agotado')}
                            className={`flex flex-col items-center justify-center py-4 px-2 rounded-2xl transition-all ${
                              isAgotado 
                                ? 'bg-rose-500/20 text-rose-400 shadow-lg shadow-rose-500/10 border border-rose-500/50' 
                                : 'bg-slate-900 text-slate-500 hover:bg-slate-800 hover:text-slate-400 border border-slate-800 shadow-sm'
                            }`}
                          >
                            <XCircle className={`h-6 w-6 mb-2 ${isAgotado ? 'text-rose-400' : 'text-slate-600'}`} />
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
          className="fixed bottom-6 right-4 sm:right-[calc(50%-200px+16px)] bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-full shadow-2xl shadow-blue-600/40 z-30 flex items-center gap-2 group border border-blue-400/30"
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
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
              />
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-700"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                <div className="p-5 flex justify-between items-center border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-500/20 p-2 rounded-xl border border-blue-500/30">
                      <Bot className="h-5 w-5 text-blue-400" />
                    </div>
                    <h3 className="font-bold text-lg text-white">Asistente IA</h3>
                  </div>
                  <button onClick={() => setShowAiModal(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="p-6 min-h-[250px] max-h-[60vh] overflow-y-auto custom-scrollbar">
                  {isAiLoading ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-6 py-12">
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        className="relative"
                      >
                        <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full"></div>
                        <Sparkles className="h-10 w-10 text-blue-400 relative z-10" />
                      </motion.div>
                      <p className="font-medium animate-pulse text-sm tracking-wide">Analizando inventario MCI...</p>
                    </div>
                  ) : (
                    <div className="text-slate-300 leading-relaxed space-y-4 font-medium text-[15px] [&>p]:mb-4 [&>p>strong]:text-white [&>p>strong]:font-bold [&>ul]:list-disc [&>ul]:ml-5 [&>ul]:mb-4">
                      <Markdown>{aiSummary}</Markdown>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}



