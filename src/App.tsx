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
import { LogOut, Plus, Trash2, CheckCircle2, AlertTriangle, XCircle, Package, Layers, ShieldAlert, Download, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
    link.setAttribute("download", `Inventario_Polycovers_${new Date().toLocaleDateString('es-MX').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link); // Required for FF
    link.click();
    document.body.removeChild(link);
  };

  const filteredMaterials = useMemo(() => {
    return materials.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [materials, searchTerm]);

  // Derived user greeting name
  const userName = user?.email?.split('@')[0] || 'Usuario';
  const displayGreeting = userName.charAt(0).toUpperCase() + userName.slice(1).toLowerCase();

  // Stats
  const stats = useMemo(() => {
    return {
      hay: materials.filter(m => m.status === 'Hay').length,
      porAgotarse: materials.filter(m => m.status === 'Por agotarse').length,
      agotado: materials.filter(m => m.status === 'Agotado').length,
    };
  }, [materials]);

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
            className="mx-auto bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-2xl h-24 w-24 flex items-center justify-center mb-6 text-white shadow-2xl"
          >
            <Layers className="h-12 w-12 text-blue-400" />
          </motion.div>
          <h2 className="text-4xl font-extrabold tracking-tight text-white uppercase bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300">
            Polycovers
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
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto shadow-2xl flex flex-col font-sans relative">
      <header className="bg-slate-900 text-white px-5 pt-6 pb-6 flex flex-col sticky top-0 z-20 shadow-xl overflow-hidden">
        {/* Abstract Background Design in Header */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
        
        <div className="flex justify-between items-start mb-6 relative z-10">
          <div className="flex items-center gap-3">
            <motion.div 
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.3 }}
              className="bg-gradient-to-br from-slate-700 to-slate-800 p-2.5 rounded-xl border border-slate-600 shadow-inner"
            >
              <Layers className="h-6 w-6 text-blue-400" />
            </motion.div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">Polycovers</h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-0.5 flex items-center gap-1.5">
                {isAdmin ? <><ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> Admin</> : 'Trabajador'} 
              </p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2.5 rounded-xl bg-slate-800/50 backdrop-blur-sm border border-slate-700 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 transition-all active:scale-95 text-slate-300 group"
          >
            <LogOut className="h-5 w-5 group-hover:scale-110 transition-transform" />
          </button>
        </div>

        <div className="relative z-10 flex justify-between items-end">
          <div>
            <p className="text-slate-400 text-sm font-medium mb-1">Bienvenido de vuelta,</p>
            <h2 className="text-xl font-bold">{displayGreeting}</h2>
          </div>
          {isAdmin && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 hover:text-blue-300 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border border-blue-500/20"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </motion.button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-slate-50 relative pb-28">
        
        {/* Stats Section */}
        <div className="grid grid-cols-3 gap-3 p-5 bg-white border-b border-slate-200">
          <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-100 flex flex-col items-center justify-center text-center shadow-sm">
            <span className="text-2xl font-black text-emerald-600 mb-1">{stats.hay}</span>
            <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-800">Hay</span>
          </div>
          <div className="bg-amber-50 rounded-2xl p-3 border border-amber-100 flex flex-col items-center justify-center text-center shadow-sm">
            <span className="text-2xl font-black text-amber-600 mb-1">{stats.porAgotarse}</span>
            <span className="text-[10px] uppercase tracking-widest font-bold text-amber-800 leading-tight">Por<br/>Agotarse</span>
          </div>
          <div className="bg-rose-50 rounded-2xl p-3 border border-rose-100 flex flex-col items-center justify-center text-center shadow-sm">
            <span className="text-2xl font-black text-rose-600 mb-1">{stats.agotado}</span>
            <span className="text-[10px] uppercase tracking-widest font-bold text-rose-800">Agotado</span>
          </div>
        </div>

        <div className="p-4">
          {isAdmin && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 mb-6"
            >
              <h3 className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2">
                <Plus className="w-4 h-4" /> Registrar Nuevo Material
              </h3>
              <form onSubmit={handleAddMaterial} className="flex gap-3">
                <input
                  type="text"
                  required
                  placeholder="Ej. Resina Epóxica..."
                  value={newMaterialName}
                  onChange={(e) => setNewMaterialName(e.target.value)}
                  disabled={isAdding}
                  className="flex-1 rounded-2xl bg-slate-50 border-0 py-3.5 px-4 text-slate-900 shadow-inner ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm text-[16px] outline-none transition-all font-medium"
                />
                <button
                  type="submit"
                  disabled={isAdding}
                  className="rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white shadow-md hover:bg-slate-800 flex items-center justify-center disabled:opacity-70 active:scale-95 transition-all"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </form>
            </motion.div>
          )}

          <div className="mb-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar material..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-3.5 border-0 rounded-2xl leading-5 bg-white shadow-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm text-[16px] font-medium outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between px-2 mb-2 mt-4">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Catálogo</h2>
              <span className="text-xs font-bold bg-slate-200 text-slate-600 px-3 py-1 rounded-full">{filteredMaterials.length}</span>
            </div>

            {materials.length === 0 ? (
              <div className="text-center py-16 px-6 bg-white rounded-3xl border border-slate-200 border-dashed">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-slate-700 font-bold mb-1">Inventario Vacío</h3>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">
                  {isAdmin ? 'Registra tu primer material arriba.' : 'El administrador aún no ha registrado materiales.'}
                </p>
              </div>
            ) : filteredMaterials.length === 0 ? (
              <div className="text-center py-10 px-6 bg-white rounded-3xl border border-slate-200 border-dashed">
                <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
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
                      className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden group"
                    >
                      <div className="p-5 flex justify-between items-center border-b border-slate-50">
                        <h3 className="font-extrabold text-lg text-slate-800 tracking-tight leading-tight pr-4">
                          {mat.name}
                        </h3>
                        {isAdmin && (
                          <motion.button 
                            whileTap={{ scale: 0.9 }}
                            onClick={() => deleteMaterial(mat.id)}
                            className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2.5 rounded-full transition-colors flex-shrink-0"
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
                            className={`flex flex-col items-center justify-center py-4 px-2 rounded-2xl transition-all ${
                              isHay 
                                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-500 ring-offset-1' 
                                : 'bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-600 border border-slate-200 shadow-sm'
                            }`}
                          >
                            <CheckCircle2 className={`h-6 w-6 mb-1.5 ${isHay ? 'text-white' : 'text-slate-400'}`} />
                            <span className="text-xs font-bold tracking-wider uppercase">HAY</span>
                          </motion.button>
                          
                          <motion.button 
                            whileTap={{ scale: 0.95 }}
                            onClick={() => updateStatus(mat.id, 'Por agotarse')}
                            className={`flex flex-col items-center justify-center py-4 px-2 rounded-2xl transition-all ${
                              isPorAgotarse 
                                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30 ring-2 ring-amber-500 ring-offset-1' 
                                : 'bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-600 border border-slate-200 shadow-sm'
                            }`}
                          >
                            <AlertTriangle className={`h-6 w-6 mb-1.5 ${isPorAgotarse ? 'text-white' : 'text-slate-400'}`} />
                            <span className="text-[10px] font-bold tracking-wider text-center leading-tight uppercase">
                              POR<br/>AGOTARSE
                            </span>
                          </motion.button>
                          
                          <motion.button 
                            whileTap={{ scale: 0.95 }}
                            onClick={() => updateStatus(mat.id, 'Agotado')}
                            className={`flex flex-col items-center justify-center py-4 px-2 rounded-2xl transition-all ${
                              isAgotado 
                                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 ring-2 ring-rose-500 ring-offset-1' 
                                : 'bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-600 border border-slate-200 shadow-sm'
                            }`}
                          >
                            <XCircle className={`h-6 w-6 mb-1.5 ${isAgotado ? 'text-white' : 'text-slate-400'}`} />
                            <span className="text-xs font-bold tracking-wider uppercase">AGOTADO</span>
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
      </main>
    </div>
  );
}



