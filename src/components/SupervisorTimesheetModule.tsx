import React, { useState, useMemo, useEffect } from "react";
import { formatArgDate, formatArgTime } from "../App";
import { supabase } from "../lib/supabase";
import { 
  Clock, 
  UserX, 
  CheckCircle2, 
  Calendar, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  TrendingUp, 
  UserCheck, 
  Award, 
  Search, 
  Menu, 
  Briefcase, 
  PlusCircle, 
  Filter, 
  RefreshCw, 
  CalendarRange,
  Zap,
  CheckCircle,
  Clock3,
  UserCheck2,
  Trash
} from "lucide-react";

interface ScheduledShift {
  id: string;
  operarioNombre: string;
  fecha: string; // YYYY-MM-DD
  inicioEstimado: string; // HH:MM, e.g. "08:00"
  finEstimado: string; // HH:MM, e.g. "16:00"
  ubicacion: string;
  reemplazoNombre?: string;
  justificado?: boolean;
}

export function SupervisorTimesheetModule({
  operarios = [],
  reportDateMode: parentDateMode,
  setReportDateMode: setParentDateMode,
  reportUserFilter: parentUserFilter,
  setReportUserFilter: setParentUserFilter,
  customStart: parentCustomStart,
  setCustomStart: setParentCustomStart,
  customEnd: parentCustomEnd,
  setCustomEnd: setParentCustomEnd,
}: any) {
  // Local operarios list fallback if prop is empty
  const [dbOperarios, setDbOperarios] = useState<any[]>([]);

  useEffect(() => {
    if (!operarios || operarios.length === 0) {
      supabase
        .from("users")
        .select("*")
        .eq("rol", "operario")
        .eq("activo", true)
        .order("nombre")
        .then(({ data }) => {
          if (data && data.length > 0) {
            setDbOperarios(data);
          }
        });
    }
  }, [operarios]);

  const activeOperarios = operarios && operarios.length > 0 ? operarios : dbOperarios;
  const [reportDateMode, setReportDateMode] = useState(parentDateMode || "semana");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [reportUserFilter, setReportUserFilter] = useState("Todos");

  // Local tab system inside the Timesheet Module
  const [activeTab, setActiveTab] = useState<"calendar" | "timesheet" | "absences" | "scheduler">("calendar");
  const [selectedOperario, setSelectedOperario] = useState<string | null>(null);

  // Navigation Offsets State
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [dayOffset, setDayOffset] = useState(0);
  const [selectedCellDetail, setSelectedCellDetail] = useState<any | null>(null);

  // Calculate Monday date of offset week
  const getMondayDate = (offsetWeeks: number) => {
    const d = new Date();
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diffToMonday + offsetWeeks * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Dynamic days array based on reportDateMode (dia, semana, mes, custom)
  const displayDays = useMemo(() => {
    const now = new Date();

    if (reportDateMode === "dia") {
      const target = new Date();
      target.setDate(now.getDate() + dayOffset);
      target.setHours(0, 0, 0, 0);
      return [target];
    }

    if (reportDateMode === "mes") {
      const targetMonthDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
      const year = targetMonthDate.getFullYear();
      const month = targetMonthDate.getMonth();
      
      const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
      const days: Date[] = [];
      for (let i = 1; i <= totalDaysInMonth; i++) {
        days.push(new Date(year, month, i, 0, 0, 0, 0));
      }
      return days;
    }

    if (reportDateMode === "custom" && customStart && customEnd) {
      const start = new Date(customStart + "T00:00:00");
      const end = new Date(customEnd + "T23:59:59");
      const days: Date[] = [];
      
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
        const cur = new Date(start);
        let count = 0;
        while (cur <= end && count < 60) {
          days.push(new Date(cur));
          cur.setDate(cur.getDate() + 1);
          count++;
        }
        if (days.length > 0) return days;
      }
    }

    // Default: "semana"
    const monday = getMondayDate(weekOffset);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const cur = new Date(monday);
      cur.setDate(monday.getDate() + i);
      days.push(cur);
    }
    return days;
  }, [reportDateMode, weekOffset, monthOffset, dayOffset, customStart, customEnd]);

  // Raw logs loaded from the DB directly to bypass any truncated parent filters
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Supervisor Shift Scheduling State
  const [shifts, setShifts] = useState<ScheduledShift[]>([]);
  const [newShiftOp, setNewShiftOp] = useState("");
  const [newShiftDate, setNewShiftDate] = useState("");
  const [newShiftStart, setNewShiftStart] = useState("08:00");
  const [newShiftEnd, setNewShiftEnd] = useState("16:00");
  const [newShiftLoc, setNewShiftLoc] = useState("");

  const locations = [
    "Oficinas Centrales",
    "Sucursal Norte",
    "Depósito Sur",
    "Sede Este",
    "Planta Industrial"
  ];

  // Load raw logs from Supabase
  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const { data, error } = await supabase
        .from("logs")
        .select("*")
        .order("inicio", { ascending: false });
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error("Error loading logs in Timesheet:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  // Initialize custom dates if empty
  useEffect(() => {
    if (!customStart || !customEnd) {
      const now = new Date();
      const past = new Date();
      past.setDate(now.getDate() - 7);
      
      const formatStr = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const dateVal = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${dateVal}`;
      };
      
      setCustomStart(formatStr(past));
      setCustomEnd(formatStr(now));
    }
  }, []);

  // Initialize Scheduled Shifts with rich, realistic mock schedules relative to current date if none exists
  useEffect(() => {
    const stored = localStorage.getItem("limpieza_turnos_scheduled");
    if (stored) {
      try {
        setShifts(JSON.parse(stored));
      } catch (err) {
        console.error("Error parsing stored shifts:", err);
      }
    } else if (operarios.length > 0) {
      const names = operarios.map((o: any) => o.nombre);
      const initialShifts: ScheduledShift[] = [];
      const now = new Date();

      // Generate schedules for the last 6 days + today + tomorrow
      for (let i = 0; i < 8; i++) {
        const d = new Date();
        d.setDate(now.getDate() - (i - 1)); // Includes yesterday, last week, today and tomorrow
        const dateStr = d.toISOString().split("T")[0];

        if (i === 1) { // Today
          initialShifts.push(
            { id: `s-today-1`, operarioNombre: names[0] || "CLAUDIA", fecha: dateStr, inicioEstimado: "08:00", finEstimado: "16:00", ubicacion: "Oficinas Centrales" },
            { id: `s-today-2`, operarioNombre: names[2] || "FLORENCIA", fecha: dateStr, inicioEstimado: "08:30", finEstimado: "16:30", ubicacion: "Sucursal Norte" },
            { id: `s-today-3`, operarioNombre: names[4] || "JOSE", fecha: dateStr, inicioEstimado: "10:00", finEstimado: "18:00", ubicacion: "Depósito Sur" }
          );
        } else if (i === 2) { // Yesterday
          initialShifts.push(
            { id: `s-yest-1`, operarioNombre: names[0] || "CLAUDIA", fecha: dateStr, inicioEstimado: "08:00", finEstimado: "16:00", ubicacion: "Oficinas Centrales" },
            { id: `s-yest-2`, operarioNombre: names[1] || "ANGIE", fecha: dateStr, inicioEstimado: "09:00", finEstimado: "17:00", ubicacion: "Depósito Sur" },
            { id: `s-yest-3`, operarioNombre: names[3] || "MARIO", fecha: dateStr, inicioEstimado: "08:00", finEstimado: "16:00", ubicacion: "Sucursal Norte" }
          );
        } else if (i === 3) { // 2 days ago
          initialShifts.push(
            { id: `s-2d-1`, operarioNombre: names[1] || "ANGIE", fecha: dateStr, inicioEstimado: "09:00", finEstimado: "17:00", ubicacion: "Depósito Sur" },
            { id: `s-2d-2`, operarioNombre: names[4] || "JOSE", fecha: dateStr, inicioEstimado: "09:00", finEstimado: "17:00", ubicacion: "Sede Este" },
            { id: `s-2d-3`, operarioNombre: names[5] || "RAUL", fecha: dateStr, inicioEstimado: "10:00", finEstimado: "18:00", ubicacion: "Oficinas Centrales" }
          );
        } else if (i === 4) { // 3 days ago
          initialShifts.push(
            { id: `s-3d-1`, operarioNombre: names[0] || "CLAUDIA", fecha: dateStr, inicioEstimado: "08:00", finEstimado: "16:00", ubicacion: "Oficinas Centrales" },
            { id: `s-3d-2`, operarioNombre: names[2] || "FLORENCIA", fecha: dateStr, inicioEstimado: "08:00", finEstimado: "16:00", ubicacion: "Sucursal Norte" },
            { id: `s-3d-3`, operarioNombre: names[6] || "NICOLAS", fecha: dateStr, inicioEstimado: "08:00", finEstimado: "16:00", ubicacion: "Depósito Sur" }
          );
        } else if (i === 0) { // Tomorrow (Future planned shift)
          initialShifts.push(
            { id: `s-tom-1`, operarioNombre: names[1] || "ANGIE", fecha: dateStr, inicioEstimado: "09:00", finEstimado: "17:00", ubicacion: "Depósito Sur" },
            { id: `s-tom-2`, operarioNombre: names[3] || "MARIO", fecha: dateStr, inicioEstimado: "08:00", finEstimado: "16:00", ubicacion: "Sucursal Norte" }
          );
        }
      }
      setShifts(initialShifts);
      localStorage.setItem("limpieza_turnos_scheduled", JSON.stringify(initialShifts));
    }
  }, [operarios]);

  // Sync back to parent filters if they changed locally
  useEffect(() => {
    if (setParentDateMode) setParentDateMode(reportDateMode);
  }, [reportDateMode]);

  useEffect(() => {
    if (setParentUserFilter) setParentUserFilter(reportUserFilter);
  }, [reportUserFilter]);

  // Normalize date string function to avoid any timezone shifts
  const normalizeDateStr = (val: any): string => {
    if (!val) return "";
    if (val instanceof Date) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, "0");
      const d = String(val.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    const str = String(val).trim();
    if (str.includes("/")) {
      const parts = str.split("/");
      if (parts.length === 3) {
        let d = parts[0].padStart(2, "0");
        let m = parts[1].padStart(2, "0");
        let y = parts[2];
        if (y.length === 2) y = "20" + y;
        return `${y}-${m}-${d}`;
      }
    }
    if (str.includes("-")) {
      const parts = str.split("T")[0].split("-");
      if (parts.length === 3) {
        return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
      }
    }
    return str;
  };

  // Helper to calculate the date range filters
  const dateRangeBounds = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (reportDateMode === "dia") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, 23, 59, 59, 999);
    } else if (reportDateMode === "semana") {
      const mon = getMondayDate(weekOffset);
      start = new Date(mon);
      start.setHours(0, 0, 0, 0);
      end = new Date(mon);
      end.setDate(mon.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (reportDateMode === "mes") {
      const targetMonthDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
      start = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth(), 1, 0, 0, 0, 0);
      const totalDays = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth() + 1, 0).getDate();
      end = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth(), totalDays, 23, 59, 59, 999);
    } else if (reportDateMode === "custom" && customStart && customEnd) {
      start = new Date(customStart + "T00:00:00");
      end = new Date(customEnd + "T23:59:59");
    } else {
      start.setHours(now.getHours() - 24);
    }
    return { start, end };
  }, [reportDateMode, weekOffset, monthOffset, dayOffset, customStart, customEnd]);

  // Add shift action
  const handleAddShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShiftOp || !newShiftDate || !newShiftLoc) {
      alert("Por favor complete todos los datos del turno.");
      return;
    }

    const newShift: ScheduledShift = {
      id: "shift-" + Date.now(),
      operarioNombre: newShiftOp,
      fecha: newShiftDate,
      inicioEstimado: newShiftStart,
      finEstimado: newShiftEnd,
      ubicacion: newShiftLoc
    };

    const updated = [newShift, ...shifts];
    setShifts(updated);
    localStorage.setItem("limpieza_turnos_scheduled", JSON.stringify(updated));
    setNewShiftLoc("");
    setNewShiftDate("");
    alert("Turno planificado correctamente.");
  };

  // Delete shift action
  const handleDeleteShift = (id: string) => {
    if (!window.confirm("¿Está seguro de eliminar este turno planificado?")) return;
    const updated = shifts.filter((s) => s.id !== id);
    setShifts(updated);
    localStorage.setItem("limpieza_turnos_scheduled", JSON.stringify(updated));
  };

  // Justify/excuse absence action
  const handleToggleJustified = (id: string) => {
    const updated = shifts.map((s) => {
      if (s.id === id) {
        return { ...s, justificado: !s.justificado };
      }
      return s;
    });
    setShifts(updated);
    localStorage.setItem("limpieza_turnos_scheduled", JSON.stringify(updated));
  };

  // Re-assign shift (Relevo)
  const handleAssignRelevo = (id: string) => {
    const name = window.prompt("Ingrese el nombre del operario de reemplazo/relevo:");
    if (!name) return;
    const updated = shifts.map((s) => {
      if (s.id === id) {
        return { ...s, reemplazoNombre: name };
      }
      return s;
    });
    setShifts(updated);
    localStorage.setItem("limpieza_turnos_scheduled", JSON.stringify(updated));
    alert(`Relevo asignado a ${name}`);
  };

  // CORE business logic calculation: Correlate Scheduled Shifts with Actual Logs
  const matchedAnalyses = useMemo(() => {
    return shifts.map((shift) => {
      const shiftDateStr = shift.fecha; // "YYYY-MM-DD"
      const shiftOpNorm = shift.operarioNombre?.toLowerCase();

      // Find all raw logs of this worker on this specific date
      const shiftLogs = logs.filter((log) => {
        const logOpNorm = log.operario_nombre?.toLowerCase();
        if (logOpNorm !== shiftOpNorm) return false;
        
        const logDateStr = normalizeDateStr(log.inicio);
        return logDateStr === shiftDateStr;
      });

      // Filter and figure out actual Clock In and Clock Out
      let actualCheckIn: string | null = null;
      let actualCheckOut: string | null = null;
      let totalWorkedMin = 0;
      let totalBreakMin = 0;

      // Iterate chronologically
      const chronoLogs = [...shiftLogs].sort((a: any, b: any) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());

      chronoLogs.forEach((l) => {
        const actionStr = l.accion || "";

        // Collect total times
        if (actionStr.includes("Descanso")) {
          totalBreakMin += (l.duracion_minutos || l.duracion || 0);
        } else {
          totalWorkedMin += (l.duracion_minutos || l.duracion || 0);
        }

        // Identify check in (earliest session, workday, task or shift start)
        if (!actualCheckIn) {
          actualCheckIn = l.inicio;
        }

        // Identify check out (latest end time recorded)
        if (l.fin) {
          if (!actualCheckOut || new Date(l.fin).getTime() > new Date(actualCheckOut).getTime()) {
            actualCheckOut = l.fin;
          }
        }
      });

      // Determine shift status
      let estado: "Presente" | "Tarde" | "Ausente" | "Programado" = "Programado";
      let delayMinutes = 0;

      const shiftLaunchTime = new Date(`${shift.fecha}T${shift.inicioEstimado}:00`);
      const now = new Date();

      if (chronoLogs.length > 0) {
        // Operator did connect
        if (actualCheckIn) {
          const checkInDate = new Date(actualCheckIn);
          // Calculate difference in minutes from planned start
          const diffMs = checkInDate.getTime() - shiftLaunchTime.getTime();
          delayMinutes = Math.round(diffMs / 60000);

          if (delayMinutes > 15) {
            estado = "Tarde";
          } else {
            estado = "Presente";
          }
        } else {
          estado = "Presente";
        }
      } else {
        // No logs found. Is it in the past or currently active?
        const isPastOrActive = now.getTime() >= shiftLaunchTime.getTime();
        if (isPastOrActive) {
          estado = "Ausente";
        } else {
          estado = "Programado";
        }
      }

      // Calculate planned hours
      const [shStartH, shStartM] = shift.inicioEstimado.split(":").map(Number);
      const [shEndH, shEndM] = shift.finEstimado.split(":").map(Number);
      const plannedMin = (shEndH * 60 + shEndM) - (shStartH * 60 + shStartM);

      return {
        ...shift,
        estado,
        actualCheckIn,
        actualCheckOut,
        totalWorkedMin,
        totalBreakMin,
        plannedMin: plannedMin > 0 ? plannedMin : 480, // Default 8 hours
        delayMinutes: delayMinutes > 0 ? delayMinutes : 0,
        logs: chronoLogs
      };
    });
  }, [shifts, logs]);

  // Aggregate stats from the calculations, within selected date bounds
  const analyticsData = useMemo(() => {
    const bounds = dateRangeBounds;
    
    // Filter matched shifts that fall inside the date boundaries
    const filteredShifts = matchedAnalyses.filter((m) => {
      const d = new Date(m.fecha + "T12:00:00"); // Noon to avoid shift
      return d.getTime() >= bounds.start.getTime() && d.getTime() <= bounds.end.getTime();
    });

    const userMap: Record<string, any> = {};

    operarios.forEach((op: any) => {
      userMap[op.nombre] = {
        name: op.nombre,
        rol: op.rol || "operario",
        totalScheduled: 0,
        totalPresent: 0,
        totalLate: 0,
        totalAbsent: 0,
        totalWorkedMin: 0,
        totalBreakMin: 0,
        totalPlannedMin: 0,
        delays: [],
        shiftRecords: []
      };
    });

    filteredShifts.forEach((s) => {
      const name = s.operarioNombre;
      if (!userMap[name]) {
        userMap[name] = {
          name,
          rol: "operario",
          totalScheduled: 0,
          totalPresent: 0,
          totalLate: 0,
          totalAbsent: 0,
          totalWorkedMin: 0,
          totalBreakMin: 0,
          totalPlannedMin: 0,
          delays: [],
          shiftRecords: []
        };
      }

      userMap[name].totalScheduled += 1;
      userMap[name].totalWorkedMin += s.totalWorkedMin;
      userMap[name].totalBreakMin += s.totalBreakMin;
      userMap[name].totalPlannedMin += s.plannedMin;
      userMap[name].shiftRecords.push(s);

      if (s.estado === "Presente") userMap[name].totalPresent += 1;
      else if (s.estado === "Tarde") {
        userMap[name].totalLate += 1;
        userMap[name].delays.push(s.delayMinutes);
      } else if (s.estado === "Ausente") {
        userMap[name].totalAbsent += 1;
      }
    });

    return {
      individual: Object.values(userMap),
      shiftsList: filteredShifts,
      summary: {
        totalScheduled: filteredShifts.length,
        totalPresent: filteredShifts.filter((s) => s.estado === "Presente").length,
        totalLate: filteredShifts.filter((s) => s.estado === "Tarde").length,
        totalAbsent: filteredShifts.filter((s) => s.estado === "Ausente").length,
        totalJustified: filteredShifts.filter((s) => s.estado === "Ausente" && s.justificado).length,
        totalWorkedHours: Math.round(filteredShifts.reduce((acc, s) => acc + s.totalWorkedMin, 0) / 60)
      }
    };
  }, [matchedAnalyses, operarios, dateRangeBounds]);

  // Apply visual active status class helper
  const cn = (...classes: any[]) => classes.filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Upper stats widgets / KPI section */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
            <Clock3 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Turnos Planificados</span>
            <span className="text-2xl font-black text-slate-800">{analyticsData.summary.totalScheduled}</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0">
            <UserCheck2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Asistencias ok</span>
            <span className="text-2xl font-black text-slate-800">{analyticsData.summary.totalPresent}</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Ingresos tarde</span>
            <span className="text-2xl font-black text-slate-800">{analyticsData.summary.totalLate}</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 shrink-0">
            <UserX className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Ausencias detectadas</span>
            <span className="text-2xl font-black text-rose-600">{analyticsData.summary.totalAbsent}</span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden p-6 w-full flex flex-col gap-6">
        
        {/* Module Header & Local Filters */}
        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 border-b border-slate-100 pb-5 w-full">
          <div>
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <CalendarRange className="w-5 h-5 text-blue-600 animate-pulse" />
              Gestión Integral de Horas y Ausencias
            </h3>
            <p className="text-slate-500 text-xs mt-1">
              Hojas de asistencia correlacionadas con turnos planificados. Alertas automáticas de ausencias y llegadas tarde.
            </p>
          </div>

          <button 
            onClick={loadLogs} 
            disabled={logsLoading}
            className="flex items-center gap-2 self-start py-2 px-3 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-slate-600 font-bold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer shadow-sm"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 text-slate-400", logsLoading && "animate-spin")} />
            Sincronizar
          </button>
        </div>

        {/* Filters Controls Bar */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col md:flex-row flex-wrap gap-4 items-end justify-between w-full">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Filtro de Tiempo</label>
            <div className="flex bg-slate-200/60 p-1 rounded-xl">
              {["dia", "semana", "mes", "custom"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setReportDateMode(mode as any)}
                  className={cn(
                    "flex-1 py-1 px-1.5 text-[10px] font-black rounded-lg uppercase tracking-wide transition-all",
                    reportDateMode === mode
                      ? "bg-white text-blue-600 shadow-sm font-black"
                      : "text-slate-500 hover:text-slate-700 font-bold"
                  )}
                >
                  {mode === "dia" ? "Hoy" : mode === "semana" ? "Semana" : mode === "mes" ? "Mes" : "Rango"}
                </button>
              ))}
            </div>
          </div>

          {reportDateMode === "custom" && (
            <div className="flex gap-2 items-center">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Desde</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none h-9 shadow-sm"
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Hasta</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none h-9 shadow-sm"
                />
              </div>
            </div>
          )}

          <div className="w-full md:w-48 shrink-0">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Filtrar por Operario</label>
            <select
              value={reportUserFilter}
              onChange={(e) => setReportUserFilter(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2 outline-none h-9 shadow-sm cursor-pointer"
            >
              <option value="Todos">Todos los Operarios</option>
              {activeOperarios.map((o: any) => (
                <option key={o.id} value={o.nombre}>{o.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Local Tab Selection Buttons */}
        <div className="flex border-b border-slate-100 gap-1 w-full overflow-x-auto">
          <button
            onClick={() => { setActiveTab("calendar"); setSelectedOperario(null); }}
            className={cn(
              "px-5 py-3.5 font-bold text-xs tracking-wide transition-all border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer",
              activeTab === "calendar"
                ? "border-emerald-600 text-emerald-600 font-black"
                : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            📅 Hoja de Horas (Calendario)
          </button>

          <button
            onClick={() => { setActiveTab("timesheet"); setSelectedOperario(null); }}
            className={cn(
              "px-5 py-3.5 font-bold text-xs tracking-wide transition-all border-b-2 whitespace-nowrap cursor-pointer",
              activeTab === "timesheet"
                ? "border-blue-600 text-blue-600 font-black"
                : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            📊 Matriz de Horarios
          </button>
          
          <button
            onClick={() => { setActiveTab("absences"); setSelectedOperario(null); }}
            className={cn(
              "px-5 py-3.5 font-bold text-xs tracking-wide transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer",
              activeTab === "absences"
                ? "border-rose-600 text-rose-600 font-black"
                : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            🚨 Alertas de Ausencias
            {analyticsData.summary.totalAbsent > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-black rounded-lg px-1.5 py-0.5 shrink-0 block">
                {analyticsData.summary.totalAbsent}
              </span>
            )}
          </button>

          <button
            onClick={() => { setActiveTab("scheduler"); setSelectedOperario(null); }}
            className={cn(
              "px-5 py-3.5 font-bold text-xs tracking-wide transition-all border-b-2 whitespace-nowrap cursor-pointer",
              activeTab === "scheduler"
                ? "border-indigo-600 text-indigo-600 font-black"
                : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            🗓️ Planificar Turnos
          </button>
        </div>

        {/* TAB 0: HOJA DE HORAS - CALENDARIO */}
        {activeTab === "calendar" && (
          <div className="flex flex-col gap-5 w-full">
            {/* Header Navigation Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 border border-slate-200 p-4 rounded-2xl">
              {reportDateMode === "dia" && (
                <>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDayOffset(dayOffset - 1)}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      &larr; Día Anterior
                    </button>
                    <button
                      onClick={() => setDayOffset(0)}
                      className={cn(
                        "px-3 py-2 border rounded-xl font-bold text-xs transition-all cursor-pointer shadow-2xs",
                        dayOffset === 0
                          ? "bg-blue-600 text-white border-blue-600 font-extrabold"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      Hoy
                    </button>
                    <button
                      onClick={() => setDayOffset(dayOffset + 1)}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      Día Siguiente &rarr;
                    </button>
                  </div>
                  <div className="text-center sm:text-right">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">
                      Vista Diaria
                    </span>
                    <span className="text-xs font-extrabold text-slate-800">
                      {displayDays[0]?.getDate()}/{displayDays[0]?.getMonth() + 1}/{displayDays[0]?.getFullYear()}
                    </span>
                  </div>
                </>
              )}

              {reportDateMode === "semana" && (
                <>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setWeekOffset(weekOffset - 1)}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      &larr; Semana Anterior
                    </button>
                    <button
                      onClick={() => setWeekOffset(0)}
                      className={cn(
                        "px-3 py-2 border rounded-xl font-bold text-xs transition-all cursor-pointer shadow-2xs",
                        weekOffset === 0
                          ? "bg-blue-600 text-white border-blue-600 font-extrabold"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      Semana Actual
                    </button>
                    <button
                      onClick={() => setWeekOffset(weekOffset + 1)}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      Semana Siguiente &rarr;
                    </button>
                  </div>
                  <div className="text-center sm:text-right">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">
                      Período Semanal
                    </span>
                    <span className="text-xs font-extrabold text-slate-800">
                      Del {displayDays[0]?.getDate()}/{displayDays[0]?.getMonth() + 1}/{displayDays[0]?.getFullYear()} al {displayDays[displayDays.length - 1]?.getDate()}/{displayDays[displayDays.length - 1]?.getMonth() + 1}/{displayDays[displayDays.length - 1]?.getFullYear()}
                    </span>
                  </div>
                </>
              )}

              {reportDateMode === "mes" && (
                <>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMonthOffset(monthOffset - 1)}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      &larr; Mes Anterior
                    </button>
                    <button
                      onClick={() => setMonthOffset(0)}
                      className={cn(
                        "px-3 py-2 border rounded-xl font-bold text-xs transition-all cursor-pointer shadow-2xs",
                        monthOffset === 0
                          ? "bg-blue-600 text-white border-blue-600 font-extrabold"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      Mes Actual
                    </button>
                    <button
                      onClick={() => setMonthOffset(monthOffset + 1)}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      Mes Siguiente &rarr;
                    </button>
                  </div>
                  <div className="text-center sm:text-right">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">
                      Período Mensual ({displayDays.length} días)
                    </span>
                    <span className="text-xs font-extrabold text-slate-800 capitalize">
                      {displayDays[0]?.toLocaleString("es-AR", { month: "long", year: "numeric" })}
                    </span>
                  </div>
                </>
              )}

              {reportDateMode === "custom" && (
                <div className="flex justify-between items-center w-full">
                  <span className="text-xs font-bold text-slate-500">
                    Rango Personalizado ({displayDays.length} días)
                  </span>
                  <span className="text-xs font-extrabold text-slate-800">
                    Del {displayDays[0]?.getDate()}/{displayDays[0]?.getMonth() + 1}/{displayDays[0]?.getFullYear()} al {displayDays[displayDays.length - 1]?.getDate()}/{displayDays[displayDays.length - 1]?.getMonth() + 1}/{displayDays[displayDays.length - 1]?.getFullYear()}
                  </span>
                </div>
              )}
            </div>

            {/* Color Legend Bar */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 shadow-2xs">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Identificadores:</span>
              <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-200/60">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Presente / Jornada Completa (Verde)</span>
              </div>
              <div className="flex items-center gap-1.5 bg-amber-50 text-amber-800 px-2.5 py-1 rounded-lg border border-amber-200/60">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Incompleto (Amarillo)</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500 animate-pulse" />
                <span>En curso (Gris)</span>
              </div>
              <div className="flex items-center gap-1.5 bg-rose-50 text-rose-800 px-2.5 py-1 rounded-lg border border-rose-200/60">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span>Ausente (Rojo)</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-50 text-slate-500 px-2.5 py-1 rounded-lg border border-slate-200/60">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span>Sin Turno / Futuro</span>
              </div>
            </div>

            {/* Grid Table */}
            <div className="overflow-x-auto w-full border border-slate-200 rounded-2xl bg-white shadow-sm">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-wider">
                    <th className="p-3.5 w-44 min-w-[160px] sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                      Operario
                    </th>
                    {displayDays.map((d, i) => {
                      const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
                      const dayName = dayNames[d.getDay()];
                      const dateNum = d.getDate();
                      const monthNum = d.getMonth() + 1;
                      const isToday = d.toDateString() === new Date().toDateString();

                      return (
                        <th
                          key={i}
                          className={cn(
                            "p-3 text-center border-r border-slate-200 min-w-[110px]",
                            isToday ? "bg-blue-50/80 text-blue-700" : ""
                          )}
                        >
                          <span className="block text-[11px] font-black">{dayName}</span>
                          <span className="block text-[10px] font-bold text-slate-400 mt-0.5">
                            {String(dateNum).padStart(2, "0")}/{String(monthNum).padStart(2, "0")}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {activeOperarios
                    .filter((op: any) => reportUserFilter === "Todos" || op.nombre === reportUserFilter)
                    .map((op: any) => {
                      const assignedSchedule = `${op.horario_entrada || "08:00"} - ${op.horario_salida || "17:00"}`;

                      return (
                        <tr key={op.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 font-extrabold text-slate-800 sticky left-0 bg-white border-r border-slate-200 z-10 shadow-2xs">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-black flex items-center justify-center text-xs shrink-0">
                                {op.nombre?.charAt(0)}
                              </div>
                              <div>
                                <span className="block text-xs font-black text-slate-800 leading-tight">
                                  {op.nombre}
                                </span>
                                <span className="block text-[9px] font-bold text-slate-400 mt-0.5">
                                  {assignedSchedule}
                                </span>
                              </div>
                            </div>
                          </td>

                          {displayDays.map((d, i) => {
                            const dateStr = normalizeDateStr(d);
                            const todayStr = normalizeDateStr(new Date());
                            const isFuture = d.getTime() > new Date().setHours(23, 59, 59, 999);
                            const isToday = d.toDateString() === new Date().toDateString();
                            const isPastDay = dateStr < todayStr;

                            // Find logs for this op on this date
                            const dayLogs = logs.filter((l) => {
                              const normOpName = l.operario_nombre?.toLowerCase();
                              return normOpName === op.nombre?.toLowerCase() && normalizeDateStr(l.inicio) === dateStr;
                            });

                            // Find if there's a scheduled shift in localStorage
                            const hasScheduledShift = shifts.some(
                              (s) => s.operarioNombre?.toLowerCase() === op.nombre?.toLowerCase() && s.fecha === dateStr
                            );

                            let checkInStr = "-";
                            let checkOutStr = "-";
                            let isOngoing = false;
                            let totalWorkedMin = 0;

                            if (dayLogs.length > 0) {
                              const sorted = [...dayLogs].sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());
                              const first = sorted[0];
                              const last = sorted[sorted.length - 1];

                              checkInStr = formatArgTime(first.inicio);

                              if (last.fin) {
                                checkOutStr = formatArgTime(last.fin);
                              } else {
                                if (isPastDay) {
                                  // Past day with open log -> Option 2 automatic closure / incomplete
                                  checkOutStr = "Sin Cierre";
                                  isOngoing = false;
                                } else {
                                  checkOutStr = "En curso";
                                  isOngoing = true;
                                }
                              }

                              totalWorkedMin = sorted.reduce((acc, l) => acc + (l.duracion_minutos || l.duracion || 0), 0);
                            }

                            // Determine status per user requirements:
                            // "Incompleto" -> Yellow
                            // "En curso" -> Gray
                            // "Presente / Completo" -> Green
                            // "Ausente" -> Red
                            let status: "verde" | "amarillo" | "gris_encurso" | "rojo" | "gris" = "gris";

                            if (dayLogs.length > 0) {
                              if (isOngoing) {
                                status = "gris_encurso";
                              } else if (totalWorkedMin < 240 || (isPastDay && checkOutStr === "Sin Cierre")) {
                                status = "amarillo"; // Incompleto
                              } else {
                                status = "verde";
                              }
                            } else {
                              if (!isFuture && ((d.getDay() >= 1 && d.getDay() <= 5) || hasScheduledShift)) {
                                status = "rojo";
                              } else {
                                status = "gris";
                              }
                            }

                            return (
                              <td
                                key={i}
                                className={cn(
                                  "p-2 border-r border-slate-200 text-center align-middle",
                                  isToday ? "bg-blue-50/20" : ""
                                )}
                              >
                                {status === "verde" && (
                                  <button
                                    onClick={() => setSelectedCellDetail({ op, dateStr, dayLogs, status: "Presente (Completo)", checkInStr, checkOutStr, totalWorkedMin, assignedSchedule })}
                                    className="w-full bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-800 border border-emerald-200/80 rounded-xl p-2 transition-all cursor-pointer shadow-2xs flex flex-col items-center gap-1"
                                  >
                                    <div className="flex items-center gap-1 text-[10px] font-black uppercase">
                                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                      <span>Presente</span>
                                    </div>
                                    <span className="text-[10px] font-extrabold text-emerald-950 block">
                                      {checkInStr} - {checkOutStr}
                                    </span>
                                    <span className="text-[9px] font-bold text-emerald-700 block">
                                      {Math.floor(totalWorkedMin / 60)}h {totalWorkedMin % 60}m
                                    </span>
                                  </button>
                                )}

                                {status === "amarillo" && (
                                  <button
                                    onClick={() => setSelectedCellDetail({ op, dateStr, dayLogs, status: "Incompleto", checkInStr, checkOutStr, totalWorkedMin, assignedSchedule })}
                                    className="w-full bg-amber-50/90 hover:bg-amber-100/90 text-amber-800 border border-amber-200/80 rounded-xl p-2 transition-all cursor-pointer shadow-2xs flex flex-col items-center gap-1"
                                  >
                                    <div className="flex items-center gap-1 text-[10px] font-black uppercase">
                                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                      <span>Incompleto</span>
                                    </div>
                                    <span className="text-[10px] font-extrabold text-amber-950 block">
                                      {checkInStr} - {checkOutStr}
                                    </span>
                                    <span className="text-[9px] font-bold text-amber-700 block">
                                      {Math.floor(totalWorkedMin / 60)}h {totalWorkedMin % 60}m
                                    </span>
                                  </button>
                                )}

                                {status === "gris_encurso" && (
                                  <button
                                    onClick={() => setSelectedCellDetail({ op, dateStr, dayLogs, status: "En curso", checkInStr, checkOutStr, totalWorkedMin, assignedSchedule })}
                                    className="w-full bg-slate-100/90 hover:bg-slate-200/80 text-slate-700 border border-slate-300/80 rounded-xl p-2 transition-all cursor-pointer shadow-2xs flex flex-col items-center gap-1"
                                  >
                                    <div className="flex items-center gap-1 text-[10px] font-black uppercase">
                                      <span className="w-2 h-2 rounded-full bg-slate-500 animate-pulse shrink-0" />
                                      <span>En curso</span>
                                    </div>
                                    <span className="text-[10px] font-extrabold text-slate-800 block">
                                      {checkInStr} - {checkOutStr}
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-600 block">
                                      {Math.floor(totalWorkedMin / 60)}h {totalWorkedMin % 60}m
                                    </span>
                                  </button>
                                )}

                                {status === "rojo" && (
                                  <button
                                    onClick={() => setSelectedCellDetail({ op, dateStr, dayLogs, status: "Ausente", checkInStr: "-", checkOutStr: "-", totalWorkedMin: 0, assignedSchedule })}
                                    className="w-full bg-rose-50/90 hover:bg-rose-100/90 text-rose-800 border border-rose-200/80 rounded-xl p-2 transition-all cursor-pointer shadow-2xs flex flex-col items-center gap-1"
                                  >
                                    <div className="flex items-center gap-1 text-[10px] font-black uppercase">
                                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                                      <span>Ausente</span>
                                    </div>
                                    <span className="text-[9px] font-bold text-rose-700 block">
                                      Sin Fichada
                                    </span>
                                  </button>
                                )}

                                {status === "gris" && (
                                  <div className="w-full bg-slate-50 text-slate-400 border border-slate-100 rounded-xl p-2 text-center">
                                    <span className="text-[10px] font-medium text-slate-300 block">
                                      -
                                    </span>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Cell Detail Modal */}
            {selectedCellDetail && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 flex flex-col gap-4">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">
                        Detalle de Actividad Diaria
                      </span>
                      <h3 className="text-lg font-black text-slate-800">
                        {selectedCellDetail.op.nombre}
                      </h3>
                      <span className="text-xs font-bold text-slate-500">
                        Fecha: {selectedCellDetail.dateStr.split("-").reverse().join("/")}
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedCellDetail(null)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-lg text-lg font-bold"
                    >
                      &times;
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                        Horario Asignado
                      </span>
                      <span className="font-extrabold text-slate-700">
                        {selectedCellDetail.assignedSchedule}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                        Estado
                      </span>
                      <span className={cn(
                        "font-black text-xs uppercase px-2 py-0.5 rounded-md inline-block mt-0.5",
                        selectedCellDetail.status.includes("Presente") ? "bg-emerald-100 text-emerald-800" :
                        selectedCellDetail.status === "Ausente" ? "bg-rose-100 text-rose-800" :
                        "bg-amber-100 text-amber-800"
                      )}>
                        {selectedCellDetail.status}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                        Ingreso Registrado
                      </span>
                      <span className="font-black text-blue-600 text-sm">
                        {selectedCellDetail.checkInStr}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                        Egreso Registrado
                      </span>
                      <span className="font-black text-blue-600 text-sm">
                        {selectedCellDetail.checkOutStr}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                      Fichadas / Tareas Realizadas
                    </span>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {selectedCellDetail.dayLogs.map((l: any, idx: number) => (
                        <div key={idx} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs flex justify-between items-center">
                          <div>
                            <span className="font-extrabold text-slate-700 block">
                              {l.accion || "Turno Activo"}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {formatArgTime(l.inicio)} {l.fin ? `- ${formatArgTime(l.fin)}` : "(En curso)"}
                            </span>
                          </div>
                          {l.duracion_minutos && (
                            <span className="font-black text-slate-600 bg-white px-2 py-1 rounded-lg border border-slate-200 text-[10px]">
                              {l.duracion_minutos} min
                            </span>
                          )}
                        </div>
                      ))}
                      {selectedCellDetail.dayLogs.length === 0 && (
                        <div className="p-4 text-center text-slate-400 text-xs font-bold bg-slate-50 rounded-xl">
                          Sin fiches registrados para este operario en esta fecha.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-slate-100">
                    <button
                      onClick={() => setSelectedCellDetail(null)}
                      className="px-5 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 1: TIMESHEET AND HOURS MATRIX */}
        {activeTab === "timesheet" && (
          <div className="flex flex-col gap-6 w-full">
            <div className="overflow-x-auto w-full border border-slate-250 rounded-2xl bg-slate-50/50">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-5 py-4">Operario</th>
                    <th className="px-5 py-4 text-center">Turnos Planificados</th>
                    <th className="px-5 py-4 text-center">Presente (a tiempo)</th>
                    <th className="px-5 py-4 text-center">Ingreso Tarde</th>
                    <th className="px-5 py-4 text-center">Ausencias</th>
                    <th className="px-5 py-4 text-center">Horas Planificadas</th>
                    <th className="px-5 py-4 text-center">Horas Registradas</th>
                    <th className="px-5 py-4 text-center">Balance Horario</th>
                    <th className="px-5 py-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {analyticsData.individual
                    .filter((u) => reportUserFilter === "Todos" || u.name === reportUserFilter)
                    .map((userStats, i) => {
                      const balanceMin = userStats.totalWorkedMin - userStats.totalPlannedMin;
                      const balanceHours = Math.floor(Math.abs(balanceMin) / 60);
                      const balanceMinutes = Math.round(Math.abs(balanceMin) % 60);
                      const isNegative = balanceMin < 0;

                      return (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-black flex items-center justify-center text-xs shrink-0 select-none">
                                {userStats.name?.charAt(0)}
                              </div>
                              <span className="font-extrabold text-slate-800">{userStats.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-center font-bold text-slate-700">
                            {userStats.totalScheduled}
                          </td>
                          <td className="px-5 py-3.5 text-center font-bold">
                            <span className={cn(userStats.totalPresent > 0 ? "text-emerald-600" : "text-slate-400")}>
                              {userStats.totalPresent}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center font-bold">
                            <span className={cn(userStats.totalLate > 0 ? "text-amber-500" : "text-slate-400")}>
                              {userStats.totalLate}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center font-bold">
                            <span className={cn(userStats.totalAbsent > 0 ? "text-rose-600 text-xs px-2 py-0.5 rounded-lg bg-rose-50" : "text-slate-400")}>
                              {userStats.totalAbsent}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center font-bold text-slate-500">
                            {Math.round(userStats.totalPlannedMin / 60)}h
                          </td>
                          <td className="px-5 py-3.5 text-center font-bold">
                            <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                              {Math.floor(userStats.totalWorkedMin / 60)}h {Math.round(userStats.totalWorkedMin % 60)}m
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center font-bold">
                            {userStats.totalScheduled === 0 ? (
                              <span className="text-slate-400">-</span>
                            ) : isNegative ? (
                              <span className="text-rose-600 text-[11px] font-extrabold bg-rose-50 px-2 py-1 rounded border border-rose-100">
                                -{balanceHours}h {balanceMinutes}m
                              </span>
                            ) : (
                              <span className="text-emerald-600 text-[11px] font-extrabold bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                                +{balanceHours}h {balanceMinutes}m
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <button
                              onClick={() => setSelectedOperario(selectedOperario === userStats.name ? null : userStats.name)}
                              className="text-[10px] font-black uppercase text-blue-600 tracking-wider bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl border border-blue-100 transition-all cursor-pointer"
                            >
                              {selectedOperario === userStats.name ? "Cerrar Detalles" : "Ver Detalle Diario"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* EXPANDED PANEL: Detailed Daily Shifts breakdown for selected operator */}
            {selectedOperario && (
              <div className="border border-slate-200 rounded-[20px] p-5 w-full bg-slate-50/50 flex flex-col gap-4 animate-fadeIn">
                <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                  <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-blue-500" />
                    Turnos y Cumplimiento Diario de {selectedOperario}
                  </h4>
                  <button 
                    onClick={() => setSelectedOperario(null)}
                    className="text-slate-400 hover:text-slate-600 font-bold text-xs p-1"
                  >
                    Cerrar panel
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {matchedAnalyses
                    .filter((m) => m.operarioNombre?.toLowerCase() === selectedOperario.toLowerCase())
                    .sort((a,b) => b.fecha.localeCompare(a.fecha))
                    .map((item, index) => (
                      <div key={index} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5 font-extrabold text-slate-800 text-xs">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {item.fecha.split("-").reverse().join("/")}
                          </div>

                          <span className={cn(
                            "text-[10px] uppercase font-black px-2 py-0.5 rounded-full select-none",
                            item.estado === "Presente" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                            item.estado === "Tarde" ? "bg-amber-50 text-amber-600 border border-amber-100 animate-pulse" :
                            item.estado === "Ausente" ? "bg-rose-50 text-rose-600 border border-rose-100" :
                            "bg-slate-100 text-slate-550"
                          )}>
                            {item.estado === "Tarde" ? "Llegó Tarde" : item.estado}
                          </span>
                        </div>

                        <div className="text-[11px] space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Lugar:</span>
                            <span className="font-bold text-slate-700">{item.ubicacion}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Turno Planificado:</span>
                            <span className="font-extrabold text-slate-700">{item.inicioEstimado} - {item.finEstimado}</span>
                          </div>
                          <div className="flex justify-between border-t border-slate-200/60 pt-1 mt-1">
                            <span className="text-slate-400 font-medium">Fichada Ingreso:</span>
                            <span className="font-extrabold text-blue-600">
                              {item.actualCheckIn ? formatArgTime(item.actualCheckIn) : "No registrado"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Fichada Egreso:</span>
                            <span className="font-extrabold text-blue-600">
                              {item.actualCheckOut ? formatArgTime(item.actualCheckOut) : "No registrado"}
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-100 mt-auto">
                          <div>
                            <span className="text-[10px] font-black text-slate-400 block uppercase">Tiempo Trabajo</span>
                            <span className="font-black text-slate-850">
                              {Math.floor(item.totalWorkedMin / 60)}h {Math.round(item.totalWorkedMin % 60)}m
                            </span>
                          </div>

                          {item.estado === "Tarde" && (
                            <div className="text-right">
                              <span className="text-[10px] font-black text-amber-500 block uppercase">Demora</span>
                              <span className="font-black text-amber-600">
                                +{item.delayMinutes} min
                              </span>
                            </div>
                          )}

                          {item.estado === "Ausente" && (
                            <div className="text-right">
                              <span className="text-[10px] font-black text-rose-500 block uppercase select-none">Falta</span>
                              <span className="font-black text-rose-600">
                                No Conectó
                              </span>
                            </div>
                          )}
                        </div>

                        {item.estado === "Ausente" && (
                          <div className="flex gap-2 border-t border-slate-100 pt-3.5 mt-2">
                            <button
                              onClick={() => handleToggleJustified(item.id)}
                              className={cn(
                                "flex-1 py-1 px-1.5 rounded-lg border text-[9px] font-extrabold uppercase transition-all shadow-sm",
                                item.justificado
                                  ? "bg-emerald-50 text-emerald-600 border-emerald-250 hover:bg-emerald-100"
                                  : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                              )}
                            >
                              {item.justificado ? "✅ Justificado" : "Justificar Falta"}
                            </button>
                            <button
                              onClick={() => handleAssignRelevo(item.id)}
                              className="flex-1 py-1 px-1.5 rounded-lg bg-slate-900 border border-slate-900 text-white text-[9px] font-extrabold uppercase hover:bg-slate-800 transition-all shadow-sm"
                            >
                              Asignar Relevo
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                  {matchedAnalyses.filter((m) => m.operarioNombre?.toLowerCase() === selectedOperario.toLowerCase()).length === 0 && (
                    <div className="col-span-full p-8 text-center text-slate-500 font-medium">
                      Sin turnos planificados para {selectedOperario} en este periodo.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DETAILED ABSENCES CHECK AND WARNING LIST */}
        {activeTab === "absences" && (
          <div className="flex flex-col gap-4 w-full">
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex gap-3 text-rose-700">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500 animate-bounce" />
              <div className="text-xs font-semibold leading-relaxed">
                <span className="font-extrabold block mb-0.5 text-rose-800">Alertas de Ausentismo y Tardanzas Activas</span>
                Este panel muestra únicamente los turnos planificados cuya hora de inicio de jornada ya ha pasado pero no poseen registros de entrada, o los que se cargaron con demoras mayores a 15 minutos en el sistema.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
              {analyticsData.shiftsList
                .filter((s) => s.estado === "Ausente" || s.estado === "Tarde")
                .map((shift, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3.5 border-l-4 border-l-rose-500">
                    <div className="flex justify-between items-start gap-1">
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-black text-[10px] shrink-0">
                            {shift.operarioNombre?.charAt(0)}
                          </span>
                          {shift.operarioNombre}
                        </h4>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1 block">
                          Ubicación: <span className="font-black text-slate-700">{shift.ubicacion}</span>
                        </span>
                      </div>

                      <span className={cn(
                        "text-[9px] uppercase font-black px-2 py-0.5 rounded-lg shadow-sm border shrink-0",
                        shift.estado === "Ausente" ? "bg-rose-100 text-rose-700 border-rose-200 animate-pulse" :
                        "bg-amber-100 text-amber-700 border-amber-200"
                      )}>
                        {shift.estado === "Ausente" ? "Ausencia" : `Tarde (+${shift.delayMinutes}m)`}
                      </span>
                    </div>

                    <div className="text-[11px] p-2 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Fecha:</span>
                        <span className="font-bold text-slate-700">
                          {shift.fecha.split("-").reverse().join("/")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Horario Previsto:</span>
                        <span className="font-black text-slate-700">{shift.inicioEstimado} - {shift.finEstimado}</span>
                      </div>
                    </div>

                    {shift.reemplazoNombre && (
                      <div className="text-[10px] px-2.5 py-1.5 bg-blue-50/50 border border-blue-200 rounded-xl flex items-center justify-between font-bold">
                        <span className="text-blue-500 font-black tracking-widest uppercase text-[8px]">REVELO / REEMPLAZO</span>
                        <span className="text-blue-700">{shift.reemplazoNombre}</span>
                      </div>
                    )}

                    {shift.justificado && (
                      <div className="text-[10px] px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between font-bold text-emerald-700">
                        <span>AUSENCIA JUSTIFICADA</span>
                      </div>
                    )}

                    <div className="flex gap-2 mt-auto pt-2 border-t border-slate-100">
                      {shift.estado === "Ausente" && (
                        <>
                          <button
                            onClick={() => handleToggleJustified(shift.id)}
                            className={cn(
                              "flex-1 py-1.5 px-2 rounded-xl border text-[9px] font-black uppercase transition-all shadow-sm font-black",
                              shift.justificado
                                ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            )}
                          >
                            {shift.justificado ? "✅ Justificado" : "Justificar"}
                          </button>
                          
                          <button
                            onClick={() => handleAssignRelevo(shift.id)}
                            className="flex-1 py-1.5 px-2 rounded-xl bg-slate-950 border border-slate-900 text-white text-[9px] font-black uppercase hover:bg-slate-800 transition-all shadow-sm"
                          >
                            Asignar Relevo
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => handleDeleteShift(shift.id)}
                        className="py-1.5 px-2.5 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-100 transition-all flex items-center justify-center shrink-0"
                        title="Borrar Turno"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

              {analyticsData.shiftsList.filter((s) => s.estado === "Ausente" || s.estado === "Tarde").length === 0 && (
                <div className="col-span-full py-12 px-6 text-center text-slate-500 bg-emerald-50 rounded-2xl border border-dashed border-emerald-350 font-semibold flex flex-col items-center justify-center gap-2">
                  <CheckCircle className="w-10 h-10 text-emerald-500" />
                  No se registraron ausencias ni tardanzas en este bloque horario. ¡Perfecta asistencia!
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SCHEDULE PLANNER AND ASSIGNMENT */}
        {activeTab === "scheduler" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
            {/* Form component to add shift */}
            <form onSubmit={handleAddShift} className="bg-slate-50/60 border border-slate-200 rounded-[22px] p-5 flex flex-col gap-4.5 h-fit w-full lg:col-span-1">
              <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1 border-b border-slate-200 pb-2">
                <PlusCircle className="w-4 h-4 text-indigo-500" />
                Cargar Nuevo Turno
              </h4>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Operario</label>
                <select
                  required
                  value={newShiftOp}
                  onChange={(e) => setNewShiftOp(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2.5 outline-none shadow-sm cursor-pointer"
                >
                  <option value="">Seleccione un Operario...</option>
                  {operarios.map((o: any) => (
                    <option key={o.id} value={o.nombre}>{o.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Fecha de Turno</label>
                <input
                  required
                  type="date"
                  value={newShiftDate}
                  onChange={(e) => setNewShiftDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2 outline-none h-[38px] shadow-sm select-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Hora Entrada</label>
                  <input
                    required
                    type="time"
                    value={newShiftStart}
                    onChange={(e) => setNewShiftStart(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2 outline-none h-[38px] shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Hora Salida</label>
                  <input
                    required
                    type="time"
                    value={newShiftEnd}
                    onChange={(e) => setNewShiftEnd(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2 outline-none h-[38px] shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Ubicación / Ficha Obra</label>
                <select
                  required
                  value={newShiftLoc}
                  onChange={(e) => setNewShiftLoc(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2.5 outline-none shadow-sm cursor-pointer"
                >
                  <option value="">Seleccione Destino...</option>
                  {locations.map((loc, i) => (
                    <option key={i} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-100 cursor-pointer mt-2"
              >
                Planificar Turno
              </button>
            </form>

            {/* List and Grid of all Planned shifts */}
            <div className="lg:col-span-2 w-full flex flex-col gap-4">
              <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1 mb-2">
                📂 Turnos Planificados Cargados ({shifts.length})
              </h4>

              <div className="overflow-x-auto w-full border border-slate-200 rounded-2xl p-1 bg-slate-50">
                <table className="w-full text-left text-xs bg-white rounded-xl overflow-hidden min-w-[500px]">
                  <thead className="bg-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                    <tr>
                      <th className="px-4 py-3">Operario</th>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Horario Previsto</th>
                      <th className="px-4 py-3">Ubicación</th>
                      <th className="px-4 py-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shifts
                      .sort((a, b) => b.fecha.localeCompare(a.fecha))
                      .map((shift, i) => (
                        <tr key={shift.id || i} className="hover:bg-slate-50 transition-all">
                          <td className="px-4 py-3 font-extrabold text-slate-800">
                            {shift.operarioNombre}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-500">
                            {shift.fecha.split("-").reverse().join("/")}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-700">
                            {shift.inicioEstimado} - {shift.finEstimado}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-600">
                            {shift.ubicacion}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleDeleteShift(shift.id)}
                              className="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 rounded-lg transition-all"
                              title="Borrar Plan de Turno"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}

                    {shifts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500 font-medium">
                          No hay turnos planificados en el sistema. Utilice el formulario de la izquierda para planificar.
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
    </div>
  );
}
