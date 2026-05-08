import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Play, Square, PauseCircle, LogOut, CheckCircle2, UserCircle, Users, RefreshCcw, Plus, Calendar, FileText, ClipboardList, ShieldAlert, Bell, Menu, X, Activity, WifiOff, Coffee, Monitor, LayoutGrid, MoveRight, MapPin, AlertTriangle, Package, ShieldCheck, ChevronRight, Camera, Key, Home, BarChart2, Megaphone, History } from 'lucide-react';
import { db, auth, OperationType, handleFirestoreError } from './lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  addDoc, 
  setDoc, 
  doc, 
  getDocs, 
  getDoc,
  updateDoc,
  where,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signInAnonymously,
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// -- Custom Hooks --

function useStickyState<T>(defaultValue: T, key: string) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stickyValue = window.localStorage.getItem(key);
      return stickyValue !== null ? JSON.parse(stickyValue) : defaultValue;
    } catch {
      return defaultValue;
    }
  });
  
  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  
  return [value, setValue] as const;
}

function useCurrentTime() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return time;
}

function getArgentinaDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}

function formatDuration(startTimeIso: string | null) {
  if (!startTimeIso) return '00:00:00';
  const start = new Date(startTimeIso).getTime();
  const now = new Date().getTime();
  const diff = Math.max(0, Math.floor((now - start) / 1000));
  
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// -- Interfaces --

interface TareaPlan {
  id: string | number;
  titulo: string;
  frecuencia: string;
  descripcion?: string;
  fecha_vencimiento?: string;
  requiere_foto?: boolean;
  tipoLimpieza?: 'Mantenimiento' | 'Intermedia' | 'Detalles';
}

interface Insumo {
  id: string;
  nombre: string;
  stock: number;
  unidad: string;
  critico: boolean;
}

interface Incidencia {
  id: string;
  autor: string;
  tipo: 'Rotura' | 'Falta de Insumo' | 'Urgencia' | 'Otro';
  descripcion: string;
  foto?: string;
  fecha: string;
}

interface Turno {
  id: string;
  operarioId: string;
  operarioNombre: string;
  ubicacion: string;
  inicioEstimado: string;
  finEstimado: string;
  estado: 'Pendiente' | 'Presente' | 'Ausente' | 'Atrasado';
  reemplazoId?: string;
  reemplazoNombre?: string;
  tareasAsignadas?: string[]; // IDs from Limpieza_Tareas_Plan
}

const INCIDENCIAS_MOCK: Incidencia[] = [
  { id: '1', autor: 'Juan Perez', tipo: 'Rotura', descripcion: 'Picaporte roto en baño piso 2', fecha: new Date(Date.now() - 86400000).toISOString() },
  { id: '2', autor: 'Maria Garcia', tipo: 'Falta de Insumo', descripcion: 'No hay papel higiénico en el depósito central', fecha: new Date(Date.now() - 172800000).toISOString() },
  { id: '3', autor: 'Carlos Lopez', tipo: 'Urgencia', descripcion: 'Inundación por cañería rota en cocina', fecha: new Date(Date.now() - 3600).toISOString() },
];

function SupervisorIncidentsLog() {
  const [filter, setFilter] = useState<'Todas' | 'Rotura' | 'Falta de Insumo' | 'Urgencia'>('Todas');
  const [incidencias, setIncidencias] = useState<any[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'incidents'), orderBy('fecha', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setIncidencias(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'incidents');
    });
    return () => unsubscribe();
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'incidents', id), { estado: newStatus });
      if (selectedIncident?.id === id) {
        setSelectedIncident((prev: any) => ({ ...prev, estado: newStatus }));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `incidents/${id}`);
    }
  };

  const filtered = incidencias.filter(i => filter === 'Todas' || i.tipo === filter);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Gestión de Tickets e Incidencias</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Seguimiento y Resolución</p>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
          {['Todas', 'Rotura', 'Falta de Insumo', 'Urgencia'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                filter === f ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
          {filtered.map((inc) => (
            <div 
              key={inc.id} 
              onClick={() => setSelectedIncident(inc)}
              className={cn(
                "p-5 rounded-[24px] border transition-all cursor-pointer hover:shadow-md",
                selectedIncident?.id === inc.id ? "bg-white border-blue-200 shadow-lg" : "bg-white border-slate-100",
                inc.urgencia === 'Alta' ? "border-l-4 border-l-rose-500" : inc.urgencia === 'Media' ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-blue-500"
              )}
            >
              <div className="flex justify-between items-start mb-3">
                <span className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                  inc.estado === 'Abierto' || !inc.estado ? "bg-rose-50 text-rose-600" : inc.estado === 'En Proceso' ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                )}>
                  {inc.estado || 'Abierto'}
                </span>
                <span className="text-[10px] text-slate-400 font-bold">{new Date(inc.fecha).toLocaleDateString()}</span>
              </div>
              <h4 className="font-bold text-slate-800 mb-1">{inc.tipo}</h4>
              <p className="text-xs text-slate-500 line-clamp-2 mb-3">{inc.descripcion}</p>
              <div className="flex items-center gap-2 mt-auto pt-3 border-t border-slate-50">
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase">
                  {inc.autor?.[0]}
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{inc.autor}</span>
                {inc.urgencia === 'Alta' && (
                  <span className="ml-auto text-[9px] font-black text-rose-500 uppercase animate-pulse">¡Prioridad Alta!</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-[32px] border border-slate-100 p-8 shadow-sm h-fit sticky top-24">
          {selectedIncident ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={selectedIncident.id}>
              <div className="flex items-center gap-4 mb-6">
                <div className={cn(
                  "p-3 rounded-2xl",
                  selectedIncident.urgencia === 'Alta' ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"
                )}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 leading-none mb-1">{selectedIncident.tipo}</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Reportado por {selectedIncident.autor}</p>
                </div>
              </div>
              
              <div className="bg-slate-50 rounded-2xl p-4 mb-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 underline decoration-blue-200">Detalle del Reporte</p>
                <p className="text-sm text-slate-700 leading-relaxed">{selectedIncident.descripcion}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-8">
                <button 
                  onClick={() => updateStatus(selectedIncident.id, 'Abierto')}
                  className={cn("py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all", (selectedIncident.estado === 'Abierto' || !selectedIncident.estado) ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-white border-slate-100 text-slate-400")}
                >
                  Abierto
                </button>
                <button 
                  onClick={() => updateStatus(selectedIncident.id, 'En Proceso')}
                  className={cn("py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all", selectedIncident.estado === 'En Proceso' ? "bg-blue-50 border-blue-200 text-blue-600" : "bg-white border-slate-100 text-slate-400")}
                >
                  En Proceso
                </button>
                <button 
                  onClick={() => updateStatus(selectedIncident.id, 'Resuelto')}
                  className={cn("py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all", selectedIncident.estado === 'Resuelto' ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-white border-slate-100 text-slate-400")}
                >
                  Resuelto
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Acciones del Supervisor</p>
                <button 
                  onClick={() => alert(`Tarea asignada para resolver ${selectedIncident.tipo}`)}
                  className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-all"
                >
                  Asignar Operario
                </button>
                <button 
                  onClick={() => alert(`Notificación masiva enviada sobre: ${selectedIncident.tipo}`)}
                  className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-50 transition-all"
                >
                  Notificar a todos
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-300 gap-4 opacity-50">
              <Megaphone className="w-16 h-16" />
              <p className="text-sm font-bold uppercase tracking-widest text-center">Selecciona un reporte<br/>para gestionar el ticket</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SupervisorProductivityStats({ registros, operarios, tasks }: { registros: any[], operarios: any[], tasks: any[] }) {
  const stats = React.useMemo(() => {
    const operarioStats: Record<string, { completed: number, totalTime: number }> = {};
    
    // Initialize
    operarios.forEach(op => {
      operarioStats[op.nombre] = { completed: 0, totalTime: 0 };
    });

    const completedTasks = registros.filter(r => r.accion?.includes('Tarea:') && r.fin);
    
    completedTasks.forEach(r => {
      if (operarioStats[r.operario]) {
        operarioStats[r.operario].completed += 1;
        operarioStats[r.operario].totalTime += (r.duracion_minutos || 0);
      }
    });

    const chartData = Object.entries(operarioStats).map(([name, data]) => ({
      name,
      tasks: data.completed,
      avgTime: data.completed > 0 ? Math.round(data.totalTime / data.completed) : 0
    })).filter(d => d.tasks > 0 || operarios.length < 10);

    const totalCompleted = completedTasks.length;
    const planCount = tasks.length || 1;
    const compliance = Math.min(100, Math.round((totalCompleted / planCount) * 100));

    return { chartData, totalCompleted, compliance };
  }, [registros, operarios, tasks]);

  const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard 
          title="Tareas Completadas" 
          value={stats.totalCompleted} 
          icon={<CheckCircle2 className="w-6 h-6 text-emerald-500" />} 
          trend="+12%"
          sub="Total en el periodo seleccionado"
        />
        <KPICard 
          title="Tasa de Cumplimiento" 
          value={`${stats.compliance}%`} 
          icon={<Activity className="w-6 h-6 text-blue-500" />} 
          trend={stats.compliance > 80 ? "Óptimo" : "Atención"}
          sub={`vs ${tasks.length} tareas planificadas`}
        />
        <KPICard 
          title="Productividad Media" 
          value={stats.chartData.length > 0 ? `${Math.round(stats.chartData.reduce((acc, curr) => acc + curr.avgTime, 0) / stats.chartData.length)}m` : '0m'} 
          icon={<Clock className="w-6 h-6 text-amber-500" />} 
          sub="Tiempo promedio por tarea"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
          <h3 className="text-sm font-black text-slate-400 mb-6 uppercase tracking-widest px-2">Tareas por Operario</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                />
                <Bar dataKey="tasks" name="Tareas" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
          <h3 className="text-sm font-black text-slate-400 mb-6 uppercase tracking-widest px-2">Tiempo Promedio (Minutos)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                />
                <Bar dataKey="avgTime" name="Minutos" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function SupervisorAnnouncements() {
  const [msg, setMsg] = useState('');
  const [history, setHistory] = useState<any[]>([]);

  const sendAnnouncement = async () => {
    if (!msg.trim()) return;
    const item = { text: msg.trim(), date: new Date().toISOString(), createdAt: serverTimestamp() };
    
    try {
      await addDoc(collection(db, 'announcements'), item);
      setMsg('');
      alert("Comunicado enviado a todo el personal.");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'announcements');
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistory(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'announcements');
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="bg-white p-8 rounded-[32px] border border-blue-100 shadow-xl shadow-blue-50/50">
        <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-3">
          <Megaphone className="w-6 h-6 text-blue-500" /> Nuevo Comunicado
        </h3>
        <p className="text-xs text-slate-400 font-bold mb-4 uppercase tracking-widest">Este mensaje llegará a la pantalla principal de todos los operarios.</p>
        <textarea 
          value={msg}
          onChange={e => setMsg(e.target.value)}
          placeholder="Escribe el anuncio para el personal..."
          className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none min-h-[150px] mb-4 focus:border-blue-400"
        />
        <button 
          onClick={sendAnnouncement}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 active:scale-[0.98] transition-all"
        >
          ENVIAR A TODOS
        </button>
      </div>

      <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col">
        <h3 className="text-sm font-black text-slate-400 mb-6 uppercase tracking-widest">Historial de Comunicación</h3>
        <div className="space-y-4 overflow-y-auto max-h-[400px] pr-2">
          {history.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center opacity-30 py-10">
               <History className="w-12 h-12 mb-2" />
               <p className="text-xs font-bold uppercase tracking-widest">Sin historial</p>
             </div>
          ) : (
            history.map(h => (
              <div key={h.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl relative group">
                <p className="text-xs text-slate-700 leading-relaxed font-medium mb-2">{h.text}</p>
                <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  <span>{new Date(h.date).toLocaleDateString()}</span>
                  <span>{new Date(h.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const TURNOS_MOCK: Turno[] = [
  { id: 't1', operarioId: '1', operarioNombre: 'Juan Perez', ubicacion: 'Oficinas Centrales', inicioEstimado: new Date(Date.now() - 3600000).toISOString(), finEstimado: new Date(Date.now() + 7200000).toISOString(), estado: 'Presente', tareasAsignadas: ['1', '2'] },
  { id: 't2', operarioId: '2', operarioNombre: 'Maria Garcia', ubicacion: 'Deposito Sur', inicioEstimado: new Date(Date.now() - 600000).toISOString(), finEstimado: new Date(Date.now() + 14400000).toISOString(), estado: 'Pendiente', tareasAsignadas: [] },
  { id: 't3', operarioId: '3', operarioNombre: 'Carlos Lopez', ubicacion: 'Sucursal Norte', inicioEstimado: new Date(Date.now() - 1800000).toISOString(), finEstimado: new Date(Date.now() + 10800000).toISOString(), estado: 'Atrasado', tareasAsignadas: [] },
];

function SupervisorShiftManager() {
  const [turnos, setTurnos] = useState<Turno[]>(TURNOS_MOCK);
  const [loading, setLoading] = useState(false);
  const [alertas, setAlertas] = useState<string[]>([]);
  const [catTareas, setCatTareas] = useState<any[]>([]);

  useEffect(() => {
    const fetchTareas = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'tasks'));
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCatTareas(data);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'tasks');
      }
    };
    fetchTareas();
  }, []);
  useEffect(() => {
    // Simulamos verificación de alertas automáticas
    const checkAlerts = () => {
      const now = new Date();
      const nuevosAtrasados = turnos.map(t => {
        if (t.estado === 'Pendiente') {
          const inicio = new Date(t.inicioEstimado);
          const diffMinutes = (now.getTime() - inicio.getTime()) / 60000;
          if (diffMinutes > 15) {
            return { ...t, estado: 'Atrasado' as const };
          }
        }
        return t;
      });

      const alertsEncontradas = nuevosAtrasados.filter(t => t.estado === 'Atrasado').map(t => `¡ALERTA!: ${t.operarioNombre} no ha marcado entrada en ${t.ubicacion} (Turno: ${new Date(t.inicioEstimado).toLocaleTimeString()})`);
      
      setAlertas(alertsEncontradas);
      setTurnos(nuevosAtrasados);
    };

    const interval = setInterval(checkAlerts, 10000);
    checkAlerts(); // Ejecución inicial
    return () => clearInterval(interval);
  }, [turnos.length]);

  const asignarReemplazo = (turnoId: string) => {
    const reemplazo = prompt("Ingrese el nombre del operario de reemplazo:");
    if (!reemplazo) return;

    setTurnos(prev => prev.map(t => t.id === turnoId ? { ...t, estado: 'Presente', reemplazoNombre: reemplazo } : t));
    alert(`Reemplazo asignado: ${reemplazo}`);
  };

  const asignarTarea = (turnoId: string) => {
    const tareaId = prompt("Lista de IDs de tareas disponibles: " + catTareas.map(ct => `${ct.id}: ${ct.titulo}`).join(", "));
    if (!tareaId) return;

    const exists = catTareas.find(t => t.id === tareaId);
    if (!exists) {
      alert("ID de tarea no válido");
      return;
    }

    setTurnos(prev => prev.map(t => {
      if (t.id === turnoId) {
        const current = t.tareasAsignadas || [];
        if (current.includes(tareaId)) return t;
        return { ...t, tareasAsignadas: [...current, tareaId] };
      }
      return t;
    }));
  };

  return (
    <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col p-6 w-full max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="font-bold text-xl text-slate-800 tracking-tight">Control de Asistencia</h3>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-0.5">Gestión de Turnos y Reemplazos</p>
        </div>
        <div className="flex items-center gap-2">
           <div className="flex items-center gap-1 text-[10px] font-black uppercase text-rose-500 bg-rose-50 px-3 py-1 rounded-full border border-rose-100 animate-pulse">
             <AlertTriangle className="w-3 h-3" /> Monitoreo GPS Activo
           </div>
        </div>
      </div>

      <AnimatePresence>
        {alertas.length > 0 && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-6 space-y-2 overflow-hidden"
          >
            {alertas.map((alerta, i) => (
              <div key={i} className="bg-rose-600 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-6 h-6 animate-bounce" />
                  <p className="text-sm font-black uppercase tracking-tight">{alerta}</p>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Turnos de Hoy</h4>
        {turnos.map(t => (
          <div key={t.id} className={cn(
            "p-5 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4",
            t.estado === 'Atrasado' ? "bg-rose-50 border-rose-200 shadow-rose-100" : "bg-white border-slate-100 hover:border-blue-200"
          )}>
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center text-white",
                t.estado === 'Presente' ? "bg-emerald-500" : t.estado === 'Atrasado' ? "bg-rose-500" : "bg-slate-300"
              )}>
                {t.estado === 'Presente' ? <CheckCircle2 className="w-8 h-8" /> : t.estado === 'Atrasado' ? <AlertTriangle className="w-8 h-8" /> : <Clock className="w-8 h-8" />}
              </div>
              <div>
                <h5 className="font-black text-slate-800">{t.operarioNombre}</h5>
                <p className="text-xs text-slate-500 font-bold">{t.ubicacion}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-[10px] font-black uppercase text-slate-400">{new Date(t.inicioEstimado).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(t.finEstimado).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {t.reemplazoNombre && <span className="text-[9px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">REEMPLAZO: {t.reemplazoNombre}</span>}
                  
                  {t.tareasAsignadas && t.tareasAsignadas.length > 0 && (
                    <div className="flex gap-1 ml-2">
                       {t.tareasAsignadas.map(tid => {
                         const match = catTareas.find(c => c.id === tid);
                         return (
                           <span key={tid} className="text-[8px] font-black bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-100">
                             {match ? match.titulo : tid}
                           </span>
                         );
                       })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => asignarTarea(t.id)}
                className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                title="Asignar Tarea Específica"
              >
                <Plus className="w-5 h-5" />
              </button>
              <div className={cn(
                "px-3 py-1 rounded-full text-[10px] font-black uppercase",
                t.estado === 'Presente' ? "bg-emerald-50 text-emerald-600" : t.estado === 'Atrasado' ? "bg-rose-100 text-rose-600 animate-pulse" : "bg-slate-100 text-slate-500"
              )}>
                {t.estado}
              </div>
              {t.estado === 'Atrasado' && (
                <button 
                  onClick={() => asignarReemplazo(t.id)}
                  className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                >
                  Asignar Relevo
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Insumo {
  id: string;
  nombre: string;
  stock: number;
  unidad: string;
  critico: boolean;
  imagen?: string;
  consumoNormal?: number;
}

interface PedidoInsumo {
  id: string;
  operarioNombre: string;
  insumoNombre: string;
  cantidad: number;
  fecha: string;
  estado: 'Pendiente' | 'Aprobado' | 'Rechazado';
  alertaConsumo?: boolean;
}

const INSUMOS_MOCK: Insumo[] = [
  { id: '1', nombre: 'Lavandina Concentrada', stock: 5, unidad: 'L', critico: true, imagen: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=100&h=100&fit=crop', consumoNormal: 2 },
  { id: '2', nombre: 'Limpiador de Pisos', stock: 2, unidad: 'L', critico: false, imagen: 'https://images.unsplash.com/photo-1563453392212-326f55821173?w=100&h=100&fit=crop', consumoNormal: 2 },
  { id: '3', nombre: 'Papel Higiénico 30m', stock: 12, unidad: 'Rollos', critico: true, imagen: 'https://images.unsplash.com/photo-1584622781564-1d9876a13d00?w=100&h=100&fit=crop', consumoNormal: 10 },
  { id: '4', nombre: 'Bolsas de Consorcio', stock: 50, unidad: 'U', critico: false, imagen: 'https://images.unsplash.com/photo-1610691023059-59eb19fed992?w=100&h=100&fit=crop', consumoNormal: 20 },
];

interface Operario {
  id?: string;
  nombre: string;
  usuario?: string;
  pin?: string;
  rol: 'operario' | 'supervisor';
  email?: string;
  whatsapp?: string;
  activo?: boolean;
}

// -- Components for New Modules --

function InsumosModule({ user }: { user: Operario }) {
  const [insumos, setInsumos] = useState(INSUMOS_MOCK);
  const [requesting, setRequesting] = useState<string|null>(null);
  const [showStockReport, setShowStockReport] = useState(false);
  
  // Check if today is Friday for stock report reminder
  const isFriday = new Date().getDay() === 5;

  const handleRequest = (name: string, quantity: number, normal: number) => {
    setRequesting(name);
    
    const pedido = {
      id: Date.now().toString(),
      operarioNombre: user.nombre,
      insumoNombre: name,
      cantidad: quantity,
      fecha: new Date().toISOString(),
      estado: 'Pendiente',
      alertaConsumo: quantity > normal
    };

    const savedRequests = JSON.parse(localStorage.getItem('pending_insumos') || '[]');
    localStorage.setItem('pending_insumos', JSON.stringify([...savedRequests, pedido]));

    setTimeout(() => {
      setRequesting(null);
      alert(`Solicitud de ${quantity}x ${name} enviada para aprobación del supervisor.`);
    }, 1000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-lg font-black text-slate-800 tracking-tight leading-none mb-1">Insumos en Sitio</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Catálogo Visual y Pedidos</p>
        </div>
        <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl">
          <Package className="w-6 h-6" />
        </div>
      </div>

      {isFriday && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl mb-2 flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-emerald-800 uppercase tracking-widest">¡Es Viernes!</p>
            <p className="text-[10px] text-emerald-600 font-bold">Reporte de stock semanal obligatorio.</p>
          </div>
          <button 
            onClick={() => setShowStockReport(true)}
            className="bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase shadow-sm"
          >
            REPORTAR
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {insumos.map(item => (
          <div key={item.id} className="bg-white border border-slate-100 rounded-3xl p-3 shadow-sm flex flex-col gap-3 relative overflow-hidden group">
            <div className="w-full h-24 bg-slate-50 rounded-2xl overflow-hidden relative">
              <img src={item.imagen} alt={item.nombre} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute top-2 right-2 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-[9px] font-black text-slate-800 border border-slate-100 shadow-sm">
                STOCK: {item.stock}
              </div>
            </div>
            <div className="px-1">
              <h4 className="text-xs font-black text-slate-800 truncate leading-tight mb-1">{item.nombre}</h4>
              <p className="text-[9px] text-slate-400 font-bold uppercase">{item.unidad}</p>
            </div>
            <button 
              onClick={() => {
                const qty = prompt(`¿Cuántos ${item.unidad} de ${item.nombre} necesitas?`, "1");
                if (qty && !isNaN(Number(qty))) {
                  handleRequest(item.nombre, Number(qty), item.consumoNormal || 2);
                }
              }}
              disabled={!!requesting}
              className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95"
            >
              {requesting === item.nombre ? <RefreshCcw className="w-3 h-3 animate-spin" /> : "PEDIR"}
            </button>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showStockReport && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: 100 }} 
              animate={{ y: 0 }}
              className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-slate-800 tracking-tight">Reporte Stock Semanal</h3>
                <button onClick={() => setShowStockReport(false)} className="p-2 bg-slate-100 rounded-full"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-4 mb-6 max-h-[40vh] overflow-y-auto px-1">
                {insumos.map(i => (
                  <div key={i.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                    <span className="text-xs font-bold text-slate-700">{i.nombre}</span>
                    <input type="number" placeholder="Queda..." className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold outline-none text-right" />
                  </div>
                ))}
              </div>
              <button 
                onClick={() => { alert("Reporte de stock enviado."); setShowStockReport(false); }}
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-100"
              >
                ENVIAR REPORTE
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1 flex items-center gap-1">
          <ShieldAlert className="w-3 h-3" /> Aviso de Supervisor
        </p>
        <p className="text-xs text-amber-700 italic">"Los pedidos realizados antes de las 10:00 se entregan el mismo día."</p>
      </div>
    </motion.div>
  );
}

function CapacitacionModule() {
  const manuals = [
    { title: 'Uso de Químicos Arevalo v2', type: 'PDF', icon: FileText, color: 'text-blue-500' },
    { title: 'Protocolo de Baños en Oficinas', type: 'Video', icon: Play, color: 'text-emerald-500' },
    { title: 'Seguridad y Salud (SST)', type: 'Tutorial', icon: ShieldCheck, color: 'text-rose-500' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-black text-slate-800 tracking-tight leading-none mb-1">Capacitación</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Manuales y Procedimientos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {manuals.map((m, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all cursor-pointer group">
            <div className={cn("w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center group-hover:scale-110 transition-transform", m.color)}>
              <m.icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-black text-slate-800">{m.title}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{m.type}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300" />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function RRHHModule() {
  const [signed, setSigned] = useState(false);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-800 tracking-tight leading-none mb-1">RRHH Arevalo</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nómina y Beneficios</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-600 rounded-3xl p-5 text-white shadow-xl shadow-blue-100">
          <Calendar className="w-6 h-6 mb-3" />
          <p className="text-2xl font-black leading-none mb-1">12</p>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Días Vacaciones</p>
        </div>
        <div className="bg-emerald-500 rounded-3xl p-5 text-white shadow-xl shadow-emerald-100">
          <FileText className="w-6 h-6 mb-3" />
          <p className="text-2xl font-black leading-none mb-1">0</p>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Pendientes</p>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Recibos de Sueldo</h4>
        {[
          { month: 'Abril 2025', status: 'Pendiente Firma' },
          { month: 'Marzo 2025', status: 'Recibido' },
        ].map((r, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-800">{r.month}</p>
              <p className={cn("text-[9px] font-black uppercase tracking-widest", r.status === 'Recibido' ? 'text-emerald-500' : 'text-rose-500')}>
                {r.status === 'Pendiente Firma' && signed ? 'Firmado' : r.status}
              </p>
            </div>
            {r.status === 'Pendiente Firma' && !signed ? (
              <button 
                onClick={() => {
                   if (confirm("¿Confirmas la firma del recibo mediante token digital?")) {
                     setSigned(true);
                   }
                }}
                className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase"
              >
                Firmar
              </button>
            ) : (
              <button className="text-blue-500 p-2 hover:bg-blue-50 rounded-xl transition-all">
                <FileText className="w-5 h-5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function IncidenciasModule({ user, onReported }: { user: Operario, onReported: () => void }) {
  const [desc, setDesc] = useState('');
  const [tipo, setTipo] = useState<'Rotura' | 'Falta de Insumo' | 'Urgencia' | 'Otro'>('Rotura');
  const [urgencia, setUrgencia] = useState<'Baja' | 'Media' | 'Alta'>('Media');
  const [isPhotoed, setIsPhotoed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showShareModal, setShowShareModal] = useState<{ id: string, content: string } | null>(null);

  const handleReport = async () => {
    if (!desc) return;
    setLoading(true);
    
    const nuevaIncidencia = {
      operarioId: user.id || 'unknown',
      autor: user.nombre,
      tipo,
      urgencia,
      descripcion: desc,
      fecha: new Date().toISOString(),
      estado: 'Abierto',
      createdAt: serverTimestamp()
    };

    try {
      const docRef = await addDoc(collection(db, 'incidents'), nuevaIncidencia);
      setLoading(false);
      
      const shareContent = `*Reporte de Incidencia*\n📌 *Tipo:* ${tipo}\n🚨 *Urgencia:* ${urgencia}\n👤 *Autor:* ${user.nombre}\n📝 *Descripción:* ${desc}`;
      setShowShareModal({ id: docRef.id, content: shareContent });
    } catch (error) {
      console.error("Error reporting incident:", error);
      handleFirestoreError(error, OperationType.CREATE, 'incidents');
      setLoading(false);
    }
  };

  const shareViaWhatsApp = () => {
    if (!showShareModal) return;
    const url = `https://wa.me/?text=${encodeURIComponent(showShareModal.content)}`;
    window.open(url, '_blank');
    setShowShareModal(null);
    onReported();
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white border-2 border-rose-100 rounded-[32px] p-6 shadow-2xl shadow-rose-50 mb-10 overflow-hidden">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-rose-200">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-800 tracking-tight leading-none mb-1">Nueva Incidencia</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reporte Directo al Supervisor</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Evento</label>
            <select 
              value={tipo}
              onChange={e => setTipo(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-3 text-xs font-bold outline-none"
            >
              <option value="Rotura">Rotura 🛠️</option>
              <option value="Falta de Insumo">Falta Insumo 📦</option>
              <option value="Urgencia">Urgencia 🚨</option>
              <option value="Otro">Otro ✨</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Urgencia</label>
            <select 
              value={urgencia}
              onChange={e => setUrgencia(e.target.value as any)}
              className={cn(
                "w-full border rounded-2xl px-3 py-3 text-xs font-bold outline-none",
                urgencia === 'Alta' ? "bg-rose-50 border-rose-200 text-rose-600" : urgencia === 'Media' ? "bg-amber-50 border-amber-200 text-amber-600" : "bg-blue-50 border-blue-200 text-blue-600"
              )}
            >
              <option value="Baja">Baja</option>
              <option value="Media">Media</option>
              <option value="Alta">Alta</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción</label>
          <textarea 
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="¿Qué ocurrió? Sé descriptivo..."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none min-h-[100px] resize-none"
          />
        </div>

        <button 
          onClick={() => setIsPhotoed(true)}
          className={cn(
            "w-full py-4 rounded-2xl border-2 border-dashed transition-all flex items-center justify-center gap-3",
            isPhotoed ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-slate-50 border-slate-200 text-slate-400"
          )}
        >
          <Camera className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-widest">{isPhotoed ? 'Evidencia Capturada' : 'Tomar Foto Evidencia'}</span>
        </button>

        <button 
          onClick={handleReport}
          disabled={!desc || loading}
          className="w-full bg-slate-900 text-white py-4 rounded-[20px] font-black text-sm uppercase tracking-widest disabled:opacity-50 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-2"
        >
          {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <><MoveRight className="w-5 h-5" /> ENVIAR REPORTE</>}
        </button>
        
        <button onClick={onReported} className="w-full text-center text-slate-400 text-[10px] font-black uppercase tracking-widest py-2">
          Cancelar
        </button>
      </div>

      <AnimatePresence>
        {showShareModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-[#0b3464] mb-2 tracking-tight">¡Reporte Enviado!</h3>
              <p className="text-sm font-bold text-slate-500 mb-8 px-4">
                El incidente ha sido registrado. ¿Quieres compartir un resumen por WhatsApp al supervisor?
              </p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={shareViaWhatsApp}
                  className="w-full py-4 bg-[#25D366] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-200 flex items-center justify-center gap-2"
                >
                  Compartir WhatsApp
                </button>
                <button 
                  onClick={() => { setShowShareModal(null); onReported(); }}
                  className="w-full py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TareaActiva({ 
  tarea, 
  onFinish, 
  durationText, 
  comment, 
  onCommentChange 
}: { 
  tarea: TareaPlan, 
  onFinish: () => void, 
  durationText: string,
  comment: string,
  onCommentChange: (val: string) => void
}) {
  const [checklist, setChecklist] = useState<string[]>([]);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const steps = [
    'Verificado de superficie',
    'Limpieza profunda con químicos',
    'Desinfección de puntos críticos',
    'Reposición de insumos local',
    'Retiro de residuos'
  ];

  const handleCapture = () => {
    setCapturing(true);
    setTimeout(() => {
      setHasPhoto(true);
      setCapturing(false);
    }, 1200);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-6 border-2 border-slate-100 rounded-[40px] bg-white shadow-2xl shadow-slate-100 flex flex-col gap-6"
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">{tarea.frecuencia}</p>
          <h3 className="text-xl font-black text-slate-900 leading-tight">{tarea.titulo}</h3>
          {tarea.descripcion && <p className="text-xs text-slate-400 mt-2 italic">"{tarea.descripcion}"</p>}
        </div>
        <div className="text-right">
          <div className="text-3xl font-black text-emerald-500 font-mono tracking-tighter leading-none mb-1">{durationText}</div>
          <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest">En curso</div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Checklist Compliance</p>
        {steps.map((step, i) => (
          <button 
            key={i}
            onClick={() => {
              if (checklist.includes(step)) setChecklist(checklist.filter(s => s !== step));
              else setChecklist([...checklist, step]);
            }}
            className={cn(
              "w-full p-4 rounded-2xl flex items-center gap-3 transition-all border",
              checklist.includes(step) ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-slate-50 border-slate-100 text-slate-500"
            )}
          >
            <CheckCircle2 className={cn("w-5 h-5", checklist.includes(step) ? "text-emerald-500" : "text-slate-300")} />
            <span className="text-xs font-bold text-left">{step}</span>
          </button>
        ))}
      </div>

      <div className="bg-slate-50 p-6 rounded-3xl border border-dashed border-slate-200 flex flex-col items-center">
        {hasPhoto ? (
          <div className="flex items-center gap-3 text-emerald-600">
             <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
               <CheckCircle2 className="w-6 h-6" />
             </div>
             <span className="text-xs font-black uppercase">Evidencia Fotográfica Ok</span>
          </div>
        ) : (
          <button onClick={handleCapture} disabled={capturing} className="flex flex-col items-center gap-2 group">
            <div className="w-14 h-14 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-blue-50 transition-all">
              <Camera className={cn("w-8 h-8 text-slate-400", capturing && "animate-pulse")} />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {capturing ? 'Capturando...' : 'Obligatorio: Foto Evidencia'}
            </span>
          </button>
        )}
      </div>

      <div className="relative">
        <textarea
          value={comment}
          onChange={e => onCommentChange(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:border-blue-400 outline-none resize-none h-28 font-medium"
          placeholder="Notas adicionales..."
        />
      </div>
      
      <motion.button 
        whileTap={{ scale: 0.96 }}
        onClick={onFinish}
        disabled={checklist.length < steps.length || !hasPhoto}
        className={cn(
          "w-full py-5 rounded-[24px] font-black text-sm uppercase tracking-widest shadow-2xl transition-all flex items-center justify-center gap-3",
          (checklist.length === steps.length && hasPhoto)
             ? "bg-[#0b3464] text-white shadow-[#0b3464]/20" 
             : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
        )}
      >
        <CheckCircle2 className="w-6 h-6" />
        Finalizar Tarea
      </motion.button>
    </motion.div>
  );
}

function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      console.log('beforeinstallprompt event fired');
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallBtn(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      alert("La aplicación ya está instalada o tu navegador no soporta la instalación automática. Si usas iPhone, pulsa el botón Compartir y luego 'Añadir a pantalla de inicio'.");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
  };

  return { showInstallBtn, handleInstall, isSupported: !!deferredPrompt };
}

function InstallBanner({ installProps }: { installProps: any }) {
  const { showInstallBtn, handleInstall } = installProps;

  if (!showInstallBtn) return null;

  return (
    <motion.div 
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-4 left-4 right-4 z-[9999] bg-blue-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-blue-400/30 backdrop-blur-md bg-opacity-95"
    >
      <div className="flex items-center gap-3">
        <div className="bg-white p-1 rounded-xl">
          <img 
            src="/logo.png" 
            alt="Logo" 
            className="w-6 h-6 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/3649/3649255.png';
            }}
          />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">Instalar Aplicación</p>
          <p className="text-[10px] text-blue-100 font-medium">Versión optimizada para celular</p>
        </div>
      </div>
      <button 
        onClick={handleInstall}
        className="bg-white text-blue-600 px-4 py-2 rounded-xl text-xs font-black shadow-sm active:scale-95 transition-transform"
      >
        INSTALAR
      </button>
    </motion.div>
  );
}


// -- Main App --

export default function App() {
  const installProps = usePWAInstall();
  useReminderChecker();
  // Authentication State
  const [user, setUser] = useStickyState<Operario | null>(null, 'limpieza_user');
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginDate, setLoginDate] = useStickyState<string | null>(null, 'limpieza_login_date');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        // If we have a firebase user, try to get their profile from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
          if (userDoc.exists()) {
            const userData = { ...(userDoc.data() as any), id: fbUser.uid } as Operario;
            setUser(userData);
          } else if (user) {
            // If user exists in local storage but not in firestore, we might need to sync it
            // This happens if they signed in with PIN and then linked Google, or vice versa
            if (user.rol === 'supervisor' || user.rol === 'operario') {
                await setDoc(doc(db, 'users', fbUser.uid), {
                    uid: fbUser.uid,
                    nombre: user.nombre,
                    rol: user.rol,
                    email: fbUser.email || null
                });
            }
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        // If logged out from Firebase
        if (user && user.id && user.id.length > 20) { // Likely a Firebase UID
           // setUser(null); 
        }
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);
  
  // App states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Shift & Task states
  const [shiftState, setShiftState] = useStickyState<'idle' | 'active' | 'paused'>('idle', 'limpieza_shift_state');
  const [shiftStart, setShiftStart] = useStickyState<string | null>(null, 'limpieza_shift_start');
  const [jornadaStart, setJornadaStart] = useStickyState<string | null>(null, 'limpieza_jornada_start');
  const [breakStart, setBreakStart] = useStickyState<string | null>(null, 'limpieza_break_start');
  
  const [activeTask, setActiveTask] = useStickyState<TareaPlan | null>(null, 'limpieza_active_task');
  const [taskStart, setTaskStart] = useStickyState<string | null>(null, 'limpieza_task_start');
  const [taskComment, setTaskComment] = useStickyState<string>('', 'limpieza_task_comment');

  // Menu & Dashboard States
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'tareas' | 'horarios' | 'insumos' | 'incidencias' | 'capacitacion' | 'rrhh' | 'perfil'>('tareas');
  const [location, setLocation] = useState<string>('');
  const [notificationsCount, setNotificationsCount] = useState(0);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
      });
    }
  }, []);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    // Check pending tasks count to simulate notifications
    async function checkNotifications() {
      if (!user || !firebaseUser) return;
      try {
        const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'), limit(10));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (data.length > 0) {
          const urgentes = data.filter((d: any) => d.fecha_vencimiento);
          setNotificationsCount(urgentes.length > 0 ? urgentes.length : 1);
        }
      } catch (err) {
        console.error("Error in checkNotifications:", err);
      }
    }
    checkNotifications();
  }, [user]);

  useEffect(() => {
    // Check if the day has changed (Argentina Time)
    const interval = setInterval(() => {
      const today = getArgentinaDate();
      if (user && loginDate && loginDate !== today) {
        performGlobalLogout();
        alert("La sesión ha expirado porque es un nuevo día (Horario Argentina). Inicie sesión nuevamente.");
      }
    }, 60000); // check every minute
    return () => clearInterval(interval);
  }, [user, loginDate]);

  const performGlobalLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Logout error:", e);
    }
    
    // Clear all sticky states manually to ensure clean slate
    localStorage.removeItem('limpieza_user');
    localStorage.removeItem('limpieza_login_date');
    localStorage.removeItem('limpieza_shift_state');
    localStorage.removeItem('limpieza_shift_start');
    localStorage.removeItem('limpieza_jornada_start');
    localStorage.removeItem('limpieza_break_start');
    localStorage.removeItem('limpieza_active_task');
    localStorage.removeItem('limpieza_task_start');
    localStorage.removeItem('limpieza_task_comment');
    
    setUser(null);
    setLoginDate(null);
    setShiftState('idle');
    setShiftStart(null);
    setJornadaStart(null);
    setBreakStart(null);
    setActiveTask(null);
    setTaskStart(null);
    setTaskComment('');
    setMenuOpen(false);
    
    // Force a small delay and reload if necessary, but setUser(null) should suffice
  };

  const handleLogout = () => {
    performGlobalLogout();
  };

  // If we have a user from sticky state but no firebase user yet
  if (user && !firebaseUser && !authLoading) {
    // If they lost their Firebase session but kept localStorage, we MUST re-authenticate
    // to prevent "Missing or insufficient permissions"
    if (user.rol === 'operario' || user.id?.startsWith('sv-') || user.id?.length < 20) {
      signInAnonymously(auth).catch(e => console.warn(e));
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Restaurando sesión...</p>
          </div>
        </div>
      );
    } else {
      // Must be a Google user that lost session, they need to manually re-login
      performGlobalLogout();
      return null;
    }
  }

  // Also block rendering if still loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <InstallBanner installProps={installProps} />
        <LoginScreen onLogin={(u, d) => { setUser(u); setLoginDate(d); }} installProps={installProps} />
      </>
    );
  }

  if (user.rol === 'supervisor') {
    return (
      <>
        <InstallBanner installProps={installProps} />
        <SupervisorDashboard user={user} onLogout={handleLogout} onUserUpdate={setUser} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-start justify-center w-full font-sans text-slate-800">
      <InstallBanner installProps={installProps} />
      <div className="w-full bg-white min-h-screen shadow-sm overflow-hidden relative flex flex-col pb-8">
        
        {/* SIDE MENU OVERLAY */}
        <AnimatePresence>
          {menuOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMenuOpen(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-[90]"
              />
              <motion.div 
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="absolute top-0 left-0 bottom-0 w-[280px] bg-white z-[100] shadow-2xl flex flex-col p-6"
              >
                <div className="flex justify-between items-center mb-10">
                  <div className="flex items-center gap-2">
                    <img 
                      src="/logo.png" 
                      alt="Logo" 
                      className="w-12 h-12 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/1048/1048953.png';
                      }}
                    />
                    <span className="font-bold text-lg tracking-tight text-brand-blue">Limpieza Arévalo</span>
                  </div>
                  <button onClick={() => setMenuOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <nav className="flex-1 overflow-y-auto pr-2 flex flex-col gap-1">
                  {[
                    { id: 'tareas', icon: Home, label: 'Inicio' },
                    { id: 'incidencias', icon: AlertTriangle, label: 'Incidencias' },
                    { id: 'perfil', icon: UserCircle, label: 'Mi Perfil' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { setActiveTab(item.id as any); setMenuOpen(false); }}
                      className={cn(
                        "flex items-center gap-4 px-4 py-4 rounded-2xl font-bold transition-all w-full text-left",
                        activeTab === item.id 
                          ? "bg-blue-50 text-blue-600" 
                          : "text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      <item.icon className="w-6 h-6" />
                      <span>{item.label}</span>
                    </button>
                  ))}

                  <div className="my-4 border-t border-slate-100" />
                  <button 
                    onClick={handleLogout}
                    className="flex items-center gap-4 px-4 py-4 rounded-2xl font-bold text-rose-500 hover:bg-rose-50 transition-all"
                  >
                    <LogOut className="w-6 h-6" />
                    <span>Cerrar Sesión</span>
                  </button>
                </nav>

                <div className="mt-auto pt-6 border-t border-slate-100">
                  <div className="flex items-center gap-3">
                    <UserCircle className="w-8 h-8 text-slate-300" />
                    <div>
                      <p className="text-xs font-bold text-slate-800 leading-tight">{user.nombre}</p>
                      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{user.rol}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* HEADER */}
        <header className="bg-brand-blue text-white px-6 py-4 flex justify-between items-center z-50 relative border-b border-white/10">
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setMenuOpen(true)}
              className="p-2 -ml-2 text-white hover:bg-white/10 rounded-xl transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 bg-transparent rounded-xl text-white hover:text-blue-200 relative transition-colors hover:bg-white/10"
              >
                <Bell className="w-6 h-6" />
                {notificationsCount > 0 && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 border-2 border-transparent rounded-full"></span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} exit={{ opacity: 0 }}
                    className="absolute top-12 left-0 bg-white p-4 rounded-2xl shadow-2xl border border-slate-100 z-[60] text-left w-64"
                  >
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 border-b border-slate-100 pb-2">Notificaciones</h4>
                    {notificationsCount > 0 ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-rose-500 mt-1"></div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">Tareas con vencimiento</p>
                            <p className="text-xs text-slate-500 mt-0.5">Tienes tareas asignadas que vencen pronto.</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 font-medium">No hay notificaciones pendientes.</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-3 text-right">
            <div>
              <h2 className="text-sm font-bold text-white leading-tight truncate max-w-[120px]">{user.nombre}</h2>
            </div>
          </div>
        </header>

        <Dashboard 
          user={user}
          onUserUpdate={setUser}
          location={location}
          shiftState={shiftState}
          setShiftState={setShiftState}
          shiftStart={shiftStart}
          setShiftStart={setShiftStart}
          jornadaStart={jornadaStart}
          setJornadaStart={setJornadaStart}
          breakStart={breakStart}
          setBreakStart={setBreakStart}
          activeTask={activeTask}
          setActiveTask={setActiveTask}
          taskStart={taskStart}
          setTaskStart={setTaskStart}
          taskComment={taskComment}
          setTaskComment={setTaskComment}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          showNotifications={showNotifications}
          setShowNotifications={setShowNotifications}
          notificationsCount={notificationsCount}
        />
      </div>
    </div>
  );
}

// -- Dashboard Section --

function Dashboard({ 
  user,
  onUserUpdate,
  location,
  shiftState, setShiftState, 
  shiftStart, setShiftStart,
  jornadaStart, setJornadaStart,
  breakStart, setBreakStart,
  activeTask, setActiveTask,
  taskStart, setTaskStart,
  taskComment, setTaskComment,
  activeTab, setActiveTab,
  showNotifications, setShowNotifications,
  notificationsCount
}: any) {
  
  const time = useCurrentTime();
  const [shiftDurationText, setShiftDurationText] = useState('00:00:00');
  const [taskDurationText, setTaskDurationText] = useState('00:00:00');
  const [breakDurationText, setBreakDurationText] = useState('00:00:00');

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (jornadaStart || activeTask || breakStart) {
      interval = setInterval(() => {
        if (jornadaStart) setShiftDurationText(formatDuration(jornadaStart));
        if (activeTask) setTaskDurationText(formatDuration(taskStart));
        if (breakStart) setBreakDurationText(formatDuration(breakStart));
      }, 1000);
    }
    // Update immediately as well when states change
    if (jornadaStart) setShiftDurationText(formatDuration(jornadaStart));
    if (activeTask) setTaskDurationText(formatDuration(taskStart));
    if (breakStart) setBreakDurationText(formatDuration(breakStart));
    
    return () => clearInterval(interval);
  }, [jornadaStart, activeTask, taskStart, breakStart]);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingRecords();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial sync check
    if (navigator.onLine) syncPendingRecords();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncPendingRecords = async () => {
    const pendingJson = localStorage.getItem('limpieza_pending_sync');
    if (!pendingJson) return;
    
    try {
      const pending: any[] = JSON.parse(pendingJson);
      if (pending.length === 0) return;
      
      setSyncing(true);
      const remaining = [];
      
      for (const record of pending) {
        try {
          // Firebase fallback
          await addDoc(collection(db, 'logs'), {
            ...record,
            operarioId: user?.id || 'unknown',
            createdAt: serverTimestamp()
          });
        } catch (e) {
          console.error("Sync error for record:", e);
          remaining.push(record);
        }
      }
      
      if (remaining.length > 0) {
        localStorage.setItem('limpieza_pending_sync', JSON.stringify(remaining));
      } else {
        localStorage.removeItem('limpieza_pending_sync');
      }
    } catch (e) {
      console.error("Fatal sync error:", e);
    } finally {
      setSyncing(false);
    }
  };

  const recordTime = async (accion: string, startIso: string, comentario?: string) => {
    const end = new Date();
    const start = new Date(startIso);
    const durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
    
    const payload: any = {
      operarioId: user?.id || 'unknown',
      operario: user?.nombre || 'Desconocido',
      accion: comentario ? `${accion} (Obs: ${comentario})` : accion,
      inicio: start.toISOString(),
      fin: end.toISOString(),
      duracion_minutos: durationMinutes,
      comentario: comentario || null,
      fecha: start.toLocaleDateString('es-AR')
    };

    if (!navigator.onLine) {
      // Offline mode: Queue for later
      const pendingJson = localStorage.getItem('limpieza_pending_sync');
      const pending = pendingJson ? JSON.parse(pendingJson) : [];
      pending.push(payload);
      localStorage.setItem('limpieza_pending_sync', JSON.stringify(pending));
      return;
    }

    // Save to Firestore (logs)
    try {
      await addDoc(collection(db, 'logs'), {
        ...payload,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error saving record:", error);
      handleFirestoreError(error, OperationType.CREATE, 'logs');
      // Fallback: Add to queue if network fails during request
      const pendingJson = localStorage.getItem('limpieza_pending_sync');
      const pending = pendingJson ? JSON.parse(pendingJson) : [];
      pending.push(payload);
      localStorage.setItem('limpieza_pending_sync', JSON.stringify(pending));
    }
  };

  const handleStartShift = async () => {
    const now = new Date().toISOString();
    if (shiftState === 'idle') {
      setJornadaStart(now);
    }
    if (shiftState === 'paused' && breakStart) {
      await recordTime('Descanso', breakStart);
    }
    setShiftStart(now);
    setBreakStart(null);
    setShiftState('active');
  };

  const handlePauseShift = async () => {
    if (shiftState === 'active' && shiftStart) {
      await recordTime('Turno (Tramo)', shiftStart);
    }
    setShiftState('paused');
    setShiftStart(null);
    setBreakStart(new Date().toISOString());
  };

  const handleEndShift = async () => {
    if (shiftState === 'active' && shiftStart) {
      await recordTime('Turno', shiftStart);
    }
    if (shiftState === 'paused' && breakStart) {
      await recordTime('Descanso (Final)', breakStart);
    }
    setShiftState('idle');
    setShiftStart(null);
    setJornadaStart(null);
    setBreakStart(null);
    
    // Auto-finish tasks if shift ends
    if (activeTask && taskStart) {
      handleFinishTask();
    }
  };

  const handleStartTask = (task: TareaPlan) => {
    if (shiftState !== 'active') {
      alert("Por favor INICIE SU TURNO antes de comenzar una tarea.");
      return;
    }
    setActiveTask(task);
    setTaskStart(new Date().toISOString());
  };

  const handleFinishTask = async () => {
    if (activeTask && taskStart) {
      await recordTime(`Tarea: ${activeTask.titulo}`, taskStart, taskComment);
      
      try {
        await updateDoc(doc(db, 'tasks', activeTask.id), {
          lastCompletedDate: new Date().toISOString(),
          lastCompletedBy: user?.nombre || 'Operario'
        });
      } catch (e) {
        console.warn("Could not update task completion status", e);
      }

      setActiveTask(null);
      setTaskStart(null);
      setTaskComment('');
    }
  };

  const [pendingReminder, setPendingReminder] = useState<{ id: string, title: string } | null>(null);

  // -- Reminder Checker --
  useEffect(() => {
    const checkReminders = () => {
      const stored = window.localStorage.getItem('limpieza_task_reminders');
      if (!stored) return;
      
      const reminders: Record<string, { time: string, title: string }> = JSON.parse(stored);
      const now = new Date();
      let changed = false;

      Object.entries(reminders).forEach(([id, r]) => {
        const reminderTime = new Date(r.time);
        if (now >= reminderTime) {
          // Trigger Notification
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Recordatorio de Tarea", {
              body: `Es hora de: ${r.title}`,
              icon: "/regenerated_image_1777551940944.png"
            });
          }

          // Show in-app modal
          setPendingReminder({ id, title: r.title });

          delete reminders[id];
          changed = true;
        }
      });

      if (changed) {
        window.localStorage.setItem('limpieza_task_reminders', JSON.stringify(reminders));
      }
    };

    const interval = setInterval(checkReminders, 15000); // Check more frequently (every 15s)
    return () => clearInterval(interval);
  }, []);

  const openWhatsApp = (phone: string, msg: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    setPendingReminder(null);
  };

  return (
    <div className="flex-1 flex flex-col pt-0">
      
      {/* BIG DIGITAL CLOCK */}
      <div className="px-6 pt-2 pb-6 text-center relative">
        <div className="absolute top-2 left-6">
          <AnimatePresence>
            {!isOnline && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full border border-amber-100 shadow-sm"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase">Offline</span>
              </motion.div>
            )}
            {syncing && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-100 shadow-sm"
              >
                <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                <span className="text-[10px] font-black uppercase">Sinc...</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="absolute top-2 right-6">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-400 rounded-full border border-slate-100 shadow-sm">
            <MapPin className="w-3.5 h-3.5" />
            <span className="text-[9px] font-black uppercase tracking-tighter">{location || 'GPS OK'}</span>
          </div>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold tracking-tighter text-slate-900 mb-1"
        >
          {time.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
        </motion.div>
        {jornadaStart && (
          <p className="text-sm font-medium text-emerald-600 flex items-center justify-center gap-1.5 uppercase mb-1">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            Total Jornada: {shiftDurationText}
          </p>
        )}
        {shiftState === 'paused' && breakStart && (
          <p className="text-sm font-bold text-amber-500 flex items-center justify-center gap-1.5 uppercase">
             En Descanso: {breakDurationText}
          </p>
        )}
        {!jornadaStart && (
          <p className="text-sm font-medium text-slate-400 flex items-center justify-center gap-1.5 uppercase">
            {time.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        )}
      </div>

      <div className="px-6 flex-1 flex flex-col gap-6">
        
        {/* NEW: ANUNCIOS DEL SUPERVISOR */}
        <AnunciosBanner />
        
        {/* SHIFT CONTROLS */}
        <section className="flex flex-col gap-3">
          
          <div className="grid grid-cols-1 gap-3">
            {shiftState === 'idle' && (
              <div className="flex flex-col gap-3">
                <ShiftButton color="green" icon={<Play className="w-6 h-6 fill-current" />} label="INICIAR TURNO" onClick={handleStartShift} />
              </div>
            )}
            
            {shiftState === 'paused' && (
              <ShiftButton color="green" icon={<Play className="w-6 h-6 fill-current" />} label="REANUDAR TRABAJO" onClick={handleStartShift} />
            )}

            {shiftState === 'active' && (
              <div className="bg-slate-50 rounded-2xl p-4 border border-emerald-100 flex flex-col items-center justify-center mb-2">
                <span className="text-emerald-600 font-bold tracking-widest uppercase text-[10px] mb-1 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Tramo Actual Activo
                </span>
                <span className="text-xl font-black text-slate-800 tracking-tight font-mono">{formatDuration(shiftStart)}</span>
              </div>
            )}
            
            {(shiftState === 'active' || shiftState === 'paused') && (
              <div className="grid grid-cols-2 gap-3">
                <ShiftButton 
                  disabled={shiftState === 'paused'}
                  color="yellow" 
                  small
                  icon={<PauseCircle className="w-5 h-5" />} 
                  label="DESCANSO" 
                  onClick={handlePauseShift} 
                />
                <ShiftButton 
                  color="red" 
                  small
                  icon={<Square className="w-5 h-5 fill-current" />} 
                  label="FINALIZAR" 
                  onClick={handleEndShift} 
                />
              </div>
            )}
          </div>
        </section>

        {/* TAB CONTENT (Controlled by Sidebar Menu) */}
        {activeTab === 'tareas' && (
          <section className="flex-1 flex flex-col pb-6">
             <div className="flex items-center justify-between mb-4">
               <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">{activeTask ? "Operación en sitio" : "Tareas disponibles"}</h2>
             </div>
             
             {activeTask ? (
               <motion.div 
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 className="p-5 border-2 border-slate-100 rounded-3xl bg-slate-50 mb-6 w-full"
               >
                 <div className="flex justify-between items-start mb-6">
                   <div className="pr-2">
                     <h3 className="text-lg font-bold text-slate-800 leading-tight">{activeTask.titulo}</h3>
                     <div className="flex gap-2 mt-2">
                        <span className="px-2 py-0.5 bg-slate-200/50 rounded text-[10px] font-bold text-slate-600 uppercase inline-block">
                          {activeTask.frecuencia}
                        </span>
                        {activeTask.tipoLimpieza && (
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-black uppercase inline-block",
                            activeTask.tipoLimpieza === 'Mantenimiento' ? "bg-blue-100 text-blue-600" :
                            activeTask.tipoLimpieza === 'Intermedia' ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"
                          )}>
                            {activeTask.tipoLimpieza}
                          </span>
                        )}
                     </div>
                   </div>
                   <div className="text-right">
                     <div className="text-2xl font-mono font-bold text-emerald-600">{taskDurationText}</div>
                     <div className="text-[10px] text-slate-400 font-bold tracking-wider">HH:MM:SS</div>
                   </div>
                 </div>

                  <div className="mb-6 relative">
                   <textarea
                     value={taskComment}
                     onChange={e => setTaskComment(e.target.value)}
                     className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-emerald-500 outline-none resize-none h-24"
                     placeholder="Agregar comentario u observación (opcional)..."
                   />
                 </div>
                 
                 <motion.button 
                   whileTap={{ scale: 0.96 }}
                   onClick={handleFinishTask}
                   className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 uppercase"
                 >
                   <CheckCircle2 className="w-5 h-5" />
                   Terminar Tarea
                 </motion.button>
               </motion.div>
             ) : (
               <TaskSelector onStart={handleStartTask} shiftActive={shiftState === 'active'} user={user} />
             )}
          </section>
        )}

        {activeTab === 'perfil' && <UserProfile user={user} onUpdate={onUserUpdate} />}
        
            {activeTab === 'incidencias' && (
              <div className="flex flex-col gap-6">
                <IncidenciasModule user={user} onReported={() => setActiveTab('tareas')} />
              </div>
            )}

        {activeTab !== 'tareas' && activeTab !== 'incidencias' && (
           <h3 onClick={() => setActiveTab('incidencias')} className="text-center font-black text-rose-500 text-[10px] uppercase tracking-widest mt-10 py-6 border-2 border-dashed border-rose-100 rounded-3xl cursor-pointer flex items-center justify-center gap-2">
             <AlertTriangle className="w-5 h-5" /> BOTÓN DE PÁNICO / INCIDENCIA
           </h3>
        )}

        <AnimatePresence>
          {pendingReminder && (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[300] flex items-center justify-center p-6">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl text-center border-4 border-emerald-50"
              >
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Bell className="w-10 h-10 animate-bounce" />
                </div>
                <h3 className="text-2xl font-black text-[#0b3464] mb-2 tracking-tight">¡Recordatorio!</h3>
                <p className="text-sm font-bold text-slate-500 mb-8 px-4 leading-relaxed">
                  Es momento de realizar: <br/>
                  <span className="text-emerald-600 font-black text-lg block mt-2">"{pendingReminder.title}"</span>
                </p>
                
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => setPendingReminder(null)}
                    className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-200"
                  >
                    Entendido
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AnunciosBanner() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(5));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAnnouncements(data);
    }, (error) => {
      console.error("Error loading announcements:", error);
    });
    return () => unsubscribe();
  }, []);

  if (announcements.length === 0) return null;

  const current = announcements[currentIndex];

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900 text-white p-4 rounded-3xl relative overflow-hidden shadow-xl"
    >
      <div className="absolute top-0 right-0 p-2 opacity-10">
        <Megaphone className="w-16 h-16 -rotate-12" />
      </div>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400">Comunicado Oficial</span>
          <span className="text-[8px] font-bold text-slate-500">{new Date(current.date).toLocaleDateString()}</span>
        </div>
        <p className="text-xs font-bold leading-relaxed">{current.text}</p>
        
        {announcements.length > 1 && (
          <div className="flex gap-1 mt-3">
             {announcements.map((_, i) => (
               <button 
                key={i} 
                onClick={() => setCurrentIndex(i)}
                className={cn("h-1 rounded-full transition-all", i === currentIndex ? "w-4 bg-blue-500" : "w-1 bg-slate-700")} 
               />
             ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
function ShiftButton({ color, label, icon, onClick, small, disabled }: { color: 'green'|'yellow'|'red', label: string, icon: React.ReactNode, onClick: ()=>void, small?: boolean, disabled?: boolean }) {
  const baseClasses = disabled ? "opacity-50 grayscale cursor-not-allowed" : "shadow-lg active:shadow-sm";
  
  const colors = {
    green: "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-100",
    yellow: "bg-amber-400 hover:bg-amber-500 text-amber-950 shadow-amber-50",
    red: "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-50"
  };

  return (
    <motion.button
      whileTap={disabled ? {} : { scale: 0.96 }}
      onClick={disabled ? undefined : onClick}
      className={cn(
        "rounded-2xl font-bold uppercase transition-all flex justify-center",
        colors[color],
        small ? "py-5 text-sm flex-col items-center gap-1" : "w-full py-5 text-lg items-center gap-3",
        baseClasses
      )}
    >
      {icon}
      <span>{label}</span>
    </motion.button>
  );
}

// -- Task Selector --
function TaskSelector({ onStart, shiftActive, user }: { onStart: (t: TareaPlan) => void, shiftActive: boolean, user: Operario }) {
  const [tasks, setTasks] = useState<TareaPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 10;

  const [filter, setFilter] = useStickyState<'Diaria' | 'Semanal' | 'Mensual' | 'Eventual'>('Diaria', 'limpieza_preferred_filter');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isCreating, setIsCreating] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskFreq, setNewTaskFreq] = useState<'Diaria' | 'Semanal' | 'Mensual' | 'Eventual'>('Diaria');
  const [newTaskType, setNewTaskType] = useState<'Mantenimiento' | 'Intermedia' | 'Detalles'>('Mantenimiento');

  const [reminders, setReminders] = useStickyState<Record<string, { time: string, title: string }>>({}, 'limpieza_task_reminders');
  const [showReminderModal, setShowReminderModal] = useState<string | null>(null);
  const [reminderDateTime, setReminderDateTime] = useState('');

  useEffect(() => {
    fetchTasks(0, true);
  }, [filter]);

  async function fetchTasks(pageNum: number, isInitial: boolean = false) {
    if (isInitial) {
      setLoading(true);
      setPage(0);
    } else {
      setLoadingMore(true);
    }

    try {
      const q = query(
        collection(db, 'tasks'),
        where('frecuencia', '==', filter),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );
      
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
      if (isInitial) {
        setTasks(data);
      } else {
        setTasks(prev => [...prev, ...data]);
      }
      setHasMore(data.length === pageSize);
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.LIST, 'tasks');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchTasks(nextPage);
  };

  const filteredTasks = tasks.filter((t: any) => {
    // Text filter
    if (searchTerm && !(
      t.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (t.descripcion || '').toLowerCase().includes(searchTerm.toLowerCase())
    )) {
      return false;
    }

    // Completion status filter
    if (t.lastCompletedDate) {
      const completedAt = new Date(t.lastCompletedDate);
      const now = new Date();
      
      if (t.frecuencia === 'Diaria') {
        if (completedAt.toDateString() === now.toDateString()) {
          return false; // Completed today
        }
      } else if (t.frecuencia === 'Semanal') {
        const diffTime = Math.abs(now.getTime() - completedAt.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        // Simple 7-day week window (alternatively align with Monday)
        if (diffDays <= 7 && now.getDay() >= completedAt.getDay() && now.getTime() - completedAt.getTime() < 7 * 24 * 60 * 60 * 1000) {
           return false; // Very rough "this week" check
        }
        // More precise: check if they are in the same ISO week or if they are less than 7 days ago 
        // For simplicity, let's say "within last 7 days" OR "same week"
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0,0,0,0);
        if (completedAt >= startOfWeek) return false;

      } else if (t.frecuencia === 'Mensual') {
        if (completedAt.getMonth() === now.getMonth() && completedAt.getFullYear() === now.getFullYear()) {
          return false; // Completed this month
        }
      }
    }

    return true;
  });

  const filters: Array<'Diaria' | 'Semanal' | 'Mensual' | 'Eventual'> = ['Diaria', 'Semanal', 'Mensual', 'Eventual'];

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    
    const newTask: any = { 
      titulo: newTaskTitle.trim(), 
      frecuencia: newTaskFreq,
      tipoLimpieza: newTaskType,
      descripcion: newTaskDesc || null,
      fecha_vencimiento: newTaskDate || null,
      createdAt: serverTimestamp()
    };
    
    try {
      const docRef = await addDoc(collection(db, 'tasks'), newTask);
      setTasks([{ id: docRef.id, ...newTask } as any, ...tasks]);
      setIsCreating(false);
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskDate('');
    } catch (error) {
      console.error('Error al crear la tarea:', error);
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
    }
  };

  const saveReminder = () => {
    if (!reminderDateTime || !showReminderModal) return;
    const task = tasks.find(t => t.id === showReminderModal);
    if (!task) return;

    if (!user.whatsapp) {
      alert("Debe cargar su número de WhatsApp en su Perfil primero.");
      setShowReminderModal(null);
      return;
    }

    const newReminders = { ...reminders };
    newReminders[showReminderModal.toString()] = {
      time: new Date(reminderDateTime).toISOString(),
      title: task.titulo
    };
    setReminders(newReminders);
    setShowReminderModal(null);
    setReminderDateTime('');

    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    alert("Recordatorio programado correctamente.");
  };

  const removeReminder = (taskId: string | number) => {
    const newReminders = { ...reminders };
    delete newReminders[taskId.toString()];
    setReminders(newReminders);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent">
      
      {/* Category Tabs */}
      <div className="grid grid-cols-4 gap-1 sm:gap-2 mb-4 pb-1">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
               filter === f 
                ? "bg-slate-900 text-white shadow-sm" 
                : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-200",
              "py-2 px-1 rounded-full text-[10px] sm:text-xs font-bold transition-all truncate flex justify-center items-center"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Enhanced Search Filter */}
      <div className="relative mb-4">
        <input 
          type="text"
          placeholder="Buscar tareas..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-2xl px-10 py-3 text-sm font-medium outline-none focus:border-blue-500 transition-all shadow-sm"
        />
        <ClipboardList className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      

      <div className="flex justify-between items-center mb-3">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Lista de Tareas</h3>
        {!isCreating && (
          <button 
            onClick={() => { setIsCreating(true); setNewTaskFreq(filter); }} 
            className="text-[10px] font-bold uppercase bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Plus className="w-3 h-3" /> Nueva
          </button>
        )}
      </div>

      {isCreating && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-4 flex flex-col gap-3"
        >
          <div className="relative">
            <input 
              autoFocus
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm font-semibold outline-none focus:border-emerald-500 transition-colors"
              placeholder="Título de la tarea*"
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
            />
          </div>
          <div className="relative">
            <textarea 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm font-medium outline-none focus:border-emerald-500 transition-colors resize-none h-16"
              placeholder="Descripción (opcional)"
              value={newTaskDesc}
              onChange={e => setNewTaskDesc(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Frecuencia</label>
              <select 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-emerald-500 transition-colors appearance-none"
                value={newTaskFreq}
                onChange={e => setNewTaskFreq(e.target.value as any)}
              >
                <option value="Diaria">Diaria</option>
                <option value="Semanal">Semanal</option>
                <option value="Mensual">Mensual</option>
                <option value="Eventual">Eventual</option>
              </select>
            </div>
            <div>
              <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Tipo de Limpieza</label>
              <select 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-emerald-500 transition-colors appearance-none"
                value={newTaskType}
                onChange={e => setNewTaskType(e.target.value as any)}
              >
                <option value="Mantenimiento">Mantenimiento</option>
                <option value="Intermedia">Intermedia</option>
                <option value="Detalles">Detalles</option>
              </select>
            </div>
          </div>
          <div className="relative">
            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Fecha Vencimiento (Opcional)</label>
            <input 
              type="date"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-600 outline-none focus:border-emerald-500 transition-colors"
              value={newTaskDate}
              onChange={e => setNewTaskDate(e.target.value)}
            />
          </div>
          <div className="flex gap-2 mt-1">
            <button 
              className="flex-1 bg-slate-100 text-slate-600 rounded-xl py-3 text-xs font-bold uppercase hover:bg-slate-200 transition-colors" 
              onClick={() => { setIsCreating(false); setNewTaskTitle(''); setNewTaskDesc(''); setNewTaskDate(''); }}
            >
              Cancelar
            </button>
            <button 
              className="flex-1 bg-emerald-500 text-white rounded-xl py-3 text-xs font-bold uppercase shadow-sm shadow-emerald-500/20 hover:bg-emerald-600 transition-colors" 
              onClick={handleCreateTask}
            >
              Guardar
            </button>
          </div>
        </motion.div>
      )}

      {/* Task List */}
      <div className="flex-1 overflow-y-auto max-h-[450px] pb-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-8 text-slate-400">
            <RefreshCcw className="w-6 h-6 animate-spin mb-4 opacity-50" />
            <p className="text-sm font-medium">Cargando tareas...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-slate-400 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <CheckCircle2 className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm font-medium">No se encontraron tareas.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map(task => (
              <div key={task.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-blue-100 transition-colors relative overflow-hidden">
                {task.tipoLimpieza && (
                  <div className={cn(
                    "absolute top-0 right-0 px-3 py-0.5 text-[8px] font-black uppercase rounded-bl-xl",
                    task.tipoLimpieza === 'Mantenimiento' ? "bg-blue-100 text-blue-600" :
                    task.tipoLimpieza === 'Intermedia' ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"
                  )}>
                    {task.tipoLimpieza}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-900 leading-tight truncate pr-16">{task.titulo}</div>
                  <div className="flex flex-wrap gap-2 items-center mt-1">
                    <span className="text-[9px] font-black text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 flex items-center gap-1">
                      {task.frecuencia === 'Diaria' && <Clock className="w-2.5 h-2.5" />}
                      {task.frecuencia === 'Semanal' && <Calendar className="w-2.5 h-2.5" />}
                      {task.frecuencia === 'Mensual' && <LayoutGrid className="w-2.5 h-2.5" />}
                      {task.frecuencia}
                    </span>
                    {task.fecha_vencimiento && (
                      <span className="text-[9px] font-black text-rose-500 flex items-center gap-0.5">
                        <Calendar className="w-2.5 h-2.5"/> {task.fecha_vencimiento}
                      </span>
                    )}
                  </div>
                  {task.descripcion && <p className="text-[11px] text-slate-500 mt-2 italic line-clamp-2">{task.descripcion}</p>}
                </div>
                
                <div className="flex items-center gap-1 ml-2">
                  <button 
                    onClick={() => reminders[task.id.toString()] ? removeReminder(task.id) : setShowReminderModal(task.id.toString())}
                    className={cn(
                      "p-2 rounded-xl transition-all",
                      reminders[task.id.toString()] ? "bg-blue-50 text-blue-600 shadow-inner" : "text-slate-300 hover:bg-slate-50"
                    )}
                    title="Configurar Recordatorio"
                  >
                    <Bell className={cn("w-5 h-5", reminders[task.id.toString()] && "fill-current animate-bounce")} />
                  </button>
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onStart(task)}
                    className="p-3 text-emerald-500 hover:bg-emerald-50 rounded-xl transition-colors flex-shrink-0"
                  >
                    <Play className="w-6 h-6 fill-current" />
                  </motion.button>
                </div>
              </div>
            ))}
            
            {hasMore && (
              <button 
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-500 hover:bg-blue-50/50 rounded-2xl transition-all border border-dashed border-slate-200 mt-4"
              >
                {loadingMore ? (
                  <RefreshCcw className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  'Cargar más tareas'
                )}
              </button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showReminderModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative"
            >
              <h3 className="text-xl font-black text-[#0b3464] mb-2 tracking-tight">Programar Recordatorio</h3>
              <p className="text-xs text-slate-400 mb-6 font-bold uppercase tracking-widest">Recibirás notificación y WhatsApp</p>
              
              <div className="mb-6">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Fecha y Hora</label>
                <input 
                  type="datetime-local" 
                  value={reminderDateTime}
                  onChange={e => setReminderDateTime(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 focus:border-blue-500 rounded-2xl px-5 py-3 font-bold outline-none"
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowReminderModal(null)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest"
                >
                  Cancelar
                </button>
                <button 
                  onClick={saveReminder}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-200"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


// -- Login Screen --

function LoginScreen({ onLogin, installProps }: { onLogin: (user: Operario, d: string) => void, installProps: any }) {
  const [usuario, setUsuario] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [geoStatus, setGeoStatus] = useState<'checking' | 'allowed' | 'denied' | 'outside'>('checking');
  const [userCoords, setUserCoords] = useState<{ lat: number, lng: number } | null>(null);

  const TARGET_LAT = -26.833782; 
  const TARGET_LNG = -65.200598;
  const ALLOWED_RADIUS_METERS = 500;

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoStatus('denied');
      setError('La geolocalización no es compatible con su navegador.');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserCoords({ lat: latitude, lng: longitude });
        const distance = calculateDistance(latitude, longitude, TARGET_LAT, TARGET_LNG);
        if (distance <= ALLOWED_RADIUS_METERS) {
          setGeoStatus('allowed');
          setError('');
        } else {
          setGeoStatus('outside');
        }
      },
      () => {
        setGeoStatus('denied');
        setError('Debe habilitar la ubicación para registrar su entrada.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    "Notification" in window ? Notification.permission : "denied"
  );

  const requestNotifPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
    }
  };

  const needsNotifAction = notifPermission === "default";
  
  // Allow clicking buttons if not loading, validation happens inside handlers
  const isButtonEnabled = !loading;

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const fbUser = result.user;
      
      let userData: any = null;
      let userId: string = fbUser.uid;

      const userRef = doc(db, 'users', fbUser.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        userData = userSnap.data();
      } else {
        const q = query(collection(db, 'users'), where('email', '==', fbUser.email));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          userData = qSnap.docs[0].data();
          userId = qSnap.docs[0].id;
        }
      }

      if (!userData) {
        if (fbUser.email?.toLowerCase() === 'comunicacionservicios@arevalo.com.ar') {
          userData = {
            nombre: 'Administrador (Arévalo)',
            rol: 'supervisor',
            email: fbUser.email,
          };
          // Try to create the user doc silently so future checks work smoothly
          try {
            await setDoc(userRef, userData, { merge: true });
          } catch (e) {
            console.warn("Could not save admin user doc", e);
          }
        } else {
          throw new Error('Cuenta de Google no registrada en el sistema.');
        }
      }

      // Check permissions based on role
      const isSupervisor = userData.rol === 'supervisor';
      
      if (!isSupervisor && userData.rol === 'operario') {
        if (geoStatus !== 'allowed') {
          throw new Error('Los operarios deben estar en el rango de la empresa para ingresar.');
        }
      }
      
      // Handle anonymous sign-in for PIN users if not already authenticated
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.warn("Anonymous sign-in error:", e);
        }
      }

      if (notifPermission !== 'granted' && "Notification" in window) {
        try {
          const perm = await Notification.requestPermission();
          setNotifPermission(perm);
          // Only block if they explicitly DENIED and app really needs it, 
          // but for now let's just warn and allow if they are in default state after prompt
          if (perm === 'denied') {
             throw new Error('Debe habilitar las notificaciones para ingresar.');
          }
        } catch (e: any) {
          if (e.message.includes('notificaciones')) throw e;
          console.warn("Notification error:", e);
        }
      }

      onLogin({ ...userData, id: userId || fbUser.uid } as any, getArgentinaDate());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !pin.trim()) return;
    setLoading(true);
    setError('');
    try {
      if (!auth.currentUser) await signInAnonymously(auth);
      const q = query(collection(db, 'users'), where('usuario', '==', usuario.trim().toUpperCase()), where('pin', '==', pin.trim()));
      const querySnapshot = await getDocs(q);
      
      let userData: any = null;
      let userId: string = '';

      if (querySnapshot.empty) {
        const u = usuario.trim().toUpperCase();
        if (u === 'WMEDINA' && pin === '1234') {
          userData = { nombre: 'Walter Medina', usuario: 'WMEDINA', rol: 'supervisor' };
          userId = 'sv-wmedina';
        } else if (u === 'ABEL' && pin === '1234') {
          userData = { nombre: 'Abel Supervisor', usuario: 'ABEL', rol: 'supervisor' };
          userId = 'sv-abel';
        } else {
          throw new Error('Usuario o PIN incorrectos.');
        }
      } else {
        userData = querySnapshot.docs[0].data();
        userId = querySnapshot.docs[0].id;
      }

      // Try to sync with auth uid
      if (auth.currentUser) {
        try {
          // If they logged in by PIN, we save their anonymous UID doc so Firebase Rules allows them
          await setDoc(doc(db, 'users', auth.currentUser.uid), {
            ...userData,
            uid: auth.currentUser.uid,
            // Keep the original document ID so we know who they really are if needed
            originalDocId: userId
          }, { merge: true });
        } catch (e) {
          console.warn("Could not sync auth user doc for rules:", e);
        }
      }

      // Check permissions based on role
      const isSupervisor = userData.rol === 'supervisor';
      if (!isSupervisor && userData.rol === 'operario') {
        if (geoStatus !== 'allowed') {
          throw new Error('Los operarios deben estar en el rango de la empresa para ingresar.');
        }
      }

      if (notifPermission !== 'granted' && "Notification" in window) {
        try {
          const perm = await Notification.requestPermission();
          setNotifPermission(perm);
          if (perm === 'denied') {
            throw new Error('Debe habilitar las notificaciones para ingresar.');
          }
        } catch (e: any) {
          if (e.message.includes('notificaciones')) throw e;
          console.warn("Notification error:", e);
        }
      }

      onLogin({ ...userData, id: userId } as any, getArgentinaDate());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="w-full max-w-sm bg-white p-8 rounded-[40px] shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 to-sky-400"></div>
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-sm overflow-hidden p-2">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.src = "https://cdn-icons-png.flaticon.com/512/3649/3649255.png";
              }}
            />
          </div>
          <h1 className="text-2xl font-black text-[#0b3464] tracking-tight">Acceso Corporativo</h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">Gestión de Higiene - Arévalo</p>
          
          <div className="mt-4 flex flex-col gap-2 items-center">
            <div className="flex justify-center">
              {geoStatus === 'checking' && <div className="text-blue-500 font-bold text-[9px] uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full animate-pulse">Verificando GPS...</div>}
              {geoStatus === 'allowed' && <div className="text-emerald-600 font-bold text-[9px] uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full flex items-center gap-1"><MapPin className="w-3 h-3" /> GPS en Rango</div>}
              {geoStatus === 'outside' && <div className="text-rose-600 font-bold text-[9px] uppercase tracking-widest bg-rose-50 px-3 py-1 rounded-full flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Fuera de Zona</div>}
              {geoStatus === 'denied' && <div className="text-rose-600 font-bold text-[9px] uppercase tracking-widest bg-rose-50 px-3 py-1 rounded-full flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> GPS Requerido</div>}
            </div>

            {needsNotifAction && (
              <button 
                onClick={requestNotifPermission}
                className="flex items-center gap-2 text-amber-600 font-bold text-[9px] uppercase tracking-widest bg-amber-50 px-3 py-1 rounded-full border border-amber-200 animate-bounce"
              >
                <Bell className="w-3 h-3" /> Tocar para Activar Notificaciones
              </button>
            )}
            {notifPermission === 'granted' && (
              <div className="text-emerald-600 font-bold text-[9px] uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Alertas Activas
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {error && <div className="bg-red-50 text-red-600 text-[10px] p-3 rounded-2xl font-bold border border-red-100 flex items-start gap-2"><ShieldAlert className="w-4 h-4 shrink-0" /><p>{error}</p></div>}
          
          <form onSubmit={handlePinLogin} className="flex flex-col gap-4">
            <div className="relative group">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Usuario</label>
              <div className="relative">
                <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input type="text" value={usuario} onChange={e => setUsuario(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-5 py-3.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all" placeholder="USUARIO" />
              </div>
            </div>
            <div className="relative group">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">PIN</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input type="password" value={pin} onChange={e => setPin(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-5 py-3.5 text-center text-xl font-bold tracking-[0.5em] font-mono outline-none focus:border-blue-500 transition-all" placeholder="****" />
              </div>
            </div>

            <button disabled={loading} type="submit" className={cn("w-full py-5 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2", isButtonEnabled ? "bg-[#0b3464] text-white hover:bg-[#0d417a]" : "bg-slate-200 text-slate-400")}>
              {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <>Ingresar <MoveRight className="w-4 h-4" /></>}
            </button>
          </form>

          <div className="flex items-center gap-2 mt-4 mb-2">
            <div className="h-px bg-slate-100 flex-1"></div>
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">O con tu cuenta</span>
            <div className="h-px bg-slate-100 flex-1"></div>
          </div>

          <button 
            disabled={loading} 
            onClick={handleGoogleLogin} 
            className={cn(
              "w-full py-4 rounded-2xl font-bold text-sm transition-all border-2 flex items-center justify-center gap-3", 
              isButtonEnabled ? "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300" : "bg-slate-50 border-slate-100 text-slate-300"
            )}
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="G" />
            Ingresar con Google
          </button>
          
          {(geoStatus !== 'allowed' || notifPermission !== 'granted') && (
            <div className="bg-rose-50 p-4 rounded-3xl border border-rose-100">
               <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest text-center leading-relaxed">
                 {geoStatus !== 'allowed' && "• Se requiere GPS en rango de la empresa\n"}
                 {notifPermission !== 'granted' && "• Debe habilitar las notificaciones para ingresar"}
               </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// -- Stock Managers --

function OperarioStockManager({ user }: { user: Operario }) {
  const [solicitud, setSolicitud] = useState('');
  const [enviando, setEnviando] = useState(false);

  const handleSolicitar = async () => {
    if (!solicitud.trim()) return;
    setEnviando(true);
    try {
      await addDoc(collection(db, 'logs'), {
        operarioId: user.id || 'unknown',
        operario: user.nombre,
        accion: `Solicitud Insumos: ${solicitud}`,
        inicio: new Date().toISOString(),
        fin: new Date().toISOString(),
        duracion_minutos: 0,
        comentario: solicitud,
        estado: 'Pendiente', // For supervisor approval if needed
        createdAt: serverTimestamp()
      });
      alert("Solicitud de insumos enviada al supervisor.");
      setSolicitud('');
    } catch (error) {
      console.error("Error al solicitar:", error);
      handleFirestoreError(error, OperationType.CREATE, 'logs');
    }
    setEnviando(false);
  };

  return (
    <div className="flex-1 overflow-y-auto flex flex-col pt-4">
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm w-full">
        <h3 className="text-lg font-bold text-slate-800 mb-2">Solicitar Insumos</h3>
        <p className="text-xs text-slate-500 mb-4">Escribe los insumos que necesitas y la cantidad. El supervisor recibirá la notificación.</p>
        <textarea 
          value={solicitud}
          onChange={e => setSolicitud(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:border-blue-500 outline-none resize-none h-32 mb-4"
          placeholder="Ej: 2 Litros de Lavandina, 5 Trapos de piso, 1 Escoba..."
        />
        <button 
          onClick={handleSolicitar}
          disabled={enviando || !solicitud.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-sm uppercase transition-colors flex justify-center items-center gap-2"
        >
          {enviando ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /> Enviar Solicitud</>}
        </button>
      </div>
    </div>
  );
}

function SupervisorStockManager() {
  const [insumos, setInsumos] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [nuevoInsumo, setNuevoInsumo] = useState('');
  const [nuevaCant, setNuevaCant] = useState('');

  useEffect(() => {
    // Insumos inventory
    const unsubscribeInsumos = onSnapshot(collection(db, 'supplies'), (snapshot) => {
      setInsumos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Pedidos (we'll filter logs that are requests and pending)
    const q = query(collection(db, 'logs'), where('accion', '>=', 'Solicitud Insumos:'), where('estado', '==', 'Pendiente'));
    const unsubscribePedidos = onSnapshot(q, (snapshot) => {
      setPedidos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeInsumos();
      unsubscribePedidos();
    };
  }, []);

  const agregarInsumo = async () => {
    if (nuevoInsumo.trim() && !isNaN(Number(nuevaCant))) {
      try {
        await addDoc(collection(db, 'supplies'), {
          nombre: nuevoInsumo.trim(),
          cantidad: Number(nuevaCant),
          unidad: 'unidades',
          stock_minimo: 5,
          createdAt: serverTimestamp()
        });
        setNuevoInsumo('');
        setNuevaCant('');
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'supplies');
      }
    }
  };

  const updateCant = async (id: string, diff: number) => {
    const item = insumos.find(i => i.id === id);
    if (!item) return;
    try {
      await updateDoc(doc(db, 'supplies', id), { 
        cantidad: Math.max(0, item.cantidad + diff) 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `supplies/${id}`);
    }
  };

  const responderPedido = async (pedidoId: string, status: 'Aprobado' | 'Rechazado') => {
    try {
      await updateDoc(doc(db, 'logs', pedidoId), { estado: status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `logs/${pedidoId}`);
    }
  };

  return (
    <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col p-6 w-full max-w-4xl mx-auto gap-8">
      <div>
        <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-500" /> Aprobación de Pedidos
        </h3>
        {pedidos.filter(p => p.estado === 'Pendiente').length === 0 ? (
          <p className="text-sm text-slate-400 italic bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-200">No hay pedidos pendientes de aprobación.</p>
        ) : (
          <div className="space-y-3">
            {pedidos.filter(p => p.estado === 'Pendiente').map(p => (
              <div key={p.id} className={cn(
                "p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4",
                p.alertaConsumo ? "bg-rose-50 border-rose-200" : "bg-blue-50 border-blue-100"
              )}>
                <div className="flex gap-4">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", p.alertaConsumo ? "bg-rose-500 text-white" : "bg-blue-500 text-white")}>
                    {p.alertaConsumo ? <ShieldAlert className="w-5 h-5 animate-pulse" /> : <Package className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800">{p.insumoNombre} <span className="text-blue-600">x{p.cantidad}</span></h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{p.operarioNombre} • {new Date(p.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    {p.alertaConsumo && (
                      <p className="text-[9px] font-black text-rose-600 uppercase mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Alerta: Consumo superior al normal
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                   <button onClick={() => responderPedido(p.id, 'Rechazado')} className="bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all">Rechazar</button>
                   <button onClick={() => responderPedido(p.id, 'Aprobado')} className="bg-slate-900 text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all">Aprobar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
           <Package className="w-5 h-5 text-blue-500" /> Inventario Central
        </h3>
        
        <div className="flex gap-2 mb-6">
          <input 
            placeholder="Nuevo Insumo (Ej: Guantes Par)" 
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none"
            value={nuevoInsumo} onChange={e => setNuevoInsumo(e.target.value)}
          />
          <input 
            type="number" 
            placeholder="Cant" 
            className="w-20 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none"
            value={nuevaCant} onChange={e => setNuevaCant(e.target.value)}
          />
          <button onClick={agregarInsumo} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold"><Plus className="w-5 h-5"/></button>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-6 py-4 rounded-tl-xl rounded-bl-xl">Insumo</th>
                <th className="px-6 py-4">Cantidad Disponible</th>
                <th className="px-6 py-4 rounded-tr-xl rounded-br-xl text-right">Ajustar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {insumos.map(insumo => (
                <tr key={insumo.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-800">{insumo.nombre}</td>
                  <td className="px-6 py-4">
                    <span className={cn("px-3 py-1 rounded-full font-bold text-xs", insumo.cantidad < 5 ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600")}>
                      {insumo.cantidad}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                    <button onClick={() => updateCant(insumo.id, -1)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 w-8 h-8 rounded-lg flex items-center justify-center font-bold">-</button>
                    <button onClick={() => updateCant(insumo.id, 1)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 w-8 h-8 rounded-lg flex items-center justify-center font-bold">+</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// -- End of Components --


function useReminderChecker() {
  const [reminders] = useStickyState<Record<string, string>>({}, 'limpieza_task_reminders');
  
  useEffect(() => {
    const checkReminders = () => {
      if (Notification.permission !== "granted") return;
      
      const now = new Date();
      Object.entries(reminders).forEach(([taskId, alertTime]) => {
        const time = new Date(alertTime as string);
        // If reminder was set for "now" or "recently" (within last 1 minute) and not yet dismissed
        // In a real app we'd compare against task due date. Here we'll just check if it's "active".
        // For the demo, we'll just log or show a simple recurring check if needed.
      });
    };

    const interval = setInterval(checkReminders, 60000);
    return () => clearInterval(interval);
  }, [reminders]);
}

function SupervisorTasksManager() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [operarios, setOperarios] = useState<Operario[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 12;

  const [estadoFilter, setEstadoFilter] = useStickyState<'Todas' | 'Pendiente' | 'Completada'>('Todas', 'limpieza_sup_estado_filter');
  const [frecuenciaFilter, setFrecuenciaFilter] = useStickyState<'Todas' | 'Diaria' | 'Semanal' | 'Mensual' | 'Eventual'>('Todas', 'limpieza_sup_frecuencia_filter');
  const [operarioFilter, setOperarioFilter] = useStickyState<string>('Todos', 'limpieza_sup_operario_filter');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [expandedTaskId, setExpandedTaskId] = useState<string|number|null>(null);
  const [viewMode, setViewMode] = useState<'lista' | 'calendario' | 'metricas'>('lista');

  useEffect(() => {
    fetchData(0, true);
  }, [estadoFilter, frecuenciaFilter, operarioFilter]);

  async function fetchData(pageNum: number, isInitial: boolean = false) {
    if (isInitial) {
      setLoading(true);
      setPage(0);
    } else {
      setLoadingMore(true);
    }

    try {
      let q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'), limit(pageSize));
      
      if (frecuenciaFilter !== 'Todas') {
        q = query(collection(db, 'tasks'), where('frecuencia', '==', frecuenciaFilter), orderBy('createdAt', 'desc'), limit(pageSize));
      }
      
      const [tasksRes, usersRes] = await Promise.all([
        getDocs(q),
        getDocs(collection(db, 'users'))
      ]);

      const tasksData = tasksRes.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const usersData = usersRes.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
      const mappedData = tasksData.map((t: any) => {
        let isCompletedToday = false;
        if (t.lastCompletedDate) {
          const completedAt = new Date(t.lastCompletedDate);
          const now = new Date();
          
          if (t.frecuencia === 'Diaria' && completedAt.toDateString() === now.toDateString()) {
            isCompletedToday = true;
          } else if (t.frecuencia === 'Semanal') {
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            startOfWeek.setHours(0,0,0,0);
            if (completedAt >= startOfWeek) isCompletedToday = true;
          } else if (t.frecuencia === 'Mensual') {
            if (completedAt.getMonth() === now.getMonth() && completedAt.getFullYear() === now.getFullYear()) {
              isCompletedToday = true;
            }
          } else if (t.frecuencia === 'Eventual') {
             // Eventual task is just completed or not
             isCompletedToday = true; 
          }
        }

        return {
          ...t,
          _estadoSimulado: isCompletedToday ? 'Completada' : 'Pendiente'
        };
      });
      
      if (isInitial) {
        setTasks(mappedData);
      } else {
        setTasks(prev => [...prev, ...mappedData]);
      }
      setHasMore(tasksData.length === pageSize);
      if (usersData) {
        setOperarios(usersData as any);
      }
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.LIST, 'tasks');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchData(nextPage);
  };

  const filteredTasks = tasks.filter((t: any) => {
    const matchEstado = estadoFilter === 'Todas' || t._estadoSimulado === estadoFilter;
    const matchOperario = operarioFilter === 'Todos' || (t.asignados && t.asignados.includes(operarioFilter));
    const matchSearch = t.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      (t.descripcion || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchEstado && matchOperario && matchSearch;
  });

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string|number|null>(null);
  
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskFreq, setNewTaskFreq] = useState<'Diaria' | 'Semanal' | 'Mensual' | 'Eventual'>('Diaria');
  const [asignados, setAsignados] = useState<string[]>([]);
  const [duracionEst, setDuracionEst] = useState('');

  const resetForm = () => {
    setCreating(false);
    setEditingId(null);
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskDate('');
    setNewTaskFreq('Diaria');
    setAsignados([]);
    setDuracionEst('');
  };

  const startEdit = (t: any) => {
    setNewTaskTitle(t.titulo);
    setNewTaskDesc(t.descripcion || '');
    setNewTaskDate(t.fecha_vencimiento || '');
    setNewTaskFreq(t.frecuencia || 'Diaria');
    setAsignados(t.asignados || []);
    setDuracionEst(t.duracion_estimada_minutos ? t.duracion_estimada_minutos.toString() : '');
    setEditingId(t.id);
    setCreating(true);
  };

  const toggleAsignado = (nombre: string) => {
    setAsignados(prev => prev.includes(nombre) ? prev.filter(n => n !== nombre) : [...prev, nombre]);
  };

  const handleCreateOrEditTask = async () => {
    if (!newTaskTitle.trim()) return;
    
    const taskPayload: any = { 
      titulo: newTaskTitle.trim(), 
      frecuencia: newTaskFreq,
      descripcion: newTaskDesc || null,
      fecha_vencimiento: newTaskDate || null,
      asignados: asignados.length > 0 ? asignados : null,
      duracion_estimada_minutos: duracionEst ? parseInt(duracionEst) : null,
      updatedAt: serverTimestamp()
    };
    
    try {
      if (editingId) {
        await updateDoc(doc(db, 'tasks', editingId.toString()), taskPayload);
        setTasks(tasks.map(t => t.id === editingId ? { ...t, ...taskPayload } : t));
      } else {
        const docRef = await addDoc(collection(db, 'tasks'), { ...taskPayload, createdAt: serverTimestamp() });
        setTasks([{ id: docRef.id, ...taskPayload, _estadoSimulado: 'Pendiente' }, ...tasks]);
      }
      resetForm();
    } catch (error) {
      console.error('Error in handleCreateOrEditTask:', error);
      handleFirestoreError(error, OperationType.WRITE, 'tasks');
    }
  };

  return (
    <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col p-6 w-full max-w-4xl mx-auto">
      <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h3 className="font-bold text-xl text-slate-800 tracking-tight">Gestión Operativa</h3>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-0.5">Control y Planificación</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-2xl border border-slate-100">
          <button onClick={() => setViewMode('lista')} className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all", viewMode === 'lista' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500")}>Lista</button>
          <button onClick={() => setViewMode('calendario')} className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all", viewMode === 'calendario' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500")}>Calendario</button>
          <button onClick={() => setViewMode('metricas')} className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all", viewMode === 'metricas' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500")}>Métricas</button>
        </div>
      </div>

      <div className="w-full flex justify-between items-center mb-6">
        <h3 className="font-bold text-sm text-slate-500 uppercase tracking-widest">
          {viewMode === 'metricas' ? 'Distribución de Carga' : viewMode === 'calendario' ? 'Cronograma' : 'Plan de Tareas'}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {!creating && viewMode === 'lista' && (
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <input 
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-bold rounded-xl px-8 py-2 outline-none focus:border-blue-300 w-32 focus:w-48 transition-all"
                />
                <ClipboardList className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              </div>
              <select 
                className="bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-bold rounded-xl px-3 py-2 outline-none"
                value={estadoFilter}
                onChange={e => setEstadoFilter(e.target.value as any)}
              >
                <option value="Todas">Estados: Todos</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Completada">Completada</option>
              </select>
              <select 
                className="bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-bold rounded-xl px-3 py-2 outline-none"
                value={frecuenciaFilter}
                onChange={e => setFrecuenciaFilter(e.target.value as any)}
              >
                <option value="Todas">Frecuencias: Todas</option>
                <option value="Diaria">Diaria</option>
                <option value="Semanal">Semanal</option>
                <option value="Mensual">Mensual</option>
                <option value="Eventual">Eventual</option>
              </select>
              <select 
                className="bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-bold rounded-xl px-3 py-2 outline-none"
                value={operarioFilter}
                onChange={e => setOperarioFilter(e.target.value)}
              >
                <option value="Todos">Operarios: Todos</option>
                {operarios.filter(o => o.rol !== 'supervisor').map(op => (
                  <option key={op.nombre} value={op.nombre}>{op.nombre}</option>
                ))}
              </select>
            </div>
          )}
          <button 
             onClick={() => creating ? resetForm() : setCreating(true)}
             className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1 transition-colors ml-auto"
          >
            {creating ? 'Volver' : <><Plus className="w-4 h-4"/> Nueva Tarea</>}
          </button>
        </div>
      </div>


      {creating ? (
        <div className="w-full bg-blue-50/50 border border-blue-100 rounded-2xl p-5 mb-6 flex flex-col gap-4">
          <h4 className="text-sm font-bold text-blue-600 tracking-widest mb-2 border-b border-blue-100 pb-2">
            {editingId ? 'Editar Tarea' : 'Carga de Nueva Tarea'}
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input 
              autoFocus
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-blue-500 transition-colors"
              placeholder="Título de la tarea*"
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
            />
            <div className="flex gap-2">
              <input 
                type="number"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-blue-500 transition-colors"
                placeholder="Duración estim. (min)"
                value={duracionEst}
                onChange={e => setDuracionEst(e.target.value)}
              />
              <select 
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-blue-500 transition-colors"
                value={newTaskFreq}
                onChange={e => setNewTaskFreq(e.target.value as any)}
              >
                <option value="Diaria">Diaria</option>
                <option value="Semanal">Semanal</option>
                <option value="Mensual">Mensual</option>
                <option value="Eventual">Eventual</option>
              </select>
            </div>
          </div>
          
          <textarea 
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-colors resize-none h-20"
            placeholder="Descripción e instrucciones detalladas (opcional)"
            value={newTaskDesc}
            onChange={e => setNewTaskDesc(e.target.value)}
          />

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Asignar Operarios (Opcional)</label>
            <div className="flex flex-wrap gap-2">
               {operarios.filter(o => o.rol !== 'supervisor').map(op => (
                 <button 
                   key={op.id || op.nombre}
                   onClick={() => toggleAsignado(op.nombre)}
                   className={cn(
                     "px-3 py-1.5 rounded-full text-xs font-bold transition-colors border",
                     asignados.includes(op.nombre) 
                       ? "bg-blue-600 text-white border-blue-600 shadow-sm" 
                       : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                   )}
                 >
                   {op.nombre}
                 </button>
               ))}
               {operarios.length === 0 && <span className="text-xs text-slate-400">No hay operarios disponibles.</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <div className="flex flex-col gap-1 text-xs">
              <label className="font-bold text-slate-500">Fecha de Vencimiento</label>
              <input 
                type="date"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 outline-none focus:border-blue-500 transition-colors"
                value={newTaskDate}
                onChange={e => setNewTaskDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <button 
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3 text-sm font-bold shadow-sm transition-colors uppercase tracking-wider" 
                onClick={handleCreateOrEditTask}
              >
                {editingId ? 'Guardar Cambios' : 'Crear Tarea'}
              </button>
            </div>
          </div>
        </div>
      ) : viewMode === 'metricas' ? (
        <div className="flex flex-col gap-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 p-6 rounded-[24px] border border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-6 border-b border-slate-200 pb-2">Tareas por Operario</h4>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={operarios.filter(o => o.rol !== 'supervisor').map(op => ({
                      name: op.nombre,
                      tareas: tasks.filter(t => t.asignados?.includes(op.nombre)).length || (tasks.filter(t => !t.asignados || t.asignados.length === 0).length / (operarios.length || 1)).toFixed(1)
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{fontSize: 10}} />
                      <YAxis tick={{fontSize: 10}} />
                      <Tooltip />
                      <Bar dataKey="tareas" fill="#3b82f6" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="bg-slate-50 p-6 rounded-[24px] border border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-6 border-b border-slate-200 pb-2">Frecuencia de Tareas</h4>
                <div className="h-[250px] w-full">
                   <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                       <Pie
                         data={[
                           { name: 'Diaria', value: tasks.filter(t => t.frecuencia === 'Diaria').length },
                           { name: 'Semanal', value: tasks.filter(t => t.frecuencia === 'Semanal').length },
                           { name: 'Mensual', value: tasks.filter(t => t.frecuencia === 'Mensual').length },
                           { name: 'Eventual', value: tasks.filter(t => t.frecuencia === 'Eventual').length },
                         ]}
                         innerRadius={60}
                         outerRadius={80}
                         paddingAngle={5}
                         dataKey="value"
                       >
                         <Cell fill="#3b82f6" />
                         <Cell fill="#10b981" />
                         <Cell fill="#f59e0b" />
                         <Cell fill="#ef4444" />
                       </Pie>
                       <Tooltip />
                     </PieChart>
                   </ResponsiveContainer>
                </div>
              </div>
           </div>
        </div>
      ) : viewMode === 'calendario' ? (
        <TaskCalendarView tasks={tasks} />
      ) : (
      
      loading ? (
        <div className="p-12 flex justify-center"><RefreshCcw className="w-8 h-8 animate-spin text-slate-300" /></div>
      ) : filteredTasks.length === 0 ? (
        <div className="p-12 text-center text-slate-400 font-medium">No hay tareas en este estado.</div>
      ) : (
        <div className="w-full bg-slate-50 rounded-2xl p-4 border border-slate-100 overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="pb-3 px-2">Tarea</th>
                <th className="pb-3 px-2 hidden sm:table-cell">Frecuencia</th>
                <th className="pb-3 px-2 hidden md:table-cell">Vencimiento</th>
                <th className="pb-3 px-2">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTasks.map((t: any) => (
                <React.Fragment key={t.id}>
                  <tr 
                    className="hover:bg-slate-100 transition-colors cursor-pointer" 
                    onClick={() => setExpandedTaskId(expandedTaskId === t.id ? null : t.id)}
                  >
                    <td className="px-2 py-3 font-semibold text-slate-800 flex items-center gap-2">
                       {expandedTaskId === t.id ? <PauseCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <Play className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                       <span className="truncate max-w-[150px] sm:max-w-[250px]">{t.titulo}</span>
                    </td>
                    <td className="px-2 py-3 hidden sm:table-cell"><span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-200 px-2 py-0.5 rounded-full">{t.frecuencia}</span></td>
                    <td className="px-2 py-3 text-slate-500 font-medium hidden md:table-cell">{t.fecha_vencimiento || '-'}</td>
                    <td className="px-2 py-3">
                      <span className={cn(
                        "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                        t._estadoSimulado === 'Pendiente' ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                      )}>
                        {t._estadoSimulado}
                      </span>
                    </td>
                  </tr>
                  {expandedTaskId === t.id && (
                    <tr className="bg-slate-100/50">
                      <td colSpan={4} className="p-4 border-l-4 border-emerald-500">
                        <div className="flex flex-col sm:flex-row gap-4 justify-between">
                          <div className="text-sm flex-1">
                            <p className="font-bold text-slate-700 mb-1">Descripción:</p>
                            <p className="text-slate-600 mb-3">{t.descripcion || 'Sin descripción detallada.'}</p>
                            
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <p className="font-bold text-slate-700">Asignados:</p>
                                <p className="text-slate-600">{t.asignados && t.asignados.length > 0 ? t.asignados.join(', ') : 'Todos'}</p>
                              </div>
                              <div>
                                <p className="font-bold text-slate-700">Duración Est.:</p>
                                <p className="text-slate-600">{t.duracion_estimada_minutos ? `${t.duracion_estimada_minutos} min` : '-'}</p>
                              </div>
                              <div className="md:hidden">
                                <p className="font-bold text-slate-700">Vencimiento:</p>
                                <p className="text-slate-600">{t.fecha_vencimiento || '-'}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-start">
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 startEdit(t);
                               }}
                               className="bg-white border border-slate-200 shadow-sm px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-colors"
                             >
                               Editar Tarea
                             </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function KPICard({ title, value, icon, trend, sub }: any) {
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
      <div className="flex justify-between items-start mb-2">
        <div className="p-2 bg-slate-50 rounded-xl">{icon}</div>
        {trend && (
          <span className={cn(
            "text-[10px] font-bold px-2 py-0.5 rounded-full",
            trend.includes('+') ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
          )}>{trend}</span>
        )}
      </div>
      <p className="text-2xl font-black text-slate-800 tracking-tight">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-1">{title}</p>
      {sub && <p className="text-[9px] text-slate-300 font-bold">{sub}</p>}
      <div className="absolute -right-4 -bottom-4 bg-slate-50 w-16 h-16 rounded-full opacity-50"></div>
    </div>
  );
}

function ActivityFeed({ registros }: { registros: any[] }) {
  const recentActions = registros.slice(0, 10);
  
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-5 border-b border-slate-50 flex items-center justify-between bg-white sticky top-0 z-10">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wider">
          <RefreshCcw className="w-4 h-4 text-blue-500 animate-spin" /> Log Reciente
        </h3>
        <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-black animate-pulse">EN VIVO</span>
      </div>
      <div className="overflow-y-auto max-h-[300px] divide-y divide-slate-50">
        {recentActions.length > 0 ? recentActions.map((reg, idx) => (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            key={reg.id || idx}
            className="p-4 hover:bg-slate-50 transition-colors flex items-start gap-3"
          >
            <div className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
              reg.accion?.includes('Turno') ? "bg-emerald-100 text-emerald-600" :
              reg.accion?.includes('Descanso') ? "bg-amber-100 text-amber-600" :
              "bg-blue-100 text-blue-600"
            )}>
              {reg.accion?.includes('Turno') ? <Play className="w-4 h-4" /> :
               reg.accion?.includes('Descanso') ? <PauseCircle className="w-4 h-4" /> :
               <CheckCircle2 className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start gap-2">
                <p className="text-sm font-bold text-slate-800 truncate">{reg.operario}</p>
                <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                  {new Date(reg.inicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5 italic">
                {reg.accion}
              </p>
            </div>
          </motion.div>
        )) : (
          <div className="p-10 text-center text-slate-400 text-sm italic">
            Esperando actividad...
          </div>
        )}
      </div>
    </div>
  );
}

function JibbleHourReport({ registros, operarios, reportDateMode, setReportDateMode, reportUserFilter, setReportUserFilter, loading }: any) {
  const summarizedData = React.useMemo(() => {
    const data: any = {};
    
    registros.forEach((r: any) => {
      const date = new Date(r.inicio).toLocaleDateString('es-AR');
      const key = `${r.operario}-${date}`;
      
      if (!data[key]) {
        data[key] = {
          operario: r.operario,
          fecha: date,
          trabajo: 0,
          descanso: 0
        };
      }
      
      if (r.accion?.includes('Descanso')) {
        data[key].descanso += (r.duracion_minutos || 0);
      } else {
        data[key].trabajo += (r.duracion_minutos || 0);
      }
    });
    
    return Object.values(data).sort((a: any, b: any) => {
      const dateA = new Date(a.fecha.split('/').reverse().join('-')).getTime();
      const dateB = new Date(b.fecha.split('/').reverse().join('-')).getTime();
      return dateB - dateA;
    });
  }, [registros]);

  return (
    <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden flex-1 p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-lg text-slate-800">Hoja de Horas (Jibble Style)</h3>
        <div className="text-[10px] font-bold text-blue-500 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">Global por Operario</div>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4 mb-6 pb-6 border-b border-slate-100">
        <div className="flex-1">
          <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Periodo</label>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {['vivo', 'dia', 'semana', 'mes'].map(m => (
              <button key={m} onClick={() => setReportDateMode(m)} className={cn("flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors capitalize", reportDateMode === m ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700')}>
                {m === 'vivo' ? 'En Vivo' : m === 'dia' ? 'Diaria' : m === 'semana' ? 'Semanal' : 'Mensual'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Personal</label>
          <select 
            className="w-full sm:w-48 bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-xl px-4 py-2 outline-none h-[36px]"
            value={reportUserFilter}
            onChange={e => setReportUserFilter(e.target.value)}
          >
            <option value="Todos">Todos</option>
            {operarios.map((op: any) => (
              <option key={op.nombre} value={op.nombre}>{op.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center"><RefreshCcw className="w-8 h-8 animate-spin text-slate-300" /></div>
      ) : summarizedData.length === 0 ? (
        <div className="p-12 text-center text-slate-400 font-medium italic">No se encontraron registros en este periodo.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-4 rounded-l-xl">Operario</th>
                <th className="px-5 py-4">Día</th>
                <th className="px-5 py-4">Trabajado</th>
                <th className="px-5 py-4">Descanso</th>
                <th className="px-5 py-4 rounded-r-xl text-right">Neto Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summarizedData.map((row: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-[10px]">
                        {row.operario?.charAt(0)}
                      </div>
                      <span className="font-bold text-slate-800">{row.operario}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-500 font-medium">{row.fecha}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                      <span className="font-mono font-bold text-slate-700">{(row.trabajo / 60).toFixed(1)}h</span>
                      <span className="text-[10px] text-slate-400">{row.trabajo}m</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                      <span className="font-mono font-bold text-slate-700">{(row.descanso / 60).toFixed(1)}h</span>
                      <span className="text-[10px] text-slate-400">{row.descanso}m</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="bg-slate-100 px-3 py-1 rounded-lg font-mono font-black text-slate-800">
                      {((row.trabajo + row.descanso) / 60).toFixed(1)}h
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TaskCalendarView({ tasks }: { tasks: any[] }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedDayTasks, setSelectedDayTasks] = useState<{tasks: any[], date: string} | null>(null);
  
  const daysInMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1).getDay();
  
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  return (
    <div className="flex flex-col gap-6 mt-6">
      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" /> Planificación Mensual
          </h3>
          <div className="flex items-center gap-4 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
            <button onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1))} className="p-1 hover:bg-white rounded-lg shadow-sm">
               <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
            <span className="text-xs font-bold text-slate-600 min-w-[100px] text-center">{monthNames[selectedMonth.getMonth()]} {selectedMonth.getFullYear()}</span>
            <button onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1))} className="p-1 hover:bg-white rounded-lg shadow-sm">
               <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-7 gap-2">
          {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map(d => (
            <div key={d} className="text-center text-[10px] font-black text-slate-400 py-2 uppercase">{d}</div>
          ))}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="h-16 lg:h-20 bg-slate-50/50 rounded-xl" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${selectedMonth.getFullYear()}-${(selectedMonth.getMonth() + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            const dayTasks = tasks.filter(t => t.fecha_vencimiento === dateStr);
            const isSelected = selectedDayTasks?.date === dateStr;
            
            return (
              <div 
                key={day} 
                onClick={() => dayTasks.length > 0 ? setSelectedDayTasks(isSelected ? null : { tasks: dayTasks, date: dateStr }) : null}
                className={cn(
                  "h-16 lg:h-20 p-2 border rounded-2xl flex flex-col gap-1 overflow-hidden transition-all relative cursor-pointer",
                  dayTasks.length > 0 ? (isSelected ? "border-blue-500 bg-blue-50/50 shadow-sm" : "bg-white border-slate-100 hover:border-blue-200") : "bg-white border-slate-50 opacity-40 cursor-default"
                )}
              >
                <span className={cn("text-[10px] font-black", dayTasks.length > 0 ? "text-slate-800" : "text-slate-300")}>{day}</span>
                <div className="flex flex-wrap gap-0.5 mt-auto">
                  {dayTasks.map((_, idx) => (
                    <div key={idx} className="w-1 h-1 bg-blue-400 rounded-full" />
                  ))}
                </div>
                {dayTasks.length > 0 && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />}
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedDayTasks && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white p-6 rounded-[32px] border border-blue-100 shadow-xl shadow-blue-50/50">
              <div className="flex justify-between items-center mb-6">
                <div>
                   <h4 className="font-black text-slate-800 tracking-tight flex items-center gap-2">
                     <ClipboardList className="w-5 h-5 text-blue-500" />
                     Tareas del {new Date(selectedDayTasks.date + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
                   </h4>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedDayTasks.tasks.length} {selectedDayTasks.tasks.length === 1 ? 'tarea' : 'tareas'} programadas</p>
                </div>
                <button 
                  onClick={() => setSelectedDayTasks(null)}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-400 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedDayTasks.tasks.map((task) => (
                  <div key={task.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-blue-200 transition-colors group">
                    <div className="flex justify-between items-start mb-2">
                      <h5 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{task.titulo}</h5>
                      <span className="text-[8px] font-black uppercase text-slate-400 bg-white border border-slate-100 px-2 py-0.5 rounded-lg">{task.frecuencia}</span>
                    </div>
                    {task.descripcion && <p className="text-[11px] text-slate-500 mb-3 line-clamp-2 italic">"{task.descripcion}"</p>}
                    <div className="flex items-center gap-2 mt-auto pt-3 border-t border-slate-200/50">
                      <UserCircle className="w-4 h-4 text-slate-400" />
                      <div className="flex flex-wrap gap-1">
                        {task.asignados && task.asignados.length > 0 ? (
                          task.asignados.map((as: string, idx: number) => (
                            <span key={idx} className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{as}</span>
                          ))
                        ) : (
                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Todos los operarios</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function OperarioStatusGrid({ operarios, registros }: { operarios: any[], registros: any[] }) {
  const currentStates = React.useMemo(() => {
    return operarios.map(op => {
      // Find the latest record for this operario in the current session (last 12h)
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
      const opLogs = registros
        .filter(r => r.operario === op.nombre && r.inicio >= twelveHoursAgo)
        .sort((a,b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime());
      
      const latest = opLogs[0];
      
      if (!latest) return { ...op, status: 'offline', task: null };
      
      // If the latest record has no 'fin', they are active in that action
      if (!latest.fin) {
        if (latest.accion.includes('Descanso')) return { ...op, status: 'rest', task: 'En Descanso' };
        if (latest.accion.includes('Turno')) return { ...op, status: 'active', task: 'Disponible / Sin tarea' };
        if (latest.accion.includes('Tarea:')) return { ...op, status: 'active', task: latest.accion.replace('Tarea: ', '') };
        return { ...op, status: 'active', task: latest.accion };
      }
      
      // If the latest record has 'fin', but it was a "Turno (Tramo)" or "Tarea" ending, they might be idle
      // For simplicity, if finished less than 5 mins ago, mark as "Idle", otherwise "Offline"
      const finTime = new Date(latest.fin).getTime();
      const now = Date.now();
      if (now - finTime < 5 * 60 * 1000) return { ...op, status: 'idle', task: 'Recién terminó tarea' };
      
      return { ...op, status: 'offline', task: null };
    });
  }, [operarios, registros]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
      <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 text-sm uppercase tracking-wider">
        <Activity className="w-5 h-5 text-emerald-500" /> Estado del Personal
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentStates.map((op, idx) => (
          <div key={idx} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-400">
                <UserCircle className="w-8 h-8" />
              </div>
              <div className={cn(
                "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white",
                op.status === 'active' ? "bg-emerald-500" : 
                op.status === 'rest' ? "bg-amber-500" :
                op.status === 'idle' ? "bg-blue-400" : "bg-slate-300"
              )}></div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800 truncate">{op.nombre}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={cn(
                  "text-[9px] font-black uppercase px-1.5 py-0.5 rounded",
                  op.status === 'active' ? "bg-emerald-100 text-emerald-700" : 
                  op.status === 'rest' ? "bg-amber-100 text-amber-700" :
                  op.status === 'idle' ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500"
                )}>
                  {op.status === 'active' ? 'Activo' : op.status === 'rest' ? 'Descanso' : op.status === 'idle' ? 'Libre' : 'Offline'}
                </span>
                {op.task && (
                  <span className="text-[10px] text-slate-400 truncate font-medium">
                    • {op.task}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UserProfile({ user, onUpdate }: { user: Operario, onUpdate: (u: Operario) => void }) {
  const [nombre, setNombre] = useState(user.nombre);
  const [usuario, setUsuario] = useState(user.usuario || '');
  const [email, setEmail] = useState(user.email || '');
  const [pin, setPin] = useState(user.pin || '');
  const [whatsapp, setWhatsapp] = useState(user.whatsapp ? user.whatsapp.replace(/^549/, '') : '');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clean spaces and ensure only digits
    const cleanNumber = whatsapp.replace(/\D/g, '');
    
    if (!cleanNumber.trim()) {
      setMsg({ text: 'El número de WhatsApp es obligatorio', type: 'error' });
      return;
    }

    setLoading(true);
    setMsg({ text: '', type: '' });
    try {
      const userRef = doc(db, 'users', user.id!);
      const fullWhatsapp = '549' + cleanNumber;
      const updates = {
        nombre,
        usuario: usuario.toUpperCase(),
        email,
        pin,
        whatsapp: fullWhatsapp
      };
      await updateDoc(userRef, updates);
      onUpdate({ ...user, ...updates });
      setMsg({ text: 'Perfil actualizado con éxito', type: 'success' });
    } catch (err: any) {
      setMsg({ text: 'Error: ' + err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm w-full mx-auto"
    >
      <h2 className="text-xl font-black text-[#0b3464] mb-6 flex items-center gap-2">
        <UserCircle className="w-6 h-6" /> Mi Perfil
      </h2>

      <form onSubmit={handleUpdate} className="space-y-4">
        {msg.text && (
          <div className={cn("p-4 rounded-xl text-xs font-bold", msg.type === 'success' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>
            {msg.text}
          </div>
        )}

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nombre Completo</label>
          <input 
            type="text" value={nombre} onChange={e => setNombre(e.target.value)}
            required
            className="w-full bg-slate-50 border-2 border-slate-100 focus:border-blue-500 rounded-2xl px-5 py-3 font-bold outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Usuario</label>
          <input 
            type="text" value={usuario} onChange={e => setUsuario(e.target.value)}
            className="w-full bg-slate-50 border-2 border-slate-100 focus:border-blue-500 rounded-2xl px-5 py-3 font-bold outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Email</label>
          <div className="relative">
            <input 
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              disabled={!!user.email && user.email.includes('@')}
              className="w-full bg-slate-100 border-2 border-slate-100 rounded-2xl px-5 py-3 font-bold outline-none opacity-60"
            />
            {user.email && <ShieldCheck className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />}
          </div>
          <p className="text-[9px] text-slate-400 mt-1 ml-1 uppercase font-bold tracking-tight">* Autenticación vinculada</p>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">WhatsApp (Argentina)</label>
          <div className="flex bg-slate-50 border-2 border-slate-100 focus-within:border-blue-500 rounded-2xl overflow-hidden transition-colors">
            <div className="bg-slate-100/50 px-4 py-3 font-black text-slate-400 border-r border-slate-100 flex items-center shrink-0 text-xs">
              +54 9
            </div>
            <input 
              type="tel" 
              value={whatsapp} 
              onChange={e => {
                const val = e.target.value.replace(/\D/g, ''); // Keep only numbers
                setWhatsapp(val);
              }}
              placeholder="Ej: 3815025897"
              required
              className="flex-1 bg-transparent px-5 py-3 font-bold outline-none"
            />
          </div>
          <p className="text-[8px] text-slate-400 mt-1 ml-1 leading-tight">Ingresa el código de área + número sin 0 ni 15. Indispensable para alertas.</p>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">PIN / Contraseña</label>
          <input 
            type="text" value={pin} onChange={e => setPin(e.target.value)}
            className="w-full bg-slate-50 border-2 border-slate-100 focus:border-blue-500 rounded-2xl px-5 py-3 font-bold outline-none text-center text-xl tracking-widest font-mono"
          />
        </div>

        <button 
          type="submit" disabled={loading}
          className="w-full bg-[#0b3464] text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-blue-900/10 active:scale-95 transition-all mt-4"
        >
          {loading ? <RefreshCcw className="w-6 h-6 animate-spin mx-auto text-white/50" /> : 'Guardar Cambios'}
        </button>
      </form>
    </motion.div>
  );
}

function PersonalManagement() {
  const [users, setUsers] = useState<Operario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('nombre', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Operario)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users');
    });
    return () => unsubscribe();
  }, []);

  const toggleRole = async (user: Operario) => {
    if (!user.id) return;
    const userRef = doc(db, 'users', user.id);
    const nextRole = user.rol === 'supervisor' ? 'operario' : 'supervisor';
    try {
      await updateDoc(userRef, { rol: nextRole });
    } catch (err) {
      console.error(err);
    }
  };

  const toggleActive = async (user: Operario) => {
    if (!user.id) return;
    const userRef = doc(db, 'users', user.id);
    try {
      await updateDoc(userRef, { activo: !user.activo });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-slate-800">Módulo de Personal</h2>
        <div className="flex bg-white px-4 py-2 rounded-xl border border-slate-200">
           <span className="text-sm font-bold text-slate-500">Total: {users.length}</span>
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre / Usuario</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rol</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-800">{u.nombre}</span>
                      <span className="text-[10px] font-black text-blue-500 tracking-wider uppercase">@{u.usuario || 'SIN_USUARIO'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      u.rol === 'supervisor' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                    )}>
                      {u.rol}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <span className={cn(
                      "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest",
                      u.activo ? "text-emerald-500" : "text-rose-500"
                    )}>
                      <div className={cn("w-2 h-2 rounded-full", u.activo ? "bg-emerald-500 animate-pulse" : "bg-rose-500")} />
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                     <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => toggleRole(u)}
                          className="p-2 hover:bg-amber-50 text-amber-600 rounded-xl transition-colors"
                          title="Cambiar Rol"
                        >
                           <ShieldAlert className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => toggleActive(u)}
                          className={cn(
                            "p-2 rounded-xl transition-colors",
                            u.activo ? "hover:bg-rose-50 text-rose-500" : "hover:bg-emerald-50 text-emerald-500"
                          )}
                          title={u.activo ? "Desactivar" : "Activar"}
                        >
                           {u.activo ? <X className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                        </button>
                     </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && <div className="p-20 flex justify-center"><RefreshCcw className="w-8 h-8 animate-spin text-slate-200" /></div>}
        {users.length === 0 && !loading && <div className="p-20 text-center text-slate-400 font-bold tracking-widest uppercase text-xs">No se encontraron usuarios.</div>}
      </div>
    </div>
  );
}

function SupervisorDashboard({ user, onLogout, onUserUpdate }: { user: Operario, onLogout: () => void, onUserUpdate: (u: Operario) => void }) {
  const [tab, setTab] = useState<'dashboard' | 'tareas' | 'reportes' | 'stock' | 'turnos' | 'incidencias' | 'anuncios' | 'metricas' | 'personal' | 'perfil'>('dashboard');
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  // Filters for Reportes & Dashboard
  const [reportDateMode, setReportDateMode] = useState<'dia'|'semana'|'mes'|'vivo'>('vivo');
  const [reportUserFilter, setReportUserFilter] = useState('Todos');
  const [operarios, setOperarios] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [stock, setStock] = useState<any[]>([]);

  const handleLogoutAdmin = () => {
    onLogout();
  };

  useEffect(() => {
    // Real-time subscription for live activity feed using onSnapshot
    const q = query(collection(db, 'logs'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRegistros(logs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'logs');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      
      // Basic data needed for dashboard
      const fetchOps = async () => {
        if (operarios.length === 0) {
          try {
            const querySnapshot = await getDocs(collection(db, 'users'));
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setOperarios(data);
          } catch (error) {
            handleFirestoreError(error, OperationType.LIST, 'users');
          }
        }
      };

      const fetchTasks = async () => {
        try {
          const querySnapshot = await getDocs(collection(db, 'tasks'));
          const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setTasks(data);
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, 'tasks');
        }
      };
      
      const fetchStock = async () => {
        try {
          const querySnapshot = await getDocs(collection(db, 'supplies'));
          const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setStock(data);
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, 'supplies');
        }
      };

      if (tab === 'reportes' || tab === 'dashboard') {
        let q = query(collection(db, 'logs'), orderBy('inicio', 'desc'));
        
        let startDate = new Date();
        if (reportDateMode === 'vivo') {
          startDate.setHours(startDate.getHours() - 12);
          q = query(collection(db, 'logs'), where('inicio', '>=', startDate.toISOString()), orderBy('inicio', 'desc'), limit(200));
        } else if (reportDateMode === 'dia') {
          startDate.setHours(0,0,0,0);
          q = query(collection(db, 'logs'), where('inicio', '>=', startDate.toISOString()), orderBy('inicio', 'desc'));
        } else if (reportDateMode === 'semana') {
          startDate.setDate(startDate.getDate() - 7);
          q = query(collection(db, 'logs'), where('inicio', '>=', startDate.toISOString()), orderBy('inicio', 'desc'));
        } else if (reportDateMode === 'mes') {
          startDate.setMonth(startDate.getMonth() - 1);
          q = query(collection(db, 'logs'), where('inicio', '>=', startDate.toISOString()), orderBy('inicio', 'desc'));
        }

        try {
          const [regSnapshot] = await Promise.all([
            getDocs(q),
            fetchOps(),
            fetchTasks(),
            fetchStock()
          ]);
          
          let finalData: any[] = regSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          if (reportUserFilter !== 'Todos') {
            finalData = finalData.filter(d => d.operario === reportUserFilter);
          }
          setRegistros(finalData);
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, 'logs');
        }
      } else {
        await Promise.all([fetchOps(), fetchTasks(), fetchStock()]);
      }
      setLoading(false);
    }
    fetchData();
  }, [tab, reportDateMode, reportUserFilter]);

  // Analytics Helpers
  const metrics = React.useMemo(() => {
    if (!registros) return { totalMinutes: 0, avgTask: 0, activeNow: 0 };
    const totalMinutes = registros.reduce((acc, r) => acc + (r.duracion_minutos || 0), 0);
    const completedTasks = registros.filter(r => r.accion && !r.accion.includes('Turno') && !r.accion.includes('Descanso')).length;
    const activeOps = new Set(registros.filter(r => {
      const now = new Date();
      const startTime = new Date(r.inicio);
      return !r.fin && (now.getTime() - startTime.getTime() < 12 * 60 * 60 * 1000); // Simple "still active" check if no end time and recent
    }).map(r => r.operario)).size;

    return {
      totalHours: (totalMinutes / 60).toFixed(1),
      completedTasks,
      activeOps: registros.filter(r => !r.fin).length, // Simplified for demo
      avgTask: completedTasks > 0 ? (totalMinutes / completedTasks).toFixed(0) : 0
    };
  }, [registros]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      
      {/* SIDE MENU OVERLAY (SUPERVISOR) */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[90]"
            />
            <motion.div 
              initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-0 left-0 bottom-0 w-[300px] bg-white z-[100] shadow-2xl flex flex-col p-8"
            >
              <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center border border-slate-100 overflow-hidden p-1">
                    <img 
                      src="/logo.png" 
                      alt="Logo" 
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/3649/3649255.png';
                      }}
                    />
                  </div>
                  <span className="font-bold text-xl tracking-tight text-brand-blue">Panel Arévalo</span>
                </div>
                <button onClick={() => setMenuOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <nav className="flex flex-col gap-2">
                <button 
                  onClick={() => { setTab('dashboard'); setMenuOpen(false); }}
                  className={cn(
                    "flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all",
                    tab === 'dashboard' ? "bg-blue-50 text-blue-600 shadow-sm" : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <ShieldAlert className="w-6 h-6" />
                  <span>Panel General</span>
                </button>
                <button 
                  onClick={() => { setTab('incidencias'); setMenuOpen(false); }}
                  className={cn(
                    "flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all",
                    tab === 'incidencias' ? "bg-rose-50 text-rose-600 shadow-sm" : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <AlertTriangle className="w-6 h-6" />
                  <span>Incidencias / Tickets</span>
                </button>

                <button 
                  onClick={() => { setTab('anuncios'); setMenuOpen(false); }}
                  className={cn(
                    "flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all",
                    tab === 'anuncios' ? "bg-blue-50 text-blue-600 shadow-sm" : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <Megaphone className="w-6 h-6" />
                  <span>Comunicados</span>
                </button>
                <button 
                  onClick={() => { setTab('metricas'); setMenuOpen(false); }}
                  className={cn(
                    "flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all",
                    tab === 'metricas' ? "bg-amber-50 text-amber-600 shadow-sm" : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <BarChart2 className="w-6 h-6" />
                  <span>Productividad</span>
                </button>
                <button 
                  onClick={() => { setTab('reportes'); setMenuOpen(false); }}
                  className={cn(
                    "flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all",
                    tab === 'reportes' ? "bg-blue-50 text-blue-600 shadow-sm" : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <FileText className="w-6 h-6" />
                  <span>Reportes / Horas</span>
                </button>
                <button 
                  onClick={() => { setTab('tareas'); setMenuOpen(false); }}
                  className={cn(
                    "flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all",
                    tab === 'tareas' ? "bg-blue-50 text-blue-600 shadow-sm" : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <ClipboardList className="w-6 h-6" />
                  <span>Gestor Tareas</span>
                </button>
                <button 
                  onClick={() => { setTab('turnos'); setMenuOpen(false); }}
                  className={cn(
                    "flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all",
                    tab === 'turnos' ? "bg-blue-50 text-blue-600 shadow-sm" : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <Calendar className="w-6 h-6" />
                  <span>Gestión Turnos</span>
                </button>
                <button 
                  onClick={() => { setTab('personal'); setMenuOpen(false); }}
                  className={cn(
                    "flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all",
                    tab === 'personal' ? "bg-blue-50 text-blue-600 shadow-sm" : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <Users className="w-6 h-6" />
                  <span>Personal</span>
                </button>
                <button 
                  onClick={() => { setTab('perfil'); setMenuOpen(false); }}
                  className={cn(
                    "flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all",
                    tab === 'perfil' ? "bg-blue-50 text-blue-600 shadow-sm" : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <UserCircle className="w-6 h-6" />
                  <span>Mi Perfil</span>
                </button>
                <button 
                  onClick={() => { setTab('stock'); setMenuOpen(false); }}
                  className={cn(
                    "flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all",
                    tab === 'stock' ? "bg-blue-50 text-blue-600 shadow-sm" : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <Plus className="w-6 h-6" />
                  <span>Control Stock</span>
                </button>
                
                <div className="my-6 border-t border-slate-100" />
                
                <button 
                  onClick={handleLogoutAdmin}
                  className="flex items-center gap-4 px-5 py-4 rounded-2xl font-bold text-rose-500 hover:bg-rose-50 transition-all"
                >
                  <LogOut className="w-6 h-6" />
                  <span>Cerrar Sesión</span>
                </button>
              </nav>

              <div className="mt-auto p-4 bg-slate-50 rounded-2xl border border-slate-100">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                     {user.nombre.charAt(0)}
                   </div>
                   <div>
                     <p className="text-sm font-bold text-slate-800 leading-tight">{user.nombre}</p>
                     <p className="text-[10px] uppercase tracking-widest text-blue-500 font-bold">{user.rol}</p>
                   </div>
                 </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <header className="bg-brand-blue text-white px-6 py-4 flex justify-between items-center z-50 sticky top-0 shadow-sm border-b border-white/10">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setMenuOpen(true)}
            className="p-2.5 bg-white/10 text-white hover:text-blue-100 hover:bg-white/20 rounded-2xl transition-all border border-white/5"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        <div className="flex items-center gap-3 text-right">
          <div className="hidden xs:block">
            <h2 className="text-sm font-bold text-white leading-tight truncate max-w-[150px]">{user.nombre}</h2>
          </div>
          <button 
            onClick={handleLogoutAdmin}
            className="bg-transparent p-2 rounded-2xl border border-transparent text-white hover:bg-white/10 transition-colors"
            title="Cerrar Sesión"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </header>

      <div className="p-4 sm:p-8 flex-1 max-w-5xl mx-auto w-full flex flex-col gap-6">
        
        {/* TAB CONTENT (Controlled by Sidebar Menu) */}
        {tab === 'dashboard' && (
          <div className="flex flex-col gap-6">
            {/* KPI ROW */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard title="Horas Totales" value={metrics.totalHours + 'h'} icon={<Clock className="w-5 h-5 text-blue-500"/>} trend="+5%" />
              <KPICard title="Tareas Realizadas" value={metrics.completedTasks} icon={<CheckCircle2 className="w-5 h-5 text-emerald-500"/>} trend="+12" />
              <KPICard title="Personal Activo" value={metrics.activeOps} icon={<UserCircle className="w-5 h-5 text-amber-500"/>} trend="Vivo" />
              <KPICard title="Eficacia Media" value={metrics.avgTask + 'm'} icon={<RefreshCcw className="w-5 h-5 text-indigo-500"/>} sub="Min/Tarea" />
            </div>

            {/* FILTERS FOR DASHBOARD */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap gap-4 items-center justify-between">
               <div className="flex bg-slate-100 p-1 rounded-xl">
                  {['vivo', 'dia', 'semana', 'mes'].map(m => (
                    <button 
                      key={m}
                      onClick={() => setReportDateMode(m as any)}
                      className={cn("px-4 py-1.5 text-xs font-bold rounded-lg capitalize", reportDateMode === m ? "bg-white shadow-sm text-blue-600" : "text-slate-500")}
                    >
                      {m === 'vivo' ? 'En Vivo' : m === 'dia' ? 'Hoy' : m === 'semana' ? 'Semana' : 'Mes'}
                    </button>
                  ))}
               </div>
               <div className="text-xs text-slate-400 font-medium">
                  Datos actualizados: {new Date().toLocaleTimeString()}
               </div>
            </div>

            <OperarioStatusGrid operarios={operarios} registros={registros} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               {/* BAR CHART: HOURS PER WORKER */}
               <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
                  <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 shrink-0">
                    <UserCircle className="w-5 h-5 text-blue-500" /> Horas por Operario
                  </h3>
                  <div className="h-[250px] w-full flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={
                        operarios.map(op => ({
                          name: op.nombre,
                          horas: parseFloat((registros.filter(r => r.operario === op.nombre).reduce((acc, r) => acc + (r.duracion_minutos || 0), 0) / 60).toFixed(1))
                        })).filter(d => d.horas > 0).sort((a,b) => b.horas - a.horas)
                      }>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                        <Tooltip 
                          contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                          cursor={{fill: '#f8fafc'}}
                        />
                        <Bar dataKey="horas" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
               </div>

               {/* REAL-TIME ACTIVITY FEED */}
               <ActivityFeed registros={registros} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               {/* PIE CHART: TASK STATUS */}
               <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-emerald-500" /> Resumen de Tareas
                  </h3>
                  <div className="h-[250px] w-full flex flex-col items-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Completadas', value: metrics.completedTasks },
                            { name: 'Pendientes', value: tasks.length - metrics.completedTasks > 0 ? tasks.length - metrics.completedTasks : 2 } // Mock some pendings if none
                          ]}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          <Cell fill="#10b981" />
                          <Cell fill="#f1f5f9" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex gap-4 text-xs font-bold -mt-4">
                       <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Realizadas</span>
                       <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-200"></span> Pendientes</span>
                    </div>
                  </div>
               </div>

               {/* LOWER ROW: STOCK & RECENT ALERTS */}
               <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-rose-500" /> Alertas de Insumos Críticos
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {stock.filter(s => s.cantidad < 5).map(s => (
                      <div key={s.id} className="flex items-center justify-between p-3 bg-rose-50 rounded-xl border border-rose-100">
                          <span className="text-sm font-bold text-slate-700">{s.nombre}</span>
                          <span className="text-xs font-black text-rose-600 bg-white px-2 py-1 rounded-lg">Quedan {s.cantidad}</span>
                      </div>
                    ))}
                    {stock.filter(s => s.cantidad < 5).length === 0 && <p className="text-slate-400 text-sm">No hay faltantes críticos.</p>}
                  </div>
               </div>
            </div>

          </div>
        )}

        {tab === 'incidencias' && <SupervisorIncidentsLog />}
        {tab === 'anuncios' && <SupervisorAnnouncements />}
        {tab === 'metricas' && <SupervisorProductivityStats registros={registros} operarios={operarios} tasks={tasks} />}
        {tab === 'reportes' && (
          <div className="flex flex-col gap-6">
            <JibbleHourReport registros={registros} operarios={operarios} reportDateMode={reportDateMode} setReportDateMode={setReportDateMode} reportUserFilter={reportUserFilter} setReportUserFilter={setReportUserFilter} loading={loading} />
          </div>
        )}

        {tab === 'tareas' && (
          <div className="w-full flex-1">
             <SupervisorTasksManager />
          </div>
        )}

        {tab === 'turnos' && (
          <SupervisorShiftManager />
        )}

        {tab === 'stock' && (
          <SupervisorStockManager />
        )}

        {tab === 'personal' && (
          <PersonalManagement />
        )}

        {tab === 'perfil' && (
          <UserProfile user={user} onUpdate={onUserUpdate} />
        )}
      </div>
    </div>
  );
}
