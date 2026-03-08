'use client';

import { useEffect, useState } from 'react';
import { obtenerSaldoEmpleadoAction } from '@/lib/ausencias/actions'; // ← IMPORTACIÓN CORREGIDA

interface SaldoAusenciasProps {
  empleadoId: string;
}

export function SaldoAusencias({ empleadoId }: SaldoAusenciasProps) {
  const [saldos, setSaldos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarSaldos = async () => {
      const result = await obtenerSaldoEmpleadoAction(empleadoId);
      if (result.success) {
        setSaldos(result.data || []);
      }
      setLoading(false);
    };
    cargarSaldos();
  }, [empleadoId]);

  if (loading) {
    return <div className="text-sm text-gray-500">Cargando saldos...</div>;
  }

  if (saldos.length === 0) {
    return (
      <div className="bg-blue-50 p-3 rounded text-sm text-blue-700">
        No hay información de saldos para el año actual.
      </div>
    );
  }

  const tipoLabels: Record<string, string> = {
    vacacion: 'Vacaciones',
    enfermedad: 'Enfermedad',
    personal: 'Asuntos personales'
  };

  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <h3 className="font-medium text-gray-700 mb-3">Saldos {new Date().getFullYear()}</h3>
      <div className="space-y-2">
        {saldos.map((saldo) => (
          <div key={saldo.tipo} className="flex justify-between items-center text-sm">
            <span className="text-gray-600">{tipoLabels[saldo.tipo] || saldo.tipo}:</span>
            <span className="font-medium">
              {saldo.dias_disponibles} días disponibles
              <span className="text-xs text-gray-500 ml-1">
                ({saldo.dias_usados} usados de {saldo.dias_totales})
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}