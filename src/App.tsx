import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Play, Square, PauseCircle, LogOut, CheckCircle2, UserCircle, RefreshCcw, Plus, Calendar, FileText, ClipboardList, ShieldAlert, Bell, Menu, X, Activity, WifiOff, Coffee, Monitor, LayoutGrid, MoveRight, QrCode, MapPin, AlertTriangle, Package, ShieldCheck, ChevronRight, Camera, Key, Home } from 'lucide-react';
import { supabase } from './supabaseClient';
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
  const [incidencias, setIncidencias] = useState<any[]>(INCIDENCIAS_MOCK);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);

  useEffect(() => {
    const loadIncidencias = () => {
      const db = JSON.parse(localStorage.getItem('incidencias_db') || '[]');
      // Fix dates for mock while merging
      const mockWithDate = INCIDENCIAS_MOCK.map(m => ({ ...m, fecha: m.fecha || new Date().toISOString() }));
      setIncidencias([...db, ...mockWithDate]);
    };
    loadIncidencias();
    const interval = setInterval(loadIncidencias, 5000);
    return () => clearInterval(interval);
  }, []);

  const updateStatus = (id: string, newStatus: string) => {
    const db = JSON.parse(localStorage.getItem('incidencias_db') || '[]');
    const isMock = INCIDENCIAS_MOCK.some(m => m.id === id);
    
    if (isMock) {
      setIncidencias(prev => prev.map(inc => inc.id === id ? { ...inc, estado: newStatus } : inc));
    } else {
      const updated = db.map((inc: any) => inc.id === id ? { ...inc, estado: newStatus } : inc);
      localStorage.setItem('incidencias_db', JSON.stringify(updated));
      setIncidencias(prev => prev.map(inc => inc.id === id ? { ...inc, estado: newStatus } : inc));
    }
    
    if (selectedIncident?.id === id) {
      setSelectedIncident((prev: any) => ({ ...prev, estado: newStatus }));
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

function SupervisorAnnouncements() {
  const [msg, setMsg] = useState('');
  const [history, setHistory] = useState<any[]>([]);

  const sendAnnouncement = () => {
    if (!msg.trim()) return;
    const item = { id: Date.now(), text: msg.trim(), date: new Date().toISOString() };
    const saved = JSON.parse(localStorage.getItem('announcements_db') || '[]');
    const updated = [item, ...saved];
    setHistory(updated);
    localStorage.setItem('announcements_db', JSON.stringify(updated));
    setMsg('');
    alert("Comunicado enviado a todo el personal.");
  };

  useEffect(() => {
    const loadAnnouncements = () => {
      setHistory(JSON.parse(localStorage.getItem('announcements_db') || '[]'));
    };
    loadAnnouncements();
    const interval = setInterval(loadAnnouncements, 5000);
    return () => clearInterval(interval);
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
      const { data } = await supabase.from('Limpieza_Tareas_Plan').select('*');
      if (data) setCatTareas(data);
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
  nombre: string;
  rol: 'operario' | 'supervisor';
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

    // In a real app, this would be a supabase insert
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

  const handleReport = async () => {
    if (!desc) return;
    setLoading(true);
    
    const nuevaIncidencia = {
      id: Date.now().toString(),
      autor: user.nombre,
      tipo,
      urgencia,
      descripcion: desc,
      fecha: new Date().toISOString(),
      estado: 'Abierto'
    };

    // Save to simulate persistence
    const current = JSON.parse(localStorage.getItem('incidencias_db') || '[]');
    localStorage.setItem('incidencias_db', JSON.stringify([nuevaIncidencia, ...current]));

    setTimeout(() => {
      setLoading(false);
      alert("Su reporte ha sido enviado al supervisor inmediatamente.");
      onReported();
    }, 1500);
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white border-2 border-rose-100 rounded-[32px] p-6 shadow-2xl shadow-rose-50 mb-10">
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
    </motion.div>
  );
}

interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  isSupervisor?: boolean;
}

function ChatModule({ user }: { user: Operario }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    const loadMessages = () => {
      const saved = JSON.parse(localStorage.getItem('corporate_chat') || '[]');
      setMessages(saved);
    };
    loadMessages();
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = () => {
    if (!inputText.trim()) return;
    const newMessage: Message = {
      id: Date.now().toString(),
      sender: user.nombre,
      text: inputText.trim(),
      timestamp: new Date().toISOString(),
      isSupervisor: user.rol === 'supervisor'
    };
    const updated = [...messages, newMessage];
    setMessages(updated);
    localStorage.setItem('corporate_chat', JSON.stringify(updated));
    setInputText('');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col h-full max-h-[500px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-black text-slate-800 tracking-tight leading-none mb-1">Chat Corporativo</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Comunicación Directa con Supervisión</p>
        </div>
      </div>
      
      <div className="flex-1 bg-slate-50 rounded-3xl p-4 overflow-y-auto mb-4 space-y-3 min-h-[300px]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-30">
            <Monitor className="w-12 h-12 mb-2" />
            <p className="text-xs font-bold uppercase tracking-widest">Inicia la conversación</p>
          </div>
        ) : (
          messages.map(m => (
            <div key={m.id} className={cn(
              "max-w-[80%] p-3 rounded-2xl text-xs font-medium",
              m.sender === user.nombre ? "bg-blue-600 text-white ml-auto rounded-br-none" : "bg-white border border-slate-100 text-slate-800 mr-auto rounded-bl-none"
            )}>
              <div className="flex justify-between items-center mb-1 gap-4">
                <span className="font-black text-[9px] uppercase opacity-70 tracking-tighter">{m.sender}</span>
                <span className="text-[8px] opacity-50">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p>{m.text}</p>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input 
          type="text" 
          value={inputText}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          onChange={e => setInputText(e.target.value)}
          placeholder="Escribe un mensaje..."
          className="flex-1 bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:border-blue-500 outline-none"
        />
        <button 
          onClick={sendMessage}
          className="bg-slate-900 text-white p-3 rounded-2xl shadow-lg active:scale-95 transition-transform"
        >
          <MoveRight className="w-6 h-6" />
        </button>
      </div>
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
        <div className="bg-white/20 p-1 rounded-xl">
          <img 
            src="/regenerated_image_1777551940944.png" 
            alt="Logo" 
            className="w-6 h-6 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/1048/1048953.png';
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
  const [loginDate, setLoginDate] = useStickyState<string | null>(null, 'limpieza_login_date');
  
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
  const [activeTab, setActiveTab] = useState<'tareas' | 'horarios' | 'insumos' | 'incidencias' | 'capacitacion' | 'rrhh'>('tareas');
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
      if (!user) return;
      const { data } = await supabase.from('Limpieza_Tareas_Plan').select('id, fecha_vencimiento, titulo').order('id', { ascending: false }).limit(10);
      if (data) {
        const urgentes = data.filter(d => d.fecha_vencimiento);
        setNotificationsCount(urgentes.length > 0 ? urgentes.length : (data.length > 0 ? 1 : 0));
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

  const performGlobalLogout = () => {
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
    if (window.confirm("¿Está seguro que desea cerrar sesión? Se perderá el estado de la tarea en curso si no la finaliza.")) {
      performGlobalLogout();
    }
  };

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
        <SupervisorDashboard user={user} onLogout={performGlobalLogout} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center w-full font-sans text-slate-800">
      <InstallBanner installProps={installProps} />
      <div className="w-full max-w-[375px] bg-white min-h-screen md:min-h-[720px] md:h-[720px] md:rounded-[40px] md:shadow-2xl md:border-[8px] md:border-slate-900 overflow-hidden relative flex flex-col pb-8">
        
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
                      src="/regenerated_image_1777551940944.png" 
                      alt="Logo" 
                      className="w-12 h-12 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/1048/1048953.png';
                      }}
                    />
                    <span className="font-bold text-lg tracking-tight">Limpieza Arevalo</span>
                  </div>
                  <button onClick={() => setMenuOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <nav className="flex-1 overflow-y-auto pr-2 flex flex-col gap-1">
                  {[
                    { id: 'tareas', icon: Home, label: 'Inicio' },
                    { id: 'horarios', icon: Calendar, label: 'Mis Horarios' },
                    { id: 'insumos', icon: Package, label: 'Insumos' },
                    { id: 'incidencias', icon: AlertTriangle, label: 'Incidencias' },
                    { id: 'capacitacion', icon: ShieldCheck, label: 'Capacitación' },
                    { id: 'rrhh', icon: FileText, label: 'RRHH' },
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
        <header className="bg-white text-slate-900 px-6 py-4 flex justify-between items-center z-50 relative border-b border-slate-50">
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setMenuOpen(true)}
              className="p-2 -ml-2 text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 bg-white rounded-xl text-slate-400 hover:text-blue-500 relative transition-colors hover:bg-slate-50"
              >
                <Bell className="w-6 h-6" />
                {notificationsCount > 0 && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full"></span>
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
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold leading-none mb-1">{user.rol}</p>
              <h2 className="text-sm font-bold text-slate-800 leading-tight truncate max-w-[120px]">{user.nombre}</h2>
            </div>
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-emerald-100 bg-slate-50 flex items-center justify-center">
              <img 
                src="/regenerated_image_1777551940944.png" 
                alt="User" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/1048/1048953.png';
                }}
              />
            </div>
          </div>
        </header>

        <Dashboard 
          user={user}
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
  const [isScanningQR, setIsScanningQR] = useState(false);

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
          const { error } = await supabase.from('Limpieza_Registros').insert([record]);
          if (error) {
            console.error("Sync error for record:", error);
            remaining.push(record);
          }
        } catch (e) {
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
      operario: user.nombre,
      accion: comentario ? `${accion} (Obs: ${comentario})` : accion,
      inicio: start.toISOString(),
      fin: end.toISOString(),
      duracion_minutos: durationMinutes,
      observacion: comentario || null
    };

    if (!navigator.onLine) {
      // Offline mode: Queue for later
      const pendingJson = localStorage.getItem('limpieza_pending_sync');
      const pending = pendingJson ? JSON.parse(pendingJson) : [];
      pending.push(payload);
      localStorage.setItem('limpieza_pending_sync', JSON.stringify(pending));
      return;
    }

    // Save to Supabase (Limpieza_Registros)
    try {
      let { error } = await supabase.from('Limpieza_Registros').insert([payload]);
      if (error && error.message.includes('column')) {
         // Fallback if 'observacion' column missing
         const fallbackPayload = {...payload};
         delete fallbackPayload.observacion;
         await supabase.from('Limpieza_Registros').insert([fallbackPayload]);
      }
    } catch (e) {
      console.error("Error saving record:", e);
      // Fallback: Add to queue if network fails during request
      const pendingJson = localStorage.getItem('limpieza_pending_sync');
      const pending = pendingJson ? JSON.parse(pendingJson) : [];
      pending.push(payload);
      localStorage.setItem('limpieza_pending_sync', JSON.stringify(pending));
    }
  };

  const handleStartShift = async (mode: 'QR' | 'Normal' = 'Normal') => {
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
    setIsScanningQR(false);

    if (mode === 'QR') {
      new Notification("Punto Verificado", {
        body: "Check-in exitoso vía QR en el sitio.",
        icon: "/regenerated_image_1777551940944.png"
      });
    }
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
      setActiveTask(null);
      setTaskStart(null);
      setTaskComment('');
    }
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
                {isScanningQR ? (
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 rounded-3xl p-8 flex flex-col items-center gap-4 border-4 border-slate-800 shadow-2xl">
                     <div className="w-48 h-48 border-2 border-dashed border-emerald-400 rounded-2xl flex items-center justify-center relative overflow-hidden">
                       <QrCode className="w-24 h-24 text-emerald-400 opacity-20" />
                       <div className="absolute inset-0 bg-emerald-400/10 animate-pulse" />
                       <p className="absolute bottom-4 text-[10px] font-black text-emerald-400 uppercase tracking-widest text-center px-4">Escaneando Punto Físico...</p>
                     </div>
                     <button onClick={() => handleStartShift('QR')} className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20">
                       SIMULAR ESCANEO VERIFICADO
                     </button>
                     <button onClick={() => setIsScanningQR(false)} className="text-slate-400 text-[10px] font-black uppercase">Cerrar</button>
                  </motion.div>
                ) : (
                  <div className="flex gap-2">
                    <ShiftButton color="green" icon={<Play className="w-6 h-6 fill-current" />} label="INICIAR TURNO" onClick={handleStartShift} />
                    <button 
                      onClick={() => setIsScanningQR(true)}
                      className="w-20 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-all border border-slate-200"
                    >
                      <QrCode className="w-8 h-8" />
                    </button>
                  </div>
                )}
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
                     <span className="px-2 py-0.5 bg-slate-200/50 mr-1 rounded text-[10px] font-bold text-slate-600 uppercase mt-2 inline-block">
                       {activeTask.frecuencia}
                     </span>
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
               <TaskSelector onStart={handleStartTask} shiftActive={shiftState === 'active'} />
             )}
          </section>
        )}

        {activeTab === 'horarios' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pb-10">
            <h3 className="text-lg font-black text-slate-800 tracking-tight mb-4">Mis Próximos Turnos</h3>
            {[
              { dia: 'Mañana', loc: 'Oficinas Arevalo', h: '08:00 - 12:00' },
              { dia: 'Lunes 12', loc: 'Deposito Puerto', h: '14:00 - 20:00' },
            ].map((t, i) => (
              <div key={i} className="p-4 bg-white border border-slate-100 rounded-2xl flex justify-between items-center shadow-sm">
                <div>
                   <p className="text-xs font-black text-blue-500 uppercase tracking-widest">{t.dia}</p>
                   <p className="text-sm font-bold text-slate-800">{t.loc}</p>
                </div>
                <p className="text-xs font-black text-slate-400">{t.h}</p>
              </div>
            ))}
          </motion.div>
        )}

        {activeTab === 'insumos' && <InsumosModule />}
        {activeTab === 'capacitacion' && <CapacitacionModule />}
        {activeTab === 'rrhh' && <RRHHModule />}
            {activeTab === 'incidencias' && (
              <div className="flex flex-col gap-6">
                <IncidenciasModule user={user} onReported={() => setActiveTab('tareas')} />
                <ChatModule user={user} />
              </div>
            )}

        {activeTab !== 'tareas' && activeTab !== 'incidencias' && (
           <h3 onClick={() => setActiveTab('incidencias')} className="text-center font-black text-rose-500 text-[10px] uppercase tracking-widest mt-10 py-6 border-2 border-dashed border-rose-100 rounded-3xl cursor-pointer flex items-center justify-center gap-2">
             <AlertTriangle className="w-5 h-5" /> BOTÓN DE PÁNICO / INCIDENCIA
           </h3>
        )}

      </div>
    </div>
  );
}

function AnunciosBanner() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const load = () => {
      const saved = JSON.parse(localStorage.getItem('announcements_db') || '[]');
      setAnnouncements(saved);
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
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
function TaskSelector({ onStart, shiftActive }: { onStart: (t: TareaPlan) => void, shiftActive: boolean }) {
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

  const [reminders, setReminders] = useStickyState<Record<string, string>>({}, 'limpieza_task_reminders');

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
      const { data, error } = await supabase
        .from('Limpieza_Tareas_Plan')
        .select('*')
        .ilike('frecuencia', filter)
        .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1)
        .order('id', { ascending: false });
        
      if (!error && data) {
        if (isInitial) {
          setTasks(data);
        } else {
          setTasks(prev => [...prev, ...data]);
        }
        setHasMore(data.length === pageSize);
      }
    } catch (err) {
      console.error(err);
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

  const filteredTasks = tasks.filter(t => 
    t.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (t.descripcion || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filters: Array<'Diaria' | 'Semanal' | 'Mensual' | 'Eventual'> = ['Diaria', 'Semanal', 'Mensual', 'Eventual'];

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    
    const newTask = { 
      titulo: newTaskTitle.trim(), 
      frecuencia: newTaskFreq,
      ...(newTaskDesc ? { descripcion: newTaskDesc } : {}),
      ...(newTaskDate ? { fecha_vencimiento: newTaskDate } : {})
    };
    
    let { data, error } = await supabase
      .from('Limpieza_Tareas_Plan')
      .insert([newTask])
      .select();
      
    if (error && error.message.includes('column')) {
      const result = await supabase.from('Limpieza_Tareas_Plan').insert([{ titulo: newTaskTitle, frecuencia: newTaskFreq }]).select();
      data = result.data;
      error = result.error;
    }
      
    if (!error && data) {
      setTasks([data[0], ...tasks]);
      setIsCreating(false);
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskDate('');
    } else if (error) {
      alert('Error al crear la tarea: ' + error.message);
    }
  };

  const toggleReminder = async (taskId: string | number) => {
    if (!("Notification" in window)) {
      alert("Este navegador no soporta notificaciones de escritorio.");
      return;
    }

    if (Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
    }

    const taskIdStr = taskId.toString();
    if (reminders[taskIdStr]) {
      const newReminders = { ...reminders };
      delete newReminders[taskIdStr];
      setReminders(newReminders);
    } else {
      setReminders({ ...reminders, [taskIdStr]: new Date().toISOString() });
      new Notification("Recordatorio Activado", {
        body: `Te avisaremos sobre la tarea seleccionada.`,
        icon: "/regenerated_image_1777551940944.png"
      });
    }
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
              "py-2 px-1 rounded-full text-[10px] sm:text-xs font-bold transition-all truncate flex justify-center items-center",
              filter === f 
                ? "bg-slate-900 text-white shadow-sm" 
                : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-200"
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
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm font-medium outline-none focus:border-emerald-500 transition-colors resize-none h-20"
              placeholder="Descripción (opcional)"
              value={newTaskDesc}
              onChange={e => setNewTaskDesc(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm font-semibold outline-none focus:border-emerald-500 transition-colors appearance-none"
              value={newTaskFreq}
              onChange={e => setNewTaskFreq(e.target.value as any)}
            >
              <option value="Diaria">Diaria</option>
              <option value="Semanal">Semanal</option>
              <option value="Mensual">Mensual</option>
              <option value="Eventual">Eventual</option>
            </select>
            <input 
              type="date"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 outline-none focus:border-emerald-500 transition-colors"
              value={newTaskDate}
              onChange={e => setNewTaskDate(e.target.value)}
              title="Fecha de Vencimiento (Opcional)"
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
              <div key={task.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-blue-100 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-900 leading-tight truncate">{task.titulo}</div>
                  <div className="flex flex-wrap gap-2 items-center mt-1">
                    <span className="text-[9px] font-black text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">{task.frecuencia}</span>
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
                    onClick={() => toggleReminder(task.id)}
                    className={cn(
                      "p-2 rounded-xl transition-all",
                      reminders[task.id.toString()] ? "bg-blue-50 text-blue-600" : "text-slate-300 hover:bg-slate-50"
                    )}
                    title="Configurar Recordatorio"
                  >
                    <Bell className={cn("w-5 h-5", reminders[task.id.toString()] && "fill-current")} />
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
    </div>
  );
}

// -- Login Screen --

function LoginScreen({ onLogin, installProps }: { onLogin: (user: Operario, d: string) => void, installProps: any }) {
  const [nombre, setNombre] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !pin.trim()) {
      setError('Por favor complete todos los campos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: dbError } = await supabase
        .from('Limpieza_Personal')
        .select('*')
        .eq('nombre', nombre.trim())
        .eq('pin', pin.trim())
        .single();

      if (dbError || !data) {
        setError('Nombre o PIN incorrectos. Verifique sus datos.');
      } else {
        // Fallback robusto en caso de que la columna 'rol' no exista: si es admin o supervisor asignarle ese rol temporalmente
        const isSuper = (data.rol === 'supervisor') || nombre.toLowerCase().includes('admin') || nombre.toLowerCase().includes('sup') || nombre.toLowerCase() === 'prueba supervisor' || nombre.toLowerCase() === 'walter medina';
        
        onLogin({ nombre: data.nombre, rol: isSuper ? 'supervisor' : 'operario' }, getArgentinaDate());
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-blue-500"></div>

        <div className="mb-8 text-center flex flex-col items-center">
          <div className="w-48 h-48 mb-4 bg-white rounded-3xl flex items-center justify-center overflow-hidden shadow-sm p-4">
            <img 
              src="/regenerated_image_1777551940944.png" 
              alt="Logo Arevalo" 
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/1048/1048953.png';
              }}
            />
          </div>
          <h1 className="text-2xl font-black text-[#0b3464] tracking-tight">Acceso Rápido</h1>
          <p className="text-slate-500 font-medium text-sm mt-1 uppercase tracking-widest">Sector de Limpieza</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div className="bg-blue-50 text-blue-700 text-xs p-4 rounded-xl border border-blue-100 bg-opacity-50">
            <p className="font-semibold mb-1 flex gap-1"><ShieldAlert className="w-4 h-4"/> Tip para probar roles:</p>
            <p>Ingresa como operario normal, o si ingresas un nombre que contenga "Admin" o "Sup", entrarás al panel de Supervisor (ej: "Juan Admin").</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-4 rounded-xl font-medium border border-red-100 flex items-start gap-2">
              <span className="mt-0.5">⚠️</span>
              <p>{error}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">
              Nombre del Operario
            </label>
            <input 
              type="text" 
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-200 focus:border-blue-500 rounded-2xl px-5 py-4 text-lg font-semibold text-slate-800 outline-none transition-colors"
              placeholder="Ej. Juan"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">
              PIN (4 dígitos)
            </label>
            <input 
              type="password" 
              value={pin}
              onChange={e => setPin(e.target.value)}
              maxLength={4}
              inputMode="numeric"
              pattern="[0-9]*"
              className="w-full bg-slate-50 border-2 border-slate-200 focus:border-blue-500 rounded-2xl px-5 py-4 text-center text-3xl tracking-[1em] font-bold text-slate-800 outline-none transition-colors"
              placeholder="••••"
            />
          </div>

          <motion.button 
            whileTap={{ scale: 0.96 }}
            disabled={loading}
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl mt-4 font-black uppercase tracking-widest shadow-lg shadow-blue-600/30 transition-all focus:outline-none flex justify-center items-center"
          >
            {loading ? <RefreshCcw className="w-6 h-6 animate-spin" /> : 'INGRESAR'}
          </motion.button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col gap-3">
          <button 
             onClick={installProps.handleInstall}
             className="w-full flex items-center justify-center gap-3 bg-[#eaf3ff] text-[#0b3464] py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-[#d8e9ff] transition-all active:scale-95 border-2 border-[#0b3464] shadow-sm"
           >
             <Monitor className="w-5 h-5 text-[#0b3464]" />
             Instalar Aplicación en Celular
           </button>
           <p className="text-[10px] text-center text-slate-400 font-medium italic">Versión 2.2 - Sistema de Gestión Arevalo</p>
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
    // Simular envío o guardado en Base de Datos (Limpieza_Solicitudes_Insumos)
    try {
      const { error } = await supabase.from('Limpieza_Registros').insert([{
        operario: user.nombre,
        accion: `Solicitud Insumos: ${solicitud}`,
        inicio: new Date().toISOString(),
        fin: new Date().toISOString()
      }]);
      if (!error) {
        alert("Solicitud de insumos enviada al supervisor.");
        setSolicitud('');
      } else {
        alert("Error al solicitar: " + error.message);
      }
    } catch(e) {}
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
  const [insumos, setInsumos] = useState<{ id: string, nombre: string, cantidad: number }[]>([
    { id: '1', nombre: 'Lavandina (Litros)', cantidad: 10 },
    { id: '2', nombre: 'Trapos de Piso', cantidad: 50 },
    { id: '3', nombre: 'Escobas', cantidad: 8 },
    { id: '4', nombre: 'Detergente (Litros)', cantidad: 15 },
  ]);

  const [pedidos, setPedidos] = useState<PedidoInsumo[]>([]);
  const [nuevoInsumo, setNuevoInsumo] = useState('');
  const [nuevaCant, setNuevaCant] = useState('');

  useEffect(() => {
    // Load pending requests from local storage
    const loadRequests = () => {
      const saved = JSON.parse(localStorage.getItem('pending_insumos') || '[]');
      setPedidos(saved);
    };
    loadRequests();
    const interval = setInterval(loadRequests, 5000);
    return () => clearInterval(interval);
  }, []);

  const agregarInsumo = () => {
    if (nuevoInsumo.trim() && !isNaN(Number(nuevaCant))) {
      setInsumos([...insumos, { id: Date.now().toString(), nombre: nuevoInsumo, cantidad: Number(nuevaCant) }]);
      setNuevoInsumo('');
      setNuevaCant('');
    }
  };

  const updateCant = (id: string, diff: number) => {
    setInsumos(prev => prev.map(i => i.id === id ? { ...i, cantidad: Math.max(0, i.cantidad + diff) } : i));
  };

  const responderPedido = (pedidoId: string, status: 'Aprobado' | 'Rechazado') => {
    const updated = pedidos.map(p => p.id === pedidoId ? { ...p, estado: status } : p);
    setPedidos(updated);
    localStorage.setItem('pending_insumos', JSON.stringify(updated));
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
      let query = supabase.from('Limpieza_Tareas_Plan').select('*');
      
      if (frecuenciaFilter !== 'Todas') {
        query = query.eq('frecuencia', frecuenciaFilter);
      }
      
      const { data: tasksData, error: tasksError } = await query
        .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1)
        .order('id', { ascending: false });

      const { data: usersData } = await supabase.from('Limpieza_Personal').select('*');
        
      if (!tasksError && tasksData) {
        const mappedData = tasksData.map((t: any) => ({
          ...t,
          _estadoSimulado: Math.random() > 0.5 ? 'Pendiente' : 'Completada'
        }));
        
        if (isInitial) {
          setTasks(mappedData);
        } else {
          setTasks(prev => [...prev, ...mappedData]);
        }
        setHasMore(tasksData.length === pageSize);
      }
      if (usersData) {
        setOperarios(usersData);
      }
    } catch (err) {
      console.error(err);
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
    
    const taskPayload = { 
      titulo: newTaskTitle.trim(), 
      frecuencia: newTaskFreq,
      ...(newTaskDesc ? { descripcion: newTaskDesc } : {}),
      ...(newTaskDate ? { fecha_vencimiento: newTaskDate } : {}),
      ...(asignados.length > 0 ? { asignados } : { asignados: null }),
      ...(duracionEst ? { duracion_estimada_minutos: parseInt(duracionEst) } : {})
    };
    
    let result;
    if (editingId) {
      result = await supabase.from('Limpieza_Tareas_Plan').update(taskPayload).eq('id', editingId).select();
    } else {
      result = await supabase.from('Limpieza_Tareas_Plan').insert([taskPayload]).select();
    }
      
    if (result.error && result.error.message.includes('column')) {
      if (editingId) {
        result = await supabase.from('Limpieza_Tareas_Plan').update({ titulo: taskPayload.titulo, frecuencia: taskPayload.frecuencia }).eq('id', editingId).select();
      } else {
        result = await supabase.from('Limpieza_Tareas_Plan').insert([{ titulo: taskPayload.titulo, frecuencia: taskPayload.frecuencia }]).select();
      }
    }
      
    if (!result.error && result.data) {
      if (editingId) {
        setTasks(tasks.map(t => t.id === editingId ? { ...t, ...result.data[0] } : t));
      } else {
        setTasks([{ ...result.data[0], _estadoSimulado: 'Pendiente' }, ...tasks]);
      }
      resetForm();
    } else if (result.error) {
      alert('Error al guardar la tarea: ' + result.error.message);
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
  
  const daysInMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1).getDay();
  
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 mt-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-500" /> Planificación Mensual
        </h3>
        <div className="flex items-center gap-4 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
          <button onClick={() => setSelectedMonth(new Date(selectedMonth.setMonth(selectedMonth.getMonth() - 1)))} className="p-1 hover:bg-white rounded-lg shadow-sm">
             <X className="w-4 h-4 rotate-45" /> {/* Simple arrow back surrogate */}
          </button>
          <span className="text-xs font-bold text-slate-600 min-w-[100px] text-center">{monthNames[selectedMonth.getMonth()]} {selectedMonth.getFullYear()}</span>
          <button onClick={() => setSelectedMonth(new Date(selectedMonth.setMonth(selectedMonth.getMonth() + 1)))} className="p-1 hover:bg-white rounded-lg shadow-sm">
             <Plus className="w-4 h-4 rotate-45" /> {/* Simple arrow next surrogate */}
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-2">
        {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map(d => (
          <div key={d} className="text-center text-[10px] font-black text-slate-400 py-2 uppercase">{d}</div>
        ))}
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} className="h-20 lg:h-24 bg-slate-50/50 rounded-xl" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${selectedMonth.getFullYear()}-${(selectedMonth.getMonth() + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
          const dayTasks = tasks.filter(t => t.fecha_vencimiento === dateStr);
          
          return (
            <div key={day} className={cn(
              "h-20 lg:h-24 p-1.5 border border-slate-100 rounded-xl flex flex-col gap-1 overflow-hidden transition-colors hover:border-blue-200",
              dayTasks.length > 0 ? "bg-blue-50/20" : "bg-white"
            )}>
              <span className="text-[10px] font-bold text-slate-400">{day}</span>
              <div className="flex flex-col gap-1">
                {dayTasks.map((dt, idx) => (
                  <div key={idx} className="bg-blue-600 text-[8px] text-white px-1 py-0.5 rounded truncate font-bold" title={dt.titulo}>
                    {dt.titulo}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
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

function SupervisorDashboard({ user, onLogout }: { user: Operario, onLogout: () => void }) {
  const [tab, setTab] = useState<'dashboard' | 'tareas' | 'reportes' | 'stock' | 'turnos' | 'incidencias' | 'anuncios' | 'chat'>('dashboard');
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
    if (window.confirm("¿Está seguro que desea cerrar sesión como Supervisor?")) {
      onLogout();
    }
  };

  useEffect(() => {
    // Real-time subscription for live activity feed
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Limpieza_Registros',
        },
        (payload) => {
          setRegistros((prev) => {
            // Avoid duplicates if fetchData also runs
            if (prev.find(r => r.id === payload.new.id)) return prev;
            return [payload.new, ...prev].slice(0, 500);
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Limpieza_Registros',
        },
        (payload) => {
          setRegistros((prev) => prev.map(r => r.id === payload.new.id ? payload.new : r));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      
      // Basic data needed for dashboard always or specific tabs
      const fetchOps = async () => {
        if (operarios.length === 0) {
          const { data } = await supabase.from('Limpieza_Personal').select('*');
          if (data) setOperarios(data);
        }
      };

      const fetchTasks = async () => {
        const { data } = await supabase.from('Limpieza_Tareas_Plan').select('*');
        if (data) setTasks(data);
      };
      
      const fetchStock = async () => {
        const { data } = await supabase.from('Limpieza_Stock').select('*');
        if (data) setStock(data);
      };

      if (tab === 'reportes' || tab === 'dashboard') {
        let query = supabase.from('Limpieza_Registros').select('*');
        
        let startDate = new Date();
        if (reportDateMode === 'vivo') {
          startDate.setHours(startDate.getHours() - 12);
          query = query.gte('inicio', startDate.toISOString()).order('inicio', { ascending: false }).limit(200);
        } else if (reportDateMode === 'dia') {
          startDate.setHours(0,0,0,0);
          startDate.setMinutes(startDate.getMinutes() + startDate.getTimezoneOffset()); // Adjust to local if needed or just use ISO
          query = query.gte('inicio', startDate.toISOString()).order('inicio', { ascending: false });
        } else if (reportDateMode === 'semana') {
          startDate.setDate(startDate.getDate() - 7);
          query = query.gte('inicio', startDate.toISOString()).order('inicio', { ascending: false });
        } else if (reportDateMode === 'mes') {
          startDate.setMonth(startDate.getMonth() - 1);
          query = query.gte('inicio', startDate.toISOString()).order('inicio', { ascending: false });
        }

        const [regRes] = await Promise.all([
          query,
          fetchOps(),
          fetchTasks(),
          fetchStock()
        ]);
        
        let finalData = regRes.data || [];
        if (reportUserFilter !== 'Todos') {
          finalData = finalData.filter(d => d.operario === reportUserFilter);
        }
        setRegistros(finalData);
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
                  <img 
                    src="/regenerated_image_1777551940944.png" 
                    alt="Logo" 
                    className="w-14 h-14 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/1048/1048953.png';
                    }}
                  />
                  <span className="font-bold text-xl tracking-tight text-slate-800">Panel Arevalo</span>
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
                  onClick={() => { setTab('chat'); setMenuOpen(false); }}
                  className={cn(
                    "flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all",
                    tab === 'chat' ? "bg-blue-50 text-blue-600 shadow-sm" : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <Monitor className="w-6 h-6" />
                  <span>Chat Operativo</span>
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

      <header className="bg-white text-slate-900 px-6 py-4 flex justify-between items-center z-50 sticky top-0 shadow-sm border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setMenuOpen(true)}
            className="p-2.5 bg-slate-50 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all border border-slate-100"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="hidden sm:flex items-center gap-3 ml-2">
            <img 
              src="/regenerated_image_1777551940944.png" 
              alt="Logo" 
              className="w-12 h-12 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/1048/1048953.png';
              }}
            />
            <h1 className="font-black text-xl tracking-tighter text-slate-900">Limpieza<span className="text-blue-600 underline decoration-4 decoration-blue-100 underline-offset-4">Arevalo</span></h1>
          </div>
        </div>

        <div className="flex items-center gap-3 text-right">
          <div className="hidden xs:block">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold leading-none mb-1">{user.rol}</p>
            <h2 className="text-sm font-bold text-slate-800 leading-tight truncate max-w-[150px]">{user.nombre}</h2>
          </div>
          <button 
            onClick={handleLogoutAdmin}
            className="bg-rose-50 p-2 rounded-2xl border border-rose-100 text-rose-600 hover:bg-rose-100 transition-colors"
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
        {tab === 'chat' && (
          <div className="max-w-2xl mx-auto w-full bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm h-full max-h-[700px]">
            <ChatModule user={user} />
          </div>
        )}

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
      </div>
    </div>
  );
}
