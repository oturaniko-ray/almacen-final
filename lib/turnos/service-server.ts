import { createServerSupabaseClient } from '@/lib/supabase/client';
import { TurnoCreateSchema } from './validators';
import type { Turno } from './types';

export async function crearTurnoServer(data: unknown) {
  console.log('[SERVER] Creando nuevo turno');
  
  try {
    const validatedData = TurnoCreateSchema.parse(data);
    const supabase = await createServerSupabaseClient();
    
    const { data: turno, error } = await supabase
      .from('turnos')
      .insert({
        ...validatedData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw new Error(`Error al crear turno: ${error.message}`);
    return { success: true, data: turno };
    
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}