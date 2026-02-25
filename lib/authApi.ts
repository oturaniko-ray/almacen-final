import { supabase } from '@/lib/supabaseClient';
import { headers } from 'next/headers';

export async function requireAdminAuth() {
    const requestHeaders = await headers();
    const userId = requestHeaders.get('x-user-id');
    const userPin = requestHeaders.get('x-user-pin');

    if (!userId || !userPin) {
        throw new Error('Faltan credenciales de autorización. Acceso denegado.');
    }

    // Verificar credenciales en la base de datos
    const { data, error } = await (supabase as any)
        .from('empleados')
        .select('id, nivel_acceso')
        .eq('id', userId)
        .eq('pin_seguridad', userPin)
        .single();

    if (error || !data) {
        throw new Error('Credenciales de administrador inválidas.');
    }

    if (Number(data.nivel_acceso) < 4) {
        throw new Error('Nivel de acceso insuficiente. Se requiere nivel de administrador.');
    }

    return data;
}
