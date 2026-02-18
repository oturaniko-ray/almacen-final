
'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { NotificacionSistema, Buscador } from '../../../components'; // ✅ 4 niveles arriba

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

// Función para obtener timestamp formateado para nombre de archivo
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
  // MOSTRAR NOTIFICACIÓN
  // ------------------------------------------------------------
  const mostrarNotificacion = (mensaje: string, tipo: 'exito' | 'error' | 'advertencia') => {
    setNotificacion({ mensaje, tipo });
    setTimeout(() => setNotificacion({ mensaje: '', tipo: null }), 2000);
  };

  // ------------------------------------------------------------
  // CARGAR DATOS - CORREGIDO
  // ------------------------------------------------------------
  const fetchData = useCallback(async () => {
    setLoading(true);

    // ✅ CORREGIDO: Verificar que data existe y tiene la propiedad valor
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
    if (perfilesData) setPerfiles(perfilesData);

    const { data: activosData } = await supabase
      .from('flota_accesos')
      .select('*, flota_perfil!inner(*)')
      .is('hora_salida', null)
      .order('hora_llegada', { ascending: false });
    if (activosData) setAccesosActivos(activosData);

    // ✅ CORREGIDO: Acceso seguro a propiedades con verificación
    const { data: accesosData } = await supabase
      .from('flota_accesos')
      .select('*, flota_perfil!inner(*)')
      .order('hora_llegada', { ascending: false });
      
    if (accesosData) {
      const accesosConHoras = (accesosData as any[]).map(acceso => {
        // Verificar que acceso existe y tiene las propiedades
        if (acceso && typeof acceso === 'object') {
          if ('hora_salida' in acceso && 'hora_llegada' in acceso && 
              acceso.hora_salida && acceso.hora_llegada) {
            const llegada = new Date(acceso.hora_llegada).getTime();
            const salida = new Date(acceso.hora_salida).getTime();
            const horasEnPatio = ((salida - llegada) / (1000 * 60 * 60)).toFixed(2);
            return { ...acceso, horas_en_patio: parseFloat(horasEnPatio) };
          }
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
      ...(a as any).flota_perfil,
      acceso: a
    }));
  }, [accesosActivos]);

  const ausentes = useMemo(() => {
    const presentesIds = new Set(presentes.map(p => (p as any).id));
    return perfiles.filter(p => !presentesIds.has((p as any).id));
  }, [perfiles, presentes]);

  const accesosFiltrados = useMemo(() => {
    return accesos.filter(a => {
      const fecha = (a as any).hora_llegada?.split('T')[0] || '';
      const matchNombre = (a as any).flota_perfil?.nombre_completo?.toLowerCase().includes(busqueda.toLowerCase());
      const matchDoc = (a as any).flota_perfil?.documento_id?.toLowerCase().includes(busqueda.toLowerCase());
      const matchDesde = desde ? fecha >= desde : true;
      const matchHasta = hasta ? fecha <= hasta : true;
      return (matchNombre || matchDoc) && matchDesde && matchHasta;
    });
  }, [accesos, busqueda, desde, hasta]);

  const accesosPorFecha = useMemo(() => {
    const agrupados: Record<string, any[]> = {};
    
    accesosFiltrados.forEach(acceso => {
      const fecha = (acceso as any).hora_llegada?.split('T')[0] || 'Sin fecha';
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
  // EXPORTAR EXCEL - UNIFICADO
  // ------------------------------------------------------------
  const exportarExcel = () => {
    // Crear libro de Excel
    const wb = XLSX.utils.book_new();
    
    // Preparar datos según la pestaña activa
    let data: any[] = [];
    let sheetName = '';
    let columnWidths: any[] = [];
    
    if (tabActiva === 'presencia') {
      sheetName = 'Presencia';
      data = presentes.map(p => ({
        Nombre: (p as any).nombre_completo,
        Documento: (p as any).documento_id,
        Flota: (p as any).nombre_flota,
        'Hora Llegada': formatearFechaHora((p as any).acceso?.hora_llegada),
        'Tiempo': formatearTiempo(calcularTiempoRaw((p as any).acceso?.hora_llegada))
      }));
      columnWidths = [
        { wch: 25 }, // Nombre
        { wch: 15 }, // Documento
        { wch: 20 }, // Flota
        { wch: 20 }, // Hora Llegada
        { wch: 12 }, // Tiempo
      ];
    } else {
      sheetName = 'Accesos';
      data = accesosFiltrados.map(a => ({
        Fecha: (a as any).hora_llegada?.split('T')[0] || '',
        Nombre: (a as any).flota_perfil?.nombre_completo,
        Documento: (a as any).flota_perfil?.documento_id,
        Flota: (a as any).flota_perfil?.nombre_flota,
        Llegada: formatearFechaHora((a as any).hora_llegada),
        Salida: formatearFechaHora((a as any).hora_salida),
        'Horas Patio': (a as any).horas_en_patio?.toFixed(2) || '-',
        'Carga Recogida': (a as any).cant_carga || 0,
        'Observación': (a as any).observacion || '-',
        Estado: (a as any).estado
      }));
      columnWidths = [
        { wch: 12 }, // Fecha
        { wch: 25 }, // Nombre
        { wch: 15 }, // Documento
        { wch: 20 }, // Flota
        { wch: 20 }, // Llegada
        { wch: 20 }, // Salida
        { wch: 12 }, // Horas Patio
        { wch: 12 }, // Carga Recogida
        { wch: 30 }, // Observación
        { wch: 12 }, // Estado
      ];
    }
    
    // Crear hoja de cálculo
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Definir ancho de columnas basado en el encabezado
    ws['!cols'] = columnWidths;
    
    // Crear contenido del membrete
    const fechaEmision = new Date().toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    const titulo = `REPORTES DE FLOTA - ${tabActiva === 'presencia' ? 'PRESENCIA' : 'ACCESOS'}`;
    const empleadoInfo = user ? `${user.nombre} - ${formatearRol(user.rol)} (Nivel ${user.nivel_acceso})` : 'Sistema';
    const fechaInfo = `Fecha de emisión: ${fechaEmision}`;
    
    // Insertar membrete al inicio de la hoja
    XLSX.utils.sheet_add_aoa(ws, [[titulo]], { origin: 'A1' });
    XLSX.utils.sheet_add_aoa(ws, [[empleadoInfo]], { origin: 'A2' });
    XLSX.utils.sheet_add_aoa(ws, [[fechaInfo]], { origin: 'A3' });
    XLSX.utils.sheet_add_aoa(ws, [['─────────────────────────────────────────────────────────────────']], { origin: 'A4' });
    
    // Mover los datos a partir de la fila 6 (dejando una fila de espacio)
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    const newData = XLSX.utils.sheet_to_json(ws, { header: 1, range: 5 });
    if (newData.length > 0) {
      XLSX.utils.sheet_add_aoa(ws, newData as any[][], { origin: 'A6' });
    }
    
    // Agregar hoja al libro
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    
    // Generar nombre de archivo según el tipo de reporte
    const timestamp = getTimestamp();
    const filename = tabActiva === 'presencia' 
      ? `presenciaflota_${timestamp}.xlsx`
      : `accesoflota_${timestamp}.xlsx`;
    
    // Guardar archivo
    XLSX.writeFile(wb, filename);
    
    mostrarNotificacion('✅ REPORTE EXPORTADO', 'exito');
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
                      const acceso = (p as any).acceso;
                      const ms = calcularTiempoRaw(acceso?.hora_llegada);
                      const excedido = maximoPatio > 0 && ms > maximoPatio;
                      return (
                        <div
                          key={(p as any).id}
                          className={`p-3 rounded-xl border-2 transition-all shadow-lg flex flex-col items-center ${
                            excedido
                              ? 'border-lime-400 bg-lime-400/10'
                              : 'border-emerald-500 bg-[#0f172a]'
                          }`}
                        >
                          <p className="text-white text-[11px] font-black uppercase truncate w-full text-center leading-none mb-1">
                            {(p as any).nombre_completo}
                          </p>
                          <p className="text-[9px] text-slate-400 font-mono mb-1 uppercase">{(p as any).documento_id}</p>
                          <p className={`text-[9px] font-black font-mono ${excedido ? 'text-lime-300' : 'text-white'}`}>
                            {formatearFechaHora(acceso?.hora_llegada)}
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
                      <div key={(p as any).id} className="bg-[#0f172a] p-3 rounded-xl border border-rose-500/30 flex flex-col items-center">
                        <p className="text-white text-[11px] font-black uppercase truncate w-full text-center leading-none mb-1">
                          {(p as any).nombre_completo}
                        </p>
                        <p className="text-[9px] text-slate-500 font-mono mb-1 uppercase">{(p as any).documento_id}</p>
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
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBusqueda(e.target.value)}
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
                                <tr key={(a as any).id} className="hover:bg-white/[0.02] transition-colors">
                                  <td className="p-2">
                                    <p className="text-[10px] font-black text-white uppercase">
                                      {(a as any).flota_perfil?.nombre_completo}
                                    </p>
                                  </td>
                                  <td className="p-2 font-mono text-[9px]">{(a as any).flota_perfil?.documento_id}</td>
                                  <td className="p-2 text-[9px]">{(a as any).flota_perfil?.nombre_flota || '-'}</td>
                                  <td className="p-2 text-[9px] font-mono text-emerald-500">
                                    {new Date((a as any).hora_llegada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                  <td className="p-2 text-[9px] font-mono text-red-400">
                                    {(a as any).hora_salida 
                                      ? new Date((a as any).hora_salida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                      : '--:--'}
                                  </td>
                                  <td className="p-2 text-center font-black text-blue-400 text-[9px]">
                                    {(a as any).horas_en_patio?.toFixed(2) || '-'}
                                  </td>
                                  <td className="p-2 text-center">
                                    <span className={`text-[9px] font-black ${(a as any).cant_carga > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                                      {(a as any).cant_carga || 0}
                                    </span>
                                  </td>
                                  <td className="p-2 text-center">
                                    {(a as any).observacion ? (
                                      <button
                                        onClick={() => abrirObservacion((a as any).observacion, (a as any).flota_perfil?.nombre_completo)}
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
                                      (a as any).estado === 'despachado'
                                        ? 'bg-emerald-500/20 text-emerald-500'
                                        : (a as any).estado === 'en_patio'
                                        ? 'bg-amber-500/20 text-amber-500'
                                        : 'bg-slate-500/20 text-slate-400'
                                    }`}>
                                      {(a as any).estado === 'despachado' ? 'DESP' : (a as any).estado === 'en_patio' ? 'PATIO' : (a as any).estado}
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