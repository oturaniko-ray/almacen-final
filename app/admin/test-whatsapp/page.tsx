'use client';

import React, { useState } from 'react';

export default function TestWhatsApp() {
  const [telefono, setTelefono] = useState('+34627411370');
  const [mensaje, setMensaje] = useState('Hola, este es un mensaje de prueba del sistema de gestión.');
  const [nombre, setNombre] = useState('Empleado');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  const enviarPrueba = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setResultado(null);

    try {
      const response = await fetch('/api/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          to: telefono, 
          message: mensaje,
          nombre: nombre 
        }),
      });
      const data = await response.json();
      setResultado(data);
    } catch (error: any) {
      setResultado({ success: false, error: error.message });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-black p-8 text-white">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-black mb-6">📱 WHATSAPP - PRUEBA FINAL</h1>
        
        <div className="mb-6 p-4 bg-emerald-600/20 rounded-xl border border-emerald-500/30">
          <p className="text-sm">
            ✅ Channel ID configurado: <span className="font-mono font-bold">1</span>
          </p>
        </div>

        <form onSubmit={enviarPrueba} className="space-y-4 bg-[#0f172a] p-6 rounded-xl border border-white/10">
          <div>
            <label className="block text-sm font-black mb-2 text-slate-400">
              NOMBRE
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl p-3 text-white"
              placeholder="Nombre del empleado"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-black mb-2 text-slate-400">
              TELÉFONO (con código de país)
            </label>
            <input
              type="text"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl p-3 text-white font-mono"
              placeholder="+34612345678"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-black mb-2 text-slate-400">
              MENSAJE
            </label>
            <textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl p-3 text-white"
              rows={4}
              required
            />
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl transition-all disabled:opacity-50"
          >
            {enviando ? 'ENVIANDO...' : 'ENVIAR WHATSAPP'}
          </button>
        </form>

        {resultado && (
          <div className={`mt-6 p-4 rounded-xl ${
            resultado.success ? 'bg-emerald-600/20 border border-emerald-500/30' : 'bg-rose-600/20 border border-rose-500/30'
          }`}>
            <h3 className="font-black mb-2 text-sm">
              {resultado.success ? '✅ ENVIADO' : '❌ ERROR'}
            </h3>
            <pre className="text-xs font-mono bg-black/50 p-3 rounded-lg overflow-auto">
              {JSON.stringify(resultado, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}