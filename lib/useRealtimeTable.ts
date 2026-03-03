'use client';
/**
 * useRealtimeTable — Hook genérico para suscripción Realtime de Supabase.
 * Cuando cualquier fila de la tabla cambie (INSERT/UPDATE/DELETE),
 * ejecuta onRefresh() para que el componente recargue sus datos.
 *
 * Uso:
 *   useRealtimeTable('sucursales', () => cargar());
 *   useRealtimeTable('jornadas', () => setRefresh(r => r + 1));
 */
import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useRealtimeTable(
    tabla: string,
    onRefresh: () => void,
    filter?: string   // Ej: 'sucursal_codigo=eq.01'  — opcional
) {
    useEffect(() => {
        const channelName = `rt_${tabla}_${Math.random().toString(36).slice(2, 7)}`;

        const config: any = {
            event: '*',
            schema: 'public',
            table: tabla,
        };
        if (filter) config.filter = filter;

        const channel = supabase
            .channel(channelName)
            .on('postgres_changes', config, () => {
                onRefresh();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
        // No incluir onRefresh en deps para evitar loops — es callback estable del componente
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabla, filter]);
}
