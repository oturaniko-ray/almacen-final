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
      <div className="max-w-[1600px] mx-auto">
        <header className="flex justify-between items-start mb-12">
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

        <div className="grid grid-cols-1 gap-16">
          
          {/* SECCIÓN PRESENTES (VERDE) - GRID 4 COLUMNAS */}
          <div>
            <h3 className="text-xs font-black uppercase text-emerald-500 mb-6 tracking-[0.3em] flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              En Almacén ({presentes.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {presentes.map(emp => (
                <div key={emp.id} className="bg-emerald-500/10 border border-emerald-500/20 p-8 rounded-[35px] text-center flex flex-col items-center justify-center transition-all hover:bg-emerald-500/20 shadow-lg shadow-emerald-900/10">
                  <p className="text-sm font-black uppercase text-emerald-400 leading-tight mb-2">{emp.nombre}</p>
                  <div className="h-[1px] w-12 bg-emerald-500/30 mb-3"></div>
                  <p className="text-[10px] font-bold text-white/50 uppercase tracking-tighter mb-1">En Almacén:</p>
                  <p className="text-lg font-black text-white">{calcularTiempo(emp.id, 'entrada')}</p>
                </div>
              ))}
            </div>
          </div>

          {/* SECCIÓN AUSENTES (ROJO) - GRID 4 COLUMNAS */}
          <div>
            <h3 className="text-xs font-black uppercase text-red-500 mb-6 tracking-[0.3em] flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              Ausentes ({ausentes.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {ausentes.map(emp => (
                <div key={emp.id} className="bg-red-500/5 border border-red-500/10 p-8 rounded-[35px] text-center flex flex-col items-center justify-center transition-all hover:bg-red-500/10 shadow-lg">
                  <p className="text-sm font-black uppercase text-red-400/80 leading-tight mb-2">{emp.nombre}</p>
                  <div className="h-[1px] w-12 bg-red-500/20 mb-3"></div>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-tighter mb-1">Tiempo Fuera:</p>
                  <p className="text-lg font-black text-white/70">{calcularTiempo(emp.id, 'salida')}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}