'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

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

// ----- MEMBRETE SUPERIOR (sin subtítulo y sin línea) -----
const MemebreteSuperior = ({ usuario }: { usuario?: any }) => {
  const titulo = "MONITOR DE PRESENCIA";
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

export default function PresenciaPage() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [ahora, setAhora] = useState(new Date());
  const [user, setUser] = useState<any>(null);
  const [tabActiva, setTabActiva] = useState<string>('empleado');
  const [maxLabor, setMaxLabor] = useState<number>(0); 
  const router = useRouter();

  const fetchData = useCallback(async () => {
    // ✅ CORREGIDO: Verificar que config existe y tiene la propiedad valor
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
      const vinculados = (emps as any[]).map(e => {
        const ultimaJornada = jors?.find((j: any) => j.empleado_id === e.id);
        return { ...e, ultimaJornada, nivel: Number(e.nivel_acceso || 0) };
      });
      setEmpleados(vinculados);
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

    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, [fetchData]);

  const calcularTiempoRaw = (fechaISO: string | null) => {
    if (!fechaISO) return 0;
    return ahora.getTime() - new Date(fechaISO).getTime();
  };

  const formatearTiempo = (ms: number) => {
    const totalSegundos = Math.floor(ms / 1000);
    const h = Math.floor(totalSegundos / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSegundos % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSegundos % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const formatearFechaHoraUnico = (fechaISO: string | null) => {
    if (!fechaISO) return '--/-- --:--:--';
    const d = new Date(fechaISO);
    const fecha = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    const hora = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    return `${fecha} ${hora}`;
  };

  // ------------------------------------------------------------
  // EXPORTAR EXCEL - UNIFICADO
  // ------------------------------------------------------------
  const exportarExcel = () => {
    // Crear libro de Excel
    const wb = XLSX.utils.book_new();
    
    // Preparar datos
    const data = empleados.map(e => ({
      Nombre: e.nombre,
      Documento: e.documento_id,
      Nivel: e.nivel_acceso,
      Estado: e.en_almacen ? 'PRESENTE' : 'AUSENTE'
    }));
    
    // Crear hoja de cálculo
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Definir ancho de columnas basado en el encabezado
    const columnWidths = [
      { wch: 30 }, // Nombre
      { wch: 15 }, // Documento
      { wch: 8 },  // Nivel
      { wch: 12 }, // Estado
    ];
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
    
    const titulo = `MONITOR DE PRESENCIA`;
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
    XLSX.utils.book_append_sheet(wb, ws, "Presencia");
    
    // Generar nombre de archivo: presencia_timestamp.xlsx
    const timestamp = getTimestamp();
    const filename = `presencia_${timestamp}.xlsx`;
    
    // Guardar archivo
    XLSX.writeFile(wb, filename);
    
    // Notificación opcional (si existiera función)
    // mostrarNotificacion('✅ REPORTE EXPORTADO', 'exito');
  };

  const filtrarYOrdenar = (esPresente: boolean, tab: string) => {
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
        const timeA = new Date(esPresente ? a.ultimaJornada?.hora_entrada : a.ultimaJornada?.hora_salida).getTime() || 0;
        const timeB = new Date(esPresente ? b.ultimaJornada?.hora_entrada : b.ultimaJornada?.hora_salida).getTime() || 0;
        return timeB - timeA;
      });
  };

  const presentes = useMemo(() => filtrarYOrdenar(true, tabActiva), [empleados, tabActiva]);
  const ausentes = useMemo(() => filtrarYOrdenar(false, tabActiva), [empleados, tabActiva]);

  const cantidadExcedidos = presentes.filter(e => {
    const ms = calcularTiempoRaw(e.ultimaJornada?.hora_entrada);
    return maxLabor > 0 && ms > maxLabor;
  }).length;

  return (
    <main className="min-h-screen bg-[#050a14] p-4 text-white font-sans">
      <div className="max-w-[100%] mx-auto">
        
        {/* HEADER CON MEMBRETE Y BOTONES */}
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
              onClick={() => router.push('/reportes')}
              className="bg-blue-800 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-transform"
            >
              REGRESAR
            </button>
          </div>
        </div>

        {/* TABS CON CONTEO POR ROL */}
        <div className="flex gap-1 mb-10 justify-center">
          {['empleado', 'supervisor', 'administrador', 'técnico'].map(p => {
            const conteoRol = filtrarYOrdenar(true, p).length;
            return (
              <button 
                key={p} 
                onClick={() => setTabActiva(p)} 
                className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${tabActiva === p ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-slate-500 hover:text-white'}`}
              >
                {p}s ({conteoRol})
              </button>
            );
          })}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* COLUMNA PRESENTES */}
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></span>
                PRESENTES ({presentes.length})
              </h3>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-lime-400 bg-lime-400/10 px-3 py-1 rounded-full border border-lime-400/20">
                Requieren atención ({cantidadExcedidos})
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {presentes.map(e => {
                const ms = calcularTiempoRaw(e.ultimaJornada?.hora_entrada);
                const esExcedido = maxLabor > 0 && ms > maxLabor;
                
                return (
                  <div key={e.id} className={`p-4 rounded-[20px] border-2 transition-all duration-300 shadow-lg flex flex-col items-center ${esExcedido ? 'border-lime-400 bg-lime-400/10 shadow-[0_0_15px_rgba(163,230,53,0.3)]' : 'border-emerald-500 bg-[#0f172a]'}`}>
                    <p className="text-white text-[12px] font-black uppercase truncate w-full text-center leading-none mb-1">{e.nombre}</p>
                    <p className="text-[10px] text-slate-400 font-mono mb-2 uppercase">{e.documento_id}</p>
                    
                    <div className="mb-3">
                      <p className={`text-[11px] font-black font-mono tracking-tighter ${esExcedido ? 'text-lime-300' : 'text-white'}`}>
                        {formatearFechaHoraUnico(e.ultimaJornada?.hora_entrada)}
                      </p>
                    </div>

                    <div className={`w-full py-2 rounded-xl border text-center ${esExcedido ? 'bg-lime-400/20 border-lime-400/40' : 'bg-black/40 border-white/5'}`}>
                      <p className={`text-lg font-black font-mono italic leading-none ${esExcedido ? 'text-lime-400 animate-pulse' : 'text-blue-500'}`}>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {ausentes.map(e => (
                <div key={e.id} className="bg-[#0f172a] p-4 rounded-[20px] border border-rose-500/30 flex flex-col items-center">
                  <p className="text-white text-[12px] font-black uppercase truncate w-full text-center leading-none mb-1">{e.nombre}</p>
                  <p className="text-[10px] text-slate-500 font-mono mb-2 uppercase">{e.documento_id}</p>
                  
                  <div className="mb-3">
                    <p className="text-[11px] font-black font-mono text-white tracking-tighter">
                      {formatearFechaHoraUnico(e.ultimaJornada?.hora_salida)}
                    </p>
                  </div>

                  <div className="bg-black/20 w-full py-2 rounded-xl border border-white/5 text-center">
                    <p className="text-lg font-black font-mono text-rose-400 italic leading-none">
                      {formatearTiempo(calcularTiempoRaw(e.ultimaJornada?.hora_salida))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}