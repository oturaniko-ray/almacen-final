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
    // 🛡️ REVISIÓN: Aseguramos que reconozca ambos términos de administrador
    const rolesAutorizados = ['admin', 'administrador'];
    if (!rolesAutorizados.includes(currentUser.rol.toLowerCase())) { 
      router.replace('/'); 
      return; 
    }
    setUser(currentUser);

    // ⏱️ SEGURIDAD: Cierre de sesión por inactividad (2 min)
    let timeout: NodeJS.Timeout;
    const resetTimer = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        localStorage.clear(); // Limpia buffers
        router.replace('/');
      }, 120000); // 120 segundos
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    resetTimer();

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans flex items-center justify-center">
      <div className="max-w-4xl w-full text-center">
        <header className="mb-16">
          <h1 className="text-5xl font-black italic uppercase tracking-tighter">
            CONSOLA <span className="text-blue-500">ADMIN</span>
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mt-3">Gestión de Infraestructura</p>
          
          {/* IDENTIFICACIÓN DEL USUARIO (Solicitado) */}
          {user && (
            <div className="mt-6 p-4 border-t border-white/5 inline-block">
              <p className="text-xs font-bold text-white uppercase italic">{user.nombre}</p>
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{user.rol}</p>
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <button onClick={() => router.push('/admin/empleados')} className="bg-[#0f172a] p-12 rounded-[45px] border border-white/5 hover:border-blue-500 transition-all text-left group">
            <h3 className="text-xl font-black uppercase italic group-hover:text-blue-500">👥 Empleados</h3>
            <p className="text-slate-500 text-[9px] mt-2 uppercase font-bold tracking-widest">Base de datos y pins</p>
          </button>
          
          <button onClick={() => router.push('/admin/presencia')} className="bg-[#0f172a] p-12 rounded-[45px] border border-white/5 hover:border-emerald-500 transition-all text-left group">
            <h3 className="text-xl font-black uppercase italic group-hover:text-emerald-500">🏪 Presencia</h3>
            <p className="text-slate-500 text-[9px] mt-2 uppercase font-bold tracking-widest">Tiempo Real</p>
          </button>
        </div>
      </div>
    </main>
  );
}