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
  const [config, setConfig] = useState<any>({ empresa_nombre: '', timer_inactividad: null });
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'exito' | 'error' | 'advertencia' | 'info' | null }>({ texto: '', tipo: null });

  const idRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
      if (Number(user.nivel_acceso) <= 2) router.push('/empleado');
      else { setTempUser(user); setPaso('selector'); }
    }
  }, [router]);

  const logout = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    localStorage.clear();
    setTempUser(null);
    setIdentificador('');
    setPin('');
    setPaso('login');
  };

  const mostrarNotificacion = (texto: string, tipo: 'exito' | 'error' | 'advertencia' | 'info') => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje({ texto: '', tipo: null }), 3000);
  };

  const handleLogin = async () => {
    if (!identificador || !pin) {
      mostrarNotificacion('Complete todos los campos', 'advertencia');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.from('empleados')
        .select('*')
        .or(`documento_id.eq."${identificador}",email.eq."${identificador.toLowerCase()}"`)
        .eq('pin_seguridad', pin).eq('activo', true).maybeSingle();

      if (error || !data) throw new Error('Credenciales inválidas');

      const userData = {
        ...data,
        nivel_acceso: Number(data.nivel_acceso),
        permiso_reportes: !!data.permiso_reportes
      };
      localStorage.setItem('user_session', JSON.stringify(userData));

      if (userData.nivel_acceso <= 2) router.push('/empleado');
      else { setTempUser(userData); setPaso('selector'); }
    } catch (err: any) {
      mostrarNotificacion('Acceso denegado', 'error');
      setIdentificador(''); setPin('');
      idRef.current?.focus();
    } finally { setLoading(false); }
  };

  const obtenerBotonesDisponibles = () => {
    const nivel = Number(tempUser?.nivel_acceso || 0);
    const tienePermisoReportes = tempUser?.permiso_reportes === true;

    const todosLosBotones = [
      { label: 'ACCESO EMPLEADO', icono: '🫆', ruta: '/empleado', minNivel: 1, hover: 'hover:bg-emerald-600' },
      { label: 'PANEL SUPERVISOR', icono: '🕖', ruta: '/supervisor', minNivel: 3, hover: 'hover:bg-blue-600' },
      { label: 'REPORTES Y ANÁLISIS', icono: '📊', ruta: '/reportes', minNivel: 3, hover: 'hover:bg-slate-700', requiereReportes: true },
      { label: 'GESTIÓN ADMINISTRATIVA', icono: '👥', ruta: '/admin', minNivel: 4, hover: 'hover:bg-amber-600' },
      { label: 'CONFIGURACIÓN MAESTRA', icono: '👨‍🔧', ruta: '/configuracion', minNivel: 8, hover: 'hover:bg-rose-900' },
    ];

    return todosLosBotones.filter((btn) => {
      if (nivel < btn.minNivel) return false;
      if (btn.requiereReportes && !tienePermisoReportes) return false;
      if (nivel === 3) return btn.ruta === '/empleado' || btn.ruta === '/supervisor';
      if (nivel === 4) {
        if (btn.ruta === '/reportes') return tienePermisoReportes;
        return btn.ruta === '/empleado' || btn.ruta === '/supervisor' || btn.ruta === '/admin';
      }
      if (nivel === 5) return btn.ruta !== '/configuracion';
      if (nivel >= 6 && nivel <= 7) return btn.ruta !== '/configuracion';
      return true;
    });
  };

  // ------------------------------------------------------------
  // COMPONENTES VISUALES INTERNOS (EXACTOS A LA CAPTURA)
  // ------------------------------------------------------------
  const Memebrete = () => (
    <div className="w-full max-w-sm bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 mb-4 text-center shadow-2xl">
      <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-2">
        <span className="text-white">GESTOR DE </span>
        <span className="text-blue-700">ACCESO</span>
      </h1>
      <p className={`text-white font-bold text-[17px] uppercase tracking-widest mb-3 ${paso === 'login' ? 'animate-pulse-slow' : ''}`}>
        {paso === 'login' ? 'IDENTIFICACIÓN' : 'MENÚ PRINCIPAL'}
      </p>
      {paso === 'selector' && tempUser && (
        <div className="mt-2 pt-2 border-t border-white/10">
          <span className="text-sm font-normal text-white uppercase">
            {tempUser.nombre} · Selector Principal ({tempUser.nivel_acceso})
          </span>
        </div>
      )}
    </div>
  );

  const BotonOpcion = ({
    texto,
    icono,
    onClick,
    className = ''
  }: {
    texto: string;
    icono: string;
    onClick: () => void;
    className?: string;
  }) => (
    <button
      onClick={onClick}
      className={`w-full bg-[#0f172a] p-4 rounded-xl border border-white/5 
        transition-all duration-200 active:scale-95 shadow-lg 
        flex items-center justify-start gap-4 group
        ${className}`}
    >
      <span className="text-2xl group-hover:scale-110 transition-transform">{icono}</span>
      <span className="text-white font-black uppercase italic text-[11px] tracking-widest group-hover:text-white">
        {texto}
      </span>
    </button>
  );

  const Footer = () => (
    <div className="w-full max-w-sm mt-8 pt-4 border-t border-white/5 text-center">
      <p className="text-[9px] text-white/40 uppercase tracking-widest mb-4">
        @Copyright RayPérez 2026
      </p>
      {paso === 'selector' && (
        <button
          onClick={logout}
          className="text-emerald-500 font-black uppercase text-[10px] tracking-[0.2em] italic flex items-center justify-center gap-2 mx-auto hover:text-emerald-400 transition-colors"
        >
          <span className="text-lg">🏠</span> CERRAR SESIÓN
        </button>
      )}
    </div>
  );

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Notificación flotante */}
      {mensaje.tipo && (
        <div className={`fixed top-6 z-50 px-6 py-3 rounded-xl font-bold text-sm shadow-2xl animate-flash-fast max-w-[90%] text-center border-2 ${
          mensaje.tipo === 'exito' ? 'bg-emerald-500 border-emerald-400 text-white' :
          mensaje.tipo === 'error' ? 'bg-rose-500 border-rose-400 text-white' :
          mensaje.tipo === 'advertencia' ? 'bg-amber-500 border-amber-400 text-white' :
          'bg-blue-500 border-blue-400 text-white'
        }`}>
          <span className="text-lg mr-2">
            {mensaje.tipo === 'exito' ? '✅' : mensaje.tipo === 'error' ? '❌' : mensaje.tipo === 'advertencia' ? '⚠️' : 'ℹ️'}
          </span>
          {mensaje.texto}
        </div>
      )}

      <div className="w-full max-w-sm flex flex-col items-center">
        <Memebrete />

        {paso === 'login' ? (
          <div className="w-full space-y-4">
            <input
              ref={idRef}
              type="text"
              placeholder="ID / CORREO"
              className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-center text-[11px] font-bold text-white outline-none focus:border-blue-500/50 uppercase"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && pinRef.current?.focus()}
              autoFocus
            />
            <input
              ref={pinRef}
              type="password"
              placeholder="PIN"
              className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-center text-[11px] font-black text-white tracking-[0.4em] outline-none focus:border-blue-500/50 uppercase"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            <BotonOpcion
              texto={loading ? 'VERIFICANDO...' : 'ENTRAR'}
              icono="🔐"
              onClick={handleLogin}
              className="hover:bg-blue-600"
            />
          </div>
        ) : (
          <div className="w-full space-y-3">
            {obtenerBotonesDisponibles().map((btn) => (
              <BotonOpcion
                key={btn.ruta}
                texto={btn.label}
                icono={btn.icono}
                onClick={() => router.push(btn.ruta)}
                className={btn.hover}
              />
            ))}
          </div>
        )}

        <Footer />
      </div>

      <style jsx global>{`
        @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
        @keyframes flash-fast { 0%, 100% { opacity: 1; } 10%, 30%, 50% { opacity: 0; } 20%, 40%, 60% { opacity: 1; } }
        .animate-flash-fast { animation: flash-fast 2s ease-in-out; }
      `}</style>
    </main>
  );
}