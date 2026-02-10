[file name]: page.tsx
[file content begin]
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

  const obtenerBotonesDisponibles = () => {
    const nivel = Number(tempUser?.nivel_acceso || 0);
    const tienePermisoReportes = tempUser?.permiso_reportes === true;
    
    const todosLosBotones = [
      { 
        label: 'ACCESO EMPLEADO', 
        icono: '🫆', 
        ruta: '/empleado', 
        minNivel: 1, 
        color: 'bg-gradient-to-r from-emerald-600/90 to-emerald-800/80 hover:from-emerald-500 hover:to-emerald-700',
        textColor: 'text-emerald-100'
      },
      { 
        label: 'PANEL SUPERVISOR', 
        icono: '🕖', 
        ruta: '/supervisor', 
        minNivel: 3, 
        color: 'bg-gradient-to-r from-blue-600/90 to-blue-800/80 hover:from-blue-500 hover:to-blue-700',
        textColor: 'text-blue-100'
      },
      { 
        label: 'REPORTES Y ANÁLISIS', 
        icono: '📊', 
        ruta: '/reportes', 
        minNivel: 3, 
        color: 'bg-gradient-to-r from-slate-700/90 to-slate-900/80 hover:from-slate-600 hover:to-slate-800',
        textColor: 'text-slate-100',
        requiereReportes: true 
      },
      { 
        label: 'GESTIÓN PERSONAL', 
        icono: '👥', 
        ruta: '/admin', 
        minNivel: 4, 
        color: 'bg-gradient-to-r from-amber-600/90 to-amber-800/80 hover:from-amber-500 hover:to-amber-700',
        textColor: 'text-amber-100'
      },
      { 
        label: 'CONFIGURACIÓN MAESTRA', 
        icono: '👨‍🔧', 
        ruta: '/configuracion', 
        minNivel: 8, 
        color: 'bg-gradient-to-r from-rose-900/90 to-rose-950/80 hover:from-rose-800 hover:to-rose-900',
        textColor: 'text-rose-100'
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

  const renderBicolorTitle = (text: string) => {
    const words = (text || 'SISTEMA DE CONTROL').split(' ');
    const lastWord = words.pop();
    const firstPart = words.join(' ');
    return (
      <div className="text-center mb-2">
        <h1 className="text-2xl md:text-3xl font-black italic uppercase tracking-tight leading-tight">
          <span className="text-white/90">{firstPart} </span>
          <span className="text-cyan-400">{lastWord}</span>
        </h1>
        <div className="h-0.5 w-24 mx-auto bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent mt-2"></div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Fondo decorativo */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/5 via-transparent to-transparent pointer-events-none"></div>
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-cyan-500/3 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/2 rounded-full blur-3xl pointer-events-none"></div>
      
      {mensaje.tipo && (
        <div className={`fixed top-6 z-50 px-6 py-3 rounded-lg font-bold text-sm shadow-2xl animate-flash-fast border backdrop-blur-sm ${
          mensaje.tipo === 'success' 
            ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-600/20 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{mensaje.tipo === 'success' ? '✓' : '✗'}</span>
            {mensaje.texto}
          </div>
        </div>
      )}

      {/* MEMBRETE MEJORADO */}
      <div className="w-full max-w-md bg-gradient-to-b from-gray-900/80 to-gray-950/80 p-8 rounded-2xl border border-gray-800/50 mb-6 text-center backdrop-blur-sm shadow-2xl z-10">
        {renderBicolorTitle(config.empresa_nombre)}
        
        <p className={`text-white font-bold text-lg uppercase tracking-[0.3em] mb-4 ${paso === 'login' ? 'animate-pulse-slow' : ''}`}>
          {paso === 'login' ? 'IDENTIFICACIÓN' : 'MENÚ PRINCIPAL'}
        </p>

        {tempUser && paso === 'selector' && (
          <div className="mt-4 pt-4 border-t border-gray-800 flex flex-col items-center">
            <span className="text-sm font-medium text-cyan-300 uppercase tracking-wide">{tempUser.nombre}</span>
            <div className="flex gap-4 mt-1">
              <span className="text-xs text-gray-400 uppercase font-bold tracking-wider bg-gray-900/50 px-3 py-1 rounded-full">
                NIVEL: {tempUser.nivel_acceso}
              </span>
              <span className={`text-xs uppercase font-bold tracking-wider px-3 py-1 rounded-full ${
                tempUser.permiso_reportes 
                  ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/30' 
                  : 'bg-gray-900/50 text-gray-500'
              }`}>
                REPORTES: {tempUser.permiso_reportes ? 'SÍ' : 'NO'}
              </span>
            </div>
          </div>
        )}
      </div>
      
      {/* CONTENEDOR PRINCIPAL */}
      <div className="w-full max-w-md bg-gradient-to-b from-gray-900/70 to-black/70 p-8 rounded-2xl border border-gray-800/50 shadow-2xl backdrop-blur-sm z-10">
        {paso === 'login' ? (
          <div className="space-y-6">
            <div className="relative">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">👤</div>
              <input 
                ref={idRef}
                type="text" 
                placeholder="ID / CORREO ELECTRÓNICO" 
                className="w-full bg-gray-900/50 border border-gray-700/50 pl-12 pr-4 py-4 rounded-xl text-center text-sm font-medium text-white placeholder:text-gray-500 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all" 
                value={identificador} 
                onChange={(e) => setIdentificador(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && pinRef.current?.focus()}
                autoFocus
              />
            </div>
            
            <div className="relative">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">🔒</div>
              <input 
                ref={pinRef}
                type="password" 
                placeholder="PIN DE SEGURIDAD" 
                className="w-full bg-gray-900/50 border border-gray-700/50 pl-12 pr-4 py-4 rounded-xl text-center text-sm font-black text-white tracking-[0.3em] placeholder:tracking-normal placeholder:text-gray-500 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all" 
                value={pin} 
                onChange={(e) => setPin(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            
            <button 
              onClick={handleLogin} 
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed p-4 rounded-xl text-white font-black uppercase italic text-sm active:scale-[0.98] transition-all shadow-lg shadow-cyan-500/20"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⟳</span> VERIFICANDO...
                </span>
              ) : 'ENTRAR AL SISTEMA'}
            </button>
            
            <div className="text-center pt-4 border-t border-gray-800/50">
              <p className="text-xs text-gray-500 italic">
                Sistema seguro • {new Date().getFullYear()}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center mb-8">
              <p className="text-sm font-bold uppercase tracking-[0.4em] text-gray-500 animate-pulse-very-slow">
                OPCIONES DISPONIBLES
              </p>
              <div className="h-px w-32 mx-auto bg-gradient-to-r from-transparent via-gray-700 to-transparent mt-2"></div>
            </div>

            <div className="grid gap-3">
              {obtenerBotonesDisponibles().map((btn) => {
                return (
                  <button 
                    key={btn.ruta}
                    onClick={() => router.push(btn.ruta)} 
                    className={`w-full ${btn.color} border border-white/5 p-4 rounded-xl ${btn.textColor} font-bold transition-all active:scale-[0.98] shadow-lg flex items-center justify-between group`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-xl opacity-80 group-hover:scale-110 transition-transform">{btn.icono}</span>
                      <span className="text-left italic uppercase text-[12px] tracking-wider">
                        {btn.label}
                      </span>
                    </span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                  </button>
                );
              })}
            </div>
            
            <button 
              onClick={logout}
              className="w-full text-cyan-400 hover:text-cyan-300 font-bold uppercase text-xs tracking-[0.3em] mt-8 pt-4 border-t border-gray-800/50 text-center py-2 transition-colors"
            >
              ✕ CERRAR SESIÓN
            </button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
        @keyframes pulse-very-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .animate-pulse-very-slow { animation: pulse-very-slow 8s ease-in-out infinite; }
        @keyframes flash-fast { 
          0%, 100% { transform: translateY(0); opacity: 1; } 
          10%, 30%, 50% { transform: translateY(-2px); opacity: 0.9; } 
          20%, 40%, 60% { transform: translateY(2px); opacity: 1; } 
        }
        .animate-flash-fast { animation: flash-fast 1.5s ease-in-out; }
      `}</style>
    </main>
  );
}
[file content end]