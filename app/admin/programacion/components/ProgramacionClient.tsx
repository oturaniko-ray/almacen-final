'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SemanaSelector } from './SemanaSelector';
import { CalendarioTurnos } from './CalendarioTurnos';
import { AsignarTurnoModal } from './AsignarTurnoModal';
import { asignarTurno } from '@/lib/turnos/service';
import type { VistaAsignacionCompleta } from '@/lib/turnos/types';

interface ProgramacionClientProps {
  empleados: Array<{ id: string; nombre: string }>;
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

  // Manejar cambio de semana
  const handleSemanaChange = (nuevaFecha: Date) => {
    setFechaBase(nuevaFecha);
    // Actualizar URL para mantener el estado
    const params = new URLSearchParams();
    params.set('semana', nuevaFecha.toISOString());
    router.push(`/admin/programacion?${params.toString()}`);
    // Recargar datos
    router.refresh();
  };

  // Abrir modal para asignar turno
  const handleAsignarClick = (empleadoId: string, fecha: string) => {
    const empleado = empleados.find(e => e.id === empleadoId);
    if (empleado) {
      setSelectedEmpleado({ id: empleadoId, nombre: empleado.nombre });
      setSelectedFecha(fecha);
      setModalOpen(true);
    }
  };

  // Asignar turno
  const handleAsignar = async (turnoId: string) => {
    const result = await asignarTurno({
      turno_id: turnoId,
      empleado_id: selectedEmpleado.id,
      fecha: selectedFecha,
      estado: 'asignado'
    });
    
    if (result.success) {
      // Recargar datos
      router.refresh();
    } else {
      alert('Error al asignar turno: ' + result.error);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Programación de Turnos</h1>
      
      <SemanaSelector 
        fechaBase={fechaBase}
        onChange={handleSemanaChange}
      />
      
      <CalendarioTurnos 
        fechaBase={fechaBase}
        empleados={empleados}
        asignaciones={asignaciones}
        onAsignarClick={handleAsignarClick}
      />
      
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