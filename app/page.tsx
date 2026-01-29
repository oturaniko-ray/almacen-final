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
  const [config, setConfig] = useState<any>({ empresa_nombre: 'SISTEMA RAY', timer_inactividad: '120000' });
  
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

  // 2. VARIABLE DE NIVEL (Tratada como número puro para comparaciones matemáticas)
  const nivelUsuario = Number(tempUser?.nivel_acceso || 0);

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

      if (error || !data) throw new Error("Credenciales inválidas");

      localStorage.setItem('user_session', JSON.stringify(data));
      setTempUser(data);
      setPaso('selector');
      
      // Limpieza de buffer tras éxito
      setIdentificador('');
      setPin('');
    } catch (err: any) {
      alert("Error: Datos incorrectos");
      // Limpieza y foco automático tras error
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
    // Limpieza total de campos
    setIdentificador('');
    setPin('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Función de derivación de módulos por nivel
  const accederAModulo = (ruta: string, nivelRequerido: number) => {
    if (nivelUsuario >= nivelRequerido) {
      router.push(ruta);
    } else {
      alert("Acceso restringido para su nivel.");
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden">
      {/* Decoración Visual */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>

      <div className="w-full max-w-md bg-[#0f172a] p-10 rounded-[45px] border border-white/5 shadow-2xl relative z-10">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none">
            {config.empresa_nombre.split(' ')[0]} <span className="text-blue-500">{config.empresa_nombre.split(' ').slice(1).join(' ')}</span>
          </h1>
          {tempUser && paso === 'selector' && (
            <div className="mt-4 animate-in fade-in">
              <p className="text-xs font-black uppercase text-white">{tempUser.nombre}</p>
              <p className="text-[9px] font-bold text-blue-400 uppercase italic">Nivel de Acceso: {nivelUsuario}</p>
            </div>
          )}
        </header>

        {paso === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-5">
            <input 
              ref={inputRef}
              type="text" 
              placeholder="DOCUMENTO O CORREO" 
              className="w-full bg-[#050a14] border border-white/5 p-5 rounded-[22px] text-xs font-bold focus:border-blue-500 outline-none uppercase placeholder:text-slate-700"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              required
            />
            <input 
              type="password" 
              placeholder="PIN DE SEGURIDAD" 
              className="w-full bg-[#050a14] border border-white/5 p-5 rounded-[22px] text-xs font-black tracking-[0.5em] focus:border-blue-500 outline-none placeholder:text-slate-700"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
            />
            <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 p-5 rounded-[25px] font-black uppercase italic text-sm transition-all shadow-xl shadow-blue-900/20">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        ) : (
          <div className="space-y-3 animate-in zoom-in duration-300">
            
            {/* OPCIÓN NIVEL 1: Empleado (Accesible para niveles 1, 3, 4, 8) */}
            {nivelUsuario >= 1 && (
              <button onClick={() => accederAModulo('/empleado', 1)} className="w-full bg-[#1e293b] hover:bg-blue-600 p-5 rounded-[22px] font-bold text-md transition-all border border-white/5 text-left pl-8 italic">
                🏃 Acceso Empleado
              </button>
            )}
            
            {/* OPCIÓN NIVEL 3: Supervisor (Accesible para niveles 3, 4, 8) */}
            {nivelUsuario >= 3 && (
              <button onClick={() => accederAModulo('/supervisor', 3)} className="w-full bg-[#1e293b] hover:bg-blue-600 p-5 rounded-[22px] font-bold text-md transition-all border border-white/5 text-left pl-8 italic">
                🛡️ Panel Supervisor
              </button>
            )}

            {/* OPCIÓN NIVEL 4: Análisis (Accesible para niveles 4, 8) */}
            {nivelUsuario >= 4 && (
              <button onClick={() => accederAModulo('/reportes', 4)} className="w-full bg-[#1e293b] hover:bg-amber-600 p-5 rounded-[22px] font-bold text-md transition-all border border-white/5 text-left pl-8 italic">
                📊 Análisis y Reportes
              </button>
            )}

            {/* OPCIÓN NIVEL 4: Gestión (Accesible para niveles 4, 8) */}
            {nivelUsuario >= 4 && (
              <button onClick={() => accederAModulo('/admin', 4)} className="w-full bg-[#1e293b] hover:bg-blue-600 p-5 rounded-[22px] font-bold text-md transition-all border border-white/5 text-left pl-8 italic">
                ⚙️ Gestión Administrativa
              </button>
            )}

            {/* OPCIÓN NIVEL 8: Técnico (Solo Nivel 8) */}
            {nivelUsuario >= 8 && (
              <button 
                onClick={() => accederAModulo('/configuracion', 8)} 
                className="w-full bg-red-600/10 border border-red-500/20 hover:bg-red-600 text-red-500 hover:text-white p-5 rounded-[22px] font-black text-md transition-all text-left pl-8 group italic"
              >
                <span className="mr-2 group-hover:animate-spin inline-block text-xl">⚙️</span> Configuración Maestra
              </button>
            )}
            
            <button onClick={finalizarSesion} className="w-full text-slate-600 font-bold uppercase text-[9px] tracking-[0.3em] mt-6 hover:text-white text-center italic transition-colors">
              ✕ Cerrar Sesión Segura
            </button>
          </div>
        )}
      </div>
    </main>
  );
}