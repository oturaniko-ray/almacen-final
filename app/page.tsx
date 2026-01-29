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
  
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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
      // Forzamos que el nivel sea número desde que se carga la sesión
      user.nivel_acceso = Number(user.nivel_acceso);
      setTempUser(user);
      setPaso('selector');
    }
  }, []);

  // --- LÓGICA DE ACCESO 100% NUMÉRICA ---
  const irARuta = (ruta: string) => {
    if (!tempUser) return;

    // Conversión explícita para evitar que el ROL interfiera por tipos de datos
    const nivel = Number(tempUser.nivel_acceso);
    const tienePermisoReportes = tempUser.permiso_reportes === true || tempUser.permiso_reportes === 'true';

    // REGLA DE ORO: NIVEL 8 ENTRA A TODO.
    if (nivel >= 8) {
      router.push(ruta);
      return;
    }

    // RUTAS ESPECÍFICAS
    if (ruta === '/reportes') {
      if (nivel >= 4 || (nivel === 3 && tienePermisoReportes)) {
        router.push(ruta);
      } else {
        alert("Nivel insuficiente para Reportes.");
      }
      return;
    }

    if (ruta === '/admin') {
      if (nivel >= 4) {
        router.push(ruta);
      } else {
        alert("Se requiere Nivel 4 para Gestión.");
      }
      return;
    }

    // Por defecto para niveles menores en rutas básicas
    router.push(ruta);
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

      if (error || !data) throw new Error("Credenciales inválidas");

      // Normalizamos el dato antes de guardarlo
      const userData = {
        ...data,
        nivel_acceso: Number(data.nivel_acceso)
      };

      localStorage.setItem('user_session', JSON.stringify(userData));
      setTempUser(userData);
      setPaso('selector');
      setIdentificador('');
      setPin('');
    } catch (err: any) {
      alert("Error de acceso");
      setIdentificador('');
      setPin('');
      setTimeout(() => inputRef.current?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
      
      <div className="w-full max-w-md bg-[#0f172a] p-10 rounded-[45px] border border-white/5 shadow-2xl relative z-10">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none">
            {config.empresa_nombre ? (
              <>
                {config.empresa_nombre.split(' ')[0]} <span className="text-blue-500">{config.empresa_nombre.split(' ').slice(1).join(' ')}</span>
              </>
            ) : 'SISTEMA'}
          </h1>
          {tempUser && (
            <div className="mt-4 border-t border-white/5 pt-4">
              <p className="text-xs font-black uppercase text-white">{tempUser.nombre}</p>
              <p className="text-[9px] font-bold text-blue-400 uppercase italic mt-1">NIVEL ACTUAL: {tempUser.nivel_acceso}</p>
            </div>
          )}
        </header>

        {paso === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-5">
            <input 
              ref={inputRef}
              type="text" 
              placeholder="DOCUMENTO O CORREO" 
              className="w-full bg-[#050a14] border border-white/5 p-5 rounded-[22px] text-xs font-bold focus:border-blue-500 outline-none uppercase"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              required
            />
            <input 
              type="password" 
              placeholder="PIN" 
              className="w-full bg-[#050a14] border border-white/5 p-5 rounded-[22px] text-xs font-black tracking-[0.5em] focus:border-blue-500 outline-none"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
            />
            <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 p-5 rounded-[25px] font-black uppercase italic text-sm transition-all shadow-xl shadow-blue-900/20">
              {loading ? 'Validando...' : 'Entrar'}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            
            {/* EMPLEADO: Nivel 1 o más */}
            {Number(tempUser.nivel_acceso) >= 1 && (
              <button onClick={() => irARuta('/empleado')} className="w-full bg-[#1e293b] hover:bg-blue-600 p-5 rounded-[22px] font-bold text-md transition-all border border-white/5 text-left pl-8 italic">
                🏃 Acceso Empleado
              </button>
            )}
            
            {/* SUPERVISOR: Nivel 3 o más */}
            {Number(tempUser.nivel_acceso) >= 3 && (
              <button onClick={() => irARuta('/supervisor')} className="w-full bg-[#1e293b] hover:bg-blue-600 p-5 rounded-[22px] font-bold text-md transition-all border border-white/5 text-left pl-8 italic">
                🛡️ Panel Supervisor
              </button>
            )}

            {/* REPORTES: Nivel 4 o (Nivel 3 + Permiso) */}
            {(Number(tempUser.nivel_acceso) >= 4 || (Number(tempUser.nivel_acceso) === 3 && (tempUser.permiso_reportes === true || tempUser.permiso_reportes === 'true'))) && (
              <button onClick={() => irARuta('/reportes')} className="w-full bg-[#1e293b] hover:bg-amber-600 p-5 rounded-[22px] font-bold text-md transition-all border border-white/5 text-left pl-8 italic">
                📊 Análisis y Reportes
              </button>
            )}

            {/* GESTIÓN: Nivel 4 o más */}
            {Number(tempUser.nivel_acceso) >= 4 && (
              <button onClick={() => irARuta('/admin')} className="w-full bg-[#1e293b] hover:bg-blue-600 p-5 rounded-[22px] font-bold text-md transition-all border border-white/5 text-left pl-8 italic">
                ⚙️ Gestión Administrativa
              </button>
            )}

            {/* CONFIGURACIÓN: Nivel 8 únicamente */}
            {Number(tempUser.nivel_acceso) >= 8 && (
              <button 
                onClick={() => irARuta('/configuracion')} 
                className="w-full bg-red-600/10 border border-red-500/20 hover:bg-red-600 text-red-500 hover:text-white p-5 rounded-[22px] font-black text-md transition-all text-left pl-8 group italic"
              >
                <span className="mr-2 group-hover:animate-spin inline-block text-xl">⚙️</span> Configuración Maestra
              </button>
            )}
            
            <button 
              onClick={() => { localStorage.removeItem('user_session'); setTempUser(null); setPaso('login'); }} 
              className="w-full text-slate-600 font-bold uppercase text-[9px] tracking-[0.3em] mt-6 hover:text-white text-center italic"
            >
              ✕ Cerrar Sesión Segura
            </button>
          </div>
        )}
      </div>
    </main>
  );
}