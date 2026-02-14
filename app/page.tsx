'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Función para formatear rol
const formatearRol = (rol: string): string => {
  if (!rol) return 'USUARIO';
  const rolLower = rol.toLowerCase();
  switch (rolLower) {
    case 'admin':
    case 'administrador':
      return 'ADMINISTRADOR';
    case 'supervisor':
      return 'SUPERVISOR';
    case 'tecnico':
      return 'TÉCNICO';
    case 'empleado':
      return 'EMPLEADO';
    default:
      return rol.toUpperCase();
  }
};

export default function LoginPage() {
  const [identificador, setIdentificador] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [paso, setPaso] = useState<'login' | 'selector'>('login');
  const [tempUser, setTempUser] = useState<any>(null);
  const [config, setConfig] = useState<any>({ empresa_nombre: '' });
  const [notificacion, setNotificacion] = useState<{
    mensaje: string;
    tipo: 'exito' | 'error' | 'advertencia' | 'info' | null;
  }>({ mensaje: '', tipo: null });

  const idRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Cargar configuración y sesión
  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase.from('sistema_config').select('clave, valor');
      if (data) {
        const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
        setConfig(cfgMap);
      }
    };
    fetchConfig();

    const sessionData = localStorage.getItem('user_session');
    if (sessionData) {
      const user = JSON.parse(sessionData);
      if (Number(user.nivel_acceso) <= 2) router.push('/empleado');
      else { setTempUser(user); setPaso('selector'); }
    }
  }, [router]);

  const logout = () => {
    localStorage.clear();
    setTempUser(null);
    setIdentificador('');
    setPin('');
    setPaso('login');
  };

  const mostrarNotificacion = (
    mensaje: string,
    tipo: 'exito' | 'error' | 'advertencia' | 'info'
  ) => {
    setNotificacion({ mensaje, tipo });
    setTimeout(() => setNotificacion({ mensaje: '', tipo: null }), 3000);
  };

  const handleLogin = async () => {
    if (!identificador || !pin) {
      mostrarNotificacion('Complete todos los campos', 'advertencia');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('empleados')
        .select('*')
        .or(`documento_id.eq."${identificador}",email.eq."${identificador.toLowerCase()}"`)
        .eq('pin_seguridad', pin)
        .eq('activo', true)
        .maybeSingle();

      if (error || !data) throw new Error('Credenciales inválidas');

      const userData = {
        ...data,
        nivel_acceso: Number(data.nivel_acceso),
        permiso_reportes: !!data.permiso_reportes,
      };
      localStorage.setItem('user_session', JSON.stringify(userData));

      if (userData.nivel_acceso <= 2) router.push('/empleado');
      else {
        setTempUser(userData);
        setPaso('selector');
      }
    } catch {
      mostrarNotificacion('Acceso denegado', 'error');
      setIdentificador('');
      setPin('');
      idRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Filtro de botones por nivel (solo para empleados/supervisores/admin)
  const obtenerBotonesDisponibles = () => {
    const nivel = Number(tempUser?.nivel_acceso || 0);
    const tienePermisoReportes = tempUser?.permiso_reportes === true;

    const todosLosBotones = [
      {
        label: 'ACCESO EMPLEADO',
        icono: '🫆',
        ruta: '/empleado',
        minNivel: 1,
        color: 'bg-emerald-600',
      },
      {
        label: 'PANEL SUPERVISOR',
        icono: '🕖',
        ruta: '/supervisor',
        minNivel: 3,
        color: 'bg-blue-600',
      },
      {
        label: 'REPORTES Y ANÁLISIS',
        icono: '📊',
        ruta: '/reportes',
        minNivel: 3,
        color: 'bg-slate-700',
        requiereReportes: true,
      },
      {
        label: 'GESTIÓN ADMINISTRATIVA',
        icono: '👥',
        ruta: '/admin',
        minNivel: 4,
        color: 'bg-amber-600',
      },
      {
        label: 'CONFIGURACIÓN MAESTRA',
        icono: '👨‍🔧',
        ruta: '/configuracion',
        minNivel: 8,
        color: 'bg-rose-900',
      },
    ];

    return todosLosBotones.filter((btn) => {
      if (nivel < btn.minNivel) return false;
      if (btn.requiereReportes && !tienePermisoReportes) return false;
      if (nivel === 3) return btn.ruta === '/empleado' || btn.ruta === '/supervisor';
      if (nivel === 4) {
        if (btn.ruta === '/reportes') return tienePermisoReportes;
        return btn.ruta === '/empleado' || btn.ruta === '/supervisor' || btn.ruta === '/admin';
      }
      if (nivel === 5) return btn.ruta !== '/configuracion';
      if (nivel >= 6 && nivel <= 7) return btn.ruta !== '/configuracion';
      return true;
    });
  };

  // Componentes visuales
  const Memebrete = () => (
    <div className="w-full max-w-sm bg-[#1a1a1a] p-4 rounded-[25px] border border-white/5 mb-3 text-center shadow-2xl">
      <h1 className="text-lg font-black italic uppercase tracking-tighter leading-none mb-2">
        <span className="text-white">GESTOR DE </span>
        <span className="text-blue-700">ACCESO</span>
      </h1>
      <p className="text-white font-bold text-[15px] uppercase tracking-widest mb-2">
        MENÚ PRINCIPAL
      </p>
      {paso === 'selector' && tempUser && (
        <div className="mt-2 pt-2 border-t border-white/10">
          <span className="text-xs text-white normal-case">{tempUser.nombre}</span>
          <span className="text-xs text-white mx-2">•</span>
          <span className="text-xs text-blue-500 normal-case">
            {formatearRol(tempUser.rol)}
          </span>
          <span className="text-xs text-white ml-2">({tempUser.nivel_acceso})</span>
        </div>
      )}
    </div>
  );

  const BotonOpcion = ({
    texto,
    icono,
    onClick,
    color,
  }: {
    texto: string;
    icono: string;
    onClick: () => void;
    color: string;
  }) => (
    <button
      onClick={onClick}
      className={`w-full ${color} p-2 rounded-xl border border-white/5 
        active:scale-95 transition-transform shadow-lg 
        flex flex-col items-center justify-center gap-1`}
    >
      <div className="w-10 h-10 rounded-full bg-black/30 border border-white/20 flex items-center justify-center">
        <span className="text-xl">{icono}</span>
      </div>
      <span className="text-white font-bold uppercase text-[10px] tracking-wider">
        {texto}
      </span>
    </button>
  );

  const BotonAccion = ({
    texto,
    icono,
    onClick,
    disabled = false,
    loading = false,
  }: {
    texto: string;
    icono?: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full bg-blue-600 p-2.5 rounded-xl border border-white/5
        active:scale-95 transition-transform shadow-lg 
        flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed
        text-white font-bold uppercase text-[11px] tracking-wider"
    >
      {icono && <span className="text-lg">{icono}</span>}
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="w-2 h-2 bg-white rounded-full animate-pulse delay-150" />
          <span className="w-2 h-2 bg-white rounded-full animate-pulse delay-300" />
        </span>
      ) : (
        texto
      )}
    </button>
  );

  const Footer = () => (
    <div className="w-full max-w-sm mt-6 pt-3 text-center">
      <p className="text-[9px] text-white/40 uppercase tracking-widest mb-3">
        @Copyright 2026
      </p>
      {paso === 'selector' && (
        <button
          onClick={logout}
          className="text-emerald-500 font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 mx-auto active:scale-95 transition-transform"
        >
          <span className="text-lg">🏠</span> CERRAR SESIÓN
        </button>
      )}
    </div>
  );

  const Notificacion = () => {
    if (!notificacion.tipo) return null;
    const colores = {
      exito: 'bg-emerald-500 border-emerald-400',
      error: 'bg-rose-500 border-rose-400',
      advertencia: 'bg-amber-500 border-amber-400',
      info: 'bg-blue-500 border-blue-400',
    };
    const iconos = {
      exito: '✅',
      error: '❌',
      advertencia: '⚠️',
      info: 'ℹ️',
    };
    return (
      <div
        className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-xl
          font-bold text-sm shadow-2xl animate-flash-fast max-w-[90%] text-center
          border-2 ${colores[notificacion.tipo]} text-white flex items-center gap-3`}
      >
        <span className="text-lg">{iconos[notificacion.tipo]}</span>
        <span>{notificacion.mensaje}</span>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans">
      <Notificacion />

      <div className="w-full max-w-sm flex flex-col items-center">
        <Memebrete />

        {paso === 'login' ? (
          <div className="w-full space-y-3">
            <input
              ref={idRef}
              type="text"
              placeholder="ID / CORREO"
              className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-center text-[11px] font-bold text-white outline-none focus:border-blue-500/50 uppercase"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && pinRef.current?.focus()}
              autoFocus
            />
            <input
              ref={pinRef}
              type="password"
              placeholder="PIN"
              className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-center text-[11px] font-black text-white tracking-[0.4em] outline-none focus:border-blue-500/50 uppercase"
              value={pin}
              onChange={(e) => setPin(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            <BotonAccion
              texto={loading ? 'VERIFICANDO...' : 'ENTRAR'}
              icono="🔐"
              onClick={handleLogin}
              disabled={loading}
              loading={loading}
            />
          </div>
        ) : (
          <div className="w-full flex flex-col gap-2">
            {obtenerBotonesDisponibles().map((btn) => (
              <BotonOpcion
                key={btn.ruta}
                texto={btn.label}
                icono={btn.icono}
                onClick={() => router.push(btn.ruta)}
                color={btn.color}
              />
            ))}
            {/* BOTÓN ADICIONAL PARA ACCESO DE CONDUCTORES (FLOTA) */}
            <button
              onClick={() => router.push('/flota/login')}
              className="w-full bg-blue-800 p-2 rounded-xl border border-white/5 
                active:scale-95 transition-transform shadow-lg 
                flex flex-col items-center justify-center gap-1 mt-2"
            >
              <div className="w-10 h-10 rounded-full bg-black/30 border border-white/20 flex items-center justify-center">
                <span className="text-xl">F</span>
              </div>
              <span className="text-white font-bold uppercase text-[10px] tracking-wider">
                ACCESO CONDUCTORES
              </span>
            </button>
          </div>
        )}

        <Footer />
      </div>

      <style jsx global>{`
        @keyframes flash-fast {
          0%, 100% { opacity: 1; }
          10%, 30%, 50% { opacity: 0; }
          20%, 40%, 60% { opacity: 1; }
        }
        .animate-flash-fast {
          animation: flash-fast 2s ease-in-out;
        }
      `}</style>
    </main>
  );
}