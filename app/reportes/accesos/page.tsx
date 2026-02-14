'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// Función para formatear rol
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

// ----- MEMBRETE SUPERIOR (sin subtítulo y sin línea) -----
const MemebreteSuperior = ({ usuario }: { usuario?: any }) => {
  const titulo = "REPORTE DE ACCESOS";
  const palabras = titulo.split(' ');
  const ultimaPalabra = palabras.pop();
  const primerasPalabras = palabras.join(' ');

  return (
    <div className="w-full max-w-sm bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 text-center shadow-2xl mx-auto">
      <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-2">
        <span className="text-white">{primerasPalabras} </span>
        <span className="text-blue-700">{ultimaPalabra}</span>
      </h1>
      {usuario && (
        <div className="mt-2">
          <span className="text-sm text-white normal-case">{usuario.nombre}</span>
          <span className="text-sm text-white mx-2">•</span>
          <span className="text-sm text-blue-500 normal-case">
            {formatearRol(usuario.rol)}
          </span>
          <span className="text-sm text-white ml-2">({usuario.nivel_acceso})</span>
        </div>
      )}
    </div>
  );
};

export default function ReporteAccesosPage() {
  const [jornadas, setJornadas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  // Carga inicial de sesión y datos
  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) setUser(JSON.parse(sessionData));
    fetchJornadas();
    
    const ch = supabase.channel('jornadas_real')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => fetchJornadas())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const fetchJornadas = async () => {
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
  };

  const formatearTiempo = (horasDecimales: number | string | null) => {
    if (!horasDecimales) return "00:00:00";
    const totalSegundos = Math.floor(Number(horasDecimales) * 3600);
    const h = Math.floor(totalSegundos / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSegundos % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(totalSegundos % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

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

  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(jornadasFiltradas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asistencia");
    XLSX.writeFile(wb, "Reporte_Asistencia.xlsx");
  };

  let fechaActual = "";

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER CON MEMBRETE Y BOTONES */}
        <div className="relative w-full mb-8">
          <MemebreteSuperior usuario={user} />
          <div className="absolute top-0 right-0 flex gap-3 mt-6 mr-6">
            <button
              onClick={exportarExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-transform"
            >
              EXPORTAR
            </button>
            <button
              onClick={() => router.push('/reportes')}
              className="bg-blue-800 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-transform"
            >
              REGRESAR
            </button>
          </div>
        </div>

        {/* BUSCADOR Y FILTROS */}
        <div className="flex flex-wrap gap-4 mb-8 bg-[#0f172a] p-6 rounded-[35px] border border-white/5 items-center shadow-xl">
          <input type="text" placeholder="🔍 BUSCAR EMPLEADO..." className="flex-1 min-w-[200px] bg-black/20 border border-white/10 rounded-xl px-5 py-3 text-[11px] font-bold uppercase outline-none focus:border-blue-500" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <input type="date" className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold uppercase outline-none focus:border-blue-500 text-slate-400" value={desde} onChange={e => setDesde(e.target.value)} />
          <input type="date" className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold uppercase outline-none focus:border-blue-500 text-slate-400" value={hasta} onChange={e => setHasta(e.target.value)} />
          <button onClick={limpiarFiltros} className="bg-slate-700 hover:bg-slate-600 px-4 py-3 rounded-xl text-[9px] font-black uppercase transition-colors">Limpiar</button>
        </div>

        {/* TABLA DE DATOS */}
        <div className="overflow-hidden rounded-[40px] border border-white/5 bg-[#0f172a] shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/40 text-[10px] font-black text-slate-500 uppercase italic">
                <th className="p-6">Empleado</th>
                <th className="p-6">Entrada (Fecha y Hora)</th>
                <th className="p-6">Salida (Fecha y Hora)</th>
                <th className="p-6 text-blue-400">Total Horas (HH:MM:SS)</th>
                <th className="p-6 text-center">Estado</th>
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
                        <td colSpan={5} className="px-6 py-2 text-[9px] font-black text-blue-400 uppercase tracking-[0.3em]">
                          📅 {fechaFila}
                        </td>
                      </tr>
                    )}
                    <tr className="hover:bg-white/[0.01] border-b border-white/5 transition-colors">
                      <td className="p-6">
                        <p className="uppercase text-lg tracking-tighter text-white leading-none">
                          {j.nombre_empleado}
                        </p>
                        <p className="text-[10px] font-bold text-white mt-2 uppercase tracking-widest">
                          {j.empleados?.documento_id || j.documento_id || 'S/D'}
                        </p>
                      </td>
                      
                      <td className="p-6 text-[11px] font-bold font-mono text-emerald-500 leading-tight">
                        {new Date(j.hora_entrada).toLocaleDateString('es-ES')}<br/>
                        <span className="text-lg">{new Date(j.hora_entrada).toLocaleTimeString('es-ES')}</span>
                      </td>
                      
                      <td className="p-6 text-[11px] font-bold font-mono text-red-400 leading-tight">
                        {j.hora_salida ? (
                          <>
                            {new Date(j.hora_salida).toLocaleDateString('es-ES')}<br/>
                            <span className="text-lg">{new Date(j.hora_salida).toLocaleTimeString('es-ES')}</span>
                          </>
                        ) : '--/--/--'}
                      </td>

                      <td className="p-6 font-black text-blue-400 italic tracking-tighter">
                        <span className="text-[14px]">
                          {j.estado === 'activo' ? 'En progreso...' : formatearTiempo(j.horas_trabajadas)}
                        </span>
                      </td>

                      <td className="p-6 text-center">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase ${j.estado === 'activo' ? 'bg-emerald-500/20 text-emerald-500 animate-pulse border border-emerald-500/30' : 'bg-slate-500/20 text-slate-400'}`}>
                          {j.estado}
                        </span>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {loading && (
            <div className="p-10 text-center text-[10px] font-black uppercase animate-pulse text-slate-500">
              Sincronizando registros...
            </div>
          )}
        </div>
      </div>
    </main>
  );
}