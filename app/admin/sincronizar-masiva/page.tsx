'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function SincronizarMasiva() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [resultados, setResultados] = useState<any[]>([]);
  const [progreso, setProgreso] = useState(0);
  const [estadisticas, setEstadisticas] = useState({ exitos: 0, errores: 0, sinTelefono: 0 });
  const [filtro, setFiltro] = useState('pendientes');
  const router = useRouter();

  useEffect(() => {
    cargarEmpleados();
  }, []);

  const cargarEmpleados = async () => {
    const { data } = await supabase
      .from('empleados')
      .select('*')
      .order('nombre');
    if (data) setEmpleados(data);
  };

  const sincronizarSeleccionados = async (empleadosSeleccionados: any[]) => {
    setProcesando(true);
    setResultados([]);
    setProgreso(0);
    setEstadisticas({ exitos: 0, errores: 0, sinTelefono: 0 });

    for (let i = 0; i < empleadosSeleccionados.length; i++) {
      const emp = empleadosSeleccionados[i];
      
      if (!emp.telefono) {
        setResultados(prev => [...prev, {
          id: emp.id,
          nombre: emp.nombre,
          telefono: 'SIN TELÉFONO',
          success: false,
          error: 'Empleado sin teléfono'
        }]);
        setEstadisticas(prev => ({ ...prev, sinTelefono: prev.sinTelefono + 1 }));
        continue;
      }

      try {
        const response = await fetch('/api/sync-contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: emp.telefono,
            nombre: emp.nombre,
            email: emp.email,
            documento_id: emp.documento_id,
            empleado_id: emp.id
          }),
        });
        
        const data = await response.json();
        
        setResultados(prev => [...prev, {
          id: emp.id,
          nombre: emp.nombre,
          telefono: emp.telefono,
          success: data.success,
          id_respondio: data.respondio_contact_id,
          error: data.error
        }]);
        
        if (data.success) {
          setEstadisticas(prev => ({ ...prev, exitos: prev.exitos + 1 }));
        } else {
          setEstadisticas(prev => ({ ...prev, errores: prev.errores + 1 }));
        }
        
      } catch (error: any) {
        setResultados(prev => [...prev, {
          id: emp.id,
          nombre: emp.nombre,
          telefono: emp.telefono,
          success: false,
          error: error.message
        }]);
        setEstadisticas(prev => ({ ...prev, errores: prev.errores + 1 }));
      }
      
      const nuevoProgreso = Math.round(((i + 1) / empleadosSeleccionados.length) * 100);
      setProgreso(nuevoProgreso);
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    setProcesando(false);
  };

  const empleadosFiltrados = empleados.filter(emp => {
    if (filtro === 'todos') return true;
    if (filtro === 'pendientes') return !emp.respondio_sincronizado && emp.telefono;
    if (filtro === 'sincronizados') return emp.respondio_sincronizado;
    return true;
  });

  const empleadosPendientes = empleados.filter(emp => !emp.respondio_sincronizado && emp.telefono);
  const empleadosConTelefono = empleados.filter(emp => emp.telefono);

  return (
    <div className="min-h-screen bg-[#020617] p-8 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-black italic uppercase tracking-tighter">
            <span className="text-white">SINCRONIZACIÓN </span>
            <span className="text-blue-700">RESPOND.IO</span>
          </h1>
          <button
            onClick={() => router.back()}
            className="bg-blue-800 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs uppercase"
          >
            ← VOLVER
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#0f172a] p-6 rounded-xl border border-white/10">
            <p className="text-slate-400 text-xs uppercase mb-2">Total Empleados</p>
            <p className="text-3xl font-bold">{empleados.length}</p>
          </div>
          <div className="bg-[#0f172a] p-6 rounded-xl border border-white/10">
            <p className="text-slate-400 text-xs uppercase mb-2">Con Teléfono</p>
            <p className="text-3xl font-bold text-emerald-400">{empleadosConTelefono.length}</p>
          </div>
          <div className="bg-[#0f172a] p-6 rounded-xl border border-white/10">
            <p className="text-slate-400 text-xs uppercase mb-2">Pendientes</p>
            <p className="text-3xl font-bold text-amber-400">{empleadosPendientes.length}</p>
          </div>
          <div className="bg-[#0f172a] p-6 rounded-xl border border-white/10">
            <p className="text-slate-400 text-xs uppercase mb-2">Sincronizados</p>
            <p className="text-3xl font-bold text-blue-400">
              {empleados.filter(e => e.respondio_sincronizado).length}
            </p>
          </div>
        </div>

        <div className="bg-[#0f172a] p-6 rounded-xl border border-white/10 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="bg-black border border-white/10 rounded-xl px-4 py-2 text-white text-sm"
            >
              <option value="pendientes">⏳ PENDIENTES ({empleadosPendientes.length})</option>
              <option value="todos">📋 TODOS LOS EMPLEADOS</option>
              <option value="sincronizados">✅ SINCRONIZADOS</option>
            </select>

            <button
              onClick={() => sincronizarSeleccionados(empleadosPendientes)}
              disabled={procesando || empleadosPendientes.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2 rounded-xl disabled:opacity-50"
            >
              🚀 SINCRONIZAR PENDIENTES ({empleadosPendientes.length})
            </button>

            <button
              onClick={() => sincronizarSeleccionados(empleadosFiltrados)}
              disabled={procesando || empleadosFiltrados.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-xl disabled:opacity-50"
            >
              🔄 SINCRONIZAR FILTRADOS ({empleadosFiltrados.length})
            </button>
          </div>

          {procesando && (
            <div className="mt-4">
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progreso}%` }}
                />
              </div>
              <div className="flex gap-4 mt-2 text-sm">
                <span className="text-emerald-400">✅ Éxitos: {estadisticas.exitos}</span>
                <span className="text-rose-400">❌ Errores: {estadisticas.errores}</span>
                <span className="text-amber-400">📱 Sin teléfono: {estadisticas.sinTelefono}</span>
              </div>
            </div>
          )}
        </div>

        {resultados.length > 0 && (
          <div className="bg-[#0f172a] rounded-xl border border-white/10 overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <h2 className="font-bold">📊 RESULTADOS DE SINCRONIZACIÓN</h2>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-black/50 sticky top-0">
                  <tr className="text-left text-xs text-slate-400">
                    <th className="p-3">NOMBRE</th>
                    <th className="p-3">TELÉFONO</th>
                    <th className="p-3">ESTADO</th>
                    <th className="p-3">ID RESPOND.IO</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((r, idx) => (
                    <tr key={idx} className="border-t border-white/5">
                      <td className="p-3">{r.nombre}</td>
                      <td className="p-3 font-mono text-sm">{r.telefono}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-[9px] font-black ${
                          r.success ? 'bg-emerald-600/20 text-emerald-400' : 'bg-rose-600/20 text-rose-400'
                        }`}>
                          {r.success ? '✅ SINCRONIZADO' : '❌ ERROR'}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-xs">
                        {r.id_respondio || r.error || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}