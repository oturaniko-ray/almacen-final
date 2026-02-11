'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function LoginPage() {
  const [identificador, setIdentificador] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [paso, setPaso] = useState<'login' | 'selector'>('login');
  const [tempUser, setTempUser] = useState<any>(null);
  const [config, setConfig] = useState<any>({ empresa_nombre: '', timer_inactividad: null });
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'success' | 'error' | null }>({ texto: '', tipo: null });

  const idRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- LÓGICA DE INACTIVIDAD SIN FALLBACK ---
  const reiniciarTemporizador = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    
    if (config.timer_inactividad) {
      const tiempoLimite = parseInt(config.timer_inactividad);
      
      if (!isNaN(tiempoLimite)) {
        timerRef.current = setTimeout(() => {
          if (paso === 'selector') {
            logout();
            showNotification("Sesión cerrada por inactividad", 'error');
          }
        }, tiempoLimite);
      }
    }
  };

  useEffect(() => {
    if (paso === 'selector' && config.timer_inactividad) {
      const eventos = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
      
      eventos.forEach(evento => document.addEventListener(evento, reiniciarTemporizador));
      reiniciarTemporizador();

      return () => {
        eventos.forEach(evento => document.removeEventListener(evento, reiniciarTemporizador));
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
  }, [paso, config.timer_inactividad]);

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase.from('sistema_config').select('clave, valor');
      if (data) {
        const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
        setConfig((prev: any) => ({ ...prev, ...cfgMap }));
      }
    };
    fetchConfig();
    
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) {
      const user = JSON.parse(sessionData);
      const nivel = Number(user.nivel_acceso);
      
      if (nivel <= 2) {
        router.push('/empleado');
      } else {
        setTempUser(user);
        setPaso('selector');
      }
    }
  }, [router]);

  const logout = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    localStorage.clear();
    setTempUser(null);
    setIdentificador('');
    setPin('');
    setPaso('login');
  };

  const showNotification = (texto: string, tipo: 'success' | 'error') => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje({ texto: '', tipo: null }), 3000);
  };

  const handleLogin = async () => {
    if (!identificador || !pin) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('empleados')
        .select('*')
        .or(`documento_id.eq."${identificador}",email.eq."${identificador.toLowerCase()}"`)
        .eq('pin_seguridad', pin).eq('activo', true).maybeSingle();

      if (error || !data) throw new Error("Credenciales inválidas");
      
      const userData = { 
        ...data, 
        nivel_acceso: Number(data.nivel_acceso),
        permiso_reportes: !!data.permiso_reportes 
      };
      
      localStorage.setItem('user_session', JSON.stringify(userData));
      const nivel = userData.nivel_acceso;

      if (nivel <= 2) {
        router.push('/empleado');
      } else {
        setTempUser(userData);
        setPaso('selector');
      }
    } catch (err: any) {
      showNotification("Acceso denegado", 'error');
      setIdentificador(''); setPin('');
      idRef.current?.focus();
    } finally { setLoading(false); }
  };

  // Función para obtener el rol basado en el nivel de acceso
  const obtenerRol = (nivel: number) => {
    if (nivel <= 2) return 'Empleado';
    if (nivel === 3) return 'Supervisor';
    if (nivel === 4) return 'Administrador';
    if (nivel === 5) return 'Gerente';
    if (nivel === 6 || nivel === 7) return 'Director';
    if (nivel === 8) return 'Configuración Maestra';
    return 'Usuario';
  };

  const obtenerBotonesDisponibles = () => {
    const nivel = Number(tempUser?.nivel_acceso || 0);
    const tienePermisoReportes = tempUser?.permiso_reportes === true;
    
    const todosLosBotones = [
      { 
        label: 'ACCESO EMPLEADO', 
        icono: '🫆​', 
        ruta: '/empleado', 
        minNivel: 1, 
        color: 'bg-gradient-to-r from-emerald-600 to-emerald-800',
        hoverColor: 'hover:from-emerald-500 hover:to-emerald-700',
        textColor: 'text-white'
      },
      { 
        label: 'PANEL SUPERVISOR', 
        icono: '🛃​​', 
        ruta: '/supervisor', 
        minNivel: 3, 
        color: 'bg-gradient-to-r from-blue-600 to-blue-800',
        hoverColor: 'hover:from-blue-500 hover:to-blue-700',
        textColor: 'text-white'
      },
      { 
        label: 'REPORTES Y ANÁLISIS', 
        icono: '📊', 
        ruta: '/reportes', 
        minNivel: 3, 
        color: 'bg-gradient-to-r from-slate-700 to-slate-900',
        hoverColor: 'hover:from-slate-600 hover:to-slate-800',
        textColor: 'text-white',
        requiereReportes: true 
      },
      { 
        label: 'GESTIÓN ADMINISTRATIVA', 
        icono: '👥', 
        ruta: '/admin', 
        minNivel: 4, 
        color: 'bg-gradient-to-r from-amber-600 to-amber-800',
        hoverColor: 'hover:from-amber-500 hover:to-amber-700',
        textColor: 'text-white'
      },
      { 
        label: 'CONFIGURACIÓN MAESTRA', 
        icono: '🛠️', 
        ruta: '/configuracion', 
        minNivel: 8, 
        color: 'bg-gradient-to-r from-purple-700 to-purple-900',
        hoverColor: 'hover:from-purple-600 hover:to-purple-800',
        textColor: 'text-white'
      },
    ];
    
    return todosLosBotones.filter((btn) => {
      if (nivel < btn.minNivel) return false;
      
      if (btn.requiereReportes && !tienePermisoReportes) return false;
      
      if (nivel === 3) {
        return btn.ruta === '/empleado' || btn.ruta === '/supervisor';
      }
      
      if (nivel === 4) {
        if (btn.ruta === '/reportes') {
          return tienePermisoReportes;
        }
        return btn.ruta === '/empleado' || btn.ruta === '/supervisor' || btn.ruta === '/admin';
      }
      
      if (nivel === 5) {
        return btn.ruta !== '/configuracion';
      }
      
      if (nivel >= 6 && nivel <= 7) {
        return btn.ruta !== '/configuracion';
      }
      
      return true;
    });
  };

  // Función para dividir el título en dos colores
  const renderBicolorTitle = (text: string) => {
    const words = (text || 'SISTEMA DE CONTROL').split(' ');
    const lastWord = words.pop();
    const firstPart = words.join(' ');
    return (
      <h1 className="text-xl font-black italic uppercase tracking-tight leading-none">
        <span className="text-white">{firstPart} </span>
        <span className="text-blue-600">{lastWord}</span>
      </h1>
    );
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      
      {/* Notificación mejorada */}
      {mensaje.tipo && (
        <div className={`fixed top-6 z-50 px-6 py-3 rounded-lg font-bold text-sm shadow-2xl border backdrop-blur-sm transition-all duration-300 ${
          mensaje.tipo === 'success' 
            ? 'bg-green-500/10 border-green-500/30 text-green-300' 
            : 'bg-red-500/10 border-red-500/30 text-red-300'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{mensaje.tipo === 'success' ? '✓' : '✗'}</span>
            <span className="font-semibold">{mensaje.texto}</span>
          </div>
        </div>
      )}

      {/* Encabezado sobrio - TODO EN UNA LÍNEA */}
      <div className="w-full max-w-md bg-gray-900/80 p-6 rounded-xl border border-gray-800/50 mb-4 text-center backdrop-blur-sm">
        {renderBicolorTitle(config.empresa_nombre)}
        
        <p className={`text-white font-bold text-[15px] uppercase tracking-wider mt-2 ${paso === 'login' ? 'animate-pulse' : ''}`}>
          {paso === 'login' ? 'IDENTIFICACIÓN' : 'MENÚ PRINCIPAL'}
        </p>

        {tempUser && paso === 'selector' && (
          <div className="mt-3 pt-3 border-t border-gray-800/50">
            <p className="text-xs font-medium text-gray-300">
              <span className="text-white font-bold text-sm">{tempUser.nombre}</span>
              <span className="text-gray-400 mx-2">•</span>
              <span className="text-cyan-300">{obtenerRol(tempUser.nivel_acceso)}</span>
              <span className="text-gray-400 ml-2">({tempUser.nivel_acceso})</span>
            </p>
          </div>
        )}
      </div>
      
      {/* Contenedor principal compacto */}
      <div className="w-full max-w-md bg-gray-900/80 p-6 rounded-xl border border-gray-800/50 shadow-lg backdrop-blur-sm">
        {paso === 'login' ? (
          <div className="space-y-4">
            <div className="relative">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <input 
                ref={idRef}
                type="text" 
                placeholder="ID / CORREO" 
                className="w-full bg-gray-800/50 border border-gray-700/50 pl-10 pr-4 py-3 rounded-lg text-sm font-medium text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all" 
                value={identificador} 
                onChange={(e) => setIdentificador(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && pinRef.current?.focus()}
                autoFocus
              />
            </div>
            
            <div className="relative">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input 
                ref={pinRef}
                type="password" 
                placeholder="PIN DE SEGURIDAD" 
                className="w-full bg-gray-800/50 border border-gray-700/50 pl-10 pr-4 py-3 rounded-lg text-sm font-bold text-white tracking-widest placeholder:tracking-normal placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all" 
                value={pin} 
                onChange={(e) => setPin(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            
            <button 
              onClick={handleLogin} 
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed p-3 rounded-lg text-white font-bold uppercase tracking-wider text-sm active:scale-[0.98] transition-all duration-200 shadow-md flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>VERIFICANDO...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  <span>ENTRAR AL SISTEMA</span>
                </>
              )}
            </button>
            
            <div className="text-center pt-4 border-t border-gray-800/50">
              <p className="text-xs text-gray-500 italic">
                @Copyright RayPérez 2026
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid gap-2">
              {obtenerBotonesDisponibles().map((btn) => {
                return (
                  <button 
                    key={btn.ruta}
                    onClick={() => router.push(btn.ruta)} 
                    className={`w-full ${btn.color} ${btn.hoverColor} border border-gray-700/30 p-3 rounded-lg ${btn.textColor} font-bold transition-all duration-200 active:scale-[0.98] shadow-md flex items-center justify-between group`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg bg-white/10 p-1.5 rounded group-hover:scale-110 transition-transform">
                        {btn.icono}
                      </span>
                      <span className="text-left font-semibold text-xs tracking-wide">
                        {btn.label}
                      </span>
                    </div>
                    <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                );
              })}
            </div>
            
            <div className="text-center pt-4 border-t border-gray-800/50">
              <p className="text-xs text-gray-500 italic mb-3">
                @Copyright RayPérez 2026
              </p>
            
              <button 
                onClick={logout}
                className="w-full text-gray-400 hover:text-white font-medium text-xs tracking-wide py-2 transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                CERRAR SESIÓN
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animate-pulse {
          animation: pulse 2s ease-in-out infinite;
        }
      `}</style>
    </main>
  );
}