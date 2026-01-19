'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function LoginPage() {
  const [doc, setDoc] = useState('');
  const [pin, setPin] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    const { data: user, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('documento_id', doc)
      .eq('pin_seguridad', pin)
      .single();

    if (error || !user || !user.activo) {
      alert("Credenciales incorrectas o usuario inactivo");
      return;
    }

    // PUNTO: Crear un Token de Sesión Único (ID aleatorio)
    const newToken = Math.random().toString(36).substring(2) + Date.now().toString(36);

    // Actualizar en la base de datos para cerrar sesiones anteriores
    await supabase.from('empleados').update({ session_token: newToken }).eq('id', user.id);

    // Guardar en localStorage para validar después
    localStorage.setItem('user_session', JSON.stringify({ ...user, session_token: newToken }));

    // Redirección según rol
    if (user.rol === 'administrador') router.push('/admin');
    else if (user.rol === 'supervisor') router.push('/supervisor');
    else router.push('/empleado');
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex items-center justify-center p-6">
      <div className="bg-[#0f172a] p-10 rounded-[40px] border border-white/5 w-full max-w-md shadow-2xl">
        <h1 className="text-3xl font-black text-blue-500 mb-8 text-center italic uppercase tracking-tighter">Acceso Sistema</h1>
        <div className="space-y-4">
          <input type="text" placeholder="DOCUMENTO ID" className="w-full p-4 bg-[#050a14] rounded-xl text-white outline-none border border-white/5 focus:border-blue-500" onChange={(e) => setDoc(e.target.value)} />
          <input type="password" placeholder="PIN SEGURIDAD" className="w-full p-4 bg-[#050a14] rounded-xl text-white outline-none border border-white/5 focus:border-blue-500" onChange={(e) => setPin(e.target.value)} />
          <button onClick={handleLogin} className="w-full p-4 bg-blue-600 rounded-2xl font-black text-white hover:bg-blue-500 transition-all uppercase italic">Entrar</button>
        </div>
      </div>
    </main>
  );
}