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
    setUser(JSON.parse(sessionData));
    
    fetchData();

    // Actualización de relojes cada minuto
    const timer = setInterval(() => setAhora(new Date()), 60000);

    // Realtime para cambios inmediatos
    const channel = supabase.channel('presencia-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, fetchData)
      .subscribe();

    return () => { 
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, [router]);

  const fetchData = async () => {
    // Consulta simplificada para asegurar que los registros se vean
    const { data, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (error) console.error("Error auditoría:", error);
    if (data) setEmpleados(data);
  };

  const calcularTiempoReal = (timestamp: string | null) => {
    if (!timestamp) return '0h 0m';
    const inicio = new Date(timestamp).getTime();
    const difMs = ahora.getTime() - inicio;
    const horas = Math.floor(difMs / 3600000);
    const minutos = Math.floor((difMs % 3600000) / 60000);
    return `${horas}h ${minutos}m`;
  };

  const exportarExcel = () => {
    const fechaActual = new Date();
    const fechaStr = fechaActual.toLocaleDateString().replace(/\//g, '-');
    const horaStr = fechaActual.getHours() + "-" + fechaActual.getMinutes();
    
    // 1. Encabezados y Metadatos
    const encabezado = [
      ["Reporte presencial del personal"],
      [`Reporte creado por: ${user?.nombre} - ${user?.rol === 'admin' ? 'ADMINISTRADOR' : user?.rol}`],
      [], // Espacio
      ["PRESENTES"],
      ["Nombre", "Documento", "Fecha Entrada", "Hora Entrada", "Tiempo en Almacén"]
    ];

    // 2. Datos de Presentes
    const presentesData = empleados
      .filter(e => e.en_almacen)
      .map(e => [
        e.nombre,
        e.documento || 'N/A',
        e.ultimo_ingreso ? new Date(e.ultimo_ingreso).toLocaleDateString() : 'N/A',
        e.ultimo_ingreso ? new Date(e.ultimo_ingreso).toLocaleTimeString() : 'N/A',
        calcularTiempoReal(e.ultimo_ingreso)
      ]);

    // 3. Datos de Ausentes
    const ausentesEncabezado = [
      [],
      ["AUSENTES"],
      ["Nombre", "Documento", "Fecha Salida", "Hora Salida", "Inactividad"]
    ];

    const ausentesData = empleados
      .filter(e => !e.en_almacen)
      .map(e => [
        e.nombre,
        e.documento || 'N/A',
        e.ultima_salida ? new Date(e.ultima_salida).toLocaleDateString() : 'N/A',
        e.ultima_salida ? new Date(e.ultima_salida).toLocaleTimeString() : 'N/A',
        calcularTiempoReal(e.ultima_salida)
      ]);

    // Unificar todo en una matriz para Excel
    const dataFinal = [...encabezado, ...presentesData, ...ausentesEncabezado, ...ausentesData];

    const ws = XLSX.utils.aoa_to_sheet(dataFinal);
    const wb = XLSX.utils.book_new();
    
    // Nombre de la hoja: presencial+fecha+hora
    const nombreHoja = `presencial${fechaStr}${horaStr}`;
    XLSX.utils.book_append_sheet(wb, ws, nombreHoja.substring(0, 31)); // Límite Excel 31 chars
    
    XLSX.writeFile(wb, `Reporte_Presencia_${fechaStr}.xlsx`);
  };

  const presentes = empleados.filter(e => e.en_almacen);
  const ausentes = empleados.filter(e => !e.en_almacen);

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <div className="max-w-[1800px] mx-auto">
        <header className="flex justify-between items-start mb-16">
          <div>
            <h2 className="text-4xl font-black uppercase italic tracking-tighter">Estado de <span className="text-blue-500">Presencia</span></h2>
            {user && (
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">
                USER: <span className="text-white italic">{user.nombre}</span> • 
                ROL: <span className="text-blue-400">{user.rol === 'admin' ? 'ADMINISTRADOR' : user.rol}</span>
              </p>
            )}
          </div>
          <div className="flex gap-4">
            <button onClick={exportarExcel} className="p-4 bg-emerald-600/20 border border-emerald-500/20 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all">📊 Exportar Reporte</button>
            <button onClick={() => router.push('/admin')} className="p-4 bg-[#1e293b] rounded-2xl border border-white/5 font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all">← Configuración</button>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-16">
          {/* SECCIÓN PRESENTES */}
          <div className="space-y-8">
            <h3 className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.4em] border-b border-emerald-500/20 pb-4">✓ EN INSTALACIÓN ({presentes.length})</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-4">
              {presentes.map(emp => (
                <div key={emp.id} className="flex flex-col group">
                  <span className="text-sm font-black uppercase text-emerald-500 italic mb-1 group-hover:text-white transition-colors">{emp.nombre}</span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Tiempo: <span className="text-white font-black">{calcularTiempoReal(emp.ultimo_ingreso)}</span></span>
                </div>
              ))}
            </div>
          </div>

          {/* SECCIÓN AUSENTES */}
          <div className="space-y-8">
            <h3 className="text-[10px] font-black uppercase text-red-500 tracking-[0.4em] border-b border-red-500/20 pb-4">✗ FUERA DE RANGO ({ausentes.length})</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-4">
              {ausentes.map(emp => (
                <div key={emp.id} className="flex flex-col group">
                  <span className="text-sm font-black uppercase text-red-600 italic mb-1 group-hover:text-white transition-colors">{emp.nombre}</span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Inactividad: <span className="text-white/70">{calcularTiempoReal(emp.ultima_salida)}</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}