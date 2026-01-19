'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'login' | 'select'>('login');
  const router = useRouter();

  // Simulación de persistencia de sesión
  useEffect(() => {
    const session = localStorage.getItem('user_session');
    if (session) {
      setUser(JSON.parse(session));
      setView('select');
    }
  }, []);

  const handleAccess = (path: string) => {
    router.push(path);
  };

  if (view === 'select' && user) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 w-full max-w-md shadow-2xl text-center">
          <h1 className="text-2xl font-bold mb-2">Bienvenido, {user.nombre}</h1>
          <p className="text-slate-500 text-sm mb-8">Seleccione su modo de acceso</p>
          
          <div className="grid gap-4">
            {/* Botón común para todos */}
            <button onClick={() => handleAccess('/empleado')} className="p-4 bg-slate-800 hover:bg-blue-600 rounded-xl transition-all font-bold">
              👤 Acceso como Empleado
            </button>

            {/* Solo para Supervisores y Admins */}
            {(user.rol === 'supervisor' || user.rol === 'admin') && (
              <button onClick={() => handleAccess('/supervisor')} className="p-4 bg-slate-800 hover:bg-emerald-600 rounded-xl transition-all font-bold">
                🛡️ Acceso como Supervisor
              </button>
            )}

            {/* Solo para Admins */}
            {user.rol === 'admin' && (
              <button onClick={() => handleAccess('/admin')} className="p-4 bg-slate-800 hover:bg-purple-600 rounded-xl transition-all font-bold">
                ⚙️ Panel de Administrador
              </button>
            )}
          </div>
          
          <button onClick={() => { localStorage.clear(); setView('login'); }} className="mt-8 text-slate-600 text-xs underline">Cerrar Sesión</button>
        </div>
      </main>
    );
  }

  // Aquí iría tu formulario de login actual...
  return <div>Formulario de Login Original</div>;
}

'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Buscamos al usuario en la tabla empleados
    const { data: user, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('email', email)
      .eq('cedula_id', password) // Usamos la cédula como pass
      .eq('activo', true)
      .single();

    if (error || !user) {
      alert("Acceso denegado: Credenciales incorrectas");
      return;
    }

    // Guardamos la sesión localmente (forma básica)
    localStorage.setItem('user_session', JSON.stringify(user));

    // Redirección lógica por ROL
    if (user.rol === 'admin') router.push('/admin');
    else if (user.rol === 'supervisor') router.push('/supervisor');
    else router.push('/empleado');
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
      <form onSubmit={handleLogin} className="bg-slate-900 p-8 rounded-2xl border border-slate-800 w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-500">Sistema Almacén</h2>
        <input type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} className="w-full p-3 mb-4 bg-slate-800 rounded border border-slate-700" required />
        <input type="password" placeholder="Cédula" onChange={e => setPassword(e.target.value)} className="w-full p-3 mb-6 bg-slate-800 rounded border border-slate-700" required />
        <button type="submit" className="w-full bg-blue-600 py-3 rounded-lg font-bold hover:bg-blue-500 transition-all">Entrar</button>
      </form>
    </main>
  );
}
