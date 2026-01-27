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
    // 1. Validar Sesión y Obtener Datos
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    const currentUser = JSON.parse(sessionData);
    setUser(currentUser);
    
    fetchData();

    // 2. Lógica de Inactividad (2 Minutos)
    let timeout: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        localStorage.clear(); // Limpiar buffer de datos
        router.replace('/'); // Regresar al menú principal
      }, 120000); // 120 segundos
    };

    // Eventos para detectar actividad
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);

    resetTimer(); // Iniciar contador

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
    if (!ultMov) return '--:--';

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
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-start mb-12">
          <div>
            <h2 className="text-4xl font-black uppercase italic tracking-tighter">Estado de <span className="text-blue-500">Presencia</span></h2>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2">Monitoreo de Personal en Tiempo Real</p>
            
            {/* IDENTIFICACIÓN DE USUARIO EN SESIÓN */}
            {user && (
              <div className="mt-4 flex items-center gap-3">
                <div className="h-1 w-8 bg-blue-500 rounded-full"></div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  SESIÓN: <span className="text-white italic">{user.nombre}</span> • <span className="text-blue-400">{user.rol}</span>
                </p>
              </div>
            )}
          </div>
          <button onClick={() => router.push('/admin')} className="p-4 bg-[#1e293b] rounded-2xl border border-white/5 font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all">← Volver</button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* COLUMNA PRESENTES */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-emerald-500 ml-4 tracking-widest flex justify-between">
              <span>✓ En Almacén ({presentes.length})</span>
              <span className="text-slate-500">Tiempo Dentro</span>
            </h3>
            {presentes.map(emp => (
              <div key={emp.id} className="bg-[#0f172a] p-5 rounded-[25px] border border-white/5 flex justify-between items-center group">
                <div>
                  <h4 className="font-bold text-sm uppercase">{emp.nombre}</h4>
                  <p className="text-[9px] text-slate-500 uppercase font-black">{emp.rol}</p>
                </div>
                <div className="text-right">
                  <span className="bg-emerald-500/20 text-emerald-500 px-3 py-1 rounded-lg text-xs font-black">
                    {calcularTiempo(emp.id, 'entrada')}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* COLUMNA AUSENTES */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-red-500 ml-4 tracking-widest flex justify-between">
              <span>✗ Ausentes ({ausentes.length})</span>
              <span className="text-slate-500">Tiempo Out</span>
            </h3>
            {ausentes.map(emp => (
              <div key={emp.id} className="bg-red-500/5 p-5 rounded-[25px] border border-red-500/10 flex justify-between items-center opacity-70 group">
                <div>
                  <h4 className="font-bold text-sm uppercase">{emp.nombre}</h4>
                  <p className="text-[9px] text-slate-500 uppercase font-black">{emp.rol}</p>
                </div>
                <div className="text-right">
                  <span className="bg-red-500/20 text-red-500 px-3 py-1 rounded-lg text-xs font-black">
                    {calcularTiempo(emp.id, 'salida')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}