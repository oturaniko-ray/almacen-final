'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Función para formatear rol
const formatearRol = (rol: string): string => {
  if (!rol) return 'CONDUCTOR';
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

// ----- MEMBRETE SUPERIOR -----
const MemebreteSuperior = ({ usuario }: { usuario?: any }) => {
  const titulo = "REPORTES DE FLOTA";
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

export default function ReportesFlotaPage() {
  const [user, setUser] = useState<any>(null);
  const [tabActiva, setTabActiva] = useState<'presencia' | 'accesos'>('presencia');
  const [loading, setLoading] = useState(false);
  const [maximoPatio, setMaximoPatio] = useState<number>(0);
  const [ahora, setAhora] = useState(new Date());
  const router = useRouter();

  const [perfiles, setPerfiles] = useState<any[]>([]);
  const [accesosActivos, setAccesosActivos] = useState<any[]>([]);
  const [accesos, setAccesos] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);

    const { data: config } = await supabase
      .from('sistema_config')
      .select('valor')
      .eq('clave', 'maximo_labor')
      .maybeSingle();
    if (config) {
      const val = parseInt(config.valor, 10);
      if (!isNaN(val)) setMaximoPatio(val);
    }

    const { data: perfilesData } = await supabase
      .from('flota_perfil')
      .select('*')
      .eq('activo', true)
      .order('nombre_completo');
    if (perfilesData) setPerfiles(perfilesData);

    const { data: activosData } = await supabase
      .from('flota_accesos')
      .select('*, flota_perfil!inner(*)')
      .is('hora_salida', null)
      .order('hora_llegada', { ascending: false });
    if (activosData) setAccesosActivos(activosData);

    const { data: accesosData } = await supabase
      .from('flota_accesos')
      .select('*, flota_perfil!inner(*)')
      .order('hora_llegada', { ascending: false });
    if (accesosData) setAccesos(accesosData);

    setLoading(false);
  }, []);

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) {
      router.replace('/');
      return;
    }
    const currentUser = JSON.parse(sessionData);
    if (Number(currentUser.nivel_acceso) < 5) {
      router.replace('/admin');
      return;
    }
    setUser(currentUser);
    fetchData();

    const interval = setInterval(() => setAhora(new Date()), 1000);

    const channel = supabase
      .channel('reportes_flota')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flota_perfil' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flota_accesos' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sistema_config' }, () => fetchData())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchData, router]);

  const calcularTiempoRaw = (fechaIso: string | null) => {
    if (!fechaIso) return 0;
    return ahora.getTime() - new Date(fechaIso).getTime();
  };

  const formatearTiempo = (ms: number) => {
    const totalSegundos = Math.floor(ms / 1000);
    const h = Math.floor(totalSegundos / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSegundos % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSegundos % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const formatearFechaHora = (fechaIso: string | null) => {
    if (!fechaIso) return '--/-- --:--:--';
    const d = new Date(fechaIso);
    const fecha = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    const hora = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    return `${fecha} ${hora}`;
  };

  const presentes = useMemo(() => {
    return accesosActivos.map(a => ({
      ...a.flota_perfil,
      acceso: a
    }));
  }, [accesosActivos]);

  const ausentes = useMemo(() => {
    const presentesIds = new Set(presentes.map(p => p.id));
    return perfiles.filter(p => !presentesIds.has(p.id));
  }, [perfiles, presentes]);

  const accesosFiltrados = useMemo(() => {
    return accesos.filter(a => {
      const fecha = a.hora_llegada.split('T')[0];
      const matchNombre = a.flota_perfil?.nombre_completo?.toLowerCase().includes(busqueda.toLowerCase());
      const matchDoc = a.flota_perfil?.documento_id?.toLowerCase().includes(busqueda.toLowerCase());
      const matchDesde = desde ? fecha >= desde : true;
      const matchHasta = hasta ? fecha <= hasta : true;
      return (matchNombre || matchDoc) && matchDesde && matchHasta;
    });
  }, [accesos, busqueda, desde, hasta]);

  const exportarExcel = () => {
    if (tabActiva === 'presencia') {
      const data = presentes.map(p => ({
        Nombre: p.nombre_completo,
        Documento: p.documento_id,
        Flota: p.nombre_flota,
        'Hora Llegada': formatearFechaHora(p.acceso.hora_llegada),
        'Tiempo': formatearTiempo(calcularTiempoRaw(p.acceso.hora_llegada))
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Presencia');
      XLSX.writeFile(wb, `Presencia_Flota_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } else {
      const data = accesosFiltrados.map(a => ({
        Nombre: a.flota_perfil?.nombre_completo,
        Documento: a.flota_perfil?.documento_id,
        Flota: a.flota_perfil?.nombre_flota,
        Llegada: formatearFechaHora(a.hora_llegada),
        Salida: formatearFechaHora(a.hora_salida),
        'Horas Patio': a.horas_en_patio?.toFixed(2),
        Estado: a.estado
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Accesos');
      XLSX.writeFile(wb, `Accesos_Flota_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }
  };

  const limpiarFiltros = () => {
    setBusqueda('');
    setDesde('');
    setHasta('');
  };

  return (
    <main className="min-h-screen bg-[#050a14] p-4 md:p-8 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="relative w-full mb-6">
          <MemebreteSuperior usuario={user} />
          <div className="absolute top-0 right-0 flex gap-3 mt-6 mr-6">
            <button
              onClick={exportarExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-transform"
            >
              EXPORTAR
            </button>
            <button
              onClick={() => router.push('/admin/flota')}
              className="bg-blue-800 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-transform"
            >
              REGRESAR
            </button>
          </div>
        </div>

        {/* PESTAÑAS */}
        <div className="flex gap-1 mb-6 justify-center">
          <button
            onClick={() => setTabActiva('presencia')}
            className={`px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
              tabActiva === 'presencia'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            PRESENCIA
          </button>
          <button
            onClick={() => setTabActiva('accesos')}
            className={`px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
              tabActiva === 'accesos'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            ACCESOS
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            {tabActiva === 'presencia' && (
              <div className="flex flex-col lg:flex-row gap-8">
                {/* COLUMNA PRESENTES */}
                <div className="flex-1">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500 flex items-center gap-2 mb-4">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></span>
                    EN PATIO ({presentes.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {presentes.map(p => {
                      const ms = calcularTiempoRaw(p.acceso.hora_llegada);
                      const excedido = maximoPatio > 0 && ms > maximoPatio;
                      return (
                        <div
                          key={p.id}
                          className={`p-4 rounded-[20px] border-2 transition-all duration-300 shadow-lg flex flex-col items-center ${
                            excedido
                              ? 'border-lime-400 bg-lime-400/10 shadow-[0_0_15px_rgba(163,230,53,0.3)]'
                              : 'border-emerald-500 bg-[#0f172a]'
                          }`}
                        >
                          <p className="text-white text-[12px] font-black uppercase truncate w-full text-center leading-none mb-1">
                            {p.nombre_completo}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono mb-2 uppercase">{p.documento_id}</p>
                          <div className="mb-3">
                            <p className={`text-[11px] font-black font-mono tracking-tighter ${excedido ? 'text-lime-300' : 'text-white'}`}>
                              {formatearFechaHora(p.acceso.hora_llegada)}
                            </p>
                          </div>
                          <div className={`w-full py-2 rounded-xl border text-center ${
                            excedido ? 'bg-lime-400/20 border-lime-400/40' : 'bg-black/40 border-white/5'
                          }`}>
                            <p className={`text-lg font-black font-mono italic leading-none ${
                              excedido ? 'text-lime-400 animate-pulse' : 'text-blue-500'
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
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500 mb-6 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-rose-600 rounded-full shadow-[0_0_8px_#e11d48]"></span>
                    AUSENTES ({ausentes.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {ausentes.map(p => (
                      <div key={p.id} className="bg-[#0f172a] p-4 rounded-[20px] border border-rose-500/30 flex flex-col items-center">
                        <p className="text-white text-[12px] font-black uppercase truncate w-full text-center leading-none mb-1">
                          {p.nombre_completo}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono mb-2 uppercase">{p.documento_id}</p>
                        <div className="mb-3">
                          <p className="text-[11px] font-black font-mono text-white tracking-tighter">
                            --/-- --:--:--
                          </p>
                        </div>
                        <div className="bg-black/20 w-full py-2 rounded-xl border border-white/5 text-center">
                          <p className="text-lg font-black font-mono text-rose-400 italic leading-none">
                            00:00:00
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tabActiva === 'accesos' && (
              <>
                {/* FILTROS */}
                <div className="flex flex-wrap gap-4 mb-8 bg-[#0f172a] p-6 rounded-[35px] border border-white/5 items-center shadow-xl">
                  <input
                    type="text"
                    placeholder="🔍 BUSCAR PERFIL..."
                    className="flex-1 min-w-[200px] bg-black/20 border border-white/10 rounded-xl px-5 py-3 text-[11px] font-bold uppercase outline-none focus:border-blue-500"
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                  />
                  <input
                    type="date"
                    className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold uppercase outline-none focus:border-blue-500 text-slate-400"
                    value={desde}
                    onChange={e => setDesde(e.target.value)}
                  />
                  <input
                    type="date"
                    className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold uppercase outline-none focus:border-blue-500 text-slate-400"
                    value={hasta}
                    onChange={e => setHasta(e.target.value)}
                  />
                  <button
                    onClick={limpiarFiltros}
                    className="bg-slate-700 hover:bg-slate-600 px-4 py-3 rounded-xl text-[9px] font-black uppercase transition-colors"
                  >
                    Limpiar
                  </button>
                </div>

                {/* TABLA DE ACCESOS */}
                <div className="overflow-hidden rounded-[40px] border border-white/5 bg-[#0f172a] shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-black/40 text-[10px] font-black text-slate-500 uppercase italic">
                          <th className="p-6">Perfil</th>
                          <th className="p-6">Documento</th>
                          <th className="p-6">Flota</th>
                          <th className="p-6">Llegada</th>
                          <th className="p-6">Salida</th>
                          <th className="p-6 text-center">Horas</th>
                          <th className="p-6 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accesosFiltrados.map((a) => (
                          <tr key={a.id} className="hover:bg-white/[0.02] border-b border-white/5">
                            <td className="p-6">
                              <p className="uppercase text-sm font-black text-white">{a.flota_perfil?.nombre_completo}</p>
                            </td>
                            <td className="p-6 font-mono text-[12px]">{a.flota_perfil?.documento_id}</td>
                            <td className="p-6">{a.flota_perfil?.nombre_flota || '-'}</td>
                            <td className="p-6 text-[11px] font-mono text-emerald-500">
                              {formatearFechaHora(a.hora_llegada)}
                            </td>
                            <td className="p-6 text-[11px] font-mono text-red-400">
                              {a.hora_salida ? formatearFechaHora(a.hora_salida) : '--/-- --:--:--'}
                            </td>
                            <td className="p-6 text-center font-black text-blue-400">
                              {a.horas_en_patio?.toFixed(2) || '-'}
                            </td>
                            <td className="p-6 text-center">
                              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                                a.estado === 'despachado'
                                  ? 'bg-emerald-500/20 text-emerald-500'
                                  : a.estado === 'en_patio'
                                  ? 'bg-amber-500/20 text-amber-500'
                                  : 'bg-slate-500/20 text-slate-400'
                              }`}>
                                {a.estado || 'en_patio'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {accesosFiltrados.length === 0 && (
                    <div className="p-10 text-center text-slate-500 text-[11px] font-black uppercase">
                      No hay accesos que coincidan con la búsqueda.
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <style jsx global>{`
        @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
        @keyframes flash-fast {
          0%, 100% { opacity: 1; }
          10%, 30%, 50% { opacity: 0; }
          20%, 40%, 60% { opacity: 1; }
        }
        .animate-flash-fast {
          animation: flash-fast 2s ease-in-out;
        }
      `}</style>
    </main>
  );
}