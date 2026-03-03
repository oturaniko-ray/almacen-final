'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

// 'all' = todas las sedes | 'XX' = código de sucursal específica
export type SucursalFiltro = 'all' | string;

interface SucursalContextType {
    sucursalFiltro: SucursalFiltro;
    setSucursalFiltro: (v: SucursalFiltro) => void;
    sucursales: { codigo: string; nombre: string }[];
    esCentral: boolean; // true si el usuario tiene acceso a vista global
}

const SucursalContext = createContext<SucursalContextType>({
    sucursalFiltro: 'all',
    setSucursalFiltro: () => { },
    sucursales: [],
    esCentral: false,
});

export function SucursalProvider({ children }: { children: React.ReactNode }) {
    const [sucursalFiltro, setSucursalFiltroState] = useState<SucursalFiltro>('all');
    const [sucursales, setSucursales] = useState<{ codigo: string; nombre: string }[]>([]);
    const [esCentral, setEsCentral] = useState(false);

    useEffect(() => {
        // Cargar lista de sucursales
        supabase
            .from('sucursales')
            .select('codigo, nombre')
            .eq('activa', true)
            .order('codigo')
            .then(({ data }) => { if (data) setSucursales(data); });

        // Determinar si el usuario tiene acceso a vista global
        // Sede principal = código '01' o nivel de acceso >= 5
        const session = localStorage.getItem('user_session');
        if (session) {
            try {
                const user = JSON.parse(session);
                const nivel = Number(user.nivel_acceso || 0);
                const sucOrg = String(user.sucursal_origen || '');
                const acceso = nivel >= 5 || sucOrg === '01';
                setEsCentral(acceso);
                // Si no es central, fijar el filtro a su propia sucursal
                if (!acceso && sucOrg) setSucursalFiltroState(sucOrg);
            } catch { /* sesión inválida */ }
        }

        // Restaurar preferencia guardada (solo si es usuario central)
        const saved = localStorage.getItem('admin_sucursal_filtro');
        if (saved) setSucursalFiltroState(saved);
    }, []);

    const setSucursalFiltro = (v: SucursalFiltro) => {
        setSucursalFiltroState(v);
        localStorage.setItem('admin_sucursal_filtro', v);
    };

    return (
        <SucursalContext.Provider value={{ sucursalFiltro, setSucursalFiltro, sucursales, esCentral }}>
            {children}
        </SucursalContext.Provider>
    );
}

export const useSucursalGlobal = () => useContext(SucursalContext);
