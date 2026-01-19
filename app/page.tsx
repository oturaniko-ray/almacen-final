'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { QRCodeSVG } from 'qrcode.react';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function EmployeeLoginPage() {
  const [loggedUser, setLoggedUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [cedula, setCedula] = useState(''); // Usada como contraseña

  const handleLogin = async () => {
    // Para simplificar sin configurar Supabase Auth de inmediato, 
    // validaremos contra la tabla de empleados directamente
    const { data, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('email', email)
      .eq('cedula_id', cedula)
      .eq('activo', true)
      .single();

    if (error || !data) {
      alert("Credenciales incorrectas o usuario no activo");
    } else {
      setLoggedUser(data);
    }
  };

  if (!loggedUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
        <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 w-full max-w-sm text-center">
          <h2 className="text-2xl font-bold mb-6">Acceso Almacén</h2>
          <input type="email" placeholder="Email Registrado" onChange={e => setEmail(e.target.value)} className="w-full p-3 mb-4 bg-slate-800 rounded border border-slate-700" />
          <input type="password" placeholder="Contraseña (Cédula)" onChange={e => setCedula(e.target.value)} className="w-full p-3 mb-6 bg-slate-800 rounded border border-slate-700" />
          <button onClick={handleLogin} className="w-full bg-blue-600 py-3 rounded-lg font-bold">Ingresar</button>
        </div>
      </div>
    );
  }

  // Si ya ingresó, muestra su QR personal
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
      <h1 className="text-xl font-bold mb-2">Bienvenido, {loggedUser.nombre}</h1>
      <p className="text-slate-400 mb-8 text-sm">Muestra este código al supervisor</p>
      
      <div className="bg-white p-4 rounded-xl">
        <QRCodeSVG value={loggedUser.cedula_id} size={250} />
      </div>
      
      <button onClick={() => setLoggedUser(null)} className="mt-10 text-slate-500 text-sm underline">
        Cerrar Sesión
      </button>
    </div>
  );
}