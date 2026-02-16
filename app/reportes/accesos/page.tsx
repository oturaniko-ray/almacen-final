'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { NotificacionSistema, Buscador } from '../../components'; // ✅ 2 niveles arriba

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// ------------------------------------------------------------
// FUNCIONES AUXILIARES (DEFINIDAS PRIMERO)
// ------------------------------------------------------------

// Función para formatear rol
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

// Función para formatear tiempo (HH:MM:SS)
const formatearTiempo = (horasDecimales: number | string | null) => {
  if (!horasDecimales) return "00:00:00";
  const totalSegundos = Math.floor(Number(horasDecimales) * 3600);
  const h = Math.floor(totalSegundos / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSegundos % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSegundos % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

// ------------------------------------------------------------
// COMPONENTES VISUALES
// ------------------------------------------------------------

// ----- MEMBRETE SUPERIOR -----
const MemebreteSuperior = ({ usuario, onExportar, onRegresar }: { usuario?: any; onExportar: () => void; onRegresar: () => void }) => {
  const titulo = "REPORTE DE ACCESOS";
  const palabras = titulo.split(' ');
  const ultimaPalabra = palabras.pop();
  const primerasPalabras = palabras.join(' ');

  return (
    <div className="relative w-full mb-4">
      <div className="w-full max-w-sm bg-[#1a1a1a] p-5 rounded-[25px] border border-white/5 text-center shadow-2xl mx-auto">
        <h1 className="text-xl font-black italic uppercase tracking-tighter">
          <span className="text-white">{primerasPalabras} </span>
          <span className="text-blue-700">{ultimaPalabra}</span>
        </h1>
        {usuario && (
          <div className="mt-1 text-sm">
            <span className="text-white">{usuario.nombre}</span>
            <span className="text-white mx-1">•</span>
            <span className="text-blue-500">{formatearRol(usuario.rol)}</span>
            <span className="text-white ml-1">({usuario.nivel_acceso})</span>
          </div>
        )}
      </div>
      <div className="absolute top-0 right-0 flex gap-2 mt-4 mr-4">
        <button
          onClick={onExportar}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-transform"
        >
          EXPORTAR
        </button>
        <button
          onClick={onRegresar}
          className="bg-blue-800 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-transform"
        >
          REGRESAR
        </button>
      </div>
    </div>
  );
};

// ------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ------------------------------------------------------------
export default function ReporteAccesosPage() {
  const [jornadas, setJornadas] = useState<any[]>([]);
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
      setJornadas(data);
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
      
    return () => { supabase.removeChannel(ch); };
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
  // EXPORTAR EXCEL
  // ------------------------------------------------------------
  const exportarExcel = () => {
    const data = jornadasFiltradas.map(j => ({
      Empleado: j.nombre_empleado,
      Documento: j.empleados?.documento_id,
      'Fecha Entrada': new Date(j.hora_entrada).toLocaleDateString('es-ES'),
      'Hora Entrada': new Date(j.hora_entrada).toLocaleTimeString('es-ES'),
      'Fecha Salida': j.hora_salida ? new Date(j.hora_salida).toLocaleDateString('es-ES') : '',
      'Hora Salida': j.hora_salida ? new Date(j.hora_salida).toLocaleTimeString('es-ES') : '',
      'Horas Trabajadas': formatearTiempo(j.horas_trabajadas),
      Estado: j.estado
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asistencia");
    XLSX.writeFile(wb, `Reporte_Asistencia_${new Date().toISOString().slice(0, 10)}.xlsx`);
    
    mostrarNotificacion('✅ ARCHIVO EXPORTADO', 'exito');
  };

  // ------------------------------------------------------------
  // REGRESAR
  // ------------------------------------------------------------
  const handleRegresar = () => {
    router.push('/reportes');
  };

  // ------------------------------------------------------------
  // RENDERIZADO
  // ------------------------------------------------------------
  let fechaActual = "";

  return (
    <main className="min-h-screen bg-[#050a14] p-3 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* NOTIFICACIÓN FLOTANTE */}
        <NotificacionSistema
          mensaje={notificacion.mensaje}
          tipo={notificacion.tipo}
          visible={!!notificacion.tipo}
          duracion={2000}
          onCerrar={() => setNotificacion({ mensaje: '', tipo: null })}
        />

        {/* HEADER */}
        <MemebreteSuperior 
          usuario={user} 
          onExportar={exportarExcel}
          onRegresar={handleRegresar}
        />

        {/* FILTROS EN UNA SOLA LÍNEA - Grid 8 columnas */}
        <div className="bg-[#0f172a] p-3 rounded-xl border border-white/5 mb-3">
          <div className="grid grid-cols-8 gap-2 items-center">
            {/* Columna 1-4: BUSCADOR */}
            <div className="col-span-4">
              <Buscador
                placeholder="BUSCAR EMPLEADO..."
                value={busqueda}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBusqueda(e.target.value)}
                onClear={() => setBusqueda('')}
              />
            </div>
            
            {/* Columna 5: FECHA DESDE */}
            <div className="col-span-1">
              <input
                type="date"
                className="w-full bg-white/5 border border-white/10 p-2 rounded-lg text-[11px] font-bold uppercase outline-none focus:border-blue-500 text-slate-400"
                value={desde}
                onChange={e => setDesde(e.target.value)}
                placeholder="DESDE"
              />
            </div>
            
            {/* Columna 6: FECHA HASTA */}
            <div className="col-span-1">
              <input
                type="date"
                className="w-full bg-white/5 border border-white/10 p-2 rounded-lg text-[11px] font-bold uppercase outline-none focus:border-blue-500 text-slate-400"
                value={hasta}
                onChange={e => setHasta(e.target.value)}
                placeholder="HASTA"
              />
            </div>
            
            {/* Columna 7: BOTÓN LIMPIAR */}
            <div className="col-span-1">
              <button
                onClick={limpiarFiltros}
                className="w-full bg-slate-700 hover:bg-slate-600 p-2 rounded-lg text-[9px] font-black uppercase transition-colors"
              >
                LIMPIAR
              </button>
            </div>
            
            {/* Columna 8: VACÍA */}
            <div className="col-span-1"></div>
          </div>
        </div>

        {/* TABLA DE DATOS */}
        <div className="overflow-hidden rounded-xl border border-white/5 bg-[#0f172a] shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-black/40 text-[9px] font-black text-slate-500 uppercase italic">
                <tr>
                  <th className="p-3">EMPLEADO</th>
                  <th className="p-3">ENTRADA</th>
                  <th className="p-3">SALIDA</th>
                  <th className="p-3 text-center">HORAS</th>
                  <th className="p-3 text-center">ESTADO</th>
                </tr>
              </thead>
              <tbody>
                {jornadasFiltradas.map((j) => {
                  const fechaFila = new Date(j.hora_entrada).toLocaleDateString('es-ES');
                  const mostrarSeparador = fechaFila !== fechaActual;
                  fechaActual = fechaFila;

                  return (
                    <React.Fragment key={j.id}>
                      {mostrarSeparador && (
                        <tr className="bg-white/5">
                          <td colSpan={5} className="px-3 py-1.5 text-[8px] font-black text-blue-400 uppercase tracking-[0.3em]">
                            📅 {fechaFila}
                          </td>
                        </tr>
                      )}
                      <tr className="hover:bg-white/[0.01] border-b border-white/5 transition-colors">
                        <td className="p-3">
                          <p className="uppercase text-sm font-black text-white leading-none">
                            {j.nombre_empleado}
                          </p>
                          <p className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase">
                            {j.empleados?.documento_id || j.documento_id || 'S/D'}
                          </p>
                        </td>
                        
                        <td className="p-3">
                          <p className="text-[9px] font-bold font-mono text-emerald-500">
                            {new Date(j.hora_entrada).toLocaleDateString('es-ES')}
                          </p>
                          <p className="text-[11px] font-black font-mono text-emerald-500">
                            {new Date(j.hora_entrada).toLocaleTimeString('es-ES')}
                          </p>
                        </td>
                        
                        <td className="p-3">
                          {j.hora_salida ? (
                            <>
                              <p className="text-[9px] font-bold font-mono text-red-400">
                                {new Date(j.hora_salida).toLocaleDateString('es-ES')}
                              </p>
                              <p className="text-[11px] font-black font-mono text-red-400">
                                {new Date(j.hora_salida).toLocaleTimeString('es-ES')}
                              </p>
                            </>
                          ) : (
                            <p className="text-[11px] font-black font-mono text-slate-600">--/--/--</p>
                          )}
                        </td>

                        <td className="p-3 text-center font-black text-blue-400 italic">
                          <span className="text-[11px]">
                            {j.estado === 'activo' ? 'En progreso...' : formatearTiempo(j.horas_trabajadas)}
                          </span>
                        </td>

                        <td className="p-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase ${
                            j.estado === 'activo' 
                              ? 'bg-emerald-500/20 text-emerald-500 animate-pulse border border-emerald-500/30' 
                              : 'bg-slate-500/20 text-slate-400'
                          }`}>
                            {j.estado}
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
            <div className="p-6 text-center text-[9px] font-black uppercase animate-pulse text-slate-500">
              Sincronizando registros...
            </div>
          )}
          {!loading && jornadasFiltradas.length === 0 && (
            <div className="p-10 text-center text-slate-500 text-[9px] font-black uppercase">
              No hay registros que coincidan con la búsqueda.
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