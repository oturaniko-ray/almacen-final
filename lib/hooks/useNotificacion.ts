// lib/hooks/useNotificacion.ts
import { useState, useCallback } from 'react';

type TipoNotificacion = 'exito' | 'error' | 'advertencia' | null;

export function useNotificacion(duracion = 2000) {
  const [notificacion, setNotificacion] = useState<{
    mensaje: string;
    tipo: TipoNotificacion;
    visible: boolean;
  }>({
    mensaje: '',
    tipo: null,
    visible: false
  });

  const mostrar = useCallback((mensaje: string, tipo: Exclude<TipoNotificacion, null>) => {
    setNotificacion({ mensaje, tipo, visible: true });
    setTimeout(() => {
      setNotificacion({ mensaje: '', tipo: null, visible: false });
    }, duracion);
  }, [duracion]);

  const ocultar = useCallback(() => {
    setNotificacion({ mensaje: '', tipo: null, visible: false });
  }, []);

  return {
    notificacion,
    mostrarNotificacion: mostrar,
    ocultarNotificacion: ocultar
  };
}