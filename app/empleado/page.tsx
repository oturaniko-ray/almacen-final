'use client';
import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function EmpleadoPage() {
  const [user, setUser] = useState<any>(null);
  const [qrValue, setQrValue] = useState('');
  const router = useRouter();

  useEffect(() => {
    const sessionStr = localStorage.getItem('user_session');
    if (!sessionStr) { router.push('/'); return; }
    const session = JSON.parse(sessionStr);

    const verificar = async () => {
      const { data } = await supabase.from('empleados').select('session_token, activo').eq('id', session.id).single();
      if (!data || data.session_token !== session.session_token || !data.activo) {
        localStorage.clear();
        router.push('/');
      }
    };

    verificar();
    setUser(session);
    setQrValue(`${session.documento_id}|${Date.now()}`);
    
    const interval = setInterval(verificar, 20000);
    return () => clearInterval(interval);
  }, [router]);

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      <div className="bg-[#0f172a] p-10 rounded-[45px] border border-white/5 w-full max-w-sm text-center shadow-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-black italic uppercase tracking-tighter">{user.nombre}</h1>
          <p className="text-blue-500 text-[10px] font-black uppercase tracking-[0.3em]">Identificación Digital</p>
        </div>
        
        <div className="bg-white p-5 rounded-[35px] shadow-inner mb-8 inline-block">
          <QRCodeSVG value={qrValue} size={160} level="H" includeMargin={false} />
        </div>

        <div className="py-4 px-6 bg-[#050a14] rounded-2xl border border-white/5 mb-8">
          <p className="text-[9px] text-slate-500 uppercase font-black mb-1">Documento ID</p>
          <p className="font-mono font-bold text-blue-400 text-lg tracking-widest">{user.documento_id}</p>
        </div>

        <button 
          onClick={() => { localStorage.clear(); router.push('/'); }} 
          className="text-slate-600 text-[10px] font-black uppercase hover:text-red-500 transition-colors tracking-widest"
        >
          Cerrar Sesión
        </button>
      </div>
    </main>
  );
}