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
  
  // Identificador único para esta pestaña/instancia
  const sessionId = useRef(Math.random().toString(36).substring(7));
  const router = useRouter();

  // --- CONTROL DE SESIÓN ÚNICA EN TIEMPO REAL ---
  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) return;

    const currentUser = JSON.parse(sessionData);
    setTempUser(currentUser);
    setPaso('selector');

    // Suscribirse al canal de control de sesiones
    const canalSession = supabase.channel('global-session-control');

    canalSession
      .on('broadcast', { event: 'nueva-sesion' }, (payload) => {
        // Si el email coincide pero el ID de sesión es distinto, esta sesión debe morir
        if (payload.payload.userEmail === currentUser.email && payload.payload.sid !== sessionId.current) {
          setSesionExpulsada(true);
          localStorage.removeItem('user_session');
          setTimeout(() => {
            window.location.reload(); // Recarga para limpiar estados
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

      // 1. Lógica de búsqueda original (Email o ID)
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
      
      // GUARDAR SESIÓN LOCAL
      localStorage.setItem('user_session', JSON.stringify(userSession));
      setTempUser(userSession);

      // NOTIFICAR A OTROS DISPOSITIVOS PARA EXPULSARLOS
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

      // 2. Bifurcación original
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

  const irARuta = (ruta: string) => {
    router.push(ruta);
  };

  // Pantalla de bloqueo si se detecta duplicidad
  if (sesionExpulsada) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
        <div className="bg-red-600/10 border-2 border-red-600 p-10 rounded-[45px] shadow-[0_0_50px_rgba(220,38,38,0.2)] animate-pulse">
          <h2 className="text-3xl font-black text-red-500 uppercase italic">Sesión Cerrada</h2>
          <p className="text-white mt-4 font-bold">Se ha iniciado sesión en otro dispositivo.<br/>Cerrando acceso actual...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050a14] flex items-center justify-center p-6 font-sans text-white">
      <div className="w-full max-w-sm bg-[#0f172a] p-10 rounded-[45px] border border-white/5 shadow-2xl relative overflow-hidden transition-all duration-500">
        
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black italic uppercase tracking-tighter">
            SISTEMA <span className="text-blue-500">RAY</span>
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mt-2">
            {paso === 'login' ? 'Control de Almacén' : 'Seleccione el Rol a ejecutar'}
          </p>
        </div>

        {paso === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4 animate-in fade-in duration-500">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase ml-4 text-slate-400">Correo Electrónico</label>
              <input 
                type="text" 
                className="w-full bg-[#050a14] border border-white/5 p-5 rounded-[25px] outline-none focus:border-blue-500 transition-all font-bold"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder="Email o Documento"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase ml-4 text-slate-400">PIN</label>
              <input 
                type="password" 
                className="w-full bg-[#050a14] border border-white/5 p-5 rounded-[25px] outline-none focus:border-blue-500 transition-all text-center text-3xl font-black"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="****"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 p-6 rounded-[25px] font-black uppercase italic mt-6 transition-all shadow-lg">
              {loading ? 'Sincronizando...' : 'Entrar'}
            </button>
          </form>
        ) : (
          <div className="space-y-4 animate-in slide-in-from-bottom duration-500">
            <button onClick={() => irARuta('/empleado')} className="w-full bg-[#1e293b] hover:bg-emerald-600 p-6 rounded-[25px] font-bold text-lg transition-all border border-white/5">
              🏃 Acceso Empleado
            </button>
            
            <button onClick={() => irARuta('/supervisor')} className="w-full bg-[#1e293b] hover:bg-blue-600 p-6 rounded-[25px] font-bold text-lg transition-all border border-white/5">
              🛡️ Panel Supervisor
            </button>

            {(tempUser?.rol === 'admin' || tempUser?.rol === 'administrador') && (
              <button onClick={() => irARuta('/admin')} className="w-full bg-blue-700 hover:bg-blue-500 p-6 rounded-[25px] font-bold text-lg transition-all shadow-xl">
                ⚙️ Consola Admin
              </button>
            )}
            
            <button onClick={() => { localStorage.removeItem('user_session'); setPaso('login'); }} className="w-full p-2 text-[10px] font-black text-slate-500 uppercase mt-4">
              Cerrar Sesión
            </button>
          </div>
        )}
      </div>
    </main>
  );
}