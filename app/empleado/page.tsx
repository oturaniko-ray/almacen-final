'use client';
import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useRouter } from 'next/navigation';

export default function EmpleadoPage() {
  const [user, setUser] = useState<any>(null);
  const [qrValue, setQrValue] = useState('');
  const router = useRouter();

  useEffect(() => {
    const sessionStr = localStorage.getItem('user_session');
    if (!sessionStr) { router.push('/'); return; }
    const session = JSON.parse(sessionStr);
    setUser(session);
    setQrValue(`${session.documento_id}|${new Date().getTime()}`);
  }, [router]);

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white">
      <div className="bg-[#0f172a] p-10 rounded-[45px] border border-white/5 w-full max-w-sm text-center shadow-2xl">
        <h1 className="text-2xl font-black mb-2 italic uppercase tracking-tighter">{user.nombre}</h1>
        <p className="text-slate-500 text-[10px] mb-8 uppercase tracking-widest font-bold">Identificación Digital</p>
        
        {/* Tamaño reducido un 20%: de 200 a 160 */}
        <div className="bg-white p-4 rounded-[30px] shadow-inner mb-8 inline-block">
          <QRCodeSVG value={qrValue} size={160} level="H" />
        </div>

        <div className="py-4 px-6 bg-[#050a14] rounded-2xl border border-white/5 mb-6">
          <p className="text-[9px] text-slate-500 uppercase font-black mb-1 tracking-tighter">ID Documento</p>
          <p className="font-mono font-bold text-blue-400 text-lg">{user.documento_id}</p>
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