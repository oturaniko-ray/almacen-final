import * as XLSX from '@e965/xlsx';

export class ExcelService {
  static crearLibro() {
    return XLSX.utils.book_new();
  }

  // ✅ CORREGIDO: Solo recibe los datos
  static crearHoja(datos: any[]) {
    return XLSX.utils.json_to_sheet(datos);
  }

  static agregarHojaAlLibro(libro: any, hoja: any, nombreHoja: string) {
    XLSX.utils.book_append_sheet(libro, hoja, nombreHoja);
  }

  static async exportar(libro: any, nombreArchivo: string) {
    XLSX.writeFile(libro, nombreArchivo);
  }

  static agregarMembrete(hoja: any, titulo: string, usuario?: any) {
    const fechaEmision = new Date().toLocaleString('es-ES', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const empleadoInfo = usuario ? `${usuario.nombre} - ${usuario.rol} (Nivel ${usuario.nivel_acceso})` : 'Sistema';
    const fechaInfo = `Fecha de emisión: ${fechaEmision}`;

    XLSX.utils.sheet_add_aoa(hoja, [[titulo]], { origin: 'A1' });
    XLSX.utils.sheet_add_aoa(hoja, [[empleadoInfo]], { origin: 'A2' });
    XLSX.utils.sheet_add_aoa(hoja, [[fechaInfo]], { origin: 'A3' });
    XLSX.utils.sheet_add_aoa(hoja, [['─────────────────────────────────────────────────────────────────']], { origin: 'A4' });

    // Mover datos a partir de la fila 6
    const newData = XLSX.utils.sheet_to_json(hoja, { header: 1, range: 5 });
    if (newData.length > 0) {
      XLSX.utils.sheet_add_aoa(hoja, newData as any[][], { origin: 'A6' });
    }
  }
}