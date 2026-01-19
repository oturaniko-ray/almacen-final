'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function EmpleadoPage() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const session = localStorage.getItem('user_session');
    if (session) {
      setUser(JSON.parse(session));
    } else {
      router.push('/');
    }
  }, [router]);

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white">
      {/* Botón Volver al Menú Principal */}
      <button 
        onClick={() => router.push('/')}
        className="absolute top-8 left-8 bg-[#1e293b] hover:bg-[#2d3a4f] px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest border border-white/10 transition-all"
      >
        ← Volver
      </button>

      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-sm shadow-2xl border border-white/5 text-center">
        <h1 className="text-2xl font-black mb-2 text-[#3b82f6] uppercase tracking-tighter">Mi Carnet Digital</h1>
        <p className="text-slate-500 text-sm mb-8 font-bold">{user.nombre}</p>

        <div className="bg-white p-6 rounded-[30px] inline-block mb-8 shadow-inner">
          {/* CORRECCIÓN: Usamos documento_id para evitar el undefined */}
          <QRCodeSVG 
            value={user.documento_id || "ID_NO_DISPONIBLE"} 
            size={200}
            level="H"
          />
        </div>

        <div className="space-y-2">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Documento de Identidad</p>
          <p className="text-xl font-mono font-black text-white">{user.documento_id}</p>
        </div>
      </div>
    </main>
  );
}