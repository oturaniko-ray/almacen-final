'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { reportesService } from '@/lib/reportes/service';
import { ofrecerTurnoAction } from '@/lib/turnos/actions';
import { TurnoCederModal } from './components/TurnoCederModal';
import { TurnosDisponiblesModal } from './components/TurnosDisponiblesModal';

const EMPLEADO_ID_ACTUAL = '32c70237-d314-4143-b7e7-4602bca111d4';
const EMPLEADO_NOMBRE = 'jose patiño';

// Definir interfaces para los tipos de datos
interface TurnoAsignado {
  id: string;
  fecha: string;
  estado: string;
  turno: {
    id: string;
    nombre: string;
    hora_inicio: string;
    hora_fin: string;
  } | null;
}

interface Intercambio {
  id: string;
  turno_original_id: string;
  empleado_origen_id: string;
  empleado_destino_id: string | null;
  fecha_turno: string;
  estado: string;
  motivo: string | null;
  creado_en: string;
  actualizado_en: string;
  aprobado_por: string | null;
  turno_nombre: string;
  hora_inicio: string;
  hora_fin: string;
  empleado_origen_nombre: string;
  empleado_destino_nombre: string | null;
}

export default function MisTurnosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [turnos, setTurnos] = useState<TurnoAsignado[]>([]);
  const [intercambiosActivos, setIntercambiosActivos] = useState<Intercambio[]>([]);
  const [modalCeder, setModalCeder] = useState<{ isOpen: boolean; turno: TurnoAsignado | null }>({
    isOpen: false,
    turno: null
  });
  const [modalDisponibles, setModalDisponibles] = useState(false);
  const [notificacion, setNotificacion] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null);

  const mostrarNotificacion = (mensaje: string, tipo: 'exito' | 'error') => {
    setNotificacion({ mensaje, tipo });
    setTimeout(() => setNotificacion(null), 3000);
  };

  const cargarDatos = async () => {
  setLoading(true);
  
  // 1. Cargar turnos del empleado
  const hoy = new Date();
  const inicio = format(startOfWeek(hoy, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const fin = format(endOfWeek(hoy, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  
  const turnosResult = await reportesService.obtenerMisTurnos(EMPLEADO_ID_ACTUAL, inicio, fin);
  
  // 2. Cargar intercambios activos del empleado
  const intercambiosResult = await reportesService.obtenerIntercambiosDisponibles();
  
  // Declarar la variable aquí, fuera de los if
  let misIntercambios: Intercambio[] = [];
  
  if (intercambiosResult.success && intercambiosResult.data) {
    // Filtrar solo los intercambios donde este empleado es el origen
    misIntercambios = intercambiosResult.data.filter(
      (i: any) => i.empleado_origen_id === EMPLEADO_ID_ACTUAL
    ) as Intercambio[];
    setIntercambiosActivos(misIntercambios);
  }
  
  if (turnosResult.success && turnosResult.data) {
    // ✅ CORREGIDO: Primero asignar a una variable local con tipo explícito
    const turnosData = turnosResult.data as TurnoAsignado[];
    
    // Filtrar turnos que NO tienen un intercambio activo
    const turnosSinIntercambio = turnosData.filter((turno: TurnoAsignado) => {
      // Verificar si este turno tiene un intercambio activo
      const tieneIntercambio = misIntercambios.some(
        (i: Intercambio) => i.turno_original_id === turno.id
      );
      return !tieneIntercambio;
    });
    
    setTurnos(turnosSinIntercambio);
  }
  
  setLoading(false);
};

  // Efecto para cargar datos al inicio
  useEffect(() => {
    cargarDatos();
  }, []);

  // Efecto para actualizar cuando cambian los intercambios
  useEffect(() => {
    if (intercambiosActivos.length > 0) {
      setTurnos(prevTurnos => 
        prevTurnos.filter(turno => 
          !intercambiosActivos.some(i => i.turno_original_id === turno.id)
        )
      );
    }
  }, [intercambiosActivos]);

  const handleCederTurno = async (turnoId: string, motivo: string) => {
    const turno = turnos.find(t => t.id === turnoId);
    if (!turno) return;
    
    const result = await ofrecerTurnoAction({
      turno_original_id: turnoId,
      empleado_origen_id: EMPLEADO_ID_ACTUAL,
      fecha_turno: turno.fecha,
      motivo: motivo || undefined
    });
    
    if (result.success) {
      mostrarNotificacion('✅ Turno ofrecido correctamente', 'exito');
      
      // Actualizar la lista de intercambios activos
      const nuevosIntercambios = [...intercambiosActivos, {
        id: '',
        turno_original_id: turnoId,
        empleado_origen_id: EMPLEADO_ID_ACTUAL,
        empleado_destino_id: null,
        fecha_turno: turno.fecha,
        estado: 'disponible',
        motivo: motivo || null,
        creado_en: new Date().toISOString(),
        actualizado_en: new Date().toISOString(),
        aprobado_por: null,
        turno_nombre: turno.turno?.nombre || '',
        hora_inicio: turno.turno?.hora_inicio || '',
        hora_fin: turno.turno?.hora_fin || '',
        empleado_origen_nombre: EMPLEADO_NOMBRE,
        empleado_destino_nombre: null
      }];
      setIntercambiosActivos(nuevosIntercambios);
      
      // Quitar el turno de la lista
      setTurnos(prev => prev.filter(t => t.id !== turnoId));
      
      setModalCeder({ isOpen: false, turno: null });
    } else {
      mostrarNotificacion(`❌ ${result.error}`, 'error');
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-black text-white">MIS TURNOS</h1>
            <p className="text-white/40 text-sm">{EMPLEADO_NOMBRE}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setModalDisponibles(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-bold"
            >
              TURNOS DISPONIBLES
            </button>
            <Link
              href="/app"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold"
            >
              VOLVER
            </Link>
          </div>
        </div>

        {/* Notificación */}
        {notificacion && (
          <div className={`mb-4 p-4 rounded-xl ${
            notificacion.tipo === 'exito' ? 'bg-green-600/20 border border-green-600/30' : 'bg-red-600/20 border border-red-600/30'
          }`}>
            <p className={`text-sm font-bold ${notificacion.tipo === 'exito' ? 'text-green-400' : 'text-red-400'}`}>
              {notificacion.mensaje}
            </p>
          </div>
        )}

        {/* Lista de turnos */}
        <div className="bg-[#1a1a1a] rounded-xl border border-white/10 overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-white font-bold">MIS TURNOS DE LA SEMANA</h2>
          </div>
          
          {turnos.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-white/40">No tienes turnos disponibles para ceder</p>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {turnos.map((turno) => (
                <div key={turno.id} className="p-4 flex items-center justify-between hover:bg-white/5">
                  <div>
                    <p className="text-white font-bold">
                      {format(new Date(turno.fecha), 'EEEE d MMMM', { locale: es })}
                    </p>
                    <p className="text-blue-400 text-sm">{turno.turno?.nombre}</p>
                    <p className="text-white/40 text-xs">
                      {turno.turno?.hora_inicio?.slice(0,5)} - {turno.turno?.hora_fin?.slice(0,5)}
                    </p>
                  </div>
                  <button
                    onClick={() => setModalCeder({ isOpen: true, turno })}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-bold"
                  >
                    CEDER TURNO
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal para ceder turno */}
      {modalCeder.turno && (
        <TurnoCederModal
          isOpen={modalCeder.isOpen}
          onClose={() => setModalCeder({ isOpen: false, turno: null })}
          turno={modalCeder.turno}
          onConfirm={handleCederTurno}
        />
      )}

      {/* Modal de turnos disponibles */}
      <TurnosDisponiblesModal
        isOpen={modalDisponibles}
        onClose={() => setModalDisponibles(false)}
        empleadoId={EMPLEADO_ID_ACTUAL}
        empleadoNombre={EMPLEADO_NOMBRE}
        onSolicitudExitosa={() => {
          mostrarNotificacion('✅ Solicitud enviada', 'exito');
          setModalDisponibles(false);
          cargarDatos();
        }}
      />
    </main>
  );
}