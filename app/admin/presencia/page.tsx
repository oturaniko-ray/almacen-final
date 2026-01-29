'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function PresenciaPage() {
  const [user, setUser] = useState<any>(null);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [ahora, setAhora] = useState(new Date());
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    
    const currentUser = JSON.parse(sessionData);
    
    const nivel = Number(currentUser.nivel_acceso);
    if (nivel < 4) {
      router.replace('/');
      return;
    }

    setUser(currentUser);
    fetchData();

    const timer = setInterval(() => setAhora(new Date()), 60000);

    const channel = supabase.channel('presencia-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, fetchData)
      .subscribe();

    return () => { 
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, [router]);

  // CORRECCIÓN: Ahora incluimos un select a 'jornadas' para obtener la entrada activa real
  const fetchData = async () => {
    const { data, error } = await supabase
      .from('empleados')
      .select(`
        *,
        jornadas(hora_entrada, hora_salida, estado)
      `)
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (data) {
      // Mapeamos para identificar la jornada activa de forma sencilla
      const procesados = data.map(emp => ({
        ...emp,
        jornada_activa: emp.jornadas?.find((j: any) => j.estado === 'activo') || null
      }));
      setEmpleados(procesados);
    }
    if (error) console.error("Error en lectura:", error);
  };

  // RUTINA DE CÁLCULO CORREGIDA: Toma los datos de la tabla jornadas
  const calcularTiempoEstado = (emp: any) => {
    let referencia: string | null = null;

    if (emp.en_almacen) {
      // Si está presente, usamos la hora_entrada de su jornada activa
      referencia = emp.jornada_activa?.hora_entrada || emp.ultimo_ingreso;
    } else {
      // Si está ausente, usamos su última salida registrada
      referencia = emp.ultima_salida;
    }

    if (!referencia) return '0h 0m';

    const inicio = new Date(referencia).getTime();
    const difMs = ahora.getTime() - inicio;
    
    if (difMs < 0) return '0h 0m';

    const horas = Math.floor(difMs / 3600000);
    const minutos = Math.floor((difMs % 3600000) / 60000);
    return `${horas}h ${minutos}m`;
  };

  const formatearCredencial = (u: any) => {
    if (!u) return '';
    return `${u.rol}(${u.nivel_acceso})`.toUpperCase();
  };

  const exportarExcel = () => {
    const f = new Date();
    const fechaStr = f.toLocaleDateString().replace(/\//g, '-');
    const horaStr = `${f.getHours()}-${f.getMinutes()}`;
    
    const encabezado = [
      ["REPORTE PRESENCIAL DEL PERSONAL"],
      [`Reporte creado por: ${user?.nombre} - ${formatearCredencial(user)}`],
      [`Fecha y Hora de creación: ${f.toLocaleDateString()} ${f.toLocaleTimeString()}`],
      [], 
      ["PRESENTES"],
      ["Nombre", "Documento ID", "Última Entrada (Fecha)", "Última Entrada (Hora)", "Tiempo en Almacén"]
    ];

    const presentesData = empleados.filter(e => e.en_almacen).map(e => [
      e.nombre, e.documento_id || 'N/A',
      e.jornada_activa?.hora_entrada ? new Date(e.jornada_activa.hora_entrada).toLocaleDateString() : '---',
      e.jornada_activa?.hora_entrada ? new Date(e.jornada_activa.hora_entrada).toLocaleTimeString() : '---',
      calcularTiempoEstado(e)
    ]);

    const ausentesEncabezado = [
      [], ["AUSENTES"],
      ["Nombre", "Documento ID", "Última Salida (Fecha)", "Última Salida (Hora)", "Inactividad"]
    ];

    const ausentesData = empleados.filter(e => !e.en_almacen).map(e => [
      e.nombre, e.documento_id || 'N/A',
      e.ultima_salida ? new Date(e.ultima_salida).toLocaleDateString() : '---',
      e.ultima_salida ? new Date(e.ultima_salida).toLocaleTimeString() : '---',
      calcularTiempoEstado(e)
    ]);

    const ws = XLSX.utils.aoa_to_sheet([...encabezado, ...presentesData, ...ausentesEncabezado, ...ausentesData]);
    const wb = XLSX.utils.book_new();
    
    const nombreHoja = `presencial${fechaStr}${horaStr}`.substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
    XLSX.writeFile(wb, `presencia${fechaStr}${horaStr}.xlsx`);
  };

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <div className="max-w-[1800px] mx-auto">
        <header className="flex justify-between items-start mb-16">
          <div>
            <h2 className="text-4xl font-black uppercase italic tracking-tighter">Estado de <span className="text-blue-500">Presencia</span></h2>
            {user && (
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">
                USER: <span className="text-white italic">{user.nombre}</span> • 
                CRED: <span className="text-blue-400">{formatearCredencial(user)}</span>
              </p>
            )}
          </div>
          <div className="flex gap-4">
            <button onClick={exportarExcel} className="p-4 bg-emerald-600/20 border border-emerald-500/20 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all">📊 Exportar Reporte</button>
            <button onClick={() => router.back()} className="p-4 bg-[#1e293b] rounded-2xl border border-white/5 font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all">← Volver</button>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-16">
          <div className="space-y-8">
            <h3 className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.4em] border-b border-emerald-500/20 pb-4">✓ PRESENTE ({empleados.filter(e => e.en_almacen).length})</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-4">
              {empleados.filter(e => e.en_almacen).map(emp => (
                <div key={emp.id} className="flex flex-col group">
                  <span className="text-sm font-black uppercase text-emerald-500 italic mb-1">{emp.nombre}</span>
                  <span className="text-[10px] text-slate-400 font-bold mb-1">{emp.documento_id}</span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Actividad: <span className="text-white font-black">{calcularTiempoEstado(emp)}</span></span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            <h3 className="text-[10px] font-black uppercase text-red-500 tracking-[0.4em] border-b border-red-500/20 pb-4">✗ AUSENTE ({empleados.filter(e => !e.en_almacen).length})</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-4">
              {empleados.filter(e => !e.en_almacen).map(emp => (
                <div key={emp.id} className="flex flex-col group">
                  <span className="text-sm font-black uppercase text-red-600 italic mb-1">{emp.nombre}</span>
                  <span className="text-[10px] text-slate-400 font-bold mb-1">{emp.documento_id}</span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Inactivo: <span className="text-white/70">{calcularTiempoEstado(emp)}</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}