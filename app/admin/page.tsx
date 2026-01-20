'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AdminPanel() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [editando, setEditando] = useState<any>(null);
  const [nuevo, setNuevo] = useState({ 
    nombre: '', 
    documento_id: '', 
    email: '', 
    pin_seguridad: '', 
    rol: 'empleado' 
  });

  useEffect(() => {
    fetchEmpleados();
  }, []);

  async function fetchEmpleados() {
    const { data } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
    if (data) setEmpleados(data);
  }

  // FUNCIÓN PARA MAPEAR ROLES (Evita el error 23514)
  const mapearRol = (rolUI: string) => {
    // Si la UI envía 'administrador', lo cambiamos a 'admin' para la DB
    if (rolUI === 'administrador' || rolUI === 'admin') return 'admin';
    return rolUI; // empleado o supervisor se quedan igual
  };

  async function guardarEmpleado() {
    if (!nuevo.nombre || !nuevo.documento_id || !nuevo.pin_seguridad) return;
    
    const datosParaDB = { 
      ...nuevo, 
      rol: mapearRol(nuevo.rol) 
    };

    const { error } = await supabase.from('empleados').insert([datosParaDB]);
    
    if (!error) {
      setNuevo({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado' });
      fetchEmpleados();
      alert("✅ Usuario registrado con éxito");
    } else {
      alert("❌ Error de Base de Datos: " + error.message);
    }
  }

  async function actualizarEmpleado() {
    if (!editando) return;
    
    const datosActualizados = {
      nombre: editando.nombre,
      documento_id: editando.documento_id,
      email: editando.email,
      pin_seguridad: editando.pin_seguridad,
      rol: mapearRol(editando.rol)
    };

    const { error } = await supabase.from('empleados').update(datosActualizados).eq('id', editando.id);
    
    if (!error) {
      setEditando(null);
      fetchEmpleados();
      alert("✅ Datos actualizados");
    } else {
      alert("❌ Error al actualizar: " + error.message);
    }
  }

  async function toggleEstado(id: string, actual: boolean) {
    await supabase.from('empleados').update({ activo: !actual }).eq('id', id);
    fetchEmpleados();
  }

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <h1 className="text-3xl font-black mb-8 italic uppercase tracking-tighter text-blue-500">Gestión de Personal</h1>
      
      {/* FORMULARIO DINÁMICO (REGISTRO Y EDICIÓN) */}
      <div className="bg-[#0f172a] p-8 rounded-[40px] border border-white/5 mb-10 shadow-2xl">
        <h2 className="text-xs font-black uppercase mb-6 text-blue-400 tracking-widest">
          {editando ? "⚡ Modo Edición Activado" : "✨ Registrar Nuevo Miembro"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input 
            type="text" 
            placeholder="Nombre Completo" 
            className="bg-slate-950 p-4 rounded-2xl border border-white/5 outline-none focus:border-blue-500 transition-all" 
            value={editando ? editando.nombre : nuevo.nombre} 
            onChange={e => editando ? setEditando({...editando, nombre: e.target.value}) : setNuevo({...nuevo, nombre: e.target.value})} 
          />
          <input 
            type="text" 
            placeholder="Documento ID" 
            className="bg-slate-950 p-4 rounded-2xl border border-white/5 outline-none focus:border-blue-500 transition-all" 
            value={editando ? editando.documento_id : nuevo.documento_id} 
            onChange={e => editando ? setEditando({...editando, documento_id: e.target.value}) : setNuevo({...nuevo, documento_id: e.target.value})} 
          />
          <input 
            type="email" 
            placeholder="Email Corporativo" 
            className="bg-slate-950 p-4 rounded-2xl border border-white/5 outline-none focus:border-blue-500 transition-all" 
            value={editando ? editando.email : nuevo.email} 
            onChange={e => editando ? setEditando({...editando, email: e.target.value}) : setNuevo({...nuevo, email: e.target.value})} 
          />
          <input 
            type="text" 
            placeholder="PIN Acceso" 
            className="bg-slate-950 p-4 rounded-2xl border border-white/5 outline-none focus:border-blue-500 transition-all" 
            value={editando ? editando.pin_seguridad : nuevo.pin_seguridad} 
            onChange={e => editando ? setEditando({...editando, pin_seguridad: e.target.value}) : setNuevo({...nuevo, pin_seguridad: e.target.value})} 
          />
          <select 
            className="bg-slate-950 p-4 rounded-2xl border border-white/5 outline-none focus:border-blue-500 transition-all font-bold text-blue-400" 
            value={editando ? (editando.rol === 'admin' ? 'administrador' : editando.rol) : nuevo.rol} 
            onChange={e => editando ? setEditando({...editando, rol: e.target.value}) : setNuevo({...nuevo, rol: e.target.value})}
          >
            <option value="empleado">Empleado</option>
            <option value="supervisor">Supervisor</option>
            <option value="administrador">Administrador</option>
          </select>
          
          <div className="md:col-span-5 flex gap-3 mt-4">
            {editando ? (
              <>
                <button onClick={actualizarEmpleado} className="flex-1 bg-blue-600 p-4 rounded-2xl font-black uppercase italic hover:bg-blue-500 transition-all">Actualizar Registro</button>
                <button onClick={() => setEditando(null)} className="flex-1 bg-slate-800 p-4 rounded-2xl font-black uppercase italic hover:bg-slate-700 transition-all">Cancelar</button>
              </>
            ) : (
              <button onClick={guardarEmpleado} className="w-full bg-blue-600 p-4 rounded-2xl font-black uppercase italic hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20">Registrar en Base de Datos</button>
            )}
          </div>
        </div>
      </div>

      {/* TABLA DE PERSONAL CON INDICADORES DE ALMACÉN */}
      <div className="bg-[#0f172a] rounded-[40px] border border-white/5 overflow-hidden shadow-2xl">
        <table className="w-full text-left">
          <thead className="bg-white/5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
            <tr>
              <th className="p-6">Status</th>
              <th className="p-6">Información</th>
              <th className="p-6">Rol de Acceso</th>
              <th className="p-6 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {empleados.map(emp => (
              <tr key={emp.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="p-6">
                  {/* LÓGICA DE PUNTO: VERDE SI EN_ALMACEN ES TRUE */}
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${emp.en_almacen ? 'bg-emerald-500 shadow-[0_0_15px_#10b981]' : 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.4)]'}`}></div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {emp.en_almacen ? 'Dentro' : 'Fuera'}
                    </span>
                  </div>
                </td>
                <td className="p-6">
                  <p className="font-bold text-slate-200 text-lg">{emp.nombre}</p>
                  <p className="text-xs text-slate-500 font-mono tracking-tighter">{emp.email || 'Sin correo'}</p>
                </td>
                <td className="p-6">
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${emp.rol === 'admin' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                    {emp.rol === 'admin' ? 'Administrador' : emp.rol}
                  </span>
                </td>
                <td className="p-6 text-right">
                  <div className="flex justify-end gap-3">
                    <button 
                      onClick={() => setEditando(emp)} 
                      className="p-3 bg-blue-500/10 text-blue-500 rounded-xl hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                      title="Editar Usuario"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => toggleEstado(emp.id, emp.activo)} 
                      className={`px-5 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${emp.activo ? 'bg-red-500/10 text-red-500 hover:bg-red-600 hover:text-white' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-600 hover:text-white'}`}
                    >
                      {emp.activo ? 'DESACTIVAR' : 'ACTIVAR'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}