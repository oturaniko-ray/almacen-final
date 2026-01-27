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
  const [sesionExpulsada, setSesionExpulsada] = useState(false);
  const [config, setConfig] = useState<any>({ empresa_nombre: 'SISTEMA RAY', timer_inactividad: '120000' });
  
  const sessionId = useRef(Math.random().toString(36).substring(7));
  const router = useRouter();

  // 1. CARGA DE CONFIGURACIÓN Y SESIÓN
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
      const currentUser = JSON.parse(sessionData);
      setTempUser(currentUser);
      setPaso('selector');
    }
  }, []);

  // 2. CONTROL DE SESIONES DUPLICADAS E INACTIVIDAD
  useEffect(() => {
    if (!tempUser) return;

    let timeout: NodeJS.Timeout;
    const resetTimer = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        localStorage.removeItem('user_session');
        window.location.reload(); 
      }, parseInt(config.timer_inactividad));
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    resetTimer();

    const canalSession = supabase.channel('global-session-control');
    canalSession
      .on('broadcast', { event: 'nueva-sesion' }, (payload) => {
        if (payload.payload.userEmail === tempUser.email && payload.payload.sid !== sessionId.current) {
          setSesionExpulsada(true);
          setTimeout(() => {
            localStorage.removeItem('user_session');
            window.location.reload();
          }, 3000);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await canalSession.send({
            type: 'broadcast',
            event: 'nueva-sesion',
            payload: { sid: sessionId.current, userEmail: tempUser.email }
          });
        }
      });

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      supabase.removeChannel(canalSession);
    };
  }, [tempUser, config.timer_inactividad]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Búsqueda sin forzar mayúsculas en el identificador
      const { data, error } = await supabase
        .from('empleados')
        .select('*')
        .or(`documento_id.eq.${identificador},email.eq.${identificador.toLowerCase()}`)
        .eq('pin_seguridad', pin)
        .eq('activo', true)
        .maybeSingle();

      if (error || !data) throw new Error("Credenciales inválidas o usuario inactivo");

      localStorage.setItem('user_session', JSON.stringify(data));
      setTempUser(data);
      setPaso('selector');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const irARuta = (ruta: string) => {
    router.push(ruta);
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden">
      {/* BACKGROUND DECORATION */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full"></div>

      {sesionExpulsada && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-[#0f172a] p-10 rounded-[40px] border border-red-500/30 text-center max-w-sm animate-in zoom-in duration-300">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-black uppercase italic text-red-500 mb-2">Sesión Duplicada</h2>
            <p className="text-slate-400 text-xs font-bold leading-relaxed uppercase">Se ha detectado un nuevo inicio de sesión con esta cuenta.</p>
          </div>
        </div>
      )}

      <div className="w-full max-w-md bg-[#0f172a] p-10 rounded-[45px] border border-white/5 shadow-2xl relative z-10">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none">
            {config.empresa_nombre.split(' ')[0]} <span className="text-blue-500">{config.empresa_nombre.split(' ').slice(1).join(' ')}</span>
          </h1>
          {/* Nombre y Rol debajo del título cuando hay sesión activa */}
          {tempUser && paso === 'selector' ? (
            <div className="mt-4 animate-in fade-in duration-700">
              <p className="text-xs font-black uppercase text-white tracking-widest">{tempUser.nombre}</p>
              <p className="text-[9px] font-bold text-blue-400 uppercase tracking-[0.3em] mt-1 italic">{tempUser.rol}</p>
            </div>
          ) : (
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mt-3 italic">Gestión de Almacén</p>
          )}
        </header>

        {paso === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="ID DE EMPLEADO O EMAIL" 
                className="w-full bg-[#050a14] border border-white/5 p-5 rounded-[22px] text-xs font-bold tracking-widest focus:border-blue-500 outline-none transition-all placeholder:text-slate-700"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                required
              />
              <input 
                type="password" 
                placeholder="PIN DE SEGURIDAD" 
                className="w-full bg-[#050a14] border border-white/5 p-5 rounded-[22px] text-xs font-black tracking-[0.5em] focus:border-blue-500 outline-none transition-all placeholder:text-slate-700"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
              />
            </div>
            <button 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 p-5 rounded-[25px] font-black uppercase italic text-sm transition-all shadow-xl shadow-blue-900/20 disabled:opacity-50"
            >
              {loading ? 'Validando...' : 'Entrar al Sistema'}
            </button>
          </form>
        ) : (
          <div className="space-y-3 animate-in fade-in zoom-in duration-500">
            <button onClick={() => irARuta('/empleado')} className="w-full bg-[#1e293b] hover:bg-blue-600 p-5 rounded-[22px] font-bold text-md transition-all border border-white/5 text-left pl-8">
              🏃 Acceso Empleado
            </button>
            
            {(tempUser?.rol === 'supervisor' || tempUser?.rol === 'admin' || tempUser?.rol === 'tecnico') && (
              <button onClick={() => irARuta('/supervisor')} className="w-full bg-[#1e293b] hover:bg-blue-600 p-5 rounded-[22px] font-bold text-md transition-all border border-white/5 text-left pl-8">
                🛡️ Panel Supervisor
              </button>
            )}

            {(tempUser?.rol === 'admin' || tempUser?.rol === 'tecnico' || tempUser?.permiso_reportes === true) && (
              <button onClick={() => irARuta('/reportes')} className="w-full bg-[#1e293b] hover:bg-amber-600 p-5 rounded-[22px] font-bold text-md transition-all border border-white/5 text-left pl-8">
                📊 Análisis y Reportes
              </button>
            )}

            {(tempUser?.rol === 'admin' || tempUser?.rol === 'tecnico') && (
              <button onClick={() => irARuta('/admin')} className="w-full bg-[#1e293b] hover:bg-blue-600 p-5 rounded-[22px] font-bold text-md transition-all border border-white/5 text-left pl-8">
                ⚙️ Gestión Administrativa
              </button>
            )}

            {tempUser?.rol === 'tecnico' && (
              <button onClick={() => irARuta('/admin/configuracion')} className="w-full bg-slate-100 text-slate-900 hover:bg-white p-5 rounded-[22px] font-black text-md transition-all text-left pl-8">
                🛠️ Configuración Maestra
              </button>
            )}
            
            <button 
              onClick={() => { localStorage.removeItem('user_session'); setPaso('login'); setTempUser(null); }} 
              className="w-full text-slate-600 font-bold uppercase text-[9px] tracking-[0.3em] mt-4 hover:text-white transition-all text-center"
            >
              ✕ Cerrar Sesión
            </button>
          </div>
        )}
      </div>
    </main>
  );
}