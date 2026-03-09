'use client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirmar: () => void;
  cambios: any;
  cantidad: number;
}

export function VistaPreviaCambios({ isOpen, onClose, onConfirmar, cambios, cantidad }: Props) {
  if (!isOpen || !cambios) return null;

  const getLabel = (campo: string, valor: any) => {
    switch (campo) {
      case 'nivel_acceso':
        return `Nivel de acceso: ${valor}`;
      case 'rol':
        return `Rol: ${valor}`;
      case 'activo':
        return `Estado: ${valor ? 'Activo' : 'Inactivo'}`;
      case 'sucursal_origen':
        return `Sucursal: ${valor}`;
      case 'permiso_reportes':
        return `Permiso reportes: ${valor ? 'Sí' : 'No'}`;
      default:
        return `${campo}: ${valor}`;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-md w-full">
        <h2 className="text-white font-black text-xl mb-2">CONFIRMAR CAMBIOS</h2>
        <p className="text-white/60 text-sm mb-4">
          Se aplicarán los siguientes cambios a <span className="text-blue-400 font-bold">{cantidad}</span> empleados:
        </p>

        <div className="bg-[#0f172a] p-4 rounded-xl mb-4 space-y-2">
          {Object.entries(cambios).map(([key, value]) => (
            <div key={key} className="text-white">
              <span className="text-blue-400">→</span> {getLabel(key, value)}
            </div>
          ))}
        </div>

        <p className="text-yellow-400 text-sm mb-4">
          ⚠️ Esta acción no se puede deshacer
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 rounded-lg"
          >
            CANCELAR
          </button>
          <button
            onClick={onConfirmar}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg"
          >
            CONFIRMAR
          </button>
        </div>
      </div>
    </div>
  );
}