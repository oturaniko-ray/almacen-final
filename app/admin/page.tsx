'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PanelAdminHub() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { 
      router.replace('/'); 
      return; 
    }
    
    const currentUser = JSON.parse(sessionData);
    const nivel = Number(currentUser.nivel_acceso);

    // SEGURIDAD PERIMETRAL: Mínimo nivel 4 para entrar al Hub Administrativo
    if (nivel < 4) { 
      router.replace('/'); 
      return; 
    }
    
    setUser(currentUser);
    setLoading(false);

    // Lógica de Inactividad Quirúrgica (2 Minutos)
    let timeout: NodeJS.Timeout;
    const resetTimer = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        localStorage.removeItem('user_session');
        router.replace('/');
      }, 120000);
    };

    const eventos = ['mousemove', 'keydown', 'click', 'touchstart'];
    eventos.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      if (timeout) clearTimeout(timeout);
      eventos.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [router]);

  if (loading) return null;

  const nivelUsuario = Number(user?.nivel_acceso || 0);

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans flex items-center justify-center">
      <div className="max-w-6xl w-full">
        <header className="text-center mb-16">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter">
            PANEL DE <span className="text-blue-500">CONTROL</span>
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mt-3">
            JERARQUÍA ADMINISTRATIVA NIVEL {nivelUsuario}
          </p>

          <div className="mt-6 flex flex-col items-center gap-1 bg-white/5 py-3 px-6 rounded-2xl border border-white/5 inline-block mx-auto">
            <p className="text-[11px] font-black text-white uppercase italic">
              {user?.nombre} <span className="text-blue-500 mx-2">|</span> 
              <span className="text-blue-400">{user?.rol}</span>
            </p>
          </div>
        </header>

        {/* GRID DINÁMICO SEGÚN ESCALAFÓN */}
        <div className={`grid gap-8 ${
          nivelUsuario >= 8 ? 'grid-cols-1 md:grid-cols-4' : 
          nivelUsuario >= 5 ? 'grid-cols-1 md:grid-cols-3' : 
          'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto'
        }`}>
          
          {/* MÓDULO 1: PERSONAL (Visible Nivel 4+) */}
          <button 
            onClick={() => router.push('/admin/empleados')} 
            className="bg-[#0f172a] p-10 rounded-[45px] border border-white/5 hover:border-blue-500 transition-all text-left group shadow-2xl relative overflow-hidden active:scale-95"
          >
            <span className="text-3xl block mb-6">👥</span>
            <h3 className="text-xl font-black uppercase italic group-hover:text-blue-500 transition-colors">Personal</h3>
            <p className="text-slate-500 text-[9px] mt-2 uppercase font-bold tracking-widest">Gestión Plantilla P</p>
          </button>

          {/* MÓDULO 2: AUDITORÍA (Visible Nivel 4+) */}
          <button 
            onClick={() => router.push('/admin/auditoria')} 
            className="bg-[#0f172a] p-10 rounded-[45px] border border-white/5 hover:border-amber-500 transition-all text-left group shadow-2xl relative overflow-hidden active:scale-95"
          >
            <span className="text-3xl block mb-6">📑</span>
            <h3 className="text-xl font-black uppercase italic group-hover:text-amber-500 transition-colors">Auditoría</h3>
            <p className="text-slate-500 text-[9px] mt-2 uppercase font-bold tracking-widest">Logs de Seguridad</p>
          </button>

          {/* MÓDULO 3: FLOTA & LOGÍSTICA (Visible Nivel 5+) */}
          {nivelUsuario >= 5 && (
            <button 
              onClick={() => router.push('/admin/flota')} 
              className="bg-[#0f172a] p-10 rounded-[45px] border-2 border-emerald-500/10 hover:border-emerald-500 transition-all text-left group shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                <span className="text-5xl font-black italic text-emerald-500">F</span>
              </div>
              <span className="text-3xl block mb-6">🚛</span>
              <h3 className="text-xl font-black uppercase italic group-hover:text-emerald-500 transition-colors">Flota</h3>
              <p className="text-slate-500 text-[9px] mt-2 uppercase font-bold tracking-widest">Control Operativo</p>
            </button>
          )}

          {/* MÓDULO 4: CONFIGURACIÓN SISTEMA (Visible Nivel 8+) */}
          {nivelUsuario >= 8 && (
            <button 
              onClick={() => router.push('/admin/configuracion')} 
              className="bg-[#0f172a] p-10 rounded-[45px] border-2 border-purple-500/10 hover:border-purple-500 transition-all text-left group shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-700"
            >
              <span className="text-3xl block mb-6">⚙️</span>
              <h3 className="text-xl font-black uppercase italic group-hover:text-purple-500 transition-colors">Sistema</h3>
              <p className="text-slate-500 text-[9px] mt-2 uppercase font-bold tracking-widest">Parámetros Globales</p>
            </button>
          )}

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