'use client';
/**
 * useSucursalActiva — Hook para detectar la sucursal más cercana por GPS.
 * Uso: const { sucursal, deteccionando, todas, error } = useSucursalActiva();
 *
 * - `sucursal`      → sucursal detectada dentro de su radio GPS, o null
 * - `todas`         → lista completa (para selector manual si no detecta)
 * - `deteccionando` → true mientras busca
 * - `detectar()`    → llamar manualmente si se quiere re-disparar
 */

import { useState, useEffect, useCallback } from 'react';

export interface Sucursal {
    id: string;
    codigo: string;
    nombre: string;
    provincia: string;
    lat: number;
    lon: number;
    radio_maximo: number;
    encargado: string | null;
    telefono: string | null;
    email: string | null;
    activa: boolean;
    timer_token: number;
    timer_inactividad: number;
    maximo_labor: number;
    porcentaje_efectividad: number;
    empresa_nombre: string;
    created_at: string;
    updated_at: string;
}

interface UseSucursalResult {
    sucursal: Sucursal | null;
    todas: Sucursal[];
    deteccionando: boolean;
    error: string | null;
    detectar: () => void;
}

export function useSucursalActiva(): UseSucursalResult {
    const [sucursal, setSucursal] = useState<Sucursal | null>(null);
    const [todas, setTodas] = useState<Sucursal[]>([]);
    const [deteccionando, setDeteccionando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const detectar = useCallback(async () => {
        setDeteccionando(true);
        setError(null);

        try {
            // 1. Obtener GPS del dispositivo
            const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 30000,
                })
            );

            const { latitude: lat, longitude: lon } = pos.coords;

            // 2. Consultar API de detección
            const res = await fetch(`/api/sucursales/detectar?lat=${lat}&lon=${lon}`);
            const json = await res.json();

            if (json.deteccion) {
                setSucursal(json.deteccion);
            } else {
                setSucursal(null);
                if (json.sucursales) setTodas(json.sucursales);
            }
        } catch (err: any) {
            // GPS denegado → cargar todas para selector manual
            setError(err.message || 'No se pudo obtener ubicación');
            try {
                const res = await fetch('/api/sucursales?activas=true');
                const lista = await res.json();
                setTodas(lista);
            } catch { /* silencioso */ }
        } finally {
            setDeteccionando(false);
        }
    }, []);

    useEffect(() => {
        detectar();
    }, [detectar]);

    return { sucursal, todas, deteccionando, error, detectar };
}
