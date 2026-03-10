'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import * as XLSX from '@e965/xlsx';
import { NotificacionSistema, Buscador } from '../../../components';
import { useSucursalGlobal } from '@/lib/SucursalContext';

// ------------------------------------------------------------
// INTERFACES PARA TIPADO
// ------------------------------------------------------------
interface FlotaPerfil {
  id: string;
  nombre_completo: string;
  documento_id: string;
  email: string | null;
  telefono: string | null;
  nombre_flota: string | null;
  cant_choferes: number;
  cant_rutas: number;
  pin_secreto: string;
  activo: boolean;
  sucursal_origen?: string;
  en_patio?: boolean;
}

interface FlotaAcceso {
  id: string;
  perfil_id: string;
  hora_llegada: string;
  hora_salida: string | null;
  cant_carga: number;
  observacion: string | null;
  estado: 'en_patio' | 'despachado';
  flota_perfil?: FlotaPerfil;
  horas_en_patio?: number;
}

// ------------------------------------------------------------
// FUNCIONES AUXILIARES
// ------------------------------------------------------------
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

const getTimestamp = () => {
  const ahora = new Date();
  const año = ahora.getFullYear();
  const mes = (ahora.getMonth() + 1).toString().padStart(2, '0');
  const dia = ahora.getDate().toString().padStart(2, '0');
  const hora = ahora.getHours().toString().padStart(2, '0');
  const minuto = ahora.getMinutes().toString().padStart(2, '0');
  const segundo = ahora.getSeconds().toString().padStart(2, '0');
  return `${año}${mes}${dia}_${hora}${minuto}${segundo}`;
};

const formatearTiempo = (ms: number): string => {
  const totalSegundos = Math.floor(ms / 1000);
  const h = Math.floor(totalSegundos / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSegundos % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSegundos % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

const formatearFechaHora = (fechaIso: string | null): string => {
  if (!fechaIso) return '--/-- --:--:--';
  const d = new Date(fechaIso);
  const fecha = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  const hora = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return `${fecha} ${hora}`;
};

const formatearFechaTitulo = (fechaStr: string): string => {
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
  const titulo = "REPORTES DE FLOTA";
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

// ----- MODAL DE OBSERVACIÓN (ACTUALIZADO) -----
const ModalObservacion = ({ 
  isOpen, 
  onClose, 
  observacion, 
  nombre 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  observacion: string; 
  nombre: string;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a1a1a] border-2 border-blue-500/30 rounded-[30px] p-6 max-w-lg w-full shadow-2xl animate-modal-appear">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-black text-lg uppercase">Observación de {nombre}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all">
            ✕
          </button>
        </div>
        <div className="bg-[#0f172a] p-6 rounded-2xl border border-white/10">
          <p className="text-white text-base leading-relaxed whitespace-pre-wrap">{observacion || 'Sin observación'}</p>
        </div>
        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 rounded-xl text-sm uppercase tracking-wider transition-all">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ------------------------------------------------------------
export default function ReportesFlotaPage() {
  const [user, setUser] = useState<any>(null);
  const [tabActiva, setTabActiva] = useState<'presencia' | 'accesos'>('presencia');
  const [loading, setLoading] = useState(false);
  const [maximoPatio, setMaximoPatio] = useState<number>(0);
  const [ahora, setAhora] = useState(new Date());
  const [notificacion, setNotificacion] = useState<{ mensaje: string; tipo: 'exito' | 'error' | 'advertencia' | null }>({ mensaje: '', tipo: null });
  const router = useRouter();

  const [perfiles, setPerfiles] = useState<FlotaPerfil[]>([]);
  const [accesosActivos, setAccesosActivos] = useState<FlotaAcceso[]>([]);
  const [accesos, setAccesos] = useState<FlotaAcceso[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const { sucursalFiltro } = useSucursalGlobal();

  const [modalOpen, setModalOpen] = useState(false);
  const [observacionSeleccionada, setObservacionSeleccionada] = useState('');
  const [nombreSeleccionado, setNombreSeleccionado] = useState('');

  // ------------------------------------------------------------
  // MOSTRAR NOTIFICACIÓN
  // ------------------------------------------------------------
  const mostrarNotificacion = (mensaje: string, tipo: 'exito' | 'error' | 'advertencia') => {
    setNotificacion({ mensaje, tipo });
    setTimeout(() => setNotificacion({ mensaje: '', tipo: null }), 2000);
  };

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

    if (config && typeof config === 'object' && 'valor' in config) {
      const val = parseInt((config as { valor: string }).valor, 10);
      if (!isNaN(val)) setMaximoPatio(val);
    }

    const { data: perfilesData } = await supabase
      .from('flota_perfil')
      .select('*')
      .eq('activo', true)
      .order('nombre_completo');
    if (perfilesData) setPerfiles(perfilesData as FlotaPerfil[]);

    const { data: activosData } = await supabase
      .from('flota_accesos')
      .select('*, flota_perfil!inner(*)')
      .is('hora_salida', null)
      .order('hora_llegada', { ascending: false });
    if (activosData) setAccesosActivos(activosData as FlotaAcceso[]);

    const { data: accesosData } = await supabase
      .from('flota_accesos')
      .select('*, flota_perfil!inner(*)')
      .order('hora_llegada', { ascending: false });

    if (accesosData) {
      const accesosConHoras = (accesosData as FlotaAcceso[]).map(acceso => {
        if (acceso.hora_salida && acceso.hora_llegada) {
          const llegada = new Date(acceso.hora_llegada).getTime();
          const salida = new Date(acceso.hora_salida).getTime();
          const horasEnPatio = (salida - llegada) / (1000 * 60 * 60);
          return { ...acceso, horas_en_patio: horasEnPatio };
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
      supabase.removeChannel(channel).catch(console.error);
    };
  }, [fetchData, router]);

  // ------------------------------------------------------------
  // CÁLCULOS Y FILTROS
  // ------------------------------------------------------------
  const calcularTiempoRaw = (fechaIso: string | null): number => {
    if (!fechaIso) return 0;
    return ahora.getTime() - new Date(fechaIso).getTime();
  };

  const presentes = useMemo(() => {
    const lista = accesosActivos
      .filter(a => a.flota_perfil)
      .map(a => ({
        ...a.flota_perfil!,
        acceso: a
      }));
    if (!sucursalFiltro || sucursalFiltro === 'all') return lista;
    return lista.filter(p => p.sucursal_origen === sucursalFiltro);
  }, [accesosActivos, sucursalFiltro]);

  const ausentes = useMemo(() => {
    const presentesIds = new Set(presentes.map(p => p.id));
    const todos = perfiles.filter(p => !presentesIds.has(p.id));
    if (!sucursalFiltro || sucursalFiltro === 'all') return todos;
    return todos.filter(p => p.sucursal_origen === sucursalFiltro);
  }, [perfiles, presentes, sucursalFiltro]);

  const accesosFiltrados = useMemo(() => {
    return accesos.filter(a => {
      if (!a.flota_perfil) return false;
      const fecha = a.hora_llegada?.split('T')[0] || '';
      const matchNombre = a.flota_perfil.nombre_completo?.toLowerCase().includes(busqueda.toLowerCase());
      const matchDoc = a.flota_perfil.documento_id?.toLowerCase().includes(busqueda.toLowerCase());
      const matchDesde = desde ? fecha >= desde : true;
      const matchHasta = hasta ? fecha <= hasta : true;
      const matchSucursal = !sucursalFiltro || sucursalFiltro === 'all' ? true : a.flota_perfil.sucursal_origen === sucursalFiltro;
      return (matchNombre || matchDoc) && matchDesde && matchHasta && matchSucursal;
    });
  }, [accesos, busqueda, desde, hasta, sucursalFiltro]);

  const accesosPorFecha = useMemo(() => {
    const agrupados: Record<string, FlotaAcceso[]> = {};

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

  // ------------------------------------------------------------
  // EXPORTAR EXCEL - ACTUALIZADO
  // ------------------------------------------------------------
  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    let data: any[] = [];
    let sheetName = '';
    let columnWidths: any[] = [];

    if (tabActiva === 'presencia') {
      sheetName = 'Presencia';
      data = presentes.map(p => ({
        Nombre: p.nombre_completo,
        Documento: p.documento_id,
        Flota: p.nombre_flota || '',
        'Hora Llegada': formatearFechaHora(p.acceso?.hora_llegada),
        Tiempo: formatearTiempo(calcularTiempoRaw(p.acceso?.hora_llegada))
      }));
      columnWidths = [
        { wch: 25 }, { wch: 15 }, { wch: 20 },
        { wch: 20 }, { wch: 12 }
      ];
    } else {
      sheetName = 'Accesos';
      data = accesosFiltrados.map(a => ({
        Fecha: a.hora_llegada?.split('T')[0] || '',
        Nombre: a.flota_perfil?.nombre_completo,
        Documento: a.flota_perfil?.documento_id,
        Flota: a.flota_perfil?.nombre_flota || '',
        Llegada: formatearFechaHora(a.hora_llegada),
        Salida: formatearFechaHora(a.hora_salida),
        'Horas Patio': a.horas_en_patio?.toFixed(2) || '-',
        'Carga Recogida': a.cant_carga || 0,
        Observación: a.observacion || '-',
        Estado: a.estado === 'despachado' ? 'DESPACHADO' : 'EN PATIO'
      }));
      columnWidths = [
        { wch: 12 }, { wch: 25 }, { wch: 15 },
        { wch: 20 }, { wch: 20 }, { wch: 20 },
        { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 12 }
      ];
    }

    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = columnWidths;

    const fechaEmision = new Date().toLocaleString('es-ES', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const titulo = `REPORTES DE FLOTA - ${tabActiva === 'presencia' ? 'PRESENCIA' : 'ACCESOS'}`;
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

    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const timestamp = getTimestamp();
    const filename = tabActiva === 'presencia'
      ? `presenciaflota_${timestamp}.xlsx`
      : `accesoflota_${timestamp}.xlsx`;

    XLSX.writeFile(wb, filename);
    mostrarNotificacion('ARCHIVO EXPORTADO', 'exito');
  };

  const handleRegresar = () => {
    router.push('/admin/flota');
  };

  // ------------------------------------------------------------
  // RENDERIZADO - UI ACTUALIZADA
  // ------------------------------------------------------------
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

        <div className="flex flex-wrap gap-2 mb-6 justify-center items-center">
          <button
            onClick={() => setTabActiva('presencia')}
            className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              tabActiva === 'presencia'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            PRESENCIA
          </button>
          <button
            onClick={() => setTabActiva('accesos')}
            className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              tabActiva === 'accesos'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
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
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500 flex items-center gap-2 mb-4">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                    EN PATIO ({presentes.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {presentes.map(p => {
                      const ms = calcularTiempoRaw(p.acceso?.hora_llegada);
                      const excedido = maximoPatio > 0 && ms > maximoPatio;
                      return (
                        <div
                          key={p.id}
                          className={`p-4 rounded-xl border-2 transition-all shadow-lg flex flex-col items-center ${
                            excedido
                              ? 'border-lime-400 bg-lime-400/10'
                              : 'border-emerald-500 bg-gradient-to-br from-[#0f172a] to-[#1a1a1a]'
                          }`}
                        >
                          <p className="text-white text-sm font-black uppercase truncate w-full text-center leading-none mb-1">
                            {p.nombre_completo}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono mb-2 uppercase">{p.documento_id}</p>
                          <p className={`text-[10px] font-black font-mono ${excedido ? 'text-lime-300' : 'text-white'}`}>
                            {formatearFechaHora(p.acceso?.hora_llegada)}
                          </p>
                          <div className={`w-full mt-3 py-2 rounded-lg border text-center ${
                            excedido ? 'bg-lime-400/20 border-lime-400/40' : 'bg-black/40 border-white/5'
                          }`}>
                            <p className={`text-base font-black font-mono italic ${
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

                <div className="flex-1">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500 mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-rose-600 rounded-full"></span>
                    AUSENTES ({ausentes.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {ausentes.map(p => (
                      <div key={p.id} className="bg-gradient-to-br from-[#0f172a] to-[#1a1a1a] p-4 rounded-xl border border-rose-500/30 flex flex-col items-center">
                        <p className="text-white text-sm font-black uppercase truncate w-full text-center leading-none mb-1">
                          {p.nombre_completo}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono mb-2 uppercase">{p.documento_id}</p>
                        <p className="text-[10px] font-black font-mono text-white">
                          --/-- --:--:--
                        </p>
                        <div className="bg-black/20 w-full mt-3 py-2 rounded-lg border border-white/5 text-center">
                          <p className="text-base font-black font-mono text-rose-400 italic">
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
                <div className="bg-gradient-to-br from-[#0f172a] to-[#1a1a1a] p-4 rounded-xl border border-blue-500/20 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-8 gap-3 items-center">
                    <div className="md:col-span-3">
                      <Buscador
                        placeholder="BUSCAR PERFIL..."
                        value={busqueda}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBusqueda(e.target.value)}
                        onClear={limpiarFiltros}
                        className="bg-black/30 border-white/10 focus:border-blue-500"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <input
                        type="date"
                        className="w-full bg-black/30 border border-white/10 p-2.5 rounded-lg text-xs font-bold uppercase outline-none focus:border-blue-500 text-slate-300"
                        value={desde}
                        onChange={e => setDesde(e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-1">
                      <input
                        type="date"
                        className="w-full bg-black/30 border border-white/10 p-2.5 rounded-lg text-xs font-bold uppercase outline-none focus:border-blue-500 text-slate-300"
                        value={hasta}
                        onChange={e => setHasta(e.target.value)}
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

                <div className="space-y-4">
                  {accesosPorFecha.map((grupo) => (
                    <React.Fragment key={grupo.fecha}>
                      <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-blue-500/20"></div>
                        </div>
                        <div className="relative flex justify-center">
                          <span className="bg-[#050a14] px-4 py-1 text-[9px] font-black text-blue-500 uppercase tracking-wider">
                            {formatearFechaTitulo(grupo.fecha)}
                          </span>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-[#0f172a] to-[#1a1a1a] rounded-xl border border-blue-500/20 overflow-hidden mb-4">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead className="bg-black/40 text-[9px] font-black text-blue-400 uppercase tracking-wider border-b border-blue-500/20">
                              <tr>
                                <th className="p-3">PERFIL</th>
                                <th className="p-3">DOC</th>
                                <th className="p-3">FLOTA</th>
                                <th className="p-3">LLEGADA</th>
                                <th className="p-3">SALIDA</th>
                                <th className="p-3 text-center">HORAS</th>
                                <th className="p-3 text-center">CARGA</th>
                                <th className="p-3 text-center">OBS</th>
                                <th className="p-3 text-center">EST</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-blue-500/10">
                              {grupo.accesos.map((a) => (
                                <tr key={a.id} className="hover:bg-blue-500/5 transition-colors">
                                  <td className="p-3">
                                    <p className="text-xs font-black text-white uppercase">
                                      {a.flota_perfil?.nombre_completo}
                                    </p>
                                  </td>
                                  <td className="p-3 font-mono text-[11px] text-slate-300">{a.flota_perfil?.documento_id}</td>
                                  <td className="p-3 text-[11px] text-slate-400">{a.flota_perfil?.nombre_flota || '-'}</td>
                                  <td className="p-3 text-[11px] font-mono text-emerald-500">
                                    {new Date(a.hora_llegada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                  <td className="p-3 text-[11px] font-mono text-red-400">
                                    {a.hora_salida
                                      ? new Date(a.hora_salida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                      : '--:--'}
                                  </td>
                                  <td className="p-3 text-center font-black text-blue-400 text-[11px]">
                                    {a.horas_en_patio?.toFixed(2) || '-'}
                                  </td>
                                  <td className="p-3 text-center">
                                    <span className={`text-[11px] font-black ${
                                      a.cant_carga > 0 ? 'text-emerald-400' : 'text-slate-500'
                                    }`}>
                                      {a.cant_carga || 0}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center">
                                    {a.observacion ? (
                                      <button
                                        onClick={() => abrirObservacion(
                                          a.observacion || '', 
                                          a.flota_perfil?.nombre_completo || ''
                                        )}
                                        className="text-[9px] font-black bg-blue-600/20 text-blue-500 px-2 py-1 rounded hover:bg-blue-600 hover:text-white transition-colors uppercase"
                                      >
                                        VER
                                      </button>
                                    ) : (
                                      <span className="text-slate-600 text-[9px]">—</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-center">
                                    <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase ${
                                      a.estado === 'despachado'
                                        ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                                        : 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                                    }`}>
                                      {a.estado === 'despachado' ? 'DESP' : 'PATIO'}
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
                  <div className="p-8 text-center text-slate-500 text-xs font-black uppercase bg-gradient-to-br from-[#0f172a] to-[#1a1a1a] rounded-xl border border-blue-500/20">
                    No hay accesos que coincidan con la búsqueda.
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

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
        select option { background-color: #1f2937; color: white; }
      `}</style>
    </main>
  );
}