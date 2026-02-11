'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ------------------------------------------------------------
// COMPONENTES VISUALES INTERNOS (ESTILO UNIFICADO)
// ------------------------------------------------------------

// ----- MEMBRETE SUPERIOR – EXACTAMENTE COMO LA CAPTURA -----
const MemebreteSuperior = ({
  titulo,
  subtitulo,
  usuario,
  modulo,
  conAnimacion = false
}: {
  titulo: string;
  subtitulo: string;
  usuario?: any;
  modulo?: string;
  conAnimacion?: boolean;
}) => {
  const renderTituloBicolor = (texto: string) => {
    const palabras = texto.split(' ');
    const ultimaPalabra = palabras.pop();
    const primerasPalabras = palabras.join(' ');
    return (
      <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-2">
        <span className="text-white">{primerasPalabras} </span>
        <span className="text-blue-700">{ultimaPalabra}</span>
      </h1>
    );
  };

  return (
    <div className="w-full max-w-4xl bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 mb-6 text-center shadow-2xl mx-auto">
      {renderTituloBicolor(titulo)}
      <p className={`text-white font-bold text-[17px] uppercase tracking-widest mb-3 ${conAnimacion ? 'animate-pulse-slow' : ''}`}>
        {subtitulo}
      </p>
      {usuario && modulo && (
        <div className="mt-2 pt-2 border-t border-white/10">
          <span className="text-sm font-normal text-white uppercase block">
            {usuario.nombre}  •  {modulo}  ({usuario.nivel_acceso})
          </span>
        </div>
      )}
    </div>
  );
};

// ----- BOTÓN DE MENÚ ADMIN (CENTRADO) -----
const BotonMenuAdmin = ({
  texto,
  icono,
  onClick,
  disabled = false,
  className = ''
}: {
  texto: string;
  icono: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full bg-[#0f172a] p-8 rounded-[30px] border border-white/5 
        hover:border-blue-500 hover:scale-[1.02] transition-all 
        shadow-2xl relative overflow-hidden active:scale-95 disabled:opacity-50 
        disabled:cursor-not-allowed disabled:border-white/5 
        flex flex-col items-center justify-center text-center ${className}`}
    >
      <span className="text-4xl block mb-4 group-hover:scale-110 transition-transform">
        {icono}
      </span>
      <h3 className="text-lg font-black uppercase italic group-hover:text-blue-500 transition-colors">
        {texto}
      </h3>
    </button>
  );
};

// ------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ------------------------------------------------------------
export default function PanelAdminHub() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // --------------------------------------------------------
  // 1. CARGAR SESIÓN Y VALIDAR ACCESO
  // --------------------------------------------------------
  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) {
      router.replace('/');
      return;
    }

    const currentUser = JSON.parse(sessionData);
    const nivel = Number(currentUser.nivel_acceso);

    // Nivel mínimo para acceder al panel admin: 4
    if (nivel < 4) {
      router.replace('/');
      return;
    }

    setUser(currentUser);
    setLoading(false);
  }, [router]);

  // --------------------------------------------------------
  // 2. RENDERIZADO
  // --------------------------------------------------------
  if (loading) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </main>
    );
  }

  const nivel = Number(user?.nivel_acceso || 0);
  const permisoReportes = user?.permiso_reportes === true;

  return (
    <main className="min-h-screen bg-black p-6 md:p-10 text-white font-sans">
      <div className="max-w-7xl mx-auto">

        {/* MEMBRETE SUPERIOR – EXACTAMENTE COMO LA CAPTURA */}
        <MemebreteSuperior
          titulo="GESTOR DE ACCESO"
          subtitulo="MENÚ PRINCIPAL"
          usuario={user}
          modulo="Panel Administrativo"
          conAnimacion={false}
        />

        {/* GRID DE BOTONES – CENTRADOS, SOLO TRES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-10 max-w-4xl mx-auto">
          
          {/* 1. GESTIÓN ADMINISTRATIVA (nivel >=4) */}
          {nivel >= 4 && (
            <BotonMenuAdmin
              texto="Gestión Administrativa"
              icono="👥"
              onClick={() => router.push('/admin/empleados')}
            />
          )}

          {/* 2. AUDITORÍA (nivel >=5 o (nivel 4 y permiso_reportes = true)) */}
          {(nivel >= 5 || (nivel === 4 && permisoReportes)) && (
            <BotonMenuAdmin
              texto="Auditoría"
              icono="🔍"
              onClick={() => router.push('/admin/auditoria')}
            />
          )}

          {/* 3. FLOTA (nivel >=5) */}
          {nivel >= 5 && (
            <BotonMenuAdmin
              texto="Flota"
              icono="🚛"
              onClick={() => router.push('/admin/flota')}
            />
          )}

        </div>

        {/* BOTÓN VOLVER AL SELECTOR PRINCIPAL */}
        <div className="mt-16 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-blue-500 font-black uppercase text-[11px] tracking-widest hover:text-white transition-all underline underline-offset-8 decoration-slate-800"
          >
            ← VOLVER AL SELECTOR
          </button>
        </div>

      </div>

      {/* ESTILOS GLOBALES */}
      <style jsx global>{`
        @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
        @keyframes flash-fast { 0%, 100% { opacity: 1; } 10%, 30%, 50% { opacity: 0; } 20%, 40%, 60% { opacity: 1; } }
        .animate-flash-fast { animation: flash-fast 2s ease-in-out; }
      `}</style>
    </main>
  );
}