'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ------------------------------------------------------------
// COMPONENTES VISUALES INTERNOS – ESTILO UNIFICADO
// ------------------------------------------------------------

// ----- MEMBRETE SUPERIOR -----
const MemebreteSuperior = ({ usuario }: { usuario?: any }) => (
  <div className="w-full max-w-4xl bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 mb-6 text-center shadow-2xl mx-auto">
    <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-2">
      <span className="text-white">GESTOR DE </span>
      <span className="text-blue-700">ACCESO</span>
    </h1>
    <p className="text-white font-bold text-[17px] uppercase tracking-widest mb-3">
      MENÚ PRINCIPAL
    </p>
    {usuario && (
      <div className="mt-2 pt-2 border-t border-white/10">
        <span className="text-sm text-white normal-case">{usuario.nombre}</span>
        <span className="text-sm text-white mx-2">•</span>
        <span className="text-sm text-blue-500 normal-case">
          {usuario.rol === 'admin' || usuario.rol === 'Administrador'
            ? 'Administración'
            : usuario.rol?.toUpperCase() || 'Administrador'}
        </span>
        <span className="text-sm text-white ml-2">({usuario.nivel_acceso})</span>
      </div>
    )}
  </div>
);

// ----- BOTÓN DE ACCIÓN -----
const BotonAccion = ({
  texto,
  icono,
  onClick,
  color = 'bg-blue-600',
  disabled = false,
  loading = false,
  fullWidth = true,
}: {
  texto: string;
  icono?: string;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    className={`${fullWidth ? 'w-full' : ''} ${color} p-3 rounded-xl border border-white/5 
      active:scale-95 transition-transform shadow-lg flex items-center justify-center gap-2 
      disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold uppercase text-[11px] tracking-wider`}
  >
    {icono && <span className="text-lg">{icono}</span>}
    {loading ? (
      <span className="flex items-center gap-2">
        <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
        <span className="w-2 h-2 bg-white rounded-full animate-pulse delay-150" />
        <span className="w-2 h-2 bg-white rounded-full animate-pulse delay-300" />
      </span>
    ) : (
      texto
    )}
  </button>
);

// ----- CAMPO DE ENTRADA -----
const CampoEntrada = ({
  type = 'text',
  placeholder = '',
  value,
  onChange,
  onEnter,
  autoFocus = false,
  disabled = false,
  textCentered = false,
  uppercase = false,
  className = '',
  label,
  required = false,
}: {
  type?: 'text' | 'password' | 'email' | 'number' | 'date';
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEnter?: () => void;
  autoFocus?: boolean;
  disabled?: boolean;
  textCentered?: boolean;
  uppercase?: boolean;
  className?: string;
  label?: string;
  required?: boolean;
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onEnter) onEnter();
  };

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-[8px] font-black text-slate-500 uppercase ml-2">
          {label}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        autoFocus={autoFocus}
        disabled={disabled}
        required={required}
        className={`w-full bg-white/5 border border-white/10 p-3 rounded-xl 
          text-[11px] font-bold text-white outline-none transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
          ${textCentered ? 'text-center' : ''} 
          ${uppercase ? 'uppercase' : ''}
          ${type === 'password' ? 'tracking-[0.4em]' : ''}
          focus:border-blue-500/50 hover:border-white/20
          ${className}`}
      />
    </div>
  );
};

// ----- FOOTER (VOLVER AL SELECTOR) -----
const Footer = ({ router }: { router: any }) => (
  <div className="w-full max-w-sm mt-8 pt-4 text-center mx-auto">
    <p className="text-[9px] text-white/40 uppercase tracking-widest mb-4">
      @Copyright 2026
    </p>
    <button
      onClick={() => router.push('/admin')}
      className="text-blue-500 font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 mx-auto active:scale-95 transition-transform"
    >
      <span className="text-lg">←</span> VOLVER AL SELECTOR
    </button>
  </div>
);

// ------------------------------------------------------------
// COMPONENTE PRINCIPAL – GESTIÓN DE EMPLEADOS
// ------------------------------------------------------------
export default function GestionEmpleados() {
  const [user, setUser] = useState<any>(null);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [editando, setEditando] = useState<any>(null);
  const [filtro, setFiltro] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Estado del formulario – SIN pin_seguridad
  const estadoInicial = {
    nombre: '',
    documento_id: '',
    email: '',
    rol: 'empleado',
    activo: true,
    permiso_reportes: false,
    nivel_acceso: 1,
  };
  const [nuevo, setNuevo] = useState(estadoInicial);

  // ------------------------------------------------------------
  // CARGAR SESIÓN Y DATOS
  // ------------------------------------------------------------
  const fetchEmpleados = useCallback(async () => {
    const { data } = await supabase
      .from('empleados')
      .select('*')
      .order('nombre', { ascending: true });
    if (data) setEmpleados(data);
  }, []);

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) {
      router.replace('/');
      return;
    }
    const currentUser = JSON.parse(sessionData);
    if (Number(currentUser.nivel_acceso) < 4) {
      router.replace('/');
      return;
    }
    setUser(currentUser);
    fetchEmpleados();

    const channel = supabase
      .channel('empleados_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, fetchEmpleados)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEmpleados, router]);

  // ------------------------------------------------------------
  // OPCIONES DE NIVEL SEGÚN ROL
  // ------------------------------------------------------------
  const obtenerOpcionesNivel = () => {
    const r = nuevo.rol;
    if (r === 'empleado') return [1, 2];
    if (r === 'supervisor') return [3];
    if (r === 'admin') return [4, 5, 6, 7];
    if (r === 'tecnico') return [8, 9, 10];
    return [1];
  };

  // ------------------------------------------------------------
  // GUARDAR (CREAR O ACTUALIZAR)
  // ------------------------------------------------------------
  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editando) {
        // --- ACTUALIZAR: no se regenera el PIN ---
        const { error } = await supabase
          .from('empleados')
          .update({
            nombre: nuevo.nombre,
            documento_id: nuevo.documento_id,
            email: nuevo.email.toLowerCase(),
            rol: nuevo.rol,
            activo: nuevo.activo,
            permiso_reportes: nuevo.permiso_reportes,
            nivel_acceso: nuevo.nivel_acceso,
          })
          .eq('id', editando.id);

        if (error) throw error;
      } else {
        // --- CREAR NUEVO: generar PIN automáticamente ---
        // 1. Llamar a la función de base de datos para obtener el nuevo PIN
        const { data: pinGenerado, error: pinError } = await supabase.rpc('generar_pin_personal');

        if (pinError) throw new Error('Error al generar PIN: ' + pinError.message);
        if (!pinGenerado) throw new Error('No se pudo generar el PIN');

        // 2. Insertar empleado con el PIN generado
        const { error } = await supabase.from('empleados').insert([
          {
            nombre: nuevo.nombre,
            documento_id: nuevo.documento_id,
            email: nuevo.email.toLowerCase(),
            pin_seguridad: pinGenerado,
            rol: nuevo.rol,
            activo: nuevo.activo,
            permiso_reportes: nuevo.permiso_reportes,
            nivel_acceso: nuevo.nivel_acceso,
            pin_generado_en: new Date().toISOString(),
          },
        ]);

        if (error) throw error;
      }

      cancelarEdicion();
    } catch (error: any) {
      console.error(error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // CANCELAR EDICIÓN / LIMPIAR FORMULARIO
  // ------------------------------------------------------------
  const cancelarEdicion = () => {
    setEditando(null);
    setNuevo(estadoInicial);
  };

  // ------------------------------------------------------------
  // EDITAR EMPLEADO (cargar datos en el formulario, SIN pin_seguridad)
  // ------------------------------------------------------------
  const editarEmpleado = (emp: any) => {
    setEditando(emp);
    setNuevo({
      nombre: emp.nombre,
      documento_id: emp.documento_id,
      email: emp.email,
      rol: emp.rol,
      activo: emp.activo,
      permiso_reportes: emp.permiso_reportes,
      nivel_acceso: emp.nivel_acceso,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ------------------------------------------------------------
  // EXPORTAR A EXCEL
  // ------------------------------------------------------------
  const exportarExcel = () => {
    const data = empleados.map((e) => ({
      Nombre: e.nombre,
      Documento: e.documento_id,
      Email: e.email,
      Rol: e.rol,
      Nivel: e.nivel_acceso,
      PIN: e.pin_seguridad,
      Activo: e.activo ? 'SÍ' : 'NO',
      Reportes: e.permiso_reportes ? 'SÍ' : 'NO',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Empleados');
    XLSX.writeFile(wb, `Empleados_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ------------------------------------------------------------
  // FILTRAR EMPLEADOS
  // ------------------------------------------------------------
  const empleadosFiltrados = empleados.filter(
    (e) =>
      e.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
      e.documento_id?.toLowerCase().includes(filtro.toLowerCase()) ||
      e.email?.toLowerCase().includes(filtro.toLowerCase())
  );

  // ------------------------------------------------------------
  // RENDERIZADO
  // ------------------------------------------------------------
  return (
    <main className="min-h-screen bg-black p-4 md:p-6 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        {/* MEMBRETE */}
        <MemebreteSuperior usuario={user} />

        {/* FORMULARIO DE CREACIÓN/EDICIÓN – SIN CAMPO PIN */}
        <div
          className={`bg-[#0f172a] p-6 rounded-[25px] border transition-all mb-6 ${
            editando ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/5'
          }`}
        >
          <form onSubmit={handleGuardar} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* NOMBRE COMPLETO */}
              <CampoEntrada
                label="NOMBRE COMPLETO"
                placeholder="Nombre completo"
                value={nuevo.nombre}
                onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                required
                autoFocus
              />

              {/* DOCUMENTO ID */}
              <CampoEntrada
                label="DOCUMENTO ID"
                placeholder="DNI / NIE / PASAPORTE"
                value={nuevo.documento_id}
                onChange={(e) => setNuevo({ ...nuevo, documento_id: e.target.value })}
                required
                uppercase
              />

              {/* EMAIL */}
              <CampoEntrada
                label="EMAIL"
                placeholder="correo@ejemplo.com"
                type="email"
                value={nuevo.email}
                onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })}
                required
              />

              {/* ROL */}
              <div className="flex flex-col gap-1">
                <label className="text-[8px] font-black text-slate-500 uppercase ml-2">ROL</label>
                <select
                  value={nuevo.rol}
                  onChange={(e) =>
                    setNuevo({
                      ...nuevo,
                      rol: e.target.value,
                      nivel_acceso:
                        e.target.value === 'supervisor'
                          ? 3
                          : e.target.value === 'admin'
                          ? 4
                          : e.target.value === 'tecnico'
                          ? 8
                          : 1,
                    })
                  }
                  className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-[11px] font-bold text-white outline-none focus:border-blue-500/50 uppercase tracking-wider"
                >
                  <option value="empleado">EMPLEADO</option>
                  <option value="supervisor">SUPERVISOR</option>
                  <option value="admin">ADMINISTRADOR</option>
                  <option value="tecnico">TÉCNICO</option>
                </select>
              </div>

              {/* NIVEL ACCESO */}
              <div className="flex flex-col gap-1">
                <label className="text-[8px] font-black text-slate-500 uppercase ml-2">NIVEL ACCESO</label>
                <select
                  value={nuevo.nivel_acceso}
                  onChange={(e) => setNuevo({ ...nuevo, nivel_acceso: parseInt(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-[11px] font-bold text-white outline-none focus:border-blue-500/50"
                >
                  {obtenerOpcionesNivel().map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              {/* PERMISO REPORTES */}
              <div className="flex flex-col gap-1">
                <label className="text-[8px] font-black text-slate-500 uppercase ml-2">PERMISO REPORTES</label>
                <select
                  value={nuevo.permiso_reportes ? 'si' : 'no'}
                  onChange={(e) => setNuevo({ ...nuevo, permiso_reportes: e.target.value === 'si' })}
                  className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-[11px] font-bold text-white outline-none focus:border-blue-500/50"
                >
                  <option value="no">NO</option>
                  <option value="si">SÍ</option>
                </select>
              </div>

              {/* ESTADO */}
              <div className="flex flex-col gap-1">
                <label className="text-[8px] font-black text-slate-500 uppercase ml-2">ESTADO</label>
                <select
                  value={nuevo.activo ? 'activo' : 'inactivo'}
                  onChange={(e) => setNuevo({ ...nuevo, activo: e.target.value === 'activo' })}
                  className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-[11px] font-bold text-white outline-none focus:border-blue-500/50"
                >
                  <option value="activo">ACTIVO</option>
                  <option value="inactivo">INACTIVO</option>
                </select>
              </div>
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="flex justify-end gap-3 mt-2">
              {editando && (
                <BotonAccion
                  texto="CANCELAR"
                  icono="✕"
                  color="bg-slate-600"
                  onClick={cancelarEdicion}
                />
              )}
              <BotonAccion
                texto={editando ? 'ACTUALIZAR' : 'CREAR EMPLEADO'}
                icono={editando ? '✏️' : '➕'}
                color={editando ? 'bg-amber-600' : 'bg-emerald-600'}
                onClick={() => {}}
                disabled={loading}
                loading={loading}
              />
            </div>
          </form>
        </div>

        {/* BARRA DE BÚSQUEDA Y EXPORTACIÓN */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex-1 min-w-[200px] bg-[#0f172a] p-1 rounded-xl border border-white/5 flex items-center">
            <span className="text-white/40 ml-3">🔍</span>
            <input
              type="text"
              placeholder="BUSCAR EMPLEADO..."
              className="w-full bg-transparent px-3 py-2 text-[11px] font-bold uppercase outline-none text-white"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
          </div>
          <BotonAccion
            texto="EXPORTAR EXCEL"
            icono="📊"
            color="bg-emerald-600"
            onClick={exportarExcel}
            fullWidth={false}
          />
        </div>

        {/* TABLA DE EMPLEADOS */}
        <div className="bg-[#0f172a] rounded-[25px] border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-black/40 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="p-4">Empleado</th>
                  <th className="p-4">Documento / Email</th>
                  <th className="p-4 text-center">Rol</th>
                  <th className="p-4 text-center">Nivel</th>
                  <th className="p-4 text-center">PIN</th>
                  <th className="p-4 text-center">Reportes</th>
                  <th className="p-4 text-center">Estado</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {empleadosFiltrados.map((emp) => (
                  <tr key={emp.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            emp.en_almacen
                              ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
                              : 'bg-white/20'
                          }`}
                        />
                        <span className="font-bold text-[13px] uppercase text-white">
                          {emp.nombre}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-[11px] font-mono">
                        <span className="block text-white">{emp.documento_id}</span>
                        <span className="text-slate-500 text-[10px]">{emp.email}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-[11px] font-black uppercase text-blue-400">
                        {emp.rol}
                      </span>
                    </td>
                    <td className="p-4 text-center font-black text-white">
                      {emp.nivel_acceso}
                    </td>
                    <td className="p-4 text-center">
                      <div className="group relative inline-block">
                        <span className="text-[11px] font-mono text-slate-600 group-hover:hidden tracking-widest">
                          ••••••
                        </span>
                        <span className="text-[11px] font-mono text-amber-500 hidden group-hover:block font-bold">
                          {emp.pin_seguridad}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`text-[10px] font-black px-2 py-1 rounded-full ${
                          emp.permiso_reportes
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {emp.permiso_reportes ? 'SÍ' : 'NO'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={async () => {
                          await supabase
                            .from('empleados')
                            .update({ activo: !emp.activo })
                            .eq('id', emp.id);
                        }}
                        className={`text-[10px] font-black px-3 py-1 rounded-full border ${
                          emp.activo
                            ? 'text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10'
                            : 'text-rose-500 border-rose-500/30 hover:bg-rose-500/10'
                        }`}
                      >
                        {emp.activo ? 'ACTIVO' : 'INACTIVO'}
                      </button>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => editarEmpleado(emp)}
                        className="text-blue-500 hover:text-white font-black text-[10px] uppercase px-3 py-1 rounded-lg border border-blue-500/20 hover:bg-blue-600 transition-all"
                      >
                        EDITAR
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {empleadosFiltrados.length === 0 && (
            <div className="p-10 text-center">
              <p className="text-slate-500 text-[11px] uppercase tracking-widest">
                No hay empleados que coincidan con la búsqueda.
              </p>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <Footer router={router} />
      </div>

      {/* ESTILOS GLOBALES */}
      <style jsx global>{`
        @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
      `}</style>
    </main>
  );
}