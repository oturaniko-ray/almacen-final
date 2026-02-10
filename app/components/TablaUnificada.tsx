'use client';

interface ColumnaTabla {
  titulo: string;
  clave: string;
  ancho?: string;
  alineacion?: 'left' | 'center' | 'right';
  formateador?: (valor: any) => string | React.ReactNode;
}

interface TablaUnificadaProps {
  columnas: ColumnaTabla[];
  datos: any[];
  cargando?: boolean;
  vacioMensaje?: string;
  className?: string;
}

export default function TablaUnificada({
  columnas,
  datos,
  cargando = false,
  vacioMensaje = 'No hay datos disponibles',
  className = ''
}: TablaUnificadaProps) {
  
  if (cargando) {
    return (
      <div className="bg-[#0f172a] rounded-[30px] border border-white/5 p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
        <p className="text-[10px] text-slate-500 font-bold uppercase mt-4 tracking-widest">
          CARGANDO DATOS...
        </p>
      </div>
    );
  }

  if (datos.length === 0) {
    return (
      <div className="bg-[#0f172a] rounded-[30px] border border-white/5 p-10 text-center">
        <p className="text-slate-500 font-bold uppercase text-[11px] tracking-widest">
          {vacioMensaje}
        </p>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-[30px] border border-white/5 bg-[#0f172a] ${className}`}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-black/40 text-[10px] font-black text-slate-500 uppercase italic">
            {columnas.map((col) => (
              <th 
                key={col.clave}
                className={`p-6 ${col.alineacion === 'center' ? 'text-center' : col.alineacion === 'right' ? 'text-right' : ''}`}
                style={{ width: col.ancho }}
              >
                {col.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {datos.map((fila, index) => (
            <tr key={index} className="hover:bg-white/[0.01] transition-colors">
              {columnas.map((col) => {
                const valor = fila[col.clave];
                const contenido = col.formateador ? col.formateador(valor) : valor;
                
                return (
                  <td 
                    key={`${index}-${col.clave}`}
                    className={`p-6 ${col.alineacion === 'center' ? 'text-center' : col.alineacion === 'right' ? 'text-right' : ''}`}
                  >
                    {contenido}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}