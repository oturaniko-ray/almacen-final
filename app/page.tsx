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

  const router = useRouter();

  // Cargar configuración inicial
  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase.from('sistema_config').select('*');
      if (data) {
        const confObj = data.reduce((acc: any, curr: any) => ({ ...acc, [curr.clave]: curr.valor }), {});
        setConfig(confObj);
      }
    };
    fetchConfig();
  }, []);

  // Persistencia de sesión
  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) {
      setTempUser(JSON.parse(sessionData));
      setPaso('selector');
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identificador || !pin) return;
    
    setLoading(true);
    setMensaje({ texto: '', tipo: null });

    try {
      const { data, error } = await supabase
        .from('empleados')
        .select('*')
        .or(`documento_id.eq.${identificador},usuario.eq.${identificador}`)
        .eq('pin', pin)
        .eq('activo', true)
        .single();

      if (error || !data) {
        setMensaje({ texto: 'Credenciales inválidas', tipo: 'error' });
      } else {
        setTempUser(data);
        localStorage.setItem('user_session', JSON.stringify(data));
        setPaso('selector');
      }
    } catch (err) {
      setMensaje({ texto: 'Error de conexión', tipo: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('user_session');
    setTempUser(null);
    setPaso('login');
    setIdentificador('');
    setPin('');
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      
      {/* Fondo Decorativo */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {paso === 'login' ? (
          <form onSubmit={handleLogin} className="bg-[#111] p-8 rounded-[35px] border border-white/5 shadow-2xl space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-white font-black uppercase italic tracking-widest text-xl leading-none">Acceso Sistema</h2>
              <p className="text-blue-500 text-[9px] font-bold mt-2 uppercase tracking-[0.3em]">Autenticación Biométrica</p>
            </div>
            
            {mensaje.texto && (
              <div className="p-3 rounded-lg text-center text-[10px] font-bold uppercase bg-red-500/10 text-red-500 border border-red-500/20">
                {mensaje.texto}
              </div>
            )}

            <input 
              type="text" placeholder="USUARIO / ID" 
              className="w-full bg-black border border-white/10 p-4 rounded-xl text-white font-bold focus:border-blue-500 outline-none transition-all"
              value={identificador} onChange={(e) => setIdentificador(e.target.value)}
              disabled={loading}
            />
            <input 
              type="password" placeholder="PIN SEGURIDAD" 
              className="w-full bg-black border border-white/10 p-4 rounded-xl text-white font-bold focus:border-blue-500 outline-none transition-all"
              value={pin} onChange={(e) => setPin(e.target.value)}
              disabled={loading}
            />
            <button 
              disabled={loading}
              className="w-full bg-blue-600 p-4 rounded-xl text-white font-black uppercase italic hover:bg-blue-700 transition-all active:scale-95"
            >
              {loading ? 'Verificando...' : 'Entrar al Sistema'}
            </button>
          </form>
        ) : (
          <div className="bg-[#111] p-8 rounded-[35px] border border-white/5 shadow-2xl space-y-3">
            <div className="text-center mb-6">
              <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">Panel de Control</p>
              <p className="text-white text-lg font-black uppercase italic leading-none truncate">{tempUser?.nombre}</p>
            </div>

            <div className="space-y-2">
              {[
                { label: '🏃 acceso empleado', ruta: '/empleado', minNivel: 1, color: 'bg-emerald-600' },
                { label: '🛡️ panel supervisor', ruta: '/supervisor', minNivel: 3, color: 'bg-blue-600' },
                { label: '📊 reportes y análisis', ruta: '/reportes', minNivel: 3, color: 'bg-slate-700' },
                { label: '👥 gestión personal', ruta: '/admin', minNivel: 5, color: 'bg-amber-600' },
                { label: '⚙️ configuración maestra', ruta: '/configuracion', minNivel: 8, color: 'bg-rose-900' }, // OPCIÓN RESTAURADA
              ].map((btn) => {
                const nivel = Number(tempUser?.nivel_acceso);
                if (nivel < btn.minNivel) return null;
                
                return (
                  <button 
                    key={btn.ruta} 
                    onClick={() => router.push(btn.ruta)}
                    className={`w-full ${btn.color} p-4 rounded-xl text-white font-bold uppercase italic text-[11px] flex items-center justify-between shadow-lg active:scale-95 transition-all hover:brightness-110`}
                  >
                    {btn.label}
                    <span className="opacity-30">→</span>
                  </button>
                );
              })}
            </div>

            <button onClick={logout} className="w-full text-white/30 hover:text-red-500 font-bold uppercase text-[9px] tracking-widest pt-4 border-t border-white/5 transition-all">
              ✕ Cerrar Sesión
            </button>
          </div>
        )}
      </div>
    </main>
  );
}