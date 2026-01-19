'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [rol, setRol] = useState('empleado');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user_session') || '{}');
    if (user.rol !== 'admin') { router.push('/'); } 
    else { setAuthorized(true); cargarDatos(); }
  }, [router]);

  async function cargarDatos() {
    const { data } = await supabase.from('empleados').select('*').eq('activo', true).order('nombre');
    setEmpleados(data || []);
  }

  async function crearEmpleado(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    
    const { error } = await supabase.from('empleados').insert([{ 
      nombre, cedula_id: cedula, email, pin_seguridad: pin, rol, activo: true 
    }]);

    if (error && error.code === '23505') {
      if (confirm("Esta cédula ya existe. ¿Desea reactivar este perfil con los nuevos datos?")) {
        const { error: upErr } = await supabase.from('empleados')
          .update({ nombre, email, pin_seguridad: pin, rol, activo: true })
          .eq('cedula_id', cedula);
        if (!upErr) { alert("Reactivado con éxito"); limpiar(); }
      }
    } else if (error) {
      alert("Error: " + error.message);
    } else {
      alert("Empleado creado");
      limpiar();
    }
    setCargando(false);
  }

  const limpiar = () => {
    setNombre(''); setCedula(''); setEmail(''); setPin(''); setRol('empleado');
    cargarDatos();
  };

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-blue-500">Gestión de Personal</h1>
        <div className="grid md:grid-cols-2 gap-8">
          <form onSubmit={crearEmpleado} className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
            <input placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} className="w-full bg-slate-800 p-3 rounded" required />
            <input placeholder="Cédula" value={cedula} onChange={e => setCedula(e.target.value)} className="w-full bg-slate-800 p-3 rounded" required />
            <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-800 p-3 rounded" required />
            <input placeholder="PIN" value={pin} onChange={e => setPin(e.target.value)} className="w-full bg-slate-800 p-3 rounded" required />
            <select value={rol} onChange={e => setRol(e.target.value)} className="w-full bg-slate-800 p-3 rounded">
              <option value="empleado">Empleado</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Administrador</option>
            </select>
            <button disabled={cargando} className="w-full bg-blue-600 py-3 rounded font-bold">{cargando ? 'Guardando...' : 'Guardar Empleado'}</button>
          </form>
          
          <div className="space-y-3">
            <h2 className="text-slate-500 font-bold uppercase text-xs">Lista de Personal</h2>
            {empleados.map(emp => (
              <div key={emp.id} className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex justify-between">
                <span>{emp.nombre} <small className="text-blue-500 block text-[10px]">{emp.rol.toUpperCase()}</small></span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}