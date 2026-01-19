'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AdminPage() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [email, setEmail] = useState(''); // Nuevo
  const [pin, setPin] = useState('');
  const [rol, setRol] = useState('empleado'); // Nuevo

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    const { data } = await supabase.from('empleados').select('*').eq('activo', true);
    setEmpleados(data || []);
  }

  async function crearEmpleado(e: React.FormEvent) {
    e.preventDefault();
    // Insertamos incluyendo email y rol
    const { error } = await supabase.from('empleados').insert([
      { nombre, cedula_id: cedula, email, pin_seguridad: pin, rol, activo: true }
    ]);
    
    if (error) alert(error.message);
    else {
      setNombre(''); setCedula(''); setEmail(''); setPin('');
      cargarDatos();
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-4xl mx-auto bg-slate-900 p-6 rounded-2xl border border-slate-800">
        <h1 className="text-2xl font-bold mb-6 text-blue-500">Gestión de Personal y Roles</h1>
        
        <form onSubmit={crearEmpleado} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} className="bg-slate-800 p-3 rounded" required />
          <input placeholder="Cédula (Será su contraseña)" value={cedula} onChange={e => setCedula(e.target.value)} className="bg-slate-800 p-3 rounded" required />
          <input type="email" placeholder="Correo Electrónico" value={email} onChange={e => setEmail(e.target.value)} className="bg-slate-800 p-3 rounded" required />
          <input placeholder="PIN de Seguridad" value={pin} onChange={e => setPin(e.target.value)} className="bg-slate-800 p-3 rounded" required />
          
          <select value={rol} onChange={e => setRol(e.target.value)} className="bg-slate-800 p-3 rounded text-white md:col-span-2">
            <option value="empleado">Rol: Empleado (Genera QR)</option>
            <option value="supervisor">Rol: Supervisor (Escanea)</option>
            <option value="admin">Rol: Administrador (Reportes)</option>
          </select>

          <button className="md:col-span-2 bg-blue-600 py-3 rounded font-bold hover:bg-blue-700">Registrar y Asignar Rol</button>
        </form>
      </div>
    </main>
  );
}