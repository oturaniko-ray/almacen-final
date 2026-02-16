'use client';
import React from 'react';

interface ModalFlotaSalidaProps {
  visible: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
  cantCarga: number;
  setCantCarga: (valor: number) => void;
  observacion: string;
  setObservacion: (valor: string) => void;
  loading: boolean;
}

export default function ModalFlotaSalida({
  visible,
  onConfirmar,
  onCancelar,
  cantCarga,
  setCantCarga,
  observacion,
  setObservacion,
  loading
}: ModalFlotaSalidaProps) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a1a1a] border-2 border-blue-500/30 rounded-[30px] p-6 max-w-sm w-full shadow-2xl animate-modal-appear">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-blue-500/30">
            <span className="text-3xl">🚛</span>
          </div>
          <h2 className="text-white font-black text-lg uppercase tracking-wider">SALIDA DE FLOTA</h2>
          <p className="text-blue-400 text-[10px] uppercase tracking-widest mt-1">INGRESE DATOS DEL DESPACHO</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-white/60 text-[9px] uppercase tracking-widest block mb-1 text-center">
              CANTIDAD DE CARGA
            </label>
            <input
              type="number"
              value={cantCarga || ''}
              onChange={(e) => setCantCarga(parseInt(e.target.value) || 0)}
              className="w-full bg-white/5 border-2 border-blue-500/30 p-4 rounded-2xl text-center text-white font-bold text-lg outline-none focus:border-blue-500 transition-all"
              placeholder="0"
              autoFocus
              min="0"
            />
          </div>

          <div>
            <label className="text-white/60 text-[9px] uppercase tracking-widest block mb-1 text-center">
              OBSERVACIÓN
            </label>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              className="w-full bg-white/5 border-2 border-blue-500/30 p-4 rounded-2xl text-center text-white font-bold text-sm outline-none focus:border-blue-500 transition-all resize-none h-24"
              placeholder="INGRESE OBSERVACIÓN..."
              maxLength={200}
            />
            <p className="text-right text-white/30 text-[8px] mt-1">
              {observacion.length}/200
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={onCancelar}
              className="flex-1 bg-slate-700 p-4 rounded-2xl text-white font-black uppercase text-sm tracking-wider hover:bg-slate-600 transition-all active:scale-95 border border-white/5"
            >
              CANCELAR
            </button>
            <button
              onClick={onConfirmar}
              disabled={loading}
              className="flex-1 bg-blue-600 p-4 rounded-2xl text-white font-black uppercase text-sm tracking-wider hover:bg-blue-500 transition-all active:scale-95 border border-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse delay-150" />
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse delay-300" />
                </span>
              ) : (
                'CONFIRMAR SALIDA'
              )}
            </button>
          </div>
        </div>

        <div className="absolute top-2 right-2">
          <button
            onClick={onCancelar}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}