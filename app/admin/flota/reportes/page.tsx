'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ------------------------------------------------------------
// FUNCIONES AUXILIARES (DEFINIDAS PRIMERO)
// ------------------------------------------------------------

// Función para formatear rol
const formatearRol = (rol: string): string => {
  if (!rol) return 'CONDUCTOR';
  const rolLower = rol.toLowerCase();
  switch (rolLower) {
    case 'admin': case 'administrador': return 'ADMIN';
    case 'supervisor': return 'SUPERV';
    case 'tecnico': return 'TECNICO';
    case 'empleado': return 'EMPLEADO';
    default: return rol.toUpperCase();
  }
};

// Función para formatear tiempo
const formatearTiempo = (ms: number) => {
  const totalSegundos = Math.floor(ms / 1000);
  const h = Math.floor(totalSegundos / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSegundos % 3600) / 60).toString().padStart(2, '0');
  const s = (totalSegundos % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

// Función para formatear fecha y hora
const formatearFechaHora = (fechaIso: string | null) => {
  if (!fechaIso) return '--/-- --:--:--';
  const d = new Date(fechaIso);
  const fecha = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  const hora = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return `${fecha} ${hora}`;
};

// Función para formatear fecha título
const formatearFechaTitulo = (fechaStr: string) => {
  const fecha = new Date(fechaStr);
  return fecha.toLocaleDateString('es-ES', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

// ------------------------------------------------------------
// COMPONENTES VISUALES
// ------------------------------------------------------------

// ----- MEMBRETE SUPERIOR -----
const MemebreteSuperior = ({ usuario, onExportar, onRegresar }: { usuario?: any; onExportar: () => void; onRegresar: () => void }) => {
  const titulo = "REPORTES DE FLOTA";
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

// ----- MODAL DE OBSERVACIÓN -----
const ModalObservacion = ({ isOpen, onClose, observacion, nombre }: { isOpen: boolean; onClose: () => void; observacion: string; nombre: string }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a1a1a] border-2 border-blue-500/30 rounded-[30px] p-6 max-w-lg w-full shadow-2xl animate-modal-appear">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-black text-lg uppercase">Observación de {nombre}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white">
            ✕
          </button>
        </div>
        <div className="bg-[#0f172a] p-6 rounded-2xl border border-white/10">
          <p className="text-white text-base leading-relaxed whitespace-pre-wrap">{observacion || 'Sin observación'}</p>
        </div>
        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 rounded-xl text-sm uppercase tracking-wider">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

// ----- BUSCADOR COMPACTO -----
const Buscador = ({ placeholder, value, onChange, onClear }: any) => (
  <div className="bg-black/20 rounded-lg flex items-center">
    <span className="text-white/40 ml-2 text-xs">🔍</span>
    <input
      type="text"
      placeholder={placeholder}
      className="w-full bg-transparent px-2 py-1.5 text-[11px] font-bold uppercase outline-none text-white"
      value={value}
      onChange={onChange}
    />
    {value && (
      <button onClick={onClear} className="mr-1 text-white/60 hover:text-white text-xs">
        ✕
      </button>
    )}
  </div>
);

// ------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ------------------------------------------------------------
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
  
  // Estado para el modal de observación
  const [modalOpen, setModalOpen] = useState(false);
  const [observacionSeleccionada, setObservacionSeleccionada] = useState('');
  const [nombreSeleccionado, setNombreSeleccionado] = useState('');

  // ------------------------------------------------------------
  // CARGAR DATOS
  // ------------------------------------------------------------
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
    if (accesosData) {
      const accesosConHoras = accesosData.map(acceso => {
        if (acceso.hora_salida && acceso.hora_llegada) {
          const llegada = new Date(acceso.hora_llegada).getTime();
          const salida = new Date(acceso.hora_salida).getTime();
          const horasEnPatio = ((salida - llegada) / (1000 * 60 * 60)).toFixed(2);
          return { ...acceso, horas_en_patio: parseFloat(horasEnPatio) };
        }
        return acceso;
      });
      setAccesos(accesosConHoras);
    }

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

  // ------------------------------------------------------------
  // CÁLCULOS Y FILTROS
  // ------------------------------------------------------------
  const calcularTiempoRaw = (fechaIso: string | null) => {
    if (!fechaIso) return 0;
    return ahora.getTime() - new Date(fechaIso).getTime();
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
      const fecha = a.hora_llegada?.split('T')[0] || '';
      const matchNombre = a.flota_perfil?.nombre_completo?.toLowerCase().includes(busqueda.toLowerCase());
      const matchDoc = a.flota_perfil?.documento_id?.toLowerCase().includes(busqueda.toLowerCase());
      const matchDesde = desde ? fecha >= desde : true;
      const matchHasta = hasta ? fecha <= hasta : true;
      return (matchNombre || matchDoc) && matchDesde && matchHasta;
    });
  }, [accesos, busqueda, desde, hasta]);

  const accesosPorFecha = useMemo(() => {
    const agrupados: Record<string, any[]> = {};
    
    accesosFiltrados.forEach(acceso => {
      const fecha = acceso.hora_llegada?.split('T')[0] || 'Sin fecha';
      if (!agrupados[fecha]) {
        agrupados[fecha] = [];
      }
      agrupados[fecha].push(acceso);
    });
    
    return Object.entries(agrupados)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([fecha, accesos]) => ({
        fecha,
        accesos
      }));
  }, [accesosFiltrados]);

  // ------------------------------------------------------------
  // MANEJADORES
  // ------------------------------------------------------------
  const abrirObservacion = (observacion: string, nombre: string) => {
    setObservacionSeleccionada(observacion);
    setNombreSeleccionado(nombre);
    setModalOpen(true);
  };

  const limpiarFiltros = () => {
    setBusqueda('');
    setDesde('');
    setHasta('');
  };

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
        Fecha: a.hora_llegada?.split('T')[0] || '',
        Nombre: a.flota_perfil?.nombre_completo,
        Documento: a.flota_perfil?.documento_id,
        Flota: a.flota_perfil?.nombre_flota,
        Llegada: formatearFechaHora(a.hora_llegada),
        Salida: formatearFechaHora(a.hora_salida),
        'Horas Patio': a.horas_en_patio?.toFixed(2) || '-',
        'Carga Recogida': a.cant_carga || 0,
        'Observación': a.observacion || '-',
        Estado: a.estado
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Accesos');
      XLSX.writeFile(wb, `Accesos_Flota_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }
  };

  const handleRegresar = () => {
    router.push('/admin/flota');
  };

  // ------------------------------------------------------------
  // RENDERIZADO
  // ------------------------------------------------------------
  return (
    <main className="min-h-screen bg-[#050a14] p-3 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <MemebreteSuperior 
          usuario={user} 
          onExportar={exportarExcel}
          onRegresar={handleRegresar}
        />

        {/* PESTAÑAS */}
        <div className="flex gap-1 mb-3 justify-center">
          <button
            onClick={() => setTabActiva('presencia')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              tabActiva === 'presencia'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            PRESENCIA
          </button>
          <button
            onClick={() => setTabActiva('accesos')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
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
              <div className="flex flex-col lg:flex-row gap-4">
                {/* COLUMNA PRESENTES */}
                <div className="flex-1">
                  <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-500 flex items-center gap-2 mb-3">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                    EN PATIO ({presentes.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {presentes.map(p => {
                      const ms = calcularTiempoRaw(p.acceso.hora_llegada);
                      const excedido = maximoPatio > 0 && ms > maximoPatio;
                      return (
                        <div
                          key={p.id}
                          className={`p-3 rounded-xl border-2 transition-all shadow-lg flex flex-col items-center ${
                            excedido
                              ? 'border-lime-400 bg-lime-400/10'
                              : 'border-emerald-500 bg-[#0f172a]'
                          }`}
                        >
                          <p className="text-white text-[11px] font-black uppercase truncate w-full text-center leading-none mb-1">
                            {p.nombre_completo}
                          </p>
                          <p className="text-[9px] text-slate-400 font-mono mb-1 uppercase">{p.documento_id}</p>
                          <p className={`text-[9px] font-black font-mono ${excedido ? 'text-lime-300' : 'text-white'}`}>
                            {formatearFechaHora(p.acceso.hora_llegada)}
                          </p>
                          <div className={`w-full mt-2 py-1 rounded-lg border text-center ${
                            excedido ? 'bg-lime-400/20 border-lime-400/40' : 'bg-black/40 border-white/5'
                          }`}>
                            <p className={`text-sm font-black font-mono italic ${
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
                  <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-rose-500 mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-rose-600 rounded-full"></span>
                    AUSENTES ({ausentes.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {ausentes.map(p => (
                      <div key={p.id} className="bg-[#0f172a] p-3 rounded-xl border border-rose-500/30 flex flex-col items-center">
                        <p className="text-white text-[11px] font-black uppercase truncate w-full text-center leading-none mb-1">
                          {p.nombre_completo}
                        </p>
                        <p className="text-[9px] text-slate-500 font-mono mb-1 uppercase">{p.documento_id}</p>
                        <p className="text-[9px] font-black font-mono text-white">
                          --/-- --:--:--
                        </p>
                        <div className="bg-black/20 w-full mt-2 py-1 rounded-lg border border-white/5 text-center">
                          <p className="text-sm font-black font-mono text-rose-400 italic">
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
                {/* FILTROS EN UNA SOLA LÍNEA */}
                <div className="bg-[#0f172a] p-3 rounded-xl border border-white/5 mb-3">
                  <div className="grid grid-cols-8 gap-2 items-center">
                    <div className="col-span-3">
                      <Buscador
                        placeholder="BUSCAR PERFIL..."
                        value={busqueda}
                        onChange={(e: any) => setBusqueda(e.target.value)}
                        onClear={limpiarFiltros}
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="date"
                        className="w-full bg-black/20 border border-white/10 p-2 rounded-lg text-[10px] font-bold uppercase outline-none focus:border-blue-500 text-slate-400"
                        value={desde}
                        onChange={e => setDesde(e.target.value)}
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="date"
                        className="w-full bg-black/20 border border-white/10 p-2 rounded-lg text-[10px] font-bold uppercase outline-none focus:border-blue-500 text-slate-400"
                        value={hasta}
                        onChange={e => setHasta(e.target.value)}
                      />
                    </div>
                    <div className="col-span-1">
                      <button
                        onClick={limpiarFiltros}
                        className="w-full bg-slate-700 hover:bg-slate-600 p-2 rounded-lg text-[8px] font-black uppercase transition-colors"
                      >
                        LIMPIAR
                      </button>
                    </div>
                    <div className="col-span-2"></div>
                  </div>
                </div>

                {/* TABLA DE ACCESOS POR FECHA */}
                <div className="space-y-0">
                  {accesosPorFecha.map((grupo) => (
                    <React.Fragment key={grupo.fecha}>
                      <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-blue-500/20"></div>
                        </div>
                        <div className="relative flex justify-center">
                          <span className="bg-[#050a14] px-3 py-0.5 text-[8px] font-black text-blue-500 uppercase tracking-wider">
                            📅 {formatearFechaTitulo(grupo.fecha)}
                          </span>
                        </div>
                      </div>

                      <div className="bg-[#0f172a] rounded-xl border border-white/5 overflow-hidden mb-4">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead className="bg-[#0f172a] text-[8px] font-black text-slate-400 uppercase tracking-wider border-b border-white/10">
                              <tr>
                                <th className="p-2">PERFIL</th>
                                <th className="p-2">DOC</th>
                                <th className="p-2">FLOTA</th>
                                <th className="p-2">LLEGADA</th>
                                <th className="p-2">SALIDA</th>
                                <th className="p-2 text-center">HORAS</th>
                                <th className="p-2 text-center">CARGA</th>
                                <th className="p-2 text-center">OBS</th>
                                <th className="p-2 text-center">EST</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {grupo.accesos.map((a) => (
                                <tr key={a.id} className="hover:bg-white/[0.02] transition-colors">
                                  <td className="p-2">
                                    <p className="text-[10px] font-black text-white uppercase">
                                      {a.flota_perfil?.nombre_completo}
                                    </p>
                                  </td>
                                  <td className="p-2 font-mono text-[9px]">{a.flota_perfil?.documento_id}</td>
                                  <td className="p-2 text-[9px]">{a.flota_perfil?.nombre_flota || '-'}</td>
                                  <td className="p-2 text-[9px] font-mono text-emerald-500">
                                    {new Date(a.hora_llegada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                  <td className="p-2 text-[9px] font-mono text-red-400">
                                    {a.hora_salida 
                                      ? new Date(a.hora_salida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                      : '--:--'}
                                  </td>
                                  <td className="p-2 text-center font-black text-blue-400 text-[9px]">
                                    {a.horas_en_patio?.toFixed(2) || '-'}
                                  </td>
                                  <td className="p-2 text-center">
                                    <span className={`text-[9px] font-black ${a.cant_carga > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                                      {a.cant_carga || 0}
                                    </span>
                                  </td>
                                  <td className="p-2 text-center">
                                    {a.observacion ? (
                                      <button
                                        onClick={() => abrirObservacion(a.observacion, a.flota_perfil?.nombre_completo)}
                                        className="text-[7px] font-black bg-blue-600/20 text-blue-500 px-1.5 py-0.5 rounded hover:bg-blue-600 hover:text-white transition-colors uppercase"
                                      >
                                        VER
                                      </button>
                                    ) : (
                                      <span className="text-slate-600 text-[7px]">—</span>
                                    )}
                                  </td>
                                  <td className="p-2 text-center">
                                    <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase ${
                                      a.estado === 'despachado'
                                        ? 'bg-emerald-500/20 text-emerald-500'
                                        : a.estado === 'en_patio'
                                        ? 'bg-amber-500/20 text-amber-500'
                                        : 'bg-slate-500/20 text-slate-400'
                                    }`}>
                                      {a.estado === 'despachado' ? 'DESP' : a.estado === 'en_patio' ? 'PATIO' : a.estado}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>

                {accesosFiltrados.length === 0 && (
                  <div className="p-4 text-center text-slate-500 text-[9px] font-black uppercase bg-[#0f172a] rounded-xl border border-white/5">
                    No hay accesos que coincidan con la búsqueda.
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Modal de Observación */}
      <ModalObservacion
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        observacion={observacionSeleccionada}
        nombre={nombreSeleccionado}
      />

      <style jsx global>{`
        @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
        @keyframes flash-fast {
          0%, 100% { opacity: 1; }
          10%, 30%, 50% { opacity: 0; }
          20%, 40%, 60% { opacity: 1; }
        }
        .animate-flash-fast { animation: flash-fast 2s ease-in-out; }
        @keyframes modal-appear {
          0% { opacity: 0; transform: scale(0.9) translateY(20px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-modal-appear { animation: modal-appear 0.3s ease-out; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.8); }
      `}</style>
    </main>
  );
}