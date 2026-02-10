'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function GestionFlotaAdmin() {
  const [unidades, setUnidades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    nombre_completo: '',
    documento_id: '',
    nombre_flota: '',
    cant_rutas: 0 // Definida como capacidad nominal del perfil
  });

  const fetchFlota = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('flota')
        .select('*')
        .order('nombre_flota', { ascending: true });
      if (error) throw error;
      if (data) setUnidades(data);
    } catch (err) {
      console.error("Error fetching flota:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFlota(); }, [fetchFlota]);

  // ALGORITMO SMART PIN: F + DDMM + NN
  const generarPinFlota = async () => {
    const hoy = new Date();
    const ddmm = `${String(hoy.getDate()).padStart(2, '0')}${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    
    const { count } = await supabase
      .from('flota')
      .select('*', { count: 'exact', head: true })
      .like('pin_secreto', `F${ddmm}%`);

    const correlativo = String((count || 0) + 1).padStart(2, '0');
    return `F${ddmm}${correlativo}`;
  };

  const guardarUnidad = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const pin = await generarPinFlota();
      const { error } = await supabase.from('flota').insert([{
        nombre_completo: form.nombre_completo,
        documento_id: form.documento_id,
        nombre_flota: form.nombre_flota,
        cant_rutas: form.cant_rutas, // Capacidad asignada al perfil
        pin_secreto: pin,
        estado: 'despachado'
      }]);

      if (error) throw error;
      
      setShowModal(false);
      setForm({ nombre_completo: '', documento_id: '', nombre_flota: '', cant_rutas: 0 });
      fetchFlota();
      alert(`PERFIL CREADO - PIN ASIGNADO: ${pin}`);
    } catch (err: any) {
      alert("Error al crear perfil: " + err.message);
    }
  };

  const eliminarUnidad = async (id: string) => {
    if (!confirm("¿Desea eliminar este perfil de flota? Esta acción no se puede deshacer.")) return;
    const { error } = await supabase.from('flota').delete().eq('id', id);
    if (!error) fetchFlota();
  };

  return (
    <div className="min-h-screen bg-[#020617] p-4 md:p-8 text-slate-300 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* MEMBRETE GESTOR */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6 border-b border-white/5 pb-8">
          <div>
            <h1 className="text-4xl font-black italic text-white uppercase tracking-tighter">
              GESTOR DE <span className="text-blue-500">FLOTA</span>
            </h1>
            <p className="text-[10px] font-black text-slate-500 tracking-[0.4em] uppercase mt-2">
              Configuración de Capacidad y Perfiles Logísticos
            </p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-5 rounded-[20px] font-black text-xs uppercase tracking-widest transition-all shadow-[0_10px_30px_rgba(37,99,235,0.2)] active:scale-95"
          >
            + Registrar Nueva Flota
          </button>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {unidades.map((u) => (
              <div key={u.id} className="bg-[#0f172a] border border-white/5 p-8 rounded-[35px] relative group hover:border-blue-500/30 transition-all duration-500">
                <div className="absolute top-6 right-6">
                  <div className={`w-3 h-3 rounded-full ${u.estado === 'en_patio' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`}></div>
                </div>
                
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">{u.nombre_flota}</p>
                <h3 className="text-2xl font-black text-white uppercase leading-tight mb-6">{u.nombre_completo}</h3>
                
                <div className="space-y-4 bg-black/20 p-5 rounded-2xl mb-8">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Smart PIN:</span>
                    <span className="text-emerald-400 font-mono font-black text-sm">{u.pin_secreto}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Documento:</span>
                    <span className="text-white font-bold text-xs">{u.documento_id}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-white/5">
                    <span className="text-[9px] font-bold text-slate-500 uppercase italic">Capacidad Nominal:</span>
                    <span className="text-blue-500 font-black text-lg">{u.cant_rutas} <small className="text-[10px]">RUTAS</small></span>
                  </div>
                </div>

                <button 
                  onClick={() => eliminarUnidad(u.id)}
                  className="w-full py-4 bg-rose-600/5 hover:bg-rose-600 text-rose-600 hover:text-white rounded-2xl text-[10px] font-black uppercase transition-all border border-rose-600/20"
                >
                  Dar de Baja Perfil
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE ALTA QUIRÚRGICA */}
      {showModal && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
          <form 
            onSubmit={guardarUnidad} 
            className="bg-[#0f172a] border-2 border-blue-600/20 w-full max-w-xl rounded-[45px] p-10 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>
            
            <h2 className="text-3xl font-black text-white uppercase italic mb-8">
              Configurar <span className="text-blue-500">Perfil de Flota</span>
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase ml-2 mb-2 block tracking-widest">Nombre Completo Conductor</label>
                <input 
                  required 
                  type="text" 
                  className="w-full bg-black/40 border border-white/10 p-5 rounded-2xl text-white outline-none focus:border-blue-500 transition-all font-bold" 
                  value={form.nombre_completo} 
                  onChange={e => setForm({...form, nombre_completo: e.target.value.toUpperCase()})} 
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-2 mb-2 block tracking-widest">Documento ID</label>
                  <input 
                    required 
                    type="text" 
                    className="w-full bg-black/40 border border-white/10 p-5 rounded-2xl text-white outline-none focus:border-blue-500 transition-all font-bold" 
                    value={form.documento_id} 
                    onChange={e => setForm({...form, documento_id: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-2 mb-2 block tracking-widest">Nombre / Placa Flota</label>
                  <input 
                    required 
                    type="text" 
                    className="w-full bg-black/40 border border-white/10 p-5 rounded-2xl text-white outline-none focus:border-blue-500 transition-all font-bold" 
                    value={form.nombre_flota} 
                    onChange={e => setForm({...form, nombre_flota: e.target.value.toUpperCase()})} 
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase ml-2 mb-2 block tracking-widest underline decoration-blue-500 underline-offset-4">Capacidad de Carga (Rutas Planificadas)</label>
                <input 
                  required 
                  type="number" 
                  className="w-full bg-black/40 border border-white/10 p-6 rounded-2xl text-4xl font-black text-center text-blue-500 outline-none focus:border-emerald-500 transition-all" 
                  value={form.cant_rutas} 
                  onChange={e => setForm({...form, cant_rutas: parseInt(e.target.value) || 0})} 
                />
                <p className="text-[9px] text-slate-600 mt-2 italic px-2">Este valor servirá como base de comparación contra la carga real diaria.</p>
              </div>
            </div>

            <div className="flex gap-4 mt-10">
              <button 
                type="button" 
                onClick={() => setShowModal(false)} 
                className="flex-1 py-5 bg-white/5 text-slate-500 rounded-2xl font-black text-xs uppercase italic hover:bg-white/10 transition-all"
              >
                Cerrar
              </button>
              <button 
                type="submit" 
                className="flex-[2] py-5 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase italic shadow-lg shadow-blue-900/40 active:scale-95 transition-all"
              >
                Generar Perfil y PIN F
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}