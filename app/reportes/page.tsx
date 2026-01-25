'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function ReportesPage() {
  const [user, setUser] = useState<any>(null);
  const [reportes, setReportes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtroNombre, setFiltroNombre] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [editandoRow, setEditandoRow] = useState<any>(null);
  
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    const currentUser = JSON.parse(sessionData);
    if (!['admin', 'administrador', 'supervisor'].includes(currentUser.rol)) { router.replace('/'); return; }
    setUser(currentUser);
    cargarDatos();
  }, [router]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      // MODIFICACIÓN 2: Asegurar que consultamos la tabla correcta para permitir updates
      let query = supabase.from('reporte_jornadas').select('*');
      if (fechaInicio) query = query.gte('hora_entrada', fechaInicio);
      if (fechaFin) query = query.lte('hora_entrada', fechaFin);
      if (filtroNombre) query = query.ilike('nombre_empleado', `%${filtroNombre}%`);

      const { data, error } = await query.order('hora_entrada', { ascending: false });
      if (error) throw error;
      setReportes(data || []);
    } catch (err) {
      console.error("Error cargando reportes:", err);
    } finally {
      setLoading(false);
    }
  };

  const guardarCambiosManuales = async () => {
    if (!editandoRow) return;

    // MODIFICACIÓN 2: Corrección de lógica de grabado. Se usa .toISOString() para asegurar formato compatible.
    const entrada = new Date(editandoRow.hora_entrada);
    const salida = new Date(editandoRow.hora_salida);
    const nuevasHoras = (salida.getTime() - entrada.getTime()) / (1000 * 60 * 60);

    const { error } = await supabase
      .from('reporte_jornadas')
      .update({
        hora_entrada: entrada.toISOString(),
        hora_salida: salida.toISOString(),
        horas_trabajadas: nuevasHoras,
        editado_por: user.nombre // Auditoría
      })
      .eq('id', editandoRow.id);

    if (!error) {
      setEditandoRow(null);
      cargarDatos();
    } else {
      alert("Error al guardar: " + error.message);
    }
  };

  const exportarExcel = () => {
    const ahora = new Date();
    // MODIFICACIÓN 4: Membrete en la exportación con datos del responsable
    const encabezado = [
      ["REPORTE DE OPERACIONES"],
      [`RESPONSABLE: ${user?.nombre} (${user?.rol})`],
      [`FECHA DE EXPORTACIÓN: ${ahora.toLocaleString()}`],
      [],
      ["Empleado", "Entrada", "Salida", "Horas Totales", "Auditado por"]
    ];

    const filas = reportes.map(r => [
      r.nombre_empleado,
      new Date(r.hora_entrada).toLocaleString(),
      r.hora_salida ? new Date(r.hora_salida).toLocaleString() : 'PENDIENTE',
      r.horas_trabajadas ? r.horas_trabajadas.toFixed(2) : '0',
      r.editado_por || 'Original'
    ]);

    const ws = XLSX.utils.aoa_to_sheet([...encabezado, ...filas]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jornadas");
    XLSX.writeFile(wb, `Reporte_Operaciones_${ahora.getTime()}.xlsx`);
  };

  let fechaCabeceraActual = "";

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-4 md:p-8 font-sans">
      {/* Modal de Edición (Ventana emergente) */}
      {editandoRow && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-white/10 p-8 rounded-[40px] max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-black uppercase text-blue-500 italic mb-2">Ajuste de Registro</h2>
            <p className="text-[10px] text-red-400 font-black uppercase mb-6">⚠️ REQUIERE REVISIÓN ESTRICTA - AUDITORÍA ACTIVA</p>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Entrada</label>
                <input type="datetime-local" className="w-full bg-[#050a14] border border-white/5 p-3 rounded-xl text-sm text-white" 
                  value={editandoRow.hora_entrada.slice(0, 16)} 
                  onChange={(e) => setEditandoRow({...editandoRow, hora_entrada: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Salida</label>
                <input type="datetime-local" className="w-full bg-[#050a14] border border-white/5 p-3 rounded-xl text-sm text-white" 
                  value={editandoRow.hora_salida?.slice(0, 16) || ''} 
                  onChange={(e) => setEditandoRow({...editandoRow, hora_salida: e.target.value})} />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={guardarCambiosManuales} className="flex-1 bg-blue-600 p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500">Confirmar Cambios</button>
              <button onClick={() => setEditandoRow(null)} className="bg-slate-800 p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter">
              REPORTES DE <span className="text-blue-500">OPERACIÓN</span>
            </h1>
            {/* MODIFICACIÓN 3: Nombre y rol del empleado logueado bajo el título */}
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              SISTEMA ACCEDIDO POR: <span className="text-blue-400">{user?.nombre}</span> | ROL: <span className="text-blue-400">{user?.rol}</span>
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={exportarExcel} className="bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all shadow-lg">📥 Exportar</button>
            <button onClick={() => router.push('/admin')} className="bg-slate-800 hover:bg-slate-700 px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all">Volver</button>
          </div>
        </div>

        <div className="bg-[#0f172a] p-6 rounded-[35px] border border-white/5 mb-8 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] font-black uppercase ml-2 text-slate-500">Filtro por Nombre</label>
            <input type="text" value={filtroNombre} onChange={(e) => setFiltroNombre(e.target.value)} className="w-full bg-[#050a14] border border-white/5 p-3 rounded-xl text-sm" placeholder="Buscar..." />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase ml-2 text-slate-500">Desde</label>
            <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="w-full bg-[#050a14] border border-white/5 p-3 rounded-xl text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase ml-2 text-slate-500">Hasta</label>
            <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="w-full bg-[#050a14] border border-white/5 p-3 rounded-xl text-sm" />
          </div>
          <button onClick={cargarDatos} className="bg-blue-600 px-8 py-3 rounded-xl font-black text-xs uppercase h-[46px]">Actualizar</button>
        </div>

        <div className="bg-[#0f172a] rounded-[40px] border border-white/5 overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02] text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5">
                <th className="p-6">Empleado</th>
                <th className="p-6">Entrada</th>
                <th className="p-6">Salida</th>
                <th className="p-6">Horas</th>
                <th className="p-6 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {reportes.map((r, i) => {
                const fechaFila = new Date(r.hora_entrada).toLocaleDateString();
                const mostrarSeparador = fechaFila !== fechaCabeceraActual;
                if (mostrarSeparador) fechaCabeceraActual = fechaFila;

                return (
                  <React.Fragment key={i}>
                    {mostrarSeparador && (
                      <tr className="bg-blue-500/5">
                        <td colSpan={5} className="p-3 text-center text-[10px] font-black text-blue-400 uppercase tracking-[0.6em] border-y border-white/5">
                          --- {fechaFila} ---
                        </td>
                      </tr>
                    )}
                    <tr className="hover:bg-white/[0.01] transition-colors group">
                      <td className="p-6 font-bold uppercase text-sm">{r.nombre_empleado}</td>
                      <td className="p-6 text-xs text-slate-400 font-mono">{new Date(r.hora_entrada).toLocaleString()}</td>
                      <td className="p-6 text-xs text-slate-400 font-mono">{r.hora_salida ? new Date(r.hora_salida).toLocaleString() : <span className="text-blue-500 italic">ACTIVO</span>}</td>
                      <td className="p-6">
                        <span className="bg-blue-600/10 text-blue-400 px-4 py-1 rounded-full font-black text-xs">
                          {r.horas_trabajadas ? r.horas_trabajadas.toFixed(2) : '0.00'} H
                        </span>
                      </td>
                      {/* MODIFICACIÓN 1: Botón de edición con icono de lápiz a la derecha */}
                      <td className="p-6 text-center">
                        <button onClick={() => setEditandoRow(r)} className="p-2 hover:bg-blue-500/20 rounded-lg transition-all text-blue-500">
                          ✏️
                        </button>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}