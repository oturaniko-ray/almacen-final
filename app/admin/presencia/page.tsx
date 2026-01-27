'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function PresenciaPage() {
  const [user, setUser] = useState<any>(null);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    const currentUser = JSON.parse(sessionData);
    setUser(currentUser);
    
    fetchData();

    // Lógica de Inactividad (2 Minutos)
    let timeout: NodeJS.Timeout;
    const resetTimer = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        localStorage.clear();
        router.replace('/');
      }, 120000);
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    resetTimer();

    const channel = supabase.channel('presencia-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, fetchData)
      .subscribe();

    return () => { 
      if (timeout) clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      supabase.removeChannel(channel); 
    };
  }, [router]);

  const fetchData = async () => {
    const { data: emp } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
    const { data: mov } = await supabase.from('movimientos_acceso').select('*').order('fecha_hora', { ascending: false });
    if (emp) setEmpleados(emp);
    if (mov) setMovimientos(mov);
  };

  const calcularTiempo = (empleadoId: string, tipo: 'entrada' | 'salida') => {
    const ultMov = movimientos.find(m => m.empleado_id === empleadoId && m.tipo_movimiento === tipo);
    if (!ultMov) return '0h 0m';
    const inicio = new Date(ultMov.fecha_hora).getTime();
    const ahora = new Date().getTime();
    const difMs = ahora - inicio;
    const horas = Math.floor(difMs / 3600000);
    const minutos = Math.floor((difMs % 3600000) / 60000);
    return `${horas}h ${minutos}m`;
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
          <button onClick={() => router.push('/admin')} className="p-4 bg-[#1e293b] rounded-2xl border border-white/5 font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all">← Volver</button>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-16">
          
          {/* COLUMNA PRESENTES (VERDE) CON GRID 4x4 INTERNO */}
          <div className="space-y-8">
            <h3 className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.4em] border-b border-emerald-500/20 pb-4">
              ✓ PRESENTES ({presentes.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-y-10 gap-x-4">
              {presentes.map(emp => (
                <div key={emp.id} className="flex flex-col">
                  <span className="text-sm font-black uppercase text-emerald-500 italic leading-tight mb-1">{emp.nombre}</span>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Tiempo:</span>
                    <span className="text-xs font-black text-white">{calcularTiempo(emp.id, 'entrada')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* COLUMNA AUSENTES (ROJO) CON GRID 4x4 INTERNO */}
          <div className="space-y-8">
            <h3 className="text-[10px] font-black uppercase text-red-500 tracking-[0.4em] border-b border-red-500/20 pb-4">
              ✗ AUSENTES ({ausentes.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-y-10 gap-x-4">
              {ausentes.map(emp => (
                <div key={emp.id} className="flex flex-col">
                  <span className="text-sm font-black uppercase text-red-600 italic leading-tight mb-1">{emp.nombre}</span>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Fuera:</span>
                    <span className="text-xs font-black text-white/70">{calcularTiempo(emp.id, 'salida')}</span>
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