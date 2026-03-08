'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { crearSolicitudAction, obtenerSaldoEmpleadoAction } from '@/lib/ausencias/actions';
import { useRealtime } from '@/lib/hooks/useRealtime';

// En producción, obtener de la sesión de autenticación
const EMPLEADO_ID_ACTUAL = '4e6b11ba-c1d3-4272-bb18-40860621219a';
const EMPLEADO_NOMBRE = 'Elisa Alcántara';

type TipoAusencia = 'vacacion' | 'enfermedad' | 'personal' | 'maternidad' | 'otro';

const TIPOS_AUSENCIA: Record<TipoAusencia, string> = {
  vacacion: 'Vacaciones',
  enfermedad: 'Enfermedad',
  personal: 'Asuntos personales',
  maternidad: 'Maternidad/Paternidad',
  otro: 'Otro'
};

export default function MisAusenciasPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [cargandoSaldos, setCargandoSaldos] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saldosIniciales, setSaldosIniciales] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    tipo: 'personal' as TipoAusencia,
    fecha_inicio: '',
    fecha_fin: '',
    motivo: ''
  });

  // Cargar saldos iniciales
  useEffect(() => {
    const cargarSaldos = async () => {
      const result = await obtenerSaldoEmpleadoAction(EMPLEADO_ID_ACTUAL);
      if (result.success) {
        setSaldosIniciales(result.data || []);
      }
      setCargandoSaldos(false);
    };
    cargarSaldos();
  }, []);

  // Suscribirse a cambios en saldos
  const saldos = useRealtime(saldosIniciales, {
    table: 'saldo_ausencias',
    filter: `empleado_id=eq.${EMPLEADO_ID_ACTUAL}`
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    const result = await crearSolicitudAction({
      empleado_id: EMPLEADO_ID_ACTUAL,
      tipo: formData.tipo,
      fecha_inicio: formData.fecha_inicio,
      fecha_fin: formData.fecha_fin,
      motivo: formData.motivo || null,
    });
    
    if (result.success) {
      setSuccess(true);
      setFormData({
        tipo: 'personal',
        fecha_inicio: '',
        fecha_fin: '',
        motivo: ''
      });
      
      setTimeout(() => {
        router.push('/admin/ausencias/solicitudes');
      }, 2000);
    } else {
      setError(result.error || 'Error al crear solicitud');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Mis Ausencias</h1>
          <p className="text-sm text-gray-600 mt-1">Bienvenido, {EMPLEADO_NOMBRE}</p>
        </div>

        {/* Saldos en tiempo real */}
        <div className="mb-6">
          {cargandoSaldos ? (
            <div className="bg-gray-50 p-4 rounded-lg text-center text-gray-500">
              Cargando saldos...
            </div>
          ) : saldos.length > 0 ? (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-700 mb-3">Saldos {new Date().getFullYear()}</h3>
              <div className="space-y-2">
                {saldos.map((saldo: any) => (
                  <div key={saldo.tipo} className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">{TIPOS_AUSENCIA[saldo.tipo as TipoAusencia]}:</span>
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
          ) : (
            <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-700 text-center">
              No hay información de saldos para el año actual.
            </div>
          )}
        </div>

        {/* Formulario (sin cambios) */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          {/* ... resto del formulario igual ... */}
        </div>
      </div>
    </div>
  );
}