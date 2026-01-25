'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PanelAdminHub() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    const currentUser = JSON.parse(sessionData);
    if (!['admin', 'administrador'].includes(currentUser.rol)) { router.replace('/'); return; }
    setUser(currentUser);
  }, [router]);

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans flex items-center justify-center">
      <div className="max-w-4xl w-full">
        <header className="text-center mb-16">
          <h1 className="text-5xl font-black italic uppercase tracking-tighter">CONSOLA <span className="text-blue-500">ADMIN</span></h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mt-3">Gestión de Infraestructura Maestra</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <button onClick={() => router.push('/admin/empleados')} className="bg-[#0f172a] p-12 rounded-[45px] border border-white/5 hover:border-blue-500 transition-all text-left group shadow-2xl">
            <span className="text-3xl block mb-6">👥</span>
            <h3 className="text-xl font-black uppercase italic group-hover:text-blue-500 transition-colors">Empleados</h3>
            <p className="text-slate-500 text-[9px] mt-2 uppercase font-bold tracking-widest">Base de datos y pins</p>
          </button>
          
          <button onClick={() => router.push('/admin/presencia')} className="bg-[#0f172a] p-12 rounded-[45px] border border-white/5 hover:border-emerald-500 transition-all text-left group shadow-2xl">
            <span className="text-3xl block mb-6">🏪</span>
            <h3 className="text-xl font-black uppercase italic group-hover:text-emerald-500 transition-colors">Presencia</h3>
            <p className="text-slate-500 text-[9px] mt-2 uppercase font-bold tracking-widest">Estado en tiempo real</p>
          </button>

          <button onClick={() => router.push('/admin/auditoria')} className="bg-[#0f172a] p-12 rounded-[45px] border border-white/5 hover:border-amber-500 transition-all text-left group shadow-2xl opacity-50 cursor-not-allowed">
            <span className="text-3xl block mb-6">📑</span>
            <h3 className="text-xl font-black uppercase italic group-hover:text-amber-500 transition-colors">Auditoría</h3>
            <p className="text-slate-500 text-[9px] mt-2 uppercase font-bold tracking-widest">Logs de movimientos</p>
          </button>
        </div>

        <div className="mt-16 text-center">
          <button onClick={() => router.push('/')} className="text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all underline underline-offset-8 decoration-slate-800">
            ← Volver al Selector Principal
          </button>
        </div>
      </div>
    </main>
  );
}