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

  // 2. RUTINA DE ACCESO QUIRÚRGICA (SIN ROLES, SOLO NIVELES)
  const ejecutarAcceso = (ruta: string, nivelMinimo: number, esReporte: boolean = false) => {
    if (!tempUser) return;

    // EL NIVEL_ACCESO ES UN NÚMERO DIRECTO DE LA TABLA
    const nivel = tempUser.nivel_acceso;
    const tienePermisoReporte = tempUser.permiso_reportes;

    // REGLA MAESTRA: NIVEL 8 ENTRA A TODO
    if (nivel >= 8) {
      router.push(ruta);
      return;
    }

    if (esReporte) {
      // Lógica Reportes: Nivel 4 o superior SIEMPRE entra. 
      // Nivel 3 SOLO entra si permiso_reportes es true.
      if (nivel >= 4 || (nivel === 3 && tienePermisoReporte === true)) {
        router.push(ruta);
      } else {
        alert("Su nivel o permisos actuales no le permiten acceder a Reportes.");
      }
    } else {
      // Lógica General: Comparación matemática pura
      if (nivel >= nivelMinimo) {
        router.push(ruta);
      } else {
        alert(`Acceso denegado. Se requiere nivel ${nivelMinimo}.`);
      }
    }
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

      localStorage.setItem('user_session', JSON.stringify(data));
      setTempUser(data);
      setPaso('selector');
      setIdentificador('');
      setPin('');
    } catch (err: any) {
      alert("Error de autenticación");
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
            {config.empresa_nombre.split(' ')[0]} <span className="text-blue-500">{config.empresa_nombre.split(' ').slice(1).join(' ')}</span>
          </h1>
          {tempUser && paso === 'selector' && (
            <div className="mt-4">
              <p className="text-xs font-black uppercase text-white tracking-widest">{tempUser.nombre}</p>
              <p className="text-[9px] font-bold text-blue-400 uppercase italic">Nivel de Acceso: {tempUser.nivel_acceso}</p>
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
              {loading ? 'AUTENTICANDO...' : 'ENTRAR'}
            </button>
          </form>
        ) : (
          <div className="space-y-3 animate-in zoom-in duration-300">
            
            {/* 1. MÓDULO EMPLEADO (Cualquier nivel >= 1) */}
            {tempUser.nivel_acceso >= 1 && (
              <button onClick={() => ejecutarAcceso('/empleado', 1)} className="w-full bg-[#1e293b] hover:bg-blue-600 p-5 rounded-[22px] font-bold text-md transition-all border border-white/5 text-left pl-8 italic">
                🏃 Acceso Empleado
              </button>
            )}
            
            {/* 2. MÓDULO SUPERVISOR (Cualquier nivel >= 3) */}
            {tempUser.nivel_acceso >= 3 && (
              <button onClick={() => ejecutarAcceso('/supervisor', 3)} className="w-full bg-[#1e293b] hover:bg-blue-600 p-5 rounded-[22px] font-bold text-md transition-all border border-white/5 text-left pl-8 italic">
                🛡️ Panel Supervisor
              </button>
            )}

            {/* 3. MÓDULO REPORTES (Nivel 4+ O Nivel 3 con permiso) */}
            {(tempUser.nivel_acceso >= 4 || (tempUser.nivel_acceso === 3 && tempUser.permiso_reportes === true)) && (
              <button onClick={() => ejecutarAcceso('/reportes', 3, true)} className="w-full bg-[#1e293b] hover:bg-amber-600 p-5 rounded-[22px] font-bold text-md transition-all border border-white/5 text-left pl-8 italic">
                📊 Análisis y Reportes
              </button>
            )}

            {/* 4. MÓDULO GESTIÓN (Cualquier nivel >= 4) */}
            {tempUser.nivel_acceso >= 4 && (
              <button onClick={() => ejecutarAcceso('/admin', 4)} className="w-full bg-[#1e293b] hover:bg-blue-600 p-5 rounded-[22px] font-bold text-md transition-all border border-white/5 text-left pl-8 italic">
                ⚙️ Gestión Administrativa
              </button>
            )}

            {/* 5. MÓDULO TÉCNICO (Nivel 8) */}
            {tempUser.nivel_acceso >= 8 && (
              <button 
                onClick={() => ejecutarAcceso('/configuracion', 8)} 
                className="w-full bg-red-600/10 border border-red-500/20 hover:bg-red-600 text-red-500 hover:text-white p-5 rounded-[22px] font-black text-md transition-all text-left pl-8 group italic"
              >
                <span className="mr-2 group-hover:animate-spin inline-block text-xl">⚙️</span> Configuración Maestra
              </button>
            )}
            
            <button 
              onClick={() => { localStorage.removeItem('user_session'); setTempUser(null); setPaso('login'); }} 
              className="w-full text-slate-600 font-bold uppercase text-[9px] tracking-[0.3em] mt-6 hover:text-white text-center italic transition-colors"
            >
              ✕ Cerrar Sesión Segura
            </button>
          </div>
        )}
      </div>
    </main>
  );
}