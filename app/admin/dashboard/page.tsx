'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [empleadosEnAlmacen, setEmpleadosEnAlmacen] = useState<any[]>([]);
  const [turnosHoy, setTurnosHoy] = useState<any[]>([]);
  const [ausenciasPendientes, setAusenciasPendientes] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) {
      router.replace('/');
      return;
    }
    const currentUser = JSON.parse(sessionData);
    if (Number(currentUser.nivel_acceso) < 4) {
      router.replace('/admin');
      return;
    }
    setUser(currentUser);
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    // Empleados en almacén
    const hoy = new Date().toISOString().split('T')[0];
    const { data: jornadas } = await supabase
      .from('jornadas')
      .select(`
        empleado_id,
        empleados!inner(nombre)
      `)
      .eq('fecha', hoy)
      .is('hora_salida', null);
    setEmpleadosEnAlmacen(jornadas || []);

    // Turnos de hoy
    const { data: asignaciones } = await supabase
      .from('asignaciones_turno')
      .select(`
        empleados!inner(nombre),
        turnos!inner(nombre, hora_inicio, hora_fin)
      `)
      .eq('fecha', hoy);
    setTurnosHoy(asignaciones || []);

    // Ausencias pendientes
    const { data: ausencias } = await supabase
      .from('solicitudes_ausencia')
      .select(`
        empleados!inner(nombre),
        tipo,
        fecha_inicio
      `)
      .eq('estado', 'pendiente')
      .limit(5);
    setAusenciasPendientes(ausencias || []);

    setLoading(false);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-black text-white">DASHBOARD</h1>
          <Link
            href="/admin"
            className="text-blue-500 font-black uppercase text-xs tracking-wider hover:text-blue-400"
          >
            ← VOLVER AL MENÚ
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#1a1a1a] p-6 rounded-xl border border-white/10">
            <h2 className="text-white/60 text-xs font-black mb-2">EN ALMACÉN AHORA</h2>
            <p className="text-4xl font-black text-green-400">{empleadosEnAlmacen.length}</p>
          </div>

          <div className="bg-[#1a1a1a] p-6 rounded-xl border border-white/10">
            <h2 className="text-white/60 text-xs font-black mb-2">TURNOS HOY</h2>
            <p className="text-4xl font-black text-blue-400">{turnosHoy.length}</p>
          </div>

          <div className="bg-[#1a1a1a] p-6 rounded-xl border border-white/10">
            <h2 className="text-white/60 text-xs font-black mb-2">AUSENCIAS PENDIENTES</h2>
            <p className="text-4xl font-black text-yellow-400">{ausenciasPendientes.length}</p>
          </div>
        </div>
      </div>
    </main>
  );
}