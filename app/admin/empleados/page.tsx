'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function GestionEmpleadosPage() {
  const [user, setUser] = useState<any>(null);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [sesionDuplicada, setSesionDuplicada] = useState(false);
  
  const sessionId = useRef(Math.random().toString(36).substring(7));
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.push('/'); return; }
    const currentUser = JSON.parse(sessionData);
    if (!['admin', 'administrador'].includes(currentUser.rol)) { router.push('/'); return; }
    setUser(currentUser);

    const canalSesion = supabase.channel('gestion-session-control');
    canalSesion
      .on('broadcast', { event: 'nueva-sesion' }, (payload) => {
        if (payload.payload.email === currentUser.email && payload.payload.id !== sessionId.current) {
          setSesionDuplicada(true);
          setTimeout(() => { localStorage.removeItem('user_session'); router.push('/'); }, 3000);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await canalSesion.send({ type: 'broadcast', event: 'nueva-sesion', payload: { id: sessionId.current, email: currentUser.email } });
        }
      });

    cargarEmpleados();
    return () => { supabase.removeChannel(canalSesion); };
  }, [router]);

  const cargarEmpleados = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
    if (!error) setEmpleados(data || []);
    setLoading(false);
  };

  // 🔴 RUTINA DE SEGURIDAD: Bloqueo de cambio de estado si está en almacén
  const toggleEstado = async (id: string, estadoActual: boolean, enAlmacen: boolean, nombre: string) => {
    if (enAlmacen && estadoActual === true) {
      alert(`⚠️ ACCIÓN BLOQUEADA: ${nombre} se encuentra actualmente dentro del almacén. Debe registrar su salida antes de ser desactivado.`);
      return;
    }

    const { error } = await supabase
      .from('empleados')
      .update({ activo: !estadoActual })
      .eq('id', id);

    if (error) {
      alert("Error al actualizar estado");
    } else {
      setEmpleados(empleados.map(e => e.id === id ? { ...e, activo: !estadoActual } : e));
    }
  };

  const filtrarEmpleados = empleados.filter(e => 
    e.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
    e.documento_id.includes(busqueda)
  );

  if (sesionDuplicada) {
    return (
      <main className="h-screen bg-black flex items-center justify-center p-10 text-center text-white">
        <div className="bg-red-600/20 border-2 border-red-600 p-10 rounded-[40px] animate-pulse">
          <h2 className="text-4xl font-black text-red-500 mb-4 uppercase italic">Sesión Duplicada</h2>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter">
              GESTIÓN DE <span className="text-blue-500">PERSONAL</span>
            </h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2">Panel de Control Administrativo RAY</p>
          </div>
          
          <div className="flex gap-4 w-full md:w-auto">
            <input 
              type="text" 
              placeholder="BUSCAR POR NOMBRE O ID..." 
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="bg-[#0f172a] border border-white/5 px-6 py-4 rounded-2xl text-xs font-bold w-full md:w-64 outline-none focus:border-blue-500 transition-all"
            />
            <button onClick={() => router.push('/admin')} className="bg-slate-800 hover:bg-slate-700 px-8 py-4 rounded-2xl font-black text-xs uppercase transition-all">Volver</button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center animate-pulse text-slate-500 font-black uppercase tracking-widest italic">Cargando base de datos...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtrarEmpleados.map((emp) => (
              <div key={emp.id} className={`bg-[#0f172a] p-8 rounded-[40px] border transition-all duration-500 ${emp.activo ? 'border-white/5' : 'border-red-900/30 opacity-60'}`}>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-black uppercase italic leading-none mb-1">{emp.nombre}</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{emp.rol}</p>
                  </div>
                  {emp.en_almacen && (
                    <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-[8px] font-black uppercase animate-pulse">
                      ● En Almacén
                    </span>
                  )}
                </div>

                <div className="space-y-3 mb-8">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500 font-bold uppercase">Documento</span>
                    <span className="font-mono">{emp.documento_id}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500 font-bold uppercase">Estado</span>
                    <span className={`font-black uppercase ${emp.activo ? 'text-blue-500' : 'text-red-500'}`}>
                      {emp.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-white/5">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Acceso al Sistema</span>
                  <button 
                    onClick={() => toggleEstado(emp.id, emp.activo, emp.en_almacen, emp.nombre)}
                    className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${emp.activo ? 'bg-blue-600' : 'bg-slate-800'}`}
                  >
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${emp.activo ? 'left-8' : 'left-1'}`} />
                  </button>
                </div>
                
                {emp.en_almacen && (
                   <p className="text-[8px] text-red-500/60 font-bold uppercase mt-4 text-center italic">
                     Bloqueado: Personal dentro del área
                   </p>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && filtrarEmpleados.length === 0 && (
          <div className="py-20 text-center text-slate-600 font-black uppercase tracking-widest">No se encontraron registros</div>
        )}

      </div>
    </main>
  );
}