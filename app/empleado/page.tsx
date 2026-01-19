'use client';
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function EmpleadoPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const session = JSON.parse(localStorage.getItem('user_session') || '{}');
    if (!session.id) window.location.href = '/';
    setUser(session);
  }, []);

  if (!user) return null;

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
      <h1 className="text-2xl font-bold mb-4">Mi QR de Acceso</h1>
      <p className="text-slate-400 mb-8">{user.nombre} ({user.rol})</p>
      <div className="bg-white p-6 rounded-3xl">
        <QRCodeSVG value={user.cedula_id} size={250} />
      </div>
      <button onClick={() => { localStorage.clear(); window.location.href='/'; }} className="mt-10 text-red-500 underline">Cerrar Sesión</button>
    </main>
  );
}