/**
 * Genera un token único para vincular Telegram
 * Formato: [tipo]_[id]_[timestamp]_[random]
 * @param tipo 'emp' para empleado, 'flt' para flota
 * @param id UUID del registro
 * @returns Token único
 */
export function generarTokenUnico(tipo: 'emp' | 'flt', id: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  // Limitar ID a primeros 8 caracteres para que no sea muy largo
  const idShort = id.replace(/-/g, '').substring(0, 8);
  return `${tipo}_${idShort}_${timestamp}_${random}`;
}

/**
 * Extrae información del token
 * @param token Token a analizar
 * @returns Tipo e ID o null si no es válido
 */
export function analizarToken(token: string): { tipo: 'emp' | 'flt'; id: string } | null {
  const partes = token.split('_');
  if (partes.length !== 4) return null;
  
  const [tipo, idShort] = partes;
  if (tipo !== 'emp' && tipo !== 'flt') return null;
  
  return { tipo: tipo as 'emp' | 'flt', id: idShort };
}