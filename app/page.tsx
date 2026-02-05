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

    const sessionData = localStorage.getItem('user_session');
    if (sessionData) {
      const user = JSON.parse(sessionData);
      user.nivel_acceso = Number(user.nivel_acceso);
      setTempUser(user);
      setPaso('selector');
    }
  }, []);

  const logout = () => {
    localStorage.removeItem('user_session');
    setTempUser(null);
    setIdentificador('');
    setPin('');
    setPaso('login');
    showNotification("Sesión finalizada", 'success');
  };

  const showNotification = (texto: string, tipo: 'success' | 'error') => {
    setMensaje({ texto, tipo });
    // Ajustado a 2 segundos con efecto flash en CSS
    setTimeout(() => setMensaje({ texto: '', tipo: null }), 2000);
  };

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
      
      setTempUser(userData);
      setPaso('selector');
      showNotification(`Bienvenido, ${userData.nombre}`, 'success');
    } catch (err: any) {
      showNotification("Acceso denegado.", 'error');
      setIdentificador('');
      setPin('');
      idRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const renderBicolorText = (text: string) => {
    const half = Math.ceil(text.length / 2);
    return (
      <>
        <span className="text-white">{text.substring(0, half)}</span>
        <span className="text-blue-700">{text.substring(half)}</span>
      </>
    );
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      
      {/* Sistema de Alertas Estándar con Efecto Flash */}
      {mensaje.tipo && (
        <div className={`fixed top-10 z-50 px-8 py-4 rounded-2xl shadow-2xl font-bold animate-flash-fast ${
          mensaje.tipo === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
        }`}>
          {mensaje.tipo === 'success' ? '✅' : '❌'} {mensaje.texto}
        </div>
      )}

      {/* Box Gris Sombreada para el Membrete */}
      <div className="w-full max-w-md bg-[#1a1a1a] p-8 rounded-[30px] shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-white/5 mb-6">
        <header className="text-center">
          <h1 className="text-3xl font-black italic uppercase tracking-tighter leading-none mb-2">
            {renderBicolorText(config.empresa_nombre || 'SISTEMA')}
          </h1>
          <p className="text-blue-700 font-bold text-[11px] uppercase tracking-widest mb-4">
            {paso === 'login' ? 'Módulo de Identificación' : 'Menú principal de acceso'}
          </p>

          {tempUser && paso === 'selector' && (
            <div className="mt-2 pt-2 border-t border-white/10">
              {/* Nombre aumentado 30% y plano */}
              <p className="text-xl font-normal text-white uppercase tracking-tight">
                {tempUser.nombre}
              </p>
              {/* Rol y Nivel plano (sin italic) */}
              <p className="text-[10px] font-normal text-white uppercase mt-1">
                {tempUser.rol} ({tempUser.nivel_acceso})
              </p>
            </div>
          )}
        </header>
      </div>
      
      {/* Contenedor Principal */}
      <div className="w-full max-w-md bg-[#111111] p-10 rounded-[40px] border border-white/5 relative z-10 shadow-2xl">
        {paso === 'login' ? (
          <div className="space-y-4">
            <input 
              ref={idRef}
              type="text" 
              placeholder="DOCUMENTO O CORREO" 
              className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-center text-sm font-bold text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all uppercase"
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
              className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-center text-sm font-black text-white tracking-[0.4em] focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            <button 
              onClick={handleLogin}
              disabled={loading} 
              className="w-full bg-blue-500 hover:bg-blue-700 p-5 rounded-2xl text-white font-black uppercase italic text-sm transition-all active:scale-95 flex justify-center shadow-lg group"
            >
              <span className="inline-block w-[75%]">
                {loading ? 'VALIDANDO...' : 'INICIAR SESIÓN'}
              </span>
            </button>
            <button onClick={logout} className="w-full text-emerald-500 font-bold uppercase text-[10px] tracking-widest mt-4 italic hover:text-emerald-400 transition-colors">
               ✕ Limpiar Terminal
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {[
              { label: '🏃 Acceso Empleado', ruta: '/empleado', minNivel: 1 },
              { label: '🛡️ Panel Supervisor', ruta: '/supervisor', minNivel: 3 },
              { label: '📊 Análisis y Reportes', ruta: '/reportes', minNivel: 4, checkPermiso: true },
              { label: '⚙️ Gestión Administrativa', ruta: '/admin', minNivel: 4 },
              { label: '⚙️ Configuración Maestra', ruta: '/configuracion', minNivel: 8 },
            ].map((btn) => {
              const tienePermiso = Number(tempUser.nivel_acceso) >= btn.minNivel || 
                                   (btn.checkPermiso && Number(tempUser.nivel_acceso) === 3 && (tempUser.permiso_reportes === true || tempUser.permiso_reportes === 'true'));
              
              if (!tienePermiso) return null;

              return (
                <button 
                  key={btn.ruta}
                  onClick={() => router.push(btn.ruta)} 
                  className="w-full bg-blue-500 hover:bg-blue-700 p-5 rounded-2xl text-white font-bold transition-all active:scale-95 flex justify-center shadow-md group"
                >
                  <span className="w-[75%] text-left italic uppercase text-xs flex items-center">
                    {/* Emoji aumentado y animado al hacer hover en el botón */}
                    <span className="text-[1.7em] mr-3 transition-transform duration-300 group-hover:scale-125 group-hover:rotate-12 inline-block">
                      {btn.label.split(' ')[0]}
                    </span>
                    {btn.label.split(' ').slice(1).join(' ')}
                  </span>
                </button>
              );
            })}
            
            <button 
              onClick={logout} 
              className="w-full text-emerald-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-8 hover:text-emerald-400 transition-colors italic"
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