'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SubmenuFlotaHub() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    const currentUser = JSON.parse(sessionData);
    
    // VALIDACIÓN NIVEL 5: Requisito operativo estricto
    if (Number(currentUser.nivel_acceso) < 5) { 
      router.replace('/admin'); 
      return; 
    }
    setUser(currentUser);
  }, [router]);

  return (
    <main className="min-h-screen bg-[#020617] p-8 text-white font-sans flex items-center justify-center">
      <div className="max-w-4xl w-full">
        <header className="text-center mb-16">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter">
            OPERACIONES DE <span className="text-emerald-500">FLOTA</span>
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mt-3">
            Nivel 5 - Control Logístico Avanzado
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* ACCESO A GESTIÓN DE PERFILES */}
          <button 
            onClick={() => router.push('/admin/flota/gestionflota')} 
            className="bg-[#0f172a] p-12 rounded-[45px] border border-white/5 hover:border-blue-500 transition-all text-left group shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-20 transition-opacity">
              <span className="text-7xl font-black italic">G</span>
            </div>
            <span className="text-4xl block mb-6">⚙️</span>
            <h3 className="text-xl font-black uppercase italic group-hover:text-blue-500 transition-colors">Gestión de Perfiles</h3>
            <p className="text-slate-500 text-[9px] mt-2 uppercase font-bold tracking-widest leading-relaxed">
              Alta de choferes, capacidad de rutas y <br/>generación de Smart Pins F
            </p>
          </button>

          {/* ACCESO A REPORTES Y AUDITORÍA */}
          <button 
            onClick={() => router.push('/admin/flota/auditoreporte')} 
            className="bg-[#0f172a] p-12 rounded-[45px] border border-white/5 hover:border-emerald-500 transition-all text-left group shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-20 transition-opacity">
              <span className="text-7xl font-black italic">A</span>
            </div>
            <span className="text-4xl block mb-6">📊</span>
            <h3 className="text-xl font-black uppercase italic group-hover:text-emerald-500 transition-colors">Auditoría y Reportes</h3>
            <p className="text-slate-500 text-[9px] mt-2 uppercase font-bold tracking-widest leading-relaxed">
              Análisis de cumplimiento: <br/>Capacidad Nominal vs Carga Real
            </p>
          </button>

        </div>

        <div className="mt-16 text-center">
          <button 
            onClick={() => router.push('/admin')} 
            className="text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all"
          >
            ← Volver al Panel Administrativo
          </button>
        </div>
      </div>
    </main>
  );
}