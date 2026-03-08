'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client-browser';

type RealtimeOptions = {
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
};

export function useRealtime<T = any>(
  initialData: T[],
  options: RealtimeOptions
): T[] {
  const [data, setData] = useState<T[]>(initialData);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    // Construir el canal de suscripción
    let channel = supabase
      .channel('realtime-changes')
      .on(
        'postgres_changes',
        {
          event: options.event || '*',
          schema: 'public',
          table: options.table,
          filter: options.filter,
        },
        (payload) => {
          console.log(`[Realtime] Cambio en ${options.table}:`, payload);

          if (payload.eventType === 'INSERT') {
            setData((prev) => [payload.new as T, ...prev]);
          }

          if (payload.eventType === 'UPDATE') {
            setData((prev) =>
              prev.map((item: any) =>
                item.id === payload.new.id ? payload.new : item
              )
            );
          }

          if (payload.eventType === 'DELETE') {
            setData((prev) =>
              prev.filter((item: any) => item.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [options.table, options.event, options.filter]);

  return data;
}