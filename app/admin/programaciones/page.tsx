'use client';
import { useState } from 'react';

export default function ProgramacionesPage() {
  const [tipo, setTipo] = useState('turno');
  const [titulo, setTitulo] = useState('');
  const [fecha, setFecha] = useState('');
  const [mensaje, setMensaje] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await fetch('/api/programaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo,
        titulo,
        fecha_programada: new Date(fecha).toISOString(),
        destinatarios: { roles: [1,2] }, // Ejemplo: empleados nivel 1 y 2
        mensaje_template: mensaje,
      }),
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* ... tu formulario aquí ... */}
    </form>
  );
}