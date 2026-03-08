'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SemanaSelector } from './SemanaSelector';
import { CalendarioTurnos } from './CalendarioTurnos';
import { AsignarTurnoModal } from './AsignarTurnoModal';
import { asignarTurno } from '@/lib/turnos/service';
import { useRealtime } from '@/lib/hooks/useRealtime';
import type { VistaAsignacionCompleta } from '@/lib/turnos/types';

interface ProgramacionClientProps {
  empleados: Array<{ id: string; nombre: string; email?: string }>;
  asignacionesIniciales: VistaAsignacionCompleta[];
  fechaBaseInicial: Date;
}

export function ProgramacionClient({ 
  empleados, 
  asignacionesIniciales,
  fechaBaseInicial 
}: ProgramacionClientProps) {
  
  const router = useRouter();
  const [fechaBase, setFechaBase] = useState(fechaBaseInicial);
  const [asignaciones, setAsignaciones] = useState(asignacionesIniciales);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEmpleado, setSelectedEmpleado] = useState({ id: '', nombre: '' });
  const [selectedFecha, setSelectedFecha] = useState('');

  // Suscribirse a cambios en asignaciones
  const asignacionesRealtime = useRealtime(asignacionesIniciales, {
    table: 'asignaciones_turno'
  });

  // Actualizar estado cuando cambian en tiempo real
  useEffect(() => {
    setAsignaciones(asignacionesRealtime);
  }, [asignacionesRealtime]);

  const handleSemanaChange = (nuevaFecha: Date) => {
    setFechaBase(nuevaFecha);
    const params = new URLSearchParams();
    params.set('semana', nuevaFecha.toISOString());
    router.push(`/admin/programacion?${params.toString()}`);
    router.refresh();
  };

  const handleAsignarClick = (empleadoId: string, fecha: string) => {
    const empleado = empleados.find(e => e.id === empleadoId);
    if (empleado) {
      setSelectedEmpleado({ id: empleadoId, nombre: empleado.nombre });
      setSelectedFecha(fecha);
      setModalOpen(true);
    }
  };

  const handleAsignar = async (turnoId: string) => {
    if (!turnoId || !selectedEmpleado.id || !selectedFecha) {
      alert('Faltan datos para la asignación');
      return;
    }

    const result = await asignarTurno({
      turno_id: turnoId,
      empleado_id: selectedEmpleado.id,
      fecha: selectedFecha,
      estado: 'asignado'
    });
    
    if (result.success) {
      setModalOpen(false);
    } else {
      alert('Error al asignar turno: ' + (result.error || 'Error desconocido'));
    }
  };

  return (
    <div className="space-y-3 w-full">
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg py-2 px-4 shadow-sm">
        <h1 className="text-xl font-semibold text-blue-900 mb-1">Programación de Turnos</h1>
        <SemanaSelector 
          fechaBase={fechaBase}
          onChange={handleSemanaChange}
        />
      </div>
      
      <div className="w-full overflow-x-auto">
        <CalendarioTurnos 
          fechaBase={fechaBase}
          empleados={empleados}
          asignaciones={asignaciones}
          onAsignarClick={handleAsignarClick}
        />
      </div>
      
      <AsignarTurnoModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        empleadoId={selectedEmpleado.id}
        empleadoNombre={selectedEmpleado.nombre}
        fecha={selectedFecha}
        onAsignar={handleAsignar}
      />
    </div>
  );
}