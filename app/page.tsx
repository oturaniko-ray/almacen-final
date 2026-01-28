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
  
  const [config, setConfig] = useState<any>({ 
    empresa_nombre: 'CARGANDO...', 
    timer_inactividad: '5' 
  });
  
  const sessionId = useRef(Math.random().toString(36).substring(7));
  const userInputRef = useRef<HTMLInputElement>(null); // Ref para el cursor
  const router = useRouter();
  const timerInactividad = useRef<any>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase.from('sistema_config').select('clave, valor');
      if (data) {
        const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
        setConfig((prev: any) => ({ ...prev, ...cfgMap }));
      }
    };
    fetchConfig();
  }, []);

  // Manejo de inactividad
  useEffect(() => {
    if (paso === 'selector') {
      const reiniciarTimer = () => {
        if (timerInactividad.current) clearTimeout(timerInactividad.current);
        const ms = (parseInt(config.timer_inactividad) || 5) * 60000;
        timerInactividad.current = setTimeout(() => {
          finalizarSesion();
        }, ms);
      };
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
    setIdentificador('');
    setPin('');
  };

  // LÓGICA DE LOGIN REVISADA (Punto 3: documento_id o email)
  const manejarLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Búsqueda por documento_id O email
      const { data: empleado, error } = await supabase
        .from('empleados')
        .select('*')
        .or(`documento_id.eq.${identificador},email.eq.${identificador}`)
        .eq('pin', pin)
        .eq('activo', true)
        .maybeSingle();

      if (error || !empleado) {
        alert('ACCESO DENEGADO: Datos Incorrectos');
        
        // PUNTO 1 y 4: Limpiar campos y posicionar cursor
        setIdentificador('');
        setPin('');
        setLoading(false);
        setTimeout(() => userInputRef.current?.focus(), 100);
        return;
      }

      await supabase
        .from('empleados')
        .update({ session_id: sessionId.current })
        .eq('id', empleado.id);

      setTempUser({ ...empleado, session_id: sessionId.current });
      setPaso('selector');
      setIdentificador('');
      setPin('');

    } catch (err) {
      console.error(err);
      alert('Error de conexión');
      setIdentificador('');
      setPin('');
      userInputRef.current?.focus();
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
        <div className="w-full max-w-md space-y-6">
          <header className="text-center mb-10">
            {/* PUNTO 2: Aumento del 10% (de text-2xl a text-[26.4px]) */}
            <h1 className="text-[26.4px] font-black italic tracking-tighter uppercase leading-none">
              {config.empresa_nombre} <span className="text-blue-600">.</span>
            </h1>
            <p className="text-slate-500 font-bold text-[9px] uppercase tracking-[0.3em] mt-2">Módulos de Control</p>
          </header>

          <div className="bg-slate-900/50 p-8 rounded-[40px] border border-white/5 backdrop-blur-xl shadow-2xl space-y-4">
            <div className="pb-4 border-b border-white/5 mb-4 text-center">
              <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Operador Sistema</p>
              <h2 className="text-xl font-black italic uppercase">{tempUser?.nombre}</h2>
              <p className="text-[9px] text-slate-500 font-bold uppercase">{tempUser?.rol === 'admin' ? 'Administrador' : tempUser?.rol === 'tecnico' ? 'Soporte Técnico' : 'Personal'}</p>
            </div>

            <button onClick={() => irARuta('/presencia')} className="w-full bg-[#1e293b] hover:bg-white hover:text-black p-5 rounded-[22px] font-black text-xs uppercase italic transition-all border border-white/5 text-left pl-8">
              📡 Monitoreo de Presencia
            </button>

            {(tempUser?.rol === 'admin' || tempUser?.rol === 'tecnico') && (
              <>
                <button onClick={() => irARuta('/reportes')} className="w-full bg-[#1e293b] hover:bg-amber-600 p-5 rounded-[22px] font-black text-xs uppercase italic transition-all border border-white/5 text-left pl-8">
                  📊 Análisis y Reportes
                </button>
                <button onClick={() => irARuta('/admin')} className="w-full bg-[#1e293b] hover:bg-blue-600 p-5 rounded-[22px] font-black text-xs uppercase italic transition-all border border-white/5 text-left pl-8">
                  ⚙️ Gestión Administrativa
                </button>
              </>
            )}

            {tempUser?.rol === 'tecnico' && (
              <button onClick={() => irARuta('/configuracion')} className="w-full bg-red-600/10 border border-red-500/20 hover:bg-red-600 text-red-500 hover:text-white p-5 rounded-[22px] font-black text-xs uppercase italic transition-all text-left pl-8">
                🛠️ Configuración Maestra
              </button>
            )}

            <button onClick={finalizarSesion} className="w-full mt-4 p-4 text-[9px] font-black uppercase text-slate-500 hover:text-white transition-colors tracking-widest italic">
              ✕ Cerrar Sesión Segura
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
          <h1 className="text-[26.4px] font-black italic tracking-tighter uppercase leading-none">
            {config.empresa_nombre} <span className="text-blue-600">.</span>
          </h1>
          <p className="text-slate-500 font-bold text-[9px] uppercase tracking-[0.4em] mt-4 italic">Security Access Control</p>
        </header>

        <form onSubmit={manejarLogin} className="space-y-4">
          <div className="space-y-2">
            <input
              ref={userInputRef}
              type="text"
              // PUNTO 5: Cambio de placeholder
              placeholder="DOCUMENTO / EMAIL"
              value={identificador}
              // PUNTO 1: Sin forzar mayúsculas automáticamente
              onChange={(e) => setIdentificador(e.target.value)}
              className="w-full bg-slate-900/50 border border-white/10 p-5 rounded-[22px] text-center font-black text-xl outline-none focus:border-blue-600 focus:bg-slate-900 transition-all placeholder:text-slate-800 italic"
              required
            />
            <input
              type="password"
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full bg-slate-900/50 border border-white/10 p-5 rounded-[22px] text-center font-black text-xl outline-none focus:border-blue-600 focus:bg-slate-900 transition-all placeholder:text-slate-800"
              maxLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            // PUNTO 5: Botón Azul y texto "ENTRAR"
            className="w-full bg-blue-600 text-white p-5 rounded-[22px] font-black text-sm uppercase italic transition-all hover:bg-blue-500 disabled:opacity-50 shadow-[0_20px_40px_rgba(37,99,235,0.2)]"
          >
            {loading ? 'VERIFICANDO...' : 'ENTRAR'}
          </button>
        </form>

        <footer className="text-center pt-10 border-t border-white/5">
          <p className="text-[8px] font-bold text-slate-700 uppercase tracking-[0.5em] italic">
            Powered by {config.empresa_nombre}
          </p>
        </footer>
      </div>
    </div>
  );
}