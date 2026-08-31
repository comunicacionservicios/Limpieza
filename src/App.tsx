import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import {
  Clock,
  Play,
  Square,
  PauseCircle,
  LogOut,
  CheckCircle2,
  PlusCircle,
  UserCircle,
  Users,
  RefreshCcw,
  Plus,
  Calendar,
  FileText,
  ClipboardList,
  ShieldAlert,
  Bell,
  Menu,
  X,
  Activity,
  WifiOff,
  Coffee,
  Monitor,
  LayoutGrid,
  MoveRight,
  MapPin,
  AlertTriangle,
  Package,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Camera,
  Key,
  Home,
  BarChart2,
  Megaphone,
  History,
  Trash2,
  Edit3,
  Settings,
  Shield,
  Download,
  FileSpreadsheet,
  BarChart3,
} from "lucide-react";
import { supabase } from "./lib/supabase";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  initGoogleAuth,
  googleSignIn,
  googleSignOut,
  createGoogleCalendarEvent,
} from "./lib/googleCalendar";
import type { User as FirebaseUser } from "firebase/auth";

import { SupervisorTimesheetModule } from "./components/SupervisorTimesheetModule";
import { ExecutiveReportModule } from "./components/ExecutiveReportModule";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

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

// -- Helpers --

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

const ARG_TZ = "America/Argentina/Buenos_Aires";

function getArgentinaDate() {
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: ARG_TZ });
  } catch (err) {
    const d = new Date();
    // Argentina is always UTC-3
    const argTime = d.getTime() - (3 * 60 * 60 * 1000);
    const argDate = new Date(argTime);
    const yyyy = argDate.getUTCFullYear();
    const mm = String(argDate.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(argDate.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
}

function getArgentinaDateString(date: Date | string | number) {
  const d = new Date(date);
  try {
    return d.toLocaleDateString("en-CA", { timeZone: ARG_TZ });
  } catch (err) {
    if (isNaN(d.getTime())) {
      const now = new Date();
      return now.toISOString().split("T")[0];
    }
    const argTime = d.getTime() - (3 * 60 * 60 * 1000);
    const argDate = new Date(argTime);
    const yyyy = argDate.getUTCFullYear();
    const mm = String(argDate.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(argDate.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
}

function getArgLocalDate(dateVal: Date | string | number) {
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) {
    return new Date();
  }
  return new Date(d.getTime() - 3 * 60 * 60 * 1000);
}

export function formatArgDate(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = {},
) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "Fecha inválida";
  try {
    return d.toLocaleDateString("es-AR", { timeZone: ARG_TZ, ...options });
  } catch (err) {
    // Fallback using UTC-3 offset components
    const argDate = new Date(d.getTime() - (3 * 60 * 60 * 1000));
    const day = String(argDate.getUTCDate()).padStart(2, "0");
    const month = String(argDate.getUTCMonth() + 1).padStart(2, "0");
    const year = argDate.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }
}

export function formatArgTime(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" },
) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "H:i";
  try {
    return d.toLocaleTimeString("es-AR", { timeZone: ARG_TZ, ...options });
  } catch (err) {
    const argDate = new Date(d.getTime() - (3 * 60 * 60 * 1000));
    const hours = String(argDate.getUTCHours()).padStart(2, "0");
    const minutes = String(argDate.getUTCMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }
}

function formatArgDateTime(date: Date | string | number) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "Fecha inválida";
  try {
    return d.toLocaleString("es-AR", { timeZone: ARG_TZ });
  } catch (err) {
    const argDate = new Date(d.getTime() - (3 * 60 * 60 * 1000));
    const day = String(argDate.getUTCDate()).padStart(2, "0");
    const month = String(argDate.getUTCMonth() + 1).padStart(2, "0");
    const year = argDate.getUTCFullYear();
    const hours = String(argDate.getUTCHours()).padStart(2, "0");
    const minutes = String(argDate.getUTCMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }
}

function formatDuration(startTimeIso: string | null) {
  if (!startTimeIso) return "00:00:00";
  const start = new Date(startTimeIso).getTime();
  const now = new Date().getTime();
  const diff = Math.max(0, Math.floor((now - start) / 1000));

  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;

  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// -- Interfaces --

interface TareaPlan {
  id: string | number;
  titulo: string;
  frecuencia: string;
  descripcion?: string;
  fecha_vencimiento?: string;
  requiere_foto?: boolean;
  tipoLimpieza?: "Mantenimiento" | "Intermedia" | "Detalles";
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
  tipo: "Rotura" | "Falta de Insumo" | "Urgencia" | "Otro";
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
  estado: "Pendiente" | "Presente" | "Ausente" | "Atrasado";
  reemplazoId?: string;
  reemplazoNombre?: string;
  tareasAsignadas?: string[]; // IDs from Limpieza_Tareas_Plan
}

const INCIDENCIAS_MOCK: Incidencia[] = [
  {
    id: "1",
    autor: "Juan Perez",
    tipo: "Rotura",
    descripcion: "Picaporte roto en baño piso 2",
    fecha: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "2",
    autor: "Maria Garcia",
    tipo: "Falta de Insumo",
    descripcion: "No hay papel higiénico en el depósito central",
    fecha: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: "3",
    autor: "Carlos Lopez",
    tipo: "Urgencia",
    descripcion: "Inundación por cañería rota en cocina",
    fecha: new Date(Date.now() - 3600).toISOString(),
  },
];

function SupervisorIncidentsLog() {
  const [filter, setFilter] = useState<
    "Todas" | "Rotura" | "Falta de Insumo" | "Urgencia"
  >("Todas");
  const [incidencias, setIncidencias] = useState<any[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIncidents = async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("*")
        .order("fecha", { ascending: false });
      if (error) console.error(error);
      else setIncidencias(data);
      setLoading(false);
    };
    fetchIncidents();
    const channel = supabase
      .channel("realtime:incidents")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidents" },
        fetchIncidents,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await supabase
        .from("incidents")
        .update({ estado: newStatus })
        .eq("id", id);
      if (selectedIncident?.id === id) {
        setSelectedIncident((prev: any) => ({ ...prev, estado: newStatus }));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const filtered = incidencias.filter(
    (i) => filter === "Todas" || i.tipo === filter,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">
            Gestión de Tickets e Incidencias
          </h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Seguimiento y Resolución
          </p>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
          {["Todas", "Rotura", "Falta de Insumo", "Urgencia"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                filter === f
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800",
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
                selectedIncident?.id === inc.id
                  ? "bg-white border-blue-200 shadow-lg"
                  : "bg-white border-slate-100",
                inc.urgencia === "Alta"
                  ? "border-l-4 border-l-rose-500"
                  : inc.urgencia === "Media"
                    ? "border-l-4 border-l-amber-500"
                    : "border-l-4 border-l-blue-500",
              )}
            >
              <div className="flex justify-between items-start mb-3">
                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                    inc.estado === "Abierto" || !inc.estado
                      ? "bg-rose-50 text-rose-600"
                      : inc.estado === "En Proceso"
                        ? "bg-blue-50 text-blue-600"
                        : "bg-emerald-50 text-emerald-600",
                  )}
                >
                  {inc.estado || "Abierto"}
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  {formatArgDate(inc.fecha)}
                </span>
              </div>
              <h4 className="font-bold text-slate-800 mb-1">{inc.tipo}</h4>
              <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                {inc.descripcion}
              </p>
              <div className="flex items-center gap-2 mt-auto pt-3 border-t border-slate-50">
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase">
                  {inc.autor?.[0]}
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {inc.autor}
                </span>
                {inc.urgencia === "Alta" && (
                  <span className="ml-auto text-[9px] font-black text-rose-500 uppercase animate-pulse">
                    ¡Prioridad Alta!
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-[32px] border border-slate-100 p-8 shadow-sm h-fit sticky top-24">
          {selectedIncident ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={selectedIncident.id}
            >
              <div className="flex items-center gap-4 mb-6">
                <div
                  className={cn(
                    "p-3 rounded-2xl",
                    selectedIncident.urgencia === "Alta"
                      ? "bg-rose-50 text-rose-600"
                      : "bg-blue-50 text-blue-600",
                  )}
                >
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 leading-none mb-1">
                    {selectedIncident.tipo}
                  </h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Reportado por {selectedIncident.autor}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 mb-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 underline decoration-blue-200">
                  Detalle del Reporte
                </p>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {selectedIncident.descripcion}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-8">
                <button
                  onClick={() => updateStatus(selectedIncident.id, "Abierto")}
                  className={cn(
                    "py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                    selectedIncident.estado === "Abierto" ||
                      !selectedIncident.estado
                      ? "bg-rose-50 border-rose-200 text-rose-600"
                      : "bg-white border-slate-100 text-slate-400",
                  )}
                >
                  Abierto
                </button>
                <button
                  onClick={() =>
                    updateStatus(selectedIncident.id, "En Proceso")
                  }
                  className={cn(
                    "py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                    selectedIncident.estado === "En Proceso"
                      ? "bg-blue-50 border-blue-200 text-blue-600"
                      : "bg-white border-slate-100 text-slate-400",
                  )}
                >
                  En Proceso
                </button>
                <button
                  onClick={() => updateStatus(selectedIncident.id, "Resuelto")}
                  className={cn(
                    "py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                    selectedIncident.estado === "Resuelto"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                      : "bg-white border-slate-100 text-slate-400",
                  )}
                >
                  Resuelto
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                  Acciones del Supervisor
                </p>
                <button
                  onClick={() =>
                    alert(
                      `Tarea asignada para resolver ${selectedIncident.tipo}`,
                    )
                  }
                  className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-all"
                >
                  Asignar Operario
                </button>
                <button
                  onClick={() =>
                    alert(
                      `Notificación masiva enviada sobre: ${selectedIncident.tipo}`,
                    )
                  }
                  className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-50 transition-all"
                >
                  Notificar a todos
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-300 gap-4 opacity-50">
              <Megaphone className="w-16 h-16" />
              <p className="text-sm font-bold uppercase tracking-widest text-center">
                Selecciona un reporte
                <br />
                para gestionar el ticket
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SupervisorProductivityStats({
  registros,
  operarios,
  tasks,
}: {
  registros: any[];
  operarios: any[];
  tasks: any[];
}) {
  const [filterType, setFilterType] = React.useState<
    "diario" | "semanal" | "mensual" | "custom"
  >("diario");
  const [customStart, setCustomStart] = React.useState("");
  const [customEnd, setCustomEnd] = React.useState("");

  const stats = React.useMemo(() => {
    const today = new Date();
    let startDateObj: Date | null = null;
    let endDateObj: Date | null = null;

    if (filterType === "diario") {
      startDateObj = new Date();
      startDateObj.setHours(0, 0, 0, 0);
      endDateObj = new Date();
      endDateObj.setHours(23, 59, 59, 999);
    } else if (filterType === "semanal") {
      startDateObj = new Date();
      startDateObj.setDate(today.getDate() - 7);
      startDateObj.setHours(0, 0, 0, 0);
      endDateObj = new Date();
      endDateObj.setHours(23, 59, 59, 999);
    } else if (filterType === "mensual") {
      startDateObj = new Date(today.getFullYear(), today.getMonth(), 1);
      endDateObj = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
    } else if (filterType === "custom" && customStart && customEnd) {
      startDateObj = new Date(customStart + "T00:00:00");
      endDateObj = new Date(customEnd + "T23:59:59");
    }

    const operarioStats: Record<
      string,
      { completed: number; totalTime: number }
    > = {};

    // Initialize
    operarios.forEach((op) => {
      operarioStats[op.nombre] = { completed: 0, totalTime: 0 };
    });

    const completedTasks = registros.filter((r) => {
      if (!r.accion?.includes("Tarea:") || !r.fin) return false;

      if (!startDateObj || !endDateObj) return true;
      let recDate = new Date(r.inicio);
      return recDate >= startDateObj && recDate <= endDateObj;
    });

    completedTasks.forEach((r) => {
      if (operarioStats[r.operario_nombre]) {
        operarioStats[r.operario_nombre].completed += 1;
        operarioStats[r.operario_nombre].totalTime += r.duracion_minutos || 0;
      }
    });

    const chartData = Object.entries(operarioStats)
      .map(([name, data]) => ({
        name,
        tasks: data.completed,
        avgTime:
          data.completed > 0 ? Math.round(data.totalTime / data.completed) : 0,
      }))
      .filter((d) => d.tasks > 0 || operarios.length < 10);

    const totalCompleted = completedTasks.length;
    let planCount = tasks.length || 1;
    // Ajustar planCount sg los dias si es necesario o dejarlo para el mes
    const days =
      startDateObj && endDateObj
        ? Math.max(
            1,
            Math.ceil(
              (endDateObj.getTime() - startDateObj.getTime()) /
                (1000 * 3600 * 24),
            ),
          )
        : 1;
    planCount = planCount * days; // Aproximacion base
    if (planCount === 0) planCount = 1;

    const compliance = Math.min(
      100,
      Math.round((totalCompleted / planCount) * 100),
    );

    return { chartData, totalCompleted, compliance, planCount };
  }, [registros, operarios, tasks, filterType, customStart, customEnd]);

  const COLORS = [
    "#3b82f6",
    "#f59e0b",
    "#10b981",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row gap-4 items-end bg-white p-4 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex-1">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">
            Periodo del Reporte
          </label>
          <div className="flex bg-slate-100 p-1 rounded-2xl w-full max-w-md">
            <button
              onClick={() => setFilterType("diario")}
              className={cn(
                "flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all",
                filterType === "diario"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              Diario
            </button>
            <button
              onClick={() => setFilterType("semanal")}
              className={cn(
                "flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all",
                filterType === "semanal"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              Semanal
            </button>
            <button
              onClick={() => setFilterType("mensual")}
              className={cn(
                "flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all",
                filterType === "mensual"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              Mensual
            </button>
            <button
              onClick={() => setFilterType("custom")}
              className={cn(
                "flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all",
                filterType === "custom"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              Personalizado
            </button>
          </div>
        </div>
        {filterType === "custom" && (
          <div className="flex items-center gap-3 w-full md:w-auto">
            <input
              type="date"
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <span className="text-slate-400 font-bold">a</span>
            <input
              type="date"
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title="Tareas Completadas"
          value={stats.totalCompleted}
          icon={<CheckCircle2 className="w-6 h-6 text-emerald-500" />}
          trend="En el periodo"
          sub="Total en el periodo seleccionado"
        />
        <KPICard
          title="Tasa de Cumplimiento"
          value={`${stats.compliance}%`}
          icon={<Activity className="w-6 h-6 text-blue-500" />}
          trend={stats.compliance > 80 ? "Óptimo" : "Atención"}
          sub={`vs ~${stats.planCount} planificadas`}
        />
        <KPICard
          title="Productividad Media"
          value={
            stats.chartData.length > 0
              ? `${Math.round(stats.chartData.reduce((acc, curr) => acc + curr.avgTime, 0) / stats.chartData.length)}m`
              : "0m"
          }
          icon={<Clock className="w-6 h-6 text-amber-500" />}
          sub="Tiempo promedio por tarea"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
          <h3 className="text-sm font-black text-slate-400 mb-6 uppercase tracking-widest px-2">
            Tareas por Operario
          </h3>
          <div className="h-72">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minHeight={1}
              minWidth={1}
            >
              <BarChart data={stats.chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#64748b" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#64748b" }}
                />
                <Tooltip
                  cursor={{ fill: "#f8fafc" }}
                  contentStyle={{
                    borderRadius: "16px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    padding: "12px",
                  }}
                />
                <Bar
                  dataKey="tasks"
                  name="Tareas"
                  fill="#3b82f6"
                  radius={[6, 6, 0, 0]}
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
          <h3 className="text-sm font-black text-slate-400 mb-6 uppercase tracking-widest px-2">
            Tiempo Promedio (Minutos)
          </h3>
          <div className="h-72">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minHeight={1}
              minWidth={1}
            >
              <BarChart data={stats.chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#64748b" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#64748b" }}
                />
                <Tooltip
                  cursor={{ fill: "#f8fafc" }}
                  contentStyle={{
                    borderRadius: "16px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    padding: "12px",
                  }}
                />
                <Bar
                  dataKey="avgTime"
                  name="Minutos"
                  fill="#f59e0b"
                  radius={[6, 6, 0, 0]}
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function SupervisorAnnouncements() {
  const [msg, setMsg] = useState("");
  const [startDateTime, setStartDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [history, setHistory] = useState<any[]>([]);

  const sendAnnouncement = async () => {
    if (!msg.trim()) return;
    const item = {
      text: msg.trim(),
      start_time: startDateTime ? new Date(startDateTime).toISOString() : null,
      end_time: endDateTime ? new Date(endDateTime).toISOString() : null,
    };

    try {
      const { error } = await supabase.from("announcements").insert(item);
      if (error) throw error;
      setMsg("");
      setStartDateTime("");
      setEndDateTime("");
      alert("Comunicado enviado a todo el personal.");
      fetchAnnouncements();
    } catch (error) {
      console.error(error);
      alert("Error al enviar el comunicado.");
    }
  };

  const deleteAnnouncement = async (id: string) => {
    if (!confirm("¿Seguro que deseas eliminar este comunicado?")) return;
    try {
      const { error } = await supabase
        .from("announcements")
        .delete()
        .match({ id: id });
      if (error) throw error;
      setHistory((prev) => prev.filter((h) => h.id !== id));
      alert("Comunicado eliminado.");
    } catch (error) {
      console.error("Error deleting announcement:", error);
      alert("Error al eliminar el comunicado.");
    }
  };

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error(error);
    } else {
      setHistory(data as any[]);
    }
  };

  useEffect(() => {
    fetchAnnouncements();

    const channel = supabase
      .channel("realtime:announcements-admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        fetchAnnouncements,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="bg-white p-8 rounded-[32px] border border-blue-100 shadow-xl shadow-blue-50/50">
        <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-3">
          <Megaphone className="w-6 h-6 text-blue-500" /> Nuevo Comunicado
        </h3>

        <p className="text-xs text-slate-400 font-bold mb-4 uppercase tracking-widest">
          Contenido del Mensaje
        </p>
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Escribe el anuncio para el personal..."
          className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none min-h-[120px] mb-6 focus:border-blue-400"
        />

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">
              Visible Desde (Opcional)
            </label>
            <input
              type="datetime-local"
              value={startDateTime}
              onChange={(e) => setStartDateTime(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-600 outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">
              Visible Hasta (Opcional)
            </label>
            <input
              type="datetime-local"
              value={endDateTime}
              onChange={(e) => setEndDateTime(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-600 outline-none focus:border-blue-400"
            />
          </div>
        </div>

        <button
          onClick={sendAnnouncement}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 active:scale-[0.98] transition-all"
        >
          PUBLICAR COMUNICADO
        </button>
      </div>

      <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col">
        <h3 className="text-sm font-black text-slate-400 mb-6 uppercase tracking-widest">
          Historial de Comunicación
        </h3>
        <div className="space-y-4 overflow-y-auto max-h-[500px] pr-2">
          {history.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-30 py-10">
              <History className="w-12 h-12 mb-2" />
              <p className="text-xs font-bold uppercase tracking-widest">
                Sin historial
              </p>
            </div>
          ) : (
            history.map((h) => (
              <div
                key={h.id}
                className="p-4 bg-slate-50 border border-slate-100 rounded-2xl relative group pr-10"
              >
                <p className="text-xs text-slate-700 leading-relaxed font-medium mb-2">
                  {h.text}
                </p>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    <span>{formatArgDate(h.created_at || h.date)}</span>
                    <span>{formatArgTime(h.created_at || h.date)}</span>
                  </div>
                  {(h.start_time || h.end_time) && (
                    <div className="flex flex-col gap-1 mt-2">
                      {h.start_time && (
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded w-fit">
                          <Clock className="w-3 h-3 text-blue-500" />
                          Desde:{" "}
                          {formatArgDate(h.start_time, {
                            day: "2-digit",
                            month: "short",
                          })}{" "}
                          {formatArgTime(h.start_time)}
                        </div>
                      )}
                      {h.end_time && (
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded w-fit">
                          <Clock className="w-3 h-3 text-blue-500" />
                          Hasta:{" "}
                          {formatArgDate(h.end_time, {
                            day: "2-digit",
                            month: "short",
                          })}{" "}
                          {formatArgTime(h.end_time)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => deleteAnnouncement(h.id)}
                  className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 transition-colors p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const TURNOS_MOCK: Turno[] = [
  {
    id: "t1",
    operarioId: "1",
    operarioNombre: "Juan Perez",
    ubicacion: "Oficinas Centrales",
    inicioEstimado: new Date(Date.now() - 3600000).toISOString(),
    finEstimado: new Date(Date.now() + 7200000).toISOString(),
    estado: "Presente",
    tareasAsignadas: ["1", "2"],
  },
  {
    id: "t2",
    operarioId: "2",
    operarioNombre: "Maria Garcia",
    ubicacion: "Deposito Sur",
    inicioEstimado: new Date(Date.now() - 600000).toISOString(),
    finEstimado: new Date(Date.now() + 14400000).toISOString(),
    estado: "Pendiente",
    tareasAsignadas: [],
  },
  {
    id: "t3",
    operarioId: "3",
    operarioNombre: "Carlos Lopez",
    ubicacion: "Sucursal Norte",
    inicioEstimado: new Date(Date.now() - 1800000).toISOString(),
    finEstimado: new Date(Date.now() + 10800000).toISOString(),
    estado: "Atrasado",
    tareasAsignadas: [],
  },
];

function SupervisorShiftManager() {
  const [turnos, setTurnos] = useState<Turno[]>(TURNOS_MOCK);
  const [loading, setLoading] = useState(false);
  const [alertas, setAlertas] = useState<string[]>([]);
  const [catTareas, setCatTareas] = useState<any[]>([]);

  useEffect(() => {
    const fetchTareas = async () => {
      try {
        const { data, error } = await supabase
          .from("tasks")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setCatTareas(data || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchTareas();
  }, []);
  useEffect(() => {
    // Simulamos verificación de alertas automáticas
    const checkAlerts = () => {
      const now = new Date();
      const nuevosAtrasados = turnos.map((t) => {
        if (t.estado === "Pendiente") {
          const inicio = new Date(t.inicioEstimado);
          const diffMinutes = (now.getTime() - inicio.getTime()) / 60000;
          if (diffMinutes > 15) {
            return { ...t, estado: "Atrasado" as const };
          }
        }
        return t;
      });

      const alertsEncontradas = nuevosAtrasados
        .filter((t) => t.estado === "Atrasado")
        .map(
          (t) =>
            `¡ALERTA!: ${t.operarioNombre} no ha marcado entrada en ${t.ubicacion} (Turno: ${formatArgTime(t.inicioEstimado)})`,
        );

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

    setTurnos((prev) =>
      prev.map((t) =>
        t.id === turnoId
          ? { ...t, estado: "Presente", reemplazoNombre: reemplazo }
          : t,
      ),
    );
    alert(`Reemplazo asignado: ${reemplazo}`);
  };

  const asignarTarea = (turnoId: string) => {
    const tareaId = prompt(
      "Lista de IDs de tareas disponibles: " +
        catTareas.map((ct) => `${ct.id}: ${ct.titulo}`).join(", "),
    );
    if (!tareaId) return;

    const exists = catTareas.find((t) => t.id === tareaId);
    if (!exists) {
      alert("ID de tarea no válido");
      return;
    }

    setTurnos((prev) =>
      prev.map((t) => {
        if (t.id === turnoId) {
          const current = t.tareasAsignadas || [];
          if (current.includes(tareaId)) return t;
          return { ...t, tareasAsignadas: [...current, tareaId] };
        }
        return t;
      }),
    );
  };

  return (
    <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col p-6 w-full max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="font-bold text-xl text-slate-800 tracking-tight">
            Control de Asistencia
          </h3>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-0.5">
            Gestión de Turnos y Reemplazos
          </p>
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
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-6 space-y-2 overflow-hidden"
          >
            {alertas.map((alerta, i) => (
              <div
                key={i}
                className="bg-rose-600 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-6 h-6 animate-bounce" />
                  <p className="text-sm font-black uppercase tracking-tight">
                    {alerta}
                  </p>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
          Turnos de Hoy
        </h4>
        {turnos.map((t) => (
          <div
            key={t.id}
            className={cn(
              "p-5 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4",
              t.estado === "Atrasado"
                ? "bg-rose-50 border-rose-200 shadow-rose-100"
                : "bg-white border-slate-100 hover:border-blue-200",
            )}
          >
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center text-white",
                  t.estado === "Presente"
                    ? "bg-emerald-500"
                    : t.estado === "Atrasado"
                      ? "bg-rose-500"
                      : "bg-slate-300",
                )}
              >
                {t.estado === "Presente" ? (
                  <CheckCircle2 className="w-8 h-8" />
                ) : t.estado === "Atrasado" ? (
                  <AlertTriangle className="w-8 h-8" />
                ) : (
                  <Clock className="w-8 h-8" />
                )}
              </div>
              <div>
                <h5 className="font-black text-slate-800">
                  {t.operarioNombre}
                </h5>
                <p className="text-xs text-slate-500 font-bold">
                  {t.ubicacion}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-[10px] font-black uppercase text-slate-400">
                    {formatArgTime(t.inicioEstimado)} -{" "}
                    {formatArgTime(t.finEstimado)}
                  </span>
                  {t.reemplazoNombre && (
                    <span className="text-[9px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                      REEMPLAZO: {t.reemplazoNombre}
                    </span>
                  )}

                  {t.tareasAsignadas && t.tareasAsignadas.length > 0 && (
                    <div className="flex gap-1 ml-2">
                      {t.tareasAsignadas.map((tid) => {
                        const match = catTareas.find((c) => c.id === tid);
                        return (
                          <span
                            key={tid}
                            className="text-[8px] font-black bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-100"
                          >
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
              <div
                className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase",
                  t.estado === "Presente"
                    ? "bg-emerald-50 text-emerald-600"
                    : t.estado === "Atrasado"
                      ? "bg-rose-100 text-rose-600 animate-pulse"
                      : "bg-slate-100 text-slate-500",
                )}
              >
                {t.estado}
              </div>
              {t.estado === "Atrasado" && (
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
  estado: "Pendiente" | "Aprobado" | "Rechazado";
  alertaConsumo?: boolean;
}

const INSUMOS_MOCK: Insumo[] = [
  {
    id: "1",
    nombre: "Lavandina Concentrada",
    stock: 5,
    unidad: "L",
    critico: true,
    imagen:
      "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=100&h=100&fit=crop",
    consumoNormal: 2,
  },
  {
    id: "2",
    nombre: "Limpiador de Pisos",
    stock: 2,
    unidad: "L",
    critico: false,
    imagen:
      "https://images.unsplash.com/photo-1563453392212-326f55821173?w=100&h=100&fit=crop",
    consumoNormal: 2,
  },
  {
    id: "3",
    nombre: "Papel Higiénico 30m",
    stock: 12,
    unidad: "Rollos",
    critico: true,
    imagen:
      "https://images.unsplash.com/photo-1584622781564-1d9876a13d00?w=100&h=100&fit=crop",
    consumoNormal: 10,
  },
  {
    id: "4",
    nombre: "Bolsas de Consorcio",
    stock: 50,
    unidad: "U",
    critico: false,
    imagen:
      "https://images.unsplash.com/photo-1610691023059-59eb19fed992?w=100&h=100&fit=crop",
    consumoNormal: 20,
  },
];

interface Operario {
  id?: string;
  nombre: string;
  usuario?: string;
  pin?: string;
  rol: "operario" | "supervisor";
  email?: string;
  whatsapp?: string;
  horario_entrada?: string; // HH:mm
  horario_salida?: string; // HH:mm
  activo?: boolean;
}

// -- Components for New Modules --

function InsumosModule({ user }: { user: Operario }) {
  const [insumos, setInsumos] = useState(INSUMOS_MOCK);
  const [requesting, setRequesting] = useState<string | null>(null);
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
      estado: "Pendiente",
      alertaConsumo: quantity > normal,
    };

    const savedRequests = JSON.parse(
      localStorage.getItem("pending_insumos") || "[]",
    );
    localStorage.setItem(
      "pending_insumos",
      JSON.stringify([...savedRequests, pedido]),
    );

    setTimeout(() => {
      setRequesting(null);
      alert(
        `Solicitud de ${quantity}x ${name} enviada para aprobación del supervisor.`,
      );
    }, 1000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-4"
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-lg font-black text-slate-800 tracking-tight leading-none mb-1">
            Insumos en Sitio
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Catálogo Visual y Pedidos
          </p>
        </div>
        <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl">
          <Package className="w-6 h-6" />
        </div>
      </div>

      {isFriday && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl mb-2 flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-emerald-800 uppercase tracking-widest">
              ¡Es Viernes!
            </p>
            <p className="text-[10px] text-emerald-600 font-bold">
              Reporte de stock semanal obligatorio.
            </p>
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
        {insumos.map((item) => (
          <div
            key={item.id}
            className="bg-white border border-slate-100 rounded-3xl p-3 shadow-sm flex flex-col gap-3 relative overflow-hidden group"
          >
            <div className="w-full h-24 bg-slate-50 rounded-2xl overflow-hidden relative">
              <img
                src={item.imagen}
                alt={item.nombre}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute top-2 right-2 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-[9px] font-black text-slate-800 border border-slate-100 shadow-sm">
                STOCK: {item.stock}
              </div>
            </div>
            <div className="px-1">
              <h4 className="text-xs font-black text-slate-800 truncate leading-tight mb-1">
                {item.nombre}
              </h4>
              <p className="text-[9px] text-slate-400 font-bold uppercase">
                {item.unidad}
              </p>
            </div>
            <button
              onClick={() => {
                const qty = prompt(
                  `¿Cuántos ${item.unidad} de ${item.nombre} necesitas?`,
                  "1",
                );
                if (qty && !isNaN(Number(qty))) {
                  handleRequest(
                    item.nombre,
                    Number(qty),
                    item.consumoNormal || 2,
                  );
                }
              }}
              disabled={!!requesting}
              className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95"
            >
              {requesting === item.nombre ? (
                <RefreshCcw className="w-3 h-3 animate-spin" />
              ) : (
                "PEDIR"
              )}
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
                <h3 className="text-lg font-black text-slate-800 tracking-tight">
                  Reporte Stock Semanal
                </h3>
                <button
                  onClick={() => setShowStockReport(false)}
                  className="p-2 bg-slate-100 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4 mb-6 max-h-[40vh] overflow-y-auto px-1">
                {insumos.map((i) => (
                  <div
                    key={i.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl"
                  >
                    <span className="text-xs font-bold text-slate-700">
                      {i.nombre}
                    </span>
                    <input
                      type="number"
                      placeholder="Queda..."
                      className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold outline-none text-right"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  alert("Reporte de stock enviado.");
                  setShowStockReport(false);
                }}
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
        <p className="text-xs text-amber-700 italic">
          "Los pedidos realizados antes de las 10:00 se entregan el mismo día."
        </p>
      </div>
    </motion.div>
  );
}

function CapacitacionModule() {
  const manuals = [
    {
      title: "Uso de Químicos Arevalo v2",
      type: "PDF",
      icon: FileText,
      color: "text-blue-500",
    },
    {
      title: "Protocolo de Baños en Oficinas",
      type: "Video",
      icon: Play,
      color: "text-emerald-500",
    },
    {
      title: "Seguridad y Salud (SST)",
      type: "Tutorial",
      icon: ShieldCheck,
      color: "text-rose-500",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-black text-slate-800 tracking-tight leading-none mb-1">
            Capacitación
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Manuales y Procedimientos
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {manuals.map((m, i) => (
          <div
            key={i}
            className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all cursor-pointer group"
          >
            <div
              className={cn(
                "w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center group-hover:scale-110 transition-transform",
                m.color,
              )}
            >
              <m.icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-black text-slate-800">{m.title}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {m.type}
              </p>
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-800 tracking-tight leading-none mb-1">
            RRHH Arevalo
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Nómina y Beneficios
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-600 rounded-3xl p-5 text-white shadow-xl shadow-blue-100">
          <Calendar className="w-6 h-6 mb-3" />
          <p className="text-2xl font-black leading-none mb-1">12</p>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">
            Días Vacaciones
          </p>
        </div>
        <div className="bg-emerald-500 rounded-3xl p-5 text-white shadow-xl shadow-emerald-100">
          <FileText className="w-6 h-6 mb-3" />
          <p className="text-2xl font-black leading-none mb-1">0</p>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">
            Pendientes
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">
          Recibos de Sueldo
        </h4>
        {[
          { month: "Abril 2025", status: "Pendiente Firma" },
          { month: "Marzo 2025", status: "Recibido" },
        ].map((r, i) => (
          <div
            key={i}
            className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between"
          >
            <div>
              <p className="text-sm font-bold text-slate-800">{r.month}</p>
              <p
                className={cn(
                  "text-[9px] font-black uppercase tracking-widest",
                  r.status === "Recibido"
                    ? "text-emerald-500"
                    : "text-rose-500",
                )}
              >
                {r.status === "Pendiente Firma" && signed
                  ? "Firmado"
                  : r.status}
              </p>
            </div>
            {r.status === "Pendiente Firma" && !signed ? (
              <button
                onClick={() => {
                  if (
                    confirm(
                      "¿Confirmas la firma del recibo mediante token digital?",
                    )
                  ) {
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

function IncidenciasModule({
  user,
  onReported,
}: {
  user: Operario;
  onReported: () => void;
}) {
  const [desc, setDesc] = useState("");
  const [tipo, setTipo] = useState<
    "Rotura" | "Falta de Insumo" | "Urgencia" | "Otro"
  >("Rotura");
  const [urgencia, setUrgencia] = useState<"Baja" | "Media" | "Alta">("Media");
  const [isPhotoed, setIsPhotoed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showShareModal, setShowShareModal] = useState<{
    id: string;
    content: string;
  } | null>(null);

  const handleReport = async () => {
    if (!desc) return;
    setLoading(true);

    const nuevaIncidencia = {
      operario_id: user.id || "unknown",
      autor: user.nombre,
      tipo,
      urgencia,
      descripcion: desc,
      fecha: new Date().toISOString(),
      estado: "Abierto",
    };

    try {
      const { data, error } = await supabase
        .from("incidents")
        .insert(nuevaIncidencia)
        .select()
        .single();
      if (error) throw error;
      setLoading(false);

      const shareContent = `*Reporte de Incidencia*\n📌 *Tipo:* ${tipo}\n🚨 *Urgencia:* ${urgencia}\n👤 *Autor:* ${user.nombre}\n📝 *Descripción:* ${desc}`;
      setShowShareModal({ id: data.id, content: shareContent });
    } catch (error) {
      console.error("Error reporting incident:", error);
      setLoading(false);
    }
  };

  const shareViaWhatsApp = () => {
    if (!showShareModal) return;
    const url = `https://wa.me/?text=${encodeURIComponent(showShareModal.content)}`;
    window.open(url, "_blank");
    setShowShareModal(null);
    onReported();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white border-2 border-rose-100 rounded-[32px] p-6 shadow-2xl shadow-rose-50 mb-10 overflow-hidden"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-rose-200">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-800 tracking-tight leading-none mb-1">
            Nueva Incidencia
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Reporte Directo al Supervisor
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Tipo de Evento
            </label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-3 text-xs font-bold outline-none"
            >
              <option value="Rotura">Rotura 🛠️</option>
              <option value="Falta de Insumo">Falta Insumo 📦</option>
              <option value="Urgencia">Urgencia 🚨</option>
              <option value="Otro">Otro ✨</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Urgencia
            </label>
            <select
              value={urgencia}
              onChange={(e) => setUrgencia(e.target.value as any)}
              className={cn(
                "w-full border rounded-2xl px-3 py-3 text-xs font-bold outline-none",
                urgencia === "Alta"
                  ? "bg-rose-50 border-rose-200 text-rose-600"
                  : urgencia === "Media"
                    ? "bg-amber-50 border-amber-200 text-amber-600"
                    : "bg-blue-50 border-blue-200 text-blue-600",
              )}
            >
              <option value="Baja">Baja</option>
              <option value="Media">Media</option>
              <option value="Alta">Alta</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
            Descripción
          </label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="¿Qué ocurrió? Sé descriptivo..."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none min-h-[100px] resize-none"
          />
        </div>

        <button
          onClick={() => setIsPhotoed(true)}
          className={cn(
            "w-full py-4 rounded-2xl border-2 border-dashed transition-all flex items-center justify-center gap-3",
            isPhotoed
              ? "bg-emerald-50 border-emerald-200 text-emerald-600"
              : "bg-slate-50 border-slate-200 text-slate-400",
          )}
        >
          <Camera className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-widest">
            {isPhotoed ? "Evidencia Capturada" : "Tomar Foto Evidencia"}
          </span>
        </button>

        <button
          onClick={handleReport}
          disabled={!desc || loading}
          className="w-full bg-slate-900 text-white py-4 rounded-[20px] font-black text-sm uppercase tracking-widest disabled:opacity-50 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-2"
        >
          {loading ? (
            <RefreshCcw className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <MoveRight className="w-5 h-5" /> ENVIAR REPORTE
            </>
          )}
        </button>

        <button
          onClick={onReported}
          className="w-full text-center text-slate-400 text-[10px] font-black uppercase tracking-widest py-2"
        >
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
              <h3 className="text-2xl font-black text-[#0b3464] mb-2 tracking-tight">
                ¡Reporte Enviado!
              </h3>
              <p className="text-sm font-bold text-slate-500 mb-8 px-4">
                El incidente ha sido registrado. ¿Quieres compartir un resumen
                por WhatsApp al supervisor?
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={shareViaWhatsApp}
                  className="w-full py-4 bg-[#25D366] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-200 flex items-center justify-center gap-2"
                >
                  Compartir WhatsApp
                </button>
                <button
                  onClick={() => {
                    setShowShareModal(null);
                    onReported();
                  }}
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
  onCommentChange,
}: {
  tarea: TareaPlan;
  onFinish: () => void;
  durationText: string;
  comment: string;
  onCommentChange: (val: string) => void;
}) {
  const [checklist, setChecklist] = useState<string[]>([]);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const steps = [
    "Verificado de superficie",
    "Limpieza profunda con químicos",
    "Desinfección de puntos críticos",
    "Reposición de insumos local",
    "Retiro de residuos",
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
          <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">
            {tarea.frecuencia}
          </p>
          <h3 className="text-xl font-black text-slate-900 leading-tight">
            {tarea.titulo}
          </h3>
          {tarea.descripcion && (
            <p className="text-xs text-slate-400 mt-2 italic">
              "{tarea.descripcion}"
            </p>
          )}
        </div>
        <div className="text-right">
          <div className="text-3xl font-black text-emerald-500 font-mono tracking-tighter leading-none mb-1">
            {durationText}
          </div>
          <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
            En curso
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">
          Checklist Compliance
        </p>
        {steps.map((step, i) => (
          <button
            key={i}
            onClick={() => {
              if (checklist.includes(step))
                setChecklist(checklist.filter((s) => s !== step));
              else setChecklist([...checklist, step]);
            }}
            className={cn(
              "w-full p-4 rounded-2xl flex items-center gap-3 transition-all border",
              checklist.includes(step)
                ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                : "bg-slate-50 border-slate-100 text-slate-500",
            )}
          >
            <CheckCircle2
              className={cn(
                "w-5 h-5",
                checklist.includes(step)
                  ? "text-emerald-500"
                  : "text-slate-300",
              )}
            />
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
            <span className="text-xs font-black uppercase">
              Evidencia Fotográfica Ok
            </span>
          </div>
        ) : (
          <button
            onClick={handleCapture}
            disabled={capturing}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-14 h-14 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-blue-50 transition-all">
              <Camera
                className={cn(
                  "w-8 h-8 text-slate-400",
                  capturing && "animate-pulse",
                )}
              />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {capturing ? "Capturando..." : "Obligatorio: Foto Evidencia"}
            </span>
          </button>
        )}
      </div>

      <div className="relative">
        <textarea
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
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
          checklist.length === steps.length && hasPhoto
            ? "bg-[#0b3464] text-white shadow-[#0b3464]/20"
            : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none",
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
      console.log("beforeinstallprompt event fired");
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setShowInstallBtn(false);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return false;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
    return true;
  };

  return { showInstallBtn, handleInstall, isSupported: !!deferredPrompt };
}

function PWAHelpModal({
  isOpen,
  onClose,
  installProps,
}: {
  isOpen: boolean;
  onClose: () => void;
  installProps: any;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full"
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>

        <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
          <Monitor className="w-6 h-6 text-blue-500" /> Guía de Instalación
        </h3>

        <div className="space-y-6">
          <section>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <div className="w-5 h-5 bg-blue-100 rounded text-blue-600 flex items-center justify-center">
                1
              </div>
              ¿Cómo instalar?
            </h4>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-xs font-black text-slate-800 mb-1">
                  Android (Chrome)
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Pulsa el botón "Instalar App" en el menú o busca en el menú de
                  Chrome (3 puntos) la opción{" "}
                  <strong>"Instalar aplicación"</strong>.
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-xs font-black text-slate-800 mb-1">
                  iPhone / iOS (Safari)
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Pulsa el botón <strong>Compartir</strong> (cuadrado con flecha
                  arriba) y selecciona{" "}
                  <strong>"Añadir a pantalla de inicio"</strong>.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <div className="w-5 h-5 bg-rose-100 rounded text-rose-600 flex items-center justify-center">
                2
              </div>
              ¿No puedes reinstalar?
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed bg-rose-50 p-4 rounded-2xl border border-rose-100">
              Si borraste la app y el botón no aparece, usa la opción manual del
              navegador descrita arriba. Si persiste, borra el historial/caché
              de este sitio en tu navegador.
            </p>
          </section>
        </div>

        <button
          onClick={async () => {
            const success = await installProps.handleInstall();
            if (!success) {
              alert("Usa el método manual de tu navegador para instalar.");
            }
          }}
          className="btn-primary w-full mt-8"
        >
          Intentar Instalación Automática
        </button>
      </motion.div>
    </div>
  );
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
              (e.target as HTMLImageElement).src =
                "https://cdn-icons-png.flaticon.com/512/3649/3649255.png";
            }}
          />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">Instalar Aplicación</p>
          <p className="text-[10px] text-blue-100 font-medium">
            Versión optimizada para celular
          </p>
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

// -- Operario Task History --
function OperarioTaskHistory({ user }: { user: Operario }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data, error } = await supabase
          .from("logs")
          .select("*")
          .eq("operario_id", user.id)
          .like("accion", "Tarea:%")
          .not("fin", "is", null) // Only completed tasks
          .order("inicio", { ascending: false })
          .limit(50);

        if (error) throw error;
        setHistory(data || []);
      } catch (err) {
        console.error("Error fetching history:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [user.id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 opacity-30">
        <RefreshCcw className="w-10 h-10 animate-spin mb-4" />
        <p className="text-xs font-black uppercase tracking-widest">
          Cargando Historial...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
        <History className="w-5 h-5 text-blue-500" /> Mis Tareas Recientes
      </h3>

      {history.length === 0 ? (
        <div className="bg-slate-50 border border-slate-100 rounded-3xl p-10 flex flex-col items-center justify-center text-center">
          <ClipboardList className="w-12 h-12 text-slate-200 mb-4" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Aún no has completado tareas.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {history.map((h) => {
            const taskTitle = h.accion.replace("Tarea: ", "");
            const startDate = new Date(h.inicio);
            const endDate = new Date(h.fin);

            return (
              <div
                key={h.id}
                className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-black text-slate-800 text-sm">
                      {taskTitle}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                      {formatArgDate(h.inicio)}
                    </p>
                  </div>
                  <div className="bg-emerald-50 text-emerald-600 text-[9px] font-black px-2 py-1 rounded-lg border border-emerald-100 uppercase">
                    Completada
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">
                      Duración
                    </span>
                    <span className="text-xs font-bold text-slate-600">
                      {h.duracion_minutos} min
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">
                      Finalizó a las
                    </span>
                    <span className="text-xs font-bold text-slate-600">
                      {formatArgTime(h.fin)}
                    </span>
                  </div>
                </div>

                {h.detalles && (
                  <div className="mt-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <p className="text-[10px] text-slate-500 font-medium italic">
                      {h.detalles}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// -- Main App --

function PersonalManagerView() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"timesheet" | "users">("timesheet");

  const [formData, setFormData] = useState({
    id: "",
    nombre: "",
    usuario: "",
    pin: "",
    rol: "operario",
    activo: true,
    horario_entrada: "08:00",
    horario_salida: "17:00",
  });

  const [schedules, setSchedules] = useState<any[]>([]);
  const [scheduleData, setScheduleData] = useState({
    operarioNombre: "",
    fecha: "",
    inicioEstimado: "08:00",
    finEstimado: "17:00",
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("users").select("*").order("nombre");
      if (error) throw error;
      setUsers(data || []);
    } catch (e: any) {
      console.error(e);
      alert("Error cargando usuarios: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSchedules = () => {
    try {
      const saved = localStorage.getItem("limpieza_turnos_scheduled");
      if (saved) {
         setSchedules(JSON.parse(saved));
      }
    } catch(e) {}
  };

  useEffect(() => {
    fetchUsers();
    loadSchedules();
  }, []);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre || !formData.usuario || !formData.pin) {
      alert("Completar todos los campos requeridos");
      return;
    }

    try {
      if (editingUser) {
        const { error } = await supabase.from("users").update({
          nombre: formData.nombre,
          usuario: formData.usuario,
          pin: formData.pin,
          rol: formData.rol,
          activo: formData.activo,
          horario_entrada: formData.horario_entrada,
          horario_salida: formData.horario_salida,
        }).eq("id", editingUser.id);
        if (error) throw error;
        alert("Usuario actualizado con horario asignado");
      } else {
        const newId = formData.usuario.toLowerCase().trim();
        const { error } = await supabase.from("users").insert({
          id: newId,
          nombre: formData.nombre,
          usuario: formData.usuario,
          pin: formData.pin,
          rol: formData.rol,
          activo: formData.activo,
          horario_entrada: formData.horario_entrada,
          horario_salida: formData.horario_salida,
        });
        if (error) throw error;
        alert("Usuario creado con horario asignado");
      }
      setIsAdding(false);
      setEditingUser(null);
      fetchUsers();
    } catch (e: any) {
      console.error(e);
      alert("Error: " + e.message);
    }
  };

  const handleEdit = (u: any) => {
    setEditingUser(u);
    setFormData({
      id: u.id,
      nombre: u.nombre || "",
      usuario: u.usuario || "",
      pin: u.pin || "",
      rol: u.rol || "operario",
      activo: u.activo ?? true,
      horario_entrada: u.horario_entrada || "08:00",
      horario_salida: u.horario_salida || "17:00",
    });
    setIsAdding(true);
    setActiveSubTab("users");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Seguro que desea eliminar este usuario?")) return;
    try {
       const { error } = await supabase.from("users").delete().eq("id", id);
       if (error) throw error;
       fetchUsers();
    } catch (e: any) {
       alert("Error al eliminar: " + e.message);
    }
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
     e.preventDefault();
     if (!scheduleData.operarioNombre || !scheduleData.fecha || !scheduleData.inicioEstimado) {
       alert("Completar campos de horario"); return;
     }
     const newSchedules = [...schedules.filter(s => !(s.operarioNombre === scheduleData.operarioNombre && s.fecha === scheduleData.fecha)), scheduleData];
     setSchedules(newSchedules);
     localStorage.setItem("limpieza_turnos_scheduled", JSON.stringify(newSchedules));
     setScheduleData({...scheduleData, fecha: "", inicioEstimado: "08:00", finEstimado: "17:00"});
     alert("Horario de turno guardado");
  };

  const handleDeleteSchedule = (idx: number) => {
     const newSchedules = schedules.filter((_, i) => i !== idx);
     setSchedules(newSchedules);
     localStorage.setItem("limpieza_turnos_scheduled", JSON.stringify(newSchedules));
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Gestión Integral del Personal y Asistencia
          </h2>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Control de usuarios, asignación de horarios habituales y seguimiento en hoja de horas semanal.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingUser(null);
              setFormData({id:"", nombre:"", usuario:"", pin:"", rol:"operario", activo:true, horario_entrada: "08:00", horario_salida: "17:00"});
              setIsAdding(!isAdding);
              if (!isAdding) setActiveSubTab("users");
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition-colors cursor-pointer shadow-sm"
          >
            {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {isAdding ? "Cancelar" : "Nuevo Usuario"}
          </button>
        </div>
      </div>

      {/* Sub Tab Navigation */}
      <div className="flex bg-slate-200/60 p-1 rounded-2xl w-full max-w-md">
        <button
          onClick={() => setActiveSubTab("timesheet")}
          className={cn(
            "flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer",
            activeSubTab === "timesheet"
              ? "bg-white text-blue-600 shadow-xs font-black"
              : "text-slate-500 hover:text-slate-700 font-bold"
          )}
        >
          📅 Hoja de Horas y Control Semanal
        </button>

        <button
          onClick={() => setActiveSubTab("users")}
          className={cn(
            "flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer",
            activeSubTab === "users"
              ? "bg-white text-blue-600 shadow-xs font-black"
              : "text-slate-500 hover:text-slate-700 font-bold"
          )}
        >
          👥 Usuarios y Horarios Asignados ({users.length})
        </button>
      </div>

      {/* SUB TAB 1: TIMESHEET AND WEEKLY CALENDAR */}
      {activeSubTab === "timesheet" && (
        <SupervisorTimesheetModule operarios={users} />
      )}

      {/* SUB TAB 2: USER MANAGEMENT & SCHEDULE ASSIGNMENT */}
      {activeSubTab === "users" && (
        <div className="flex flex-col gap-6 w-full">
          {isAdding && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-4">
              <h3 className="text-lg font-black mb-4 text-slate-800">
                {editingUser ? "Editar Usuario y Modificar Horario" : "Nuevo Usuario y Asignación de Horario"}
              </h3>
              <form onSubmit={handleSaveUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Nombre Completo</label>
                  <input type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm font-bold" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Nombre de Usuario (Login)</label>
                  <input type="text" value={formData.usuario} onChange={e => setFormData({...formData, usuario: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm font-bold" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">PIN / Contraseña</label>
                  <input type="text" value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm font-bold" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Rol</label>
                  <select value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm font-bold" required>
                    <option value="operario">Operario</option>
                    <option value="supervisor">Supervisor</option>
                  </select>
                </div>

                {/* Asignación de Horarios por el Administrador */}
                <div className="md:col-span-2 p-4 bg-blue-50/50 border border-blue-100 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
                  <div>
                    <label className="block text-xs font-black text-blue-900 mb-1 uppercase tracking-wider">Hora Ingreso Habitual</label>
                    <input type="time" value={formData.horario_entrada} onChange={e => setFormData({...formData, horario_entrada: e.target.value})} className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-sm font-bold" required />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-blue-900 mb-1 uppercase tracking-wider">Hora Egreso Habitual</label>
                    <input type="time" value={formData.horario_salida} onChange={e => setFormData({...formData, horario_salida: e.target.value})} className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-sm font-bold" required />
                  </div>
                </div>

                <div className="md:col-span-2 flex items-center gap-2 mt-2">
                  <input type="checkbox" checked={formData.activo} onChange={e => setFormData({...formData, activo: e.target.checked})} id="activo-chk" />
                  <label htmlFor="activo-chk" className="text-sm font-bold text-slate-700">Usuario Activo</label>
                </div>
                <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                  <button type="button" onClick={() => setIsAdding(false)} className="px-5 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200">
                    Cancelar
                  </button>
                  <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700">
                    Guardar Usuario y Horarios
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* User List Table */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuario</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">PIN</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rol</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Horario Asignado</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-bold text-slate-800 text-sm">{u.nombre}</td>
                      <td className="px-6 py-4 font-mono text-slate-600 text-sm">{u.usuario}</td>
                      <td className="px-6 py-4 font-mono text-slate-500 text-sm">{u.pin}</td>
                      <td className="px-6 py-4">
                        <span className={cn("text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider", u.rol === "supervisor" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700")}>
                          {u.rol}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-xs text-slate-700">
                        <span className="bg-slate-100 border border-slate-200/80 px-2.5 py-1 rounded-lg">
                          {u.horario_entrada || "08:00"} hs - {u.horario_salida || "17:00"} hs
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn("w-3 h-3 rounded-full inline-block border-2 border-white shadow-sm", u.activo ? "bg-emerald-500" : "bg-rose-500")} title={u.activo ? "Activo" : "Inactivo"} />
                      </td>
                      <td className="px-6 py-4 flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(u)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg flex items-center gap-1 text-xs font-bold" title="Modificar Horario y Datos">
                          <Edit3 className="w-4 h-4" />
                          <span className="hidden sm:inline">Modificar Horario</span>
                        </button>
                        <button onClick={() => handleDelete(u.id)} className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg" title="Eliminar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400 font-bold text-xs uppercase tracking-widest">
                        Sin usuarios
                      </td>
                    </tr>
                  )}
                  {loading && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400 font-bold text-xs uppercase tracking-widest">
                        Cargando...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Schedule Shift Adder */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-black mb-4 text-slate-800">
              Gestión de Horarios Específicos por Fecha / Turno
            </h3>
            <form onSubmit={handleSaveSchedule} className="flex flex-col md:flex-row gap-4 items-end mb-6">
              <div className="w-full md:w-1/4">
                <label className="block text-xs font-bold text-slate-500 mb-1">Operario</label>
                <select value={scheduleData.operarioNombre} onChange={e => setScheduleData({...scheduleData, operarioNombre: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm font-bold" required>
                  <option value="">Seleccionar...</option>
                  {users.filter(u => u.rol === "operario").map(u => (
                    <option key={u.id} value={u.nombre}>{u.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="w-full md:w-1/4">
                <label className="block text-xs font-bold text-slate-500 mb-1">Fecha Programada</label>
                <input type="date" value={scheduleData.fecha} onChange={e => setScheduleData({...scheduleData, fecha: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm font-bold" required />
              </div>
              <div className="w-full md:w-1/4">
                <label className="block text-xs font-bold text-slate-500 mb-1">Hora Ingreso Estimada</label>
                <input type="time" value={scheduleData.inicioEstimado} onChange={e => setScheduleData({...scheduleData, inicioEstimado: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm font-bold" required />
              </div>
              <div className="w-full md:w-1/4">
                <label className="block text-xs font-bold text-slate-500 mb-1">Hora Egreso Estimada</label>
                <input type="time" value={scheduleData.finEstimado} onChange={e => setScheduleData({...scheduleData, finEstimado: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm font-bold" required />
              </div>
              <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shrink-0 h-[46px]">
                Agregar Turno
              </button>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Operario</th>
                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Horario Previsto</th>
                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Quitar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {schedules.map((s, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 text-sm font-bold text-slate-700">{s.operarioNombre}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-500">{s.fecha}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-500">{s.inicioEstimado} - {s.finEstimado || "17:00"} hs</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleDeleteSchedule(idx)} className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {schedules.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-6 text-slate-400 font-bold text-xs uppercase tracking-widest">
                        Sin horarios programados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const installProps = usePWAInstall();
  useReminderChecker();
  // Authentication State
  const [user, setUser] = useStickyState<Operario | null>(
    null,
    "limpieza_user",
  );
  const [authLoading, setAuthLoading] = useState(true);
  const [showPWAHelp, setShowPWAHelp] = useState(false);
  const [loginDate, setLoginDate] = useStickyState<string | null>(
    null,
    "limpieza_login_date",
  );

  // Google Calendar Integration States
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (fUser, token) => {
        setGoogleUser(fUser);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      },
    );
    return () => unsubscribe();
  }, []);

  const handleLinkGoogleCalendar = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Error al conectar con Google Calendar: ${err.message || err}`);
    }
  };

  const handleUnlinkGoogleCalendar = async () => {
    if (
      !confirm(
        "¿Estás seguro de que deseas desconectar tu cuenta de Google Calendar?",
      )
    )
      return;
    try {
      await googleSignOut();
      setGoogleUser(null);
      setGoogleToken(null);
    } catch (err: any) {
      console.error(err);
      alert("Error al desconectar la cuenta.");
    }
  };

  useEffect(() => {
    // Basic auth mapping is no longer needed with Supabase and custom PIN login
    setAuthLoading(false);
  }, []);

  // App states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Shift & Task states
  const [shiftState, setShiftState] = useStickyState<
    "idle" | "active" | "paused"
  >("idle", "limpieza_shift_state");
  const [shiftStart, setShiftStart] = useStickyState<string | null>(
    null,
    "limpieza_shift_start",
  );
  const [jornadaStart, setJornadaStart] = useStickyState<string | null>(
    null,
    "limpieza_jornada_start",
  );
  const [breakStart, setBreakStart] = useStickyState<string | null>(
    null,
    "limpieza_break_start",
  );

  const [activeTask, setActiveTask] = useStickyState<TareaPlan | null>(
    null,
    "limpieza_active_task",
  );
  const [taskStart, setTaskStart] = useStickyState<string | null>(
    null,
    "limpieza_task_start",
  );
  const [taskComment, setTaskComment] = useStickyState<string>(
    "",
    "limpieza_task_comment",
  );

  const [sessionLogId, setSessionLogId] = useStickyState<string | null>(
    null,
    "limpieza_session_log_id",
  );
  const [shiftLogId, setShiftLogId] = useStickyState<string | null>(
    null,
    "limpieza_shift_log_id",
  );
  const [breakLogId, setBreakLogId] = useStickyState<string | null>(
    null,
    "limpieza_break_log_id",
  );
  const [taskLogId, setTaskLogId] = useStickyState<string | null>(
    null,
    "limpieza_task_log_id",
  );

  const [targetCoords, setTargetCoords] = useStickyState<{
    lat: number;
    lng: number;
  } | null>(null, "limpieza_target_coords");
  const [currentCoords, setCurrentCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Menu & Dashboard States
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [activeTab, setActiveTab] = useState<
    | "tareas"
    | "horarios"
    | "insumos"
    | "incidencias"
    | "capacitacion"
    | "rrhh"
    | "perfil"
    | "historial"
  >("tareas");
  const [location, setLocation] = useState<string>("");
  const [notificationsCount, setNotificationsCount] = useState(0);

  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setLocation(
            `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
          );
          setCurrentCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => {
          console.error("Geo error:", err);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        },
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    async function checkNotifications() {
      if (!user) return;
      try {
        const notifs: any[] = [];
        const todayStr = getArgentinaDate();

        let query = supabase.from("tasks").select("*");
        if (user.rol === "operario") {
          query = query.or(
            `created_by_id.eq.${user.id},asignados.cs.{${user.nombre}}`,
          );
        }
        query = query.order("created_at", { ascending: false }).limit(50);

        const { data: tasks, error } = await query;
        if (error) throw error;

        if (tasks && tasks.length > 0) {
          tasks.forEach((t: any) => {
            const isToday = formatArgDate(t.created_at) === todayStr;
            const isOverdue =
              t.fecha_vencimiento &&
              t.fecha_vencimiento < todayStr &&
              (!t.last_completed_date || getArgentinaDateString(t.last_completed_date) !== todayStr);
            const isDueToday =
              t.fecha_vencimiento === todayStr &&
              (!t.last_completed_date || getArgentinaDateString(t.last_completed_date) !== todayStr);

            if (isToday && user.rol === "operario") {
              notifs.push({
                id: `task-new-${t.id}`,
                title: "Nueva Tarea",
                description: t.titulo,
                date: t.created_at,
                type: "info",
              });
            } else if (isOverdue) {
              notifs.push({
                id: `task-overdue-${t.id}`,
                title: "Tarea Atrasada",
                description: `Venció: ${t.titulo}`,
                date: t.fecha_vencimiento,
                type: "urgente",
              });
            } else if (isDueToday) {
              notifs.push({
                id: `task-duetoday-${t.id}`,
                title: "Vence Hoy",
                description: t.titulo,
                date: t.fecha_vencimiento,
                type: "alerta",
              });
            }
          });
        }

        // Supervisor check stock
        if (user.rol === "supervisor") {
          const { data: insumos } = await supabase
            .from("insumos")
            .select("*")
            .lt("stock", 5);
          if (insumos) {
            insumos.forEach((i: any) => {
              notifs.push({
                id: `insumo-${i.id}`,
                title: "Atención: Stock Bajo",
                description: `${i.nombre} (Quedan ${i.stock})`,
                date: new Date().toISOString(),
                type: "urgente",
              });
            });
          }
        }

        notifs.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
        const uniqueNotifs = Array.from(
          new Map(notifs.map((item) => [item.id, item])).values(),
        ).slice(0, 8);

        setNotifications(uniqueNotifs);
        setNotificationsCount(uniqueNotifs.length);
      } catch (err) {
        console.error("Error in checkNotifications:", err);
      }
    }
    checkNotifications();
    const interval = setInterval(checkNotifications, 1000 * 60 * 5); // check every 5 min
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const checkExpiration = () => {
      if (!user) return;
      try {
        const dFmt = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Argentina/Buenos_Aires",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
        const today = dFmt.format(new Date()); // Formato: YYYY-MM-DD

        const timeFmt = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Argentina/Buenos_Aires",
          hour: "numeric",
          minute: "numeric",
          hour12: false,
        });
        const timeStr = timeFmt.format(new Date());
        const [hourStr, minStr] = timeStr.split(":");
        const argHour = parseInt(hourStr, 10);
        const argMin = parseInt(minStr, 10);

        const isDifferentDay = loginDate && loginDate !== today;
        const is2359 = argHour === 23 && argMin === 59;

        if (isDifferentDay || is2359) {
          performGlobalLogout();
          alert(
            "Su sesión ha finalizado automáticamente debido al cierre de jornada forzado diario (23:59 Horario Argentina).",
          );
        }
      } catch (err) {
        console.error("Error al validar expiración de sesión:", err);
      }
    };

    checkExpiration();
    const interval = setInterval(checkExpiration, 15000); // comprobar cada 15 segundos
    return () => clearInterval(interval);
  }, [user, loginDate]);

  const performGlobalLogout = async () => {
    // Clear all sticky states manually to ensure clean slate
    localStorage.removeItem("limpieza_user");
    localStorage.removeItem("limpieza_login_date");
    localStorage.removeItem("limpieza_shift_state");
    localStorage.removeItem("limpieza_shift_start");
    localStorage.removeItem("limpieza_jornada_start");
    localStorage.removeItem("limpieza_break_start");
    localStorage.removeItem("limpieza_active_task");
    localStorage.removeItem("limpieza_task_start");
    localStorage.removeItem("limpieza_task_comment");

    setUser(null);
    setLoginDate(null);
    setShiftState("idle");
    setShiftStart(null);
    setJornadaStart(null);
    setBreakStart(null);
    setActiveTask(null);
    setTaskStart(null);
    setTaskComment("");
    setMenuOpen(false);

    // Force a small delay and reload if necessary, but setUser(null) should suffice
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const [reauthError, setReauthError] = useState<string | null>(null);

  // Also block rendering if still loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
            Cargando...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <InstallBanner installProps={installProps} />
        <LoginScreen
          onLogin={async (u, d) => {
            setUser(u);
            setLoginDate(d);
          }}
          installProps={installProps}
        />
      </>
    );
  }

  if (user.rol === "supervisor") {
    return (
      <>
        <InstallBanner installProps={installProps} />
        <SupervisorDashboard
          user={user}
          onLogout={handleLogout}
        />

        <AnimatePresence>
          {showLogoutModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[400] flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl text-center relative border border-slate-100"
              >
                <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <LogOut className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-[#0b3464] mb-2 tracking-tight">
                  ¿Cerrar Sesión?
                </h3>
                <p className="text-xs font-bold text-slate-500 mb-6 leading-relaxed px-2">
                  ¿Estás seguro de que deseas cerrar sesión? Deberás ingresar tu
                  PIN la próxima vez para acceder.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowLogoutModal(false)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-xs uppercase"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      setShowLogoutModal(false);
                      await performGlobalLogout();
                    }}
                    className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-rose-200"
                  >
                    Salir
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-start justify-center w-full font-sans text-slate-800">
      <InstallBanner installProps={installProps} />
      <PWAHelpModal
        isOpen={showPWAHelp}
        onClose={() => setShowPWAHelp(false)}
        installProps={installProps}
      />
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
                        (e.target as HTMLImageElement).src =
                          "https://cdn-icons-png.flaticon.com/512/1048/1048953.png";
                      }}
                    />
                    <span className="font-bold text-lg tracking-tight text-brand-blue">
                      Limpieza Arévalo
                    </span>
                  </div>
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-full text-slate-400"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <nav className="flex-1 overflow-y-auto pr-2 flex flex-col gap-1">
                  {[
                    { id: "tareas", icon: Home, label: "Inicio" },
                    { id: "historial", icon: History, label: "Mi Historial" },
                    {
                      id: "incidencias",
                      icon: AlertTriangle,
                      label: "Incidencias",
                    },
                    { id: "perfil", icon: UserCircle, label: "Mi Perfil" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as any);
                        setMenuOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-4 px-4 py-4 rounded-2xl font-bold transition-all w-full text-left",
                        activeTab === item.id
                          ? "bg-blue-50 text-blue-600"
                          : "text-slate-500 hover:bg-slate-50",
                      )}
                    >
                      <item.icon className="w-6 h-6" />
                      <span>{item.label}</span>
                    </button>
                  ))}

                  <button
                    onClick={() => {
                      setShowPWAHelp(true);
                      setMenuOpen(false);
                    }}
                    className="flex items-center gap-4 px-4 py-4 rounded-2xl font-bold text-blue-600 hover:bg-blue-50 transition-all w-full text-left"
                  >
                    <Monitor className="w-6 h-6" />
                    <span>Descargar App</span>
                  </button>

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
                      <p className="text-xs font-bold text-slate-800 leading-tight">
                        {user.nombre}
                      </p>
                      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                        {user.rol}
                      </p>
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
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute top-12 left-0 bg-white p-4 rounded-2xl shadow-2xl border border-slate-100 z-[60] text-left w-64"
                  >
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 border-b border-slate-100 pb-2">
                      Notificaciones
                    </h4>
                    {notifications.length > 0 ? (
                      <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
                        {notifications.map((notif: any) => (
                          <div
                            key={notif.id}
                            className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 hover:border-blue-100 transition-colors"
                          >
                            <div
                              className={cn(
                                "w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0",
                                notif.type === "urgente"
                                  ? "bg-rose-500"
                                  : notif.type === "alerta"
                                    ? "bg-amber-500"
                                    : "bg-blue-500",
                              )}
                            ></div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-800 leading-tight">
                                {notif.title}
                              </p>
                              <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                                {notif.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 font-medium">
                        No hay notificaciones pendientes.
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center justify-center absolute left-1/2 -translate-x-1/2">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white/10 text-white rounded-full border border-white/20 shadow-sm backdrop-blur-md">
              <MapPin className="w-3.5 h-3.5" />
              <span className="text-[9px] font-black uppercase tracking-tighter">
                {location || "GPS OK"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-right">
            <div>
              <h2 className="text-sm font-bold text-white leading-tight truncate max-w-[120px]">
                {user.nombre}
              </h2>
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
          targetCoords={targetCoords}
          currentCoords={currentCoords}
          googleUser={googleUser}
          googleToken={googleToken}
          handleLinkGoogleCalendar={handleLinkGoogleCalendar}
          handleUnlinkGoogleCalendar={handleUnlinkGoogleCalendar}
          shiftLogId={shiftLogId}
          setShiftLogId={setShiftLogId}
          breakLogId={breakLogId}
          setBreakLogId={setBreakLogId}
          taskLogId={taskLogId}
          setTaskLogId={setTaskLogId}
        />

        <AnimatePresence>
          {showLogoutModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[400] flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl text-center relative border border-slate-100"
              >
                <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <LogOut className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-[#0b3464] mb-2 tracking-tight">
                  ¿Cerrar Sesión?
                </h3>
                <p className="text-xs font-bold text-slate-500 mb-6 leading-relaxed px-2">
                  ¿Estás seguro de que deseas cerrar sesión? Deberás ingresar tu
                  PIN la próxima vez para acceder.
                </p>
                <div className="flex gap-3 font-sans">
                  <button
                    onClick={() => setShowLogoutModal(false)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-xs uppercase"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      setShowLogoutModal(false);
                      await performGlobalLogout();
                    }}
                    className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-rose-200"
                  >
                    Salir
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

// -- Dashboard Section --

function Dashboard({
  user,
  onUserUpdate,
  location,
  shiftState,
  setShiftState,
  shiftStart,
  setShiftStart,
  jornadaStart,
  setJornadaStart,
  breakStart,
  setBreakStart,
  activeTask,
  setActiveTask,
  taskStart,
  setTaskStart,
  taskComment,
  setTaskComment,
  activeTab,
  setActiveTab,
  showNotifications,
  setShowNotifications,
  notificationsCount,
  targetCoords,
  currentCoords,
  googleUser,
  googleToken,
  handleLinkGoogleCalendar,
  handleUnlinkGoogleCalendar,
  shiftLogId,
  setShiftLogId,
  breakLogId,
  setBreakLogId,
  taskLogId,
  setTaskLogId,
}: any) {
  const time = useCurrentTime();
  const [shiftDurationText, setShiftDurationText] = useState("00:00:00");
  const [taskDurationText, setTaskDurationText] = useState("00:00:00");
  const [breakDurationText, setBreakDurationText] = useState("00:00:00");

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

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial sync check
    if (navigator.onLine) syncPendingRecords();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const syncPendingRecords = async () => {
    const pendingJson = localStorage.getItem("limpieza_pending_sync");
    if (!pendingJson) return;

    try {
      const pending: any[] = JSON.parse(pendingJson);
      if (pending.length === 0) return;

      setSyncing(true);
      const remaining = [];

      for (const record of pending) {
        try {
          const { error } = await supabase.from("logs").insert({
            ...record,
            operario_id: user?.id || "unknown",
          });
          if (error) throw error;
        } catch (e) {
          console.error("Sync error for record:", e);
          remaining.push(record);
        }
      }

      if (remaining.length > 0) {
        localStorage.setItem(
          "limpieza_pending_sync",
          JSON.stringify(remaining),
        );
      } else {
        localStorage.removeItem("limpieza_pending_sync");
      }
    } catch (e) {
      console.error("Fatal sync error:", e);
    } finally {
      setSyncing(false);
    }
  };

  const recordTime = async (
    accion: string,
    startIso: string,
    comentario?: string,
    isOngoing: boolean = false,
    existingLogId?: string | null,
  ): Promise<string | null> => {
    const end = isOngoing ? null : new Date();
    const start = new Date(startIso);
    const durationMinutes = isOngoing
      ? 0
      : Math.max(1, Math.round((end!.getTime() - start.getTime()) / 60000));

    if (existingLogId) {
      if (!navigator.onLine) {
        return existingLogId;
      }
      try {
        const updatePayload: any = {
          fin: end ? end.toISOString() : null,
          duracion_minutos: durationMinutes,
          detalles: comentario || null,
          accion: comentario ? `${accion} (Obs: ${comentario})` : accion,
        };

        const { error } = await supabase
          .from("logs")
          .update(updatePayload)
          .eq("id", existingLogId);

        if (error) throw error;

        // Also update normalized table if it's task completion or attendance
        if (accion.startsWith("Tarea: ")) {
          const taskTitulo = accion.replace("Tarea: ", "");
          await supabase
            .from("task_completions")
            .update({
              fin: end ? end.toISOString() : null,
              duracion_minutos: durationMinutes,
              comentarios: comentario || null,
            })
            .eq("operario_id", user?.id || "unknown")
            .eq("task_titulo", taskTitulo)
            .is("fin", null);
        } else if (accion === "Turno" || accion === "Descanso") {
          await supabase
            .from("asistencia")
            .update({
              fin: end ? end.toISOString() : null,
              duracion_minutos: durationMinutes,
              detalles: comentario || null,
            })
            .eq("operario_id", user?.id || "unknown")
            .eq("tipo_registro", accion)
            .is("fin", null);
        }

        return existingLogId;
      } catch (err) {
        console.error("Error updating log in Supabase:", err);
        return existingLogId;
      }
    }

    const payload: any = {
      operario_id: user?.id || "unknown",
      operario_nombre: user?.nombre || "Desconocido",
      accion: comentario ? `${accion} (Obs: ${comentario})` : accion,
      inicio: start.toISOString(),
      fin: end ? end.toISOString() : null,
      duracion_minutos: durationMinutes,
      detalles: comentario || null,
      fecha_argentina: formatArgDate(start),
    };

    if (!navigator.onLine) {
      const pendingJson = localStorage.getItem("limpieza_pending_sync");
      const pending = pendingJson ? JSON.parse(pendingJson) : [];
      pending.push(payload);
      localStorage.setItem("limpieza_pending_sync", JSON.stringify(pending));
      return null;
    }

    try {
      const { data, error } = await supabase
        .from("logs")
        .insert(payload)
        .select()
        .single();
      if (error) {
        console.error("Supabase insert error details:", error);
        throw error;
      }

      const createdLogId = data?.id || null;

      // Duplicate in dedicated normalized tables safely
      if (accion.startsWith("Tarea: ")) {
        const taskTitulo = accion.replace("Tarea: ", "");
        let taskId: string | null = null;
        try {
          const { data: tData } = await supabase
            .from("tasks")
            .select("id")
            .eq("titulo", taskTitulo)
            .limit(1);
          if (tData && tData.length > 0) {
            taskId = tData[0].id;
          }
        } catch (e) {
          console.warn("Could not find matching task ID", e);
        }

        await supabase.from("task_completions").insert({
          task_id: taskId,
          task_titulo: taskTitulo,
          operario_id: user?.id || "unknown",
          operario_nombre: user?.nombre || "Desconocido",
          inicio: start.toISOString(),
          fin: end ? end.toISOString() : null,
          duracion_minutos: durationMinutes,
          comentarios: comentario || null,
          fecha_argentina: formatArgDate(start),
        });
      } else if (accion === "Turno" || accion === "Descanso") {
        await supabase.from("asistencia").insert({
          operario_id: user?.id || "unknown",
          operario_nombre: user?.nombre || "Desconocido",
          tipo_registro: accion,
          inicio: start.toISOString(),
          fin: end ? end.toISOString() : null,
          duracion_minutos: durationMinutes,
          detalles: comentario || null,
          fecha_argentina: formatArgDate(start),
        });
      }

      return createdLogId;
    } catch (error: any) {
      console.error("Error saving record to Supabase:", error);
      // Fallback: save to localStorage if DB fails
      const pendingJson = localStorage.getItem("limpieza_pending_sync");
      const pending = pendingJson ? JSON.parse(pendingJson) : [];
      pending.push(payload);
      localStorage.setItem("limpieza_pending_sync", JSON.stringify(pending));
      return null;
    }
  };

  const handleStartShift = async () => {
    // Distance check
    if (targetCoords && currentCoords) {
      const dist = calculateDistance(
        currentCoords.lat,
        currentCoords.lng,
        targetCoords.lat,
        targetCoords.lng,
      );
      if (dist > 300) {
        alert(
          `ACCESO DENEGADO: Estás fuera del perímetro permitido (${Math.round(dist)}m). Acércate a menos de 300m del punto central para iniciar jornada.`,
        );
        return;
      }
    } else if (targetCoords && !currentCoords) {
      alert(
        "ERROR DE GPS: No se detecta tu ubicación. Asegúrate de tener el GPS activado y dar permisos a la aplicación.",
      );
      return;
    }

    const now = new Date().toISOString();
    if (shiftState === "idle") {
      setJornadaStart(now);
      const logId = await recordTime("Turno", now, undefined, true);
      setShiftLogId(logId);
    }
    if (shiftState === "paused" && breakStart) {
      await recordTime("Descanso", breakStart, undefined, false, breakLogId);
      setBreakLogId(null);
      const logId = await recordTime("Turno", now, undefined, true);
      setShiftLogId(logId);
    }
    setShiftStart(now);
    setBreakStart(null);
    setShiftState("active");
  };

  const handlePauseShift = async () => {
    if (shiftState === "active" && shiftStart) {
      await recordTime("Turno (Tramo)", shiftStart, undefined, false, shiftLogId);
      setShiftLogId(null);
    }
    const now = new Date().toISOString();
    setShiftState("paused");
    setShiftStart(null);
    setBreakStart(now);
    const logId = await recordTime("Descanso", now, undefined, true);
    setBreakLogId(logId);
  };

  const handleEndShift = async () => {
    if (shiftState === "active" && shiftStart) {
      await recordTime("Turno", shiftStart, undefined, false, shiftLogId);
      setShiftLogId(null);
    }
    if (shiftState === "paused" && breakStart) {
      await recordTime("Descanso (Final)", breakStart, undefined, false, breakLogId);
      setBreakLogId(null);
    }

    // Registrar la Jornada Completa (desde el primer Inicio de Jornada hasta ahora)
    if (jornadaStart) {
      await recordTime("Jornada Completa", jornadaStart);
    }

    setShiftState("idle");
    setShiftStart(null);
    setJornadaStart(null);
    setBreakStart(null);

    // Auto-finish tasks if shift ends
    if (activeTask && taskStart) {
      await handleFinishTask();
    }
  };

  const handleStartTask = async (task: TareaPlan) => {
    if (shiftState !== "active") {
      alert("Por favor INICIE SU TURNO antes de comenzar una tarea.");
      return;
    }
    const now = new Date().toISOString();
    setActiveTask(task);
    setTaskStart(now);
    const logId = await recordTime(`Tarea: ${task.titulo}`, now, undefined, true);
    setTaskLogId(logId);
  };

  const handleFinishTask = async () => {
    if (activeTask && taskStart) {
      await recordTime(`Tarea: ${activeTask.titulo}`, taskStart, taskComment, false, taskLogId);
      setTaskLogId(null);

      try {
        await supabase
          .from("tasks")
          .update({
            last_completed_date: new Date().toISOString(),
            last_completed_by: user?.nombre || "Operario",
          })
          .eq("id", activeTask.id);
      } catch (e) {
        console.warn("Could not update task completion status", e);
      }

      setActiveTask(null);
      setTaskStart(null);
      setTaskComment("");
    }
  };

  // Timer mode integrated inline

  const [pendingReminder, setPendingReminder] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // -- Reminder Checker --
  useEffect(() => {
    const checkReminders = () => {
      const stored = window.localStorage.getItem("limpieza_task_reminders");
      if (!stored) return;

      let reminders: Record<string, { time: string; title: string }> = {};
      try {
        reminders = JSON.parse(stored);
      } catch (err) {
        console.warn("Corrupted notification reminders in local storage:", err);
        window.localStorage.removeItem("limpieza_task_reminders");
        return;
      }

      const now = new Date();
      let changed = false;

      Object.entries(reminders).forEach(([id, r]) => {
        const reminderTime = new Date(r.time);
        if (now >= reminderTime) {
          // Trigger Notification
          if (
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            new Notification("Recordatorio de Tarea", {
              body: `Es hora de: ${r.title}`,
              icon: "/regenerated_image_1777551940944.png",
            });
          }

          // Show in-app modal
          setPendingReminder({ id, title: r.title });

          delete reminders[id];
          changed = true;
        }
      });

      if (changed) {
        window.localStorage.setItem(
          "limpieza_task_reminders",
          JSON.stringify(reminders),
        );
      }
    };

    const interval = setInterval(checkReminders, 15000); // Check more frequently (every 15s)
    return () => clearInterval(interval);
  }, []);

  const openWhatsApp = (phone: string, msg: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
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
                <span className="text-[10px] font-black uppercase">
                  Offline
                </span>
              </motion.div>
            )}
            {syncing && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-100 shadow-sm"
              >
                <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                <span className="text-[10px] font-black uppercase">
                  Sinc...
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold tracking-tighter text-slate-900 mb-1"
        >
          {formatArgTime(time)}
        </motion.div>
        {jornadaStart && (
          <p className="text-base font-medium text-emerald-600 flex items-center justify-center gap-1.5 uppercase mb-1">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            Total Jornada: {shiftDurationText}
          </p>
        )}
        {shiftState === "paused" && breakStart && (
          <p className="text-base font-bold text-amber-500 flex items-center justify-center gap-1.5 uppercase">
            En Descanso: {breakDurationText}
          </p>
        )}
        {!jornadaStart && (
          <p className="text-base font-medium text-slate-400 flex items-center justify-center gap-1.5 uppercase">
            {formatArgDate(time)}
          </p>
        )}
      </div>

      <div className="px-6 flex-1 flex flex-col gap-6">
        {/* NEW: ANUNCIOS DEL SUPERVISOR */}
        <AnunciosBanner />

        {/* SHIFT CONTROLS */}
        <section className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3">
            {shiftState === "idle" && (
              <div className="flex flex-col gap-3">
                <ShiftButton
                  color="green"
                  icon={<Play className="w-6 h-6 fill-current" />}
                  label="INICIAR TURNO"
                  onClick={handleStartShift}
                />
              </div>
            )}

            {shiftState === "paused" && (
              <ShiftButton
                color="green"
                icon={<Play className="w-6 h-6 fill-current" />}
                label="REANUDAR TRABAJO"
                onClick={handleStartShift}
              />
            )}

            {(shiftState === "active" || shiftState === "paused") && (
              <div className="flex bg-slate-50 rounded-2xl border border-emerald-100 overflow-hidden mb-2">
                <div
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center p-3 border-r border-slate-200/50",
                    shiftState === "active" ? "bg-emerald-50" : "bg-amber-50",
                  )}
                >
                  <span
                    className={cn(
                      "font-bold tracking-widest uppercase text-[11px] mb-1 flex items-center gap-1.5",
                      shiftState === "active"
                        ? "text-emerald-600"
                        : "text-amber-600",
                    )}
                  >
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full animate-pulse",
                        shiftState === "active"
                          ? "bg-emerald-500"
                          : "bg-amber-500",
                      )}
                    ></span>
                    {shiftState === "active" ? "Tramo Actual" : "En Descanso"}
                  </span>
                  <span className="text-[26px] font-black text-slate-800 tracking-tight font-mono leading-none">
                    {formatDuration(
                      shiftState === "active" ? shiftStart : breakStart,
                    )}
                  </span>
                </div>

                <div className="flex-1 flex flex-col gap-2 p-2 justify-center bg-white">
                  <ShiftButton
                    disabled={shiftState === "paused"}
                    color="yellow"
                    small
                    icon={<PauseCircle className="w-4 h-4" />}
                    label="DESCANSO"
                    onClick={handlePauseShift}
                  />
                  <ShiftButton
                    color="red"
                    small
                    icon={<Square className="w-4 h-4 fill-current" />}
                    label="FINALIZAR"
                    onClick={handleEndShift}
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* TAB CONTENT (Controlled by Sidebar Menu) */}
        {activeTab === "tareas" && (
          <section className="flex-1 flex flex-col pb-6">
            {activeTask && (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-[24px] text-center shadow-inner mb-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 bg-emerald-50 text-emerald-600 rounded-bl-2xl">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <h3 className="text-base font-extrabold text-[#0b3464] tracking-tight">
                  Tarea Activa en Ejecución
                </h3>
                <p className="text-xs text-slate-500 font-bold mt-1">
                  "{activeTask.titulo}"
                </p>
                <div className="text-2xl font-mono font-black text-emerald-600 mt-3">
                  {taskDurationText}
                </div>

                <div className="mt-6 text-left space-y-2 max-w-sm mx-auto">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Observaciones (Opcional)
                  </label>
                  <textarea
                    value={taskComment}
                    onChange={(e) => setTaskComment(e.target.value)}
                    className="w-full bg-white text-slate-700 border border-slate-200 rounded-2xl p-4 text-sm font-semibold outline-none focus:border-blue-500 transition-colors placeholder:text-slate-300 resize-none h-24 shadow-sm"
                    placeholder="¿Algún detalle relevante de la tarea?"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2 mt-5 max-w-sm mx-auto">
                  <button
                    onClick={handleFinishTask}
                    className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-emerald-200"
                  >
                    Terminar Tarea
                  </button>
                </div>
              </div>
            )}

            {!activeTask ? (
              <TaskSelector
                onStart={handleStartTask}
                shiftActive={shiftState === "active"}
                user={user}
                googleUser={googleUser}
                googleToken={googleToken}
                onLinkGoogle={handleLinkGoogleCalendar}
                onUnlinkGoogle={handleUnlinkGoogleCalendar}
              />
            ) : (
              <div className="p-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400">
                <p className="text-xs font-medium">
                  Debes finalizar la tarea activa arriba para poder registrar
                  una nueva.
                </p>
              </div>
            )}
          </section>
        )}

        {activeTab === "historial" && <OperarioTaskHistory user={user} />}

        {activeTab === "perfil" && (
          <UserProfile
            user={user}
            onUpdate={onUserUpdate}
            googleUser={googleUser}
            googleToken={googleToken}
            onLink={handleLinkGoogleCalendar}
            onUnlink={handleUnlinkGoogleCalendar}
          />
        )}

        {activeTab === "incidencias" && (
          <div className="flex flex-col gap-6">
            <IncidenciasModule
              user={user}
              onReported={() => setActiveTab("tareas")}
            />
          </div>
        )}

        {activeTab !== "tareas" && activeTab !== "incidencias" && (
          <h3
            onClick={() => setActiveTab("incidencias")}
            className="text-center font-black text-rose-500 text-[10px] uppercase tracking-widest mt-10 py-6 border-2 border-dashed border-rose-100 rounded-3xl cursor-pointer flex items-center justify-center gap-2"
          >
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
                <h3 className="text-2xl font-black text-[#0b3464] mb-2 tracking-tight">
                  ¡Recordatorio!
                </h3>
                <p className="text-sm font-bold text-slate-500 mb-8 px-4 leading-relaxed">
                  Es momento de realizar: <br />
                  <span className="text-emerald-600 font-black text-lg block mt-2">
                    "{pendingReminder.title}"
                  </span>
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
    const fetchAnnouncements = async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Error loading announcements:", error);
      } else {
        // Filtrar por rango de fechas (timed visibility)
        const now = new Date();

        const validAnnouncements = (data || []).filter((h: any) => {
          if (!h.start_time && !h.end_time) return true;

          let isValid = true;
          if (h.start_time) {
            const start = new Date(h.start_time);
            if (now < start) isValid = false;
          }
          if (h.end_time) {
            const end = new Date(h.end_time);
            if (now > end) isValid = false;
          }
          return isValid;
        });

        setAnnouncements(validAnnouncements);
      }
    };
    fetchAnnouncements();

    // Refresh every minute to update visibility based on time
    const timer = setInterval(fetchAnnouncements, 60000);

    const channel = supabase
      .channel("realtime:announcements-banner")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        fetchAnnouncements,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
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
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400">
              Comunicado
            </span>
            {current.end_time && (
              <span className="text-[8px] font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded leading-none">
                Vence{" "}
                {formatArgDate(current.end_time, {
                  day: "2-digit",
                  month: "short",
                })}{" "}
                {formatArgTime(current.end_time)}
              </span>
            )}
          </div>
          <span className="text-[8px] font-bold text-slate-500">
            {formatArgDate(current.created_at || current.date)}
          </span>
        </div>
        <p className="text-xs font-bold leading-relaxed">{current.text}</p>

        {announcements.length > 1 && (
          <div className="flex gap-1 mt-3">
            {announcements.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={cn(
                  "h-1 rounded-full transition-all",
                  i === currentIndex ? "w-4 bg-blue-500" : "w-1 bg-slate-700",
                )}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
function ShiftButton({
  color,
  label,
  icon,
  onClick,
  small,
  disabled,
}: {
  color: "green" | "yellow" | "red";
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  small?: boolean;
  disabled?: boolean;
}) {
  const baseClasses = disabled
    ? "opacity-50 grayscale cursor-not-allowed"
    : "active:scale-95 shadow-xl";

  const colors = {
    green:
      "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/10",
    yellow: "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-900/10",
    red: "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-900/10",
  };

  return (
    <motion.button
      whileTap={disabled ? {} : { scale: 0.96 }}
      onClick={disabled ? undefined : onClick}
      className={cn(
        "rounded-2xl font-black uppercase transition-all flex flex-row items-center justify-center border-b-[3px] border-black/10 tracking-widest",
        colors[color],
        small
          ? "text-[10px] gap-2 min-h-[40px] py-2 px-4"
          : "w-full text-sm gap-3 min-h-[50px] py-3 px-6",
        baseClasses,
      )}
    >
      <div
        className={cn(
          "rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md",
          small ? "w-6 h-6" : "w-8 h-8",
        )}
      >
        {icon}
      </div>
      <span>{label}</span>
    </motion.button>
  );
}

// -- Task Selector --
function TaskSelector({
  onStart,
  shiftActive,
  user,
  googleUser,
  googleToken,
  onLinkGoogle,
  onUnlinkGoogle,
}: {
  onStart: (t: TareaPlan) => void;
  shiftActive: boolean;
  user: Operario;
  googleUser?: FirebaseUser | null;
  googleToken?: string | null;
  onLinkGoogle?: () => void;
  onUnlinkGoogle?: () => void;
}) {
  const [gcalSyncing, setGcalSyncing] = useState<Record<string, boolean>>({});
  const [gcalSynced, setGcalSynced] = useStickyState<Record<string, boolean>>(
    {},
    "limpieza_gcal_synced_tasks",
  );

  const handleSyncToGoogleCalendar = async (task: TareaPlan) => {
    if (!googleToken) {
      if (onLinkGoogle) {
        if (
          confirm(
            "Google Calendar no está vinculado. ¿Deseas vincular tu cuenta ahora para sincronizar esta tarea?",
          )
        ) {
          onLinkGoogle();
        }
      } else {
        alert(
          "Debe vincular su cuenta de Google Calendar desde la pestaña de Perfil.",
        );
      }
      return;
    }

    setGcalSyncing((prev) => ({ ...prev, [task.id]: true }));
    try {
      const success = await createGoogleCalendarEvent(googleToken, task);
      if (success) {
        setGcalSynced((prev: any) => ({ ...prev, [task.id]: true }));
        alert(
          `¡Tarea "${task.titulo}" sincronizada con éxito en tu Google Calendar!`,
        );
      } else {
        alert(
          "Error al sincronizar con Google Calendar. Por favor reintente o vuelva a vincular su cuenta.",
        );
      }
    } catch (err: any) {
      console.error(err);
      alert(`Error al sincronizar: ${err.message || err}`);
    } finally {
      setGcalSyncing((prev) => ({ ...prev, [task.id]: false }));
    }
  };

  const [tasks, setTasks] = useState<TareaPlan[]>([]);
  const [completedTitles, setCompletedTitles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 10;

  const [filter, setFilter] = useStickyState<
    "Diaria" | "Semanal" | "Mensual" | "Eventual"
  >("Diaria", "limpieza_preferred_filter");
  const [searchTerm, setSearchTerm] = useState("");

  const [isCreating, setIsCreating] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskDate, setNewTaskDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [newTaskFreq, setNewTaskFreq] = useState<
    "Diaria" | "Semanal" | "Mensual" | "Eventual"
  >("Diaria");
  const [newTaskType, setNewTaskType] = useState<
    "Mantenimiento" | "Intermedia" | "Detalles"
  >("Mantenimiento");
  const [taskNotice, setTaskNotice] = useState<string | null>(null);

  const [reminders, setReminders] = useStickyState<
    Record<string, { time: string; title: string }>
  >({}, "limpieza_task_reminders");
  const [showReminderModal, setShowReminderModal] = useState<string | null>(
    null,
  );
  const [reminderDateTime, setReminderDateTime] = useState("");

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
      let query = supabase.from("tasks").select("*");

      if (user.rol === "operario") {
        query = query.or(
          `created_by_id.eq.${user.id},asignados.cs.{${user.nombre}}`,
        );
      }

      const { data, error } = await query
        .eq("frecuencia", filter)
        .order("created_at", { ascending: false })
        .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1);

      if (error) throw error;

      // Fetch task completions for this operario to filter completed tasks out
      let completedTaskTitulos: string[] = [];
      try {
        const { data: compData } = await supabase
          .from("task_completions")
          .select("task_titulo, inicio")
          .eq("operario_id", user.id)
          .not("fin", "is", null);

        if (compData) {
          const todayStr = getArgentinaDate();
          compData.forEach((c: any) => {
            const compDateStr = getArgentinaDateString(c.inicio);
            if (filter === "Diaria") {
              if (compDateStr === todayStr) {
                completedTaskTitulos.push(c.task_titulo);
              }
            } else if (filter === "Semanal") {
              const argNow = getArgLocalDate(new Date());
              const argCompleted = getArgLocalDate(c.inicio);
              const diff = argNow.getUTCDay() === 0 ? -6 : 1 - argNow.getUTCDay();
              const argStartOfWeek = new Date(argNow);
              argStartOfWeek.setUTCDate(argNow.getUTCDate() + diff);
              argStartOfWeek.setUTCHours(0, 0, 0, 0);
              if (argCompleted >= argStartOfWeek) {
                completedTaskTitulos.push(c.task_titulo);
              }
            } else if (filter === "Mensual") {
              const argNow = getArgLocalDate(new Date());
              const argCompleted = getArgLocalDate(c.inicio);
              if (
                argCompleted.getUTCMonth() === argNow.getUTCMonth() &&
                argCompleted.getUTCFullYear() === argNow.getUTCFullYear()
              ) {
                completedTaskTitulos.push(c.task_titulo);
              }
            } else if (filter === "Eventual") {
              completedTaskTitulos.push(c.task_titulo);
            }
          });
        }
      } catch (e) {
        console.warn("Could not fetch task completions", e);
      }

      setCompletedTitles(completedTaskTitulos);

      if (isInitial) {
        setTasks(data || []);
      } else {
        setTasks((prev) => [...prev, ...(data || [])]);
      }
      setHasMore((data || []).length === pageSize);
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

  const filteredTasks = tasks.filter((t: any) => {
    // Text filter
    if (
      searchTerm &&
      !(
        t.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.descripcion || "").toLowerCase().includes(searchTerm.toLowerCase())
      )
    ) {
      return false;
    }

    // New normalized completions filter
    if (completedTitles.includes(t.titulo)) {
      return false;
    }

    // Completion status filter
    if (t.last_completed_date) {
      const todayStr = getArgentinaDate();
      const compDateStr = getArgentinaDateString(t.last_completed_date);

      if (t.frecuencia === "Diaria") {
        if (compDateStr === todayStr) {
          return false; // Completed today
        }
      } else if (t.frecuencia === "Semanal") {
        const argNow = getArgLocalDate(new Date());
        const argCompleted = getArgLocalDate(t.last_completed_date);
        const diff = argNow.getUTCDay() === 0 ? -6 : 1 - argNow.getUTCDay();
        const argStartOfWeek = new Date(argNow);
        argStartOfWeek.setUTCDate(argNow.getUTCDate() + diff);
        argStartOfWeek.setUTCHours(0, 0, 0, 0);

        if (argCompleted >= argStartOfWeek) {
          return false; // Completed this week
        }
      } else if (t.frecuencia === "Mensual") {
        const argNow = getArgLocalDate(new Date());
        const argCompleted = getArgLocalDate(t.last_completed_date);
        if (
          argCompleted.getUTCMonth() === argNow.getUTCMonth() &&
          argCompleted.getUTCFullYear() === argNow.getUTCFullYear()
        ) {
          return false; // Completed this month
        }
      } else if (t.frecuencia === "Eventual") {
        return false; // Eventual is done once
      }
    }

    return true;
  });

  const filters: Array<"Diaria" | "Semanal" | "Mensual" | "Eventual"> = [
    "Diaria",
    "Semanal",
    "Mensual",
    "Eventual",
  ];

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;

    const newTask: any = {
      titulo: newTaskTitle.trim(),
      frecuencia: newTaskFreq,
      tipo_limpieza: newTaskType,
      descripcion: newTaskDesc || null,
      fecha_vencimiento: newTaskDate || null,
      asignados: [user.nombre], // Auto-assign to self if created by operario
      created_by_id: user.id,
    };

    try {
      const { data: docRef, error } = await supabase
        .from("tasks")
        .insert(newTask)
        .select()
        .single();
      if (error) throw error;
      const createdTaskObj = { id: docRef.id, ...newTask } as TareaPlan;
      setTasks([createdTaskObj, ...tasks]);
      setIsCreating(false);
      setTaskNotice(newTaskTitle.trim());
      setNewTaskTitle("");
      setNewTaskDesc("");
      setNewTaskDate(new Date().toISOString().split("T")[0]);

      // Auto Google Sync if linked
      if (googleToken) {
        try {
          const success = await createGoogleCalendarEvent(
            googleToken,
            createdTaskObj,
          );
          if (success) {
            setGcalSynced((prev: any) => ({ ...prev, [docRef.id]: true }));
            alert(
              `¡Tarea "${createdTaskObj.titulo}" sincronizada con éxito en tu Google Calendar automáticamente!`,
            );
          }
        } catch (gErr) {
          console.error("Auto sync to Google Calendar failed:", gErr);
        }
      }
    } catch (error) {
      console.error("Error al crear la tarea:", error);
    }
  };

  const handleDeleteTask = async (taskId: string | number, title: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar la tarea "${title}"?`))
      return;
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      console.error("Error in handleDeleteTask from TaskSelector:", err);
      alert("Error al eliminar la tarea");
    }
  };

  const saveReminder = () => {
    if (!reminderDateTime || !showReminderModal) return;
    const task = tasks.find((t) => t.id === showReminderModal);
    if (!task) return;

    if (!user.whatsapp) {
      alert("Debe cargar su número de WhatsApp en su Perfil primero.");
      setShowReminderModal(null);
      return;
    }

    const newReminders = { ...reminders };
    newReminders[showReminderModal.toString()] = {
      time: new Date(reminderDateTime).toISOString(),
      title: task.titulo,
    };
    setReminders(newReminders);
    setShowReminderModal(null);
    setReminderDateTime("");

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
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              filter === f
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-200",
              "py-2 px-1 rounded-full text-[10px] sm:text-xs font-bold transition-all truncate flex justify-center items-center",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center mb-3">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
          Lista de Tareas
        </h3>
        {!isCreating && (
          <button
            onClick={() => {
              setIsCreating(true);
              setNewTaskFreq(filter);
            }}
            className="text-[10px] font-bold uppercase bg-blue-600 border border-blue-500 text-white px-8 py-1.5 rounded-full flex items-center gap-1 hover:bg-blue-700 transition-all shadow-md shadow-blue-200 scale-105"
          >
            <Plus className="w-3 h-3" /> Nueva
          </button>
        )}
      </div>

      {isCreating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm p-5 rounded-3xl border border-slate-200 shadow-2xl flex flex-col gap-3"
            style={{ backgroundColor: "#0b3464", borderColor: "#7ade92" }}
          >
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-white font-bold tracking-tight">
                Nueva Tarea
              </h3>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewTaskTitle("");
                  setNewTaskDesc("");
                  setNewTaskDate(new Date().toISOString().split("T")[0]);
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative">
              <input
                autoFocus
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm font-semibold outline-none focus:border-emerald-500 transition-colors"
                placeholder="Título de la tarea*"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
              />
            </div>
            <div className="relative">
              <textarea
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm font-medium outline-none focus:border-emerald-500 transition-colors resize-none h-16"
                placeholder="Descripción (opcional)"
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1"
                  style={{ color: "#94a3b8" }}
                >
                  Frecuencia
                </label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-emerald-500 transition-colors appearance-none"
                  value={newTaskFreq}
                  onChange={(e) => setNewTaskFreq(e.target.value as any)}
                >
                  <option value="Diaria">Diaria</option>
                  <option value="Semanal">Semanal</option>
                  <option value="Mensual">Mensual</option>
                  <option value="Eventual">Eventual</option>
                </select>
              </div>
              <div>
                <label
                  className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1"
                  style={{ color: "#94a3b8" }}
                >
                  Tipo de Limpieza
                </label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-emerald-500 transition-colors appearance-none"
                  value={newTaskType}
                  onChange={(e) => setNewTaskType(e.target.value as any)}
                >
                  <option value="Mantenimiento">Mantenimiento</option>
                  <option value="Intermedia">Intermedia</option>
                  <option value="Detalles">Detalles</option>
                </select>
              </div>
            </div>
            <div className="relative">
              <label
                className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1"
                style={{ color: "#94a3b8" }}
              >
                Fecha Vencimiento (Opcional)
              </label>
              <input
                type="date"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-600 outline-none focus:border-emerald-500 transition-colors"
                value={newTaskDate}
                onChange={(e) => setNewTaskDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2 mt-2">
              <button
                className="flex-1 rounded-xl py-3 text-xs font-bold uppercase transition-colors hover:brightness-110"
                style={{ backgroundColor: "#ff2607", color: "#feffff" }}
                onClick={() => {
                  setIsCreating(false);
                  setNewTaskTitle("");
                  setNewTaskDesc("");
                  setNewTaskDate(new Date().toISOString().split("T")[0]);
                }}
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
        </div>
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
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-blue-100 transition-colors relative overflow-hidden"
              >
                {task.tipoLimpieza && (
                  <div
                    className={cn(
                      "absolute top-0 right-0 px-3 py-0.5 text-[8px] font-black uppercase rounded-bl-xl",
                      task.tipoLimpieza === "Mantenimiento"
                        ? "bg-blue-100 text-blue-600"
                        : task.tipoLimpieza === "Intermedia"
                          ? "bg-amber-100 text-amber-600"
                          : "bg-rose-100 text-rose-600",
                    )}
                  >
                    {task.tipoLimpieza}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-900 leading-tight truncate pr-16">
                    {task.titulo}
                  </div>
                  <div className="flex flex-wrap gap-2 items-center mt-1">
                    <span className="text-[9px] font-black text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 flex items-center gap-1">
                      {task.frecuencia === "Diaria" && (
                        <Clock className="w-2.5 h-2.5" />
                      )}
                      {task.frecuencia === "Semanal" && (
                        <Calendar className="w-2.5 h-2.5" />
                      )}
                      {task.frecuencia === "Mensual" && (
                        <LayoutGrid className="w-2.5 h-2.5" />
                      )}
                      {task.frecuencia}
                    </span>
                    {task.fecha_vencimiento && (
                      <span className="text-[9px] font-black text-rose-500 flex items-center gap-0.5">
                        <Calendar className="w-2.5 h-2.5" />{" "}
                        {task.fecha_vencimiento}
                      </span>
                    )}
                  </div>
                  {task.descripcion && (
                    <p className="text-[11px] text-slate-500 mt-2 italic line-clamp-2">
                      {task.descripcion}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() =>
                      reminders[task.id.toString()]
                        ? removeReminder(task.id)
                        : setShowReminderModal(task.id.toString())
                    }
                    className={cn(
                      "p-2 rounded-xl transition-all",
                      reminders[task.id.toString()]
                        ? "bg-blue-50 text-blue-600 shadow-inner"
                        : "text-slate-300 hover:bg-slate-50",
                    )}
                    title="Configurar Recordatorio"
                  >
                    <Bell
                      className={cn(
                        "w-5 h-5",
                        reminders[task.id.toString()] &&
                          "fill-current animate-bounce",
                      )}
                    />
                  </button>

                  {(task.created_by_id === user.id ||
                    user.rol === "supervisor") && (
                    <button
                      onClick={() => handleDeleteTask(task.id, task.titulo)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all shrink-0"
                      title="Eliminar Tarea"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}

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
                  "Cargar más tareas"
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
              <h3 className="text-xl font-black text-[#0b3464] mb-2 tracking-tight">
                Programar Recordatorio
              </h3>
              <p className="text-xs text-slate-400 mb-6 font-bold uppercase tracking-widest">
                Recibirás notificación y WhatsApp
              </p>

              <div className="mb-6">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                  Fecha y Hora
                </label>
                <input
                  type="datetime-local"
                  value={reminderDateTime}
                  onChange={(e) => setReminderDateTime(e.target.value)}
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

      <AnimatePresence>
        {taskNotice && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-96 z-[500] bg-white border-2 border-emerald-500 rounded-3xl p-5 shadow-2xl flex items-start gap-4 font-sans"
          >
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-black text-sm text-slate-900">
                ¡Tarea Creada con Éxito!
              </h4>
              <p className="text-xs text-slate-500 font-medium mt-1 truncate">
                "{taskNotice}"
              </p>
              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-2">
                La tarea ya está disponible para el personal.
              </p>
            </div>
            <button
              onClick={() => setTaskNotice(null)}
              className="text-slate-400 hover:text-slate-600 p-1 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// -- Login Screen --

const DEFAULT_USERS = [
  { nombre: "ABEL", usuario: "ABEL", rol: "supervisor", defaultPin: "1" },
  {
    nombre: "WALTER",
    usuario: "WALTER",
    rol: "supervisor",
    defaultPin: "1211",
  },
  {
    nombre: "CLAUDIA",
    usuario: "CLAUDIA",
    rol: "operario",
    defaultPin: "1234",
  },
  { nombre: "ANGIE", usuario: "ANGIE", rol: "operario", defaultPin: "1234" },
  {
    nombre: "FLORENCIA",
    usuario: "FLORENCIA",
    rol: "operario",
    defaultPin: "1234",
  },
  { nombre: "MARIO", usuario: "MARIO", rol: "operario", defaultPin: "1234" },
  { nombre: "JOSE", usuario: "JOSE", rol: "operario", defaultPin: "1234" },
  { nombre: "RAUL", usuario: "RAUL", rol: "operario", defaultPin: "1234" },
  {
    nombre: "NICOLAS",
    usuario: "NICOLAS",
    rol: "operario",
    defaultPin: "1234",
  },
];

function LoginScreen({
  onLogin,
  installProps,
}: {
  onLogin: (user: Operario, d: string) => void;
  installProps: any;
}) {
  const [usuario, setUsuario] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Allow clicking buttons if not loading, validation happens inside handlers
  const isButtonEnabled = !loading;

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !pin.trim()) return;
    setLoading(true);
    setError("");
    try {
      const u = usuario.trim().toUpperCase();
      const loginId = u.toLowerCase();

      let { data: userData, error: fetchError } = await supabase
        .from("users")
        .select("*")
        .eq("id", loginId)
        .maybeSingle(); // maybeSingle uses fewer errors for "not found"

      if (fetchError) {
        throw new Error(
          `Error de conexión con la base de datos: ${fetchError.message}`,
        );
      }

      if (!userData) {
        // Not in database yet, check default users map
        const defaultUser = DEFAULT_USERS.find(
          (d) => d.usuario === u && d.defaultPin === pin.trim(),
        );
        if (defaultUser) {
          // Create user in DB and let them login
          const newUserId = loginId;
          const newUserData = {
            id: newUserId,
            nombre: defaultUser.nombre,
            usuario: defaultUser.usuario,
            pin: defaultUser.defaultPin,
            rol: defaultUser.rol,
            activo: true,
          };

          // Use insert instead of upsert to be safe, if we get here userData was null
          const { error: insertError } = await supabase
            .from("users")
            .insert(newUserData);
          if (insertError) {
            console.error("Insert user error:", insertError);
            throw new Error(`Error BD al inicializar: ${insertError.message}`);
          }

          userData = newUserData;
        } else {
          throw new Error("Usuario o PIN incorrectos.");
        }
      } else {
        // Exists in DB
        if (!userData.activo) {
          throw new Error(
            "El usuario está desactivado. Contacte a un supervisor.",
          );
        }
        if (userData.pin !== pin.trim()) {
          throw new Error("Usuario o PIN incorrectos.");
        }
      }

      // Check permissions based on role
      const isSupervisor = userData.rol === "supervisor";

      // Log session start for operators and supervisors
      if (userData.rol === "operario" || userData.rol === "supervisor") {
        const start = new Date();
        await supabase.from("logs").insert({
          operario_id: loginId,
          operario_nombre: userData.nombre,
          accion:
            userData.rol === "supervisor"
              ? "[SUPERVISOR] Sesión Iniciada"
              : "Sesión Iniciada",
          inicio: start.toISOString(),
          fin: start.toISOString(), // Sessions are instantaneous logs
          duracion_minutos: 0,
          fecha_argentina: formatArgDate(start),
        });
      }

      onLogin({ ...userData, id: loginId } as any, getArgentinaDate());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
                e.currentTarget.src =
                  "https://cdn-icons-png.flaticon.com/512/3649/3649255.png";
              }}
            />
          </div>
          <h1 className="text-2xl font-black text-[#0b3464] tracking-tight">
            Acceso Corporativo
          </h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">
            Gestión de Higiene - Arévalo
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-[10px] p-3 rounded-2xl font-bold border border-red-100 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handlePinLogin} className="flex flex-col gap-4">
            <div className="relative group">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">
                Usuario
              </label>
              <div className="relative">
                <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input
                  type="text"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-5 py-3.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                  placeholder="USUARIO"
                />
              </div>
            </div>
            <div className="relative group">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">
                PIN
              </label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-5 py-3.5 text-center text-xl font-bold tracking-[0.5em] font-mono outline-none focus:border-blue-500 transition-all"
                  placeholder="****"
                />
              </div>
            </div>

            <button
              disabled={loading}
              type="submit"
              className={cn(
                "w-full py-5 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2",
                isButtonEnabled
                  ? "bg-[#0b3464] text-white hover:bg-[#0d417a]"
                  : "bg-slate-200 text-slate-400",
              )}
            >
              {loading ? (
                <RefreshCcw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Ingresar <MoveRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

// -- Stock Managers --

function OperarioStockManager({ user }: { user: Operario }) {
  const [solicitud, setSolicitud] = useState("");
  const [enviando, setEnviando] = useState(false);

  const handleSolicitar = async () => {
    if (!solicitud.trim()) return;
    setEnviando(true);
    try {
      await supabase.from("logs").insert({
        operario_id: user.id || "unknown",
        operario_nombre: user.nombre,
        accion: `Solicitud Insumos: ${solicitud}`,
        inicio: new Date().toISOString(),
        fin: new Date().toISOString(),
        duracion_minutos: 0,
        detalles: solicitud,
        estado: "Pendiente",
      });
      alert("Solicitud de insumos enviada al supervisor.");
      setSolicitud("");
    } catch (error) {
      console.error("Error al solicitar:", error);
    }
    setEnviando(false);
  };

  return (
    <div className="flex-1 overflow-y-auto flex flex-col pt-4">
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm w-full">
        <h3 className="text-lg font-bold text-slate-800 mb-2">
          Solicitar Insumos
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Escribe los insumos que necesitas y la cantidad. El supervisor
          recibirá la notificación.
        </p>
        <textarea
          value={solicitud}
          onChange={(e) => setSolicitud(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:border-blue-500 outline-none resize-none h-32 mb-4"
          placeholder="Ej: 2 Litros de Lavandina, 5 Trapos de piso, 1 Escoba..."
        />
        <button
          onClick={handleSolicitar}
          disabled={enviando || !solicitud.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-sm uppercase transition-colors flex justify-center items-center gap-2"
        >
          {enviando ? (
            <RefreshCcw className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Plus className="w-5 h-5" /> Enviar Solicitud
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function SupervisorStockManager() {
  const [insumos, setInsumos] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [nuevoInsumo, setNuevoInsumo] = useState("");
  const [nuevaCant, setNuevaCant] = useState("");

  useEffect(() => {
    const fetchInsumos = async () => {
      const { data } = await supabase.from("insumos").select("*");
      setInsumos(data || []);
    };
    fetchInsumos();
    const subInsumos = supabase
      .channel("realtime:insumos")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "insumos" },
        fetchInsumos,
      )
      .subscribe();

    const fetchPedidos = async () => {
      const { data } = await supabase
        .from("logs")
        .select("*")
        .eq("estado", "Pendiente")
        .ilike("accion", "Solicitud Insumos:%");
      setPedidos(data || []);
    };
    fetchPedidos();
    const subPedidos = supabase
      .channel("realtime:pedidos")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "logs" },
        fetchPedidos,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subInsumos);
      supabase.removeChannel(subPedidos);
    };
  }, []);

  const agregarInsumo = async () => {
    if (nuevoInsumo.trim() && !isNaN(Number(nuevaCant))) {
      try {
        await supabase.from("insumos").insert({
          nombre: nuevoInsumo.trim(),
          stock: Number(nuevaCant),
          unidad: "unidades",
        });
        setNuevoInsumo("");
        setNuevaCant("");
      } catch (error) {
        console.error(error);
      }
    }
  };

  const updateCant = async (id: string, diff: number) => {
    const item = insumos.find((i) => i.id === id);
    if (!item) return;
    try {
      await supabase
        .from("insumos")
        .update({
          stock: Math.max(0, item.stock + diff),
        })
        .eq("id", id);
    } catch (error) {
      console.error(error);
    }
  };

  const responderPedido = async (
    pedidoId: string,
    status: "Aprobado" | "Rechazado",
  ) => {
    try {
      await supabase.from("logs").update({ estado: status }).eq("id", pedidoId);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col p-6 w-full max-w-4xl mx-auto gap-8">
      <div>
        <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-500" /> Aprobación de
          Pedidos
        </h3>
        {pedidos.filter((p) => p.estado === "Pendiente").length === 0 ? (
          <p className="text-sm text-slate-400 italic bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-200">
            No hay pedidos pendientes de aprobación.
          </p>
        ) : (
          <div className="space-y-3">
            {pedidos
              .filter((p) => p.estado === "Pendiente")
              .map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    "p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4",
                    p.alertaConsumo
                      ? "bg-rose-50 border-rose-200"
                      : "bg-blue-50 border-blue-100",
                  )}
                >
                  <div className="flex gap-4">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        p.alertaConsumo
                          ? "bg-rose-500 text-white"
                          : "bg-blue-500 text-white",
                      )}
                    >
                      {p.alertaConsumo ? (
                        <ShieldAlert className="w-5 h-5 animate-pulse" />
                      ) : (
                        <Package className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-800">
                        {p.insumoNombre}{" "}
                        <span className="text-blue-600">x{p.cantidad}</span>
                      </h4>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                        {p.operarioNombre} • {formatArgTime(p.fecha)}
                      </p>
                      {p.alertaConsumo && (
                        <p className="text-[9px] font-black text-rose-600 uppercase mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Alerta: Consumo
                          superior al normal
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => responderPedido(p.id, "Rechazado")}
                      className="bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all"
                    >
                      Rechazar
                    </button>
                    <button
                      onClick={() => responderPedido(p.id, "Aprobado")}
                      className="bg-slate-900 text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all"
                    >
                      Aprobar
                    </button>
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
            value={nuevoInsumo}
            onChange={(e) => setNuevoInsumo(e.target.value)}
          />
          <input
            type="number"
            placeholder="Cant"
            className="w-20 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none"
            value={nuevaCant}
            onChange={(e) => setNuevaCant(e.target.value)}
          />
          <button
            onClick={agregarInsumo}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-6 py-4 rounded-tl-xl rounded-bl-xl">
                  Insumo
                </th>
                <th className="px-6 py-4">Cantidad Disponible</th>
                <th className="px-6 py-4 rounded-tr-xl rounded-br-xl text-right">
                  Ajustar
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {insumos.map((insumo) => (
                <tr
                  key={insumo.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-4 font-semibold text-slate-800">
                    {insumo.nombre}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        "px-3 py-1 rounded-full font-bold text-xs",
                        insumo.cantidad < 5
                          ? "bg-rose-100 text-rose-600"
                          : "bg-emerald-100 text-emerald-600",
                      )}
                    >
                      {insumo.cantidad}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                    <button
                      onClick={() => updateCant(insumo.id, -1)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-600 w-8 h-8 rounded-lg flex items-center justify-center font-bold"
                    >
                      -
                    </button>
                    <button
                      onClick={() => updateCant(insumo.id, 1)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-600 w-8 h-8 rounded-lg flex items-center justify-center font-bold"
                    >
                      +
                    </button>
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
  const [reminders] = useStickyState<Record<string, string>>(
    {},
    "limpieza_task_reminders",
  );

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

function SupervisorTasksManager({
  user,
  googleUser,
  googleToken,
  onLinkGoogle,
  onUnlinkGoogle,
}: {
  user: Operario;
  googleUser?: FirebaseUser | null;
  googleToken?: string | null;
  onLinkGoogle?: () => void;
  onUnlinkGoogle?: () => void;
}) {
  const [gcalSyncing, setGcalSyncing] = useState<Record<string, boolean>>({});
  const [gcalSynced, setGcalSynced] = useStickyState<Record<string, boolean>>(
    {},
    "limpieza_sup_gcal_synced",
  );

  const handleSyncToGoogleCalendar = async (task: any) => {
    if (!googleToken) {
      if (onLinkGoogle) {
        if (
          confirm(
            "Google Calendar no está vinculado. ¿Deseas vincular tu cuenta ahora para sincronizar esta tarea?",
          )
        ) {
          onLinkGoogle();
        }
      } else {
        alert(
          "Debe vincular su cuenta de Google Calendar desde la pestaña de Perfil.",
        );
      }
      return;
    }

    setGcalSyncing((prev) => ({ ...prev, [task.id]: true }));
    try {
      const success = await createGoogleCalendarEvent(googleToken, task);
      if (success) {
        setGcalSynced((prev: any) => ({ ...prev, [task.id]: true }));
        alert(
          `¡Tarea "${task.titulo}" sincronizada con éxito en tu Google Calendar!`,
        );
      } else {
        alert(
          "Error al sincronizar con Google Calendar. Por favor reintente o vuelva a vincular su cuenta.",
        );
      }
    } catch (err: any) {
      console.error(err);
      alert(`Error al sincronizar: ${err.message || err}`);
    } finally {
      setGcalSyncing((prev) => ({ ...prev, [task.id]: false }));
    }
  };

  const [tasks, setTasks] = useState<any[]>([]);
  const [operarios, setOperarios] = useState<Operario[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 12;

  const [estadoFilter, setEstadoFilter] = useStickyState<
    "Todas" | "Pendiente" | "Completada"
  >("Todas", "limpieza_sup_estado_filter");
  const [frecuenciaFilter, setFrecuenciaFilter] = useStickyState<
    "Todas" | "Diaria" | "Semanal" | "Mensual" | "Eventual"
  >("Todas", "limpieza_sup_frecuencia_filter");
  const [operarioFilter, setOperarioFilter] = useStickyState<string>(
    "Todos",
    "limpieza_sup_operario_filter",
  );
  const [searchTerm, setSearchTerm] = useState("");

  const [expandedTaskId, setExpandedTaskId] = useState<string | number | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<"lista" | "calendario" | "metricas">(
    "lista",
  );

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
      let query = supabase.from("tasks").select("*");

      // If operario, restrict to assigned tasks or tasks they created
      if (user.rol === "operario") {
        query = query.or(
          `created_by_id.eq.${user.id},asignados.cs.{${user.nombre}}`,
        );
      }

      query = query
        .order("created_at", { ascending: false })
        .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1);

      if (frecuenciaFilter !== "Todas") {
        query = query.eq("frecuencia", frecuenciaFilter);
      }

      const [tasksRes, usersRes] = await Promise.all([
        query,
        supabase.from("users").select("*").order("nombre"),
      ]);

      if (tasksRes.error) throw tasksRes.error;
      if (usersRes.error) throw usersRes.error;

      const tasksData = tasksRes.data || [];
      const usersData = usersRes.data || [];

      const mappedData = tasksData.map((t: any) => {
        let isCompletedToday = false;
        if (t.last_completed_date) {
          const todayStr = getArgentinaDate();
          const compDateStr = getArgentinaDateString(t.last_completed_date);

          if (t.frecuencia === "Diaria") {
            if (compDateStr === todayStr) {
              isCompletedToday = true;
            }
          } else if (t.frecuencia === "Semanal") {
            const argNow = getArgLocalDate(new Date());
            const argCompleted = getArgLocalDate(t.last_completed_date);
            const diff = argNow.getUTCDay() === 0 ? -6 : 1 - argNow.getUTCDay();
            const argStartOfWeek = new Date(argNow);
            argStartOfWeek.setUTCDate(argNow.getUTCDate() + diff);
            argStartOfWeek.setUTCHours(0, 0, 0, 0);

            if (argCompleted >= argStartOfWeek) {
              isCompletedToday = true;
            }
          } else if (t.frecuencia === "Mensual") {
            const argNow = getArgLocalDate(new Date());
            const argCompleted = getArgLocalDate(t.last_completed_date);
            if (
              argCompleted.getUTCMonth() === argNow.getUTCMonth() &&
              argCompleted.getUTCFullYear() === argNow.getUTCFullYear()
            ) {
              isCompletedToday = true;
            }
          } else if (t.frecuencia === "Eventual") {
            isCompletedToday = true;
          }
        }

        return {
          ...t,
          _estadoSimulado: isCompletedToday ? "Completada" : "Pendiente",
        };
      });

      if (isInitial) {
        setTasks(mappedData);
      } else {
        setTasks((prev) => [...prev, ...mappedData]);
      }
      setHasMore(tasksData.length === pageSize);
      if (usersData) {
        setOperarios(usersData as any);
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
    const matchEstado =
      estadoFilter === "Todas" || t._estadoSimulado === estadoFilter;
    const matchOperario =
      operarioFilter === "Todos" ||
      (t.asignados && t.asignados.includes(operarioFilter));
    const matchSearch =
      t.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.descripcion || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchEstado && matchOperario && matchSearch;
  });

  const [creating, setCreating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | number | null>(null);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskDate, setNewTaskDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [newTaskFreq, setNewTaskFreq] = useState<
    "Diaria" | "Semanal" | "Mensual" | "Eventual"
  >("Diaria");
  const [asignados, setAsignados] = useState<string[]>([]);
  const [duracionEst, setDuracionEst] = useState("");

  const resetForm = () => {
    setCreating(false);
    setEditingId(null);
    setNewTaskTitle("");
    setNewTaskDesc("");
    setNewTaskDate(new Date().toISOString().split("T")[0]);
    setNewTaskFreq("Diaria");
    setAsignados([]);
    setDuracionEst("");
  };

  const startEdit = (t: any) => {
    setNewTaskTitle(t.titulo);
    setNewTaskDesc(t.descripcion || "");
    setNewTaskDate(t.fecha_vencimiento || "");
    setNewTaskFreq(t.frecuencia || "Diaria");
    setAsignados(t.asignados || []);
    setDuracionEst(
      t.duracion_estimada_minutos ? t.duracion_estimada_minutos.toString() : "",
    );
    setEditingId(t.id);
    setCreating(true);
  };

  const handleDeleteTask = async (taskId: string | number, title: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar la tarea "${title}"?`))
      return;
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
      setTasks(tasks.filter((t) => t.id !== taskId));
      setToastMessage(`Tarea "${title}" eliminada con éxito`);
      setExpandedTaskId(null);
    } catch (error) {
      console.error("Error in handleDeleteTask:", error);
      alert("Error al eliminar la tarea");
    }
  };

  const toggleAsignado = (nombre: string) => {
    setAsignados((prev) =>
      prev.includes(nombre)
        ? prev.filter((n) => n !== nombre)
        : [...prev, nombre],
    );
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
      updated_at: new Date().toISOString(),
      created_by_id: user?.id,
    };

    try {
      if (editingId) {
        await supabase.from("tasks").update(taskPayload).eq("id", editingId);
        const updatedTaskObj = { id: editingId, ...taskPayload };
        setTasks(
          tasks.map((t) => (t.id === editingId ? { ...t, ...taskPayload } : t)),
        );
        setToastMessage(`Tarea "${taskPayload.titulo}" editada con éxito`);
      } else {
        const { data, error } = await supabase
          .from("tasks")
          .insert(taskPayload)
          .select()
          .single();
        if (error) throw error;
        const taskObj = { ...data, _estadoSimulado: "Pendiente" };
        setTasks([taskObj, ...tasks]);
        setToastMessage(`Tarea "${taskPayload.titulo}" creada con éxito`);

        // Auto Google Sync if linked
        if (googleToken) {
          try {
            const success = await createGoogleCalendarEvent(
              googleToken,
              taskObj,
            );
            if (success) {
              setGcalSynced((prev: any) => ({ ...prev, [data.id]: true }));
              setToastMessage(
                `Tarea "${taskPayload.titulo}" creada y sincronizada a Google Calendar`,
              );
            }
          } catch (gErr) {
            console.error("Auto sync to Google Calendar failed:", gErr);
          }
        }
      }
      resetForm();
    } catch (error) {
      console.error("Error in handleCreateOrEditTask:", error);
    }
  };

  return (
    <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col p-6 w-full max-w-4xl mx-auto">
      <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h3 className="font-bold text-xl text-slate-800 tracking-tight">
            Gestión Operativa
          </h3>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-0.5">
            Control y Planificación
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-2xl border border-slate-100">
          <button
            onClick={() => setViewMode("lista")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all",
              viewMode === "lista"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500",
            )}
          >
            Lista
          </button>
          <button
            onClick={() => setViewMode("calendario")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all",
              viewMode === "calendario"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500",
            )}
          >
            Calendario
          </button>
          <button
            onClick={() => setViewMode("metricas")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all",
              viewMode === "metricas"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500",
            )}
          >
            Métricas
          </button>
        </div>
      </div>

      <div className="w-full flex justify-between items-center mb-6">
        <h3 className="font-bold text-sm text-slate-500 uppercase tracking-widest">
          {viewMode === "metricas"
            ? "Distribución de Carga"
            : viewMode === "calendario"
              ? "Cronograma"
              : "Plan de Tareas"}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {!creating && viewMode === "lista" && (
            <div className="flex flex-wrap gap-2">
              <select
                className="bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-bold rounded-xl px-3 py-2 outline-none"
                value={estadoFilter}
                onChange={(e) => setEstadoFilter(e.target.value as any)}
              >
                <option value="Todas">Estados: Todos</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Completada">Completada</option>
              </select>
              <select
                className="bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-bold rounded-xl px-3 py-2 outline-none"
                value={frecuenciaFilter}
                onChange={(e) => setFrecuenciaFilter(e.target.value as any)}
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
                onChange={(e) => setOperarioFilter(e.target.value)}
              >
                <option value="Todos">Operarios: Todos</option>
                {operarios
                  .filter((o) => o.rol !== "supervisor")
                  .map((op) => (
                    <option key={op.nombre} value={op.nombre}>
                      {op.nombre}
                    </option>
                  ))}
              </select>
            </div>
          )}
          <button
            onClick={() => (creating ? resetForm() : setCreating(true))}
            className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl hover:shadow-violet-500/40 hover:scale-105 active:scale-95 border-b-4 border-black/20 ml-auto animate-pulse"
          >
            {creating ? (
              "Volver"
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>{" "}
                NUEVA TAREA
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Google Calendar Connection Status Banner removed from view */}

      {creating ? (
        <div className="w-full bg-blue-600 border-4 border-[#0b3464] shadow-2xl shadow-blue-200 rounded-[32px] p-8 mb-8 flex flex-col gap-6 transform transition-all animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center justify-between border-b border-white/20 pb-4">
            <h4 className="text-lg font-black text-white tracking-tight uppercase">
              {editingId ? "✍️ Editar Tarea" : "🚀 Carga de Nueva Tarea"}
            </h4>
            <div className="text-[10px] bg-white/20 text-white px-3 py-1 rounded-full font-black uppercase tracking-widest">
              Supervisor Privileged
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-black text-blue-100 uppercase tracking-widest ml-1">
                Nombre de la Tarea
              </label>
              <input
                autoFocus
                className="w-full bg-white/10 border border-[#0b3464] rounded-2xl px-5 py-4 text-sm font-bold text-white placeholder:text-blue-200 outline-none focus:bg-white focus:text-slate-900 transition-all shadow-inner"
                placeholder="Ej: Limpieza de ventanales"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-black text-blue-100 uppercase tracking-widest ml-1">
                  Tiempo Est. (Min)
                </label>
                <input
                  type="number"
                  className="w-full bg-white/10 border border-[#0b3464] rounded-2xl px-5 py-4 text-sm font-bold text-white placeholder:text-blue-200 outline-none focus:bg-white focus:text-slate-900 transition-all shadow-inner"
                  placeholder="Minutos"
                  value={duracionEst}
                  onChange={(e) => setDuracionEst(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-black text-blue-100 uppercase tracking-widest ml-1">
                  Frecuencia
                </label>
                <select
                  className="w-full bg-white/10 border border-[#0b3464] rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:bg-white focus:text-slate-900 transition-all shadow-inner appearance-none"
                  value={newTaskFreq}
                  onChange={(e) => setNewTaskFreq(e.target.value as any)}
                >
                  <option value="Diaria" className="text-slate-900">
                    Diaria
                  </option>
                  <option value="Semanal" className="text-slate-900">
                    Semanal
                  </option>
                  <option value="Mensual" className="text-slate-900">
                    Mensual
                  </option>
                  <option value="Eventual" className="text-slate-900">
                    Eventual
                  </option>
                </select>
              </div>
            </div>
          </div>

          <textarea
            className="w-full bg-white/10 border border-[#0b3464] rounded-2xl px-5 py-4 text-sm font-medium text-white placeholder:text-blue-200 outline-none focus:bg-white focus:text-slate-900 transition-all shadow-inner resize-none h-24"
            placeholder="Detalle los pasos a seguir..."
            value={newTaskDesc}
            onChange={(e) => setNewTaskDesc(e.target.value)}
          />

          <div className="flex flex-col gap-3">
            <label className="text-xs font-black text-blue-100 uppercase tracking-widest ml-1">
              Personal Asignado
            </label>
            <div className="flex flex-wrap gap-2 p-4 bg-white/5 rounded-2xl border border-[#0b3464] max-h-32 overflow-y-auto">
              {operarios
                .filter((o) => o.rol !== "supervisor")
                .map((op) => (
                  <button
                    key={op.id || op.nombre}
                    onClick={() => toggleAsignado(op.nombre)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-black transition-all border-2",
                      asignados.includes(op.nombre)
                        ? "bg-white text-blue-600 border-white shadow-lg scale-105"
                        : "bg-white/10 text-white border-white/20 hover:border-white/40",
                    )}
                  >
                    {op.nombre}
                  </button>
                ))}
              {operarios.length === 0 && (
                <span className="text-xs text-blue-100 font-bold italic">
                  No hay operarios cargados.
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-2 pt-4 border-t border-white/10">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-black text-blue-100 uppercase tracking-widest ml-1">
                Vencimiento del Plan
              </label>
              <input
                type="date"
                className="w-full bg-white/10 border border-[#0b3464] rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:bg-white focus:text-slate-900 transition-all shadow-inner"
                value={newTaskDate}
                onChange={(e) => setNewTaskDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <button
                className="w-full bg-white text-blue-600 hover:bg-blue-50 rounded-2xl py-4 text-sm font-black shadow-xl transition-all uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
                onClick={handleCreateOrEditTask}
              >
                {editingId ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <PlusCircle className="w-5 h-5" />
                )}
                {editingId ? "Actualizar Tarea" : "Publicar Tarea"}
              </button>
            </div>
          </div>
        </div>
      ) : viewMode === "metricas" ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-50 p-6 rounded-[24px] border border-slate-100">
              <h4 className="text-sm font-bold text-slate-800 mb-6 border-b border-slate-200 pb-2">
                Tareas por Operario
              </h4>
              <div className="h-[250px] w-full">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minHeight={1}
                  minWidth={1}
                >
                  <BarChart
                    data={operarios
                      .filter((o) => o.rol !== "supervisor")
                      .map((op) => ({
                        name: op.nombre,
                        tareas:
                          tasks.filter((t) => t.asignados?.includes(op.nombre))
                            .length ||
                          (
                            tasks.filter(
                              (t) => !t.asignados || t.asignados.length === 0,
                            ).length / (operarios.length || 1)
                          ).toFixed(1),
                      }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="tareas" fill="#3b82f6" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-[24px] border border-slate-100">
              <h4 className="text-sm font-bold text-slate-800 mb-6 border-b border-slate-200 pb-2">
                Frecuencia de Tareas
              </h4>
              <div className="h-[250px] w-full">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minHeight={1}
                  minWidth={1}
                >
                  <PieChart>
                    <Pie
                      data={[
                        {
                          name: "Diaria",
                          value: tasks.filter((t) => t.frecuencia === "Diaria")
                            .length,
                        },
                        {
                          name: "Semanal",
                          value: tasks.filter((t) => t.frecuencia === "Semanal")
                            .length,
                        },
                        {
                          name: "Mensual",
                          value: tasks.filter((t) => t.frecuencia === "Mensual")
                            .length,
                        },
                        {
                          name: "Eventual",
                          value: tasks.filter(
                            (t) => t.frecuencia === "Eventual",
                          ).length,
                        },
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
      ) : viewMode === "calendario" ? (
        <TaskCalendarView tasks={tasks} />
      ) : loading ? (
        <div className="p-12 flex justify-center">
          <RefreshCcw className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="p-12 text-center text-slate-400 font-medium">
          No hay tareas planificadas.
        </div>
      ) : (
        <div className="w-full bg-white rounded-[32px] p-2 border-4 border-[#0b3464] shadow-2xl shadow-blue-100 overflow-hidden mt-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-blue-600 text-white font-black uppercase tracking-[0.2em] text-[9px]">
                <tr>
                  <th className="py-5 px-6 rounded-tl-[24px]">
                    Planificación / Tarea
                  </th>
                  <th className="py-5 px-6 hidden sm:table-cell">
                    Recurrencia
                  </th>
                  <th className="py-5 px-6 hidden md:table-cell">Límite</th>
                  <th className="py-5 px-6 rounded-tr-[24px]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {filteredTasks.map((t: any) => (
                  <React.Fragment key={t.id}>
                    <tr
                      className="hover:bg-slate-100 transition-colors cursor-pointer"
                      onClick={() =>
                        setExpandedTaskId(expandedTaskId === t.id ? null : t.id)
                      }
                    >
                      <td className="px-6 py-5 font-bold text-slate-800 flex items-center gap-3">
                        {expandedTaskId === t.id ? (
                          <PauseCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <Play className="w-5 h-5 text-blue-400/50 flex-shrink-0" />
                        )}
                        <span className="truncate max-w-[150px] sm:max-w-[250px]">
                          {t.titulo}
                        </span>
                      </td>
                      <td className="px-6 py-5 hidden sm:table-cell">
                        <span className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                          {t.frecuencia}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-slate-500 font-bold hidden md:table-cell">
                        {t.fecha_vencimiento
                          ? formatArgDate(t.fecha_vencimiento)
                          : "-"}
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className={cn(
                            "text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-sm",
                            t._estadoSimulado === "Pendiente"
                              ? "bg-amber-100 text-amber-600 border border-amber-200"
                              : "bg-emerald-100 text-emerald-600 border border-emerald-200",
                          )}
                        >
                          {t._estadoSimulado}
                        </span>
                      </td>
                    </tr>
                    {expandedTaskId === t.id && (
                      <tr className="bg-slate-100/50">
                        <td
                          colSpan={4}
                          className="p-4 border-l-4 border-emerald-500"
                        >
                          <div className="flex flex-col sm:flex-row gap-4 justify-between">
                            <div className="text-sm flex-1">
                              <p className="font-bold text-slate-700 mb-1">
                                Descripción:
                              </p>
                              <p className="text-slate-600 mb-3">
                                {t.descripcion || "Sin descripción detallada."}
                              </p>

                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <p className="font-bold text-slate-700">
                                    Asignados:
                                  </p>
                                  <p className="text-slate-600">
                                    {t.asignados && t.asignados.length > 0
                                      ? t.asignados.join(", ")
                                      : "Todos"}
                                  </p>
                                </div>
                                <div>
                                  <p className="font-bold text-slate-700">
                                    Duración Est.:
                                  </p>
                                  <p className="text-slate-600">
                                    {t.duracion_estimada_minutos
                                      ? `${t.duracion_estimada_minutos} min`
                                      : "-"}
                                  </p>
                                </div>
                                <div className="md:hidden">
                                  <p className="font-bold text-slate-700">
                                    Vencimiento:
                                  </p>
                                  <p className="text-slate-600">
                                    {t.fecha_vencimiento || "-"}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEdit(t);
                                }}
                                className="bg-white border border-slate-200 shadow-sm px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-colors"
                              >
                                Editar Tarea
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTask(t.id, t.titulo);
                                }}
                                className="bg-rose-50 border border-rose-100 shadow-sm px-4 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-100 transition-colors flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Eliminar
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
        </div>
      )}

      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-96 z-[500] bg-white border-2 border-blue-500 rounded-3xl p-5 shadow-2xl flex items-start gap-4 font-sans"
          >
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-black text-sm text-slate-900">
                ¡Acción Completada!
              </h4>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                {toastMessage}
              </p>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-slate-600 p-1 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function KPICard({ title, value, icon, trend, sub }: any) {
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
      <div className="flex justify-between items-start mb-2">
        <div className="p-2 bg-slate-50 rounded-xl">{icon}</div>
        {trend && (
          <span
            className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full",
              trend.includes("+")
                ? "bg-emerald-50 text-emerald-600"
                : "bg-blue-50 text-blue-600",
            )}
          >
            {trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-black text-slate-800 tracking-tight">
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-1">
        {title}
      </p>
      {sub && <p className="text-[9px] text-slate-300 font-bold">{sub}</p>}
      <div className="absolute -right-4 -bottom-4 bg-slate-50 w-16 h-16 rounded-full opacity-50"></div>
    </div>
  );
}

function OperarioAccordion({ metric }: { metric: any; key?: any }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="bg-white border-b border-[#c6c6cd] last:border-0 hover:bg-[#f2f4f6]/50 transition-colors">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-4 text-left focus:outline-none focus:bg-[#f2f4f6]"
      >
        <div className="flex-1 grid grid-cols-7 items-center text-[10px] sm:text-xs">
          <div className="px-1 font-bold text-slate-800 overflow-hidden text-ellipsis whitespace-nowrap">
            {metric.nombre}
          </div>
          <div className="px-1 text-center font-mono text-slate-500">
            {metric.inicio}
          </div>
          <div className="px-1 text-center font-mono text-slate-500">
            {metric.fin}
          </div>
          <div className="px-1 text-center font-mono font-bold text-slate-700">
            {metric.duracion}
          </div>
          <div className="px-1 text-center font-mono text-slate-500">
            {metric.assigned}
          </div>
          <div className="px-1 text-center font-mono text-slate-500">
            {metric.completed}
          </div>
          <div
            className={cn(
              "px-1 font-black text-center",
              metric.efficacy >= 90
                ? "text-emerald-600"
                : metric.efficacy >= 70
                  ? "text-amber-600"
                  : "text-rose-600",
            )}
          >
            {metric.efficacy}%
          </div>
        </div>
        {metric.dailyStats && metric.dailyStats.length > 0 ? (
          <ChevronDown
            className={cn(
              "w-5 h-5 text-slate-400 shrink-0 transition-transform",
              isOpen && "rotate-180",
            )}
          />
        ) : (
          <div className="w-5 h-5 shrink-0" />
        )}
      </button>

      {isOpen && metric.dailyStats && metric.dailyStats.length > 0 && (
        <div className="bg-[#f2f4f6] px-6 pb-6 pt-2">
          <div className="bg-white rounded-xl border border-[#c6c6cd] overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-[#e6e8ea]">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Día
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">
                    Inicio
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">
                    Fin
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">
                    Tareas Completadas
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">
                    Logro
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c6c6cd] text-[11px] font-medium text-slate-600">
                {metric.dailyStats.map((d: any, i: number) => (
                  <tr key={i}>
                    <td className="px-4 py-3 text-slate-800">{d.dateStr}</td>
                    <td className="px-4 py-3 text-center">{d.start}</td>
                    <td className="px-4 py-3 text-center">{d.end}</td>
                    <td className="px-4 py-3 text-center">{d.completed}</td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-bold",
                        d.efficacy >= 90
                          ? "text-emerald-600"
                          : d.efficacy >= 70
                            ? "text-amber-600"
                            : "text-rose-600",
                      )}
                    >
                      {d.efficacy}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function DailyReportScreen({
  registros,
  operarios,
  tasks,
  supervisorName,
  onBack,
}: {
  registros: any[];
  operarios: any[];
  tasks: any[];
  supervisorName: string;
  onBack: () => void;
}) {
  const componentRef = React.useRef(null);
  const [filterType, setFilterType] = React.useState<
    "diario" | "semanal" | "mensual" | "custom"
  >("diario");
  const [customStart, setCustomStart] = React.useState("");
  const [customEnd, setCustomEnd] = React.useState("");

  const today = new Date();
  const todayStr = getArgentinaDate();

  const getActivePeriodString = () => {
    if (filterType === "diario") return todayStr;
    if (filterType === "semanal") return "Últimos 7 días";
    if (filterType === "mensual") return "Este Mes";
    if (filterType === "custom" && customStart && customEnd) {
      return `${formatArgDate(new Date(customStart + "T00:00:00"))} al ${formatArgDate(new Date(customEnd + "T23:59:59"))}`;
    }
    return "Periodo Seleccionado";
  };

  const perOpMetrics = React.useMemo(() => {
    let startDateObj: Date | null = null;
    let endDateObj: Date | null = null;
    let limitDays = 1;

    if (filterType === "diario") {
      startDateObj = new Date();
      startDateObj.setHours(0, 0, 0, 0);
      endDateObj = new Date();
      endDateObj.setHours(23, 59, 59, 999);
      limitDays = 1;
    } else if (filterType === "semanal") {
      startDateObj = new Date();
      startDateObj.setDate(today.getDate() - 7);
      startDateObj.setHours(0, 0, 0, 0);
      endDateObj = new Date();
      endDateObj.setHours(23, 59, 59, 999);
      limitDays = 7;
    } else if (filterType === "mensual") {
      startDateObj = new Date(today.getFullYear(), today.getMonth(), 1);
      endDateObj = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      limitDays = today.getDate(); // approximate passed days
    } else if (filterType === "custom" && customStart && customEnd) {
      startDateObj = new Date(customStart + "T00:00:00");
      endDateObj = new Date(customEnd + "T23:59:59");
      const diffTime = Math.abs(endDateObj.getTime() - startDateObj.getTime());
      limitDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (limitDays === 0) limitDays = 1;
    }

    return operarios
      .filter((o) => o.rol !== "supervisor")
      .map((op) => {
        const logs = registros
          .filter((r) => {
            if (r.operario_nombre !== op.nombre) return false;
            if (!startDateObj || !endDateObj)
              return formatArgDate(r.inicio) === todayStr;
            let recDate = new Date(r.inicio);
            return recDate >= startDateObj && recDate <= endDateObj;
          })
          .sort(
            (a, b) =>
              new Date(a.inicio).getTime() - new Date(b.inicio).getTime(),
          );

        if (logs.length === 0) return null;

        const firstLog = logs[0];
        const lastLog =
          [...logs].reverse().find((l) => l.fin) || logs[logs.length - 1];

        const startTime = formatArgTime(firstLog.inicio);
        const endTime = lastLog.fin ? formatArgTime(lastLog.fin) : "Activo";

        const totalMin = logs.reduce(
          (acc, r) => acc + (r.duracion_minutos || 0),
          0,
        );
        const hours = (totalMin / 60).toFixed(1);

        const isMultiDay = filterType !== "diario";

        const tareasAsignadasList = tasks.filter(
          (t) => t.frecuencia === "Diaria" && t.asignados?.includes(op.nombre),
        );
        let assignedCount = tareasAsignadasList.length * limitDays;
        const semanalTasks = tasks.filter(
          (t) => t.frecuencia === "Semanal" && t.asignados?.includes(op.nombre),
        ).length;
        const mensualTasks = tasks.filter(
          (t) => t.frecuencia === "Mensual" && t.asignados?.includes(op.nombre),
        ).length;

        if (limitDays >= 7)
          assignedCount += semanalTasks * Math.floor(limitDays / 7);
        if (limitDays >= 30)
          assignedCount += mensualTasks * Math.floor(limitDays / 30);

        if (
          assignedCount === 0 &&
          tasks.filter((t) => t.asignados?.includes(op.nombre)).length > 0
        )
          assignedCount = 1;

        const completedCount = logs.filter(
          (r) =>
            r.fin &&
            r.accion &&
            !r.accion.includes("Turno") &&
            !r.accion.includes("Descanso") &&
            !r.accion.startsWith("Sesión"),
        ).length;

        const efficacy =
          assignedCount > 0
            ? Math.min(100, Math.round((completedCount / assignedCount) * 100))
            : 100;

        // Group day-by-day stats
        const dailyMap: Record<string, any[]> = {};
        logs.forEach((log) => {
          const dateStr = formatArgDate(log.inicio);
          if (!dailyMap[dateStr]) dailyMap[dateStr] = [];
          dailyMap[dateStr].push(log);
        });

        const dailyStats = Object.keys(dailyMap)
          .sort()
          .map((dateStr) => {
            const dayLogs = dailyMap[dateStr].sort(
              (a, b) =>
                new Date(a.inicio).getTime() - new Date(b.inicio).getTime(),
            );
            const dFirst = dayLogs[0];
            const dLast =
              [...dayLogs].reverse().find((l) => l.fin) ||
              dayLogs[dayLogs.length - 1];

            const dTasksCompleted = dayLogs.filter(
              (r) =>
                r.fin &&
                r.accion &&
                !r.accion.includes("Turno") &&
                !r.accion.includes("Descanso") &&
                !r.accion.startsWith("Sesión"),
            ).length;

            const dAssigned =
              tareasAsignadasList.length > 0 ? tareasAsignadasList.length : 1;
            const dEfficacy = Math.min(
              100,
              Math.round((dTasksCompleted / dAssigned) * 100),
            );

            return {
              dateStr,
              start: formatArgTime(dFirst.inicio),
              end: dLast.fin ? formatArgTime(dLast.fin) : "Activo",
              completed: dTasksCompleted,
              assigned: dAssigned,
              efficacy: dEfficacy,
            };
          });

        return {
          nombre: op.nombre,
          inicio: isMultiDay ? "-" : startTime,
          fin: isMultiDay ? "-" : endTime,
          duracion: `${hours}h`,
          assigned: assignedCount,
          completed: completedCount,
          efficacy: efficacy,
          dailyStats: isMultiDay ? dailyStats : null,
        };
      })
      .filter(Boolean);
  }, [
    registros,
    operarios,
    tasks,
    filterType,
    customStart,
    customEnd,
    todayStr,
  ]);

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e] font-sans animate-in fade-in duration-500">
      <header className="bg-[#f7f9fb] border-b border-[#c6c6cd] sticky top-0 z-50 no-print">
        <div className="flex justify-between items-center w-full py-4 max-w-[1280px] mx-auto px-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white">
                  <Activity className="w-5 h-5" />
                </div>
                <h1 className="text-lg md:text-xl font-bold tracking-tight">
                  Reporte de Productividad
                </h1>
              </div>
              <p className="text-xs font-bold text-blue-600 mt-1 pl-11">
                {getActivePeriodString()}
              </p>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-black/10"
          >
            <Download className="w-4 h-4" /> Imprimir / PDF
          </button>
        </div>
      </header>

      <div className="bg-slate-50 border-b border-[#c6c6cd] py-4 no-print">
        <div className="max-w-[1280px] mx-auto px-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-400" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Filtro de Período
            </span>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex bg-white border border-[#c6c6cd] p-1 rounded-full shadow-sm">
              <button
                onClick={() => setFilterType("diario")}
                className={cn(
                  "px-4 py-1.5 text-xs font-bold rounded-full transition-all",
                  filterType === "diario"
                    ? "bg-black text-white"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                Diario
              </button>
              <button
                onClick={() => setFilterType("semanal")}
                className={cn(
                  "px-4 py-1.5 text-xs font-bold rounded-full transition-all",
                  filterType === "semanal"
                    ? "bg-black text-white"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                Semanal
              </button>
              <button
                onClick={() => setFilterType("mensual")}
                className={cn(
                  "px-4 py-1.5 text-xs font-bold rounded-full transition-all",
                  filterType === "mensual"
                    ? "bg-black text-white"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                Mensual
              </button>
              <button
                onClick={() => setFilterType("custom")}
                className={cn(
                  "px-4 py-1.5 text-xs font-bold rounded-full transition-all",
                  filterType === "custom"
                    ? "bg-black text-white"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                Personalizado
              </button>
            </div>
            {filterType === "custom" && (
              <div className="flex items-center gap-2 bg-white border border-[#c6c6cd] rounded-full px-2 py-1 shadow-sm">
                <input
                  type="date"
                  className="bg-transparent px-2 py-1 text-xs font-bold text-slate-700 outline-none w-[110px]"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
                <span className="text-slate-300 font-bold px-1">a</span>
                <input
                  type="date"
                  className="bg-transparent px-2 py-1 text-xs font-bold text-slate-700 outline-none w-[110px]"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div ref={componentRef} className="print:p-0 print:m-0">
        <main className="max-w-[1280px] mx-auto py-8 px-4">
          <section className="bg-white border border-[#c6c6cd] mb-8 shadow-sm overflow-hidden rounded-2xl">
            <div className="px-6 py-4 border-b border-[#c6c6cd] bg-[#131b2e] text-white flex justify-between items-center">
              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-[#dbe1ff]">
                  <ClipboardList className="w-5 h-5" /> Desempeño por Operario
                </h2>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">
                Actualizado hace un momento
              </span>
            </div>

            <div className="overflow-x-auto print:overflow-visible">
              <div className="min-w-[800px]">
                <div className="bg-[#f2f4f6] border-b border-[#c6c6cd] px-4 py-3 hidden sm:block">
                  <div className="grid grid-cols-7 items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <div className="px-1">OP.</div>
                    <div className="px-1 text-center">INI.</div>
                    <div className="px-1 text-center">FIN</div>
                    <div className="px-1 text-center">DUR.</div>
                    <div className="px-1 text-center">ASIG.</div>
                    <div className="px-1 text-center">REAL.</div>
                    <div className="px-1 text-center">% CUMP.</div>
                  </div>
                </div>
                <div className="divide-y divide-[#c6c6cd]">
                  {perOpMetrics.map((m: any, idx) => (
                    <OperarioAccordion key={idx} metric={m} />
                  ))}
                  {perOpMetrics.length === 0 && (
                    <div className="p-8 text-center text-slate-500 font-medium text-sm">
                      No hay registros para este periodo.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-16 mb-12 p-12 bg-white border border-[#c6c6cd] flex flex-col gap-4 shadow-sm items-center max-w-md mx-auto text-center border-dashed">
            <div className="w-full max-w-[240px]">
              <div className="w-full border-b-2 border-black mb-6 min-h-[60px] flex items-end justify-center pb-2">
                <span className="font-serif italic text-2xl text-slate-300 pointer-events-none">
                  Firma Digital
                </span>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                Responsable de Turno
              </p>
              <p className="text-sm font-bold text-slate-800 uppercase tracking-tight">
                {supervisorName}
              </p>
              <p className="text-[10px] font-medium text-slate-400 italic mt-1">
                Verificado en Sistema
              </p>
            </div>
          </section>
        </main>

        <footer className="bg-[#f7f9fb] border-t border-[#c6c6cd] mt-auto">
          <div className="flex justify-between items-center w-full py-8 max-w-[1280px] mx-auto px-4 flex-col text-center gap-4">
            <div className="text-[10px] font-bold text-[#45464d] uppercase tracking-[0.2em]">
              Generado: {formatArgDateTime(new Date())} | Reporte Oficial
            </div>
            <div className="text-[11px] font-medium text-slate-400 leading-relaxed">
              © 2026 Arevalo Servicios Sociales.
              <br />
              Desarrollo WM.
            </div>
          </div>
        </footer>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          .no-print { display: none !important; }
          body { background-color: white !important; }
          main { padding: 0 !important; max-width: 100% !important; }
          .rounded-2xl, .rounded-3xl, .rounded-xl { border-radius: 0 !important; }
          .shadow-sm { box-shadow: none !important; }
          .border { border-color: #000 !important; }
          .bg-\\[\\#131b2e\\] { background-color: #e5e5e5 !important; color: #000 !important; }
          .text-\\[\\#dbe1ff\\] { color: #000 !important; }
        }
      `,
        }}
      />
    </div>
  );
}

function DailySupervisorReport({
  registros,
  operarios,
  tasks,
  reportDateMode,
  setReportDateMode,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
}: {
  registros: any[];
  operarios: any[];
  tasks: any[];
  reportDateMode: "dia" | "semana" | "mes" | "vivo" | "custom";
  setReportDateMode: (mode: any) => void;
  customStart: string;
  setCustomStart: (val: string) => void;
  customEnd: string;
  setCustomEnd: (val: string) => void;
}) {
  const filterType =
    reportDateMode === "dia"
      ? "diario"
      : reportDateMode === "semana"
        ? "semanal"
        : reportDateMode === "mes"
          ? "mensual"
          : reportDateMode === "custom"
            ? "custom"
            : "diario";

  const todayStr = React.useMemo(() => getArgentinaDate(), []);

  const reportData = React.useMemo(() => {
    const today = new Date();
    let startDateObj: Date | null = null;
    let endDateObj: Date | null = null;
    let days = 1;

    if (filterType === "diario") {
      startDateObj = new Date();
      startDateObj.setHours(0, 0, 0, 0);
      endDateObj = new Date();
      endDateObj.setHours(23, 59, 59, 999);
      days = 1;
    } else if (filterType === "semanal") {
      startDateObj = new Date();
      startDateObj.setDate(today.getDate() - 7);
      startDateObj.setHours(0, 0, 0, 0);
      endDateObj = new Date();
      endDateObj.setHours(23, 59, 59, 999);
      days = 7;
    } else if (filterType === "mensual") {
      startDateObj = new Date(today.getFullYear(), today.getMonth(), 1);
      endDateObj = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      days = today.getDate(); // days passed in the month
    } else if (filterType === "custom" && customStart && customEnd) {
      startDateObj = new Date(customStart + "T00:00:00");
      endDateObj = new Date(customEnd + "T23:59:59");
      const diffTime = Math.abs(endDateObj.getTime() - startDateObj.getTime());
      days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (days === 0) days = 1;
    }

    return operarios
      .filter((o) => o.rol !== "supervisor")
      .map((op) => {
        const opsRecords = registros.filter((r) => {
          if (r.operario_nombre !== op.nombre) return false;
          if (!startDateObj || !endDateObj) {
            return formatArgDate(r.inicio) === todayStr;
          }
          let recDate = new Date(r.inicio);
          return recDate >= startDateObj && recDate <= endDateObj;
        });

        let horaIngreso = "-";
        let horaSalida = "-";

        if (filterType === "diario" && opsRecords.length > 0) {
          const sortedDesc = [...opsRecords].sort(
            (a, b) =>
              new Date(a.inicio).getTime() - new Date(b.inicio).getTime(),
          );
          horaIngreso = formatArgTime(sortedDesc[0].inicio);

          const lastRec = sortedDesc[sortedDesc.length - 1];
          if (lastRec.fin) {
            horaSalida = formatArgTime(lastRec.fin);
          } else {
            horaSalida = "En turno";
          }
        }

        const tiempoActivoMin = opsRecords
          .filter((r) => !r.accion?.includes("Descanso"))
          .reduce((acc, r) => acc + (r.duracion_minutos || 0), 0);
        const tiempoActivoStr = `${Math.floor(tiempoActivoMin / 60)}h ${Math.round(tiempoActivoMin % 60)}m`;

        const limitDays = days || 1;
        const tareasAsignadasList = tasks.filter(
          (t) => t.frecuencia === "Diaria" && t.asignados?.includes(op.nombre),
        );

        // Calculate overall tasks assigned in the period (for recurring ones)
        // Note: This is an approximation. Daily tasks happen every day.
        let tareasAsignadas = tareasAsignadasList.length * limitDays;

        // Weekly and monthly tasks
        const semanalTasks = tasks.filter(
          (t) => t.frecuencia === "Semanal" && t.asignados?.includes(op.nombre),
        ).length;
        const mensualTasks = tasks.filter(
          (t) => t.frecuencia === "Mensual" && t.asignados?.includes(op.nombre),
        ).length;

        if (limitDays >= 7)
          tareasAsignadas += semanalTasks * Math.floor(limitDays / 7);
        if (limitDays >= 30)
          tareasAsignadas += mensualTasks * Math.floor(limitDays / 30);

        const tareasRealizadasList = opsRecords.filter((r) =>
          r.accion?.startsWith("Tarea: "),
        );
        const tareasRealizadas = tareasRealizadasList.length;

        const eficiencia =
          tareasAsignadas > 0
            ? Math.round((tareasRealizadas / tareasAsignadas) * 100)
            : tareasRealizadas > 0
              ? 100
              : 0;

        return {
          nombre: op.nombre,
          horaIngreso,
          horaSalida,
          tiempoActivoStr,
          tiempoActivoMin,
          tareasAsignadas,
          tareasRealizadas,
          eficiencia,
        };
      })
      .sort((a, b) => b.eficiencia - a.eficiencia);
  }, [
    registros,
    operarios,
    tasks,
    filterType,
    customStart,
    customEnd,
    todayStr,
  ]);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-col md:flex-row gap-4 items-end bg-white p-4 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex-1">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">
            Periodo del Reporte
          </label>
          <div className="flex bg-slate-100 p-1 rounded-2xl w-full max-w-md">
            <button
              onClick={() => setReportDateMode("dia")}
              className={cn(
                "flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all",
                filterType === "diario"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              Diario
            </button>
            <button
              onClick={() => setReportDateMode("semana")}
              className={cn(
                "flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all",
                filterType === "semanal"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              Semanal
            </button>
            <button
              onClick={() => setReportDateMode("mes")}
              className={cn(
                "flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all",
                filterType === "mensual"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              Mensual
            </button>
            <button
              onClick={() => setReportDateMode("custom")}
              className={cn(
                "flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all",
                filterType === "custom"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              Personalizado
            </button>
          </div>
        </div>
        {filterType === "custom" && (
          <div className="flex items-center gap-3 w-full md:w-auto">
            <input
              type="date"
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <span className="text-slate-400 font-bold">a</span>
            <input
              type="date"
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200 flex-1 overflow-x-auto">
        <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
          <UserCircle className="w-5 h-5 text-blue-500" /> Reporte de
          Productividad
        </h3>

        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-5 py-4 rounded-l-xl">Operario</th>
              {filterType === "diario" && (
                <th className="px-5 py-4 text-center">Ingreso</th>
              )}
              {filterType === "diario" && (
                <th className="px-5 py-4 text-center">Salida</th>
              )}
              <th className="px-5 py-4 text-center">Tiempo Act.</th>
              <th className="px-5 py-4 text-center">Asignadas</th>
              <th className="px-5 py-4 text-center">Realizadas</th>
              <th className="px-5 py-4 rounded-r-xl text-right">Eficiencia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reportData.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-4 font-bold text-slate-800 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs">
                    {row.nombre.charAt(0)}
                  </div>
                  {row.nombre}
                </td>
                {filterType === "diario" && (
                  <td className="px-5 py-4 text-slate-500 font-medium text-center">
                    {row.horaIngreso}
                  </td>
                )}
                {filterType === "diario" && (
                  <td className="px-5 py-4 text-slate-500 font-medium text-center">
                    {row.horaSalida}
                  </td>
                )}
                <td className="px-5 py-4 text-slate-700 font-bold text-center">
                  {row.tiempoActivoStr}
                </td>
                <td className="px-5 py-4 text-center font-bold text-blue-600">
                  {row.tareasAsignadas}
                </td>
                <td className="px-5 py-4 text-center font-bold text-emerald-600">
                  {row.tareasRealizadas}
                </td>
                <td className="px-5 py-4 text-right">
                  <span
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-black",
                      row.eficiencia >= 80
                        ? "bg-emerald-100 text-emerald-700"
                        : row.eficiencia >= 50
                          ? "bg-amber-100 text-amber-700"
                          : "bg-rose-100 text-rose-700",
                    )}
                  >
                    {row.eficiencia}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {reportData.length === 0 && (
          <p className="text-center text-slate-400 py-6 text-sm font-medium">
            No hay operarios para mostrar.
          </p>
        )}
      </div>

      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200 w-full flex flex-col">
        <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Tareas (
          {filterType})
        </h3>
        <div className="flex-1 min-h-[250px]">
          <ResponsiveContainer
            width="100%"
            height="100%"
            minHeight={1}
            minWidth={1}
          >
            <BarChart data={reportData}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f1f5f9"
              />
              <XAxis
                dataKey="nombre"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fill: "#64748b" }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "#64748b" }}
              />
              <Tooltip
                cursor={{ fill: "#f8fafc" }}
                contentStyle={{
                  borderRadius: "12px",
                  border: "none",
                  boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                }}
              />
              <Bar
                dataKey="tareasRealizadas"
                name="Realizadas"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                barSize={20}
              />
              <Bar
                dataKey="tareasAsignadas"
                name="Asignadas"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function JibbleHourReport({
  registros,
  operarios,
  reportDateMode,
  setReportDateMode,
  reportUserFilter,
  setReportUserFilter,
  loading,
}: any) {
  const summarizedData = React.useMemo(() => {
    const data: any = {};

    registros.forEach((r: any) => {
      const date = formatArgDate(r.inicio);
      const key = `${r.operario_nombre}-${date}`;

      if (!data[key]) {
        data[key] = {
          operario: r.operario_nombre,
          fecha: date,
          trabajo: 0,
          descanso: 0,
        };
      }

      if (r.accion?.includes("Descanso")) {
        data[key].descanso += r.duracion_minutos || 0;
      } else {
        data[key].trabajo += r.duracion_minutos || 0;
      }
    });

    return Object.values(data).sort((a: any, b: any) => {
      const dateA = new Date(a.fecha.split("/").reverse().join("-")).getTime();
      const dateB = new Date(b.fecha.split("/").reverse().join("-")).getTime();
      return dateB - dateA;
    });
  }, [registros]);

  return (
    <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden flex-1 p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-lg text-slate-800">
          Hoja de Horas (Jibble Style)
        </h3>
        <div className="text-[10px] font-bold text-blue-500 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">
          Global por Operario
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6 pb-6 border-b border-slate-100">
        <div className="flex-1">
          <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">
            Periodo
          </label>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {["vivo", "dia", "semana", "mes"].map((m) => (
              <button
                key={m}
                onClick={() => setReportDateMode(m)}
                className={cn(
                  "flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors capitalize",
                  reportDateMode === m
                    ? "bg-white shadow-sm text-blue-600"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                {m === "vivo"
                  ? "En Vivo"
                  : m === "dia"
                    ? "Diaria"
                    : m === "semana"
                      ? "Semanal"
                      : "Mensual"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">
            Personal
          </label>
          <select
            className="w-full sm:w-48 bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-xl px-4 py-2 outline-none h-[36px]"
            value={reportUserFilter}
            onChange={(e) => setReportUserFilter(e.target.value)}
          >
            <option value="Todos">Todos</option>
            {operarios.map((op: any) => (
              <option key={op.nombre} value={op.nombre}>
                {op.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center">
          <RefreshCcw className="w-8 h-8 animate-spin text-slate-300" />
        </div>
      ) : summarizedData.length === 0 ? (
        <div className="p-12 text-center text-slate-400 font-medium italic">
          No se encontraron registros en este periodo.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-4 rounded-l-xl">Operario</th>
                <th className="px-5 py-4">Día</th>
                <th className="px-5 py-4">Trabajado</th>
                <th className="px-5 py-4">Descanso</th>
                <th className="px-5 py-4 rounded-r-xl text-right">
                  Neto Total
                </th>
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
                      <span className="font-bold text-slate-800">
                        {row.operario}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-500 font-medium">
                    {row.fecha}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                      <span className="font-mono font-bold text-slate-700">
                        {(row.trabajo / 60).toFixed(1)}h
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {row.trabajo}m
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                      <span className="font-mono font-bold text-slate-700">
                        {(row.descanso / 60).toFixed(1)}h
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {row.descanso}m
                      </span>
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
  const [selectedDayTasks, setSelectedDayTasks] = useState<{
    tasks: any[];
    date: string;
  } | null>(null);

  const daysInMonth = new Date(
    selectedMonth.getFullYear(),
    selectedMonth.getMonth() + 1,
    0,
  ).getDate();
  const firstDayOfMonth = new Date(
    selectedMonth.getFullYear(),
    selectedMonth.getMonth(),
    1,
  ).getDay();

  const monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];

  return (
    <div className="flex flex-col gap-6 mt-6">
      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" /> Planificación Mensual
          </h3>
          <div className="flex items-center gap-4 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
            <button
              onClick={() =>
                setSelectedMonth(
                  new Date(
                    selectedMonth.getFullYear(),
                    selectedMonth.getMonth() - 1,
                    1,
                  ),
                )
              }
              className="p-1 hover:bg-white rounded-lg shadow-sm"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
            <span className="text-xs font-bold text-slate-600 min-w-[100px] text-center">
              {monthNames[selectedMonth.getMonth()]}{" "}
              {selectedMonth.getFullYear()}
            </span>
            <button
              onClick={() =>
                setSelectedMonth(
                  new Date(
                    selectedMonth.getFullYear(),
                    selectedMonth.getMonth() + 1,
                    1,
                  ),
                )
              }
              className="p-1 hover:bg-white rounded-lg shadow-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {["D", "L", "M", "X", "J", "V", "S"].map((d) => (
            <div
              key={d}
              className="text-center text-[10px] font-black text-slate-400 py-2 uppercase"
            >
              {d}
            </div>
          ))}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="h-16 lg:h-20 bg-slate-50/50 rounded-xl"
            />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${selectedMonth.getFullYear()}-${(selectedMonth.getMonth() + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
            const dayTasks = tasks.filter(
              (t) => t.fecha_vencimiento === dateStr,
            );
            const isSelected = selectedDayTasks?.date === dateStr;

            return (
              <div
                key={day}
                onClick={() =>
                  dayTasks.length > 0
                    ? setSelectedDayTasks(
                        isSelected ? null : { tasks: dayTasks, date: dateStr },
                      )
                    : null
                }
                className={cn(
                  "h-16 lg:h-20 p-2 border rounded-2xl flex flex-col gap-1 overflow-hidden transition-all relative cursor-pointer",
                  dayTasks.length > 0
                    ? isSelected
                      ? "border-blue-500 bg-blue-50/50 shadow-sm"
                      : "bg-white border-slate-100 hover:border-blue-200"
                    : "bg-white border-slate-50 opacity-40 cursor-default",
                )}
              >
                <span
                  className={cn(
                    "text-[10px] font-black",
                    dayTasks.length > 0 ? "text-slate-800" : "text-slate-300",
                  )}
                >
                  {day}
                </span>
                <div className="flex flex-wrap gap-0.5 mt-auto">
                  {dayTasks.map((_, idx) => (
                    <div
                      key={idx}
                      className="w-1 h-1 bg-blue-400 rounded-full"
                    />
                  ))}
                </div>
                {dayTasks.length > 0 && (
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedDayTasks && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white p-6 rounded-[32px] border border-blue-100 shadow-xl shadow-blue-50/50">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h4 className="font-black text-slate-800 tracking-tight flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-blue-500" />
                    Tareas del{" "}
                    {formatArgDate(selectedDayTasks.date + "T12:00:00", {
                      day: "numeric",
                      month: "long",
                    })}
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {selectedDayTasks.tasks.length}{" "}
                    {selectedDayTasks.tasks.length === 1 ? "tarea" : "tareas"}{" "}
                    programadas
                  </p>
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
                  <div
                    key={task.id}
                    className="p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-blue-200 transition-colors group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h5 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                        {task.titulo}
                      </h5>
                      <span className="text-[8px] font-black uppercase text-slate-400 bg-white border border-slate-100 px-2 py-0.5 rounded-lg">
                        {task.frecuencia}
                      </span>
                    </div>
                    {task.descripcion && (
                      <p className="text-[11px] text-slate-500 mb-3 line-clamp-2 italic">
                        "{task.descripcion}"
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-auto pt-3 border-t border-slate-200/50">
                      <UserCircle className="w-4 h-4 text-slate-400" />
                      <div className="flex flex-wrap gap-1">
                        {task.asignados && task.asignados.length > 0 ? (
                          task.asignados.map((as: string, idx: number) => (
                            <span
                              key={idx}
                              className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md"
                            >
                              {as}
                            </span>
                          ))
                        ) : (
                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                            Todos los operarios
                          </span>
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

function TimeElapsed({
  start,
  className,
}: {
  start: string;
  className?: string;
}) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!start) return;
    const update = () => {
      let ms = Date.now() - new Date(start).getTime();
      if (ms < 0) ms = 0; // Prevent negative time
      const minutes = Math.floor(ms / 60000);
      const hours = Math.floor(minutes / 60);
      if (hours > 0) {
        setElapsed(`${hours}h ${minutes % 60}m`);
      } else {
        setElapsed(`${minutes}m`);
      }
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [start]);

  if (!start) return null;
  return <span className={className}>{elapsed}</span>;
}

function OperarioActivityModal({
  operario,
  registros,
  onClose,
}: {
  operario: any;
  registros: any[];
  onClose: () => void;
}) {
  React.useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  // Filter logs for this operario only, from today
  const todayStr = getArgentinaDate();
  const opLogs = registros
    .filter(
      (r) =>
        r.operario_nombre === operario.nombre &&
        formatArgDate(r.inicio) === todayStr,
    )
    .sort(
      (a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime(),
    );

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
              <UserCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                {operario.nombre}
              </h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">
                Actividad del Día
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shadow-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {opLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <History className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-xs font-bold uppercase tracking-widest">
                Sin actividad hoy
              </p>
            </div>
          ) : (
            <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-[11px] before:w-0.5 before:bg-slate-100 ml-2">
              {opLogs.map((log, idx) => (
                <div key={log.id || idx} className="relative pl-8">
                  <div
                    className={cn(
                      "absolute left-0 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center translate-x-[-11px]",
                      log.accion?.includes("Turno")
                        ? "bg-emerald-100 text-emerald-600"
                        : log.accion?.includes("Descanso")
                          ? "bg-amber-100 text-amber-600"
                          : "bg-blue-100 text-blue-600",
                    )}
                  >
                    {log.accion?.includes("Turno") ? (
                      <Play className="w-3 h-3" />
                    ) : log.accion?.includes("Descanso") ? (
                      <PauseCircle className="w-3 h-3" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3" />
                    )}
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                    <p className="text-xs font-bold text-slate-700 mb-1">
                      {log.accion}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <span>{formatArgTime(log.inicio)}</span>
                      {log.fin && (
                        <>
                          <span>-</span>
                          <span>{formatArgTime(log.fin)}</span>
                          <span className="text-blue-500 bg-blue-50 px-1.5 rounded">
                            {log.duracion_minutos}m
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function OperarioStatusGrid({
  operarios,
  registros,
}: {
  operarios: any[];
  registros: any[];
}) {
  const [selectedOp, setSelectedOp] = useState<any>(null);

  const currentStates = React.useMemo(() => {
    return operarios.map((op) => {
      // Find the latest record for this operario in the current session (last 12h)
      const twelveHoursAgo = new Date(
        Date.now() - 12 * 60 * 60 * 1000,
      ).toISOString();
      const opLogs = registros
        .filter(
          (r) => r.operario_nombre === op.nombre && r.inicio >= twelveHoursAgo,
        )
        .sort(
          (a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime(),
        );

      const latest = opLogs[0];

      if (!latest)
        return {
          ...op,
          status: "offline",
          task: null,
          delayed: false,
          startTime: null,
        };

      // Check for delay if they just started (first log of the day includes "Turno")
      let isDelayed = false;
      if (
        latest.accion.includes("Turno") &&
        !latest.fin &&
        op.horario_entrada
      ) {
        const startHour = new Date(latest.inicio).getHours();
        const startMin = new Date(latest.inicio).getMinutes();
        const [targetHour, targetMin] = op.horario_entrada
          .split(":")
          .map(Number);

        if (
          startHour > targetHour ||
          (startHour === targetHour && startMin > targetMin + 5)
        ) {
          isDelayed = true;
        }
      }

      const startTime = latest.inicio;

      // If the latest record has no 'fin', they are active in that action
      if (!latest.fin) {
        if (latest.accion.includes("Descanso"))
          return {
            ...op,
            status: "rest",
            task: "En Descanso",
            delayed: isDelayed,
            startTime,
          };
        if (latest.accion.includes("Turno"))
          return {
            ...op,
            status: "active",
            task: "Disponible / Sin tarea",
            delayed: isDelayed,
            startTime,
          };
        if (latest.accion.includes("Tarea:"))
          return {
            ...op,
            status: "active",
            task: latest.accion.replace("Tarea: ", ""),
            delayed: isDelayed,
            startTime,
          };
        return {
          ...op,
          status: "active",
          task: latest.accion,
          delayed: isDelayed,
          startTime,
        };
      }

      // If the latest record has 'fin', but it was a "Turno (Tramo)" or "Tarea" ending, they might be idle
      // For simplicity, if finished less than 5 mins ago, mark as "Idle", otherwise "Offline"
      const finTime = new Date(latest.fin).getTime();
      const now = Date.now();
      if (now - finTime < 5 * 60 * 1000)
        return {
          ...op,
          status: "idle",
          task: "Recién terminó tarea",
          startTime: latest.fin,
        };

      return { ...op, status: "offline", task: null, startTime: null };
    });
  }, [operarios, registros]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wider">
          <Activity className="w-5 h-5 text-emerald-500" /> Estado del Personal
        </h3>
      </div>

      {/* Desktop List View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-1/4">
                Operario
              </th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-1/6">
                Estado
              </th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-1/3">
                Actividad Actual
              </th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Duración
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentStates.map((op, idx) => (
              <tr
                key={idx}
                onClick={() => setSelectedOp(op)}
                className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-500 transition-colors">
                        <UserCircle className="w-5 h-5" />
                      </div>
                      <div
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white",
                          op.status === "active"
                            ? "bg-emerald-500"
                            : op.status === "rest"
                              ? "bg-amber-500"
                              : op.status === "idle"
                                ? "bg-blue-400"
                                : "bg-slate-300",
                        )}
                      ></div>
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-700 block">
                        {op.nombre}
                      </span>
                      {op.delayed && (
                        <span className="bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase inline-block mt-0.5">
                          Atrasado
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={cn(
                      "text-[9px] font-black uppercase px-2 py-1 rounded-md",
                      op.status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : op.status === "rest"
                          ? "bg-amber-100 text-amber-700"
                          : op.status === "idle"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {op.status === "active"
                      ? "Activo"
                      : op.status === "rest"
                        ? "Descanso"
                        : op.status === "idle"
                          ? "Libre"
                          : "Offline"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs text-slate-600 font-medium">
                    {op.task || "-"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {op.startTime ? (
                    <TimeElapsed
                      start={op.startTime}
                      className="text-xs font-bold text-slate-500"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden grid grid-cols-1 gap-4 p-4 bg-slate-50/50">
        {currentStates.map((op, idx) => (
          <div
            key={idx}
            onClick={() => setSelectedOp(op)}
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <UserCircle className="w-8 h-8" />
              </div>
              <div
                className={cn(
                  "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white",
                  op.status === "active"
                    ? "bg-emerald-500"
                    : op.status === "rest"
                      ? "bg-amber-500"
                      : op.status === "idle"
                        ? "bg-blue-400"
                        : "bg-slate-300",
                )}
              ></div>
            </div>
            <div className="min-w-0 flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-bold text-slate-800 truncate">
                  {op.nombre}
                </p>
                {op.delayed && (
                  <span className="bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">
                    Atrasado
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1 items-start">
                <span
                  className={cn(
                    "text-[9px] font-black uppercase px-1.5 py-0.5 rounded",
                    op.status === "active"
                      ? "bg-emerald-100 text-emerald-700"
                      : op.status === "rest"
                        ? "bg-amber-100 text-amber-700"
                        : op.status === "idle"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-200 text-slate-500",
                  )}
                >
                  {op.status === "active"
                    ? "Activo"
                    : op.status === "rest"
                      ? "Descanso"
                      : op.status === "idle"
                        ? "Libre"
                        : "Offline"}
                </span>
                {op.task && (
                  <div className="flex items-center gap-1 w-full text-slate-500">
                    <span
                      className="text-[10px] truncate max-w-[120px] font-medium"
                      title={op.task}
                    >
                      {op.task}
                    </span>
                    {op.startTime && (
                      <>
                        <span className="text-[8px] mx-0.5 opacity-50">•</span>
                        <TimeElapsed
                          start={op.startTime}
                          className="text-[10px] font-bold text-slate-400 shrink-0"
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300" />
          </div>
        ))}
      </div>

      {selectedOp && (
        <OperarioActivityModal
          operario={selectedOp}
          registros={registros}
          onClose={() => setSelectedOp(null)}
        />
      )}
    </div>
  );
}

function UserProfile({
  user,
  onUpdate,
  googleUser,
  googleToken,
  onLink,
  onUnlink,
}: {
  user: Operario;
  onUpdate: (u: Operario) => void;
  googleUser?: FirebaseUser | null;
  googleToken?: string | null;
  onLink?: () => void;
  onUnlink?: () => void;
}) {
  const [nombre, setNombre] = useState(user.nombre);
  const [usuario, setUsuario] = useState(user.usuario || "");
  const [email, setEmail] = useState(user.email || "");
  const [pin, setPin] = useState(user.pin || "");
  const [whatsapp, setWhatsapp] = useState(
    user.whatsapp ? user.whatsapp.replace(/^549/, "") : "",
  );
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clean spaces and ensure only digits
    const cleanNumber = whatsapp.replace(/\D/g, "");

    if (!cleanNumber.trim()) {
      setMsg({ text: "El número de WhatsApp es obligatorio", type: "error" });
      return;
    }

    setLoading(true);
    setMsg({ text: "", type: "" });
    try {
      const fullWhatsapp = "549" + cleanNumber;
      const updates = {
        nombre,
        usuario: usuario.toUpperCase(),
        email,
        pin,
        whatsapp: fullWhatsapp,
      };
      const { error: updateError } = await supabase
        .from("users")
        .update(updates)
        .eq("id", user.id);
      if (updateError) throw updateError;

      onUpdate({ ...user, ...updates });
      setMsg({ text: "Perfil actualizado con éxito", type: "success" });
    } catch (err: any) {
      setMsg({ text: "Error: " + err.message, type: "error" });
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
          <div
            className={cn(
              "p-4 rounded-xl text-xs font-bold",
              msg.type === "success"
                ? "bg-emerald-50 text-emerald-600"
                : "bg-red-50 text-red-600",
            )}
          >
            {msg.text}
          </div>
        )}

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
            Nombre Completo
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            className="w-full bg-slate-50 border-2 border-slate-100 focus:border-blue-500 rounded-2xl px-5 py-3 font-bold outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
            Usuario
          </label>
          <input
            type="text"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            className="w-full bg-slate-50 border-2 border-slate-100 focus:border-blue-500 rounded-2xl px-5 py-3 font-bold outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
            Email
          </label>
          <div className="relative">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!!user.email && user.email.includes("@")}
              className="w-full bg-slate-100 border-2 border-slate-100 rounded-2xl px-5 py-3 font-bold outline-none opacity-60"
            />
            {user.email && (
              <ShieldCheck className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
            )}
          </div>
          <p className="text-[9px] text-slate-400 mt-1 ml-1 uppercase font-bold tracking-tight">
            * Autenticación vinculada
          </p>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
            WhatsApp (Argentina)
          </label>
          <div className="flex bg-slate-50 border-2 border-slate-100 focus-within:border-blue-500 rounded-2xl overflow-hidden transition-colors">
            <div className="bg-slate-100/50 px-4 py-3 font-black text-slate-400 border-r border-slate-100 flex items-center shrink-0 text-xs">
              +54 9
            </div>
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, ""); // Keep only numbers
                setWhatsapp(val);
              }}
              placeholder="Ej: 3815025897"
              required
              className="flex-1 bg-transparent px-5 py-3 font-bold outline-none"
            />
          </div>
          <p className="text-[8px] text-slate-400 mt-1 ml-1 leading-tight">
            Ingresa el código de área + número sin 0 ni 15. Indispensable para
            alertas.
          </p>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
            PIN / Contraseña
          </label>
          <input
            type="text"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full bg-slate-50 border-2 border-slate-100 focus:border-blue-500 rounded-2xl px-5 py-3 font-bold outline-none text-center text-xl tracking-widest font-mono"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#0b3464] text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-blue-900/10 active:scale-95 transition-all mt-4"
        >
          {loading ? (
            <RefreshCcw className="w-6 h-6 animate-spin mx-auto text-white/50" />
          ) : (
            "Guardar Cambios"
          )}
        </button>
      </form>

      {onLink && onUnlink && (
        <div className="mt-8 pt-6 border-t border-slate-100">
          <h3 className="text-sm font-black text-[#0b3464] mb-3 uppercase tracking-widest flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-500" /> Vinculación de
            Calendario
          </h3>

          {googleUser ? (
            <div className="flex flex-col gap-3">
              <div className="bg-emerald-50 border-2 border-emerald-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Conectado con Google e-Mail
                  </p>
                  <p className="text-xs font-bold text-slate-500 truncate mt-0.5">
                    {googleUser.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onUnlink}
                  className="px-4 py-2 bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all self-start sm:self-center shrink-0 uppercase tracking-wider"
                >
                  Desvincular
                </button>
              </div>
              <p className="text-[10px] text-rose-500 font-medium bg-rose-50 px-3 py-2 rounded-lg border border-rose-100">
                ⚠️ <strong>Advertencia:</strong> Si desvinculas tu cuenta, las tareas dejarán de sincronizarse automáticamente en tu Google Calendar y no recibirás notificaciones programadas.
              </p>
            </div>
          ) : (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-5 text-center">
              <p className="text-xs font-extrabold text-slate-600 leading-normal mb-4">
                Vincula tu cuenta para ver y sincronizar tus tareas directamente
                en tu Google Calendar. Podrás recibir notificaciones y organizar
                tu jornada.
              </p>
              <button
                type="button"
                onClick={onLink}
                className="inline-flex items-center gap-2.5 px-6 py-3 bg-white border-2 border-slate-200 hover:border-slate-300 rounded-2xl text-xs font-black text-slate-700 shadow-sm transition-all uppercase tracking-widest"
              >
                <svg className="w-4.5 h-4.5" viewBox="0 0 48 48">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  ></path>
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  ></path>
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  ></path>
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  ></path>
                </svg>
                Vincular Google Calendar
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function PersonalManagement() {
  const [users, setUsers] = useState<Operario[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<Partial<Operario> | null>(
    null,
  );

  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("nombre", { ascending: true });

      if (error) {
        console.error("Error fetching users:", error);
      } else {
        setUsers(data as Operario[]);
      }
      setLoading(false);
    };

    fetchUsers();

    // Setup real-time listener
    const channel = supabase
      .channel("public:users")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => {
          fetchUsers();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const toggleRole = async (user: Operario) => {
    if (!user.id) return;
    const nextRole = user.rol === "supervisor" ? "operario" : "supervisor";
    try {
      const { error } = await supabase
        .from("users")
        .update({ rol: nextRole })
        .eq("id", user.id);
      if (error) throw error;
    } catch (err) {
      console.error(err);
      alert("Error al cambiar rol");
    }
  };

  const toggleActive = async (user: Operario) => {
    if (!user.id) return;
    try {
      const { error } = await supabase
        .from("users")
        .update({ activo: !user.activo })
        .eq("id", user.id);
      if (error) throw error;
    } catch (err) {
      console.error(err);
      alert("Error al cambiar estado");
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const { error } = await supabase.from("users").delete().eq("id", userId);
      if (error) throw error;
    } catch (err) {
      console.error(err);
      alert("Error al eliminar usuario");
    }
  };

  const saveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const u = editingUser.usuario?.trim().toUpperCase();
      const userData: any = {
        nombre: editingUser.nombre,
        usuario: u,
        pin: editingUser.pin?.trim(),
        whatsapp: editingUser.whatsapp,
        rol: editingUser.rol || "operario",
        horario_entrada: editingUser.horario_entrada || null,
        horario_salida: editingUser.horario_salida || null,
      };

      if (editingUser.id) {
        const { error } = await supabase
          .from("users")
          .update(userData)
          .eq("id", editingUser.id);
        if (error) throw error;
      } else {
        const customId = u!.toLowerCase();
        const { error } = await supabase.from("users").insert({
          ...userData,
          id: customId,
          activo: true,
        });
        if (error) throw error;
      }
      setEditingUser(null);
    } catch (err) {
      console.error(err);
      alert("Error guardando usuario");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-slate-800">
          Módulo de Personal
        </h2>
        <div className="flex gap-4">
          <div className="flex bg-white px-4 py-2 rounded-xl border border-slate-200">
            <span className="text-sm font-bold text-slate-500">
              Total: {users.length}
            </span>
          </div>
          <button
            onClick={() => setEditingUser({})}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> Nuevo Usuario
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Nombre / Usuario
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Contraseña
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Rol
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Estado
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-800">
                        {u.nombre}
                      </span>
                      <span className="text-[10px] font-black text-blue-500 tracking-wider uppercase">
                        @{u.usuario || "SIN_USUARIO"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">
                      {u.pin || "---"}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <span
                      className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                        u.rol === "supervisor"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-blue-100 text-blue-700",
                      )}
                    >
                      {u.rol}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <span
                      className={cn(
                        "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest",
                        u.activo ? "text-emerald-500" : "text-rose-500",
                      )}
                    >
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full",
                          u.activo
                            ? "bg-emerald-500 animate-pulse"
                            : "bg-rose-500",
                        )}
                      />
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingUser(u)}
                        className="p-2 hover:bg-blue-50 text-blue-600 rounded-xl transition-colors"
                        title="Editar"
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
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
                          u.activo
                            ? "hover:bg-rose-50 text-rose-500"
                            : "hover:bg-emerald-50 text-emerald-500",
                        )}
                        title={u.activo ? "Desactivar" : "Activar"}
                      >
                        {u.activo ? (
                          <X className="w-5 h-5" />
                        ) : (
                          <CheckCircle2 className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => deleteUser(u.id!)}
                        className="p-2 hover:bg-rose-50 text-rose-600 rounded-xl transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && (
          <div className="p-20 flex justify-center">
            <RefreshCcw className="w-8 h-8 animate-spin text-slate-200" />
          </div>
        )}
        {users.length === 0 && !loading && (
          <div className="p-20 text-center text-slate-400 font-bold tracking-widest uppercase text-xs">
            No se encontraron usuarios.
          </div>
        )}
      </div>

      {editingUser !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-[32px] w-full max-w-lg shadow-xl">
            <h3 className="text-xl font-black text-slate-800 mb-6">
              {editingUser.id ? "Editar Usuario" : "Nuevo Usuario"}
            </h3>
            <form onSubmit={saveUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={editingUser.nombre || ""}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, nombre: e.target.value })
                  }
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Usuario (ej: LPEREZ)
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingUser.id}
                  value={editingUser.usuario || ""}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, usuario: e.target.value })
                  }
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 outline-none focus:border-blue-500 disabled:opacity-50 uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  WhatsApp (+549...)
                </label>
                <input
                  type="text"
                  value={editingUser.whatsapp || ""}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, whatsapp: e.target.value })
                  }
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Contraseña / PIN
                </label>
                <input
                  type="text"
                  required
                  value={editingUser.pin || ""}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, pin: e.target.value })
                  }
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 outline-none focus:border-blue-500 font-mono text-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 text-[10px] uppercase tracking-widest">
                    Hora Entrada
                  </label>
                  <input
                    type="time"
                    value={editingUser.horario_entrada || ""}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        horario_entrada: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 text-[10px] uppercase tracking-widest">
                    Hora Salida
                  </label>
                  <input
                    type="time"
                    value={editingUser.horario_salida || ""}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        horario_salida: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              {!editingUser.id && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Rol
                  </label>
                  <select
                    value={editingUser.rol || "operario"}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        rol: e.target.value as any,
                      })
                    }
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 outline-none focus:border-blue-500"
                  >
                    <option value="operario">Operario</option>
                    <option value="supervisor">Supervisor</option>
                  </select>
                </div>
              )}
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-4 font-bold text-slate-500 bg-slate-100 rounded-2xl hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 font-bold text-white bg-blue-600 rounded-2xl hover:bg-blue-700"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SupervisorDashboard({
  user,
  onLogout,
}: {
  user: Operario;
  onLogout: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"live" | "personal" | "hoja_de_horas" | "reportes">("live");

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-800">
      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col hidden md:flex flex-shrink-0">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center p-1.5 text-white font-black text-lg shadow-md shadow-blue-500/20">
              A
            </div>
            <div>
              <h1 className="font-black text-sm text-white tracking-tight leading-tight">
                Arévalo Servicios
              </h1>
              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-widest mt-0.5">
                SUPERVISOR
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab("live")}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all",
              activeTab === "live"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            )}
          >
            <Activity className="w-5 h-5" />
            Monitoreo en Vivo
          </button>
          
          <button
            onClick={() => setActiveTab("personal")}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all",
              activeTab === "personal"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            )}
          >
            <Users className="w-5 h-5" />
            Personal
          </button>

          <button
            onClick={() => setActiveTab("hoja_de_horas")}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all",
              activeTab === "hoja_de_horas"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            )}
          >
            <Calendar className="w-5 h-5" />
            Hoja de Horas
          </button>

          <button
            onClick={() => setActiveTab("reportes")}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all",
              activeTab === "reportes"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            )}
          >
            <FileSpreadsheet className="w-5 h-5" />
            Reporte Gerencial
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-4 py-3 mb-2 bg-slate-800 rounded-xl">
             <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
                {user.nombre ? user.nombre.substring(0, 2).toUpperCase() : "SP"}
             </div>
             <span className="text-sm font-bold truncate">{user.nombre}</span>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-xl transition-all"
          >
            <LogOut className="w-5 h-5" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* MOBILE HEADER (ONLY SHOWS ON MOBILE) */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-slate-900 text-white z-50 flex items-center justify-between p-4 shadow-md">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-black text-sm">
              A
            </div>
            <h1 className="font-black text-sm text-white tracking-tight leading-tight">
              Arévalo
            </h1>
        </div>
        <div className="flex items-center gap-2">
           <select
             value={activeTab}
             onChange={(e) => setActiveTab(e.target.value as any)}
             className="bg-slate-800 text-white text-xs font-bold rounded-lg px-2 py-1.5 border-none outline-none"
           >
              <option value="live">Monitoreo</option>
              <option value="personal">Personal</option>
              <option value="hoja_de_horas">Hoja de Horas</option>
              <option value="reportes">Reporte Gerencial</option>
           </select>
           <button onClick={onLogout} className="p-1.5 text-rose-400 bg-slate-800 rounded-lg">
             <LogOut className="w-4 h-4" />
           </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden pt-16 md:pt-0">
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
           {activeTab === "live" ? (
             <LiveStatusView user={user} onLogout={onLogout} />
           ) : activeTab === "personal" ? (
             <PersonalManagement />
           ) : activeTab === "reportes" ? (
             <ExecutiveReportModule />
           ) : (
             <SupervisorTimesheetModule />
           )}
        </div>
      </main>
    </div>
  );
}

function LiveStatusView({
  user,
  onLogout,
}: {
  user: Operario;
  onLogout: () => void;
}) {
  const [operarios, setOperarios] = useState<any[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowTime, setNowTime] = useState<number>(Date.now());
  const [selectedOperarioId, setSelectedOperarioId] = useState<number | null>(null);


  const fetchOps = async () => {
    try {
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("rol", "operario")
        .eq("activo", true)
        .order("nombre");
      setOperarios(data || []);
    } catch (e) {
      console.error("Error fetching operarios:", e);
    }
  };

  const fetchLogs = async () => {
    try {
      const { data } = await supabase
        .from("logs")
        .select("*")
        .order("inicio", { ascending: false })
        .limit(200);
      setRegistros(data || []);
    } catch (e) {
      console.error("Error fetching logs:", e);
    }
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      await Promise.all([fetchOps(), fetchLogs()]);
      setLoading(false);
    }
    loadData();

    // Subscribe to logs changes in real-time
    const channel = supabase
      .channel("supervisor-live-status-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "logs" },
        () => {
          fetchLogs();
        }
      )
      .subscribe();

    // Periodic safety sync fallback
    const interval = setInterval(() => {
      fetchLogs();
      fetchOps();
    }, 12000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  // Compute live state matrix using real-time local calculations
  const operariosEstadoEnVivo = React.useMemo(() => {
    // Current local Argentinian date representation
    const dObj = new Date();
    const yVal = dObj.getFullYear();
    const mVal = String(dObj.getMonth() + 1).padStart(2, "0");
    const dVal = String(dObj.getDate()).padStart(2, "0");
    const todayStr = `${yVal}-${mVal}-${dVal}`;

    // Load shifts scheduled
    let shifts: any[] = [];
    try {
      const saved = localStorage.getItem("limpieza_turnos_scheduled");
      if (saved) {
        shifts = JSON.parse(saved);
      }
    } catch (e) {
      console.error("Error decoding schedules from localStorage:", e);
    }

    return operarios.map((op) => {
      const opNameNorm = op.nombre?.trim().toLowerCase();

      // Look up if operator had a shift scheduled for today
      const todayShift = shifts.find(
        (s: any) =>
          s.operarioNombre?.trim().toLowerCase() === opNameNorm &&
          s.fecha === todayStr
      );

      // Filter all logs of today or inside current 12-hour window
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
      const opLogs = registros
        .filter(
          (r) =>
            r.operario_nombre?.trim().toLowerCase() === opNameNorm &&
            (r.inicio >= twelveHoursAgo || (r.inicio && r.inicio.startsWith(todayStr)))
        )
        .sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime());

      const latestLog = opLogs[0];

      // Determine checks for delays (tardiness)
      let isLateOffline = false;
      let hasLateCheckIn = false;

      // First shift log of today
      const firstTurnoLog = [...opLogs]
        .reverse()
        .find(
          (r) =>
            r.accion?.includes("Turno") ||
            r.accion?.includes("Sesión") ||
            r.accion?.includes("Jornada")
        );

      if (todayShift) {
        // Build estimated start date target
        const [h, m] = todayShift.inicioEstimado.split(":").map(Number);
        const schedTime = new Date();
        schedTime.setHours(h, m, 0, 0);

        if (!firstTurnoLog) {
          // If the operator hasn't logged in today and 15 mins passed the expected check-in
          if (Date.now() > schedTime.getTime() + 15 * 60 * 1000) {
            isLateOffline = true;
          }
        } else {
          // If check-in happened 15 minutes after scheduled check-in time
          const checkInTime = new Date(firstTurnoLog.inicio);
          const checkHour = checkInTime.getHours();
          const checkMin = checkInTime.getMinutes();
          if (checkHour > h || (checkHour === h && checkMin > m + 15)) {
            hasLateCheckIn = true;
          }
        }
      }

      // Compute visual logic state: green, gray, red, yellow
      let type: "activo" | "offline" | "atrasado" | "descanso" = "offline";
      let label = "No logueado";
      let horaIngreso = "-";
      let actividad = "Sin registro";
      let startForElapsed: string | null = null;

      // Filter all logs strictly belonging to today (on local calendar date basis)
      const logsDeHoy = opLogs.filter((r) => {
        if (!r.inicio) return false;
        try {
          const d = new Date(r.inicio);
          return (
            d.getFullYear() === yVal &&
            d.getMonth() === dObj.getMonth() &&
            d.getDate() === dObj.getDate()
          );
        } catch (e) {
          return false;
        }
      });

      // Find the absolute first log of today (earliest log among today's logs)
      // Since opLogs & logsDeHoy are sorted newest to oldest, the last item is the earliest.
      const firstLogDeHoy = logsDeHoy[logsDeHoy.length - 1];
      const firstLogDelDia = firstLogDeHoy || (latestLog && !latestLog.fin ? latestLog : null);

      if (firstLogDelDia) {
        try {
          const di = new Date(firstLogDelDia.inicio);
          horaIngreso = `${String(di.getHours()).padStart(2, "0")}:${String(di.getMinutes()).padStart(2, "0")} hs`;
        } catch (e) {
          horaIngreso = "-";
        }
      }

      if (latestLog && !latestLog.fin) {
        // Connected active session
        startForElapsed = latestLog.inicio;

        if (latestLog.accion?.includes("Descanso")) {
          type = "descanso";
          label = "Descanso";
          actividad = "Descansando / Pausa";
        } else {
          if (hasLateCheckIn) {
            type = "atrasado";
            label = "Atrasado";
          } else {
            type = "activo";
            label = "Activo";
          }

          if (latestLog.accion?.includes("Tarea:")) {
            actividad = latestLog.accion.replace("Tarea: ", "");
          } else if (latestLog.accion?.includes("Turno")) {
            actividad = "Disponible / Guardia";
          } else {
            actividad = latestLog.accion || "Turno Activo";
          }
        }
      } else {
        // Offline
        if (isLateOffline) {
          type = "atrasado";
          label = "Atrasado";
          actividad = "Turno vencido sin fichar";
        } else {
          type = "offline";
          label = "No logueado";
          actividad = "No logueado";
        }
      }

      return {
        id: op.id,
        nombre: op.nombre,
        loginType: type,
        loginLabel: label,
        horaIngreso,
        actividad,
        startForElapsed,
        logsDeHoy,
      };
    });
  }, [operarios, registros, nowTime]);

  const getElapsedString = (startIso: string | null) => {
    if (!startIso) return "-";
    const gapMs = nowTime - new Date(startIso).getTime();
    if (gapMs < 0) return "0s";

    const secs = Math.floor(gapMs / 1000);
    const mins = Math.floor(secs / 60);
    const hrs = Math.floor(mins / 60);

    const remSecs = secs % 60;
    const remMins = mins % 60;

    let str = "";
    if (hrs > 0) {
      str += `${hrs}h `;
    }
    if (mins > 0 || hrs > 0) {
      str += `${remMins}m `;
    }
    str += `${remSecs}s`;
    return str;
  };



  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      {/* TITLE AND LEGEND CARD */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Estado en Vivo del Personal
          </h2>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Visualización unificada de tiempo de trabajo, actividades en curso y descansos del equipo de Arévalo Servicios.
          </p>
        </div>

          {/* STATUS COLOR LEGEND */}
          <div className="flex flex-wrap gap-3 p-3 bg-slate-50 border border-slate-100 rounded-2xl w-full md:w-auto">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <span className="w-3 h-3 bg-emerald-500 rounded-full border-2 border-white shadow shadow-emerald-200" />
              <span>Activo</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <span className="w-3 h-3 bg-amber-400 rounded-full border-2 border-white shadow shadow-amber-200" />
              <span>Descanso</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <span className="w-3 h-3 bg-rose-500 rounded-full border-2 border-white shadow shadow-rose-200 animate-pulse" />
              <span>Atrasado</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <span className="w-3 h-3 bg-slate-300 rounded-full border-2 border-white shadow shadow-slate-100" />
              <span>No logueado</span>
            </div>
          </div>
        </div>

        {/* LOADING & DATA DISPLAY */}
        {loading ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-16 flex flex-col items-center justify-center text-center shadow-sm">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-xs font-black uppercase text-slate-400 tracking-widest">
              Sincronizando estados en vivo...
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            {/* DESKTOP TABLE VIEW */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[12%] text-center">
                      Logueo
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[25%]">
                      Nombre del Operario
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[18%] text-center">
                      Ingreso
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[30%]">
                      Actividad Actual
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[15%] text-right pr-8">
                      Duración
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {operariosEstadoEnVivo.map((op) => (
                    <React.Fragment key={op.id}>
                      <tr
                        onClick={() => setSelectedOperarioId(selectedOperarioId === op.id ? null : op.id)}
                        className={cn(
                          "cursor-pointer hover:bg-blue-50/30 transition-all group select-none",
                          selectedOperarioId === op.id && "bg-blue-50/20"
                        )}
                      >
                        {/* 1. ICONO DE LOGUE */}
                        <td className="px-6 py-5 text-center">
                          <div className="inline-flex justify-center items-center">
                            <span
                              className={cn(
                                "w-5 h-5 rounded-full border-4 border-white shadow-md flex items-center justify-center transition-all",
                                op.loginType === "activo" && "bg-emerald-500 shadow-emerald-100",
                                op.loginType === "descanso" && "bg-amber-400 shadow-amber-100",
                                op.loginType === "atrasado" && "bg-rose-500 shadow-rose-100 animate-pulse",
                                op.loginType === "offline" && "bg-slate-300"
                              )}
                              title={op.loginLabel}
                            />
                          </div>
                        </td>

                        {/* 2. NOMBRE DEL OPERARIO */}
                        <td className="px-6 py-5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center uppercase">
                                {op.nombre ? op.nombre.substring(0, 2) : "OP"}
                              </div>
                              <div>
                                <span className="text-sm font-bold text-slate-800 block">
                                  {op.nombre}
                                </span>
                                {op.loginType === "atrasado" && (
                                  <span className="inline-block bg-rose-50 text-rose-600 text-[8px] font-black px-1.5 py-0.5 rounded uppercase mt-0.5 tracking-wider border border-rose-100 font-sans">
                                    Alerta de Retraso
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-slate-400 group-hover:text-blue-600 transition-colors bg-slate-50 p-1 rounded-lg border border-slate-100/50">
                              {selectedOperarioId === op.id ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 3. INGRESO (HORA DE INICIO) */}
                        <td className="px-6 py-5 text-center">
                          <span className="text-xs font-mono font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                            {op.horaIngreso}
                          </span>
                        </td>

                        {/* 4. ACTIVIDAD ACTUAL */}
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700 leading-normal">
                              {op.actividad}
                            </span>
                            {op.loginType === "activo" && (
                              <span className="text-[10px] font-semibold text-emerald-500 flex items-center gap-1 mt-0.5">
                                ● En línea
                              </span>
                            )}
                            {op.loginType === "descanso" && (
                              <span className="text-[10px] font-semibold text-amber-500 flex items-center gap-1 mt-0.5">
                                ● En receso
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 5. DURACIÓN */}
                        <td className="px-6 py-5 text-right pr-8">
                          <span className="text-xs font-mono font-bold text-slate-500 block">
                            {getElapsedString(op.startForElapsed)}
                          </span>
                        </td>
                      </tr>

                      {/* DETALLE DE ACTIVIDADES DE HOY EXPANDIDO */}
                      {selectedOperarioId === op.id && (
                        <tr className="bg-slate-50/30">
                          <td colSpan={5} className="px-8 py-5 border-l-4 border-l-blue-600">
                            <div className="flex items-center gap-2 mb-3 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                              <History className="w-4 h-4 text-blue-500" />
                              <span>Actividades completadas hoy ({op.nombre})</span>
                            </div>

                            {op.logsDeHoy && op.logsDeHoy.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl">
                                {op.logsDeHoy.map((log: any, idx: number) => {
                                  let startFormatted = "--:--";
                                  let endFormatted = "En curso";
                                  let diffFormatted = "";

                                  try {
                                    if (log.inicio) {
                                      const dStart = new Date(log.inicio);
                                      startFormatted = `${String(dStart.getHours()).padStart(2, "0")}:${String(dStart.getMinutes()).padStart(2, "0")}`;
                                      
                                      const finMs = log.fin ? new Date(log.fin).getTime() : Date.now();
                                      const diffMs = finMs - dStart.getTime();
                                      if (diffMs > 0) {
                                        const mins = Math.floor(diffMs / 60000);
                                        const hrs = Math.floor(mins / 60);
                                        const remMins = mins % 60;
                                        diffFormatted = hrs > 0 ? `${hrs}h ${remMins}m` : `${remMins}m`;
                                      } else {
                                        diffFormatted = "0m";
                                      }
                                    }
                                    if (log.fin) {
                                      const dEnd = new Date(log.fin);
                                      endFormatted = `${String(dEnd.getHours()).padStart(2, "0")}:${String(dEnd.getMinutes()).padStart(2, "0")}`;
                                    }
                                  } catch (err) {
                                    console.error(err);
                                  }

                                  const isBreak = log.accion?.includes("Descanso") || log.accion?.includes("Almuerzo");
                                  const isCheckIn = log.accion?.includes("Turno") || log.accion?.includes("Sesión") || log.accion?.includes("Jornada");

                                  return (
                                    <div
                                      key={log.id || idx}
                                      className="flex flex-col gap-2 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-slate-200 transition-all"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <div className={cn(
                                            "w-2 h-2 rounded-full",
                                            isBreak ? "bg-amber-400" : (isCheckIn ? "bg-emerald-500" : "bg-blue-500")
                                          )} />
                                          <span className="text-xs font-bold text-slate-700">
                                            {log.accion?.includes("Tarea:") ? log.accion.replace("Tarea: ", "") : log.accion}
                                          </span>
                                        </div>
                                        <span className={cn(
                                          "text-[9px] font-black px-2 py-0.5 rounded border font-sans",
                                          log.fin ? "bg-slate-50 text-slate-500 border-slate-100" : "bg-emerald-50 text-emerald-600 border-emerald-100 animate-pulse"
                                        )}>
                                          {diffFormatted || "0m"}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between pl-4 text-slate-500">
                                        <span className="text-[10px] font-bold font-mono">
                                          ⏱️ {startFormatted} - {endFormatted}
                                        </span>
                                      </div>
                                      {log.comentario && (
                                        <div className="ml-4 text-[10px] text-slate-500 italic bg-amber-50/40 p-2 rounded-xl border border-amber-100/50 leading-snug">
                                          "{log.comentario}"
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-slate-400 text-xs font-semibold p-4 bg-slate-50 rounded-2xl border border-slate-100 w-fit">
                                Sin actividades registradas el día de hoy.
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}

                  {operariosEstadoEnVivo.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">
                        Ningún operario registrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS VIEW */}
            <div className="md:hidden flex flex-col divide-y divide-slate-100">
              {operariosEstadoEnVivo.map((op) => (
                <div
                  key={op.id}
                  onClick={() => setSelectedOperarioId(selectedOperarioId === op.id ? null : op.id)}
                  className={cn(
                    "p-5 flex flex-col gap-4 hover:bg-slate-50/50 transition-all cursor-pointer select-none",
                    selectedOperarioId === op.id ? "bg-slate-50/80" : ""
                  )}
                >
                  <div className="flex justify-between items-start gap-4">
                    {/* Operario & Status */}
                    <div className="flex items-center gap-3">
                      {/* 1. ICONO DE LOGUE (MOBILE) */}
                      <span
                        className={cn(
                          "w-4 h-4 rounded-full border-2 border-white shadow-sm block flex-shrink-0",
                          op.loginType === "activo" && "bg-emerald-500 shadow-emerald-100",
                          op.loginType === "descanso" && "bg-amber-400 shadow-amber-100",
                          op.loginType === "atrasado" && "bg-rose-500 shadow-rose-100 animate-pulse",
                          op.loginType === "offline" && "bg-slate-300"
                        )}
                        title={op.loginLabel}
                      />

                      {/* 2. NOMBRE DEL OPERARIO */}
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 leading-tight flex items-center gap-1.5">
                          {op.nombre}
                          <span className="text-slate-400">
                            {selectedOperarioId === op.id ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </span>
                        </h4>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mt-0.5">
                          {op.loginLabel}
                        </span>
                      </div>
                    </div>

                    {/* 5. DURACIÓN (MOBILE) */}
                    <div className="text-right">
                      <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider mb-0.5">
                        DURACIÓN
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        {getElapsedString(op.startForElapsed)}
                      </span>
                    </div>
                  </div>

                  {/* Highlights Grid */}
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">
                        3. INGRESO
                      </span>
                      <span className="text-xs font-bold text-slate-700 font-mono">
                        {op.horaIngreso}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">
                        4. ACTIVIDAD ACTUAL
                      </span>
                      <span className="text-xs font-bold text-slate-700 truncate block max-w-[150px]" title={op.actividad}>
                        {op.actividad}
                      </span>
                    </div>
                  </div>

                  {/* EXPANDED ACTIVITY HISTORY FOR MOBILE */}
                  {selectedOperarioId === op.id && (
                    <div className="mt-2 pt-4 border-t border-slate-100 select-none">
                      <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-3 flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-blue-500" />
                        <span>Historial de Actividades de Hoy</span>
                      </div>

                      {op.logsDeHoy && op.logsDeHoy.length > 0 ? (
                        <div className="flex flex-col gap-2.5 pl-3 border-l-2 border-slate-200">
                          {op.logsDeHoy.map((log: any, idx: number) => {
                            let startFormatted = "--:--";
                            let endFormatted = "En curso";
                            let diffFormatted = "";

                            try {
                              if (log.inicio) {
                                const dStart = new Date(log.inicio);
                                startFormatted = `${String(dStart.getHours()).padStart(2, "0")}:${String(dStart.getMinutes()).padStart(2, "0")}`;
                                
                                const finMs = log.fin ? new Date(log.fin).getTime() : Date.now();
                                const diffMs = finMs - dStart.getTime();
                                if (diffMs > 0) {
                                  const mins = Math.floor(diffMs / 60000);
                                  const hrs = Math.floor(mins / 60);
                                  const remMins = mins % 60;
                                  diffFormatted = hrs > 0 ? `${hrs}h ${remMins}m` : `${remMins}m`;
                                } else {
                                  diffFormatted = "0m";
                                }
                              }
                              if (log.fin) {
                                const dEnd = new Date(log.fin);
                                endFormatted = `${String(dEnd.getHours()).padStart(2, "0")}:${String(dEnd.getMinutes()).padStart(2, "0")}`;
                              }
                            } catch (err) {
                              console.error(err);
                            }

                            const isBreak = log.accion?.includes("Descanso") || log.accion?.includes("Almuerzo");
                            const isCheckIn = log.accion?.includes("Turno") || log.accion?.includes("Sesión") || log.accion?.includes("Jornada");

                            return (
                              <div key={log.id || idx} className="flex flex-col gap-1.5 p-2 bg-white rounded-xl border border-slate-200/60 shadow-sm">
                                <div className="flex justify-between items-start gap-2">
                                  <div className="flex items-start gap-1.5">
                                    <div className={cn(
                                      "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                                      isBreak ? "bg-amber-400" : (isCheckIn ? "bg-emerald-500" : "bg-blue-500")
                                    )} />
                                    <span className="text-xs font-bold text-slate-700 leading-tight">
                                      {log.accion?.includes("Tarea:") ? log.accion.replace("Tarea: ", "") : log.accion}
                                    </span>
                                  </div>
                                  <span className={cn(
                                    "text-[9px] font-black px-1.5 py-0.5 rounded border font-sans",
                                    log.fin ? "bg-slate-50 text-slate-500 border-slate-100" : "bg-emerald-50 text-emerald-600 border-emerald-100 animate-pulse"
                                  )}>
                                    {diffFormatted || "0m"}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center pl-3.5">
                                  <span className="text-[10px] font-bold text-slate-500 font-mono">
                                    ⏱️ {startFormatted} - {endFormatted}
                                  </span>
                                </div>
                                {log.comentario && (
                                  <p className="text-[10px] text-slate-500 italic ml-3.5 bg-amber-50/20 p-1.5 rounded-lg border border-amber-100/30">
                                    "{log.comentario}"
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-slate-400 text-xs font-semibold py-2">
                          Sin actividades registradas el día de hoy.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {operariosEstadoEnVivo.length === 0 && (
                <div className="py-12 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">
                  Ningún operario registrado
                </div>
              )}
            </div>
          </div>
        )}
      </div>
  );
}














