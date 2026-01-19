'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [rol, setRol] = useState('empleado');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user_session') || '{}');
    if (user.rol !== 'admin') {
      router.push('/');
    } else {
      setAuthorized(true);
      cargarDatos();
    }
  }, []);

  async function cargarDatos() {
    const { data: emps } = await supabase.from('empleados').select('*').eq('activo', true);
    const { data: lg } = await supabase.from('registros_acceso').select('*').order('fecha_hora', { ascending: false });
    setEmpleados(emps || []);
    setLogs(lg || []);
  }

  async function crearEmpleado(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    const { error } = await supabase.from('empleados').insert([{ nombre, cedula_id: cedula, email, pin_seguridad: pin, rol, activo: true }]);
    if (error) alert(error.message);
    else {
      alert("Registrado");
      setNombre(''); setCedula(''); setEmail(''); setPin('');
      cargarDatos();
    }
    setCargando(false);
  }

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-blue-500">Panel Maestro</h1>
          <button onClick={() => { localStorage.clear(); router.push('/'); }} className="text-red-400 underline">Cerrar Sesión</button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Formulario */}
          <section className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-xl mb-4 text-blue-400">Registrar Personal</h2>
            <form onSubmit={crearEmpleado} className="space-y-4">
              <input placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} className="w-full bg-slate-800 p-3 rounded" required />
              <input placeholder="Cédula" value={cedula} onChange={e => setCedula(e.target.value)} className="w-full bg-slate-800 p-3 rounded" required />
              <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-800 p-3 rounded" required />
              <input placeholder="PIN" value={pin} onChange={e => setPin(e.target.value)} className="w-full bg-slate-800 p-3 rounded" required />
              <select value={rol} onChange={e => setRol(e.target.value)} className="w-full bg-slate-800 p-3 rounded">
                <option value="empleado">Empleado</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
              <button disabled={cargando} className="w-full bg-blue-600 py-3 rounded font-bold">{cargando ? 'Guardando...' : 'Crear'}</button>
            </form>
          </section>

          {/* Lista e Historial (Simplificado para el ejemplo) */}
          <section className="lg:col-span-2 bg-slate-900 p-6 rounded-2xl border border-slate-800">
             <h2 className="text-xl mb-4 text-emerald-400">Historial</h2>
             <div className="text-sm text-slate-400 italic">Datos cargados: {logs.length} registros.</div>
          </section>
        </div>
      </div>
    </main>
  );
}