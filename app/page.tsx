'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PanelAdminHub() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // 1. Validación de Sesión y Seguridad Perimetral
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { 
      router.replace('/'); 
      return; 
    }
    
    const currentUser = JSON.parse(sessionData);
    const nivel = Number(currentUser.nivel_acceso);

    // SEGURIDAD: Solo niveles >= 4 pueden acceder a este Hub Administrativo
    if (nivel < 4) { 
      router.replace('/'); 
      return; 
    }
    
    setUser(currentUser);
    setLoading(false);

    // 2. Protocolo de Inactividad Quirúrgica (120s)
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

  // Determinar columnas del grid para mantener estética visual según el nivel
  const getGridCols = () => {
    if (nivelUsuario >= 8) return 'grid-cols-1 md:grid-cols-4';
    if (nivelUsuario >= 5) return 'grid-cols-1 md:grid-cols-3';
    return 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto';
  };

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans flex items-center justify-center">
      <div className="max-w-6xl w-full">
        <header className="text-center mb-16">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter">
            PANEL DE <span className="text-blue-500">GESTIÓN</span>
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mt-3">
            CONTROL CENTRALIZADO • NIVEL {nivelUsuario}
          </p>

          <div className="mt-6 flex flex-col items-center gap-1 bg-white/5 py-3 px-8 rounded-2xl border border-white/5 inline-block mx-auto">
            <p className="text-[11px] font-black text-white uppercase italic">
              {user?.nombre} <span className="text-blue-500 mx-2">|</span> 
              <span className="text-blue-400">{user?.rol}</span>
            </p>
          </div>
        </header>

        {/* GRID DINÁMICO SEGÚN NIVEL DE ACCESO */}
        <div className={`grid gap-8 ${getGridCols()}`}>
          
          {/* NIVEL 4+: PERSONAL (Ubicación: app/admin/empleados) */}
          <button 
            onClick={() => router.push('/admin/empleados')} 
            className="bg-[#0f172a] p-10 rounded-[45px] border border-white/5 hover:border-blue-500 transition-all text-left group shadow-2xl relative overflow-hidden active:scale-95"
          >
            <span className="text-3xl block mb-6">👥</span>
            <h3 className="text-xl font-black uppercase italic group-hover:text-blue-500 transition-colors">Personal</h3>
            <p className="text-slate-500 text-[9px] mt-2 uppercase font-bold tracking-widest">Plantilla y Pins P</p>
          </button>

          {/* NIVEL 4+: REPORTES & AUDITORÍA (Ubicación: app/admin/reportes y app/admin/auditoria) */}
          <button 
            onClick={() => router.push('/admin/reportes')} 
            className="bg-[#0f172a] p-10 rounded-[45px] border border-white/5 hover:border-amber-500 transition-all text-left group shadow-2xl relative overflow-hidden active:scale-95"
          >
            <span className="text-3xl block mb-6">📑</span>
            <h3 className="text-xl font-black uppercase italic group-hover:text-amber-500 transition-colors">Auditoría</h3>
            <p className="text-slate-500 text-[9px] mt-2 uppercase font-bold tracking-widest">Reportes y Análisis</p>
          </button>

          {/* NIVEL 5+: FLOTA & LOGÍSTICA (Ubicación: app/admin/flota) */}
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
              <p className="text-slate-500 text-[9px] mt-2 uppercase font-bold tracking-widest">Gestión Operativa</p>
            </button>
          )}

          {/* NIVEL 8+: CONFIGURACIÓN (Ubicación: app/admin/configuracion) */}
          {nivelUsuario >= 8 && (
            <button 
              onClick={() => router.push('/admin/configuracion')} 
              className="bg-[#0f172a] p-10 rounded-[45px] border-2 border-purple-500/10 hover:border-purple-500 transition-all text-left group shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-700"
            >
              <span className="text-3xl block mb-6">⚙️</span>
              <h3 className="text-xl font-black uppercase italic group-hover:text-purple-500 transition-colors">Sistema</h3>
              <p className="text-slate-500 text-[9px] mt-2 uppercase font-bold tracking-widest">Configuración Global</p>
            </button>
          )}

        </div>

        <div className="mt-16 text-center">
          <button 
            onClick={() => router.push('/')} 
            className="text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all underline underline-offset-8 decoration-slate-800"
          >
            ← Salir al Selector Principal
          </button>
        </div>
      </div>
    </main>
  );
}