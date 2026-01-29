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
  const [config, setConfig] = useState<any>({ empresa_nombre: 'SISTEMA RAY' });
  
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // 1. PERSISTENCIA DE SESIÓN
  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) {
      setTempUser(JSON.parse(sessionData));
      setPaso('selector');
    }
  }, []);

  // 2. RUTINA DE ACCESO (Lógica solicitada: Nivel Usuario >= Nivel Módulo)
  const validarYEntrar = (ruta: string, nivelRequerido: number) => {
    // Leemos el nivel_acceso directamente del objeto guardado tras el login
    const nivelActual = tempUser?.nivel_acceso; 

    if (nivelActual >= nivelRequerido) {
      router.push(ruta);
    } else {
      alert(`ACCESO DENEGADO: Su nivel (${nivelActual}) no alcanza el requerido (${nivelRequerido})`);
    }
  };

  // 3. PROCESO DE LOGIN Y CAPTURA DE NIVEL_ACCESO
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('empleados')
        .select('*') // Aquí capturamos nivel_acceso como número entero desde la tabla
        .or(`documento_id.eq.${identificador},email.eq.${identificador.toLowerCase()}`)
        .eq('pin_seguridad', pin)
        .eq('activo', true)
        .maybeSingle();

      if (error || !data) throw new Error("Credenciales inválidas o usuario inactivo");

      // Verificamos que el campo nivel_acceso venga de la tabla
      if (data.nivel_acceso === undefined) throw new Error("Error: Campo nivel_acceso no encontrado");

      // ÉXITO: Guardamos datos y pasamos al selector
      localStorage.setItem('user_session', JSON.stringify(data));
      setTempUser(data);
      setPaso('selector');
      
      // Limpieza total de buffer de login
      setIdentificador('');
      setPin('');
    } catch (err: any) {
      alert(err.message);
      setIdentificador('');
      setPin('');
      setTimeout(() => inputRef.current?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  const cerrarSesion = () => {
    localStorage.removeItem('user_session');
    setTempUser(null);
    setPaso('login');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      <div className="w-full max-w-md bg-[#0f172a] p-10 rounded-[45px] border border-white/5 shadow-2xl">
        
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter">
            {config.empresa_nombre}
          </h1>
          {tempUser && (
            <p className="text-[10px] text-blue-400 font-bold mt-2 tracking-widest uppercase">
              SESIÓN: {tempUser.nombre} | NIVEL: {tempUser.nivel_acceso}
            </p>
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
              placeholder="PIN DE SEGURIDAD" 
              className="w-full bg-[#050a14] border border-white/5 p-5 rounded-[22px] text-xs font-black tracking-[0.5em] focus:border-blue-500 outline-none"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
            />
            <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 p-5 rounded-[25px] font-black uppercase text-sm transition-all">
              {loading ? 'AUTENTICANDO...' : 'ENTRAR AL SISTEMA'}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            
            {/* 1. MÓDULO EMPLEADO (Nivel 1 o superior) */}
            <button onClick={() => validarYEntrar('/empleado', 1)} className="w-full bg-[#1e293b] hover:bg-blue-600 p-5 rounded-[22px] font-bold text-left pl-8 italic transition-all">
              🏃 Acceso Empleado
            </button>
            
            {/* 2. MÓDULO SUPERVISOR (Nivel 3 o superior) */}
            {tempUser.nivel_acceso >= 3 && (
              <button onClick={() => validarYEntrar('/supervisor', 3)} className="w-full bg-[#1e293b] hover:bg-blue-600 p-5 rounded-[22px] font-bold text-left pl-8 italic transition-all">
                🛡️ Panel Supervisor
              </button>
            )}

            {/* 3. MÓDULO REPORTES (Nivel 4 o superior) */}
            {tempUser.nivel_acceso >= 4 && (
              <button onClick={() => validarYEntrar('/reportes', 4)} className="w-full bg-[#1e293b] hover:bg-amber-600 p-5 rounded-[22px] font-bold text-left pl-8 italic transition-all">
                📊 Análisis y Reportes
              </button>
            )}

            {/* 4. MÓDULO ADMINISTRACIÓN (Nivel 4 o superior) */}
            {tempUser.nivel_acceso >= 4 && (
              <button onClick={() => validarYEntrar('/admin', 4)} className="w-full bg-[#1e293b] hover:bg-blue-600 p-5 rounded-[22px] font-bold text-left pl-8 italic transition-all">
                ⚙️ Gestión Administrativa
              </button>
            )}

            {/* 5. MÓDULO TÉCNICO (Nivel 8 o superior) */}
            {tempUser.nivel_acceso >= 8 && (
              <button 
                onClick={() => validarYEntrar('/configuracion', 8)} 
                className="w-full bg-red-600/10 border border-red-500/20 hover:bg-red-600 text-red-500 hover:text-white p-5 rounded-[22px] font-black text-left pl-8 group transition-all"
              >
                ⚙️ Configuración Maestra
              </button>
            )}
            
            <button onClick={cerrarSesion} className="w-full text-slate-600 font-bold uppercase text-[9px] tracking-[0.3em] mt-6 hover:text-white text-center">
              ✕ CERRAR SESIÓN SEGURA
            </button>
          </div>
        )}
      </div>
    </main>
  );
}