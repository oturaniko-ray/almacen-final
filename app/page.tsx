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
