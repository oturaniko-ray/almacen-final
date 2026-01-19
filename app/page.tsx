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

  // Verificar si ya hay una sesión activa al cargar
  useEffect(() => {
    const session = localStorage.getItem('user_session');
    if (session) {
      setUser(JSON.parse(session));
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
      localStorage.setItem('user_session', JSON.stringify(data));
      setUser(data);
    }
    setLoading(false);
  };

  const cerrarSesion = () => {
    localStorage.clear();
    setUser(null);
  };

  // PANTALLA DE SELECCIÓN DE ROL
  if (user) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 w-full max-w-md shadow-2xl text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            {user.nombre[0]}
          </div>
          <h1 className="text-2xl font-bold mb-1">Hola, {user.nombre}</h1>
          <p className="text-slate-500 text-sm mb-8 uppercase tracking-widest font-semibold">¿Cómo deseas acceder?</p>
          
          <div className="grid gap-4">
            {/* OPCIÓN EMPLEADO: Disponible para todos */}
            <button 
              onClick={() => router.push('/empleado')}
              className="p-5 bg-slate-800 hover:bg-blue-600 rounded-2xl transition-all border border-slate-700 flex items-center justify-between group"
            >
              <span className="font-bold">Modo Empleado</span>
              <span className="group-hover:translate-x-1 transition-transform">👤 →</span>
            </button>

            {/* OPCIÓN SUPERVISOR: Solo Supervisor y Admin */}
            {(user.rol === 'supervisor' || user.rol === 'admin') && (
              <button 
                onClick={() => router.push('/supervisor')}
                className="p-5 bg-slate-800 hover:bg-emerald-600 rounded-2xl transition-all border border-slate-700 flex items-center justify-between group"
              >
                <span className="font-bold">Modo Supervisor</span>
                <span className="group-hover:translate-x-1 transition-transform">🛡️ →</span>
              </button>
            )}

            {/* OPCIÓN ADMINISTRADOR: Solo Admin */}
            {user.rol === 'admin' && (
              <button 
                onClick={() => router.push('/admin')}
                className="p-5 bg-slate-800 hover:bg-purple-600 rounded-2xl transition-all border border-slate-700 flex items-center justify-between group"
              >
                <span className="font-bold">Panel de Control</span>
                <span className="group-hover:translate-x-1 transition-transform">⚙️ →</span>
              </button>
            )}
          </div>
          
          <button onClick={cerrarSesion} className="mt-10 text-slate-600 text-xs underline hover:text-red-400">Cerrar Sesión Actual</button>
        </div>
      </main>
    );
  }

  // PANTALLA DE LOGIN
  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
      <form onSubmit={handleLogin} className="bg-slate-900 p-8 rounded-3xl border border-slate-800 w-full max-w-md shadow-2xl">
        <h1 className="text-3xl font-bold mb-8 text-center text-blue-500">Acceso Sistema</h1>
        <div className="space-y-4">
          <input 
            type="email" 
            placeholder="Correo Electrónico" 
            className="w-full p-4 bg-slate-950 rounded-xl border border-slate-800 focus:border-blue-500 outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input 
            type="password" 
            placeholder="PIN de Seguridad" 
            className="w-full p-4 bg-slate-950 rounded-xl border border-slate-800 focus:border-blue-500 outline-none"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
          />
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/40"
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </div>
      </form>
    </main>
  );
}