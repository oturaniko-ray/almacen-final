'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import * as XLSX from '@e965/xlsx';

// ------------------------------------------------------------
// INTERFACES PARA TIPADO
// ------------------------------------------------------------
interface Empleado {
  id: string;
  nombre: string;
  documento_id: string;
  email: string;
  telefono: string | null;
  rol: string;
  nivel_acceso: number;
  activo: boolean;
  en_almacen?: boolean;
}

interface Jornada {
  id: string;
  empleado_id: string;
  hora_entrada: string;
  hora_salida: string | null;
}

interface EmpleadoConJornada extends Empleado {
  ultimaJornada?: Jornada;
  nivel: number;
}

// ------------------------------------------------------------
// FUNCIONES AUXILIARES
// ------------------------------------------------------------
const formatearRol = (rol: string): string => {
  if (!rol) return 'USUARIO';
  const rolLower = rol.toLowerCase();
  switch (rolLower) {
    case 'admin':
    case 'administrador':
      return 'ADMINISTRADOR';
    case 'supervisor':
      return 'SUPERVISOR';
    case 'tecnico':
      return 'TÉCNICO';
    case 'empleado':
      return 'EMPLEADO';
    default:
      return rol.toUpperCase();
  }
};

const getTimestamp = (): string => {
  const ahora = new Date();
  const año = ahora.getFullYear();
  const mes = (ahora.getMonth() + 1).toString().padStart(2, '0');
  const dia = ahora.getDate().toString().padStart(2, '0');
  const hora = ahora.getHours().toString().padStart(2, '0');
  const minuto = ahora.getMinutes().toString().padStart(2, '0');
  const segundo = ahora.getSeconds().toString().padStart(2, '0');
  return `${año}${mes}${dia}_${hora}${minuto}${segundo}`;
};

// ------------------------------------------------------------
// MEMBRETE SUPERIOR (ACTUALIZADO)
// ------------------------------------------------------------
const MemebreteSuperior = ({ 
  usuario, 
  onExportar, 
  onRegresar 
}: { 
  usuario?: any; 
  onExportar: () => void; 
  onRegresar: () => void;
}) => {
  const titulo = "MONITOR DE PRESENCIA";
  const palabras = titulo.split(' ');
  const ultimaPalabra = palabras.pop();
  const primerasPalabras = palabras.join(' ');

  return (
    <div className="w-full mb-4">
      <div className="w-full bg-gradient-to-r from-[#1a1a1a] to-[#0f172a] px-6 py-4 rounded-[25px] border border-blue-500/20 shadow-2xl flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-xl font-black italic uppercase tracking-tighter">
            <span className="text-white">{primerasPalabras} </span>
            <span className="text-blue-500">{ultimaPalabra}</span>
          </h1>
          {usuario && (
            <div className="text-sm mt-1">
              <span className="text-white/80">{usuario.nombre}</span>
              <span className="text-white/50 mx-1">•</span>
              <span className="text-blue-400">{formatearRol(usuario.rol)}</span>
              <span className="text-white/50 ml-1">(Nivel {usuario.nivel_acceso})</span>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onExportar}
            className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-wider border border-emerald-500/30 hover:border-emerald-500 transition-all active:scale-95"
          >
            EXPORTAR
          </button>
          <button
            onClick={onRegresar}
            className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-wider border border-blue-500/30 hover:border-blue-500 transition-all active:scale-95"
          >
            REGRESAR
          </button>
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ------------------------------------------------------------
export default function PresenciaPage() {
  const [empleados, setEmpleados] = useState<EmpleadoConJornada[]>([]);
  const [ahora, setAhora] = useState(new Date());
  const [user, setUser] = useState<any>(null);
  const [tabActiva, setTabActiva] = useState<string>('empleado');
  const [maxLabor, setMaxLabor] = useState<number>(0); 
  const [mostrarNotificacion, setMostrarNotificacion] = useState(false);
  const router = useRouter();

  const fetchData = useCallback(async () => {
    const { data: config } = await supabase
      .from('sistema_config')
      .select('valor')
      .eq('clave', 'maximo_labor')
      .single();
      
    if (config && typeof config === 'object' && 'valor' in config) {
        setMaxLabor(parseFloat((config as { valor: string }).valor) || 0);
    }

    const { data: emps } = await supabase
      .from('empleados')
      .select('*')
      .eq('activo', true)
      .order('nombre');
      
    const { data: jors } = await supabase
      .from('jornadas')
      .select('*')
      .order('hora_entrada', { ascending: false });

    if (emps) {
      const vinculados = (emps as Empleado[]).map(e => {
        const ultimaJornada = jors?.find((j: Jornada) => j.empleado_id === e.id);
        return { 
          ...e, 
          ultimaJornada, 
          nivel: Number(e.nivel_acceso || 0) 
        };
      });
      setEmpleados(vinculados as EmpleadoConJornada[]);
    }
  }, []);

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) setUser(JSON.parse(sessionData));
    fetchData();
    const interval = setInterval(() => setAhora(new Date()), 1000);

    const channel = supabase.channel('presencia_v9')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sistema_config' }, () => fetchData())
      .subscribe();

    return () => { 
      clearInterval(interval); 
      supabase.removeChannel(channel).catch(console.error); 
    };
  }, [fetchData]);

  const calcularTiempoRaw = (fechaISO: string | null): number => {
    if (!fechaISO) return 0;
    return ahora.getTime() - new Date(fechaISO).getTime();
  };

  const formatearTiempo = (ms: number): string => {
    const totalSegundos = Math.floor(ms / 1000);
    const h = Math.floor(totalSegundos / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSegundos % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(totalSegundos % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const formatearFechaHoraUnico = (fechaISO: string | null): string => {
    if (!fechaISO) return '--/-- --:--:--';
    const d = new Date(fechaISO);
    const fecha = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    const hora = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    return `${fecha} ${hora}`;
  };

  // ------------------------------------------------------------
  // EXPORTAR EXCEL - ACTUALIZADO
  // ------------------------------------------------------------
  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    
    const data = empleados.map(e => ({
      Nombre: e.nombre,
      Documento: e.documento_id,
      Nivel: e.nivel_acceso,
      Estado: e.en_almacen ? 'PRESENTE' : 'AUSENTE'
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    
    const columnWidths = [
      { wch: 30 }, { wch: 15 }, { wch: 8 }, { wch: 12 }
    ];
    ws['!cols'] = columnWidths;
    
    const fechaEmision = new Date().toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    const titulo = `MONITOR DE PRESENCIA`;
    const empleadoInfo = user ? `${user.nombre} - ${formatearRol(user.rol)} (Nivel ${user.nivel_acceso})` : 'Sistema';
    const fechaInfo = `Fecha de emision: ${fechaEmision}`;
    
    XLSX.utils.sheet_add_aoa(ws, [[titulo]], { origin: 'A1' });
    XLSX.utils.sheet_add_aoa(ws, [[empleadoInfo]], { origin: 'A2' });
    XLSX.utils.sheet_add_aoa(ws, [[fechaInfo]], { origin: 'A3' });
    XLSX.utils.sheet_add_aoa(ws, [['─────────────────────────────────────────────────────────────────']], { origin: 'A4' });
    
    const newData = XLSX.utils.sheet_to_json(ws, { header: 1, range: 5 });
    if (newData.length > 0) {
      XLSX.utils.sheet_add_aoa(ws, newData as any[][], { origin: 'A6' });
    }
    
    XLSX.utils.book_append_sheet(wb, ws, "Presencia");
    
    const timestamp = getTimestamp();
    const filename = `presencia_${timestamp}.xlsx`;
    
    XLSX.writeFile(wb, filename);
    
    setMostrarNotificacion(true);
    setTimeout(() => setMostrarNotificacion(false), 2000);
  };

  const filtrarYOrdenar = (esPresente: boolean, tab: string): EmpleadoConJornada[] => {
    return empleados
      .filter(e => {
        const n = e.nivel;
        const matchesTab = tab === 'empleado' ? (n === 1 || n === 2) :
                         tab === 'supervisor' ? (n === 3) :
                         tab === 'administrador' ? (n >= 4 && n <= 7) :
                         tab === 'técnico' ? (n >= 8 && n <= 10) : false;
        return matchesTab && e.en_almacen === esPresente;
      })
      .sort((a, b) => {
        const timeA = new Date(esPresente ? a.ultimaJornada?.hora_entrada || '' : a.ultimaJornada?.hora_salida || '').getTime() || 0;
        const timeB = new Date(esPresente ? b.ultimaJornada?.hora_entrada || '' : b.ultimaJornada?.hora_salida || '').getTime() || 0;
        return timeB - timeA;
      });
  };

  const presentes = useMemo(() => filtrarYOrdenar(true, tabActiva), [empleados, tabActiva]);
  const ausentes = useMemo(() => filtrarYOrdenar(false, tabActiva), [empleados, tabActiva]);

  const cantidadExcedidos = presentes.filter(e => {
    const ms = calcularTiempoRaw(e.ultimaJornada?.hora_entrada || null);
    return maxLabor > 0 && ms > maxLabor;
  }).length;

  return (
    <main className="min-h-screen bg-gradient-to-b from-black to-[#050a14] p-4 text-white font-sans">
      <div className="max-w-[100%] mx-auto">
        
        {/* NOTIFICACIÓN TEMPORAL */}
        {mostrarNotificacion && (
          <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-2xl animate-slide-in">
            <p className="text-sm font-black uppercase">ARCHIVO EXPORTADO</p>
          </div>
        )}

        {/* HEADER CON MEMBRETE Y BOTONES */}
        <div className="relative w-full mb-6">
          <MemebreteSuperior 
            usuario={user} 
            onExportar={exportarExcel}
            onRegresar={() => router.push('/reportes')}
          />
        </div>

        {/* TABS CON CONTEO POR ROL - ACTUALIZADO */}
        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          {['empleado', 'supervisor', 'administrador', 'técnico'].map(p => {
            const conteoRol = filtrarYOrdenar(true, p).length;
            return (
              <button 
                key={p} 
                onClick={() => setTabActiva(p)} 
                className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  tabActiva === p 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                    : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {p.toUpperCase()}S ({conteoRol})
              </button>
            );
          })}
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* COLUMNA PRESENTES */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-500 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></span>
                PRESENTES ({presentes.length})
              </h3>
              {cantidadExcedidos > 0 && (
                <span className="text-[10px] font-black uppercase text-lime-400 bg-lime-400/10 px-3 py-1.5 rounded-full border border-lime-400/30">
                  {cantidadExcedidos} EXCEDIDO{ cantidadExcedidos !== 1 ? 'S' : '' }
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {presentes.map(e => {
                const ms = calcularTiempoRaw(e.ultimaJornada?.hora_entrada || null);
                const esExcedido = maxLabor > 0 && ms > maxLabor;
                
                return (
                  <div 
                    key={e.id} 
                    className={`p-4 rounded-xl border-2 transition-all duration-300 shadow-lg flex flex-col items-center ${
                      esExcedido 
                        ? 'border-lime-400 bg-gradient-to-br from-lime-400/10 to-lime-400/5 shadow-lime-400/20' 
                        : 'border-emerald-500 bg-gradient-to-br from-[#0f172a] to-[#1a1a1a]'
                    }`}
                  >
                    <p className="text-white text-sm font-black uppercase truncate w-full text-center leading-none mb-1">
                      {e.nombre}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono mb-2 uppercase">{e.documento_id}</p>
                    
                    <div className="mb-2">
                      <p className={`text-[10px] font-black font-mono tracking-tighter ${
                        esExcedido ? 'text-lime-300' : 'text-white/70'
                      }`}>
                        {formatearFechaHoraUnico(e.ultimaJornada?.hora_entrada || null)}
                      </p>
                    </div>

                    <div className={`w-full py-2 rounded-lg border text-center ${
                      esExcedido 
                        ? 'bg-lime-400/20 border-lime-400/40' 
                        : 'bg-black/40 border-white/10'
                    }`}>
                      <p className={`text-base font-black font-mono italic leading-none ${
                        esExcedido ? 'text-lime-400 animate-pulse' : 'text-blue-500'
                      }`}>
                        {formatearTiempo(ms)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* COLUMNA AUSENTES */}
          <div className="flex-1">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-rose-500 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-rose-600 rounded-full shadow-[0_0_8px_#e11d48]"></span>
              AUSENTES ({ausentes.length})
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {ausentes.map(e => (
                <div 
                  key={e.id} 
                  className="bg-gradient-to-br from-[#0f172a] to-[#1a1a1a] p-4 rounded-xl border border-rose-500/30 flex flex-col items-center"
                >
                  <p className="text-white text-sm font-black uppercase truncate w-full text-center leading-none mb-1">
                    {e.nombre}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono mb-2 uppercase">{e.documento_id}</p>
                  
                  <div className="mb-2">
                    <p className="text-[10px] font-black font-mono text-white/50 tracking-tighter">
                      {formatearFechaHoraUnico(e.ultimaJornada?.hora_salida || null)}
                    </p>
                  </div>

                  <div className="bg-black/40 w-full py-2 rounded-lg border border-white/10 text-center">
                    <p className="text-base font-black font-mono text-rose-400/70 italic leading-none">
                      {formatearTiempo(calcularTiempoRaw(e.ultimaJornada?.hora_salida || null))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
        @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
        select option { background-color: #1f2937; color: white; }
      `}</style>
    </main>
  );
}