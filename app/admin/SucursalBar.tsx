'use client';
import { useSucursalGlobal } from '@/lib/SucursalContext';

export default function SucursalBar() {
    const { sucursalFiltro, setSucursalFiltro, sucursales, esCentral } = useSucursalGlobal();

    // Solo aparece para usuarios con acceso central y cuando hay más de 1 sucursal
    if (!esCentral || sucursales.length <= 1) return null;

    const sedeActual = sucursales.find(s => s.codigo === sucursalFiltro);

    return (
        <div className="fixed top-0 inset-x-0 z-[9900] h-8 bg-[#080d1a] border-b border-slate-800 flex items-center px-6 gap-4 select-none">
            {/* Indicador de modo */}
            <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${sucursalFiltro === 'all' ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'}`} />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
                    {sucursalFiltro === 'all' ? 'VISTA CENTRAL — TODAS LAS SEDES' : `SEDE ${sedeActual?.codigo} — ${sedeActual?.nombre?.toUpperCase()}`}
                </span>
            </div>

            <div className="flex-1" />

            {/* Selector */}
            <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Filtrar</span>
                <select
                    value={sucursalFiltro}
                    onChange={e => setSucursalFiltro(e.target.value)}
                    className="bg-[#0f172a] border border-slate-700 text-[10px] font-black text-white uppercase outline-none rounded px-2 py-0.5 cursor-pointer"
                >
                    <option value="all">TODAS LAS SEDES</option>
                    {sucursales.map(s => (
                        <option key={s.codigo} value={s.codigo}>
                            {s.codigo} — {s.nombre.toUpperCase()}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
