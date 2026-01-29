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

  // 1. CARGA DE CONFIGURACIÓN DESDE TABLA sistema_config
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

  // 2. ÚNICA RUTINA DE ACCESO (Coherencia Total)
  const ejecutarAcceso = (ruta: string, nivelMinimoModulo: number, esReporte: boolean = false) => {
    // Si no hay usuario, rebotar
    if (!tempUser) return;

    // REGLA MAESTRA: Nivel 8 tiene inmunidad total y acceso directo
    if (tempUser.nivel_acceso >= 8) {
      router.push(ruta);
      return;
    }

    // Lógica para los demás niveles
    if (esReporte) {
      // Caso especial Reportes: Nivel 4+ O (Nivel 3 Y permiso_reportes true)
      if (tempUser.nivel_acceso >= 4 || (tempUser.nivel_acceso === 3 && tempUser.permiso_reportes === true)) {
        router.push(ruta);
      } else {
        alert("Permisos de Reportes insuficientes.");
      }
    } else {
      // Caso General: Nivel Usuario >= Nivel Módulo
      if (tempUser.nivel_acceso >= nivelMinimoModulo) {
        router.push(ruta);
      } else {
        alert("Nivel de acceso insuficiente para este módulo.");
      }
    }
  };

  // 3. CAPTURA DE DATOS DESDE TABLA empleados
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

      // Almacenamos el objeto completo (nivel_acceso es int, permiso_reportes es bool)
      localStorage.setItem('user_session', JSON.stringify(data));
      setTempUser(data);
      setPaso('selector');
      
      setIdentificador('');
      setPin('');
    } catch (err: any) {
      alert("Error: Verifique sus datos.");
      setIdentificador('');
      setPin('');
      setTimeout(() => inputRef.current?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans relative">
      <div className="w-full max-w-md bg-[#0f172a] p-10 rounded-[45px] border border-white/5 shadow-2xl z-10">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter">
            {config.empresa_nombre || 'SISTEMA'}
          </h1>
          {tempUser && paso === 'selector' && (
            <div className="mt-4 border-t border-white/5 pt-4">
              <p className="text-xs font-black uppercase">{tempUser.nombre}</p>
              <p className="text-[9px] font-bold text-blue-500 uppercase italic">NIVEL: {tempUser.nivel_acceso}</p>
            </div>
          )}
        </header>

        {paso === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-5">
            <input 
              ref={inputRef}
              type="text" 
              placeholder="DOCUMENTO / CORREO" 
              className="w-full bg-[#050a14] border border-white/5 p-5 rounded-[22px] text-xs font-bold focus:border-blue-500 outline-none uppercase"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              required
            />
            <input 
              type="password" 
              placeholder="PIN" 
              className="w-full bg-[#050a14] border border-white/5 p-5 rounded-[22px] text-xs font-black tracking-[0.4em] focus:border-blue-500 outline-none"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
            />
            <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 p-5 rounded-[25px] font-black uppercase italic text-sm transition-all">
              {loading ? 'AUTENTICANDO...' : 'ENTRAR'}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            
            {/* MÓDULO 1: EMPLEADO (Nivel 1+) */}
            {tempUser.nivel_acceso >= 1 && (
              <button onClick={() => ejecutarAcceso('/empleado', 1)} className="w-full bg-[#1e293b] hover:bg-blue-600 p-5 rounded-[22px] font-bold text-left pl-8 italic transition-all">
                🏃 Acceso Empleado
              </button>
            )}
            
            {/* MÓDULO 2: SUPERVISOR (Nivel 3+) */}
            {tempUser.nivel_acceso >= 3 && (
              <button onClick={() => ejecutarAcceso('/supervisor', 3)} className="w-full bg-[#1e293b] hover:bg-blue-600 p-5 rounded-[22px] font-bold text-left pl-8 italic transition-all">
                🛡️ Panel Supervisor
              </button>
            )}

            {/* MÓDULO 3: REPORTES (Nivel 4+ O Nivel 3 con Permiso) */}
            {(tempUser.nivel_acceso >= 4 || (tempUser.nivel_acceso === 3 && tempUser.permiso_reportes)) && (
              <button onClick={() => ejecutarAcceso('/reportes', 3, true)} className="w-full bg-[#1e293b] hover:bg-amber-600 p-5 rounded-[22px] font-bold text-left pl-8 italic transition-all">
                📊 Análisis y Reportes
              </button>
            )}

            {/* MÓDULO 4: ADMINISTRACIÓN (Nivel 4+) */}
            {tempUser.nivel_acceso >= 4 && (
              <button onClick={() => ejecutarAcceso('/admin', 4)} className="w-full bg-[#1e293b] hover:bg-blue-600 p-5 rounded-[22px] font-bold text-left pl-8 italic transition-all">
                ⚙️ Gestión Administrativa
              </button>
            )}

            {/* MÓDULO 5: TÉCNICO (Nivel 8+) */}
            {tempUser.nivel_acceso >= 8 && (
              <button onClick={() => ejecutarAcceso('/configuracion', 8)} className="w-full bg-red-600/10 border border-red-500/20 hover:bg-red-600 text-red-500 hover:text-white p-5 rounded-[22px] font-black text-left pl-8 italic transition-all">
                ⚙️ Configuración Maestra
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