'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function LoginPage() {
  const [identificador, setIdentificador] = useState(''); // Soporta ID o Email
  const [pin, setPin] = useState('');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // 1. PERSISTENCIA DE SESIÓN Y VALIDACIÓN DE TOKEN ÚNICO
  useEffect(() => {
    const verificarSesionLocal = async () => {
      const sessionStr = localStorage.getItem('user_session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        
        // Verificamos en tiempo real si el token sigue siendo válido en la BD
        const { data } = await supabase
          .from('empleados')
          .select('session_token, activo')
          .eq('id', session.id)
          .single();

        if (data && data.session_token === session.session_token && data.activo) {
          setUser(session);
        } else {
          localStorage.clear();
          setUser(null);
        }
      }
    };
    verificarSesionLocal();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Limpiamos el identificador de posibles caracteres basura del escáner (ScrollLock, etc)
    const valorLimpio = identificador.replace(/(ScrollLock|AltGraph|Control|Shift|CapsLock|Alt|Meta|Tab)/gi, "").trim();
    const pinLimpio = pin.trim();

    // 2. BÚSQUEDA FLEXIBLE (ID O EMAIL)
    const { data, error } = await supabase
      .from('empleados')
      .select('*')
      .or(`documento_id.eq."${valorLimpio}",email.eq."${valorLimpio.toLowerCase()}"`)
      .eq('pin_seguridad', pinLimpio)
      .eq('activo', true)
      .single();

    if (error || !data) {
      alert("❌ Credenciales incorrectas o usuario inactivo");
    } else {
      // 3. GENERACIÓN DE TOKEN PARA SESIÓN ÚNICA
      const newToken = crypto.randomUUID();
      
      const { error: updateError } = await supabase
        .from('empleados')
        .update({ session_token: newToken })
        .eq('id', data.id);

      if (!updateError) {
        const sessionData = { ...data, session_token: newToken };
        localStorage.setItem('user_session', JSON.stringify(sessionData));
        setUser(sessionData);
        setIdentificador(''); 
        setPin('');
      } else {
        alert("Error al sincronizar sesión");
      }
    }
    setLoading(false);
  };

  // VISTA: MENÚ DE SELECCIÓN (Tu estructura original)
  if (user) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 w-full max-w-md text-center shadow-2xl">
          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 font-black text-2xl shadow-lg shadow-blue-900/20">
            {user.nombre ? user.nombre[0].toUpperCase() : 'U'}
          </div>
          <h1 className="text-2xl font-black mb-2 italic uppercase tracking-tighter">Bienvenido</h1>
          <p className="text-slate-400 mb-8 font-bold">{user.nombre}</p>
          
          <div className="grid gap-4">
            <button 
              onClick={() => router.push('/empleado')} 
              className="p-5 bg-slate-800 hover:bg-blue-600 rounded-2xl transition-all font-bold border border-slate-700 uppercase italic text-sm tracking-widest"
            >
              👤 Modo Empleado
            </button>

            {(user.rol === 'supervisor' || user.rol === 'admin') && (
              <button 
                onClick={() => router.push('/supervisor')} 
                className="p-5 bg-slate-800 hover:bg-emerald-600 rounded-2xl transition-all font-bold border border-slate-700 uppercase italic text-sm tracking-widest"
              >
                🛡️ Modo Supervisor
              </button>
            )}

            {(user.rol === 'admin') && (
              <button 
                onClick={() => router.push('/admin')} 
                className="p-5 bg-slate-800 hover:bg-purple-600 rounded-2xl transition-all font-bold border border-slate-700 uppercase italic text-sm tracking-widest"
              >
                ⚙️ Panel Administrativo
              </button>
            )}
          </div>

          <button 
            onClick={() => { localStorage.clear(); setUser(null); }} 
            className="mt-8 text-slate-500 hover:text-red-400 transition-colors font-bold uppercase text-[10px] tracking-[0.2em]"
          >
            Cerrar Sesión
          </button>
        </div>
      </main>
    );
  }

  // VISTA: FORMULARIO DE ACCESO
  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white font-sans">
      <form onSubmit={handleLogin} className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 w-full max-w-sm shadow-2xl">
        <h1 className="text-2xl font-black mb-8 text-center text-blue-500 italic uppercase tracking-tighter">Acceso al Sistema</h1>
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-500 font-bold uppercase ml-2">ID o Correo</p>
            <input 
              type="text" 
              placeholder="Ej: 12345678" 
              className="w-full p-4 bg-slate-950 rounded-xl border border-slate-800 focus:border-blue-500 outline-none transition-all" 
              value={identificador} 
              onChange={(e) => setIdentificador(e.target.value)} 
              required 
            />
          </div>

          <div className="space-y-1">
            <p className="text-[10px] text-slate-500 font-bold uppercase ml-2">PIN de Seguridad</p>
            <input 
              type="password" 
              placeholder="****" 
              className="w-full p-4 bg-slate-950 rounded-xl border border-slate-800 focus:border-blue-500 outline-none transition-all" 
              value={pin} 
              onChange={(e) => setPin(e.target.value)} 
              required 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-blue-600 py-4 rounded-2xl font-black hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20 uppercase italic tracking-widest mt-4"
          >
            {loading ? 'Verificando...' : 'ENTRAR'}
          </button>
        </div>
      </form>
    </main>
  );
}