/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
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
import { LogOut, Plus, Trash2, CheckCircle2, AlertTriangle, XCircle, Package, Layers, ShieldAlert } from 'lucide-react';

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
  const [showRulesAlert, setShowRulesAlert] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      // Determine if user is admin based on email
      const adminStatus = currentUser?.email?.toLowerCase().includes('admin') || false;
      setIsAdmin(adminStatus);
      if (adminStatus) {
        setShowRulesAlert(true);
      }
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

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="mx-auto bg-slate-800 border border-slate-700 rounded-2xl h-20 w-20 flex items-center justify-center mb-6 text-white shadow-2xl">
            <Layers className="h-10 w-10 text-slate-200" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white uppercase">
            Polycovers
          </h2>
          <p className="mt-2 text-sm text-slate-400 uppercase tracking-widest font-semibold">
            Control de Inventario
          </p>
        </div>

        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[400px]">
          <div className="bg-slate-800 px-6 py-10 shadow-2xl sm:rounded-3xl sm:px-12 mx-4 border border-slate-700">
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
                    className="block w-full rounded-xl border-0 bg-slate-900 py-3.5 px-4 text-white shadow-inner ring-1 ring-inset ring-slate-700 placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6 text-[16px] outline-none transition-all"
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
                    className="block w-full rounded-xl border-0 bg-slate-900 py-3.5 px-4 text-white shadow-inner ring-1 ring-inset ring-slate-700 placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6 text-[16px] outline-none transition-all"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="flex w-full justify-center rounded-xl bg-blue-600 px-3 py-4 text-sm font-bold uppercase tracking-wider text-white shadow-lg hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-70 transition-all active:scale-[0.98]"
                >
                  {isLoggingIn ? 'Iniciando...' : 'Acceder al Sistema'}
                </button>
              </div>
              
              {loginError && (
                <div className="rounded-lg bg-red-900/50 p-3 mt-4 border border-red-500/30">
                  <p className="text-red-400 text-sm text-center font-medium">
                    {loginError}
                  </p>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 max-w-md mx-auto shadow-2xl flex flex-col font-sans relative">
      <header className="bg-slate-900 text-white px-5 py-5 flex justify-between items-center sticky top-0 z-20 border-b border-slate-800 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-slate-800 p-2 rounded-lg border border-slate-700">
            <Layers className="h-6 w-6 text-slate-200" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Polycovers</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mt-0.5 flex items-center gap-1">
              {isAdmin ? <><ShieldAlert className="w-3 h-3 text-amber-400" /> Admin</> : 'Trabajador'} 
              <span className="opacity-50">|</span> {user.email}
            </p>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors active:scale-95 text-slate-300"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-28">
        
        {isAdmin && showRulesAlert && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
            <div className="flex gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-900">Aviso de Seguridad</h4>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  Para garantizar que <b>solo administradores</b> puedan agregar o borrar materiales, debes configurar las <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="underline font-semibold">Reglas de Firestore</a> en tu consola de Firebase. Revisa el chat para ver las reglas.
                </p>
                <button onClick={() => setShowRulesAlert(false)} className="mt-3 text-xs font-semibold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-lg hover:bg-amber-200 transition-colors">
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 mb-6">
            <h3 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-widest flex items-center gap-2">
              <Plus className="w-4 h-4" /> Registrar Material
            </h3>
            <form onSubmit={handleAddMaterial} className="flex gap-3">
              <input
                type="text"
                required
                placeholder="Ej. Resina Epóxica..."
                value={newMaterialName}
                onChange={(e) => setNewMaterialName(e.target.value)}
                disabled={isAdding}
                className="flex-1 rounded-2xl bg-slate-50 border-0 py-3.5 px-4 text-slate-900 shadow-inner ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-slate-900 sm:text-sm text-[16px] outline-none transition-all font-medium"
              />
              <button
                type="submit"
                disabled={isAdding}
                className="rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white shadow-md hover:bg-slate-800 flex items-center justify-center disabled:opacity-70 active:scale-95 transition-all"
              >
                <Plus className="h-5 w-5" />
              </button>
            </form>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1 mb-2 mt-8">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Inventario Actual</h2>
            <span className="text-xs font-semibold bg-slate-200 text-slate-600 px-2.5 py-1 rounded-full">{materials.length}</span>
          </div>

          {materials.length === 0 ? (
            <div className="text-center py-16 px-6 bg-white rounded-3xl border border-slate-200 border-dashed">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-slate-700 font-semibold mb-1">Inventario Vacío</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                {isAdmin ? 'Agrega materiales usando el formulario de arriba.' : 'Esperando a que el administrador agregue materiales.'}
              </p>
            </div>
          ) : (
            materials.map((mat) => {
              const isHay = mat.status === 'Hay';
              const isPorAgotarse = mat.status === 'Por agotarse';
              const isAgotado = mat.status === 'Agotado';

              return (
                <div key={mat.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden group">
                  <div className="p-5 flex justify-between items-center border-b border-slate-100">
                    <h3 className="font-bold text-lg text-slate-800 tracking-tight leading-tight pr-4">
                      {mat.name}
                    </h3>
                    {isAdmin && (
                      <button 
                        onClick={() => deleteMaterial(mat.id)}
                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2.5 rounded-full transition-all active:scale-90 flex-shrink-0"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                  
                  <div className="p-4 bg-slate-50/50">
                    <div className="grid grid-cols-3 gap-3">
                      <button 
                        onClick={() => updateStatus(mat.id, 'Hay')}
                        className={`flex flex-col items-center justify-center py-4 px-2 rounded-2xl transition-all active:scale-95 ${
                          isHay 
                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                            : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200 shadow-sm'
                        }`}
                      >
                        <CheckCircle2 className={`h-6 w-6 mb-1.5 ${isHay ? 'text-white' : 'text-slate-400'}`} />
                        <span className="text-xs font-bold tracking-wide">HAY</span>
                      </button>
                      
                      <button 
                        onClick={() => updateStatus(mat.id, 'Por agotarse')}
                        className={`flex flex-col items-center justify-center py-4 px-2 rounded-2xl transition-all active:scale-95 ${
                          isPorAgotarse 
                            ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' 
                            : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200 shadow-sm'
                        }`}
                      >
                        <AlertTriangle className={`h-6 w-6 mb-1.5 ${isPorAgotarse ? 'text-white' : 'text-slate-400'}`} />
                        <span className="text-[11px] font-bold tracking-wide text-center leading-none">
                          POR<br/><span className="mt-0.5 inline-block">AGOTARSE</span>
                        </span>
                      </button>
                      
                      <button 
                        onClick={() => updateStatus(mat.id, 'Agotado')}
                        className={`flex flex-col items-center justify-center py-4 px-2 rounded-2xl transition-all active:scale-95 ${
                          isAgotado 
                            ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20' 
                            : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200 shadow-sm'
                        }`}
                      >
                        <XCircle className={`h-6 w-6 mb-1.5 ${isAgotado ? 'text-white' : 'text-slate-400'}`} />
                        <span className="text-xs font-bold tracking-wide">AGOTADO</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}


