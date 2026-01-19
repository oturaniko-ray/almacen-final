'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Verificar sesión existente
  useEffect(() => {
    const session = localStorage.getItem('user_session');
    if (session) {
      try {
        setUser(JSON.parse(session));
      } catch (e) {
        localStorage.clear();
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('email', email)
      .eq('pin_seguridad', pin)
      .eq('activo', true)
      .single();

    if (error || !data) {
      alert("Credenciales incorrectas o usuario inactivo");
    } else {
      // Guardamos la sesión completa
      localStorage.setItem('user_session', JSON.stringify(data));
      setUser(data);
    }
    setLoading(false);
  };

  const cerrarSesion = () => {
    localStorage.clear();
    setUser(null);
    router.push('/');
  };

  // PANTALLA DE SELECCIÓN DE ROL (POST-LOGIN)
  if (user) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 w-full max-w-md shadow-2xl text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            {user.nombre[0]}
          </div>
          <h1 className="text-2xl font-bold mb-1">Bienvenido, {user.nombre}</h1>
          <p className="text-slate-500 text-xs mb-8 uppercase tracking-widest">Nivel de Acceso: {user.rol}</p>
          
          <div className="grid gap-4">
            {/* BOTÓN EMPLEADO */}
            <button 
              onClick={() => router.push('/empleado')}
              className="p-5 bg-slate-800 hover:bg-blue-600 rounded-2xl transition-all border border-slate-700 flex items-center justify-between"
            >
              <span className="font-bold">Modo Empleado</span>
              <span>👤</span>
            </button>

            {/* BOTÓN SUPERVISOR */}
            {(user.rol === 'supervisor' || user.rol === 'admin') && (
              <button 
                onClick={() => router.push('/supervisor')}
                className="p-5 bg-slate-800 hover:bg-emerald-600 rounded-2xl transition-all border border-slate-700 flex items-center justify-between"
              >
                <span className="font-bold">Modo Supervisor</span>
                <span>🛡️</span>
              </button>
            )}

            {/* BOTÓN ADMINISTRADOR */}
            {user.rol === 'admin' && (
              <button 
                onClick={() => router.push('/admin')}
                className="p-5 bg-slate-800 hover:bg-purple-600 rounded-2xl transition-all border border-slate-700 flex items-center justify-between"
              >
                <span className="font-bold">Panel Administrativo</span>
                <span>⚙️</span>
              </button>
            )}
          </div>
          
          <button onClick={cerrarSesion} className="mt-10 text-slate-600 text-xs underline">Cerrar Sesión</button>
        </div>
      </main>
    );
  }

  // FORMULARIO DE ACCESO
  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
      <form onSubmit={handleLogin} className="bg-slate-900 p-8 rounded-3xl border border-slate-800 w-full max-w-sm shadow-2xl">
        <h1 className="text-3xl font-bold mb-8 text-center text-blue-500">Sistema Acceso</h1>
        <div className="space-y-4">
          <input 
            type="email" 
            placeholder="Email" 
            className="w-full p-4 bg-slate-950 rounded-xl border border-slate-800 focus:border-blue-500 outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input 
            type="password" 
            placeholder="PIN" 
            className="w-full p-4 bg-slate-950 rounded-xl border border-slate-800 focus:border-blue-500 outline-none"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
          />
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold transition-all shadow-lg"
          >
            {loading ? 'Cargando...' : 'Entrar'}
          </button>
        </div>
      </form>
    </main>
  );
}