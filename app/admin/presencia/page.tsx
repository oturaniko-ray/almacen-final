'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function PresenciaPage() {
  const [user, setUser] = useState<any>(null);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [ahora, setAhora] = useState(new Date()); // Para actualización en tiempo real
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    setUser(JSON.parse(sessionData));
    
    fetchData();

    // Actualización cada minuto para refrescar los contadores de tiempo
    const timer = setInterval(() => setAhora(new Date()), 60000);

    // Auditoría Realtime: Escuchamos cambios en empleados y jornadas
    const channel = supabase.channel('presencia-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, fetchData)
      .subscribe();

    return () => { 
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, [router]);

  const fetchData = async () => {
    // Traemos empleados y sus jornadas relacionadas para el cálculo exacto
    const { data, error } = await supabase
      .from('empleados')
      .select(`
        *,
        jornadas (
          entrada,
          salida,
          duracion_minutos
        )
      `)
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (data) setEmpleados(data);
  };

  // AJUSTE 1 y 3: Cálculo preciso basado en la tabla jornadas
  const calcularTiempoReal = (emp: any) => {
    if (emp.en_almacen) {
      // Si está presente, calculamos desde su último ingreso registrado
      if (!emp.ultimo_ingreso) return '0h 0m';
      const inicio = new Date(emp.ultimo_ingreso).getTime();
      const difMs = ahora.getTime() - inicio;
      const horas = Math.floor(difMs / 3600000);
      const minutos = Math.floor((difMs % 3600000) / 60000);
      return `${horas}h ${minutos}m`;
    } else {
      // Si está ausente, calculamos el tiempo transcurrido desde su última salida
      if (!emp.ultima_salida) return '---';
      const fin = new Date(emp.ultima_salida).getTime();
      const difMs = ahora.getTime() - fin;
      const horas = Math.floor(difMs / 3600000);
      const minutos = Math.floor((difMs % 3600000) / 60000);
      return `${horas}h ${minutos}m`;
    }
  };

  const exportarExcel = () => {
    const reporte = empleados.map(e => ({
      Nombre: e.nombre,
      Estado: e.en_almacen ? 'PRESENTE' : 'AUSENTE',
      'Último Ingreso': e.ultimo_ingreso ? new Date(e.ultimo_ingreso).toLocaleString() : 'N/A',
      'Última Salida': e.ultima_salida ? new Date(e.ultima_salida).toLocaleString() : 'N/A',
      'Tiempo en Estado': calcularTiempoReal(e)
    }));
    const ws = XLSX.utils.json_to_sheet(reporte);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Presencia");
    XLSX.writeFile(wb, `Auditoria_Presencia_${new Date().toLocaleDateString()}.xlsx`);
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
                MODO: <span className="text-white italic">MONITOREO TIEMPO REAL</span> • <span className="text-blue-400">AUDITORÍA JORNADAS</span>
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
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Jornada actual: <span className="text-white font-black">{calcularTiempoReal(emp)}</span></span>
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
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Tiempo fuera: <span className="text-white/70">{calcularTiempoReal(emp)}</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}