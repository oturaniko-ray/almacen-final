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
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase
      .from('empleados')
      .select('*')
      .or(`email.eq.${identificador},documento_id.eq.${identificador}`)
      .eq('pin_seguridad', pin)
      .single();

    if (data) {
      if (!data.activo) { alert('USUARIO INACTIVO'); setLoading(false); return; }
      setTempUser(data);
      localStorage.setItem('user_session', JSON.stringify(data));
      setPaso('selector');
    } else {
      alert('CREDENCIALES INCORRECTAS');
    }
    setLoading(false);
  };

  if (paso === 'selector') {
    return (
      <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="w-full max-w-md space-y-4">
          <header className="text-center mb-10">
            <h1 className="text-5xl font-black uppercase tracking-tighter">
              CONTROL DE <span className="text-blue-500">ACCESO</span>
            </h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-4">BIENVENIDO: {tempUser?.nombre}</p>
          </header>
          
          <button onClick={() => router.push('/empleado')} className="w-full bg-[#0f172a] hover:bg-blue-600 p-6 rounded-[25px] font-black text-sm uppercase tracking-widest border border-white/5 transition-all text-left px-10">
            🏃 ACCESO EMPLEADO
          </button>
          
          <button onClick={() => router.push('/supervisor')} className="w-full bg-[#0f172a] hover:bg-blue-600 p-6 rounded-[25px] font-black text-sm uppercase tracking-widest border border-white/5 transition-all text-left px-10">
            🛡️ PANEL SUPERVISOR
          </button>

          {['admin', 'administrador', 'supervisor'].includes(tempUser?.rol) && (
            <button onClick={() => router.push('/reportes')} className="w-full bg-[#0f172a] hover:bg-blue-600 p-6 rounded-[25px] font-black text-sm uppercase tracking-widest border border-white/5 transition-all text-left px-10">
              📊 REPORTES OPERACIÓN
            </button>
          )}

          {['admin', 'administrador'].includes(tempUser?.rol) && (
            <button onClick={() => router.push('/admin')} className="w-full bg-blue-600 hover:bg-blue-500 p-6 rounded-[25px] font-black text-sm uppercase tracking-widest transition-all text-left px-10 shadow-xl">
              ⚙️ CONSOLA ADMIN
            </button>
          )}
          
          <button onClick={() => { localStorage.removeItem('user_session'); setPaso('login'); }} className="w-full py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">
            SALIR DEL SISTEMA
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050a14] flex items-center justify-center p-6 text-white font-sans">
      <div className="w-full max-w-sm">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-black uppercase tracking-tighter">
            SISTEMA <span className="text-blue-500">LOGIN</span>
          </h1>
        </header>
        <form onSubmit={handleLogin} className="space-y-4">
          <input className="w-full bg-[#0f172a] p-5 rounded-[22px] border border-white/10 font-black uppercase text-xs tracking-widest outline-none focus:border-blue-500 transition-all" placeholder="ID O CORREO" value={identificador} onChange={(e) => setIdentificador(e.target.value)} required />
          <input type="password" className="w-full bg-[#0f172a] p-5 rounded-[22px] border border-white/10 font-black uppercase text-xs tracking-widest outline-none focus:border-blue-500 transition-all" placeholder="PIN SEGURIDAD" value={pin} onChange={(e) => setPin(e.target.value)} required />
          <button type="submit" disabled={loading} className="w-full bg-blue-600 py-5 rounded-[22px] font-black uppercase tracking-widest shadow-lg hover:bg-blue-500 transition-all">
            {loading ? 'VALIDANDO...' : 'ENTRAR'}
          </button>
        </form>
      </div>
    </main>
  );
}