'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const session = localStorage.getItem('user_session');
    if (session) setUser(JSON.parse(session));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const newSessionId = crypto.randomUUID();

    const { data, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('email', email)
      .eq('pin_seguridad', pin)
      .eq('activo', true)
      .single();

    if (error || !data) {
      alert("Credenciales incorrectas");
    } else {
      // ACTUALIZAR SESSION_ID PARA BLOQUEAR OTROS DISPOSITIVOS
      await supabase.from('empleados').update({ session_id: newSessionId }).eq('id', data.id);
      
      const sessionData = { ...data, session_id: newSessionId };
      localStorage.setItem('user_session', JSON.stringify(sessionData));
      setUser(sessionData);
      // LIMPIEZA DE BUFFER
      setEmail(''); setPin('');
    }
    setLoading(false);
  };

  if (user) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
        <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 w-full max-w-md text-center">
          <h1 className="text-2xl font-bold mb-8">Panel de Acceso</h1>
          <div className="grid gap-4">
            <button onClick={() => router.push('/empleado')} className="p-5 bg-slate-800 hover:bg-blue-600 rounded-2xl transition-all font-bold">Modo Empleado</button>
            {(user.rol === 'supervisor' || user.rol === 'admin') && (
              <button onClick={() => router.push('/supervisor')} className="p-5 bg-slate-800 hover:bg-emerald-600 rounded-2xl transition-all font-bold">Modo Supervisor</button>
            )}
            {user.rol === 'admin' && (
              <button onClick={() => router.push('/admin')} className="p-5 bg-slate-800 hover:bg-purple-600 rounded-2xl transition-all font-bold">Panel Administrativo</button>
            )}
          </div>
          <button onClick={() => { localStorage.clear(); setUser(null); }} className="mt-8 text-slate-500 underline text-xs">Cerrar Sesión</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
      <form onSubmit={handleLogin} className="bg-slate-900 p-8 rounded-3xl border border-slate-800 w-full max-w-sm shadow-2xl">
        <h1 className="text-2xl font-bold mb-6 text-center text-blue-500">Iniciar Sesión</h1>
        <div className="space-y-4">
          <input type="email" placeholder="Email" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-800" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="PIN" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-800" value={pin} onChange={(e) => setPin(e.target.value)} required />
          <button type="submit" disabled={loading} className="w-full bg-blue-600 py-4 rounded-xl font-bold">{loading ? 'Entrando...' : 'Entrar'}</button>
        </div>
      </form>
    </main>
  );
}