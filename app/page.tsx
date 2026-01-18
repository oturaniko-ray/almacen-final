'use client';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
      <div className="bg-slate-900 p-10 rounded-3xl border-2 border-blue-500 shadow-2xl text-center">
        <h1 className="text-3xl font-bold mb-4 text-blue-400">SISTEMA ALMACÉN</h1>
        <p className="text-slate-400">¡Conexión Exitosa!</p>
        <div className="mt-6 p-4 bg-slate-800 rounded-lg border border-slate-700">
          <span className="text-emerald-500 font-mono">ESTADO: ONLINE</span>
        </div>
      </div>
    </main>
  );
}