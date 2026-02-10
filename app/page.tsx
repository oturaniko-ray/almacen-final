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
    
    // Solo se ejecuta si existe el valor en la configuración cargada de la DB
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
      
      // NUEVA LÓGICA DE REDIRECCIÓN
      if (nivel <= 2) {
        // Nivel 1-2: Solo empleado
        router.push('/empleado');
      } else {
        // Nivel 3 o más: Va al selector
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

      // NUEVA LÓGICA DE NAVEGACIÓN SEGÚN NIVEL
      if (nivel <= 2) {
        // Nivel 1-2: Va directo a empleado
        router.push('/empleado');
      } else {
        // Nivel 3 o más: Va al selector
        setTempUser(userData);
        setPaso('selector');
      }
    } catch (err: any) {
      showNotification("Acceso denegado", 'error');
      setIdentificador(''); setPin('');
      idRef.current?.focus();
    } finally { setLoading(false); }
  };

  // NUEVA FUNCIÓN PARA DETERMINAR QUÉ BOTONES MOSTRAR
  const obtenerBotonesDisponibles = () => {
    const nivel = Number(tempUser?.nivel_acceso || 0);
    const tienePermisoReportes = tempUser?.permiso_reportes === true;
    
    const todosLosBotones = [
      { label: '🫆 acceso empleado', ruta: '/empleado', minNivel: 1, color: 'bg-emerald-600' },
      { label: '🕖 panel supervisor', ruta: '/supervisor', minNivel: 3, color: 'bg-blue-600' },
      { label: '📊 reportes y análisis', ruta: '/reportes', minNivel: 3, color: 'bg-slate-700', requiereReportes: true },
      { label: '👥 gestión personal', ruta: '/admin', minNivel: 4, color: 'bg-amber-600' },
      { label: '👨‍🔧 configuración maestra', ruta: '/configuracion', minNivel: 8, color: 'bg-rose-900' },
    ];
    
    // Filtrar según nivel y permisos
    return todosLosBotones.filter((btn) => {
      // 1. Verificar nivel mínimo
      if (nivel < btn.minNivel) return false;
      
      // 2. Verificar permiso especial para reportes
      if (btn.requiereReportes && !tienePermisoReportes) return false;
      
      // 3. Lógica específica por nivel
      if (nivel === 3) {
        // Nivel 3: Solo empleado y supervisor
        return btn.ruta === '/empleado' || btn.ruta === '/supervisor';
      }
      
      if (nivel === 4) {
        // Nivel 4: Con permiso_reportes ve reportes, sin él no
        if (btn.ruta === '/reportes') {
          return tienePermisoReportes;
        }
        // Nivel 4 siempre ve empleado, supervisor, admin
        return btn.ruta === '/empleado' || btn.ruta === '/supervisor' || btn.ruta === '/admin';
      }
      
      if (nivel === 5) {
        // Nivel 5: Ve todo menos configuración
        return btn.ruta !== '/configuracion';
      }
      
      // Nivel 8: Ve todo
      // Nivel 6-7: Mismo que nivel 5
      if (nivel >= 6 && nivel <= 7) {
        return btn.ruta !== '/configuracion';
      }
      
      return true;
    });
  };

  const renderBicolorTitle = (text: string) => {
    const words = (text || 'SISTEMA').split(' ');
    const lastWord = words.pop();
    const firstPart = words.join(' ');
    return (
      <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-2">
        <span className="text-white">{firstPart} </span>
        <span className="text-blue-700">{lastWord}</span>
      </h1>
    );
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      
      {mensaje.tipo && (
        <div className={`fixed top-6 z-50 px-6 py-3 rounded-xl font-bold text-sm shadow-2xl animate-flash-fast ${
          mensaje.tipo === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white'
        }`}>
          {mensaje.texto}
        </div>
      )}

      {/* MEMBRETE */}
      <div className="w-full max-w-sm bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 mb-4 text-center">
        {renderBicolorTitle(config.empresa_nombre)}
        
        <p className={`text-white font-bold text-[17px] uppercase tracking-widest mb-3 ${paso === 'login' ? 'animate-pulse-slow' : ''}`}>
          {paso === 'login' ? 'Identificación' : 'Menú Principal'}
        </p>

        {tempUser && paso === 'selector' && (
          <div className="mt-2 pt-2 border-t border-white/10 flex flex-col items-center">
            <span className="text-sm font-normal text-white uppercase">{tempUser.nombre}</span>
            <span className="text-[10px] text-white/40 uppercase font-black tracking-widest">
              NIVEL: {tempUser.nivel_acceso} | 
              REPORTES: {tempUser.permiso_reportes ? 'SÍ' : 'NO'}
            </span>
          </div>
        )}
      </div>
      
      <div className="w-full max-w-sm bg-[#111111] p-8 rounded-[35px] border border-white/5 shadow-2xl">
        {paso === 'login' ? (
          <div className="space-y-4">
            <input 
              ref={idRef}
              type="text" 
              placeholder="ID / CORREO" 
              className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-center text-sm font-bold text-white outline-none focus:border-blue-500/50" 
              value={identificador} 
              onChange={(e) => setIdentificador(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && pinRef.current?.focus()}
              autoFocus
            />
            <input 
              ref={pinRef}
              type="password" 
              placeholder="PIN" 
              className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-center text-sm font-black text-white tracking-[0.4em] outline-none focus:border-blue-500/50" 
              value={pin} 
              onChange={(e) => setPin(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            <button 
              onClick={handleLogin} 
              className="w-full bg-blue-600 p-4 rounded-xl text-white font-black uppercase italic text-sm active:scale-95 transition-all shadow-lg"
            >
              {loading ? '...' : 'Entrar'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-center mb-6">
              <p className="text-[13px] font-bold uppercase tracking-[0.4em] text-white/20 animate-pulse-very-slow">
                OPCIONES DISPONIBLES
              </p>
            </div>

            {obtenerBotonesDisponibles().map((btn) => {
              return (
                <button 
                  key={btn.ruta}
                  onClick={() => router.push(btn.ruta)} 
                  className={`w-full ${btn.color} p-4 rounded-xl text-white font-bold transition-all active:scale-95 shadow-lg flex items-center`}
                >
                  <span className="text-left italic uppercase text-[11px] flex items-center">
                    <span className="text-[1.4em] mr-3">{btn.label.split(' ')[0]}</span>
                    {btn.label.split(' ').slice(1).join(' ')}
                  </span>
                </button>
              );
            })}
            
            <button onClick={logout} className="w-full text-emerald-500 font-bold uppercase text-[11px] tracking-[0.2em] mt-6 italic text-center py-2 border-t border-white/5">
              ✕ Cerrar Sesión
            </button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
        @keyframes pulse-very-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
        .animate-pulse-very-slow { animation: pulse-very-slow 6s ease-in-out infinite; }
        @keyframes flash-fast { 0%, 100% { opacity: 1; } 10%, 30%, 50% { opacity: 0; } 20%, 40%, 60% { opacity: 1; } }
        .animate-flash-fast { animation: flash-fast 2s ease-in-out; }
      `}</style>
    </main>
  );
}