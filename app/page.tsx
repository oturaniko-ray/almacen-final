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
      user.nivel_acceso = Number(user.nivel_acceso);
      setTempUser(user);
      setPaso('selector');
    }
  }, []);

  const showNotification = (texto: string, tipo: 'success' | 'error') => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje({ texto: '', tipo: null }), 4000);
  };

  const irARuta = (ruta: string) => {
    if (!tempUser) return;
    const nivel = Number(tempUser.nivel_acceso);
    const tienePermisoReportes = tempUser.permiso_reportes === true || tempUser.permiso_reportes === 'true';

    if (nivel >= 8) { router.push(ruta); return; }
    if (ruta === '/reportes' && !(nivel >= 4 || (nivel === 3 && tienePermisoReportes))) {
      showNotification("Nivel insuficiente para Reportes.", 'error');
      return;
    }
    if (ruta === '/admin' && nivel < 4) {
      showNotification("Se requiere Nivel 4 para Gestión.", 'error');
      return;
    }
    router.push(ruta);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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

      const userData = { ...data, nivel_acceso: Number(data.nivel_acceso) };
      localStorage.setItem('user_session', JSON.stringify(userData));
      
      setTempUser(userData);
      setPaso('selector');
      showNotification(`Bienvenido, ${userData.nombre}`, 'success');
    } catch (err: any) {
      showNotification("Acceso denegado.", 'error');
      setIdentificador('');
      setPin('');
      setTimeout(() => inputRef.current?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  // Función para renderizar el nombre de la empresa mitad blanco/mitad azul
  const renderBicolorText = (text: string) => {
    const half = Math.ceil(text.length / 2);
    return (
      <>
        <span className="text-white">{text.substring(0, half)}</span>
        <span className="text-blue-500">{text.substring(half)}</span>
      </>
    );
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      
      {mensaje.tipo && (
        <div className={`fixed top-10 z-50 px-8 py-4 rounded-2xl shadow-2xl font-bold animate-bounce transition-all ${
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
          <p className="text-white font-bold text-[11px] uppercase tracking-widest mb-4">
            {paso === 'login' ? 'Módulo de Identificación' : 'Menú principal de acceso'}
          </p>

          {tempUser && paso === 'selector' && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <p className="text-sm font-black uppercase">
                <span className="text-white">{tempUser.nombre.split(' ')[0]} </span>
                <span className="text-blue-500">{tempUser.nombre.split(' ').slice(1).join(' ')}</span>
              </p>
              <p className="text-[10px] font-bold uppercase italic">
                <span className="text-white">{tempUser.rol} </span>
                <span className="text-blue-500">({tempUser.nivel_acceso})</span>
              </p>
            </div>
          )}
        </header>
      </div>
      
      {/* Contenedor de Formulario/Botones */}
      <div className="w-full max-w-md bg-[#111111] p-10 rounded-[40px] border border-white/5 relative z-10">
        {paso === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              ref={inputRef}
              type="text" 
              placeholder="DOCUMENTO O CORREO" 
              className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-center text-sm font-bold text-white focus:ring-2 focus:ring-blue-500 focus:bg-white/10 outline-none transition-all uppercase"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              required
            />
            <input 
              type="password" 
              placeholder="PIN DE SEGURIDAD" 
              className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-center text-sm font-black text-white tracking-[0.4em] focus:ring-2 focus:ring-blue-500 focus:bg-white/10 outline-none transition-all"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
            />
            <button 
              disabled={loading} 
              className="w-full bg-blue-600 hover:bg-blue-700 p-5 rounded-2xl text-white font-black uppercase italic text-sm transition-all shadow-lg shadow-blue-900/20 active:scale-95 flex justify-center"
            >
              <span className="inline-block w-[75%]">
                {loading ? 'VALIDANDO...' : 'INICIAR SESIÓN'}
              </span>
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            {[
              { label: '🏃 Acceso Empleado', ruta: '/empleado', minNivel: 1 },
              { label: '🛡️ Panel Supervisor', ruta: '/supervisor', minNivel: 3 },
              { label: '📊 Análisis y Reportes', ruta: '/reportes', minNivel: 4, checkPermiso: true },
              { label: '⚙️ Gestión Administrativa', ruta: '/admin', minNivel: 4 },
            ].map((btn) => {
              const tienePermiso = Number(tempUser.nivel_acceso) >= btn.minNivel || 
                                   (btn.checkPermiso && Number(tempUser.nivel_acceso) === 3 && (tempUser.permiso_reportes === true || tempUser.permiso_reportes === 'true'));
              
              if (!tienePermiso) return null;

              return (
                <button 
                  key={btn.ruta}
                  onClick={() => irARuta(btn.ruta)} 
                  className="w-full bg-blue-600 hover:bg-blue-700 p-5 rounded-2xl text-white font-bold transition-all active:scale-95 flex justify-center shadow-md shadow-blue-900/20"
                >
                  <span className="w-[75%] text-left italic uppercase text-xs">{btn.label}</span>
                </button>
              );
            })}

            {Number(tempUser.nivel_acceso) >= 8 && (
              <button 
                onClick={() => irARuta('/configuracion')} 
                className="w-full bg-white/10 p-5 rounded-2xl text-white font-black transition-all flex justify-center active:scale-95 border border-white/5"
              >
                <span className="w-[75%] text-left italic uppercase text-xs">⚙️ Configuración Maestra</span>
              </button>
            )}
            
            <button 
              onClick={() => { localStorage.removeItem('user_session'); setTempUser(null); setPaso('login'); }} 
              className="w-full text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-8 hover:text-rose-500 transition-colors italic"
            >
              ✕ Cerrar Sesión Segura
            </button>
          </div>
        )}
      </div>
    </main>
  );
}