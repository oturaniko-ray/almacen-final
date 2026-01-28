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
  const [sesionExpulsada, setSesionExpulsada] = useState(false);
  
  // Estado de configuración inicial con valores de respaldo
  const [config, setConfig] = useState<any>({ 
    empresa_nombre: 'CARGANDO...', 
    timer_inactividad: '300000' // 5 minutos por defecto
  });
  
  const sessionId = useRef(Math.random().toString(36).substring(7));
  const router = useRouter();
  const timerInactividad = useRef<any>(null);

  // 1. CARGA DE CONFIGURACIÓN DEL SISTEMA
  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase.from('sistema_config').select('clave, valor');
      if (data) {
        const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
        setConfig((prev: any) => ({ ...prev, ...cfgMap }));
      }
    };
    fetchConfig();

    // Monitoreo de sesión única (expulsión si otro inicia sesión)
    const checkSesion = async () => {
      const sesionLocal = localStorage.getItem('user_session');
      if (sesionLocal) {
        const user = JSON.parse(sesionLocal);
        const { data } = await supabase
          .from('empleados')
          .select('session_id')
          .eq('id', user.id)
          .single();

        if (data && data.session_id !== user.session_id) {
          finalizarSesion();
          setSesionExpulsada(true);
        }
      }
    };

    const interval = setInterval(checkSesion, 5000);
    return () => clearInterval(interval);
  }, []);

  // 2. LÓGICA DE INACTIVIDAD AJUSTADA
  useEffect(() => {
    if (paso === 'selector') {
      const reiniciarTimer = () => {
        if (timerInactividad.current) clearTimeout(timerInactividad.current);
        
        // Convertimos el valor de la DB (que puede venir en minutos o ms)
        // Asumiendo que guardas minutos en la DB, multiplicamos por 60000
        const tiempoLimite = parseInt(config.timer_inactividad) * 60000 || 300000;

        timerInactividad.current = setTimeout(() => {
          finalizarSesion();
          alert("SESIÓN FINALIZADA POR INACTIVIDAD");
        }, tiempoLimite);
      };

      // Eventos que reinician el contador
      window.addEventListener('mousemove', reiniciarTimer);
      window.addEventListener('keydown', reiniciarTimer);
      reiniciarTimer();

      return () => {
        window.removeEventListener('mousemove', reiniciarTimer);
        window.removeEventListener('keydown', reiniciarTimer);
        if (timerInactividad.current) clearTimeout(timerInactividad.current);
      };
    }
  }, [paso, config.timer_inactividad]);

  const finalizarSesion = () => {
    localStorage.removeItem('user_session');
    setTempUser(null);
    setPaso('login');
  };

  const manejarLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSesionExpulsada(false);

    try {
      const { data: empleado, error } = await supabase
        .from('empleados')
        .select('*')
        .or(`documento_id.eq.${identificador},nombre.eq.${identificador}`)
        .eq('pin', pin)
        .eq('activo', true)
        .single();

      if (error || !empleado) {
        alert('Credenciales incorrectas o usuario inactivo');
        return;
      }

      const nuevaSesion = {
        ...empleado,
        session_id: sessionId.current,
        login_time: new Date().getTime()
      };

      await supabase
        .from('empleados')
        .update({ session_id: sessionId.current })
        .eq('id', empleado.id);

      setTempUser(nuevaSesion);
      setPaso('selector');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const irARuta = (ruta: string) => {
    localStorage.setItem('user_session', JSON.stringify(tempUser));
    router.push(ruta);
  };

  if (paso === 'selector') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md space-y-6 animate-in fade-in zoom-in duration-500">
          <header className="text-center mb-10">
            {/* Título dinámico desde la base de datos */}
            <h1 className="text-4xl font-black italic tracking-tighter uppercase">
              {config.empresa_nombre} <span className="text-blue-600">.</span>
            </h1>
            <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.3em] mt-2">
              Panel de Selección de Módulo
            </p>
          </header>

          <div className="bg-slate-900/50 p-8 rounded-[40px] border border-white/5 backdrop-blur-xl shadow-2xl space-y-4">
            <div className="pb-4 border-b border-white/5 mb-4">
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Usuario Activo</p>
              <h2 className="text-xl font-black italic uppercase">{tempUser?.nombre}</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase">
                {tempUser?.rol === 'admin' ? 'Administrador' : tempUser?.rol === 'tecnico' ? 'Soporte Técnico' : 'Operador'}
              </p>
            </div>

            <button 
              onClick={() => irARuta('/presencia')} 
              className="w-full bg-[#1e293b] hover:bg-white hover:text-black p-5 rounded-[22px] font-bold text-md transition-all border border-white/5 text-left pl-8 flex justify-between items-center group"
            >
              📡 Monitoreo de Presencia
              <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
            </button>

            {/* ANÁLISIS Y REPORTES: Acceso para Admin y Técnico */}
            {(tempUser?.rol === 'admin' || tempUser?.rol === 'tecnico' || tempUser?.permiso_reportes) && (
              <button 
                onClick={() => irARuta('/reportes')} 
                className="w-full bg-[#1e293b] hover:bg-amber-600 p-5 rounded-[22px] font-bold text-md transition-all border border-white/5 text-left pl-8"
              >
                📊 Análisis y Reportes
              </button>
            )}

            {/* GESTIÓN ADMINISTRATIVA: Acceso para Admin y Técnico */}
            {(tempUser?.rol === 'admin' || tempUser?.rol === 'tecnico') && (
              <button 
                onClick={() => irARuta('/admin')} 
                className="w-full bg-[#1e293b] hover:bg-blue-600 p-5 rounded-[22px] font-bold text-md transition-all border border-white/5 text-left pl-8"
              >
                ⚙️ Gestión Administrativa
              </button>
            )}

            {/* CONFIGURACIÓN MAESTRA: Solo Técnico */}
            {tempUser?.rol === 'tecnico' && (
              <button 
                onClick={() => irARuta('/configuracion')} 
                className="w-full bg-red-600/10 border border-red-500/20 hover:bg-red-600 text-red-500 hover:text-white p-5 rounded-[22px] font-black text-md transition-all text-left pl-8 group"
              >
                <span className="mr-2 group-hover:animate-spin inline-block">⚙️</span> Configuración Maestra
              </button>
            )}

            <button 
              onClick={finalizarSesion}
              className="w-full mt-4 p-4 text-[10px] font-black uppercase text-slate-500 hover:text-white transition-colors tracking-widest"
            >
              ✕ Finalizar Sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm space-y-10">
        <header className="text-center">
          <h1 className="text-6xl font-black italic tracking-tighter uppercase leading-none">
            {/* Nombre dinámico también en el login principal */}
            {config.empresa_nombre.split(' ')[0]} <span className="text-blue-600 text-7xl">.</span>
          </h1>
          <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.4em] mt-4">Security Access Control</p>
        </header>

        <form onSubmit={manejarLogin} className="space-y-4">
          {sesionExpulsada && (
            <div className="bg-red-600/20 border border-red-500/50 p-4 rounded-2xl text-[10px] font-black uppercase text-red-500 text-center animate-pulse">
              Sesión iniciada en otro dispositivo
            </div>
          )}

          <div className="space-y-2">
            <input
              type="text"
              placeholder="ID / USUARIO"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value.toUpperCase())}
              className="w-full bg-slate-900/50 border border-white/10 p-5 rounded-[22px] text-center font-black text-xl outline-none focus:border-blue-600 focus:bg-slate-900 transition-all placeholder:text-slate-700"
              required
            />
            <input
              type="password"
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full bg-slate-900/50 border border-white/10 p-5 rounded-[22px] text-center font-black text-xl outline-none focus:border-blue-600 focus:bg-slate-900 transition-all placeholder:text-slate-700"
              maxLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black p-5 rounded-[22px] font-black text-[11px] uppercase italic transition-all hover:bg-blue-600 hover:text-white disabled:opacity-50 shadow-[0_20px_40px_rgba(255,255,255,0.1)]"
          >
            {loading ? 'Verificando...' : 'Acceder al Sistema →'}
          </button>
        </form>

        <footer className="text-center pt-10">
          <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest italic">
            {config.empresa_nombre} • Derechos Reservados 2026
          </p>
        </footer>
      </div>
    </div>
  );
}