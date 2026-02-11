'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ------------------------------------------------------------
// COMPONENTES VISUALES INTERNOS (ESTILO UNIFICADO)
// ------------------------------------------------------------

// ----- MEMBRETE SUPERIOR (con rol legible) -----
const MemebreteSuperior = ({
  titulo,
  subtitulo,
  usuario,
  conAnimacion = false,
  mostrarUsuario = true
}: {
  titulo: string;
  subtitulo: string;
  usuario?: any;
  conAnimacion?: boolean;
  mostrarUsuario?: boolean;
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

  const getRolDisplay = (rol: string) => {
    if (!rol) return 'SIN ROL';
    const rolLower = rol.toLowerCase();
    if (rolLower === 'admin' || rolLower === 'administrador') {
      return 'Administración';
    }
    return rol.toUpperCase();
  };

  return (
    <div className="w-full max-w-4xl bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 mb-6 text-center shadow-2xl mx-auto">
      {renderTituloBicolor(titulo)}
      <p className={`text-white font-bold text-[17px] uppercase tracking-widest mb-3 ${conAnimacion ? 'animate-pulse-slow' : ''}`}>
        {subtitulo}
      </p>
      {mostrarUsuario && usuario && (
        <div className="mt-2 pt-2 border-t border-white/10">
          <span className="text-sm font-normal text-white uppercase block">
            {usuario.nombre}•{getRolDisplay(usuario.rol)}({usuario.nivel_acceso})
          </span>
        </div>
      )}
    </div>
  );
};

// ----- BOTÓN DE MENÚ ADMIN (estilo consistente) -----
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
        hover:border-blue-500 hover:scale-[1.02] transition-all text-left group 
        shadow-2xl relative overflow-hidden active:scale-95 disabled:opacity-50 
        disabled:cursor-not-allowed disabled:border-white/5 ${className}`}
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
  const [config, setConfig] = useState<any>({ timer_inactividad: 120000 });
  const [tiempoRestante, setTiempoRestante] = useState<number>(120000);
  const router = useRouter();

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // --------------------------------------------------------
  // 1. CARGAR SESIÓN Y CONFIGURACIÓN
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

    const fetchConfig = async () => {
      const { data } = await supabase
        .from('sistema_config')
        .select('valor')
        .eq('clave', 'timer_inactividad')
        .maybeSingle();

      if (data) {
        const ms = parseInt(data.valor);
        if (!isNaN(ms) && ms > 0) {
          setConfig({ timer_inactividad: ms });
          setTiempoRestante(ms);
        }
      }
      setLoading(false);
    };

    fetchConfig();
  }, [router]);

  // --------------------------------------------------------
  // 2. LÓGICA DE INACTIVIDAD (con contador visible)
  // --------------------------------------------------------
  const reiniciarTemporizador = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);

    setTiempoRestante(config.timer_inactividad);

    timerRef.current = setTimeout(() => {
      localStorage.clear();
      router.replace('/');
    }, config.timer_inactividad);

    intervalRef.current = setInterval(() => {
      setTiempoRestante((prev) => {
        if (prev <= 1000) {
          clearInterval(intervalRef.current!);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);
  }, [config.timer_inactividad, router]);

  useEffect(() => {
    if (!loading && config.timer_inactividad) {
      const eventos = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
      const reset = () => reiniciarTemporizador();

      eventos.forEach((e) => window.addEventListener(e, reset));
      reiniciarTemporizador();

      return () => {
        eventos.forEach((e) => window.removeEventListener(e, reset));
        if (timerRef.current) clearTimeout(timerRef.current);
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [loading, config.timer_inactividad, reiniciarTemporizador]);

  // --------------------------------------------------------
  // 3. FUNCIONES AUXILIARES
  // --------------------------------------------------------
  const formatearTiempo = (ms: number): string => {
    if (ms <= 0) return '00:00';
    const minutos = Math.floor(ms / 60000);
    const segundos = Math.floor((ms % 60000) / 1000);
    return `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
  };

  // --------------------------------------------------------
  // 4. RENDERIZADO
  // --------------------------------------------------------
  if (loading) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </main>
    );
  }

  const nivel = Number(user?.nivel_acceso || 0);
  const permisoReportes = user?.permiso_reportes === true;

  // ✅ REGLAS DE NEGOCIO:
  // - Gestión de Empleado: requiere nivel >= 5
  // - Auditoría: nivel >= 5 O (nivel 4 Y permiso_reportes = true)
  // - Flota: requiere nivel >= 5

  return (
    <main className="min-h-screen bg-black p-6 md:p-10 text-white font-sans">
      <div className="max-w-7xl mx-auto">

        {/* MEMBRETE SUPERIOR + INDICADOR DE INACTIVIDAD */}
        <div className="relative">
          <MemebreteSuperior
            titulo="PANEL DE GESTIÓN"
            subtitulo="CONTROL CENTRALIZADO"
            usuario={user}
            conAnimacion={false}
            mostrarUsuario={true}
          />
          <div className="absolute top-0 right-0 mt-6 mr-6 bg-black/60 px-4 py-2 rounded-full border border-white/10">
            <p className="text-[10px] font-black uppercase text-slate-400">
              ⏳ INACTIVIDAD:{' '}
              <span className={tiempoRestante < 30000 ? 'text-amber-500 animate-pulse' : 'text-white'}>
                {formatearTiempo(tiempoRestante)}
              </span>
            </p>
          </div>
        </div>

        {/* ✅ GRID DE BOTONES – SOLO TRES: GESTIÓN DE EMPLEADO, AUDITORÍA, FLOTA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-10 max-w-4xl mx-auto">
          
          {/* 1. GESTIÓN DE EMPLEADO (nivel >=5) */}
          {nivel >= 5 && (
            <BotonMenuAdmin
              texto="Gestión de Empleado"
              icono="👥"
              onClick={() => router.push('/admin/empleados')}
            />
          )}

          {/* 2. AUDITORÍA (nivel >=5 o nivel 4 con permiso_reportes) */}
          {(nivel >= 5 || (nivel === 4 && permisoReportes)) && (
            <BotonMenuAdmin
              texto="Auditoría"
              icono="🔍"
              onClick={() => router.push('/reportes/auditoria')}
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

        {/* BOTÓN CERRAR SESIÓN */}
        <div className="mt-16 text-center">
          <button
            onClick={() => {
              localStorage.clear();
              router.push('/');
            }}
            className="text-emerald-500 font-black uppercase text-[11px] tracking-widest hover:text-white transition-all underline underline-offset-8 decoration-slate-800"
          >
            ✕ CERRAR SESIÓN
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