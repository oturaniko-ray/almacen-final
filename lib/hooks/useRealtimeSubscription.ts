// lib/hooks/useRealtimeSubscription.ts
import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useRealtimeSubscription(
  table: string,
  callback: () => void,
  dependencies: any[] = []
) {
  useEffect(() => {
    const channel = supabase
      .channel(`${table}_changes`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        callback
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, callback, ...dependencies]);
}