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
  const [config, setConfig] = useState<any>({ empresa_nombre: '', timer_inactividad: '120000' });
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'success' | 'error' | null }>({ texto: '', tipo: null });

  const idRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // --- CONTROL DE INACTIVIDAD ---
  useEffect(() => {
    if (paso !== 'selector') return;
    const tiempoLimite = parseInt(config.timer_inactividad) || 120000;
    const reiniciarTemporizador = () => {
      clearTimeout(window.inactividadTimeout);
      window.inactividadTimeout = setTimeout(() => logout(), tiempoLimite);
    };
    const eventos = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    eventos.forEach(evento => document.addEventListener(evento, reiniciarTemporizador));
    reiniciarTemporizador();
    return () => {
      eventos.forEach(evento => document.removeEventListener(evento, reiniciarTemporizador));
      clearTimeout(window.inactividadTimeout);
    };
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
      if (Number(user.nivel_acceso) === 1) router.push('/empleado');
      else { setTempUser(user); setPaso('selector'); }
    }
  }, [router]);

  const logout = () => {
    localStorage.clear();
    setTempUser(null);
    setIdentificador('');
    setPin('');
    setPaso('login');
    showNotification("Sesión cerrada", 'success');
  };

  const showNotification = (texto: string, tipo: 'success' | 'error') => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje({ texto: '', tipo: null }), 2000);
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
      const userData = { ...data, nivel_acceso: Number(data.nivel_acceso) };
      localStorage.setItem('user_session', JSON.stringify(userData));

      if (userData.nivel_acceso === 1) router.push('/empleado');
      else { setTempUser(userData); setPaso('selector'); }
    } catch (err: any) {
      showNotification("Acceso denegado", 'error');
    } finally { setLoading(false); }
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
        <div className={`fixed top-6 z-50 px-6 py-3 rounded-xl font-bold animate-flash-fast text-sm ${
          mensaje.tipo === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
        }`}>
          {mensaje.texto}
        </div>
      )}

      <div className="w-full max-w-sm bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 mb-4 text-center">
        {renderBicolorTitle(config.empresa_nombre)}
        <p className="text-blue-700 font-bold text-[13px] uppercase tracking-widest mb-3">
          {paso === 'login' ? 'Identificación' : 'Menú Principal'}
        </p>
        {tempUser && paso === 'selector' && (
          <div className="mt-2 pt-2 border-t border-white/5 flex flex-col items-center">
            <span className="text-sm font-normal text-white uppercase">{tempUser.nombre}</span>
            <span className="text-[10px] text-white/40 uppercase tracking-tighter">{tempUser.rol} ({tempUser.nivel_acceso})</span>
          </div>
        )}
      </div>
      
      <div className="w-full max-w-sm bg-[#111111] p-8 rounded-[35px] border border-white/5 shadow-2xl">
        {paso === 'login' ? (
          <div className="space-y-4">
            <input type="text" placeholder="ID / CORREO" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-center text-sm font-bold text-white outline-none uppercase" value={identificador} onChange={(e) => setIdentificador(e.target.value)} />
            <input type="password" placeholder="PIN" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-center text-sm font-black text-white tracking-[0.4em] outline-none" value={pin} onChange={(e) => setPin(e.target.value)} />
            <button onClick={handleLogin} className="w-full bg-blue-600 p-4 rounded-xl text-white font-black uppercase italic text-sm active:scale-95 transition-all">
              {loading ? '...' : 'Entrar'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-center mb-6">
              <p className="text-[13px] font-bold uppercase tracking-[0.4em] text-white animate-pulse-very-slow">Opciones</p>
            </div>

            {[
              { label: '🕣 acceso empleado', ruta: '/empleado', minNivel: 1, color: 'bg-emerald-600' },
              { label: '👮 panel supervisor', ruta: '/supervisor', minNivel: 3, color: 'bg-blue-600' },
              { label: '📝 reportes y análisis', ruta: '/reportes', minNivel: 3, color: 'bg-slate-700', checkPermiso: true },
              { label: '⌨️ gestión personal', ruta: '/admin', minNivel: 4, color: 'bg-amber-600' },
              { label: '🛠️ config. maestra', ruta: '/configuracion', minNivel: 8, color: 'bg-rose-900' },
            ].map((btn) => {
              const tienePermiso = Number(tempUser.nivel_acceso) >= btn.minNivel;
              if (!tienePermiso) return null;

              return (
                <button 
                  key={btn.ruta}
                  onClick={() => router.push(btn.ruta)} 
                  className={`w-full ${btn.color} p-4 rounded-xl text-white font-bold transition-all active:scale-95 shadow-lg group`}
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
        @keyframes pulse-very-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
        .animate-pulse-very-slow { animation: pulse-very-slow 6s ease-in-out infinite; }
      `}</style>
    </main>
  );
}

declare global { interface Window { inactividadTimeout: any; } }