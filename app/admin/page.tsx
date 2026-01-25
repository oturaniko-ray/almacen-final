'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AdminPanel() {
  const [user, setUser] = useState<any>(null);
  const [vista, setVista] = useState<'menu' | 'empleados' | 'movimientos'>('menu');
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [sesionDuplicada, setSesionDuplicada] = useState(false);
  const sessionId = useRef(Math.random().toString(36).substring(7));
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    const currentUser = JSON.parse(sessionData);
    if (!['admin', 'administrador'].includes(currentUser.rol)) { router.replace('/'); return; }
    setUser(currentUser);

    const canal = supabase.channel('admin-session').on('broadcast', { event: 'nueva-sesion' }, (payload) => {
      if (payload.payload.userEmail === currentUser.email && payload.payload.sid !== sessionId.current) {
        setSesionDuplicada(true);
        localStorage.removeItem('user_session');
        setTimeout(() => router.push('/'), 3000);
      }
    }).subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [router]);

  if (sesionDuplicada) return <div className="h-screen bg-black flex items-center justify-center text-red-500 font-black italic uppercase">Sesión Duplicada</div>;

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter">CONSOLA <span className="text-blue-500">ADMIN</span></h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Gestión Maestra del Sistema</p>
          </div>
          <button onClick={() => router.push('/')} className="bg-slate-800 hover:bg-slate-700 px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all">← Volver al Menú</button>
        </header>

        {vista === 'menu' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button onClick={() => setVista('empleados')} className="bg-[#0f172a] p-10 rounded-[45px] border border-white/5 hover:border-blue-500/50 transition-all text-left group">
              <h3 className="text-2xl font-black uppercase italic group-hover:text-blue-500 transition-colors">👥 Empleados</h3>
              <p className="text-slate-500 text-xs mt-2 uppercase font-bold tracking-widest">Altas, bajas y edición de PINs</p>
            </button>
            
            {/* NUEVO VÍNCULO AL ARCHIVO DE PERSONAL */}
            <button onClick={() => router.push('/admin/personal')} className="bg-[#0f172a] p-10 rounded-[45px] border border-white/5 hover:border-emerald-500/50 transition-all text-left group">
              <h3 className="text-2xl font-black uppercase italic group-hover:text-emerald-500 transition-colors">🏪 Presencia</h3>
              <p className="text-slate-500 text-xs mt-2 uppercase font-bold tracking-widest">Quién está en el almacén ahora</p>
            </button>

            <button onClick={() => setVista('movimientos')} className="bg-[#0f172a] p-10 rounded-[45px] border border-white/5 hover:border-amber-500/50 transition-all text-left group">
              <h3 className="text-2xl font-black uppercase italic group-hover:text-amber-500 transition-colors">📑 Auditoría</h3>
              <p className="text-slate-500 text-xs mt-2 uppercase font-bold tracking-widest">Historial completo de accesos</p>
            </button>
          </div>
        )}
        {/* Aquí iría la lógica de tablas de empleados/movimientos que ya tienes */}
      </div>
    </main>
  );
}