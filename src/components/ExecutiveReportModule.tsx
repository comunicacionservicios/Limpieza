import React, { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import {
  FileSpreadsheet,
  Printer,
  Calendar,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Briefcase,
  Search,
  Filter,
  ArrowUpDown,
  Download,
  TrendingUp,
  Award,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  FileText,
  Building2,
  Sparkles,
  BarChart3,
  CalendarDays,
  CheckCircle
} from "lucide-react";

interface ExecutiveReportProps {
  operarios?: any[];
  onClose?: () => void;
}

export function ExecutiveReportModule({ operarios = [] }: ExecutiveReportProps) {
  // Local state for operarios fallback
  const [dbOperarios, setDbOperarios] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Month navigation: 0 = current month, -1 = previous month, etc.
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedUserFilter, setSelectedUserFilter] = useState("Todos");
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<"resumen" | "tareas" | "operarios" | "imprimir">("resumen");
  const [selectedOpDetail, setSelectedOpDetail] = useState<string | null>(null);

  // Configuración de secciones para Imprimir / PDF
  const [printConfig, setPrintConfig] = useState({
    showKpis: true,
    showPresentismo: true,
    showTareas: false, // Por defecto solo presentismo según solicitud del usuario
    showFirmas: true,
    showObservacionesGenerales: false,
    notaGerencial: "",
  });

  // Modal de opciones antes de imprimir directo
  const [showPrintOptionsModal, setShowPrintOptionsModal] = useState(false);

  // Fetch operarios if empty
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

  // Fetch all logs from database
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("logs")
        .select("*")
        .order("inicio", { ascending: false });
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error("Error fetching logs for executive report:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Compute selected month details
  const targetMonthDate = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  }, [monthOffset]);

  const monthName = useMemo(() => {
    return targetMonthDate.toLocaleString("es-AR", { month: "long", year: "numeric" });
  }, [targetMonthDate]);

  // Days array for the month
  const monthDays = useMemo(() => {
    const year = targetMonthDate.getFullYear();
    const month = targetMonthDate.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const days: Date[] = [];
    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(year, month, i, 0, 0, 0, 0));
    }
    return days;
  }, [targetMonthDate]);

  // Helper date normalizer (YYYY-MM-DD)
  const normalizeDate = (d: any): string => {
    if (!d) return "";
    const dateObj = d instanceof Date ? d : new Date(d);
    if (isNaN(dateObj.getTime())) return "";
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // Helper formatting for timestamps to HH:MM in Argentina time
  const formatTime = (iso: string | null): string => {
    if (!iso) return "-";
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return "-";
    }
  };

  // Helper formatting for dates to DD/MM/YYYY
  const formatDate = (iso: string | null | Date): string => {
    if (!iso) return "-";
    try {
      const d = iso instanceof Date ? iso : new Date(iso);
      return d.toLocaleDateString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "-";
    }
  };

  // Filter logs for this specific selected month
  const monthLogs = useMemo(() => {
    const year = targetMonthDate.getFullYear();
    const month = targetMonthDate.getMonth();

    return logs.filter((log) => {
      if (!log.inicio) return false;
      const logDate = new Date(log.inicio);
      return logDate.getFullYear() === year && logDate.getMonth() === month;
    });
  }, [logs, targetMonthDate]);

  // Filtered by user if selected
  const filteredLogs = useMemo(() => {
    if (selectedUserFilter === "Todos") return monthLogs;
    const normUser = selectedUserFilter.toLowerCase();
    return monthLogs.filter((l) => (l.operario_nombre || "").toLowerCase() === normUser);
  }, [monthLogs, selectedUserFilter]);

  // Compute stats per Operario for the month
  const operariosReportStats = useMemo(() => {
    const todayStr = normalizeDate(new Date());

    return activeOperarios.map((op) => {
      const opNorm = (op.nombre || "").toLowerCase();
      const opMonthLogs = monthLogs.filter(
        (l) => (l.operario_nombre || "").toLowerCase() === opNorm
      );

      let totalMinutesWorked = 0;
      let diasPresentes = 0;
      let diasIncompletos = 0;
      let diasAusentes = 0;
      let totalTasksCount = 0;

      // Group logs by day
      const logsByDay: { [dateStr: string]: any[] } = {};
      opMonthLogs.forEach((l) => {
        const dStr = normalizeDate(l.inicio);
        if (!logsByDay[dStr]) logsByDay[dStr] = [];
        logsByDay[dStr].push(l);

        // Count tasks
        if ((l.accion || "").startsWith("Tarea:") || l.tarea || l.tarea_nombre) {
          totalTasksCount++;
        }
      });

      monthDays.forEach((day) => {
        const dateStr = normalizeDate(day);
        const dayOfWeek = day.getDay(); // 0 = Domingo
        const isFuture = day.getTime() > new Date().setHours(23, 59, 59, 999);
        const isPastDay = dateStr < todayStr;
        const dayLogs = logsByDay[dateStr] || [];

        if (isFuture) return; // Future days don't count towards absences

        if (dayLogs.length > 0) {
          const sorted = [...dayLogs].sort(
            (a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime()
          );
          const last = sorted[sorted.length - 1];
          const hasOpenLog = !last.fin;

          const dayMinutes = sorted.reduce(
            (acc, l) => acc + (l.duracion_minutos || l.duracion || 0),
            0
          );
          totalMinutesWorked += dayMinutes;

          if (isPastDay && hasOpenLog) {
            diasIncompletos++;
          } else if (hasOpenLog) {
            // Today ongoing
            diasIncompletos++;
          } else if (dayMinutes < 240) {
            diasIncompletos++;
          } else {
            diasPresentes++;
          }
        } else {
          // No logs recorded. Only count as absence if it is a working day (Mon-Sat)
          if (dayOfWeek !== 0 && isPastDay) {
            diasAusentes++;
          }
        }
      });

      const totalActiveDays = diasPresentes + diasIncompletos + diasAusentes;
      const presentismoPct =
        totalActiveDays > 0
          ? Math.round((diasPresentes / totalActiveDays) * 100)
          : 100;

      const totalHoras = Math.floor(totalMinutesWorked / 60);
      const totalMinsResto = totalMinutesWorked % 60;

      return {
        id: op.id,
        nombre: op.nombre,
        email: op.email,
        telefono: op.telefono,
        horario_entrada: op.horario_entrada || "08:00",
        horario_salida: op.horario_salida || "17:00",
        diasPresentes,
        diasIncompletos,
        diasAusentes,
        totalMinutesWorked,
        totalHorasFormatted: `${totalHoras}h ${totalMinsResto}m`,
        totalHorasDecimal: +(totalMinutesWorked / 60).toFixed(1),
        presentismoPct,
        totalTasksCount,
        logs: opMonthLogs,
      };
    });
  }, [activeOperarios, monthLogs, monthDays]);

  // Overall Global Executive KPIs
  const globalKpis = useMemo(() => {
    const totalMinutes = operariosReportStats.reduce(
      (acc, op) => acc + op.totalMinutesWorked,
      0
    );
    const totalPresentes = operariosReportStats.reduce(
      (acc, op) => acc + op.diasPresentes,
      0
    );
    const totalIncompletos = operariosReportStats.reduce(
      (acc, op) => acc + op.diasIncompletos,
      0
    );
    const totalAusencias = operariosReportStats.reduce(
      (acc, op) => acc + op.diasAusentes,
      0
    );
    const totalTasks = operariosReportStats.reduce(
      (acc, op) => acc + op.totalTasksCount,
      0
    );

    const totalDaysRecorded = totalPresentes + totalIncompletos + totalAusencias;
    const globalPresentismo =
      totalDaysRecorded > 0
        ? Math.round((totalPresentes / totalDaysRecorded) * 100)
        : 100;

    const horasTotales = Math.floor(totalMinutes / 60);
    const minsTotales = totalMinutes % 60;

    return {
      totalHorasStr: `${horasTotales}h ${minsTotales}m`,
      totalHorasDecimal: +(totalMinutes / 60).toFixed(1),
      globalPresentismo,
      totalPresentes,
      totalIncompletos,
      totalAusencias,
      totalTasks,
      activeWorkersCount: activeOperarios.length,
    };
  }, [operariosReportStats, activeOperarios]);

  // Task Breakdown Analytics
  const tasksBreakdown = useMemo(() => {
    const taskMap: {
      [taskName: string]: {
        name: string;
        count: number;
        totalMinutes: number;
        operariosSet: Set<string>;
      };
    } = {};

    filteredLogs.forEach((l) => {
      let taskName = l.accion || "";
      if (taskName.startsWith("Tarea: ")) {
        taskName = taskName.replace("Tarea: ", "").trim();
      } else if (taskName.startsWith("Turno") || taskName.startsWith("Descanso")) {
        // Attendance logs, not specific task completions
        return;
      }

      if (!taskName) return;

      // Clean observation notes from task title if appended
      const cleanName = taskName.split(" (Obs:")[0].trim();
      const minutes = l.duracion_minutos || l.duracion || 0;
      const opName = l.operario_nombre || "Desconocido";

      if (!taskMap[cleanName]) {
        taskMap[cleanName] = {
          name: cleanName,
          count: 0,
          totalMinutes: 0,
          operariosSet: new Set<string>(),
        };
      }

      taskMap[cleanName].count++;
      taskMap[cleanName].totalMinutes += minutes;
      taskMap[cleanName].operariosSet.add(opName);
    });

    const totalTaskMinutes = Object.values(taskMap).reduce(
      (acc, t) => acc + t.totalMinutes,
      0
    );

    return Object.values(taskMap)
      .map((t) => {
        const hours = Math.floor(t.totalMinutes / 60);
        const mins = t.totalMinutes % 60;
        const pct =
          totalTaskMinutes > 0
            ? Math.round((t.totalMinutes / totalTaskMinutes) * 100)
            : 0;

        return {
          name: t.name,
          count: t.count,
          totalMinutes: t.totalMinutes,
          hoursFormatted: `${hours}h ${mins}m`,
          hoursDecimal: +(t.totalMinutes / 60).toFixed(1),
          percentage: pct,
          operarios: Array.from(t.operariosSet),
        };
      })
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [filteredLogs]);

  // Chronological Task Logs for Table Listing
  const chronologicalTaskLogs = useMemo(() => {
    return filteredLogs
      .filter((l) => {
        const act = l.accion || "";
        return act.startsWith("Tarea:") || l.tarea || l.tarea_nombre;
      })
      .filter((l) => {
        if (!taskSearchQuery) return true;
        const q = taskSearchQuery.toLowerCase();
        return (
          (l.accion || "").toLowerCase().includes(q) ||
          (l.operario_nombre || "").toLowerCase().includes(q) ||
          (l.detalles || "").toLowerCase().includes(q) ||
          (l.ubicacion || "").toLowerCase().includes(q)
        );
      });
  }, [filteredLogs, taskSearchQuery]);

  // Export to Excel / CSV Functionality
  const handleExportCSV = () => {
    const sep = ";"; // Standard semicolon separator for Spanish Excel
    let csv = "\uFEFF"; // UTF-8 BOM so Excel opens with proper accents and tildes

    // Header Metadata
    csv += `REPORTE GERENCIAL DE ASISTENCIA Y TAREAS - ARÉVALO SERVICIOS\r\n`;
    csv += `Período: ${monthName.toUpperCase()}\r\n`;
    csv += `Fecha de Generación: ${new Date().toLocaleDateString("es-AR")} ${new Date().toLocaleTimeString("es-AR")}\r\n`;
    csv += `Tasa de Presentismo Global: ${globalKpis.globalPresentismo}%\r\n`;
    csv += `Total Horas Hombre Trabajadas: ${globalKpis.totalHorasStr}\r\n`;
    csv += `\r\n`;

    // SECTION 1: Resumen de Asistencias por Operario
    csv += `=== SECCIÓN 1: RESUMEN MENSUAL DE ASISTENCIAS POR OPERARIO ===\r\n`;
    csv += `Operario${sep}Horario Asignado${sep}Días Presentes${sep}Jornadas Incompletas${sep}Inasistencias${sep}Horas Totales Trabajadas${sep}% Presentismo${sep}Tareas Realizadas\r\n`;

    operariosReportStats.forEach((op) => {
      csv += `"${op.nombre}"${sep}"${op.horario_entrada} - ${op.horario_salida}"${sep}${op.diasPresentes}${sep}${op.diasIncompletos}${sep}${op.diasAusentes}${sep}"${op.totalHorasFormatted}"${sep}"${op.presentismoPct}%"${sep}${op.totalTasksCount}\r\n`;
    });

    csv += `\r\n\r\n`;

    // SECTION 2: Resumen de Tareas y Distribución
    csv += `=== SECCIÓN 2: DISTRIBUCIÓN DE HORAS POR TAREA / SECTOR ===\r\n`;
    csv += `Tarea / Actividad${sep}Cantidad de Ejecuciones${sep}Tiempo Total Acumulado${sep}% del Tiempo Total${sep}Personal Involucrado\r\n`;

    tasksBreakdown.forEach((t) => {
      csv += `"${t.name}"${sep}${t.count}${sep}"${t.hoursFormatted}"${sep}"${t.percentage}%"${sep}"${t.operarios.join(", ")}"\r\n`;
    });

    csv += `\r\n\r\n`;

    // SECTION 3: Registro Detallado de Tareas
    csv += `=== SECCIÓN 3: BITÁCORA DETALLADA DE TAREAS EJECUTADAS ===\r\n`;
    csv += `Fecha${sep}Operario${sep}Tarea Realizada${sep}Hora Inicio${sep}Hora Fin${sep}Duración${sep}Observaciones / Notas\r\n`;

    filteredLogs
      .filter((l) => (l.accion || "").startsWith("Tarea:") || l.tarea || l.tarea_nombre)
      .forEach((l) => {
        let taskTitle = l.accion || "";
        if (taskTitle.startsWith("Tarea: ")) {
          taskTitle = taskTitle.replace("Tarea: ", "");
        }
        const fDate = formatDate(l.inicio);
        const hIni = formatTime(l.inicio);
        const hFin = formatTime(l.fin);
        const durStr = `${Math.floor((l.duracion_minutos || l.duracion || 0) / 60)}h ${(l.duracion_minutos || l.duracion || 0) % 60}m`;
        const obs = (l.detalles || "").replace(/"/g, '""');

        csv += `"${fDate}"${sep}"${l.operario_nombre || "-"}"${sep}"${taskTitle.replace(/"/g, '""')}"${sep}"${hIni}"${sep}"${hFin}"${sep}"${durStr}"${sep}"${obs}"\r\n`;
      });

    // Create Download Link
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Reporte_Gerencial_${monthName.replace(/\s+/g, "_")}_Arevalo.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Trigger browser print for clean PDF export
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full flex flex-col gap-6 font-sans">
      {/* HEADER BAR CON CONTROLES EJECUTIVOS */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0">
            <BarChart3 className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                Módulo Gerencial
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                Arévalo Servicios Integrales
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
              Reporte de Asistencia y Productividad
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Consolidado de presentismo, control horario y bitácora de tareas para gerencia.
            </p>
          </div>
        </div>

        {/* CONTROLES DE FECHA Y EXPORTACIÓN */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-start lg:justify-end">
          {/* Navegador de Mes */}
          <div className="flex items-center bg-slate-100/80 border border-slate-200 rounded-2xl p-1 shadow-inner">
            <button
              onClick={() => setMonthOffset(monthOffset - 1)}
              className="p-2 hover:bg-white text-slate-600 rounded-xl transition-all shadow-2xs cursor-pointer"
              title="Mes Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 py-1 text-center min-w-[130px]">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                Mes Seleccionado
              </span>
              <span className="text-xs font-black text-slate-800 capitalize block">
                {monthName}
              </span>
            </div>
            <button
              onClick={() => setMonthOffset(monthOffset + 1)}
              className="p-2 hover:bg-white text-slate-600 rounded-xl transition-all shadow-2xs cursor-pointer"
              title="Mes Siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {monthOffset !== 0 && (
              <button
                onClick={() => setMonthOffset(0)}
                className="ml-1 px-2.5 py-1 text-[10px] font-bold bg-white text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-200 transition-all cursor-pointer"
              >
                Mes Actual
              </button>
            )}
          </div>

          {/* Botón Excel / CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
            title="Descargar datos en Excel / CSV"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Descargar Excel</span>
          </button>

          {/* Botón Imprimir / PDF */}
          <button
            onClick={() => setShowPrintOptionsModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-2xl transition-all shadow-md shadow-slate-900/20 cursor-pointer"
            title="Personalizar e imprimir reporte"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      {/* MODAL PARA PREGUNTAR QUÉ CONTENIDOS MOSTRAR AL IMPRIMIR */}
      {showPrintOptionsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 flex flex-col gap-6">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Configurar Reporte Imprimible / PDF
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Selecciona exactamente qué secciones deseas incluir en el documento:
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPrintOptionsModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* OPCIONES / CHECKBOXES */}
            <div className="flex flex-col gap-3">
              {/* Opcion 1: Resumen de Presentismo (Principal) */}
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer">
                <input
                  type="checkbox"
                  checked={printConfig.showPresentismo}
                  onChange={(e) =>
                    setPrintConfig({ ...printConfig, showPresentismo: e.target.checked })
                  }
                  className="mt-0.5 w-4 h-4 text-blue-600 rounded-md border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-black text-slate-800 block">
                    1. Cómputo de Presentismo y Asistencias por Operario (Recomendado)
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                    Incluye días trabajados, ausencias, jornadas incompletas, horas totales y porcentaje de cumplimiento.
                  </span>
                </div>
              </label>

              {/* Opcion 2: Tarjetas de Resumen Ejecutivo / KPIs */}
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer">
                <input
                  type="checkbox"
                  checked={printConfig.showKpis}
                  onChange={(e) =>
                    setPrintConfig({ ...printConfig, showKpis: e.target.checked })
                  }
                  className="mt-0.5 w-4 h-4 text-blue-600 rounded-md border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-black text-slate-800 block">
                    2. Resumen Numérico Ejecutivo (Cabecera)
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                    Muestra los 4 indicadores clave: % Presentismo global, Horas Totales y Operarios activos.
                  </span>
                </div>
              </label>

              {/* Opcion 3: Desglose de Tareas Realizadas */}
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer">
                <input
                  type="checkbox"
                  checked={printConfig.showTareas}
                  onChange={(e) =>
                    setPrintConfig({ ...printConfig, showTareas: e.target.checked })
                  }
                  className="mt-0.5 w-4 h-4 text-blue-600 rounded-md border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-black text-slate-800 block">
                    3. Desglose y Distribución de Tareas
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                    Detalle de las actividades realizadas, frecuencia y porcentaje del tiempo ocupado.
                  </span>
                </div>
              </label>

              {/* Opcion 4: Sector de Firmas */}
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer">
                <input
                  type="checkbox"
                  checked={printConfig.showFirmas}
                  onChange={(e) =>
                    setPrintConfig({ ...printConfig, showFirmas: e.target.checked })
                  }
                  className="mt-0.5 w-4 h-4 text-blue-600 rounded-md border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-black text-slate-800 block">
                    4. Cuadro de Firmas Oficiales
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                    Espacios para la firma del Supervisor Operativo y Conformidad de Gerencia.
                  </span>
                </div>
              </label>
            </div>

            {/* PRESET RÁPIDO: SOLO PRESENTISMO */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex justify-between items-center text-xs">
              <span className="text-[11px] font-bold text-amber-900">
                ¿Solo quieres entregar el Presentismo?
              </span>
              <button
                type="button"
                onClick={() =>
                  setPrintConfig({
                    showKpis: true,
                    showPresentismo: true,
                    showTareas: false,
                    showFirmas: true,
                    showObservacionesGenerales: false,
                    notaGerencial: "",
                  })
                }
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] rounded-lg cursor-pointer transition-all"
              >
                Configurar Solo Presentismo
              </button>
            </div>

            {/* ACCIONES DEL MODAL */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPrintOptionsModal(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowPrintOptionsModal(false);
                  setActiveSubTab("imprimir");
                  setTimeout(() => {
                    window.print();
                  }, 300);
                }}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-600/20 flex items-center gap-2 cursor-pointer transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Ahora</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TARJETAS KPI EJECUTIVAS GLOBALES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tasa de Presentismo */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                Presentismo Global
              </span>
              <div className="text-3xl font-black text-slate-900 tracking-tight">
                {globalKpis.globalPresentismo}%
              </div>
            </div>
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                globalKpis.globalPresentismo >= 90
                  ? "bg-emerald-100 text-emerald-700"
                  : globalKpis.globalPresentismo >= 75
                  ? "bg-amber-100 text-amber-700"
                  : "bg-rose-100 text-rose-700"
              }`}
            >
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  globalKpis.globalPresentismo >= 90
                    ? "bg-emerald-500"
                    : globalKpis.globalPresentismo >= 75
                    ? "bg-amber-500"
                    : "bg-rose-500"
                }`}
                style={{ width: `${globalKpis.globalPresentismo}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-slate-500 mt-1.5 block">
              Calculado sobre {activeOperarios.length} operarios activos
            </span>
          </div>
        </div>

        {/* KPI 2: Total Horas Hombre */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                Horas Totales Trabajadas
              </span>
              <div className="text-3xl font-black text-blue-600 tracking-tight">
                {globalKpis.totalHorasStr}
              </div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-600">
            <span>Promedio por operario:</span>
            <span className="text-slate-900 font-extrabold">
              {activeOperarios.length > 0
                ? (globalKpis.totalHorasDecimal / activeOperarios.length).toFixed(1)
                : 0}
              h
            </span>
          </div>
        </div>

        {/* KPI 3: Desglose de Asistencias y Fichadas */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
              Distribución de Jornadas
            </span>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-emerald-50 border border-emerald-100 rounded-xl p-2 text-center">
                <span className="text-emerald-700 font-black text-sm block">
                  {globalKpis.totalPresentes}
                </span>
                <span className="text-[9px] font-extrabold text-emerald-600 uppercase block">
                  Completas
                </span>
              </div>
              <div className="flex-1 bg-amber-50 border border-amber-100 rounded-xl p-2 text-center">
                <span className="text-amber-700 font-black text-sm block">
                  {globalKpis.totalIncompletos}
                </span>
                <span className="text-[9px] font-extrabold text-amber-600 uppercase block">
                  Incompletas
                </span>
              </div>
              <div className="flex-1 bg-rose-50 border border-rose-100 rounded-xl p-2 text-center">
                <span className="text-rose-700 font-black text-sm block">
                  {globalKpis.totalAusencias}
                </span>
                <span className="text-[9px] font-extrabold text-rose-600 uppercase block">
                  Ausencias
                </span>
              </div>
            </div>
          </div>
          <span className="text-[10px] font-bold text-slate-400 mt-2 block">
            Jornadas monitoreadas en el mes
          </span>
        </div>

        {/* KPI 4: Volumen de Tareas */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                Tareas Realizadas
              </span>
              <div className="text-3xl font-black text-indigo-600 tracking-tight">
                {globalKpis.totalTasks}
              </div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-600">
            <span>Tipos de actividades:</span>
            <span className="text-indigo-900 font-extrabold">
              {tasksBreakdown.length} áreas
            </span>
          </div>
        </div>
      </div>

      {/* NAVEGACIÓN DE PESTAÑAS DEL REPORTE */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab("resumen")}
          className={`px-5 py-3 font-extrabold text-xs tracking-wide transition-all border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeSubTab === "resumen"
              ? "border-blue-600 text-blue-600 font-black"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>1. Asistencias por Operario</span>
        </button>

        <button
          onClick={() => setActiveSubTab("tareas")}
          className={`px-5 py-3 font-extrabold text-xs tracking-wide transition-all border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeSubTab === "tareas"
              ? "border-indigo-600 text-indigo-600 font-black"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>2. Productividad y Tareas</span>
        </button>

        <button
          onClick={() => setActiveSubTab("imprimir")}
          className={`px-5 py-3 font-extrabold text-xs tracking-wide transition-all border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeSubTab === "imprimir"
              ? "border-slate-800 text-slate-900 font-black"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>3. Vista Formal para Gerencia (Imprimir)</span>
        </button>
      </div>

      {/* SUBTAB 1: TABLA RESUMEN POR OPERARIO */}
      {activeSubTab === "resumen" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
              <span>Detalle Individual de Presentismo ({monthName})</span>
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">Filtrar:</span>
              <select
                value={selectedUserFilter}
                onChange={(e) => setSelectedUserFilter(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-1.5 outline-none shadow-2xs cursor-pointer"
              >
                <option value="Todos">Todos los Operarios ({activeOperarios.length})</option>
                {activeOperarios.map((op) => (
                  <option key={op.id} value={op.nombre}>
                    {op.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200/80 rounded-3xl bg-white shadow-sm">
            <table className="w-full text-left border-collapse text-xs min-w-[850px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="p-4">Operario</th>
                  <th className="p-4">Horario Habitual</th>
                  <th className="p-4 text-center">Jornadas Completas</th>
                  <th className="p-4 text-center">Incompletas / Sin Cierre</th>
                  <th className="p-4 text-center">Inasistencias</th>
                  <th className="p-4 text-center">Horas Totales</th>
                  <th className="p-4 text-center">Presentismo</th>
                  <th className="p-4 text-center">Tareas Realizadas</th>
                  <th className="p-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {operariosReportStats
                  .filter(
                    (op) =>
                      selectedUserFilter === "Todos" || op.nombre === selectedUserFilter
                  )
                  .map((op) => (
                    <tr key={op.id} className="hover:bg-slate-50/60 transition-all">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                            {op.nombre ? op.nombre.substring(0, 2).toUpperCase() : "OP"}
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-900 block">
                              {op.nombre}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400">
                              {op.telefono || "Personal de Limpieza"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 font-mono font-bold text-slate-600">
                        {op.horario_entrada} - {op.horario_salida}
                      </td>

                      <td className="p-4 text-center">
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-xl font-black border border-emerald-200/60">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          {op.diasPresentes} días
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-black border ${
                            op.diasIncompletos > 0
                              ? "bg-amber-50 text-amber-800 border-amber-200/80"
                              : "bg-slate-50 text-slate-400 border-slate-200"
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              op.diasIncompletos > 0 ? "bg-amber-500" : "bg-slate-300"
                            }`}
                          />
                          {op.diasIncompletos} días
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-black border ${
                            op.diasAusentes > 0
                              ? "bg-rose-50 text-rose-800 border-rose-200/80"
                              : "bg-slate-50 text-slate-400 border-slate-200"
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              op.diasAusentes > 0 ? "bg-rose-500" : "bg-slate-300"
                            }`}
                          />
                          {op.diasAusentes} días
                        </span>
                      </td>

                      <td className="p-4 text-center font-extrabold text-slate-900 font-mono">
                        {op.totalHorasFormatted}
                      </td>

                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`font-black text-xs ${
                              op.presentismoPct >= 90
                                ? "text-emerald-700"
                                : op.presentismoPct >= 75
                                ? "text-amber-700"
                                : "text-rose-700"
                            }`}
                          >
                            {op.presentismoPct}%
                          </span>
                          <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                op.presentismoPct >= 90
                                  ? "bg-emerald-500"
                                  : op.presentismoPct >= 75
                                  ? "bg-amber-500"
                                  : "bg-rose-500"
                              }`}
                              style={{ width: `${op.presentismoPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="p-4 text-center font-extrabold text-indigo-700">
                        {op.totalTasksCount} tareas
                      </td>

                      <td className="p-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedOpDetail(
                              selectedOpDetail === op.nombre ? null : op.nombre
                            );
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 font-bold text-[11px] rounded-xl border border-slate-200 transition-all cursor-pointer"
                        >
                          {selectedOpDetail === op.nombre ? "Ocultar" : "Ver Tareas"}
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* FICHA DETALLADA SI SE SELECCIONÓ UN OPERARIO */}
          {selectedOpDetail && (
            <div className="bg-slate-50 border border-blue-200 rounded-3xl p-6 flex flex-col gap-4 shadow-sm animate-in fade-in">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  <h4 className="font-black text-sm text-slate-900">
                    Historial de Tareas y Fichadas de {selectedOpDetail} ({monthName})
                  </h4>
                </div>
                <button
                  onClick={() => setSelectedOpDetail(null)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  Cerrar Detalle &times;
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <thead className="bg-slate-100 text-slate-500 text-[10px] font-black uppercase">
                    <tr>
                      <th className="p-3">Fecha</th>
                      <th className="p-3">Actividad / Tarea</th>
                      <th className="p-3">Hora Inicio</th>
                      <th className="p-3">Hora Fin</th>
                      <th className="p-3">Duración</th>
                      <th className="p-3">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthLogs
                      .filter(
                        (l) =>
                          (l.operario_nombre || "").toLowerCase() ===
                          selectedOpDetail.toLowerCase()
                      )
                      .map((log, idx) => (
                        <tr key={log.id || idx} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-700">
                            {formatDate(log.inicio)}
                          </td>
                          <td className="p-3 font-extrabold text-slate-900">
                            {log.accion || "Turno Regular"}
                          </td>
                          <td className="p-3 font-mono text-slate-600 font-bold">
                            {formatTime(log.inicio)}
                          </td>
                          <td className="p-3 font-mono text-slate-600 font-bold">
                            {formatTime(log.fin)}
                          </td>
                          <td className="p-3 font-mono font-black text-blue-600">
                            {Math.floor(
                              (log.duracion_minutos || log.duracion || 0) / 60
                            )}
                            h {(log.duracion_minutos || log.duracion || 0) % 60}m
                          </td>
                          <td className="p-3 text-slate-500 italic">
                            {log.detalles || "-"}
                          </td>
                        </tr>
                      ))}
                    {monthLogs.filter(
                      (l) =>
                        (l.operario_nombre || "").toLowerCase() ===
                        selectedOpDetail.toLowerCase()
                    ).length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400 font-bold">
                          No hay registros para este operario en el mes de {monthName}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: PRODUCTIVIDAD Y TAREAS REALIZADAS */}
      {activeSubTab === "tareas" && (
        <div className="flex flex-col gap-6">
          {/* DISTRIBUCIÓN DE HORAS POR TAREA */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
            <h3 className="text-base font-extrabold text-slate-900 mb-1 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-indigo-600" />
              <span>Distribución del Tiempo por Tipo de Tarea ({monthName})</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mb-6">
              Muestra a qué servicios y áreas se destinó el total de horas trabajadas durante el período.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tasksBreakdown.map((t, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50/80 border border-slate-200/70 rounded-2xl p-4 flex flex-col justify-between gap-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-black text-sm text-slate-900 block">
                        {t.name}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                        {t.count} intervenciones &bull; {t.operarios.length} operario(s)
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-indigo-600 block">
                        {t.hoursFormatted}
                      </span>
                      <span className="text-[10px] font-extrabold text-slate-500 block">
                        {t.percentage}% del total
                      </span>
                    </div>
                  </div>

                  {/* Barra de Progreso */}
                  <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${t.percentage}%` }}
                    />
                  </div>

                  {/* Personal que trabajó en la tarea */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                      Operarios:
                    </span>
                    {t.operarios.map((op, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-bold bg-white text-slate-700 px-2 py-0.5 rounded-lg border border-slate-200"
                      >
                        {op}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              {tasksBreakdown.length === 0 && (
                <div className="col-span-full p-8 text-center text-slate-400 font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  No se registraron tareas etiquetadas en este período.
                </div>
              )}
            </div>
          </div>

          {/* BITÁCORA DETALLADA DE TODAS LAS TAREAS */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Bitácora Cronológica de Tareas Ejecutadas
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  Registro histórico de cada tarea iniciada y finalizada por el equipo.
                </span>
              </div>

              {/* Buscador de Tareas */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por tarea, operario..."
                  value={taskSearchQuery}
                  onChange={(e) => setTaskSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl pl-9 pr-3 py-2 outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Operario</th>
                    <th className="p-3">Tarea / Obra</th>
                    <th className="p-3">Horario</th>
                    <th className="p-3">Duración</th>
                    <th className="p-3">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {chronologicalTaskLogs.map((l, idx) => {
                    let taskName = l.accion || "";
                    if (taskName.startsWith("Tarea: ")) {
                      taskName = taskName.replace("Tarea: ", "");
                    }

                    return (
                      <tr key={l.id || idx} className="hover:bg-slate-50/70">
                        <td className="p-3 font-bold text-slate-600 font-mono">
                          {formatDate(l.inicio)}
                        </td>
                        <td className="p-3 font-extrabold text-slate-900">
                          {l.operario_nombre || "Operario"}
                        </td>
                        <td className="p-3 font-bold text-indigo-900">
                          {taskName}
                        </td>
                        <td className="p-3 font-mono font-semibold text-slate-600">
                          {formatTime(l.inicio)} - {formatTime(l.fin)}
                        </td>
                        <td className="p-3 font-mono font-black text-blue-600">
                          {Math.floor((l.duracion_minutos || l.duracion || 0) / 60)}h{" "}
                          {(l.duracion_minutos || l.duracion || 0) % 60}m
                        </td>
                        <td className="p-3 text-slate-500 italic">
                          {l.detalles || "-"}
                        </td>
                      </tr>
                    );
                  })}

                  {chronologicalTaskLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">
                        No se encontraron registros de tareas con los filtros actuales.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: VISTA FORMAL PARA GERENCIA E IMPRESIÓN / PDF */}
      {activeSubTab === "imprimir" && (
        <div className="flex flex-col gap-6">
          {/* BARRA DE CONFIGURACIÓN RÁPIDA DE SECCIONES PARA IMPRESIÓN */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-600" />
                <h4 className="font-extrabold text-sm text-slate-900">
                  ¿Qué secciones deseas incluir en el documento imprimible?
                </h4>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Activa o desactiva las secciones según lo que solicite la gerencia.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Botón rápido Solo Presentismo */}
              <button
                onClick={() =>
                  setPrintConfig({
                    showKpis: true,
                    showPresentismo: true,
                    showTareas: false,
                    showFirmas: true,
                    showObservacionesGenerales: false,
                    notaGerencial: "",
                  })
                }
                className={`px-3 py-1.5 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                  printConfig.showPresentismo && !printConfig.showTareas
                    ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                Solo Presentismo
              </button>

              {/* Botón rápido Presentismo + Tareas */}
              <button
                onClick={() =>
                  setPrintConfig({
                    showKpis: true,
                    showPresentismo: true,
                    showTareas: true,
                    showFirmas: true,
                    showObservacionesGenerales: false,
                    notaGerencial: "",
                  })
                }
                className={`px-3 py-1.5 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                  printConfig.showPresentismo && printConfig.showTareas
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                Presentismo + Tareas
              </button>

              <button
                onClick={handlePrint}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl transition-all shadow-md shadow-slate-900/20 cursor-pointer flex items-center gap-2 shrink-0 ml-2"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir / PDF</span>
              </button>
            </div>
          </div>

          {/* CHECKBOXES DETALLADOS DE CONFIGURACIÓN */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-wrap items-center gap-4 text-xs font-bold text-slate-700">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Personalizar:
            </span>

            <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
              <input
                type="checkbox"
                checked={printConfig.showKpis}
                onChange={(e) =>
                  setPrintConfig({ ...printConfig, showKpis: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 rounded-sm"
              />
              <span>Cabecera con Indicadores</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
              <input
                type="checkbox"
                checked={printConfig.showPresentismo}
                onChange={(e) =>
                  setPrintConfig({ ...printConfig, showPresentismo: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 rounded-sm"
              />
              <span>Tabla de Presentismo y Horas</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
              <input
                type="checkbox"
                checked={printConfig.showTareas}
                onChange={(e) =>
                  setPrintConfig({ ...printConfig, showTareas: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 rounded-sm"
              />
              <span>Tabla de Tareas Realizadas</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
              <input
                type="checkbox"
                checked={printConfig.showFirmas}
                onChange={(e) =>
                  setPrintConfig({ ...printConfig, showFirmas: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 rounded-sm"
              />
              <span>Sector de Firmas</span>
            </label>
          </div>

          {/* HOJA FORMAL IMPRIMIBLE */}
          <div
            ref={printRef}
            className="bg-white border border-slate-300 rounded-2xl p-8 sm:p-12 shadow-md max-w-4xl mx-auto w-full text-slate-900 print:border-none print:shadow-none print:p-0"
          >
            {/* MEMBRETE */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  ARÉVALO SERVICIOS INTEGRALES
                </h1>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                  Control de Gestión Operativa &bull; Recursos Humanos
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Dirección de Operaciones &bull; {printConfig.showTareas ? "Reporte Mensual de Asistencia y Servicios" : "Reporte Mensual de Presentismo y Control Horario"}
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                  Período Liquidado
                </span>
                <span className="text-base font-black text-blue-900 capitalize block">
                  {monthName}
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">
                  Emisión: {new Date().toLocaleDateString("es-AR")}
                </span>
              </div>
            </div>

            {/* RESUMEN EJECUTIVO (SI ESTÁ HABILITADO) */}
            {printConfig.showKpis && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mb-8 bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 block">
                    Presentismo Global
                  </span>
                  <span className="text-lg font-black text-slate-900 block">
                    {globalKpis.globalPresentismo}%
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 block">
                    Horas Totales
                  </span>
                  <span className="text-lg font-black text-slate-900 block">
                    {globalKpis.totalHorasStr}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 block">
                    Personal Activo
                  </span>
                  <span className="text-lg font-black text-slate-900 block">
                    {activeOperarios.length} operarios
                  </span>
                </div>
                {printConfig.showTareas && (
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 block">
                      Total Tareas
                    </span>
                    <span className="text-lg font-black text-slate-900 block">
                      {globalKpis.totalTasks}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* TABLA DE ASISTENCIAS (SI ESTÁ HABILITADA) */}
            {printConfig.showPresentismo && (
              <div className="mb-8">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 mb-2">
                  1. Cómputo Mensual de Asistencias, Inasistencias y Horas
                </h3>
                <table className="w-full text-left text-xs border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 text-[10px] font-black uppercase border-b border-slate-300">
                      <th className="p-2 border-r border-slate-300">Operario</th>
                      <th className="p-2 border-r border-slate-300">Horario Asignado</th>
                      <th className="p-2 border-r border-slate-300 text-center">Días Presente</th>
                      <th className="p-2 border-r border-slate-300 text-center">Jornadas Incompletas</th>
                      <th className="p-2 border-r border-slate-300 text-center">Inasistencias</th>
                      <th className="p-2 border-r border-slate-300 text-center">Horas Totales</th>
                      <th className="p-2 text-center">% Cumplimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operariosReportStats.map((op, idx) => (
                      <tr key={idx} className="border-b border-slate-200">
                        <td className="p-2 font-bold border-r border-slate-200">{op.nombre}</td>
                        <td className="p-2 font-mono text-[11px] border-r border-slate-200">
                          {op.horario_entrada} - {op.horario_salida}
                        </td>
                        <td className="p-2 text-center font-bold text-emerald-800 border-r border-slate-200">
                          {op.diasPresentes}
                        </td>
                        <td className="p-2 text-center font-bold text-amber-800 border-r border-slate-200">
                          {op.diasIncompletos}
                        </td>
                        <td className="p-2 text-center font-bold text-rose-800 border-r border-slate-200">
                          {op.diasAusentes}
                        </td>
                        <td className="p-2 text-center font-mono font-bold border-r border-slate-200">
                          {op.totalHorasFormatted}
                        </td>
                        <td className="p-2 text-center font-black">{op.presentismoPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TABLA DE TAREAS RESUMIDAS (SI ESTÁ HABILITADA) */}
            {printConfig.showTareas && (
              <div className="mb-8">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 mb-2">
                  2. Principales Tareas Ejecutadas en el Mes
                </h3>
                <table className="w-full text-left text-xs border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 text-[10px] font-black uppercase border-b border-slate-300">
                      <th className="p-2 border-r border-slate-300">Tarea / Actividad</th>
                      <th className="p-2 border-r border-slate-300 text-center">Frecuencia</th>
                      <th className="p-2 border-r border-slate-300 text-center">Tiempo Dedicado</th>
                      <th className="p-2 text-center">% de la Carga Horaria</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasksBreakdown.slice(0, 8).map((t, idx) => (
                      <tr key={idx} className="border-b border-slate-200">
                        <td className="p-2 font-bold border-r border-slate-200">{t.name}</td>
                        <td className="p-2 text-center border-r border-slate-200">{t.count}</td>
                        <td className="p-2 text-center font-mono font-bold border-r border-slate-200">
                          {t.hoursFormatted}
                        </td>
                        <td className="p-2 text-center font-black">{t.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* SECTOR DE FIRMAS (SI ESTÁ HABILITADO) */}
            {printConfig.showFirmas && (
              <div className="grid grid-cols-2 gap-12 mt-16 pt-8 border-t border-slate-300 text-center text-xs">
                <div>
                  <div className="w-48 border-b border-slate-400 mx-auto mb-2" />
                  <span className="font-black text-slate-900 block">Firma del Supervisor</span>
                  <span className="text-[10px] text-slate-500 block">Control y Validación de Fichadas</span>
                </div>

                <div>
                  <div className="w-48 border-b border-slate-400 mx-auto mb-2" />
                  <span className="font-black text-slate-900 block">Conformidad Gerencia</span>
                  <span className="text-[10px] text-slate-500 block">Aprobación de Liquidación</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
