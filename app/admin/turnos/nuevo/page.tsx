import { TurnoForm } from '../components/TurnoForm';
import { crearTurnoServer } from '@/lib/turnos/service-server';
import { redirect } from 'next/navigation';

export default function NuevoTurnoPage() {
  
  async function handleSubmit(formData: FormData) {
    'use server';
    
    // Obtener días del checkbox
    const diasSeleccionados = [];
    for (let i = 1; i <= 7; i++) {
      if (formData.get(`dia_${i}`) === 'on') {
        diasSeleccionados.push(i);
      }
    }

    const data = {
      nombre: formData.get('nombre'),
      descripcion: formData.get('descripcion') || null,
      hora_inicio: formData.get('hora_inicio') + ':00',
      hora_fin: formData.get('hora_fin') + ':00',
      sucursal_codigo: 'ALM01',
      dias_semana: diasSeleccionados.length > 0 ? diasSeleccionados : [1,2,3,4,5],
      capacidad_min: Number(formData.get('capacidad_min')) || 1,
      capacidad_max: Number(formData.get('capacidad_max')) || 5,
    };

    const result = await crearTurnoServer(data);
    
    if (result.success) {
      redirect('/admin/turnos');
    } else {
      return { error: result.error };
    }
  }

  return (
    <div className="pt-20 p-6 w-full">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm max-w-2xl mx-auto">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-800">Crear Nuevo Turno</h1>
        </div>
        
        <div className="p-4">
          <TurnoForm 
            action={handleSubmit}
            submitText="Crear Turno"
          />
        </div>
      </div>
    </div>
  );
}