'use client';

import { useState, useEffect } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client-browser';
import type { ReporteProgramado } from '@/lib/reportes/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  reporte: ReporteProgramado | null;
  onGuardado: () => void;
  usuarioId: string;
}

export function ProgramadorModal({ isOpen, onClose, reporte, onGuardado, usuarioId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createBrowserSupabaseClient();
  
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    tipo: 'timesheet',
    frecuencia: 'semanal',
    dia_semana: 1,
    dia_mes: 1,
    hora_envio: '08:00',
    destinatarios: '',
    formato: 'excel',
    activo: true,
    filtros: {}
  });

  useEffect(() => {
    if (reporte) {
      setFormData({
        nombre: reporte.nombre,
        descripcion: reporte.descripcion || '',
        tipo: reporte.tipo,
        frecuencia: reporte.frecuencia,
        dia_semana: reporte.dia_semana || 1,
        dia_mes: reporte.dia_mes || 1,
        hora_envio: reporte.hora_envio.slice(0,5),
        destinatarios: reporte.destinatarios.join(', '),
        formato: reporte.formato,
        activo: reporte.activo,
        filtros: reporte.filtros || {}
      });
    } else {
      setFormData({
        nombre: '',
        descripcion: '',
        tipo: 'timesheet',
        frecuencia: 'semanal',
        dia_semana: 1,
        dia_mes: 1,
        hora_envio: '08:00',
        destinatarios: '',
        formato: 'excel',
        activo: true,
        filtros: {}
      });
    }
  }, [reporte]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validar emails
      const emails = formData.destinatarios.split(',').map(e => e.trim()).filter(e => e);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const emailsInvalidos = emails.filter(e => !emailRegex.test(e));
      
      if (emailsInvalidos.length > 0) {
        setError(`Emails inválidos: ${emailsInvalidos.join(', ')}`);
        setLoading(false);
        return;
      }

      const data: any = {
        nombre: formData.nombre,
        descripcion: formData.descripcion || null,
        tipo: formData.tipo,
        frecuencia: formData.frecuencia,
        hora_envio: formData.hora_envio + ':00',
        destinatarios: emails,
        formato: formData.formato,
        activo: formData.activo,
        filtros: formData.filtros,
        creado_por: usuarioId
      };

      // Agregar campos según frecuencia
      if (formData.frecuencia === 'semanal') {
        data.dia_semana = formData.dia_semana;
      }
      if (formData.frecuencia === 'mensual') {
        data.dia_mes = formData.dia_mes;
      }

      if (reporte) {
        // Actualizar
        const { error } = await supabase
          .from('reportes_programados')
          .update(data)
          .eq('id', reporte.id);
        
        if (error) throw error;
      } else {
        // Crear
        const { error } = await supabase
          .from('reportes_programados')
          .insert(data);
        
        if (error) throw error;
      }

      onGuardado();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-white font-black text-xl mb-4">
          {reporte ? 'EDITAR REPORTE' : 'NUEVO REPORTE PROGRAMADO'}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-600/20 border border-red-600/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-white/60 text-xs mb-2">NOMBRE *</label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="w-full bg-[#0f172a] border border-white/10 rounded-lg p-3 text-white"
              required
            />
          </div>

          <div>
            <label className="block text-white/60 text-xs mb-2">DESCRIPCIÓN</label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              className="w-full bg-[#0f172a] border border-white/10 rounded-lg p-3 text-white"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-white/60 text-xs mb-2">TIPO DE REPORTE</label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                className="w-full bg-[#0f172a] border border-white/10 rounded-lg p-3 text-white"
              >
                <option value="timesheet">Timesheet</option>
                <option value="comparativa">Comparativa Turnos</option>
                <option value="ausencias">Reporte Ausencias</option>
              </select>
            </div>

            <div>
              <label className="block text-white/60 text-xs mb-2">FORMATO</label>
              <select
                value={formData.formato}
                onChange={(e) => setFormData({ ...formData, formato: e.target.value })}
                className="w-full bg-[#0f172a] border border-white/10 rounded-lg p-3 text-white"
              >
                <option value="excel">Excel</option>
                <option value="pdf">PDF</option>
                <option value="ambos">Excel + PDF</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-white/60 text-xs mb-2">FRECUENCIA</label>
              <select
                value={formData.frecuencia}
                onChange={(e) => setFormData({ ...formData, frecuencia: e.target.value })}
                className="w-full bg-[#0f172a] border border-white/10 rounded-lg p-3 text-white"
              >
                <option value="diario">Diario</option>
                <option value="semanal">Semanal</option>
                <option value="mensual">Mensual</option>
                <option value="trimestral">Trimestral</option>
              </select>
            </div>

            <div>
              <label className="block text-white/60 text-xs mb-2">HORA DE ENVÍO</label>
              <input
                type="time"
                value={formData.hora_envio}
                onChange={(e) => setFormData({ ...formData, hora_envio: e.target.value })}
                className="w-full bg-[#0f172a] border border-white/10 rounded-lg p-3 text-white"
                required
              />
            </div>
          </div>

          {formData.frecuencia === 'semanal' && (
            <div>
              <label className="block text-white/60 text-xs mb-2">DÍA DE LA SEMANA</label>
              <select
                value={formData.dia_semana}
                onChange={(e) => setFormData({ ...formData, dia_semana: parseInt(e.target.value) })}
                className="w-full bg-[#0f172a] border border-white/10 rounded-lg p-3 text-white"
              >
                <option value={1}>Lunes</option>
                <option value={2}>Martes</option>
                <option value={3}>Miércoles</option>
                <option value={4}>Jueves</option>
                <option value={5}>Viernes</option>
                <option value={6}>Sábado</option>
                <option value={7}>Domingo</option>
              </select>
            </div>
          )}

          {formData.frecuencia === 'mensual' && (
            <div>
              <label className="block text-white/60 text-xs mb-2">DÍA DEL MES (1-31)</label>
              <input
                type="number"
                min="1"
                max="31"
                value={formData.dia_mes}
                onChange={(e) => setFormData({ ...formData, dia_mes: parseInt(e.target.value) })}
                className="w-full bg-[#0f172a] border border-white/10 rounded-lg p-3 text-white"
              />
            </div>
          )}

          <div>
            <label className="block text-white/60 text-xs mb-2">DESTINATARIOS (emails separados por coma)</label>
            <textarea
              value={formData.destinatarios}
              onChange={(e) => setFormData({ ...formData, destinatarios: e.target.value })}
              className="w-full bg-[#0f172a] border border-white/10 rounded-lg p-3 text-white"
              rows={2}
              placeholder="ejemplo@email.com, otro@email.com"
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 rounded-lg"
            >
              CANCELAR
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg disabled:opacity-50"
            >
              {loading ? 'GUARDANDO...' : (reporte ? 'ACTUALIZAR' : 'CREAR')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}