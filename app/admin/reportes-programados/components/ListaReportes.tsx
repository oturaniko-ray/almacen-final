'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ReporteProgramado } from '@/lib/reportes/types';

interface Props {
  reportes: ReporteProgramado[];
  onEditar: (reporte: ReporteProgramado) => void;
  onEliminar: (id: string) => void;
  onToggleActivo: (reporte: ReporteProgramado) => void;
}

export function ListaReportes({ reportes, onEditar, onEliminar, onToggleActivo }: Props) {
  const getFrecuenciaTexto = (reporte: ReporteProgramado) => {
    switch (reporte.frecuencia) {
      case 'diario':
        return `Diario a las ${reporte.hora_envio.slice(0,5)}`;
      case 'semanal':
        const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        return `Semanal (${dias[reporte.dia_semana! - 1]}) a las ${reporte.hora_envio.slice(0,5)}`;
      case 'mensual':
        return `Mensual (día ${reporte.dia_mes}) a las ${reporte.hora_envio.slice(0,5)}`;
      case 'trimestral':
        return `Trimestral a las ${reporte.hora_envio.slice(0,5)}`;
      default:
        return reporte.frecuencia;
    }
  };

  const getTipoTexto = (tipo: string) => {
    const tipos: Record<string, string> = {
      timesheet: 'Timesheet',
      comparativa: 'Comparativa Turnos',
      ausencias: 'Reporte Ausencias',
      personalizado: 'Personalizado'
    };
    return tipos[tipo] || tipo;
  };

  const getFormatoTexto = (formato: string) => {
    const formatos: Record<string, string> = {
      excel: '📊 Excel',
      pdf: '📄 PDF',
      ambos: '📊📄 Excel + PDF'
    };
    return formatos[formato] || formato;
  };

  return (
    <div className="grid gap-4">
      {reportes.map((reporte) => (
        <div
          key={reporte.id}
          className={`bg-[#1a1a1a] rounded-xl border p-4 transition-all ${
            reporte.activo ? 'border-white/10 hover:border-blue-500/30' : 'border-white/5 opacity-60'
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                {reporte.nombre}
                {!reporte.activo && (
                  <span className="bg-gray-600/20 text-gray-400 px-2 py-0.5 rounded text-xs">
                    INACTIVO
                  </span>
                )}
              </h3>
              {reporte.descripcion && (
                <p className="text-white/40 text-sm">{reporte.descripcion}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onToggleActivo(reporte)}
                className={`px-3 py-1 rounded-lg text-xs font-bold ${
                  reporte.activo
                    ? 'bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30'
                    : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                }`}
              >
                {reporte.activo ? 'DESACTIVAR' : 'ACTIVAR'}
              </button>
              <button
                onClick={() => onEditar(reporte)}
                className="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-lg text-xs font-bold hover:bg-blue-600/30"
              >
                EDITAR
              </button>
              <button
                onClick={() => onEliminar(reporte.id)}
                className="bg-red-600/20 text-red-400 px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-600/30"
              >
                ELIMINAR
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-white/40 text-xs">TIPO</p>
              <p className="text-white font-medium">{getTipoTexto(reporte.tipo)}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs">FRECUENCIA</p>
              <p className="text-white font-medium">{getFrecuenciaTexto(reporte)}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs">FORMATO</p>
              <p className="text-white font-medium">{getFormatoTexto(reporte.formato)}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs">DESTINATARIOS</p>
              <p className="text-white font-medium text-sm truncate" title={reporte.destinatarios.join(', ')}>
                {reporte.destinatarios.length} email(s)
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-4 text-xs border-t border-white/10 pt-3">
            <div>
              <span className="text-white/40">Último envío: </span>
              <span className="text-white">
                {reporte.ultimo_envio
                  ? format(new Date(reporte.ultimo_envio), 'dd/MM/yyyy HH:mm', { locale: es })
                  : 'Nunca'}
              </span>
            </div>
            <div>
              <span className="text-white/40">Próximo envío: </span>
              <span className="text-blue-400 font-bold">
                {reporte.proximo_envio
                  ? format(new Date(reporte.proximo_envio), 'dd/MM/yyyy HH:mm', { locale: es })
                  : 'No programado'}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}