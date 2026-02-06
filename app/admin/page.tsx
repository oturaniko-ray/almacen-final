'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PanelAdminHub() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    // 1. Validar Sesión y Obtener Datos
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    
    const currentUser = JSON.parse(sessionData);
    
    // VALIDACIÓN POR NIVEL: Permitir Nivel 4 o superior (incluye Técnicos Nivel 8)
    const nivel = Number(currentUser.nivel_acceso);
    if (nivel < 4) { 
      router.replace('/'); 
      return; 
    }
    setUser(currentUser);

    // 2. Lógica de Inactividad (120 segundos)
    let timeout: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        localStorage.removeItem('user_session');
        router.replace('/');
      }, 120000);
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);

    resetTimer();

    return () => {
      if (timeout) clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans flex items-center justify-center">
      <div className="max-w-4xl w-full">
        <header className="text-center mb-16">
          <h1 className="text-5xl font-black italic uppercase tracking-tighter">
            CONSOLA <span className="text-blue-500">ADMIN</span>
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mt-3">
            Gestión de Infraestructura Maestra
          </p>

          {user && (
            <div className="mt-6 flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">USUARIO:</span>
                <span className="text-[11px] font-black text-white uppercase italic">{user.nombre}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">CREDERNCIALES:</span>
                <span className="text-[11px] font-black text-blue-400 uppercase italic">
                  {user.rol}({user.nivel_acceso})
                </span>
              </div>
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <button onClick={() => router.push('/admin/empleados')} className="bg-[#0f172a] p-12 rounded-[45px] border border-white/5 hover:border-blue-500 transition-all text-left group shadow-2xl">
            <span className="text-3xl block mb-6">👥</span>
            <h3 className="text-xl font-black uppercase italic group-hover:text-blue-500 transition-colors">Empleados</h3>
            <p className="text-slate-500 text-[9px] mt-2 uppercase font-bold tracking-widest">Base de datos y pins</p>
          </button>
          
          <button onClick={() => router.push('/admin/auditoria')} className="bg-[#0f172a] p-12 rounded-[45px] border border-white/5 hover:border-amber-500 transition-all text-left group shadow-2xl">
            <span className="text-3xl block mb-6">📑</span>
            <h3 className="text-xl font-black uppercase italic group-hover:text-amber-500 transition-colors">Auditoría</h3>
            <p className="text-slate-500 text-[9px] mt-2 uppercase font-bold tracking-widest">Logs de movimientos</p>
          </button>
        </div>

        <div className="mt-16 text-center">
          <button 
            onClick={() => router.push('/')} 
            className="text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all underline underline-offset-8 decoration-slate-800"
          >
            ← Volver al Selector Principal
          </button>
        </div>
      </div>
    </main>
  );
}