'use client';

interface MembreteSuperiorProps {
  titulo: string;
  subtitulo: string;
  usuario?: {
    nombre: string;
    nivel_acceso: number;
    permiso_reportes?: boolean;
    rol?: string;
  };
  conAnimacion?: boolean;
  mostrarUsuario?: boolean;
}

export default function MembreteSuperior({ 
  titulo, 
  subtitulo, 
  usuario, 
  conAnimacion = false, 
  mostrarUsuario = true 
}: MembreteSuperiorProps) {
  
  const renderTituloBicolor = (texto: string) => {
    const palabras = texto.split(' ');
    const ultimaPalabra = palabras.pop();
    const primerasPalabras = palabras.join(' ');
    
    return (
      <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-2">
        <span className="text-white">{primerasPalabras} </span>
        <span className="text-blue-700">{ultimaPalabra}</span>
      </h1>
    );
  };

  return (
    <div className="w-full max-w-sm bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 mb-4 text-center shadow-2xl">
      {renderTituloBicolor(titulo)}
      
      <p className={`text-white font-bold text-[17px] uppercase tracking-widest mb-3 ${conAnimacion ? 'animate-pulse-slow' : ''}`}>
        {subtitulo}
      </p>

      {mostrarUsuario && usuario && (
        <div className="mt-2 pt-2 border-t border-white/10">
          <span className="text-sm font-normal text-white uppercase block">{usuario.nombre}</span>
          <span className="text-[10px] text-white/40 uppercase font-black tracking-widest block mt-1">
            NIVEL: {usuario.nivel_acceso} 
            {usuario.rol && ` | ${usuario.rol.toUpperCase()}`}
            {usuario.permiso_reportes !== undefined && ` | REPORTES: ${usuario.permiso_reportes ? 'SÍ' : 'NO'}`}
          </span>
        </div>
      )}
    </div>
  );
}