'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function PresenciaPage() {
  const [user, setUser] = useState<any>(null);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) setUser(JSON.parse(sessionData));
    
    fetchData();
    const channel = supabase.channel('presencia-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, fetchData).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    const { data: emp } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
    const { data: mov } = await supabase.from('movimientos_acceso').select('*').order('fecha_hora', { ascending: false });
    if (emp) setEmpleados(emp);
    if (mov) setMovimientos(mov);
  };

  const calcularHoras = (empId: string) => {
    const ultimo = movimientos.find(m => m.empleado_id === empId && m.tipo_movimiento === 'entrada');
    if (!ultimo) return '0h';
    const diff = (new Date().getTime() - new Date(ultimo.fecha_hora).getTime()) / (1000 * 60 * 60);
    return `${diff.toFixed(1)}h`;
  };

  const presentes = empleados.filter(e => e.en_almacen);
  const ausentes = empleados.filter(e => !e.en_almacen);
  const total = empleados.length || 1;
  const porcP = (presentes.length / total) * 100;

  const exportarPresencia = () => {
    const maxRows = Math.max(presentes.length, ausentes.length);
    const rows = [];
    for (let i = 0; i < maxRows; i++) {
      rows.push({
        'Presentes en Almacén': presentes[i]?.nombre || '',
        'Ausentes': ausentes[i]?.nombre || ''
      });
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estado Presencia");

    XLSX.utils.sheet_add_aoa(ws, [
      ["Exportado por:", user?.nombre, "Rol:", user?.rol],
      ["Fecha/Hora:", new Date().toLocaleString()],
      ["Total Presentes:", presentes.length, "Total Ausentes:", ausentes.length]
    ], { origin: -1 });

    XLSX.writeFile(wb, `Estado_Presencia_${new Date().getTime()}.xlsx`);
  };

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-black uppercase tracking-tighter">Estado de Presencia</h2>
          <div className="flex gap-4">
            <button onClick={exportarPresencia} className="bg-emerald-600 px-5 py-2 rounded-xl font-black text-[10px] uppercase">Exportar Estado</button>
            <button onClick={() => router.push('/admin')} className="bg-slate-800 px-5 py-2 rounded-xl font-black text-[10px] uppercase">← Volver</button>
          </div>
        </header>

        <section className="bg-[#0f172a] p-10 rounded-[45px] border border-white/5 mb-10 flex flex-col md:flex-row items-center justify-around shadow-2xl">
          <div className="relative w-32 h-32 rounded-full border-4 border-[#050a14]" 
               style={{ background: `conic-gradient(#10b981 ${porcP}%, #ef4444 0)` }}>
            <div className="absolute inset-2 bg-[#0f172a] rounded-full flex items-center justify-center">
              <span className="text-xl font-black">{Math.round(porcP)}%</span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Cantidad de empleados presentes:</p>
              <p className="text-4xl font-black text-emerald-500">{presentes.length}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Cantidad de empleados ausentes:</p>
              <p className="text-4xl font-black text-red-500">{ausentes.length}</p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-emerald-500 ml-4 tracking-widest">✓ Presentes</h3>
            {presentes.map(emp => (
              <div key={emp.id} className="bg-emerald-500/5 p-5 rounded-[25px] border border-emerald-500/10 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-sm uppercase">{emp.nombre}</h4>
                  <p className="text-[9px] text-slate-500 uppercase font-black">{emp.rol}</p>
                </div>
                <span className="bg-emerald-500/20 text-emerald-500 px-3 py-1 rounded-lg text-xs font-black">{calcularHoras(emp.id)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-red-500 ml-4 tracking-widest">✗ Ausentes</h3>
            {ausentes.map(emp => (
              <div key={emp.id} className="bg-red-500/5 p-5 rounded-[25px] border border-red-500/10 flex justify-between items-center opacity-60">
                <div>
                  <h4 className="font-bold text-sm uppercase">{emp.nombre}</h4>
                  <p className="text-[9px] text-slate-500 uppercase font-black">{emp.rol}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}