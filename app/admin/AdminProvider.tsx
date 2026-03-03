'use client';
import { SucursalProvider } from '@/lib/SucursalContext';
import SucursalBar from './SucursalBar';

export default function AdminProvider({ children }: { children: React.ReactNode }) {
    return (
        <SucursalProvider>
            <SucursalBar />
            {/* pt-8: espacio para la barra fija cuando está visible */}
            <div className="has-sucursal-bar">
                {children}
            </div>
        </SucursalProvider>
    );
}
