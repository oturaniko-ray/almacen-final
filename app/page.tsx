'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

// Inicialización de Supabase
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function LoginPage() {
  // --- ESTADOS ---
  const [identificador, setIdentificador] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [paso, setPaso] = useState<'login' | 'selector'>('login');
  const [tempUser, setTempUser] = useState<any>(null);
  const [config, setConfig] = useState<any>({ empresa_nombre: '', timer_inactividad: '120000' });
  
  // Estados para el Sistema de Mensajes Estándar
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'success' | 'error' | null }>({ texto: '', tipo: null });

  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // --- EFECTOS ---
  useEffect(() => {
    // Carga de configuración inicial del sistema
    const fetchConfig = async () => {
      const { data } = await supabase.from('sistema_config').select('clave, valor');
      if (data) {
        const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
        setConfig((prev: any) => ({ ...prev, ...cfgMap }));
      }
    };
    fetchConfig();

    // Recuperación de sesión persistente
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) {
      const user = JSON.parse(sessionData);
      user.nivel_acceso = Number(user.nivel_acceso);
      setTempUser(user);
      setPaso('selector');
    }
  }, []);

  // --- UTILIDADES ESTÁNDAR (NOTIFICACIONES) ---
  const showNotification = (texto: string, tipo: 'success' | 'error') => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje({ texto: '', tipo: null }), 4000);
  };

  // --- LÓGICA DE NAVEGACIÓN ---
  const irARuta = (ruta: string) => {
    if (!tempUser) return;
    const nivel = Number(tempUser.nivel_acceso);
    const tienePermisoReportes = tempUser.permiso_reportes === true || tempUser.permiso_reportes === 'true';

    // Validación jerárquica de acceso
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

  // --- MANEJO DE AUTENTICACIÓN ---
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
      showNotification("Acceso denegado: Verifique sus credenciales.", 'error');
      setIdentificador('');
      setPin('');
      setTimeout(() => inputRef.current?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 text-slate-800 font-sans relative overflow-hidden">
      
      {/* Sistema de Alertas Estándar */}
      {mensaje.tipo && (
        <div className={`fixed top-10 z-50 px-8 py-4 rounded-2xl shadow-2xl font-bold animate-bounce transition-all ${
          mensaje.tipo === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
        }`}>
          {mensaje.tipo === 'success' ? '✅' : '❌'} {mensaje.texto}
        </div>
      )}

      {/* Decoración Visual de Fondo */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-100 blur-[120px] rounded-full"></div>
      
      <div className="w-full max-w-md bg-white p-10 rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-blue-50 relative z-10">
        
        {/* MEMBRETE ESTÁNDAR */}
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900 leading-none mb-1">
            {config.empresa_nombre ? config.empresa_nombre : 'SISTEMA'}
          </h1>
          <p className="text-blue-600 font-bold text-[11px] uppercase tracking-widest mb-4">
            {paso === 'login' ? 'Módulo de Identificación' : 'Menú principal de acceso'}
          </p>

          {tempUser && paso === 'selector' && (
            <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100">
              <p className="text-sm font-black text-slate-900 uppercase">{tempUser.nombre}</p>
              <p className="text-[10px] font-bold text-blue-500 uppercase italic">
                {tempUser.rol} ({tempUser.nivel_acceso})
              </p>
            </div>
          )}
        </header>

        {/* CONTENIDO PRINCIPAL */}
        {paso === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              ref={inputRef}
              type="text" 
              placeholder="DOCUMENTO O CORREO" 
              className="w-full bg-slate-50 border border-slate-200 p-5 rounded-2xl text-center text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all uppercase"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              required
            />
            <input 
              type="password" 
              placeholder="PIN DE SEGURIDAD" 
              className="w-full bg-slate-50 border border-slate-200 p-5 rounded-2xl text-center text-sm font-black tracking-[0.4em] focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
            />
            <button 
              disabled={loading} 
              className="w-full bg-blue-600 hover:bg-blue-700 p-5 rounded-2xl text-white font-black uppercase italic text-sm transition-all shadow-lg shadow-blue-200 active:scale-95"
            >
              <span className="inline-block w-[75%]">
                {loading ? 'VALIDANDO...' : 'INICIAR SESIÓN'}
              </span>
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            {/* Botones de Navegación Estándar */}
            {[
              { id: 1, label: '🏃 Acceso Empleado', ruta: '/empleado', color: 'bg-blue-600', minNivel: 1 },
              { id: 3, label: '🛡️ Panel Supervisor', ruta: '/supervisor', color: 'bg-blue-600', minNivel: 3 },
              { id: 4, label: '📊 Análisis y Reportes', ruta: '/reportes', color: 'bg-blue-600', minNivel: 4, checkPermiso: true },
              { id: 4, label: '⚙️ Gestión Administrativa', ruta: '/admin', color: 'bg-blue-600', minNivel: 4 },
            ].map((btn) => {
              const tienePermiso = Number(tempUser.nivel_acceso) >= btn.minNivel || 
                                   (btn.checkPermiso && Number(tempUser.nivel_acceso) === 3 && (tempUser.permiso_reportes === true || tempUser.permiso_reportes === 'true'));
              
              if (!tienePermiso) return null;

              return (
                <button 
                  key={btn.ruta}
                  onClick={() => irARuta(btn.ruta)} 
                  className={`w-full ${btn.color} hover:opacity-90 p-5 rounded-2xl text-white font-bold transition-all shadow-md active:scale-95 flex justify-center`}
                >
                  <span className="w-[75%] text-left italic uppercase text-xs">{btn.label}</span>
                </button>
              );
            })}

            {/* Configuración Maestra (Exclusivo Nivel 8) */}
            {Number(tempUser.nivel_acceso) >= 8 && (
              <button 
                onClick={() => irARuta('/configuracion')} 
                className="w-full bg-slate-900 p-5 rounded-2xl text-white font-black transition-all flex justify-center active:scale-95"
              >
                <span className="w-[75%] text-left italic uppercase text-xs">⚙️ Configuración Maestra</span>
              </button>
            )}
            
            <button 
              onClick={() => { localStorage.removeItem('user_session'); setTempUser(null); setPaso('login'); }} 
              className="w-full text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-8 hover:text-rose-500 transition-colors italic"
            >
              ✕ Cerrar Sesión Segura
            </button>
          </div>
        )}
      </div>
    </main>
  );
}