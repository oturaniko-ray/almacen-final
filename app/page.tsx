'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function LoginPage() {
  const [identificador, setIdentificador] = useState('');
  const [pin, setPin] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    const valorBusqueda = identificador.trim();
    
    // Buscamos al usuario por Documento ID o por Email
    const { data: user, error } = await supabase
      .from('empleados')
      .select('*')
      .or(`documento_id.eq."${valorBusqueda}",email.eq."${valorBusqueda.toLowerCase()}"`)
      .eq('pin_seguridad', pin.trim())
      .single();

    if (error || !user) {
      alert("❌ Credenciales incorrectas.");
      return;
    }

    if (!user.activo) {
      alert("🚫 Usuario inactivo.");
      return;
    }

    const newToken = Math.random().toString(36).substring(2) + Date.now().toString(36);

    // Actualizamos token de sesión única
    await supabase.from('empleados').update({ session_token: newToken }).eq('id', user.id);
    
    // Guardamos la sesión completa incluyendo el ROL exacto de la BD
    localStorage.setItem('user_session', JSON.stringify({ ...user, session_token: newToken }));

    // Redirección basada estrictamente en el ROL de la base de datos
    if (user.rol === 'administrador') {
      router.push('/admin');
    } else if (user.rol === 'supervisor') {
      router.push('/supervisor');
    } else {
      router.push('/empleado');
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex items-center justify-center p-6 text-white font-sans">
      <div className="bg-[#0f172a] p-10 rounded-[45px] border border-white/5 w-full max-w-md shadow-2xl">
        <h1 className="text-3xl font-black text-blue-500 mb-8 text-center italic uppercase tracking-tighter">Acceso Sistema</h1>
        <div className="space-y-4">
          <input 
            type="text" 
            placeholder="ID O EMAIL" 
            className="w-full p-4 bg-[#050a14] rounded-xl text-white outline-none border border-white/5 focus:border-blue-500 transition-all" 
            value={identificador}
            onChange={(e) => setIdentificador(e.target.value)} 
          />
          <input 
            type="password" 
            placeholder="PIN SEGURIDAD" 
            className="w-full p-4 bg-[#050a14] rounded-xl text-white outline-none border border-white/5 focus:border-blue-500 transition-all" 
            value={pin}
            onChange={(e) => setPin(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <button onClick={handleLogin} className="w-full p-4 bg-blue-600 rounded-2xl font-black text-white hover:bg-blue-500 transition-all uppercase italic tracking-widest mt-4">Entrar</button>
        </div>
      </div>
    </main>
  );
}