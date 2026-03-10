'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

// ------------------------------------------------------------
// INTERFACES
// ------------------------------------------------------------
interface Empleado {
  id: string;
  nombre: string;
  email: string;
  documento_id: string;
  nivel_acceso: number;
  permiso_reportes: boolean;
  rol: string;
  pin_seguridad: string;
  activo: boolean;
  foto_url?: string;
  telegram_token?: string;
  created_at?: string;
  updated_at?: string;
}

interface UserSession {
  id: string;
  nombre: string;
  rol: string;
  nivel_acceso: number;
  permiso_reportes: boolean;
  foto_url?: string;
}

// ------------------------------------------------------------
// ICONOS PERSONALIZADOS
// ------------------------------------------------------------

const IconEmployee = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
    <path d="M5 20V19C5 15.6863 7.68629 13 11 13H13C16.3137 13 19 15.6863 19 19V20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M16 6L19 9L22 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconSupervisor = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
    <path d="M12 8V12L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M8 5L5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M16 5L19 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const IconReports = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 17V20H21V17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 14V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 14V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M17 14V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconAdmin = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M19.4 15L18.5 18.6L15 20L12 18L9 20L5.5 18.6L4.6 15L6 12L4.6 9L5.5 5.4L9 4L12 6L15 4L18.5 5.4L19.4 9L18 12L19.4 15Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconMaster = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M20 7L17 4M20 17L17 20M4 7L7 4M4 17L7 20M12 3V6M12 21V18M3 12H6M21 12H18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const IconLogout = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 16L19 12M19 12L15 8M19 12H9M14 20H6C4.89543 20 4 19.1046 4 18V6C4 4.89543 4.89543 4 6 4H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ------------------------------------------------------------
// COMPONENTE DE NOTIFICACIÓN
// ------------------------------------------------------------
const Notificacion = ({ mensaje, tipo, visible }: { mensaje: string; tipo: 'exito' | 'error' | 'advertencia' | null; visible: boolean }) => {
  if (!visible || !tipo) return null;
  
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-2xl bg-white/90 backdrop-blur-md shadow-lg border border-white/20 text-slate-800 text-sm font-medium animate-slide-in">
      {mensaje}
    </div>
  );
};

// ------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ------------------------------------------------------------
export default function HomePage() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [identificador, setIdentificador] = useState('');
  const [pin, setPin] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [notificacion, setNotificacion] = useState<{ mensaje: string; tipo: 'exito' | 'error' | 'advertencia' | null }>({ mensaje: '', tipo: null });
  
  const idRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // ------------------------------------------------------------
  // VERIFICAR SESIÓN AL INICIAR
  // ------------------------------------------------------------
  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) {
      try {
        const userData = JSON.parse(sessionData) as Empleado;
        setUser({
          id: userData.id,
          nombre: userData.nombre,
          rol: userData.rol,
          nivel_acceso: userData.nivel_acceso,
          permiso_reportes: userData.permiso_reportes,
          foto_url: userData.foto_url
        });
      } catch (error) {
        localStorage.removeItem('user_session');
      }
    }
    setLoading(false);
  }, []);

  // ------------------------------------------------------------
  // FUNCIONES AUXILIARES
  // ------------------------------------------------------------
  const mostrarNotificacion = (mensaje: string, tipo: 'exito' | 'error' | 'advertencia') => {
    setNotificacion({ mensaje, tipo });
    setTimeout(() => setNotificacion({ mensaje: '', tipo: null }), 3000);
  };

  const handleLogout = () => {
    localStorage.removeItem('user_session');
    setUser(null);
    setIdentificador('');
    setPin('');
    router.push('/');
  };

  const formatearRol = (rol: string): string => {
    if (!rol) return 'USUARIO';
    const rolLower = rol.toLowerCase();
    switch (rolLower) {
      case 'admin': case 'administrador': return 'ADMINISTRADOR';
      case 'supervisor': return 'SUPERVISOR';
      case 'tecnico': return 'TÉCNICO';
      case 'empleado': return 'EMPLEADO';
      default: return rol.toUpperCase();
    }
  };

  // ------------------------------------------------------------
  // LOGIN
  // ------------------------------------------------------------
  const handleLogin = async () => {
    if (!identificador || !pin) {
      mostrarNotificacion('Complete todos los campos', 'advertencia');
      return;
    }
    
    setAuthLoading(true);
    
    try {
      const pinUpper = pin.toUpperCase();

      let { data: empleado, error } = await supabase
        .from('empleados')
        .select('*')
        .or(`documento_id.eq."${identificador}",email.eq."${identificador.toLowerCase()}"`)
        .eq('pin_seguridad', pinUpper)
        .eq('activo', true)
        .maybeSingle();

      if (!empleado && !error && pinUpper.startsWith('P') && pinUpper.length === 8) {
        const pinNuevo = 'E01' + pinUpper.substring(1);
        const res2 = await supabase
          .from('empleados')
          .select('*')
          .or(`documento_id.eq."${identificador}",email.eq."${identificador.toLowerCase()}"`)
          .eq('pin_seguridad', pinNuevo)
          .eq('activo', true)
          .maybeSingle();
        empleado = res2.data;
        error = res2.error;
      }

      if (error || !empleado) throw new Error('Credenciales inválidas');

      const empleadoData = empleado as Empleado;
      localStorage.setItem('user_session', JSON.stringify(empleadoData));
      
      setUser({
        id: empleadoData.id,
        nombre: empleadoData.nombre,
        rol: empleadoData.rol,
        nivel_acceso: empleadoData.nivel_acceso,
        permiso_reportes: empleadoData.permiso_reportes,
        foto_url: empleadoData.foto_url
      });

    } catch (error) {
      mostrarNotificacion('Acceso denegado', 'error');
      setIdentificador('');
      setPin('');
      idRef.current?.focus();
    } finally {
      setAuthLoading(false);
    }
  };

  // ------------------------------------------------------------
  // MENÚ PRINCIPAL (cuando hay sesión)
  // ------------------------------------------------------------
  if (user) {
    const nivel = user.nivel_acceso;
    const tienePermisoReportes = user.permiso_reportes;

    const botones = [
      {
        label: 'ACCESO EMPLEADO',
        descripcion: 'Registro de entrada/salida',
        icono: IconEmployee,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        hoverBg: 'hover:bg-emerald-100',
        ruta: '/empleado',
        visible: nivel >= 1,
      },
      {
        label: 'PANEL SUPERVISOR',
        descripcion: 'Gestión de personal y turnos',
        icono: IconSupervisor,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        hoverBg: 'hover:bg-amber-100',
        ruta: '/supervisor',
        visible: nivel >= 3,
      },
      {
        label: 'REPORTES Y ANÁLISIS',
        descripcion: 'Timesheets, accesos, ausencias',
        icono: IconReports,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200',
        hoverBg: 'hover:bg-purple-100',
        ruta: '/reportes',
        visible: nivel >= 3 && tienePermisoReportes,
      },
      {
        label: 'GESTIÓN ADMINISTRATIVA',
        descripcion: 'Empleados, flota, sucursales',
        icono: IconAdmin,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        hoverBg: 'hover:bg-blue-100',
        ruta: '/admin',
        visible: nivel >= 4,
      },
      {
        label: 'CONFIGURACIÓN MAESTRA',
        descripcion: 'Sistema, parámetros, auditoría',
        icono: IconMaster,
        color: 'text-rose-600',
        bgColor: 'bg-rose-50',
        borderColor: 'border-rose-200',
        hoverBg: 'hover:bg-rose-100',
        ruta: '/configuracion',
        visible: nivel >= 8,
      },
    ].filter(b => b.visible);

    return (
      <main className="min-h-screen bg-gradient-to-br from-[#FFE4D6] via-[#FFF5F0] to-[#D4EDE4]">
        {/* Fondo con patrón suave */}
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.02]"></div>
        
        <div className="relative z-10 container mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
          {/* Contenedor principal blanco con glassmorphism */}
          <div className="w-full max-w-4xl bg-white/95 backdrop-blur-sm rounded-[48px] border border-white/30 shadow-2xl p-8">
            
            {/* MEMBRETE SUPERIOR - Título a la izquierda, usuario a la derecha */}
            <div className="flex justify-between items-center mb-8">
              {/* Título y logo a la izquierda */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FFD1C0] to-[#C5E0D8] flex items-center justify-center shadow-md">
                  <span className="text-xl font-black text-white">GA</span>
                </div>
                <div>
                  <h1 className="text-2xl font-black italic tracking-tighter text-slate-800">
                    <span>GESTOR DE </span>
                    <span className="text-[#FF9F8C]">ACCESO</span>
                  </h1>
                  <p className="text-xs text-slate-500">Sistema de gestión integral v2.0</p>
                </div>
              </div>
              
              {/* Usuario a la derecha */}
              <div className="text-right">
                <p className="text-lg font-black text-slate-800">{user.nombre}</p>
                <p className="text-sm text-[#FF9F8C] font-medium">
                  {formatearRol(user.rol)} • Nivel {user.nivel_acceso}
                </p>
              </div>
            </div>

            {/* Título MENÚ PRINCIPAL */}
            <div className="mb-6">
              <h2 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400">
                MENÚ PRINCIPAL
              </h2>
              <div className="w-16 h-0.5 bg-gradient-to-r from-[#FF9F8C] to-transparent mt-2"></div>
            </div>

            {/* Grid de módulos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
              {botones.map((btn) => {
                const IconComponent = btn.icono;
                return (
                  <button
                    key={btn.ruta}
                    onClick={() => router.push(btn.ruta)}
                    className={`group ${btn.bgColor} p-6 rounded-3xl border ${btn.borderColor} hover:shadow-xl hover:shadow-${btn.color}/10 transition-all active:scale-[0.98] text-left flex items-start gap-4`}
                  >
                    <div className={`w-14 h-14 rounded-xl ${btn.bgColor} border ${btn.borderColor} flex items-center justify-center ${btn.color} flex-shrink-0`}>
                      <IconComponent className="w-7 h-7" />
                    </div>
                    <div className="flex-1">
                      <h3 className={`text-lg font-black text-slate-800 group-hover:${btn.color} transition-colors`}>
                        {btn.label}
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">
                        {btn.descripcion}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Botón cerrar sesión */}
            <div className="flex justify-center">
              <button
                onClick={handleLogout}
                className="group flex items-center gap-3 px-8 py-4 bg-white rounded-2xl border border-slate-200 hover:border-[#FF9F8C] hover:shadow-lg hover:shadow-[#FFD1C0] transition-all active:scale-[0.98]"
              >
                <IconLogout className="w-5 h-5 text-[#FF9F8C] group-hover:text-[#FF7F6E] transition-colors" />
                <span className="text-sm font-black uppercase tracking-wider text-slate-600 group-hover:text-[#FF7F6E]">
                  CERRAR SESIÓN
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-4 left-0 right-0 text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wider">
            SISTEMA DE GESTIÓN DE ACCESO • VERSIÓN 2.0
          </p>
        </div>
      </main>
    );
  }

  // ------------------------------------------------------------
  // PANTALLA DE CARGA
  // ------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFE4D6] via-[#FFF5F0] to-[#D4EDE4] flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#FF9F8C]"></div>
      </div>
    );
  }

  // ------------------------------------------------------------
  // PANTALLA DE LOGIN (ÚNICA)
  // ------------------------------------------------------------
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#FFE4D6] via-[#FFF5F0] to-[#D4EDE4] flex flex-col items-center justify-center p-4">
      <Notificacion mensaje={notificacion.mensaje} tipo={notificacion.tipo} visible={!!notificacion.tipo} />
      
      <div className="w-full max-w-md">
        {/* Contenedor principal blanco */}
        <div className="bg-white/95 backdrop-blur-sm rounded-[48px] border border-white/30 shadow-2xl p-8">
          
          {/* Logo GA */}
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#FFD1C0] to-[#C5E0D8] flex items-center justify-center shadow-lg">
              <span className="text-3xl font-black text-white">GA</span>
            </div>
          </div>

          {/* Título GESTOR DE ACCESO */}
          <div className="text-center mb-2">
            <h1 className="text-3xl font-black italic tracking-tighter text-slate-800">
              <span>GESTOR DE </span>
              <span className="text-[#FF9F8C]">ACCESO</span>
            </h1>
            <p className="text-slate-500 text-sm mt-1">Sistema de gestión integral v2.0</p>
          </div>

          {/* Subtítulo IDENTIFICACIÓN */}
          <div className="mb-6 mt-6">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 text-center">
              IDENTIFICACIÓN
            </h2>
            <div className="w-16 h-0.5 bg-gradient-to-r from-[#FF9F8C] to-transparent mx-auto mt-2"></div>
          </div>

          {/* Formulario */}
          <div className="space-y-4">
            <input
              ref={idRef}
              type="text"
              placeholder="DOCUMENTO / CORREO"
              className="w-full bg-white/50 border border-slate-200 p-4 rounded-2xl text-center text-sm font-bold text-slate-800 outline-none focus:border-[#FF9F8C] uppercase placeholder:text-slate-400"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && pinRef.current?.focus()}
              autoFocus
            />
            
            <input
              ref={pinRef}
              type="password"
              placeholder="PIN DE SEGURIDAD"
              className="w-full bg-white/50 border border-slate-200 p-4 rounded-2xl text-center text-sm font-black text-slate-800 tracking-[0.4em] outline-none focus:border-[#FF9F8C] uppercase placeholder:text-slate-400"
              value={pin}
              onChange={(e) => setPin(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            
            <button
              onClick={handleLogin}
              disabled={authLoading}
              className="w-full bg-gradient-to-br from-[#FFB5A0] to-[#FF9F8C] hover:from-[#FF9F8C] hover:to-[#FF7F6E] p-4 rounded-2xl text-white font-black uppercase text-sm active:scale-[0.98] transition-all shadow-lg disabled:opacity-50"
            >
              {authLoading ? 'VERIFICANDO...' : 'ENTRAR'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-[9px] text-slate-400 uppercase tracking-widest">
            @Copyright 2026 • Sistema de Gestión de Acceso v2.0
          </p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </main>
  );
}