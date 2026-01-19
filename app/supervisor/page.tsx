'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function SupervisorPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [qrData, setQrData] = useState('');
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState({ texto: 'Esperando escaneo...', color: 'text-slate-400' });

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user_session') || '{}');
    if (user.rol === 'supervisor' || user.rol === 'admin') {
      setAuthorized(true);
    } else {
      router.push('/');
    }

    let buffer = "";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        setQrData(buffer);
        setMsg({ texto: "Código detectado. Ingrese PIN.", color: "text-blue-400" });
        buffer = "";
      } else { buffer += e.key; }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const validarAcceso = async () => {
    const { data: emp, error } = await supabase.from('empleados')
      .select('*').eq('cedula_id', qrData).eq('pin_seguridad', pin).single();

    if (error || !emp) {
      setMsg({ texto: "Error: PIN o QR incorrecto", color: "text-red-500" });
    } else {
      await supabase.from('registros_acceso').insert([{ 
        empleado_id: emp.id, nombre_empleado: emp.nombre, tipo_movimiento: 'entrada', fecha_hora: new Date().toISOString() 
      }]);
      setMsg({ texto: `¡Acceso concedido a ${emp.nombre}!`, color: "text-emerald-500" });
      setQrData(''); setPin('');
    }
  };

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
      <div className="bg-slate-900 p-8 rounded-3xl border-2 border-blue-500 w-full max-w-md shadow-2xl text-center">
        <h1 className="text-xl font-bold mb-6 text-blue-400">Escáner de Supervisor</h1>
        <div className={`p-4 mb-6 rounded-xl bg-slate-800 font-bold ${msg.color}`}>{msg.texto}</div>
        {qrData && (
          <div className="space-y-4">
            <input type="password" placeholder="PIN" className="w-full p-4 bg-slate-950 rounded-xl border border-blue-500 text-center text-3xl outline-none" value={pin} onChange={(e) => setPin(e.target.value)} autoFocus />
            <button onClick={validarAcceso} className="w-full bg-blue-600 py-4 rounded-xl font-bold transition-all">Validar Acceso</button>
          </div>
        )}
        <button onClick={() => { localStorage.clear(); router.push('/'); }} className="mt-6 text-slate-500 text-sm underline">Salir</button>
      </div>
    </main>
  );
}