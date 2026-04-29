import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Play, Square, PauseCircle, LogOut, CheckCircle2, UserCircle, RefreshCcw, Plus, Calendar, FileText, ClipboardList, ShieldAlert, Bell, Menu, X, Activity, WifiOff, Coffee, Monitor, LayoutGrid, MoveRight, Mic, MicOff } from 'lucide-react';
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
}

interface Operario {
  nombre: string;
  rol: 'operario' | 'supervisor';
}

function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
  };

  return { showInstallBtn, handleInstall };
}

function InstallBanner() {
  const { showInstallBtn, handleInstall } = usePWAInstall();

  if (!showInstallBtn) return null;

  return (
    <motion.div 
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-4 left-4 right-4 z-[9999] bg-blue-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-blue-400/30 backdrop-blur-md bg-opacity-95"
    >
      <div className="flex items-center gap-3">
        <div className="bg-white/20 p-2 rounded-xl">
          <Monitor className="w-5 h-5 text-white" />
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

function VoiceInputButton({ onTranscript, placeholder = "Escuchando...", className = "" }: { onTranscript: (text: string) => void, placeholder?: string, className?: string }) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startListening = () => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).speechRecognition;
    if (!SpeechRecognition) {
      alert("Tu navegador no soporta reconocimiento de voz. Usa Chrome o Safari.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-AR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };
    
    recognition.onend = () => {
      setIsListening(false);
    };
    
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setError(event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        alert("Permiso de micrófono denegado. Por favor, habilitalo en la configuración del sitio.");
      }
    };
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onTranscript(transcript);
    };

    try {
      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

  return (
    <button
      type="button"
      onClick={startListening}
      className={cn(
        "p-2 rounded-xl transition-all flex items-center justify-center",
        isListening ? "bg-red-500 text-white animate-pulse shadow-lg scale-110" : "bg-slate-100 text-slate-500 hover:bg-slate-200",
        className
      )}
      title={isListening ? placeholder : "Dictar por voz"}
    >
      {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
    </button>
  );
}

function SmartVoiceTask({ onTaskCreated, currentFilter }: { onTaskCreated: (task: TareaPlan) => void, currentFilter: string }) {
  const [processing, setProcessing] = useState(false);

  const handleSmartTranscript = async (text: string) => {
    setProcessing(true);
    try {
      // Basic parsing logic
      // e.g., "Limpiar el baño en recepción frecuenca semanal"
      let title = text.charAt(0).toUpperCase() + text.slice(1);
      let desc = "";
      let freq = currentFilter;

      const lowerText = text.toLowerCase();
      if (lowerText.includes('diario') || lowerText.includes('diaria')) freq = 'Diaria';
      else if (lowerText.includes('semanal')) freq = 'Semanal';
      else if (lowerText.includes('mensual')) freq = 'Mensual';
      else if (lowerText.includes('eventual')) freq = 'Eventual';

      const newTask = {
        titulo: title,
        frecuencia: freq,
        descripcion: "Creado por voz: " + text,
      };

      const { data, error } = await supabase
        .from('Limpieza_Tareas_Plan')
        .insert([newTask])
        .select();

      if (!error && data) {
        onTaskCreated(data[0]);
      } else {
        console.error("Error creating smart task", error);
        alert("No se pudo crear la tarea automáticamente: " + (error?.message || "Error desconocido"));
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-4 flex items-center gap-4 shadow-sm">
      <div className="bg-emerald-500 p-3 rounded-full shadow-emerald-200 shadow-lg">
        <Mic className="w-6 h-6 text-white" />
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-bold text-emerald-800">Crear Tarea por Voz</h4>
        <p className="text-[10px] text-emerald-600 font-medium italic">"Limpiar los vidrios de la entrada para mañana..."</p>
      </div>
      <VoiceInputButton 
        onTranscript={handleSmartTranscript}
        className="bg-emerald-500 text-white hover:bg-emerald-600 shadow-md h-12 w-12"
      />
      {processing && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] rounded-2xl flex items-center justify-center z-10">
          <RefreshCcw className="w-6 h-6 text-emerald-500 animate-spin" />
        </div>
      )}
    </div>
  );
}

// -- Main App --

export default function App() {
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
  const [activeTab, setActiveTab] = useState<'tareas' | 'stock'>('tareas');
  const [notificationsCount, setNotificationsCount] = useState(0);
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
        <InstallBanner />
        <LoginScreen onLogin={(u, d) => { setUser(u); setLoginDate(d); }} />
      </>
    );
  }

  if (user.rol === 'supervisor') {
    return (
      <>
        <InstallBanner />
        <SupervisorDashboard user={user} onLogout={performGlobalLogout} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center w-full font-sans text-slate-800">
      <InstallBanner />
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
                    <ShieldAlert className="w-6 h-6 text-emerald-500" />
                    <span className="font-bold text-lg tracking-tight">LimpiezaApp</span>
                  </div>
                  <button onClick={() => setMenuOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <nav className="flex flex-col gap-2">
                  <button 
                    onClick={() => { setActiveTab('tareas'); setMenuOpen(false); }}
                    className={cn(
                      "flex items-center gap-4 px-4 py-4 rounded-2xl font-bold transition-all",
                      activeTab === 'tareas' ? "bg-emerald-50 text-emerald-600" : "text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    <ClipboardList className="w-6 h-6" />
                    <span>Tareas</span>
                  </button>
                  <button 
                    onClick={() => { setActiveTab('stock'); setMenuOpen(false); }}
                    className={cn(
                      "flex items-center gap-4 px-4 py-4 rounded-2xl font-bold transition-all",
                      activeTab === 'stock' ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    <Plus className="w-6 h-6" />
                    <span>Insumos</span>
                  </button>
                  <div className="my-4 border-t border-slate-100" />
                  <button 
                    onClick={handleLogout}
                    className="flex items-center gap-4 px-4 py-4 rounded-2xl font-bold text-rose-500 hover:bg-rose-50 transition-all"
                  >
                    <LogOut className="w-6 h-6" />
                    <span>Salir</span>
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
            <div className="bg-emerald-50 p-1.5 rounded-xl border border-emerald-100">
              <UserCircle className="w-6 h-6 text-emerald-500" />
            </div>
          </div>
        </header>

        <Dashboard 
          user={user}
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
                <span className="text-[10px] font-black uppercase">Sin Conexión</span>
              </motion.div>
            )}
            {syncing && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-100 shadow-sm"
              >
                <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                <span className="text-[10px] font-black uppercase">Sincronizando...</span>
              </motion.div>
            )}
          </AnimatePresence>
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
        
        {/* SHIFT CONTROLS */}
        <section className="flex flex-col gap-3">
          
          <div className="grid grid-cols-1 gap-3">
            {shiftState === 'idle' && (
              <ShiftButton color="green" icon={<Play className="w-6 h-6 fill-current" />} label="INICIAR TURNO" onClick={handleStartShift} />
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
               <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">Tarea Actual</h2>
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
                     className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-emerald-500 outline-none resize-none h-24 pr-12"
                     placeholder="Agregar comentario u observación (opcional)..."
                   />
                   <div className="absolute right-2 top-2">
                     <VoiceInputButton onTranscript={(text) => setTaskComment(prev => prev ? `${prev} ${text}` : text)} />
                   </div>
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

        {activeTab === 'stock' && (
          <OperarioStockManager user={user} />
        )}

      </div>
    </div>
  );
}

// -- Shift Button UI --
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
  const [filter, setFilter] = useState<'Diaria' | 'Semanal' | 'Mensual' | 'Eventual'>('Diaria');
  
  const [isCreating, setIsCreating] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskFreq, setNewTaskFreq] = useState<'Diaria' | 'Semanal' | 'Mensual' | 'Eventual'>('Diaria');

  useEffect(() => {
    async function fetchTasks() {
      setLoading(true);
      const { data, error } = await supabase
        .from('Limpieza_Tareas_Plan')
        .select('*');
        
      if (!error && data) {
        setTasks(data);
      }
      setLoading(false);
    }
    fetchTasks();
  }, []);

  const filteredTasks = tasks.filter(t => (t.frecuencia || '').toLowerCase() === filter.toLowerCase());

  const filters: Array<'Diaria' | 'Semanal' | 'Mensual' | 'Eventual'> = ['Diaria', 'Semanal', 'Mensual', 'Eventual'];

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    
    // Si la DB aún no tiene estos campos, podría tirar error. Trataremos de insertar lo básico si falla.
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
      alert("⚠️ Falta agregar las columnas 'descripcion' o 'fecha_vencimiento' a Limpieza_Tareas_Plan en tu base de datos Supabase. Guardando solo el título...");
      // Intentar solo lo basico
      const result = await supabase.from('Limpieza_Tareas_Plan').insert([{ titulo: newTaskTitle, frecuencia: newTaskFreq }]).select();
      data = result.data;
      error = result.error;
    }
      
    if (!error && data) {
      setTasks([...tasks, data[0]]);
      setIsCreating(false);
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskDate('');
    } else if (error) {
      alert('Error al crear la tarea: ' + error.message);
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
      
      <SmartVoiceTask 
        onTaskCreated={(newTask) => setTasks([...tasks, newTask])} 
        currentFilter={filter}
      />

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
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm font-semibold outline-none focus:border-emerald-500 transition-colors pr-10"
              placeholder="Título de la tarea*"
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
               <VoiceInputButton onTranscript={(text) => setNewTaskTitle(text)} />
            </div>
          </div>
          <div className="relative">
            <textarea 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm font-medium outline-none focus:border-emerald-500 transition-colors resize-none h-20 pr-10"
              placeholder="Descripción (opcional)"
              value={newTaskDesc}
              onChange={e => setNewTaskDesc(e.target.value)}
            />
            <div className="absolute right-2 top-2">
               <VoiceInputButton onTranscript={(text) => setNewTaskDesc(prev => prev ? `${prev} ${text}` : text)} />
            </div>
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
      <div className="flex-1 overflow-y-auto max-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-8 text-slate-400">
            <RefreshCcw className="w-6 h-6 animate-spin mb-4 opacity-50" />
            <p className="text-sm animate-pulse font-medium">Cargando...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-slate-400 text-center">
            <CheckCircle2 className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm font-medium">Nada por aquí.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map(task => (
              <div key={task.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                <div>
                  <div className="text-sm font-bold text-slate-900 leading-tight">{task.titulo}</div>
                  <div className="flex gap-2 items-center mt-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded-full">{task.frecuencia}</span>
                    {task.fecha_vencimiento && <span className="text-[10px] font-bold text-rose-500 flex items-center gap-0.5"><Calendar className="w-3 h-3"/> {task.fecha_vencimiento}</span>}
                  </div>
                  {task.descripcion && <p className="text-xs text-slate-500 mt-2 italic max-w-[200px] truncate">{task.descripcion}</p>}
                </div>
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onStart(task)}
                  className="p-3 text-emerald-500 hover:bg-emerald-50 rounded-xl transition-colors ml-2 flex-shrink-0"
                >
                  <Play className="w-6 h-6 fill-current" />
                </motion.button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// -- Login Screen --

function LoginScreen({ onLogin }: { onLogin: (user: Operario, d: string) => void }) {
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
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex justify-center items-center mb-4">
            <UserCircle className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Acceso Rápido</h1>
          <p className="text-slate-500 font-medium text-sm mt-1">Sector de Limpieza</p>
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

  const [nuevoInsumo, setNuevoInsumo] = useState('');
  const [nuevaCant, setNuevaCant] = useState('');

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

  return (
    <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col p-6 w-full max-w-4xl mx-auto">
      <h3 className="font-bold text-lg text-slate-800 mb-6">Control de Stock e Insumos</h3>
      
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
  );
}

// -- End of Components --


function SupervisorTasksManager() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [operarios, setOperarios] = useState<Operario[]>([]);
  const [loading, setLoading] = useState(true);
  const [estadoFilter, setEstadoFilter] = useState<'Todas' | 'Pendiente' | 'Completada'>('Todas');
  const [frecuenciaFilter, setFrecuenciaFilter] = useState<'Todas' | 'Diaria' | 'Semanal' | 'Mensual' | 'Eventual'>('Todas');
  const [operarioFilter, setOperarioFilter] = useState<string>('Todos');
  const [expandedTaskId, setExpandedTaskId] = useState<string|number|null>(null);
  const [viewMode, setViewMode] = useState<'lista' | 'calendario' | 'metricas'>('lista');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [tasksRes, usersRes] = await Promise.all([
        supabase.from('Limpieza_Tareas_Plan').select('*'),
        supabase.from('Limpieza_Personal').select('*')
      ]);
        
      if (!tasksRes.error && tasksRes.data) {
        const mappedData = tasksRes.data.map((t: any) => ({
          ...t,
          _estadoSimulado: Math.random() > 0.5 ? 'Pendiente' : 'Completada'
        }));
        setTasks(mappedData);
      }
      if (!usersRes.error && usersRes.data) {
        setOperarios(usersRes.data);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const filteredTasks = tasks.filter((t: any) => {
    const matchEstado = estadoFilter === 'Todas' || t._estadoSimulado === estadoFilter;
    const matchFrecuencia = frecuenciaFilter === 'Todas' || t.frecuencia === frecuenciaFilter;
    const matchOperario = operarioFilter === 'Todos' || (t.asignados && t.asignados.includes(operarioFilter));
    return matchEstado && matchFrecuencia && matchOperario;
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
      alert("⚠️ Faltan columnas en Supabase (ej. asignados, duracion_estimada). Por favor ejecuta el script de SQL.");
      // Fallback
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
            <>
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
            </>
          )}
          <button 
             onClick={() => creating ? resetForm() : setCreating(true)}
             className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1 transition-colors"
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
  const [tab, setTab] = useState<'dashboard' | 'tareas' | 'reportes' | 'stock'>('dashboard');
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
                  <div className="bg-blue-600 p-2 rounded-xl">
                    <ShieldAlert className="w-6 h-6 text-white" />
                  </div>
                  <span className="font-bold text-xl tracking-tight text-slate-800">Panel Control</span>
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
            <div className="bg-blue-600 p-2.5 rounded-2xl shadow-lg shadow-blue-100">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-black text-xl tracking-tighter text-slate-900">Limpieza<span className="text-blue-600 underline decoration-4 decoration-blue-100 underline-offset-4">Panel</span></h1>
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

        {tab === 'stock' && (
          <SupervisorStockManager />
        )}
      </div>
    </div>
  );
}
