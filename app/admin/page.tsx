'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AdminPanel() {
  const [vista, setVista] = useState<'menu' | 'empleados' | 'movimientos'>('menu');
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [editando, setEditando] = useState<any>(null);
  const [nuevo, setNuevo] = useState({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado' });
  const router = useRouter();

  useEffect(() => {
    fetchEmpleados();
    fetchMovimientos();

    const canalRealtime = supabase
      .channel('admin-live')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'empleados' }, 
        (payload) => {
          setEmpleados(current => 
            current.map(emp => emp.id === payload.new.id ? { ...emp, ...payload.new } : emp)
          );
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'registros_acceso' },
        () => { fetchMovimientos(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(canalRealtime); };
  }, []);

  async function fetchEmpleados() {
    const { data } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
    if (data) setEmpleados(data);
  }

  async function fetchMovimientos() {
    const { data } = await supabase.from('registros_acceso').select('*').order('fecha_hora', { ascending: false }).limit(50);
    if (data) setMovimientos(data);
  }

  // Función para extraer modo y autorizador del string de detalles
  const parseDetalles = (detalles: string) => {
    const modoMatch = detalles.match(/Modo: (\w+)|MODO (\w+)/i);
    const autorizaMatch = detalles.match(/Autoriza \w+: (.+)|Autoriza: (.+)|AUTORIZADO POR: (.+)/i);
    
    const modo = modoMatch ? (modoMatch[1] || modoMatch[2]) : 'QR/USB';
    const autoriza = autorizaMatch ? (autorizaMatch[1] || autorizaMatch[2] || autorizaMatch[3]) : 'Sistema';
    
    return { modo, autoriza };
  };

  async function guardarEmpleado() {
    if (!nuevo.nombre || !nuevo.documento_id || !nuevo.pin_seguridad) return;
    const { error } = await supabase.from('empleados').insert([{ ...nuevo, en_almacen: false, activo: true }]);
    if (!error) {
      setNuevo({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado' });
      fetchEmpleados();
    }
  }

  async function actualizarEmpleado() {
    if (!editando) return;
    const { error } = await supabase.from('empleados').update({
      nombre: editando.nombre,
      documento_id: editando.documento_id,
      email: editando.email,
      pin_seguridad: editando.pin_seguridad,
      rol: editando.rol
    }).eq('id', editando.id);
    if (!error) { setEditando(null); fetchEmpleados(); }
  }

  if (vista === 'menu') {
    return (
      <main className="min-h-screen bg-[#050a14] text-white flex flex-col items-center justify-center p-6">
        <h1 className="text-xl font-black uppercase italic tracking-tighter text-blue-500 mb-10 text-center">
          Panel Administrativo <br/> <span className="text-[10px] text-slate-500 not-italic tracking-[0.4em]">Control Maestro</span>
        </h1>
        <div className="w-full max-w-sm space-y-4">
          <button onClick={() => setVista('empleados')} className="w-full p-8 bg-[#0f172a] border border-white/5 rounded-[30px] font-black uppercase italic hover:bg-blue-600 transition-all shadow-2xl group">
             <span className="block text-2xl mb-2 group-hover:scale-110 transition-transform">👥</span>
             Gestión de Personal
          </button>
          <button onClick={() => setVista('movimientos')} className="w-full p-8 bg-[#0f172a] border border-white/5 rounded-[30px] font-black uppercase italic hover:bg-blue-600 transition-all shadow-2xl group">
             <span className="block text-2xl mb-2 group-hover:scale-110 transition-transform">🕒</span>
             Historial de Accesos
          </button>
          <button onClick={() => router.push('/')} className="w-full p-4 mt-6 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-600 hover:text-white transition-all">
            ← Volver al Menú
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen bg-[#050a14] text-white font-sans flex flex-col overflow-hidden">
      {/* 1. CABECERA FIJA (MEMBRETE) */}
      <div className="flex-none p-4 border-b border-white/5 bg-[#050a14] z-20">
        <div className="max-w-7xl mx-auto flex justify-between items-center mb-4">
          <button onClick={() => {setVista('menu'); setEditando(null);}} className="bg-slate-800 px-4 py-2 rounded-xl text-[9px] font-black uppercase">← Volver</button>
          <h2 className="text-[10px] font-black uppercase tracking-widest text-blue-500">
            {vista === 'empleados' ? 'DATOS DEL EMPLEADO' : 'HISTORIAL DE ACCESOS'}
          </h2>
          <button onClick={vista === 'empleados' ? fetchEmpleados : fetchMovimientos} className="bg-blue-600/10 text-blue-500 px-4 py-2 rounded-xl text-[9px] font-black">🔄</button>
        </div>

        {vista === 'empleados' && (
          <div className="max-w-7xl mx-auto bg-[#0f172a] p-4 rounded-[25px] border border-white/5 shadow-2xl">
             <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] uppercase font-bold text-slate-500 ml-2">Nombre</label>
                  <input type="text" placeholder="Nombre completo" className="w-full bg-slate-950 p-3 rounded-xl border border-white/5 text-[11px] outline-none focus:border-blue-500" value={editando ? editando.nombre : nuevo.nombre} onChange={e => editando ? setEditando({...editando, nombre: e.target.value}) : setNuevo({...nuevo, nombre: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] uppercase font-bold text-slate-500 ml-2">Email</label>
                  <input type="email" placeholder="Email" className="w-full bg-slate-950 p-3 rounded-xl border border-white/5 text-[11px] outline-none focus:border-blue-500" value={editando ? editando.email : nuevo.email} onChange={e => editando ? setEditando({...editando, email: e.target.value}) : setNuevo({...nuevo, email: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] uppercase font-bold text-slate-500 ml-2">PIN</label>
                  <input type="text" placeholder="PIN Seguridad" className="w-full bg-slate-950 p-3 rounded-xl border border-white/5 text-[11px] outline-none focus:border-blue-500" value={editando ? editando.pin_seguridad : nuevo.pin_seguridad} onChange={e => editando ? setEditando({...editando, pin_seguridad: e.target.value}) : setNuevo({...nuevo, pin_seguridad: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] uppercase font-bold text-slate-500 ml-2">Rol</label>
                  <div className="flex gap-2">
                    <select className="flex-1 bg-slate-950 p-3 rounded-xl border border-white/5 text-[11px] font-bold" value={editando ? editando.rol : nuevo.rol} onChange={e => editando ? setEditando({...editando, rol: e.target.value}) : setNuevo({...nuevo, rol: e.target.value})}>
                      <option value="empleado">Empleado</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="admin">Administrador</option>
                    </select>
                    <button onClick={editando ? actualizarEmpleado : guardarEmpleado} className="flex-1 bg-blue-600 rounded-xl font-black uppercase text-[10px] hover:bg-blue-500 transition-colors">
                      {editando ? 'Actualizar' : 'Registrar'}
                    </button>
                    {editando && <button onClick={() => setEditando(null)} className="px-3 bg-red-600/20 text-red-500 rounded-xl font-bold">✕</button>}
                  </div>
                </div>
             </div>
             {/* Documento ID Oculto o agregado dinámicamente si es necesario */}
             {!editando && (
               <input type="hidden" value={nuevo.documento_id} /> 
             )}
          </div>
        )}
      </div>

      {/* 2. TABLAS CON SCROLL Y ENCABEZADOS FIJOS */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
        <div className="max-w-7xl mx-auto">
          <div className="bg-[#0f172a] rounded-[25px] border border-white/5 shadow-2xl overflow-hidden">
            <table className="w-full text-left text-[10px] table-fixed">
              <thead className="bg-white/5 uppercase text-slate-500 font-black sticky top-0 z-10 backdrop-blur-md">
                {vista === 'empleados' ? (
                  <tr>
                    <th className="p-4 w-20 text-center">Estado</th>
                    <th className="p-4">Nombre / Email</th>
                    <th className="p-4 w-32">Rol</th>
                    <th className="p-4 w-40">Documento / PIN</th>
                    <th className="p-4 w-24 text-center">Editar</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="p-4">Empleado</th>
                    <th className="p-4 w-24">Tipo</th>
                    <th className="p-4 w-28">Modo</th>
                    <th className="p-4">Autorizado por</th>
                    <th className="p-4 w-32">Fecha/Hora</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-white/5">
                {vista === 'empleados' ? (
                  empleados.map(emp => (
                    <tr key={emp.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-3 h-3 rounded-full ${emp.en_almacen ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-red-500 shadow-[0_0_10px_#ef4444]'}`}></div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-200 text-[11px]">{emp.nombre}</span>
                          <span className="text-[9px] text-slate-500 lowercase">{emp.email}</span>
                        </div>
                      </td>
                      <td className="p-4 uppercase text-slate-400 font-black">{emp.rol}</td>
                      <td className="p-4">
                        <p className="font-mono text-blue-400">{emp.documento_id}</p>
                        <p className="text-slate-500 text-[8px] uppercase">PIN: {emp.pin_seguridad}</p>
                      </td>
                      <td className="p-4 text-center">
                        <button onClick={() => {
                            setEditando(emp);
                            window.scrollTo({top: 0, behavior: 'smooth'});
                          }} className="p-2 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500 hover:text-white transition-all">
                          ✎
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  movimientos.map(mov => {
                    const info = parseDetalles(mov.detalles || '');
                    return (
                      <tr key={mov.id} className="hover:bg-white/[0.01]">
                        <td className="p-4 font-bold text-slate-200">{mov.nombre_empleado}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-md font-black text-[8px] ${mov.tipo_movimiento === 'entrada' ? 'text-emerald-500 bg-emerald-500/10' : 'text-red-500 bg-red-500/10'}`}>
                            {mov.tipo_movimiento?.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4 uppercase text-slate-400 font-black text-[9px]">{info.modo}</td>
                        <td className="p-4 text-blue-400 font-bold">{info.autoriza}</td>
                        <td className="p-4 text-slate-500 font-mono text-[9px]">
                          {new Date(mov.fecha_hora).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}