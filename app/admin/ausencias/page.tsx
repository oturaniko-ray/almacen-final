import { obtenerSolicitudesAction } from '@/lib/ausencias/actions'; // <- RUTA CORREGIDA
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default async function AusenciasPage() {
  // Usar la función correcta de actions.ts
  const result = await obtenerSolicitudesAction();
  const solicitudes = result.success ? result.data || [] : [];

  const getEstadoColor = (estado: string) => {
    switch(estado) {
      case 'aprobada': return 'bg-green-100 text-green-700';
      case 'rechazada': return 'bg-red-100 text-red-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };

  const getEstadoTexto = (estado: string) => {
    switch(estado) {
      case 'aprobada': return 'Aprobada';
      case 'rechazada': return 'Rechazada';
      default: return 'Pendiente';
    }
  };

  return (
    <div className="pt-20 p-6 w-full">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-800">Solicitudes de Ausencia</h1>
          <Link
            href="/app/mis-ausencias"
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
          >
            + Nueva Solicitud
          </Link>
        </div>

        {solicitudes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No hay solicitudes de ausencia</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="p-3 text-left font-medium text-gray-600">Empleado</th>
                  <th className="p-3 text-left font-medium text-gray-600">Tipo</th>
                  <th className="p-3 text-left font-medium text-gray-600">Período</th>
                  <th className="p-3 text-left font-medium text-gray-600">Días</th>
                  <th className="p-3 text-left font-medium text-gray-600">Estado</th>
                  <th className="p-3 text-left font-medium text-gray-600">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {solicitudes.map((s: any) => (
                  <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3">{s.empleado_nombre}</td>
                    <td className="p-3 capitalize">{s.tipo}</td>
                    <td className="p-3">
                      {format(new Date(s.fecha_inicio), 'dd/MM')} - {format(new Date(s.fecha_fin), 'dd/MM/yyyy')}
                    </td>
                    <td className="p-3">{s.dias_solicitados}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs ${getEstadoColor(s.estado)}`}>
                        {getEstadoTexto(s.estado)}
                      </span>
                    </td>
                    <td className="p-3 text-gray-500">
                      {format(new Date(s.created_at), 'dd/MM/yyyy', { locale: es })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}