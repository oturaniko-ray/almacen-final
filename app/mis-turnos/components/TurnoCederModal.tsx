'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  turno: any;
  onConfirm: (turnoId: string, motivo: string) => Promise<void>;
}

export function TurnoCederModal({ isOpen, onClose, turno, onConfirm }: Props) {
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setLoading(true);
    await onConfirm(turno.id, motivo);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-md w-full">
        <h2 className="text-white font-black text-xl mb-4">CEDER TURNO</h2>
        
        <div className="bg-[#0f172a] p-4 rounded-xl mb-4">
          <p className="text-white font-bold">
            {format(new Date(turno.fecha), 'EEEE d MMMM', { locale: es })}
          </p>
          <p className="text-blue-400 mt-1">{turno.turno?.nombre}</p>
          <p className="text-white/40 text-sm">
            {turno.turno?.hora_inicio?.slice(0,5)} - {turno.turno?.hora_fin?.slice(0,5)}
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-white/60 text-xs mb-2">MOTIVO (OPCIONAL)</label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full bg-[#0f172a] border border-white/10 rounded-lg p-3 text-white"
            rows={3}
            placeholder="Ej: Problemas personales, enfermedad, etc."
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 rounded-lg"
          >
            CANCELAR
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg disabled:opacity-50"
          >
            {loading ? 'PROCESANDO...' : 'CONFIRMAR'}
          </button>
        </div>
      </div>
    </div>
  );
}