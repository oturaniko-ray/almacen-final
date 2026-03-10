'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import * as XLSX from '@e965/xlsx';
import { NotificacionSistema, Buscador } from '../../components';

// ------------------------------------------------------------
// INTERFACES PARA TIPADO
// ------------------------------------------------------------
interface Jornada {
  id: string;
  empleado_id: string;
  nombre_empleado: string;
  documento_id?: string;
  hora_entrada: string;
  hora_salida: string | null;
  horas_trabajadas: number | null;
  estado: 'activo' | 'completado' | 'ausente';
  empleados?: {
    documento_id: string;
  };
}

interface EmpleadoInfo {
  documento_id: string;
}

// ------------------------------------------------------------
// FUNCIONES AUXILIARES
// ------------------------------------------------------------
const formatearRol = (rol: string): string => {
  if (!rol) return 'USUARIO';
  const rolLower = rol.toLowerCase();
  switch (rolLower) {
    case 'admin': case 'administrador': return 'ADMIN';
    case 'supervisor': return 'SUPERV';
    case 'tecnico': return 'TECNICO';
    case 'empleado': return 'EMPLEADO';
    default: return rol.toUpperCase();
  }
};

const formatearTiempo = (horasDecimales: number | string | null): string => {
  if (!horasDecimales) return "00:00:00";
  const totalSegundos = Math.floor(Number(horasDecimales) * 3600);
  const h = Math.floor(totalSegundos / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSegundos % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSegundos % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
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
// COMPONENTES VISUALES
// ------------------------------------------------------------

// ----- MEMBRETE SUPERIOR (ACTUALIZADO) -----
const MemebreteSuperior = ({ 
  usuario, 
  onExportar, 
  onRegresar 
}: { 
  usuario?: any; 
  onExportar: () => void; 
  onRegresar: () => void;
}) => {
  const titulo = "REPORTE DE ACCESOS";
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
export default function ReporteAccesosPage() {
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [user, setUser] = useState<any>(null);
  const [notificacion, setNotificacion] = useState<{ mensaje: string; tipo: 'exito' | 'error' | 'advertencia' | null }>({ mensaje: '', tipo: null });
  const router = useRouter();

  // ------------------------------------------------------------
  // CARGAR DATOS
  // ------------------------------------------------------------
  const fetchJornadas = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('jornadas')
      .select(`
        *,
        empleados!inner (
          documento_id
        )
      `)
      .order('hora_entrada', { ascending: false });

    if (!error && data) {
      setJornadas(data as Jornada[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) setUser(JSON.parse(sessionData));
    fetchJornadas();
    
    const ch = supabase
      .channel('jornadas_real')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => fetchJornadas())
      .subscribe();
      
    return () => { 
      supabase.removeChannel(ch).catch(console.error); 
    };
  }, [fetchJornadas]);

  // ------------------------------------------------------------
  // MOSTRAR NOTIFICACIÓN
  // ------------------------------------------------------------
  const mostrarNotificacion = (mensaje: string, tipo: 'exito' | 'error' | 'advertencia') => {
    setNotificacion({ mensaje, tipo });
    setTimeout(() => setNotificacion({ mensaje: '', tipo: null }), 2000);
  };

  // ------------------------------------------------------------
  // FILTROS
  // ------------------------------------------------------------
  const limpiarFiltros = () => {
    setBusqueda('');
    setDesde('');
    setHasta('');
  };

  const jornadasFiltradas = jornadas.filter(j => {
    const f = j.hora_entrada.split('T')[0];
    const matchNombre = j.nombre_empleado?.toLowerCase().includes(busqueda.toLowerCase());
    const matchDesde = desde ? f >= desde : true;
    const matchHasta = hasta ? f <= hasta : true;
    return matchNombre && matchDesde && matchHasta;
  });

  // ------------------------------------------------------------
  // EXPORTAR EXCEL - ACTUALIZADO
  // ------------------------------------------------------------
  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    
    const data = jornadasFiltradas.map(j => ({
      Empleado: j.nombre_empleado,
      Documento: j.empleados?.documento_id || j.documento_id || '',
      'Fecha Entrada': new Date(j.hora_entrada).toLocaleDateString('es-ES'),
      'Hora Entrada': new Date(j.hora_entrada).toLocaleTimeString('es-ES'),
      'Fecha Salida': j.hora_salida ? new Date(j.hora_salida).toLocaleDateString('es-ES') : '',
      'Hora Salida': j.hora_salida ? new Date(j.hora_salida).toLocaleTimeString('es-ES') : '',
      'Horas Trabajadas': formatearTiempo(j.horas_trabajadas),
      Estado: j.estado === 'activo' ? 'EN PROGRESO' : j.estado === 'completado' ? 'COMPLETADO' : 'AUSENTE'
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    
    const columnWidths = [
      { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
      { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }
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
    
    const titulo = `REPORTE DE ACCESOS`;
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
    
    XLSX.utils.book_append_sheet(wb, ws, "Accesos");
    
    const timestamp = getTimestamp();
    const filename = `acceso_${timestamp}.xlsx`;
    
    XLSX.writeFile(wb, filename);
    
    mostrarNotificacion('ARCHIVO EXPORTADO', 'exito');
  };

  // ------------------------------------------------------------
  // REGRESAR
  // ------------------------------------------------------------
  const handleRegresar = () => {
    router.push('/reportes');
  };

  // ------------------------------------------------------------
  // RENDERIZADO - UI ACTUALIZADA
  // ------------------------------------------------------------
  let fechaActual = "";

  return (
    <main className="min-h-screen bg-gradient-to-b from-black to-[#050a14] p-3 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        
        <NotificacionSistema
          mensaje={notificacion.mensaje}
          tipo={notificacion.tipo}
          visible={!!notificacion.tipo}
          duracion={2000}
          onCerrar={() => setNotificacion({ mensaje: '', tipo: null })}
        />

        <MemebreteSuperior 
          usuario={user} 
          onExportar={exportarExcel}
          onRegresar={handleRegresar}
        />

        <div className="bg-gradient-to-br from-[#0f172a] to-[#1a1a1a] p-4 rounded-xl border border-blue-500/20 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-8 gap-3 items-center">
            <div className="md:col-span-4">
              <Buscador
                placeholder="BUSCAR EMPLEADO..."
                value={busqueda}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBusqueda(e.target.value)}
                onClear={() => setBusqueda('')}
                className="bg-black/30 border-white/10 focus:border-blue-500"
              />
            </div>
            
            <div className="md:col-span-1">
              <input
                type="date"
                className="w-full bg-black/30 border border-white/10 p-2.5 rounded-lg text-xs font-bold uppercase outline-none focus:border-blue-500 text-slate-300"
                value={desde}
                onChange={e => setDesde(e.target.value)}
                placeholder="DESDE"
              />
            </div>
            
            <div className="md:col-span-1">
              <input
                type="date"
                className="w-full bg-black/30 border border-white/10 p-2.5 rounded-lg text-xs font-bold uppercase outline-none focus:border-blue-500 text-slate-300"
                value={hasta}
                onChange={e => setHasta(e.target.value)}
                placeholder="HASTA"
              />
            </div>
            
            <div className="md:col-span-1">
              <button
                onClick={limpiarFiltros}
                className="w-full bg-slate-700 hover:bg-slate-600 p-2.5 rounded-lg text-xs font-black uppercase transition-colors"
              >
                LIMPIAR
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#0f172a] to-[#1a1a1a] rounded-xl border border-blue-500/20 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-black/40 text-[10px] font-black text-blue-400 uppercase tracking-wider border-b border-blue-500/20">
                <tr>
                  <th className="p-3">EMPLEADO</th>
                  <th className="p-3">ENTRADA</th>
                  <th className="p-3">SALIDA</th>
                  <th className="p-3 text-center">HORAS</th>
                  <th className="p-3 text-center">ESTADO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-500/10">
                {jornadasFiltradas.map((j) => {
                  const fechaFila = new Date(j.hora_entrada).toLocaleDateString('es-ES');
                  const mostrarSeparador = fechaFila !== fechaActual;
                  fechaActual = fechaFila;

                  return (
                    <React.Fragment key={j.id}>
                      {mostrarSeparador && (
                        <tr className="bg-blue-600/10">
                          <td colSpan={5} className="px-3 py-2 text-[9px] font-black text-blue-500 uppercase tracking-[0.2em]">
                            {fechaFila}
                          </td>
                        </tr>
                      )}
                      <tr className="hover:bg-blue-500/5 transition-colors">
                        <td className="p-3">
                          <p className="uppercase text-sm font-black text-white leading-none">
                            {j.nombre_empleado}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
                            {j.empleados?.documento_id || j.documento_id || 'S/D'}
                          </p>
                        </td>
                        
                        <td className="p-3">
                          <p className="text-[10px] font-bold font-mono text-emerald-500">
                            {new Date(j.hora_entrada).toLocaleDateString('es-ES')}
                          </p>
                          <p className="text-xs font-black font-mono text-emerald-500">
                            {new Date(j.hora_entrada).toLocaleTimeString('es-ES')}
                          </p>
                        </td>
                        
                        <td className="p-3">
                          {j.hora_salida ? (
                            <>
                              <p className="text-[10px] font-bold font-mono text-red-400">
                                {new Date(j.hora_salida).toLocaleDateString('es-ES')}
                              </p>
                              <p className="text-xs font-black font-mono text-red-400">
                                {new Date(j.hora_salida).toLocaleTimeString('es-ES')}
                              </p>
                            </>
                          ) : (
                            <p className="text-xs font-black font-mono text-slate-600">--/--/----</p>
                          )}
                        </td>

                        <td className="p-3 text-center font-black text-blue-400">
                          <span className="text-xs">
                            {j.estado === 'activo' ? 'En progreso...' : formatearTiempo(j.horas_trabajadas)}
                          </span>
                        </td>

                        <td className="p-3 text-center">
                          <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase ${
                            j.estado === 'activo' 
                              ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' 
                              : j.estado === 'completado'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            {j.estado === 'activo' ? 'ACTIVO' : j.estado === 'completado' ? 'COMPLETADO' : 'AUSENTE'}
                          </span>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {loading && (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-3"></div>
              <p className="text-xs font-black uppercase text-slate-500">Sincronizando registros...</p>
            </div>
          )}
          {!loading && jornadasFiltradas.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-slate-500 text-xs font-black uppercase">No hay registros que coincidan con la búsqueda.</p>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
        @keyframes flash-fast {
          0%, 100% { opacity: 1; }
          10%, 30%, 50% { opacity: 0; }
          20%, 40%, 60% { opacity: 1; }
        }
        .animate-flash-fast { animation: flash-fast 2s ease-in-out; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.8); }
      `}</style>
    </main>
  );
}