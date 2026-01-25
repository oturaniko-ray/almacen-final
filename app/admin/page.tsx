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
          <h1 className="text-5xl font-black uppercase tracking-tighter">CONSOLA <span className="text-blue-500">ADMIN</span></h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mt-3">GESTIÓN DE INFRAESTRUCTURA MAESTRA</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <button onClick={() => router.push('/admin/empleados')} className="bg-[#0f172a] p-12 rounded-[45px] border border-white/5 hover:border-blue-500 transition-all group shadow-2xl">
            <h3 className="text-xl font-black uppercase group-hover:text-blue-500">EMPLEADOS</h3>
            <p className="text-slate-500 text-[9px] mt-2 uppercase font-black tracking-widest">ALTAS Y ROLES</p>
          </button>
          
          <button onClick={() => router.push('/admin/presencia')} className="bg-[#0f172a] p-12 rounded-[45px] border border-white/5 hover:border-emerald-500 transition-all group shadow-2xl">
            <h3 className="text-xl font-black uppercase group-hover:text-emerald-500">PRESENCIA</h3>
            <p className="text-slate-500 text-[9px] mt-2 uppercase font-black tracking-widest">ESTADO EN VIVO</p>
          </button>

          <button disabled className="bg-[#0f172a] p-12 rounded-[45px] border border-white/5 opacity-40 cursor-not-allowed">
            <h3 className="text-xl font-black uppercase">AUDITORÍA</h3>
            <p className="text-slate-500 text-[9px] mt-2 uppercase font-black tracking-widest">PRÓXIMAMENTE</p>
          </button>
        </div>
        <div className="mt-16 text-center">
          <button onClick={() => router.push('/')} className="text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all">← REGRESAR AL MENÚ</button>
        </div>
      </div>
    </main>
  );
}