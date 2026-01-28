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
  const inputRef = useRef<HTMLInputElement>(null);
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
      setTempUser(JSON.parse(sessionData));
      setPaso('selector');
    }
  }, []);

  // 2. LÓGICA DE PERMISOS BASADA EN NIVELES (1, 3, 4, 8)
  const tieneAcceso = (nivelRequerido: number) => {
    const nivelActual = parseInt(tempUser?.nivel_acceso) || 0;
    return nivelActual >= nivelRequerido;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('empleados')
        .select('*')
        .or(`documento_id.eq.${identificador},email.eq.${identificador.toLowerCase()}`)
        .eq('pin_seguridad', pin)
        .eq('activo', true)
        .maybeSingle();

      if (error || !data) throw new Error("Acceso Denegado: Datos incorrectos");

      localStorage.setItem('user_session', JSON.stringify(data));
      setTempUser(data);
      setPaso('selector');
      
      // Limpiar buffer
      setIdentificador('');
      setPin('');
    } catch (err: any) {
      alert(err.message);
      // Limpiar y resetear foco
      setIdentificador('');
      setPin('');
      setTimeout(() => inputRef.current?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  const finalizarSesion = () => {
    localStorage.removeItem('user_session');
    setTempUser(null);
    setPaso('login');
    setIdentificador('');
    setPin('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const irARuta = (ruta: string) => {
    router.push(ruta);
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden">
      {/* DECORACIÓN VISUAL ORIGINAL */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full"></div>

      <div className="w-full max-w-md bg-[#0f172a] p-10 rounded-[45px] border border-white/5 shadow-2xl relative z-10">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none">
            {config.empresa_nombre.split(' ')[0]} <span className="text-blue-500">{config.empresa_nombre.split(' ').slice(1).join(' ')}</span>
          </h1>
          
          {tempUser && paso === 'selector' && (
            <div className="mt-4 animate-in fade-in duration-700">
              <p className="text-xs font-black uppercase text-white tracking-widest">{tempUser.nombre}</p>
              <p className="text-[9px] font-bold text-blue-400 uppercase tracking-[0.3em] mt-1 italic">
                {tempUser.rol} | NIVEL {tempUser.nivel_acceso}
              </p>
            </div>
          )}
        </header>

        {paso === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-4">
              <input 
                ref={inputRef}
                type="text" 
                placeholder="DOCUMENTO O CORREO" 
                className="w-full bg-[#050a14] border border-white/5 p-5 rounded-[22px] text-xs font-bold tracking-widest focus:border-blue-500 outline-none transition-all placeholder:text-slate-700 uppercase"
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
              className="w-full bg-blue-600 hover:bg-blue-500 p-5 rounded-[25px] font-black uppercase italic text-sm transition-all shadow-xl shadow-blue-900/20"
            >
              {loading ? 'AUTENTICANDO...' : 'ENTRAR'}
            </button>
          </form>
        ) : (
          <div className="space-y-3 animate-in fade-in zoom-in duration-500">
            {/* NIVEL 1 EN ADELANTE */}
            <button onClick={() => irARuta('/empleado')} className="w-full bg-[#1e293b] hover:bg-blue-600 p-5 rounded-[22px] font-bold text-md transition-all border border-white/5 text-left pl-8 italic">
              🏃 Acceso Empleado
            </button>
            
            {/* NIVEL 3 EN ADELANTE (Supervisor, Admin, Técnico) */}
            {tieneAcceso(3) && (
              <button onClick={() => irARuta('/supervisor')} className="w-full bg-[#1e293b] hover:bg-blue-600 p-5 rounded-[22px] font-bold text-md transition-all border border-white/5 text-left pl-8 italic">
                🛡️ Panel Supervisor
              </button>
            )}

            {/* NIVEL 4 EN ADELANTE (Admin y Técnico) */}
            {tieneAcceso(4) && (
              <>
                <button onClick={() => irARuta('/reportes')} className="w-full bg-[#1e293b] hover:bg-amber-600 p-5 rounded-[22px] font-bold text-md transition-all border border-white/5 text-left pl-8 italic">
                  📊 Análisis y Reportes
                </button>
                <button onClick={() => irARuta('/admin')} className="w-full bg-[#1e293b] hover:bg-blue-600 p-5 rounded-[22px] font-bold text-md transition-all border border-white/5 text-left pl-8 italic">
                  ⚙️ Gestión Administrativa
                </button>
              </>
            )}

            {/* NIVEL 8 EN ADELANTE (Solo Técnico) */}
            {tieneAcceso(8) && (
              <button 
                onClick={() => irARuta('/configuracion')} 
                className="w-full bg-red-600/10 border border-red-500/20 hover:bg-red-600 text-red-500 hover:text-white p-5 rounded-[22px] font-black text-md transition-all text-left pl-8 group italic"
              >
                <span className="mr-2 group-hover:animate-spin inline-block text-xl">⚙️</span> Configuración Maestra
              </button>
            )}
            
            <button 
              onClick={finalizarSesion} 
              className="w-full text-slate-600 font-bold uppercase text-[9px] tracking-[0.3em] mt-4 hover:text-white transition-all text-center italic"
            >
              ✕ Cerrar Sesión Segura
            </button>
          </div>
        )}
      </div>
    </main>
  );
}