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

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase.from('sistema_config').select('clave, valor');
      if (data) {
        const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
        setConfig((prev: any) => ({ ...prev, ...cfgMap }));
      }
    };
    fetchConfig();

    // PERSISTENCIA: Si ya hay sesión, evaluar bypass
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) {
      const user = JSON.parse(sessionData);
      if (Number(user.nivel_acceso) === 1) {
        router.push('/empleado');
      } else {
        setTempUser(user);
        setPaso('selector');
      }
    }
  }, [router]);

  const logout = () => {
    localStorage.clear(); // Limpieza total por seguridad
    setTempUser(null);
    setIdentificador('');
    setPin('');
    setPaso('login');
    showNotification("Sesión finalizada", 'success');
  };

  const showNotification = (texto: string, tipo: 'success' | 'error') => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje({ texto: '', tipo: null }), 2000);
  };

  // --- FUNCIÓN DE LOGIN CORREGIDA ---
  const handleLogin = async () => {
    if (!identificador || !pin) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('empleados')
        .select('*')
        .or(`documento_id.eq."${identificador}",email.eq."${identificador.toLowerCase()}"`)
        .eq('pin_seguridad', pin)
        .eq('activo', true)
        .maybeSingle();

      if (error || !data) throw new Error("Credenciales inválidas");

      const userData = { 
        ...data, 
        nivel_acceso: Number(data.nivel_acceso),
        rol: data.rol.toLowerCase() === 'admin' ? 'Administrador' : data.rol 
      };
      
      localStorage.setItem('user_session', JSON.stringify(userData));

      // BYPASS INMEDIATO: Si es nivel 1, saltar el menú "Opciones"
      if (userData.nivel_acceso === 1) {
        showNotification(`Accediendo...`, 'success');
        router.push('/empleado');
      } else {
        // Solo supervisores o admin ven el menú de opciones
        setTempUser(userData);
        setPaso('selector');
        showNotification(`Bienvenido, ${userData.nombre}`, 'success');
      }
    } catch (err: any) {
      showNotification("Acceso denegado.", 'error');
      setIdentificador('');
      setPin('');
      idRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const renderBicolorTitle = (text: string) => {
    const words = (text || 'SISTEMA').split(' ');
    if (words.length === 1) return <span className="text-blue-700">{words[0]}</span>;
    const lastWord = words.pop();
    const firstPart = words.join(' ');
    return (
      <>
        <span className="text-white">{firstPart} </span>
        <span className="text-blue-700">{lastWord}</span>
      </>
    );
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      
      {mensaje.tipo && (
        <div className={`fixed top-6 z-50 px-6 py-3 rounded-xl shadow-2xl font-bold animate-flash-fast text-sm ${
          mensaje.tipo === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
        }`}>
          {mensaje.tipo === 'success' ? '✅' : '❌'} {mensaje.texto}
        </div>
      )}

      {/* Box de Membrete */}
      <div className="w-full max-w-sm bg-[#1a1a1a] p-6 rounded-[25px] shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-white/5 mb-4">
        <header className="text-center">
          <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-2">
            {renderBicolorTitle(config.empresa_nombre)}
          </h1>
          <p className="text-blue-700 font-bold text-[10px] uppercase tracking-widest mb-3">
            {paso === 'login' ? 'Identificación' : 'Menú Principal'}
          </p>

          {tempUser && paso === 'selector' && (
            <div className="mt-2 pt-2 border-t border-white/5 flex flex-row items-center justify-center gap-2 flex-wrap">
              <span className="text-sm font-normal text-white uppercase truncate max-w-[150px]">
                {tempUser.nombre.split(' ')[0]}
              </span>
              <span className="text-[11px] font-normal text-white/60 uppercase">
                | {tempUser.rol} ({tempUser.nivel_acceso})
              </span>
            </div>
          )}
        </header>
      </div>
      
      {/* Contenedor de Acciones */}
      <div className="w-full max-w-sm bg-[#111111] p-8 rounded-[35px] border border-white/5 relative z-10 shadow-2xl">
        {paso === 'login' ? (
          <div className="space-y-4">
            <input 
              ref={idRef}
              type="text" 
              placeholder="DOCUMENTO O CORREO" 
              className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-center text-sm font-bold text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all uppercase"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && pinRef.current?.focus()}
              autoFocus
            />
            <input 
              ref={pinRef}
              type="text" 
              style={{ WebkitTextSecurity: 'disc' } as any}
              placeholder="PIN DE SEGURIDAD" 
              className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-center text-sm font-black text-white tracking-[0.4em] focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            <button 
              onClick={handleLogin}
              disabled={loading} 
              className="w-full bg-blue-500 hover:bg-blue-700 p-4 rounded-xl text-white font-black uppercase italic text-sm transition-all active:scale-95 flex justify-center shadow-lg group"
            >
              <span className="inline-block w-[75%]">
                {loading ? '...' : 'INICIAR SESIÓN'}
              </span>
            </button>
            <button onClick={logout} className="w-full text-emerald-500 font-bold uppercase text-[9px] tracking-widest mt-2 italic hover:text-emerald-400 transition-colors">
               ✕ Limpiar Terminal
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-center mb-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em]">
                <span className="text-white">Opci</span><span className="text-blue-700">ones</span>
              </p>
            </div>

            {[
              { label: '🏃 acceso como empleado', ruta: '/empleado', minNivel: 1 },
              { label: '🛡️ panel supervisor', ruta: '/supervisor', minNivel: 3 },
              { label: '📊 análisis y reportes', ruta: '/reportes', minNivel: 3, checkPermiso: true },
              { label: '⚙️ gestión administrativa', ruta: '/admin', minNivel: 4 },
              { label: '⚙️ configuración maestra', ruta: '/configuracion', minNivel: 8 },
            ].map((btn) => {
              const esSupervisor = Number(tempUser.nivel_acceso) === 3;
              const tienePermisoReportes = tempUser.permiso_reportes === true || String(tempUser.permiso_reportes) === 'true';
              
              let accesoAutorizado = Number(tempUser.nivel_acceso) >= btn.minNivel;

              if (btn.checkPermiso) {
                accesoAutorizado = (Number(tempUser.nivel_acceso) >= 4) || (esSupervisor && tienePermisoReportes);
              }
              
              if (!accesoAutorizado) return null;

              return (
                <button 
                  key={btn.ruta}
                  onClick={() => router.push(btn.ruta)} 
                  className="w-full bg-blue-500 hover:bg-blue-700 p-4 rounded-xl text-white font-bold transition-all active:scale-95 flex justify-center shadow-md group"
                >
                  <span className="w-[85%] text-left italic uppercase text-[11px] flex items-center">
                    <span className="text-[1.5em] mr-3 transition-transform duration-300 group-hover:scale-125 group-hover:rotate-12 inline-block">
                      {btn.label.split(' ')[0]}
                    </span>
                    {btn.label.split(' ').slice(1).join(' ')}
                  </span>
                </button>
              );
            })}
            
            <button 
              onClick={logout} 
              className="w-full text-emerald-500 font-bold uppercase text-[9px] tracking-[0.2em] mt-6 hover:text-emerald-400 transition-colors italic text-center"
            >
              ✕ Cerrar Sesión Segura
            </button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes flash-fast {
          0%, 100% { opacity: 1; }
          10%, 30%, 50% { opacity: 0; }
          20%, 40%, 60% { opacity: 1; }
        }
        .animate-flash-fast {
          animation: flash-fast 2s ease-in-out;
        }
      `}</style>
    </main>
  );
}