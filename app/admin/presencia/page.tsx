'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function PresenciaPage() {
  const [user, setUser] = useState<any>(null);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    setUser(JSON.parse(sessionData));
    
    fetchData();
    const channel = supabase.channel('presencia-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, fetchData).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [router]);

  const fetchData = async () => {
    const { data } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
    if (data) setEmpleados(data);
  };

  const calcularTiempo = (timestamp: string | null) => {
    if (!timestamp) return '0h 0m';
    const inicio = new Date(timestamp).getTime();
    const difMs = new Date().getTime() - inicio;
    const horas = Math.floor(difMs / 3600000);
    const minutos = Math.floor((difMs % 3600000) / 60000);
    return `${horas}h ${minutos}m`;
  };

  const exportarExcel = () => {
    const reporte = empleados.map(e => ({
      Nombre: e.nombre,
      Estado: e.en_almacen ? 'PRESENTE' : 'AUSENTE',
      'Último Ingreso': e.ultimo_ingreso ? new Date(e.ultimo_ingreso).toLocaleString() : 'N/A',
      'Última Salida': e.ultima_salida ? new Date(e.ultima_salida).toLocaleString() : 'N/A'
    }));
    const ws = XLSX.utils.json_to_sheet(reporte);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Presencia");
    XLSX.writeFile(wb, `Estado_Presencia_${new Date().toLocaleDateString()}.xlsx`);
  };

  const presentes = empleados.filter(e => e.en_almacen && e.activo);
  const ausentes = empleados.filter(e => !e.en_almacen && e.activo);

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <div className="max-w-[1800px] mx-auto">
        <header className="flex justify-between items-start mb-16">
          <div>
            <h2 className="text-4xl font-black uppercase italic tracking-tighter">Estado de <span className="text-blue-500">Presencia</span></h2>
            {user && (
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">
                SESIÓN: <span className="text-white italic">{user.nombre}</span> • <span className="text-blue-400">{user.rol}</span>
              </p>
            )}
          </div>
          <div className="flex gap-4">
            <button onClick={exportarExcel} className="p-4 bg-emerald-600/20 border border-emerald-500/20 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all">📊 Exportar Excel</button>
            <button onClick={() => router.push('/admin')} className="p-4 bg-[#1e293b] rounded-2xl border border-white/5 font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all">← Volver</button>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-16">
          <div className="space-y-8">
            <h3 className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.4em] border-b border-emerald-500/20 pb-4">✓ PRESENTES ({presentes.length})</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-4">
              {presentes.map(emp => (
                <div key={emp.id} className="flex flex-col">
                  <span className="text-sm font-black uppercase text-emerald-500 italic mb-1">{emp.nombre}</span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Tiempo: <span className="text-white">{calcularTiempo(emp.ultimo_ingreso)}</span></span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-8">
            <h3 className="text-[10px] font-black uppercase text-red-500 tracking-[0.4em] border-b border-red-500/20 pb-4">✗ AUSENTES ({ausentes.length})</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-4">
              {ausentes.map(emp => (
                <div key={emp.id} className="flex flex-col">
                  <span className="text-sm font-black uppercase text-red-600 italic mb-1">{emp.nombre}</span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Fuera: <span className="text-white/70">{calcularTiempo(emp.ultima_salida)}</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}