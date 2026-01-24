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
  
  const sessionId = useRef(Math.random().toString(36).substring(7));
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) return;

    const currentUser = JSON.parse(sessionData);
    setTempUser(currentUser);
    setPaso('selector');

    const canalSession = supabase.channel('global-session-control');
    canalSession
      .on('broadcast', { event: 'nueva-sesion' }, (payload) => {
        if (payload.payload.userEmail === currentUser.email && payload.payload.sid !== sessionId.current) {
          setSesionExpulsada(true);
          localStorage.removeItem('user_session');
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canalSession);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const entrada = identificador.trim();
      const pinLimpio = pin.trim();
      const esEmail = entrada.includes('@');
      let empleadoData = null;

      if (esEmail) {
        const { data: directo } = await supabase.from('empleados').select('*').eq('email', entrada).eq('pin_seguridad', pinLimpio).maybeSingle();
        if (directo) {
          empleadoData = directo;
        } else {
          const { data: perfil } = await supabase.from('profiles').select('id').eq('email', entrada).maybeSingle();
          if (perfil) {
            const { data: relacional } = await supabase.from('empleados').select('*').eq('id', perfil.id).eq('pin_seguridad', pinLimpio).maybeSingle();
            empleadoData = relacional;
          }
        }
      } else {
        const { data: documento } = await supabase.from('empleados').select('*').eq('documento_id', entrada).eq('pin_seguridad', pinLimpio).maybeSingle();
        empleadoData = documento;
      }

      if (!empleadoData) {
        alert("Credenciales incorrectas.");
        setLoading(false);
        return;
      }

      if (!empleadoData.activo) {
        alert("Usuario inactivo.");
        setLoading(false);
        return;
      }

      const rolLimpio = empleadoData.rol?.toLowerCase().trim();
      const userSession = { ...empleadoData, rol: rolLimpio };
      
      localStorage.setItem('user_session', JSON.stringify(userSession));
      setTempUser(userSession);

      const canalSession = supabase.channel('global-session-control');
      await canalSession.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await canalSession.send({
            type: 'broadcast',
            event: 'nueva-sesion',
            payload: { sid: sessionId.current, userEmail: userSession.email },
          });
        }
      });

      if (rolLimpio === 'admin' || rolLimpio === 'administrador' || rolLimpio === 'supervisor') {
        setPaso('selector');
      } else {
        router.push('/empleado');
      }

    } catch (err) {
      alert("Error de conexión.");
    } finally {
      setLoading(false);
    }
  };

  // Función de navegación optimizada
  const irARuta = (ruta: string) => {
    router.replace(ruta); // Usamos replace para evitar que el historial mantenga el bucle
  };

  if (sesionExpulsada) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center p-6 text-center text-white">
        <div className="bg-red-600/10 border-2 border-red-600 p-10 rounded-[45px] animate-pulse">
          <h2 className="text-3xl font-black text-red-500 uppercase italic">Sesión Cerrada</h2>
          <p className="mt-4">Iniciada en otro dispositivo.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050a14] flex items-center justify-center p-6 font-sans text-white">
      <div className="w-full max-w-[360px] bg-[#0f172a] p-8 rounded-[45px] border border-white/5 shadow-2xl relative overflow-hidden transition-all duration-500">
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black italic uppercase tracking-tighter">
            SISTEMA <span className="text-blue-500">RAY</span>
          </h1>
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500 mt-2">
            {paso === 'login' ? 'GESTIÓN DE ALMACÉN' : 'SELECCIONE EL ROL'}
          </p>
        </div>

        {paso === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4 animate-in fade-in duration-500">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase ml-4 text-slate-400">Identificador</label>
              <input 
                type="text" 
                className="w-full bg-[#050a14] border border-white/5 p-4 rounded-[22px] outline-none focus:border-blue-500 transition-all font-bold text-sm"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder="Email o DNI"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase ml-4 text-slate-400">PIN de Seguridad</label>
              <input 
                type="password" 
                className="w-full bg-[#050a14] border border-white/5 p-4 rounded-[22px] outline-none focus:border-blue-500 transition-all text-center text-2xl font-black"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="****"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 p-5 rounded-[22px] font-black uppercase italic mt-4 transition-all shadow-lg text-sm">
              {loading ? 'Validando...' : 'Entrar'}
            </button>
          </form>
        ) : (
          <div className="space-y-3 animate-in slide-in-from-bottom duration-500">
            <button onClick={() => irARuta('/empleado')} className="w-full bg-[#1e293b] hover:bg-emerald-600 p-5 rounded-[22px] font-bold text-md transition-all border border-white/5 text-left pl-8">
              🏃 Acceso Empleado
            </button>
            
            <button onClick={() => irARuta('/supervisor')} className="w-full bg-[#1e293b] hover:bg-blue-600 p-5 rounded-[22px] font-bold text-md transition-all border border-white/5 text-left pl-8">
              🛡️ Panel Supervisor
            </button>

            {(tempUser?.rol === 'admin' || tempUser?.rol === 'administrador' || tempUser?.rol === 'supervisor') && (
              <button onClick={() => irARuta('/reportes')} className="w-full bg-[#1e293b] hover:bg-amber-600 p-5 rounded-[22px] font-bold text-md transition-all border border-white/5 text-left pl-8">
                📊 Reportes Operación
              </button>
            )}

            {(tempUser?.rol === 'admin' || tempUser?.rol === 'administrador') && (
              <button onClick={() => irARuta('/admin')} className="w-full bg-blue-700 hover:bg-blue-500 p-5 rounded-[22px] font-bold text-md transition-all shadow-xl text-left pl-8">
                ⚙️ Consola Admin
              </button>
            )}
            
            <button onClick={() => { localStorage.removeItem('user_session'); setPaso('login'); setTempUser(null); }} className="w-full p-2 text-[9px] font-black text-slate-500 uppercase mt-4 hover:text-white transition-colors">
              Cerrar Sesión
            </button>
          </div>
        )}
      </div>
    </main>
  );
}